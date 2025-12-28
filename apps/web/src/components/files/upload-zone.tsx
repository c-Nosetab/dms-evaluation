'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function UploadZone({
  onFilesSelected,
  className,
  disabled,
  children,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected]
  );

  // Expose a method to programmatically trigger the file input
  const triggerFileInput = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      className={cn(
        'relative transition-all duration-200',
        isDragging && 'ring-2 ring-(--primary) ring-offset-2 rounded-lg',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      {isDragging && (
        <div className="absolute inset-0 bg-(--primary)/10 border-2 border-dashed border-(--primary) rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto text-(--primary) mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="font-medium text-(--primary)">Drop files here</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
