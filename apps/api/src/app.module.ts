import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database';
import { AuthModule, SessionAuthGuard } from './auth';
import { StorageModule } from './storage';
import { FilesModule } from './files';
import { FoldersModule } from './folders';
import { ProcessingModule } from './processing';
import { PROCESSING_QUEUE } from './processing/processing.types';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../../.env.local'],
    }),
    // Global BullMQ configuration - makes Redis available app-wide
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not configured');
        }
        return {
          connection: {
            url: redisUrl,
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register the processing queue at root level for health check access
    BullModule.registerQueue({
      name: PROCESSING_QUEUE,
    }),
    DatabaseModule,
    AuthModule,
    StorageModule,
    FilesModule,
    FoldersModule,
    ProcessingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
