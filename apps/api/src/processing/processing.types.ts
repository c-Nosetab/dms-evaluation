// Processing job types and interfaces

export const PROCESSING_QUEUE = 'file-processing';

export type ProcessingJobType =
  | 'pdf-split'
  | 'image-convert'
  | 'ocr'
  | 'pdf-thumbnail';

export interface BaseJobData {
  fileId: string;
  userId: string;
  storageKey: string;
  filename: string;
}

export interface PdfSplitJobData extends BaseJobData {
  type: 'pdf-split';
  outputNamePrefix: string; // e.g., "split pdf" -> "split pdf 1", "split pdf 2"
  folderId?: string; // Folder to place split files in
}

export interface ImageConvertJobData extends BaseJobData {
  type: 'image-convert';
  targetFormat: 'png' | 'jpeg' | 'webp';
  quality?: number; // 1-100, default 80
  folderId?: string;
}

export type OcrMode = 'extract' | 'summary' | 'both';

export interface OcrJobData extends BaseJobData {
  type: 'ocr';
  language?: string; // e.g., 'eng', 'spa', default 'eng'
  mode?: OcrMode; // 'extract' (default), 'summary', or 'both'
}

export interface PdfThumbnailJobData extends BaseJobData {
  type: 'pdf-thumbnail';
}

export type ProcessingJobData =
  | PdfSplitJobData
  | ImageConvertJobData
  | OcrJobData
  | PdfThumbnailJobData;

export interface ProcessingJobResult {
  success: boolean;
  message?: string;
  outputFileIds?: string[]; // IDs of created files (for split/convert)
  ocrText?: string; // Extracted text (for OCR)
  ocrSummary?: string; // AI-generated summary (for OCR with summary mode)
  thumbnailKey?: string; // Storage key for thumbnail (for pdf-thumbnail)
}

export interface ProcessingStatus {
  jobId: string;
  type: ProcessingJobType;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number; // 0-100
  result?: ProcessingJobResult;
  error?: string;
  createdAt: Date;
  finishedAt?: Date;
}
