import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { DATABASE_CONNECTION, files, folders } from '../database';
import type { Database } from '../database';
import { eq, and } from 'drizzle-orm';
import { CurrentUser } from '../auth/decorators';

interface PdfSplitDto {
  outputNamePrefix?: string;
  folderId?: string;
}

interface ImageConvertDto {
  targetFormat: 'png' | 'jpeg' | 'webp';
  quality?: number;
  folderId?: string;
}

interface OcrDto {
  language?: string;
  mode?: 'extract' | 'summary' | 'both';
}

@Controller('processing')
export class ProcessingController {
  constructor(
    private readonly processingService: ProcessingService,
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
  ) {}

  /**
   * Split a PDF into individual pages.
   */
  @Post('files/:fileId/split')
  async splitPdf(
    @Param('fileId') fileId: string,
    @Body() dto: PdfSplitDto,
    @CurrentUser() user: { id: string },
  ) {
    // Verify the file exists and belongs to the user
    const file = await this.getFile(fileId, user.id);

    if (!file.mimeType.includes('pdf')) {
      throw new HttpException(
        'Only PDF files can be split',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate folderId if provided
    if (dto.folderId) {
      await this.validateFolder(dto.folderId, user.id);
    }

    const jobId = await this.processingService.queuePdfSplit(
      fileId,
      user.id,
      file.storageKey,
      file.name,
      dto.outputNamePrefix,
      dto.folderId,
    );

    return {
      jobId,
      message: 'PDF split job queued',
    };
  }

  /**
   * Convert an image to a different format.
   */
  @Post('files/:fileId/convert')
  async convertImage(
    @Param('fileId') fileId: string,
    @Body() dto: ImageConvertDto,
    @CurrentUser() user: { id: string },
  ) {
    const file = await this.getFile(fileId, user.id);

    // Validate it's an image
    if (!file.mimeType.startsWith('image/')) {
      throw new HttpException(
        'Only image files can be converted',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate target format
    const validFormats = ['png', 'jpeg', 'webp'];
    if (!validFormats.includes(dto.targetFormat)) {
      throw new HttpException(
        `Invalid target format. Must be one of: ${validFormats.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate quality
    if (dto.quality !== undefined && (dto.quality < 1 || dto.quality > 100)) {
      throw new HttpException(
        'Quality must be between 1 and 100',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate folderId if provided
    if (dto.folderId) {
      await this.validateFolder(dto.folderId, user.id);
    }

    const jobId = await this.processingService.queueImageConvert(
      fileId,
      user.id,
      file.storageKey,
      file.name,
      dto.targetFormat,
      dto.quality,
      dto.folderId,
    );

    return {
      jobId,
      message: `Image conversion to ${dto.targetFormat.toUpperCase()} queued`,
    };
  }

  /**
   * Extract text from a PDF or image using OCR.
   */
  @Post('files/:fileId/ocr')
  async extractText(
    @Param('fileId') fileId: string,
    @Body() dto: OcrDto,
    @CurrentUser() user: { id: string },
  ) {
    const file = await this.getFile(fileId, user.id);

    // Validate it's a PDF or image
    if (
      !file.mimeType.includes('pdf') &&
      !file.mimeType.startsWith('image/')
    ) {
      throw new HttpException(
        'OCR is only supported for PDF and image files',
        HttpStatus.BAD_REQUEST,
      );
    }

    const jobId = await this.processingService.queueOcr(
      fileId,
      user.id,
      file.storageKey,
      file.name,
      dto.language,
      dto.mode,
    );

    const modeLabel = dto.mode === 'summary' ? 'summarization' : dto.mode === 'both' ? 'OCR + summarization' : 'OCR';
    return {
      jobId,
      message: `${modeLabel} job queued`,
    };
  }

  /**
   * Generate a thumbnail for a PDF.
   */
  @Post('files/:fileId/thumbnail')
  async generateThumbnail(
    @Param('fileId') fileId: string,
    @CurrentUser() user: { id: string },
  ) {
    const file = await this.getFile(fileId, user.id);

    if (!file.mimeType.includes('pdf')) {
      throw new HttpException(
        'Thumbnails can only be generated for PDF files',
        HttpStatus.BAD_REQUEST,
      );
    }

    const jobId = await this.processingService.queuePdfThumbnail(
      fileId,
      user.id,
      file.storageKey,
      file.name,
    );

    return {
      jobId,
      message: 'PDF thumbnail generation queued',
    };
  }

  /**
   * Get the status of a processing job.
   */
  @Get('jobs/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
  ) {
    const status = await this.processingService.getJobStatus(jobId);

    if (!status) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    return status;
  }

  /**
   * Get all processing jobs for a specific file.
   */
  @Get('files/:fileId/jobs')
  async getJobsForFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: { id: string },
  ) {
    // Verify the file exists and belongs to the user
    await this.getFile(fileId, user.id);

    const jobs = await this.processingService.getJobsForFile(fileId);
    return { jobs };
  }

  /**
   * Cancel a pending job.
   */
  @Delete('jobs/:jobId')
  async cancelJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
  ) {
    const cancelled = await this.processingService.cancelJob(jobId);

    if (!cancelled) {
      throw new HttpException(
        'Job not found or already started',
        HttpStatus.BAD_REQUEST,
      );
    }

    return { message: 'Job cancelled' };
  }

  /**
   * Helper to get and validate file ownership.
   */
  private async getFile(fileId: string, userId: string) {
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    return file;
  }

  /**
   * Helper to validate folder ownership.
   */
  private async validateFolder(folderId: string, userId: string) {
    const [folder] = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1);

    if (!folder) {
      throw new HttpException('Folder not found', HttpStatus.NOT_FOUND);
    }

    return folder;
  }
}
