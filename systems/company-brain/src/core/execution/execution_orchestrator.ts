import { ActionPlan } from "../decision/decision_engine";

export type ExecutionResult = {
  jobId: string;
  status: "completed" | "failed" | "partial";
  outputs: string[];
  sideEffects: string[];
  timestamp: string;
};

export async function executionOrchestrator(
  plan: ActionPlan
): Promise<ExecutionResult> {
  console.log("⚡ Executing Action Plan:", plan.jobId);
  const outputs: string[] = [];
  const sideEffects: string[] = [];

  try {
    // 🟢 EXECUTE MODE
    if (plan.strategy === "execute") {
      for (const action of plan.actions) {
        const result = await executeAction(action, plan.jobId);
        outputs.push(result);
      }
      sideEffects.push("execution_complete");
    }
    // 🟡 REFINE MODE
    else if (plan.strategy === "refine") {
      const refined = await refinePlan(plan);
      outputs.push(refined);
      sideEffects.push("refinement_triggered");
    }
    // 🔴 HOLD MODE
    else if (plan.strategy === "hold") {
      sideEffects.push("job_on_hold");
    }
    // 🟠 ESCALATE MODE
    else if (plan.strategy === "escalate") {
      await escalateJob(plan);
      sideEffects.push("escalation_sent");
    }

    return {
      jobId: plan.jobId,
      status: "completed",
      outputs,
      sideEffects,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      jobId: plan.jobId,
      status: "failed",
      outputs,
      sideEffects: [err.message],
      timestamp: new Date().toISOString(),
    };
  }
}

async function executeAction(action: string, jobId: string): Promise<string> {
  console.log(`🚀 Executing action for ${jobId}: ${action}`);
  // Simulated real-world effects (expand later)
  if (action.includes("promote")) {
    return `Generated promotional asset for: ${jobId}`;
  }
  if (action.includes("lore")) {
    return `Generated lore expansion for: ${jobId}`;
  }
  if (action.includes("content")) {
    return `Created content package for: ${jobId}`;
  }
  return `Executed generic action: ${action}`;
}

async function refinePlan(plan: ActionPlan): Promise<string> {
  return `Refinement requested for job ${plan.jobId} due to low confidence or ambiguity.`;
}

async function escalateJob(plan: ActionPlan): Promise<string> {
  console.log(`⚠️ Escalating job ${plan.jobId} for review layer`);
  return `Job ${plan.jobId} escalated to higher-level review system.`;
}
