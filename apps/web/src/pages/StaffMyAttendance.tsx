import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Compass,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Calendar,
  ShieldCheck,
  Navigation,
  Check,
  ChevronRight,
  Info,
  HelpCircle,
  Copy,
  Home,
  Building,
  Video,
  ExternalLink,
  X,
  Send,
  FileText,
  BookOpen,
} from 'lucide-react';

// Client-side Haversine for instant UI visual feedback (server always recalculates authoritatively)
function calculateClientDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const StaffMyAttendance: React.FC = () => {
  const { user } = useAuth();

  // Status & Data State
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Attendance Mode: ON_SITE vs WFH
  const [attendanceMode, setAttendanceMode] = useState<'ON_SITE' | 'WFH'>('ON_SITE');
  const [wfhEligibility, setWfhEligibility] = useState<{
    isAuthorized: boolean;
    authorization?: any;
    allowStaffWfhRequests?: boolean;
    todayStr?: string;
  } | null>(null);
  const [wfhEligibilityLoading, setWfhEligibilityLoading] = useState(false);

  // Staff WFH Requests & Modal
  const [myWfhRequests, setMyWfhRequests] = useState<any[]>([]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestDurationType, setRequestDurationType] = useState<'SINGLE_DAY' | 'DATE_RANGE'>('SINGLE_DAY');
  const [requestStartDate, setRequestStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [requestEndDate, setRequestEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [requestReasonCategory, setRequestReasonCategory] = useState('WEATHER_DISRUPTION');
  const [requestReason, setRequestReason] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // Online Classes
  const [onlineClasses, setOnlineClasses] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classActionTarget, setClassActionTarget] = useState<any | null>(null);
  const [classActionStatus, setClassActionStatus] = useState<'CONDUCTED' | 'CANCELLED'>('CONDUCTED');
  const [classActionRemarks, setClassActionRemarks] = useState('');
  const [classActionSubmitting, setClassActionSubmitting] = useState(false);

  // Live Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // GPS Device State
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);

  // Action Loading & Messages
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  // Personal History
  const [history, setHistory] = useState<any[]>([]);
  const [historyMetrics, setHistoryMetrics] = useState<any>(null);

  // Keep clock updated
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Today's Attendance Status
  const fetchTodayStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/staff-attendance/today');
      if (res.success && res.data) {
        setData(res.data);
        // If an active session exists today, match its attendanceMode
        if (res.data.session?.attendanceMode) {
          setAttendanceMode(res.data.session.attendanceMode);
        }
      }
    } catch (err: any) {
      console.error('[StaffMyAttendance] Fetch today error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch WFH Eligibility
  const fetchWfhEligibility = useCallback(async () => {
    try {
      setWfhEligibilityLoading(true);
      const res = await apiFetch('/staff-attendance/wfh/eligibility');
      if (res.success && res.data) {
        setWfhEligibility(res.data);
        // If authorized for WFH and user hasn't checked in yet, default mode to WFH
        if (res.data.isAuthorized && (!data?.session || data.status === 'NOT_CHECKED_IN')) {
          setAttendanceMode('WFH');
        }
      }
    } catch (err) {
      console.error('[StaffMyAttendance] Fetch WFH eligibility error:', err);
    } finally {
      setWfhEligibilityLoading(false);
    }
  }, [data?.session, data?.status]);

  // Fetch Staff's WFH Requests
  const fetchMyWfhRequests = useCallback(async () => {
    try {
      const res = await apiFetch('/staff-attendance/wfh/my-requests');
      if (res.success && res.data) {
        setMyWfhRequests(Array.isArray(res.data) ? res.data : []);
      } else {
        setMyWfhRequests([]);
      }
    } catch (err) {
      console.error('[StaffMyAttendance] Fetch my WFH requests error:', err);
      setMyWfhRequests([]);
    }
  }, []);

  // Fetch Today's Online Classes
  const fetchOnlineClasses = useCallback(async () => {
    try {
      setClassesLoading(true);
      const res = await apiFetch('/staff-attendance/wfh/online-classes');
      if (res.success && res.data) {
        const classList = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data.classes)
          ? res.data.classes
          : [];
        setOnlineClasses(classList);
      } else {
        setOnlineClasses([]);
      }
    } catch (err) {
      console.error('[StaffMyAttendance] Fetch online classes error:', err);
      setOnlineClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, []);

  // Fetch 7-Day History
  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiFetch('/staff-attendance/my-history?limit=7');
      if (res.success && res.data) {
        setHistory(res.data.sessions || []);
        setHistoryMetrics(res.data.metrics || null);
      }
    } catch (err) {
      console.error('[StaffMyAttendance] Fetch history error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTodayStatus();
    fetchWfhEligibility();
    fetchMyWfhRequests();
    fetchOnlineClasses();
    fetchHistory();
  }, [fetchTodayStatus, fetchWfhEligibility, fetchMyWfhRequests, fetchOnlineClasses, fetchHistory]);

  // Request & Verify Device GPS Location
  const verifyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device or browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    setFeedback(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Failed to obtain GPS location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in your browser settings.';
        else if (err.code === 2) msg = 'Position unavailable. Please turn on device GPS/Location services.';
        else if (err.code === 3) msg = 'GPS request timed out. Please retry outdoors.';
        setGpsError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      }
    );
  }, []);

  // Automatically trigger location verification on mount for on-site checks
  useEffect(() => {
    verifyLocation();
  }, [verifyLocation]);

  const handleCopyCoords = () => {
    if (deviceCoords) {
      navigator.clipboard.writeText(`${deviceCoords.latitude.toFixed(6)}, ${deviceCoords.longitude.toFixed(6)}`);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  // Calculated distance & eligibility
  const institute = data?.institute;
  const session = data?.session;
  const status = data?.status || 'NOT_CHECKED_IN';
  const isWfhAuthorized = wfhEligibility?.isAuthorized === true;

  const clientDistance = useMemo(() => {
    if (
      !deviceCoords ||
      !institute ||
      institute.latitude == null ||
      institute.longitude == null
    ) {
      return null;
    }
    return calculateClientDistance(
      institute.latitude,
      institute.longitude,
      deviceCoords.latitude,
      deviceCoords.longitude
    );
  }, [deviceCoords, institute]);

  const isWithinRadius = clientDistance != null && institute ? clientDistance <= institute.geofenceRadius : false;
  const isSessionFinalized = Boolean(session?.checkOutTime || status === 'CHECKED_OUT');

  // Determination of Check-in Capability based on selected mode
  const canCheckIn = useMemo(() => {
    if (status !== 'NOT_CHECKED_IN' || isSessionFinalized || actionSubmitting) return false;

    if (attendanceMode === 'WFH') {
      return isWfhAuthorized;
    } else {
      // ON_SITE requires GPS and within geofence
      return deviceCoords != null && isWithinRadius;
    }
  }, [status, isSessionFinalized, actionSubmitting, attendanceMode, isWfhAuthorized, deviceCoords, isWithinRadius]);

  const canCheckOut =
    !isSessionFinalized &&
    (status === 'CHECKED_IN' || status === 'LATE' || (status === 'MANUALLY_CORRECTED' && Boolean(session?.checkInTime)));

  // Elapsed Session Time (Live duration)
  const elapsedTimer = useMemo(() => {
    if (!session?.checkInTime || session?.checkOutTime) return null;
    const checkInMs = new Date(session.checkInTime).getTime();
    const nowMs = currentTime.getTime();
    const diffSeconds = Math.max(0, Math.floor((nowMs - checkInMs) / 1000));

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [session, currentTime]);

  // Handle Check-In
  const handleCheckIn = async () => {
    try {
      setActionSubmitting(true);
      setFeedback(null);

      const payload: any = {
        mode: attendanceMode,
        deviceInfo: navigator.userAgent,
        idempotencyKey: `checkin_${data?.staff?.id}_${data?.todayDateStr}_${attendanceMode}`,
      };

      if (attendanceMode === 'ON_SITE') {
        if (!deviceCoords) {
          verifyLocation();
          setActionSubmitting(false);
          return;
        }
        payload.latitude = deviceCoords.latitude;
        payload.longitude = deviceCoords.longitude;
        payload.accuracy = deviceCoords.accuracy;
      } else {
        // WFH Mode: Attach coordinates optionally if available for audit trail
        if (deviceCoords) {
          payload.latitude = deviceCoords.latitude;
          payload.longitude = deviceCoords.longitude;
          payload.accuracy = deviceCoords.accuracy;
        }
      }

      const res = await apiFetch('/staff-attendance/check-in', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message:
            res.message ||
            (attendanceMode === 'WFH'
              ? 'Checked in successfully for Work From Home (Remote)!'
              : 'Checked in successfully at Institute!'),
        });
        await fetchTodayStatus();
        await fetchHistory();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Check-in failed.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Network error during check-in.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    try {
      setActionSubmitting(true);
      setFeedback(null);

      const payload: any = {
        deviceInfo: navigator.userAgent,
        idempotencyKey: `checkout_${data?.staff?.id}_${data?.todayDateStr}`,
      };

      if (deviceCoords) {
        payload.latitude = deviceCoords.latitude;
        payload.longitude = deviceCoords.longitude;
        payload.accuracy = deviceCoords.accuracy;
      }

      const res = await apiFetch('/staff-attendance/check-out', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Checked out successfully!',
        });
        await fetchTodayStatus();
        await fetchHistory();
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'Check-out failed.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Network error during check-out.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Handle Submit Staff WFH Request
  const handleSubmitWfhRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) {
      alert('Please provide a reason for the WFH request.');
      return;
    }
    try {
      setRequestSubmitting(true);
      const finalEndDate = requestDurationType === 'SINGLE_DAY' ? requestStartDate : requestEndDate;
      const res = await apiFetch('/staff-attendance/wfh/request', {
        method: 'POST',
        body: JSON.stringify({
          startDate: requestStartDate,
          endDate: finalEndDate,
          reasonCategory: requestReasonCategory,
          reason: requestReason.trim(),
          notes: requestNotes.trim() || undefined,
        }),
      });

      if (res.success) {
        setRequestModalOpen(false);
        setRequestReason('');
        setRequestNotes('');
        setFeedback({
          type: 'success',
          message: 'WFH request submitted successfully. Awaiting Academic Admin review.',
        });
        await fetchWfhEligibility();
        await fetchMyWfhRequests();
      } else {
        alert(res.message || 'Failed to submit WFH request.');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting WFH request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  // Handle Update Online Class Status
  const handleUpdateOnlineClassStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classActionTarget) return;

    if (classActionStatus === 'CANCELLED' && !classActionRemarks.trim()) {
      alert('A cancellation reason is required.');
      return;
    }

    try {
      setClassActionSubmitting(true);
      const res = await apiFetch(`/staff-attendance/wfh/online-classes/${classActionTarget.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: classActionStatus,
          notes: classActionRemarks.trim() || undefined,
        }),
      });

      if (res.success) {
        setClassActionTarget(null);
        setClassActionRemarks('');
        await fetchOnlineClasses();
      } else {
        alert(res.message || 'Failed to update online class status.');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating class status.');
    } finally {
      setClassActionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-[#64748B]">
        <div className="flex items-center gap-2 font-semibold">
          <RefreshCw className="w-5 h-5 animate-spin text-[#006FFF]" />
          <span>Verifying attendance profile & geofence...</span>
        </div>
      </div>
    );
  }

  const activeAuth = wfhEligibility?.authorization;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {data?.staff?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">{data?.staff?.name || 'Staff Member'}</h1>
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-medium">
                <span className="font-mono bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                  {data?.staff?.employeeCode || 'STAFF'}
                </span>
                <span>•</span>
                <span>{data?.staff?.designation || 'Faculty'}</span>
                <span>•</span>
                <span>{institute?.name || 'Tuition Institute'}</span>
              </div>
            </div>
          </div>

          {/* Live Digital Clock */}
          <div className="text-left sm:text-right bg-[#FAF8F5] px-3.5 py-2 rounded-xl border border-[#E2E8F0]">
            <div className="text-[11px] font-semibold text-[#94A3B8] uppercase">
              {currentTime.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
            <div className="text-base font-mono font-bold text-[#0F172A]">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Attendance Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm space-y-6">
        {/* Work Mode Toggle Selector (On-Site vs WFH) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Select Attendance Mode</span>
            {session?.attendanceMode && (
              <span className="text-[11px] font-semibold text-[#94A3B8]">
                Mode locked by active session: <strong className="text-[#006FFF]">{session.attendanceMode === 'WFH' ? 'Work From Home' : 'On-Site'}</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl">
            <button
              type="button"
              disabled={!!session?.checkInTime && !session?.checkOutTime}
              onClick={() => setAttendanceMode('ON_SITE')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                attendanceMode === 'ON_SITE'
                  ? 'bg-[#006FFF] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              } disabled:cursor-not-allowed`}
            >
              <Building className="w-4 h-4" />
              <span>🏢 On-site at Institute</span>
            </button>
            <button
              type="button"
              disabled={!!session?.checkInTime && !session?.checkOutTime}
              onClick={() => setAttendanceMode('WFH')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                attendanceMode === 'WFH'
                  ? 'bg-[#006FFF] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              } disabled:cursor-not-allowed`}
            >
              <Home className="w-4 h-4" />
              <span>🏠 Work From Home</span>
            </button>
          </div>
        </div>

        {/* Status Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
          <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Today's Attendance Status</span>
          <div>
            {isSessionFinalized ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                Work Session Completed ({session?.attendanceMode === 'WFH' ? 'WFH' : 'On-Site'})
                {status === 'MANUALLY_CORRECTED' && ' (Admin Adjusted)'}
              </span>
            ) : status === 'CHECKED_IN' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active Session ({session?.attendanceMode === 'WFH' ? 'WFH' : 'On-Site'})
              </span>
            ) : status === 'LATE' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Checked In (Late)
              </span>
            ) : status === 'MANUALLY_CORRECTED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                Manually Adjusted by Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-300">
                Not Checked In
              </span>
            )}
          </div>
        </div>

        {/* Live Active Session Timer (if checked in) */}
        {elapsedTimer && (
          <div className="bg-gradient-to-r from-[#4E342E] to-[#3E2723] text-white p-5 rounded-2xl shadow-sm text-center space-y-1">
            <div className="text-xs font-semibold text-[#D7CCC8] uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Live Work Duration ({session?.attendanceMode === 'WFH' ? 'Work From Home' : 'On-Site Institute'})
            </div>
            <div className="text-3xl font-mono font-bold tracking-widest">{elapsedTimer}</div>
            <div className="text-[11px] text-[#94A3B8]">
              Checked in at{' '}
              {session?.checkInTime
                ? new Date(session.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : ''}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE A: WORK FROM HOME (WFH) PANEL                        */}
        {/* ========================================================= */}
        {attendanceMode === 'WFH' && (
          <div className="space-y-4">
            {isWfhAuthorized ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Approved for Work From Home Today</span>
                </div>
                <div className="text-xs text-emerald-800 space-y-1 pl-6">
                  <div>
                    <span className="font-semibold text-emerald-950">Reason:</span> {activeAuth?.reason}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-emerald-700">
                    <span>Scope: <strong>{activeAuth?.scope?.replace('_', ' ')}</strong></span>
                    <span>Category: <strong>{activeAuth?.reasonCategory}</strong></span>
                    <span>Authorized by: <strong>{activeAuth?.approvedBy?.fullName || 'Academic Admin'}</strong></span>
                  </div>
                  {activeAuth?.notes && (
                    <div className="text-[11px] text-emerald-700 italic pt-1 border-t border-emerald-200/60">
                      Teaching Notes: {activeAuth.notes}
                    </div>
                  )}
                </div>
                <div className="pt-2 pl-6 text-[11px] text-emerald-700 font-medium">
                  ✓ Geofence requirement waived. You can check in directly from home.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Work From Home Not Authorized for Today</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  You do not have an active Academic Admin approval to work remotely today. Regular physical attendance within the institute 200m geofence is required.
                </p>

                {/* Staff Request Button */}
                {wfhEligibility?.allowStaffWfhRequests !== false && (
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-amber-200/60">
                    <span className="text-[11px] text-amber-800">
                      Need permission due to weather, online classes, or personal emergency?
                    </span>
                    <button
                      type="button"
                      onClick={() => setRequestModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Request WFH Approval
                    </button>
                  </div>
                )}

                {/* Show Pending Requests if any */}
                {Array.isArray(myWfhRequests) && myWfhRequests.some((r) => r.status === 'PENDING') && (
                  <div className="p-2.5 rounded-lg bg-white border border-amber-300 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1 text-[11px] text-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      Pending Request Awaiting Review:
                    </div>
                    {myWfhRequests
                      .filter((r) => r.status === 'PENDING')
                      .map((req) => (
                        <div key={req.id} className="text-[11px] text-stone-700">
                          • {(() => {
                            const s = new Date(req.startDate).toLocaleDateString();
                            const e = new Date(req.endDate).toLocaleDateString();
                            return s === e ? `${s} (Single Day)` : `${s} to ${e}`;
                          })()} — {req.reason}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE B: ON-SITE GEOFENCE PANEL                            */}
        {/* ========================================================= */}
        {attendanceMode === 'ON_SITE' && (
          <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#94A3B8]" />
                <span className="text-xs font-bold text-[#0F172A]">Institute Geofence Range</span>
              </div>

              <button
                onClick={verifyLocation}
                disabled={gpsLoading}
                className="text-xs font-semibold text-[#006FFF] hover:text-[#0F172A] flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                <span>{gpsLoading ? 'Acquiring GPS...' : 'Refresh GPS'}</span>
              </button>
            </div>

            {gpsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{gpsError}</p>
                  <p className="text-[11px] mt-0.5">Please ensure GPS is enabled and permissions are granted.</p>
                </div>
              </div>
            ) : deviceCoords ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Geodesic Distance to Institute:</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                      isWithinRadius ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {clientDistance != null ? `${clientDistance} metres` : 'Calculating...'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Device GPS Accuracy:</span>
                  <span className="font-mono font-semibold text-xs text-stone-700">
                    {deviceCoords.accuracy != null ? `±${Math.round(deviceCoords.accuracy)}m` : 'N/A'}
                  </span>
                </div>

                {/* Detected Coordinates readout */}
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#E2E8F0]/40">
                  <span className="text-[#94A3B8]">Detected Device Location:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#006FFF]">
                      {deviceCoords.latitude.toFixed(6)}, {deviceCoords.longitude.toFixed(6)}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCoords}
                      className="text-[11px] text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-0.5 bg-white border border-[#E2E8F0] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Copy your exact coordinates to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCoords ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0]/60 flex items-start gap-2 text-[11px]">
                  {isSessionFinalized ? (
                    <span className="text-[#64748B] font-medium flex items-center gap-1.5 py-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Attendance finalized for today. Distance to institute: {clientDistance != null ? `${clientDistance}m` : 'N/A'}.
                    </span>
                  ) : isWithinRadius ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      Within permitted {institute?.geofenceRadius || 200}m radius ({clientDistance}m away). Ready to record attendance.
                    </span>
                  ) : (
                    <div className="text-red-900 bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-start gap-2 w-full">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-red-950">
                          Outside Geofence: {clientDistance} metres away (Allowed: {institute?.geofenceRadius || 200}m)
                        </p>
                        <p className="text-[11px] text-red-900 leading-normal">
                          Your device is currently outside the {institute?.geofenceRadius || 200}m institute boundary. Move within {institute?.geofenceRadius || 200}m to check in.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-3 text-center text-xs text-[#94A3B8]">
                Acquiring fresh device satellite coordinates...
              </div>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div>
          {status === 'NOT_CHECKED_IN' && !isSessionFinalized && (
            <button
              onClick={handleCheckIn}
              disabled={!canCheckIn}
              className={`w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                canCheckIn
                  ? 'bg-[#006FFF] hover:bg-[#0058D4] hover:shadow-lg active:scale-[0.99]'
                  : 'bg-stone-400 cursor-not-allowed opacity-70'
              }`}
            >
              {actionSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying & Recording Check-In...</span>
                </>
              ) : attendanceMode === 'WFH' ? (
                <>
                  <Home className="w-4 h-4" />
                  <span>
                    {isWfhAuthorized ? 'Check In (Work From Home)' : 'WFH Check-In (Requires Approval)'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isWithinRadius
                      ? 'Confirm & Check In to Institute'
                      : 'Check In (Requires 200m Geofence)'}
                  </span>
                </>
              )}
            </button>
          )}

          {canCheckOut && (
            <button
              onClick={handleCheckOut}
              disabled={actionSubmitting}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#B91C1C] hover:bg-[#991B1B] shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recording Check-Out...</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>
                    {session?.attendanceMode === 'WFH'
                      ? 'Check Out (Work From Home)'
                      : 'Check Out & Complete Work Session'}
                  </span>
                </>
              )}
            </button>
          )}

          {isSessionFinalized && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center text-xs text-blue-900 space-y-1.5">
              <div className="font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Work Session Finalized ({session?.attendanceMode === 'WFH' ? 'Work From Home' : 'On-Site'})
                {session?.isManuallyCorrected && ' — Manually Corrected'}
              </div>
              <p className="text-[#64748B]">
                Checked in: <b>{session?.checkInTime ? new Date(session.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</b>
                {'  •  '}
                Checked out: <b>{session?.checkOutTime ? new Date(session.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</b>
              </p>
              <p className="text-[#64748B]">
                Total recorded duration:{' '}
                <b>
                  {session?.workDurationMinutes != null
                    ? `${Math.floor(session.workDurationMinutes / 60)}h ${session.workDurationMinutes % 60}m`
                    : 'N/A'}
                </b>
              </p>
              {session?.correctionReason && (
                <p className="text-[11px] text-purple-700 italic pt-1 border-t border-blue-200">
                  Admin Note: {session.correctionReason}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION: TODAY'S ONLINE CLASSES & TEACHING SCHEDULE       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#94A3B8]" />
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Today's Online Classes & Teaching Schedule
            </h3>
          </div>
          <span className="text-[11px] text-[#94A3B8] italic">
            Class delivery tracked separately from work attendance
          </span>
        </div>

        {classesLoading ? (
          <div className="py-6 text-center text-xs text-[#94A3B8]">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-[#006FFF]" />
            Loading assigned classes...
          </div>
        ) : (!Array.isArray(onlineClasses) || onlineClasses.length === 0) ? (
          <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#FAF8F5] rounded-xl border border-[#E2E8F0]/60">
            <BookOpen className="w-6 h-6 mx-auto mb-2 text-[#94A3B8] opacity-60" />
            <p className="font-semibold text-[#0F172A]">No online classes scheduled for today.</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Classes assigned to your faculty profile will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(onlineClasses) ? onlineClasses : []).map((c) => {
              const log = c.todayLog;
              const deliveryStatus = log?.status || 'SCHEDULED';
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-[#FAF8F5] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#0F172A]">{c.batchName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#006FFF] text-white">
                        {c.subjectName} ({c.subjectCode || 'SUB'})
                      </span>
                      {deliveryStatus === 'CONDUCTED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ✓ Conducted
                        </span>
                      ) : deliveryStatus === 'CANCELLED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                          ✗ Cancelled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          Scheduled
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Time: {c.scheduledTime}
                    </div>
                    {log?.notes && (
                      <div className="text-[11px] text-stone-600 italic">
                        Notes: {log.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions & Meet Link */}
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                    {c.meetingLink ? (
                      <a
                        href={c.meetingLink.startsWith('http') ? c.meetingLink : `https://${c.meetingLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Google Meet
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-stone-400 bg-stone-100 px-2 py-1 rounded">
                        No Meet Link
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setClassActionTarget(c);
                        setClassActionStatus('CONDUCTED');
                        setClassActionRemarks('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold"
                    >
                      Mark Conducted
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setClassActionTarget(c);
                        setClassActionStatus('CANCELLED');
                        setClassActionRemarks('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-700 text-xs font-semibold"
                    >
                      Cancel Class
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* SECTION: RECENT 7-DAY HISTORY TABLE                       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#94A3B8]" />
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Recent 7-Day History</h3>
          </div>
          {historyMetrics && (
            <span className="text-xs text-[#94A3B8]">
              Total: <b>{historyMetrics.totalWorkHours} hrs</b>
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-center text-[#94A3B8] py-4">No past attendance records found.</p>
        ) : (
          <div className="divide-y divide-[#D7CCC8]/60">
            {history.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#0F172A]">
                      {new Date(s.attendanceDate).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        s.attendanceMode === 'WFH'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}
                    >
                      {s.attendanceMode === 'WFH' ? '🏠 WFH' : '🏢 On-Site'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#94A3B8]">
                    {s.checkInTime ? new Date(s.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    {' → '}
                    {s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-[#0F172A]">
                    {s.workDurationMinutes > 0
                      ? `${Math.floor(s.workDurationMinutes / 60)}h ${s.workDurationMinutes % 60}m`
                      : '—'}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-[#94A3B8]">{s.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exception Process Notice */}
      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] text-xs text-[#64748B] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#0F172A]">Experiencing location issues?</span> Standard browser GPS
          requires clear satellite visibility. If your device has genuine hardware malfunction, report to Academic Admin
          for an audited manual attendance correction.
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: STAFF WFH REQUEST MODAL                          */}
      {/* ========================================================= */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Home className="w-5 h-5 text-[#94A3B8]" />
                  Request Work From Home
                </h3>
                <p className="text-xs text-[#64748B]">
                  Submit remote work request for Academic Admin approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitWfhRequest} className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-1 bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl mb-1">
                <span className="text-xs font-semibold text-[#94A3B8] ml-2">Duration:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-white border border-[#E2E8F0]/60">
                  <button
                    type="button"
                    onClick={() => {
                      setRequestDurationType('SINGLE_DAY');
                      setRequestEndDate(requestStartDate);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      requestDurationType === 'SINGLE_DAY'
                        ? 'bg-[#006FFF] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestDurationType('DATE_RANGE')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      requestDurationType === 'DATE_RANGE'
                        ? 'bg-[#006FFF] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Multiple Days
                  </button>
                </div>
              </div>

              {requestDurationType === 'SINGLE_DAY' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={requestStartDate}
                    onChange={(e) => {
                      setRequestStartDate(e.target.value);
                      setRequestEndDate(e.target.value);
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={requestStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRequestStartDate(val);
                        if (requestEndDate < val) setRequestEndDate(val);
                      }}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">End Date *</label>
                    <input
                      type="date"
                      required
                      value={requestEndDate}
                      min={requestStartDate}
                      onChange={(e) => setRequestEndDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Reason Category *</label>
                <select
                  value={requestReasonCategory}
                  onChange={(e) => setRequestReasonCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                >
                  <option value="WEATHER_DISRUPTION">Weather Disruption (Heavy Rain / Cyclone)</option>
                  <option value="ONLINE_CLASSES">Online Classes Scheduled</option>
                  <option value="INSTITUTE_CLOSURE">Institute Closure</option>
                  <option value="INDIVIDUAL_REQUEST">Individual Faculty Request</option>
                  <option value="MANAGEMENT_APPROVAL">Management Approval</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Detailed Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Explain why you are requesting to work from home..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">Teaching Notes / Plan (Optional)</label>
                <textarea
                  rows={2}
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Online class schedule, Google Meet plans, or topics covered..."
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {requestSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{requestSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: UPDATE ONLINE CLASS STATUS MODAL                 */}
      {/* ========================================================= */}
      {classActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Video className="w-5 h-5 text-[#94A3B8]" />
                  {classActionStatus === 'CONDUCTED' ? 'Mark Class Conducted' : 'Report Class Cancellation'}
                </h3>
                <p className="text-xs text-[#64748B]">
                  {classActionTarget.batchName} • {classActionTarget.subjectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClassActionTarget(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateOnlineClassStatus} className="space-y-3 text-xs">
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E2E8F0] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Subject:</span>
                  <span className="font-bold text-[#0F172A]">{classActionTarget.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Batch:</span>
                  <span className="font-semibold text-[#0F172A]">{classActionTarget.batchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Scheduled Time:</span>
                  <span className="font-semibold text-[#0F172A]">{classActionTarget.scheduledTime}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  {classActionStatus === 'CONDUCTED'
                    ? 'Topics Covered / Delivery Remarks (Optional)'
                    : 'Cancellation Reason *'}
                </label>
                <textarea
                  required={classActionStatus === 'CANCELLED'}
                  rows={3}
                  value={classActionRemarks}
                  onChange={(e) => setClassActionRemarks(e.target.value)}
                  placeholder={
                    classActionStatus === 'CONDUCTED'
                      ? 'e.g. Chapter 4 Newton Laws solved problems, all students attended via Google Meet...'
                      : 'e.g. Heavy network outage, rescheduled to tomorrow...'
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#FAF8F5] text-[#0F172A] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setClassActionTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={classActionSubmitting}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm disabled:opacity-50 flex items-center gap-1.5 ${
                    classActionStatus === 'CONDUCTED'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-red-700 hover:bg-red-800'
                  }`}
                >
                  {classActionSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {classActionSubmitting
                      ? 'Saving...'
                      : classActionStatus === 'CONDUCTED'
                      ? 'Confirm Conducted'
                      : 'Confirm Cancellation'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};