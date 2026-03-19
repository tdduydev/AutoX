---
description: "Use when working with database schema, migrations, seed data, MongoDB collections, or Drizzle ORM queries in xClaw"
applyTo: "packages/db/**"
---
# Database Instructions

## Dual-Database Split

| Database | Purpose | Driver | Files |
|----------|---------|--------|-------|
| PostgreSQL 18 | Config, RBAC, tenants, users, workflows | Drizzle ORM | `packages/db/src/schema/index.ts` |
| MongoDB 7 | AI sessions, messages, memory, agent configs | Official `mongodb` driver | `packages/db/src/mongo.ts` |

## PostgreSQL (Drizzle)

- Schema lives in `packages/db/src/schema/index.ts`
- Migrations auto-generated: `npx drizzle-kit generate` (run from `packages/db/`)
- Migrations auto-applied on server startup via `runMigrations()`
- All tables requiring tenant isolation must have `tenantId` FK with `onDelete: 'cascade'`
- Users have composite unique on `(tenantId, email)`, not global unique

## MongoDB

- Connection in `packages/db/src/mongo.ts` — typed collections, auto-indexing
- 4 collections: `sessions`, `messages`, `memory_entries`, `agent_configs`
- Messages and memory entries include `embedding?: number[]` for vector search/RAG
- Use `sessionsCollection()`, `messagesCollection()`, etc. — never access raw db directly

## Seed Data

- Seed logic in `packages/db/src/seed.ts`
- Must be **idempotent**: always check existence before inserting
- Default credentials: `admin@xclaw.io` / `password123`
- Passwords hashed with PBKDF2 (via `packages/gateway/src/auth.ts`)

## Adding New Tables

1. Add table definition to `packages/db/src/schema/index.ts`
2. Run `npx drizzle-kit generate` to create migration SQL
3. Export from `packages/db/src/index.ts`
4. Rebuild: `docker compose up --build`
