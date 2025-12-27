# DMS Project - Claude Code Configuration

## Project Overview

This is a Document Management System (DMS) built for a CultureEngine/SocialToast.ai interview evaluation. The system provides cloud-based file storage similar to Google Drive.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router, RSC, Server Actions)
- **Styling**: Tailwind CSS + shadcn/ui with CSS variables theming
- **Backend**: NestJS
- **Database**: PostgreSQL + Drizzle ORM
- **Caching**: Redis + BullMQ
- **File Storage**: Cloudflare R2
- **Auth**: NextAuth.js (Google + GitHub OAuth)
- **Monorepo**: Turborepo

## Critical Rules

### 1. CSS Variables Only
All colors, spacing, and sizing MUST use CSS variables from `apps/web/app/globals.css`. Never use hardcoded color values like `bg-blue-500` or `text-gray-800`.

```tsx
// CORRECT
className="bg-(--primary) text-(--foreground)"

// WRONG
className="bg-blue-500 text-gray-900"
```

### 2. shadcn/ui Components First
Always use existing shadcn/ui components from `apps/web/src/components/ui/`. Don't reinvent buttons, inputs, cards, etc.

### 3. Drizzle ORM Only
All database queries use Drizzle. Never write raw SQL.

### 4. No Redundant API Calls
Use UserContext for session data. Use SWR for data fetching with caching.

### 5. Presigned URLs for Files
File uploads/downloads use presigned URLs to bypass the API server.

### 6. Ask Before Destructive Operations
Never auto-run database resets or migrations that delete data. Always ask first.

## File Structure

```
apps/
  web/          # Next.js frontend (port 3000)
  api/          # NestJS backend (port 3001)
packages/
  shared-types/ # Shared TypeScript types
  ui/           # Shared UI components (legacy)
  eslint-config/
  typescript-config/
```

## Development Commands

```bash
# Run all apps in development
npm run dev

# Run specific app
npm run dev:web  # Next.js only
npm run dev:api  # NestJS only

# Build all
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

## Sharing Model

- Private by default
- Folder shares cascade to contents
- Individual files can have explicit overrides
- `is_explicit` flag tracks inheritance vs direct shares

## Testing Workflow

Use Playwright MCP tools for local validation:
1. Navigate to pages
2. Take screenshots
3. Test interactions
4. Verify at breakpoints: 320px, 640px, 768px, 1024px, 1280px

## PR Workflow

Each feature: Complete -> Review -> Validate -> Commit -> Push -> PR -> Merge

Commit format: `feat:`, `fix:`, `chore:`, `docs:`
