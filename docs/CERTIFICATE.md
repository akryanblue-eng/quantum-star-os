# ExecutionCertificate v0.1 Specification

The ExecutionCertificate is a **cryptographic manifest, not a data
container**. It holds only digests and small scalars that bind the heavy
artifacts of an epoch together; the artifacts themselves (plans, trace,
market snapshot) live alongside it. Normative implementation:
`systems/causal-kernel/src/contracts/certificate.ts`.

Not in the certificate, by design: no full trace, no market snapshot, no
execution plan, no model state, no frame list. Only digests.

## Schema

| Section | Field | Meaning |
| --- | --- | --- |
| Header | `certVersion` | schema version, `"0.1"` |
| Header | `epochNumber` | position in the chain, Genesis = 0 |
| Lineage | `previousExecutionDigest` | `executionDigest` of epoch n−1; `ZERO_DIGEST` at Genesis |
| Execution | `executionPlanDigest` | digest over the ordered plan-hash list |
| Execution | `traceRoot` | digest of the epoch's trace |
| Execution | `predictedStateRoot` | prediction for this epoch (see GENESIS.md) |
| Execution | `finalStateRoot` | state commitment after the epoch |
| Market | `marketRoot` | root over the clearing result (per-model scores) |
| Market | `marketSnapshotDigest` | digest of the market snapshot artifact as stored |
| Configuration | `vmConfigHash` | digest of the VM semantics that executed the epoch |
| Configuration | `kernelVersion` | producing kernel build |
| Statistics | `frameCount` | plans executed |
| Statistics | `tickCount` | VM steps executed |
| Integrity | `executionDigest` | see digest rules |
| Integrity | `certificateDigest` | see digest rules |
| Integrity | `signature` (optional) | reserved; not yet produced |

Two deliberate deviations from the draft schema:

- `predictedStateRoot` **is** committed, so the prediction chain is
  verifiable from certificates alone — no artifacts needed in fast mode.
- `epochDigest` is omitted: `executionDigest` already is the epoch-level
  commitment; a second one would be redundant.

## Digest rules

One canonical hashing rule (`src/codec/canonical.ts`: sorted-key JSON,
integers only), no hand-picked field concatenation:

```
commitments       = certificate without { executionDigest,
                                          certificateDigest, signature }
executionDigest   = SHA256(canonical(commitments))
certificateDigest = SHA256(canonical(commitments + executionDigest))
```

Because the digests are derived from the canonical structure itself,
adding a committed field automatically changes them — the schema is
self-documenting for verification. The same pattern produces
`marketSnapshotDigest` and `executionPlanDigest`.

## The two chains are orthogonal

- **Prediction chain (causality)** — `predictedStateRoot(n) =
  finalStateRoot(n−1)`. Answers: *did the system evolve causally?* A
  break means the Brain's planning diverged from what the Kernel computed.
- **Lineage chain (integrity)** — `previousExecutionDigest(n) =
  executionDigest(n−1)`. Answers: *is the recorded history intact?* A
  break means corruption or tampering.

Neither replaces the other. Lineage verification is an O(n) chain walk
with no VM execution:

```
certificate[0].previousExecutionDigest == ZERO_DIGEST
certificate[n].previousExecutionDigest == certificate[n−1].executionDigest
```

Tamper behavior: editing a committed field of a historical certificate
breaks its own `executionDigest` recomputation immediately; rewriting the
certificate *consistently* (resealing its digests) is caught by the
lineage check at epoch n+1. Both cases are exercised in
`src/replay/replay.test.ts`.

## Two verification modes

| Mode | Cost | Runs the VM? | Checks |
| --- | --- | --- | --- |
| Fast (`verifyFast`) | O(epochs) | never | certificate digests, lineage walk, prediction walk; artifact-binding digests when artifacts are presented |
| Full replay (`verifyFullReplay`) | O(trace length) | yes, from Genesis | everything in fast mode, plus re-execution and byte-for-byte comparison of every regenerated artifact |

Fast verification is the everyday check (sync, audit logs, health
monitoring). Full replay is the forensic audit (bug hunting, dispute
resolution, pre-mutation gating).

## The AcceptanceReport is not a commitment

The verifier emits an AcceptanceReport with per-gate booleans:

```
gates { lineageVerified, predictionVerified, marketVerified, replayVerified }
```

It is deliberately **outside** the cryptographic commitments — including
it would be a paradox (the certificate would have to exist before its own
verification). The certificate is the immutable proof; the artifacts are
the immutable bulk data; the acceptance report is the mutable, indexable
health readout produced after the fact.
