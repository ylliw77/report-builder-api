import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Report Builder API')
    .setDescription('Multi-DB Report Builder & PDF Generation Engine')
    .setVersion('1.0')
    .addBearerAuth() // CMS JWT Auth
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key') // External Apps
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs on http://localhost:${port}/docs`);
}
bootstrap();
