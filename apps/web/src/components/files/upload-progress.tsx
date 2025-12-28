'use client';

import { cn } from '@/lib/utils';

interface UploadProgressItem {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  onRemove?: (fileId: string) => void;
}

export function UploadProgress({ uploads, onRemove }: UploadProgressProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-(--card) border border-(--border) rounded-lg shadow-lg overflow-hidden z-50">
      <div className="bg-(--muted) px-4 py-2 border-b border-(--border)">
        <p className="text-sm font-medium text-(--foreground)">
          Uploading {uploads.filter((u) => u.status === 'uploading').length} of{' '}
          {uploads.length} files
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {uploads.map((upload) => (
          <div
            key={upload.fileId}
            className="px-4 py-3 border-b border-(--border) last:border-b-0"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-(--foreground) truncate flex-1 mr-2">
                {upload.fileName}
              </p>
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
      </div>
    </div>
  );
}
