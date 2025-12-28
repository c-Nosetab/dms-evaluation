import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  folders,
  files,
} from '../database/database.module';
import type { Database } from '../database/database.module';
import { StorageService } from '../storage/storage.service';

export interface CreateFolderDto {
  name: string;
  parentId?: string | null;
}

export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Create a new folder.
   */
  async createFolder(
    userId: string,
    dto: CreateFolderDto,
  ): Promise<FolderRecord> {
    // If parentId is provided, verify it exists and belongs to the user
    if (dto.parentId) {
      const [parent] = await this.db
        .select()
        .from(folders)
        .where(and(eq(folders.id, dto.parentId), eq(folders.userId, userId)))
        .limit(1);

      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const [folder] = await this.db
      .insert(folders)
      .values({
        id: crypto.randomUUID(),
        userId,
        parentId: dto.parentId || null,
        name: dto.name,
      })
      .returning();

    this.logger.debug(`Created folder: ${folder.id} (${folder.name})`);

    return folder;
  }

  /**
   * Get all folders for a user in a specific parent (or root if parentId is null).
   */
  async getFolders(
    userId: string,
    parentId: string | null = null,
  ): Promise<FolderRecord[]> {
    const conditions = [eq(folders.userId, userId)];

    if (parentId) {
      conditions.push(eq(folders.parentId, parentId));
    } else {
      conditions.push(isNull(folders.parentId));
    }

    const result = await this.db
      .select()
      .from(folders)
      .where(and(...conditions))
      .orderBy(desc(folders.createdAt));

    return result as FolderRecord[];
  }

  /**
   * Get a single folder by ID.
   */
  async getFolder(userId: string, folderId: string): Promise<FolderRecord> {
    const [folder] = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder as FolderRecord;
  }

  /**
   * Delete a folder and all its contents (files and subfolders).
   */
  async deleteFolder(userId: string, folderId: string): Promise<void> {
    await this.getFolder(userId, folderId); // Verify ownership

    // Get all files in this folder to delete from R2
    const filesToDelete = await this.db
      .select()
      .from(files)
      .where(and(eq(files.folderId, folderId), eq(files.userId, userId)));

    // Delete files from R2
    if (filesToDelete.length > 0) {
      const keys = filesToDelete.map((f) => f.storageKey);
      try {
        await this.storageService.deleteFiles(keys);
      } catch (error) {
        this.logger.warn(
          `Failed to delete some R2 objects for folder: ${folderId}`,
          error,
        );
      }
    }

    // Delete folder from database (cascade will handle files and subfolders)
    await this.db
      .delete(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));

    this.logger.debug(`Deleted folder: ${folderId}`);
  }

  /**
   * Rename a folder.
   */
  async renameFolder(
    userId: string,
    folderId: string,
    newName: string,
  ): Promise<FolderRecord> {
    await this.getFolder(userId, folderId); // Verify ownership

    const [updated] = await this.db
      .update(folders)
      .set({
        name: newName,
        updatedAt: new Date(),
      })
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .returning();

    return updated as FolderRecord;
  }

  /**
   * Move a folder to a different parent.
   */
  async moveFolder(
    userId: string,
    folderId: string,
    newParentId: string | null,
  ): Promise<FolderRecord> {
    await this.getFolder(userId, folderId); // Verify ownership

    // Prevent moving folder into itself
    if (newParentId === folderId) {
      throw new NotFoundException('Cannot move folder into itself');
    }

    // If moving to a parent, verify the parent exists and belongs to the user
    // Also verify we're not creating a circular reference
    if (newParentId) {
      const [parent] = await this.db
        .select()
        .from(folders)
        .where(and(eq(folders.id, newParentId), eq(folders.userId, userId)))
        .limit(1);

      if (!parent) {
        throw new NotFoundException('Target parent folder not found');
      }

      // Check for circular reference (parent cannot be a descendant of folder)
      const isCircular = await this.isDescendant(userId, newParentId, folderId);
      if (isCircular) {
        throw new NotFoundException('Cannot move folder into its descendant');
      }
    }

    const [updated] = await this.db
      .update(folders)
      .set({
        parentId: newParentId,
        updatedAt: new Date(),
      })
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .returning();

    return updated as FolderRecord;
  }

  /**
   * Check if targetId is a descendant of ancestorId.
   */
  private async isDescendant(
    userId: string,
    targetId: string,
    ancestorId: string,
  ): Promise<boolean> {
    // Walk up from target to see if we hit ancestor
    let currentId: string | null = targetId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === ancestorId) {
        return true;
      }

      if (visited.has(currentId)) {
        // Circular reference in data, shouldn't happen
        break;
      }
      visited.add(currentId);

      const [folder] = await this.db
        .select()
        .from(folders)
        .where(and(eq(folders.id, currentId), eq(folders.userId, userId)))
        .limit(1);

      currentId = folder?.parentId || null;
    }

    return false;
  }

  /**
   * Get the breadcrumb path from root to a folder.
   */
  async getBreadcrumb(
    userId: string,
    folderId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const breadcrumb: Array<{ id: string; name: string }> = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const [folder] = await this.db
        .select()
        .from(folders)
        .where(and(eq(folders.id, currentId), eq(folders.userId, userId)))
        .limit(1);

      if (!folder) {
        break;
      }

      breadcrumb.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return breadcrumb;
  }
}
