import { ExecutionPlan, planHashOf } from "../contracts/execution_plan";
import {
  CERT_VERSION,
  ExecutionCertificate,
  ZERO_DIGEST,
  sealCertificate,
} from "../contracts/certificate";
import { digestOf } from "../codec/canonical";
import {
  KernelState,
  VM_CONFIG_HASH,
  applyStep,
  stateRootOf,
} from "../vm/vm";
import { Trace, TraceEvent, traceRootOf } from "../trace/trace";
import {
  MarketSnapshot,
  marketRootOf,
  marketSnapshotDigestOf,
  scorePrediction,
} from "../market/market";
import { KERNEL_VERSION } from "../version";
import { predictionFor } from "./prediction";

// The EpochRunner EXECUTES; it does not verify. It consumes ExecutionPlans
// and produces artifacts — trace, market snapshot, and a sealed
// certificate manifest — which the Verifier (src/verifier/verifier.ts)
// checks independently, possibly long after this process is gone.

export type EpochArtifacts = {
  plans: ExecutionPlan[];
  trace: Trace;
  marketSnapshot: MarketSnapshot;
  certificate: ExecutionCertificate;
};

export type EpochResult = {
  artifacts: EpochArtifacts;
  finalState: KernelState;
};

export type PreviousEpoch = {
  state: KernelState;
  certificate: ExecutionCertificate;
};

export function runEpoch(
  epoch: number,
  plans: ExecutionPlan[],
  previous: PreviousEpoch | null
): EpochResult {
  const prevCert = previous ? previous.certificate : null;
  if (prevCert && prevCert.epochNumber !== epoch - 1) {
    throw new Error(
      `Epoch ${epoch} cannot follow certificate for epoch ${prevCert.epochNumber}`
    );
  }

  const predictedStateRoot = predictionFor(
    epoch,
    prevCert ? prevCert.finalStateRoot : null
  );

  const state: KernelState = new Map(previous ? previous.state : []);
  const startStateRoot = stateRootOf(state);
  if (prevCert && startStateRoot !== prevCert.finalStateRoot) {
    throw new Error(
      `Epoch ${epoch} starting state does not match epoch ${prevCert.epochNumber}'s final root`
    );
  }

  const events: TraceEvent[] = [];
  for (const plan of plans) {
    if (plan.epoch !== epoch) {
      throw new Error(
        `Plan ${plan.planId} targets epoch ${plan.epoch}, not ${epoch}`
      );
    }
    const { planHash, ...body } = plan;
    if (planHashOf(body) !== planHash) {
      throw new Error(`Plan ${plan.planId} hash does not match its content`);
    }
    for (const step of plan.steps) {
      applyStep(state, step);
      events.push({
        planId: plan.planId,
        stepIndex: step.index,
        op: step.op,
        stateRootAfter: stateRootOf(state),
      });
    }
  }

  const trace: Trace = { epoch, startStateRoot, events };
  const finalStateRoot = stateRootOf(state);

  const marketSnapshot: MarketSnapshot = {
    epoch,
    predictedStateRoot,
    finalStateRoot,
    score: scorePrediction(predictedStateRoot, finalStateRoot),
  };

  const certificate = sealCertificate({
    certVersion: CERT_VERSION,
    epochNumber: epoch,
    previousExecutionDigest: prevCert
      ? prevCert.executionDigest
      : ZERO_DIGEST,
    executionPlanDigest: digestOf(plans.map((p) => p.planHash)),
    traceRoot: traceRootOf(trace),
    predictedStateRoot,
    finalStateRoot,
    marketRoot: marketRootOf(marketSnapshot),
    marketSnapshotDigest: marketSnapshotDigestOf(marketSnapshot),
    vmConfigHash: VM_CONFIG_HASH,
    kernelVersion: KERNEL_VERSION,
    frameCount: plans.length,
    tickCount: events.length,
  });

  return {
    artifacts: { plans, trace, marketSnapshot, certificate },
    finalState: state,
  };
}

// Run epochs 0..n-1 from Genesis, threading state and certificates.
export function runChain(epochPlans: ExecutionPlan[][]): EpochArtifacts[] {
  const chain: EpochArtifacts[] = [];
  let previous: PreviousEpoch | null = null;
  epochPlans.forEach((plans, epoch) => {
    const result = runEpoch(epoch, plans, previous);
    chain.push(result.artifacts);
    previous = {
      state: result.finalState,
      certificate: result.artifacts.certificate,
    };
  });
  return chain;
}
