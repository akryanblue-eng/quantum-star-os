import { strict as assert } from "assert";
import { canonicalize, digestOf } from "../codec/canonical";
import { DeterministicMap } from "./deterministic_map";
import {
  fpAdd,
  fpDiv,
  fpFromDecimalString,
  fpFromInt,
  fpMul,
  fpToDecimalString,
} from "./fixed_point";
import { DeterministicRng } from "./prng";
import { celAssert } from "./guard";
import { newKernelState, stateRootOf, applyStep } from "../vm/vm";

// ── Canonical JSON: ordering, normalization, dense output ──
assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');

// Key order is UTF-8 bytewise, not UTF-16 code units: U+FF61 encodes as
// EF BD A1, U+10000 as F0 90 80 80, so UTF-8 puts U+FF61 first while
// UTF-16 comparison (0xFF61 vs surrogate 0xD800) would reverse them.
const utf8Order = canonicalize({ "\u{10000}": 1, "｡": 2 });
assert.ok(
  utf8Order.indexOf("｡") < utf8Order.indexOf("\u{10000}"),
  "keys must sort by UTF-8 bytes"
);

// NFC: decomposed é (e + combining acute) digests identically to composed é.
assert.equal(digestOf("café"), digestOf("café"));
assert.equal(digestOf({ "café": 1 }), digestOf({ "café": 1 }));
assert.throws(
  () => canonicalize({ "café": 1, "café": 2 }),
  /collide after NFC/
);

// ── Tripwires: violations crash, never sanitize ──
assert.throws(() => canonicalize(0.5), /float/i);
assert.throws(() => canonicalize(NaN));
assert.throws(() => canonicalize(Infinity));
assert.throws(() => canonicalize(10n), /bigint/);
assert.throws(() => canonicalize(undefined));
assert.throws(() => canonicalize(new Date(0)), /Date/);
assert.throws(() => canonicalize(new Map()), /Map/);
assert.throws(() => canonicalize(new Set()), /Set/);
class NotPlain {
  x = 1;
}
assert.throws(() => canonicalize(new NotPlain()), /plain objects/);
assert.throws(() => canonicalize({ nested: { deep: [1, 2, 0.5] } }));
assert.throws(
  () => celAssert("trace-frame", { t: new Date(0) }),
  /\[CEL VIOLATION:trace-frame\]/
);

// ── DeterministicMap: iteration order independent of insertion order ──
const m1 = new DeterministicMap<number>();
m1.set("b", 2);
m1.set("a", 1);
const m2 = new DeterministicMap<number>();
m2.set("a", 1);
m2.set("b", 2);
assert.equal(canonicalize(m1.entries()), canonicalize(m2.entries()));
assert.deepEqual(m1.entries(), [["a", 1], ["b", 2]]);
m1.delete("a");
assert.equal(m1.size, 1);
const m3 = m2.clone();
m3.set("c", 3);
assert.equal(m2.size, 2, "clone must not alias the original");

// VM state roots are insertion-order invariant end to end.
const s1 = newKernelState();
applyStep(s1, { index: 0, op: "set", args: { key: "x", value: "1" } });
applyStep(s1, { index: 1, op: "set", args: { key: "y", value: "2" } });
const s2 = newKernelState();
applyStep(s2, { index: 0, op: "set", args: { key: "y", value: "2" } });
applyStep(s2, { index: 1, op: "set", args: { key: "x", value: "1" } });
assert.equal(stateRootOf(s1), stateRootOf(s2));

// ── Fixed point: exact arithmetic, exact decimal round-trip, traps ──
const half = fpFromDecimalString("0.5");
const three = fpFromInt(3);
assert.equal(fpToDecimalString(fpAdd(half, half)), "1");
assert.equal(fpToDecimalString(fpMul(half, three)), "1.5");
assert.equal(fpToDecimalString(fpDiv(three, fpFromInt(2))), "1.5");
assert.equal(fpFromDecimalString(fpToDecimalString(fpMul(half, half))), fpMul(half, half));
assert.equal(fpToDecimalString(fpFromDecimalString("-2.25")), "-2.25");
assert.throws(() => fpFromDecimalString("0.1"), /not exactly representable/);
assert.throws(() => fpDiv(fpFromInt(1), 0n), /division by zero/);
assert.throws(() => fpMul(fpFromInt(2 ** 31), fpFromInt(2 ** 31)), /overflow/);

// ── PRNG: seed-determined, domain-separated ──
const seed = digestOf("epoch-0");
const rngA = new DeterministicRng(seed, "mutation");
const rngB = new DeterministicRng(seed, "mutation");
const rngC = new DeterministicRng(seed, "selection");
const seqA = [rngA.nextU32(), rngA.nextU32(), rngA.nextU32()];
const seqB = [rngB.nextU32(), rngB.nextU32(), rngB.nextU32()];
assert.deepEqual(seqA, seqB, "same seed + domain → same stream");
assert.notDeepEqual(seqA, [rngC.nextU32(), rngC.nextU32(), rngC.nextU32()]);
const draw = new DeterministicRng(seed, "draw");
for (let i = 0; i < 100; i++) {
  const v = draw.nextIntBelow(7);
  assert.ok(v >= 0 && v < 7);
}

console.log("✅ cel: canonical codec hardened; deterministic map, fixed point, prng, guard all verified");
