'use client';

import { useState, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  createdAt: string;
}

interface OcrJobInfo {
  jobId: string;
  fileName: string;
  mimeType: string;
}

interface UseFileUploadOptions {
  folderId?: string | null;
  onUploadComplete?: (file: UploadedFile) => void;
  onError?: (error: string, fileName: string) => void;
  onOcrJobQueued?: (job: OcrJobInfo) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [uploads, setUploads] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();
      const apiUrl = getApiUrl();
      let createdFileId: string | null = null; // Track the real file ID for cleanup

      // Add to upload queue
      setUploads((prev) => [
        ...prev,
        {
          fileId: tempId,
          fileName: file.name,
          progress: 0,
          status: 'pending',
        },
      ]);

      try {
        setIsUploading(true);

        // Step 1: Create file record and get presigned URL
        setUploads((prev) =>
          prev.map((u) =>
            u.fileId === tempId ? { ...u, status: 'uploading', progress: 10 } : u
          )
        );

        const createResponse = await fetch(`${apiUrl}/files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            folderId: options.folderId || null,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create file record');
        }

        const fileRecord = await createResponse.json();
        createdFileId = fileRecord.id; // Store for cleanup on failure

        // Update with real file ID
        setUploads((prev) =>
          prev.map((u) =>
            u.fileId === tempId
              ? { ...u, fileId: fileRecord.id, progress: 20 }
              : u
          )
        );

        // Step 2: Upload file directly to R2 using presigned URL
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round(
                20 + (event.loaded / event.total) * 70
              );
              setUploads((prev) =>
                prev.map((u) =>
                  u.fileId === fileRecord.id
                    ? { ...u, progress: percentComplete }
                    : u
                )
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
          });

          xhr.open('PUT', fileRecord.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });

        // Step 3: Confirm upload and trigger processing (OCR for PDFs/images)
        setUploads((prev) =>
          prev.map((u) =>
            u.fileId === fileRecord.id
              ? { ...u, progress: 95 }
              : u
          )
        );

        // Call confirm endpoint to trigger auto-OCR for PDFs/images
        try {
          const confirmResponse = await fetch(`${apiUrl}/files/${fileRecord.id}/confirm`, {
            method: 'POST',
            credentials: 'include',
          });

          if (confirmResponse.ok) {
            const confirmData = await confirmResponse.json();
            // If OCR job was queued, notify the caller so they can track it
            if (confirmData.ocrJobId) {
              options.onOcrJobQueued?.({
                jobId: confirmData.ocrJobId,
                fileName: fileRecord.name,
                mimeType: fileRecord.mimeType,
              });
            }
          }
        } catch (confirmError) {
          // Log but don't fail - confirm is for OCR triggering, not critical
          console.warn('Failed to confirm upload:', confirmError);
        }

        // Step 4: Mark as complete
        setUploads((prev) =>
          prev.map((u) =>
            u.fileId === fileRecord.id
              ? { ...u, progress: 100, status: 'complete' }
              : u
          )
        );

        options.onUploadComplete?.({
          id: fileRecord.id,
          name: fileRecord.name,
          mimeType: fileRecord.mimeType,
          sizeBytes: fileRecord.sizeBytes,
          folderId: fileRecord.folderId,
          createdAt: fileRecord.createdAt,
        });

        // Remove from queue after a delay
        setTimeout(() => {
          setUploads((prev) => prev.filter((u) => u.fileId !== fileRecord.id));
        }, 2000);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';

        // If we created a DB record but R2 upload failed, delete the orphaned record
        if (createdFileId) {
          try {
            await fetch(`${apiUrl}/files/${createdFileId}`, {
              method: 'DELETE',
              credentials: 'include',
            });
          } catch (deleteError) {
            console.error('Failed to delete orphaned file record:', deleteError);
          }
        }

        setUploads((prev) =>
          prev.map((u) =>
            u.fileId === tempId || u.fileId === createdFileId
              ? { ...u, status: 'error', error: errorMessage }
              : u
          )
        );

        options.onError?.(errorMessage, file.name);
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const clearUploads = useCallback(() => {
    setUploads([]);
  }, []);

  const removeUpload = useCallback((fileId: string) => {
    setUploads((prev) => prev.filter((u) => u.fileId !== fileId));
  }, []);

  return {
    uploads,
    isUploading,
    uploadFile,
    uploadFiles,
    clearUploads,
    removeUpload,
  };
}
