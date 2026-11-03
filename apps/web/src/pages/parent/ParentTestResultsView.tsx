import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import {
  Award,
  TrendingUp,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  BookOpen,
  Sparkles,
} from 'lucide-react';

interface ParentTestResultsViewProps {
  student: any;
}

export const ParentTestResultsView: React.FC<ParentTestResultsViewProps> = ({ student }) => {
  const [reportCard, setReportCard] = useState<any>(null);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');

  useEffect(() => {
    async function loadData() {
      if (!student?.id) return;
      try {
        setLoading(true);
        const [rcRes, exRes] = await Promise.all([
          apiFetch(`/exams/students/${student.id}/report-card`),
          apiFetch('/exams?status=PUBLISHED'),
        ]);
        if (rcRes.success && rcRes.data) {
          setReportCard(rcRes.data);
        }
        if (exRes.success && exRes.data?.exams) {
          setUpcomingExams(exRes.data.exams.filter((e: any) => !e.isResultsPublished));
        }
      } catch (err) {
        console.error('[Load Report Card / Exams Error]', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [student?.id]);

  const allMarks = reportCard?.marks || [];
  const summary = reportCard?.summary || {
    totalExams: 0,
    totalPassed: 0,
    totalMaxMarks: 0,
    totalMarksObtained: 0,
    cumulativePercentage: 0,
    status: 'NEEDS_IMPROVEMENT',
  };

  // Distinct subjects for filter
  const subjects = ['ALL', ...Array.from(new Set(allMarks.map((m: any) => m.subject)))];

  const filteredMarks = selectedSubject === 'ALL'
    ? allMarks
    : allMarks.filter((m: any) => m.subject === selectedSubject);

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#64748B]" /> Test Results & Performance Tracking
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verified marks and examination analytics for{' '}
            <strong className="text-[#0F172A]">{student?.firstName} {student?.lastName}</strong>
          </p>
        </div>

        {subjects.length > 1 && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-[#E2E8F0] shadow-sm">
            <Filter className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-xs text-[#64748B] font-bold">Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs font-semibold text-[#0F172A] bg-transparent focus:outline-none cursor-pointer"
            >
              {subjects.map((sub: any) => (
                <option key={sub} value={sub}>
                  {sub === 'ALL' ? 'All Curriculum Subjects' : sub}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-16 text-center text-xs text-[#94A3B8]">
          Loading examination results...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Examination Timetable (Scheduled) */}
          {upcomingExams.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#64748B]" /> Upcoming Scheduled Examinations ({upcomingExams.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingExams.map((ex: any) => (
                  <div key={ex.id} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-[#0F172A]">{ex.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Scheduled
                      </span>
                    </div>
                    <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                      <span>{ex.subject?.name}</span>
                      <span>&bull;</span>
                      <span>{ex.batch?.name}</span>
                    </div>
                    <div className="text-xs text-[#0F172A] flex items-center justify-between pt-1 border-t border-[#E2E8F0]/50">
                      <span>Date: <strong>{new Date(ex.examDate).toLocaleDateString('en-IN')}</strong></span>
                      {(ex.startTime || ex.endTime) && (
                        <span className="text-[#64748B] font-mono">{ex.startTime || ''} - {ex.endTime || ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cumulative Performance Analytics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                Exams Completed
              </span>
              <span className="text-2xl font-black text-[#0F172A] block mt-1">
                {summary.totalExams}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Tests Cleared
              </span>
              <span className="text-2xl font-black text-emerald-900 block mt-1">
                {summary.totalPassed}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                Total Marks
              </span>
              <span className="text-2xl font-black text-[#0F172A] block mt-1">
                {summary.totalMarksObtained} / {summary.totalMaxMarks}
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-[#006FFF] text-white shadow-sm text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D7CCC8] block">
                Overall Percentage
              </span>
              <span className="text-2xl font-black text-white block mt-1">
                {summary.cumulativePercentage}%
              </span>
            </div>
          </div>

          {/* Performance Trend Progress Chart */}
          {allMarks.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#64748B]" /> Performance Progression Over Time
              </h3>

              <div className="space-y-3 pt-2">
                {allMarks.slice(0, 6).map((mark: any) => (
                  <div key={mark.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0F172A]">
                        {mark.subject} &bull; {mark.examTitle}
                      </span>
                      <span className="font-mono font-bold text-[#006FFF]">
                        {mark.marksObtained}/{mark.totalMarks} ({mark.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#F1F5F9] rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          mark.isAbsent
                            ? 'bg-rose-400'
                            : mark.percentage >= 75
                            ? 'bg-emerald-600'
                            : mark.percentage >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${mark.isAbsent ? 100 : Math.min(100, mark.percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Examination Results Detailed Table */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#64748B] uppercase tracking-wider">
              Examination Score Records ({filteredMarks.length})
            </h3>

            {filteredMarks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] text-[#94A3B8] font-bold uppercase tracking-wider">
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Subject</th>
                      <th className="pb-3">Exam Details</th>
                      <th className="pb-3 text-right">Score</th>
                      <th className="pb-3 text-right">Percentage</th>
                      <th className="pb-3 text-center">Result</th>
                      <th className="pb-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    {filteredMarks.map((m: any) => (
                      <tr key={m.id} className="hover:bg-[#F8FAFC]/60 transition-colors">
                        <td className="py-3 text-[#64748B]">
                          {new Date(m.examDate).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 font-bold text-[#0F172A]">
                          {m.subject}
                        </td>
                        <td className="py-3">
                          <span className="font-semibold text-[#0F172A] block">{m.examTitle}</span>
                          <span className="text-[10px] text-[#94A3B8]">{m.examType}</span>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-[#0F172A]">
                          {m.isAbsent ? 'ABSENT' : `${m.marksObtained} / ${m.totalMarks}`}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-[#006FFF]">
                          {m.isAbsent ? '0%' : `${m.percentage}%`}
                        </td>
                        <td className="py-3 text-center">
                          {m.isAbsent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Absent
                            </span>
                          ) : m.isPass ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Pass
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Fail
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-[#64748B] italic">
                          {m.remarks || 'Satisfactory'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-[#94A3B8]">
                No examination records found for the selected filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
