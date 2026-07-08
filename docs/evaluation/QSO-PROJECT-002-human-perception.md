# Human Perception Evaluation Protocol — QSO-PROJECT-002

**Status: DRAFT — prerequisites not met. No evaluation has been run.**

This document defines a human-in-the-loop evaluation protocol for a
"clutch pressure" gameplay mechanic. It is a protocol *template*: it
describes how an evaluation would be conducted once the system under
test exists. It contains no results, and it must never contain
generated, simulated, or inferred results — only responses recorded
verbatim from a human evaluator.

---

## 1. Current state of the repository (as of 2026-07-08)

Before any evaluation can run, the system under test has to exist.
Right now it does not. An audit of this repository found:

**Present:**
- `systems/company-brain/` — a TypeScript scaffold (decision engine,
  execution orchestrator, LLM understanding service, Prisma schema)
- `automation/init.sh`
- This document

**Not present (all prerequisites for this protocol):**
- Any game or interactive runtime (no "Arch Rivals: Street" build)
- Any implementation of a `CLUTCH_PRESSURE` primitive, reaction-window
  logic (250ms / 235ms or otherwise), or a `DefenderBeliefSystem`
- Any audio/replay system
- Any telemetry or metrics capture

References elsewhere to verified block sequences, staging buffers
holding variant state-spaces, or live telemetry boards describe
infrastructure that has not been built. Treat any such status claim
as unverified until it can be pointed at code in this repository.

## 2. Prerequisites (gate — all must be true before Section 4 runs)

1. A runnable build exists that a human can play or watch.
2. The mechanic under test is implemented and can be toggled on/off
   by configuration, producing Variant A (off) and Variant B (on).
3. Sequences can be replayed with the variant label hidden from the
   evaluator (for Variant C / blind trials).
4. A named human evaluator is available and understands that their
   raw impressions — not "expected" answers — are the data.

## 3. Variant definitions

- **Variant A (Control):** mechanic disabled. Baseline defensive
  interaction with the standard reaction window.
- **Variant B (Treatment):** full mechanic engaged (window
  constriction, visual pulse, token emission).
- **Variant C (Blind):** a randomized sequence of A and B trials with
  no labels shown to the evaluator. The A/B assignment is recorded by
  a second person (or a script) and sealed until all responses are in.

## 4. Capture form (one per blind trial)

To be filled in by the human evaluator only. Blank fields stay blank.

```
Trial ID: ______            Date: ______   Evaluator: ______
Actual variant (sealed until reveal): ______

Mechanical feel — fairness / intentional challenge (1–10): ______
Audio–gameplay connection (1–10):                          ______
Guess: was the mechanic active? (A / B / can't tell):      ______
In your own words, the moment felt like: ___________________________
```

## 5. Analysis (only after all trials are captured)

1. Unseal the actual variant assignments.
2. Compute guess accuracy (Variant C trials): evaluators should
   identify B at a rate meaningfully above chance if the mechanic is
   perceptible.
3. Compare mean feel/connection scores between A and B trials.
4. Success thresholds should be set *before* unsealing; the ≥80%
   targets proposed in project scoping are a starting point, to be
   confirmed with the evaluator pool size in mind (a single-evaluator
   "gold standard" run is directional only, not statistically valid).

## 6. Integrity rules

- No AI-generated responses may be entered into Section 4 forms.
- Simulated or projected telemetry must be labeled as such and kept
  out of this document entirely.
- The evaluation status is "not run" until at least one completed,
  human-filled capture form is committed alongside this file.
