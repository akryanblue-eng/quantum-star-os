// The Brain → Kernel boundary. An ExecutionPlan is the ONLY input the
// Causal Kernel accepts. Every field must be a concrete value: all
// nondeterminism (LLM sampling, wall-clock time, external lookups) is
// resolved on the Company Brain side before the plan is emitted.

export type StateRoot = `0x${string}`; // 32 bytes, lowercase hex, 64 chars

export const ZERO_ROOT: StateRoot =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type PlanStep = {
  index: number;
  op: string;
  // Fully resolved arguments — no references to anything outside the plan.
  args: Record<string, string | number | boolean>;
};

export type ExecutionPlan = {
  planId: string;
  // The Company Brain job this plan was derived from (ActionPlan.jobId).
  sourceJobId: string;
  epoch: number;
  steps: PlanStep[];
  // Hash of the canonical serialization of this plan, so certificates can
  // bind to the plan without embedding it.
  planHash: `0x${string}`;
};
