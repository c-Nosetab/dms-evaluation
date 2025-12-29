'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateFolderDialog({ isOpen, onClose, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreate(trimmedName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  }, [name, onCreate, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              disabled={isSubmitting}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
