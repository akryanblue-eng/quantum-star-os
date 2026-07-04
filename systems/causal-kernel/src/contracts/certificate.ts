import { StateRoot } from "./execution_plan";
import { Hex32, digestOf } from "../codec/canonical";

export { ZERO_DIGEST } from "../codec/canonical";

// ExecutionCertificate v0.1 — a cryptographic MANIFEST, not a data
// container (docs/CERTIFICATE.md). It holds only digests and scalars that
// bind the heavy artifacts (plans, trace, market snapshot) together; the
// artifacts themselves live alongside it.
//
// Certificates are doubly chained, and the two chains are orthogonal:
//
//   1. Prediction chain (causality): predictedStateRoot(n) =
//      finalStateRoot(n − 1). Answers "did the system evolve causally?"
//   2. Lineage chain (integrity): previousExecutionDigest(n) =
//      executionDigest(n − 1), ZERO_DIGEST at Genesis. Answers "is the
//      recorded history intact?"
//
// Digest rules — one canonical hashing rule, no hand-picked field lists:
//
//   executionDigest   = SHA256(canonical(commitments))
//   certificateDigest = SHA256(canonical(commitments + executionDigest))
//
// where "commitments" is every field EXCEPT the self-referential ones
// (executionDigest, certificateDigest, signature). Adding a committed
// field automatically changes both digests.

export const CERT_VERSION = "0.1";

export type CertificateCommitments = {
  // Header
  certVersion: string;
  epochNumber: number;
  // Lineage
  previousExecutionDigest: Hex32;
  // Execution
  executionPlanDigest: Hex32;
  traceRoot: Hex32;
  predictedStateRoot: StateRoot;
  finalStateRoot: StateRoot;
  // Market
  marketRoot: Hex32;
  marketSnapshotDigest: Hex32;
  // Configuration
  vmConfigHash: Hex32;
  kernelVersion: string;
  // Statistics
  frameCount: number; // plans executed in the epoch
  tickCount: number;  // VM steps executed in the epoch
};

export type ExecutionCertificate = CertificateCommitments & {
  // Integrity (self-referential; excluded from their own preimages)
  executionDigest: Hex32;
  certificateDigest: Hex32;
  signature?: string;
};

// Extract exactly the committed fields, so digests are unaffected by any
// extra properties a deserializer might have attached.
export function commitmentsOf(
  cert: CertificateCommitments
): CertificateCommitments {
  return {
    certVersion: cert.certVersion,
    epochNumber: cert.epochNumber,
    previousExecutionDigest: cert.previousExecutionDigest,
    executionPlanDigest: cert.executionPlanDigest,
    traceRoot: cert.traceRoot,
    predictedStateRoot: cert.predictedStateRoot,
    finalStateRoot: cert.finalStateRoot,
    marketRoot: cert.marketRoot,
    marketSnapshotDigest: cert.marketSnapshotDigest,
    vmConfigHash: cert.vmConfigHash,
    kernelVersion: cert.kernelVersion,
    frameCount: cert.frameCount,
    tickCount: cert.tickCount,
  };
}

export function executionDigestOf(cert: CertificateCommitments): Hex32 {
  return digestOf(commitmentsOf(cert));
}

export function certificateDigestOf(cert: ExecutionCertificate): Hex32 {
  return digestOf({ ...commitmentsOf(cert), executionDigest: cert.executionDigest });
}

export function sealCertificate(
  commitments: CertificateCommitments
): ExecutionCertificate {
  const executionDigest = executionDigestOf(commitments);
  const sealed = { ...commitmentsOf(commitments), executionDigest };
  return { ...sealed, certificateDigest: digestOf(sealed) };
}
