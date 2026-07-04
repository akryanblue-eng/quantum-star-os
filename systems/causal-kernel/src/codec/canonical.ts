import { createHash } from "crypto";

// The Canonical Execution Layer's serialization core: every digest in the
// kernel (plan hashes, trace roots, market roots, certificate lineage
// digests) is SHA-256 over this encoding. Two artifacts are equal if and
// only if their canonical bytes are equal, which is what makes
// byte-for-byte replay comparison possible — across processes and
// machines, not just within one run.
//
// Rules (violations throw — determinism is binary, never sanitized):
//   - object keys sorted by UTF-8 bytewise lexicographic order
//   - strings normalized to NFC before encoding
//   - integers only; floats, NaN, and Infinity are banned
//   - bigint is banned from canonical form: values beyond the safe
//     integer range would silently lose precision on JSON.parse, breaking
//     the log's lossless round-trip. Encode them as decimal strings
//     (see cel/fixed_point).
//   - plain objects and arrays only: Date, Map, Set, class instances,
//     functions, and undefined are all trapped, not skipped
//   - dense output, no whitespace

export type Hex32 = `0x${string}`; // 32 bytes, lowercase hex, 64 chars

export const ZERO_DIGEST: Hex32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export function compareUtf8(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `CEL violation: non-integer number ${value} (floats, NaN, Infinity banned; encode fixed-point as decimal strings)`
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") {
    throw new Error(
      "CEL violation: bigint cannot be committed directly — encode as a decimal string (cel/fixed_point)"
    );
  }
  if (typeof value === "string") {
    return JSON.stringify(value.normalize("NFC"));
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    if (value instanceof Date || value instanceof Map || value instanceof Set) {
      throw new Error(
        `CEL violation: ${value.constructor.name} is not canonicalizable`
      );
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(
        "CEL violation: only plain objects can be canonicalized"
      );
    }
    const record = value as Record<string, unknown>;
    const pairs = Object.keys(record)
      .map((k): [string, string] => [k.normalize("NFC"), k])
      .sort(([a], [b]) => compareUtf8(a, b));
    for (let i = 1; i < pairs.length; i++) {
      if (pairs[i][0] === pairs[i - 1][0]) {
        throw new Error(
          `CEL violation: keys "${pairs[i - 1][1]}" and "${pairs[i][1]}" collide after NFC normalization`
        );
      }
    }
    return (
      "{" +
      pairs
        .map(([nfc, orig]) => JSON.stringify(nfc) + ":" + canonicalize(record[orig]))
        .join(",") +
      "}"
    );
  }
  throw new Error(`CEL violation: cannot canonicalize value of type ${typeof value}`);
}

export function sha256Hex(input: string): Hex32 {
  return ("0x" +
    createHash("sha256").update(input, "utf8").digest("hex")) as Hex32;
}

export function digestOf(value: unknown): Hex32 {
  return sha256Hex(canonicalize(value));
}
