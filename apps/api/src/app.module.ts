import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { apiEnvValidationSchema } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { MarketplacesModule } from './modules/marketplaces/marketplaces.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ShopsModule } from './modules/shops/shops.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: apiEnvValidationSchema,
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    MarketplacesModule,
    ShopsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
