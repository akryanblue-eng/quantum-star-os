// Q32.32 signed fixed-point over bigint: the only arithmetic permitted
// for future fractional quantities (market weights, scores, pressures).
// Floats are banned from the kernel entirely.
//
// Canonical-form boundary rule: fixed-point values enter artifacts as
// exact DECIMAL STRINGS (fpToDecimalString), never as raw bigints —
// bigints beyond 2^53 would silently lose precision on JSON.parse and
// break the certificate log's lossless round-trip.
//
// Rounding is defined, not incidental: fpMul floors (toward −∞, bigint
// >>); fpDiv truncates toward zero (bigint /). Every operation traps on
// overflow of the signed 64-bit range.

const FRACTION_BITS = 32n;
export const FP_SCALE = 1n << FRACTION_BITS;
const FP_MIN = -(1n << 63n);
const FP_MAX = (1n << 63n) - 1n;
const POW5_32 = 5n ** 32n;

export type Fixed = bigint;

function trap(x: bigint): Fixed {
  if (x < FP_MIN || x > FP_MAX) {
    throw new Error("CEL violation: fixed-point overflow");
  }
  return x;
}

export function fpFromInt(n: number): Fixed {
  if (!Number.isSafeInteger(n)) {
    throw new Error(`CEL violation: fpFromInt requires an integer, got ${n}`);
  }
  return trap(BigInt(n) << FRACTION_BITS);
}

export function fpAdd(a: Fixed, b: Fixed): Fixed {
  return trap(a + b);
}

export function fpSub(a: Fixed, b: Fixed): Fixed {
  return trap(a - b);
}

export function fpMul(a: Fixed, b: Fixed): Fixed {
  return trap((a * b) >> FRACTION_BITS);
}

export function fpDiv(a: Fixed, b: Fixed): Fixed {
  if (b === 0n) {
    throw new Error("CEL violation: fixed-point division by zero");
  }
  return trap((a << FRACTION_BITS) / b);
}

// Exact decimal encoding: frac/2^32 = frac·5^32/10^32, so at most 32
// fractional digits, no rounding ever.
export function fpToDecimalString(x: Fixed): string {
  const neg = x < 0n;
  const v = neg ? -x : x;
  const whole = v >> FRACTION_BITS;
  const frac = v & (FP_SCALE - 1n);
  const sign = neg ? "-" : "";
  if (frac === 0n) {
    return `${sign}${whole}`;
  }
  const digits = (frac * POW5_32)
    .toString()
    .padStart(32, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}.${digits}`;
}

export function fpFromDecimalString(s: string): Fixed {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!match) {
    throw new Error(`CEL violation: not a decimal string: "${s}"`);
  }
  const [, sign, wholePart, fracPart = ""] = match;
  const pow10 = 10n ** BigInt(fracPart.length);
  const fracNum = fracPart === "" ? 0n : BigInt(fracPart);
  const scaledFrac = fracNum << FRACTION_BITS;
  if (scaledFrac % pow10 !== 0n) {
    throw new Error(
      `CEL violation: "${s}" is not exactly representable in Q32.32`
    );
  }
  const magnitude = (BigInt(wholePart) << FRACTION_BITS) + scaledFrac / pow10;
  return trap(sign === "-" ? -magnitude : magnitude);
}
