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

// On byte mismatch, walk recorded vs regenerated down to the first
// divergent artifact — epoch → part → trace frame / certificate field —
// so a failure names its layer instead of just existing.
export function locateFirstDivergence(
  recorded: EpochArtifacts[],
  regenerated: EpochArtifacts[]
): string | null {
  const eq = (a: unknown, b: unknown) =>
    canonicalize(a ?? null) === canonicalize(b ?? null);
  for (let i = 0; i < Math.max(recorded.length, regenerated.length); i++) {
    const a = recorded[i];
    const b = regenerated[i];
    if (!a || !b) {
      return `epoch ${i}: present in only one run`;
    }
    const parts = ["plans", "trace", "marketSnapshot", "certificate"] as const;
    for (const part of parts) {
      if (eq(a[part], b[part])) {
        continue;
      }
      if (part === "trace") {
        const [ea, eb] = [a.trace.events, b.trace.events];
        for (let j = 0; j < Math.max(ea.length, eb.length); j++) {
          if (!eq(ea[j], eb[j])) {
            return `epoch ${i}: trace event ${j} diverges first`;
          }
        }
        return `epoch ${i}: trace start root or shape diverges`;
      }
      if (part === "certificate") {
        const [ca, cb] = [a.certificate, b.certificate] as [
          Record<string, unknown>,
          Record<string, unknown>
        ];
        for (const k of Object.keys(ca).sort()) {
          if (!eq(ca[k], cb[k])) {
            return `epoch ${i}: certificate.${k} diverges first`;
          }
        }
      }
      return `epoch ${i}: ${part} diverges first`;
    }
  }
  return null;
}

export function verifyBundleDir(dir: string): boolean {
  const recordedBytes = readFileSync(join(dir, "bundle.cjson"), "utf8");
  const recorded = JSON.parse(recordedBytes) as EpochArtifacts[];

  // A tampered plan is rejected by the kernel at ingestion (hash check);
  // that is a verdict, not a crash — report it as one.
  let regenerated: EpochArtifacts[] | null = null;
  let regenError: string | null = null;
  try {
    regenerated = runChain(recorded.map((a) => a.plans));
  } catch (err) {
    regenError = err instanceof Error ? err.message : String(err);
  }
  const bytesMatch =
    regenerated !== null && canonicalize(regenerated) + "\n" === recordedBytes;

  const rootsMatch =
    regenerated !== null &&
    rootsOf(regenerated) === readFileSync(join(dir, "roots.cjson"), "utf8");

  const report = verifyFullReplay(recorded);
  const logReport = verifyLog(join(dir, "certificates.cjsonl"));

  const line = (label: string, ok: boolean) =>
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  console.log(`machine: node ${process.version} ${process.platform}/${process.arch}`);
  line("bundle byte equality (re-executed vs recorded)", bytesMatch);
  if (!bytesMatch) {
    console.log(
      `  · first divergence: ${
        regenError
          ? `re-execution rejected recorded plans — ${regenError}`
          : locateFirstDivergence(recorded, regenerated!)
      }`
    );
  }
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
