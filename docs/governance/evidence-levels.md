# Evidence Level Classification

Every capability claim in this repository must carry an evidence level.
A claim may not be stated at a higher level than the artifacts in this
repository support.

| Level | Name         | Requirement                                              |
|-------|--------------|----------------------------------------------------------|
| L0    | Concept      | Documented intention only                                 |
| L1    | Architecture | Interfaces, schemas, or contracts committed as code/docs  |
| L2    | Prototype    | Runnable isolated implementation, verified to execute     |
| L3    | Measurement  | Human or system telemetry captured from a real run        |
| L4    | Production   | Integrated runtime capability in regular use              |

## The invariant

> The system may forecast, explain, and propose creative relationships —
> but it cannot claim a validated experience until an executable artifact
> produces observable evidence.

Practical consequences:

- Status reports must cite the file (and where relevant, the commit)
  that supports each claimed level.
- Simulated or projected data is never evidence for L3. Only captured
  output from a real run — human responses recorded verbatim, or
  telemetry written by executing code — counts.
- A claim that cannot be pointed at an artifact in this repository is
  L0 by definition, regardless of how it is phrased.

## Current classification (2026-07-08)

| Capability                     | Level | Supporting artifact                                        |
|--------------------------------|-------|------------------------------------------------------------|
| Company Brain decision scaffold| L1    | `systems/company-brain/src/core/`                          |
| Experience runtime contract    | L1    | `docs/architecture/qs-experience-runtime-v0.1.md`          |
| Blitz Clutch experience slice  | L2    | `prototypes/blitz-clutch-v0.1/` (verified runnable)        |
| Human perception evaluation    | L1    | `docs/evaluation/QSO-PROJECT-002-human-perception.md` — protocol only, not run |
| Runtime bridge (QSO-PROJECT-003)| L0   | none                                                        |

Update this table in the same commit as any change that moves a level.
