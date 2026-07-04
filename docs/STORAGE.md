# Certificate Storage — Log-First Architecture

One strict rule governs storage:

> **The flat append-only log is the source of truth. Everything else is
> derived.**

## 1. Primary: the append-only certificate log (canonical truth)

`certificates.cjsonl` — one canonical-JSON ExecutionCertificate per line,
strictly ordered by epoch. Implementation:
`systems/causal-kernel/src/log/certificate_log.ts`.

Properties:

- immutable — no overwrites, no deletes
- strictly ordered append
- replayable from Genesis
- the hash chain inside the entries makes the log self-validating

This is the physical-reality layer: deterministic lineage traversal,
forensic reconstruction, and the replay substrate all come from this one
file stream.

## 2. Secondary: optional index (KV / DB / in-memory)

Not truth — a navigation accelerator only:

```
executionDigest → file offset
epochNumber     → executionDigest
modelId         → last-seen certificate(s)
```

Crucial constraint: **if the index disappears, nothing is lost except
performance.** It is always rebuildable by scanning the log. (No index is
implemented yet; it is a derived view to add when dashboards need it.)

## 3. Why KV-only storage is rejected

A pure KV design breaks a core invariant — *replay determinism must not
depend on system state outside the log*. It introduces reordering bugs,
write races, partial visibility, and database semantics into the trust
base, shifting the mental model from "I can reconstruct the system from
first principles" to "I trust the database reflects history correctly."

## 4. Write and read paths

```
                 WRITE PATH
Brain → ExecutionPlan
             ↓
        Kernel executes
             ↓
      ExecutionCertificate
             ↓
   append-only certificates.cjsonl
             ↓
        (fan-out)
     ┌──────────────┬──────────────┐
     ▼              ▼              ▼
Index DB       Metrics Store   UI Cache
(KV)            (optional)     (ephemeral)

                 READ PATH
Log → (scan, or seek via index) → verifier / replay
```

## 5. Lineage traversal modes

- **Hard replay (truth reconstruction)** — start at Genesis, follow the
  `previousExecutionDigest` chain. No index required; purely
  cryptographic; slow but canonical. This is `verifyLog()` — a streaming
  reducer over the certificate log.
- **Fast traversal (product layer)** — `epochNumber → index → seek`, then
  follow the chain. For dashboards, debugging, sampling.

## 6. Checkpoints for large logs

Each entry has a hash, and periodic checkpoints commit to the whole
prefix:

```
logEntryHash  = SHA256(canonical(ExecutionCertificate))
logMerkleRoot = binary Merkle root over entry hashes
```

A massive log can then be spot-checked against a single 32-byte
commitment. Tamper detection works even inside very large logs without
walking every entry.

## 7. The self-healing property

Because the log is primary: index corruption doesn't matter, partial
system failure doesn't matter, and the entire system — market history,
model evolution, replay verification, audit trails — can be rebuilt from
a single file stream.
