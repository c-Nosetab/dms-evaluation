import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresAt: Date;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
  expiresAt: Date;
}

export interface FileMetadata {
  contentType: string;
  contentLength: number;
  lastModified: Date;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    // Support both R2_ACCOUNT_ID and CLOUDFLARE_ACCOUNT_ID
    const accountId =
      process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    // Support R2_ENDPOINT for custom endpoint or construct from account ID
    const endpoint =
      process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      this.logger.warn(
        'R2 credentials not configured. Storage operations will fail.',
      );
    }

    this.bucket = bucket || 'dms-files';
    this.publicUrl =
      process.env.R2_PUBLIC_URL ||
      `https://${this.bucket}.${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      // Disable checksum for R2 compatibility
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Generate a presigned URL for uploading a file directly to R2.
   * The client can use this URL to upload without going through our API.
   * @param customKey - Optional custom key to use instead of auto-generated one
   */
  async getPresignedUploadUrl(
    userId: string,
    filename: string,
    contentType: string,
    expiresInSeconds = 3600, // 1 hour default
    customKey?: string,
  ): Promise<PresignedUploadResult> {
    // Use custom key if provided, otherwise generate one
    let key: string;
    if (customKey) {
      key = customKey;
    } else {
      // Create a unique key for the file: userId/timestamp-uuid-filename
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const sanitizedFilename = this.sanitizeFilename(filename);
      key = `${userId}/${timestamp}-${uuid}-${sanitizedFilename}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
      // Don't sign Content-Type header so client can set it
      unhoistableHeaders: new Set(['content-type']),
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    this.logger.debug(`Generated presigned upload URL for key: ${key}`);

    return {
      uploadUrl,
      key,
      expiresAt,
    };
  }

  /**
   * Generate a presigned URL for downloading a file from R2.
   * This allows direct download without going through our API.
   */
  async getPresignedDownloadUrl(
    key: string,
    filename?: string,
    expiresInSeconds = 3600, // 1 hour default
  ): Promise<PresignedDownloadResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      // Set Content-Disposition to trigger download with original filename
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename}"`
        : undefined,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    this.logger.debug(`Generated presigned download URL for key: ${key}`);

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Delete a file from R2 storage.
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Deleted file with key: ${key}`);
  }

  /**
   * Delete multiple files from R2 storage.
   */
  async deleteFiles(keys: string[]): Promise<void> {
    // Delete files in parallel with a concurrency limit
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      await Promise.all(batch.map((key) => this.deleteFile(key)));
    }
    this.logger.debug(`Deleted ${keys.length} files`);
  }

  /**
   * Get metadata about a file in R2.
   */
  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
      };
    } catch (error) {
      // File doesn't exist
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if a file exists in R2.
   */
  async fileExists(key: string): Promise<boolean> {
    const metadata = await this.getFileMetadata(key);
    return metadata !== null;
  }

  /**
   * Get the public URL for a file (if bucket is public).
   * For private buckets, use getPresignedDownloadUrl instead.
   */
  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Sanitize filename to remove potentially problematic characters.
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, 255); // Limit length
  }
}
