'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { UploadZone } from './upload-zone';
import { UploadProgress } from './upload-progress';
import { FileInfoPanel } from './file-info-panel';
import { FolderInfoPanel } from './folder-info-panel';
import { FilePreviewModal } from './file-preview-modal';
import { RenameDialog } from './rename-dialog';
import { CreateFolderDialog } from './create-folder-dialog';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useProcessing } from '@/contexts/processing-context';

interface BreadcrumbItem {
	id: string | null;
	name: string;
}

interface FolderItem {
	id: string;
	name: string;
	parentId: string | null;
	isStarred?: boolean;
	createdAt: string;
	updatedAt?: string;
}

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

interface DashboardContentProps {
	userName?: string | null;
}

type ViewMode = 'grid' | 'list';

export function DashboardContent({ userName }: DashboardContentProps) {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [folders, setFolders] = useState<FolderItem[]>([]);

	// Processing context for shared job state
	const { jobs: processingJobs, removeJob } = useProcessing();
	const [viewMode, setViewMode] = useState<ViewMode>('list');
	const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
	const [infoFile, setInfoFile] = useState<FileItem | null>(null);
	const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
	const [renameFile, setRenameFile] = useState<FileItem | null>(null);
	const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

	// Folder navigation state
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
	const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
		{ id: null, name: 'My Files' },
	]);
	const [infoFolder, setInfoFolder] = useState<FolderItem | null>(null);
	const [renameFolder, setRenameFolder] = useState<FolderItem | null>(null);

	// Track if initial animation has played (only animate on first page load)
	const [hasAnimated, setHasAnimated] = useState(false);
	useEffect(() => {
		// Mark as animated after first render
		const timer = setTimeout(() => setHasAnimated(true), 500);
		return () => clearTimeout(timer);
	}, []);

	// Sync infoFile with updated files array (e.g., after OCR completes)
	// This ensures the info panel shows fresh data when loadData refreshes the files
	useEffect(() => {
		if (infoFile) {
			const updatedFile = files.find((f) => f.id === infoFile.id);
			if (
				updatedFile &&
				(updatedFile.ocrText !== infoFile.ocrText ||
					updatedFile.ocrSummary !== infoFile.ocrSummary ||
					updatedFile.ocrProcessedAt !== infoFile.ocrProcessedAt ||
					updatedFile.name !== infoFile.name ||
					updatedFile.isStarred !== infoFile.isStarred)
			) {
				setInfoFile(updatedFile);
			}
		}
	}, [files, infoFile]);

	const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
	const searchParams = useSearchParams();

	// Load files and folders from API based on current folder
	const loadData = useCallback(
		async (folderId: string | null) => {
			try {
				const folderParam = folderId ? `?folderId=${folderId}` : '';
				const parentParam = folderId ? `?parentId=${folderId}` : '';

				const [filesResponse, foldersResponse] = await Promise.all([
					fetch(`${apiUrl}/files${folderParam}`, { credentials: 'include' }),
					fetch(`${apiUrl}/folders${parentParam}`, { credentials: 'include' }),
				]);

				// Update both at once to minimize re-renders
				const newFiles = filesResponse.ok
					? (await filesResponse.json()).files || []
					: [];
				const newFolders = foldersResponse.ok
					? (await foldersResponse.json()).folders || []
					: [];

				setFiles(newFiles);
				setFolders(newFolders);
			} catch (error) {
				console.error('Failed to load data:', error);
			}
		},
		[apiUrl]
	);

	// Load breadcrumb for current folder
	const loadBreadcrumb = useCallback(
		async (folderId: string) => {
			try {
				const response = await fetch(
					`${apiUrl}/folders/${folderId}/breadcrumb`,
					{
						credentials: 'include',
					}
				);
				if (response.ok) {
					const data = await response.json();
					setBreadcrumb([{ id: null, name: 'My Files' }, ...data.breadcrumb]);
				}
			} catch (error) {
				console.error('Failed to load breadcrumb:', error);
			}
		},
		[apiUrl]
	);

	// Sync currentFolderId from URL and load data
	useEffect(() => {
		const folderId = searchParams?.get('folder') || null;
		setCurrentFolderId(folderId);
		loadData(folderId);

		if (folderId) {
			loadBreadcrumb(folderId);
		} else {
			setBreadcrumb([{ id: null, name: 'My Files' }]);
		}
	}, [searchParams, loadData, loadBreadcrumb]);

	const handleUploadComplete = useCallback((file: FileItem) => {
		setFiles((prev) => [file, ...prev]);
	}, []);

	const { uploads, uploadFiles, removeUpload } = useFileUpload({
		folderId: currentFolderId,
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
						const response = await fetch(
							`${apiUrl}/files/${file.id}/download`,
							{
								credentials: 'include',
							}
						);
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
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
				'DOCX',
			'application/vnd.ms-excel': 'XLS',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
				'XLSX',
			'application/vnd.ms-powerpoint': 'PPT',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation':
				'PPTX',
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

	// Handle file download
	const handleDownload = useCallback(
		async (fileId: string, fileName: string) => {
			try {
				const response = await fetch(`${apiUrl}/files/${fileId}/download`, {
					credentials: 'include',
				});
				if (!response.ok) {
					throw new Error('Failed to get download URL');
				}
				const data = await response.json();

				// Create a temporary hidden link and trigger download
				const link = document.createElement('a');
				link.href = data.downloadUrl;
				link.download = fileName;
				link.style.display = 'none';
				document.body.appendChild(link);
				link.click();
				// Small delay before removing to ensure download starts
				setTimeout(() => {
					document.body.removeChild(link);
				}, 100);
			} catch (error) {
				console.error('Download failed:', error);
			}
		},
		[apiUrl]
	);

	// Handle file removal (soft delete - move to trash)
	const handleRemove = useCallback(
		async (fileId: string) => {
			try {
				const response = await fetch(`${apiUrl}/files/${fileId}`, {
					method: 'DELETE',
					credentials: 'include',
				});
				if (!response.ok) {
					throw new Error('Failed to delete file');
				}

				// Remove from local state
				setFiles((prev) => prev.filter((f) => f.id !== fileId));
				setSelectedFiles((prev) => {
					const newSet = new Set(prev);
					newSet.delete(fileId);
					return newSet;
				});
				// Close info panel if this file was open
				setInfoFile((prev) => (prev?.id === fileId ? null : prev));
			} catch (error) {
				console.error('Delete failed:', error);
			}
		},
		[apiUrl]
	);

	// Handle file star toggle
	const handleToggleFileStar = useCallback(
		async (fileId: string) => {
			try {
				const response = await fetch(`${apiUrl}/files/${fileId}/star`, {
					method: 'PATCH',
					credentials: 'include',
				});
				if (!response.ok) {
					throw new Error('Failed to toggle star');
				}

				const data = await response.json();

				// Update local state
				setFiles((prev) =>
					prev.map((f) =>
						f.id === fileId ? { ...f, isStarred: data.isStarred } : f
					)
				);
				// Update info panel if this file is open
				setInfoFile((prev) =>
					prev?.id === fileId ? { ...prev, isStarred: data.isStarred } : prev
				);
			} catch (error) {
				console.error('Toggle star failed:', error);
			}
		},
		[apiUrl]
	);

	// Handle folder star toggle
	const handleToggleFolderStar = useCallback(
		async (folderId: string) => {
			try {
				const response = await fetch(`${apiUrl}/folders/${folderId}/star`, {
					method: 'PATCH',
					credentials: 'include',
				});
				if (!response.ok) {
					throw new Error('Failed to toggle star');
				}

				const data = await response.json();

				// Update local state
				setFolders((prev) =>
					prev.map((f) =>
						f.id === folderId ? { ...f, isStarred: data.isStarred } : f
					)
				);
				// Update info panel if this folder is open
				setInfoFolder((prev) =>
					prev?.id === folderId ? { ...prev, isStarred: data.isStarred } : prev
				);
			} catch (error) {
				console.error('Toggle star failed:', error);
			}
		},
		[apiUrl]
	);

	// Track click timing for single vs double click detection
	const fileClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const fileClickCountRef = useRef(0);
	const folderClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const folderClickCountRef = useRef(0);
	const DOUBLE_CLICK_DELAY = 250; // ms to wait before confirming single click

	// Handle file click with single/double click detection
	const handleFileClick = useCallback((file: FileItem) => {
		fileClickCountRef.current += 1;

		if (fileClickCountRef.current === 1) {
			// First click - wait to see if it's a double click
			fileClickTimeoutRef.current = setTimeout(() => {
				if (fileClickCountRef.current === 1) {
					// Single click confirmed - open info panel
					setInfoFile(file);
				}
				fileClickCountRef.current = 0;
			}, DOUBLE_CLICK_DELAY);
		} else if (fileClickCountRef.current === 2) {
			// Double click - open preview modal
			if (fileClickTimeoutRef.current) {
				clearTimeout(fileClickTimeoutRef.current);
			}
			fileClickCountRef.current = 0;
			setPreviewFile(file);
		}
	}, []);

	// Handle view (opens preview modal for images and PDFs)
	const handleView = useCallback((file: FileItem) => {
		setPreviewFile(file);
	}, []);

	// Handle rename
	const handleRename = useCallback(
		async (fileId: string, newName: string) => {
			const response = await fetch(`${apiUrl}/files/${fileId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ name: newName }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to rename file');
			}

			const updatedFile = await response.json();

			// Update local state
			setFiles((prev) =>
				prev.map((f) =>
					f.id === fileId
						? { ...f, name: updatedFile.name, updatedAt: updatedFile.updatedAt }
						: f
				)
			);

			// Update info panel if this file is open
			setInfoFile((prev) =>
				prev?.id === fileId
					? {
							...prev,
							name: updatedFile.name,
							updatedAt: updatedFile.updatedAt,
						}
					: prev
			);
		},
		[apiUrl]
	);

	// Handle folder creation
	const handleCreateFolder = useCallback(
		async (name: string) => {
			const response = await fetch(`${apiUrl}/folders`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ name, parentId: currentFolderId }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to create folder');
			}

			const newFolder = await response.json();
			setFolders((prev) => [newFolder, ...prev]);
		},
		[apiUrl, currentFolderId]
	);

	// Handle folder navigation (direct navigation, used by double-click and menu)
	const handleFolderClick = useCallback(
		(folderId: string) => {
			const url = new URL(window.location.href);
			url.searchParams.set('folder', folderId);
			window.history.pushState({}, '', url.toString());
			setCurrentFolderId(folderId);
			loadData(folderId);
			loadBreadcrumb(folderId);
		},
		[loadData, loadBreadcrumb]
	);

	// Handle folder item click with single/double click detection
	// Single click: open info panel, Double click: navigate into folder
	const handleFolderItemClick = useCallback(
		(folder: FolderItem) => {
			folderClickCountRef.current += 1;

			if (folderClickCountRef.current === 1) {
				// First click - wait to see if it's a double click
				folderClickTimeoutRef.current = setTimeout(() => {
					if (folderClickCountRef.current === 1) {
						// Single click confirmed - open info panel
						setInfoFolder(folder);
					}
					folderClickCountRef.current = 0;
				}, DOUBLE_CLICK_DELAY);
			} else if (folderClickCountRef.current === 2) {
				// Double click - navigate into folder
				if (folderClickTimeoutRef.current) {
					clearTimeout(folderClickTimeoutRef.current);
				}
				folderClickCountRef.current = 0;
				handleFolderClick(folder.id);
			}
		},
		[handleFolderClick]
	);

	// Handle breadcrumb navigation
	const handleBreadcrumbClick = useCallback(
		(folderId: string | null) => {
			const url = new URL(window.location.href);
			if (folderId) {
				url.searchParams.set('folder', folderId);
			} else {
				url.searchParams.delete('folder');
			}
			window.history.pushState({}, '', url.toString());
			setCurrentFolderId(folderId);
			loadData(folderId);
			if (folderId) {
				loadBreadcrumb(folderId);
			} else {
				setBreadcrumb([{ id: null, name: 'My Files' }]);
			}
		},
		[loadData, loadBreadcrumb]
	);

	// Handle folder rename
	const handleFolderRename = useCallback(
		async (folderId: string, newName: string) => {
			const response = await fetch(`${apiUrl}/folders/${folderId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name: newName }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to rename folder');
			}

			const updatedFolder = await response.json();

			setFolders((prev) =>
				prev.map((f) =>
					f.id === folderId
						? {
								...f,
								name: updatedFolder.name,
								updatedAt: updatedFolder.updatedAt,
							}
						: f
				)
			);
			setInfoFolder((prev) =>
				prev?.id === folderId
					? {
							...prev,
							name: updatedFolder.name,
							updatedAt: updatedFolder.updatedAt,
						}
					: prev
			);
			// Update breadcrumb if current folder was renamed
			if (currentFolderId === folderId) {
				loadBreadcrumb(folderId);
			}
		},
		[apiUrl, currentFolderId, loadBreadcrumb]
	);

	// Handle folder removal (soft delete - move to trash)
	const handleFolderRemove = useCallback(
		async (folderId: string) => {
			try {
				const response = await fetch(`${apiUrl}/folders/${folderId}`, {
					method: 'DELETE',
					credentials: 'include',
				});
				if (!response.ok) {
					throw new Error('Failed to delete folder');
				}

				setFolders((prev) => prev.filter((f) => f.id !== folderId));
				setInfoFolder((prev) => (prev?.id === folderId ? null : prev));

				// If we deleted the current folder, navigate to parent
				if (currentFolderId === folderId) {
					const parent = breadcrumb[breadcrumb.length - 2] || {
						id: null,
						name: 'My Files',
					};
					handleBreadcrumbClick(parent.id);
				}
			} catch (error) {
				console.error('Delete failed:', error);
			}
		},
		[apiUrl, currentFolderId, breadcrumb, handleBreadcrumbClick]
	);

	const getFileIcon = (mimeType: string) => {
		if (mimeType.startsWith('image/')) {
			return (
				<svg
					className='w-8 h-8 text-(--primary)'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={1.5}
						d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
					/>
				</svg>
			);
		}
		if (mimeType === 'application/pdf') {
			return (
				<svg
					className='w-8 h-8 text-red-500'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={1.5}
						d='M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z'
					/>
				</svg>
			);
		}
		return (
			<svg
				className='w-8 h-8 text-(--muted-foreground)'
				fill='none'
				viewBox='0 0 24 24'
				stroke='currentColor'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={1.5}
					d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
				/>
			</svg>
		);
	};

	// Reusable folder action menu items for both dropdown and context menu
	const renderFolderMenuItems = (
		folder: FolderItem,
		MenuItemComponent: typeof DropdownMenuItem | typeof ContextMenuItem,
		SeparatorComponent:
			| typeof DropdownMenuSeparator
			| typeof ContextMenuSeparator
	) => (
		<>
			<MenuItemComponent onClick={() => handleFolderClick(folder.id)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
					/>
				</svg>
				Open
			</MenuItemComponent>
			<MenuItemComponent onClick={() => handleToggleFolderStar(folder.id)}>
				<svg
					className='w-4 h-4'
					fill={folder.isStarred ? 'currentColor' : 'none'}
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
					/>
				</svg>
				{folder.isStarred ? 'Unstar' : 'Star'}
			</MenuItemComponent>
			<MenuItemComponent onClick={() => setRenameFolder(folder)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
					/>
				</svg>
				Rename
			</MenuItemComponent>
			<MenuItemComponent onClick={() => setInfoFolder(folder)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
					/>
				</svg>
				Info
			</MenuItemComponent>
			<SeparatorComponent />
			<MenuItemComponent
				className='text-red-500 focus:text-red-500'
				onClick={() => handleFolderRemove(folder.id)}
			>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
					/>
				</svg>
				Move to Trash
			</MenuItemComponent>
		</>
	);

	// Reusable file action menu items for both dropdown and context menu
	const renderFileMenuItems = (
		file: FileItem,
		MenuItemComponent: typeof DropdownMenuItem | typeof ContextMenuItem,
		SeparatorComponent:
			| typeof DropdownMenuSeparator
			| typeof ContextMenuSeparator
	) => (
		<>
			<MenuItemComponent onClick={() => handleDownload(file.id, file.name)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
					/>
				</svg>
				Download
			</MenuItemComponent>
			<MenuItemComponent onClick={() => handleView(file)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
					/>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
					/>
				</svg>
				View
			</MenuItemComponent>
			<MenuItemComponent onClick={() => handleToggleFileStar(file.id)}>
				<svg
					className='w-4 h-4'
					fill={file.isStarred ? 'currentColor' : 'none'}
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
					/>
				</svg>
				{file.isStarred ? 'Unstar' : 'Star'}
			</MenuItemComponent>
			<MenuItemComponent onClick={() => setInfoFile(file)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
					/>
				</svg>
				Info
			</MenuItemComponent>
			<MenuItemComponent onClick={() => setRenameFile(file)}>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
					/>
				</svg>
				Rename
			</MenuItemComponent>
			<SeparatorComponent />
			<MenuItemComponent
				className='text-red-500 focus:text-red-500'
				onClick={() => handleRemove(file.id)}
			>
				<svg
					className='w-4 h-4'
					fill='none'
					viewBox='0 0 24 24'
					stroke='currentColor'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
					/>
				</svg>
				Move to Trash
			</MenuItemComponent>
		</>
	);

	return (
		<UploadZone
			onFilesSelected={handleFilesSelected}
			className='min-h-full'
		>
			<div className='space-y-8'>
				{/* Page header */}
				<div className={hasAnimated ? '' : 'animate-fade-up'}>
					<h1 className='text-2xl font-bold text-(--foreground) tracking-tight'>
						My Files
					</h1>
					<p className='text-(--muted-foreground)'>
						Welcome back, {userName?.split(' ')[0] || 'friend'}! Stashy&apos;s
						got your files.
					</p>
				</div>

				{/* Breadcrumb navigation */}
				{breadcrumb.length > 1 && (
					<nav
						className='flex items-center text-sm'
						aria-label='Breadcrumb'
					>
						{/* Mobile: Always show dropdown */}
						<div className='md:hidden flex items-center gap-1'>
							<DropdownMenu>
								<DropdownMenuTrigger className='flex items-center gap-1 px-2 py-1 rounded-md hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer'>
									<svg
										className='w-4 h-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
										/>
									</svg>
									<span className='max-w-[120px] truncate'>
										{breadcrumb[breadcrumb.length - 1]?.name}
									</span>
									<svg
										className='w-4 h-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M19 9l-7 7-7-7'
										/>
									</svg>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='start'>
									{breadcrumb.map((item, index) => (
										<DropdownMenuItem
											key={item.id ?? 'root'}
											onClick={() => handleBreadcrumbClick(item.id)}
											className={
												index === breadcrumb.length - 1 ? 'font-medium' : ''
											}
										>
											{index === 0 ? (
												<svg
													className='w-4 h-4'
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
													/>
												</svg>
											) : (
												<svg
													className='w-4 h-4'
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
													/>
												</svg>
											)}
											{item.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						{/* Desktop: Show full path or collapse at 3+ levels */}
						<div className='hidden md:flex items-center gap-1'>
							{breadcrumb.length <= 3 ? (
								// Show full breadcrumb path
								breadcrumb.map((item, index) => (
									<div
										key={item.id ?? 'root'}
										className='flex items-center gap-1'
									>
										{index > 0 && (
											<svg
												className='w-4 h-4 text-(--muted-foreground)'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M9 5l7 7-7 7'
												/>
											</svg>
										)}
										<button
											onClick={() => handleBreadcrumbClick(item.id)}
											className={`px-2 py-1 rounded-md hover:bg-(--muted) transition-colors ${
												index === breadcrumb.length - 1
													? 'text-(--foreground) font-medium'
													: 'text-(--muted-foreground) hover:text-(--foreground)'
											}`}
										>
											{index === 0 ? (
												<span className='flex items-center gap-1.5'>
													<svg
														className='w-4 h-4'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth={2}
															d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
														/>
													</svg>
													{item.name}
												</span>
											) : (
												item.name
											)}
										</button>
									</div>
								))
							) : (
								// Collapse middle items into dropdown
								<>
									{/* First item (My Files) */}
									<button
										onClick={() =>
											handleBreadcrumbClick(breadcrumb[0]?.id ?? null)
										}
										className='px-2 py-1 rounded-md hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors flex items-center gap-1.5'
									>
										<svg
											className='w-4 h-4'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
											/>
										</svg>
										{breadcrumb[0]?.name}
									</button>

									<svg
										className='w-4 h-4 text-(--muted-foreground)'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M9 5l7 7-7 7'
										/>
									</svg>

									{/* Middle items in dropdown */}
									<DropdownMenu>
										<DropdownMenuTrigger className='px-2 py-1 rounded-md hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer'>
											...
										</DropdownMenuTrigger>
										<DropdownMenuContent align='start'>
											{breadcrumb.slice(1, -1).map((item) => (
												<DropdownMenuItem
													key={item.id ?? 'item'}
													onClick={() => handleBreadcrumbClick(item.id)}
												>
													<svg
														className='w-4 h-4'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth={2}
															d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
														/>
													</svg>
													{item.name}
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>

									<svg
										className='w-4 h-4 text-(--muted-foreground)'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M9 5l7 7-7 7'
										/>
									</svg>

									{/* Last item (current folder) */}
									<button
										onClick={() =>
											handleBreadcrumbClick(
												breadcrumb[breadcrumb.length - 1]?.id ?? null
											)
										}
										className='px-2 py-1 rounded-md hover:bg-(--muted) text-(--foreground) font-medium transition-colors'
									>
										{breadcrumb[breadcrumb.length - 1]?.name}
									</button>
								</>
							)}
						</div>
					</nav>
				)}

				{/* Quick actions */}
				<div
					className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${hasAnimated ? '' : 'animate-fade-up delay-100'}`}
				>
					<Card
						className='group cursor-pointer card-hover'
						onClick={(e) => {
							e.stopPropagation();
							document
								.querySelector<HTMLInputElement>('input[type="file"]')
								?.click();
						}}
					>
						<CardContent className='p-4'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors'>
									<svg
										className='w-5 h-5 text-(--primary)'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
										/>
									</svg>
								</div>
								<div>
									<p className='font-medium text-(--foreground)'>
										Upload Files
									</p>
									<p className='text-sm text-(--muted-foreground)'>
										Add new documents
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card
						className='group cursor-pointer card-hover'
						onClick={(e) => {
							e.stopPropagation();
							setIsCreateFolderOpen(true);
						}}
					>
						<CardContent className='p-4'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 rounded-lg bg-(--accent)/10 flex items-center justify-center group-hover:bg-(--accent)/20 transition-colors'>
									<svg
										className='w-5 h-5 text-(--accent)'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
										/>
									</svg>
								</div>
								<div>
									<p className='font-medium text-(--foreground)'>
										Create Folder
									</p>
									<p className='text-sm text-(--muted-foreground)'>
										Organize your files
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* <Card
						className='group cursor-pointer card-hover'
						onClick={(e) => e.stopPropagation()}
					>
						<CardContent className='p-4'>
							<div className='flex items-center gap-3'>
								<div className='w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors'>
									<svg
										className='w-5 h-5 text-(--primary)'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
										/>
									</svg>
								</div>
								<div>
									<p className='font-medium text-(--foreground)'>Share Files</p>
									<p className='text-sm text-(--muted-foreground)'>
										Collaborate with others
									</p>
								</div>
							</div>
						</CardContent>
					</Card> */}
				</div>

				{/* Files grid or empty state */}
				{files.length > 0 || folders.length > 0 ? (
					<div className={hasAnimated ? '' : 'animate-fade-up delay-200'}>
						{/* Header with view toggle */}
						<div className='flex justify-between items-center mb-4'>
							<h2 className='text-lg font-semibold text-(--foreground)'>
								My Files
							</h2>
							<div className='flex items-center gap-1 p-1 rounded-lg bg-(--muted)/50'>
								<button
									onClick={() => setViewMode('grid')}
									className={`p-2 rounded-md transition-colors ${
										viewMode === 'grid'
											? 'bg-(--background) text-(--foreground) shadow-sm'
											: 'text-(--muted-foreground) hover:text-(--foreground)'
									}`}
									title='Grid view'
								>
									<svg
										className='w-4 h-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
										/>
									</svg>
								</button>
								<button
									onClick={() => setViewMode('list')}
									className={`p-2 rounded-md transition-colors ${
										viewMode === 'list'
											? 'bg-(--background) text-(--foreground) shadow-sm'
											: 'text-(--muted-foreground) hover:text-(--foreground)'
									}`}
									title='List view'
								>
									<svg
										className='w-4 h-4'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M4 6h16M4 12h16M4 18h16'
										/>
									</svg>
								</button>
							</div>
						</div>

						{/* Grid View */}
						{viewMode === 'grid' && (
							<div className='gap-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
								{/* Folders first */}
								{folders.map((folder) => (
									<ContextMenu key={`folder-${folder.id}`}>
										<ContextMenuTrigger asChild>
											<Card
												className='group relative overflow-hidden cursor-pointer card-hover'
												onClick={() => handleFolderItemClick(folder)}
											>
												<CardContent className='p-0'>
													{/* Horizontal meatball menu in top right */}
													<div className='top-2 right-2 z-10 absolute'>
														<DropdownMenu>
															<DropdownMenuTrigger
																className='p-1.5 rounded-md bg-(--background)/80 backdrop-blur-sm hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors shadow-sm cursor-pointer'
																onClick={(e) => e.stopPropagation()}
															>
																<svg
																	className='w-4 h-4'
																	fill='none'
																	viewBox='0 0 24 24'
																	stroke='currentColor'
																>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z'
																	/>
																</svg>
															</DropdownMenuTrigger>
															<DropdownMenuContent
																align='end'
																sideOffset={-4}
																onClick={(e) => e.stopPropagation()}
															>
																{renderFolderMenuItems(
																	folder,
																	DropdownMenuItem,
																	DropdownMenuSeparator
																)}
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
													<div className='flex flex-col'>
														{/* Folder icon */}
														<div className='w-full aspect-square bg-(--muted)/30 flex items-center justify-center overflow-hidden'>
															<div className='flex justify-center items-center w-16 h-16'>
																<svg
																	className='w-12 h-12 text-(--accent)'
																	fill='none'
																	viewBox='0 0 24 24'
																	stroke='currentColor'
																>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={1.5}
																		d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
																	/>
																</svg>
															</div>
														</div>
														{/* Folder info */}
														<div className='p-3 text-center'>
															<div className='flex justify-center items-center gap-1'>
																<p className='text-sm font-medium text-(--foreground) truncate'>
																	{folder.name}
																</p>
																{folder.isStarred && (
																	<svg
																		className='w-3.5 h-3.5 text-amber-500 shrink-0'
																		fill='currentColor'
																		viewBox='0 0 24 24'
																	>
																		<path d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
																	</svg>
																)}
															</div>
															<p className='text-xs text-(--muted-foreground)'>
																Folder
															</p>
														</div>
													</div>
												</CardContent>
											</Card>
										</ContextMenuTrigger>
										<ContextMenuContent>
											{renderFolderMenuItems(
												folder,
												ContextMenuItem,
												ContextMenuSeparator
											)}
										</ContextMenuContent>
									</ContextMenu>
								))}

								{/* Files */}
								{files.map((file) => (
									<ContextMenu key={file.id}>
										<ContextMenuTrigger asChild>
											<Card
												className='group relative overflow-hidden cursor-pointer card-hover'
												onClick={() => handleFileClick(file)}
											>
												<CardContent className='p-0'>
													{/* Horizontal meatball menu in top right */}
													<div className='top-2 right-2 z-10 absolute'>
														<DropdownMenu>
															<DropdownMenuTrigger
																className='p-1.5 rounded-md bg-(--background)/80 backdrop-blur-sm hover:bg-(--muted) text-(--muted-foreground) hover:text-(--foreground) transition-colors shadow-sm cursor-pointer'
																onClick={(e) => e.stopPropagation()}
															>
																<svg
																	className='w-4 h-4'
																	fill='none'
																	viewBox='0 0 24 24'
																	stroke='currentColor'
																>
																	<path
																		strokeLinecap='round'
																		strokeLinejoin='round'
																		strokeWidth={2}
																		d='M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z'
																	/>
																</svg>
															</DropdownMenuTrigger>
															<DropdownMenuContent
																align='end'
																sideOffset={-4}
																onClick={(e) => e.stopPropagation()}
															>
																{renderFileMenuItems(
																	file,
																	DropdownMenuItem,
																	DropdownMenuSeparator
																)}
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
													<div className='flex flex-col'>
														{/* Thumbnail or icon */}
														<div className='w-full aspect-square bg-(--muted)/30 flex items-center justify-center overflow-hidden'>
															{file.mimeType.startsWith('image/') &&
															file.thumbnailUrl ? (
																<img
																	src={file.thumbnailUrl}
																	alt={file.name}
																	className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
																/>
															) : (
																<div className='flex justify-center items-center w-16 h-16'>
																	{getFileIcon(file.mimeType)}
																</div>
															)}
														</div>
														{/* File info */}
														<div className='p-3 text-center'>
															<div className='flex justify-center items-center gap-1'>
																<p className='text-sm font-medium text-(--foreground) truncate'>
																	{file.name}
																</p>
																{file.isStarred && (
																	<svg
																		className='w-3.5 h-3.5 text-amber-500 shrink-0'
																		fill='currentColor'
																		viewBox='0 0 24 24'
																	>
																		<path d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
																	</svg>
																)}
															</div>
															<p className='text-xs text-(--muted-foreground)'>
																{formatFileSize(file.sizeBytes)}
															</p>
														</div>
													</div>
												</CardContent>
											</Card>
										</ContextMenuTrigger>
										<ContextMenuContent>
											{renderFileMenuItems(
												file,
												ContextMenuItem,
												ContextMenuSeparator
											)}
										</ContextMenuContent>
									</ContextMenu>
								))}
							</div>
						)}

						{/* List View - Table Layout */}
						{viewMode === 'list' && (
							<Card>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className='w-12'>
												<Checkbox
													checked={
														selectedFiles.size === files.length &&
														files.length > 0
													}
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
											<TableHead className='hidden sm:table-cell'>
												Type
											</TableHead>
											<TableHead className='hidden lg:table-cell'>
												AI Status
											</TableHead>
											<TableHead className='hidden md:table-cell'>
												Size
											</TableHead>
											<TableHead className='hidden md:table-cell'>
												Uploaded
											</TableHead>
											<TableHead className='hidden xl:table-cell'>
												Modified
											</TableHead>
											<TableHead className='w-12'>
												<span className='sr-only'>Actions</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{/* Folders first */}
										{folders.map((folder) => (
											<ContextMenu key={`folder-${folder.id}`}>
												<ContextMenuTrigger asChild>
													<TableRow
														className='group cursor-pointer'
														onClick={() => handleFolderItemClick(folder)}
													>
														<TableCell>
															<Checkbox disabled />
														</TableCell>
														<TableCell>
															<div className='flex items-center gap-3'>
																<div className='w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center overflow-hidden shrink-0'>
																	<svg
																		className='w-6 h-6 text-(--accent)'
																		fill='none'
																		viewBox='0 0 24 24'
																		stroke='currentColor'
																	>
																		<path
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			strokeWidth={1.5}
																			d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
																		/>
																	</svg>
																</div>
																<span className='text-sm font-medium text-(--foreground) truncate max-w-[200px] sm:max-w-[300px]'>
																	{folder.name}
																</span>
																{folder.isStarred && (
																	<svg
																		className='w-4 h-4 text-amber-500 shrink-0'
																		fill='currentColor'
																		viewBox='0 0 24 24'
																	>
																		<path d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
																	</svg>
																)}
															</div>
														</TableCell>
														<TableCell className='hidden sm:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																Folder
															</span>
														</TableCell>
														<TableCell className='hidden lg:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																--
															</span>
														</TableCell>
														<TableCell className='hidden md:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																--
															</span>
														</TableCell>
														<TableCell className='hidden md:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{new Date(
																	folder.createdAt
																).toLocaleDateString()}
															</span>
														</TableCell>
														<TableCell className='hidden xl:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{new Date(
																	folder.updatedAt || folder.createdAt
																).toLocaleDateString()}
															</span>
														</TableCell>
														<TableCell>
															<DropdownMenu>
																<DropdownMenuTrigger
																	className='p-2 rounded-md hover:bg-(--muted)/50 text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer'
																	onClick={(e) => e.stopPropagation()}
																>
																	<svg
																		className='w-5 h-5'
																		fill='none'
																		viewBox='0 0 24 24'
																		stroke='currentColor'
																	>
																		<path
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			strokeWidth={2}
																			d='M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
																		/>
																	</svg>
																</DropdownMenuTrigger>
																<DropdownMenuContent
																	align='end'
																	sideOffset={-4}
																	onClick={(e) => e.stopPropagation()}
																>
																	{renderFolderMenuItems(
																		folder,
																		DropdownMenuItem,
																		DropdownMenuSeparator
																	)}
																</DropdownMenuContent>
															</DropdownMenu>
														</TableCell>
													</TableRow>
												</ContextMenuTrigger>
												<ContextMenuContent>
													{renderFolderMenuItems(
														folder,
														ContextMenuItem,
														ContextMenuSeparator
													)}
												</ContextMenuContent>
											</ContextMenu>
										))}

										{/* Files */}
										{files.map((file) => (
											<ContextMenu key={file.id}>
												<ContextMenuTrigger asChild>
													<TableRow
														className='group cursor-pointer'
														data-state={
															selectedFiles.has(file.id)
																? 'selected'
																: undefined
														}
														onClick={() => handleFileClick(file)}
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
															<div className='flex items-center gap-3'>
																<div className='w-10 h-10 rounded-lg bg-(--muted)/30 flex items-center justify-center overflow-hidden shrink-0'>
																	{file.mimeType.startsWith('image/') &&
																	file.thumbnailUrl ? (
																		<img
																			src={file.thumbnailUrl}
																			alt={file.name}
																			className='w-full h-full object-cover'
																		/>
																	) : (
																		<div className='flex justify-center items-center w-6 h-6'>
																			{getFileIcon(file.mimeType)}
																		</div>
																	)}
																</div>
																<span className='text-sm font-medium text-(--foreground) truncate max-w-[200px] sm:max-w-[300px]'>
																	{file.name}
																</span>
																{file.isStarred && (
																	<svg
																		className='w-4 h-4 text-amber-500 shrink-0'
																		fill='currentColor'
																		viewBox='0 0 24 24'
																	>
																		<path d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' />
																	</svg>
																)}
															</div>
														</TableCell>
														{/* Type */}
														<TableCell className='hidden sm:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{getFileType(file.mimeType)}
															</span>
														</TableCell>
														{/* AI Status */}
														<TableCell className='hidden lg:table-cell'>
															{file.mimeType === 'application/pdf' ||
															file.mimeType.startsWith('image/') ? (
																file.ocrText || file.ocrSummary ? (
																	<div className='flex items-center gap-1'>
																		{file.ocrText && (
																			<span
																				className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-(--primary)/10 text-(--primary)'
																				title='Text Extracted'
																			>
																				<svg
																					className='w-3 h-3'
																					fill='none'
																					viewBox='0 0 24 24'
																					stroke='currentColor'
																				>
																					<path
																						strokeLinecap='round'
																						strokeLinejoin='round'
																						strokeWidth={2}
																						d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
																					/>
																				</svg>
																				OCR
																			</span>
																		)}
																		{file.ocrSummary && (
																			<span
																				className='inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium text-amber-600 text-xs'
																				title='Summary Available'
																			>
																				<svg
																					className='w-3 h-3'
																					fill='none'
																					viewBox='0 0 24 24'
																					stroke='currentColor'
																				>
																					<path
																						strokeLinecap='round'
																						strokeLinejoin='round'
																						strokeWidth={2}
																						d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
																					/>
																				</svg>
																				AI
																			</span>
																		)}
																	</div>
																) : (
																	<span className='text-xs text-(--muted-foreground)'>
																		Not processed
																	</span>
																)
															) : (
																<span className='text-sm text-(--muted-foreground)'>
																	--
																</span>
															)}
														</TableCell>
														{/* Size */}
														<TableCell className='hidden md:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{formatFileSize(file.sizeBytes)}
															</span>
														</TableCell>
														{/* Upload date */}
														<TableCell className='hidden md:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{new Date(file.createdAt).toLocaleDateString()}
															</span>
														</TableCell>
														{/* Modified date */}
														<TableCell className='hidden xl:table-cell'>
															<span className='text-sm text-(--muted-foreground)'>
																{new Date(file.createdAt).toLocaleDateString()}
															</span>
														</TableCell>
														{/* Meatball menu */}
														<TableCell>
															<DropdownMenu>
																<DropdownMenuTrigger
																	className='p-2 rounded-md hover:bg-(--muted)/50 text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer'
																	onClick={(e) => e.stopPropagation()}
																>
																	<svg
																		className='w-5 h-5'
																		fill='none'
																		viewBox='0 0 24 24'
																		stroke='currentColor'
																	>
																		<path
																			strokeLinecap='round'
																			strokeLinejoin='round'
																			strokeWidth={2}
																			d='M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z'
																		/>
																	</svg>
																</DropdownMenuTrigger>
																<DropdownMenuContent
																	align='end'
																	sideOffset={-4}
																	onClick={(e) => e.stopPropagation()}
																>
																	{renderFileMenuItems(
																		file,
																		DropdownMenuItem,
																		DropdownMenuSeparator
																	)}
																</DropdownMenuContent>
															</DropdownMenu>
														</TableCell>
													</TableRow>
												</ContextMenuTrigger>
												<ContextMenuContent>
													{renderFileMenuItems(
														file,
														ContextMenuItem,
														ContextMenuSeparator
													)}
												</ContextMenuContent>
											</ContextMenu>
										))}
									</TableBody>
								</Table>
							</Card>
						)}
					</div>
				) : (
					/* Empty state with Stashy - animated */
					<Card
						className={`border-2 border-dashed border-(--primary)/20 bg-gradient-cream ${hasAnimated ? '' : 'animate-fade-up delay-200'}`}
					>
						<CardContent className='p-12 text-center'>
							<div className='space-y-6'>
								{/* Stashy mascot with float animation */}
								<div className='relative mx-auto w-28 h-28 animate-float'>
									<Image
										src='/squirrel_logo.webp'
										alt='Stashy the Squirrel'
										fill
										className='drop-shadow-lg object-contain'
									/>
								</div>

								<div className='space-y-2'>
									<p className='text-lg font-semibold text-(--foreground)'>
										{currentFolderId
											? 'This folder is empty'
											: "Stashy hasn't found anything here yet"}
									</p>
									<p className='text-sm text-(--muted-foreground) max-w-md mx-auto leading-relaxed'>
										{currentFolderId
											? 'Drop files here or click "Upload Files" to add content to this folder.'
											: 'Upload your first file and let Stashy handle it. Your documents will be stored securely in the cloud.'}
									</p>
								</div>

								{/* Drop hint */}
								<p className='text-xs text-(--muted-foreground)'>
									Drag and drop files anywhere on this page
								</p>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Upload progress indicator */}
			<UploadProgress
				uploads={uploads}
				processingJobs={processingJobs}
				onRemove={removeUpload}
				onRemoveJob={removeJob}
			/>

			{/* File info panel (slides in from right) */}
			<FileInfoPanel
				file={infoFile}
				onClose={() => setInfoFile(null)}
				onDownload={handleDownload}
				onRemove={handleRemove}
				onRename={(file) => setRenameFile(file)}
				onToggleStar={handleToggleFileStar}
				onRefresh={() => loadData(currentFolderId)}
			/>

			{/* File preview modal (for images and PDFs) */}
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

			{/* Create folder dialog */}
			<CreateFolderDialog
				isOpen={isCreateFolderOpen}
				onClose={() => setIsCreateFolderOpen(false)}
				onCreate={handleCreateFolder}
			/>

			{/* Folder info panel (slides in from right) */}
			<FolderInfoPanel
				folder={infoFolder}
				onClose={() => setInfoFolder(null)}
				onRename={(folder) => setRenameFolder(folder)}
				onRemove={handleFolderRemove}
				onToggleStar={handleToggleFolderStar}
			/>

			{/* Rename folder dialog */}
			<RenameDialog
				isOpen={renameFolder !== null}
				currentName={renameFolder?.name || ''}
				onClose={() => setRenameFolder(null)}
				onRename={async (newName) => {
					if (renameFolder) {
						await handleFolderRename(renameFolder.id, newName);
					}
				}}
			/>
		</UploadZone>
	);
}
