import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AppointmentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
