import React, { useEffect, useRef, useState } from 'react';
import { Square, Mic } from 'lucide-react';

interface LiveAudioVisualizerProps {
  stream?: MediaStream | null;
  duration: number; // in seconds
  onStop: () => void;
  formatDuration: (seconds: number) => string;
}

const BAR_COUNT = 32;

export const LiveAudioVisualizer: React.FC<LiveAudioVisualizerProps> = ({
  stream,
  duration,
  onStop,
  formatDuration,
}) => {
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 15)
  );
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Produces 32 frequency bins
      analyser.smoothingTimeConstant = 0.8;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let phase = 0;

      const renderFrame = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate average speech volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Compute bar heights (percentage 15% to 100%)
        const nextHeights: number[] = [];
        phase += 0.08;

        for (let i = 0; i < BAR_COUNT; i++) {
          const rawVal = dataArray[i % bufferLength] || 0;
          // Add an organic subtle undulating wave so it's always animated even in silence
          const idleWave = Math.sin(phase + i * 0.4) * 8;
          const liveScale = (rawVal / 255) * 85;
          const height = Math.max(12, Math.min(100, Math.round(15 + liveScale + idleWave)));
          nextHeights.push(height);
        }

        setBarHeights(nextHeights);
        animationFrameRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (err) {
      console.warn('Live audio context not initialized, falling back to simulated wave:', err);
      // Fallback breathing animation
      let step = 0;
      const interval = setInterval(() => {
        step += 0.15;
        setBarHeights((prev) =>
          prev.map((_, i) => Math.max(15, Math.min(95, Math.round(30 + Math.sin(step + i * 0.5) * 25))))
        );
      }, 50);

      return () => clearInterval(interval);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream]);

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-b from-rose-50/80 via-white to-amber-50/40 border border-rose-200 shadow-sm space-y-4 text-center">
      {/* Header Pill */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100/90 border border-rose-300 text-rose-800 text-xs font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
          </span>
          <span>Microphone Live</span>
        </div>

        <div className="text-sm font-bold font-mono text-rose-700 tracking-wider">
          {formatDuration(duration)}
        </div>
      </div>

      {/* Live Audio Animated Waveform Line */}
      <div className="relative py-2 px-2 bg-white/80 rounded-xl border border-rose-100 shadow-inner">
        <div className="h-16 flex items-center justify-between gap-1 sm:gap-1.5 px-2">
          {barHeights.map((h, i) => (
            <div key={i} className="flex-1 flex items-center justify-center h-full">
              <span
                style={{ height: `${h}%` }}
                className="w-full max-w-[5px] rounded-full bg-gradient-to-t from-rose-600 via-amber-600 to-rose-400 transition-all duration-75 shadow-sm"
              />
            </div>
          ))}
        </div>

        {/* Central audio zero line */}
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[1px] bg-rose-200/50 pointer-events-none" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5 font-medium">
          <Mic className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
          Speaking... Voice line actively monitoring audio levels
        </p>

        {/* Stop Recording Button */}
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl font-semibold text-xs shadow-md transition-all active:scale-95 hover:shadow-lg"
        >
          <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
          Stop Recording
        </button>
      </div>
    </div>
  );
};

