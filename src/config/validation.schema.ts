import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().default('rules_user'),
  DATABASE_PASSWORD: Joi.string().default('rules_password'),
  DATABASE_NAME: Joi.string().default('rules_engine'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // RabbitMQ
  RABBITMQ_URL: Joi.string().default(
    'amqp://rules_user:rules_password@localhost:5672',
  ),

  // Rule Engine
  MAX_TIME_WINDOW_DAYS: Joi.number().default(30),
  RULE_CACHE_TTL_SECONDS: Joi.number().default(300),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal')
    .default('debug'),
});
