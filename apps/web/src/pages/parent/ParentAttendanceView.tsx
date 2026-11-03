import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCw,
  QrCode,
  Info,
} from 'lucide-react';

interface ParentAttendanceViewProps {
  student: any;
}

export const ParentAttendanceView: React.FC<ParentAttendanceViewProps> = ({ student }) => {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<any>(null);

  const fetchAttendance = async () => {
    if (!student?.id) return;
    try {
      setLoading(true);
      const res = await apiFetch(
        `/parents/students/${student.id}/attendance?month=${currentMonth}&year=${currentYear}`
      );
      if (res.success && res.data) {
        setAttendanceData(res.data);
      }
    } catch (err) {
      console.error('[Attendance Fetch Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [student?.id, currentMonth, currentYear]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatKolkataTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--';
    const d = new Date(timeStr);
    return isNaN(d.getTime())
      ? '--:--'
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
  };

  // First day of month offset (0 = Sunday, 1 = Monday, ...)
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();

  const metrics = attendanceData?.metrics || {
    totalWorkingDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    attendancePercentage: 100,
  };

  return (
    <div className="space-y-6">
      {/* Header and Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#64748B]" /> Attendance Report & Calendar
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verified check-in / check-out timestamps for{' '}
            <strong className="text-[#0F172A]">{student?.firstName} {student?.lastName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-[#E2E8F0] shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-[#0F172A] min-w-[120px] text-center select-none">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={fetchAttendance}
            className="p-1.5 ml-1 rounded-lg bg-[#F8FAFC] hover:bg-[#D7CCC8]/40 text-[#006FFF] transition-colors"
            title="Refresh Attendance from Teacher Portal"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
            Working Days
          </span>
          <span className="text-2xl font-black text-[#0F172A] block mt-1">
            {metrics.totalWorkingDays}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
            Present Days
          </span>
          <span className="text-2xl font-black text-emerald-900 block mt-1">
            {metrics.presentDays}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            Late Arrivals
          </span>
          <span className="text-2xl font-black text-amber-900 block mt-1">
            {metrics.lateDays}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
            Absent Days
          </span>
          <span className="text-2xl font-black text-rose-900 block mt-1">
            {metrics.absentDays}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#006FFF] text-white shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D7CCC8] block">
            Attendance Rate
          </span>
          <span className="text-2xl font-black text-white block mt-1">
            {metrics.attendancePercentage}%
          </span>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-[#94A3B8] uppercase tracking-wider pb-2 border-b border-[#F1F5F9]">
          <span className="text-rose-600">Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-[#94A3B8]">
            Loading attendance records for {monthNames[currentMonth - 1]} {currentYear}...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Blank offset days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-[60px] sm:min-h-[85px] rounded-xl bg-[#F8FAFC]/40" />
            ))}

            {/* Calendar Days */}
            {attendanceData?.calendar?.map((dayRecord: any) => {
              const isPresent = dayRecord.status === 'PRESENT';
              const isLate = dayRecord.status === 'LATE';
              const isAbsent = dayRecord.status === 'ABSENT';

              const isSelected = selectedDay?.date === dayRecord.date;

              return (
                <div
                  key={dayRecord.date}
                  onClick={() => setSelectedDay(dayRecord)}
                  className={`min-h-[60px] sm:min-h-[85px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-[#4E342E] shadow-md'
                      : 'hover:shadow-sm'
                  } ${
                    isPresent
                      ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400'
                      : isLate
                      ? 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                      : isAbsent
                      ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400'
                      : 'bg-[#F8FAFC]/60 border-transparent hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isPresent
                          ? 'text-emerald-900'
                          : isLate
                          ? 'text-amber-900'
                          : isAbsent
                          ? 'text-rose-900'
                          : 'text-[#94A3B8]'
                      }`}
                    >
                      {dayRecord.day}
                    </span>
                    {isPresent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 hidden sm:block" />}
                    {isLate && <Clock className="w-3.5 h-3.5 text-amber-600 hidden sm:block" />}
                    {isAbsent && <XCircle className="w-3.5 h-3.5 text-rose-600 hidden sm:block" />}
                  </div>

                  {/* Day Status Label & Time on Desktop */}
                  <div className="mt-1">
                    {isPresent && (
                      <div className="text-[10px] text-emerald-800 font-mono hidden sm:block">
                        In: {formatKolkataTime(dayRecord.checkIn)}
                      </div>
                    )}
                    {isLate && (
                      <div className="text-[10px] text-amber-800 font-mono hidden sm:block">
                        Late: {formatKolkataTime(dayRecord.checkIn)}
                      </div>
                    )}
                    {isAbsent && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 py-0.5 rounded block text-center">
                        Absent
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-center gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500"></span>
            <span className="text-[#64748B]">Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500"></span>
            <span className="text-[#64748B]">Late Arrival</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500"></span>
            <span className="text-[#64748B]">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#F1F5F9]"></span>
            <span className="text-[#94A3B8]">No Class / Holiday</span>
          </div>
        </div>
      </div>

      {/* Selected Day Details Panel */}
      {selectedDay && (
        <div className="p-6 rounded-3xl bg-white border border-[#006FFF] shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#006FFF]" /> Session Details for {selectedDay.date}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                selectedDay.status === 'PRESENT'
                  ? 'bg-emerald-100 text-emerald-800'
                  : selectedDay.status === 'LATE'
                  ? 'bg-amber-100 text-amber-800'
                  : selectedDay.status === 'ABSENT'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              {selectedDay.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#F8FAFC]">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-semibold">Check-In Time</span>
              <strong className="text-[#0F172A] font-mono text-sm block mt-0.5">
                {formatKolkataTime(selectedDay.checkIn)}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC]">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-semibold">Check-Out Time</span>
              <strong className="text-[#0F172A] font-mono text-sm block mt-0.5">
                {formatKolkataTime(selectedDay.checkOut)}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC]">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-semibold">Late Status</span>
              <span className={`font-semibold block mt-0.5 ${selectedDay.isLate ? 'text-amber-700 font-bold' : 'text-emerald-700'}`}>
                {selectedDay.isLate ? 'Marked Late' : 'On Time'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F8FAFC]">
              <span className="text-[10px] text-[#94A3B8] uppercase block font-semibold">Teacher Remarks</span>
              <span className="text-[#0F172A] block mt-0.5 italic">
                {selectedDay.remarks || 'No notes entered'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
