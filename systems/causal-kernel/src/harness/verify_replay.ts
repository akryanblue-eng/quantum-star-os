import { readFileSync } from "fs";
import { join } from "path";
import { canonicalize } from "../codec/canonical";
import { runChain, EpochArtifacts } from "../epoch/epoch_runner";
import { verifyFullReplay } from "../verifier/verifier";
import { verifyLog } from "../log/certificate_log";
import { rootsOf } from "./run_chain";

// Machine B of the cross-machine replay protocol: take a bundle produced
// elsewhere, re-execute the chain from Genesis on THIS machine, and
// demand byte equality. Three checks, three distinct failure meanings
// (docs/CROSS_MACHINE_PROTOCOL.md):
//   bundle bytes   — full artifact equality (the coin flip itself)
//   roots          — narrows a mismatch to trace / market / state / lineage
//   verifier gates — internal consistency independent of re-execution

export function verifyBundleDir(dir: string): boolean {
  const recordedBytes = readFileSync(join(dir, "bundle.cjson"), "utf8");
  const recorded = JSON.parse(recordedBytes) as EpochArtifacts[];

  const regenerated = runChain(recorded.map((a) => a.plans));
  const bytesMatch = canonicalize(regenerated) + "\n" === recordedBytes;

  const rootsMatch =
    rootsOf(regenerated) === readFileSync(join(dir, "roots.cjson"), "utf8");

  const report = verifyFullReplay(recorded);
  const logReport = verifyLog(join(dir, "certificates.cjsonl"));

  const line = (label: string, ok: boolean) =>
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`machine: node ${process.version} ${process.platform}/${process.arch}`);
  line("bundle byte equality (re-executed vs recorded)", bytesMatch);
  line("roots equality (trace/market/state/lineage)", rootsMatch);
  line(`full replay verification (${report.epochsVerified} epochs)`, report.accepted);
  line("certificate log streaming verification", logReport.accepted);
  for (const f of [...report.failures, ...logReport.failures]) {
    console.log(`  · epoch ${f.epoch} [${f.check}] ${f.message}`);
  }

  return bytesMatch && rootsMatch && report.accepted && logReport.accepted;
}

if (require.main === module) {
  const dir = process.argv[2] ?? "replay-artifacts";
  const ok = verifyBundleDir(dir);
  console.log(ok ? "REPLAY OK" : "REPLAY DIVERGED");
  process.exit(ok ? 0 : 1);
}
