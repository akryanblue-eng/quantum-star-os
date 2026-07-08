// Experience Primitive Resolver — contract §2 of docs/architecture/qs-experience-runtime-v0.1.md
// v0.1 emits only PRESSURE. SPACE and IDENTITY are deferred (L0).

export const CLUTCH_THRESHOLD = 0.66;

export function resolvePrimitives(features) {
  return {
    events: features.onsets.map((o) => ({
      timeSec: o.timeSec,
      pressure: o.energy,
      clutch: o.energy >= CLUTCH_THRESHOLD,
    })),
  };
}

// Fallback when no audio file is supplied: a deterministic 8-event
// pattern with two high-pressure beats, so the prototype runs with
// zero assets. Clearly synthetic — recorded as such in telemetry.
export function builtinPattern() {
  const pressures = [0.3, 0.4, 0.35, 0.8, 0.4, 0.3, 0.9, 0.5];
  return {
    events: pressures.map((p, i) => ({
      timeSec: 2 + i * 1.5,
      pressure: p,
      clutch: p >= CLUTCH_THRESHOLD,
    })),
  };
}
