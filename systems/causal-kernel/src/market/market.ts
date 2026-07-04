import { StateRoot } from "../contracts/execution_plan";
import { Hex32, digestOf } from "../codec/canonical";

// The Market scores each epoch on how well the previous epoch's final
// state predicts this one (docs/GENESIS.md). The score is an integer so
// that market artifacts are bit-identical across platforms — floats are
// banned from canonical form.

export type MarketSnapshot = {
  epoch: number;
  predictedStateRoot: StateRoot;
  finalStateRoot: StateRoot;
  // Position-wise matching hex characters between prediction and final
  // root: 0 (nothing predicted) .. 64 (perfectly predicted).
  score: number;
};

export function scorePrediction(
  predicted: StateRoot,
  final: StateRoot
): number {
  let matches = 0;
  for (let i = 2; i < 66; i++) {
    if (predicted[i] === final[i]) {
      matches++;
    }
  }
  return matches;
}

// marketRoot commits to the CLEARING RESULT — today a single entry; when
// the Market evaluates many models this becomes a root over all per-model
// scores. marketSnapshotDigest commits to the snapshot ARTIFACT as stored.
// The certificate carries both.
export function marketRootOf(snapshot: MarketSnapshot): Hex32 {
  return digestOf([{ epoch: snapshot.epoch, score: snapshot.score }]);
}

export function marketSnapshotDigestOf(snapshot: MarketSnapshot): Hex32 {
  return digestOf(snapshot);
}
