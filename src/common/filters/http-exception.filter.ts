import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message: string | string[] }).message;
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: Unique constraint failed
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'This date already has a confirmed appointment. Please select another date.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found.';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Database operation failed.';
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
      }
    } else {
      this.logger.error('Unhandled exception caught by global filter', exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
