import {
  ExecutionPlan,
  PlanBody,
  PlanStep,
  planHashOf,
} from "../contracts/execution_plan";

// The Brain → Kernel compiler. This is the LAST point where Brain
// concepts (strategy, confidence, actions) exist; everything below this
// line speaks only the kernel contract. All nondeterminism must already
// be resolved: the input is the Decision Engine's finished ActionPlan,
// and compilation itself is a pure function — same ActionPlan + epoch in,
// bit-identical ExecutionPlan out.
//
// BrainActionPlan structurally matches company-brain's ActionPlan
// (src/core/decision/decision_engine.ts), so the Brain can call this
// without the kernel ever importing Brain code — the dependency arrow
// stays Brain → Kernel.

export type BrainActionPlan = {
  jobId: string;
  strategy: "execute" | "refine" | "hold" | "escalate";
  confidence: number;
  actions: string[];
  execution_mode: "single" | "multi_step" | "pipeline";
  notes: string;
};

export function compileExecutionPlan(
  plan: BrainActionPlan,
  epoch: number
): ExecutionPlan {
  // CEL boundary rule: Brain strings are NFC-normalized here, so that
  // in-memory plans are byte-identical to their canonical serialization
  // and no Unicode composition variance ever reaches kernel state.
  const nfc = (s: string) => s.normalize("NFC");
  const jobId = nfc(plan.jobId);
  const steps: PlanStep[] = [];
  const push = (op: string, args: Record<string, string>) =>
    steps.push({ index: steps.length, op, args });
  const base = `job/${jobId}`;

  push("set", { key: `${base}/strategy`, value: plan.strategy });
  // Floats are banned from canonical form; confidence crosses the
  // boundary as integer basis points.
  push("set", {
    key: `${base}/confidence_bp`,
    value: String(Math.round(plan.confidence * 10000)),
  });

  switch (plan.strategy) {
    case "execute":
      plan.actions.forEach((action, i) =>
        push("set", { key: `${base}/action/${i}`, value: nfc(action) })
      );
      push("set", { key: `${base}/status`, value: "executed" });
      break;
    case "refine":
      push("set", { key: `${base}/status`, value: "refining" });
      push("set", { key: `${base}/refine_reason`, value: nfc(plan.notes) });
      break;
    case "hold":
      push("set", { key: `${base}/status`, value: "held" });
      break;
    case "escalate":
      push("set", { key: `${base}/status`, value: "escalated" });
      push("set", { key: `${base}/escalation_note`, value: nfc(plan.notes) });
      break;
  }

  const body: PlanBody = {
    // Deterministic identity — no timestamps, no UUIDs.
    planId: `${jobId}@${epoch}`,
    sourceJobId: jobId,
    epoch,
    steps,
  };
  return { ...body, planHash: planHashOf(body) };
}
