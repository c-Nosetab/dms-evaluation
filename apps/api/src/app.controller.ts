import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { DATABASE_CONNECTION } from './database';
import type { Database } from './database';
import { sql } from 'drizzle-orm';
import { Public, CurrentUser } from './auth';
import type { AuthUser } from './auth/auth.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  async healthCheck() {
    try {
      // Test database connection
      await this.db.execute(sql`SELECT 1`);
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
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
