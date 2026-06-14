import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHealth() {
    return {
      appEnv: this.configService.get<string>('APP_ENV', 'local'),
      port: this.configService.get<number>('PORT', 3001),
      service: 'api',
      status: 'ok',
    } as const;
  }
}
