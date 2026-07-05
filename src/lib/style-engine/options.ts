import type { StyleId } from "./styles";

/** Client-safe style metadata (no filesystem paths) for rendering the style picker. */
export interface StyleOption {
  id: StyleId;
  label: string;
  tagline: string;
  emoji: string;
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: "chill", label: "Chill", tagline: "Lo-fi, warm, half-time", emoji: "\u{1F319}" },
  { id: "pop", label: "Pop", tagline: "Bright, four-on-the-floor", emoji: "\u{2728}" },
  { id: "reggaeton", label: "Reggaeton", tagline: "Dembow riddim, punchy", emoji: "\u{1F525}" },
];
