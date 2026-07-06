import { runFfmpeg } from "@/lib/ffmpeg/run";
import { MAX_INPUT_SECONDS, SAMPLE_RATE } from "./constants";

/**
 * Stage 1: clean + normalize the raw voice note.
 *
 * - Trims leading/trailing silence (a stand-in for "phrasing" detection: real onset/phrase
 *   detection is a good candidate for a future, swappable implementation of this module).
 * - High/low-pass to strip rumble and hiss, plus an FFT denoiser for typical phone-mic noise.
 * - Loudness-normalizes so every clip enters the next stage at a consistent level.
 * - Hard-caps at MAX_INPUT_SECONDS regardless of what was uploaded.
 */
export async function cleanAudio(inputPath: string, outputPath: string): Promise<void> {
  const filters = [
    "silenceremove=start_periods=1:start_duration=0.1:start_threshold=-45dB:start_silence=0.15:" +
      "stop_periods=1:stop_duration=0.1:stop_threshold=-45dB:stop_silence=0.15",
    "highpass=f=80",
    "lowpass=f=11000",
    "afftdn=nf=-25",
    "loudnorm=I=-18:TP=-2:LRA=11",
  ].join(",");

  await runFfmpeg([
    "-i",
    inputPath,
    "-af",
    filters,
    "-t",
    String(MAX_INPUT_SECONDS),
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    "1",
    outputPath,
  ]);
}
