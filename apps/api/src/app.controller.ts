import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';
import { DATABASE_CONNECTION } from './database';
import type { Database } from './database';
import { sql } from 'drizzle-orm';
import { Public, CurrentUser } from './auth';
import type { AuthUser } from './auth/auth.service';
import Redis from 'ioredis';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async healthCheck() {
    const result: {
      status: 'ok' | 'error';
      database: 'connected' | 'disconnected';
      redis: 'connected' | 'disconnected';
      timestamp: string;
      error?: string;
    } = {
      status: 'ok',
      database: 'disconnected',
      redis: 'disconnected',
      timestamp: new Date().toISOString(),
    };

    // Test database connection
    try {
      await this.db.execute(sql`SELECT 1`);
      result.database = 'connected';
    } catch (error) {
      result.status = 'error';
      result.error = `Database: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // Test Redis connection directly
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      let redis: Redis | null = null;
      try {
        redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          lazyConnect: true,
        });
        await redis.connect();
        await redis.ping();
        result.redis = 'connected';
      } catch (error) {
        result.status = 'error';
        const redisError = `Redis: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.error = result.error
          ? `${result.error}; ${redisError}`
          : redisError;
      } finally {
        if (redis) {
          redis.disconnect();
        }
      }
    } else {
      result.redis = 'disconnected';
    }

    return result;
  }

  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  }
}
