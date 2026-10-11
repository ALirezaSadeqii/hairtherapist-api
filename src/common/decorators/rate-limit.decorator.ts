import { applyDecorators, SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_WINDOW_KEY = 'rate_window';

/**
 * Idiomatic NestJS decorator for setting rate limiting limits on endpoints.
 * @param limit Maximum number of requests allowed in the time window
 * @param windowMs Time window in milliseconds (default: 60,000 ms / 1 minute)
 */
export const RateLimit = (limit: number, windowMs = 60000) => {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, limit),
    SetMetadata(RATE_WINDOW_KEY, windowMs),
  );
};
