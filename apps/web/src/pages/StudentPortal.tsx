import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Building, 
  Users, 
  Sparkles,
  X,
  BookOpen,
  FileText,
  HelpCircle,
  Headphones,
  ArrowRight,
} from 'lucide-react';

export const StudentPortal: React.FC = () => {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [recentMaterials, setRecentMaterials] = useState<any[]>([]);
  const [recentHomework, setRecentHomework] = useState<any[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);

  useEffect(() => {
    async function loadStudentData() {
      try {
        setLoading(true);
        const [profRes, matRes, hwRes, quizRes] = await Promise.allSettled([
          apiFetch('/students/my/profile'),
          apiFetch('/materials'),
          apiFetch('/homework'),
          apiFetch('/quizzes'),
        ]);

        if (profRes.status === 'fulfilled' && profRes.value.success && profRes.value.data?.student) {
          setStudent(profRes.value.data.student);
        } else {
          setError('Student record not found');
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
    }

    loadStudentData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-3">
        <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping"></div>
        <span>Loading Student Portal...</span>
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
  const batchMap = new Map<string, { batch: any; subjects: Array<{ id: string; name: string; code?: string; teacherName?: string }> }>();
  for (const enr of (student.enrollments || [])) {
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
  const filteredAttendanceEvents = selectedBatchFilter === 'ALL'
    ? attendanceEvents
    : attendanceEvents.filter((evt: any) => evt.batchId === selectedBatchFilter);

  return (
    <div className="space-y-6">
      {/* Student Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#6D4C41] border border-[#6D4C41] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 text-white">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Enrolled Student
            </span>
            <span className="text-xs font-mono text-[#D7CCC8]">
              Admission: <strong className="text-white">{student.admissionNumber}</strong>
            </span>
            <span className="text-xs text-[#D7CCC8]">
              Created: <strong className="text-white">{formatKolkataDateTime(student.createdAt)}</strong>
            </span>
            {student.rollNumber && (
              <span className="text-xs font-mono text-[#D7CCC8]">
                Roll No: <strong className="text-white">{student.rollNumber}</strong>
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white mt-2">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-[#D7CCC8] mt-1 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#94A3B8]" />
            <span>{student.institute?.name} ({student.institute?.code})</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-[#D7CCC8] block">Active Enrollments</span>
            <span className="text-base font-bold text-white block mt-0.5">
              {enrolledBatches.length > 0
                ? `${enrolledBatches.length} Active Batch${enrolledBatches.length > 1 ? 'es' : ''}`
                : 'No active batch'}
            </span>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-[#006FFF] border border-[#CBD5E1] text-white flex items-center justify-center font-bold text-xl shadow-md">
            {student.firstName[0]}
          </div>
        </div>
      </div>

      {/* Actionable Recent Curriculum & Activity (Phase 7) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Recent Materials & Audio Lessons */}
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5 uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-[#64748B]" /> Recent Study Materials
            </span>
          </div>
          {recentMaterials.length === 0 ? (
            <p className="text-xs text-[#94A3B8] italic py-3 text-center">No materials published yet.</p>
          ) : (
            <div className="space-y-2">
              {recentMaterials.map((m: any) => (
                <div key={m.id} className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#0F172A] truncate">{m.title}</p>
                    <span className="text-[10px] text-[#94A3B8]">{m.batch?.name} • {m.type}</span>
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
                {recentHomework.filter((h) => !h.isSubmitted).length} Pending • {recentHomework.filter((h) => h.isSubmitted).length} Submitted
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
                        {hw.grade && (
                          <strong className="text-emerald-800 font-bold">• Grade: {hw.grade}</strong>
                        )}
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
                <div key={q.id} className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200/60 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-[#0F172A] truncate">{q.title}</p>
                    <span className="text-[10px] text-indigo-800">
                      {q.durationMinutes ? `${q.durationMinutes} mins • ` : ''}{q._count?.questions || 0} Questions
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
      <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0F172A] font-bold text-base">
                <GraduationCap className="w-5 h-5 text-[#64748B]" />
                <span>My Active Batches & Subjects</span>
              </div>
              <span className="text-xs text-[#94A3B8] font-medium">
                {enrolledBatches.length} Enrolled Batch{enrolledBatches.length > 1 ? 'es' : ''}
              </span>
            </div>

            {enrolledBatches.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9] text-xs text-[#94A3B8] text-center">
                No active batch allocations found for this student.
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
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm">
                <Users className="w-4 h-4 text-[#64748B]" />
                <span>Linked Guardians</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {student.parentRelations?.map((rel: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#0F172A] block">{rel.parent?.user?.fullName || 'Parent'}</span>
                      <span className="text-[#64748B] text-[11px] block mt-0.5">
                        {rel.relationship} {rel.isPrimaryContact && '• Primary'}
                      </span>
                    </div>
                    {rel.canReceiveSms && (
                      <span className="px-2 py-0.5 rounded-md bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1] text-[10px] font-semibold">
                        SMS Alerts
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance History */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#0F172A] font-semibold text-sm">
                  <Clock className="w-4 h-4 text-[#64748B]" />
                  <span>Recent Attendance Activity</span>
                </div>
                {enrolledBatches.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#94A3B8] font-medium">Batch Filter:</span>
                    <select
                      value={selectedBatchFilter}
                      onChange={(e) => setSelectedBatchFilter(e.target.value)}
                      className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#006FFF]/20"
                    >
                      <option value="ALL">All Enrolled Batches</option>
                      {enrolledBatches.map(({ batch }) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {filteredAttendanceEvents.length === 0 ? (
                <p className="text-xs text-[#94A3B8] italic p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                  {selectedBatchFilter === 'ALL'
                    ? 'No attendance scans recorded for this term yet.'
                    : 'No attendance scans recorded for the selected batch.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredAttendanceEvents.slice(0, 5).map((evt: any, i: number) => (
                    <div key={evt.id || i} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${evt.eventType === 'CHECK_IN' ? 'bg-emerald-600' : 'bg-amber-600'}`}></span>
                        <span className="font-semibold text-[#0F172A]">
                          {evt.eventType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} (Session #{evt.sessionNumber})
                        </span>
                        {evt.isLate && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300">Late</span>
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

          </div>
        </div>
    </div>
  );
};
