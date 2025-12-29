'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useProcessing } from '@/contexts/processing-context';
import { getApiUrl } from '@/lib/api';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  isStarred?: boolean;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  // OCR fields
  ocrText?: string | null;
  ocrSummary?: string | null;
  ocrProcessedAt?: string | null;
}

type OcrMode = 'extract' | 'summary' | 'both';

interface FileInfoPanelProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (fileId: string, fileName: string) => void;
  onRemove: (fileId: string) => void;
  onRename: (file: FileItem) => void;
  onToggleStar?: (fileId: string) => void;
  onRefresh?: () => void;
}

export function FileInfoPanel({ file, onClose, onDownload, onRemove, onRename, onToggleStar, onRefresh }: FileInfoPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(null);

  // Processing context
  const { jobs: processingJobs, addJob } = useProcessing();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [splitNamePrefix, setSplitNamePrefix] = useState('');
  const [convertFormat, setConvertFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const [ocrSummary, setOcrSummary] = useState<string | null>(null);
  const [ocrMode, setOcrMode] = useState<OcrMode>('extract');
  const [showOcrModeDialog, setShowOcrModeDialog] = useState(false);

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
      // Same file but properties changed (e.g., renamed, starred, OCR processed), update
      if (
        file.name !== currentFile.name ||
        file.updatedAt !== currentFile.updatedAt ||
        file.isStarred !== currentFile.isStarred ||
        file.ocrText !== currentFile.ocrText ||
        file.ocrSummary !== currentFile.ocrSummary ||
        file.ocrProcessedAt !== currentFile.ocrProcessedAt
      ) {
        setCurrentFile(file);
      }
    } else if (!file && currentFile && !isClosing) {
      // File set to null externally (e.g., file deleted)
      handleClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Watch for job completions to trigger refresh
  useEffect(() => {
    if (!currentFile?.name) return;

    const completedJobs = processingJobs.filter(
      j => j.status === 'completed' && j.fileName === currentFile.name
    );

    if (completedJobs.length > 0 && onRefresh) {
      // Delay refresh to allow backend to finish processing
      const timeout = setTimeout(() => {
        onRefresh();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [processingJobs, currentFile?.name, onRefresh]);

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

  // Check if processing is available for this file type
  const isPdf = currentFile.mimeType.includes('pdf');
  const isImage = currentFile.mimeType.startsWith('image/');
  const canSplit = isPdf;
  const canConvert = isImage;

  // Processing API calls
  const apiUrl = getApiUrl();

  const handleSplitPdf = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
      const baseName = currentFile.name.replace(/\.pdf$/i, '');
      const prefix = splitNamePrefix || `${baseName} copy`;

      const response = await fetch(`${apiUrl}/processing/files/${currentFile.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ outputNamePrefix: prefix }),
      });

      if (!response.ok) throw new Error('Failed to start PDF split');

      const data = await response.json();
      addJob({
        jobId: data.jobId,
        fileName: currentFile.name,
        type: 'pdf-split',
        status: 'waiting',
      });
      setShowSplitDialog(false);
      setSplitNamePrefix('');
    } catch (error) {
      console.error('PDF split failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertImage = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${apiUrl}/processing/files/${currentFile.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetFormat: convertFormat, quality: 85 }),
      });

      if (!response.ok) throw new Error('Failed to start image conversion');

      const data = await response.json();
      addJob({
        jobId: data.jobId,
        fileName: currentFile.name,
        type: 'image-convert',
        status: 'waiting',
      });
      setShowConvertDialog(false);
    } catch (error) {
      console.error('Image conversion failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOcr = async (mode: OcrMode = 'extract') => {
    if (!currentFile) return;
    setIsProcessing(true);
    setOcrResult(null);
    setOcrSummary(null);
    setShowOcrModeDialog(false);
    try {
      const response = await fetch(`${apiUrl}/processing/files/${currentFile.id}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) throw new Error('Failed to start OCR');

      const data = await response.json();
      addJob({
        jobId: data.jobId,
        fileName: currentFile.name,
        type: 'ocr',
        status: 'waiting',
      });
    } catch (error) {
      console.error('OCR failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDescribeImage = async () => {
    if (!currentFile) return;
    setIsProcessing(true);
    setOcrResult(null);
    setOcrSummary(null);
    try {
      const response = await fetch(`${apiUrl}/processing/files/${currentFile.id}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'summary' }),
      });

      if (!response.ok) throw new Error('Failed to start image description');

      const data = await response.json();
      addJob({
        jobId: data.jobId,
        fileName: currentFile.name,
        type: 'image-describe',
        status: 'waiting',
      });
    } catch (error) {
      console.error('Image description failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter jobs for this specific file
  const getActiveJobs = () => {
    return processingJobs.filter(
      j => j.fileName === currentFile?.name && (j.status === 'waiting' || j.status === 'active')
    );
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
              <Image
                src={currentFile.thumbnailUrl}
                alt={currentFile.name}
                width={400}
                height={300}
                className="w-full h-full object-contain"
                unoptimized
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
            {onToggleStar && (
              <Button
                variant="outline"
                onClick={() => onToggleStar(currentFile.id)}
                className={currentFile.isStarred ? 'text-amber-500 hover:text-amber-600' : ''}
                title={currentFile.isStarred ? 'Unstar' : 'Star'}
              >
                <svg className="w-4 h-4" fill={currentFile.isStarred ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </Button>
            )}
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
              title="Move to Trash"
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

          {/* Processing Actions */}
          {(canSplit || canConvert || isPdf || isImage) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Active Jobs */}
                {getActiveJobs().length > 0 && (
                  <div className="mb-3 p-2 bg-(--muted)/50 rounded-md">
                    {getActiveJobs().map(job => (
                      <div key={job.jobId} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 animate-spin text-(--primary)" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-(--muted-foreground)">
                          {job.type === 'pdf-split' && 'Splitting PDF...'}
                          {job.type === 'image-convert' && 'Converting image...'}
                          {job.type === 'ocr' && 'Extracting text...'}
                          {job.type === 'image-describe' && 'Analyzing image...'}
                          {job.progress !== undefined && ` (${job.progress}%)`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* PDF Split Button */}
                {canSplit && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      const baseName = currentFile.name.replace(/\.pdf$/i, '');
                      setSplitNamePrefix(`${baseName} copy`);
                      setShowSplitDialog(true);
                    }}
                    disabled={isProcessing || getActiveJobs().length > 0}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Split PDF into Pages
                  </Button>
                )}

                {/* Image Convert Button */}
                {canConvert && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowConvertDialog(true)}
                    disabled={isProcessing || getActiveJobs().length > 0}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Convert to Different Format
                  </Button>
                )}

                {/* OCR Button - PDFs only */}
                {isPdf && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setShowOcrModeDialog(true)}
                    disabled={isProcessing || getActiveJobs().length > 0}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Extract Text / Summarize (AI)
                  </Button>
                )}

                {/* Describe Image Button - Images only */}
                {isImage && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleDescribeImage()}
                    disabled={isProcessing || getActiveJobs().length > 0}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Describe Image (AI)
                  </Button>
                )}

                {!canSplit && !canConvert && !isPdf && !isImage && (
                  <p className="text-sm text-(--muted-foreground)">
                    No processing options available for this file type.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* OCR Status - Show if file has been processed */}
          {(currentFile.ocrText || currentFile.ocrSummary) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  AI Processing Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  {currentFile.ocrText && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-(--primary)/10 text-(--primary)">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Text Extracted
                    </span>
                  )}
                  {currentFile.ocrSummary && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {isImage ? 'Description Available' : 'Summary Available'}
                    </span>
                  )}
                </div>

                {/* View Results Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOcrResult(currentFile.ocrText || null);
                    setOcrSummary(currentFile.ocrSummary || null);
                    setShowOcrDialog(true);
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View Results
                </Button>

                {/* Processed date */}
                {currentFile.ocrProcessedAt && (
                  <p className="text-xs text-(--muted-foreground) text-center">
                    Processed {formatDate(currentFile.ocrProcessedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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

      {/* PDF Split Dialog */}
      <AlertDialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Split PDF into Pages</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a separate PDF file for each page. Enter a name prefix for the output files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={splitNamePrefix}
              onChange={(e) => setSplitNamePrefix(e.target.value)}
              placeholder="e.g., 'split pdf' → 'split pdf 1.pdf', 'split pdf 2.pdf'"
            />
            <p className="mt-2 text-sm text-(--muted-foreground)">
              Output: {splitNamePrefix || 'document copy'} 1.pdf, {splitNamePrefix || 'document copy'} 2.pdf, ...
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSplitPdf} disabled={isProcessing}>
              {isProcessing ? 'Starting...' : 'Split PDF'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Convert Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Image Format</AlertDialogTitle>
            <AlertDialogDescription>
              Convert this image to a different format. A new file will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['png', 'jpeg', 'webp'] as const).map(format => (
                <Button
                  key={format}
                  variant={convertFormat === format ? 'default' : 'outline'}
                  onClick={() => setConvertFormat(format)}
                  className="w-full"
                >
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
            <p className="text-sm text-(--muted-foreground)">
              {convertFormat === 'png' && 'PNG: Lossless compression, supports transparency'}
              {convertFormat === 'jpeg' && 'JPEG: Smaller file size, best for photos'}
              {convertFormat === 'webp' && 'WebP: Modern format, excellent compression'}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertImage} disabled={isProcessing}>
              {isProcessing ? 'Starting...' : `Convert to ${convertFormat.toUpperCase()}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OCR Mode Selection Dialog */}
      <AlertDialog open={showOcrModeDialog} onOpenChange={setShowOcrModeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Text Processing</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how you want to process the text in this {isPdf ? 'PDF' : 'image'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <div className="grid gap-2">
              {([
                { mode: 'extract' as OcrMode, label: 'Extract Text Only', description: 'Get all text content from the document' },
                { mode: 'summary' as OcrMode, label: 'Summarize Only', description: 'Get an AI-generated summary of the document' },
                { mode: 'both' as OcrMode, label: 'Extract & Summarize', description: 'Get both the full text and a summary' },
              ]).map(option => (
                <Button
                  key={option.mode}
                  variant={ocrMode === option.mode ? 'default' : 'outline'}
                  onClick={() => setOcrMode(option.mode)}
                  className="w-full h-auto py-3 flex flex-col items-start text-left"
                >
                  <span className="font-medium">{option.label}</span>
                  <span className={`text-xs ${ocrMode === option.mode ? 'text-(--primary-foreground)/80' : 'text-(--muted-foreground)'}`}>
                    {option.description}
                  </span>
                </Button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleOcr(ocrMode)} disabled={isProcessing}>
              {isProcessing ? 'Starting...' : 'Process'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OCR Result Dialog */}
      <AlertDialog open={showOcrDialog} onOpenChange={setShowOcrDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isImage
                ? 'Image Description'
                : ocrResult && ocrSummary
                  ? 'Extracted Text & Summary'
                  : ocrSummary
                    ? 'Document Summary'
                    : 'Extracted Text'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isImage
                ? `AI-generated description of ${currentFile.name}`
                : ocrResult && ocrSummary
                  ? `AI-processed content from ${currentFile.name}`
                  : ocrSummary
                    ? `AI-generated summary of ${currentFile.name}`
                    : `Text extracted from ${currentFile.name}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-1 overflow-auto py-4 space-y-4">
            {/* Summary/Description Section */}
            {ocrSummary && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-(--foreground) flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {isImage ? (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      )}
                    </svg>
                    {isImage ? 'Image Description' : 'AI Summary'}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(ocrSummary)}
                    className="h-7 text-xs"
                  >
                    Copy
                  </Button>
                </div>
                <div className="p-4 bg-(--primary)/5 border border-(--primary)/20 rounded-md text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                  {ocrSummary}
                </div>
              </div>
            )}

            {/* Full Text Section */}
            {ocrResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-(--foreground) flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Full Text
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(ocrResult)}
                    className="h-7 text-xs"
                  >
                    Copy
                  </Button>
                </div>
                <pre className="p-4 bg-(--muted)/50 rounded-md text-sm whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                  {ocrResult}
                </pre>
              </div>
            )}

            {/* No content case */}
            {!ocrResult && !ocrSummary && (
              <p className="text-(--muted-foreground)">No content extracted.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
