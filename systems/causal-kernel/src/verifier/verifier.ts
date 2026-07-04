import { ZERO_ROOT, planHashOf } from "../contracts/execution_plan";
import {
  CERT_VERSION,
  ExecutionCertificate,
  ZERO_DIGEST,
  certificateDigestOf,
  executionDigestOf,
} from "../contracts/certificate";
import { canonicalize, digestOf } from "../codec/canonical";
import { traceRootOf } from "../trace/trace";
import {
  marketRootOf,
  marketSnapshotDigestOf,
  scorePrediction,
} from "../market/market";
import { EpochArtifacts, runChain } from "../epoch/epoch_runner";

// The Verifier is deliberately separate from the EpochRunner: the runner
// produces artifacts, the verifier consumes them and produces an
// AcceptanceReport. Two assurance levels:
//
//   Fast verification  — O(epochs), certificates only (artifacts optional
//                        for binding checks). Digest recomputation,
//                        lineage walk, prediction walk. Never runs the VM.
//   Full replay        — re-executes every plan from Genesis and demands
//                        byte-for-byte equality of every regenerated
//                        artifact against the recorded ones.
//
// The report is NOT part of any cryptographic commitment — it is produced
// after the fact and can be stored, indexed, or discarded freely. The
// certificate is the proof; the report is the health readout.

export type VerificationFailure = {
  epoch: number;
  check: string;
  message: string;
};

// Each gate is true only if its checks RAN and PASSED. In fast mode
// without artifacts, marketVerified stays false (unchecked); replayVerified
// is only ever set by full replay. failures[] disambiguates
// unchecked-vs-failed.
export type AcceptanceGates = {
  lineageVerified: boolean;
  predictionVerified: boolean;
  marketVerified: boolean;
  replayVerified: boolean;
};

export type AcceptanceReport = {
  mode: "fast" | "full-replay";
  accepted: boolean;
  epochsVerified: number;
  gates: AcceptanceGates;
  failures: VerificationFailure[];
};

const LINEAGE_CHECKS = [
  "cert-version",
  "epoch-index",
  "execution-digest",
  "certificate-digest",
  "lineage",
];
const PREDICTION_CHECKS = ["prediction-chain"];
const MARKET_CHECKS = [
  "market-consistency",
  "market-score",
  "market-root",
  "market-snapshot-digest",
];

export function verifyFast(
  certificates: ExecutionCertificate[],
  artifacts?: EpochArtifacts[]
): AcceptanceReport {
  const failures: VerificationFailure[] = [];
  const fail = (epoch: number, check: string, message: string) =>
    failures.push({ epoch, check, message });

  certificates.forEach((cert, i) => {
    const prev = i === 0 ? null : certificates[i - 1];

    // ── Manifest integrity ──
    if (cert.certVersion !== CERT_VERSION) {
      fail(i, "cert-version", `unsupported certificate version ${cert.certVersion}`);
    }
    if (cert.epochNumber !== i) {
      fail(i, "epoch-index", "certificate epoch does not match chain position");
    }
    if (executionDigestOf(cert) !== cert.executionDigest) {
      fail(i, "execution-digest", "executionDigest does not match the committed fields");
    }
    if (certificateDigestOf(cert) !== cert.certificateDigest) {
      fail(i, "certificate-digest", "certificateDigest does not match the certificate");
    }

    // ── Lineage chain (integrity): is the recorded history intact? ──
    const expectedLineage = prev ? prev.executionDigest : ZERO_DIGEST;
    if (cert.previousExecutionDigest !== expectedLineage) {
      fail(i, "lineage", "previousExecutionDigest does not match the previous executionDigest");
    }

    // ── Prediction chain (causality): did the system evolve causally? ──
    const expectedPrediction = prev ? prev.finalStateRoot : ZERO_ROOT;
    if (cert.predictedStateRoot !== expectedPrediction) {
      fail(i, "prediction-chain", "predicted root is not the previous epoch's final root");
    }

    // ── Artifact binding (only when artifacts are presented) ──
    const a = artifacts?.[i];
    if (a) {
      const recomputedHashes = a.plans.map((plan) => {
        const { planHash, ...body } = plan;
        return planHashOf(body);
      });
      a.plans.forEach((plan, j) => {
        if (plan.planHash !== recomputedHashes[j]) {
          fail(i, "plan-hash", `plan ${plan.planId} hash does not match its content`);
        }
      });
      if (digestOf(recomputedHashes) !== cert.executionPlanDigest) {
        fail(i, "execution-plan-digest", "certificate does not bind the presented plans");
      }

      if (traceRootOf(a.trace) !== cert.traceRoot) {
        fail(i, "trace-root", "trace root does not match certificate");
      }
      const lastRoot =
        a.trace.events.length > 0
          ? a.trace.events[a.trace.events.length - 1].stateRootAfter
          : a.trace.startStateRoot;
      if (lastRoot !== cert.finalStateRoot) {
        fail(i, "final-state-root", "trace does not end at the certified final root");
      }
      if (a.trace.startStateRoot !== expectedPrediction) {
        fail(i, "start-state-root", "trace does not start at the previous final root");
      }
      if (a.trace.events.length !== cert.tickCount) {
        fail(i, "tick-count", "trace length does not match certified tickCount");
      }
      if (a.plans.length !== cert.frameCount) {
        fail(i, "frame-count", "plan count does not match certified frameCount");
      }

      const s = a.marketSnapshot;
      if (
        s.predictedStateRoot !== cert.predictedStateRoot ||
        s.finalStateRoot !== cert.finalStateRoot
      ) {
        fail(i, "market-consistency", "market snapshot roots disagree with certificate");
      }
      if (s.score !== scorePrediction(s.predictedStateRoot, s.finalStateRoot)) {
        fail(i, "market-score", "market score is not the deterministic score of its roots");
      }
      if (marketRootOf(s) !== cert.marketRoot) {
        fail(i, "market-root", "market root does not match certificate");
      }
      if (marketSnapshotDigestOf(s) !== cert.marketSnapshotDigest) {
        fail(i, "market-snapshot-digest", "market snapshot digest does not match certificate");
      }
    }
  });

  const failed = (checks: string[]) =>
    failures.some((f) => checks.includes(f.check));

  return {
    mode: "fast",
    accepted: failures.length === 0,
    epochsVerified: certificates.length,
    gates: {
      lineageVerified: !failed(LINEAGE_CHECKS),
      predictionVerified: !failed(PREDICTION_CHECKS),
      marketVerified: artifacts !== undefined && !failed(MARKET_CHECKS),
      replayVerified: false,
    },
    failures,
  };
}

// Full replay: re-execute every plan from Genesis and byte-compare every
// regenerated artifact — trace, snapshot, certificate — against the
// recorded ones. This is the deep forensic audit; fast verification is
// the everyday check.
export function verifyFullReplay(chain: EpochArtifacts[]): AcceptanceReport {
  const base = verifyFast(chain.map((a) => a.certificate), chain);
  const failures = [...base.failures];
  let replayVerified = false;

  try {
    const regenerated = runChain(chain.map((a) => a.plans));
    if (canonicalize(regenerated) === canonicalize(chain)) {
      replayVerified = true;
    } else {
      regenerated.forEach((r, i) => {
        if (canonicalize(r) !== canonicalize(chain[i])) {
          failures.push({
            epoch: i,
            check: "replay",
            message: "regenerated artifacts are not byte-identical to recorded artifacts",
          });
        }
      });
    }
  } catch (err) {
    failures.push({
      epoch: -1,
      check: "replay",
      message: `re-execution failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return {
    mode: "full-replay",
    accepted: failures.length === 0,
    epochsVerified: chain.length,
    gates: { ...base.gates, replayVerified },
    failures,
  };
}
