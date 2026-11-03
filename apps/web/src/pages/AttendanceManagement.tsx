import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StudentAvatar } from '../components/StudentAvatar';
import { Batch } from '../types';
import { matchStudentVoice, EnrolledStudentCandidate, AttendanceMethod } from '@tuition/shared';
import { useWebSpeechRecognition } from '../hooks/useWebSpeechRecognition';
import {
  Mic,
  MicOff,
  Volume2,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Users,
  AlertCircle,
  FileText,
  Send,
  X,
  Edit2,
  RefreshCw,
  Check,
  Phone,
  Sparkles,
  HelpCircle,
  UserCheck,
} from 'lucide-react';

export const AttendanceManagement: React.FC = () => {
  const { activeInstitute } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [batchLoading, setBatchLoading] = useState<boolean>(true);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    notificationNote?: string;
  } | null>(null);

  // Active view tab: 'voice' (primary) | 'daily' | 'reports' | 'sms_logs'
  const [viewTab, setViewTab] = useState<'voice' | 'daily' | 'reports' | 'sms_logs'>('voice');

  // Confirmation & Smart Voice Attendance State
  const [voiceSearching, setVoiceSearching] = useState<boolean>(false);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [recentAutoCheckIn, setRecentAutoCheckIn] = useState<{
    student: any;
    smsNotification?: {
      queued: boolean;
      recipient?: string;
      status?: string;
      reason?: string;
      count?: number;
    };
  } | null>(null);
  const [alreadyCheckedInNotice, setAlreadyCheckedInNotice] = useState<{
    student: any;
    checkInTimeFormatted: string;
  } | null>(null);
  const [pendingVoiceCandidate, setPendingVoiceCandidate] = useState<EnrolledStudentCandidate | null>(null);
  const [candidateOptions, setCandidateOptions] = useState<EnrolledStudentCandidate[]>([]);
  const [manualVoiceInput, setManualVoiceInput] = useState<string>('');
  const [noMatchPhrase, setNoMatchPhrase] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Correction Modal State
  const [correctionTarget, setCorrectionTarget] = useState<any>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionIsLate, setCorrectionIsLate] = useState<boolean>(false);

  // SMS Logs State
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  // Reports State
  const [reportsData, setReportsData] = useState<any[]>([]);
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Load batches reliably with institute context
  const loadBatches = useCallback(async () => {
    try {
      setBatchLoading(true);
      setBatchError(null);
      const res = await apiFetch('/academics/batches');
      const b: Batch[] = res.data?.batches || [];
      setBatches(b);
      if (b.length > 0) {
        setSelectedBatchId((prev) => (prev && b.some((x) => x.id === prev) ? prev : b[0].id));
      } else {
        setSelectedBatchId('');
        setSelectedSubjectId('');
      }
    } catch (err: any) {
      console.error('[AttendanceManagement] Failed to load batches:', err);
      setBatchError(err.message || 'Failed to load academic batches');
    } finally {
      setBatchLoading(false);
    }
  }, [activeInstitute?.id]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const availableSubjects = useMemo(() => {
    const b = batches.find((x) => x.id === selectedBatchId);
    return b?.batchSubjects || [];
  }, [batches, selectedBatchId]);

  // Fetch Attendance Summary
  const fetchSummary = useCallback(async () => {
    if (!selectedBatchId) {
      setAttendanceData({ records: [], counts: { totalStudents: 0, checkedInCount: 0, checkedOutCount: 0, absentCount: 0, lateCount: 0 } });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setFetchError(null);
      const query = new URLSearchParams({
        batchId: selectedBatchId,
        date: selectedDate,
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      });
      const res = await apiFetch(`/attendance/summary?${query.toString()}`);
      setAttendanceData(res.data);
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Failed to load batch attendance');
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, selectedSubjectId, selectedDate]);

  const handleRefreshRoster = useCallback(async () => {
    if (batches.length === 0) {
      await loadBatches();
    }
    await fetchSummary();
  }, [batches.length, loadBatches, fetchSummary]);

  useEffect(() => {
    if (viewTab === 'daily' || viewTab === 'voice') {
      fetchSummary();
    } else if (viewTab === 'sms_logs') {
      apiFetch('/notifications/sms')
        .then((res) => setSmsLogs(res.data?.notifications || []))
        .catch(console.error);
    } else if (viewTab === 'reports') {
      const q = new URLSearchParams({
        startDate: reportStartDate,
        endDate: reportEndDate,
        ...(selectedBatchId ? { batchId: selectedBatchId } : {}),
        ...(selectedSubjectId ? { subjectId: selectedSubjectId } : {}),
      });
      apiFetch(`/attendance/reports?${q.toString()}`)
        .then((res) => setReportsData(res.data?.events || []))
        .catch(console.error);
    }
  }, [selectedBatchId, selectedSubjectId, selectedDate, viewTab, reportStartDate, reportEndDate, fetchSummary]);

  // Candidates enrolled in the selected batch
  const enrolledCandidates: EnrolledStudentCandidate[] = useMemo(() => {
    if (!attendanceData?.records) return [];
    return attendanceData.records.map((r: any) => ({
      id: r.student.id,
      firstName: r.student.firstName || r.student.name?.split(' ')[0] || '',
      lastName: r.student.lastName || r.student.name?.split(' ').slice(1).join(' ') || '',
      admissionNumber: r.student.admissionNumber,
      rollNumber: r.student.rollNumber,
      phone: r.student.phone,
      photoUrl: r.student.photoUrl,
      status: r.student.status,
    }));
  }, [attendanceData]);

  // Unified Attendance Action executor (supports Check In & Check Out, optimistic UI, live KPIs, & real SMS status)
  const executeStudentAttendanceAction = useCallback(
    async (
      candidate: EnrolledStudentCandidate,
      action: 'CHECK_IN' | 'CHECK_OUT',
      method: AttendanceMethod | 'MANUAL' | 'QR_SCAN' | 'VOICE_CONFIRMED' = AttendanceMethod.VOICE_CONFIRMED,
      isAuto = false
    ) => {
      setActionLoading(candidate.id);
      setFeedback(null);
      setAlreadyCheckedInNotice(null);
      if (!isAuto) {
        setRecentAutoCheckIn(null);
      }

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const idempotencyKey = `ATT_${candidate.id}_${todayStr}_${action}_1`;
        const endpoint = action === 'CHECK_IN' ? '/attendance/check-in' : '/attendance/check-out';
        const res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            studentId: candidate.id,
            batchId: selectedBatchId || candidate.batchId || undefined,
            subjectId: selectedSubjectId || candidate.subjectId || undefined,
            method,
            idempotencyKey,
          }),
        });

        if (res.data?.alreadyProcessed) {
          setAlreadyCheckedInNotice({
            student: res.data.student,
            checkInTimeFormatted: res.data.student.checkInTimeFormatted || 'earlier today',
          });
          setPendingVoiceCandidate(null);
          setCandidateOptions([]);
          setVoiceResult(null);
          return;
        }

        const notifInfo = res.data?.notification;
        const smsInfo = res.data?.smsNotification;
        let notificationNote = '';
        if (smsInfo?.queued) {
          const rec = smsInfo.recipient ? ` to ${smsInfo.recipient}` : '';
          notificationNote = 'In-app notification sent to linked parents';
        } else if (smsInfo?.reason) {
          notificationNote = smsInfo.reason;
        }

        const nowFormatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(new Date());

        const newStatus = action === 'CHECK_IN' ? 'CHECKED_IN' : 'CHECKED_OUT';

        // 1. Optimistically update roster row and counts immediately (zero latency)
        setAttendanceData((prev: any) => {
          if (!prev?.records) return prev;
          const updatedRecords = prev.records.map((r: any) => {
            if (r.student.id === candidate.id) {
              return {
                ...r,
                status: newStatus,
                checkInTime: action === 'CHECK_IN' ? new Date().toISOString() : r.checkInTime,
                checkInTimeFormatted: action === 'CHECK_IN' ? nowFormatted : r.checkInTimeFormatted,
                checkOutTime: action === 'CHECK_OUT' ? new Date().toISOString() : r.checkOutTime,
                checkOutTimeFormatted: action === 'CHECK_OUT' ? nowFormatted : r.checkOutTimeFormatted,
              };
            }
            return r;
          });

          const checkedInCount = updatedRecords.filter((r: any) => r.status === 'CHECKED_IN').length;
          const checkedOutCount = updatedRecords.filter((r: any) => r.status === 'CHECKED_OUT').length;
          const presentTotal = checkedInCount + checkedOutCount;
          const absentCount = updatedRecords.length - presentTotal;

          return {
            ...prev,
            counts: {
              ...prev.counts,
              totalStudents: updatedRecords.length,
              checkedInCount,
              checkedOutCount,
              presentTotal,
              absentCount,
            },
            records: updatedRecords,
          };
        });

        // 2. Set recent banner / feedback
        if (isAuto && action === 'CHECK_IN') {
          setRecentAutoCheckIn({
            student: res.data?.student || { ...candidate, checkInTimeFormatted: nowFormatted },
            smsNotification: res.data?.smsNotification,
          });
        } else {
          setFeedback({
            type: 'success',
            message: `${candidate.firstName} ${candidate.lastName} ${action === 'CHECK_IN' ? 'checked in' : 'checked out'} successfully.`,
            notificationNote,
          });
        }

        setPendingVoiceCandidate(null);
        setCandidateOptions([]);
        setVoiceResult(null);

        // 3. Immediately sync authoritative summary from backend
        fetchSummary();
      } catch (err: any) {
        console.warn('[Attendance Action Error]', err);
        if (err.data?.alreadyCheckedIn) {
          setAlreadyCheckedInNotice({
            student: err.data.data?.student || candidate,
            checkInTimeFormatted: err.data.data?.existingEvent?.eventTimeFormatted || 'earlier today',
          });
          setPendingVoiceCandidate(null);
          setCandidateOptions([]);
          setVoiceResult(null);
        } else if (err.data?.alreadyCheckedOut) {
          setFeedback({
            type: 'warning',
            message: err.message || `${candidate.firstName} ${candidate.lastName} has already checked out today.`,
          });
          setPendingVoiceCandidate(null);
          setCandidateOptions([]);
          setVoiceResult(null);
        } else {
          setFeedback({
            type: 'error',
            message: err.message || `Failed to record ${action.toLowerCase()}`,
          });
        }
      } finally {
        setActionLoading(null);
      }
    },
    [selectedBatchId, selectedSubjectId, fetchSummary]
  );

  // Perform Voice Match with Backend and Dynamic Check-In / Check-Out
  const isSearchingRef = React.useRef(false);
  const performVoiceMatch = useCallback(
    async (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!trimmed || isSearchingRef.current) return;

      isSearchingRef.current = true;
      setVoiceSearching(true);
      setNoMatchPhrase(null);
      setFeedback(null);
      setPendingVoiceCandidate(null);
      setCandidateOptions([]);
      setAlreadyCheckedInNotice(null);
      setRecentAutoCheckIn(null);

      try {
        const res = await apiFetch('/attendance/voice-match', {
          method: 'POST',
          body: JSON.stringify({
            transcript: trimmed,
            batchId: selectedBatchId || undefined,
            subjectId: selectedSubjectId || undefined,
          }),
        });

        if (res.success) {
          setVoiceResult(res);

          // Case A: Exactly one eligible student matches
          if (res.status === 'EXACT_SINGLE' && res.bestMatch) {
            const proposed = res.proposedAction || (res.bestMatch.alreadyCheckedIn ? 'CHECK_OUT' : 'CHECK_IN');
            if (proposed === 'CHECK_IN' && res.autoActionEligible) {
              await executeStudentAttendanceAction(res.bestMatch, 'CHECK_IN', 'VOICE_CONFIRMED', true);
            } else if (proposed === 'CHECK_OUT') {
              // Student is currently checked in; offer one-click Check-Out confirmation
              setPendingVoiceCandidate({
                ...res.bestMatch,
                recommendedAction: 'CHECK_OUT',
              });
              setCandidateOptions([]);
            } else if (proposed === 'COMPLETED' || res.alreadyCheckedOut) {
              setFeedback({
                type: 'warning',
                message: `${res.bestMatch.firstName} ${res.bestMatch.lastName} has already checked out for today.`,
              });
              setVoiceResult(null);
            }
          } else if (res.status === 'EXACT_MULTIPLE' || res.status === 'FUZZY_MULTIPLE') {
            // Case B: Multiple students match -> Show candidate cards with individual Check In / Check Out action
            setCandidateOptions(res.matches || []);
            setPendingVoiceCandidate(null);
          } else if (res.status === 'FUZZY_SINGLE' && res.bestMatch) {
            // Low confidence match -> Staff confirmation required
            setPendingVoiceCandidate(res.bestMatch);
            setCandidateOptions([]);
          } else if (res.status === 'NO_MATCH') {
            // Case C: No student matches
            setNoMatchPhrase(trimmed);
            setCandidateOptions([]);
            setPendingVoiceCandidate(null);
          }
        }
      } catch (err: any) {
        console.error('[Voice Match Backend Error]', err);
        // Fallback: If backend search fails or offline, use shared client voice matcher
        const localRes = matchStudentVoice(trimmed, enrolledCandidates);
        if (localRes.status === 'EXACT_SINGLE' && localRes.bestMatch) {
          setPendingVoiceCandidate(localRes.bestMatch);
          setCandidateOptions([]);
        } else if (localRes.status === 'EXACT_MULTIPLE' || localRes.status === 'FUZZY_MULTIPLE') {
          const cands =
            localRes.allMatches ||
            (localRes.exactMatches.length > 0
              ? localRes.exactMatches
              : localRes.fuzzyMatches.map((f) => f.student));
          setCandidateOptions(cands);
          setPendingVoiceCandidate(null);
        } else {
          setNoMatchPhrase(trimmed);
          setCandidateOptions([]);
          setPendingVoiceCandidate(null);
        }
      } finally {
        setVoiceSearching(false);
        isSearchingRef.current = false;
      }
    },
    [selectedBatchId, selectedSubjectId, enrolledCandidates, executeStudentAttendanceAction]
  );

  // Web Speech Recognition Hook
  const handleSpeechResult = useCallback(
    (spokenText: string, isFinal: boolean) => {
      if (!spokenText.trim()) return;
      if (isFinal) {
        performVoiceMatch(spokenText);
      }
    },
    [performVoiceMatch]
  );

  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useWebSpeechRecognition({
    lang: 'en-IN',
    continuous: true,
    interimResults: true,
    onResult: handleSpeechResult,
  });

  // Handle manual transcription query if staff types or pastes voice text
  const handleManualVoiceMatch = (text: string) => {
    setManualVoiceInput(text);
  };

  const handleManualVoiceSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (manualVoiceInput.trim()) {
      performVoiceMatch(manualVoiceInput.trim());
    }
  };

  // Perform Voice-Confirmed Attendance (Manual confirm)
  const handleConfirmVoiceAttendance = async (student: EnrolledStudentCandidate) => {
    const actionType =
      student.recommendedAction === 'CHECK_OUT' || student.alreadyCheckedIn ? 'CHECK_OUT' : 'CHECK_IN';
    await executeStudentAttendanceAction(student, actionType, 'VOICE_CONFIRMED', false);
    resetTranscript();
    setManualVoiceInput('');
  };

  // Handle Manual Check-In
  const handleCheckIn = async (studentId: string, isLate = false) => {
    const candidate =
      enrolledCandidates.find((c) => c.id === studentId) ||
      ({ id: studentId, firstName: 'Student', lastName: '' } as any);
    await executeStudentAttendanceAction(candidate, 'CHECK_IN', 'MANUAL', false);
  };

  // Handle Manual Check-Out
  const handleCheckOut = async (studentId: string) => {
    const candidate =
      enrolledCandidates.find((c) => c.id === studentId) ||
      ({ id: studentId, firstName: 'Student', lastName: '' } as any);
    await executeStudentAttendanceAction(candidate, 'CHECK_OUT', 'MANUAL', false);
  };

  // Execute Correction
  const handleSaveCorrection = async () => {
    if (!correctionTarget || !correctionReason) return;
    try {
      await apiFetch(`/attendance/${correctionTarget.eventId}/correction`, {
        method: 'PATCH',
        body: JSON.stringify({
          reason: correctionReason,
          isLate: correctionIsLate,
        }),
      });
      setFeedback({ type: 'success', message: 'Attendance correction saved successfully' });
      setCorrectionTarget(null);
      fetchSummary();
    } catch (err: any) {
      alert(`Failed to save correction: ${err.message}`);
    }
  };

  const records = attendanceData?.records || [];
  const counts = attendanceData?.counts || {
    totalStudents: 0,
    checkedInCount: 0,
    checkedOutCount: 0,
    absentCount: 0,
    lateCount: 0,
  };

  const filteredRecords = records.filter((item: any) => {
    const s = item.student;
    const nameMatch = s.name.toLowerCase().includes(search.toLowerCase());
    const rollMatch = s.rollNumber ? s.rollNumber.toLowerCase().includes(search.toLowerCase()) : false;
    const admMatch = s.admissionNumber ? s.admissionNumber.toLowerCase().includes(search.toLowerCase()) : false;
    return nameMatch || rollMatch || admMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#F1F5F9]">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Attendance Management</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Voice-based attendance, rapid speech recognition, daily roster, and guardian in-app alerts
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E2E8F0] rounded-xl shadow-sm">
          <button
            onClick={() => setViewTab('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewTab === 'voice'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Attendance</span>
          </button>
          <button
            onClick={() => setViewTab('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewTab === 'daily'
                ? 'bg-[#006FFF] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            Daily Sheet
          </button>
          <button
            onClick={() => setViewTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewTab === 'reports'
                ? 'bg-[#006FFF] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            Reports
          </button>
          <button
            onClick={() => setViewTab('sms_logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewTab === 'sms_logs'
                ? 'bg-[#006FFF] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            Notification Logs
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-start justify-between border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5" />
            )}
            <div>
              <div className="font-bold">{feedback.message}</div>
              {feedback.notificationNote && (
                <div className="text-[11px] font-medium opacity-90 mt-0.5">
                  Notification: {feedback.notificationNote}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 text-[#64748B] hover:text-[#0F172A]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Controls Bar: Batch & Date Picker */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#006FFF]">Class Batch:</span>
            <select
              value={selectedBatchId}
              disabled={batchLoading}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setPendingVoiceCandidate(null);
                setCandidateOptions([]);
                resetTranscript();
              }}
              className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 disabled:opacity-60"
            >
              {batchLoading ? (
                <option value="">Loading batches...</option>
              ) : batches.length === 0 ? (
                <option value="">No batches found</option>
              ) : (
                batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.academicYear})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#006FFF]">Subject:</span>
            <select
              value={selectedSubjectId}
              disabled={batchLoading}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setPendingVoiceCandidate(null);
                setCandidateOptions([]);
                resetTranscript();
              }}
              className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 disabled:opacity-60"
            >
              <option value="">All Assigned Subjects</option>
              {availableSubjects.map((bs: any) => (
                <option key={bs.subject.id} value={bs.subject.id}>
                  {bs.subject.name} {bs.subject.code ? `(${bs.subject.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#006FFF]">Attendance Date:</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#0F172A]">
              <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>{attendanceData?.formattedDate || new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} (Today Only)</span>
            </div>
          </div>
        </div>

        {/* Live Attendance KPIs Pill — Guaranteed single line */}
        <div className="flex items-center gap-2 text-xs font-semibold shrink-0 whitespace-nowrap overflow-x-auto py-0.5">
          <span className="shrink-0 whitespace-nowrap text-[#006FFF] bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>Total: <strong>{counts.totalStudents}</strong></span>
          </span>
          <span className="shrink-0 whitespace-nowrap text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300">
            Present (Total): <strong>{counts.presentTotal ?? (counts.checkedInCount + counts.checkedOutCount)}</strong>
          </span>
          <span className="shrink-0 whitespace-nowrap text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-300">
            In Class: <strong>{counts.checkedInCount}</strong>
          </span>
          <span className="shrink-0 whitespace-nowrap text-[#006FFF] bg-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
            Checked Out: <strong>{counts.checkedOutCount}</strong>
          </span>
          <span className="shrink-0 whitespace-nowrap text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
            Absent: <strong>{counts.absentCount}</strong>
          </span>
          {loading && (
            <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8] animate-spin ml-1 shrink-0" />
          )}
        </div>
      </div>

      {/* VIEW: VOICE-BASED ATTENDANCE (PRIMARY WORKFLOW) */}
      {viewTab === 'voice' && (
        <div className="space-y-6">
          {/* Main Voice Panel */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Mic className="w-5 h-5 text-[#006FFF]" /> Voice Attendance Assistant
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Tap "Start Listening", call out the student's name, review match, and confirm check-in.
                </p>
              </div>

              {/* Speech Controls */}
              <div className="flex items-center gap-3">
                {isListening ? (
                  <button
                    onClick={stopListening}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-md transition animate-pulse"
                  >
                    <MicOff className="w-4 h-4" /> Stop Listening
                  </button>
                ) : (
                  <button
                    onClick={startListening}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-md transition"
                  >
                    <Mic className="w-4 h-4 text-amber-200" /> Start Listening
                  </button>
                )}

                <button
                  onClick={() => {
                    resetTranscript();
                    setPendingVoiceCandidate(null);
                    setCandidateOptions([]);
                    setManualVoiceInput('');
                  }}
                  title="Clear Speech & Matches"
                  className="p-2.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAF7F2] rounded-xl border border-[#E2E8F0] transition"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Listening Status & Browser Support Banner */}
            {!isSpeechSupported && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-bold">Web Speech API is not supported in this browser.</span> Please use
                  Google Chrome or Microsoft Edge for live microphone capture, or use the manual name search box below.
                </div>
              </div>
            )}

            {speechError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Status Indicator */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-[#64748B]">Microphone Status:</span>
                {isListening ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                    Listening (Indian English: en-IN)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#FAF7F2] text-[#64748B] border border-[#E2E8F0]">
                    Microphone Idle (Press "Start Listening")
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#94A3B8]">
                {enrolledCandidates.length} students enrolled in batch
              </span>
            </div>

            {/* Live Transcript Box */}
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2E8F0] space-y-1.5">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Recognized Speech:
              </span>
              <div className="min-h-[48px] text-sm text-[#0F172A] font-medium flex items-center">
                {transcript || interimTranscript ? (
                  <div className="space-x-1.5">
                    <span className="font-bold text-[#0F172A]">{transcript}</span>
                    <span className="italic text-[#94A3B8]">{interimTranscript}</span>
                  </div>
                ) : (
                  <span className="text-[#94A3B8] italic text-xs">
                    {isListening
                      ? 'Listening... say a student name (e.g. "Aarav Sharma" or "Priya present")'
                      : 'No speech captured yet. Click "Start Listening" above or type a name below.'}
                  </span>
                )}
              </div>
            </div>

            {/* Manual Name Search / Voice Typing Fallback Form */}
            <form onSubmit={handleManualVoiceSubmit} className="space-y-1.5">
              <label className="block text-xs font-bold text-[#006FFF]">
                Manual Speech Fallback / Type Student Name:
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={manualVoiceInput}
                    onChange={(e) => handleManualVoiceMatch(e.target.value)}
                    placeholder="Type student name to search authorized batch/subject roster..."
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={voiceSearching || !manualVoiceInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold disabled:opacity-50 transition flex items-center gap-1.5 shrink-0"
                >
                  {voiceSearching ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  )}
                  <span>Match & Check In</span>
                </button>
              </div>
            </form>

            {/* Voice Searching Progress Indicator */}
            {voiceSearching && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5 animate-pulse">
                <RefreshCw className="w-4 h-4 text-[#94A3B8] animate-spin shrink-0" />
                <span className="font-semibold">
                  Searching authorized batch and subject roster for spoken name...
                </span>
              </div>
            )}

            {/* Case A: Automatic Check-in Success Banner */}
            {recentAutoCheckIn && (
              <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 shadow-md animate-in fade-in space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      studentId={recentAutoCheckIn.student.id}
                      photoUrl={recentAutoCheckIn.student.photoUrl}
                      name={`${recentAutoCheckIn.student.firstName} ${recentAutoCheckIn.student.lastName}`}
                      size="lg"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-emerald-950">
                          {recentAutoCheckIn.student.firstName} {recentAutoCheckIn.student.lastName}
                        </h3>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-400">
                          Automatic Voice Check-In
                        </span>
                      </div>
                      <div className="text-xs text-emerald-800 mt-0.5 font-mono">
                        Admission No: {recentAutoCheckIn.student.admissionNumber}
                        {recentAutoCheckIn.student.batchName && ` • Batch: ${recentAutoCheckIn.student.batchName}`}
                      </div>
                      <div className="text-xs text-emerald-900 font-semibold mt-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Checked in at {recentAutoCheckIn.student.checkInTimeFormatted || 'Just now'} (VOICE_CONFIRMED)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setRecentAutoCheckIn(null)}
                    className="text-emerald-700 hover:text-emerald-950 p-1"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2.5 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {recentAutoCheckIn.smsNotification?.queued
                        ? `Parent In-App Notification Sent`
                        : `Parent Notification: ${recentAutoCheckIn.smsNotification?.reason || 'Dispatched'}`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setRecentAutoCheckIn(null);
                      resetTranscript();
                      setManualVoiceInput('');
                    }}
                    className="text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 self-end sm:self-auto"
                  >
                    Next Student ➔
                  </button>
                </div>
              </div>
            )}

            {/* Duplicate Check-in Prevention Notice */}
            {alreadyCheckedInNotice && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 shadow-sm animate-in fade-in space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      studentId={alreadyCheckedInNotice.student.id}
                      photoUrl={alreadyCheckedInNotice.student.photoUrl}
                      name={`${alreadyCheckedInNotice.student.firstName} ${alreadyCheckedInNotice.student.lastName}`}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#0F172A]">
                          {alreadyCheckedInNotice.student.firstName} {alreadyCheckedInNotice.student.lastName}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                          Already Checked In
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 mt-0.5">
                        Student is already checked in for today at <strong className="font-bold">{alreadyCheckedInNotice.checkInTimeFormatted}</strong>. Duplicate attendance record prevented; no duplicate notification created.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setAlreadyCheckedInNotice(null)}
                    className="text-amber-800 hover:text-amber-950 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Case C: No Match Feedback Card */}
            {noMatchPhrase && !pendingVoiceCandidate && candidateOptions.length === 0 && !recentAutoCheckIn && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-bold">No enrolled student in this batch matched speech '{noMatchPhrase}'.</span>
                    <span className="ml-1 text-[#64748B]">Please call out the student's name clearly, or select them from the roster below.</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNoMatchPhrase(null);
                    resetTranscript();
                    setManualVoiceInput('');
                  }}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 px-2 py-1 rounded-lg border border-amber-300 bg-white"
                >
                  Clear & Try Again
                </button>
              </div>
            )}

            {/* Low-Confidence Match (Requires Staff Confirmation) */}
            {pendingVoiceCandidate && (
              <div className="p-5 rounded-2xl bg-[#FAF7F2] border-2 border-[#006FFF] shadow-md animate-in fade-in space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      studentId={pendingVoiceCandidate.id}
                      photoUrl={pendingVoiceCandidate.photoUrl}
                      name={`${pendingVoiceCandidate.firstName} ${pendingVoiceCandidate.lastName}`}
                      size="lg"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-[#0F172A]">
                          {pendingVoiceCandidate.firstName} {pendingVoiceCandidate.lastName}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                          Low-Confidence Voice Match
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5 font-mono">
                        Admission No: {pendingVoiceCandidate.admissionNumber}
                        {pendingVoiceCandidate.phone && ` | Phone: ${pendingVoiceCandidate.phone}`}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-[#94A3B8] font-semibold bg-white px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                    Requires Staff Confirmation
                  </span>
                </div>

                <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setPendingVoiceCandidate(null);
                      resetTranscript();
                      setManualVoiceInput('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                  >
                    Cancel / Skip
                  </button>

                  <button
                    onClick={() => handleConfirmVoiceAttendance(pendingVoiceCandidate)}
                    disabled={actionLoading === pendingVoiceCandidate.id}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition disabled:opacity-50 ${
                      pendingVoiceCandidate.recommendedAction === 'CHECK_OUT' || pendingVoiceCandidate.alreadyCheckedIn
                        ? 'bg-[#006FFF] hover:bg-[#0058D4]'
                        : 'bg-emerald-700 hover:bg-emerald-800'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {actionLoading === pendingVoiceCandidate.id
                        ? 'Processing...'
                        : (pendingVoiceCandidate.recommendedAction === 'CHECK_OUT' || pendingVoiceCandidate.alreadyCheckedIn)
                        ? `Confirm Check-Out for ${pendingVoiceCandidate.firstName}`
                        : `Confirm Check-In for ${pendingVoiceCandidate.firstName}`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Case B: Multiple Matched Candidates -> Disambiguation List with Individual Check-In / Check-Out Buttons */}
            {candidateOptions.length > 0 && !pendingVoiceCandidate && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                    <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Multiple students match '{transcript || manualVoiceInput || voiceResult?.cleanedQuery || 'spoken name'}'. Please select action for the intended student:
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCandidateOptions([]);
                      resetTranscript();
                      setManualVoiceInput('');
                    }}
                    className="text-xs text-amber-800 hover:text-amber-950"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {candidateOptions.map((candidate) => {
                    const isCheckedIn = candidate.todayStatus === 'CHECKED_IN' || candidate.alreadyCheckedIn;
                    const isCheckedOut = candidate.todayStatus === 'CHECKED_OUT' || candidate.alreadyCheckedOut;

                    return (
                      <div
                        key={candidate.id}
                        className="p-3.5 rounded-xl bg-white border border-amber-200 hover:border-[#006FFF] shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StudentAvatar
                            studentId={candidate.id}
                            photoUrl={candidate.photoUrl}
                            name={`${candidate.firstName} ${candidate.lastName}`}
                            size="md"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#0F172A] truncate">
                              {candidate.firstName} {candidate.lastName}
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B]">
                              Adm: {candidate.admissionNumber}
                            </div>
                            {candidate.batchName && (
                              <div className="text-[10px] text-[#94A3B8] truncate">
                                {candidate.batchName} {candidate.subjectName ? `• ${candidate.subjectName}` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {isCheckedOut ? (
                          <span className="text-[11px] font-bold text-[#006FFF] bg-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#E2E8F0] shrink-0">
                            Checked Out {candidate.checkOutTimeFormatted ? `(${candidate.checkOutTimeFormatted})` : ''}
                          </span>
                        ) : isCheckedIn ? (
                          <button
                            onClick={() => executeStudentAttendanceAction(candidate, 'CHECK_OUT', 'VOICE_CONFIRMED', false)}
                            disabled={actionLoading === candidate.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-sm transition disabled:opacity-50 shrink-0"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{actionLoading === candidate.id ? 'Checking Out...' : 'Check Out'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => executeStudentAttendanceAction(candidate, 'CHECK_IN', 'VOICE_CONFIRMED', false)}
                            disabled={actionLoading === candidate.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{actionLoading === candidate.id ? 'Checking In...' : 'Check In'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Roster Snapshot with Manual Attendance Fallback */}
          <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Today's Batch Roster & Fallback</h3>
                <p className="text-xs text-[#64748B]">
                  Direct check-in/out buttons available if voice recognition is unavailable
                </p>
              </div>

              <button
                onClick={handleRefreshRoster}
                className="inline-flex items-center gap-1.5 text-xs text-[#006FFF] font-semibold hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Roster
              </button>
            </div>

            <div className="border border-[#F1F5F9] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#F1F5F9] text-[#64748B]">
                    <th className="py-2.5 px-3 font-bold">Student</th>
                    <th className="py-2.5 px-3 font-bold">Admission No</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE9]">
                  {batchError ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-rose-700 space-y-2">
                        <div>Failed to load academic batches: {batchError}</div>
                        <button
                          onClick={loadBatches}
                          className="px-3 py-1 bg-[#006FFF] text-white rounded-lg text-xs font-semibold"
                        >
                          Retry Loading Batches
                        </button>
                      </td>
                    </tr>
                  ) : batchLoading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#006FFF]" />
                          <span>Loading academic batches...</span>
                        </div>
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#64748B] space-y-2">
                        <div>No academic batches found in your institute. Please create a batch first.</div>
                        <button
                          onClick={loadBatches}
                          className="px-3 py-1 bg-[#FAF7F2] border border-[#E2E8F0] text-[#006FFF] rounded-lg text-xs font-semibold hover:bg-[#F0EAE1]"
                        >
                          Refresh Batches
                        </button>
                      </td>
                    </tr>
                  ) : fetchError ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-rose-700 space-y-2">
                        <div>Failed to load batch roster: {fetchError}</div>
                        <button
                          onClick={fetchSummary}
                          className="px-3 py-1 bg-[#006FFF] text-white rounded-lg text-xs font-semibold"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : loading ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#64748B]">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#006FFF]" />
                          <span>Loading batch students...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#64748B]">
                        No students are enrolled in this batch yet.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item: any) => {
                      const student = item.student;
                      return (
                        <tr key={student.id} className="hover:bg-[#FFFFFF]">
                          <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                            <div className="flex items-center gap-2">
                              <StudentAvatar studentId={student.id} photoUrl={student.photoUrl} name={student.name} size="xs" />
                              <span>{student.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#64748B]">
                            {student.admissionNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.status === 'CHECKED_IN' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                Checked In
                              </span>
                            ) : item.status === 'CHECKED_OUT' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0]">
                                Checked Out
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {item.status === 'ABSENT' && (
                              <button
                                onClick={() => handleCheckIn(student.id, false)}
                                disabled={actionLoading === student.id}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white transition shadow-sm disabled:opacity-50"
                              >
                                Check In
                              </button>
                            )}
                            {item.status === 'CHECKED_IN' && (
                              <button
                                onClick={() => handleCheckOut(student.id)}
                                disabled={actionLoading === student.id}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#006FFF] hover:bg-[#006FFF] text-white transition shadow-sm disabled:opacity-50"
                              >
                                Check Out
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DAILY SHEET */}
      {viewTab === 'daily' && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or admission no..."
              className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
          </div>

          {/* Records Table */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF7F2] border-b border-[#F1F5F9] text-[#64748B]">
                    <th className="py-3 px-4 font-bold">Student</th>
                    <th className="py-3 px-4 font-bold">Roll / Adm</th>
                    <th className="py-3 px-4 font-bold">Class Batch</th>
                    <th className="py-3 px-4 font-bold">Check-In</th>
                    <th className="py-3 px-4 font-bold">Check-Out</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEBE9]">
                  {batchLoading || loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">
                        Loading attendance data...
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B] space-y-2">
                        <div>No academic batches found. Please create or assign a batch first.</div>
                        <button
                          onClick={loadBatches}
                          className="px-3 py-1 bg-[#FAF7F2] border border-[#E2E8F0] text-[#006FFF] rounded-lg text-xs font-semibold hover:bg-[#F0EAE1]"
                        >
                          Refresh Batches
                        </button>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">
                        No students found for this batch.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((item: any) => {
                      const student = item.student;
                      return (
                        <tr key={student.id} className="hover:bg-[#FFFFFF] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-[#0F172A] text-sm">
                            {student.name}
                            <div className="text-[11px] font-mono text-[#64748B] font-normal">
                              {student.admissionNumber}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#475569]">
                            {student.rollNumber || student.admissionNumber}
                          </td>
                          <td className="py-3.5 px-4 text-[#475569]">{student.batchName}</td>
                          <td className="py-3.5 px-4 text-[#475569]">
                            {item.checkInTime ? (
                              <div>
                                <span className="font-mono text-emerald-800 font-bold">
                                  {new Date(item.checkInTime).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {item.isLate && (
                                  <span className="ml-1 text-[10px] text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-300 font-semibold">
                                    Late
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#94A3B8] italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#475569]">
                            {item.checkOutTime ? (
                              <span className="font-mono text-[#006FFF] font-bold">
                                {new Date(item.checkOutTime).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.status === 'CHECKED_IN' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                Checked In
                              </span>
                            ) : item.status === 'CHECKED_OUT' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0]">
                                Checked Out
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'ABSENT' && (
                                <>
                                  <button
                                    onClick={() => handleCheckIn(student.id, false)}
                                    disabled={actionLoading === student.id}
                                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white transition shadow-sm disabled:opacity-50"
                                  >
                                    Check In
                                  </button>
                                  <button
                                    onClick={() => handleCheckIn(student.id, true)}
                                    disabled={actionLoading === student.id}
                                    className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition disabled:opacity-50"
                                  >
                                    Late
                                  </button>
                                </>
                              )}

                              {item.status === 'CHECKED_IN' && (
                                <button
                                  onClick={() => handleCheckOut(student.id)}
                                  disabled={actionLoading === student.id}
                                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#006FFF] hover:bg-[#006FFF] text-white transition shadow-sm disabled:opacity-50"
                                >
                                  Check Out
                                </button>
                              )}

                              {item.eventId && (
                                <button
                                  onClick={() => {
                                    setCorrectionTarget(item);
                                    setCorrectionIsLate(item.isLate);
                                    setCorrectionReason('');
                                  }}
                                  title="Correct Attendance Record"
                                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: REPORTS */}
      {viewTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#006FFF]">From:</span>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A]"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-[#006FFF]">To:</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#F1F5F9] text-[#64748B]">
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Student Name</th>
                  <th className="py-3 px-4 font-bold">Event Type</th>
                  <th className="py-3 px-4 font-bold">Method</th>
                  <th className="py-3 px-4 font-bold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE9]">
                {reportsData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No events found for selected date range.
                    </td>
                  </tr>
                ) : (
                  reportsData.map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-[#FFFFFF]">
                      <td className="py-3 px-4 font-mono">
                        {new Date(ev.eventDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0F172A]">
                        {ev.student?.firstName} {ev.student?.lastName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            ev.eventType === 'CHECK_IN'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                          }`}
                        >
                          {ev.eventType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#006FFF]">
                        {ev.method}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#64748B]">
                        {new Date(ev.eventTime).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: SMS ALERTS */}
      {viewTab === 'sms_logs' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2E8F0] text-xs text-[#64748B] flex items-center justify-between">
            <div>
              <span className="font-bold text-[#006FFF]">Parent Notification Outbox:</span> Shows real-time
              attendance SMS status dispatched to eligible guardians.
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              Mock Provider Mode (Dev/Simulated)
            </span>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#F1F5F9] text-[#64748B]">
                  <th className="py-3 px-4 font-bold">Recipient Phone</th>
                  <th className="py-3 px-4 font-bold">Message Content</th>
                  <th className="py-3 px-4 font-bold">Template</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE9]">
                {smsLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No notification events found in outbox.
                    </td>
                  </tr>
                ) : (
                  smsLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-[#FFFFFF]">
                      <td className="py-3 px-4 font-mono text-[#0F172A]">
                        {log.phoneNumber}
                      </td>
                      <td className="py-3 px-4 max-w-sm truncate text-[#006FFF]">
                        {log.messageBody}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#94A3B8]">
                        {log.templateName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            log.status === 'SENT' || log.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : log.status === 'QUEUED'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {log.status === 'SENT' ? 'Simulated Sent' : log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#94A3B8]">
                        {new Date(log.createdAt).toLocaleTimeString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CORRECTION MODAL */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h2 className="text-lg font-bold text-[#0F172A]">Correct Attendance Record</h2>
              <button
                onClick={() => setCorrectionTarget(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div>
                <span className="font-semibold text-[#64748B]">Student:</span>{' '}
                <span className="font-bold text-[#0F172A]">{correctionTarget.student.name}</span>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#006FFF]">
                  <input
                    type="checkbox"
                    checked={correctionIsLate}
                    onChange={(e) => setCorrectionIsLate(e.target.checked)}
                    className="rounded text-[#006FFF] focus:ring-[#006FFF]/20"
                  />
                  <span>Mark as Late Arrival</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-[#006FFF] mb-1">
                  Reason for Correction *
                </label>
                <textarea
                  required
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Teacher verified voice error or biometric scan issue..."
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-4 py-2 font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCorrection}
                  disabled={!correctionReason.trim()}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold px-4 py-2 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  Save Correction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
