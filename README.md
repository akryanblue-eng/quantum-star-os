# quantum-star-os

Quantum Star OS - Quantum Star LLC

## Architecture

The system is organized into four layers:

1. **Company Brain** (`systems/company-brain`) — planning, intent, orchestration. It *reasons*.
2. **Causal Kernel** (`systems/causal-kernel`) — deterministic execution and replay. It *proves*.
3. **Market Layer** — model evaluation and selection, scored on epoch prediction chains.
4. **Product Surface** — dashboards, APIs, and user interaction (stateless).

The Brain emits `ExecutionPlan`s across a typed boundary; the Kernel executes
them deterministically and produces proof artifacts (traces, execution
certificates, market scores).

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, boundaries, and interfaces
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hybrid deployment topology (stateless surface, persistent core)
- [docs/GENESIS.md](docs/GENESIS.md) — Genesis, prediction chaining, and certificate lineage
- [docs/CERTIFICATE.md](docs/CERTIFICATE.md) — ExecutionCertificate v0.1 manifest schema and verification modes
- [docs/STORAGE.md](docs/STORAGE.md) — log-first storage: append-only certificate log as source of truth
