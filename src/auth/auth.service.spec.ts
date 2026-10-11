import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    admin: {
      findUnique: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  const mockAdminId = '99999999-9999-9999-9999-999999999999';
  const mockEmail = 'admin@beautysalon.com';
  const mockPassword = 'supersecretpassword';
  const mockHash = bcrypt.hashSync(mockPassword, 10);

  beforeEach(async () => {
    prisma = {
      admin: {
        findUnique: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return token and admin info with valid credentials', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: mockAdminId,
        email: mockEmail,
        passwordHash: mockHash,
      });

      const result = await service.login({
        email: mockEmail,
        password: mockPassword,
      });

      expect(result.token).toBe('signed-jwt-token');
      expect(result.admin.id).toBe(mockAdminId);
      expect(result.admin.email).toBe(mockEmail);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockAdminId,
        email: mockEmail,
      });
    });

    it('should throw UnauthorizedException with wrong password (no user enumeration)', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: mockAdminId,
        email: mockEmail,
        passwordHash: mockHash,
      });

      await expect(
        service.login({
          email: mockEmail,
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with non-existent email (same generic message)', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: mockPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return admin profile without passwordHash', async () => {
      prisma.admin.findUnique.mockResolvedValue({
        id: mockAdminId,
        email: mockEmail,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const profile = await service.getProfile(mockAdminId);

      expect(profile.id).toBe(mockAdminId);
      expect(profile.email).toBe(mockEmail);
      expect((profile as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
    });

    it('should throw UnauthorizedException if admin not found', async () => {
      prisma.admin.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
