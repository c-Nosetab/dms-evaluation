import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { DATABASE_CONNECTION } from './database';
import type { Database } from './database';
import { sql } from 'drizzle-orm';
import { Public, CurrentUser } from './auth';
import type { AuthUser } from './auth/auth.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    @InjectQueue('processing') private readonly processingQueue: Queue,
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

    // Test Redis connection via BullMQ queue
    try {
      await this.processingQueue.client;
      result.redis = 'connected';
    } catch (error) {
      result.status = 'error';
      const redisError = `Redis: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.error = result.error ? `${result.error}; ${redisError}` : redisError;
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
