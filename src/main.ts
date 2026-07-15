import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Express 5 defaults to the "simple" query parser; "extended" is needed
  // so nested filters like filter[price][gte]=1000 parse into objects.
  app.set('query parser', 'extended');

  // Behind nginx, req.ip is the proxy's address unless we trust X-Forwarded-For
  // — which would bucket every anonymous visitor into one rate-limit key and
  // record the wrong IP in the audit log. Off by default: trusting the header
  // when there is no proxy in front lets clients spoof their address.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set('trust proxy', Number(trustProxy) || trustProxy);
  }

  app.use(cookieParser());

  // The admin panel sends its refresh cookie cross-origin, which needs an
  // explicit origin + credentials: the wildcard is illegal with credentials,
  // and reflecting *any* origin with them would let a hostile site call
  // /auth/refresh and read back a fresh access token. So credentials are
  // granted only to ADMIN_ORIGINS; every other origin keeps the open,
  // cookie-less access the public Content API is consumed with.
  const adminOrigins = (process.env.ADMIN_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors((req: Request, cb) => {
    const origin = req.headers.origin;
    cb(null, {
      origin: true,
      credentials: !!origin && adminOrigins.includes(origin),
    });
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ModernWeb CMS API')
    .setDescription('Multi-website headless CMS')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `ModernWeb CMS running on http://localhost:${port} (docs at /docs)`,
  );
}

void bootstrap();
