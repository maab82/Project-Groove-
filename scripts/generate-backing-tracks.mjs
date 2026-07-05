#!/usr/bin/env node
// Renders the procedural backing-track loops shipped with the app (Chill / Pop / Reggaeton).
// These are synthesized from scratch with ffmpeg's audio-generator filters (no sample libraries,
// no copyrighted material) so the assets can be committed to the repo and regenerated at will.
//
// Run: node scripts/generate-backing-tracks.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "assets", "backing-tracks");
const LOOP_SECONDS = 24; // covers the 20s max clip plus a little headroom

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: "inherit",
  });
}

const SAMPLE_RATE = 44100;

/** One-shot percussive hit rendered from a lavfi source + shaping filters. */
function hit({ source, shape, stepIndex, stepDurSec, gainDb }) {
  const delayMs = Math.round(stepIndex * stepDurSec * 1000);
  return {
    input: source,
    filter: `${shape},volume=${gainDb}dB,adelay=${delayMs}|${delayMs}`,
  };
}

function kick({ stepIndex, stepDurSec, freq = 95, gainDb = 2 }) {
  return hit({
    source: `sine=frequency=${freq}:duration=0.28:sample_rate=${SAMPLE_RATE}`,
    shape: `afade=t=out:st=0.05:d=0.23,lowpass=f=180`,
    stepIndex,
    stepDurSec,
    gainDb,
  });
}

function snare({ stepIndex, stepDurSec, gainDb = -4 }) {
  return hit({
    source: `anoisesrc=color=white:duration=0.16:sample_rate=${SAMPLE_RATE}`,
    shape: `highpass=f=500,lowpass=f=5000,afade=t=out:st=0.03:d=0.13`,
    stepIndex,
    stepDurSec,
    gainDb,
  });
}

function hat({ stepIndex, stepDurSec, gainDb = -14, open = false }) {
  const dur = open ? 0.18 : 0.06;
  return hit({
    source: `anoisesrc=color=white:duration=${dur}:sample_rate=${SAMPLE_RATE}`,
    shape: `highpass=f=7000,afade=t=out:st=0.01:d=${dur - 0.01}`,
    stepIndex,
    stepDurSec,
    gainDb,
  });
}

function bassNote({ stepIndex, stepDurSec, freq, durSec = 0.4, gainDb = -6 }) {
  return hit({
    source: `sine=frequency=${freq}:duration=${durSec}:sample_rate=${SAMPLE_RATE}`,
    shape: `afade=t=out:st=${Math.max(durSec - 0.28, 0.02)}:d=0.28,lowpass=f=420`,
    stepIndex,
    stepDurSec,
    gainDb,
  });
}

/** A sustained chord tone held for the whole bar (pad wash). */
function padTone({ freq, barDurSec, gainDb = -16 }) {
  return {
    input: `sine=frequency=${freq}:duration=${barDurSec}:sample_rate=${SAMPLE_RATE}`,
    filter: `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(
      barDurSec - 0.3,
      0.05
    )}:d=0.3,tremolo=f=4.5:d=0.3,lowpass=f=2200,volume=${gainDb}dB`,
  };
}

// Roughly equal-tempered note frequencies (Hz), just the handful this file needs.
const NOTE = {
  A1: 55.0,
  A2: 110.0,
  C2: 65.41,
  C3: 130.81,
  E2: 82.41,
  E3: 164.81,
  G1: 49.0,
  G2: 98.0,
  G3: 196.0,
  Bb2: 116.54,
  D3: 146.83,
};

function buildStyle({ name, bpm, beatsPerBar = 4, stepsPerBar = 16, pattern, bassRootFreq, chord, masterGainDb }) {
  const barDurSec = (60 / bpm) * beatsPerBar;
  const stepDurSec = barDurSec / stepsPerBar;

  const elements = [];

  for (const step of pattern.kick) elements.push(kick({ stepIndex: step, stepDurSec }));
  for (const step of pattern.snare) elements.push(snare({ stepIndex: step, stepDurSec }));
  for (const step of pattern.hat) elements.push(hat({ stepIndex: step, stepDurSec }));
  for (const step of pattern.bass) elements.push(bassNote({ stepIndex: step, stepDurSec, freq: bassRootFreq }));
  for (const freq of chord) elements.push(padTone({ freq, barDurSec }));

  const inputArgs = elements.flatMap((el) => ["-f", "lavfi", "-i", el.input]);
  const labeled = elements.map((el, i) => `[${i}:a]${el.filter}[e${i}]`).join(";");
  const mixInputs = elements.map((_, i) => `[e${i}]`).join("");
  const filterComplex = `${labeled};${mixInputs}amix=inputs=${elements.length}:duration=longest:normalize=0[mixed];[mixed]alimiter=limit=0.9,volume=${masterGainDb}dB[out]`;

  const workDir = mkdtempSync(path.join(tmpdir(), `groove-${name}-`));
  const unitPath = path.join(workDir, "unit.wav");
  const finalPath = path.join(OUT_DIR, `${name}.mp3`);

  ffmpeg([...inputArgs, "-filter_complex", filterComplex, "-map", "[out]", "-t", barDurSec.toFixed(4), unitPath]);

  const repeats = Math.ceil(LOOP_SECONDS / barDurSec);
  ffmpeg([
    "-stream_loop",
    String(repeats - 1),
    "-i",
    unitPath,
    "-t",
    String(LOOP_SECONDS),
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    "2",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "2",
    finalPath,
  ]);

  rmSync(workDir, { recursive: true, force: true });
  console.log(`✓ ${name}: ${finalPath} (bar=${barDurSec.toFixed(3)}s, bpm=${bpm})`);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Chill (80 BPM): sparse, warm, half-time feel.
buildStyle({
  name: "chill",
  bpm: 80,
  bassRootFreq: NOTE.A1,
  chord: [NOTE.A2, NOTE.C3, NOTE.E3],
  masterGainDb: 4,
  pattern: {
    kick: [0, 8],
    snare: [],
    hat: [2, 6, 10, 14],
    bass: [0, 8],
  },
});

// Pop (112 BPM): four-on-the-floor, bright and energetic.
buildStyle({
  name: "pop",
  bpm: 112,
  bassRootFreq: NOTE.C2,
  chord: [NOTE.C3, NOTE.E3, NOTE.G3],
  masterGainDb: 3,
  pattern: {
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 4, 8, 12],
  },
});

// Reggaeton (95 BPM): dembow "boom-ch-boom-chick" riddim.
buildStyle({
  name: "reggaeton",
  bpm: 95,
  bassRootFreq: NOTE.G1,
  chord: [NOTE.G2, NOTE.Bb2, NOTE.D3],
  masterGainDb: 4,
  pattern: {
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 6, 8, 14],
  },
});

console.log("All backing tracks generated.");
