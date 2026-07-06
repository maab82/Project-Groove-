import { runFfmpeg } from "@/lib/ffmpeg/run";
import type { StyleConfig } from "@/lib/style-engine";
import { SAMPLE_RATE } from "./constants";

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Stage 4 + 5: glue compression, a touch of reverb, final loudness/peak safety net, and MP3
 * export. This is the last stop before the file goes back to the client.
 */
export async function masterAndExport(
  inputPath: string,
  outputPath: string,
  style: StyleConfig
): Promise<void> {
  const compressorThreshold = dbToLinear(-18).toFixed(4);

  const filters = [
    `acompressor=threshold=${compressorThreshold}:ratio=${style.master.compressionRatio}:attack=15:release=200:makeup=2`,
    `aecho=0.8:0.7:${style.master.reverbDelayMs}:${style.master.reverbDecay}`,
    "loudnorm=I=-14:TP=-1:LRA=9",
    "alimiter=limit=0.95",
  ].join(",");

  await runFfmpeg([
    "-i",
    inputPath,
    "-af",
    filters,
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    "2",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "2",
    outputPath,
  ]);
}
