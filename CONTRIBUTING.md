# Contributing to Gigabee

Thank you for your interest in contributing. Pull requests are welcome — for significant changes, please open an issue first to discuss what you'd like to change.

## Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL 16+
- A `.env` file based on `.env.example`

## Setup

```bash
git clone https://github.com/mr-gigabee/gigabee.git
cd gigabee
pnpm install
cp .env.example .env   # fill in your values
pnpm --filter @workspace/db run push
```

## Running locally

```bash
# Terminal 1 — API server (port 8080, served at /api)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 25992, served at /)
pnpm --filter @workspace/gigabee run dev
```

## Project structure

| Path | Description |
|---|---|
| `artifacts/gigabee/` | React + Vite frontend |
| `artifacts/api-server/` | Express 5 API + Socket.io |
| `lib/db/` | Drizzle schema + migrations |
| `lib/api-spec/openapi.yaml` | OpenAPI spec (source of truth) |
| `lib/api-client-react/` | Generated React Query hooks |
| `lib/api-zod/` | Generated Zod schemas |
| `packages/gigabee-sdk/` | Public JavaScript/TypeScript SDK |
| `packages/gigabee-cli/` | CLI (`npx gigabee`) |

## Workflow

### Making API changes

1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Implement the route in `artifacts/api-server/src/routes/`
4. Use the generated hook in the frontend

### Making database changes

1. Edit `lib/db/src/schema/`
2. Run `pnpm run typecheck:libs` to rebuild lib declarations
3. Run `pnpm --filter @workspace/db run push` to apply to the local DB

## Before submitting

```bash
pnpm run typecheck   # must pass with zero errors
```

## Code style

- TypeScript strict mode everywhere
- Never use `console.log` in server code — use `req.log` in route handlers and the `logger` singleton elsewhere
- No manual `fetch` calls in the frontend — use the generated React Query hooks

## Questions

Open an issue or reach out on [X / Twitter](https://x.com/Gigabee_).
