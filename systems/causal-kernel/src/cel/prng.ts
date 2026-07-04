import { createHash } from "crypto";
import { Hex32 } from "../codec/canonical";

// The only randomness source permitted in kernel paths — nothing uses it
// yet (mutation is roadmap-gated), but when structural perturbation
// arrives it must draw from here, seeded by a committed digest (e.g. the
// previous epoch's executionDigest), so that "random" choices are exactly
// as replayable as everything else.
//
// SHA-256 counter construction: state = H(seed | domain), output n =
// H(state | n). Domain separation prevents two consumers seeded from the
// same digest from ever sharing a stream.

export class DeterministicRng {
  private readonly state: Buffer;
  private counter = 0;

  constructor(seed: Hex32, domain: string) {
    this.state = createHash("sha256")
      .update(seed, "utf8")
      .update("|", "utf8")
      .update(domain, "utf8")
      .digest();
  }

  nextU32(): number {
    const block = createHash("sha256")
      .update(this.state)
      .update(String(this.counter), "utf8")
      .digest();
    this.counter++;
    return block.readUInt32BE(0);
  }

  // Uniform in [0, n) via rejection sampling — no modulo bias.
  nextIntBelow(n: number): number {
    if (!Number.isSafeInteger(n) || n <= 0 || n > 0x100000000) {
      throw new Error(`CEL violation: nextIntBelow bound out of range: ${n}`);
    }
    const limit = Math.floor(0x100000000 / n) * n;
    for (;;) {
      const r = this.nextU32();
      if (r < limit) {
        return r % n;
      }
    }
  }
}
