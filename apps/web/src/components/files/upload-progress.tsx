'use client';

import { cn } from '@/lib/utils';

interface UploadProgressItem {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ProcessingJob {
  jobId: string;
  fileName: string;
  type: 'pdf-split' | 'image-convert' | 'ocr' | 'image-describe' | 'pdf-thumbnail';
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  processingJobs?: ProcessingJob[];
  onRemove?: (fileId: string) => void;
  onRemoveJob?: (jobId: string) => void;
}

const getJobLabel = (type: ProcessingJob['type']): string => {
  switch (type) {
    case 'pdf-split':
      return 'Splitting PDF';
    case 'image-convert':
      return 'Converting image';
    case 'ocr':
      return 'Extracting text';
    case 'image-describe':
      return 'Analyzing image';
    case 'pdf-thumbnail':
      return 'Generating preview';
    default:
      return 'Processing';
  }
};

const getJobIcon = (type: ProcessingJob['type']) => {
  switch (type) {
    case 'pdf-split':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'image-convert':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'ocr':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'image-describe':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    case 'pdf-thumbnail':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
  }
};

export function UploadProgress({ uploads, processingJobs = [], onRemove, onRemoveJob }: UploadProgressProps) {
  // Show panel if there are active uploads or processing jobs
  if (uploads.length === 0 && processingJobs.length === 0) return null;

  const uploadingCount = uploads.filter((u) => u.status === 'uploading').length;
  const processingCount = processingJobs.filter((j) => j.status === 'waiting' || j.status === 'active').length;

  // Build header text
  let headerText = '';
  if (uploadingCount > 0 && processingCount > 0) {
    headerText = `Uploading ${uploadingCount} • Processing ${processingCount}`;
  } else if (uploadingCount > 0) {
    headerText = `Uploading ${uploadingCount} of ${uploads.length} files`;
  } else if (processingCount > 0) {
    headerText = `Processing ${processingCount} ${processingCount === 1 ? 'file' : 'files'}`;
  } else {
    headerText = 'All tasks complete';
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-(--card) border border-(--border) rounded-lg shadow-lg overflow-hidden z-50">
      <div className="bg-(--muted) px-4 py-2 border-b border-(--border)">
        <p className="text-sm font-medium text-(--foreground)">
          {headerText}
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {/* Upload items */}
        {uploads.map((upload) => (
          <div
            key={upload.fileId}
            className="px-4 py-3 border-b border-(--border) last:border-b-0"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <svg className="w-4 h-4 text-(--muted-foreground) flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p className="text-sm font-medium text-(--foreground) truncate">
                  {upload.fileName}
                </p>
              </div>
              {upload.status === 'complete' && (
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {upload.status === 'error' && (
                <button
                  onClick={() => onRemove?.(upload.fileId)}
                  className="text-red-500 hover:text-red-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {upload.status === 'error' ? (
              <p className="text-xs text-red-500">{upload.error}</p>
            ) : (
              <div className="h-1.5 bg-(--muted) rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    upload.status === 'complete'
                      ? 'bg-green-500'
                      : 'bg-(--primary)'
                  )}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Processing job items */}
        {processingJobs.map((job) => (
          <div
            key={job.jobId}
            className="px-4 py-3 border-b border-(--border) last:border-b-0"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={cn(
                  "flex-shrink-0",
                  job.status === 'active' && "text-(--primary) animate-pulse",
                  job.status === 'waiting' && "text-(--muted-foreground)",
                  job.status === 'completed' && "text-green-500",
                  job.status === 'failed' && "text-red-500"
                )}>
                  {getJobIcon(job.type)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--foreground) truncate">
                    {job.fileName}
                  </p>
                  <p className="text-xs text-(--muted-foreground)">
                    {getJobLabel(job.type)}
                  </p>
                </div>
              </div>
              {job.status === 'completed' && (
                <svg
                  className="w-4 h-4 text-green-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {job.status === 'failed' && (
                <button
                  onClick={() => onRemoveJob?.(job.jobId)}
                  className="text-red-500 hover:text-red-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {(job.status === 'waiting' || job.status === 'active') && (
                <svg className="w-4 h-4 animate-spin text-(--primary) flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
            {job.status === 'failed' ? (
              <p className="text-xs text-red-500">{job.error || 'Processing failed'}</p>
            ) : (
              <div className="h-1.5 bg-(--muted) rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    job.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${job.progress || (job.status === 'waiting' ? 0 : 50)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
