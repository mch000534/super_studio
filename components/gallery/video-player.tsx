'use client';

import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { MediaItem } from '@/types/workflow';

interface VideoPlayerProps {
  item: MediaItem;
}

export function VideoPlayer({ item }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  };

  const format = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-black">
      <video
        ref={ref}
        src={item.url}
        className="w-full"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => {
          const v = ref.current;
          if (v) {
            setProgress(v.currentTime);
            setDuration(v.duration || 0);
          }
        }}
        onLoadedMetadata={() => {
          const v = ref.current;
          if (v) setDuration(v.duration || 0);
        }}
      />
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={toggle}
          className="rounded-md border p-1.5 hover:bg-accent"
          aria-label="播放/暫停"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="relative h-2 flex-1 rounded-full bg-secondary">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {format(progress)} / {format(duration)}
        </span>
      </div>
    </div>
  );
}