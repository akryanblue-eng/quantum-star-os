#!/usr/bin/env node
// Blind trial runner — QSO-PROJECT-002 Variant C protocol.
// Runs one blind game session, then immediately prompts the human
// capture form (docs/evaluation/QSO-PROJECT-002-human-perception.md §4)
// before the evaluator has a reason to open the sealed telemetry file.
//
// Usage: node src/trial.js [--audio path.wav] [--events N]

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(here, '..', 'results');

function sessionFiles() {
  if (!existsSync(resultsDir)) return new Set();
  return new Set(readdirSync(resultsDir).filter((f) => f.startsWith('session-')));
}

const before = sessionFiles();
const game = spawnSync(process.execPath, [join(here, 'game.js'), '--blind', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
if (game.status !== 0) process.exit(game.status ?? 1);

const created = [...sessionFiles()].filter((f) => !before.has(f));
if (created.length !== 1) {
  console.error(`Expected exactly one new telemetry file, found ${created.length}. Capture aborted.`);
  process.exit(1);
}
const sessionFile = created[0];

console.log('\n--- CAPTURE FORM (answer from immediate impression; do not open the telemetry file) ---');
const rl = createInterface({ input: process.stdin, output: process.stdout });

// Queue lines as they arrive so answers typed or pasted ahead of the
// prompts aren't dropped between rl.question calls.
const pendingLines = [];
const waiters = [];
let stdinClosed = false;
rl.on('line', (line) => {
  const waiter = waiters.shift();
  if (waiter) waiter(line);
  else pendingLines.push(line);
});
rl.on('close', () => {
  stdinClosed = true;
  for (const waiter of waiters.splice(0)) waiter(null);
});

function nextLine() {
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  if (stdinClosed) return Promise.resolve(null);
  return new Promise((resolve) => waiters.push(resolve));
}

async function ask(question, validate) {
  for (;;) {
    process.stdout.write(question);
    const raw = await nextLine();
    if (raw === null) {
      console.error('\nInput closed before the form was completed — capture aborted; session stays sealed.');
      process.exit(1);
    }
    const value = validate(raw.trim());
    if (value !== undefined) return value;
    console.log('  (invalid answer, try again)');
  }
}

const oneOf = (allowed) => (raw) => {
  const v = raw.toLowerCase();
  return allowed.includes(v) ? v : undefined;
};
const score = (raw) => {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : undefined;
};

const capture = {
  sessionFile,
  capturedAt: new Date().toISOString(),
  evaluator: await ask('Evaluator name/initials: ', (r) => (r.length > 0 ? r : undefined)),
  feltDifferent: await ask('Did the moment feel different from baseline? (y/n/u=unsure): ', oneOf(['y', 'n', 'u'])),
  mechanicalFeel: await ask('Mechanical feel — intentional challenge (1-10): ', score),
  fairness: await ask('Fairness (1-10): ', score),
  audioConnection: await ask('Audio–gameplay connection (1-10): ', score),
  variantGuess: await ask('Guess: was the experience mechanic active? (a/b/x=cannot tell): ', oneOf(['a', 'b', 'x'])),
  feltLike: await ask('The moment felt like: ', (r) => (r.length > 0 ? r : undefined)),
};
rl.close();

mkdirSync(resultsDir, { recursive: true });
const captureFile = join(resultsDir, sessionFile.replace(/^session-/, 'capture-'));
writeFileSync(captureFile, JSON.stringify(capture, null, 2));

console.log(`\nCapture recorded: ${captureFile}`);
console.log('The telemetry variant stays sealed. Run more trials, then: node src/reveal.js');
