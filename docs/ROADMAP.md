# Roadmap & Reality Gates

This document does two things: it locks in the rules from the design
discussions that are true of the system *today*, and it parks the
designed-but-not-buildable layers behind explicit prerequisites, so the
specification stack cannot silently outrun the implementation.

Governing principle (established early, still binding): **the system is
not evolutionary until replay is perfect — and a layer is not
implementable until the quantities it operates on exist.**

## Locked in (true of the code today)

**The epoch-boundary law.** Structural change happens only *between*
epochs, never within one. Within an epoch, configuration is immutable and
committed: `vmConfigHash` and `kernelVersion` are sealed into every
certificate, so any future reparameterization is visible as a
commitment change at an epoch boundary, and replay of a past epoch always
runs under the configuration that produced it. Any future mutation
mechanism inherits this for free — it slots in at the boundary or it
does not slot in at all.

**The pipeline ordering contract.** The canonical construction order is
procedural and lives in one place, `runEpoch`: execute steps → emit trace
→ derive final state root → derive market snapshot → seal certificate.
Artifacts are built in a fixed post-pass, not "as it goes." The
run-twice byte-equality test is the enforcement mechanism; a declarative
transition-graph formalism adds nothing while the pipeline has one
implementation and one test that catches any ordering drift.

**In-process, service-ready.** The kernel runs in one process (Phase 1).
Module boundaries are kept extraction-ready: no shared mutable state
across subsystems, every inter-module payload is canonically
serializable, and the Market is a projection over VM output — not a peer
of the VM. Sidecar extraction (Phase 2) is deferred until replay is
proven beyond a single machine.

## Reality gates (prerequisites before the parked layers)

Gate 1 — **Real workloads.** The Execution Orchestrator currently
pattern-matches action strings; no production job has flowed end-to-end.
Until real jobs run through understanding → decision → compiled plan →
epoch, every downstream signal is synthetic.

Gate 2 — **Cross-environment replay.** In progress. The CEL (canonical
codec hardened with UTF-8 bytewise ordering, NFC normalization, and
non-plain-object tripwires; deterministic map backing VM state) and the
cross-machine protocol (docs/CROSS_MACHINE_PROTOCOL.md) are in place; a
golden vector is committed and replays byte-identically across process
boundaries locally. Remaining: `scripts/verify_replay.sh` on a second
real machine / OS / Node version, and a long-chain (10³+ epochs) soak.

Gate 3 — **A model population.** The Market today has exactly one
implicit participant: the chain predictor (yesterday's root predicts
today's). There is no RegimeModel abstraction, no second hypothesis, and
no per-model prediction stream.

Gate 4 — **Real objective signals.** `utility` and `informationGain` are
not computed anywhere. Pareto dominance over {stability, utility,
infoGain} is undefined until all three coordinates exist per model per
epoch, from real workloads (Gate 1) across a population (Gate 3).

## Parked specifications (design accepted, implementation gated)

| Layer | Blocked by | Why it cannot be built sooner |
| --- | --- | --- |
| MarketClearing v0.2 (Pareto surface) | Gates 1, 3, 4 | A Pareto frontier over one point is that point; two of its three axes don't exist yet |
| MarketTopologyEngine (bifurcation monitor) | Gate 3 | Mutual information and divergence between model predictions require multiple models emitting predictions over shared observations |
| MutationEngine + Constitution | Gates 2, 3 | There is nothing mutable (no RegimeModel), and constitutional rule C1 — replay must not diverge — cannot be evaluated until Gate 2 defines what stable replay means at scale |
| State-Morph / Reversibility hooks | all of the above | They mutate the RegimeModel; it must exist first |

The constitutional ideas (C1 causal consistency, C2 lineage integrity as
a DAG, C3 bounded instability, C4 reversibility) and the
proposal-then-validate mutation flow are sound and adopted as design
intent. They are recorded here so they can be built at the moment their
inputs are real — and not before.

## Build order from here

1. Persist Brain jobs end-to-end: real job → `llmUnderstand` →
   `decisionEngine` → `compileExecutionPlan` → epoch → certificate log
   (closes Gate 1).
2. Replay a produced certificate log + artifact store on a second
   machine / Node version; add a long-chain (10³+ epochs) soak test
   (closes Gate 2).
3. Introduce `RegimeModel` as an explicit kernel citizen: a named,
   versioned predictor whose per-epoch predictions are committed
   artifacts (opens Gate 3).
4. Define and compute utility from real job outcomes (opens Gate 4).
5. Only then: MarketClearing v0.2 → topology detection → governed
   mutation, in that order.
