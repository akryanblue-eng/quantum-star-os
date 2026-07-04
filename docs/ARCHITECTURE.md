# Quantum Star OS — System Architecture

Quantum Star OS is organized into four layers with clean interfaces between
them. The central boundary is between the **Product Surface** (stateless) and
the **Execution Core** (stateful), and within the Execution Core, between the
subsystem that *reasons* and the subsystem that *proves*.

## The four layers

1. **Company Brain** — planning, intent, orchestration.
2. **Causal Kernel** — deterministic execution and replay.
3. **Market Layer** — model evaluation, selection, and eventually speciation.
4. **Product Surface** — dashboards, APIs, and user interaction.

## Top-level topology

```
                   Users
                     │
          ┌──────────┴──────────┐
          │                     │
      Web UI               External APIs
      (Next.js)                 │
          │                     │
          └──────────┬──────────┘
                     │
               HTTP / Queue
                     │
      ┌──────────────┴──────────────┐
      │        Execution Core       │
      └──────────────┬──────────────┘
                     │
          PostgreSQL / Object Storage
```

The important boundary:

- **Product Surface → stateless.** Request/response only. Any API route that
  would take longer than a request cycle enqueues work instead of doing it.
- **Execution Core → stateful.** Long-running processes, job queues,
  schedulers, LLM calls, database ownership.

## The Execution Core is two subsystems

The Execution Core is deliberately split in two, because reasoning and
proving are fundamentally different responsibilities:

```
                    UI
                     │
              HTTP / RPC
                     │
        ┌─────────────────────┐
        │ Company Brain        │
        │----------------------│
        │ Intent               │
        │ Planning             │
        │ LLM Understanding    │
        │ Decision Engine      │
        └─────────┬────────────┘
                  │
          emits ExecutionPlan
                  │
                  ▼
        ┌─────────────────────┐
        │ Causal Kernel        │
        │----------------------│
        │ VM                   │
        │ Trace                │
        │ Market               │
        │ Epoch Runner         │
        │ Certificate          │
        └─────────┬────────────┘
                  │
             Proof Artifacts
```

### Company Brain (`systems/company-brain`)

The Company Brain **reasons**. It is allowed to be nondeterministic: it calls
LLMs, weighs intent, tone, and risk, and decides what should happen.

- LLM Understanding (`src/core/understanding/llm_understand.ts`)
- Decision Engine (`src/core/decision/decision_engine.ts`)
- Execution Orchestrator (`src/core/execution/execution_orchestrator.ts`)

Its sole output across the boundary is an **ExecutionPlan** — a fully
resolved, deterministic description of work. All nondeterminism (LLM
sampling, wall-clock time, external lookups) must be resolved *before* the
plan is emitted; the plan itself contains only concrete values.

### Causal Kernel (`systems/causal-kernel`)

The Causal Kernel **proves**. It takes ExecutionPlans and executes them
deterministically, so that any run can be replayed byte-for-byte:

- **VM** — deterministic execution of plan steps.
- **Trace** — an append-only record of every state transition.
- **Market** — scores model output against predictions (see below).
- **Epoch Runner** — batches execution into numbered epochs, each closing
  with a final state root.
- **Certificate** — an Execution Certificate binding plan, trace, and state
  roots into a verifiable proof artifact.

The kernel never calls an LLM, never reads a clock, and never touches the
network. Everything it needs arrives inside the ExecutionPlan.

### Why the split matters

The Brain can be tested with mocks, judgment calls, and fuzzy assertions.
The Kernel is tested by **replay**: run an epoch twice, byte-compare the
trace, certificate, and market outputs. Keeping nondeterminism on the Brain
side of the ExecutionPlan boundary is what makes that test possible.

## Epoch prediction chaining

The Market measures how well the system predicts its own next state. The
prediction for an epoch is the previous epoch's final state root:

```
prediction(epoch n) = finalStateRoot(epoch n − 1)
```

- Epoch 0: prediction = zero root (`0x00…00`) — Genesis, the null hypothesis.
- Epoch 1: prediction = epoch 0's final root.
- Epoch 2: prediction = epoch 1's final root.
- …

The Market is therefore not measuring distance from a fixed null
hypothesis — it measures how well *yesterday predicts today*, while
remaining fully deterministic and replayable. See
[GENESIS.md](./GENESIS.md) for the full specification.

## Interfaces between layers

| From | To | Interface |
| --- | --- | --- |
| Product Surface | Company Brain | HTTP / job queue (enqueue only) |
| Company Brain | Causal Kernel | `ExecutionPlan` (typed, deterministic) |
| Causal Kernel | Market Layer | epoch state roots + traces |
| Causal Kernel | everyone | Proof artifacts (certificates, traces) |
| Execution Core | storage | PostgreSQL (state), object storage (artifacts) |

The kernel-side contract types live in
`systems/causal-kernel/src/contracts/` and are the source of truth for the
Brain → Kernel boundary.

## Deployment

Each subsystem runs in the environment it is best suited for; see
[DEPLOYMENT.md](./DEPLOYMENT.md).
