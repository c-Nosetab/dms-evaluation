import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, and, isNull, desc, isNotNull, or, ilike } from 'drizzle-orm';
import {
  DATABASE_CONNECTION,
  files,
  folders,
} from '../database/database.module';
import type { Database } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { ProcessingService } from '../processing/processing.service';

export interface CreateFileDto {
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId?: string | null;
}

export interface FileWithUploadUrl {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  storageKey: string;
  createdAt: Date;
  updatedAt: Date;
  uploadUrl: string;
  uploadUrlExpiresAt: Date;
}

// Use the Drizzle-inferred type for files
// This ensures type safety with all columns including OCR fields
export type FileRecord = typeof files.$inferSelect;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => ProcessingService))
    private readonly processingService: ProcessingService,
  ) {}

  /**
   * Create a new file record and get a presigned upload URL.
   * The client will use this URL to upload directly to R2.
   */
  async createFile(
    userId: string,
    dto: CreateFileDto,
  ): Promise<FileWithUploadUrl> {
    const fileId = crypto.randomUUID();

    // Build storage key: /{userId}/{fileId}/{filename}
    const sanitizedName = this.sanitizeFilename(dto.name);
    const storageKey = `${userId}/${fileId}/${sanitizedName}`;

    // Insert file record
    const [file] = await this.db
      .insert(files)
      .values({
        id: fileId,
        userId,
        folderId: dto.folderId || null,
        name: dto.name,
        storageKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      })
      .returning();

    // Generate presigned upload URL
    const presignedResult = await this.storageService.getPresignedUploadUrl(
      userId,
      dto.name,
      dto.mimeType,
      3600, // 1 hour expiry
      storageKey, // Use our custom key
    );

    this.logger.debug(`Created file record: ${fileId} with key: ${storageKey}`);

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      folderId: file.folderId,
      storageKey: file.storageKey,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      uploadUrl: presignedResult.uploadUrl,
      uploadUrlExpiresAt: presignedResult.expiresAt,
    };
  }

  /**
   * Get all files for a user in a specific folder (or root if folderId is null).
   * Excludes soft-deleted files.
   */
  async getFiles(
    userId: string,
    folderId: string | null = null,
  ): Promise<FileRecord[]> {
    const conditions = [eq(files.userId, userId), eq(files.isDeleted, false)];

    if (folderId) {
      conditions.push(eq(files.folderId, folderId));
    } else {
      conditions.push(isNull(files.folderId));
    }

    const result = await this.db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));

    return result;
  }

  /**
   * Get a single file by ID.
   */
  async getFile(userId: string, fileId: string): Promise<FileRecord> {
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  /**
   * Get a presigned download URL for a file.
   * Also updates lastAccessedAt for "Recent" tracking.
   */
  async getDownloadUrl(
    userId: string,
    fileId: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const file = await this.getFile(userId, fileId);

    // Update lastAccessedAt for Recent tracking
    await this.db
      .update(files)
      .set({ lastAccessedAt: new Date() })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));

    const result = await this.storageService.getPresignedDownloadUrl(
      file.storageKey,
      file.name,
      3600, // 1 hour expiry
    );

    return {
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Soft delete a file (moves to trash).
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    await this.getFile(userId, fileId); // Verify ownership

    await this.db
      .update(files)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));

    this.logger.debug(`Soft deleted file: ${fileId}`);
  }

  /**
   * Rename a file.
   */
  async renameFile(
    userId: string,
    fileId: string,
    newName: string,
  ): Promise<FileRecord> {
    await this.getFile(userId, fileId); // Verify ownership

    const [updated] = await this.db
      .update(files)
      .set({
        name: newName,
        updatedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    return updated;
  }

  /**
   * Move a file to a different folder.
   */
  async moveFile(
    userId: string,
    fileId: string,
    newFolderId: string | null,
  ): Promise<FileRecord> {
    await this.getFile(userId, fileId); // Verify ownership

    // If moving to a folder, verify the folder exists and belongs to the user
    if (newFolderId) {
      const [folder] = await this.db
        .select()
        .from(folders)
        .where(and(eq(folders.id, newFolderId), eq(folders.userId, userId)))
        .limit(1);

      if (!folder) {
        throw new NotFoundException('Target folder not found');
      }
    }

    const [updated] = await this.db
      .update(files)
      .set({
        folderId: newFolderId,
        updatedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    return updated;
  }

  /**
   * Sanitize filename for safe storage.
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }

  // ============================================
  // Recent, Starred, and Trash Methods
  // ============================================

  /**
   * Get recently accessed files for a user.
   */
  async getRecentFiles(userId: string, limit = 20): Promise<FileRecord[]> {
    const result = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          eq(files.isDeleted, false),
          isNotNull(files.lastAccessedAt),
        ),
      )
      .orderBy(desc(files.lastAccessedAt))
      .limit(limit);

    return result;
  }

  /**
   * Get starred files for a user.
   */
  async getStarredFiles(userId: string): Promise<FileRecord[]> {
    const result = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          eq(files.isDeleted, false),
          eq(files.isStarred, true),
        ),
      )
      .orderBy(desc(files.updatedAt));

    return result;
  }

  /**
   * Get trashed files for a user.
   */
  async getTrashedFiles(userId: string): Promise<FileRecord[]> {
    const result = await this.db
      .select()
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.isDeleted, true)))
      .orderBy(desc(files.deletedAt));

    return result;
  }

  /**
   * Toggle starred status for a file.
   */
  async toggleStar(userId: string, fileId: string): Promise<FileRecord> {
    const file = await this.getFile(userId, fileId);

    const [updated] = await this.db
      .update(files)
      .set({
        isStarred: !file.isStarred,
        updatedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    this.logger.debug(
      `Toggled star for file: ${fileId} to ${updated.isStarred}`,
    );

    return updated;
  }

  /**
   * Restore a file from trash.
   */
  async restoreFile(userId: string, fileId: string): Promise<FileRecord> {
    // Get file including deleted ones
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isDeleted) {
      throw new BadRequestException('File is not in trash');
    }

    const [updated] = await this.db
      .update(files)
      .set({
        isDeleted: false,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .returning();

    this.logger.debug(`Restored file from trash: ${fileId}`);

    return updated;
  }

  /**
   * Permanently delete a file from trash.
   */
  async permanentlyDeleteFile(userId: string, fileId: string): Promise<void> {
    // Get file including deleted ones
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    if (!file.isDeleted) {
      throw new BadRequestException(
        'File must be in trash before permanent deletion',
      );
    }

    // Delete from R2
    try {
      await this.storageService.deleteFile(file.storageKey);
    } catch (error) {
      this.logger.warn(`Failed to delete R2 object: ${file.storageKey}`, error);
      // Continue with database deletion even if R2 fails
    }

    // Delete from database
    await this.db
      .delete(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));

    this.logger.debug(`Permanently deleted file: ${fileId}`);
  }

  // ============================================
  // Search and Processing Methods
  // ============================================

  /**
   * Search files by name and OCR text.
   * Uses case-insensitive ILIKE for PostgreSQL.
   */
  async searchFiles(
    userId: string,
    query: string,
    limit = 50,
  ): Promise<FileRecord[]> {
    const searchPattern = `%${query}%`;

    const result = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          eq(files.isDeleted, false),
          or(
            ilike(files.name, searchPattern),
            ilike(files.ocrText, searchPattern),
          ),
        ),
      )
      .orderBy(desc(files.updatedAt))
      .limit(limit);

    return result;
  }

  /**
   * Confirm file upload completed and trigger OCR for PDFs/images.
   * Called by frontend after R2 upload succeeds.
   */
  async confirmUpload(
    userId: string,
    fileId: string,
  ): Promise<{ file: FileRecord; ocrJobId?: string }> {
    const file = await this.getFile(userId, fileId);

    const isPdf = file.mimeType === 'application/pdf';
    const isImage = file.mimeType.startsWith('image/');

    let ocrJobId: string | undefined;

    if (!file.ocrProcessedAt) {
      try {
        if (isPdf) {
          // Queue OCR job with both extract + summary for PDFs
          // This provides searchable text AND AI-generated summary in one pass
          ocrJobId = await this.processingService.queueOcr(
            file.id,
            userId,
            file.storageKey,
            file.name,
            'eng',
            'both', // Extract text for search + generate summary
          );
          this.logger.log(
            `Auto-queued OCR+summary job ${ocrJobId} for PDF ${fileId}`,
          );
        } else if (isImage) {
          // Queue image description job (summary only - describes visual content)
          ocrJobId = await this.processingService.queueOcr(
            file.id,
            userId,
            file.storageKey,
            file.name,
            'eng',
            'summary', // Just generate visual description for images
          );
          this.logger.log(
            `Auto-queued image description job ${ocrJobId} for image ${fileId}`,
          );
        }
      } catch (error) {
        // Log but don't fail - processing is optional enhancement
        this.logger.warn(`Failed to queue processing for ${fileId}: ${error}`);
      }
    }

    return { file, ocrJobId };
  }
}
