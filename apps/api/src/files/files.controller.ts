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
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
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
   * Delete a file.
   * DELETE /files/:id
   */
  @Delete(':id')
  async deleteFile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.filesService.deleteFile(user.id, id);

    return { success: true };
  }
}
