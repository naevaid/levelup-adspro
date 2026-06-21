import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { apiEnvValidationSchema } from './config/env.validation';
import { BillingModule } from './modules/billing/billing.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExtensionSessionsModule } from './modules/extension-sessions/extension-sessions.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InternalPlansModule } from './modules/internal-plans/internal-plans.module';
import { InternalMonitoringModule } from './modules/internal-monitoring/internal-monitoring.module';
import { MarketplaceCategoryFeesModule } from './modules/marketplace-category-fees/marketplace-category-fees.module';
import { MarketplacesModule } from './modules/marketplaces/marketplaces.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RawDataModule } from './modules/raw-data/raw-data.module';
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
    BillingModule,
    OrganizationsModule,
    MarketplacesModule,
    MarketplaceCategoryFeesModule,
    InternalPlansModule,
    InternalMonitoringModule,
    ShopsModule,
    ExtensionSessionsModule,
    RawDataModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
