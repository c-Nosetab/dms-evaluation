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
import { FoldersService, CreateFolderDto } from './folders.service';
import { CurrentUser } from '../auth';
import type { AuthUser } from '../auth/auth.service';

class CreateFolderRequestDto {
  name!: string;
  parentId?: string;
}

class RenameFolderDto {
  name!: string;
}

class MoveFolderDto {
  parentId!: string | null;
}

@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  /**
   * Create a new folder.
   * POST /folders
   */
  @Post()
  async createFolder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFolderRequestDto,
  ) {
    if (!dto.name) {
      throw new BadRequestException('name is required');
    }

    const createDto: CreateFolderDto = {
      name: dto.name,
      parentId: dto.parentId || null,
    };

    const folder = await this.foldersService.createFolder(user.id, createDto);

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * List folders in a parent (or root).
   * GET /folders?parentId=xxx
   */
  @Get()
  async listFolders(
    @CurrentUser() user: AuthUser,
    @Query('parentId') parentId?: string,
  ) {
    const folders = await this.foldersService.getFolders(
      user.id,
      parentId || null,
    );

    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        isStarred: f.isStarred,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get starred folders.
   * GET /folders/starred
   */
  @Get('starred')
  async getStarredFolders(@CurrentUser() user: AuthUser) {
    const folders = await this.foldersService.getStarredFolders(user.id);

    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        isStarred: f.isStarred,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get trashed folders.
   * GET /folders/trash
   */
  @Get('trash')
  async getTrashedFolders(@CurrentUser() user: AuthUser) {
    const folders = await this.foldersService.getTrashedFolders(user.id);

    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        isStarred: f.isStarred,
        deletedAt: f.deletedAt?.toISOString() || null,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Get a single folder.
   * GET /folders/:id
   */
  @Get(':id')
  async getFolder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const folder = await this.foldersService.getFolder(user.id, id);

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * Get breadcrumb path to a folder.
   * GET /folders/:id/breadcrumb
   */
  @Get(':id/breadcrumb')
  async getBreadcrumb(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const breadcrumb = await this.foldersService.getBreadcrumb(user.id, id);

    return { breadcrumb };
  }

  /**
   * Rename a folder.
   * PATCH /folders/:id
   */
  @Patch(':id')
  async renameFolder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenameFolderDto,
  ) {
    if (!dto.name) {
      throw new BadRequestException('name is required');
    }

    const folder = await this.foldersService.renameFolder(
      user.id,
      id,
      dto.name,
    );

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * Move a folder to a different parent.
   * PATCH /folders/:id/move
   */
  @Patch(':id/move')
  async moveFolder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: MoveFolderDto,
  ) {
    const folder = await this.foldersService.moveFolder(
      user.id,
      id,
      dto.parentId,
    );

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * Toggle star status for a folder.
   * PATCH /folders/:id/star
   */
  @Patch(':id/star')
  async toggleStar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const folder = await this.foldersService.toggleStar(user.id, id);

    return {
      id: folder.id,
      name: folder.name,
      isStarred: folder.isStarred,
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * Restore a folder from trash.
   * PATCH /folders/:id/restore
   */
  @Patch(':id/restore')
  async restoreFolder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const folder = await this.foldersService.restoreFolder(user.id, id);

    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      isStarred: folder.isStarred,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * Soft delete a folder (move to trash).
   * DELETE /folders/:id
   */
  @Delete(':id')
  async deleteFolder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.foldersService.deleteFolder(user.id, id);

    return { success: true };
  }

  /**
   * Permanently delete a folder from trash.
   * DELETE /folders/:id/permanent
   */
  @Delete(':id/permanent')
  async permanentlyDeleteFolder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.foldersService.permanentlyDeleteFolder(user.id, id);

    return { success: true };
  }
}
