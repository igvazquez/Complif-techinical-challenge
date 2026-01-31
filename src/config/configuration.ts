export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'rules_user',
    password: process.env.DATABASE_PASSWORD || 'rules_password',
    name: process.env.DATABASE_NAME || 'rules_engine',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  rabbitmq: {
    url:
      process.env.RABBITMQ_URL ||
      'amqp://rules_user:rules_password@localhost:5672',
  },

  ruleEngine: {
    maxTimeWindowDays: parseInt(process.env.MAX_TIME_WINDOW_DAYS || '30', 10),
    ruleCacheTtlSeconds: parseInt(
      process.env.RULE_CACHE_TTL_SECONDS || '300',
      10,
    ),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
});
