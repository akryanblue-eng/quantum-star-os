import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { canonicalize, digestOf } from "../codec/canonical";
import { runChain, EpochArtifacts } from "../epoch/epoch_runner";
import { appendCertificate, logEntryHash, logMerkleRoot } from "../log/certificate_log";
import { buildFixturePlans } from "./fixture_chain";

// Machine A of the cross-machine replay protocol
// (docs/CROSS_MACHINE_PROTOCOL.md): execute the reference chain, write
// canonical artifacts to disk. No logging system, no DB, no daemon —
// just files whose bytes either match on machine B or don't.

export function rootsOf(chain: EpochArtifacts[]): string {
  const certs = chain.map((a) => a.certificate);
  return (
    canonicalize({
      epochs: certs.map((c) => ({
        epochNumber: c.epochNumber,
        traceRoot: c.traceRoot,
        marketRoot: c.marketRoot,
        finalStateRoot: c.finalStateRoot,
        executionDigest: c.executionDigest,
      })),
      bundleDigest: digestOf(chain),
      logMerkleRoot: logMerkleRoot(certs.map(logEntryHash)),
    }) + "\n"
  );
}

export function writeBundle(outDir: string, chain: EpochArtifacts[]): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "bundle.cjson"), canonicalize(chain) + "\n");
  const logPath = join(outDir, "certificates.cjsonl");
  rmSync(logPath, { force: true });
  chain.forEach((a) => appendCertificate(logPath, a.certificate));
  writeFileSync(join(outDir, "roots.cjson"), rootsOf(chain));
}

if (require.main === module) {
  const outDir = process.argv[2] ?? "replay-artifacts";
  const chain = runChain(buildFixturePlans());
  writeBundle(outDir, chain);
  console.log(`machine: node ${process.version} ${process.platform}/${process.arch}`);
  console.log(`epochs: ${chain.length}`);
  console.log(`bundleDigest: ${digestOf(chain)}`);
  console.log(`wrote ${outDir}/{bundle.cjson, certificates.cjsonl, roots.cjson}`);
}
