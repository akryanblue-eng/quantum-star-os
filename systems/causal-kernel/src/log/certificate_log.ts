import { appendFileSync, existsSync, readFileSync } from "fs";
import { ExecutionCertificate } from "../contracts/certificate";
import { Hex32, ZERO_DIGEST, canonicalize, digestOf, sha256Hex } from "../codec/canonical";
import { AcceptanceReport, verifyFast } from "../verifier/verifier";

// The append-only certificate log is the ONLY authoritative storage
// primitive (docs/STORAGE.md). One canonical-JSON certificate per line,
// strictly ordered by epoch, never overwritten, never deleted. Everything
// else — indexes, metrics, UI caches — is a derived view that can be
// rebuilt by scanning this file. If an index disappears, nothing is lost
// except performance.

export function appendCertificate(
  logPath: string,
  cert: ExecutionCertificate
): void {
  appendFileSync(logPath, canonicalize(cert) + "\n", "utf8");
}

export function readCertificateLog(logPath: string): ExecutionCertificate[] {
  if (!existsSync(logPath)) {
    return [];
  }
  return readFileSync(logPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ExecutionCertificate);
}

// Digest of the full certificate as logged (integrity fields included).
export function logEntryHash(cert: ExecutionCertificate): Hex32 {
  return digestOf(cert);
}

// Periodic checkpoint: a binary Merkle root over log entry hashes, so a
// massive log can be spot-checked against a single 32-byte commitment
// without walking every entry. Odd nodes are paired with themselves.
export function logMerkleRoot(entryHashes: Hex32[]): Hex32 {
  if (entryHashes.length === 0) {
    return ZERO_DIGEST;
  }
  let level = entryHashes;
  while (level.length > 1) {
    const next: Hex32[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256Hex(level[i] + (level[i + 1] ?? level[i])));
    }
    level = next;
  }
  return level[0];
}

// The streaming form of fast verification: scan the log from Genesis and
// walk the lineage + prediction chains. No index, no VM, no database —
// the log alone is sufficient to re-establish trust.
export function verifyLog(logPath: string): AcceptanceReport {
  return verifyFast(readCertificateLog(logPath));
}
