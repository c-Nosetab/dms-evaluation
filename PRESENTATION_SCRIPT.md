# Squirrel Away - Technical Presentation Script
## 15-Minute Architecture Overview

---

## Slide 1: Title Slide (30 seconds)

**Visual:** Project logo, title "Squirrel Away - Cloud Document Management System", your name, subtitle "Technical Architecture Overview"

**Script:**
> "Hi, I'm [Your Name], and today I'll walk you through Squirrel Away, a cloud-based document management system I built as part of this technical evaluation. Over the next 15 minutes, I'll focus on the high-level architecture, the key design decisions I made, and the trade-offs I considered. I'll keep it focused on the system design rather than code, but I'm happy to dive deeper into any area during questions."

---

## Slide 2: Problem Statement (1 minute)

**Visual:** 4 bullet points with icons representing each problem

**Content:**
- Secure cloud storage for documents
- Search documents by content, not just filename
- File processing shouldn't block the user
- Must scale without API bottlenecks

**Script:**
> "Before diving into the architecture, let me frame the problem I was solving. Users need a secure place to store documents in the cloud—think Google Drive or Dropbox. But beyond basic storage, I wanted documents to be searchable by their *content*, not just their filename. If someone uploads a scanned receipt, they should be able to search 'coffee' and find it.
>
> The third challenge is that processing files—extracting text, generating thumbnails—can be slow. I didn't want users staring at a loading spinner for 30 seconds after every upload.
>
> And finally, file uploads can be large. If every 10MB PDF flows through my API server, that becomes a scaling bottleneck very quickly. So I needed an architecture that keeps the API lightweight."

---

## Slide 3: Architecture Diagram (3-4 minutes) ⭐ KEY SLIDE

**Visual:** System architecture diagram showing:
- Client (Next.js) at top
- Two paths: Auth flow to API, Direct upload to R2
- API server connected to PostgreSQL and Redis
- Worker process connected to Redis queue
- External services: OpenAI, Cloudflare R2

**Script:**
> "Here's the high-level architecture. Let me walk through the main components and how they interact.
>
> At the top, we have the **client**—a Next.js application using React 19 and the App Router. This handles the UI, authentication flows, and coordinates uploads.
>
> There are two main data paths here, and this is intentional. For **authentication**, we go through NextAuth.js which supports Google and GitHub OAuth. Sessions are stored in PostgreSQL, so users stay logged in across devices.
>
> But for **file uploads**—and this is a key architectural decision—files go *directly* to Cloudflare R2, bypassing the API entirely. The client requests a presigned URL from the API, then uploads straight to object storage. I'll explain why in the next slide.
>
> The **NestJS API** handles everything except file bytes: user metadata, folder structure, search queries, and dispatching processing jobs. It's connected to **PostgreSQL** via Drizzle ORM for all persistent data—users, files, folders, and extracted text.
>
> When a file upload completes, the API pushes a job to **Redis via BullMQ**. A separate **worker process** picks up these jobs and handles the heavy lifting: OCR with Tesseract.js, AI-powered image descriptions via OpenAI's Vision API, PDF thumbnail generation, and format conversions.
>
> The worker writes results back to PostgreSQL—so when OCR extracts text from a document, that text becomes searchable immediately.
>
> This separation means the API stays fast and responsive. File processing happens asynchronously, and users see real-time progress updates without blocking."

---

## Slide 4: Presigned URL Pattern (2 minutes)

**Visual:** Sequence diagram showing 4 steps:
1. Client → API: "I want to upload file.pdf"
2. API → Client: "Here's a presigned URL (valid 1 hour)"
3. Client → R2: Direct upload (10MB)
4. Client → API: "Upload complete, start processing"

**Script:**
> "Let me zoom in on the presigned URL pattern because it's central to the architecture's scalability.
>
> When a user wants to upload a file, the client first asks the API for permission. The API generates a presigned URL—this is a time-limited, cryptographically signed URL that grants temporary write access to a specific location in R2.
>
> The client then uploads directly to Cloudflare R2. That 10 megabyte PDF never touches our API server. Once the upload completes, the client tells the API 'I'm done,' and that triggers the processing pipeline.
>
> Why does this matter? Three reasons:
>
> **Bandwidth**: Instead of proxying 10MB through our API, we're only handling maybe 1KB of metadata. That's a 10,000x reduction in API bandwidth.
>
> **Scaling**: Our API servers stay lightweight. We can handle thousands of concurrent uploads without scaling compute—R2 handles the heavy lifting.
>
> **Cost**: With traditional architectures, you pay for egress twice—once into your server, once out to storage. Here, there's only one hop.
>
> The trade-off is slightly more client complexity, but modern browsers handle this seamlessly."

---

## Slide 5: Async Processing Pipeline (2 minutes)

**Visual:** Pipeline diagram showing:
- Upload triggers job queue
- Jobs with priorities (1: Thumbnails, 2: PDF Split, 3: OCR)
- Worker processing with retry logic
- Progress updates back to client

**Script:**
> "Once a file is uploaded, we need to process it—extract text, generate thumbnails, maybe split a multi-page PDF. This can take anywhere from 1 second to 30 seconds depending on the file.
>
> Rather than making users wait, I push these tasks to a **BullMQ job queue** backed by Redis. The API responds immediately with 'upload successful,' and processing happens in the background.
>
> Jobs have **priorities**. Thumbnails are priority 1 because they're fast and users see them immediately in the file grid. PDF splitting is priority 2. OCR is priority 3 since it's slower but less time-sensitive.
>
> For **resilience**, jobs retry 3 times with exponential backoff. If OpenAI's API is temporarily down, we'll retry in 10 seconds, then 30, then 90. Failed jobs are retained for 24 hours so I can debug issues.
>
> The client can poll for **real-time progress**. For a large PDF, users see '30% complete... 60%... done!' rather than an indefinite spinner. This is a small UX detail that makes the system feel responsive even when operations take time.
>
> The worker process runs separately from the API. In production, these could be different containers or even different machines, scaling independently based on queue depth."

---

## Slide 6: Search Architecture (1.5 minutes)

**Visual:**
- Example: User uploads image → AI describes "squirrel eating acorn" → Stored in database
- Search query flow: User searches "acorn" → Matches ocrSummary → Returns image
- SQL query snippet showing ILIKE across three fields

**Script:**
> "One of the more interesting features is content-based search. Let me show you how it works.
>
> When someone uploads an image, it goes through OpenAI's Vision API, which generates a description. For example, an image might get described as 'A photograph of a squirrel eating an acorn on a wooden fence.' That description is stored in a field called `ocrSummary`.
>
> For PDFs and scanned documents, we extract the actual text using Tesseract.js and store it in `ocrText`.
>
> When a user searches, we query across three fields: the filename, the OCR text, and the AI summary. So if they search for 'acorn,' that image appears in results—even though 'acorn' isn't in the filename.
>
> Currently this uses PostgreSQL's ILIKE for pattern matching. It's simple and works well for moderate data sizes. For production scale—say, millions of documents—I'd migrate to PostgreSQL's full-text search with tsvector indexing, or potentially Elasticsearch for more advanced relevance ranking.
>
> The key insight is that we're transforming unstructured files into searchable, structured data at upload time, not at query time."

---

## Slide 7: Tech Stack Summary (1 minute)

**Visual:** Table with Layer, Technology, and Why columns

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Next.js 14 | Server components, App Router, React 19 |
| Backend | NestJS | Dependency injection, TypeScript-first, modular |
| Database | PostgreSQL + Drizzle | Type-safe ORM, no runtime surprises |
| Storage | Cloudflare R2 | S3-compatible, zero egress fees |
| Queue | Redis + BullMQ | Mature, progress tracking, priorities |
| Auth | NextAuth.js v5 | OAuth simplified, database sessions |

**Script:**
> "Here's a quick summary of the tech stack and why I chose each piece.
>
> **Next.js 14** with the App Router gives me server components for better performance and simpler data fetching. The frontend and API proxy share the same deployment, simplifying auth.
>
> **NestJS** for the backend because it's TypeScript-first with excellent dependency injection. Coming from the Angular world, the module structure felt natural and keeps code organized as it grows.
>
> **Drizzle ORM** over Prisma was a deliberate choice. Drizzle generates TypeScript types directly from the schema, so if I query a file, I get autocomplete for `ocrText`, `createdAt`, everything. No runtime type mismatches.
>
> **Cloudflare R2** is S3-compatible but with zero egress fees. For a file storage app where users download frequently, that's significant cost savings.
>
> **BullMQ** is battle-tested for job queues. It supports priorities, progress tracking, retries—everything I needed without building custom infrastructure.
>
> The theme here is choosing mature, well-documented tools that solve specific problems well."

---

## Slide 8: Trade-offs & Assumptions (2 minutes)

**Visual:** Table with Decision, Trade-off, and Assumption columns

| Decision | Trade-off | Assumption |
|----------|-----------|------------|
| Presigned URLs | More client complexity | Users have decent upload speeds |
| BullMQ over SQS | Self-managed Redis | Single-region deployment initially |
| Drizzle over Prisma | Smaller ecosystem | Type safety > migration tooling |
| Soft deletes | Storage cost | Users want trash recovery |
| ILIKE search | Not infinitely scalable | <100K files per user initially |

**Script:**
> "Every architecture involves trade-offs, so let me be explicit about the ones I made.
>
> **Presigned URLs** add complexity to the client—we need to handle the two-step upload flow, manage retries if R2 is slow, show accurate progress. The assumption is users have reasonable internet connections. For a mobile-first app in emerging markets, I might reconsider.
>
> **BullMQ with Redis** means I'm managing Redis myself rather than using a managed service like AWS SQS. The trade-off is operational overhead, but the benefit is richer features like progress tracking and job priorities. My assumption is single-region deployment initially; if I needed multi-region, SQS might make more sense.
>
> **Drizzle over Prisma**—Prisma has a larger ecosystem and better migration tooling, but Drizzle's type inference is superior. Since I value catching errors at compile time, I accepted the smaller ecosystem.
>
> **Soft deletes** mean deleted files still consume storage until permanently removed. Users explicitly wanted trash recovery, so I accepted the storage cost.
>
> **ILIKE search** is simple but scans the table. It's fine for thousands of files per user, but won't scale to millions. That's an acceptable starting point with a clear migration path to full-text search."

---

## Slide 9: Production Hardening (1.5 minutes)

**Visual:** List with icons for each improvement area

**What I'd Add for Production:**
- PostgreSQL full-text search (tsvector) or Elasticsearch
- CDN layer for file downloads
- Rate limiting on API endpoints
- File virus scanning before processing
- Separate worker deployment
- Observability: Sentry, Datadog, structured logging

**Script:**
> "If this were going to production with real users, here's what I'd add.
>
> **Search scaling**: Replace ILIKE with PostgreSQL's tsvector full-text search. It's indexed, supports relevance ranking, and handles stemming. For even larger scale, Elasticsearch would be the next step.
>
> **CDN**: Cloudflare R2 integrates with Cloudflare's CDN. For frequently accessed files, we'd cache at edge locations, reducing latency globally.
>
> **Rate limiting**: Protect the API from abuse. Probably 100 requests per minute per user for most endpoints, lower limits for expensive operations like OCR.
>
> **Virus scanning**: Before processing any uploaded file, run it through ClamAV or a cloud service. This protects both our infrastructure and other users.
>
> **Worker separation**: Right now the worker runs in the same process for simplicity. In production, it would be a separate deployment that scales based on queue depth.
>
> **Observability**: Sentry for error tracking, Datadog or similar for metrics, and structured JSON logging so we can query logs effectively. You can't fix what you can't see."

---

## Slide 10: Questions & Deep Dive (remaining time)

**Visual:** Simple slide with topic areas:
- Database schema design
- Authentication flow details
- Error handling strategies
- Scaling considerations
- Specific component deep-dives

**Script:**
> "That's the high-level overview. I've tried to focus on the architectural decisions and trade-offs rather than implementation details.
>
> I'm happy to dive deeper into any area—whether that's the database schema design, how authentication flows through the system, error handling strategies, or scaling considerations.
>
> I also have the codebase available if you'd like to see how any of these concepts translate to implementation.
>
> What questions do you have?"

---

## Backup Topics (if asked)

### Database Schema
> "The core tables are `user`, `file`, and `folder`. Files have a `folderId` foreign key for hierarchy, plus `ocrText` and `ocrSummary` for searchable content. I use soft deletes with an `isDeleted` boolean—the trash view just filters on that flag. Key indexes are on `userId`, `folderId`, `isDeleted`, and `isStarred` since those are the most common query patterns."

### Authentication Flow
> "NextAuth.js handles OAuth with Google and GitHub. On successful auth, it creates a session in PostgreSQL and sets an HTTP-only cookie. The Next.js frontend reads session data via server components. For API calls, the session token is forwarded in cookies, and NestJS validates it against the database. No JWTs flying around—everything is server-side validated."

### Error Handling
> "The API returns consistent error shapes with HTTP status codes and descriptive messages. For async jobs, failures are captured in the job metadata with retry counts. The frontend shows appropriate error states and allows retry for transient failures. I use NestJS exception filters to centralize error formatting."

### Scaling Path
> "Horizontal scaling for the API is straightforward—it's stateless. Redis is the only shared state, and that can be a managed service like Upstash or ElastiCache. For the worker, I'd use Kubernetes HPA based on queue depth. The database would be the eventual bottleneck—read replicas first, then potentially sharding by user ID."

---

## Timing Guide

| Slide | Duration | Cumulative |
|-------|----------|------------|
| 1. Title | 0:30 | 0:30 |
| 2. Problem | 1:00 | 1:30 |
| 3. Architecture | 3:30 | 5:00 |
| 4. Presigned URLs | 2:00 | 7:00 |
| 5. Async Pipeline | 2:00 | 9:00 |
| 6. Search | 1:30 | 10:30 |
| 7. Tech Stack | 1:00 | 11:30 |
| 8. Trade-offs | 2:00 | 13:30 |
| 9. Production | 1:30 | 15:00 |
| 10. Questions | — | — |

---

## Tips for Delivery

1. **Practice the architecture slide** the most—it's where you demonstrate systems thinking
2. **Use your hands** to trace data flow on the diagram
3. **Pause after trade-offs**—interviewers often jump in with follow-ups there
4. **If asked something you didn't implement**, say "I considered X but chose Y because..." or "That's a great point—here's how I'd approach it"
5. **Keep code mentions brief**—"I used Drizzle's type inference" not "let me show you the schema file"
