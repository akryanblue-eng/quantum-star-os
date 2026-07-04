import { StateRoot } from "../contracts/execution_plan";
import { Hex32, digestOf } from "../codec/canonical";

// A Trace is the append-only record of one epoch's execution: the state
// root before the epoch, then one event per executed step with the state
// root after it. The trace root is a digest over the whole trace and is
// what the certificate binds to.

export type TraceEvent = {
  planId: string;
  stepIndex: number;
  op: string;
  stateRootAfter: StateRoot;
};

export type Trace = {
  epoch: number;
  startStateRoot: StateRoot;
  events: TraceEvent[];
};

export function traceRootOf(trace: Trace): Hex32 {
  return digestOf(trace);
}
