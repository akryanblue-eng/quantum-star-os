import { strict as assert } from "assert";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  ExecutionPlan,
  PlanBody,
  planHashOf,
} from "../contracts/execution_plan";
import { ZERO_DIGEST, canonicalize } from "../codec/canonical";
import { runChain } from "../epoch/epoch_runner";
import {
  appendCertificate,
  logEntryHash,
  logMerkleRoot,
  readCertificateLog,
  verifyLog,
} from "./certificate_log";

function makePlan(epoch: number, planId: string): ExecutionPlan {
  const body: PlanBody = {
    planId,
    sourceJobId: `job-${planId}`,
    epoch,
    steps: [{ index: 0, op: "set", args: { key: planId, value: "x" } }],
  };
  return { ...body, planHash: planHashOf(body) };
}

const chain = runChain([
  [makePlan(0, "p0")],
  [makePlan(1, "p1")],
  [makePlan(2, "p2")],
]);
const certs = chain.map((a) => a.certificate);

const dir = mkdtempSync(join(tmpdir(), "cert-log-"));
const logPath = join(dir, "certificates.cjsonl");

// ── Empty log: valid, empty, zero checkpoint ──
assert.deepEqual(readCertificateLog(logPath), []);
assert.equal(logMerkleRoot([]), ZERO_DIGEST);

// ── Append-only write path, lossless canonical round-trip ──
certs.forEach((cert) => appendCertificate(logPath, cert));
const replayed = readCertificateLog(logPath);
assert.equal(canonicalize(replayed), canonicalize(certs));

// ── Streaming fast verification over the log alone: no index, no VM ──
const report = verifyLog(logPath);
assert.equal(report.accepted, true, JSON.stringify(report.failures));
assert.equal(report.epochsVerified, 3);
assert.equal(report.gates.lineageVerified, true);
assert.equal(report.gates.predictionVerified, true);

// ── Entry hashes and Merkle checkpoints are deterministic ──
const hashes = replayed.map(logEntryHash);
assert.deepEqual(hashes, certs.map(logEntryHash));
const root = logMerkleRoot(hashes);
assert.equal(root, logMerkleRoot(certs.map(logEntryHash)));
assert.notEqual(root, logMerkleRoot(hashes.slice(0, 2)));
assert.notEqual(root, logMerkleRoot([...hashes].reverse()));

// ── A tampered log fails the streaming walk ──
const tamperedPath = join(dir, "tampered.cjsonl");
appendCertificate(tamperedPath, certs[0]);
appendCertificate(tamperedPath, {
  ...certs[1],
  previousExecutionDigest: ZERO_DIGEST,
});
const tamperedReport = verifyLog(tamperedPath);
assert.equal(tamperedReport.accepted, false);
assert.ok(
  tamperedReport.failures.some((f) => f.epoch === 1 && f.check === "lineage")
);

console.log("✅ certificate log: append-only round-trip, streaming verification, merkle checkpoints");
