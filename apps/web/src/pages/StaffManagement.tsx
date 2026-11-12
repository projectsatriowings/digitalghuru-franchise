import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../services/api';
import { StaffMember, Batch } from '../types';
import { useAuth } from '../context/AuthContext';
import { StaffProfileView } from '../components/staff/StaffProfileView';
import { AddStaffModal } from '../components/staff/AddStaffModal';
import { StaffAvatar } from '../components/StaffAvatar';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  X,
  Phone,
  Mail,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Lock,
  RefreshCw,
  Building2,
  BookOpen,
  GraduationCap,
  User,
  MoreVertical,
  UserCheck,
  UserX,
} from 'lucide-react';

export const StaffManagement: React.FC = () => {
  const { activeInstitute } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openMenuStaffId, setOpenMenuStaffId] = useState<string | null>(null);

  // Close 3-dots action menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuStaffId && !(e.target as HTMLElement).closest('.staff-action-menu')) {
        setOpenMenuStaffId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuStaffId]);

  // Selected staff profile view state
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // Add staff modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [createdStaffId, setCreatedStaffId] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{
    fullName: string;
    email: string;
    permanentPassword: string;
    employeeCode?: string;
    instituteCode?: string;
  } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(true);

  // Clipboard toast
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // View / Reset Credentials Modal State
  const [viewingStaffCreds, setViewingStaffCreds] = useState<StaffMember | null>(null);
  const [showExistingPassword, setShowExistingPassword] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetInputPassword, setShowResetInputPassword] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Batch & Subject Assignment Modal State
  const [viewingStaffAssignments, setViewingStaffAssignments] = useState<StaffMember | null>(null);
  const [assignmentBatchIds, setAssignmentBatchIds] = useState<string[]>([]);
  const [assignmentSubjectMap, setAssignmentSubjectMap] = useState<Record<string, string[]>>({});
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [staffRes, batchesRes] = await Promise.allSettled([
        apiFetch(`/staff?search=${encodeURIComponent(search)}`),
        apiFetch('/academics/batches'),
      ]);
      if (staffRes.status === 'fulfilled') {
        setStaff(staffRes.value.data?.staff || []);
      }
      if (batchesRes.status === 'fulfilled') {
        setBatches(batchesRes.value.data?.batches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedStaff(null);
  }, [activeInstitute?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeInstitute?.id]);

  const handleOpenAssignmentModal = (item: StaffMember) => {
    setViewingStaffAssignments(item);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    const assignedBatchIds = item.assignments?.map((a) => a.batch.id) || [];
    setAssignmentBatchIds(assignedBatchIds);

    const subMap: Record<string, string[]> = {};
    if (item.batchSubjects && item.batchSubjects.length > 0) {
      for (const bs of item.batchSubjects) {
        if (!subMap[bs.batchId]) {
          subMap[bs.batchId] = [];
        }
        if (!subMap[bs.batchId].includes(bs.subjectId)) {
          subMap[bs.batchId].push(bs.subjectId);
        }
      }
    }
    setAssignmentSubjectMap(subMap);
  };

  const handleToggleBatch = (batchId: string) => {
    const isSelected = assignmentBatchIds.includes(batchId);
    if (isSelected) {
      setAssignmentBatchIds((prev) => prev.filter((id) => id !== batchId));
      setAssignmentSubjectMap((prev) => {
        const next = { ...prev };
        delete next[batchId];
        return next;
      });
    } else {
      setAssignmentBatchIds((prev) => [...prev, batchId]);
      const batch = batches.find((b) => b.id === batchId);
      const subjectIds = batch?.batchSubjects?.map((bs) => bs.subjectId) || [];
      if (subjectIds.length > 0) {
        setAssignmentSubjectMap((prev) => ({
          ...prev,
          [batchId]: subjectIds,
        }));
      }
    }
  };

  const handleToggleSubject = (batchId: string, subjectId: string) => {
    setAssignmentSubjectMap((prev) => {
      const current = prev[batchId] || [];
      const updated = current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId];
      return {
        ...prev,
        [batchId]: updated,
      };
    });
  };

  const handleSelectAllSubjectsForBatch = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    const subjectIds = batch?.batchSubjects?.map((bs) => bs.subjectId) || [];
    setAssignmentSubjectMap((prev) => ({
      ...prev,
      [batchId]: subjectIds,
    }));
  };

  const handleClearSubjectsForBatch = (batchId: string) => {
    setAssignmentSubjectMap((prev) => ({
      ...prev,
      [batchId]: [],
    }));
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingStaffAssignments) return;

    setAssignmentLoading(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const assignments = assignmentBatchIds.map((batchId) => ({
        batchId,
        subjectIds: assignmentSubjectMap[batchId] || [],
      }));

      const res = await apiFetch(`/staff/${viewingStaffAssignments.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          batchIds: assignmentBatchIds,
          assignments,
        }),
      });

      if (res.success) {
        setAssignmentSuccess('Batch and subject assignments saved successfully!');
        await fetchData();
        setTimeout(() => {
          setViewingStaffAssignments(null);
        }, 1200);
      }
    } catch (err: any) {
      setAssignmentError(err.message || 'Failed to update assignments');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const generateStrongPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const rand = (str: string, len: number) =>
      Array.from({ length: len }, () => str[Math.floor(Math.random() * str.length)]).join('');
    return `Pass#${rand(chars, 3)}${rand(nums, 4)}`;
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyFormattedCredentials = (
    name: string,
    email: string,
    pass: string,
    instCode?: string,
    empCode?: string,
    key: string = 'full'
  ) => {
    const text =
      `Staff Login Credentials\n` +
      `------------------------\n` +
      `Staff Name: ${name}\n` +
      (empCode ? `Employee Code: ${empCode}\n` : '') +
      (instCode ? `Institute Code: ${instCode}\n` : '') +
      `Login Email: ${email}\n` +
      `Permanent Password: ${pass}\n` +
      `Portal: ${window.location.origin}\n` +
      `------------------------\n` +
      `Keep this password safe. You can log into Digital Guru with these credentials.`;

    copyToClipboard(text, key);
  };

  const handleToggleStatus = async (item: StaffMember) => {
    const nextStatus = !item.user.isActive;
    const confirmMsg = item.user.isActive
      ? `Deactivate account for "${item.user.fullName}"? They will lose access.`
      : `Reactivate account for "${item.user.fullName}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/staff/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      fetchData();
    } catch (err: any) {
      alert(`Error updating staff status: ${err.message}`);
    }
  };

  const handleOpenCredentialsModal = (item: StaffMember) => {
    setViewingStaffCreds(item);
    setShowExistingPassword(true);
    setResetPasswordInput('');
    setShowResetInputPassword(true);
    setResetError(null);
    setResetSuccess(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingStaffCreds) return;

    if (!resetPasswordInput.trim()) {
      setResetError('Please enter a password or click Auto-generate');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await apiFetch(`/staff/${viewingStaffCreds.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          newPassword: resetPasswordInput.trim(),
        }),
      });

      if (res.success) {
        setResetSuccess(`Permanent password updated successfully to: "${res.data.permanentPassword}"`);
        const updatedStaff = {
          ...viewingStaffCreds,
          permissionsJson: {
            ...(viewingStaffCreds.permissionsJson || {}),
            permanentPassword: res.data.permanentPassword,
          },
        };
        setViewingStaffCreds(updatedStaff);
        setShowExistingPassword(true);
        setResetPasswordInput('');
        setStaff((prev) => prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s)));
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to update permanent password');
    } finally {
      setResetLoading(false);
    }
  };

  // If a staff profile is selected, render the full Profile View
  if (selectedStaff) {
    return (
      <StaffProfileView
        staffId={selectedStaff.id}
        initialStaff={selectedStaff}
        onBack={() => {
          setSelectedStaff(null);
          fetchData();
        }}
        onUpdated={fetchData}
        batches={batches}
        onOpenBatchAssignments={handleOpenAssignmentModal}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Staff & Faculty Management</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Manage teaching faculty, staff profiles, and login credentials
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#006FFF]/20 transition-all self-start"
        >
          <Plus className="w-4 h-4" /> Add New Staff Member
        </button>
      </div>

      {/* Directory Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, code..."
              className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
          </div>
          <div className="text-xs text-[#64748B] font-medium hidden sm:block">
            Institute Code:{' '}
            <span className="font-mono font-bold text-[#006FFF] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
              {activeInstitute?.code || 'INST-001'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[360px]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC] uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Faculty / Staff</th>
                <th className="py-3 px-4 font-bold">Employee Code</th>
                <th className="py-3 px-4 font-bold">Designation</th>
                <th className="py-3 px-4 font-bold">Batches Assigned</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE9]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    Loading staff directory...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748B]">
                    No staff members found.
                  </td>
                </tr>
              ) : (
                staff.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedStaff(item)}
                    className="hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <StaffAvatar
                          staffId={item.id}
                          avatarUrl={item.avatarUrl}
                          name={item.user.fullName}
                          size="sm"
                        />
                        <div>
                          <div className="font-bold text-[#0F172A] text-sm group-hover:underline group-hover:text-[#006FFF] text-left transition-colors">
                            {item.user.fullName}
                          </div>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-[#94A3B8]" /> {item.user.email}
                            </span>
                            {item.user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-[#94A3B8]" /> {item.user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#006FFF]">
                      {item.employeeCode ? (
                        <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-xs">
                          {item.employeeCode}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#0F172A] font-medium">
                      <div>{item.designation}</div>
                      {item.department && (
                        <div className="text-[11px] text-[#94A3B8]">{item.department}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-[#475569]">
                      {item.assignments && item.assignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {item.assignments.map((a) => {
                            const assignedSubjectsForBatch =
                              item.batchSubjects?.filter((bs) => bs.batchId === a.batch.id) || [];

                            return (
                              <span
                                key={a.id}
                                className="inline-flex flex-col px-2 py-1 rounded-lg bg-[#F8FAFC] text-[11px] text-[#006FFF] border border-[#E2E8F0]"
                              >
                                <span className="font-bold">{a.batch.name}</span>
                                {assignedSubjectsForBatch.length > 0 ? (
                                  <span className="text-[10px] text-[#94A3B8] font-medium">
                                    {assignedSubjectsForBatch.map((bs) => bs.subject.name).join(', ')}
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-[#94A3B8] italic">All / General</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-[#94A3B8] italic">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {item.user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="relative inline-block text-left staff-action-menu">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuStaffId(openMenuStaffId === item.id ? null : item.id);
                          }}
                          className={`p-2 rounded-lg border transition shadow-sm ${
                            openMenuStaffId === item.id
                              ? 'bg-[#006FFF] text-white border-[#006FFF]'
                              : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                          }`}
                          title="Actions menu"
                          aria-label="Actions menu"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuStaffId === item.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-48 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-1.5 z-50 text-xs font-medium text-[#0F172A] text-left"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuStaffId(null);
                                setSelectedStaff(item);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#F8FAFC] hover:text-[#006FFF] flex items-center gap-2.5 transition-colors"
                            >
                              <User className="w-4 h-4 text-[#94A3B8]" />
                              <span>View Profile</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuStaffId(null);
                                handleOpenAssignmentModal(item);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#F8FAFC] hover:text-[#006FFF] flex items-center gap-2.5 transition-colors"
                            >
                              <BookOpen className="w-4 h-4 text-[#94A3B8]" />
                              <span>Assign Batches</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuStaffId(null);
                                handleOpenCredentialsModal(item);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-[#F8FAFC] hover:text-[#006FFF] flex items-center gap-2.5 transition-colors"
                            >
                              <Key className="w-4 h-4 text-[#94A3B8]" />
                              <span>Login Credentials</span>
                            </button>

                            <div className="my-1 border-t border-[#F1F5F9]" />

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuStaffId(null);
                                handleToggleStatus(item);
                              }}
                              className={`w-full text-left px-3.5 py-2 flex items-center gap-2.5 transition-colors ${
                                item.user.isActive
                                  ? 'hover:bg-rose-50 text-rose-700'
                                  : 'hover:bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {item.user.isActive ? (
                                <>
                                  <UserX className="w-4 h-4 text-rose-600" />
                                  <span>Deactivate Staff</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 text-emerald-600" />
                                  <span>Activate Staff</span>
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

      {/* Upgraded Multi-Step Add Staff Modal */}
      <AddStaffModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        batches={batches}
        activeInstituteCode={activeInstitute?.code}
        onSuccess={(newStaff, creds) => {
          setShowAddModal(false);
          setCreatedStaffId(newStaff.id);
          setCreatedCredential(creds);
          fetchData();
        }}
      />

      {/* Created Credential Modal */}
      {createdCredential && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Permanent Staff Login Created
              </h2>
              <button
                onClick={() => {
                  setCreatedCredential(null);
                  setCreatedStaffId(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 p-5 rounded-2xl bg-emerald-50 border border-emerald-300 text-[#0F172A] space-y-4">
              <p className="text-xs text-[#475569] leading-relaxed">
                The permanent login account and profile have been created. You can hand over these login
                details directly to the staff member.
              </p>

              <div className="p-4 rounded-xl bg-white border border-emerald-200 text-xs space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-[#64748B]">Staff Name:</span>
                  <span className="font-bold text-[#0F172A]">{createdCredential.fullName}</span>
                </div>
                {createdCredential.employeeCode && (
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                    <span className="text-[#64748B]">Employee Code:</span>
                    <span className="font-mono font-bold text-[#006FFF] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-xs">
                      {createdCredential.employeeCode}
                    </span>
                  </div>
                )}
                {createdCredential.instituteCode && (
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                    <span className="text-[#64748B]">Institute Code:</span>
                    <span className="font-mono font-bold text-[#006FFF]">
                      {createdCredential.instituteCode}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-[#64748B]">Login Email:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[#0F172A] select-all">
                      {createdCredential.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdCredential.email, 'created_email')}
                      className="text-[#94A3B8] hover:text-[#0F172A] p-0.5"
                    >
                      {copiedKey === 'created_email' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#64748B]">Permanent Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0F172A] bg-emerald-50/70 border border-emerald-200 px-2.5 py-0.5 rounded text-xs select-all">
                      {showCreatedPassword ? createdCredential.permanentPassword : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      className="text-[#94A3B8] hover:text-[#0F172A]"
                    >
                      {showCreatedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdCredential.permanentPassword, 'created_pass')}
                      className="text-[#94A3B8] hover:text-emerald-700"
                    >
                      {copiedKey === 'created_pass' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    copyFormattedCredentials(
                      createdCredential.fullName,
                      createdCredential.email,
                      createdCredential.permanentPassword,
                      createdCredential.instituteCode,
                      createdCredential.employeeCode,
                      'created_all'
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-md transition"
                >
                  {copiedKey === 'created_all' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey === 'created_all' ? 'Copied Login & Password!' : 'Copy Login Details'}
                </button>
                {createdStaffId && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = createdStaffId;
                      setCreatedCredential(null);
                      setCreatedStaffId(null);
                      setSelectedStaff(staff.find((s) => s.id === id) || ({ id } as any));
                    }}
                    className="inline-flex items-center justify-center gap-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition"
                  >
                    <User className="w-4 h-4" />
                    <span>View Profile</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreatedCredential(null);
                    setCreatedStaffId(null);
                  }}
                  className="border border-[#E2E8F0] hover:bg-white text-[#006FFF] text-xs font-semibold py-2.5 px-4 rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Existing Credentials View / Reset Modal */}
      {viewingStaffCreds && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-md p-6 shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-sm">
                  {viewingStaffCreds.user.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    {viewingStaffCreds.user.fullName}
                  </h2>
                  <div className="text-[11px] font-mono text-[#94A3B8]">
                    {viewingStaffCreds.employeeCode || 'No Employee Code'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingStaffCreds(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {resetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                  {resetError}
                </div>
              )}

              {/* Profile Details Card */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Institute Code:</span>
                  <span className="font-mono font-bold text-[#006FFF]">
                    {activeInstitute?.code || 'INST'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Designation:</span>
                  <span className="font-semibold text-[#0F172A]">{viewingStaffCreds.designation}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                  <span className="text-[#64748B]">Login Email:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#0F172A] select-all">
                      {viewingStaffCreds.user.email}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(viewingStaffCreds.user.email || '', 'view_email')
                      }
                      className="text-[#94A3B8] hover:text-[#0F172A]"
                      title="Copy email"
                    >
                      {copiedKey === 'view_email' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Permanent Password on Record */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[#64748B]">Permanent Password:</span>
                  {viewingStaffCreds.permissionsJson?.permanentPassword ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-xs select-all">
                        {showExistingPassword
                          ? viewingStaffCreds.permissionsJson.permanentPassword
                          : '••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowExistingPassword(!showExistingPassword)}
                        className="text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        {showExistingPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            (viewingStaffCreds.permissionsJson as any)?.permanentPassword || '',
                            'view_pass'
                          )
                        }
                        className="text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        {copiedKey === 'view_pass' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#94A3B8] italic text-[11px]">
                      Not visible (enter new password below to reset)
                    </span>
                  )}
                </div>
              </div>

              {/* Set / Reset Password Form */}
              <form onSubmit={handleResetPassword} className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#006FFF]">Set New Permanent Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newPass = generateStrongPassword();
                      setResetPasswordInput(newPass);
                      setShowResetInputPassword(true);
                    }}
                    className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-generate
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetInputPassword ? 'text' : 'password'}
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Type or click Auto-generate"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-3 pr-10 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetInputPassword(!showResetInputPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#006FFF]"
                  >
                    {showResetInputPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setViewingStaffCreds(null)}
                    className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetPasswordInput}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition disabled:opacity-50"
                  >
                    {resetLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{resetLoading ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch & Subject Assignment Modal */}
      {viewingStaffAssignments && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl p-6 shadow-2xl text-[#0F172A] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {viewingStaffAssignments.user.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Assign Batches & Subjects
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    {viewingStaffAssignments.user.fullName} ({viewingStaffAssignments.designation})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingStaffAssignments(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignmentSuccess && (
              <div className="p-3 my-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{assignmentSuccess}</span>
              </div>
            )}

            {assignmentError && (
              <div className="p-3 my-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                {assignmentError}
              </div>
            )}

            <form onSubmit={handleSaveAssignments} className="mt-4 space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {batches.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#94A3B8] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E2E8F0]">
                    No batches available. Please create batches first in Academic Management.
                  </div>
                ) : (
                  batches.map((b) => {
                    const isBatchSelected = assignmentBatchIds.includes(b.id);
                    const batchSubjects = b.batchSubjects || [];
                    const selectedSubjectsForBatch = assignmentSubjectMap[b.id] || [];

                    return (
                      <div
                        key={b.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isBatchSelected
                            ? 'bg-[#FFFFFF] border-[#8D6E63] shadow-sm'
                            : 'bg-white border-[#F1F5F9] hover:border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isBatchSelected}
                              onChange={() => handleToggleBatch(b.id)}
                              className="w-4 h-4 rounded text-[#006FFF] border-[#E2E8F0] focus:ring-[#006FFF]/20 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-xs text-[#0F172A]">
                                {b.name}
                              </div>
                              <div className="text-[11px] text-[#94A3B8]">
                                Year: {b.academicYear} {b.code ? `• Code: ${b.code}` : ''}
                              </div>
                            </div>
                          </label>

                          {isBatchSelected && batchSubjects.length > 0 && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAllSubjectsForBatch(b.id)}
                                className="text-[10px] font-semibold text-[#006FFF] hover:underline"
                              >
                                All Subjects
                              </button>
                              <span className="text-[#D7CCC8]">|</span>
                              <button
                                type="button"
                                onClick={() => handleClearSubjectsForBatch(b.id)}
                                className="text-[10px] font-semibold text-[#94A3B8] hover:underline"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Subjects list for this batch */}
                        {isBatchSelected && (
                          <div className="mt-3 pt-3 border-t border-[#F1F5F9] pl-6 space-y-2">
                            <div className="text-[11px] font-bold text-[#64748B]">
                              Subjects taught by this staff member:
                            </div>

                            {batchSubjects.length === 0 ? (
                              <div className="text-[11px] text-[#94A3B8] italic">
                                No distinct subjects configured in this batch. Staff will have general batch access.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {batchSubjects.map((bs) => {
                                  const isSubjectSelected = selectedSubjectsForBatch.includes(bs.subjectId);
                                  return (
                                    <label
                                      key={bs.id}
                                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                        isSubjectSelected
                                          ? 'bg-white border-[#8D6E63] text-[#0F172A] font-semibold shadow-xs'
                                          : 'bg-[#F8FAFC]/60 border-transparent text-[#64748B]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSubjectSelected}
                                        onChange={() => handleToggleSubject(b.id, bs.subjectId)}
                                        className="w-3.5 h-3.5 rounded text-[#006FFF] border-[#E2E8F0] focus:ring-[#006FFF]/20 cursor-pointer"
                                      />
                                      <span className="truncate">
                                        {bs.subject.name}
                                        {bs.subject.code ? ` (${bs.subject.code})` : ''}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setViewingStaffAssignments(null)}
                  disabled={assignmentLoading}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignmentLoading}
                  className="inline-flex items-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {assignmentLoading ? 'Saving Assignments...' : 'Save Assignments'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

