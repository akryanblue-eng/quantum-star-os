#!/usr/bin/env node
// Reveal mapping — QSO-PROJECT-002 Variant C analysis.
// Pairs sealed blind telemetry with completed human capture forms and
// compares intuition against the actual variant. Sessions without a
// capture form are NOT revealed.
//
// Usage: node src/reveal.js

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
if (!existsSync(resultsDir)) {
  console.error('No results directory — run some blind trials first: node src/trial.js');
  process.exit(1);
}

const files = readdirSync(resultsDir);
const sessions = files.filter((f) => f.startsWith('session-')).sort();
const trials = [];
const uncaptured = [];

for (const s of sessions) {
  const session = JSON.parse(readFileSync(join(resultsDir, s), 'utf8'));
  if (!session.blind) continue;
  const captureName = s.replace(/^session-/, 'capture-');
  if (!files.includes(captureName)) {
    uncaptured.push(s);
    continue;
  }
  trials.push({ session, capture: JSON.parse(readFileSync(join(resultsDir, captureName), 'utf8')) });
}

if (uncaptured.length > 0) {
  console.log(`Sealed (no capture form, variant NOT revealed): ${uncaptured.join(', ')}\n`);
}
if (trials.length === 0) {
  console.log('No blind trials with completed capture forms yet. Run: node src/trial.js');
  process.exit(0);
}

console.log('trial'.padEnd(32), 'guess', 'actual', 'correct', 'felt-diff', 'mech', 'fair', 'audio');
let correct = 0;
let abstained = 0;
const byVariant = { A: [], B: [] };

for (const { session, capture } of trials) {
  const actual = session.variant;
  const guess = capture.variantGuess.toUpperCase();
  const isCorrect = guess === actual;
  if (guess === 'X') abstained++;
  else if (isCorrect) correct++;
  byVariant[actual].push(capture);
  console.log(
    session.startedAt.padEnd(32),
    guess.padEnd(5),
    actual.padEnd(6),
    (guess === 'X' ? '—' : isCorrect ? 'yes' : 'no').padEnd(7),
    capture.feltDifferent.padEnd(9),
    String(capture.mechanicalFeel).padEnd(4),
    String(capture.fairness).padEnd(4),
    String(capture.audioConnection),
  );
  console.log(`  felt like: "${capture.feltLike}"`);
}

const decided = trials.length - abstained;
const mean = (arr, key) =>
  arr.length ? (arr.reduce((a, c) => a + c[key], 0) / arr.length).toFixed(1) : '—';

console.log(`\nGuess accuracy: ${correct}/${decided} decided (${abstained} abstained); chance is ~50%.`);
for (const v of ['A', 'B']) {
  console.log(
    `Variant ${v} (${byVariant[v].length} trial${byVariant[v].length === 1 ? '' : 's'}): ` +
      `mechanical ${mean(byVariant[v], 'mechanicalFeel')}, fairness ${mean(byVariant[v], 'fairness')}, ` +
      `audio connection ${mean(byVariant[v], 'audioConnection')}`,
  );
}
console.log(
  `\nNote: with n=${trials.length} this is directional evidence only. ` +
    'Commit the capture + session files to record the dataset (L3).',
);
