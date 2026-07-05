import path from "node:path";

export type StyleId = "chill" | "pop" | "reggaeton";

export interface StyleConfig {
  id: StyleId;
  label: string;
  tagline: string;
  bpm: number;
  /** Absolute path to the pre-rendered backing-track loop (mp3, 24s, see scripts/generate-backing-tracks.mjs). */
  backingTrackPath: string;
  /** One bar at this style's tempo, in seconds. The vocal phrase is time-stretched to the nearest multiple of this. */
  barDurationSec: number;
  pitch: {
    /** Semitones the vocal is shifted up so speech reads as "sung". */
    semitones: number;
    /** Keep the speaker's formants in place while shifting pitch, so they stay recognizable. */
    formantPreserve: boolean;
  };
  effects: {
    vibratoHz: number;
    vibratoDepth: number;
    chorus: boolean;
  };
  mix: {
    vocalGainDb: number;
    backingGainDb: number;
  };
  master: {
    compressionRatio: number;
    reverbDelayMs: number;
    reverbDecay: number;
  };
}

const ASSETS_DIR = path.join(process.cwd(), "assets", "backing-tracks");

export const STYLES: Record<StyleId, StyleConfig> = {
  chill: {
    id: "chill",
    label: "Chill",
    tagline: "Lo-fi, warm, half-time",
    bpm: 80,
    backingTrackPath: path.join(ASSETS_DIR, "chill.mp3"),
    barDurationSec: (60 / 80) * 4,
    pitch: { semitones: 2, formantPreserve: true },
    effects: { vibratoHz: 4, vibratoDepth: 0.15, chorus: true },
    mix: { vocalGainDb: 0, backingGainDb: -6 },
    master: { compressionRatio: 3, reverbDelayMs: 60, reverbDecay: 0.35 },
  },
  pop: {
    id: "pop",
    label: "Pop",
    tagline: "Bright, four-on-the-floor",
    bpm: 112,
    backingTrackPath: path.join(ASSETS_DIR, "pop.mp3"),
    barDurationSec: (60 / 112) * 4,
    pitch: { semitones: 4, formantPreserve: true },
    effects: { vibratoHz: 5.5, vibratoDepth: 0.2, chorus: true },
    mix: { vocalGainDb: 1, backingGainDb: -5 },
    master: { compressionRatio: 4, reverbDelayMs: 40, reverbDecay: 0.25 },
  },
  reggaeton: {
    id: "reggaeton",
    label: "Reggaeton",
    tagline: "Dembow riddim, punchy",
    bpm: 95,
    backingTrackPath: path.join(ASSETS_DIR, "reggaeton.mp3"),
    barDurationSec: (60 / 95) * 4,
    pitch: { semitones: 3, formantPreserve: true },
    effects: { vibratoHz: 6, vibratoDepth: 0.25, chorus: false },
    mix: { vocalGainDb: 1.5, backingGainDb: -4 },
    master: { compressionRatio: 5, reverbDelayMs: 30, reverbDecay: 0.2 },
  },
};

export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export function isStyleId(value: string): value is StyleId {
  return value in STYLES;
}

export function getStyle(id: StyleId): StyleConfig {
  return STYLES[id];
}
