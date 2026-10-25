import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpRequestLoggerMiddleware } from './common/middleware/http-request.logger.middleware';

const logger = new Logger('IdentityService');

const LOG_LEVELS: Record<string, string[]> = {
  error: ['error'],
  warn: ['error', 'warn'],
  log: ['error', 'warn', 'log'],
  debug: ['error', 'warn', 'log', 'debug'],
  verbose: ['error', 'warn', 'log', 'debug', 'verbose'],
};

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL ?? 'log').toLowerCase();
  const levels = LOG_LEVELS[logLevel] ?? LOG_LEVELS['log'];

  const app = await NestFactory.create(AppModule, {
    logger: levels as ('debug' | 'verbose' | 'error' | 'warn' | 'log' | 'fatal')[],
    // Buffer logs until the request logger middleware is registered so
    // bootstrap messages are not lost.
    bufferLogs: true,
  });

  const requestLogger = new HttpRequestLoggerMiddleware();
  app.use((req, res, next) => requestLogger.use(req, res, next));

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RxSoft Identity Service')
    .setDescription('User, authentication, organization and location management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 8092);
  await app.listen(port);
  logger.log(`Identity service running on port ${port}`);
  logger.log(`Log level: ${logLevel}`);
}

void bootstrap();
