import { runFfmpeg, probeDurationSeconds } from "@/lib/ffmpeg/run";
import type { StyleConfig } from "@/lib/style-engine";

const MIN_TEMPO_ADJUST = 0.85;
const MAX_TEMPO_ADJUST = 1.18;

function semitonesToPitchRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Nudge the phrase length toward the nearest whole bar at the style's tempo, without forcing an
 * exact quantization. A full snap-to-grid would fight the "preserve timing/imperfections" goal,
 * so the adjustment is clamped to a gentle +/-18% stretch.
 */
function tempoForNearestBar(rawDurationSec: number, barDurationSec: number): number {
  const bars = Math.max(1, Math.round(rawDurationSec / barDurationSec));
  const targetDurationSec = bars * barDurationSec;
  const idealTempo = rawDurationSec / targetDurationSec;
  return Math.min(MAX_TEMPO_ADJUST, Math.max(MIN_TEMPO_ADJUST, idealTempo));
}

/**
 * Stage 2: pitch correction + rhythm alignment.
 *
 * Speech doesn't have a musical tempo of its own, so instead of detecting one, this stage aligns
 * the phrase to the chosen style's beat grid (rhythm alignment) and shifts it into a sung pitch
 * range with formants preserved so the speaker still sounds like themselves (pitch correction).
 * A touch of vibrato (and chorus, for styles that want it) sells the "auto-tuned" character.
 *
 * This is intentionally the most replaceable module in the pipeline: swap it out for a real
 * pitch-tracking/note-quantizing implementation (e.g. an aubio- or CREPE-based one) without
 * touching mix/master/export.
 */
export async function performVocals(
  inputPath: string,
  outputPath: string,
  style: StyleConfig
): Promise<{ durationSec: number }> {
  const rawDurationSec = await probeDurationSeconds(inputPath);
  const tempo = tempoForNearestBar(rawDurationSec, style.barDurationSec);
  const pitch = semitonesToPitchRatio(style.pitch.semitones);
  const formant = style.pitch.formantPreserve ? "preserved" : "shifted";

  const filters = [
    `rubberband=tempo=${tempo.toFixed(4)}:pitch=${pitch.toFixed(4)}:formant=${formant}:pitchq=quality`,
    `vibrato=f=${style.effects.vibratoHz}:d=${style.effects.vibratoDepth}`,
  ];
  if (style.effects.chorus) {
    filters.push("chorus=0.5:0.9:55:0.4:0.25:2");
  }

  await runFfmpeg(["-i", inputPath, "-af", filters.join(","), outputPath]);

  const durationSec = await probeDurationSeconds(outputPath);
  return { durationSec };
}
