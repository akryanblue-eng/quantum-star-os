import { strict as assert } from "assert";
import {
  ExecutionPlan,
  PlanBody,
  PlanStep,
  planHashOf,
} from "../contracts/execution_plan";
import { commitmentsOf, sealCertificate } from "../contracts/certificate";
import { canonicalize } from "../codec/canonical";
import { runChain, EpochArtifacts } from "../epoch/epoch_runner";
import { verifyFast, verifyFullReplay } from "../verifier/verifier";

function makePlan(
  epoch: number,
  planId: string,
  steps: [string, Record<string, string>][]
): ExecutionPlan {
  const body: PlanBody = {
    planId,
    sourceJobId: `job-${planId}`,
    epoch,
    steps: steps.map(([op, args], index): PlanStep => ({ index, op, args })),
  };
  return { ...body, planHash: planHashOf(body) };
}

const epochPlans: ExecutionPlan[][] = [
  [
    makePlan(0, "genesis-plan", [
      ["set", { key: "mission", value: "quantum-star" }],
      ["set", { key: "counter", value: "1" }],
    ]),
  ],
  [
    makePlan(1, "growth-plan", [
      ["append", { key: "mission", value: "-os" }],
      ["set", { key: "phase", value: "expansion" }],
      ["delete", { key: "counter" }],
    ]),
    makePlan(1, "audit-plan", [["noop", {}]]),
  ],
  [
    makePlan(2, "consolidation-plan", [
      ["set", { key: "phase", value: "consolidation" }],
      ["append", { key: "mission", value: "!" }],
    ]),
  ],
];

const clone = (chain: EpochArtifacts[]): EpochArtifacts[] =>
  JSON.parse(JSON.stringify(chain));

// ── Replay: two independent runs must produce byte-identical artifacts ──
const run1 = runChain(epochPlans);
const run2 = runChain(epochPlans);
assert.equal(
  canonicalize(run1),
  canonicalize(run2),
  "replay must be byte-for-byte identical"
);

// ── Fast verification: certificates only, no VM, no artifacts ──
const certs = run1.map((a) => a.certificate);
const fast = verifyFast(certs);
assert.equal(fast.accepted, true, JSON.stringify(fast.failures));
assert.equal(fast.mode, "fast");
assert.equal(fast.epochsVerified, 3);
assert.deepEqual(fast.gates, {
  lineageVerified: true,
  predictionVerified: true,
  marketVerified: false, // unchecked: no artifacts presented
  replayVerified: false, // never set in fast mode
});

// ── Fast verification with artifacts: binding checks light up market ──
const fastBound = verifyFast(certs, run1);
assert.equal(fastBound.accepted, true, JSON.stringify(fastBound.failures));
assert.equal(fastBound.gates.marketVerified, true);
assert.equal(fastBound.gates.replayVerified, false);

// ── Full replay: re-execute from Genesis, all gates pass ──
const full = verifyFullReplay(run1);
assert.equal(full.accepted, true, JSON.stringify(full.failures));
assert.deepEqual(full.gates, {
  lineageVerified: true,
  predictionVerified: true,
  marketVerified: true,
  replayVerified: true,
});

// ── Both chains are live in the artifacts, and they are orthogonal ──
assert.equal(
  certs[1].predictedStateRoot,
  certs[0].finalStateRoot,
  "prediction chain (causality)"
);
assert.equal(
  certs[1].previousExecutionDigest,
  certs[0].executionDigest,
  "lineage chain (integrity)"
);

// ── Crude tamper: edit a committed field → caught locally by digest ──
const crude = clone(run1);
crude[0].certificate.marketRoot = ("0x" + "ff".repeat(32)) as `0x${string}`;
const crudeReport = verifyFast(crude.map((a) => a.certificate));
assert.equal(crudeReport.accepted, false);
assert.ok(
  crudeReport.failures.some((f) => f.epoch === 0 && f.check === "execution-digest"),
  "tampered commitments must break the certificate's own digest"
);

// ── Consistent forgery: rewrite epoch 0's certificate AND reseal its
//    digests → internally valid, but lineage breaks at epoch 1 ──
const forged = clone(run1);
forged[0].certificate = sealCertificate({
  ...commitmentsOf(forged[0].certificate),
  marketRoot: ("0x" + "ff".repeat(32)) as `0x${string}`,
});
const forgedReport = verifyFast(forged.map((a) => a.certificate));
assert.ok(
  !forgedReport.failures.some((f) => f.epoch === 0 && f.check === "execution-digest"),
  "a resealed forgery is internally consistent"
);
assert.ok(
  forgedReport.failures.some((f) => f.epoch === 1 && f.check === "lineage"),
  "history rewriting must break lineage at the next epoch"
);
assert.equal(forgedReport.gates.lineageVerified, false);

// ── Trace tamper: caught by binding in fast mode, and by re-execution ──
const traceTampered = clone(run1);
traceTampered[1].trace.events[0].op = "delete";
assert.ok(
  verifyFast(traceTampered.map((a) => a.certificate), traceTampered)
    .failures.some((f) => f.epoch === 1 && f.check === "trace-root")
);

// ── Market score tamper: caught deterministically ──
const marketTampered = clone(run1);
marketTampered[2].marketSnapshot.score = 64;
assert.ok(
  verifyFast(marketTampered.map((a) => a.certificate), marketTampered)
    .failures.some((f) => f.epoch === 2 && f.check === "market-score")
);

console.log(
  "✅ replay: runs byte-identical; fast + full verification accept honest chains and reject tampering and forgery"
);
