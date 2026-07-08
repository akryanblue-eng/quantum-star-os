# QS Experience Runtime — Minimum Implementation Contract v0.1

**Evidence level: L1 (Architecture).** This document defines interfaces.
Where a row in the conformance table below cites a file, that piece is
implemented; everything else is contract only.

## Purpose

Define the smallest pipeline that turns an audio signal into an
observable gameplay difference, so that a human can compare the system
with the experience layer ON versus OFF. This is the object that
QSO-PROJECT-002 (human perception evaluation) measures.

## Pipeline

```
Audio Signal (WAV file)
      |
      v
Feature Extractor
  outputs per-event: onset time, energy, transient density, tempo estimate
      |
      v
Experience Primitive Resolver
  inputs:  energy, tempo, transient density, (narrative tags — deferred)
  outputs: PRESSURE  (implemented)
           SPACE     (deferred)
           IDENTITY  (deferred)
      |
      v
Actuator Interface
  ReactionWindowModifier — maps PRESSURE to a reaction-window change
  plus a pre-cue "pulse" signal when PRESSURE exceeds threshold
```

## Interface contracts

### 1. Feature Extractor

```
extractFeatures(wavBuffer) -> {
  sampleRate: number,
  durationSec: number,
  tempoBpmEstimate: number | null,
  transientDensity: number,        // onsets per second
  onsets: [{ timeSec: number, energy: number }]  // energy normalized 0..1
}
```

Constraints: pure function of the audio bytes; deterministic; no
network access. PCM WAV in, features out.

### 2. Experience Primitive Resolver

```
resolvePrimitives(features) -> {
  events: [{
    timeSec: number,
    pressure: number,      // 0..1, derived from normalized onset energy
    clutch: boolean        // pressure >= CLUTCH_THRESHOLD
  }]
}
```

`PRESSURE` is the only primitive in v0.1. `SPACE` and `IDENTITY` remain
L0 and must not be emitted until they have their own contract version.

### 3. Actuator Interface — ReactionWindowModifier

```
reactionWindow(event, experienceMode) -> {
  windowMs: number,        // 250 baseline; 235 when experienceMode && event.clutch
  pulse: boolean           // pre-cue visual pulse, only when experienceMode && event.clutch
}
```

The toggle (`experienceMode`) is the A/B boundary:

- **Variant A (control):** every event gets the 250 ms window, no pulse.
- **Variant B (experience):** clutch events get a 235 ms window and a
  pre-cue pulse; non-clutch events behave as in A.

Any future actuator (e.g. a `DefenderReactionModifier` inside a real
game runtime) must consume the same resolver output and honor the same
toggle semantics, so evaluation results transfer.

### 4. Telemetry

Every run writes a results file containing, per event: the scheduled
time, the window applied, the measured human response latency in ms
(or null on miss), and hit/miss. Telemetry is written only from actual
execution — see `docs/governance/evidence-levels.md`.

## Conformance (what exists today)

| Contract element             | Status | Artifact                                            |
|------------------------------|--------|-----------------------------------------------------|
| Feature Extractor            | L2     | `prototypes/blitz-clutch-v0.1/src/features.js`      |
| Primitive Resolver (PRESSURE)| L2     | `prototypes/blitz-clutch-v0.1/src/resolver.js`      |
| ReactionWindowModifier       | L2     | `prototypes/blitz-clutch-v0.1/src/game.js`          |
| Telemetry capture            | L2     | results JSON written by `game.js`                   |
| SPACE / IDENTITY primitives  | L0     | none                                                |
| Narrative tag input          | L0     | none                                                |
| Integrated game runtime      | L0     | none                                                |

## Out of scope for v0.1

Full game integration, networked play, audio synthesis, any
"DefenderBeliefSystem" beyond the single window modifier, and any
claim about how the experience *feels* — feel claims belong to
QSO-PROJECT-002 and require L3 evidence.
