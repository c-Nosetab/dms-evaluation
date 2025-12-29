import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
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
  isStarred: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
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
   * Excludes soft-deleted folders.
   */
  async getFolders(
    userId: string,
    parentId: string | null = null,
  ): Promise<FolderRecord[]> {
    const conditions = [
      eq(folders.userId, userId),
      eq(folders.isDeleted, false),
    ];

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
   * Soft delete a folder and all its contents (files and subfolders).
   */
  async deleteFolder(userId: string, folderId: string): Promise<void> {
    await this.getFolder(userId, folderId); // Verify ownership
    const now = new Date();

    // Soft delete the folder
    await this.db
      .update(folders)
      .set({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));

    // Soft delete all files in this folder
    await this.db
      .update(files)
      .set({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(eq(files.folderId, folderId), eq(files.userId, userId)));

    // Recursively soft delete subfolders and their contents
    await this.softDeleteSubfolders(userId, folderId, now);

    this.logger.debug(`Soft deleted folder: ${folderId}`);
  }

  /**
   * Recursively soft delete all subfolders and their files.
   */
  private async softDeleteSubfolders(
    userId: string,
    parentId: string,
    deletedAt: Date,
  ): Promise<void> {
    // Get all direct subfolders
    const subfolders = await this.db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.parentId, parentId),
          eq(folders.isDeleted, false),
        ),
      );

    for (const subfolder of subfolders) {
      // Soft delete the subfolder
      await this.db
        .update(folders)
        .set({
          isDeleted: true,
          deletedAt,
          updatedAt: deletedAt,
        })
        .where(and(eq(folders.id, subfolder.id), eq(folders.userId, userId)));

      // Soft delete all files in this subfolder
      await this.db
        .update(files)
        .set({
          isDeleted: true,
          deletedAt,
          updatedAt: deletedAt,
        })
        .where(and(eq(files.folderId, subfolder.id), eq(files.userId, userId)));

      // Recurse into subfolders
      await this.softDeleteSubfolders(userId, subfolder.id, deletedAt);
    }
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

  // ============================================
  // Starred and Trash Methods
  // ============================================

  /**
   * Get starred folders for a user.
   */
  async getStarredFolders(userId: string): Promise<FolderRecord[]> {
    const result = await this.db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.isDeleted, false),
          eq(folders.isStarred, true),
        ),
      )
      .orderBy(desc(folders.updatedAt));

    return result as FolderRecord[];
  }

  /**
   * Get trashed folders for a user (top-level only, not subfolders).
   */
  async getTrashedFolders(userId: string): Promise<FolderRecord[]> {
    const result = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.userId, userId), eq(folders.isDeleted, true)))
      .orderBy(desc(folders.deletedAt));

    return result as FolderRecord[];
  }

  /**
   * Toggle starred status for a folder.
   */
  async toggleStar(userId: string, folderId: string): Promise<FolderRecord> {
    const folder = await this.getFolder(userId, folderId);

    const [updated] = await this.db
      .update(folders)
      .set({
        isStarred: !folder.isStarred,
        updatedAt: new Date(),
      })
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .returning();

    this.logger.debug(
      `Toggled star for folder: ${folderId} to ${updated.isStarred}`,
    );

    return updated as FolderRecord;
  }

  /**
   * Restore a folder from trash.
   */
  async restoreFolder(userId: string, folderId: string): Promise<FolderRecord> {
    // Get folder including deleted ones
    const [folder] = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (!folder.isDeleted) {
      throw new BadRequestException('Folder is not in trash');
    }

    const now = new Date();

    // Restore the folder
    const [updated] = await this.db
      .update(folders)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: now,
      })
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .returning();

    // Restore all files in this folder
    await this.db
      .update(files)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: now,
      })
      .where(and(eq(files.folderId, folderId), eq(files.userId, userId)));

    // Recursively restore subfolders
    await this.restoreSubfolders(userId, folderId, now);

    this.logger.debug(`Restored folder from trash: ${folderId}`);

    return updated as FolderRecord;
  }

  /**
   * Recursively restore all subfolders and their files.
   */
  private async restoreSubfolders(
    userId: string,
    parentId: string,
    updatedAt: Date,
  ): Promise<void> {
    // Get all direct subfolders that are deleted
    const subfolders = await this.db
      .select()
      .from(folders)
      .where(
        and(
          eq(folders.userId, userId),
          eq(folders.parentId, parentId),
          eq(folders.isDeleted, true),
        ),
      );

    for (const subfolder of subfolders) {
      // Restore the subfolder
      await this.db
        .update(folders)
        .set({
          isDeleted: false,
          deletedAt: null,
          updatedAt,
        })
        .where(and(eq(folders.id, subfolder.id), eq(folders.userId, userId)));

      // Restore all files in this subfolder
      await this.db
        .update(files)
        .set({
          isDeleted: false,
          deletedAt: null,
          updatedAt,
        })
        .where(and(eq(files.folderId, subfolder.id), eq(files.userId, userId)));

      // Recurse into subfolders
      await this.restoreSubfolders(userId, subfolder.id, updatedAt);
    }
  }

  /**
   * Permanently delete a folder from trash.
   */
  async permanentlyDeleteFolder(
    userId: string,
    folderId: string,
  ): Promise<void> {
    // Get folder including deleted ones
    const [folder] = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
      .limit(1);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (!folder.isDeleted) {
      throw new BadRequestException(
        'Folder must be in trash before permanent deletion',
      );
    }

    // Get all files in this folder tree to delete from R2
    const allFiles = await this.getAllFilesInFolderTree(userId, folderId);

    // Delete files from R2
    if (allFiles.length > 0) {
      const keys = allFiles.map((f) => f.storageKey);
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

    this.logger.debug(`Permanently deleted folder: ${folderId}`);
  }

  /**
   * Get all files in a folder and its subfolders recursively.
   */
  private async getAllFilesInFolderTree(
    userId: string,
    folderId: string,
  ): Promise<Array<{ storageKey: string }>> {
    const allFiles: Array<{ storageKey: string }> = [];

    // Get files in this folder
    const folderFiles = await this.db
      .select({ storageKey: files.storageKey })
      .from(files)
      .where(and(eq(files.folderId, folderId), eq(files.userId, userId)));

    allFiles.push(...folderFiles);

    // Get subfolders
    const subfolders = await this.db
      .select()
      .from(folders)
      .where(and(eq(folders.parentId, folderId), eq(folders.userId, userId)));

    // Recurse into subfolders
    for (const subfolder of subfolders) {
      const subfolderFiles = await this.getAllFilesInFolderTree(
        userId,
        subfolder.id,
      );
      allFiles.push(...subfolderFiles);
    }

    return allFiles;
  }
}
