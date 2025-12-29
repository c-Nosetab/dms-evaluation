import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProcessingService } from './processing.service';
import { ProcessingProcessor } from './processing.processor';
import { ProcessingController } from './processing.controller';
import { PROCESSING_QUEUE } from './processing.types';
import { StorageModule } from '../storage';

// Note: BullModule.forRootAsync() is configured in AppModule for global access
// This module only configures the queue-specific options for processing jobs

@Module({
  imports: [
    StorageModule,
    // Configure queue-specific job options (root config is in AppModule)
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
  exports: [ProcessingService, BullModule],
})
export class ProcessingModule {}
