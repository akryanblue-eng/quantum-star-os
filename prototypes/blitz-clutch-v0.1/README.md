# Blitz Clutch Prototype v0.1

The minimum playable proof for the QS experience runtime contract
(`docs/architecture/qs-experience-runtime-v0.1.md`). A terminal
reaction game: cues fire on audio onsets (or a built-in pattern), you
press SPACE inside the reaction window.

**Evidence level: L2 (runnable isolated prototype).** This is not a
game, not "Arch Rivals," and makes no claims about how it feels —
that's what QSO-PROJECT-002 measures.

## What it proves

- **Variant A (control):** every event has a 250 ms reaction window.
- **Variant B (`--experience-mode`):** high-PRESSURE ("clutch") events
  constrict the window to 235 ms and show a pre-cue pulse; a hit on a
  clutch event emits a CLUTCH token in telemetry.
- **Blind mode (`--blind`):** the variant is chosen randomly and
  sealed inside the telemetry file, enabling the Variant C protocol in
  `docs/evaluation/QSO-PROJECT-002-human-perception.md`.

Two playable states now exist, so A/B comparison by a human is possible.

## Run it

Requires Node ≥ 18.3, no dependencies. In an interactive terminal:

```sh
node src/game.js                       # Variant A, built-in 8-event pattern
node src/game.js --experience-mode     # Variant B
node src/game.js --blind               # random sealed variant (for blind trials)
node src/game.js --audio track.wav     # events from a 16-bit PCM WAV's onsets
node src/game.js --dry-run             # print the event plan without playing
```

With `--audio`, playback is attempted via `afplay`/`aplay`/`ffplay`/`play`
if one is installed; without a player the cues still follow the audio's
onset times (silent run).

## Running the human evaluation (QSO-PROJECT-002 Variant C)

The trial runner enforces the sealed-blind ordering so telemetry can't
contaminate perception:

```sh
node src/trial.js        # runs one blind session, then prompts the
                         # capture form immediately — answer from
                         # immediate impression, before opening any file
# ...repeat several times...
node src/reveal.js       # unseals ONLY sessions that have a completed
                         # capture form; prints guess accuracy and
                         # per-variant score means
```

`reveal.js` never prints the variant of a session without a capture
form. The L3 dataset is the committed pair of `results/session-*.json`
and `results/capture-*.json` files from a real human run — nothing
machine-generated may be committed there. `results/` is gitignored to
keep test junk out; commit a real dataset deliberately with
`git add -f results/`.

## Telemetry

Each session writes `results/session-<timestamp>.json` with per-event
scheduled time, pressure, window applied, measured reaction latency,
and hit/miss. Only real keypress data goes in this file. In blind mode
the variant is recorded there sealed — fill in the human capture form
before opening it.

## Known limitations

- Terminal I/O adds latency jitter (typically a few ms, but unbounded
  under load); fine for A/B perception comparison, not for absolute
  reaction-time science.
- Onset detection is energy-based and crude; dense or quiet material
  may yield few events.
- Audio playback start is not sample-accurately synced to the cue
  clock (best-effort process spawn).
