'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UploadZone } from './upload-zone';
import { UploadProgress } from './upload-progress';
import { useFileUpload } from '@/hooks/use-file-upload';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  createdAt: string;
  thumbnailUrl?: string;
}

interface DashboardContentProps {
  userName?: string | null;
}

type ViewMode = 'grid' | 'list';

export function DashboardContent({ userName }: DashboardContentProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load files from API on mount
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const response = await fetch(`${apiUrl}/files`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setFiles(data.files || []);
        }
      } catch (error) {
        console.error('Failed to load files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, [apiUrl]);

  const handleUploadComplete = useCallback((file: FileItem) => {
    setFiles((prev) => [file, ...prev]);
  }, []);

  const { uploads, uploadFiles, removeUpload } = useFileUpload({
    onUploadComplete: handleUploadComplete,
    onError: (error, fileName) => {
      console.error(`Upload failed for ${fileName}: ${error}`);
    },
  });

  const handleFilesSelected = useCallback(
    (fileList: FileList) => {
      uploadFiles(fileList);
    },
    [uploadFiles]
  );

  // Fetch thumbnail URLs for image files
  useEffect(() => {

    const fetchThumbnails = async () => {
      const imageFiles = files.filter(
        (f) => f.mimeType.startsWith('image/') && !f.thumbnailUrl
      );

      if (imageFiles.length === 0) return;

      const updates: Record<string, string> = {};

      await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const response = await fetch(`${apiUrl}/files/${file.id}/download`, {
              credentials: 'include',
            });
            if (response.ok) {
              const data = await response.json();
              updates[file.id] = data.downloadUrl;
            }
          } catch (error) {
            console.error(`Failed to fetch thumbnail for ${file.name}:`, error);
          }
        })
      );

      if (Object.keys(updates).length > 0) {
        setFiles((prev) =>
          prev.map((f) =>
            updates[f.id] ? { ...f, thumbnailUrl: updates[f.id] } : f
          )
        );
      }
    };

    fetchThumbnails();
  }, [files]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileType = (mimeType: string) => {
    // Common mime type mappings to short friendly names
    const typeMap: Record<string, string> = {
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/webp': 'WebP',
      'image/svg+xml': 'SVG',
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'text/plain': 'TXT',
      'text/html': 'HTML',
      'text/css': 'CSS',
      'text/javascript': 'JS',
      'application/javascript': 'JS',
      'application/json': 'JSON',
      'application/zip': 'ZIP',
      'application/x-rar-compressed': 'RAR',
      'video/mp4': 'MP4',
      'video/webm': 'WebM',
      'audio/mpeg': 'MP3',
      'audio/wav': 'WAV',
    };

    if (typeMap[mimeType]) {
      return typeMap[mimeType];
    }

    // Fallback: extract subtype from mime and capitalize
    const parts = mimeType.split('/');
    const subtype = parts[1] || 'File';
    // Handle special cases like "svg+xml" -> "SVG"
    const cleanSubtype = subtype.split('+')[0] || 'File';
    return cleanSubtype.toUpperCase();
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-8 h-8 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  return (
    <UploadZone onFilesSelected={handleFilesSelected} className="min-h-full">
      <div className="space-y-8">
        {/* Page header with animation */}
        <div className="animate-fade-up">
          <h1 className="text-2xl font-bold text-(--foreground) tracking-tight">
            My Files
          </h1>
          <p className="text-(--muted-foreground)">
            Welcome back, {userName?.split(' ')[0] || 'friend'}! Stashy&apos;s
            got your files.
          </p>
        </div>

        {/* Quick actions with staggered animation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up delay-100">
          <Card
            className="card-hover cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-(--primary)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-(--foreground)">Upload Files</p>
                  <p className="text-sm text-(--muted-foreground)">
                    Add new documents
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover cursor-pointer group" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-(--accent)/10 flex items-center justify-center group-hover:bg-(--accent)/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-(--accent)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-(--foreground)">Create Folder</p>
                  <p className="text-sm text-(--muted-foreground)">
                    Organize your files
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover cursor-pointer group" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors">
                  <svg
                    className="w-5 h-5 text-(--primary)"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-(--foreground)">Share Files</p>
                  <p className="text-sm text-(--muted-foreground)">
                    Collaborate with others
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Files grid or empty state */}
        {files.length > 0 ? (
          <div className="animate-fade-up delay-200">
            {/* Header with view toggle */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-(--foreground)">
                Recent Files
              </h2>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-(--muted)/50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-(--background) text-(--foreground) shadow-sm'
                      : 'text-(--muted-foreground) hover:text-(--foreground)'
                  }`}
                  title="Grid view"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-(--background) text-(--foreground) shadow-sm'
                      : 'text-(--muted-foreground) hover:text-(--foreground)'
                  }`}
                  title="List view"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <Card
                    key={file.id}
                    className="card-hover cursor-pointer group overflow-hidden relative"
                  >
                    <CardContent className="p-0">
                      {/* Horizontal meatball menu in top right */}
                      <div className="absolute top-2 right-2 z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="p-1.5 rounded-md bg-(--background)/80 backdrop-blur-sm hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors shadow-sm cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                            </svg>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={-4}>
                            <DropdownMenuItem onClick={() => console.log('Download', file.id)}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log('View', file.id)}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => console.log('Info', file.id)}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Info
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-500 focus:text-red-500"
                              onClick={() => console.log('Remove', file.id)}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-col">
                        {/* Thumbnail or icon */}
                        <div className="w-full aspect-square bg-(--muted)/30 flex items-center justify-center overflow-hidden">
                          {file.mimeType.startsWith('image/') && file.thumbnailUrl ? (
                            <img
                              src={file.thumbnailUrl}
                              alt={file.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-16 h-16 flex items-center justify-center">
                              {getFileIcon(file.mimeType)}
                            </div>
                          )}
                        </div>
                        {/* File info */}
                        <div className="p-3 text-center">
                          <p className="text-sm font-medium text-(--foreground) truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-(--muted-foreground)">
                            {formatFileSize(file.sizeBytes)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* List View - Table Layout */}
            {viewMode === 'list' && (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedFiles.size === files.length && files.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFiles(new Set(files.map((f) => f.id)));
                            } else {
                              setSelectedFiles(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead className="hidden md:table-cell">Size</TableHead>
                      <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                      <TableHead className="hidden lg:table-cell">Modified</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow
                        key={file.id}
                        className="group cursor-pointer"
                        data-state={selectedFiles.has(file.id) ? 'selected' : undefined}
                      >
                        {/* Checkbox */}
                        <TableCell>
                          <Checkbox
                            checked={selectedFiles.has(file.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedFiles);
                              if (checked) {
                                newSelected.add(file.id);
                              } else {
                                newSelected.delete(file.id);
                              }
                              setSelectedFiles(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        {/* Name with preview */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center overflow-hidden shrink-0">
                              {file.mimeType.startsWith('image/') && file.thumbnailUrl ? (
                                <img
                                  src={file.thumbnailUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {getFileIcon(file.mimeType)}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-(--foreground) truncate max-w-[200px] sm:max-w-[300px]">
                              {file.name}
                            </span>
                          </div>
                        </TableCell>
                        {/* Type */}
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-(--muted-foreground)">
                            {getFileType(file.mimeType)}
                          </span>
                        </TableCell>
                        {/* Size */}
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-(--muted-foreground)">
                            {formatFileSize(file.sizeBytes)}
                          </span>
                        </TableCell>
                        {/* Upload date */}
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-(--muted-foreground)">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        {/* Modified date */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-(--muted-foreground)">
                            {new Date(file.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        {/* Meatball menu */}
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="p-2 rounded-md hover:bg-(--muted)/50 text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={-4}>
                              <DropdownMenuItem onClick={() => console.log('Download', file.id)}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => console.log('View', file.id)}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => console.log('Info', file.id)}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Info
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => console.log('Remove', file.id)}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        ) : (
          /* Empty state with Stashy - animated */
          <Card className="border-2 border-dashed border-(--primary)/20 animate-fade-up delay-200 bg-gradient-cream">
            <CardContent className="p-12 text-center">
              <div className="space-y-6">
                {/* Stashy mascot with float animation */}
                <div className="w-28 h-28 mx-auto relative animate-float">
                  <Image
                    src="/squirrel_logo.webp"
                    alt="Stashy the Squirrel"
                    fill
                    className="object-contain drop-shadow-lg"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-lg font-semibold text-(--foreground)">
                    Stashy hasn&apos;t found anything here yet
                  </p>
                  <p className="text-sm text-(--muted-foreground) max-w-md mx-auto leading-relaxed">
                    Upload your first file and let Stashy handle it. Your
                    documents will be stored securely in the cloud.
                  </p>
                </div>

                {/* Drop hint */}
                <p className="text-xs text-(--muted-foreground)">
                  Drag and drop files anywhere on this page
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload progress indicator */}
      <UploadProgress uploads={uploads} onRemove={removeUpload} />
    </UploadZone>
  );
}
