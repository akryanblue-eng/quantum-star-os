// Feature Extractor — contract §1 of docs/architecture/qs-experience-runtime-v0.1.md
// Parses PCM WAV and detects onset events by frame-energy rise.

const FRAME = 1024;
const HOP = 512;
const MIN_ONSET_GAP_SEC = 0.35;

export function parseWav(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('Missing fmt or data chunk');
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`Only 16-bit PCM supported (got format ${fmt.audioFormat}, ${fmt.bitsPerSample}-bit)`);
  }

  const frames = Math.floor(data.length / 2 / fmt.channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      acc += data.readInt16LE((i * fmt.channels + c) * 2);
    }
    mono[i] = acc / fmt.channels / 32768;
  }
  return { sampleRate: fmt.sampleRate, samples: mono };
}

export function extractFeatures(buf) {
  const { sampleRate, samples } = parseWav(buf);
  const durationSec = samples.length / sampleRate;

  const energies = [];
  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    let sum = 0;
    for (let i = start; i < start + FRAME; i++) sum += samples[i] * samples[i];
    energies.push(Math.sqrt(sum / FRAME));
  }

  // Onset strength = positive energy rise between consecutive frames.
  const rises = energies.map((e, i) => (i === 0 ? 0 : Math.max(0, e - energies[i - 1])));
  const mean = rises.reduce((a, b) => a + b, 0) / (rises.length || 1);
  const std = Math.sqrt(rises.reduce((a, b) => a + (b - mean) ** 2, 0) / (rises.length || 1));
  const threshold = mean + 1.5 * std;

  const onsets = [];
  let lastTime = -Infinity;
  for (let i = 1; i < rises.length - 1; i++) {
    const isPeak = rises[i] >= threshold && rises[i] >= rises[i - 1] && rises[i] >= rises[i + 1];
    const timeSec = (i * HOP) / sampleRate;
    if (isPeak && timeSec - lastTime >= MIN_ONSET_GAP_SEC) {
      onsets.push({ timeSec, energy: energies[i] });
      lastTime = timeSec;
    }
  }

  const maxEnergy = Math.max(...onsets.map((o) => o.energy), 1e-9);
  for (const o of onsets) o.energy = o.energy / maxEnergy;

  // Crude tempo estimate: median inter-onset interval.
  let tempoBpmEstimate = null;
  if (onsets.length >= 3) {
    const gaps = onsets.slice(1).map((o, i) => o.timeSec - onsets[i].timeSec).sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    if (medianGap > 0) tempoBpmEstimate = Math.round(60 / medianGap);
  }

  return {
    sampleRate,
    durationSec,
    tempoBpmEstimate,
    transientDensity: durationSec > 0 ? onsets.length / durationSec : 0,
    onsets,
  };
}
