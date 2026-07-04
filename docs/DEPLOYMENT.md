# Quantum Star OS — Deployment Topology

Quantum Star OS is not one application; it is two systems (a stateless
product surface and a stateful execution core) that must not be deployed as
though they were one. The chosen topology is a **hybrid ("Path 1.5")**:
serverless for the surface, persistent processes for everything that holds
state or runs longer than a request.

## Subsystem placement

### 1. Next.js — Vercel (stateless)

- Dashboard
- Studio
- Documentation
- Authentication
- API routes that **enqueue work only** — no route may run a job inline

Rules: no long-lived processes, no schedulers, no direct LLM orchestration.
If an endpoint would exceed a request cycle, it writes a job to the queue
and returns.

### 2. Persistent Worker — Railway / Fly.io / Render (stateful)

- Company Brain (understanding → decision → orchestration)
- Job queue consumer
- Anthropic / OpenAI calls
- Prisma (owns the PostgreSQL connection pool)
- Scheduler

This is the only tier that talks to LLM providers and the only tier that
holds database connections open.

### 3. Causal Kernel — persistent, isolated process (deterministic)

- Epoch Runner
- Trace generation
- Market clearing
- Execution Certificates
- Replay verification

The kernel runs as its own process (same host class as the worker, but a
separate deployable) so that:

- replay verification can run against production artifacts without
  competing with Brain workloads;
- the kernel's no-network / no-clock discipline is enforceable at the
  process boundary, not just by convention.

## Data plane

- **PostgreSQL** — system state, job queue, epoch index.
- **Object storage** — proof artifacts: traces, certificates, state
  snapshots. Artifacts are content-addressed and immutable.

## Boundary summary

| Tier | State | Scaling | Talks to |
| --- | --- | --- | --- |
| Next.js (Vercel) | none | per-request | worker via HTTP/queue |
| Worker | DB + queue | few long-lived instances | LLMs, Postgres, kernel |
| Causal Kernel | append-only artifacts | single-writer per epoch | Postgres, object storage |

## What we explicitly rejected

- **Everything on Vercel** — the Brain and Kernel are long-lived, stateful
  processes; serverless time limits and cold starts break epochs and
  schedulers.
- **Everything on a single VM ("Path 2")** — couples the product surface's
  deploy cadence and failure modes to the execution core, and gives up
  Vercel's edge/CDN advantages for the UI, without buying any determinism
  the kernel doesn't already provide for itself.
