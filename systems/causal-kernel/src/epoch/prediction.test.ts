import { strict as assert } from "assert";
import { ZERO_ROOT, StateRoot } from "../contracts/execution_plan";
import {
  CERT_VERSION,
  ExecutionCertificate,
  ZERO_DIGEST,
  sealCertificate,
} from "../contracts/certificate";
import { predictionFor, verifyPredictionChain } from "./prediction";

const rootA = ("0x" + "aa".repeat(32)) as StateRoot;
const rootB = ("0x" + "bb".repeat(32)) as StateRoot;

// Genesis predicts the zero root and admits no predecessor.
assert.equal(predictionFor(0, null), ZERO_ROOT);
assert.throws(() => predictionFor(0, rootA));

// Every later epoch predicts its predecessor's final root.
assert.equal(predictionFor(1, rootA), rootA);
assert.equal(predictionFor(2, rootB), rootB);
assert.throws(() => predictionFor(1, null));
assert.throws(() => predictionFor(-1, null));
assert.throws(() => predictionFor(1.5, rootA));

const cert = (
  epochNumber: number,
  predictedStateRoot: StateRoot,
  finalStateRoot: StateRoot
): ExecutionCertificate =>
  sealCertificate({
    certVersion: CERT_VERSION,
    epochNumber,
    previousExecutionDigest: ZERO_DIGEST,
    executionPlanDigest: ZERO_DIGEST,
    traceRoot: ZERO_DIGEST,
    predictedStateRoot,
    finalStateRoot,
    marketRoot: ZERO_DIGEST,
    marketSnapshotDigest: ZERO_DIGEST,
    vmConfigHash: ZERO_DIGEST,
    kernelVersion: "test",
    frameCount: 0,
    tickCount: 0,
  });

// A well-formed chain: 0 predicts zero root, n predicts n−1's final root.
verifyPredictionChain([
  cert(0, ZERO_ROOT, rootA),
  cert(1, rootA, rootB),
  cert(2, rootB, rootA),
]);
verifyPredictionChain([]);

// Broken link: epoch 2 predicts something other than epoch 1's final root.
assert.throws(() =>
  verifyPredictionChain([
    cert(0, ZERO_ROOT, rootA),
    cert(1, rootA, rootB),
    cert(2, rootA, rootA),
  ])
);

// Chain must start at Genesis and be contiguous.
assert.throws(() => verifyPredictionChain([cert(1, rootA, rootB)]));
assert.throws(() =>
  verifyPredictionChain([cert(0, ZERO_ROOT, rootA), cert(2, rootA, rootB)])
);

// Genesis with a non-zero prediction is invalid.
assert.throws(() => verifyPredictionChain([cert(0, rootA, rootB)]));

console.log("✅ prediction chaining: all assertions passed");
