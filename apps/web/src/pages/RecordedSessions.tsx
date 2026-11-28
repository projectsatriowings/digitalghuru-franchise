import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, getAuthToken } from '../services/api';
import { parseVideoSource, CoursePlayer } from '../components/CoursePlayer';
import {
  Video,
  Play,
  PlayCircle,
  Clock,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Award,
  Sparkles,
  Laptop,
  ChevronRight,
  X,
  ExternalLink,
  Eye,
  Building2,
  Layers,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Tv,
  Plus,
  Upload,
  Link2,
  Trash2,
  FileVideo,
  AlertCircle,
  Calendar,
  Users,
} from 'lucide-react';

export interface RecordedSessionItem {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  duration?: string | null;
  durationMinutes?: number | null;
  position: number;
  isFree?: boolean;
  moduleId?: string;
  moduleTitle?: string;
  courseId: string;
  courseTitle: string;
  courseThumbnail?: string | null;
  categoryName?: string;
  batchName?: string | null;
  isCompleted?: boolean;
  trainerName?: string | null;
  sessionDate?: string | null;
  videoSource?: 'LINK' | 'SYSTEM_UPLOAD' | string | null;
  canDelete?: boolean;
  isCurriculumLesson?: boolean;
}

const parseDurationToMinutes = (dur?: string | null): number => {
  if (!dur) return 15;
  const parts = dur.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return Math.round(parts[0] + parts[1] / 60);
  }
  const num = parseInt(dur, 10);
  return isNaN(num) ? 15 : num;
};

interface RecordedSessionsProps {
  onNavigateTab?: (tab: string) => void;
  /** Optional student context when rendered inside ParentPortal */
  parentStudentContext?: any;
}

export const RecordedSessions: React.FC<RecordedSessionsProps> = ({
  onNavigateTab,
  parentStudentContext,
}) => {
  const { user, activeInstitute } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecordedSessionItem[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; count: number }>>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'COMPLETED' | 'UNWATCHED'>('ALL');

  // Video playback modal state
  const [activeSession, setActiveSession] = useState<RecordedSessionItem | null>(null);
  const [activePlayerCourseId, setActivePlayerCourseId] = useState<string | null>(null);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [completionSuccessMsg, setCompletionSuccessMsg] = useState<string | null>(null);

  // Upload modal state (Trainer / Franchise Admin)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'FILE' | 'LINK'>('FILE');
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    courseId: '',
    batchId: '',
    videoLink: '',
    duration: '45:00',
    sessionDate: new Date().toISOString().split('T')[0],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [savingSession, setSavingSession] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [availableCourses, setAvailableCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [availableBatches, setAvailableBatches] = useState<Array<{ id: string; name: string; courseId?: string }>>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT' || Boolean(parentStudentContext);
  const isStaff = user?.role === 'STAFF';
  const isOwner =
    user?.role === 'FRANCHISE_OWNER' ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ACADEMIC_ADMIN' ||
    user?.role === 'BRANCH_ADMIN';
  const canUpload = isStaff || isOwner;

  // Load available courses and batches for upload form
  const loadFormMetadata = async () => {
    try {
      // 1. Load franchise courses
      let targetFranchiseId: string | null = null;
      try {
        const ctxRes = await apiFetch('/courses/my-franchise-context');
        targetFranchiseId = ctxRes?.data?.franchise?.id || null;
      } catch {
        if (activeInstitute?.id && activeInstitute.id !== 'ALL') {
          targetFranchiseId = activeInstitute.id;
        }
      }

      if (targetFranchiseId) {
        const cRes = await apiFetch(`/courses/franchise/${targetFranchiseId}`, { skipCache: true });
        if (cRes.success && Array.isArray(cRes.data)) {
          setAvailableCourses(cRes.data.map((c: any) => ({ id: c.id, title: c.title })));
        }
      } else {
        const allCRes = await apiFetch('/courses', { skipCache: true });
        if (allCRes.success && Array.isArray(allCRes.data)) {
          setAvailableCourses(allCRes.data.map((c: any) => ({ id: c.id, title: c.title })));
        }
      }

      // 2. Load batches
      const bRes = await apiFetch('/academics/batches', { skipCache: true });
      if (bRes.success && Array.isArray(bRes.data)) {
        setAvailableBatches(
          bRes.data.map((b: any) => ({
            id: b.id,
            name: b.name,
            courseId: b.courseId || b.course?.id,
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load courses/batches for upload:', err);
    }
  };

  // Load sessions depending on role
  const loadSessionsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const items: RecordedSessionItem[] = [];
      const courseMap = new Map<string, { id: string; title: string; count: number }>();

      // 1. Fetch trainer / custom recorded sessions from DB API
      try {
        const recRes = await apiFetch('/recorded-sessions', { skipCache: true });
        if (recRes.success && Array.isArray(recRes.data)) {
          for (const s of recRes.data) {
            items.push({
              id: s.id,
              title: s.title,
              description: s.description,
              videoUrl: s.videoUrl,
              duration: s.duration || '45:00',
              durationMinutes: parseDurationToMinutes(s.duration || '45:00'),
              position: 0,
              moduleId: undefined,
              moduleTitle: s.batchName ? `Batch: ${s.batchName}` : 'Interactive Lecture',
              courseId: s.courseId || 'general',
              courseTitle: s.courseTitle || 'Classroom Recorded Session',
              courseThumbnail: s.courseThumbnail,
              categoryName: 'Classroom Recording',
              batchName: s.batchName,
              trainerName: s.trainerName,
              sessionDate: s.sessionDate,
              videoSource: s.videoSource,
              canDelete: s.canDelete,
              isCurriculumLesson: false,
              isCompleted: false,
            });

            const cid = s.courseId || 'general';
            const ctitle = s.courseTitle || 'Classroom Recorded Session';
            const existing = courseMap.get(cid) || { id: cid, title: ctitle, count: 0 };
            existing.count++;
            courseMap.set(cid, existing);
          }
        }
      } catch (recErr) {
        console.warn('Failed to fetch /recorded-sessions table data:', recErr);
      }

      // 2. Also fetch LMS Curriculum Course Chapters with Videos
      if (isStudent || isParent) {
        // Student or Parent: fetch learning dashboard
        const studentIdParam = parentStudentContext?.id ? `?studentId=${encodeURIComponent(parentStudentContext.id)}` : '';
        const res = await apiFetch(`/courses/learning/my-dashboard${studentIdParam}`, { skipCache: true });

        if (res.success && res.data) {
          const enrollments = res.data.enrollments || [];
          const completedSet = new Set((res.data.progress || []).map((p: any) => p.chapterId));

          for (const enr of enrollments) {
            const course = enr.course;
            if (!course) continue;

            const courseId = course.id;
            const courseTitle = course.title;
            const courseThumbnail = course.thumbnailUrl;
            const categoryName = course.category?.name || 'Curriculum';
            const batchName = enr.batch?.name || null;

            const modules = course.activeCurriculumVersion?.modules || [];
            let courseSessionCount = 0;

            for (const mod of modules) {
              const chapters = mod.chapters || [];
              for (const ch of chapters) {
                if (ch.videoUrl && ch.videoUrl.trim()) {
                  courseSessionCount++;
                  const isCompleted = completedSet.has(ch.id);

                  items.push({
                    id: ch.id,
                    title: ch.title,
                    description: ch.description,
                    videoUrl: ch.videoUrl.trim(),
                    duration: ch.duration,
                    durationMinutes: parseDurationToMinutes(ch.duration),
                    position: ch.position || 0,
                    isFree: ch.isFree,
                    moduleId: mod.id,
                    moduleTitle: mod.title,
                    courseId,
                    courseTitle,
                    courseThumbnail,
                    categoryName,
                    batchName,
                    isCompleted,
                    isCurriculumLesson: true,
                  });
                }
              }
            }

            if (courseSessionCount > 0) {
              const existing = courseMap.get(courseId) || { id: courseId, title: courseTitle, count: 0 };
              existing.count += courseSessionCount;
              courseMap.set(courseId, existing);
            }
          }
        }
      } else {
        // Franchise Owner / Administrator / Staff: fetch franchise courses
        let targetFranchiseId: string | null = null;
        try {
          const ctxRes = await apiFetch('/courses/my-franchise-context');
          targetFranchiseId = ctxRes?.data?.franchise?.id || null;
        } catch {
          if (activeInstitute?.id && activeInstitute.id !== 'ALL') {
            targetFranchiseId = activeInstitute.id;
          }
        }

        if (targetFranchiseId) {
          const res = await apiFetch(`/courses/franchise/${targetFranchiseId}`, { skipCache: true });
          if (res.success && Array.isArray(res.data)) {
            for (const course of res.data) {
              const courseId = course.id;
              const courseTitle = course.title;
              const courseThumbnail = course.thumbnailUrl;
              const categoryName = course.category?.name || 'Curriculum';

              const modules = course.activeCurriculumVersion?.modules || [];
              let courseSessionCount = 0;

              for (const mod of modules) {
                const chapters = mod.chapters || [];
                for (const ch of chapters) {
                  if (ch.videoUrl && ch.videoUrl.trim()) {
                    courseSessionCount++;
                    items.push({
                      id: ch.id,
                      title: ch.title,
                      description: ch.description,
                      videoUrl: ch.videoUrl.trim(),
                      duration: ch.duration,
                      durationMinutes: parseDurationToMinutes(ch.duration),
                      position: ch.position || 0,
                      isFree: ch.isFree,
                      moduleId: mod.id,
                      moduleTitle: mod.title,
                      courseId,
                      courseTitle,
                      courseThumbnail,
                      categoryName,
                      batchName: null,
                      isCurriculumLesson: true,
                    });
                  }
                }
              }

              if (courseSessionCount > 0) {
                const existing = courseMap.get(courseId) || { id: courseId, title: courseTitle, count: 0 };
                existing.count += courseSessionCount;
                courseMap.set(courseId, existing);
              }
            }
          }
        }
      }

      setSessions(items);
      setCourses(Array.from(courseMap.values()));
    } catch (err: any) {
      setError(err.message || 'Failed to load recorded sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionsData();
    if (canUpload) {
      loadFormMetadata();
    }
  }, [user?.role, parentStudentContext?.id, activeInstitute?.id]);

  // Handle Mark Complete & Claim XP for student
  const handleMarkComplete = async (session: RecordedSessionItem) => {
    if (!isStudent || !session.isCurriculumLesson) return;
    try {
      setCompletingSessionId(session.id);
      setCompletionSuccessMsg(null);
      const res = await apiFetch('/courses/learning/complete-lesson', {
        method: 'POST',
        body: JSON.stringify({
          courseId: session.courseId,
          chapterId: session.id,
        }),
      });

      if (res.success) {
        setCompletionSuccessMsg(`Session completed! +${res.data?.xpGained || 50} XP earned.`);
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, isCompleted: true } : s))
        );
        setTimeout(() => setCompletionSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      console.warn('Failed to mark lesson complete:', err);
    } finally {
      setCompletingSessionId(null);
    }
  };

  // Handle Delete Recorded Session
  const handleDeleteSession = async (session: RecordedSessionItem) => {
    if (!session.canDelete) return;
    if (!window.confirm(`Are you sure you want to delete "${session.title}"?`)) return;

    try {
      setDeletingId(session.id);
      const res = await apiFetch(`/recorded-sessions/${session.id}`, { method: 'DELETE' });
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      } else {
        alert(res.error || 'Failed to delete recorded session');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete recorded session');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Session Form Submission
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!sessionForm.title.trim()) {
      setModalError('Please enter a session title');
      return;
    }

    try {
      setSavingSession(true);
      let finalVideoUrl = '';

      if (uploadMode === 'FILE') {
        if (!selectedFile) {
          setModalError('Please select a video file from your computer');
          setSavingSession(false);
          return;
        }

        // Upload directly from system via FormData
        const formData = new FormData();
        formData.append('file', selectedFile);

        const token = getAuthToken();
        const uploadRes = await fetch('/api/recorded-sessions/upload', {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.message || uploadData.error || 'Video file upload failed');
        }

        finalVideoUrl = uploadData.data.fileUrl;
      } else {
        if (!sessionForm.videoLink.trim()) {
          setModalError('Please enter a valid video link (YouTube, Vimeo, or direct video URL)');
          setSavingSession(false);
          return;
        }
        finalVideoUrl = sessionForm.videoLink.trim();
      }

      // Publish session record
      const postRes = await apiFetch('/recorded-sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: sessionForm.title.trim(),
          description: sessionForm.description.trim() || undefined,
          courseId: sessionForm.courseId || undefined,
          batchId: sessionForm.batchId || undefined,
          videoUrl: finalVideoUrl,
          videoSource: uploadMode === 'FILE' ? 'SYSTEM_UPLOAD' : 'LINK',
          duration: sessionForm.duration.trim() || '45:00',
          sessionDate: sessionForm.sessionDate,
        }),
      });

      if (!postRes.success) {
        throw new Error(postRes.error || 'Failed to publish recorded session');
      }

      // Success
      setShowUploadModal(false);
      setSessionForm({
        title: '',
        description: '',
        courseId: '',
        batchId: '',
        videoLink: '',
        duration: '45:00',
        sessionDate: new Date().toISOString().split('T')[0],
      });
      setSelectedFile(null);
      setUploadProgress(0);
      await loadSessionsData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save recorded session');
    } finally {
      setSavingSession(false);
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Course filter
      if (selectedCourseFilter !== 'ALL' && s.courseId !== selectedCourseFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter === 'COMPLETED' && !s.isCompleted) {
        return false;
      }
      if (selectedStatusFilter === 'UNWATCHED' && s.isCompleted) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesCourse = s.courseTitle.toLowerCase().includes(q);
        const matchesModule = (s.moduleTitle || '').toLowerCase().includes(q);
        const matchesTrainer = (s.trainerName || '').toLowerCase().includes(q);
        const matchesDesc = (s.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCourse && !matchesModule && !matchesTrainer && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, selectedCourseFilter, selectedStatusFilter, searchQuery]);

  // Aggregated Stats
  const stats = useMemo(() => {
    const totalCount = sessions.length;
    const completedCount = sessions.filter((s) => s.isCompleted).length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes || 15), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    return {
      totalCount,
      completedCount,
      totalHours,
      totalCourses: courses.length,
    };
  }, [sessions, courses]);

  // Full Course Player handover
  if (activePlayerCourseId) {
    return (
      <CoursePlayer
        courseId={activePlayerCourseId}
        onBack={() => {
          setActivePlayerCourseId(null);
          loadSessionsData();
        }}
        onProgressUpdated={loadSessionsData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                {isStudent
                  ? 'My Recorded Sessions & Video Lectures'
                  : isParent
                  ? `${parentStudentContext?.firstName || 'Student'}'s Recorded Sessions`
                  : isStaff
                  ? 'Trainer Recorded Sessions'
                  : 'Franchise Recorded Sessions & Video Library'}
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isStudent
                  ? 'Stream classroom recordings, online lecture videos, and topic demonstrations.'
                  : isParent
                  ? 'Review recorded class lectures and video lessons assigned to your child.'
                  : isStaff
                  ? 'Upload recorded class sessions directly from your system or attach external video links for your students.'
                  : 'Manage and review recorded sessions and video lectures across your franchise campus.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {canUpload && (
            <button
              onClick={() => {
                setShowUploadModal(true);
                setModalError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#006FFF] hover:bg-[#005AD0] text-white rounded-xl text-xs font-bold shadow-md shadow-[#006FFF]/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Recorded Session</span>
            </button>
          )}

          <button
            onClick={loadSessionsData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#E2E8F0] bg-white rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <Video className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Sessions</span>
          </div>
          <div className="text-2xl font-black text-[#0F172A]">{stats.totalCount}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Available for playback</div>
        </div>

        <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-sky-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Watch Time</span>
          </div>
          <div className="text-2xl font-black text-[#0F172A]">{stats.totalHours} hrs</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Total lecture duration</div>
        </div>

        <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Courses</span>
          </div>
          <div className="text-2xl font-black text-[#0F172A]">{stats.totalCourses}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Active subjects & modules</div>
        </div>

        <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              {isStudent ? 'Completed' : 'Library Health'}
            </span>
          </div>
          <div className="text-2xl font-black text-[#0F172A]">
            {isStudent ? stats.completedCount : '100%'}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {isStudent ? `${Math.round((stats.completedCount / (stats.totalCount || 1)) * 100)}% progress` : 'Streams active'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by session title, course, batch, or trainer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Course Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs font-medium text-[#0F172A] bg-white focus:ring-2 focus:ring-[#006FFF] transition"
              >
                <option value="ALL">All Courses ({sessions.length})</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (Students / Parents) */}
            {(isStudent || isParent) && (
              <div className="flex items-center bg-[#FAF8F5] p-0.5 rounded-xl border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'ALL'
                      ? 'bg-white text-[#006FFF] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('UNWATCHED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'UNWATCHED'
                      ? 'bg-white text-[#006FFF] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('COMPLETED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'COMPLETED'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Watched
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Sessions Grid */}
      {loading ? (
        <div className="p-16 text-center text-[#94A3B8] text-sm flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-[#E2E8F0]">
          <Loader2 className="w-8 h-8 rounded-full animate-spin text-rose-500" />
          <span className="font-semibold text-xs">Loading recorded lectures and classroom video streams...</span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
          <p className="font-bold">{error}</p>
          <button
            onClick={loadSessionsData}
            className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-[#E2E8F0] space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center mx-auto">
            <Video className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">No recorded sessions found</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            {canUpload
              ? 'You have not uploaded any recorded classroom sessions yet. Click "Upload Recorded Session" to upload a session from your computer or paste an external video link.'
              : 'No recorded sessions match your filters. Once your instructors record or publish classroom sessions, they will appear here.'}
          </p>
          {canUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] hover:bg-[#005AD0] text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Upload First Session</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session, index) => {
            const parsed = parseVideoSource(session.videoUrl);
            const providerType = parsed?.type || (session.videoSource === 'SYSTEM_UPLOAD' ? 'direct' : 'link');

            return (
              <div
                key={`${session.courseId}-${session.id}-${index}`}
                className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden hover:border-[#006FFF]/40 hover:shadow-md transition-all flex flex-col group"
              >
                {/* Card Top Banner / Course Info */}
                <div className="p-4 pb-3 border-b border-[#F1F5F9] bg-[#FAF8F5] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                        session.isCurriculumLesson
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {session.isCurriculumLesson ? 'Curriculum Lesson' : 'Class Recording'}
                    </span>
                    <span className="text-xs font-bold text-[#0F172A] truncate" title={session.courseTitle}>
                      {session.courseTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {session.isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3 text-emerald-600" /> Watched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full">
                        {session.duration || (session.durationMinutes ? `${session.durationMinutes}m` : '45:00')}
                      </span>
                    )}

                    {session.canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === session.id}
                        onClick={() => handleDeleteSession(session)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Session Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {session.moduleTitle && (
                      <div className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5 mb-1">
                        <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{session.moduleTitle}</span>
                      </div>
                    )}

                    <h4 className="font-black text-sm text-[#0F172A] group-hover:text-[#006FFF] transition leading-snug">
                      {session.title}
                    </h4>

                    {session.description && (
                      <p className="text-xs text-[#64748B] line-clamp-2 mt-1.5 leading-relaxed">
                        {session.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata tags */}
                  <div className="pt-2 border-t border-[#F8FAFC] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 font-mono uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                        <Tv className="w-3 h-3 text-rose-500" /> {providerType}
                      </span>
                      {session.videoSource === 'SYSTEM_UPLOAD' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <FileVideo className="w-3 h-3" /> System File
                        </span>
                      )}
                      {session.batchName && (
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {session.batchName}
                        </span>
                      )}
                    </div>

                    {session.trainerName && (
                      <span className="text-[10px] font-semibold text-blue-700">
                        {session.trainerName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-white border-t border-[#F1F5F9] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSession(session)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch Recording</span>
                  </button>

                  {session.courseId && session.courseId !== 'general' && (
                    <button
                      type="button"
                      onClick={() => setActivePlayerCourseId(session.courseId)}
                      className="p-2 border border-[#E2E8F0] hover:bg-[#FAF8F5] text-[#64748B] hover:text-[#006FFF] rounded-xl transition"
                      title="Open Full Course Player"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Video Player Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between text-white">
              <div className="min-w-0 pr-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Video className="w-3 h-3" />
                  <span>
                    {activeSession.courseTitle}
                    {activeSession.moduleTitle ? ` • ${activeSession.moduleTitle}` : ''}
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white truncate mt-0.5">
                  {activeSession.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Display Container */}
            <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[460px] flex items-center justify-center">
              {(() => {
                const parsed = parseVideoSource(activeSession.videoUrl);
                if (!parsed) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Invalid or unsupported video source format.
                    </div>
                  );
                }

                if (parsed.type === 'direct') {
                  return (
                    <video
                      key={activeSession.id}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full max-h-[65vh] object-contain"
                      src={parsed.src}
                    >
                      Your browser does not support standard video playback.
                    </video>
                  );
                }

                return (
                  <iframe
                    key={activeSession.id}
                    src={parsed.src}
                    title={activeSession.title}
                    className="w-full h-full min-h-[340px] sm:min-h-[460px] border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                );
              })()}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2">
                {isStudent && activeSession.isCurriculumLesson && (
                  <button
                    type="button"
                    disabled={completingSessionId === activeSession.id || activeSession.isCompleted}
                    onClick={() => handleMarkComplete(activeSession)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeSession.isCompleted
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {completingSessionId === activeSession.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{activeSession.isCompleted ? 'Completed' : 'Mark as Watched'}</span>
                  </button>
                )}

                {completionSuccessMsg && (
                  <span className="text-xs text-emerald-400 font-semibold animate-in fade-in flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> {completionSuccessMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeSession.courseId && activeSession.courseId !== 'general' && (
                  <button
                    type="button"
                    onClick={() => {
                      const courseId = activeSession.courseId;
                      setActiveSession(null);
                      setActivePlayerCourseId(courseId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
                  >
                    <Laptop className="w-3.5 h-3.5 text-sky-400" />
                    <span>Open Full Course</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  className="px-4 py-1.5 bg-[#006FFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trainer / Admin Upload Session Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl p-6 shadow-2xl text-[#0F172A] max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Video className="w-5 h-5 text-rose-600" /> Upload Recorded Session
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Publish a recorded classroom session for your enrolled students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] rounded-xl hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSession} className="mt-4 space-y-4 text-xs">
              {/* Video Source Option Toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Video Source Method *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setUploadMode('FILE')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
                      uploadMode === 'FILE'
                        ? 'bg-white text-[#006FFF] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-4 h-4" /> Direct File Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('LINK')}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
                      uploadMode === 'LINK'
                        ? 'bg-white text-[#006FFF] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Link2 className="w-4 h-4" /> Video URL / Link
                  </button>
                </div>
              </div>

              {/* Source-specific Input */}
              {uploadMode === 'FILE' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Select Video File from Computer *
                  </label>
                  <div className="border-2 border-dashed border-slate-300 hover:border-[#006FFF] rounded-2xl p-6 text-center transition bg-slate-50">
                    <input
                      type="file"
                      id="video-upload-input"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          setModalError(null);
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="video-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#006FFF] flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      {selectedFile ? (
                        <div>
                          <p className="font-bold text-sm text-[#0F172A]">{selectedFile.name}</p>
                          <p className="text-[11px] text-[#64748B]">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB &bull; Ready to upload
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-bold text-sm text-[#0F172A]">Click to choose video file</p>
                          <p className="text-[11px] text-[#64748B]">MP4, WEBM, MOV up to 500MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    External Video Link *
                  </label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... or https://.../video.mp4"
                      value={sessionForm.videoLink}
                      onChange={(e) => setSessionForm({ ...sessionForm, videoLink: e.target.value })}
                      required={uploadMode === 'LINK'}
                      className="w-full pl-9 pr-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Supports YouTube, Vimeo, Google Drive preview links, or direct MP4/HLS streams.
                  </p>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Session Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Session 3: State Management & Hooks Deep Dive"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] transition"
                />
              </div>

              {/* Course & Batch Selection Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Associated Course
                  </label>
                  <select
                    value={sessionForm.courseId}
                    onChange={(e) => setSessionForm({ ...sessionForm, courseId: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#006FFF] transition"
                  >
                    <option value="">-- General / No Specific Course --</option>
                    {availableCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Target Batch
                  </label>
                  <select
                    value={sessionForm.batchId}
                    onChange={(e) => setSessionForm({ ...sessionForm, batchId: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#006FFF] transition"
                  >
                    <option value="">-- All Enrolled Batches --</option>
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Duration Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={sessionForm.sessionDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Duration (e.g. 45:00)
                  </label>
                  <input
                    type="text"
                    placeholder="45:00"
                    value={sessionForm.duration}
                    onChange={(e) => setSessionForm({ ...sessionForm, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] transition"
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Description & Topics Covered (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Key concepts discussed, homework assigned, or reference links..."
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-xs focus:ring-2 focus:ring-[#006FFF] transition"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={savingSession}
                  className="px-4 py-2 border border-[#E2E8F0] text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSession}
                  className="px-5 py-2 bg-[#006FFF] hover:bg-[#005AD0] text-white font-bold rounded-xl shadow-md shadow-[#006FFF]/20 transition flex items-center gap-2"
                >
                  {savingSession ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadMode === 'FILE' ? 'Uploading Video...' : 'Publishing...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Publish Session</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
