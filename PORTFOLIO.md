# Squirrel Away - Cloud Document Management System

## Overview

A full-stack, production-grade document management system built as a technical evaluation project. Features Google Drive-like functionality with AI-powered search, OCR text extraction, and real-time file processing.

**Live Demo**: [Your deployed URL]
**Source**: [GitHub repo if public]

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14 (App Router), React 19, Tailwind CSS 4, shadcn/ui |
| **Backend** | NestJS 11, Express 5, TypeScript 5.9 |
| **Database** | PostgreSQL + Drizzle ORM (type-safe queries) |
| **Auth** | NextAuth.js v5 (Google & GitHub OAuth) |
| **Storage** | Cloudflare R2 (S3-compatible) with presigned URLs |
| **Queue** | Redis + BullMQ for async job processing |
| **AI/ML** | OpenAI Vision API, Tesseract.js OCR, Sharp image processing |
| **Infra** | Turborepo monorepo, Railway deployment |

---

## Key Features

### File Management
- **Direct-to-cloud uploads** via presigned URLs (bypasses API server for performance)
- Nested folder hierarchy with breadcrumb navigation
- Soft delete with trash recovery
- File starring and recent files tracking
- Grid/list view toggle with responsive design

### AI-Powered Search & Processing
- **Full-text search** across filenames AND extracted document text
- **Hybrid OCR pipeline**: Fast PDF text extraction → image-based OCR fallback → OpenAI Vision for complex documents
- **AI image descriptions**: Automatically describes uploaded images, making them searchable by content
- Real-time job progress tracking (0-100%) for long-running tasks

### File Processing Queue
- PDF splitting into individual pages
- Image format conversion (PNG, JPEG, WebP) with quality control
- Thumbnail generation for PDF previews
- Exponential backoff retry with job prioritization

### Design System
- CSS variable-based theming (no hardcoded colors)
- Light/dark mode with warm, branded color palette
- Fully responsive from mobile to desktop
- Smooth animations and micro-interactions

---

## Technical Highlights

### Architecture Decisions

**Presigned URL Pattern**
Files stream directly between browser and Cloudflare R2, eliminating API bandwidth bottlenecks. The API only handles metadata and URL generation.

**Type-Safe Database Layer**
Drizzle ORM provides end-to-end TypeScript safety with inferred types from schema definitions—no runtime type mismatches.

**Async Processing with BullMQ**
Long-running tasks (OCR, PDF processing) run in background workers with Redis-backed queues. The UI polls for real-time progress updates.

**Hybrid OCR Strategy**
1. Attempt fast text extraction from digital PDFs
2. Fall back to Tesseract.js for scanned documents
3. Optional OpenAI Vision API for highest accuracy

### Code Quality
- Full TypeScript across frontend and backend
- ESLint + Prettier for consistent code style
- Turborepo for efficient monorepo builds with caching
- Clean service/controller separation in NestJS
- Indexed database columns for query performance

---

## API Design

```
Files:     POST/GET/PATCH/DELETE /files, /files/search, /files/recent, /files/starred
Folders:   POST/GET/PATCH/DELETE /folders, /folders/:id/breadcrumb
Processing: POST /processing/files/:id/ocr, /split, /convert
Health:    GET /health (DB + Redis connectivity)
```

All file operations return presigned URLs rather than streaming bytes through the API.

---

## What This Demonstrates

- **Full-stack proficiency**: React/Next.js frontend + NestJS backend in TypeScript
- **Cloud architecture**: S3-compatible storage, Redis queues, PostgreSQL
- **AI integration**: OpenAI API for vision/summarization, local OCR fallback
- **Production patterns**: Auth, soft deletes, job queues, error handling
- **UI/UX polish**: Responsive design, theming system, smooth interactions
- **DevOps awareness**: Monorepo structure, CI/CD, environment configuration

---

## Screenshots

*(Add 3-4 screenshots showing: dashboard with files, upload flow, search with AI content indicator, mobile responsive view)*
