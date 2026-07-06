import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A short-lived scratch directory for one generate request. Nothing here outlives the request:
 * the caller must always release() it, which deletes the directory and everything in it.
 * Project Groove keeps no uploaded or generated audio around once the response is sent.
 */
export interface Workspace {
  dir: string;
  path(name: string): string;
  release(): Promise<void>;
}

export async function createWorkspace(): Promise<Workspace> {
  const dir = await mkdtemp(path.join(tmpdir(), "groove-"));
  return {
    dir,
    path: (name: string) => path.join(dir, name),
    release: () => rm(dir, { recursive: true, force: true }),
  };
}
