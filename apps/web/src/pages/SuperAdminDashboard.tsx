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
} from 'lucide-react';

interface AcademicAdminAccount extends User {
  createdAt?: string;
}

interface InstituteDetailData {
  institute: Institute;
  adminAccount: AcademicAdminAccount | null;
}

export const SuperAdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Global notification banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // ----------------------------------------------------
  // 1. CREATE INSTITUTE MODAL STATE
  // ----------------------------------------------------
  const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form fields
  const [newInst, setNewInst] = useState({
    name: '',
    legalName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    phone: '',
    email: '',
    adminFullName: '',
    adminEmail: '',
    adminPhone: '',
    adminInitialPassword: '',
    confirmPassword: '',
  });

  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Auto-fill City & State when PIN Code is entered
  const handlePostalCodeChange = async (val: string) => {
    setNewInst((prev) => ({ ...prev, postalCode: val }));
    const clean = val.trim().replace(/\D/g, '');
    if (clean.length === 6) {
      setIsLocating(true);
      const res = await lookupByPostalCode(clean);
      setIsLocating(false);
      if (res) {
        setNewInst((prev) => ({
          ...prev,
          city: res.city || prev.city,
          state: res.state || prev.state,
        }));
      }
    }
  };

  // Auto-fill State and optional PIN when City is entered
  const handleCityChange = async (val: string) => {
    setNewInst((prev) => ({ ...prev, city: val }));
    if (val.trim().length >= 3) {
      const res = await lookupByCity(val);
      if (res && res.state) {
        setNewInst((prev) => ({
          ...prev,
          state: res.state || prev.state,
          postalCode: prev.postalCode ? prev.postalCode : (res.postalCode || ''),
        }));
      }
    }
  };

  // Success Created Institute Modal State
  const [createdInstitute, setCreatedInstitute] = useState<{
    name: string;
    code: string;
    adminEmail?: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // ----------------------------------------------------
  // 2. INSTITUTE DETAILS DRAWER STATE
  // ----------------------------------------------------
  const [selectedInstituteId, setSelectedInstituteId] = useState<string | null>(null);
  useBodyScrollLock(showCreateModal || !!selectedInstituteId || !!createdInstitute);
  const [detailData, setDetailData] = useState<InstituteDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ----------------------------------------------------
  // 3. EDIT ADMIN ACCOUNT MODAL STATE
  // ----------------------------------------------------
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
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

  // ----------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------
  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsRes, institutesRes] = await Promise.all([
        apiFetch('/institutes/dashboard/summary'),
        apiFetch(`/institutes?search=${encodeURIComponent(search)}&status=${statusFilter}`),
      ]);
      setMetrics(metricsRes.data);
      setInstitutes(institutesRes.data?.institutes || []);
    } catch (err: any) {
      console.error('Failed to load institutes', err);
      showNotification('error', err.message || 'Failed to load institute directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter]);

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
    fetchInstituteDetails(id);
  };

  const handleCloseDetails = () => {
    setSelectedInstituteId(null);
    setDetailData(null);
    setDetailError(null);
  };

  // Helper: Generate secure random password
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pwd = 'Tuit#';
    for (let i = 0; i < 7; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd + '!';
  };

  // ----------------------------------------------------
  // HANDLE CREATE INSTITUTE SUBMIT
  // ----------------------------------------------------
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Client-side validations
    if (!newInst.name.trim()) {
      setCreateError('Institute name is required');
      return;
    }
    if (!newInst.adminFullName.trim()) {
      setCreateError('Academic Admin full name is required');
      return;
    }
    if (!newInst.adminEmail.trim()) {
      setCreateError('Academic Admin email/username is required');
      return;
    }
    if (!newInst.adminInitialPassword || newInst.adminInitialPassword.length < 8) {
      setCreateError('Initial password must be at least 8 characters long');
      return;
    }
    if (newInst.adminInitialPassword !== newInst.confirmPassword) {
      setCreateError('Passwords do not match. Please verify your initial password.');
      return;
    }

    setCreateLoading(true);

    try {
      // Omit client confirmPassword before sending to backend
      const payload = {
        name: newInst.name.trim(),
        legalName: newInst.legalName.trim() || undefined,
        address: newInst.address.trim() || undefined,
        city: newInst.city.trim() || undefined,
        state: newInst.state.trim() || undefined,
        postalCode: newInst.postalCode.trim() || undefined,
        phone: newInst.phone.trim() || undefined,
        email: newInst.email.trim() || undefined,
        adminFullName: newInst.adminFullName.trim(),
        adminEmail: newInst.adminEmail.trim().toLowerCase(),
        adminPhone: newInst.adminPhone.trim() || undefined,
        adminInitialPassword: newInst.adminInitialPassword,
      };

      const res = await apiFetch('/institutes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data?.institute) {
        setShowCreateModal(false);
        setCreatedInstitute({
          name: res.data.institute.name,
          code: res.data.institute.code,
          adminEmail: res.data.initialAdmin?.email || payload.adminEmail,
        });
        setNewInst({
          name: '',
          legalName: '',
          address: '',
          city: '',
          state: '',
          postalCode: '',
          phone: '',
          email: '',
          adminFullName: '',
          adminEmail: '',
          adminPhone: '',
          adminInitialPassword: '',
          confirmPassword: '',
        });
        fetchData();
        showNotification('success', `Institute "${res.data.institute.name}" created successfully with code ${res.data.institute.code}`);
      } else {
        setCreateError(res.error || 'Failed to create institute');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create institute');
    } finally {
      setCreateLoading(false);
    }
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
  // HANDLE EDIT ADMIN ACCOUNT
  // ----------------------------------------------------
  const handleOpenEditAdminModal = () => {
    if (!detailData?.adminAccount) return;
    setEditAdminForm({
      fullName: detailData.adminAccount.fullName || '',
      email: detailData.adminAccount.email || '',
      phone: detailData.adminAccount.phone || '',
      isActive: detailData.adminAccount.isActive ?? true,
    });
    setEditAdminError(null);
    setShowEditAdminModal(true);
  };

  const handleEditAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstituteId) return;

    setEditAdminError(null);
    setEditAdminLoading(true);

    try {
      const res = await apiFetch(`/institutes/${selectedInstituteId}/admin-account`, {
        method: 'PATCH',
        body: JSON.stringify(editAdminForm),
      });

      if (res.success && res.data?.adminAccount) {
        setShowEditAdminModal(false);
        showNotification('success', 'Academic Admin account updated successfully');

        // Update local state in drawer
        if (detailData) {
          setDetailData({
            ...detailData,
            adminAccount: {
              ...detailData.adminAccount,
              ...res.data.adminAccount,
            },
          });
        }
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
  // HANDLE RESET ADMIN PASSWORD
  // ----------------------------------------------------
  const handleOpenResetPasswordModal = () => {
    setResetPassMode('AUTO');
    setCustomPassword('');
    setResetError(null);
    setShowResetPasswordModal(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstituteId || !detailData?.adminAccount) return;

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

      const res = await apiFetch(`/institutes/${selectedInstituteId}/admin-account/reset-password`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data?.temporaryPassword) {
        setShowResetPasswordModal(false);
        setOneTimePasswordData({
          adminEmail: detailData.adminAccount.email || 'Admin',
          temporaryPassword: res.data.temporaryPassword,
        });
        showNotification('success', 'Password reset successfully. Please share the temporary password.');

        // Refresh admin details in drawer
        fetchInstituteDetails(selectedInstituteId);
      } else {
        setResetError(res.error || 'Failed to reset password');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
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
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 ${
              notification.type === 'success'
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
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Platform Administration</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Global multi-tenant institute management, security compliance & onboarding
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#006FFF]/20 transition-all self-start active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add New Institute
        </button>
      </div>

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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Institute</th>
                <th className="py-3 px-4 font-bold">Code</th>
                <th className="py-3 px-4 font-bold">Location</th>
                <th className="py-3 px-4 font-bold">Metrics</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE9]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">Loading institutes...</td>
                </tr>
              ) : institutes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">No institutes found.</td>
                </tr>
              ) : (
                institutes.map((inst) => (
                  <tr key={inst.id} className="hover:bg-[#FFFFFF] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#0F172A] text-sm">{inst.name}</div>
                      {inst.email && <div className="text-[11px] text-[#64748B]">{inst.email}</div>}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#006FFF]">
                      <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-xs">
                        {inst.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#475569]">
                      {inst.city ? `${inst.city}${inst.state ? `, ${inst.state}` : ''}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-[#475569]">
                      <div className="flex items-center gap-3 text-[11px]">
                        <span><strong>{inst._count?.students || 0}</strong> Students</span>
                        <span>&bull;</span>
                        <span><strong>{inst._count?.staffProfiles || 0}</strong> Staff</span>
                        <span>&bull;</span>
                        <span><strong>{inst._count?.batches || 0}</strong> Batches</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* View Details Action */}
                        <button
                          onClick={() => handleOpenDetails(inst.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC] transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>

                        {/* Suspend or Activate Action */}
                        <button
                          onClick={() => setStatusActionTarget(inst)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                            inst.status === 'ACTIVE'
                              ? 'border-rose-300 text-rose-800 hover:bg-rose-50'
                              : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                          }`}
                        >
                          {inst.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
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
          1. CREATE INSTITUTE MODAL (COMPLETE ONBOARDING FORM)
         ==================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0F172A]">Onboard New Institute</h2>
                  <p className="text-xs text-[#64748B]">Set up tenant details and initial Academic Admin account</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#F8FAFC] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-6 mt-5">
              {/* SECTION: INSTITUTE DETAILS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#94A3B8]" /> Institute Details
                  </div>
                  <span className="text-[11px] text-[#94A3B8] font-medium">* Required fields</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Institute Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newInst.name}
                      onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                      placeholder="e.g. Cambridge Academy of Sciences"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Legal Name (Optional)</label>
                    <input
                      type="text"
                      value={newInst.legalName}
                      onChange={(e) => setNewInst({ ...newInst, legalName: e.target.value })}
                      placeholder="Registered entity name"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  {/* Auto-generated code badge */}
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Institute Code</label>
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#64748B] flex items-center justify-between">
                      <span className="font-mono font-medium text-[#006FFF]">Auto-assigned by system</span>
                      <span className="text-[10px] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full text-[#006FFF] font-semibold">
                        e.g. INS-XXXXXX
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Institute Email</label>
                    <input
                      type="email"
                      value={newInst.email}
                      onChange={(e) => setNewInst({ ...newInst, email: e.target.value })}
                      placeholder="contact@institute.edu"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Institute Phone</label>
                    <input
                      type="tel"
                      value={newInst.phone}
                      onChange={(e) => setNewInst({ ...newInst, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Address</label>
                    <input
                      type="text"
                      value={newInst.address}
                      onChange={(e) => setNewInst({ ...newInst, address: e.target.value })}
                      placeholder="Street address, Campus or Landmark"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#006FFF]">City</label>
                      <span className="text-[10px] text-[#94A3B8]">Auto-detects State</span>
                    </div>
                    <input
                      type="text"
                      value={newInst.city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      placeholder="e.g. Bangalore"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">State</label>
                    <input
                      type="text"
                      value={newInst.state}
                      onChange={(e) => setNewInst({ ...newInst, state: e.target.value })}
                      placeholder="e.g. Karnataka"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#006FFF]">PIN / Postal Code</label>
                      {isLocating ? (
                        <span className="text-[10px] text-[#006FFF] font-medium animate-pulse flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Fetching...
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#94A3B8]">Auto-fills City & State</span>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      value={newInst.postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      placeholder="e.g. 560001"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: INITIAL ACADEMIC ADMIN */}
              <div className="pt-4 border-t border-[#F1F5F9] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#94A3B8]" /> Initial Academic Admin Account
                  </div>
                  <span className="text-[11px] text-[#64748B]">Must change password on first login</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Admin Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newInst.adminFullName}
                      onChange={(e) => setNewInst({ ...newInst, adminFullName: e.target.value })}
                      placeholder="e.g. Dr. Ramesh Kumar"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Admin Login Email / Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={newInst.adminEmail}
                      onChange={(e) => setNewInst({ ...newInst, adminEmail: e.target.value })}
                      placeholder="admin@institute.edu"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Admin Phone Number</label>
                    <input
                      type="tel"
                      value={newInst.adminPhone}
                      onChange={(e) => setNewInst({ ...newInst, adminPhone: e.target.value })}
                      placeholder="+91 91234 56789"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  {/* Initial Password with Toggle and Generator */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#006FFF]">
                        Initial Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const pwd = generateStrongPassword();
                          setNewInst({ ...newInst, adminInitialPassword: pwd, confirmPassword: pwd });
                        }}
                        className="text-[11px] font-semibold text-[#006FFF] hover:text-[#0F172A] flex items-center gap-1 underline underline-offset-2"
                      >
                        <Sparkles className="w-3 h-3 text-[#94A3B8]" /> Generate Secure
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showInitialPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newInst.adminInitialPassword}
                        onChange={(e) => setNewInst({ ...newInst, adminInitialPassword: e.target.value })}
                        placeholder="Min 8 characters"
                        className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInitialPassword(!showInitialPassword)}
                        className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#006FFF]"
                      >
                        {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={newInst.confirmPassword}
                        onChange={(e) => setNewInst({ ...newInst, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                        className={`w-full bg-[#FFFFFF] border rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 ${
                          newInst.confirmPassword && newInst.adminInitialPassword !== newInst.confirmPassword
                            ? 'border-rose-400 focus:ring-rose-400'
                            : 'border-[#E2E8F0]'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#006FFF]"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newInst.confirmPassword && newInst.adminInitialPassword !== newInst.confirmPassword && (
                      <span className="text-[11px] text-rose-600 block mt-1">Passwords do not match</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-[#006FFF]/20 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {createLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Provisioning...
                    </>
                  ) : (
                    'Create Institute & Admin'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================
          2. SUCCESS MODAL SHOWING GENERATED CODE
         ==================================================== */}
      {createdInstitute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Institute Onboarded</h3>
                  <p className="text-xs text-[#64748B]">Unique code assigned and persisted</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedInstitute(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div>
                <span className="text-[#64748B] block mb-1">Institute Name</span>
                <div className="font-bold text-[#0F172A] text-sm">{createdInstitute.name}</div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[11px] uppercase tracking-wider text-[#006FFF] font-bold block mb-1.5">
                  Generated Institute Code
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-black text-[#0F172A] tracking-wider">
                    {createdInstitute.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdInstitute.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2500);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-medium text-xs transition-colors shadow-sm"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                </div>
              </div>

              {createdInstitute.adminEmail && (
                <div>
                  <span className="text-[#64748B] block mb-0.5">Assigned Academic Admin</span>
                  <div className="text-[#0F172A] font-mono text-xs font-semibold">{createdInstitute.adminEmail}</div>
                  <span className="text-[11px] text-[#94A3B8]">
                    The admin account must change password upon initial login.
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedInstitute(null)}
                className="w-full bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold py-2.5 rounded-xl transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          3. INSTITUTE DETAILS DRAWER / MODAL
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
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          detailData.institute.status === 'ACTIVE'
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
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                          detailData.institute.status === 'ACTIVE'
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
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC] transition disabled:opacity-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Details
                        </button>
                        <button
                          onClick={handleOpenResetPasswordModal}
                          disabled={!detailData.adminAccount}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white transition disabled:opacity-50 shadow-sm"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset Password
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

                        <div>
                          <span className="text-[#64748B] block mb-0.5">Password Status</span>
                          <div>
                            {detailData.adminAccount.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-600" /> Pending Change on Next Login
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" /> Active Password Set
                              </span>
                            )}
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
                className="px-5 py-2 text-xs font-semibold text-[#006FFF] hover:text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl transition shadow-sm"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          4. EDIT ADMIN ACCOUNT DETAILS MODAL
         ==================================================== */}
      {showEditAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
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
          5. RESET PASSWORD MODAL
         ==================================================== */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Reset Admin Password</h3>
                  <p className="text-xs text-[#64748B]">Issue a temporary password for this administrator</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
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
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      resetPassMode === 'AUTO'
                        ? 'bg-[#006FFF] text-white border-[#006FFF]'
                        : 'bg-[#FFFFFF] text-[#006FFF] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPassMode('MANUAL')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      resetPassMode === 'MANUAL'
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
                  onClick={() => setShowResetPasswordModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-[#006FFF]/20 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resetting...
                    </>
                  ) : (
                    'Confirm Password Reset'
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
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  statusActionTarget.status === 'ACTIVE'
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
                className={`text-xs font-semibold px-4 py-2 rounded-xl text-white transition shadow-sm flex items-center gap-1.5 ${
                  statusActionTarget.status === 'ACTIVE'
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
