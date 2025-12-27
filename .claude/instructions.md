# DMS Evaluation Project - Claude Instructions

## Project Overview

This is a Document Management System (DMS) built for a job interview evaluation. The goal is to demonstrate full-stack development skills with a cloud-based file storage solution similar to Google Drive.

## Tech Stack

| Layer        | Technology                                    |
| ------------ | --------------------------------------------- |
| Frontend     | Next.js 14+ (App Router, RSC, Server Actions) |
| Styling      | Tailwind CSS + shadcn/ui                      |
| Backend      | NestJS                                        |
| Database     | PostgreSQL + Drizzle ORM                      |
| Caching      | Redis                                         |
| Queue        | BullMQ                                        |
| File Storage | Cloudflare R2                                 |
| Auth         | NextAuth.js (Google + GitHub OAuth)           |
| Monorepo     | Turborepo                                     |

## File Structure

```
apps/
  web/          # Next.js frontend
  api/          # NestJS backend
packages/
  shared-types/ # Shared TypeScript types
  database/     # Drizzle schema and migrations
```

---

## Component Development

### 1. Use shadcn/ui Components

**Always use** existing components from `apps/web/components/ui/`:

```tsx
// ✅ CORRECT
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

// ❌ WRONG - Don't write custom components when shadcn has them
<button className='px-4 py-2 bg-blue-500'>Click</button>;
```

### 2. CSS Variables for All Styling

**All colors, spacing, and sizing must use CSS variables** defined in `globals.css`.

**Colors:**

```tsx
// ✅ CORRECT - Uses CSS variables via Tailwind
className = 'bg-background text-foreground border-border';
className = 'bg-primary text-primary-foreground';
className = 'bg-muted text-muted-foreground';

// ❌ WRONG - Hardcoded colors
className = 'bg-white text-gray-900 border-gray-300';
className = 'bg-blue-500 text-white';
```

**Spacing:**

```tsx
// ✅ CORRECT - Uses CSS variable spacing tokens
className = 'p-md gap-lg'; // Maps to --spacing-md, --spacing-lg

// ❌ WRONG - Arbitrary values
className = 'p-[17px] gap-[23px]';
```

### 3. Dark Mode Support Required

Every component must support light/dark mode via CSS variables. The `.dark` class on `<html>` automatically switches all CSS variables.

```tsx
// ✅ CORRECT - Automatically supports dark mode
className = 'bg-background text-foreground';

// ❌ WRONG - No dark mode support
className = 'bg-white text-black';
```

---

## Performance & API Requests

### 4. Use Context for User Session

**Never fetch user data on every render.** Use the UserContext:

```tsx
// ✅ CORRECT - Uses context (no extra request)
import { useUser } from '@/contexts/user-context';

function MyComponent() {
	const { user } = useUser();
	return <div>Welcome, {user?.name}</div>;
}

// ❌ WRONG - Fetches user on every render
function BadComponent() {
	const [user, setUser] = useState();
	useEffect(() => {
		fetch('/api/user').then(setUser);
	}, []);
}
```

### 5. Use SWR for Data Fetching

Use SWR (or React Query) for caching and revalidation:

```tsx
import useSWR from 'swr';

const { data: files, mutate } = useSWR('/api/files', fetcher, {
	revalidateOnFocus: false,
});
```

### 6. Presigned URLs for File Operations

File uploads and downloads should use presigned URLs to bypass our API:

```
Upload Flow:
1. Client → API: Request presigned URL
2. API → Client: Return presigned URL
3. Client → R2: Upload directly
4. Client → API: Confirm upload complete
```

---

## Database Operations

### 7. Use Drizzle ORM

All database queries use Drizzle. Never write raw SQL.

```tsx
// ✅ CORRECT - Drizzle ORM
import { db } from '@/lib/db';
import { files } from '@/lib/db/schema';

const userFiles = await db.query.files.findMany({
	where: eq(files.userId, userId),
});

// ❌ WRONG - Raw SQL
await db.execute('SELECT * FROM files WHERE user_id = $1', [userId]);
```

### 8. Database Resets Require Confirmation

**Never automatically run database reset commands.** Always ask first:

```
⚠️ WARNING: This will delete all existing data.
Do you want me to run the database reset?
```

---

## Code Organization

### 9. Keep Files Small

**Maximum file sizes:**

- Components: ~200-300 lines
- Pages: ~300-400 lines
- Services: ~200-300 lines

**When a file gets too large:**

1. Extract sub-components into separate files
2. Move business logic into services
3. Create feature-specific modules

### 10. Separation of Concerns

```
Frontend:
- /app/**         # Pages and routes only
- /components/**  # Reusable UI components
- /contexts/**    # React contexts
- /hooks/**       # Custom hooks
- /lib/**         # Utilities, API clients

Backend:
- /src/modules/** # Feature modules (files, folders, auth)
- /src/common/**  # Shared utilities, guards, decorators
```

---

## Authentication

### 11. JWT for API Authentication

- Frontend uses NextAuth for session management
- API uses JWT tokens extracted from NextAuth session
- All API routes require authentication via AuthGuard

```tsx
// NestJS Controller
@UseGuards(AuthGuard)
@Get('files')
async getFiles(@User() user: UserPayload) {
  return this.filesService.findByUser(user.id)
}
```

---

## Error Handling

### 12. Consistent Error Responses

API errors should follow a consistent format:

```json
{
	"statusCode": 400,
	"message": "File not found",
	"error": "BadRequest"
}
```

---

## Sharing Model (Google Drive-like)

### 13. Private by Default

All files/folders are private until explicitly shared.

**Sharing Hierarchy:**

- Folder shares apply to all contents
- New files in shared folder are auto-shared
- Individual files can have explicit overrides
- Removing folder share cascades to contents (unless explicitly shared)

```
/My Drive (private)
├── /Project A (shared with Team)
│   ├── doc1.pdf (inherits Team access)
│   ├── doc2.pdf (inherits + explicit share with John)
│   └── /Subfolder (inherits Team access)
```

---

## Testing with Playwright

### 14. Use Playwright MCP Tools for Validation

After implementing features, use Playwright to verify:

```
1. Navigate to the page
2. Take screenshots
3. Click/fill to test interactions
4. Verify text content
```

Test at multiple breakpoints: 320px, 640px, 768px, 1024px, 1280px

---

## Git Workflow

### 15. Iterative PR Workflow

Each feature follows: **Complete → Review → Validate → Commit → Push → PR → Merge**

**Commit Message Format:**

```
feat: add file upload with presigned URLs
fix: resolve folder navigation bug
chore: update dependencies
```

---

## Quick Reference

**Component Imports:**

```tsx
import { Button, Input, Card } from '@/components/ui';
```

**Context:**

```tsx
import { useUser } from '@/contexts/user-context';
```

**Database:**

```tsx
import { db } from '@/lib/db';
import { files, folders, users } from '@/lib/db/schema';
```

**Storage:**

```tsx
import { storageService } from '@/lib/storage';
const url = await storageService.getPresignedUrl(key);
```

---

## Checklist Before Completing a Feature

- [ ] Uses shadcn/ui components (no custom buttons/inputs)
- [ ] Uses CSS variables for colors/spacing (no hardcoded values)
- [ ] Supports dark mode
- [ ] Uses context for user data (no redundant fetches)
- [ ] Uses Drizzle ORM (no raw SQL)
- [ ] Files are reasonably sized (<400 lines)
- [ ] Tested with Playwright at multiple breakpoints
- [ ] No secrets/API keys committed
