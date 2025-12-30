import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for Next.js frontend
  app.enableCors({
    origin:
      process.env.CORS_ORIGIN ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000',
    credentials: true,
  });

  // Parse cookies for session authentication
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3001);
  console.log(`API server is running on port ${process.env.PORT ?? 3001}`);
}
void bootstrap();
