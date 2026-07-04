import { StateRoot } from "./execution_plan";

// An Execution Certificate is the kernel's proof artifact for one epoch.
// It binds the plans executed, the trace produced, and the state-root
// transition into a single verifiable record. Certificates chain: each
// epoch's predictedStateRoot is the previous epoch's finalStateRoot
// (see docs/GENESIS.md).

export type ExecutionCertificate = {
  epoch: number;
  planHashes: `0x${string}`[];
  traceHash: `0x${string}`;
  predictedStateRoot: StateRoot;
  finalStateRoot: StateRoot;
  // Deterministic market score of prediction quality for this epoch.
  marketScore: number;
};
