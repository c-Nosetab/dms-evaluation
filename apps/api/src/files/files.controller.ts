import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FilesService, CreateFileDto } from './files.service';
import { CurrentUser } from '../auth';
import type { AuthUser } from '../auth/auth.service';

class CreateFileRequestDto {
  name!: string;
  mimeType!: string;
  sizeBytes!: number;
  folderId?: string;
}

class RenameFileDto {
  name!: string;
}

class MoveFileDto {
  folderId!: string | null;
}

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Create a new file and get an upload URL.
   * POST /files
   */
  @Post()
  async createFile(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFileRequestDto,
  ) {
    if (!dto.name) {
      throw new BadRequestException('name is required');
    }
    if (!dto.mimeType) {
      throw new BadRequestException('mimeType is required');
    }
    if (typeof dto.sizeBytes !== 'number' || dto.sizeBytes < 0) {
      throw new BadRequestException('sizeBytes must be a positive number');
    }

    const createDto: CreateFileDto = {
      name: dto.name,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      folderId: dto.folderId || null,
    };

    const result = await this.filesService.createFile(user.id, createDto);

    return {
      id: result.id,
      name: result.name,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      folderId: result.folderId,
      storageKey: result.storageKey,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      uploadUrl: result.uploadUrl,
      uploadUrlExpiresAt: result.uploadUrlExpiresAt.toISOString(),
    };
  }

  /**
   * List files in a folder (or root).
   * GET /files?folderId=xxx
   */
  @Get()
  async listFiles(
    @CurrentUser() user: AuthUser,
    @Query('folderId') folderId?: string,
  ) {
    const files = await this.filesService.getFiles(user.id, folderId || null);

    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        folderId: f.folderId,
        isStarred: f.isStarred,
        ocrText: f.ocrText || null,
        ocrSummary: f.ocrSummary || null,
        ocrProcessedAt: f.ocrProcessedAt?.toISOString() || null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Search files by name, OCR text, and AI summary.
   * GET /files/search?q=query&limit=50
   * Returns matchSource indicating where the query was found: 'name', 'content', or 'ai'
   */
  @Get('search')
  async searchFiles(
    @CurrentUser() user: AuthUser,
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { files: [] };
    }

    const files = await this.filesService.searchFiles(
      user.id,
      query.trim(),
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        folderId: f.folderId,
        isStarred: f.isStarred,
        ocrText: f.ocrText || null,
        ocrSummary: f.ocrSummary || null,
        ocrProcessedAt: f.ocrProcessedAt?.toISOString() || null,
        matchSource: f.matchSource,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get recently accessed files.
   * GET /files/recent
   */
  @Get('recent')
  async getRecentFiles(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    const files = await this.filesService.getRecentFiles(
      user.id,
      limit ? parseInt(limit, 10) : 20,
    );

    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        folderId: f.folderId,
        isStarred: f.isStarred,
        lastAccessedAt: f.lastAccessedAt?.toISOString() || null,
        ocrText: f.ocrText || null,
        ocrSummary: f.ocrSummary || null,
        ocrProcessedAt: f.ocrProcessedAt?.toISOString() || null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get starred files.
   * GET /files/starred
   */
  @Get('starred')
  async getStarredFiles(@CurrentUser() user: AuthUser) {
    const files = await this.filesService.getStarredFiles(user.id);

    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        folderId: f.folderId,
        isStarred: f.isStarred,
        ocrText: f.ocrText || null,
        ocrSummary: f.ocrSummary || null,
        ocrProcessedAt: f.ocrProcessedAt?.toISOString() || null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get trashed files.
   * GET /files/trash
   */
  @Get('trash')
  async getTrashedFiles(@CurrentUser() user: AuthUser) {
    const files = await this.filesService.getTrashedFiles(user.id);

    return {
      files: files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        folderId: f.folderId,
        isStarred: f.isStarred,
        deletedAt: f.deletedAt?.toISOString() || null,
        ocrText: f.ocrText || null,
        ocrSummary: f.ocrSummary || null,
        ocrProcessedAt: f.ocrProcessedAt?.toISOString() || null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get a single file.
   * GET /files/:id
   */
  @Get(':id')
  async getFile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.filesService.getFile(user.id, id);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folderId: file.folderId,
      isStarred: file.isStarred,
      ocrText: file.ocrText || null,
      ocrSummary: file.ocrSummary || null,
      ocrProcessedAt: file.ocrProcessedAt?.toISOString() || null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Confirm file upload completed and trigger processing.
   * POST /files/:id/confirm
   * Call this after R2 upload succeeds to trigger auto-OCR for PDFs/images.
   */
  @Post(':id/confirm')
  async confirmUpload(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.filesService.confirmUpload(user.id, id);

    return {
      id: result.file.id,
      name: result.file.name,
      mimeType: result.file.mimeType,
      ocrJobId: result.ocrJobId || null,
      message: result.ocrJobId
        ? 'Upload confirmed, OCR processing queued'
        : 'Upload confirmed',
    };
  }

  /**
   * Get a download URL for a file.
   * GET /files/:id/download
   */
  @Get(':id/download')
  async getDownloadUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.filesService.getDownloadUrl(user.id, id);

    return {
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Rename a file.
   * PATCH /files/:id
   */
  @Patch(':id')
  async renameFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenameFileDto,
  ) {
    if (!dto.name) {
      throw new BadRequestException('name is required');
    }

    const file = await this.filesService.renameFile(user.id, id, dto.name);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folderId: file.folderId,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Move a file to a different folder.
   * PATCH /files/:id/move
   */
  @Patch(':id/move')
  async moveFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveFileDto,
  ) {
    const file = await this.filesService.moveFile(user.id, id, dto.folderId);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folderId: file.folderId,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Toggle star status for a file.
   * PATCH /files/:id/star
   */
  @Patch(':id/star')
  async toggleStar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.filesService.toggleStar(user.id, id);

    return {
      id: file.id,
      name: file.name,
      isStarred: file.isStarred,
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Restore a file from trash.
   * PATCH /files/:id/restore
   */
  @Patch(':id/restore')
  async restoreFile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const file = await this.filesService.restoreFile(user.id, id);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folderId: file.folderId,
      isStarred: file.isStarred,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Soft delete a file (move to trash).
   * DELETE /files/:id
   */
  @Delete(':id')
  async deleteFile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.filesService.deleteFile(user.id, id);

    return { success: true };
  }

  /**
   * Permanently delete a file from trash.
   * DELETE /files/:id/permanent
   */
  @Delete(':id/permanent')
  async permanentlyDeleteFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.filesService.permanentlyDeleteFile(user.id, id);

    return { success: true };
  }
}
