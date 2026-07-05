"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STYLE_OPTIONS } from "@/lib/style-engine/options";
import type { StyleId } from "@/lib/style-engine/styles";

const MAX_SECONDS = 20;
const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

type Stage = "idle" | "ready" | "generating" | "done";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GrooveStudio() {
  const [stage, setStage] = useState<Stage>("idle");
  const [clip, setClip] = useState<Blob | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleId | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipUrlRef = useRef<string | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  useEffect(() => {
    clipUrlRef.current = clipUrl;
    resultUrlRef.current = resultUrl;
  }, [clipUrl, resultUrl]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    clearTimer();
  }, []);

  const setNewClip = (blob: Blob) => {
    setClip(blob);
    setClipUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setStage("ready");
    setError(null);
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? "audio/webm" });
        setNewClip(blob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Couldn't access your microphone. Try uploading a file instead.");
    }
  }, [stopRecording]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setNewClip(file);
    event.target.value = "";
  };

  const reset = () => {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setClip(null);
    setClipUrl(null);
    setResultUrl(null);
    setStyle(null);
    setStage("idle");
    setError(null);
  };

  const generate = async () => {
    if (!clip || !style) return;
    setStage("generating");
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", clip, "voice-note");
      form.append("style", style);

      const res = await fetch("/api/generate", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Something went wrong.");
      }
      const mp3 = await res.blob();
      setResultUrl(URL.createObjectURL(mp3));
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("ready");
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">🎤➡️🎶</span>
        <h1 className="text-3xl font-bold tracking-tight">Project Groove</h1>
        <p className="text-balance text-sm text-zinc-500 dark:text-zinc-400">
          Speak a voice note. Get back a song. Up to {MAX_SECONDS} seconds, ready in a few
          seconds flat.
        </p>
      </div>

      {stage === "idle" && (
        <div className="flex w-full flex-col gap-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex h-32 w-full flex-col items-center justify-center gap-1 rounded-3xl text-lg font-semibold text-white shadow-lg transition active:scale-[0.98] ${
              isRecording
                ? "bg-red-500 shadow-red-500/30"
                : "bg-violet-600 shadow-violet-600/30 hover:bg-violet-500"
            }`}
          >
            <span className="text-3xl">{isRecording ? "⏹️" : "🎙️"}</span>
            {isRecording ? `Recording… ${formatTime(recordSeconds)}` : "Tap to record"}
          </button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <label className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 font-medium text-zinc-600 transition hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-300">
            📁 Upload an audio file
            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      )}

      {(stage === "ready" || stage === "generating" || stage === "done") && clipUrl && (
        <div className="flex w-full flex-col gap-6">
          <div className="flex flex-col gap-2 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Your voice note
            </span>
            <audio src={clipUrl} controls className="w-full" />
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Pick a style
            </span>
            <div className="grid grid-cols-3 gap-3">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setStyle(option.id)}
                  disabled={stage === "generating"}
                  className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition disabled:opacity-50 ${
                    style === option.id
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                    {option.tagline}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {stage !== "done" && (
            <button
              onClick={generate}
              disabled={!style || stage === "generating"}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-lg font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none dark:disabled:bg-zinc-700"
            >
              {stage === "generating" ? (
                <>
                  <span className="animate-spin">🎛️</span> Cooking up your jam…
                </>
              ) : (
                <>✨ Generate</>
              )}
            </button>
          )}

          {stage === "done" && resultUrl && (
            <div className="flex flex-col gap-3 rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30">
              <span className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Your performance 🎉
              </span>
              <audio src={resultUrl} controls autoPlay className="w-full" />
              <div className="flex gap-2">
                <a
                  href={resultUrl}
                  download="project-groove.mp3"
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-violet-600 font-semibold text-white transition hover:bg-violet-500"
                >
                  ⬇️ Download MP3
                </a>
                <button
                  onClick={reset}
                  className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 px-4 font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  🔁 Again
                </button>
              </div>
            </div>
          )}

          {stage !== "done" && (
            <button
              onClick={reset}
              disabled={stage === "generating"}
              className="text-sm text-zinc-400 underline-offset-2 hover:underline disabled:opacity-40"
            >
              Start over
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
