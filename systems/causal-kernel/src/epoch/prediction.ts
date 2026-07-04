import { StateRoot, ZERO_ROOT } from "../contracts/execution_plan";
import { ExecutionCertificate } from "../contracts/certificate";

// Prediction chaining (normative spec: docs/GENESIS.md):
//
//   prediction(epoch 0) = zero root
//   prediction(epoch n) = finalStateRoot(epoch n − 1)   for n ≥ 1
//
// The Market scores each epoch on how well the previous epoch's final
// state predicts this one — "how well yesterday predicts today" — rather
// than distance from a fixed null hypothesis.

export function predictionFor(
  epoch: number,
  previousFinalRoot: StateRoot | null
): StateRoot {
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new Error(`Invalid epoch: ${epoch}`);
  }
  if (epoch === 0) {
    if (previousFinalRoot !== null) {
      throw new Error("Epoch 0 (Genesis) has no predecessor");
    }
    return ZERO_ROOT;
  }
  if (previousFinalRoot === null) {
    throw new Error(`Epoch ${epoch} requires epoch ${epoch - 1}'s final root`);
  }
  return previousFinalRoot;
}

// Verify the prediction chain across an ordered run of certificates
// starting at Genesis. Returns nothing; throws on the first broken link.
// This is the invariant a replay must reproduce byte-for-byte.
export function verifyPredictionChain(
  certificates: ExecutionCertificate[]
): void {
  certificates.forEach((cert, i) => {
    if (cert.epoch !== i) {
      throw new Error(
        `Certificate at position ${i} has epoch ${cert.epoch}; chain must start at Genesis and be contiguous`
      );
    }
    const expected = predictionFor(
      i,
      i === 0 ? null : certificates[i - 1].finalStateRoot
    );
    if (cert.predictedStateRoot !== expected) {
      throw new Error(
        `Epoch ${i}: predictedStateRoot ${cert.predictedStateRoot} does not match ${expected}`
      );
    }
  });
}
