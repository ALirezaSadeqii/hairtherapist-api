import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
    appointment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      appointment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  describe('getAvailability', () => {
    it('should calculate availability correctly without exposing customer details', async () => {
      // Confirmed appointment on 2026-10-15
      prisma.appointment.findMany.mockResolvedValue([
        { date: new Date('2026-10-15T00:00:00.000Z') },
      ]);

      const result = await service.getAvailability('2026-10');

      expect(result.month).toBe('2026-10');
      expect(result.days.length).toBe(31);

      const day15 = result.days.find((d) => d.date === '2026-10-15');
      expect(day15?.available).toBe(false);

      const day1 = result.days.find((d) => d.date === '2026-10-01');
      expect(day1?.available).toBe(true);

      // Verify that no customer fields exist in the response
      expect(JSON.stringify(result)).not.toContain('customerName');
      expect(JSON.stringify(result)).not.toContain('email');
      expect(JSON.stringify(result)).not.toContain('phone');
    });

    it('should treat months with no confirmed bookings as all available', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability('2026-11');
      expect(result.days.length).toBe(30);
      expect(result.days.every((d) => d.available)).toBe(true);
    });
  });

  describe('createAppointment', () => {
    const validDto: CreateAppointmentDto = {
      customerName: 'Alice Smith',
      email: 'alice@example.com',
      phone: '523 434 1223',
      date: '2026-10-20',
    };

    it('should successfully create an appointment when date is free', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        customerName: 'Alice Smith',
        email: 'alice@example.com',
        phone: '523 434 1223',
        date: new Date('2026-10-20T00:00:00.000Z'),
        status: 'CONFIRMED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await service.createAppointment(validDto);

      expect(response.id).toBe('11111111-1111-1111-1111-111111111111');
      expect(response.date).toBe('2026-10-20');
      expect(response.status).toBe('CONFIRMED');
      expect(response.customerName).toBe('Alice Smith');
      expect(response.phone).toBe('523 434 1223');
    });

    it('should successfully create an appointment when email is omitted', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        customerName: 'Bob Brown',
        email: null,
        phone: '523 434 1223',
        date: new Date('2026-10-21T00:00:00.000Z'),
        status: 'CONFIRMED',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await service.createAppointment({
        customerName: 'Bob Brown',
        phone: '523 434 1223',
        date: '2026-10-21',
      });

      expect(response.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(response.email).toBeNull();
      expect(response.phone).toBe('523 434 1223');
    });

    it('should throw ConflictException on duplicate booking for the same date', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'existing-id',
        date: new Date('2026-10-20T00:00:00.000Z'),
        status: 'CONFIRMED',
      });

      await expect(service.createAppointment(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should translate PostgreSQL P2002 unique constraint error into ConflictException (concurrent race safety)', async () => {
      // Application check passes (e.g. race condition)
      prisma.appointment.findFirst.mockResolvedValue(null);

      // But database rejects concurrent insert with unique index violation
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on appointments_date_confirmed_unique',
        {
          code: 'P2002',
          clientVersion: '7.10.0',
        },
      );
      prisma.appointment.create.mockRejectedValue(p2002Error);

      await expect(service.createAppointment(validDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('cancelAppointment', () => {
    const validId = '11111111-1111-1111-1111-111111111111';

    it('should cancel an existing appointment and mark date as available', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        id: validId,
        date: new Date('2026-10-20T00:00:00.000Z'),
        status: 'CONFIRMED',
      });
      prisma.appointment.update.mockResolvedValue({
        id: validId,
        date: new Date('2026-10-20T00:00:00.000Z'),
        status: 'CANCELLED',
      });

      const result = await service.cancelAppointment(validId);

      expect(result.message).toContain('successfully cancelled');
      expect(result.appointment.status).toBe('CANCELLED');
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: validId },
        data: { status: 'CANCELLED' },
      });
    });

    it('should handle repeated cancellation predictably (idempotent)', async () => {
      prisma.appointment.findUnique.mockResolvedValue({
        id: validId,
        date: new Date('2026-10-20T00:00:00.000Z'),
        status: 'CANCELLED',
      });

      const result = await service.cancelAppointment(validId);

      expect(result.message).toContain('already cancelled');
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(service.cancelAppointment(validId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if id is not a valid UUID', async () => {
      await expect(service.cancelAppointment('invalid-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
