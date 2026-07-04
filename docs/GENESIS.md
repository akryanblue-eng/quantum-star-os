# Genesis & Epoch Prediction Specification

This document specifies epoch 0 (Genesis) and the prediction rule that
links every subsequent epoch to its predecessor. It is the normative
reference for `systems/causal-kernel/src/epoch/prediction.ts`.

## State roots

Every epoch closes with a **final state root**: a 32-byte hash committing
to the entire kernel state at the end of the epoch. State roots are
lowercase hex, `0x`-prefixed, 64 hex characters.

The **zero root** is:

```
0x0000000000000000000000000000000000000000000000000000000000000000
```

## Prediction rule

The predicted state root for an epoch is defined by chaining, not by a
constant:

```
prediction(epoch 0) = zero root
prediction(epoch n) = finalStateRoot(epoch n − 1)     for n ≥ 1
```

Concretely:

| Epoch | Prediction |
| --- | --- |
| 0 | zero root |
| 1 | epoch 0's final root |
| 2 | epoch 1's final root |
| … | … |

### Rationale

An earlier draft fixed `predictedStateRoot = 0x00…00` for all epochs. That
is deterministic, but after the first epoch it is an uninformative
baseline: the Market would forever be measuring distance from a null
hypothesis.

Under chaining, the Market instead measures **how well yesterday predicts
today**. An epoch that changes little scores as highly predictable; an
epoch with large state movement scores as surprising. This yields a
meaningful performance signal while remaining fully deterministic and
replayable — the prediction for epoch *n* is derivable from the epoch
*n − 1* certificate alone.

## Genesis (epoch 0)

- `epoch = 0`
- `predictedStateRoot = zero root`
- The kernel state before epoch 0 is empty; the zero root is both the
  prediction and the pre-state commitment.
- Epoch 0's certificate is the root of the certificate chain: every later
  certificate is transitively bound to it through the prediction rule.

## Market scoring

For each epoch the Market receives the pair:

```
(prediction(n), finalStateRoot(n))
```

and produces a deterministic score of prediction quality. The scoring
function is part of the Market specification; this document only fixes
what the prediction *is*.

## Replay invariants

Any replay of epochs `0..n` must reproduce, byte-for-byte:

1. every `finalStateRoot(k)` for `k ≤ n`;
2. every `prediction(k)` (which follows from 1 and the chaining rule);
3. every certificate and market score derived from them.

A replay that diverges in any of these is a kernel defect by definition.
