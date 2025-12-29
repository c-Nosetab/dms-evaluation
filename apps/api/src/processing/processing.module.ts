import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ProcessingService } from './processing.service';
import { ProcessingProcessor } from './processing.processor';
import { ProcessingController } from './processing.controller';
import { PROCESSING_QUEUE } from './processing.types';
import { StorageModule } from '../storage';

@Module({
  imports: [
    StorageModule,
    ConfigModule,
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
    BullModule.registerQueue({
      name: PROCESSING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    }),
  ],
  controllers: [ProcessingController],
  providers: [ProcessingService, ProcessingProcessor],
  exports: [ProcessingService],
})
export class ProcessingModule {}
