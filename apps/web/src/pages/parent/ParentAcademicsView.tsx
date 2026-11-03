import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import {
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Star,
  Sparkles,
  Award,
  AlertCircle,
  CheckCircle,
  User,
} from 'lucide-react';

interface ParentAcademicsViewProps {
  student: any;
}

export const ParentAcademicsView: React.FC<ParentAcademicsViewProps> = ({ student }) => {
  const [academicData, setAcademicData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAcademics() {
      if (!student?.id) return;
      try {
        setLoading(true);
        const res = await apiFetch(`/parents/students/${student.id}/academics`);
        if (res.success && res.data) {
          setAcademicData(res.data);
        }
      } catch (err) {
        console.error('[Academics Fetch Error]', err);
      } finally {
        setLoading(false);
      }
    }

    loadAcademics();
  }, [student?.id]);

  const subjects = academicData?.subjects || [];
  const homework = academicData?.homework || [];
  const feedbacks = academicData?.feedbacks || [];
  const upcomingExams = academicData?.upcomingExams || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#64748B]" /> Academic Reports & Class Schedule
        </h2>
        <p className="text-xs text-[#64748B] mt-0.5">
          Curriculum subjects, timetable, homework assignments, and faculty feedback for{' '}
          <strong className="text-[#0F172A]">{student?.firstName} {student?.lastName}</strong>
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-[#94A3B8]">
          Loading academic reports...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Assigned Curriculum Subjects & Timetable */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#64748B]" /> Curriculum Subjects & Weekly Schedule
              </h3>
              <span className="text-xs text-[#94A3B8]">
                Batch: <strong className="text-[#0F172A]">{academicData?.student?.batchName}</strong>
              </span>
            </div>

            {subjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 hover:border-[#006FFF] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">{sub.name}</h4>
                        {sub.code && (
                          <span className="text-[10px] font-mono text-[#94A3B8]">{sub.code}</span>
                        )}
                      </div>
                      <span className="p-1.5 rounded-lg bg-[#006FFF]/10 text-[#006FFF]">
                        <BookOpen className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="text-xs text-[#64748B] space-y-1 pt-1 border-t border-[#E2E8F0]/60">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>{sub.schedule}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#94A3B8]" />
                        <span>Faculty: <strong className="text-[#0F172A]">{sub.teacher}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#94A3B8]">
                No subjects currently assigned to this batch.
              </div>
            )}
          </div>

          {/* Section 2: Homework & Assignments */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
              <FileText className="w-4 h-4 text-[#64748B]" /> Homework & Assigned Tasks ({homework.length})
            </h3>

            {homework.length > 0 ? (
              <div className="space-y-3">
                {homework.map((hw: any) => (
                  <div
                    key={hw.id}
                    className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[#0F172A] text-sm">{hw.title}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#006FFF]/10 text-[#006FFF]">
                          {hw.subject}
                        </span>
                      </div>
                      {hw.description && (
                        <p className="text-[#64748B] line-clamp-1">{hw.description}</p>
                      )}
                      <div className="text-[#94A3B8] flex items-center gap-3 text-[11px] pt-0.5">
                        <span>Assigned by: <strong>{hw.teacher}</strong></span>
                        {hw.dueDate && (
                          <span>
                            Due:{' '}
                            <strong className="text-[#0F172A]">
                              {new Date(hw.dueDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          hw.submissionStatus === 'GRADED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : hw.submissionStatus === 'SUBMITTED'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {hw.submissionStatus === 'GRADED'
                          ? `Graded (${hw.grade || 'Passed'})`
                          : hw.submissionStatus === 'SUBMITTED'
                          ? 'Submitted'
                          : 'Pending Submission'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#94A3B8]">
                No pending homework or tasks assigned at this time.
              </div>
            )}
          </div>

          {/* Section 3: Teacher Progress Feedback & Reviews */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
              <Sparkles className="w-4 h-4 text-[#64748B]" /> Faculty Academic Feedback & Reviews
            </h3>

            {feedbacks.length > 0 ? (
              <div className="space-y-3">
                {feedbacks.map((f: any) => (
                  <div
                    key={f.id}
                    className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0F172A] text-sm">{f.termName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D7CCC8]/40 text-[#006FFF]">
                            {f.periodType || 'TERM'}
                          </span>
                        </div>
                        <span className="text-[#94A3B8] text-[11px] block mt-0.5">
                          Assessed by {f.teacher} &bull;{' '}
                          {new Date(f.date).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {f.rating && (
                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, rIdx) => (
                            <Star
                              key={rIdx}
                              className={`w-4 h-4 ${
                                rIdx < f.rating ? 'fill-amber-400 text-amber-500' : 'text-[#D7CCC8]'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Auto-Calculated Metrics Bar */}
                    {(f.attendanceRate !== null || f.homeworkRate !== null || f.examAverage !== null) && (
                      <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-[#E2E8F0]/60 text-center">
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-[#94A3B8]">Attendance</span>
                          <strong className="text-xs font-black text-[#0F172A]">
                            {f.attendanceRate !== null ? `${f.attendanceRate}%` : 'N/A'}
                          </strong>
                        </div>
                        <div className="border-x border-[#E2E8F0]/60">
                          <span className="block text-[9px] uppercase font-bold text-[#94A3B8]">Homework</span>
                          <strong className="text-xs font-black text-[#0F172A]">
                            {f.homeworkRate !== null ? `${f.homeworkRate}%` : 'N/A'}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-[9px] uppercase font-bold text-[#94A3B8]">Test Average</span>
                          <strong className="text-xs font-black text-[#0F172A]">
                            {f.examAverage !== null ? `${f.examAverage}%` : 'N/A'}
                          </strong>
                        </div>
                      </div>
                    )}

                    <p className="text-[#0F172A] leading-relaxed italic bg-white p-3 rounded-xl border border-[#E2E8F0]/60">
                      "{f.remarks}"
                    </p>

                    <div className="space-y-2 text-[11px]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {f.strengths && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                            <strong className="block text-emerald-800 uppercase text-[10px]">Key Strengths:</strong>
                            <span className="mt-0.5 block">{f.strengths}</span>
                          </div>
                        )}
                        {f.improvements && (
                          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                            <strong className="block text-amber-800 uppercase text-[10px]">Areas to Improve:</strong>
                            <span className="mt-0.5 block">{f.improvements}</span>
                          </div>
                        )}
                      </div>
                      {f.recommendations && (
                        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                          <strong className="block text-sky-800 uppercase text-[10px]">Recommended Actions:</strong>
                          <span className="mt-0.5 block">{f.recommendations}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#94A3B8]">
                No progress reports have been published for this term yet.
              </div>
            )}
          </div>

          {/* Section 4: Upcoming Examinations */}
          {upcomingExams.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                <Award className="w-4 h-4 text-[#64748B]" /> Scheduled Upcoming Examinations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingExams.map((exam: any) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-[#0F172A]">{exam.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#006FFF]/10 text-[#006FFF]">
                        {exam.subject}
                      </span>
                    </div>
                    <div className="text-[#64748B] space-y-0.5">
                      <p>Type: <strong>{exam.examType}</strong></p>
                      <p>
                        Date:{' '}
                        <strong className="text-[#0F172A]">
                          {new Date(exam.examDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </strong>
                      </p>
                      <p>Total Marks: <strong>{exam.totalMarks}</strong> (Pass: {exam.passingMarks})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
