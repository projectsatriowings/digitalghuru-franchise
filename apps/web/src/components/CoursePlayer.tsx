import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlayCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  ChevronLeft,
  Menu,
  X,
  Download,
  Award,
  Sparkles,
  Loader2,
  Laptop,
  Building2,
  Paperclip,
  Trophy,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import { openMediaResource } from '../utils/mediaHelper';

export interface ParsedVideoEmbed {
  type: 'youtube' | 'gdrive' | 'vimeo' | 'loom' | 'dailymotion' | 'direct';
  src: string;
}

/**
 * Robust video source parser supporting YouTube (all link shapes), Google Drive,
 * Vimeo, Loom, Dailymotion, Dropbox direct links, and standard direct HTML5 streams.
 */
export function parseVideoSource(rawUrl?: string | null): ParsedVideoEmbed | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // 1. YouTube (handles /watch?v=, youtu.be/, /embed/, /shorts/, /live/, m.youtube.com)
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      src: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`,
    };
  }

  // 2. Google Drive preview embed
  if (url.includes('drive.google.com') || url.includes('docs.google.com/file')) {
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return {
        type: 'gdrive',
        src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      };
    }
  }

  // 3. Vimeo embed
  const vimeoMatch = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?badge=0&autopause=0&player_id=0`,
    };
  }

  // 4. Loom embed
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9_-]+)/i);
  if (loomMatch && loomMatch[1]) {
    return {
      type: 'loom',
      src: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  // 5. Dailymotion embed
  const dailyMatch = url.match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
  if (dailyMatch && dailyMatch[1]) {
    return {
      type: 'dailymotion',
      src: `https://www.dailymotion.com/embed/video/${dailyMatch[1]}`,
    };
  }

  // 6. Dropbox (direct video stream normalization)
  if (url.includes('dropbox.com')) {
    let cleanDropbox = url.replace(/[?&]dl=0/g, '');
    cleanDropbox += (cleanDropbox.includes('?') ? '&' : '?') + 'raw=1';
    return {
      type: 'direct',
      src: cleanDropbox,
    };
  }

  // Default: Direct HTML5 video element (MP4, WebM, HLS, local protected media stream)
  return {
    type: 'direct',
    src: url,
  };
}

/**
 * Requests a short-lived media access token bound to the current user, course, and file.
 * Normal login JWTs are never exposed in media URLs.
 */
async function requestShortLivedMediaUrl(courseId: string, rawUrl?: string | null): Promise<string> {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    if (!rawUrl.includes('/media/protected/') && !rawUrl.includes('/uploads/courses/')) {
      return rawUrl;
    }
  }
  try {
    const res = await apiFetch('/courses/media-token', {
      method: 'POST',
      body: JSON.stringify({ courseId, mediaUrl: rawUrl }),
    });
    if (res.data?.mediaUrl) {
      return res.data.mediaUrl;
    }
  } catch (err) {
    console.warn('[CoursePlayer] Could not acquire short-lived media token:', err);
  }
  return rawUrl;
}

interface CoursePlayerProps {
  courseId: string;
  onBack: () => void;
  onProgressUpdated?: () => void;
  onCertificateClaimed?: (cert: any) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseId,
  onBack,
  onProgressUpdated,
  onCertificateClaimed,
}) => {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [enrollmentContext, setEnrollmentContext] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalChapters: number; completedChapters: number; progressPercent: number; isCourseCompleted: boolean }>({
    totalChapters: 0,
    completedChapters: 0,
    progressPercent: 0,
    isCourseCompleted: false,
  });

  const [expandedModule, setExpandedModule] = useState<number>(0);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [claimingCert, setClaimingCert] = useState(false);
  const [xpBanner, setXpBanner] = useState<string>('');
  const [levelUpData, setLevelUpData] = useState<{ show: boolean; newLevel: number }>({
    show: false,
    newLevel: 0,
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [videoMediaUrl, setVideoMediaUrl] = useState<string>('');
  const [isVideoLoading, setIsVideoLoading] = useState<boolean>(false);
  const [streamErrorState, setStreamErrorState] = useState<{
    title: string;
    message: string;
    isExternal: boolean;
    url: string;
  } | null>(null);

  const [actualDurations, setActualDurations] = useState<Record<string, string>>({});

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const retryCountRef = useRef<number>(0);
  const pendingSeekRef = useRef<{ time: number; play: boolean } | null>(null);

  // Automatically request short-lived media token for active lesson video
  useEffect(() => {
    let isCancelled = false;
    retryCountRef.current = 0;
    setStreamErrorState(null);
    pendingSeekRef.current = null;

    const rawUrl = activeLesson?.videoUrl;
    if (!rawUrl) {
      setVideoMediaUrl('');
      setIsVideoLoading(false);
      return;
    }

    const parsed = parseVideoSource(rawUrl);
    if (!parsed) {
      setVideoMediaUrl('');
      setIsVideoLoading(false);
      return;
    }

    // Embeddable iframe providers (YouTube, Google Drive, Vimeo, Loom, Dailymotion)
    if (parsed.type !== 'direct') {
      setVideoMediaUrl(parsed.src);
      setIsVideoLoading(false);
      return;
    }

    // Direct video: Check if it's an internal protected media asset
    const isInternalProtected = parsed.src.includes('/media/protected/') || parsed.src.includes('/uploads/courses/');
    if (!isInternalProtected) {
      // External MP4/WebM/Dropbox URL
      setVideoMediaUrl(parsed.src);
      setIsVideoLoading(false);
      return;
    }

    // Internal protected asset: request short-lived media authorization token
    setIsVideoLoading(true);
    requestShortLivedMediaUrl(courseId, parsed.src)
      .then((tokenUrl) => {
        if (!isCancelled) {
          setVideoMediaUrl(tokenUrl);
        }
      })
      .catch((err) => {
        console.warn('Failed to obtain short-lived media token for lesson video:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsVideoLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [courseId, activeLesson?.id, activeLesson?.videoUrl]);

  // Proactive token refresh before 15-minute token expiry during continuous playback (refreshes at 12 minutes)
  useEffect(() => {
    if (!videoMediaUrl || (!videoMediaUrl.includes('mt=') && !videoMediaUrl.includes('token='))) {
      return;
    }

    const refreshTimer = setTimeout(async () => {
      try {
        const savedTime = videoRef.current?.currentTime || 0;
        const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
        const freshUrl = await requestShortLivedMediaUrl(courseId, activeLesson?.videoUrl);
        if (freshUrl && freshUrl !== videoMediaUrl) {
          pendingSeekRef.current = { time: savedTime, play: wasPlaying };
          setVideoMediaUrl(freshUrl);
        }
      } catch (err) {
        console.warn('[CoursePlayer] Proactive media token refresh failed:', err);
      }
    }, 12 * 60 * 1000); // 12 minutes

    return () => clearTimeout(refreshTimer);
  }, [videoMediaUrl, courseId, activeLesson?.videoUrl]);

  const handleOpenResource = async (rawUrl?: string | null, type: 'pdf' | 'video' | 'attachment' = 'pdf') => {
    if (!rawUrl) return;
    await openMediaResource({
      url: rawUrl,
      courseId,
      type,
      onError: (msg) => toast.error(msg),
    });
  };

  const loadPlayer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/courses/learning/${courseId}`, { skipCache: true });
      const data = res.data;
      setCourseInfo(data.course);
      setEnrollmentContext(data.enrollmentContext);
      setStats(data.stats);

      const rawModules = data.modules || data.curriculum || [];
      const loadedModules = rawModules.map((m: any) => ({
        ...m,
        chapters: [...(m.chapters || m.lessons || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
        lessons: [...(m.chapters || m.lessons || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
      })).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
      setModules(loadedModules);

      // Jump to first incomplete lesson or first lesson
      let targetModIdx = 0;
      let targetLesson = loadedModules[0]?.chapters?.[0] || loadedModules[0]?.lessons?.[0] || null;
      for (let i = 0; i < loadedModules.length; i++) {
        const lessons = loadedModules[i].chapters || loadedModules[i].lessons || [];
        const uncompleted = lessons.find((l: any) => !l.isCompleted);
        if (uncompleted) {
          targetModIdx = i;
          targetLesson = uncompleted;
          break;
        }
      }
      setExpandedModule(targetModIdx);
      setActiveLesson(targetLesson);
    } catch (err: any) {
      setError(err.message || 'Failed to load course curriculum');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadPlayer();
  }, [loadPlayer]);

  const handleLessonSelect = (lesson: any, moduleIdx: number) => {
    setActiveLesson(lesson);
    setExpandedModule(moduleIdx);
    setIsMobileSidebarOpen(false);
  };

  const handleCompleteAndNext = async () => {
    if (!activeLesson || isCompleting) return;
    setIsCompleting(true);

    try {
      const res = await apiFetch('/courses/learning/complete-lesson', {
        method: 'POST',
        body: JSON.stringify({
          courseId,
          chapterId: activeLesson.id,
          timeSpentSec: 120,
        }),
      });
      const result = res.data || {};

      // Mark activeLesson complete locally
      const wasCompleted = Boolean(activeLesson.isCompleted);
      const updatedModules = modules.map((mod) => ({
        ...mod,
        chapters: (mod.chapters || []).map((ch: any) =>
          ch.id === activeLesson.id ? { ...ch, isCompleted: true } : ch
        ),
        lessons: (mod.lessons || []).map((ch: any) =>
          ch.id === activeLesson.id ? { ...ch, isCompleted: true } : ch
        ),
      }));
      setModules(updatedModules);

      // Recompute progress stats cleanly
      const allLessons = updatedModules.flatMap((m) => m.chapters || m.lessons || []);
      const completedTotal = allLessons.filter((l) => l.isCompleted).length;
      const totalCount = allLessons.length;
      setStats({
        totalChapters: totalCount,
        completedChapters: completedTotal,
        progressPercent: totalCount > 0 ? Math.round((completedTotal / totalCount) * 100) : 0,
        isCourseCompleted: totalCount > 0 && completedTotal === totalCount,
      });

      if (!wasCompleted && result.xpAwarded > 0) {
        setXpBanner(`+${result.xpAwarded} XP Earned!`);
        setTimeout(() => setXpBanner(''), 3500);
      }

      if (result.leveledUp && result.newLevel) {
        setLevelUpData({ show: true, newLevel: result.newLevel });
      }

      if (result.courseJustCompleted) {
        toast.success('Congratulations! Course 100% Completed! You can now claim your certificate.');
      }

      // Find next lesson
      let foundCurrent = false;
      let nextLesson: any = null;
      let nextModIdx = expandedModule;

      for (let i = 0; i < updatedModules.length; i++) {
        const list = updatedModules[i].chapters || updatedModules[i].lessons || [];
        for (let j = 0; j < list.length; j++) {
          if (foundCurrent) {
            nextLesson = list[j];
            nextModIdx = i;
            break;
          }
          if (list[j].id === activeLesson.id) {
            foundCurrent = true;
          }
        }
        if (nextLesson) break;
      }

      if (nextLesson) {
        setActiveLesson(nextLesson);
        setExpandedModule(nextModIdx);
      } else {
        setActiveLesson({ ...activeLesson, isCompleted: true });
      }

      onProgressUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save lesson progress');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleClaimCertificate = async () => {
    setClaimingCert(true);
    try {
      const res = await apiFetch('/courses/certificates/claim', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      toast.success(`Certificate Issued: ${res.data?.certificateNumber}`);
      onCertificateClaimed?.(res.data);
      onProgressUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Unable to claim certificate yet');
    } finally {
      setClaimingCert(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#006FFF] mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading Digital Ghuru Course Player...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center space-y-4">
        <p className="text-sm font-bold text-rose-700">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
        >
          Back to My Courses
        </button>
      </div>
    );
  }

  const renderVideoStage = () => {
    const rawUrl = activeLesson?.videoUrl;
    if (!rawUrl) {
      return (
        <div className="text-center px-6 py-10 space-y-2">
          <PlayCircle className="w-14 h-14 text-amber-400/70 mx-auto" />
          <h3 className="text-white font-display font-bold text-xl">{activeLesson?.title || 'Select a Lesson'}</h3>
          <p className="text-amber-300 text-xs font-bold tracking-wider uppercase">
            Reading / Practical Lesson (No Video Attached Yet)
          </p>
        </div>
      );
    }

    const parsed = parseVideoSource(rawUrl);
    if (!parsed) {
      return (
        <div className="text-center px-6 py-10 space-y-2">
          <PlayCircle className="w-14 h-14 text-amber-400/70 mx-auto" />
          <h3 className="text-white font-display font-bold text-xl">{activeLesson?.title || 'Select a Lesson'}</h3>
          <p className="text-amber-300 text-xs font-bold tracking-wider uppercase">
            Reading / Practical Lesson (No Video Attached Yet)
          </p>
        </div>
      );
    }

    // Embeddable iframe providers (YouTube, Google Drive, Vimeo, Loom, Dailymotion)
    if (parsed.type !== 'direct') {
      return (
        <iframe
          src={parsed.src}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          title={activeLesson?.title || 'Lesson Video'}
        />
      );
    }

    // Direct MP4/WebM/Stream video
    if (streamErrorState) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-slate-900 text-white rounded-2xl h-full min-h-[360px]">
          <AlertCircle className="w-12 h-12 text-rose-500 animate-pulse" />
          <div className="text-center space-y-1.5 max-w-md">
            <h3 className="text-base font-bold text-white">{streamErrorState.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{streamErrorState.message}</p>
            {streamErrorState.isExternal && (
              <p
                className="text-[11px] font-mono text-slate-400 truncate max-w-sm mt-1 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/60"
                title={streamErrorState.url}
              >
                {streamErrorState.url}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {streamErrorState.isExternal && (
              <button
                type="button"
                onClick={() => window.open(streamErrorState.url, '_blank', 'noopener,noreferrer')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Video in New Window
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                setStreamErrorState(null);
                retryCountRef.current = 0;
                setIsVideoLoading(true);
                const isInternal = parsed.src.includes('/media/protected/') || parsed.src.includes('/uploads/courses/');
                if (isInternal) {
                  const freshUrl = await requestShortLivedMediaUrl(courseId, activeLesson?.videoUrl);
                  setVideoMediaUrl(freshUrl);
                } else {
                  setVideoMediaUrl(parsed.src + (parsed.src.includes('?') ? '&' : '?') + '_r=' + Date.now());
                }
                setIsVideoLoading(false);
              }}
              className="px-5 py-2 bg-[#006FFF] hover:bg-blue-600 rounded-xl text-xs font-bold text-white transition-colors shadow-md cursor-pointer"
            >
              Retry Playback
            </button>
          </div>
        </div>
      );
    }

    if (isVideoLoading && !videoMediaUrl) {
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#006FFF]" />
          <p className="text-xs text-slate-300 font-semibold">Authorizing secure stream...</p>
        </div>
      );
    }

    return (
      <video
        ref={videoRef}
        key={activeLesson?.id || 'active-video'}
        src={videoMediaUrl}
        controls
        className="w-full h-full object-contain bg-black"
        onEnded={handleCompleteAndNext}
        onLoadedMetadata={() => {
          setStreamErrorState(null);
          retryCountRef.current = 0;
          if (videoRef.current && activeLesson?.id && videoRef.current.duration) {
            const formatted = formatDuration(videoRef.current.duration);
            if (formatted) {
              setActualDurations((prev) => ({ ...prev, [activeLesson.id]: formatted }));
            }
          }
          if (pendingSeekRef.current && videoRef.current) {
            const { time, play } = pendingSeekRef.current;
            pendingSeekRef.current = null;
            if (time > 0) {
              videoRef.current.currentTime = time;
            }
            if (play) {
              videoRef.current.play().catch(() => {});
            }
          }
        }}
        onError={async () => {
          const isInternal = videoMediaUrl.includes('/media/protected/') || videoMediaUrl.includes('/uploads/courses/');

          // For internal protected assets, execute one automatic token refresh attempt
          if (isInternal && retryCountRef.current < 1) {
            retryCountRef.current += 1;
            console.warn('[CoursePlayer] Internal stream token refresh attempt (retry #1)...');
            const savedTime = videoRef.current?.currentTime || 0;
            const wasPlaying = videoRef.current ? !videoRef.current.paused : false;
            const freshUrl = await requestShortLivedMediaUrl(courseId, activeLesson?.videoUrl);
            if (freshUrl && freshUrl !== videoMediaUrl) {
              pendingSeekRef.current = { time: savedTime, play: wasPlaying };
              setVideoMediaUrl(freshUrl);
              return;
            }
          }

          if (isInternal) {
            setStreamErrorState({
              title: 'Stream Session Expired',
              message: 'Your secure media authorization token has expired or is invalid. Click retry below to obtain a fresh session token.',
              isExternal: false,
              url: videoMediaUrl,
            });
          } else {
            let host = 'external host';
            try {
              host = new URL(videoMediaUrl).hostname;
            } catch {
              host = 'video server';
            }
            setStreamErrorState({
              title: 'External Video Inaccessible',
              message: `The video stream from ${host} could not be loaded in the browser. The host server may be blocking embedded playback (e.g. HTTP 403 Forbidden or CORS restrictions), the link is private/expired, or the format is unsupported.`,
              isExternal: true,
              url: videoMediaUrl,
            });
          }
        }}
      >
        Your browser does not support HTML5 video playback.
      </video>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden relative flex flex-col min-h-[720px]">
      {/* Level Up Modal */}
      <AnimatePresence>
        {levelUpData.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0.45 }}
              className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm w-full border-2 border-amber-400 text-center"
            >
              <div className="h-20 w-20 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-orange-500/30">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-display text-3xl font-extrabold text-slate-900 mb-2">Level Up!</h2>
              <p className="text-slate-600 text-sm font-medium mb-6">
                Congratulations! You reached <strong className="text-[#006FFF]">Level {levelUpData.newLevel}</strong>. Keep learning to unlock your certificate!
              </p>
              <button
                type="button"
                onClick={() => setLevelUpData({ show: false, newLevel: 0 })}
                className="w-full py-3 bg-[#006FFF] hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md"
              >
                Continue Learning
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Player Toolbar */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" /> My Courses
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold truncate">{courseInfo?.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
              {enrollmentContext?.mode === 'OFFLINE' ? (
                <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                  <Building2 className="w-3 h-3" /> OFFLINE BATCH: {enrollmentContext.batchName || 'Classroom'} · Recorded Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-300 font-bold">
                  <Laptop className="w-3 h-3" /> ONLINE LMS ACCESS
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {xpBanner && (
            <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-extrabold animate-bounce flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {xpBanner}
            </span>
          )}
          {stats.isCourseCompleted && (
            <button
              type="button"
              disabled={claimingCert}
              onClick={handleClaimCertificate}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              {claimingCert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
              Claim Certificate
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="lg:hidden px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold flex items-center gap-1"
          >
            <Menu className="w-4 h-4" /> Syllabus
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex flex-1 flex-col lg:flex-row relative">
        {/* Curriculum Sidebar */}
        <aside
          className={`${isMobileSidebarOpen ? 'fixed inset-0 z-40 bg-white flex' : 'hidden lg:flex'
            } lg:w-80 xl:w-96 flex-col border-r border-slate-200 bg-white shrink-0`}
        >
          {isMobileSidebarOpen && (
            <div className="p-4 border-b border-slate-200 flex items-center justify-between lg:hidden">
              <span className="font-bold text-sm">Course Syllabus</span>
              <button type="button" onClick={() => setIsMobileSidebarOpen(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Course Image + Progress */}
          <div className="relative bg-slate-900 h-36 shrink-0 overflow-hidden">
            {courseInfo?.thumbnailUrl && (
              <img
                src={courseInfo.thumbnailUrl}
                alt={courseInfo.title}
                className="w-full h-full object-cover opacity-70"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent p-4 flex flex-col justify-end">
              <div className="flex justify-between text-[11px] font-bold text-white mb-1.5">
                <span>{stats.completedChapters} / {stats.totalChapters} Lessons</span>
                <span>{stats.progressPercent}% Complete</span>
              </div>
              <div className="w-full bg-white/25 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-500"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Modules Accordion */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[540px]">
            {modules.map((mod, mIdx) => {
              const isOpen = expandedModule === mIdx;
              const lessons = [...(mod.chapters || mod.lessons || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
              return (
                <div key={mod.id || mIdx}>
                  <button
                    type="button"
                    onClick={() => setExpandedModule(isOpen ? -1 : mIdx)}
                    className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors ${isOpen ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                      }`}
                  >
                    <span className={`text-xs font-extrabold pr-2 ${isOpen ? 'text-[#006FFF]' : 'text-slate-800'}`}>
                      {mod.title}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="bg-white divide-y divide-slate-50">
                      {lessons.map((lesson: any, lIdx: number) => {
                        const isActive = activeLesson?.id === lesson.id;
                        return (
                          <button
                            key={lesson.id || lIdx}
                            type="button"
                            onClick={() => handleLessonSelect(lesson, mIdx)}
                            className={`w-full px-4 py-3 flex items-start justify-between gap-2.5 text-left transition-colors relative ${isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50'
                              }`}
                          >
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#006FFF]" />}
                            <div className="flex items-start gap-2.5 min-w-0">
                              <FileText
                                className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-[#006FFF]' : 'text-slate-400'
                                  }`}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-xs leading-snug ${isActive ? 'text-[#006FFF] font-bold' : 'text-slate-700 font-medium'
                                    }`}
                                >
                                  {lIdx + 1}. {lesson.title}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {actualDurations[lesson.id] || lesson.duration || '10:00'}
                                </div>
                              </div>
                            </div>
                            {lesson.isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-200 shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Video + Lesson Resources Area */}
        <div className="flex-1 p-5 lg:p-6 flex flex-col gap-5 bg-slate-50/50 overflow-y-auto">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>Module {expandedModule + 1}</span>
              <span>/</span>
              <span className="font-bold text-slate-800">{activeLesson?.title || 'Lesson'}</span>
            </div>
            {activeLesson?.isCompleted && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </span>
            )}
          </div>

          {/* 16:9 Player Stage */}
          <div
            className="w-full bg-slate-950 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
          >
            {renderVideoStage()}
          </div>

          {/* Lesson Description & Downloadable Resources */}
          {(activeLesson?.description || activeLesson?.pdfUrl || (activeLesson?.attachments?.length || 0) > 0) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              {activeLesson?.description && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-1">Lesson Notes</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{activeLesson.description}</p>
                </div>
              )}

              {(activeLesson?.pdfUrl || (activeLesson?.attachments?.length || 0) > 0) && (
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Downloadable Study Resources
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeLesson?.pdfUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenResource(activeLesson.pdfUrl, 'pdf')}
                        className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#006FFF] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Lesson PDF Guide
                      </button>
                    )}
                    {(activeLesson?.attachments || []).map((att: any) => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => handleOpenResource(att.fileUrl, 'attachment')}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> {att.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete & Next Lesson Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-500">
              Complete lessons to earn <strong>+10 XP</strong> per lesson and <strong>+100 XP</strong> on course completion.
            </span>
            <button
              type="button"
              onClick={handleCompleteAndNext}
              disabled={isCompleting || !activeLesson}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#006FFF] to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-md flex items-center gap-2"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Progress...
                </>
              ) : (
                <>
                  {activeLesson?.isCompleted ? 'Next Lesson' : 'Complete & Next Lesson'}{' '}
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

