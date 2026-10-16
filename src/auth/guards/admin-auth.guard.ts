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
    const tokens = this.extractTokens(request);

    if (tokens.length === 0) {
      throw new UnauthorizedException('Authentication required to access administrator endpoints.');
    }

    for (const token of tokens) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        request.admin = {
          id: payload.sub,
          email: payload.email,
        };
        return true;
      } catch {
        // Continue to next token if available
      }
    }

    throw new UnauthorizedException('Invalid or expired authentication session.');
  }

  private extractTokens(request: Request): string[] {
    const tokens: string[] = [];

    // 1. Authorization Bearer header (takes priority if provided)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const headerToken = authHeader.substring(7).trim();
      if (headerToken) {
        tokens.push(headerToken);
      }
    }

    // 2. HTTP-only cookie
    if (request.cookies && typeof request.cookies['admin_token'] === 'string') {
      tokens.push(request.cookies['admin_token']);
    }

    return tokens;
  }
}
