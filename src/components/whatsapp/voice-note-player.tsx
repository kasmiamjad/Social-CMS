"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, User } from "lucide-react";

interface VoiceNotePlayerProps {
  src: string;
  /** Any stable per-message value (e.g. message id) — keeps the waveform shape from jittering on re-render. */
  seed: string;
  variant: "outbound" | "inbound";
}

const BAR_COUNT = 28;

/** Deterministic pseudo-random bar heights from a string seed, so the waveform looks the same every render. */
function seededBars(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(0.3 + ((h >>> 8) % 100) / 100 * 0.7); // 0.3–1.0 relative height
  }
  return bars;
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** WhatsApp-style voice note bubble: small avatar, round play button, waveform, duration. */
export function VoiceNotePlayer({ src, seed, variant }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bars] = useState(() => seededBars(seed, BAR_COUNT));

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      if (el.duration) setProgress(el.currentTime / el.duration);
    };
    const onLoaded = () => setDuration(el.duration);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  }

  const isOutbound = variant === "outbound";
  const displayTime = playing || currentTime > 0 ? currentTime : duration;

  return (
    <div className="flex items-center gap-2 min-w-[230px]">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isOutbound ? "bg-white/20" : "bg-surface border border-border"
        }`}
      >
        <User size={13} strokeWidth={1.8} className={isOutbound ? "text-white/90" : "text-text-muted"} />
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isOutbound ? "bg-white text-primary" : "bg-primary text-white"
        }`}
      >
        {playing ? (
          <Pause size={13} strokeWidth={2} fill="currentColor" />
        ) : (
          <Play size={13} strokeWidth={2} fill="currentColor" className="ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex items-center gap-[2.5px] h-6">
        {bars.map((h, i) => {
          const filled = bars.length > 0 && i / bars.length <= progress;
          return (
            <span
              key={i}
              className={`w-[2.5px] rounded-full ${
                filled ? (isOutbound ? "bg-white" : "bg-primary") : isOutbound ? "bg-white/35" : "bg-text-muted/30"
              }`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>
      <span className={`text-[10px] tabular-nums shrink-0 ${isOutbound ? "text-white/80" : "text-text-muted"}`}>
        {formatTime(displayTime)}
      </span>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
