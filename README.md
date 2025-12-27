# DMS - Document Management System

A modern, cloud-based document management system built with Next.js, NestJS, and Cloudflare R2.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router, RSC) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | NestJS |
| Database | PostgreSQL + Drizzle ORM |
| Caching | Redis + BullMQ |
| File Storage | Cloudflare R2 |
| Auth | NextAuth.js (Google + GitHub OAuth) |
| Monorepo | Turborepo |

## Project Structure

```
apps/
  web/          # Next.js frontend (port 3000)
  api/          # NestJS backend (port 3001)
packages/
  shared-types/ # Shared TypeScript types
  ui/           # Shared UI components
  eslint-config/
  typescript-config/
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+

### Installation

```bash
# Install dependencies
npm install

# Run development servers
npm run dev

# Or run individually
npm run dev:web  # Next.js on port 3000
npm run dev:api  # NestJS on port 3001
```

### Build

```bash
npm run build
```

### Lint & Type Check

```bash
npm run lint
npm run type-check
```

## Features

- File upload/download with presigned URLs
- Folder organization
- Google Drive-like sharing with permissions
- Full-text search
- Real-time updates
- Light/Dark mode theming

## License

Private - Interview Evaluation Project
