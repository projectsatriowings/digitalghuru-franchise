import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { Institute, User } from '../types';
import { lookupByPostalCode, lookupByCity } from '../utils/locationHelper';
import {
  Building2,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  GraduationCap,
  Layers,
  Phone,
  Mail,
  MapPin,
  X,
  Copy,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  UserCheck,
  UserX,
  Edit3,
  RefreshCw,
  ShieldCheck,
  Clock,
  BookOpen,
  ArrowRight,
  Info,
  MoreVertical,
} from 'lucide-react';

interface AcademicAdminAccount extends User {
  createdAt?: string;
  initialPassword?: string | null;
}

interface FranchiseOption {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  state?: string | null;
  ownerName?: string;
  status: string;
}

interface InstituteDetailData {
  institute: Institute;
  adminAccount: AcademicAdminAccount | null;
}

interface SuperAdminDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onNavigateTab }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Three-dot action menu state
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setActiveActionMenuId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Global notification banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // ----------------------------------------------------
  // 2. INSTITUTE DETAILS DRAWER STATE
  // ----------------------------------------------------
  const [selectedInstituteId, setSelectedInstituteId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<InstituteDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showDrawerPassword, setShowDrawerPassword] = useState(false);
  const [drawerCopiedKey, setDrawerCopiedKey] = useState<string | null>(null);

  // ----------------------------------------------------
  // 3. EDIT ADMIN ACCOUNT MODAL STATE
  // ----------------------------------------------------
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [editAdminTarget, setEditAdminTarget] = useState<{ instituteId: string; instituteName: string } | null>(null);
  const [editAdminLoading, setEditAdminLoading] = useState(false);
  const [editAdminError, setEditAdminError] = useState<string | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    isActive: true,
  });

  // ----------------------------------------------------
  // 4. RESET PASSWORD MODAL STATE
  // ----------------------------------------------------
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{
    instituteId: string;
    instituteName: string;
    adminEmail: string;
    adminName: string;
  } | null>(null);
  const [resetPassMode, setResetPassMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // One-time Temporary Password Display State
  const [oneTimePasswordData, setOneTimePasswordData] = useState<{
    adminEmail: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedTempPassword, setCopiedTempPassword] = useState(false);

  // ----------------------------------------------------
  // 5. STATUS CONFIRMATION MODAL STATE
  // ----------------------------------------------------
  const [statusActionTarget, setStatusActionTarget] = useState<Institute | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useBodyScrollLock(
    !!selectedInstituteId ||
    showEditAdminModal ||
    showResetPasswordModal ||
    !!oneTimePasswordData ||
    !!statusActionTarget
  );

  // ----------------------------------------------------
  // DATA FETCHING (Optimized: separate metrics & debounced list)
  // ----------------------------------------------------
  const fetchMetrics = async () => {
    try {
      const metricsRes = await apiFetch('/institutes/dashboard/summary');
      if (metricsRes.success) {
        setMetrics(metricsRes.data);
      }
    } catch {
      // non-blocking
    }
  };

  const fetchInstitutesList = async (searchQuery = debouncedSearch, statusVal = statusFilter) => {
    try {
      setLoading(true);
      const institutesRes = await apiFetch(`/institutes?search=${encodeURIComponent(searchQuery)}&status=${statusVal}`);
      setInstitutes(institutesRes.data?.institutes || []);
    } catch (err: any) {
      console.error('Failed to load institutes', err);
      showNotification('error', err.message || 'Failed to load institute directory');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    await Promise.all([fetchMetrics(), fetchInstitutesList()]);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchInstitutesList(debouncedSearch, statusFilter);
  }, [debouncedSearch, statusFilter]);

  // Fetch full details for the drawer
  const fetchInstituteDetails = async (id: string) => {
    try {
      setDetailLoading(true);
      setDetailError(null);
      const res = await apiFetch(`/institutes/${id}`);
      if (res.success && res.data) {
        setDetailData({
          institute: res.data.institute,
          adminAccount: res.data.adminAccount || res.data.institute?.memberships?.[0]?.user || null,
        });
      } else {
        setDetailError(res.error || 'Failed to fetch institute details');
      }
    } catch (err: any) {
      setDetailError(err.message || 'Failed to fetch institute details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetails = (id: string) => {
    setSelectedInstituteId(id);
    setShowDrawerPassword(false);
    setDrawerCopiedKey(null);
    fetchInstituteDetails(id);
  };

  const handleCloseDetails = () => {
    setSelectedInstituteId(null);
    setDetailData(null);
    setDetailError(null);
  };
  // ----------------------------------------------------
  // HANDLE STATUS TOGGLE (SUSPEND / ACTIVATE)
  // ----------------------------------------------------
  const handleConfirmStatusToggle = async () => {
    if (!statusActionTarget) return;

    const targetId = statusActionTarget.id;
    const nextStatus = statusActionTarget.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    setStatusUpdating(true);
    try {
      const res = await apiFetch(`/institutes/${targetId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          reason: `Super Admin manually changed status to ${nextStatus}`,
        }),
      });

      if (res.success) {
        showNotification(
          'success',
          `Institute "${statusActionTarget.name}" is now ${nextStatus === 'ACTIVE' ? 'Active' : 'Suspended'}.`
        );
        setStatusActionTarget(null);
        fetchData();

        // If drawer is currently displaying this institute, update its status
        if (selectedInstituteId === targetId && detailData) {
          setDetailData({
            ...detailData,
            institute: {
              ...detailData.institute,
              status: nextStatus as any,
            },
          });
        }
      } else {
        showNotification('error', res.error || 'Failed to update institute status');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status');
    } finally {
      setStatusUpdating(false);
    }
  };

  // ----------------------------------------------------
  // HANDLE EDIT ADMIN ACCOUNT (closes details drawer cleanly first)
  // ----------------------------------------------------
  const handleOpenEditAdminModal = () => {
    if (!detailData?.adminAccount || !selectedInstituteId) return;
    setEditAdminTarget({
      instituteId: selectedInstituteId,
      instituteName: detailData.institute.name,
    });
    setEditAdminForm({
      fullName: detailData.adminAccount.fullName || '',
      email: detailData.adminAccount.email || '',
      phone: detailData.adminAccount.phone || '',
      isActive: detailData.adminAccount.isActive ?? true,
    });
    setEditAdminError(null);
    // Close current details grid before showing Edit Admin page
    handleCloseDetails();
    setShowEditAdminModal(true);
  };

  const handleEditAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdminTarget?.instituteId) return;

    setEditAdminError(null);
    setEditAdminLoading(true);

    try {
      const res = await apiFetch(`/institutes/${editAdminTarget.instituteId}/admin-account`, {
        method: 'PATCH',
        body: JSON.stringify(editAdminForm),
      });

      if (res.success && res.data?.adminAccount) {
        setShowEditAdminModal(false);
        setEditAdminTarget(null);
        showNotification('success', 'Admin account updated successfully');
        fetchData();
      } else {
        setEditAdminError(res.error || 'Failed to update admin account');
      }
    } catch (err: any) {
      setEditAdminError(err.message || 'Failed to update admin account');
    } finally {
      setEditAdminLoading(false);
    }
  };

  // ----------------------------------------------------
  // HANDLE CHANGE / RESET ADMIN PASSWORD (closes details drawer cleanly first)
  // ----------------------------------------------------
  const handleOpenResetPasswordModal = () => {
    if (!detailData?.adminAccount || !selectedInstituteId) return;
    setResetPasswordTarget({
      instituteId: selectedInstituteId,
      instituteName: detailData.institute.name,
      adminEmail: detailData.adminAccount.email || 'Admin',
      adminName: detailData.adminAccount.fullName || 'Institute Admin',
    });
    setResetPassMode('AUTO');
    setCustomPassword('');
    setResetError(null);
    // Close current details grid before showing Change Password page
    handleCloseDetails();
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget?.instituteId) return;

    if (resetPassMode === 'MANUAL') {
      if (!customPassword || customPassword.length < 8) {
        setResetError('Password must be at least 8 characters long');
        return;
      }
    }

    setResetError(null);
    setResetLoading(true);

    try {
      const payload = resetPassMode === 'MANUAL' ? { password: customPassword } : {};

      const res = await apiFetch(`/institutes/${resetPasswordTarget.instituteId}/admin-account/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data?.temporaryPassword) {
        setShowResetPasswordModal(false);
        setOneTimePasswordData({
          adminEmail: resetPasswordTarget.adminEmail,
          temporaryPassword: res.data.temporaryPassword,
        });
        setResetPasswordTarget(null);
        showNotification('success', 'Password changed successfully. Please share the new password with the admin.');
      } else {
        setResetError(res.error || 'Failed to change password');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to change password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 ${notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-semibold leading-relaxed flex-1">{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-[#64748B] hover:text-[#0F172A] p-0.5 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Super Admin Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Manage franchises, courses, and campus branches from one central control panel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('course_management')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
            >
              <BookOpen className="w-4 h-4" /> Course Management
            </button>
          )}
        </div>
      </div>

      {/* Quick Module Shortcuts for Super Admin */}
      {onNavigateTab && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab('franchise_management')}
            className="p-5 rounded-2xl bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white text-left flex items-center justify-between gap-4 shadow-md hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FEDC32]/20 border border-[#FEDC32]/30 flex items-center justify-center text-[#FEDC32] shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-bold flex items-center gap-2">
                  Franchise Management
                  {metrics?.totalFranchises !== undefined && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-[#FEDC32] font-bold">
                      {metrics.totalFranchises} Total · {metrics.activeFranchises} Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300 mt-0.5">Add franchises, track royalties, agreements & branch access</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-[#FEDC32] group-hover:translate-x-1 transition-all shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('course_management')}
            className="p-5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 text-white text-left flex items-center justify-between gap-4 shadow-md hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-white shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-bold flex items-center gap-2">
                  Course Management
                  {metrics?.totalCourses !== undefined && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/20 text-white font-bold">
                      {metrics.totalCourses} Courses · {metrics.publishedCourses} Live
                    </span>
                  )}
                </div>
                <p className="text-sm text-emerald-100 mt-0.5">Create courses, manage modules, lessons, videos & franchise permissions</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-100 group-hover:translate-x-1 transition-all shrink-0" />
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#CBD5E1] transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Institutes</span>
            <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#0F172A] mt-3">
            {metrics ? metrics.totalInstitutes : '...'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Registered tenant accounts</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#CBD5E1] transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Active Institutes</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-800 mt-3">
            {metrics ? metrics.activeInstitutes : '...'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Operational and compliant</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#CBD5E1] transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Suspended</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-800 mt-3">
            {metrics ? metrics.suspendedInstitutes : '...'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Temporarily locked</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#CBD5E1] transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Students</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-800">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-sky-800 mt-3">
            {metrics ? metrics.totalStudents : '...'}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Across all institutes</div>
        </div>
      </div>

      {/* Institutes Directory Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, city..."
              className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-[#64748B] font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-visible">
          <table className="w-full text-left text-xs table-auto">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 font-bold">Institute</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">Code</th>
                <th className="py-3 px-3 font-bold">Franchise Center</th>
                <th className="py-3 px-3 font-bold">Location</th>
                <th className="py-3 px-3 font-bold">Metrics</th>
                <th className="py-3 px-3 font-bold">Status</th>
                <th className="py-3 px-3 font-bold text-center w-14">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE9]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">Loading institutes...</td>
                </tr>
              ) : institutes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">No institutes found.</td>
                </tr>
              ) : (
                institutes.map((inst) => (
                  <tr
                    key={inst.id}
                    onClick={() => handleOpenDetails(inst.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group relative"
                    title={`Click to view details for ${inst.name}`}
                  >
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-[#0F172A] text-sm group-hover:text-[#006FFF] transition-colors flex items-center gap-1.5">
                        <span>{inst.name}</span>
                        <Eye className="w-3.5 h-3.5 text-[#006FFF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      {inst.email && <div className="text-[11px] text-[#64748B] truncate max-w-[200px]">{inst.email}</div>}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#006FFF] whitespace-nowrap">
                      <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-xs whitespace-nowrap inline-block tracking-wide group-hover:border-blue-300 transition-colors">
                        {inst.code}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {inst.franchise ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-[#006FFF] border border-blue-200 group-hover:bg-blue-100/70 transition-colors max-w-[220px] 2xl:max-w-xs" title={`Franchise: ${inst.franchise.name} (${inst.franchise.code})`}>
                          <Building2 className="w-3.5 h-3.5 text-[#006FFF] shrink-0" />
                          <span className="truncate">{inst.franchise.code} - {inst.franchise.name}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200 whitespace-nowrap">
                          Standalone Campus
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#475569] whitespace-nowrap">
                      {inst.city ? `${inst.city}${inst.state ? `, ${inst.state}` : ''}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-[#475569] whitespace-nowrap">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span><strong>{inst._count?.students || 0}</strong> Students</span>
                        <span>&bull;</span>
                        <span><strong>{inst._count?.staffProfiles || 0}</strong> Staff</span>
                        <span>&bull;</span>
                        <span><strong>{inst._count?.batches || 0}</strong> Batches</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {inst.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap relative">
                      <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMenuId(activeActionMenuId === inst.id ? null : inst.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 transition-colors"
                          title="Options"
                          aria-label={`Actions for ${inst.name}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {activeActionMenuId === inst.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                handleOpenDetails(inst.id);
                              }}
                              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#006FFF] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#006FFF]" />
                              View Details
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                setStatusActionTarget(inst);
                              }}
                              className={`w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors ${
                                inst.status === 'ACTIVE'
                                  ? 'text-rose-700 hover:bg-rose-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {inst.status === 'ACTIVE' ? (
                                <>
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  Suspend Campus
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  Activate Campus
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ====================================================
          1. INSTITUTE DETAILS DRAWER / MODAL
         ==================================================== */}
      {selectedInstituteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-l border-[#E2E8F0] w-full max-w-2xl h-full shadow-2xl flex flex-col text-[#0F172A] overflow-hidden">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#F1F5F9] bg-[#FFFFFF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      {detailData?.institute.name || 'Institute Details'}
                    </h2>
                    {detailData?.institute.status && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${detailData.institute.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                          }`}
                      >
                        {detailData.institute.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B] mt-0.5">
                    <span>Code: <strong className="font-mono text-[#006FFF]">{detailData?.institute.code || '...'}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseDetails}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#F8FAFC] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#64748B]">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#006FFF] mb-3" />
                  <span className="text-xs font-semibold">Loading institute details...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              ) : detailData ? (
                <>
                  {/* Institutional Metrics Overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5" /> Students
                      </div>
                      <div className="text-xl font-bold text-[#0F172A] mt-1">
                        {detailData.institute._count?.students ?? 0}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Staff
                      </div>
                      <div className="text-xl font-bold text-[#0F172A] mt-1">
                        {detailData.institute._count?.staffProfiles ?? 0}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> Batches
                      </div>
                      <div className="text-xl font-bold text-[#0F172A] mt-1">
                        {detailData.institute._count?.batches ?? 0}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Subjects
                      </div>
                      <div className="text-xl font-bold text-[#0F172A] mt-1">
                        {detailData.institute._count?.subjects ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: INSTITUTE INFORMATION */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#94A3B8]" /> Institute Information
                      </span>
                      <button
                        onClick={() => {
                          setStatusActionTarget(detailData.institute);
                        }}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${detailData.institute.status === 'ACTIVE'
                            ? 'border-rose-300 text-rose-800 hover:bg-rose-50'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                          }`}
                      >
                        {detailData.institute.status === 'ACTIVE' ? 'Suspend Institute' : 'Activate Institute'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[#64748B] block mb-0.5">Institute Name</span>
                        <div className="font-semibold text-[#0F172A]">{detailData.institute.name}</div>
                      </div>

                      <div>
                        <span className="text-[#64748B] block mb-0.5">Institute Code</span>
                        <div className="font-mono font-bold text-[#006FFF] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0] inline-block">
                          {detailData.institute.code}
                        </div>
                      </div>

                      <div>
                        <span className="text-[#64748B] block mb-0.5">Franchise Affiliation</span>
                        {detailData.institute.franchise ? (
                          <div className="font-semibold text-[#006FFF] flex items-center gap-1.5 bg-blue-50/80 px-2 py-1 rounded border border-blue-200">
                            <Building2 className="w-3.5 h-3.5 text-[#006FFF]" />
                            {detailData.institute.franchise.code} - {detailData.institute.franchise.name}
                          </div>
                        ) : (
                          <div className="text-slate-500 italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            Standalone Campus (Independent)
                          </div>
                        )}
                      </div>

                      {detailData.institute.legalName && (
                        <div>
                          <span className="text-[#64748B] block mb-0.5">Legal Entity Name</span>
                          <div className="text-[#0F172A]">{detailData.institute.legalName}</div>
                        </div>
                      )}

                      <div>
                        <span className="text-[#64748B] block mb-0.5">Email</span>
                        <div className="text-[#0F172A] flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-[#94A3B8]" />
                          {detailData.institute.email || '—'}
                        </div>
                      </div>

                      <div>
                        <span className="text-[#64748B] block mb-0.5">Phone</span>
                        <div className="text-[#0F172A] flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-[#94A3B8]" />
                          {detailData.institute.phone || '—'}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[#64748B] block mb-0.5">Location & Address</span>
                        <div className="text-[#0F172A] flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                          <span>
                            {[
                              detailData.institute.address,
                              detailData.institute.city,
                              detailData.institute.state,
                              detailData.institute.postalCode,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'No address specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: ACADEMIC ADMIN ACCOUNT */}
                  <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#94A3B8]" /> Academic Admin Account
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleOpenEditAdminModal}
                          disabled={!detailData.adminAccount}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC] transition disabled:opacity-50"
                        >
                          <Edit3 className="w-4 h-4" /> Edit Admin
                        </button>
                        <button
                          onClick={handleOpenResetPasswordModal}
                          disabled={!detailData.adminAccount}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white transition disabled:opacity-50 shadow-sm"
                        >
                          <KeyRound className="w-4 h-4" /> Change Password
                        </button>
                      </div>
                    </div>

                    {detailData.adminAccount ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-[#64748B] block mb-0.5">Admin Full Name</span>
                          <div className="font-semibold text-[#0F172A] text-sm">
                            {detailData.adminAccount.fullName}
                          </div>
                        </div>

                        <div>
                          <span className="text-[#64748B] block mb-0.5">Login Email / Username</span>
                          <div className="font-mono text-[#0F172A] font-medium">
                            {detailData.adminAccount.email}
                          </div>
                        </div>

                        <div>
                          <span className="text-[#64748B] block mb-0.5">Phone Number</span>
                          <div className="text-[#0F172A]">
                            {detailData.adminAccount.phone || '—'}
                          </div>
                        </div>

                        <div>
                          <span className="text-[#64748B] block mb-0.5">Account Status</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {detailData.adminAccount.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> Active Account
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-300">
                                <UserX className="w-3 h-3 text-rose-600" /> Inactive
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-1 sm:col-span-2 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-semibold text-xs">Password Status & Credentials</span>
                            {detailData.adminAccount.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Change on Next Login
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" /> Active Password Set
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <div className="flex-1 font-mono text-xs font-bold bg-white px-3 py-2 rounded-lg border border-slate-200 text-slate-800 tracking-wider flex items-center justify-between select-all shadow-xs">
                              <span>
                                {showDrawerPassword
                                  ? (detailData.adminAccount.initialPassword ||
                                     (detailData.adminAccount.mustChangePassword ? 'digi@123' : '••••••••••••••••'))
                                  : '••••••••••••••••'}
                              </span>
                              <span className="text-[10px] font-sans font-medium text-slate-400 uppercase tracking-normal">
                                {showDrawerPassword ? 'Visible' : 'Masked'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowDrawerPassword(!showDrawerPassword)}
                              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-xs"
                              title={showDrawerPassword ? 'Hide password' : 'Show password'}
                            >
                              {showDrawerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const pwd =
                                  detailData.adminAccount?.initialPassword ||
                                  (detailData.adminAccount?.mustChangePassword ? 'digi@123' : '');
                                if (!pwd) {
                                  showNotification(
                                    'error',
                                    'No temporary password stored. Click Change Password above to set a new one.'
                                  );
                                  return;
                                }
                                navigator.clipboard.writeText(pwd);
                                setDrawerCopiedKey('inst_drawer_password');
                                showNotification(
                                  'success',
                                  'Institute administrator password copied to clipboard'
                                );
                                setTimeout(() => setDrawerCopiedKey(null), 2500);
                              }}
                              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 ${
                                drawerCopiedKey === 'inst_drawer_password'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-[#006FFF] hover:bg-[#0058D4] text-white border-blue-600'
                              }`}
                              title="Copy password"
                            >
                              {drawerCopiedKey === 'inst_drawer_password' ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Password</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[#64748B] block mb-0.5">Last Login</span>
                          <div className="text-[#0F172A]">
                            {detailData.adminAccount.lastLoginAt
                              ? new Date(detailData.adminAccount.lastLoginAt).toLocaleString()
                              : 'Never logged in'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-[#64748B] text-xs">
                        No Academic Admin account found for this institute.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#F1F5F9] bg-[#FFFFFF] flex justify-end">
              <button
                type="button"
                onClick={handleCloseDetails}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          4. EDIT ADMIN ACCOUNT DETAILS MODAL
         ==================================================== */}
      {showEditAdminModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Edit Admin Account Details</h3>
                  <p className="text-xs text-[#64748B]">Update permitted academic administrator profile fields</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditAdminModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editAdminError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editAdminError}</span>
              </div>
            )}

            <form onSubmit={handleEditAdminSubmit} className="space-y-4 mt-5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editAdminForm.fullName}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, fullName: e.target.value })}
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                  Login Email / Username
                </label>
                <input
                  type="email"
                  required
                  value={editAdminForm.email}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
                <span className="text-[11px] text-[#64748B] mt-0.5 block">
                  Must be unique across the platform.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editAdminForm.phone}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, phone: e.target.value })}
                  placeholder="Optional phone number"
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAdminForm.isActive}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#006FFF] rounded border-[#E2E8F0] focus:ring-[#006FFF]/20"
                  />
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Account is Active (Uncheck to suspend login for this admin)
                  </span>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowEditAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editAdminLoading}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-[#006FFF]/20 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {editAdminLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                    </>
                  ) : (
                    'Save Account Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          5. CHANGE / RESET PASSWORD PAGE MODAL
         ==================================================== */}
      {showResetPasswordModal && resetPasswordTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A]">Change Admin Password</h3>
                  <p className="text-xs text-[#64748B]">
                    {resetPasswordTarget.instituteName} &bull; {resetPasswordTarget.adminEmail}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordTarget(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 mt-5 text-xs">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#006FFF]">Password Option</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPassMode('AUTO')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${resetPassMode === 'AUTO'
                        ? 'bg-[#006FFF] text-white border-[#006FFF]'
                        : 'bg-[#FFFFFF] text-[#006FFF] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPassMode('MANUAL')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${resetPassMode === 'MANUAL'
                        ? 'bg-[#006FFF] text-white border-[#006FFF]'
                        : 'bg-[#FFFFFF] text-[#006FFF] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                      }`}
                  >
                    Set Manually
                  </button>
                </div>
              </div>

              {resetPassMode === 'AUTO' ? (
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#006FFF] text-xs">
                  <span className="font-semibold block mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#94A3B8]" /> Cryptographic Generation
                  </span>
                  A secure, temporary password will be generated, hashed with Argon2id, and displayed once for you to copy.
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                    Temporary Password (Min 8 characters)
                  </label>
                  <div className="relative">
                    <input
                      type={showCustomPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Enter new temporary password"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomPassword(!showCustomPassword)}
                      className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#006FFF]"
                    >
                      {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <strong>Important:</strong> The administrator will be required to create their own new password upon signing in.
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setResetPasswordTarget(null);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] rounded-xl border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-[#006FFF]/20 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          6. ONE-TIME TEMPORARY PASSWORD COPY DISPLAY
         ==================================================== */}
      {oneTimePasswordData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Temporary Password Ready</h3>
                  <p className="text-xs text-[#64748B]">Copy and securely share with administrator</p>
                </div>
              </div>
              <button
                onClick={() => setOneTimePasswordData(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <span className="text-[#64748B] block mb-0.5">Academic Admin Account</span>
                <div className="font-semibold text-[#0F172A] text-sm">{oneTimePasswordData.adminEmail}</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[11px] uppercase tracking-wider text-[#006FFF] font-bold block mb-1.5">
                  Temporary Password
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-black text-[#0F172A] tracking-wider select-all">
                    {oneTimePasswordData.temporaryPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(oneTimePasswordData.temporaryPassword);
                      setCopiedTempPassword(true);
                      setTimeout(() => setCopiedTempPassword(false), 2500);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-medium text-xs transition-colors shadow-sm"
                  >
                    {copiedTempPassword ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Password
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-[11px] leading-relaxed">
                <strong>Security Notice:</strong> This temporary password will NOT be displayed again or stored in plaintext. The user will be required to set a permanent password immediately upon login.
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOneTimePasswordData(null)}
                className="w-full bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-sm"
              >
                I have securely saved or shared this password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          7. STATUS TOGGLE CONFIRMATION MODAL
         ==================================================== */}
      {statusActionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center gap-3 pb-4 border-b border-[#F1F5F9]">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${statusActionTarget.status === 'ACTIVE'
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  {statusActionTarget.status === 'ACTIVE' ? 'Suspend Institute' : 'Reactivate Institute'}
                </h3>
                <p className="text-xs text-[#64748B]">Institute ID: {statusActionTarget.id}</p>
              </div>
            </div>

            <div className="py-4 text-xs text-[#006FFF] space-y-2">
              <p>
                Are you sure you want to{' '}
                <strong>{statusActionTarget.status === 'ACTIVE' ? 'suspend' : 'activate'}</strong> "
                {statusActionTarget.name}" ({statusActionTarget.code})?
              </p>
              {statusActionTarget.status === 'ACTIVE' ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  When suspended, faculty, staff and students will be locked out from signing in. All historical data, student records and attendances are safely preserved.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                  When reactivated, all valid members of this institute will regain active access immediately.
                </div>
              )}
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setStatusActionTarget(null)}
                disabled={statusUpdating}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                disabled={statusUpdating}
                className={`text-xs font-semibold px-4 py-2 rounded-xl text-white transition shadow-sm flex items-center gap-1.5 ${statusActionTarget.status === 'ACTIVE'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
              >
                {statusUpdating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Updating...
                  </>
                ) : statusActionTarget.status === 'ACTIVE' ? (
                  'Yes, Suspend Institute'
                ) : (
                  'Yes, Activate Institute'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
