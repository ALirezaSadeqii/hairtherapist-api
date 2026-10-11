import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  formatCalendarDate,
  parseCalendarDate,
  parseMonth,
} from '../common/utils/date.util';

export interface DayAvailability {
  date: string;
  available: boolean;
}

export interface AvailabilityResponse {
  month: string;
  days: DayAvailability[];
}

export interface PublicAppointmentResponse {
  id: string;
  customerName: string;
  email?: string | null;
  phone: string;
  date: string;
  status: string;
  createdAt: Date;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns calendar availability for a given month.
   * Never exposes any customer personal details.
   */
  async getAvailability(monthStr: string): Promise<AvailabilityResponse> {
    const parsed = parseMonth(monthStr);

    // Fetch only dates with CONFIRMED appointments in this month
    const confirmedAppointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: parsed.startDate,
          lte: parsed.endDate,
        },
        status: 'CONFIRMED',
      },
      select: {
        date: true,
      },
    });

    const bookedDateSet = new Set(
      confirmedAppointments.map((app) => formatCalendarDate(app.date)),
    );

    const days: DayAvailability[] = parsed.allDays.map((dateStr) => ({
      date: dateStr,
      available: !bookedDateSet.has(dateStr),
    }));

    return {
      month: parsed.monthString,
      days,
    };
  }

  /**
   * Creates a guest customer booking for a date.
   * Enforces uniqueness at application level and through PostgreSQL partial unique index.
   */
  async createAppointment(
    dto: CreateAppointmentDto,
  ): Promise<PublicAppointmentResponse> {
    const calendarDate = parseCalendarDate(dto.date);

    // 1. Application-level pre-check
    const existing = await this.prisma.appointment.findFirst({
      where: {
        date: calendarDate,
        status: 'CONFIRMED',
      },
    });

    if (existing) {
      throw new ConflictException(
        `The date ${dto.date} is already booked. Please choose another date.`,
      );
    }

    // 2. Database insert with PostgreSQL unique index protection
    try {
      const created = await this.prisma.appointment.create({
        data: {
          customerName: dto.customerName,
          email: dto.email ?? null,
          phone: dto.phone,
          date: calendarDate,
          status: 'CONFIRMED',
        },
      });

      this.logger.log(`Created confirmed appointment on date ${dto.date}`);

      return {
        id: created.id,
        customerName: created.customerName,
        email: created.email,
        phone: created.phone ?? dto.phone,
        date: formatCalendarDate(created.date),
        status: created.status,
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Concurrent race condition handled safely by PostgreSQL partial unique index
        this.logger.warn(
          `Concurrent conflict detected by PostgreSQL unique index for date: ${dto.date}`,
        );
        throw new ConflictException(
          `The date ${dto.date} is already booked. Please choose another date.`,
        );
      }
      throw error;
    }
  }

  /**
   * Admin endpoint: Returns all appointments for the requested month with customer details.
   */
  async getAdminAppointments(monthStr: string) {
    const parsed = parseMonth(monthStr);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: parsed.startDate,
          lte: parsed.endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return appointments.map((app) => ({
      ...app,
      date: formatCalendarDate(app.date),
    }));
  }

  /**
   * Admin endpoint: Returns details of a single appointment.
   */
  async getAppointmentById(id: string) {
    this.validateUuid(id);

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} was not found.`);
    }

    return {
      ...appointment,
      date: formatCalendarDate(appointment.date),
    };
  }

  /**
   * Admin endpoint: Cancels an appointment and frees its date for future bookings.
   */
  async cancelAppointment(id: string) {
    this.validateUuid(id);

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} was not found.`);
    }

    if (appointment.status === 'CANCELLED') {
      return {
        message: 'Appointment was already cancelled.',
        appointment: {
          ...appointment,
          date: formatCalendarDate(appointment.date),
        },
      };
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(
      `Appointment ${id} cancelled. Date ${formatCalendarDate(updated.date)} is now available.`,
    );

    return {
      message: 'Appointment successfully cancelled. The date is now available for new bookings.',
      appointment: {
        ...updated,
        date: formatCalendarDate(updated.date),
      },
    };
  }

  private validateUuid(id: string): void {
    if (!id || !UUID_REGEX.test(id)) {
      throw new BadRequestException(`Invalid appointment ID format: ${id}. Expected a valid UUID.`);
    }
  }
}
