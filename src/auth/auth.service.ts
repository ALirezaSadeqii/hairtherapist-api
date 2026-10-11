import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export interface AdminProfileResponse {
  id: string;
  email: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates credentials and returns signed JWT token.
   * Uses generic error messages to prevent email enumeration attacks.
   */
  async login(loginDto: LoginDto): Promise<{ token: string; admin: { id: string; email: string } }> {
    const admin = await this.prisma.admin.findUnique({
      where: { email: loginDto.email },
    });

    if (!admin) {
      this.logger.warn(`Failed login attempt for email: ${loginDto.email} (not found)`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, admin.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt for email: ${loginDto.email} (incorrect password)`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload = { sub: admin.id, email: admin.email };
    const token = await this.jwtService.signAsync(payload);

    this.logger.log(`Admin logged in successfully: ${admin.email}`);
    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    };
  }

  /**
   * Retrieves profile for the authenticated admin.
   * Never includes passwordHash in response.
   */
  async getProfile(adminId: string): Promise<AdminProfileResponse> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account not found.');
    }

    return admin;
  }
}
