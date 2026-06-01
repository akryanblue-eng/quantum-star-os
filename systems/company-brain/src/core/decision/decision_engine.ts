import { UnderstandingOutput } from "../understanding/llm_understand";

export type ActionPlan = {
  jobId: string;
  strategy: "execute" | "refine" | "hold" | "escalate";
  confidence: number;
  actions: string[];
  execution_mode: "single" | "multi_step" | "pipeline";
  notes: string;
};

export function decisionEngine(
  u: UnderstandingOutput
): ActionPlan {
  let strategy: ActionPlan["strategy"] = "execute";
  let confidence = 0.75;

  // 🚨 Risk logic
  if (u.risk_flags.length > 0) {
    strategy = "refine";
    confidence -= 0.2;
  }

  // 🎯 Aggressive intent detection
  if (
    u.intent.toLowerCase().includes("promote") &&
    u.tone.toLowerCase().includes("aggressive")
  ) {
    strategy = "execute";
    confidence += 0.15;
  }

  // 🧠 Ambiguity handling
  if (u.suggested_actions.length < 2) {
    strategy = "refine";
    confidence -= 0.1;
  }

  // 📦 Execution mode selection
  let execution_mode: ActionPlan["execution_mode"] = "single";
  if (u.suggested_actions.length > 3) {
    execution_mode = "pipeline";
  } else if (u.suggested_actions.length > 1) {
    execution_mode = "multi_step";
  }

  // 🧭 Final normalization
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    jobId: u.jobId,
    strategy,
    confidence,
    actions: u.suggested_actions,
    execution_mode,
    notes: `Derived from semantic intent: ${u.intent}`,
  };
}
