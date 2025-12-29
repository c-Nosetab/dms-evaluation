# Session Log - December 27, 2024

## Overview
Today's session focused on implementing the core file upload flow and dashboard UI for "Squirrel Away" DMS. We went from having basic auth working to a fully functional file upload system with a polished dashboard.

---

## What Was Accomplished

### 1. File Upload Flow (End-to-End with Cloudflare R2)

**What we built:**
- Created `FilesModule` and `FoldersModule` in NestJS with full CRUD endpoints
- Implemented presigned URL upload flow: Client gets signed URL → uploads directly to R2 → confirms with API
- Added database schema for files, folders, and shares tables

**Why presigned URLs?**
- Files upload directly to R2, bypassing our API server entirely
- Reduces server load and bandwidth costs
- Faster uploads for users (direct to edge storage)
- Standard pattern used by Google Drive, Dropbox, etc.

**Key files:**
- `apps/api/src/files/files.controller.ts` - REST endpoints for file CRUD
- `apps/api/src/files/files.service.ts` - Business logic, presigned URL generation
- `apps/api/src/storage/storage.service.ts` - R2/S3 SDK integration

### 2. R2 Signature Fix

**Problem:** Uploads were failing with `SignatureDoesNotMatch` errors from Cloudflare R2.

**Root cause:** AWS SDK v3 was calculating checksums that R2 doesn't support the same way.

**Solution:**
```typescript
// In S3Client configuration
requestChecksumCalculation: 'WHEN_REQUIRED',
responseChecksumValidation: 'WHEN_REQUIRED',

// In getSignedUrl options
unhoistableHeaders: new Set(['content-type']),
```

**Why this matters for interview:** Shows understanding of cloud storage quirks and debugging production issues.

### 3. Dashboard UI with Grid/List Views

**What we built:**
- Drag-and-drop upload zone covering the entire dashboard
- Toggle between grid (card) view and list (table) view
- File cards with thumbnails, meatball menus, hover effects
- Responsive table with columns: checkbox, name, type, size, uploaded, modified, actions

**Why both views?**
- Grid view: Better for visual files (images, thumbnails)
- List view: Better for dense file lists, sorting, bulk operations
- Matches user expectations from Google Drive, Finder, etc.

**Key files:**
- `apps/web/src/components/files/dashboard-content.tsx` - Main dashboard component
- `apps/web/src/components/files/upload-zone.tsx` - Drag-drop wrapper
- `apps/web/src/components/files/upload-progress.tsx` - Upload status indicator

### 4. Reusable UI Components

**Created:**
- `Table` component (Table, TableHeader, TableBody, TableRow, TableCell, etc.)
- `Checkbox` component (accessible, keyboard-friendly)
- `DropdownMenu` component (Radix UI-based with portal for proper z-index)

**Why build these?**
- shadcn/ui pattern: Unstyled primitives we own and customize
- No external dependencies for core UI
- CSS variables for theming consistency

### 5. File Selection System

**What we built:**
- Checkbox column in table view for multi-select
- `selectedFiles` state using `Set<string>` for O(1) lookups
- Select all / deselect all via header checkbox

**Why Set instead of Array?**
- O(1) add/remove/check operations
- Cleaner code: `selectedFiles.has(id)` vs `selectedFiles.includes(id)`

### 6. Meatball Menu with Actions

**What we built:**
- Vertical dots menu in table rows
- Horizontal dots menu in card top-right corner
- Dropdown with: Download, View, Info, Remove (placeholders for now)
- Portal-based dropdown that doesn't clip inside table overflow

**Technical decision - Radix Portal:**
The dropdown was getting cut off by the table's `overflow-auto`. Radix UI's `DropdownMenu` renders content in a portal (attached to document.body), solving z-index and clipping issues.

### 7. Orphaned Record Cleanup

**Problem:** If R2 upload fails after we create a DB record, we'd have orphaned file records pointing to nothing.

**Solution:**
```typescript
// In use-file-upload.ts
if (createdFileId) {
  try {
    await fetch(`${apiUrl}/files/${createdFileId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (deleteError) {
    console.error('Failed to delete orphaned file record:', deleteError);
  }
}
```

**Why this matters:** Data integrity - no ghost records in the database.

---

## Architecture Decisions Explained

### Presigned URL Flow
```
1. Client: POST /files (metadata: name, size, type)
2. API: Create DB record, generate presigned URL from R2
3. API: Return { id, uploadUrl }
4. Client: PUT file directly to uploadUrl (R2)
5. Client: File appears in list on next refresh
```

**Benefits:**
- API server never touches file bytes
- Scales horizontally (stateless API)
- CDN-friendly (R2 has built-in CDN)

### State Management Approach
- **useState for local UI state** (viewMode, selectedFiles, uploads)
- **useEffect for data fetching** (files list from API)
- **No global state library** - React's built-in is sufficient for this scope

### Component Structure
```
dashboard-content.tsx (main orchestrator)
├── UploadZone (drag-drop wrapper)
│   ├── Header section (title, view toggle, upload button)
│   ├── Grid View (Card components)
│   └── List View (Table component)
└── UploadProgress (floating progress indicator)
```

---

## UX Decisions

### View Toggle
- Grid icon for grid view, list icon for list view
- Active state uses primary color
- Persists during session (could add localStorage later)

### File Type Display
- Shortened MIME types: "WebP" not "image/webp"
- Consistent capitalization
- Fallback to "File" for unknown types

### Meatball Menu Positioning
- `sideOffset={-4}` pulls dropdown closer to trigger
- `align="end"` right-aligns with the dots
- Portal ensures it renders above all content

---

## What's Next (For Tomorrow)

### Immediate (Step 1.5/1.6 completion):
- [ ] Implement actual Download (presigned GET URL)
- [ ] Implement Remove (DELETE endpoint + UI confirmation)
- [ ] Add Info slider panel (single click behavior)
- [ ] Add View/Preview mode (double click behavior)

### Planned Interactions:
- **Single click** → Opens metadata slider from right side
- **Double click** → Opens full preview mode
- **Long click** → Enters multi-select mode for bulk operations

### Step 1.7: Folder Structure
- Folder CRUD endpoints
- Breadcrumb navigation
- Folder contents view

### Step 1.8: Deploy
- Vercel (frontend)
- Railway (backend)
- Environment configuration

---

## Files Changed Today

### New Files Created:
```
apps/api/src/files/
├── files.controller.ts
├── files.module.ts
├── files.service.ts
└── index.ts

apps/api/src/folders/
├── folders.controller.ts
├── folders.module.ts
├── folders.service.ts
└── index.ts

apps/web/src/components/files/
├── dashboard-content.tsx
├── upload-zone.tsx
├── upload-progress.tsx
└── index.ts

apps/web/src/components/ui/
├── table.tsx
├── checkbox.tsx
└── dropdown-menu.tsx (modified)

apps/web/src/hooks/
└── use-file-upload.ts

packages/database/src/schema.ts (added files, folders, shares tables)
```

### Modified Files:
```
apps/api/src/app.module.ts (added FilesModule, FoldersModule)
apps/api/src/storage/storage.service.ts (R2 checksum fix)
apps/web/app/(dashboard)/dashboard/page.tsx (uses DashboardContent)
```

---

## Git Commits

1. `feat: add dashboard UI shell with Squirrel Away branding` (previous session)
2. `feat: add file upload flow with dashboard grid/list views` (today's work)
   - 23 files changed, +2,297 lines

---

## Interview Talking Points from Today

1. **Direct-to-storage uploads** - Why presigned URLs are industry standard
2. **Cloud storage debugging** - R2 signature issues and how to solve them
3. **Component architecture** - Reusable primitives, composition over inheritance
4. **Data integrity** - Cleaning up orphaned records on failed uploads
5. **UX patterns** - Grid/list toggle, progressive disclosure with meatball menus
6. **Accessibility** - Checkbox with proper ARIA roles, keyboard navigation
