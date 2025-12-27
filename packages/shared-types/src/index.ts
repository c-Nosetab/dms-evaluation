// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// File types
export interface FileMetadata {
  id: string;
  userId: string;
  folderId: string | null;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type FileStatus = 'pending' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error';

// Folder types
export interface Folder {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  path: string;
  createdAt: Date;
}

// Share types
export interface Share {
  id: string;
  fileId: string | null;
  folderId: string | null;
  ownerId: string;
  sharedWithId: string | null;
  sharedWithTeamId: string | null;
  permission: Permission;
  isExplicit: boolean;
  inheritedFromFolderId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type Permission = 'view' | 'edit' | 'admin';

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

// Upload types
export interface PresignedUrlResponse {
  uploadUrl: string;
  fileId: string;
  expiresAt: Date;
}

export interface UploadConfirmation {
  fileId: string;
  success: boolean;
}
