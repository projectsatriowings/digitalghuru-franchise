import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FileText,
  AlertCircle,
  Headphones,
  Eye,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { apiFetch, getMaterialDownloadUrl } from '../services/api';

export interface MaterialViewerModalProps {
  material: {
    id: string;
    title: string;
    description?: string | null;
    content?: string | null;
    type: 'PDF' | 'IMAGE' | 'AUDIO' | 'VOICE_NOTE' | 'TEXT' | 'DOCUMENT' | 'HOMEWORK' | 'ANNOUNCEMENT';
    fileName?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
    fileUrl?: string | null;
    batch?: { name: string };
    subject?: { name: string } | null;
    createdAt?: string;
  };
  onClose: () => void;
}

export const MaterialViewerModal: React.FC<MaterialViewerModalProps> = ({ material, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioCompleted, setAudioCompleted] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const downloadUrl = material.id ? getMaterialDownloadUrl(material.id) : '';

  const isAudio = material.type === 'AUDIO' || material.type === 'VOICE_NOTE';
  const isImage = material.type === 'IMAGE' || (material.mimeType && material.mimeType.startsWith('image/'));
  const isPdf = material.type === 'PDF' || material.mimeType === 'application/pdf' || material.fileName?.toLowerCase().endsWith('.pdf');
  const isText = material.type === 'TEXT' || (!material.fileUrl && !!material.content);

  // Track initial material open (separated from completion)
  useEffect(() => {
    if (material.id) {
      apiFetch(`/materials/${material.id}/track`, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'OPENED' }),
      }).catch(() => {
        // Non-blocking telemetry
      });
    }
  }, [material.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose]);

  // Audio time update & completion tracker
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);

      const audioDur = audioRef.current.duration;
      if (isFinite(audioDur) && !isNaN(audioDur) && audioDur > 0 && (!duration || !isFinite(duration) || duration <= 0)) {
        setDuration(audioDur);
      }

      const effectiveDur = (duration && isFinite(duration) && duration > 0)
        ? duration
        : (isFinite(audioDur) && audioDur > 0 ? audioDur : 0);

      if (effectiveDur > 0) {
        const percent = (cur / effectiveDur) * 100;
        if (percent >= 95 && !audioCompleted) {
          setAudioCompleted(true);
          apiFetch(`/materials/${material.id}/track`, {
            method: 'POST',
            body: JSON.stringify({
              eventType: 'AUDIO_COMPLETED',
              progressPercent: 100,
              durationSeconds: effectiveDur,
            }),
          }).catch(() => {});
        }
      }
    }
  };

  // Resolve true duration for WebM blobs and streaming files where audio.duration is Infinity
  useEffect(() => {
    if (!downloadUrl || !isAudio) return;

    let isMounted = true;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      fetch(downloadUrl)
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
            setDuration(dur);
          }
        })
        .catch((err) => {
          console.warn('[AudioContext Decode Duration Fallback]', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [downloadUrl, isAudio]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || !isFinite(sec) || isNaN(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        ref={containerRef}
        className={`bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-[96vw] max-w-[1400px] h-[93vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-white border-b border-[#E2E8F0] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#006FFF]/10 flex items-center justify-center text-[#006FFF] shrink-0">
              {isAudio ? <Headphones className="w-5 h-5" /> : isImage ? <Eye className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#0F172A] truncate leading-tight">
                {material.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                <span>{material.subject?.name || 'Batch-wide'}</span>
                <span>&bull;</span>
                <span>{material.batch?.name}</span>
                {material.fileSize ? (
                  <>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px]">{formatFileSize(material.fileSize)}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isImage && (
              <div className="flex items-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-0.5 mr-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-white rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-semibold px-1 text-[#64748B]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-white rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-white rounded-lg transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {material.fileUrl && (
              <>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl hover:bg-[#D7CCC8]/30 text-[#64748B] hover:text-[#0F172A] transition-colors"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                <a
                  href={downloadUrl}
                  download={material.fileName || 'material'}
                  className="p-2 rounded-xl bg-[#006FFF]/10 hover:bg-[#006FFF] text-[#006FFF] hover:text-white transition-colors"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
              </>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl hover:bg-[#D7CCC8]/30 text-[#64748B] hover:text-[#0F172A] transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-rose-50 text-[#64748B] hover:text-rose-700 transition-colors ml-1"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className={`flex-1 overflow-auto relative bg-[#ECE6E1] flex flex-col items-center justify-center ${isPdf ? 'p-0' : 'p-2 sm:p-4'}`}>
          {/* PDF Viewer */}
          {isPdf && material.fileUrl && (
            <div className="w-full h-full overflow-hidden bg-white shadow-sm flex flex-col">
              <iframe
                src={`${downloadUrl}#page=1&view=FitH`}
                className="w-full h-full border-0"
                title={material.title}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setHasError(true);
                }}
              />
            </div>
          )}

          {/* Image Viewer */}
          {isImage && material.fileUrl && (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={downloadUrl}
                alt={material.title}
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-150 shadow-md"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setHasError(true);
                }}
              />
            </div>
          )}

          {/* Audio Player */}
          {isAudio && material.fileUrl && (
            <div className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-lg space-y-6 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#006FFF]/10 flex items-center justify-center text-[#006FFF]">
                <Headphones className="w-10 h-10 animate-pulse" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">{material.title}</h3>
                <p className="text-xs text-[#64748B] mt-1">{material.description || 'Audio recording / study lecture'}</p>
              </div>

              <audio
                ref={audioRef}
                src={downloadUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  const audioDur = el.duration;
                  if (isFinite(audioDur) && !isNaN(audioDur) && audioDur > 0) {
                    setDuration(audioDur);
                  } else {
                    // Chromium seek-to-end fallback for WebM Infinity duration
                    const onSeeked = () => {
                      el.removeEventListener('seeked', onSeeked);
                      const computedDur = isFinite(el.duration) && el.duration > 0
                        ? el.duration
                        : el.currentTime;
                      if (isFinite(computedDur) && computedDur > 0) {
                        setDuration(computedDur);
                      }
                      el.currentTime = 0;
                    };
                    el.addEventListener('seeked', onSeeked);
                    try {
                      el.currentTime = 1e101;
                    } catch (_) {}
                  }
                  setLoading(false);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setAudioCompleted(true);
                  apiFetch(`/materials/${material.id}/track`, {
                    method: 'POST',
                    body: JSON.stringify({ eventType: 'AUDIO_COMPLETED', progressPercent: 100 }),
                  }).catch(() => {});
                }}
                onError={() => {
                  setLoading(false);
                  setHasError(true);
                }}
              />

              {/* Scrubber with Animated Audio Waveform Line */}
              {(() => {
                const safeDuration = (duration && isFinite(duration) && duration > 0)
                  ? duration
                  : (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
                  ? audioRef.current.duration
                  : Math.max(currentTime, 1);

                const progressPercent = safeDuration > 0
                  ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100))
                  : 0;

                return (
                  <div className="space-y-2">
                    <div
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const newTime = ratio * safeDuration;
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                          setCurrentTime(newTime);
                        }
                      }}
                      className="group relative h-12 flex flex-col justify-center cursor-pointer p-1 rounded-xl hover:bg-[#F8FAFC] transition-colors"
                    >
                      {/* Waveform Bars */}
                      <div className="w-full h-8 flex items-center justify-between gap-[3px] pointer-events-none px-1">
                        {[
                          0.25, 0.4, 0.6, 0.8, 0.45, 0.9, 0.75, 0.5, 0.85, 0.65,
                          0.35, 0.7, 0.95, 0.8, 0.4, 0.6, 0.85, 0.7, 0.5, 0.9,
                          0.65, 0.45, 0.8, 0.95, 0.7, 0.4, 0.65, 0.8, 0.55, 0.35,
                          0.6, 0.75, 0.45, 0.3
                        ].map((barHeight, idx) => {
                          const barPercent = (idx / 33) * 100;
                          const isPassed = barPercent <= progressPercent;
                          return (
                            <div key={idx} className="flex-1 flex items-center justify-center h-full">
                              <span
                                style={{
                                  height: `${Math.round(barHeight * 100)}%`,
                                  animationDelay: isPlaying ? `${(idx % 6) * 0.12}s` : '0s',
                                }}
                                className={`w-full max-w-[4px] rounded-full transition-all duration-150 ${
                                  isPassed
                                    ? 'bg-[#006FFF]'
                                    : 'bg-[#D7CCC8]/60 group-hover:bg-[#BCAAA4]'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Audio Line Track */}
                      <div className="relative w-full h-1.5 rounded-full bg-[#F1F5F9] mt-1 pointer-events-none">
                        <div
                          style={{ width: `${progressPercent}%` }}
                          className="absolute left-0 top-0 bottom-0 rounded-full bg-[#006FFF]"
                        >
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#006FFF] shadow-sm" />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs font-mono text-[#94A3B8] px-1">
                      <span>{formatSeconds(currentTime)}</span>
                      <span>{formatSeconds(duration && isFinite(duration) && duration > 0 ? duration : (safeDuration > 1 ? safeDuration : 0))}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={cyclePlaybackRate}
                  className="px-2.5 py-1 text-xs font-bold font-mono rounded-lg border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC]"
                  title="Playback Speed"
                >
                  {playbackRate}x
                </button>

                <button
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-[#006FFF] hover:bg-[#0058D4] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.muted = !isMuted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="p-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-rose-600" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              {audioCompleted && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 py-1.5 px-3 rounded-full border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Playback Completed</span>
                </div>
              )}
            </div>
          )}

          {/* Text Study Notes Viewer */}
          {isText && (
            <div className="max-w-3xl w-full h-full bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-sm overflow-auto">
              {material.description && (
                <div className="mb-4 pb-3 border-b border-[#E2E8F0]">
                  <h4 className="text-xs uppercase font-bold text-[#94A3B8] tracking-wider mb-1">Study Instructions</h4>
                  <p className="text-xs text-[#006FFF] italic">{material.description}</p>
                </div>
              )}
              <div className="prose prose-stone text-sm text-[#0F172A] whitespace-pre-wrap leading-relaxed font-sans">
                {material.content || 'No text content available for this study note.'}
              </div>
            </div>
          )}

          {/* Unsupported File Type Fallback */}
          {!isPdf && !isImage && !isAudio && !isText && (
            <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-[#E2E8F0] text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#006FFF]/10 flex items-center justify-center text-[#006FFF]">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">{material.title}</h3>
                <p className="text-xs text-[#64748B] mt-1">
                  {material.fileName || 'Educational Attachment'} ({formatFileSize(material.fileSize)})
                </p>
                <p className="text-xs text-[#94A3B8] mt-2">
                  In-page preview is not supported for this file format ({material.mimeType || 'binary'}). You can download and open it in your system viewer.
                </p>
              </div>
              <a
                href={downloadUrl}
                download={material.fileName || 'material'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-semibold text-xs shadow-sm"
              >
                <Download className="w-4 h-4" /> Download / Open Attachment
              </a>
            </div>
          )}

          {/* Error State */}
          {hasError && (
            <div className="absolute inset-4 rounded-xl bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 space-y-3 z-10">
              <AlertCircle className="w-10 h-10 text-rose-600" />
              <div>
                <h4 className="font-bold text-sm text-[#0F172A]">Unable to Preview File</h4>
                <p className="text-xs text-[#64748B] mt-1">The attachment could not be rendered inside the modal.</p>
              </div>
              <a
                href={downloadUrl}
                download={material.fileName || 'material'}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white rounded-xl text-xs font-semibold"
              >
                <Download className="w-4 h-4" /> Download File Instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
