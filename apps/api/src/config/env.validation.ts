import * as Joi from 'joi';

export const apiEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_ENV: Joi.string().default('local'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .default('postgresql://levelup:levelup@localhost:5432/levelup_adspro'),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis'] })
    .default('redis://localhost:6379'),
  MINIO_ENDPOINT: Joi.string().default('localhost'),
  MINIO_PORT: Joi.number().port().default(9000),
  MINIO_USE_SSL: Joi.boolean().default(false),
  MINIO_ACCESS_KEY: Joi.string().default('levelup'),
  MINIO_SECRET_KEY: Joi.string().default('levelup123'),
  MINIO_BUCKET_RAW_CAPTURE: Joi.string().default('raw-capture'),
  MINIO_BUCKET_EXPORTS: Joi.string().default('exports'),
  JWT_SECRET: Joi.string().min(8).default('replace-me-in-local'),
  SESSION_TTL_HOURS: Joi.number().integer().min(1).default(168),
  PAYMENT_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://payment.naeva.id/api/v1'),
  PAYMENT_APP_ID: Joi.string().default('replace-with-payment-app-id'),
  PAYMENT_SECRET_KEY: Joi.string().min(8).default('replace-with-payment-secret-key'),
  BILLING_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/api/billing/payment/callback'),
  BILLING_RENEWAL_LEAD_DAYS: Joi.number().integer().min(1).default(3),
  BILLING_GRACE_PERIOD_DAYS: Joi.number().integer().min(1).default(7),
  BILLING_UNSUCCESSFUL_TRANSACTION_RETENTION_HOURS: Joi.number()
    .integer()
    .min(1)
    .default(24),
});
