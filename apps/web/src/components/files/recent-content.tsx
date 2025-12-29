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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { FileInfoPanel } from './file-info-panel';
import { FilePreviewModal } from './file-preview-modal';
import { RenameDialog } from './rename-dialog';

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  isStarred?: boolean;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
}

type ViewMode = 'grid' | 'list';

export function RecentContent() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [infoFile, setInfoFile] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load recent files from API
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${apiUrl}/files/recent?limit=50`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load recent files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
  }, [files, apiUrl]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getFileType = (mimeType: string) => {
    const typeMap: Record<string, string> = {
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPEG',
      'image/png': 'PNG',
      'image/gif': 'GIF',
      'image/webp': 'WebP',
      'application/pdf': 'PDF',
      'application/msword': 'DOC',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'text/plain': 'TXT',
      'application/json': 'JSON',
      'application/zip': 'ZIP',
      'video/mp4': 'MP4',
      'audio/mpeg': 'MP3',
    };

    if (typeMap[mimeType]) return typeMap[mimeType];
    const parts = mimeType.split('/');
    return (parts[1] || 'File').toUpperCase();
  };

  const handleDownload = useCallback(async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(`${apiUrl}/files/${fileId}/download`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to get download URL');
      const data = await response.json();

      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [apiUrl]);

  const handleRemove = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${apiUrl}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      setInfoFile((prev) => (prev?.id === fileId ? null : prev));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [apiUrl]);

  const handleToggleStar = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${apiUrl}/files/${fileId}/star`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to toggle star');
      const data = await response.json();
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, isStarred: data.isStarred } : f))
      );
      setInfoFile((prev) =>
        prev?.id === fileId ? { ...prev, isStarred: data.isStarred } : prev
      );
    } catch (error) {
      console.error('Toggle star failed:', error);
    }
  }, [apiUrl]);

  const handleView = useCallback((file: FileItem) => {
    setPreviewFile(file);
  }, []);

  const handleRename = useCallback(async (fileId: string, newName: string) => {
    const response = await fetch(`${apiUrl}/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to rename file');
    }

    const updatedFile = await response.json();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, name: updatedFile.name, updatedAt: updatedFile.updatedAt } : f
      )
    );
    setInfoFile((prev) =>
      prev?.id === fileId ? { ...prev, name: updatedFile.name, updatedAt: updatedFile.updatedAt } : prev
    );
  }, [apiUrl]);

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

  const renderFileMenuItems = (
    file: FileItem,
    MenuItemComponent: typeof DropdownMenuItem | typeof ContextMenuItem,
    SeparatorComponent: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
  ) => (
    <>
      <MenuItemComponent onClick={() => handleDownload(file.id, file.name)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download
      </MenuItemComponent>
      <MenuItemComponent onClick={() => handleView(file)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        View
      </MenuItemComponent>
      <MenuItemComponent onClick={() => handleToggleStar(file.id)}>
        <svg className="w-4 h-4" fill={file.isStarred ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        {file.isStarred ? 'Unstar' : 'Star'}
      </MenuItemComponent>
      <MenuItemComponent onClick={() => setInfoFile(file)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Info
      </MenuItemComponent>
      <MenuItemComponent onClick={() => setRenameFile(file)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Rename
      </MenuItemComponent>
      <SeparatorComponent />
      <MenuItemComponent
        className="text-red-500 focus:text-red-500"
        onClick={() => handleRemove(file.id)}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Move to Trash
      </MenuItemComponent>
    </>
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-(--foreground) tracking-tight">
          Recent
        </h1>
        <p className="text-(--muted-foreground)">
          Files you&apos;ve recently opened or downloaded
        </p>
      </div>

      {/* Files section */}
      {isLoading ? (
        <Card className="border-2 border-dashed border-(--border)">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 mx-auto bg-(--muted) rounded-full" />
              <div className="h-4 bg-(--muted) rounded w-1/3 mx-auto" />
            </div>
          </CardContent>
        </Card>
      ) : files.length > 0 ? (
        <div>
          {/* Header with view toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-(--foreground)">
              Recently Accessed
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
                <ContextMenu key={file.id}>
                  <ContextMenuTrigger asChild>
                    <Card
                      className="card-hover cursor-pointer group overflow-hidden relative"
                      onClick={() => setInfoFile(file)}
                    >
                      <CardContent className="p-0">
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
                            <DropdownMenuContent align="end" sideOffset={-4} onClick={(e) => e.stopPropagation()}>
                              {renderFileMenuItems(file, DropdownMenuItem, DropdownMenuSeparator)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-col">
                          <div className="w-full aspect-square bg-(--muted)/30 flex items-center justify-center overflow-hidden">
                            {file.mimeType.startsWith('image/') && file.thumbnailUrl ? (
                              <Image
                                src={file.thumbnailUrl}
                                alt={file.name}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                unoptimized
                              />
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center">
                                {getFileIcon(file.mimeType)}
                              </div>
                            )}
                          </div>
                          <div className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <p className="text-sm font-medium text-(--foreground) truncate">
                                {file.name}
                              </p>
                              {file.isStarred && (
                                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              )}
                            </div>
                            <p className="text-xs text-(--muted-foreground)">
                              {file.lastAccessedAt ? formatRelativeTime(file.lastAccessedAt) : 'Never accessed'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {renderFileMenuItems(file, ContextMenuItem, ContextMenuSeparator)}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead>Last Accessed</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          className="group cursor-pointer"
                          onClick={() => setInfoFile(file)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center overflow-hidden shrink-0">
                                {file.mimeType.startsWith('image/') && file.thumbnailUrl ? (
                                  <Image
                                    src={file.thumbnailUrl}
                                    alt={file.name}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                    unoptimized
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
                              {file.isStarred && (
                                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-sm text-(--muted-foreground)">
                              {getFileType(file.mimeType)}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-(--muted-foreground)">
                              {formatFileSize(file.sizeBytes)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-(--muted-foreground)">
                              {file.lastAccessedAt ? formatRelativeTime(file.lastAccessedAt) : 'Never'}
                            </span>
                          </TableCell>
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
                              <DropdownMenuContent align="end" sideOffset={-4} onClick={(e) => e.stopPropagation()}>
                                {renderFileMenuItems(file, DropdownMenuItem, DropdownMenuSeparator)}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {renderFileMenuItems(file, ContextMenuItem, ContextMenuSeparator)}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ) : (
        /* Empty state */
        <Card className="border-2 border-dashed border-(--primary)/20 bg-gradient-cream">
          <CardContent className="p-12 text-center">
            <div className="space-y-6">
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
                  No recent files yet
                </p>
                <p className="text-sm text-(--muted-foreground) max-w-md mx-auto leading-relaxed">
                  Files you open or download will appear here. Go to My Files to start browsing!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File info panel */}
      <FileInfoPanel
        file={infoFile}
        onClose={() => setInfoFile(null)}
        onDownload={handleDownload}
        onRemove={handleRemove}
        onRename={(file) => setRenameFile(file)}
        onToggleStar={handleToggleStar}
      />

      {/* File preview modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
      />

      {/* Rename dialog */}
      <RenameDialog
        isOpen={renameFile !== null}
        currentName={renameFile?.name || ''}
        onClose={() => setRenameFile(null)}
        onRename={async (newName) => {
          if (renameFile) {
            await handleRename(renameFile.id, newName);
          }
        }}
      />
    </div>
  );
}
