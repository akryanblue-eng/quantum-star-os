# Cross-Machine Replay Protocol v0.1

The falsifiable test that decides whether the kernel is deterministic
physics or a localhost artifact: **do two different machines produce
identical bytes under real execution?** This protocol is deliberately
host-naive — no environment manifest, no VFS, no scheduler shims. If
determinism fails here, the first job is finding the leak, not
classifying the host.

## Protocol

**Machine A**

```
scripts/run_epoch.sh [outDir]
```

Runs the reference chain (fixtured Brain understanding → real decision
engine → plan compiler → 3 epochs) and writes canonical artifacts:

- `bundle.cjson` — the full artifact chain, canonical bytes
- `certificates.cjsonl` — append-only certificate log
- `roots.cjson` — per-epoch trace/market/state roots, execution digests,
  bundle digest, log Merkle root

**Machine B** (after copying the directory, or from the committed vector)

```
scripts/verify_replay.sh [bundleDir]
```

Re-executes the chain from Genesis on the local machine and demands:

1. **Bundle byte equality** — regenerated canonical bytes == recorded
   bytes. This is the coin flip.
2. **Roots equality** — localizes any mismatch to trace, market, state,
   or lineage.
3. **Full replay verification** — the verifier's gates on the recorded
   artifacts.
4. **Log streaming verification** — the certificate log's chain walk.

Exit 0 = replay closed. Exit 1 = reality leaked; the FAIL lines say
where.

## The golden vector

`systems/causal-kernel/vectors/genesis-chain-v1/` is a committed bundle
produced on: `node v22.22.2, linux/x64`. It serves two purposes:

- **Cross-machine test with zero setup**: clone the repo on any machine
  and run `scripts/verify_replay.sh` — that machine immediately replays
  against bytes produced elsewhere.
- **Drift tripwire in CI/tests**: `npm test` verifies the vector, so any
  code change that alters canonical bytes, digests, or execution
  semantics fails loudly and must regenerate the vector deliberately
  (run `scripts/run_epoch.sh` and review the `git diff`).

## Outcome interpretation

| Outcome | Meaning | Next action |
| --- | --- | --- |
| All PASS | Kernel deterministic across this boundary | Add environments (other OS, other Node major, other CPU arch); then Gate 2 closes |
| Bundle FAIL, code identical | Hidden nondeterminism (ordering, normalization, runtime behavior) | The roots line localizes the layer; fix the leak, do not paper over it |
| Roots diverge but certificates verify | The sealing layer commits to different bytes than execution produced | Sealing bug — highest severity, informative |

## What is deliberately NOT here yet

- **EnvironmentManifest** — meaningful only after a first cross-machine
  divergence needs classifying, or a first success needs recording.
- **VFS / tick sequencer / WASM sanitization** — the kernel currently has
  no filesystem access, no async, no timers, no `Date`, no
  `Math.random`, and no WASM in any execution path; it is synchronous
  and I/O-free by construction. The CEL guard exists to keep it that
  way. These hardening layers become real work only when the kernel
  gains such capabilities — building them now would harden doors that
  do not exist.

## Status

- [x] Same machine, same process (run-twice, in test suite)
- [x] Same machine, separate processes via disk round-trip (this
  protocol, local)
- [ ] Second real machine / OS / Node version — **run
  `scripts/verify_replay.sh` on any other computer; this is the next
  action and it is one command**
