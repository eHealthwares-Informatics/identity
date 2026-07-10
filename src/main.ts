import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseSeedService } from './database/seeding.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, transformOptions: { enableImplicitConversion: true } }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RxSoft Identity Service')
    .setDescription('User, authentication, organization and location management')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.get(DatabaseSeedService).runSeedsOnStartup();

  const port = app.get(ConfigService).get<number>('PORT', 8092);
  await app.listen(port);
  console.log(`Identity service running on port ${port}`);
}

void bootstrap();
