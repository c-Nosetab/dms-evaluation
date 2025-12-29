import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import { CurrentUser } from '../auth';
import type { AuthUser } from '../auth/auth.service';

class GetUploadUrlDto {
  filename!: string;
  contentType!: string;
  expiresIn?: number;
}

class GetDownloadUrlDto {
  filename?: string;
  expiresIn?: number;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Get a presigned URL for uploading a file directly to R2.
   * POST /storage/upload-url
   */
  @Post('upload-url')
  async getUploadUrl(
    @CurrentUser() user: AuthUser,
    @Body() dto: GetUploadUrlDto,
  ) {
    if (!dto.filename) {
      throw new BadRequestException('filename is required');
    }
    if (!dto.contentType) {
      throw new BadRequestException('contentType is required');
    }

    const result = await this.storageService.getPresignedUploadUrl(
      user.id,
      dto.filename,
      dto.contentType,
      dto.expiresIn,
    );

    return {
      uploadUrl: result.uploadUrl,
      key: result.key,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Get a presigned URL for downloading a file from R2.
   * GET /storage/download-url/:key
   */
@Get('download-url/*key')
  async getDownloadUrl(
    @Param('key') key: string,
    @Query() query: GetDownloadUrlDto,
  ) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    // Verify the file exists
    const exists = await this.storageService.fileExists(key);
    if (!exists) {
      throw new BadRequestException('File not found');
    }

    const result = await this.storageService.getPresignedDownloadUrl(
      key,
      query.filename,
      query.expiresIn ? parseInt(String(query.expiresIn), 10) : undefined,
    );

    return {
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Get metadata about a file in R2.
   * GET /storage/metadata/:key
   */
@Get('metadata/*key')
  async getMetadata(@Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    const metadata = await this.storageService.getFileMetadata(key);
    if (!metadata) {
      throw new BadRequestException('File not found');
    }

    return {
      contentType: metadata.contentType,
      contentLength: metadata.contentLength,
      lastModified: metadata.lastModified.toISOString(),
    };
  }

  /**
   * Delete a file from R2 storage.
   * DELETE /storage/:key
   * Note: In production, you'd verify the user owns this file via the files table.
   */
@Delete('*key')
  async deleteFile(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    // Verify the file belongs to this user (key starts with userId)
    if (!key.startsWith(`${user.id}/`)) {
      throw new BadRequestException(
        'You do not have permission to delete this file',
      );
    }

    await this.storageService.deleteFile(key);

    return { success: true };
  }
}
