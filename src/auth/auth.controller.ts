import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import type { AuthenticatedAdmin } from './interfaces/jwt-payload.interface';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

export const ADMIN_COOKIE_NAME = 'admin_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Administrator login with email and password' })
  @RateLimit(5, 60000) // Stricter rate limit: 5 login attempts per minute per IP
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, admin } = await this.authService.login(loginDto);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    response.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: cookieMaxAge,
      path: '/',
    });

    return {
      message: 'Logged in successfully.',
      admin,
      token, // Also provided in payload for clients preferring bearer authorization
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Administrator logout (clears session cookie)' })
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    response.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully.' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current administrator profile' })
  @UseGuards(AdminAuthGuard)
  async getMe(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.authService.getProfile(admin.id);
  }
}
