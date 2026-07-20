# ML Model Monitor

A **ML Model Monitoring Platform** that tracks drift, latency, feature health, and alerts for machine learning models in production. Built with TypeScript, Express, React, and PostgreSQL.

## Architecture

```
├── artifacts/
│   ├── api-server/          # Express 5 API server (port 5000)
│   └── ml-monitor/          # React SPA dashboard (Vite)
├── lib/
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-spec/            # OpenAPI 3.0 specification
│   ├── api-zod/             # Zod validation schemas
│   └── db/                  # Database schema (Drizzle ORM)
└── scripts/                 # Utility & seed scripts
```

## Features

- **Model Health Dashboard** — Real-time view of all monitored models with health scores
- **Drift Detection** — PSI, KS statistic, Chi-square drift monitoring per feature
- **Latency Monitoring** — P50/P95/P99 latency tracking with SLA breach alerts
- **Feature Drift Analysis** — Per-feature null rate, schema mismatch, and drift scoring
- **Alert System** — Auto-generated alerts for drift, latency, null rate, and schema mismatches
- **AI Suggestions** — Automated recommendations for model issues
- **ML Pipeline Integration** — REST API for metric ingestion from inference containers

## Quick Start

### Prerequisites

- **Node.js 24+**
- **pnpm 11+**
- **PostgreSQL** (with `DATABASE_URL` configured)

### Setup

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Seed sample metrics
pnpm --filter @workspace/scripts run seed

# Start development servers
pnpm --filter @workspace/api-server run dev   # API → http://localhost:5000
pnpm --filter @workspace/ml-monitor run dev   # UI  → http://localhost:5173
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks & Zod schemas from OpenAPI spec |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CLERK_PUBLISHABLE_KEY` | ⚠️ | Clerk auth (UI auth) |
| `CLERK_SECRET_KEY` | ⚠️ | Clerk auth (API) |
| `OPENAI_API_KEY` | ⚠️ | AI suggestions feature |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/healthz` | Health check |
| `GET` | `/api/models` | List all model versions |
| `POST` | `/api/models` | Register a new model |
| `GET` | `/api/models/:id` | Get model details |
| `GET` | `/api/models/:id/report` | Full health report |
| `POST` | `/api/ingest/metrics` | Push inference metrics |
| `POST` | `/api/ingest/baseline` | Set baseline distribution |
| `GET` | `/api/drift/metrics` | List drift metrics |
| `GET` | `/api/drift/summary` | Drift summary |
| `GET` | `/api/latency/metrics` | List latency metrics |
| `GET` | `/api/latency/current` | Current latency percentiles |
| `GET` | `/api/alerts` | List alerts |
| `PATCH` | `/api/alerts/:id/resolve` | Resolve an alert |
| `GET` | `/api/features` | List feature stats |
| `GET` | `/api/summary/dashboard` | Dashboard summary |

## Technical Stack

- **Runtime**: Node.js 24, TypeScript 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v4), drizzle-zod
- **Frontend**: React 19, Vite, TanStack Query, Tailwind CSS 4
- **API Codegen**: Orval (from OpenAPI 3.0)
- **Build**: esbuild (CJS bundles)

## License

MIT

