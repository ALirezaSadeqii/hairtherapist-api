import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Public: Check calendar availability for a month.
   */
  @Get('availability')
  @ApiOperation({
    summary: 'Check monthly availability',
    description:
      'Returns calendar dates and availability status for a selected month. Never reveals customer details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar availability returned successfully',
  })
  async getAvailability(@Query() query: MonthQueryDto) {
    return this.appointmentsService.getAvailability(query.month);
  }

  /**
   * Public: Guest customer booking for a date.
   */
  @Post()
  @ApiOperation({
    summary: 'Book an appointment',
    description:
      'Guest booking for a specific calendar date. Rejects duplicate bookings with 409 Conflict.',
  })
  @ApiResponse({ status: 201, description: 'Appointment confirmed' })
  @ApiResponse({ status: 409, description: 'Date already booked' })
  @RateLimit(15, 60000)
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.createAppointment(dto);
  }

  /**
   * Admin: List all appointments for the requested month with customer details.
   */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List monthly appointments (Admin only)',
    description:
      'Returns all appointments for the requested month including customer contact details.',
  })
  @UseGuards(AdminAuthGuard)
  async getAdminAppointments(@Query() query: MonthQueryDto) {
    return this.appointmentsService.getAdminAppointments(query.month);
  }

  /**
   * Admin: Get a single appointment by UUID.
   */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get appointment details by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @UseGuards(AdminAuthGuard)
  async getAppointmentById(@Param('id') id: string) {
    return this.appointmentsService.getAppointmentById(id);
  }

  /**
   * Admin: Cancel an appointment. Frees the calendar date for new bookings.
   */
  @Patch(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel an appointment (Admin only)',
    description:
      'Cancels the appointment and immediately frees its date for new customer bookings.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @UseGuards(AdminAuthGuard)
  async cancelAppointment(@Param('id') id: string) {
    return this.appointmentsService.cancelAppointment(id);
  }
}
