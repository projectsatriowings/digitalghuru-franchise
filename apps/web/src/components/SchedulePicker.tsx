import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, Calendar, Check, Sparkles, Edit3, ArrowRight } from 'lucide-react';

export interface SchedulePickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
  required?: boolean;
}

const DAYS_OF_WEEK = [
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' },
  { short: 'Sun', full: 'Sunday' },
];

const QUICK_DAY_PRESETS = [
  { label: 'Weekdays (Mon-Fri)', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { label: 'MWF', days: ['Mon', 'Wed', 'Fri'] },
  { label: 'TTS', days: ['Tue', 'Thu', 'Sat'] },
  { label: 'Weekends', days: ['Sat', 'Sun'] },
  { label: 'Daily', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
];

const COMMON_TIME_SLOTS = [
  { label: '4:00 - 5:30 PM (Evening)', startH: 4, startM: 0, startP: 'PM', endH: 5, endM: 30, endP: 'PM' },
  { label: '5:30 - 7:00 PM (Prime)', startH: 5, startM: 30, startP: 'PM', endH: 7, endM: 0, endP: 'PM' },
  { label: '6:00 - 7:30 PM (Late)', startH: 6, startM: 0, startP: 'PM', endH: 7, endM: 30, endP: 'PM' },
  { label: '10:00 - 11:30 AM (Morning)', startH: 10, startM: 0, startP: 'AM', endH: 11, endM: 30, endP: 'AM' },
  { label: '11:30 AM - 1:00 PM (Noon)', startH: 11, startM: 30, startP: 'AM', endH: 1, endM: 0, endP: 'PM' },
  { label: '2:00 - 3:30 PM (Afternoon)', startH: 2, startM: 0, startP: 'PM', endH: 3, endM: 30, endP: 'PM' },
];

interface TimeState {
  hour: number; // 1-12
  minute: number; // 0-59
  period: 'AM' | 'PM';
}

const timeToMinutes = (t: TimeState): number => {
  let h = t.hour % 12;
  if (t.period === 'PM') h += 12;
  return h * 60 + t.minute;
};

const minutesToTime = (totalMinutes: number): TimeState => {
  let normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  let h = Math.floor(normalized / 60);
  const m = normalized % 60;
  let p: 'AM' | 'PM' = 'AM';
  if (h >= 12) {
    p = 'PM';
    if (h > 12) h -= 12;
  } else if (h === 0) {
    h = 12;
  }
  return { hour: h, minute: m, period: p };
};

const formatScheduleString = (days: string[], start: TimeState, end: TimeState): string => {
  if (days.length === 0) return '';
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const sorted = [...days].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  let daysStr = '';
  if (sorted.length === 7) {
    daysStr = 'Daily';
  } else if (sorted.length === 5 && sorted.every((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d))) {
    daysStr = 'Weekdays';
  } else if (sorted.length === 2 && sorted.includes('Sat') && sorted.includes('Sun')) {
    daysStr = 'Weekends';
  } else {
    daysStr = sorted.join(', ');
  }

  const startStr = `${start.hour}:${start.minute.toString().padStart(2, '0')} ${start.period}`;
  const endStr = `${end.hour}:${end.minute.toString().padStart(2, '0')} ${end.period}`;
  return `${daysStr} ${startStr} - ${endStr}`;
};

const parseScheduleString = (val: string): { days: string[]; start: TimeState; end: TimeState; isRecognized: boolean } => {
  if (!val || !val.trim()) {
    return {
      days: [],
      start: { hour: 4, minute: 0, period: 'PM' },
      end: { hour: 5, minute: 30, period: 'PM' },
      isRecognized: true,
    };
  }

  const trimmed = val.trim();
  const foundDays: string[] = [];

  if (/Daily/i.test(trimmed)) {
    foundDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
  } else if (/Weekdays/i.test(trimmed) || /Mon\s*(?:-|to)\s*Fri/i.test(trimmed)) {
    foundDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri');
  } else if (/Weekends/i.test(trimmed) || /Sat\s*(?:-|to|&)\s*Sun/i.test(trimmed)) {
    foundDays.push('Sat', 'Sun');
  } else if (/Mon\s*(?:-|to)\s*Thu/i.test(trimmed)) {
    foundDays.push('Mon', 'Tue', 'Wed', 'Thu');
  } else if (/Mon\s*(?:-|to)\s*Sat/i.test(trimmed)) {
    foundDays.push('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');
  } else {
    DAYS_OF_WEEK.forEach((d) => {
      const shortPattern = new RegExp(`\\b${d.short}\\b`, 'i');
      const fullPattern = new RegExp(`\\b${d.full}\\b`, 'i');
      if (shortPattern.test(trimmed) || fullPattern.test(trimmed)) {
        if (!foundDays.includes(d.short)) {
          foundDays.push(d.short);
        }
      }
    });
  }

  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi;
  const timeMatches = [...trimmed.matchAll(timeRegex)];
  const validTimes: TimeState[] = [];

  for (const match of timeMatches) {
    const rawH = parseInt(match[1], 10);
    const rawM = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3] ? (match[3].toUpperCase() as 'AM' | 'PM') : null;

    if (rawH >= 1 && rawH <= 12 && rawM >= 0 && rawM <= 59) {
      validTimes.push({
        hour: rawH,
        minute: rawM,
        period: period || (rawH >= 8 && rawH <= 11 ? 'AM' : 'PM'),
      });
    }
  }

  let start: TimeState = { hour: 4, minute: 0, period: 'PM' };
  let end: TimeState = { hour: 5, minute: 30, period: 'PM' };

  if (validTimes.length >= 1) {
    start = validTimes[0];
    if (validTimes.length >= 2) {
      end = validTimes[1];
    } else {
      end = minutesToTime(timeToMinutes(start) + 90);
    }
  }

  const isRecognized = foundDays.length > 0 || validTimes.length > 0;
  return { days: foundDays, start, end, isRecognized };
};

export const SchedulePicker: React.FC<SchedulePickerProps> = ({
  value = '',
  onChange,
  label = 'Schedule & Timing',
  helperText,
}) => {
  const initialParsed = useMemo(() => parseScheduleString(value), []);
  const [selectedDays, setSelectedDays] = useState<string[]>(initialParsed.days);
  const [startTime, setStartTime] = useState<TimeState>(initialParsed.start);
  const [endTime, setEndTime] = useState<TimeState>(initialParsed.end);

  // Time target: editing 'start' or 'end'
  const [activeTarget, setActiveTarget] = useState<'start' | 'end'>('start');
  // Clock mode: picking 'hour' or 'minute'
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour');

  const [isManualMode, setIsManualMode] = useState(!initialParsed.isRecognized);
  const [manualText, setManualText] = useState(value || '');

  const lastSentRef = useRef<string>(value || '');
  const clockRef = useRef<SVGSVGElement | null>(null);

  // Current active time object
  const activeTime = activeTarget === 'start' ? startTime : endTime;
  const setActiveTime = (updater: (prev: TimeState) => TimeState) => {
    if (activeTarget === 'start') {
      const next = updater(startTime);
      setStartTime(next);
      updateSchedule(selectedDays, next, endTime);
    } else {
      const next = updater(endTime);
      setEndTime(next);
      updateSchedule(selectedDays, startTime, next);
    }
  };

  // Synchronize on external value change
  useEffect(() => {
    if (value !== lastSentRef.current) {
      lastSentRef.current = value;
      const parsed = parseScheduleString(value);
      setSelectedDays(parsed.days);
      setStartTime(parsed.start);
      setEndTime(parsed.end);
      setManualText(value);
      if (!parsed.isRecognized && value.trim()) {
        setIsManualMode(true);
      }
    }
  }, [value]);

  const updateSchedule = (days: string[], s: TimeState, e: TimeState) => {
    const formatted = formatScheduleString(days, s, e);
    lastSentRef.current = formatted;
    onChange(formatted);
  };

  const handleToggleDay = (dayShort: string) => {
    const updated = selectedDays.includes(dayShort)
      ? selectedDays.filter((d) => d !== dayShort)
      : [...selectedDays, dayShort];
    setSelectedDays(updated);
    updateSchedule(updated, startTime, endTime);
  };

  const handleApplyPreset = (presetDays: string[]) => {
    setSelectedDays(presetDays);
    updateSchedule(presetDays, startTime, endTime);
  };

  const handleApplyTimeSlot = (slot: (typeof COMMON_TIME_SLOTS)[0]) => {
    const newStart: TimeState = { hour: slot.startH, minute: slot.startM, period: slot.startP as any };
    const newEnd: TimeState = { hour: slot.endH, minute: slot.endM, period: slot.endP as any };
    setStartTime(newStart);
    setEndTime(newEnd);
    const days = selectedDays.length === 0 ? ['Mon', 'Wed', 'Fri'] : selectedDays;
    if (selectedDays.length === 0) setSelectedDays(days);
    updateSchedule(days, newStart, newEnd);
  };

  const handleApplyDuration = (durationMinutes: number) => {
    const sMinutes = timeToMinutes(startTime);
    const newEnd = minutesToTime(sMinutes + durationMinutes);
    setEndTime(newEnd);
    const days = selectedDays.length === 0 ? ['Mon', 'Wed', 'Fri'] : selectedDays;
    if (selectedDays.length === 0) setSelectedDays(days);
    updateSchedule(days, startTime, newEnd);
  };

  const durationLabel = useMemo(() => {
    let diff = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (diff <= 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h > 0 && m > 0) return `${h} hr ${m} mins`;
    if (h > 0) return `${h} hr${h > 1 ? 's' : ''}`;
    return `${m} mins`;
  }, [startTime, endTime]);

  // Small Clock Dimensions (Compact 140px diameter)
  const clockSize = 140;
  const cx = clockSize / 2;
  const cy = clockSize / 2;
  const radius = 50;

  // Clock Hand Angle calculation
  const handAngle = useMemo(() => {
    if (clockMode === 'hour') {
      const h = activeTime.hour % 12;
      return (h * 30 - 90) * (Math.PI / 180);
    } else {
      const m = activeTime.minute % 60;
      return (m * 6 - 90) * (Math.PI / 180);
    }
  }, [clockMode, activeTime]);

  const handX = cx + radius * Math.cos(handAngle);
  const handY = cy + radius * Math.sin(handAngle);

  // Hour markers 1-12
  const hourMarkers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // Minute markers in 5-min intervals
  const minuteMarkers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const handleSelectHour = (h: number) => {
    setActiveTime((prev) => ({ ...prev, hour: h }));
    // Auto switch to minute mode smoothly
    setTimeout(() => {
      setClockMode('minute');
    }, 250);
  };

  const handleSelectMinute = (m: number) => {
    setActiveTime((prev) => ({ ...prev, minute: m }));
  };

  return (
    <div className="space-y-2.5">
      {/* Label and Mode Switch */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block font-bold text-[#006FFF] text-xs">{label}</label>
          {helperText && <p className="text-[11px] text-[#94A3B8]">{helperText}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            const nextMode = !isManualMode;
            setIsManualMode(nextMode);
            if (nextMode) {
              setManualText(value);
            } else {
              const parsed = parseScheduleString(manualText);
              setSelectedDays(parsed.days);
              setStartTime(parsed.start);
              setEndTime(parsed.end);
              updateSchedule(parsed.days, parsed.start, parsed.end);
            }
          }}
          className="text-[11px] font-bold text-[#94A3B8] hover:text-[#006FFF] transition flex items-center gap-1"
        >
          <Edit3 className="w-3 h-3" />
          <span>{isManualMode ? 'Clock Builder' : 'Custom Text'}</span>
        </button>
      </div>

      {isManualMode ? (
        <div>
          <input
            type="text"
            placeholder="e.g. Mon, Wed, Fri 4:00 PM - 5:30 PM"
            value={manualText}
            onChange={(e) => {
              setManualText(e.target.value);
              lastSentRef.current = e.target.value;
              onChange(e.target.value);
            }}
            className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20 focus:outline-none"
          />
        </div>
      ) : (
        <div className="p-3.5 bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl space-y-3 text-xs">
          {/* Active Schedule Summary Badge */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-[#F1F5F9] rounded-xl shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" />
              <span>
                {selectedDays.length > 0
                  ? formatScheduleString(selectedDays, startTime, endTime)
                  : 'No days selected yet (select days below)'}
              </span>
            </div>
            {selectedDays.length > 0 && (
              <span className="text-[10px] font-bold text-[#64748B] bg-[#F8FAFC] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                {durationLabel}
              </span>
            )}
          </div>

          {/* 1. Day Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#006FFF]">Select Class Days:</span>
              <div className="flex items-center gap-1">
                {QUICK_DAY_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.days)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#006FFF] hover:text-white transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const isSelected = selectedDays.includes(d.short);
                return (
                  <button
                    key={d.short}
                    type="button"
                    onClick={() => handleToggleDay(d.short)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#006FFF] text-white shadow-sm'
                        : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {d.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Interactive Time Selection with Small Clock Dial */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-[#F1F5F9] items-center">
            {/* Left Column (7 cols): Start Time / End Time selector cards & presets */}
            <div className="md:col-span-7 space-y-2.5">
              {/* Target Cards: Start vs End Time */}
              <div className="grid grid-cols-2 gap-2">
                {/* Start Time Card */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTarget('start');
                    setClockMode('hour');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    activeTarget === 'start'
                      ? 'bg-white border-[#006FFF] shadow-sm ring-2 ring-[#4E342E]/10'
                      : 'bg-[#FAF8F5] border-[#F1F5F9] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    <span>Start Time</span>
                    {activeTarget === 'start' && <span className="w-1.5 h-1.5 rounded-full bg-[#006FFF]" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-black text-[#0F172A]">
                      {startTime.hour}:{startTime.minute.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs font-extrabold text-[#64748B]">{startTime.period}</span>
                  </div>
                </button>

                {/* End Time Card */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTarget('end');
                    setClockMode('hour');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    activeTarget === 'end'
                      ? 'bg-white border-[#006FFF] shadow-sm ring-2 ring-[#4E342E]/10'
                      : 'bg-[#FAF8F5] border-[#F1F5F9] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    <span>End Time</span>
                    {activeTarget === 'end' && <span className="w-1.5 h-1.5 rounded-full bg-[#006FFF]" />}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-black text-[#0F172A]">
                      {endTime.hour}:{endTime.minute.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs font-extrabold text-[#64748B]">{endTime.period}</span>
                  </div>
                </button>
              </div>

              {/* Quick Duration & Preset Slots */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#94A3B8]">Quick Duration:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '+45m', mins: 45 },
                      { label: '+1h', mins: 60 },
                      { label: '+1.5h', mins: 90 },
                      { label: '+2h', mins: 120 },
                    ].map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => handleApplyDuration(d.mins)}
                        className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#006FFF] hover:text-white transition font-medium"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#94A3B8]">Popular Slots:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleApplyTimeSlot(COMMON_TIME_SLOTS[0])}
                      className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#006FFF] hover:text-white transition font-medium"
                    >
                      4:00 - 5:30 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyTimeSlot(COMMON_TIME_SLOTS[1])}
                      className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#006FFF] hover:text-white transition font-medium"
                    >
                      5:30 - 7:00 PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Small Circular Clock Dial */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-2.5 bg-white border border-[#F1F5F9] rounded-2xl shadow-2xs">
              {/* Digital Header + Mode & AM/PM Pills */}
              <div className="w-full flex items-center justify-between mb-1.5 px-1">
                {/* Mode Selector (Hours vs Minutes) */}
                <div className="flex items-center bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setClockMode('hour')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      clockMode === 'hour' ? 'bg-[#006FFF] text-white shadow-xs' : 'text-[#64748B]'
                    }`}
                  >
                    Hr
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockMode('minute')}
                    className={`px-2 py-0.5 rounded-md font-bold transition ${
                      clockMode === 'minute' ? 'bg-[#006FFF] text-white shadow-xs' : 'text-[#64748B]'
                    }`}
                  >
                    Min
                  </button>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex items-center bg-[#FAF8F5] border border-[#E2E8F0] rounded-lg p-0.5 text-[10px]">
                  {(['AM', 'PM'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActiveTime((prev) => ({ ...prev, period: p }))}
                      className={`px-2 py-0.5 rounded-md font-bold transition ${
                        activeTime.period === p ? 'bg-[#006FFF] text-white shadow-xs' : 'text-[#64748B]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Small SVG Clock Dial (140px diameter) */}
              <div className="relative flex items-center justify-center">
                <svg
                  ref={clockRef}
                  width={clockSize}
                  height={clockSize}
                  className="select-none"
                >
                  {/* Outer Clock Dial Circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 15}
                    fill="#FAF8F5"
                    stroke="#D7CCC8"
                    strokeWidth="1.5"
                  />
                  {/* Inner subtle circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 12}
                    fill="none"
                    stroke="#EFEBE9"
                    strokeWidth="1"
                  />

                  {/* Clock Hand Line */}
                  <line
                    x1={cx}
                    y1={cy}
                    x2={handX}
                    y2={handY}
                    stroke="#4E342E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Clock Center Pin */}
                  <circle cx={cx} cy={cy} r="3.5" fill="#4E342E" />
                  {/* Clock Pointer Tip */}
                  <circle cx={handX} cy={handY} r="9" fill="#4E342E" />

                  {/* Clock Dial Numbers */}
                  {clockMode === 'hour'
                    ? hourMarkers.map((h) => {
                        const angle = (h * 30 - 90) * (Math.PI / 180);
                        const nx = cx + radius * Math.cos(angle);
                        const ny = cy + radius * Math.sin(angle);
                        const isSelected = activeTime.hour === h || (h === 12 && activeTime.hour === 0);

                        return (
                          <g
                            key={h}
                            onClick={() => handleSelectHour(h)}
                            className="cursor-pointer group"
                          >
                            <circle
                              cx={nx}
                              cy={ny}
                              r="10"
                              fill="transparent"
                              className="group-hover:fill-[#D7CCC8]/30 transition"
                            />
                            <text
                              x={nx}
                              y={ny + 3.5}
                              textAnchor="middle"
                              className={`text-[10px] font-bold select-none ${
                                isSelected ? 'fill-white font-extrabold' : 'fill-[#4E342E]'
                              }`}
                            >
                              {h}
                            </text>
                          </g>
                        );
                      })
                    : minuteMarkers.map((m) => {
                        const angle = (m * 6 - 90) * (Math.PI / 180);
                        const nx = cx + radius * Math.cos(angle);
                        const ny = cy + radius * Math.sin(angle);
                        const isSelected = Math.round(activeTime.minute / 5) * 5 === m;

                        return (
                          <g
                            key={m}
                            onClick={() => handleSelectMinute(m)}
                            className="cursor-pointer group"
                          >
                            <circle
                              cx={nx}
                              cy={ny}
                              r="10"
                              fill="transparent"
                              className="group-hover:fill-[#D7CCC8]/30 transition"
                            />
                            <text
                              x={nx}
                              y={ny + 3.5}
                              textAnchor="middle"
                              className={`text-[9px] font-bold select-none ${
                                isSelected ? 'fill-white font-extrabold' : 'fill-[#4E342E]'
                              }`}
                            >
                              {m.toString().padStart(2, '0')}
                            </text>
                          </g>
                        );
                      })}
                </svg>
              </div>

              {/* Mode indicator label below clock */}
              <span className="text-[9px] text-[#94A3B8] font-semibold mt-1">
                {activeTarget === 'start' ? 'Editing Start Time' : 'Editing End Time'} ({clockMode === 'hour' ? 'Tap hour' : 'Tap minute'})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SchedulePicker;
