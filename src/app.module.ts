import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ConfigModule } from './config';
import { DatabaseModule } from './database';
import { HealthModule } from './health';

@Module({
  imports: [
    // Configuration
    ConfigModule,

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: {
          ignore: (req) => {
            // Don't log health checks and metrics
            return req.url === '/health' || req.url === '/metrics';
          },
        },
      },
    }),

    // Metrics
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),

    // Database
    DatabaseModule,

    // Health checks
    HealthModule,
  ],
})
export class AppModule {}
