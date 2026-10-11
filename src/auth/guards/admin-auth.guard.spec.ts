import { jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthGuard } from './admin-auth.guard';

describe('AdminAuthGuard', () => {
  let guard: AdminAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    guard = new AdminAuthGuard(jwtService as unknown as JwtService);
  });

  function createMockContext(cookies: Record<string, string> = {}, authHeader?: string): ExecutionContext {
    const request = {
      cookies,
      headers: {
        authorization: authHeader,
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('should authenticate via HTTP-only cookie', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-id',
      email: 'admin@example.com',
    });

    const context = createMockContext({ admin_token: 'valid-cookie-token' });
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-cookie-token');
  });

  it('should authenticate via Authorization Bearer header as fallback', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-id',
      email: 'admin@example.com',
    });

    const context = createMockContext({}, 'Bearer valid-header-token');
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-header-token');
  });

  it('should throw UnauthorizedException when no token is present', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

    const context = createMockContext({ admin_token: 'expired-or-invalid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
