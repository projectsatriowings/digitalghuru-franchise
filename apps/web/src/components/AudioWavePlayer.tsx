import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface AudioWavePlayerProps {
  src: string;
  duration?: number; // Duration in seconds if known (e.g. from recordingDuration)
  title?: string;
  className?: string;
  accentColor?: string; // hex or tailwind class
  compact?: boolean;
}

// 42 normalized heights (0.15 to 0.95) resembling natural voice speech frequencies
const WAVE_BAR_PROFILE = [
  0.22, 0.35, 0.48, 0.65, 0.38, 0.52, 0.85, 0.72, 0.92, 0.60,
  0.42, 0.78, 0.95, 0.68, 0.50, 0.82, 0.75, 0.45, 0.62, 0.88,
  0.94, 0.70, 0.40, 0.58, 0.80, 0.91, 0.66, 0.44, 0.72, 0.85,
  0.55, 0.36, 0.62, 0.78, 0.52, 0.40, 0.68, 0.50, 0.34, 0.28,
  0.20, 0.15
];

export const AudioWavePlayer: React.FC<AudioWavePlayerProps> = ({
  src,
  duration: initialDuration,
  title,
  className = '',
  accentColor = '#4E342E',
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(() => {
    return (initialDuration && initialDuration > 0) ? initialDuration : 0;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; time: number } | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  // Sync initialDuration if it changes or updates
  useEffect(() => {
    if (initialDuration && initialDuration > 0 && initialDuration !== totalDuration) {
      setTotalDuration(initialDuration);
    }
  }, [initialDuration]);

  // Decode audio buffer via AudioContext to resolve finite duration for WebM blobs and streaming files
  useEffect(() => {
    if (!src) return;
    let isMounted = true;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      fetch(src)
        .then((res) => res.arrayBuffer())
        .then((buf) => {
          const ctx = new AudioCtx();
          return ctx.decodeAudioData(buf).then((decoded) => {
            ctx.close().catch(() => {});
            return decoded.duration;
          });
        })
        .then((dur) => {
          if (isMounted && dur && isFinite(dur) && dur > 0) {
            setTotalDuration(dur);
          }
        })
        .catch((err) => {
          console.warn('[AudioWavePlayer AudioContext decode error]', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (isFinite(audioDuration) && !isNaN(audioDuration) && audioDuration > 0) {
        setTotalDuration(audioDuration);
      } else if (initialDuration && initialDuration > 0) {
        setTotalDuration(initialDuration);
      } else {
        const el = audioRef.current;
        const onSeeked = () => {
          el.removeEventListener('seeked', onSeeked);
          const computed = isFinite(el.duration) && el.duration > 0 ? el.duration : el.currentTime;
          if (isFinite(computed) && computed > 0) {
            setTotalDuration(computed);
          }
          el.currentTime = 0;
        };
        el.addEventListener('seeked', onSeeked);
        try {
          el.currentTime = 1e101;
        } catch (_) {}
      }
    }
  };

  // Ultra-smooth 60fps playback progress loop
  const updateProgress = useCallback(() => {
    if (audioRef.current && isPlaying) {
      const curr = audioRef.current.currentTime;
      setCurrentTime(curr);

      // Auto-detect duration if it wasn't finite initially
      const audioDur = audioRef.current.duration;
      if (isFinite(audioDur) && !isNaN(audioDur) && audioDur > 0 && totalDuration === 0) {
        setTotalDuration(audioDur);
      }

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isPlaying, totalDuration]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  // Play / Pause toggle
  const togglePlay = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // If ended, restart from 0
        if (currentTime >= (totalDuration || 1) - 0.1) {
          audioRef.current.currentTime = 0;
          setCurrentTime(0);
        }
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
      setIsPlaying(false);
    }
  };

  // Replay from start
  const handleReset = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const safeDuration = (totalDuration && isFinite(totalDuration) && totalDuration > 0)
    ? totalDuration
    : (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : Math.max(currentTime, 1);

  // Seeking logic based on click or drag
  const seekToPosition = (clientX: number) => {
    if (!progressBarRef.current || !audioRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const targetTime = percentage * safeDuration;

    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsSeeking(true);
    seekToPosition(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const moveX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const hoverTime = (moveX / rect.width) * (safeDuration || 0);
    setHoverPosition({ x: moveX, time: hoverTime });

    if (isSeeking) {
      seekToPosition(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSeeking) {
      setIsSeeking(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Cycle playback speed
  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  // Format seconds into m:ss
  const formatTime = (secs: number) => {
    if (!secs || !isFinite(secs) || isNaN(secs) || secs <= 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const remSecs = Math.floor(secs % 60);
    return `${mins}:${remSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = safeDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))
    : 0;

  return (
    <div
      className={`relative w-full rounded-2xl bg-white border border-[#E2E8F0]/80 shadow-sm p-3.5 transition-all hover:border-[#CBD5E1] ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={() => {
          if (!isPlaying && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(totalDuration);
        }}
      />

      <div className="flex items-center gap-3">
        {/* Play / Pause Action Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`relative group shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
            isPlaying
              ? 'bg-[#0F172A] text-amber-200 ring-4 ring-[#4E342E]/20'
              : 'bg-[#006FFF] hover:bg-[#0058D4] text-white hover:scale-105'
          }`}
          title={isPlaying ? 'Pause' : 'Play audio'}
          aria-label={isPlaying ? 'Pause' : 'Play audio'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}

          {/* Pulsing ring while playing */}
          {isPlaying && (
            <span className="absolute -inset-1 rounded-full border-2 border-[#006FFF]/40 animate-ping pointer-events-none opacity-70" />
          )}
        </button>

        {/* Current Time Display */}
        <div className="shrink-0 text-xs font-mono font-bold text-[#006FFF] w-10 text-center select-none">
          {formatTime(currentTime)}
        </div>

        {/* Interactive Animated Waveform & Audio Line Track */}
        <div className="flex-1 flex flex-col justify-center min-w-0 select-none">
          <div
            ref={progressBarRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              if (!isSeeking) setHoverPosition(null);
            }}
            className="group/track relative flex flex-col justify-center cursor-pointer py-1.5 px-1"
          >
            {/* Waveform Bars */}
            <div className="w-full h-7 flex items-center justify-between gap-[2px] sm:gap-[3px] pointer-events-none mb-1.5">
              {WAVE_BAR_PROFILE.map((barHeight, idx) => {
                const barPercent = (idx / (WAVE_BAR_PROFILE.length - 1)) * 100;
                const isPassed = barPercent <= progressPercent;
                const animationDelay = `${(idx % 8) * 0.1}s`;

                return (
                  <div
                    key={idx}
                    className="flex-1 flex items-center justify-center h-full"
                  >
                    <span
                      style={{
                        height: `${Math.round(barHeight * 100)}%`,
                        animationDelay: isPlaying ? animationDelay : '0s',
                      }}
                      className={`w-full max-w-[4px] rounded-full transition-[height] duration-100 ${
                        isPassed
                          ? isPlaying
                            ? 'bg-[#0F172A] animate-[audio-wave_1s_ease-in-out_infinite_alternate]'
                            : 'bg-[#006FFF]'
                          : 'bg-[#D7CCC8]/70 group-hover/track:bg-[#BCAAA4]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Seamless Audio Line Scrubber Track */}
            <div className="relative w-full h-1.5 rounded-full bg-[#F1F5F9] pointer-events-none">
              {/* Filled Played Progress Line */}
              <div
                style={{ width: `${progressPercent}%` }}
                className="absolute left-0 top-0 bottom-0 rounded-full bg-[#006FFF]"
              >
                {/* Scrubber Thumb Knob - Physically anchored at the leading tip of the progress line! */}
                <div
                  className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#006FFF] shadow-md transition-transform pointer-events-none ${
                    isSeeking ? 'scale-125 ring-2 ring-amber-400' : 'group-hover/track:scale-110'
                  }`}
                />
              </div>
            </div>

            {/* Hover Tooltip showing preview time */}
            {hoverPosition && (
              <div
                style={{ left: `${hoverPosition.x}px` }}
                className="absolute -top-7 -translate-x-1/2 bg-[#2D1E18] text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md shadow pointer-events-none whitespace-nowrap z-20"
              >
                {formatTime(hoverPosition.time)}
              </div>
            )}
          </div>
        </div>

        {/* Total Duration Readout */}
        <div className="shrink-0 text-xs font-mono font-medium text-[#94A3B8] w-10 text-center select-none">
          {formatTime(totalDuration && isFinite(totalDuration) && totalDuration > 0 ? totalDuration : (safeDuration > 1 ? safeDuration : 0))}
        </div>

        {/* Speed Multiplier Button */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="shrink-0 px-2 py-1 text-[11px] font-bold font-mono rounded-lg border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors"
          title={`Playback Speed: ${playbackRate}x`}
        >
          {playbackRate}x
        </button>

        {/* Mute / Unmute Button */}
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.muted = !isMuted;
              setIsMuted(!isMuted);
            }
          }}
          className="shrink-0 p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-600" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Optional Live Indicator Pill when playing */}
      {isPlaying && (
        <div className="mt-2 pt-2 border-t border-[#F5EBE6] flex items-center justify-between text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Audio line active • Playing at {playbackRate}x
          </span>
          <span className="font-mono text-[#94A3B8]">
            {Math.round(progressPercent)}% completed
          </span>
        </div>
      )}
    </div>
  );
};

