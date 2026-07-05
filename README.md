# Gigabee

**Decentralized AI inference network.** Chat with AI models running on a global network of contributor GPUs. GPU owners earn Honey (USDC) for serving inference jobs.

> AI powered by the hive, not the data center.

---

## Overview

Gigabee routes your prompts to the **Hive** — a permissionless network of GPU contributors running open-source models via Ollama. Tokens stream back in real time. Your prompt lives in memory on exactly two machines (yours and the worker's) and is never written to disk anywhere.

**Three ways to participate:**
- **Chat** — pay per message with credits (1 credit = $0.01)
- **Earn** — run a GPU worker, earn 75% of every job's value in USDC
- **Grow** — refer friends, earn 5% of their spend for 12 months

---

## Stack

| Layer | Tech |
|---|---|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript 5.9 |
| Frontend | React + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, Wouter |
| API | Express 5, Socket.io (token streaming) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod (zod/v4), drizzle-zod |
| API contract | OpenAPI 3.1 → Orval codegen → typed React Query hooks |
| Build | esbuild (CJS/ESM bundle) |
| Auth | Bearer token — sessions stored in DB, no cookies |
| Payments | USDC on Solana mainnet (Phantom / Solflare) |

---

## Repository structure

```
gigabee/
├── artifacts/
│   ├── gigabee/          # React + Vite frontend (/)
│   ├── api-server/       # Express 5 API + Socket.io (/api)
│   └── gigabee-worker/   # Native GPU worker CLI (Node.js + Ollama)
├── lib/
│   ├── db/               # Drizzle schema + migrations
│   ├── api-spec/         # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/ # Generated React Query hooks + Zod schemas
│   ├── api-zod/          # Generated Zod request/response schemas
│   └── integrations/     # Shared integration helpers
├── packages/
│   ├── gigabee-sdk/      # JS/TS SDK for the Gigabee API
│   └── gigabee-cli/      # CLI tool for worker management
├── worker/               # Standalone worker release (gigabee-worker.mjs)
├── scripts/              # Utility scripts (@workspace/scripts)
├── pnpm-workspace.yaml   # Workspace catalog, overrides
├── tsconfig.base.json    # Shared strict TS defaults
└── tsconfig.json         # Root TS solution config (libs only)
```

---

## Getting started

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL 16+

### Install

```bash
git clone https://github.com/mr-gigabee/gigabee.git
cd gigabee
pnpm install
```

### Environment variables

Create a `.env` file (or export these in your shell):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/gigabee
SESSION_SECRET=your-random-secret-min-32-chars
```

### Database setup

```bash
pnpm --filter @workspace/db run push
```

### Run in development

```bash
# Terminal 1 — API server (port 8080, served at /api)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 25992, served at /)
pnpm --filter @workspace/gigabee run dev
```

Open `http://localhost:25992` in your browser.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm run typecheck` | Full typecheck (libs + all leaf packages) |
| `pnpm run typecheck:libs` | Rebuild lib declarations (run after lib schema changes) |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

---

## Architecture

### Contract-first API

The OpenAPI spec at `lib/api-spec/openapi.yaml` is the single source of truth. Running codegen produces:

- `lib/api-client-react/src/generated/` — typed React Query hooks
- `lib/api-zod/src/generated/` — Zod request/response schemas

Never write manual fetch calls — use the generated hooks.

### Token streaming

The frontend connects to the API server via Socket.io. Each inference job emits token chunks in real time. A REST fallback handles environments where WebSocket is unavailable.

### Worker selection

Workers register via Socket.io, declare supported models, and are weighted-randomly selected per job based on reputation score (speed + accuracy on integrity checks + history).

### No prompt storage

There is deliberately no code path that writes message content to a database. Conversations are stored in browser `localStorage` only. The API stores only job metadata (token counts, latency, cost) for billing.

### Credits & billing

1 credit = $0.01. Charged per job. Failed or timed-out jobs are refunded automatically. Workers earn 75% of job value (85% with staking, Phase 2). Earnings accrue as Honey, paid in USDC on Solana.

---

## Running a GPU worker

```bash
# 1. Install Ollama and pull a model
ollama pull llama3.3:70b   # bea-glide
ollama pull llama3.2:3b    # bea-hover

# 2. Set your session token (from the Earn page)
export GIGABEE_TOKEN=your-session-token

# 3. Optionally configure models and Ollama host
export GIGABEE_MODELS=bea-glide,bea-hover
export OLLAMA_HOST=http://localhost:11434

# 4. Run
node gigabee-worker.mjs
```

**Hardware requirements:**

| GPU | Tier | Notes |
|---|---|---|
| RTX 3060 / 4060 (12 GB) | bea-hover only | llama3.2:3b fits comfortably |
| RTX 3090 / 4090 (24 GB) | bea-hover | llama3.3:70b needs 2× or quantized |
| 2× RTX 3090 / A100 (40 GB+) | bea-glide + bea-hover | Full quality, max earnings |

Workers earn per token served. Honey accrues with a 24-hour integrity hold, then becomes withdrawable as USDC to any Solana wallet.

---

## Chat features

### Composer toolbar

| Feature | Status | Notes |
|---|---|---|
| Attach image | UI live — model forwarding coming soon | Stored in localStorage only, never on server |
| Code mode | Live | Auto-wraps input in code fences at send |
| Web search | Coming soon | Will cite real-time sources in answers |
| Generate image | Coming soon — paid, 18+ | 50 credits per image, age-gated |

### Image generation (18+)

Image generation uses open-source Stable Diffusion-based models running on worker GPUs. Generated images are never stored by Gigabee. Users must be 18 years of age or older and comply with all applicable local laws. See the [Content Policy](#content-policy) below.

---

## Content Policy

Gigabee operates an uncensored image generation tier. By using it you confirm you are 18+ and that your use complies with your jurisdiction's laws.

**Prohibited content (results in immediate permanent ban):**
- Any sexual content depicting minors
- Content illegal in your country of residence
- Content created to harass, defame, or threaten a real, identifiable person

Gigabee does not pre-screen or store generated images. Violations discovered through integrity checks, reports, or legal process result in immediate account suspension, forfeiture of pending earnings/credits, and referral to law enforcement where required by law.

---

## Roadmap

### Live now
- Bee Hover & Glide chat (Llama 3.3 70B, token streaming)
- Magic-link email login (passwordless, no OAuth required)
- Credits system — 10 free on signup, USDC top-up on Solana mainnet
- Native GPU worker (Node.js + Ollama)
- Honey earnings tracked per job (24 h integrity hold)
- Referral program — 5% of referee spend for 12 months
- Chat composer — image attachment UI, code mode

### Building next
- USDC Honey withdrawals to any Solana wallet
- Public OpenAI-compatible API with API key management
- Browser workers (WebGPU, no install)
- Vision model tier (enables image attachment forwarding)
- Web search augmentation
- Staking — 85% worker rate + revenue share
- Image generation (18+, paid — 50 credits per image)

### Never promised
Token launches, fixed yields, guaranteed APY, price predictions. If you see any of those next to our name, it's a scam — report it to [security@gigabee.io](mailto:security@gigabee.io).

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes with clear messages
4. Push and open a pull request

Please ensure `pnpm run typecheck` passes before submitting.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Contact

- Website: [gigabee.io](https://gigabee.io)
- X / Twitter: [@Gigabee_](https://x.com/Gigabee_)
- Security: [security@gigabee.io](mailto:security@gigabee.io)
