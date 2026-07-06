import { readFile, writeFile } from "node:fs/promises";
import { getStyle, type StyleId } from "@/lib/style-engine";
import { createWorkspace } from "./workspace";
import { cleanAudio } from "./clean";
import { performVocals } from "./perform";
import { mixWithBacking } from "./mix";
import { masterAndExport } from "./master";
import { probeDurationSeconds } from "@/lib/ffmpeg/run";

export { MAX_INPUT_SECONDS } from "./constants";

const MIN_VOICE_SECONDS = 0.3;

export class NoSpeechDetectedError extends Error {
  constructor() {
    super("That clip didn't have any audio in it. Try recording again.");
    this.name = "NoSpeechDetectedError";
  }
}

/**
 * Runs the full pipeline: receive -> clean -> pitch/rhythm -> mix -> master -> export.
 * Takes the raw uploaded audio bytes and a style, returns a finished MP3 buffer.
 * All intermediate files live in a per-request temp workspace that is always deleted,
 * success or failure, before this resolves/rejects.
 */
export async function generatePerformance(input: Buffer, styleId: StyleId): Promise<Buffer> {
  const style = getStyle(styleId);
  const workspace = await createWorkspace();

  try {
    const rawPath = workspace.path("input.raw");
    const cleanPath = workspace.path("clean.wav");
    const performedPath = workspace.path("performed.wav");
    const mixedPath = workspace.path("mixed.wav");
    const outputPath = workspace.path("output.mp3");

    await writeFile(rawPath, input);
    await cleanAudio(rawPath, cleanPath);

    const cleanedDurationSec = await probeDurationSeconds(cleanPath).catch(() => 0);
    if (cleanedDurationSec < MIN_VOICE_SECONDS) {
      throw new NoSpeechDetectedError();
    }

    const { durationSec } = await performVocals(cleanPath, performedPath, style);
    await mixWithBacking(performedPath, mixedPath, style, durationSec);
    await masterAndExport(mixedPath, outputPath, style);

    return await readFile(outputPath);
  } finally {
    await workspace.release();
  }
}
