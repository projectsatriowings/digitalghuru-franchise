import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Users,
  CheckCircle2,
  Plus,
  Search,
  RefreshCw,
  ArrowRightLeft,
  Laptop,
  Building2,
  Layers,
  Loader2,
  X,
  Check,
  Sparkles,
  UserPlus,
  Clock,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export const FranchiseCourses: React.FC = () => {
  const { user, activeInstitute } = useAuth();
  const toast = useToast();
  const canToggleOfferings = user?.role === 'FRANCHISE_OWNER' || user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [franchise, setFranchise] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'offerings' | 'enrollments'>('offerings');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);

  // Enroll Modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    courseId: '',
    studentId: '',
    mode: 'ONLINE' as 'ONLINE' | 'OFFLINE',
    instituteId: '',
    batchId: '',
  });
  const [enrolling, setEnrolling] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Transfer Modal
  const [transferEnrollment, setTransferEnrollment] = useState<any | null>(null);
  const [transferForm, setTransferForm] = useState({
    newMode: 'OFFLINE' as 'ONLINE' | 'OFFLINE',
    newInstituteId: '',
    newBatchId: '',
    reason: '',
  });
  const [transferring, setTransferring] = useState(false);

  useBodyScrollLock(Boolean(showEnrollModal || transferEnrollment));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ctxRes = await apiFetch('/courses/my-franchise-context', { skipCache: true });
      const ctx = ctxRes.data || {};
      setFranchise(ctx.franchise || null);
      setBranches(ctx.branches || []);
      setStudents(ctx.students || []);

      if (ctx.franchise?.id) {
        const instFilter =
          activeInstitute && activeInstitute.id !== 'ALL' ? `&instituteId=${activeInstitute.id}` : '';
        const [coursesRes, enrollmentsRes] = await Promise.all([
          apiFetch(`/courses/franchise/${ctx.franchise.id}`, { skipCache: true }),
          apiFetch(`/courses/franchise/${ctx.franchise.id}/enrollments?${instFilter.replace(/^&/, '')}`, {
            skipCache: true,
          }),
        ]);

        const fetchedCourses = coursesRes.data || [];
        setCourses(fetchedCourses);
        const feesMap: Record<string, string> = {};
        fetchedCourses.forEach((c: any) => {
          feesMap[c.id] =
            c.franchiseCustomPrice !== null && c.franchiseCustomPrice !== undefined
              ? String(c.franchiseCustomPrice)
              : '';
        });
        setFeeInputs(feesMap);
        setEnrollments(enrollmentsRes.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load franchise courses');
    } finally {
      setLoading(false);
    }
  }, [activeInstitute?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle course offering enable/disable or save fee
  const handleToggleOffering = async (course: any, nextEnabled: boolean) => {
    if (!franchise?.id || !canToggleOfferings) return;
    setTogglingCourseId(course.id);
    const feeStr = feeInputs[course.id] ?? '';
    try {
      await apiFetch(`/courses/franchise/${franchise.id}/select`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          isEnabled: nextEnabled,
          customPrice: feeStr.trim() !== '' ? Number(feeStr) : null,
        }),
      });
      toast.success(nextEnabled ? `"${course.title}" enabled for enrollment` : `"${course.title}" disabled`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update course offering');
    } finally {
      setTogglingCourseId(null);
    }
  };

  // Open Enroll Modal
  const openEnrollModal = (prefillCourseId = '') => {
    const enabledCourses = courses.filter((c) => c.isSelected);
    const defaultBranchId =
      activeInstitute && activeInstitute.id !== 'ALL' ? activeInstitute.id : branches[0]?.id || '';
    const defaultBatchId =
      branches.find((b) => b.id === defaultBranchId)?.batches?.[0]?.id || '';

    setEnrollForm({
      courseId: prefillCourseId || enabledCourses[0]?.id || '',
      studentId: '',
      mode: 'ONLINE',
      instituteId: defaultBranchId,
      batchId: defaultBatchId,
    });
    setStudentSearch('');
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchise?.id) return;
    if (!enrollForm.courseId || !enrollForm.studentId) {
      toast.error('Select both a global course and a student');
      return;
    }
    if (enrollForm.mode === 'OFFLINE' && (!enrollForm.instituteId || !enrollForm.batchId)) {
      toast.error('Branch and Batch are required for OFFLINE enrollments');
      return;
    }

    setEnrolling(true);
    try {
      await apiFetch('/courses/enroll', {
        method: 'POST',
        body: JSON.stringify({
          franchiseId: franchise.id,
          courseId: enrollForm.courseId,
          studentId: enrollForm.studentId,
          mode: enrollForm.mode,
          instituteId: enrollForm.mode === 'OFFLINE' ? enrollForm.instituteId : null,
          batchId: enrollForm.mode === 'OFFLINE' ? enrollForm.batchId : null,
        }),
      });
      toast.success(`Student enrolled in ${enrollForm.mode} mode!`);
      setShowEnrollModal(false);
      setActiveTab('enrollments');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (enr: any) => {
    const defaultNextMode: 'ONLINE' | 'OFFLINE' = enr.mode === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const fallbackBranch = enr.instituteId || branches[0]?.id || '';
    const fallbackBatch =
      enr.batchId || branches.find((b) => b.id === fallbackBranch)?.batches?.[0]?.id || '';

    setTransferEnrollment(enr);
    setTransferForm({
      newMode: defaultNextMode,
      newInstituteId: defaultNextMode === 'OFFLINE' ? fallbackBranch : '',
      newBatchId: defaultNextMode === 'OFFLINE' ? fallbackBatch : '',
      reason: '',
    });
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferEnrollment) return;
    if (transferForm.newMode === 'OFFLINE' && (!transferForm.newInstituteId || !transferForm.newBatchId)) {
      toast.error('Destination branch and batch are required for OFFLINE transfer');
      return;
    }

    setTransferring(true);
    try {
      await apiFetch(`/courses/enrollments/${transferEnrollment.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          newMode: transferForm.newMode,
          newInstituteId: transferForm.newMode === 'OFFLINE' ? transferForm.newInstituteId : null,
          newBatchId: transferForm.newMode === 'OFFLINE' ? transferForm.newBatchId : null,
          reason: transferForm.reason.trim() || `Transferred to ${transferForm.newMode} mode`,
        }),
      });
      toast.success('Enrollment transferred cleanly with progress preserved!');
      setTransferEnrollment(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  const enabledCourses = courses.filter((c) => c.isSelected);
  const filteredEnrollments = enrollments.filter((enr) => {
    if (modeFilter !== 'ALL' && enr.mode !== modeFilter) return false;
    if (statusFilter !== 'ALL' && enr.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const studentName = `${enr.student?.firstName || ''} ${enr.student?.lastName || ''}`.toLowerCase();
      return (
        studentName.includes(q) ||
        (enr.student?.admissionNumber || '').toLowerCase().includes(q) ||
        (enr.course?.title || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const enrollSelectedBranch = branches.find((b) => b.id === enrollForm.instituteId);
  const transferSelectedBranch = branches.find((b) => b.id === transferForm.newInstituteId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#006FFF] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> {franchise ? `${franchise.name} (${franchise.code})` : 'Franchise LMS Hub'}
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Courses & LMS Enrollments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enable global Digital Guru courses for your centres, enroll Online or Offline batch students, and manage mode transfers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            disabled={enabledCourses.length === 0}
            onClick={() => openEnrollModal()}
            className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-[#006FFF]/25"
          >
            <UserPlus className="w-4 h-4" /> Enroll Student
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Enabled Offerings</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {enabledCourses.length} <span className="text-xs font-semibold text-slate-400">/ {courses.length}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Active Enrollments</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {enrollments.filter((e) => e.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Online LMS Students</div>
          <div className="text-2xl font-extrabold text-[#006FFF] mt-1">
            {enrollments.filter((e) => e.status === 'ACTIVE' && e.mode === 'ONLINE').length}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Offline Classroom + LMS</div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">
            {enrollments.filter((e) => e.status === 'ACTIVE' && e.mode === 'OFFLINE').length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('offerings')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
            activeTab === 'offerings'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Permitted Global Courses ({courses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('enrollments')}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
            activeTab === 'enrollments'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Student Enrollments & Transfers ({enrollments.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#006FFF] mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading franchise course catalogue...</p>
        </div>
      ) : activeTab === 'offerings' ? (
        /* ================= OFFERINGS TAB ================= */
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#006FFF] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>HQ Catalogue Governance:</strong> Only global Digital Guru courses explicitly permitted to your franchise by Super Admin (HQ) appear below. You can enable/disable offerings and customize local franchise fees, while master syllabus and assets remain centrally governed by Digital Guru HQ.
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No HQ-permitted courses available yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Courses permitted for your franchise by Digital Guru HQ (Super Admin) will appear here for activation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className={`rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                    course.isSelected ? 'border-emerald-300 ring-1 ring-emerald-500/15' : 'border-slate-200'
                  }`}
                >
                  <div className="p-5 flex gap-4">
                    <div className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-7 h-7 text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            course.isSelected
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {course.isSelected ? 'Enabled for Franchise' : 'Not Offered'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#006FFF] border border-blue-200 text-[11px] font-bold">
                          <ShieldCheck className="w-3 h-3" /> Permitted by Digital Guru HQ
                        </span>
                        {course.category && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                            {course.category.name}
                          </span>
                        )}
                      </div>

                    <h3 className="text-base font-extrabold text-slate-900 line-clamp-1">{course.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {course.subTitle || course.description || 'Official Digital Guru Global Course'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-slate-600">
                      <span>Standard Fee: ₹{Number(course.price || 0).toLocaleString('en-IN')}</span>
                      {course.duration && <span>· {course.duration}</span>}
                      <span className="text-[#006FFF]">· {course.activeEnrollmentsCount || 0} Active Enrolled</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {canToggleOfferings ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={feeInputs[course.id] ?? ''}
                        onChange={(e) => setFeeInputs((prev) => ({ ...prev, [course.id]: e.target.value }))}
                        placeholder="Local Fee ₹"
                        className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                      {course.isSelected && (
                        <button
                          type="button"
                          disabled={togglingCourseId === course.id}
                          onClick={() => handleToggleOffering(course, true)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold"
                        >
                          Save Fee
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={togglingCourseId === course.id}
                        onClick={() => handleToggleOffering(course, !course.isSelected)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                          course.isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        {togglingCourseId === course.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : course.isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Enabled
                          </>
                        ) : (
                          'Enable Course'
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Managed by Franchise Owner</span>
                  )}

                  {course.isSelected && (
                    <button
                      type="button"
                      onClick={() => openEnrollModal(course.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#006FFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Enroll Student
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= ENROLLMENTS TAB ================= */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student name, admission no, or course..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#006FFF]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['ALL', 'ONLINE', 'OFFLINE'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModeFilter(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      modeFilter === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>
          </div>

          {filteredEnrollments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center">
              <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">No enrollments matching filters</p>
              <p className="text-xs text-slate-500 mt-1">
                Enroll a student into Online LMS or Offline Classroom + Recorded LMS mode.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Branch & Batch</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEnrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {enr.student?.firstName} {enr.student?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {enr.student?.admissionNumber || enr.student?.phone || '—'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{enr.course?.title}</div>
                        <div className="text-[11px] text-slate-500">
                          Enrolled {new Date(enr.enrolledAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                            enr.mode === 'ONLINE'
                              ? 'bg-blue-50 text-[#006FFF]'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {enr.mode === 'ONLINE' ? (
                            <Laptop className="w-3 h-3" />
                          ) : (
                            <Building2 className="w-3 h-3" />
                          )}
                          {enr.mode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {enr.mode === 'OFFLINE' ? (
                          <div>
                            <div className="font-semibold text-slate-800">{enr.institute?.name || '—'}</div>
                            <div className="text-[11px] text-slate-500">{enr.batch?.name || '—'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Central Online LMS</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            enr.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : enr.status === 'COMPLETED'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {enr.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {enr.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => openTransferModal(enr)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#006FFF] text-slate-700 font-bold inline-flex items-center gap-1.5"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-[#006FFF]" /> Transfer
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">{enr.transferReason || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= ENROLL STUDENT MODAL ================= */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#006FFF]" />
                <h2 className="text-lg font-extrabold text-slate-900">Enroll Student in Global Course</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Enabled Global Course</label>
                <select
                  required
                  value={enrollForm.courseId}
                  onChange={(e) => setEnrollForm({ ...enrollForm, courseId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#006FFF]"
                >
                  <option value="">Select Course...</option>
                  {enabledCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Student</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Quick filter student name or admission no..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs mb-2 outline-none"
                />
                <select
                  required
                  value={enrollForm.studentId}
                  onChange={(e) => setEnrollForm({ ...enrollForm, studentId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-[#006FFF]"
                >
                  <option value="">Choose Student ({students.length} available)...</option>
                  {students
                    .filter((st) => {
                      if (!studentSearch.trim()) return true;
                      const full = `${st.firstName} ${st.lastName} ${st.admissionNumber}`.toLowerCase();
                      return full.includes(studentSearch.toLowerCase());
                    })
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName} ({st.admissionNumber})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Learning Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnrollForm({ ...enrollForm, mode: 'ONLINE' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      enrollForm.mode === 'ONLINE'
                        ? 'border-[#006FFF] bg-blue-50/70 ring-1 ring-[#006FFF]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                      <Laptop className="w-4 h-4 text-[#006FFF]" /> ONLINE
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Direct Digital LMS access. Branch & Batch remain unassigned.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnrollForm({ ...enrollForm, mode: 'OFFLINE' })}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      enrollForm.mode === 'OFFLINE'
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                      <Building2 className="w-4 h-4 text-indigo-600" /> OFFLINE
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Branch Classroom Batch + Full Recorded Sessions & PDFs on LMS.
                    </p>
                  </button>
                </div>
              </div>

              {enrollForm.mode === 'OFFLINE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Campus / Branch</label>
                    <select
                      required
                      value={enrollForm.instituteId}
                      onChange={(e) => {
                        const nextBranch = branches.find((b) => b.id === e.target.value);
                        setEnrollForm({
                          ...enrollForm,
                          instituteId: e.target.value,
                          batchId: nextBranch?.batches?.[0]?.id || '',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="">Select Branch...</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Batch</label>
                    <select
                      required
                      value={enrollForm.batchId}
                      onChange={(e) => setEnrollForm({ ...enrollForm, batchId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                    >
                      <option value="">Select Batch...</option>
                      {(enrollSelectedBranch?.batches || []).map((bt: any) => (
                        <option key={bt.id} value={bt.id}>
                          {bt.name} ({bt.academicYear})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrolling}
                  className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2"
                >
                  {enrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Enrollment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TRANSFER ENROLLMENT MODAL ================= */}
      {transferEnrollment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-[#006FFF]" />
                <h2 className="text-lg font-extrabold text-slate-900">Transfer Course Enrollment</h2>
              </div>
              <button
                type="button"
                onClick={() => setTransferEnrollment(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">
                  {transferEnrollment.student?.firstName} {transferEnrollment.student?.lastName} ·{' '}
                  {transferEnrollment.course?.title}
                </div>
                <div className="text-slate-600">
                  Current Mode: <strong>{transferEnrollment.mode}</strong>
                  {transferEnrollment.mode === 'OFFLINE' &&
                    ` (${transferEnrollment.institute?.name || ''} — ${transferEnrollment.batch?.name || ''})`}
                </div>
                <p className="text-emerald-700 font-semibold pt-1">
                  All historical lesson progress, XP, and completion records remain preserved across transfers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Destination Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setTransferForm({
                        ...transferForm,
                        newMode: 'ONLINE',
                        newInstituteId: '',
                        newBatchId: '',
                      })
                    }
                    className={`p-3 rounded-xl border text-xs font-bold ${
                      transferForm.newMode === 'ONLINE'
                        ? 'border-[#006FFF] bg-blue-50 text-[#006FFF]'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    ONLINE LMS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const defB = transferForm.newInstituteId || branches[0]?.id || '';
                      const defBat =
                        transferForm.newBatchId || branches.find((b) => b.id === defB)?.batches?.[0]?.id || '';
                      setTransferForm({
                        ...transferForm,
                        newMode: 'OFFLINE',
                        newInstituteId: defB,
                        newBatchId: defBat,
                      });
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold ${
                      transferForm.newMode === 'OFFLINE'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    OFFLINE BATCH
                  </button>
                </div>
              </div>

              {transferForm.newMode === 'OFFLINE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Branch</label>
                    <select
                      required
                      value={transferForm.newInstituteId}
                      onChange={(e) => {
                        const nb = branches.find((b) => b.id === e.target.value);
                        setTransferForm({
                          ...transferForm,
                          newInstituteId: e.target.value,
                          newBatchId: nb?.batches?.[0]?.id || '',
                        });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="">Select Branch...</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Batch</label>
                    <select
                      required
                      value={transferForm.newBatchId}
                      onChange={(e) => setTransferForm({ ...transferForm, newBatchId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
                    >
                      <option value="">Select Batch...</option>
                      {(transferSelectedBranch?.batches || []).map((bt: any) => (
                        <option key={bt.id} value={bt.id}>
                          {bt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Reason (Audit Log)</label>
                <input
                  type="text"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g. Student switched to weekend physical batch..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#006FFF]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferEnrollment(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-5 py-2 rounded-xl bg-[#006FFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2"
                >
                  {transferring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

