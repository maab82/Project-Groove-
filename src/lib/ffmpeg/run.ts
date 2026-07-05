import { spawn } from "node:child_process";

/**
 * Thin wrapper around the system `ffmpeg`/`ffprobe` binaries. Project Groove leans on ffmpeg's
 * built-in filters (rubberband, acompressor, aecho, ...) directly instead of a JS DSP library,
 * so this is the only place that shells out to a subprocess.
 */

export class FfmpegError extends Error {
  constructor(message: string, public readonly stderr: string) {
    super(message);
    this.name = "FfmpegError";
  }
}

function runProcess(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", (err) => {
      reject(new FfmpegError(`Failed to launch ${bin}: ${err.message}`, stderr));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new FfmpegError(`${bin} exited with code ${code}`, stderr));
      }
    });
  });
}

export function runFfmpeg(args: string[]): Promise<void> {
  return runProcess("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]).then(() => undefined);
}

export async function probeDurationSeconds(filePath: string): Promise<number> {
  const out = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = parseFloat(out.trim());
  if (!Number.isFinite(seconds)) {
    throw new FfmpegError(`Could not read duration for ${filePath}`, out);
  }
  return seconds;
}
