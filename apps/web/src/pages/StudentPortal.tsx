import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../services/api';
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle,
  Building,
  Users,
  Sparkles,
  BookOpen,
  FileText,
  HelpCircle,
  PlayCircle,
  Award,
  Trophy,
  Laptop,
  Building2,
  ShieldCheck,
  Search,
  X,
  Loader2,
  Printer,
} from 'lucide-react';
import { CoursePlayer } from '../components/CoursePlayer';
import { useToast } from '../context/ToastContext';

interface StudentPortalProps {
  initialSection?: 'overview' | 'courses';
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ initialSection = 'overview' }) => {
  const toast = useToast();

  const formatKolkataDateTime = (dateString?: string | null) => {
    if (!dateString) return 'Not available';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Not available';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  };

  const [student, setStudent] = useState<any>(null);
  const [lmsDashboard, setLmsDashboard] = useState<any>(null);
  const [activePlayerCourseId, setActivePlayerCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [recentMaterials, setRecentMaterials] = useState<any[]>([]);
  const [recentHomework, setRecentHomework] = useState<any[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);

  // Certificate modal & verifier
  const [activeCertModal, setActiveCertModal] = useState<any | null>(null);
  const [claimingCourseId, setClaimingCourseId] = useState<string | null>(null);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifyingCert, setVerifyingCert] = useState(false);

  const loadStudentData = useCallback(async () => {
    try {
      setLoading(true);
      const [profRes, lmsRes, matRes, hwRes, quizRes] = await Promise.allSettled([
        apiFetch('/students/my/profile', { skipCache: true }),
        apiFetch('/courses/learning/my-dashboard', { skipCache: true }),
        apiFetch('/materials'),
        apiFetch('/homework'),
        apiFetch('/quizzes'),
      ]);

      if (profRes.status === 'fulfilled' && profRes.value.success && profRes.value.data?.student) {
        setStudent(profRes.value.data.student);
      } else {
        setError('Student record not found');
      }

      if (lmsRes.status === 'fulfilled' && lmsRes.value.success) {
        setLmsDashboard(lmsRes.value.data);
      }

      if (matRes.status === 'fulfilled' && matRes.value.success) {
        setRecentMaterials((matRes.value.data?.materials || []).slice(0, 3));
      }

      if (hwRes.status === 'fulfilled' && hwRes.value.success) {
        setRecentHomework((hwRes.value.data?.homework || []).slice(0, 3));
      }

      if (quizRes.status === 'fulfilled' && quizRes.value.success) {
        setRecentQuizzes((quizRes.value.data?.quizzes || []).slice(0, 3));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const handleClaimCertificate = async (courseId: string) => {
    setClaimingCourseId(courseId);
    try {
      const res = await apiFetch('/courses/certificates/claim', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      toast.success(`Certificate generated: ${res.data?.certificateNumber}`);
      setActiveCertModal(res.data);
      await loadStudentData();
    } catch (err: any) {
      toast.error(err.message || 'Unable to claim certificate');
    } finally {
      setClaimingCourseId(null);
    }
  };

  const handleVerifyCertificateNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCodeInput.trim()) return;
    setVerifyingCert(true);
    setVerifyResult(null);
    try {
      const res = await apiFetch(`/courses/certificates/verify/${encodeURIComponent(verifyCodeInput.trim())}`, {
        skipCache: true,
      });
      setVerifyResult(res.data);
    } catch (err: any) {
      setVerifyResult({ notFound: true, error: err.message || 'Certificate not found' });
    } finally {
      setVerifyingCert(false);
    }
  };

  if (activePlayerCourseId) {
    return (
      <CoursePlayer
        courseId={activePlayerCourseId}
        onBack={() => {
          setActivePlayerCourseId(null);
          loadStudentData();
        }}
        onProgressUpdated={loadStudentData}
        onCertificateClaimed={(cert) => {
          setActiveCertModal(cert);
          loadStudentData();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-3">
        <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping"></div>
        <span>Loading Student Portal & LMS...</span>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
        {error || 'No active student profile linked to this account. Please contact institute administration.'}
      </div>
    );
  }

  // Group active enrollments by batch
  const batchMap = new Map<
    string,
    { batch: any; subjects: Array<{ id: string; name: string; code?: string; teacherName?: string }> }
  >();
  for (const enr of student.enrollments || []) {
    if (enr.batch) {
      if (!batchMap.has(enr.batch.id)) {
        batchMap.set(enr.batch.id, {
          batch: enr.batch,
          subjects: [],
        });
      }
      if (enr.subject) {
        const bs = (enr.batch.batchSubjects || []).find((x: any) => x.subjectId === enr.subject.id);
        const teacherName = bs?.staffProfile?.user?.fullName || null;
        const exists = batchMap.get(enr.batch.id)!.subjects.some((s) => s.id === enr.subject.id);
        if (!exists) {
          batchMap.get(enr.batch.id)!.subjects.push({
            id: enr.subject.id,
            name: enr.subject.name,
            code: enr.subject.code,
            teacherName,
          });
        }
      }
    }
  }
  const enrolledBatches = Array.from(batchMap.values());
  const attendanceEvents = student?.attendanceEvents || [];
  const filteredAttendanceEvents =
    selectedBatchFilter === 'ALL'
      ? attendanceEvents
      : attendanceEvents.filter((evt: any) => evt.batchId === selectedBatchFilter);

  const xpInfo = lmsDashboard?.xp || { totalXp: student.user?.xpPoints || 0, level: student.user?.level || 1, currentLevelFloor: 0, nextLevelThreshold: 50, recentLedger: [] };
  const courseEnrollments = lmsDashboard?.enrollments || [];
  const certificates = lmsDashboard?.certificates || [];

  const levelProgressPct = xpInfo.nextLevelThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((xpInfo.totalXp - (xpInfo.currentLevelFloor || 0)) /
              Math.max(1, xpInfo.nextLevelThreshold - (xpInfo.currentLevelFloor || 0))) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="space-y-6">
      {/* Student Identity & XP Gamification Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0B1221] via-[#172554] to-[#1E3A8A] border border-blue-900 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-white">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Enrolled Student
            </span>
            <span className="text-xs font-mono text-blue-200">
              Admission: <strong className="text-white">{student.admissionNumber}</strong>
            </span>
            <span className="text-xs text-blue-200">
              Joined: <strong className="text-white">{formatKolkataDateTime(student.createdAt)}</strong>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-blue-200 mt-1 flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-300" />
            <span>
              {student.institute
                ? `${student.institute.name} (${student.institute.code})`
                : `${student.franchise?.name || 'Digital Guru'} · Online Direct LMS`}
            </span>
          </p>
        </div>

        {/* Live XP + Level Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 min-w-[260px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-amber-300">Learner Rank</div>
                <div className="text-lg font-extrabold text-white">Level {xpInfo.level}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-amber-300">{xpInfo.totalXp} XP</div>
              <div className="text-[11px] text-blue-200">{certificates.length} Certificates</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-bold text-blue-200 mb-1">
              <span>{courseEnrollments.length} Active LMS Courses</span>
              <span>
                {xpInfo.nextLevelThreshold ? `${xpInfo.nextLevelThreshold - xpInfo.totalXp} XP to Level ${xpInfo.level + 1}` : 'Max Rank Reached'}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500" style={{ width: `${levelProgressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MY ENROLLED GLOBAL COURSES (ONLINE & OFFLINE LMS)                 */}
      {/* ================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-[#006FFF]" /> My Digital Guru Courses & Recorded Sessions
            </h2>
            <p className="text-xs text-slate-500">
              Access video lessons, recorded classroom sessions, downloadable guides, XP rewards, and certificates.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-[#006FFF] text-xs font-bold">
            {courseEnrollments.length} Enrolled Course{courseEnrollments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {courseEnrollments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-sm text-slate-500">
            No Global LMS course enrollments found yet. Contact your franchise or campus counselor to activate a course.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {courseEnrollments.map((enr: any) => (
              <div
                key={enr.id}
                className="rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 flex gap-4">
                  <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {enr.course?.thumbnailUrl ? (
                      <img src={enr.course.thumbnailUrl} alt={enr.course.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-7 h-7 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          enr.mode === 'ONLINE'
                            ? 'bg-blue-50 text-[#006FFF]'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {enr.mode === 'ONLINE' ? <Laptop className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                        {enr.mode === 'OFFLINE' ? `OFFLINE · ${enr.batch?.name || 'Campus Batch'}` : 'ONLINE LMS'}
                      </span>
                      {enr.isCompleted && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          COMPLETED
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 line-clamp-1">{enr.course?.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{enr.course?.subTitle || enr.franchise?.name}</p>

                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                        <span>
                          {enr.completedLessons} / {enr.totalLessons} Lessons
                        </span>
                        <span className="text-[#006FFF]">{enr.progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            enr.isCompleted ? 'bg-emerald-500' : 'bg-[#006FFF]'
                          }`}
                          style={{ width: `${enr.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePlayerCourseId(enr.courseId)}
                    className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {enr.completedLessons > 0 ? 'Resume Learning' : 'Start Course'}
                  </button>

                  {enr.certificate ? (
                    <button
                      type="button"
                      onClick={() => setActiveCertModal(enr.certificate)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5 border border-emerald-200"
                    >
                      <Award className="w-4 h-4" /> View Certificate
                    </button>
                  ) : enr.isCompleted ? (
                    <button
                      type="button"
                      disabled={claimingCourseId === enr.courseId}
                      onClick={() => handleClaimCertificate(enr.courseId)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      {claimingCourseId === enr.courseId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Award className="w-4 h-4" />
                      )}
                      Claim Certificate
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* CERTIFICATES & CRYPTOGRAPHIC VERIFICATION                         */}
      {/* ================================================================= */}
      {(certificates.length > 0 || initialSection === 'courses') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> My Earned Certificates
            </h3>
            {certificates.length === 0 ? (
              <p className="text-xs text-slate-500">Complete 100% of lessons in any enrolled course to unlock your signed certificate.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {certificates.map((cert: any) => (
                  <div
                    key={cert.id}
                    className="p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-white flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-mono font-bold text-amber-800">{cert.certificateNumber}</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="font-extrabold text-sm text-slate-900">{cert.courseTitle}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Issued {new Date(cert.issuedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCertModal(cert)}
                      className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                    >
                      Open Verified Certificate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verify Certificate ID
            </h3>
            <form onSubmit={handleVerifyCertificateNumber} className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={verifyCodeInput}
                  onChange={(e) => setVerifyCodeInput(e.target.value)}
                  placeholder="e.g. DG-CERT-2026-000001"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:border-[#006FFF]"
                />
              </div>
              <button
                type="submit"
                disabled={verifyingCert}
                className="w-full py-2 rounded-xl bg-[#006FFF] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {verifyingCert && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Verify Authenticity
              </button>
            </form>
            {verifyResult && (
              <div
                className={`p-3 rounded-xl text-xs border ${
                  verifyResult.isAuthentic
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {verifyResult.isAuthentic ? (
                  <>
                    <div className="font-extrabold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Authentic HMAC-SHA256 Verified
                    </div>
                    <div className="mt-1">Recipient: {verifyResult.recipientName}</div>
                    <div>Course: {verifyResult.courseTitle}</div>
                  </>
                ) : (
                  <div>{verifyResult.error || 'Certificate could not be verified.'}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CAMPUS ACTIVITY & ACADEMIC WIDGETS (ONLY WHEN RELEVANT)           */}
      {/* ================================================================= */}
      {initialSection !== 'courses' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Recent Materials & Audio Lessons */}
            <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-[#64748B]" /> Recent Study Materials
                </span>
              </div>
              {recentMaterials.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic py-3 text-center">No campus materials published yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentMaterials.map((m: any) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#0F172A] truncate">{m.title}</p>
                        <span className="text-[10px] text-[#94A3B8]">
                          {m.batch?.name} • {m.type}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#006FFF] border border-[#E2E8F0] shrink-0">
                        {m.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Homework & Assigned Tasks */}
            <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-[#64748B]" /> Homework & Assigned Tasks
                </span>
                {recentHomework.length > 0 && (
                  <span className="text-[10px] text-[#94A3B8] font-medium">
                    {recentHomework.filter((h) => !h.isSubmitted).length} Pending •{' '}
                    {recentHomework.filter((h) => h.isSubmitted).length} Submitted
                  </span>
                )}
              </div>
              {recentHomework.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic py-3 text-center">No assignments due.</p>
              ) : (
                <div className="space-y-2">
                  {recentHomework.map((hw: any) => {
                    const isGraded = hw.studentStatus === 'GRADED' || Boolean(hw.grade);
                    const isCompleted = hw.studentStatus === 'COMPLETED';
                    const isAwaiting = hw.studentStatus === 'AWAITING_REVIEW' || (hw.isSubmitted && !isGraded && !isCompleted);
                    const isOverdue = hw.studentStatus === 'OVERDUE' || (hw.isOverdue && !hw.isSubmitted);

                    return (
                      <div
                        key={hw.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          isGraded
                            ? 'bg-emerald-50/50 border-emerald-200/70'
                            : isCompleted
                            ? 'bg-teal-50/50 border-teal-200/70'
                            : isAwaiting
                            ? 'bg-blue-50/50 border-blue-200/70'
                            : isOverdue
                            ? 'bg-rose-50/50 border-rose-200/70'
                            : 'bg-[#F8FAFC] border-[#F1F5F9]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-[#0F172A] truncate">{hw.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#64748B] mt-0.5">
                            <span>Due: {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : 'No date'}</span>
                            {hw.subject?.name && <span>• {hw.subject.name}</span>}
                            {hw.grade && <strong className="text-emerald-800 font-bold">• Grade: {hw.grade}</strong>}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                            isGraded
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isCompleted
                              ? 'bg-teal-100 text-teal-800 border-teal-300'
                              : isAwaiting
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isGraded
                            ? `Graded (${hw.grade})`
                            : isCompleted
                            ? 'Completed'
                            : isAwaiting
                            ? 'Submitted'
                            : isOverdue
                            ? 'Overdue'
                            : 'Not Started'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Available Quizzes */}
            <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4 text-indigo-700" /> Available Quizzes
                </span>
              </div>
              {recentQuizzes.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic py-3 text-center">No active quizzes.</p>
              ) : (
                <div className="space-y-2">
                  {recentQuizzes.map((q: any) => (
                    <div
                      key={q.id}
                      className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200/60 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#0F172A] truncate">{q.title}</p>
                        <span className="text-[10px] text-indigo-800">
                          {q.durationMinutes ? `${q.durationMinutes} mins • ` : ''}
                          {q._count?.questions || 0} Questions
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300 shrink-0">
                        {q.myAttempt ? 'Completed' : 'Available'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Academic & Attendance Overview */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0F172A] font-bold text-base">
                <GraduationCap className="w-5 h-5 text-[#64748B]" />
                <span>My Active Classroom Batches & Subjects</span>
              </div>
              <span className="text-xs text-[#94A3B8] font-medium">
                {enrolledBatches.length} Enrolled Batch{enrolledBatches.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {enrolledBatches.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9] text-xs text-[#94A3B8] text-center">
                No offline campus batch allocations assigned (Online LMS learners do not require a campus batch).
              </div>
            ) : (
              <div className="space-y-3">
                {enrolledBatches.map(({ batch, subjects }) => (
                  <div key={batch.id} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9] space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#0F172A] text-sm">{batch.name}</h4>
                          {batch.code && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E2E8F0] text-[#006FFF]">
                              {batch.code}
                            </span>
                          )}
                        </div>
                        {batch.academicYear && (
                          <span className="text-[11px] text-[#94A3B8]">Academic Year: {batch.academicYear}</span>
                        )}
                      </div>
                      {batch.schedule && (
                        <div className="text-xs text-[#64748B] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>{batch.schedule}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1.5">
                        Allocated Subjects & Teachers:
                      </span>
                      {subjects.length === 0 ? (
                        <span className="text-xs text-[#64748B] italic">Standard batch curriculum</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {subjects.map((sub) => (
                            <div
                              key={sub.id}
                              className="px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-center gap-2 text-xs"
                            >
                              <span className="font-bold text-[#0F172A]">{sub.name}</span>
                              {sub.teacherName && (
                                <span className="text-[11px] text-[#94A3B8] bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#F1F5F9]">
                                  Teacher: <strong className="text-[#006FFF]">{sub.teacherName}</strong>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Linked Guardians */}
            {Array.isArray(student.parentRelations) && student.parentRelations.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm">
                  <Users className="w-4 h-4 text-[#64748B]" />
                  <span>Linked Guardians</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {student.parentRelations.map((rel: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#0F172A] block">{rel.parent?.user?.fullName || 'Parent'}</span>
                        <span className="text-[#64748B] text-[11px] block mt-0.5">
                          {rel.relation || rel.relationship} {rel.isPrimaryContact && '• Primary'}
                        </span>
                      </div>
                      {rel.canReceiveSms && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#006FFF] border border-blue-200 text-[10px] font-semibold">
                          SMS Alerts
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance History */}
            {enrolledBatches.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm">
                    <Clock className="w-4 h-4 text-[#64748B]" />
                    <span>Recent Attendance Activity</span>
                  </div>
                  {enrolledBatches.length > 1 && (
                    <select
                      value={selectedBatchFilter}
                      onChange={(e) => setSelectedBatchFilter(e.target.value)}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-xs text-[#0F172A]"
                    >
                      <option value="ALL">All Enrolled Batches</option>
                      {enrolledBatches.map(({ batch }) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {filteredAttendanceEvents.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] italic p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                    No attendance scans recorded for this term yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAttendanceEvents.slice(0, 5).map((evt: any, i: number) => (
                      <div
                        key={evt.id || i}
                        className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              evt.eventType === 'CHECK_IN' ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                          ></span>
                          <span className="font-semibold text-[#0F172A]">
                            {evt.eventType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} (Session #{evt.sessionNumber})
                          </span>
                          {evt.isLate && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                              Late
                            </span>
                          )}
                        </div>
                        <span className="text-[#64748B] font-mono text-[11px]">
                          {new Date(evt.eventTime).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* OFFICIAL SIGNED CERTIFICATE MODAL                                 */}
      {/* ================================================================= */}
      {activeCertModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
                <Award className="w-5 h-5 text-amber-500" /> Official Digital Guru Certificate
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCertModal(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 sm:p-10 bg-gradient-to-br from-slate-50 via-white to-amber-50/40">
              <div className="border-4 border-double border-amber-400 rounded-2xl p-8 text-center space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#006FFF] text-xs font-extrabold uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" /> Digital Guru Certificate of Completion
                </div>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">This is proudly presented to</p>
                <h2 className="text-3xl font-extrabold text-slate-900 font-display">{activeCertModal.recipientName}</h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  for successfully completing 100% of the curriculum modules and practical assessments for
                </p>
                <h3 className="text-xl font-extrabold text-[#006FFF]">{activeCertModal.courseTitle}</h3>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200 text-left text-xs">
                  <div>
                    <div className="text-slate-400 uppercase font-bold text-[10px]">Certificate Number</div>
                    <div className="font-mono font-bold text-slate-900">{activeCertModal.certificateNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400 uppercase font-bold text-[10px]">Issued Date</div>
                    <div className="font-bold text-slate-900">{new Date(activeCertModal.issuedAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  HMAC-SHA256 Verification Hash: {activeCertModal.verificationCode}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
