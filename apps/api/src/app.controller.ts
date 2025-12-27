import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { DATABASE_CONNECTION } from './database';
import { sql } from 'drizzle-orm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(DATABASE_CONNECTION) private readonly db: any,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

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
}
