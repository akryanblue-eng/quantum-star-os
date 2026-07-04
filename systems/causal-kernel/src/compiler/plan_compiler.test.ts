import { strict as assert } from "assert";
import {
  decisionEngine,
} from "../../../company-brain/src/core/decision/decision_engine";
import { UnderstandingOutput } from "../../../company-brain/src/core/understanding/llm_understand";
import { canonicalize } from "../codec/canonical";
import { runChain } from "../epoch/epoch_runner";
import { verifyFullReplay } from "../verifier/verifier";
import { compileExecutionPlan } from "./plan_compiler";

// End-to-end across the real boundary: Understanding → Decision Engine →
// compiled ExecutionPlan → EpochRunner → certificate → full replay. The
// LLM call is the one nondeterministic stage, so its output is a fixture:
// from that point on, everything must be bit-reproducible.

const understanding = (
  jobId: string,
  intent: string,
  tone: string,
  actions: string[],
  risks: string[]
): UnderstandingOutput => ({
  jobId,
  summary: `summary for ${jobId}`,
  intent,
  tone,
  key_entities: [],
  suggested_actions: actions,
  risk_flags: risks,
  raw_model_output: "{}",
});

const jobs: UnderstandingOutput[][] = [
  [
    understanding("job-001", "promote new release", "aggressive", [
      "promote on social",
      "draft lore tie-in",
      "package content",
      "schedule follow-up",
    ], []),
    understanding("job-002", "expand lore", "measured", ["draft lore"], []),
  ],
  [
    understanding("job-003", "promote quietly", "calm", [
      "small campaign",
      "notify partners",
    ], ["conflicting deadline"]),
  ],
];

// Compilation is a pure function: same ActionPlan + epoch → same hash.
const probe = decisionEngine(jobs[0][0]);
assert.equal(
  compileExecutionPlan(probe, 0).planHash,
  compileExecutionPlan(probe, 0).planHash
);
assert.notEqual(
  compileExecutionPlan(probe, 0).planHash,
  compileExecutionPlan(probe, 1).planHash,
  "epoch is part of plan identity"
);

// Full pipeline, twice, from the same fixtures.
const compileEpoch = (epoch: number) =>
  jobs[epoch].map((u) => compileExecutionPlan(decisionEngine(u), epoch));
const runA = runChain([compileEpoch(0), compileEpoch(1)]);
const runB = runChain([compileEpoch(0), compileEpoch(1)]);
assert.equal(
  canonicalize(runA),
  canonicalize(runB),
  "Brain-derived epochs must replay byte-for-byte"
);

const report = verifyFullReplay(runA);
assert.equal(report.accepted, true, JSON.stringify(report.failures));
assert.deepEqual(report.gates, {
  lineageVerified: true,
  predictionVerified: true,
  marketVerified: true,
  replayVerified: true,
});

// The decisions actually landed in kernel state via the trace.
const allOps = runA.flatMap((a) => a.trace.events.map((e) => e.op));
assert.ok(allOps.every((op) => op === "set"));
assert.equal(runA[0].certificate.frameCount, 2);
assert.equal(runA[1].certificate.frameCount, 1);

console.log(
  "✅ brain→kernel: decision engine output compiles to deterministic plans; end-to-end replay verified"
);
