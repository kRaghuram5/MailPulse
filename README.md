# MailPulse — Email Job Scheduler

MailPulse is a distributed, production-grade email scheduling system featuring real Google OAuth login, BullMQ-backed delayed job processing, atomic idempotency, distributed rate limiting, and an intuitive dashboard.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Vite)               │
│  Google Login → Dashboard → Compose Modal → Tables     │
└───────────────────────────┬────────────────────────────┘
                            │ REST API / Session Cookie
┌───────────────────────────▼────────────────────────────┐
│             Backend API Server (Express + TS)          │
│  - Real Google OAuth 2.0 (Passport session in Redis)   │
│  - POST /api/emails/schedule:                          │
│      1. Parse & validate recipients                    │
│      2. Upsert EmailJob in PostgreSQL (idempotencyKey) │
│      3. Enqueue BullMQ delayed job in Redis            │
└───────────────────────────┬────────────────────────────┘
                            │ BullMQ Job Queue (Redis)
┌───────────────────────────▼────────────────────────────┐
│               Email Worker Process (BullMQ)            │
│  - Atomic DB claim (status: PROCESSING)                │
│  - Distributed rate limit check (Redis INCR window)    │
│  - If rate limit exceeded: reschedule to next hour     │
│  - Pre-send transition: SENDING (anti-zombie guard)    │
│  - Transmit email via Nodemailer (Ethereal SMTP)       │
│  - Update status: SENT or FAILED                       │
└────────────────────────────────────────────────────────┘
```

### How Scheduling Works
1. **Bulk Ingestion**: When the user submits a batch of leads in the Compose Modal, the backend calculates the exact timestamp for each email based on `startTime` and sequential `delayBetweenEmailsMs`:
   $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayBetweenEmailsMs})$$
2. **Zero Cron Dependency**: Instead of polling periodically with cron jobs, every email is scheduled as an individual delayed job using BullMQ's native timer system (`delay = scheduledAt - now`). BullMQ uses Redis sorted sets (`ZSET`) to wake up workers precisely when the delay expires.
3. **Deterministic Job IDs**: The BullMQ job ID matches the database `EmailJob.id`, preventing duplicate queue entries.

### How Persistence on Restart is Handled
1. **PostgreSQL Ground Truth**: Every email job is persisted in PostgreSQL with status `SCHEDULED` *before* the job is added to BullMQ.
2. **Redis Durability**: Redis sorted sets preserve all delayed jobs across worker or server restarts.
3. **Worker Crash Recovery & Stalled Job Handling**: BullMQ worker detects stalled or abruptly disconnected jobs and retries them according to configured backoff settings.
4. **Atomic Claim & Anti-Zombie Guard**:
   - The worker executes an atomic database update:
     ```sql
     UPDATE "EmailJob" SET status = 'PROCESSING'
     WHERE id = :id AND status IN ('SCHEDULED', 'PROCESSING')
     ```
   - Right before SMTP dispatch, the worker transitions the status to `SENDING`. If two workers ever overlap on the same job, only one can acquire the state transition, preventing duplicate emails.

### How Rate Limiting & Concurrency are Implemented
1. **Worker Concurrency**: The worker runs with configurable concurrency (`WORKER_CONCURRENCY`, default `5`), processing multiple jobs in parallel while respecting per-sender constraints.
2. **Minimum Delay Throttling**: Configured via BullMQ limiter (`MIN_DELAY_BETWEEN_EMAILS_MS`, default `2000ms`), ensuring a physical delay between consecutive outbound dispatches.
3. **Distributed Hourly Rate Limiter**:
   - Implemented using atomic Redis keys keyed by sender and hourly window: `ratelimit:<senderId>:<YYYY-MM-DD-HH>`.
   - On each job execution, the worker runs `INCR`. If the count exceeds `MAX_EMAILS_PER_HOUR_PER_SENDER` (or the custom `hourlyLimit` on the campaign):
     - The job is **not dropped**; instead, it is rescheduled to the top of the next hour window (`delay = millisUntilNextHour`).
     - Status is marked as `RATE_LIMITED` and a Slack notification is triggered (if Slack is connected).

---

## 2. Ethereal Email Setup & Environment Variables

### Setting Up Ethereal Email
MailPulse uses Ethereal Email (a fake SMTP service by Nodemailer) for testing:
- **Automatic Setup (Zero Config)**: If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` are left blank in `.env`, the backend automatically generates a disposable Ethereal test account on startup and logs the login credentials and preview URLs to the console.
- **Manual Setup (Optional)**:
  1. Visit [https://ethereal.email/create](https://ethereal.email/create) to generate credentials.
  2. Paste `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASSWORD` into your backend `.env`.
  3. Sent emails generate an Ethereal preview link visible in the worker logs.

### Backend Environment Variables (`apps/backend/.env`)

```env
NODE_ENV=development
PORT=5000

# PostgreSQL
DATABASE_URL=postgresql://outbox:outbox_secret@localhost:5433/outbox_db
POSTGRES_USER=outbox
POSTGRES_PASSWORD=outbox_secret
POSTGRES_DB=outbox_db
POSTGRES_PORT=5433

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch (Optional: falls back to PostgreSQL search if unavailable)
ELASTICSEARCH_URL=http://localhost:9200

# Real Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Slack OAuth (Optional)
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/auth/slack/callback

# Session
SESSION_SECRET=a_long_random_session_secret_32_characters_min

# Ethereal Email / SMTP (Leave blank to auto-create test account)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@outboxlabs.dev

# Worker Concurrency & Rate Limiting
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=5

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Bull Board Dashboard (/admin/queues)
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=admin_secret
```

---

## 3. How to Run Backend

### Prerequisites
- Node.js (v18 or higher)
- Docker & Docker Compose (for PostgreSQL, Redis, Elasticsearch)

### Step 1: Start Infrastructure (PostgreSQL & Redis)
From the project root:
```bash
docker compose up -d postgres redis
```

### Step 2: Install Dependencies & Run Database Migrations
```bash
cd apps/backend
npm install
npx prisma db push
```

### Step 3: Start the Backend Server (Express + BullMQ Worker)
In development mode (runs Express API and BullMQ worker concurrently with hot reload):
```bash
npm run dev
```

Alternatively, to run the API and worker separately in production:
```bash
# Terminal 1: Express API Server
npm run start

# Terminal 2: BullMQ Email Worker
npm run worker:dev
```
- API Server runs at: `http://localhost:5000`
- Bull Board Queue UI: `http://localhost:5000/admin/queues` (Login: `admin` / `admin_secret`)

---

## 4. How to Run Frontend

### Step 1: Install Dependencies
```bash
cd apps/frontend
npm install
```

### Step 2: Start Vite Development Server
```bash
npm run dev
```
- Frontend application runs at: `http://localhost:5173`
- Vite proxies `/api` calls directly to `http://localhost:5000`.

---

## 5. List of Features Implemented

### Backend Features
- **Scheduler**:
  - Non-cron precision scheduler utilizing BullMQ delayed jobs backed by Redis sorted sets.
  - Bulk lead scheduling with sequential staggering (`delayBetweenEmailsMs`) starting from specified `startTime`.
  - Auto-creation of default Sender identity for authenticated Google users.
- **Persistence Across Restarts**:
  - PostgreSQL durable storage via Prisma ORM for all `EmailJob` records.
  - Deterministic idempotency key (`senderId:recipient:subject:scheduledAt`) preventing duplicate jobs on network retry or service restart.
  - Redis sorted set retention ensuring queued delayed jobs survive full process reboots.
- **Rate Limiting & Concurrency**:
  - Multi-worker concurrent processing controlled via `WORKER_CONCURRENCY`.
  - Minimum send delay enforced by BullMQ limiter (`MIN_DELAY_BETWEEN_EMAILS_MS`).
  - Distributed hourly rate limiter per sender (`INCR` with sliding 1-hour Redis TTL).
  - Automatic rescheduling to the next hour when a sender's rate limit is reached.
  - Real-time Slack notifications dispatched upon rate limit triggering (with duplicate alert suppression).
- **Monitoring & Search**:
  - Real-time Bull Board queue dashboard at `/admin/queues`.
  - Full-text search with Elasticsearch and resilient PostgreSQL fallback.

### Frontend Features
- **Real Google OAuth Login**:
  - Real Google OAuth 2.0 authentication flow (no mocks).
  - Error toast handling for authentication cancellations or misconfigurations.
  - Automatic redirect to `/dashboard` upon successful login.
- **Top Header**:
  - Displays authenticated user's **Name**, **Email**, and **Avatar** (or styled initials fallback).
  - Clearly accessible **Logout** action that destroys the backend session and clears client query cache.
  - Quick-access status badges for Slack workspace integration and Bull Board queue monitoring.
- **Main Dashboard**:
  - Hero action bar with primary **“Compose New Email”** button.
  - Live metric cards (Scheduled, Delivered/Sent, Active Senders, Total Processed).
  - Tab navigation between **Scheduled Emails** and **Sent Emails** with real-time counter badges.
  - Integrated search bar to filter leads, subjects, or body content with debounce and clear button.
- **Compose New Email (Modal)**:
  - Form inputs for **Subject** and **Body**.
  - **CSV / TXT Lead File Upload** with drag/file selector + direct lead pasting.
  - Live parsing engine showing the exact **number of email addresses detected** (e.g. `✓ 15 email addresses detected`) and warnings for invalid rows.
  - Configurable **Start time** (datetime-local picker), **Delay between emails** (ms), and **Hourly limit**.
  - Sender identity selector with inline "+ Add New Sender" profile creation.
  - Submits payload to `POST /api/emails/schedule` with loading spinner and toast notifications.
- **Scheduled Emails Table**:
  - Displays **Email** (recipient), **Subject**, **Scheduled time**, and **Status** (`SCHEDULED`, `PROCESSING`, `RATE_LIMITED`).
  - Loading skeleton state while fetching.
  - Dedicated empty state with direct "Compose New Email" call-to-action when queue is clear.
  - Page-by-page pagination controls.
- **Sent Emails Table**:
  - Displays **Email** (recipient), **Subject**, **Sent time**, and **Status** (`sent` in green / `failed` in rose).
  - Full search integration with Elasticsearch / DB fallback indicator.
  - Loading state and dedicated empty state.
- **Frontend Code Quality & UX**:
  - Strict TypeScript definitions across all models, API responses, and component props (`src/types/index.ts`).
  - Modular, reusable UI component library: `Button`, `Input`, `Modal`, `Table`, `StatusBadge`, `EmptyState`, `Spinner`.
  - Toast feedback via `react-hot-toast` for all mutation events, errors, and background updates.
