// Canonical Execution Layer — the single import surface for every
// determinism primitive. Nothing above this layer may introduce its own
// serialization, ordering, arithmetic, or randomness rules.
//
// The serialization core lives in ../codec/canonical.ts (it predates this
// module and every existing digest routes through it); it is re-exported
// here so there is exactly one codec and exactly one place to find it.

export {
  Hex32,
  ZERO_DIGEST,
  canonicalize,
  compareUtf8,
  digestOf,
  sha256Hex,
} from "../codec/canonical";
export { DeterministicMap } from "./deterministic_map";
export {
  FP_SCALE,
  Fixed,
  fpAdd,
  fpDiv,
  fpFromDecimalString,
  fpFromInt,
  fpMul,
  fpSub,
  fpToDecimalString,
} from "./fixed_point";
export { DeterministicRng } from "./prng";
export { celAssert } from "./guard";
