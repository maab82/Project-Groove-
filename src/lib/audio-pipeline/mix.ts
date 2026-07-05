import { runFfmpeg } from "@/lib/ffmpeg/run";
import type { StyleConfig } from "@/lib/style-engine";

/**
 * Stage 3: mix the performed vocal with the style's instrumental backing track.
 * The backing loop (see scripts/generate-backing-tracks.mjs) is always at least as long as the
 * max clip, so it's simply trimmed to the vocal's final duration starting from its top.
 */
export async function mixWithBacking(
  vocalPath: string,
  outputPath: string,
  style: StyleConfig,
  durationSec: number
): Promise<void> {
  const filterComplex = [
    `[1:a]atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS,volume=${style.mix.backingGainDb}dB[bg]`,
    `[0:a]volume=${style.mix.vocalGainDb}dB,aformat=channel_layouts=stereo[vox]`,
    `[vox][bg]amix=inputs=2:duration=first:normalize=0[mixed]`,
  ].join(";");

  await runFfmpeg([
    "-i",
    vocalPath,
    "-i",
    style.backingTrackPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[mixed]",
    outputPath,
  ]);
}
