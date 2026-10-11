import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  root(@Res() res: Response): void {
    res.redirect('/api');
  }

  @Get('health')
  @ApiExcludeEndpoint()
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
