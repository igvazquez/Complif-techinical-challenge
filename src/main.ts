import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  // Connect RabbitMQ microservice
  const rabbitmqUrl = configService.get<string>('rabbitmq.url');
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'transactions',
      queueOptions: {
        durable: true,
      },
      noAck: false,
    },
  });

  // Use Pino for logging
  app.useLogger(app.get(PinoLogger));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Rules Engine API')
    .setDescription(
      'Real-time rules engine for detecting suspicious transactions',
    )
    .setVersion('1.0')
    .addServer('/api')
    .addTag('rules', 'Rule management endpoints')
    .addTag('templates', 'Rule template management')
    .addTag('transactions', 'Transaction evaluation')
    .addTag('alerts', 'Alert management')
    .addTag('lists', 'Blacklist/Whitelist management')
    .addTag('organizations', 'Organization management')
    .addTag('health', 'Health check endpoints')
    .addApiKey(
      { type: 'apiKey', name: 'x-organization-id', in: 'header' },
      'organization-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Enable CORS
  app.enableCors();

  // Set global prefix for API routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'metrics'],
  });

  const port = process.env.PORT || 3000;

  // Start all microservices
  await app.startAllMicroservices();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
  logger.log('RabbitMQ microservice connected to transactions queue');
}

bootstrap();
