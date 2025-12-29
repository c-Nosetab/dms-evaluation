'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
}

interface FilePreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (fileId: string, fileName: string) => void;
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Handle opening
  useEffect(() => {
    if (file && !currentFile) {
      setCurrentFile(file);
      setError(null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else if (file && currentFile && file.id !== currentFile.id) {
      setCurrentFile(file);
      setPreviewUrl(null);
      setError(null);
    } else if (!file && currentFile && !isClosing) {
      handleClose();
    }
  }, [file, currentFile, isClosing]);

  // Fetch preview URL when file changes
  useEffect(() => {
    if (!currentFile) return;

    const fetchPreviewUrl = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/files/${currentFile.id}/download`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load preview');
        }
        const data = await response.json();
        setPreviewUrl(data.downloadUrl);
      } catch (err) {
        setError('Failed to load preview');
        console.error('Preview load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [currentFile, apiUrl]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);

    setTimeout(() => {
      setCurrentFile(null);
      setPreviewUrl(null);
      setIsClosing(false);
      onClose();
    }, 300);
  }, [isClosing, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (currentFile) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentFile, handleClose]);

  if (!currentFile) return null;

  const isImage = currentFile.mimeType.startsWith('image/');
  const isPdf = currentFile.mimeType === 'application/pdf';
  const isPreviewable = isImage || isPdf;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 z-50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal container */}
      <div
        className={`fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-(--background) rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-(--border) bg-(--background)">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-(--foreground) truncate">
              {currentFile.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(currentFile.id, currentFile.name)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            <button
              onClick={handleClose}
              className="p-2 rounded-md hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-(--muted)/20 flex items-center justify-center p-4">
          {isLoading && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-(--primary) border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-(--muted-foreground)">Loading preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 text-center">
              <svg className="w-16 h-16 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-(--muted-foreground)">{error}</p>
              <Button variant="outline" onClick={() => onDownload(currentFile.id, currentFile.name)}>
                Download Instead
              </Button>
            </div>
          )}

          {!isLoading && !error && previewUrl && isImage && (
            <img
              src={previewUrl}
              alt={currentFile.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          )}

          {!isLoading && !error && previewUrl && isPdf && (
            <iframe
              src={previewUrl}
              className="w-full h-full rounded-lg shadow-lg bg-white"
              title={currentFile.name}
            />
          )}

          {!isLoading && !error && !isPreviewable && (
            <div className="flex flex-col items-center gap-4 text-center">
              <svg className="w-24 h-24 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-lg font-medium text-(--foreground)">Preview not available</p>
                <p className="text-sm text-(--muted-foreground) mt-1">
                  This file type ({currentFile.mimeType}) cannot be previewed in the browser.
                </p>
              </div>
              <Button onClick={() => onDownload(currentFile.id, currentFile.name)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download File
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
