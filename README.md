# Outbox Labs — Email Job Scheduler

A production-quality Full-Stack Email Scheduling System inspired by ReachInbox. Built as part of the Outbox Labs SDE Intern assessment.

---

## ✅ Feature Checklist

| Feature | Status |
|---|---|
| TypeScript (backend + frontend) | ✅ |
| Express.js backend | ✅ |
| PostgreSQL + Prisma ORM | ✅ |
| Redis (distributed) | ✅ |
| BullMQ delayed jobs | ✅ |
| No cron (zero cron usage) | ✅ |
| Ethereal Email / SMTP | ✅ |
| Multiple senders | ✅ |
| Persistence across restarts | ✅ |
| Restart safety (BullMQ retains delayed jobs) | ✅ |
| Idempotency (Atomic Db claim + SENDING transition) | ✅ |
| Worker concurrency (configurable) | ✅ |
| Minimum delay between sends (BullMQ limiter) | ✅ |
| Hourly rate limiting per sender | ✅ |
| Distributed rate limiting (Redis INCR) | ✅ |
| Rate-limit rescheduling to next hour | ✅ |
| Slack OAuth (connect/disconnect) | ✅ |
| Real Slack notification on rate limit | ✅ |
| Slack duplicate notification prevention | ✅ |
| Elasticsearch indexing | ✅ |
| Elasticsearch search (with DB fallback) | ✅ |
| Bull Board queue monitoring | ✅ |
| Google OAuth 2.0 | ✅ |
| Logout | ✅ |
| Dashboard | ✅ |
| Compose modal | ✅ |
| CSV / text upload | ✅ |
| Scheduled emails table | ✅ |
| Sent emails table | ✅ |
| Loading states | ✅ |
| Empty states | ✅ |
| Error handling | ✅ |
| Docker Compose | ✅ |
| README | ✅ |
| Unit Tests (21 passing) | ✅ |

---

## Overview

Outbox Labs Email Scheduler is a distributed email job scheduling system that:

- Accepts bulk email scheduling requests
- Stores jobs in PostgreSQL (the persistent ground truth)
- Enqueues them as BullMQ delayed jobs in Redis
- Sends via Ethereal Email (SMTP)
- Enforces per-sender hourly rate limits (Redis-backed, distributed)
- Notifies via Slack when rate limits are hit
- Indexes emails in Elasticsearch for full-text search
- Recovers from worker crashes and handles stalled jobs robustly

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                          │
│  Login → Dashboard → Compose → Scheduled/Sent Tables + Search       │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ HTTP REST API
┌─────────────────────▼───────────────────────────────────────────────┐
│                  Backend (Express + TypeScript)                      │
│                                                                      │
│  POST /api/emails/schedule                                           │
│    1. Validate input (Zod)                                           │
│    2. Deduplicate recipients                                         │
│    3. Sequentially upsert EmailJob records (PostgreSQL)              │
│    4. Enqueue BullMQ delayed jobs (Redis)                            │
│    5. Index in Elasticsearch                                         │
│                                                                      │
│  Google OAuth ──► Session (Redis-backed)                            │
│  Slack OAuth  ──► SlackConnection (PostgreSQL)                      │
│  Bull Board   ──► /admin/queues (HTTP Basic Auth)                   │
└──────────┬──────────────────────────────────────────────────────────┘
           │ BullMQ
┌──────────▼──────────────────────────────────────────────────────────┐
│                    Email Worker (BullMQ)                             │
│                                                                      │
│  For each job:                                                       │
│    1. Atomic claim: UPDATE WHERE status IN [SCHEDULED, PROCESSING]   │
│       → set status=PROCESSING                                        │
│    2. Check hourly rate limit (Redis INCR)                           │
│       - Limit hit → reschedule to next hour + Slack notify           │
│    3. Pre-send lock: UPDATE WHERE status=PROCESSING                  │
│       → set status=SENDING (Prevents duplicate sends from zombies)   │
│    4. Send via Nodemailer/Ethereal SMTP                              │
│    5. Update DB status (SENT/FAILED)                                 │
│    6. Index in Elasticsearch                                         │
└──────────────────────────────────────────────────────────────────────┘

Infrastructure:
  PostgreSQL ─── durable storage, all email records
  Redis ─────── BullMQ queues, sessions, rate limiting
  Elasticsearch ─ full-text search (graceful degradation if down)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, TypeScript, Express.js |
| ORM | Prisma + PostgreSQL |
| Queue | BullMQ + Redis |
| Email | Nodemailer (Ethereal SMTP) |
| Search | Elasticsearch 8 |
| Auth | Passport.js, Google OAuth 2.0, Slack OAuth |
| Queue UI | Bull Board |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Testing | Jest + ts-jest |
| Infrastructure | Docker Compose |

---

## Folder Structure

```
outbox-email-scheduler/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── __tests__/         # Unit tests
│   │   │   ├── auth/              # Passport.js setup
│   │   │   ├── config/            # DB, Redis, ES, Logger
│   │   │   ├── integrations/      # Slack API
│   │   │   ├── middleware/        # Auth, error handling
│   │   │   ├── queues/            # BullMQ queue definition
│   │   │   ├── routes/            # Express routes
│   │   │   ├── services/          # Email, scheduling, search
│   │   │   ├── types/             # TypeScript declarations
│   │   │   ├── workers/           # BullMQ email worker
│   │   │   ├── app.ts             # Express app factory
│   │   │   └── server.ts          # Server entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma      # Database schema
│   │   ├── .env.example
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── components/        # UI components
│       │   ├── hooks/             # React hooks
│       │   ├── pages/             # Route pages
│       │   └── services/          # API client
│       └── package.json
└── docker-compose.yml
```

---

## Prerequisites

- Node.js 18+
- Docker Compose (for PostgreSQL, Redis, Elasticsearch)
- Google Cloud Console project (for OAuth)
- Slack app (for Slack OAuth)

---

## Environment Setup

Copy the example file and fill in credentials:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` — from Slack API dashboard
- `SESSION_SECRET` — random 32+ char string

Optional (auto-configured if blank):
- `SMTP_*` — leave blank to auto-create an Ethereal test account

---

## Docker Setup

```bash
# Start all infrastructure
docker compose up -d

# Services:
# PostgreSQL → localhost:5433
# Redis      → localhost:6379
# Elasticsearch → localhost:9200
```

> **Note:** PostgreSQL runs on port `5433` (not 5432) to avoid conflicts with any locally installed PostgreSQL instance.

---

## Database Setup

```bash
cd apps/backend

# Generate Prisma client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate:dev

# (Optional) View data in Prisma Studio
npm run prisma:studio
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Go to **Credentials** → **Create OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Secret to `.env`

---

## Slack OAuth Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app → **From scratch**
3. Under **OAuth & Permissions**, add redirect URL: `http://localhost:5000/api/auth/slack/callback`
4. Add Bot Token Scopes: `chat:write`, `chat:write.public`
5. Install to workspace
6. Copy Client ID and Secret to `.env`

---

## Backend Setup

```bash
cd apps/backend
npm install
npm run dev          # Start backend (port 5000)
```

## Worker Setup

In a separate terminal:

```bash
cd apps/backend
npm run dev:worker   # Start email worker
```

## Frontend Setup

```bash
cd apps/frontend
npm install
npm run dev          # Start frontend (port 5173)
```

---

## API Documentation

### Auth
```
GET  /api/auth/google              → Initiate Google OAuth
GET  /api/auth/google/callback     → Google OAuth callback
GET  /api/auth/me                  → Get current user
POST /api/auth/logout              → Logout
GET  /api/auth/slack               → Initiate Slack OAuth
GET  /api/auth/slack/callback      → Slack OAuth callback
POST /api/auth/slack/disconnect    → Disconnect Slack
```

### Emails
```
POST /api/emails/schedule          → Schedule emails
GET  /api/emails/scheduled         → List scheduled/pending
GET  /api/emails/sent              → List sent/failed
GET  /api/emails/search?q=<query>  → Full-text search
```

### Senders
```
GET  /api/senders                  → List senders
POST /api/senders                  → Create sender
```

### Admin
```
GET  /admin/queues                 → Bull Board (HTTP Basic Auth)
GET  /api/health                   → Health check
```

### Schedule Request Example
```json
{
  "senderId": "clxyz...",
  "subject": "Hello World",
  "body": "<p>Hello!</p>",
  "recipients": ["alice@example.com", "bob@example.com"],
  "startTime": "2026-09-27T10:00:00Z",
  "delayBetweenEmailsMs": 2000,
  "hourlyLimit": 200
}
```

---

## BullMQ Architecture

### Why BullMQ (not cron)?
- Jobs are **persistent in Redis** — survive server restarts
- **Delayed jobs** are native: `scheduledAt - Date.now()` = delay
- **Retry support**: Failed jobs retry with exponential backoff
- **Concurrency**: Multiple workers process jobs in parallel
- **Deduplication**: Same DB job ID = same BullMQ job ID

### Job Lifecycle
```
Schedule API call
     │
     ▼
PostgreSQL: upsert EmailJob (status=SCHEDULED)
     │
     ▼
BullMQ: ADD delayed job (jobId = emailJob.id)
     │
     ▼ (after delay expires)
Worker picks up job
     │
     ▼
DB: UPDATE status IN [SCHEDULED, PROCESSING] → PROCESSING (atomic claim/recovery)
     │
     ▼
Redis: INCR rate limit counter for sender+hour
     │
     ├─ Limit exceeded → reschedule to next hour + Slack notify
     │
     └─ OK → atomic pre-send lock: UPDATE status=PROCESSING → SENDING
           │
           ▼
      Send via SMTP
           │
           ▼
      DB: UPDATE status → SENT (or FAILED)
      ES: Index document
```

---

## Persistence & Restart Safety

BullMQ jobs are backed by Redis, but **PostgreSQL is the ultimate source of truth.** The Redis queue coordinates timing and worker distribution, but the state transitions are securely gated by database records. 

If the backend stops and restarts, BullMQ reads the jobs from Redis without losing delayed triggers. The database guarantees exactly what state every job is currently in.

---

## Idempotency and State Recovery

### Problem
BullMQ may retry a stalled job if a worker crashes. Multiple workers may race to claim the same job. A server may restart mid-send. 

### Solution
The system utilizes a 4-state state machine: `SCHEDULED → PROCESSING → SENDING → SENT/FAILED`. 

1. **Atomic Claiming and Stalled Job Recovery:**
```sql
UPDATE email_jobs
SET status = 'PROCESSING', attempts = attempts + 1
WHERE id = $emailJobId AND status IN ('SCHEDULED', 'PROCESSING')
```
If a worker crashes while a job is in `PROCESSING`, BullMQ will eventually retry it. The query allows healthy workers to safely reclaim `PROCESSING` jobs.

2. **Atomic Pre-Send Lock (Duplicate Prevention):**
```sql
UPDATE email_jobs
SET status = 'SENDING'
WHERE id = $emailJobId AND status = 'PROCESSING'
```
Immediately before invoking the external SMTP server, the worker transitions the job to `SENDING`. If a "zombie" worker wakes up and tries to send the email concurrently, this atomic update will return `0` affected rows, causing the zombie to abort and thus preventing a duplicate send.

### The SMTP Uncertainty Window
While the pre-send lock prevents workers from duplicating effort, **strict exactly-once delivery cannot be mathematically guaranteed by any database.** If a worker transitions a job to `SENDING`, triggers the external SMTP server, and then crashes before it can update the database to `SENT`, the job will remain perpetually in the `SENDING` state. 

These jobs are intentionally *not* automatically reclaimed by stalled-job recovery. A job stuck in `SENDING` means an SMTP command was issued, and it is unknowable to the database whether the remote server fulfilled the email delivery. Automatic retries of `SENDING` jobs would risk duplicate emails; instead, they are left for manual review.

The `idempotencyKey` (senderId:recipient:subject:scheduledAt) prevents duplicate DB insertions during API call retries.

---

## Rate Limiting

### Algorithm
```
hourWindow = floor(Date.now() / 3_600_000)   # Changes every hour
key = "email-rate-limit:{senderId}:{hourWindow}"

count = INCR key                              # Atomic Redis increment
if count == 1: EXPIRE key 3700               # Set TTL on first use

if count > maxPerHour:
    DECR key                                 # Undo — job not actually sent
    rescheduleAt = (hourWindow + 1) * 3_600_000   # Next hour boundary
    UPDATE EmailJob: status=RATE_LIMITED, scheduledAt=rescheduleAt
    BullMQ: re-enqueue with new delay
    Slack: notify (once per sender per window)
```

### Trade-offs
- Uses Redis INCR which is atomic per key.
- Multiple workers share the same Redis counter → correctly distributed.
- No off-by-one risk from timestamp rounding (floor division is deterministic).
- Slack notifications are deduped via a Redis key with TTL.

---

## Concurrency

Worker concurrency is set via `WORKER_CONCURRENCY=5` (default).

The BullMQ rate limiter ensures minimum delay between sends globally across the queue:
```
limiter: { max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }
```

**Trade-off:** The rate limiter is per-queue, not per-sender. With `WORKER_CONCURRENCY=5` and `MIN_DELAY=2000ms`, the effective throughput is 1 email per 2 seconds globally. For per-sender delay control, a Redis lock per sender would be needed (documented as a future improvement).

---

## 1000 Email Scenario

With:
- 1000 emails, same start time
- `hourlyLimit=200`, `delayBetweenEmailsMs=2000`
- `WORKER_CONCURRENCY=10`

Expected behavior:
1. API receives the request and sequentially iterates through all 1000 recipients.
2. For each recipient, it performs a Postgres UPSERT, followed by a BullMQ `add`, followed by an `update`, followed by ES indexing. *(Note: This is sequential, not a bulk `createMany` operation).*
3. Worker starts processing at `startTime`.
4. After 200 sends in window[0], the INCR atomic check returns 201 → rate limited.
5. The remaining emails are rescheduled to window[1] (next hour).
6. A Slack notification is sent (once per sender per window).
7. Next hour: worker processes the next 200, and so on.

---

## Elasticsearch

### Indexing
- Every successfully sent email is indexed in `email_jobs` index.
- Every newly scheduled email is also indexed (for search before sending).

### Search
```
GET /api/emails/search?q=hello
```
Searches: `subject` (boosted 2x), `body`, `recipient`

### Graceful degradation
If Elasticsearch is down, the backend:
1. Logs a warning
2. Falls back to PostgreSQL ILIKE search
3. Returns results with `fallback: true` flag

---

## Security

- **HTTP-only cookies** — session stored in Redis-backed cookie.
- **User isolation** — all queries filter by `userId` from session.
- **Input validation** — Zod on all API endpoints.
- **No secrets in code** — all secrets via environment variables.
- **Bull Board** — protected with HTTP Basic Auth.
- **OAuth State Protection** — Slack OAuth implements state tokens to protect against CSRF attacks during the OAuth callback flow.

---

## Testing

Run unit and integration tests:
```bash
cd apps/backend
npm test
```

**21 tests covering:**
- Schema validation (valid/invalid inputs)
- Email stagger scheduling math
- Deduplication logic
- Idempotency key generation
- Rate limit window calculation
- BullMQ delay calculation
- Worker crash state-machine recovery and idempotency guarantees

---

## Trade-offs & Limitations

1. **Slack OAuth state**: State tokens are stored in-memory (Map). In a multi-instance deployment, this would cause OAuth failures if the callback hits a different instance. A Redis-backed state store is required for horizontal scaling.
2. **Rate limiter granularity**: BullMQ's built-in `limiter` is per-queue, not per-sender. True per-sender throttling would require Redis-backed locks per sender.
3. **Elasticsearch availability**: ES is optional — service degrades to DB search if ES is down.
4. **Ethereal Email**: Preview URLs are logged to console. In production, use a real SMTP provider.
5. **Sequential Enqueuing**: The 1000 email scenario inserts jobs sequentially rather than utilizing Prisma's `createMany` and BullMQ's `addBulk`. This safely handles partial enqueuing failures at the cost of scheduling speed.

---

## Assessment Demo

To evaluate the system, follow this 5-minute flow:

1. **Start Services:** Start docker-compose, `npm run dev`, and `npm run dev:worker`.
2. **Login:** Authenticate via Google OAuth on the frontend (`http://localhost:5173`).
3. **Schedule:** Use the Compose Modal to schedule an email to 5+ recipients.
4. **Monitor Queue:** Open Bull Board (`http://localhost:5000/admin/queues` with `admin`/`admin_secret`) to watch the jobs transition.
5. **Verify Delivery:** Check the worker console logs for Ethereal SMTP preview URLs.
6. **Test Persistence:** Stop the worker, schedule an email, then restart the worker. The email will be picked up natively from Redis.
7. **Test Rate Limits:** Lower `MAX_EMAILS_PER_HOUR_PER_SENDER=2` in `.env`, restart the worker, and schedule 5 emails. Observe 2 sends and 3 reschedules to the next hour.
8. **Slack Alerts:** Connect Slack in settings, ensure your bot is invited to `#general` (or the configured channel), and trigger a rate limit to receive a live notification.

---

## Future Improvements

- Per-sender rate limiter using Redis sorted sets
- Redis-backed OAuth state for multi-instance Slack flows
- Webhook callbacks on email delivery
- Email template editor with HTML preview
- Sender reputation scoring
- Bulk insertion (`createMany` + `addBulk`) for faster large-scale scheduling
- Prometheus metrics endpoint
- k8s Helm chart
