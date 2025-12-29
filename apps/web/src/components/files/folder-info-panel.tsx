'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  isStarred?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface FolderInfoPanelProps {
  folder: FolderItem | null;
  onClose: () => void;
  onRename: (folder: FolderItem) => void;
  onRemove: (folderId: string) => void;
  onToggleStar?: (folderId: string) => void;
}

export function FolderInfoPanel({ folder, onClose, onRename, onRemove, onToggleStar }: FolderInfoPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<FolderItem | null>(null);

  // Handle opening: when folder changes from null to a folder
  useEffect(() => {
    if (folder && !currentFolder) {
      setCurrentFolder(folder);
      // Double RAF to ensure DOM paint before animation starts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else if (folder && currentFolder && folder.id !== currentFolder.id) {
      // Different folder selected, update without closing animation
      setCurrentFolder(folder);
    } else if (folder && currentFolder && folder.id === currentFolder.id) {
      // Same folder but properties changed (e.g., renamed, starred), update
      if (folder.name !== currentFolder.name || folder.updatedAt !== currentFolder.updatedAt || folder.isStarred !== currentFolder.isStarred) {
        setCurrentFolder(folder);
      }
    } else if (!folder && currentFolder && !isClosing) {
      // Folder set to null externally (e.g., folder deleted)
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, currentFolder, isClosing]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);

    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setCurrentFolder(null);
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

    if (currentFolder) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [currentFolder, handleClose]);

  if (!currentFolder) return null;

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
            {currentFolder.name}
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
          {/* Folder Icon Preview */}
          <div className="aspect-video bg-(--muted)/30 rounded-lg flex items-center justify-center overflow-hidden">
            <div className="text-center p-4">
              <svg className="w-24 h-24 mx-auto text-(--accent)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-(--muted-foreground)">
                Folder
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onRename(currentFolder)}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </Button>
            {onToggleStar && (
              <Button
                variant="outline"
                onClick={() => onToggleStar(currentFolder.id)}
                className={currentFolder.isStarred ? 'text-amber-500 hover:text-amber-600' : ''}
                title={currentFolder.isStarred ? 'Unstar' : 'Star'}
              >
                <svg className="w-4 h-4" fill={currentFolder.isStarred ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                onRemove(currentFolder.id);
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
              <CardTitle className="text-sm font-medium">Folder Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">Type</span>
                <span className="text-(--foreground) font-medium">Folder</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-(--muted-foreground)">Created</span>
                <span className="text-(--foreground)">{formatDate(currentFolder.createdAt)}</span>
              </div>
              {currentFolder.updatedAt && currentFolder.updatedAt !== currentFolder.createdAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-(--muted-foreground)">Modified</span>
                  <span className="text-(--foreground)">{formatDate(currentFolder.updatedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Future: Sharing section */}
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
