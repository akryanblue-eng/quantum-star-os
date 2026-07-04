import { decisionEngine } from "../../../company-brain/src/core/decision/decision_engine";
import { UnderstandingOutput } from "../../../company-brain/src/core/understanding/llm_understand";
import { ExecutionPlan } from "../contracts/execution_plan";
import { compileExecutionPlan } from "../compiler/plan_compiler";

// The deterministic reference workload for cross-environment replay:
// fixtured Brain understanding (the LLM stage is the one legitimately
// nondeterministic input) driven through the REAL decision engine and
// plan compiler. Any machine that runs this must produce byte-identical
// artifacts. The decomposed-Unicode action below ("café") is
// deliberate: it proves NFC normalization at the compiler boundary.

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

const EPOCH_JOBS: UnderstandingOutput[][] = [
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
    understanding("job-004", "promote café launch", "aggressive", [
      "promote café event",
      "content for café menu",
      "lore crossover",
      "press outreach",
    ], []),
  ],
  [
    understanding("job-005", "consolidate content", "measured", [
      "archive assets",
      "summarize outcomes",
      "plan next cycle",
    ], []),
  ],
];

export function buildFixturePlans(): ExecutionPlan[][] {
  return EPOCH_JOBS.map((jobs, epoch) =>
    jobs.map((u) => compileExecutionPlan(decisionEngine(u), epoch))
  );
}
