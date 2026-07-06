import { NextResponse } from "next/server";
import { generatePerformance, NoSpeechDetectedError } from "@/lib/audio-pipeline";
import { isStyleId, STYLE_IDS } from "@/lib/style-engine";
import { FfmpegError } from "@/lib/ffmpeg/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generous ceiling on the *upload* itself; actual audio length is capped separately in the
// pipeline. This just stops someone from posting an enormous non-audio blob.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const audio = form.get("audio");
  const style = form.get("style");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (typeof style !== "string" || !isStyleId(style)) {
    return NextResponse.json(
      { error: `Missing or invalid style. Expected one of: ${STYLE_IDS.join(", ")}` },
      { status: 400 }
    );
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }
  if (audio.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Audio file is too large." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    const mp3 = await generatePerformance(buffer, style);

    return new NextResponse(new Uint8Array(mp3), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(mp3.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof NoSpeechDetectedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("generate failed:", err instanceof FfmpegError ? err.stderr : err);
    return NextResponse.json(
      { error: "Couldn't turn that into a performance. Try a different clip." },
      { status: 500 }
    );
  }
}
