# Project Groove

Turn a short voice note into a funny, shareable musical performance. Record or upload up to
20 seconds of speech, pick a style (Chill / Pop / Reggaeton), and get back an MP3 that still
sounds like you — just sung.

This is an entertainment product, not a music production tool: the goal is fun and shareability,
not professional-grade audio.

## Requirements

- Node.js 20+
- **ffmpeg and ffprobe on `PATH`**, built with `librubberband` support (used for time-stretching
  and pitch-shifting: `ffmpeg -filters | grep rubberband` should list it). On Debian/Ubuntu:
  `apt-get install ffmpeg`.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The backing-track loops shipped in `assets/backing-tracks/` are already rendered and committed.
To regenerate them (e.g. after tweaking a drum pattern):

```bash
node scripts/generate-backing-tracks.mjs
```

## How it works

```
src/
  app/
    page.tsx              one-page UI (record/upload -> style -> generate -> preview -> download)
    api/generate/route.ts  POST endpoint: audio + style in, MP3 out
  components/
    GrooveStudio.tsx       all client-side UI state (recording, upload, styles, result)
  lib/
    style-engine/          per-style config: bpm, backing track, pitch target, mix/master params
    audio-pipeline/        clean -> pitch/rhythm -> mix -> master -> export (see below)
    ffmpeg/                thin subprocess wrapper around the system ffmpeg/ffprobe binaries
scripts/
  generate-backing-tracks.mjs  synthesizes the Chill/Pop/Reggaeton backing loops from scratch
assets/backing-tracks/        pre-rendered backing loops (24s, looped and trimmed at request time)
```

The audio pipeline (`src/lib/audio-pipeline`) is deliberately split into replaceable stages:

1. **Clean** — trims leading/trailing silence, high/low-pass filters, denoise, loudness-normalize.
2. **Perform** (pitch + rhythm) — shifts the vocal into a sung pitch range with formants preserved
   (so the speaker stays recognizable) and gently nudges the phrase length toward the style's beat
   grid. This is the most swappable stage — a real pitch-tracking/note-quantizing implementation
   can replace it without touching mix/master/export.
3. **Mix** — blends the performed vocal with the style's backing track.
4. **Master + export** — compression, a touch of reverb, final loudness/peak limiting, MP3 encode.

Nothing is persisted: uploaded audio and every intermediate file live in a per-request temp
directory that's deleted as soon as the response is sent, whether the request succeeds or fails.

## Testing on a real phone

Anything that touches the microphone (`getUserMedia`, `MediaRecorder`) needs a **secure context** —
`https://`, or the special-cased `http://localhost`. A LAN address like `http://192.168.1.27:3000`
is plain HTTP and is *never* a secure context, in any browser, on any OS — that's a spec rule, not
an iOS quirk. `npm run dev` and testing from the same machine at `localhost` will work; opening
that same LAN URL from a phone will silently fail `getUserMedia` because it's a genuinely different
kind of origin, not a broken one.

To test from a real device, front the local dev server with real HTTPS:

```bash
# terminal 1
npm run dev

# terminal 2 — install once: brew install cloudflared (or the Cloudflare download for your OS)
cloudflared tunnel --url http://localhost:3000
```

Open the printed `https://*.trycloudflare.com` URL on the phone — real, trusted certificate, no
device-side setup, `isSecureContext` reads `true`.

For a fully local alternative with no third-party tunnel, use [mkcert](https://github.com/FiloSottile/mkcert)
to issue a locally-trusted cert for your LAN IP, serve `next dev --experimental-https` (or a custom
HTTPS server) with it, and install `mkcert`'s root CA on the phone once (AirDrop/email the `.pem`,
install as a profile, then enable full trust under Settings → General → About → Certificate Trust
Settings).

Once deployed, a real host (Vercel, etc.) provides valid HTTPS automatically and none of this is
needed — this is only for testing local `npm run dev` builds against a real device.

## Constraints

- Max clip length: 20 seconds (uploads longer than that are trimmed).
- No accounts, no login, no storage — everything happens in a single request.
