import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  PROCESSING_QUEUE,
  ProcessingJobData,
  ProcessingJobResult,
  ProcessingStatus,
  PdfSplitJobData,
  ImageConvertJobData,
  OcrJobData,
  PdfThumbnailJobData,
} from './processing.types';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    @InjectQueue(PROCESSING_QUEUE) private readonly processingQueue: Queue,
  ) {}

  /**
   * Queue a PDF split job.
   * Splits a PDF into individual pages, each saved as a separate file.
   */
  async queuePdfSplit(
    fileId: string,
    userId: string,
    storageKey: string,
    filename: string,
    outputNamePrefix?: string,
    folderId?: string,
  ): Promise<string> {
    // Default name: "filename copy" -> "filename copy 1", "filename copy 2", etc.
    const baseName = filename.replace(/\.pdf$/i, '');
    const prefix = outputNamePrefix || `${baseName} copy`;

    const jobData: PdfSplitJobData = {
      type: 'pdf-split',
      fileId,
      userId,
      storageKey,
      filename,
      outputNamePrefix: prefix,
      folderId,
    };

    const job = await this.processingQueue.add('pdf-split', jobData, {
      priority: 2, // Normal priority
    });

    this.logger.log(`Queued PDF split job ${job.id} for file ${fileId}`);
    return job.id!;
  }

  /**
   * Queue an image conversion job.
   * Converts an image to PNG, JPEG, or WebP format.
   */
  async queueImageConvert(
    fileId: string,
    userId: string,
    storageKey: string,
    filename: string,
    targetFormat: 'png' | 'jpeg' | 'webp',
    quality = 80,
    folderId?: string,
  ): Promise<string> {
    const jobData: ImageConvertJobData = {
      type: 'image-convert',
      fileId,
      userId,
      storageKey,
      filename,
      targetFormat,
      quality,
      folderId,
    };

    const job = await this.processingQueue.add('image-convert', jobData, {
      priority: 2,
    });

    this.logger.log(
      `Queued image convert job ${job.id} for file ${fileId} -> ${targetFormat}`,
    );
    return job.id!;
  }

  /**
   * Queue an OCR job.
   * Extracts text from a PDF or image using AI, with optional summarization.
   */
  async queueOcr(
    fileId: string,
    userId: string,
    storageKey: string,
    filename: string,
    language = 'eng',
    mode: 'extract' | 'summary' | 'both' = 'extract',
  ): Promise<string> {
    const jobData: OcrJobData = {
      type: 'ocr',
      fileId,
      userId,
      storageKey,
      filename,
      language,
      mode,
    };

    const job = await this.processingQueue.add('ocr', jobData, {
      priority: 3, // Lower priority (OCR can take longer)
    });

    this.logger.log(`Queued OCR job ${job.id} for file ${fileId}`);
    return job.id!;
  }

  /**
   * Queue a PDF thumbnail generation job.
   * Extracts the first page of a PDF and converts it to an image thumbnail.
   */
  async queuePdfThumbnail(
    fileId: string,
    userId: string,
    storageKey: string,
    filename: string,
  ): Promise<string> {
    const jobData: PdfThumbnailJobData = {
      type: 'pdf-thumbnail',
      fileId,
      userId,
      storageKey,
      filename,
    };

    const job = await this.processingQueue.add('pdf-thumbnail', jobData, {
      priority: 1, // High priority - users want to see thumbnails quickly
    });

    this.logger.log(`Queued PDF thumbnail job ${job.id} for file ${fileId}`);
    return job.id!;
  }

  /**
   * Get the status of a processing job.
   * Returns null if job not found.
   * Returns status with userId for ownership verification in controller.
   */
  async getJobStatus(
    jobId: string,
  ): Promise<(ProcessingStatus & { userId: string }) | null> {
    const job = await this.processingQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const data = job.data as ProcessingJobData;

    return {
      jobId: job.id!,
      type: data.type,
      status: state as ProcessingStatus['status'],
      progress: job.progress as number | undefined,
      result: job.returnvalue as ProcessingJobResult | undefined,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      userId: data.userId, // Include for ownership verification
    };
  }

  /**
   * Get all jobs for a specific file.
   */
  async getJobsForFile(fileId: string): Promise<ProcessingStatus[]> {
    // Get jobs from all states
    const [waiting, active, completed, failed] = await Promise.all([
      this.processingQueue.getJobs(['waiting']),
      this.processingQueue.getJobs(['active']),
      this.processingQueue.getJobs(['completed']),
      this.processingQueue.getJobs(['failed']),
    ]);

    const allJobs = [...waiting, ...active, ...completed, ...failed];

    // Filter jobs for this file
    const fileJobs = allJobs.filter((job) => {
      const data = job.data as ProcessingJobData;
      return data.fileId === fileId;
    });

    // Convert to status objects
    const statuses = await Promise.all(
      fileJobs.map(async (job) => {
        const state = await job.getState();
        const data = job.data as ProcessingJobData;
        return {
          jobId: job.id!,
          type: data.type,
          status: state as ProcessingStatus['status'],
          progress: job.progress as number | undefined,
          result: job.returnvalue as ProcessingJobResult | undefined,
          error: job.failedReason,
          createdAt: new Date(job.timestamp),
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        };
      }),
    );

    return statuses;
  }

  /**
   * Cancel a job if it hasn't started yet.
   * Returns { cancelled: true, userId } on success, or { cancelled: false } on failure.
   */
  async cancelJob(
    jobId: string,
  ): Promise<{ cancelled: boolean; userId?: string }> {
    const job = await this.processingQueue.getJob(jobId);
    if (!job) {
      return { cancelled: false };
    }

    const data = job.data as ProcessingJobData;
    const state = await job.getState();

    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      this.logger.log(`Cancelled job ${jobId}`);
      return { cancelled: true, userId: data.userId };
    }

    return { cancelled: false, userId: data.userId };
  }

  /**
   * Get the userId for a job (for ownership verification).
   */
  async getJobUserId(jobId: string): Promise<string | null> {
    const job = await this.processingQueue.getJob(jobId);
    if (!job) {
      return null;
    }
    const data = job.data as ProcessingJobData;
    return data.userId;
  }
}
