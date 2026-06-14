import * as Joi from 'joi';

export const workerEnvValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_ENV: Joi.string().default('local'),
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
  WORKER_QUEUE_NAME: Joi.string().default('bootstrap-jobs'),
});
