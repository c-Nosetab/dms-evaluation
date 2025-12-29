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

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
}

type ViewMode = 'grid' | 'list';
type DeleteTarget = { type: 'file' | 'folder'; id: string; name: string } | null;

export function TrashContent() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Load trashed files and folders from API
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [filesResponse, foldersResponse] = await Promise.all([
        fetch(`${apiUrl}/files/trash`, { credentials: 'include' }),
        fetch(`${apiUrl}/folders/trash`, { credentials: 'include' }),
      ]);

      if (filesResponse.ok) {
        const data = await filesResponse.json();
        setFiles(data.files || []);
      }
      if (foldersResponse.ok) {
        const data = await foldersResponse.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Failed to load trashed items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDeletedTime = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const daysRemaining = 30 - diffDays;

    if (diffDays === 0) return 'Deleted today';
    if (diffDays === 1) return 'Deleted yesterday';
    if (daysRemaining <= 0) return 'Will be deleted soon';
    if (daysRemaining <= 7) return `${daysRemaining} days until permanent deletion`;
    return `Deleted ${diffDays} days ago`;
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

  // File handlers
  const handleRestoreFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${apiUrl}/files/${fileId}/restore`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to restore file');
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error('Restore failed:', error);
    }
  }, [apiUrl]);

  const handlePermanentDeleteFile = useCallback(async (fileId: string) => {
    try {
      const response = await fetch(`${apiUrl}/files/${fileId}/permanent`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to permanently delete file');
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error('Permanent delete failed:', error);
    }
  }, [apiUrl]);

  // Folder handlers
  const handleRestoreFolder = useCallback(async (folderId: string) => {
    try {
      const response = await fetch(`${apiUrl}/folders/${folderId}/restore`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to restore folder');
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    } catch (error) {
      console.error('Restore failed:', error);
    }
  }, [apiUrl]);

  const handlePermanentDeleteFolder = useCallback(async (folderId: string) => {
    try {
      const response = await fetch(`${apiUrl}/folders/${folderId}/permanent`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to permanently delete folder');
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    } catch (error) {
      console.error('Permanent delete failed:', error);
    }
  }, [apiUrl]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'file') {
      await handlePermanentDeleteFile(deleteTarget.id);
    } else {
      await handlePermanentDeleteFolder(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, handlePermanentDeleteFile, handlePermanentDeleteFolder]);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-8 h-8 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className="w-8 h-8 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  const renderFolderMenuItems = (
    folder: FolderItem,
    MenuItemComponent: typeof DropdownMenuItem | typeof ContextMenuItem,
    SeparatorComponent: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
  ) => (
    <>
      <MenuItemComponent onClick={() => handleRestoreFolder(folder.id)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Restore
      </MenuItemComponent>
      <SeparatorComponent />
      <MenuItemComponent
        className="text-red-500 focus:text-red-500"
        onClick={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Permanently
      </MenuItemComponent>
    </>
  );

  const renderFileMenuItems = (
    file: FileItem,
    MenuItemComponent: typeof DropdownMenuItem | typeof ContextMenuItem,
    SeparatorComponent: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
  ) => (
    <>
      <MenuItemComponent onClick={() => handleRestoreFile(file.id)}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Restore
      </MenuItemComponent>
      <SeparatorComponent />
      <MenuItemComponent
        className="text-red-500 focus:text-red-500"
        onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Permanently
      </MenuItemComponent>
    </>
  );

  const hasContent = files.length > 0 || folders.length > 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-(--foreground) tracking-tight">
          Trash
        </h1>
        <p className="text-(--muted-foreground)">
          Items in trash will be permanently deleted after 30 days
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card className="border-2 border-dashed border-(--border)">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 mx-auto bg-(--muted) rounded-full" />
              <div className="h-4 bg-(--muted) rounded w-1/3 mx-auto" />
            </div>
          </CardContent>
        </Card>
      ) : hasContent ? (
        <div className="space-y-8">
          {/* View toggle */}
          <div className="flex items-center justify-end">
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

          {/* Trashed Folders Section */}
          {folders.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-(--foreground) mb-4">
                Folders
              </h2>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {folders.map((folder) => (
                    <ContextMenu key={folder.id}>
                      <ContextMenuTrigger asChild>
                        <Card className="cursor-pointer group overflow-hidden relative opacity-60 hover:opacity-100 transition-opacity">
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
                                  {renderFolderMenuItems(folder, DropdownMenuItem, DropdownMenuSeparator)}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-col">
                              <div className="w-full aspect-square bg-(--muted)/30 flex items-center justify-center overflow-hidden">
                                <svg className="w-12 h-12 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                              </div>
                              <div className="p-3 text-center">
                                <p className="text-sm font-medium text-(--foreground) truncate">
                                  {folder.name}
                                </p>
                                <p className="text-xs text-(--muted-foreground)">
                                  {formatDeletedTime(folder.deletedAt)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        {renderFolderMenuItems(folder, ContextMenuItem, ContextMenuSeparator)}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folders.map((folder) => (
                        <ContextMenu key={folder.id}>
                          <ContextMenuTrigger asChild>
                            <TableRow className="group opacity-60 hover:opacity-100 transition-opacity">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center shrink-0">
                                    <svg className="w-6 h-6 text-(--muted-foreground)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                  </div>
                                  <span className="text-sm font-medium text-(--foreground) truncate max-w-[200px] sm:max-w-[300px]">
                                    {folder.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="text-sm text-(--muted-foreground)">Folder</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-(--muted-foreground)">
                                  {formatDeletedTime(folder.deletedAt)}
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
                                    {renderFolderMenuItems(folder, DropdownMenuItem, DropdownMenuSeparator)}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            {renderFolderMenuItems(folder, ContextMenuItem, ContextMenuSeparator)}
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          )}

          {/* Trashed Files Section */}
          {files.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-(--foreground) mb-4">
                Files
              </h2>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {files.map((file) => (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger asChild>
                        <Card className="cursor-pointer group overflow-hidden relative opacity-60 hover:opacity-100 transition-opacity">
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
                                <div className="w-16 h-16 flex items-center justify-center">
                                  {getFileIcon(file.mimeType)}
                                </div>
                              </div>
                              <div className="p-3 text-center">
                                <p className="text-sm font-medium text-(--foreground) truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-(--muted-foreground)">
                                  {formatDeletedTime(file.deletedAt)}
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
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Size</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file) => (
                        <ContextMenu key={file.id}>
                          <ContextMenuTrigger asChild>
                            <TableRow className="group opacity-60 hover:opacity-100 transition-opacity">
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center shrink-0">
                                    <div className="w-6 h-6 flex items-center justify-center">
                                      {getFileIcon(file.mimeType)}
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-(--foreground) truncate max-w-[200px] sm:max-w-[300px]">
                                    {file.name}
                                  </span>
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
                                  {formatDeletedTime(file.deletedAt)}
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
                  Trash is empty
                </p>
                <p className="text-sm text-(--muted-foreground) max-w-md mx-auto leading-relaxed">
                  Nothing to see here! Items you delete will appear in the trash for 30 days before being permanently removed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permanent delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
