import { createHash } from "crypto";

// Canonical serialization: every digest in the kernel (plan hashes, trace
// roots, market roots, certificate lineage digests) is SHA-256 over this
// encoding. Two artifacts are equal if and only if their canonical bytes
// are equal, which is what makes byte-for-byte replay comparison possible.
//
// Rules: JSON with object keys sorted lexicographically, arrays in order,
// integers only (floats are banned — they are a determinism hazard across
// platforms), no undefined, no NaN.

export type Hex32 = `0x${string}`; // 32 bytes, lowercase hex, 64 chars

export const ZERO_DIGEST: Hex32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Non-integer number in canonical form: ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalize(record[k]))
        .join(",") +
      "}"
    );
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

export function sha256Hex(input: string): Hex32 {
  return ("0x" +
    createHash("sha256").update(input, "utf8").digest("hex")) as Hex32;
}

export function digestOf(value: unknown): Hex32 {
  return sha256Hex(canonicalize(value));
}
