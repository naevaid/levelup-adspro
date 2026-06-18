import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.appService.getReadiness();

    if (readiness.status !== 'ok') {
      response.status(503);
    }

    return readiness;
  }
}
