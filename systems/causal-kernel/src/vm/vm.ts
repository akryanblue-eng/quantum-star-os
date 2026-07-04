import { PlanStep, StateRoot, ZERO_ROOT } from "../contracts/execution_plan";
import { Hex32, digestOf } from "../codec/canonical";

// The deterministic state machine. State is a flat string→string map; the
// state root is a digest over its sorted entries. No clock, no network,
// no randomness — a step's effect is a pure function of (state, step).

// The VM's semantics, committed into every certificate as vmConfigHash: a
// replay is only valid against the exact VM that produced the artifacts.
export const VM_CONFIG = {
  stateModel: "kv-string-v1",
  ops: ["append", "delete", "noop", "set"],
};
export const VM_CONFIG_HASH: Hex32 = digestOf(VM_CONFIG);

export type KernelState = Map<string, string>;

export function stateRootOf(state: KernelState): StateRoot {
  // The empty state commits to ZERO_ROOT so that Genesis's prediction,
  // pre-state commitment, and trace start root are all the same value
  // (docs/GENESIS.md).
  if (state.size === 0) {
    return ZERO_ROOT;
  }
  const entries = [...state.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return digestOf(entries) as StateRoot;
}

export function applyStep(state: KernelState, step: PlanStep): void {
  switch (step.op) {
    case "set": {
      state.set(requireString(step, "key"), requireString(step, "value"));
      return;
    }
    case "append": {
      const key = requireString(step, "key");
      state.set(key, (state.get(key) ?? "") + requireString(step, "value"));
      return;
    }
    case "delete": {
      state.delete(requireString(step, "key"));
      return;
    }
    case "noop": {
      return;
    }
    default:
      throw new Error(`Unknown op "${step.op}" at step ${step.index}`);
  }
}

function requireString(step: PlanStep, arg: string): string {
  const value = step.args[arg];
  if (typeof value !== "string") {
    throw new Error(
      `Step ${step.index} (${step.op}): arg "${arg}" must be a string`
    );
  }
  return value;
}
