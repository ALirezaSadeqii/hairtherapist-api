import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local first if it exists, then fallback to .env
const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
}
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security HTTP headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to render assets cleanly
    }),
  );

  // Parse HTTP-only cookies
  app.use(cookieParser());

  // Explicit CORS configuration for the Next.js frontend
  const allowedOrigins = [
    'http://localhost:3000',
    'https://hairtherapist.vercel.app',
    ...(process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
      : []),
  ];

  // Deduplicate
  const uniqueOrigins = [...new Set(allowedOrigins)];
  logger.log(`CORS allowed origins: ${uniqueOrigins.join(', ')}`);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (uniqueOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin '${origin}' not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  // Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // Centralized Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interactive Swagger API Documentation for Browser Viewing & Testing
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Beauty Salon Appointment Booking API')
    .setDescription(
      'Interactive API documentation for beauty salon daily bookings, availability calendar, and administrator management.',
    )
    .setVersion('1.0')
    .addTag('appointments', 'Public availability & booking, plus admin management')
    .addTag('auth', 'Administrator authentication & session')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`=======================================================`);
  logger.log(`🚀 Beauty Salon Backend running at: http://localhost:${port}`);
  logger.log(`📖 Interactive API Documentation:   http://localhost:${port}/api`);
  logger.log(`=======================================================`);
}

void bootstrap();
