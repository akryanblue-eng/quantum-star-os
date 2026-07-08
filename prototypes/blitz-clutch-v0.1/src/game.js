#!/usr/bin/env node
// Blitz Clutch Prototype v0.1 — terminal reaction game.
// ReactionWindowModifier + telemetry: contract §3–§4 of
// docs/architecture/qs-experience-runtime-v0.1.md
//
// Variant A (default):          every event -> 250 ms window, no pulse.
// Variant B (--experience-mode): clutch events -> 235 ms window + pre-cue pulse.
//
// Usage:
//   node src/game.js [--audio path.wav] [--experience-mode] [--blind]
//                    [--events N] [--dry-run]

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractFeatures } from './features.js';
import { resolvePrimitives, builtinPattern } from './resolver.js';

const BASELINE_WINDOW_MS = 250;
const CLUTCH_WINDOW_MS = 235;
const PULSE_LEAD_MS = 450;
const MAX_WAIT_MS = 1200;

const { values: args } = parseArgs({
  options: {
    audio: { type: 'string' },
    'experience-mode': { type: 'boolean', default: false },
    blind: { type: 'boolean', default: false },
    events: { type: 'string', default: '8' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function reactionWindow(event, experienceMode) {
  const clutchActive = experienceMode && event.clutch;
  return {
    windowMs: clutchActive ? CLUTCH_WINDOW_MS : BASELINE_WINDOW_MS,
    pulse: clutchActive,
  };
}

function buildPlan() {
  let source;
  let resolved;
  if (args.audio) {
    const features = extractFeatures(readFileSync(args.audio));
    resolved = resolvePrimitives(features);
    source = { kind: 'audio', path: args.audio, tempoBpmEstimate: features.tempoBpmEstimate, transientDensity: features.transientDensity };
  } else {
    resolved = builtinPattern();
    source = { kind: 'builtin-pattern' };
  }
  const events = resolved.events.slice(0, parseInt(args.events, 10) || 8);
  if (events.length === 0) throw new Error('No events detected — try different audio or omit --audio');
  return { source, events };
}

function tryStartAudioPlayback(path) {
  const players = [
    ['afplay', [path]],
    ['aplay', ['-q', path]],
    ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', path]],
    ['play', ['-q', path]],
  ];
  for (const [cmd, cmdArgs] of players) {
    try {
      const child = spawn(cmd, cmdArgs, { stdio: 'ignore' });
      child.on('error', () => {});
      return child;
    } catch {
      // try next player
    }
  }
  return null;
}

function waitForPress(deadlineMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, deadlineMs);
    function onData(chunk) {
      const key = chunk.toString();
      if (key === '' || key === 'q') {
        process.stdout.write('\nAborted.\n');
        process.exit(130);
      }
      cleanup();
      resolve(performance.now());
    }
    function cleanup() {
      clearTimeout(timer);
      process.stdin.off('data', onData);
    }
    process.stdin.on('data', onData);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const { source, events } = buildPlan();

  // Variant selection. In blind mode it is random and never printed.
  const experienceMode = args.blind ? Math.random() < 0.5 : args['experience-mode'];
  const variant = experienceMode ? 'B' : 'A';

  if (args['dry-run']) {
    console.log(JSON.stringify({
      source,
      blind: args.blind,
      variant: args.blind ? '(sealed)' : variant,
      plan: events.map((e) => ({ ...e, ...reactionWindow(e, experienceMode) })),
    }, null, 2));
    return;
  }

  if (!process.stdin.isTTY) {
    console.error('This game needs an interactive terminal (TTY). Use --dry-run to inspect the event plan.');
    process.exit(1);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();

  console.log('\n=== BLITZ CLUTCH PROTOTYPE v0.1 ===');
  console.log(args.blind
    ? 'Blind trial: the variant is sealed until your capture form is filled in.'
    : `Variant ${variant} (${experienceMode ? 'experience mode ON' : 'control'})`);
  console.log('When you see  🏀 BLOCK NOW!  press SPACE as fast as you can. q quits.\n');

  for (const n of [3, 2, 1]) {
    process.stdout.write(`  ${n}...\n`);
    await sleep(700);
  }

  const player = args.audio ? tryStartAudioPlayback(args.audio) : null;
  const startMs = performance.now();
  const records = [];

  for (const [i, event] of events.entries()) {
    const { windowMs, pulse } = reactionWindow(event, experienceMode);
    const cueAtMs = event.timeSec * 1000;

    if (pulse) {
      const pulseAt = startMs + cueAtMs - PULSE_LEAD_MS;
      const wait = pulseAt - performance.now();
      if (wait > 0) await sleep(wait);
      process.stdout.write('        · · · pulse · · ·\n');
    }

    const wait = startMs + cueAtMs - performance.now();
    if (wait > 0) await sleep(wait);
    const cueShownAt = performance.now();
    process.stdout.write('  🏀 BLOCK NOW!  ');

    const pressedAt = await waitForPress(MAX_WAIT_MS);
    const latencyMs = pressedAt === null ? null : Math.round(pressedAt - cueShownAt);
    const hit = latencyMs !== null && latencyMs <= windowMs;
    process.stdout.write(latencyMs === null
      ? '— no reaction ✗\n'
      : `${latencyMs} ms ${hit ? '✓ BLOCKED' : `✗ too slow (window ${windowMs} ms)`}\n`);

    records.push({
      index: i,
      scheduledSec: event.timeSec,
      pressure: event.pressure,
      clutch: event.clutch,
      windowMs,
      pulseShown: pulse,
      latencyMs,
      hit,
    });
  }

  if (player) player.kill();
  process.stdin.setRawMode(false);
  process.stdin.pause();

  const hits = records.filter((r) => r.hit).length;
  const measured = records.filter((r) => r.latencyMs !== null);
  const meanLatency = measured.length
    ? Math.round(measured.reduce((a, r) => a + r.latencyMs, 0) / measured.length)
    : null;
  const clutchTokens = records.filter((r) => r.hit && r.clutch && experienceMode).length;

  console.log(`\nResult: ${hits}/${records.length} blocked, mean reaction ${meanLatency ?? '—'} ms`);
  if (!args.blind && clutchTokens > 0) console.log(`CLUTCH tokens earned: ${clutchTokens}`);

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
  mkdirSync(resultsDir, { recursive: true });
  const file = join(resultsDir, `session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({
    startedAt: new Date().toISOString(),
    source,
    blind: args.blind,
    variant, // in blind mode: sealed here — fill in the capture form before opening this file
    baselineWindowMs: BASELINE_WINDOW_MS,
    clutchWindowMs: CLUTCH_WINDOW_MS,
    events: records,
    summary: { hits, total: records.length, meanLatencyMs: meanLatency, clutchTokens },
  }, null, 2));

  console.log(`Telemetry written: ${file}`);
  if (args.blind) {
    console.log('\nBLIND TRIAL: complete the capture form in');
    console.log('docs/evaluation/QSO-PROJECT-002-human-perception.md §4');
    console.log('BEFORE opening the telemetry file — it contains the sealed variant.');
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
