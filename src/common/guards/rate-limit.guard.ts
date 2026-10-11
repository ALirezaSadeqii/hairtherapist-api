import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY, RATE_WINDOW_KEY } from '../decorators/rate-limit.decorator';

interface ClientRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly records = new Map<string, ClientRecord>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const limit = this.reflector.get<number>(RATE_LIMIT_KEY, handler) ?? 100;
    const windowMs = this.reflector.get<number>(RATE_WINDOW_KEY, handler) ?? 60000;

    const request = context.switchToHttp().getRequest<Request>();
    const rawForwarded = request.headers['x-forwarded-for'];
    const ip =
      (typeof rawForwarded === 'string'
        ? rawForwarded.split(',')[0].trim()
        : Array.isArray(rawForwarded) && rawForwarded.length > 0
          ? rawForwarded[0].split(',')[0].trim()
          : null) ||
      request.ip ||
      request.socket.remoteAddress ||
      '127.0.0.1';

    const routeIdentifier = `${context.getClass().name}:${handler.name}`;
    const clientKey = `${ip}:${routeIdentifier}`;

    const now = Date.now();
    const existing = this.records.get(clientKey);

    if (!existing || now > existing.resetAt) {
      this.records.set(clientKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (existing.count >= limit) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again after ${retryAfterSec} seconds.`,
          retryAfter: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count++;
    return true;
  }
}
