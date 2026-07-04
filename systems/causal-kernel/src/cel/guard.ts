import { canonicalize } from "../codec/canonical";

// The runtime tripwire. The codec itself is the enforcement mechanism —
// canonicalize() throws on floats, bigints, Dates, Maps, Sets, class
// instances, undefined, and NFC key collisions — so guarding a value
// means proving it canonicalizes. Violations always crash, never warn:
// determinism is binary.

export function celAssert(label: string, value: unknown): void {
  try {
    canonicalize(value);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[CEL VIOLATION:${label}] ${message}`);
  }
}
