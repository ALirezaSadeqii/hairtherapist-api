import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { admin?: { id: string; email: string } }>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required to access administrator endpoints.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.admin = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication session.');
    }
  }

  private extractToken(request: Request): string | null {
    // 1. Prefer HTTP-only cookie
    if (request.cookies && typeof request.cookies['admin_token'] === 'string') {
      return request.cookies['admin_token'];
    }

    // 2. Fallback to Authorization Bearer header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
