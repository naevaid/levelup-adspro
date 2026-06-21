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
  APP_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).default(60),
  MAIL_MAILER: Joi.string().default('smtp'),
  MAIL_HOST: Joi.string().default('localhost'),
  MAIL_PORT: Joi.number().port().default(465),
  MAIL_USERNAME: Joi.string().allow('').default(''),
  MAIL_PASSWORD: Joi.string().allow('').default(''),
  MAIL_ENCRYPTION: Joi.string().valid('ssl', 'tls', 'starttls', 'none').default('ssl'),
  MAIL_FROM_ADDRESS: Joi.string().email().default('no-reply@example.com'),
  MAIL_FROM_NAME: Joi.string().default('LevelUP adsPRO'),
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
