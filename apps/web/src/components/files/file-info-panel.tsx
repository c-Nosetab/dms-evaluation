'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface FileInfoPanelProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (fileId: string, fileName: string) => void;
  onRemove: (fileId: string) => void;
  onRename: (file: FileItem) => void;
}

export function FileInfoPanel({ file, onClose, onDownload, onRemove, onRename }: FileInfoPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);

  // Handle opening: when file changes from null to a file
  useEffect(() => {
    if (file && !currentFile) {
      setCurrentFile(file);
      // Double RAF to ensure DOM paint before animation starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else if (file && currentFile && file.id !== currentFile.id) {
      // Different file selected, update without closing animation
      setCurrentFile(file);
    } else if (file && currentFile && file.id === currentFile.id) {
      // Same file but properties changed (e.g., renamed), update
      if (file.name !== currentFile.name || file.updatedAt !== currentFile.updatedAt) {
        setCurrentFile(file);
      }
    } else if (!file && currentFile && !isClosing) {
      // File set to null externally (e.g., file deleted)
      handleClose();
    }
  }, [file, currentFile, isClosing]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);

    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setCurrentFile(null);
      setIsClosing(false);
      onClose();
    }, 300); // Match animation duration
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileTypeLabel = (mimeType: string) => {
    const parts = mimeType.split('/');
    const type = parts[0] || 'File';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-(--background) border-l border-(--border) shadow-xl z-50 overflow-y-auto transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-(--background) border-b border-(--border) p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--foreground) truncate pr-4">
            {currentFile.name}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-md hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Preview */}
          <div className="aspect-video bg-(--muted)/30 rounded-lg flex items-center justify-center overflow-hidden">
            {currentFile.mimeType.startsWith('image/') && currentFile.thumbnailUrl ? (
              <img
                src={currentFile.thumbnailUrl}
                alt={currentFile.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-4">
                <svg className="w-16 h-16 mx-auto text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-sm text-(--muted-foreground)">
                  No preview available
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => onDownload(currentFile.id, currentFile.name)}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => onRename(currentFile)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onRemove(currentFile.id);
              }}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </Button>
          </div>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">File Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">Type</span>
                <span className="text-(--foreground) font-medium">{getFileTypeLabel(currentFile.mimeType)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">MIME Type</span>
                <span className="text-(--foreground) font-mono text-xs">{currentFile.mimeType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">Size</span>
                <span className="text-(--foreground) font-medium">{formatFileSize(currentFile.sizeBytes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">Uploaded</span>
                <span className="text-(--foreground)">{formatDate(currentFile.createdAt)}</span>
              </div>
              {currentFile.updatedAt && currentFile.updatedAt !== currentFile.createdAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-(--muted-foreground)">Modified</span>
                  <span className="text-(--foreground)">{formatDate(currentFile.updatedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Future: Sharing, Comments, Activity sections */}
          <Card className="opacity-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-(--muted-foreground)">
                Only you have access
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
