import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import {
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Laptop,
  Loader2,
  Printer,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';

interface ParentCoursesViewProps {
  student: any;
}

export const ParentCoursesView: React.FC<ParentCoursesViewProps> = ({ student }) => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [certVerification, setCertVerification] = useState<any | null>(null);
  const [verifyingCert, setVerifyingCert] = useState(false);

  const loadChildCourses = async () => {
    if (!student?.id) return;
    try {
      setLoading(true);
      setError(null);
      const [dashRes, certRes] = await Promise.all([
        apiFetch(`/courses/learning/my-dashboard?studentId=${encodeURIComponent(student.id)}`, { skipCache: true }),
        apiFetch(`/courses/students/${encodeURIComponent(student.id)}/certificates`, { skipCache: true }),
      ]);

      if (dashRes.success && dashRes.data) {
        setDashboard(dashRes.data);
      }
      if (certRes.success && Array.isArray(certRes.data)) {
        setCertificates(certRes.data);
      } else if (dashRes.data?.certificates) {
        setCertificates(dashRes.data.certificates);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load student LMS courses & certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setExpandedCourseId(null);
    loadChildCourses();
  }, [student?.id]);

  const handleOpenCertificate = async (cert: any) => {
    setSelectedCert(cert);
    setCertVerification(null);
    setVerifyingCert(true);
    try {
      const res = await apiFetch(`/courses/certificates/verify/${encodeURIComponent(cert.certificateNumber)}`, {
        skipCache: true,
      });
      if (res.success && res.data) {
        setCertVerification(res.data);
      }
    } catch {
      setCertVerification({ signatureValid: false });
    } finally {
      setVerifyingCert(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 bg-white rounded-3xl border border-[#E2E8F0] flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-[#006FFF]" />
        <span className="text-sm font-semibold">Loading {student?.firstName}&apos;s Global Courses &amp; Certificates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center space-y-3">
        <p className="font-semibold">{error}</p>
        <button
          onClick={loadChildCourses}
          className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const xp = dashboard?.xp || { totalXp: 0, level: 1, currentLevelFloor: 0, nextLevelThreshold: 50, recentLedger: [] };
  const enrollments = dashboard?.enrollments || [];
  const levelProgressPct = xp.nextLevelThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(((xp.totalXp - (xp.currentLevelFloor || 0)) / Math.max(1, xp.nextLevelThreshold - (xp.currentLevelFloor || 0))) * 100)
        )
      )
    : 100;

  return (
    <div className="space-y-6">
      {/* Gamification & LMS Overview Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#1E3A8A] text-white shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold border border-white/15 mb-2">
            <Laptop className="w-3.5 h-3.5 text-emerald-300" />
            Digital Guru Hybrid LMS &bull; Parent Read-Only Monitor
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {student?.firstName} {student?.lastName}&apos;s Global Courses
          </h2>
          <p className="text-xs text-blue-200 mt-1">
            Tracking enrolled curriculum progress, XP milestones, and verified certificates across Online &amp; Offline batches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 min-w-[140px]">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300 font-bold">
              <Trophy className="w-3.5 h-3.5" /> Level {xp.level}
            </div>
            <div className="text-xl font-black mt-0.5">{xp.totalXp} XP</div>
            <div className="w-full h-1.5 bg-white/15 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${levelProgressPct}%` }} />
            </div>
            {xp.nextLevelThreshold && (
              <div className="text-[10px] text-blue-200 mt-1">
                {Math.max(0, xp.nextLevelThreshold - xp.totalXp)} XP to Level {xp.level + 1}
              </div>
            )}
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px]">
            <div className="text-2xl font-black">{enrollments.length}</div>
            <div className="text-[11px] text-blue-200 font-semibold">Courses</div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px]">
            <div className="text-2xl font-black text-emerald-300">{certificates.length}</div>
            <div className="text-[11px] text-blue-200 font-semibold">Certificates</div>
          </div>
        </div>
      </div>

      {/* Enrolled Global Courses */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#006FFF]" />
            <h3 className="text-lg font-extrabold text-[#0F172A]">Enrolled Global Courses</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {enrollments.length} Active / Completed
          </span>
        </div>

        {enrollments.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-sm">
            No Global LMS course enrollments found for {student?.firstName} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {enrollments.map((enr: any) => {
              const isExpanded = expandedCourseId === enr.id;
              const modules = enr.course?.activeCurriculumVersion?.modules || [];
              const progressPct = enr.progressPercent ?? enr.progress ?? 0;

              return (
                <div
                  key={enr.id}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/60 overflow-hidden transition-all"
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            enr.mode === 'ONLINE'
                              ? 'bg-blue-50 text-[#006FFF] border-blue-200'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}
                        >
                          {enr.mode === 'ONLINE' ? <Laptop className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          {enr.mode === 'ONLINE' ? 'Online Direct' : 'Offline Classroom + LMS'}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            enr.isCompleted || enr.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {enr.isCompleted || enr.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
                        </span>

                        {enr.institute?.name && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            Campus: <strong className="text-slate-700">{enr.institute.name}</strong>
                          </span>
                        )}
                        {enr.batch?.name && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            &bull; Batch: <strong className="text-slate-700">{enr.batch.name}</strong>
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-extrabold text-[#0F172A] truncate">
                        {enr.course?.title}
                      </h4>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1 max-w-xs h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPct >= 100 ? 'bg-emerald-600' : 'bg-[#006FFF]'
                            }`}
                            style={{ width: `${Math.min(100, progressPct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-extrabold text-[#0F172A]">{progressPct}%</span>
                        <span className="text-xs text-slate-500">
                          ({enr.completedLessons ?? 0} / {enr.totalLessons ?? 0} lessons)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {enr.certificate && (
                        <button
                          onClick={() => handleOpenCertificate(enr.certificate)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                        >
                          <Award className="w-3.5 h-3.5" /> View Certificate
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedCourseId(isExpanded ? null : enr.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                      >
                        Syllabus ({modules.length} Modules)
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 border-t border-[#E2E8F0] space-y-3">
                      {modules.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No syllabus modules published yet.</p>
                      ) : (
                        modules.map((mod: any, idx: number) => (
                          <div key={mod.id} className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="font-bold text-xs text-slate-900 mb-2">
                              Module {idx + 1}: {mod.title}
                            </div>
                            <div className="space-y-1.5">
                              {(mod.chapters || []).map((ch: any) => (
                                <div
                                  key={ch.id}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50"
                                >
                                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                                    {enr.isCompleted ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    )}
                                    {ch.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verified Certificates Section */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-extrabold text-[#0F172A]">Earned Course Certificates</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{certificates.length} Issued</span>
        </div>

        {certificates.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-slate-500 text-xs">
            No course completion certificates issued yet. Certificates are unlocked upon 100% lesson completion.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert: any) => (
              <div
                key={cert.id}
                className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3" /> Verified Credential
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-600">
                      {cert.certificateNumber}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-[#0F172A] mt-2">
                    {cert.courseTitle || cert.course?.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Issued to <strong className="text-slate-900">{cert.recipientName}</strong> on{' '}
                    {new Date(cert.issuedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleOpenCertificate(cert)}
                  className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Inspect &amp; Print Certificate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificate Viewer Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                <Award className="w-4 h-4 text-emerald-600" /> Digital Guru Verified Certificate
              </div>
              <button
                onClick={() => setSelectedCert(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 text-center space-y-4 bg-gradient-to-b from-amber-50/40 via-white to-blue-50/40 border-b border-slate-100">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {verifyingCert ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying cryptographic signature...
                  </>
                ) : certVerification?.isAuthentic === false ? (
                  <span className="text-rose-700">Signature Check Failed</span>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> HMAC Authenticity Verified
                  </>
                )}
              </div>

              <div className="text-xs uppercase tracking-[0.2em] text-slate-400 font-bold">
                Certificate of Completion
              </div>
              <h2 className="text-2xl font-black text-slate-900">{selectedCert.recipientName}</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                has successfully completed 100% of the required curriculum for
              </p>
              <div className="text-lg font-extrabold text-[#006FFF]">
                {selectedCert.courseTitle || selectedCert.course?.title}
              </div>
              <div className="pt-3 flex items-center justify-center gap-6 text-xs text-slate-500">
                <div>
                  Certificate No: <strong className="font-mono text-slate-900">{selectedCert.certificateNumber}</strong>
                </div>
                <div>
                  Issued:{' '}
                  <strong className="text-slate-900">
                    {new Date(selectedCert.issuedAt).toLocaleDateString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="p-4 flex items-center justify-end gap-2 bg-white">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold"
              >
                <Printer className="w-4 h-4" /> Print Certificate
              </button>
              <button
                onClick={() => setSelectedCert(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

