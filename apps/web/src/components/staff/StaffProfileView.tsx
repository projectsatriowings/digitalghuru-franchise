import { lookupByPostalCode, lookupByCity } from '../../utils/locationHelper';
import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { StaffMember, StaffQualification, StaffExperience, StaffDocument, Batch } from '../../types';
import {
  ArrowLeft,
  User,
  Briefcase,
  GraduationCap,
  BookOpen,
  FileText,
  Key,
  CheckCircle,
  AlertTriangle,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Download,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Clock,
  Award,
  ShieldCheck,
  Check,
  Copy,
  Eye,
  EyeOff,
  UploadCloud,
  ChevronRight,
  Building,
  Sparkles,
  RefreshCw,
  Camera,
} from 'lucide-react';

interface StaffProfileViewProps {
  staffId: string;
  initialStaff?: StaffMember | null;
  onBack: () => void;
  onUpdated?: () => void;
  batches: Batch[];
  onOpenBatchAssignments: (staff: StaffMember) => void;
}

type TabType =
  | 'overview'
  | 'personal'
  | 'employment'
  | 'qualifications'
  | 'assignments'
  | 'documents'
  | 'account';

export const StaffProfileView: React.FC<StaffProfileViewProps> = ({
  staffId,
  initialStaff,
  onBack,
  onUpdated,
  batches,
  onOpenBatchAssignments,
}) => {
  const [staff, setStaff] = useState<StaffMember | null>(initialStaff || null);
  const [loading, setLoading] = useState(!initialStaff);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Photo upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Edit personal details mode
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    fullName: '',
    phone: '',
    dob: '',
    gender: '',
    altPhone: '',
    personalEmail: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    currentAddressLine1: '',
    currentAddressLine2: '',
    currentCity: '',
    currentState: '',
    currentPostalCode: '',
    currentCountry: '',
    permanentAddressLine1: '',
    permanentAddressLine2: '',
    permanentCity: '',
    permanentState: '',
    permanentPostalCode: '',
    permanentCountry: '',
    sameAsCurrentAddress: false,
  });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Edit employment details mode
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [employmentForm, setEmploymentForm] = useState({
    employeeCode: '',
    designation: '',
    department: '',
    employmentType: 'FULL_TIME',
    joiningDate: '',
    probationEndDate: '',
    workLocation: '',
    employmentNotes: '',
  });
  const [employmentSaving, setEmploymentSaving] = useState(false);
  const [employmentError, setEmploymentError] = useState<string | null>(null);

  // Qualification Modal
  const [showQualModal, setShowQualModal] = useState(false);
  const [editingQual, setEditingQual] = useState<StaffQualification | null>(null);
  const [qualForm, setQualForm] = useState({
    degree: '',
    fieldOfStudy: '',
    institution: '',
    yearOfCompletion: '',
    gradeScore: '',
  });
  const [qualSaving, setQualSaving] = useState(false);

  // Experience Modal
  const [showExpModal, setShowExpModal] = useState(false);
  const [editingExp, setEditingExp] = useState<StaffExperience | null>(null);
  const [expForm, setExpForm] = useState({
    institution: '',
    designation: '',
    subjects: '',
    totalYears: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    notes: '',
  });
  const [expSaving, setExpSaving] = useState(false);

  // Document Upload Modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docForm, setDocForm] = useState({
    documentType: 'ID_PROOF',
    displayName: '',
    expiryDate: '',
    notes: '',
  });
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Password Reset state in Account Tab
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetInputPassword, setShowResetInputPassword] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);


  const populateForms = (s: StaffMember) => {
    setPersonalForm({
      fullName: s.user?.fullName || '',
      phone: s.user?.phone || '',
      dob: s.dob ? s.dob.split('T')[0] : '',
      gender: s.gender || '',
      altPhone: s.altPhone || '',
      personalEmail: s.personalEmail || '',
      emergencyContactName: s.emergencyContactName || '',
      emergencyContactRelation: s.emergencyContactRelation || '',
      emergencyContactPhone: s.emergencyContactPhone || '',
      currentAddressLine1: s.currentAddressLine1 || '',
      currentAddressLine2: s.currentAddressLine2 || '',
      currentCity: s.currentCity || '',
      currentState: s.currentState || '',
      currentPostalCode: s.currentPostalCode || '',
      currentCountry: s.currentCountry || 'India',
      permanentAddressLine1: s.permanentAddressLine1 || '',
      permanentAddressLine2: s.permanentAddressLine2 || '',
      permanentCity: s.permanentCity || '',
      permanentState: s.permanentState || '',
      permanentPostalCode: s.permanentPostalCode || '',
      permanentCountry: s.permanentCountry || 'India',
      sameAsCurrentAddress: !!s.sameAsCurrentAddress,
    });

    setEmploymentForm({
      employeeCode: s.employeeCode || '',
      designation: s.designation || '',
      department: s.department || '',
      employmentType: s.employmentType || 'FULL_TIME',
      joiningDate: s.joiningDate ? s.joiningDate.split('T')[0] : '',
      probationEndDate: s.probationEndDate ? s.probationEndDate.split('T')[0] : '',
      workLocation: s.workLocation || '',
      employmentNotes: s.employmentNotes || '',
    });
  };

  // Load Staff Details
  const fetchStaffDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/staff/${staffId}`);
      if (res.success && res.data?.staff) {
        const s: StaffMember = res.data.staff;
        setStaff(s);
        populateForms(s);
      } else {
        setError('Staff profile could not be loaded');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch staff details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffDetails();
  }, [staffId]);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate strong password
  const generateStrongPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const rand = (str: string, len: number) =>
      Array.from({ length: len }, () => str[Math.floor(Math.random() * str.length)]).join('');
    return `Pass#${rand(chars, 3)}${rand(nums, 4)}`;
  };

  // Photo upload handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Photograph size must be less than 5MB');
      return;
    }

    try {
      setPhotoUploading(true);
      const formData = new FormData();
      formData.append('photo', file);

      const res = await apiFetch(`/staff/${staffId}/photo`, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload photograph');
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Save Personal Details
  const handleCurrentPostalCodeChange = async (val: string) => {
    setPersonalForm((prev) => ({ ...prev, currentPostalCode: val }));
    const clean = val.trim().replace(/\D/g, '');
    if (clean.length === 6) {
      const res = await lookupByPostalCode(clean);
      if (res) {
        setPersonalForm((prev) => ({
          ...prev,
          currentCity: res.city || prev.currentCity,
          currentState: res.state || prev.currentState,
        }));
      }
    }
  };

  const handleCurrentCityChange = async (val: string) => {
    setPersonalForm((prev) => ({ ...prev, currentCity: val }));
    if (val.trim().length >= 3) {
      const res = await lookupByCity(val);
      if (res && res.state) {
        setPersonalForm((prev) => ({
          ...prev,
          currentState: res.state || prev.currentState,
          currentPostalCode: prev.currentPostalCode ? prev.currentPostalCode : (res.postalCode || ''),
        }));
      }
    }
  };

  const handlePermanentPostalCodeChange = async (val: string) => {
    setPersonalForm((prev) => ({ ...prev, permanentPostalCode: val }));
    const clean = val.trim().replace(/\D/g, '');
    if (clean.length === 6) {
      const res = await lookupByPostalCode(clean);
      if (res) {
        setPersonalForm((prev) => ({
          ...prev,
          permanentCity: res.city || prev.permanentCity,
          permanentState: res.state || prev.permanentState,
        }));
      }
    }
  };

  const handlePermanentCityChange = async (val: string) => {
    setPersonalForm((prev) => ({ ...prev, permanentCity: val }));
    if (val.trim().length >= 3) {
      const res = await lookupByCity(val);
      if (res && res.state) {
        setPersonalForm((prev) => ({
          ...prev,
          permanentState: res.state || prev.permanentState,
          permanentPostalCode: prev.permanentPostalCode ? prev.permanentPostalCode : (res.postalCode || ''),
        }));
      }
    }
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPersonalSaving(true);
      setPersonalError(null);

      const payload = {
        fullName: personalForm.fullName.trim(),
        phone: personalForm.phone.trim() || null,
        dob: personalForm.dob || null,
        gender: personalForm.gender || null,
        altPhone: personalForm.altPhone.trim() || null,
        personalEmail: personalForm.personalEmail.trim() || null,
        emergencyContactName: personalForm.emergencyContactName.trim() || null,
        emergencyContactRelation: personalForm.emergencyContactRelation.trim() || null,
        emergencyContactPhone: personalForm.emergencyContactPhone.trim() || null,
        currentAddressLine1: personalForm.currentAddressLine1.trim() || null,
        currentAddressLine2: personalForm.currentAddressLine2.trim() || null,
        currentCity: personalForm.currentCity.trim() || null,
        currentState: personalForm.currentState.trim() || null,
        currentPostalCode: personalForm.currentPostalCode.trim() || null,
        currentCountry: personalForm.currentCountry.trim() || null,
        sameAsCurrentAddress: personalForm.sameAsCurrentAddress,
        permanentAddressLine1: personalForm.sameAsCurrentAddress
          ? personalForm.currentAddressLine1.trim() || null
          : personalForm.permanentAddressLine1.trim() || null,
        permanentAddressLine2: personalForm.sameAsCurrentAddress
          ? personalForm.currentAddressLine2.trim() || null
          : personalForm.permanentAddressLine2.trim() || null,
        permanentCity: personalForm.sameAsCurrentAddress
          ? personalForm.currentCity.trim() || null
          : personalForm.permanentCity.trim() || null,
        permanentState: personalForm.sameAsCurrentAddress
          ? personalForm.currentState.trim() || null
          : personalForm.permanentState.trim() || null,
        permanentPostalCode: personalForm.sameAsCurrentAddress
          ? personalForm.currentPostalCode.trim() || null
          : personalForm.permanentPostalCode.trim() || null,
        permanentCountry: personalForm.sameAsCurrentAddress
          ? personalForm.currentCountry.trim() || null
          : personalForm.permanentCountry.trim() || null,
      };

      const res = await apiFetch(`/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setEditingPersonal(false);
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setPersonalError(err.message || 'Failed to save personal details');
    } finally {
      setPersonalSaving(false);
    }
  };

  // Save Employment Details
  const handleSaveEmployment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEmploymentSaving(true);
      setEmploymentError(null);

      const payload = {
        employeeCode: employmentForm.employeeCode.trim() || null,
        designation: employmentForm.designation.trim(),
        department: employmentForm.department.trim() || null,
        employmentType: employmentForm.employmentType,
        joiningDate: employmentForm.joiningDate || null,
        probationEndDate: employmentForm.probationEndDate || null,
        workLocation: employmentForm.workLocation.trim() || null,
        employmentNotes: employmentForm.employmentNotes.trim() || null,
      };

      const res = await apiFetch(`/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setEditingEmployment(false);
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setEmploymentError(err.message || 'Failed to update employment details');
    } finally {
      setEmploymentSaving(false);
    }
  };

  // Toggle Staff Status
  const handleToggleStatus = async () => {
    if (!staff) return;
    const newStatus = !staff.user.isActive;
    const actionLabel = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${staff.user.fullName}?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/staff/${staff.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      if (res.success) {
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      alert(err.message || `Failed to ${actionLabel} staff`);
    }
  };

  // Save Qualification
  const handleSaveQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setQualSaving(true);
      const payload = {
        degree: qualForm.degree.trim(),
        fieldOfStudy: qualForm.fieldOfStudy.trim() || null,
        institution: qualForm.institution.trim(),
        yearOfCompletion: qualForm.yearOfCompletion ? parseInt(qualForm.yearOfCompletion, 10) : null,
        gradeScore: qualForm.gradeScore.trim() || null,
      };

      if (editingQual) {
        await apiFetch(`/staff/${staffId}/qualifications/${editingQual.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/staff/${staffId}/qualifications`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowQualModal(false);
      setEditingQual(null);
      await fetchStaffDetails();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to save qualification');
    } finally {
      setQualSaving(false);
    }
  };

  // Delete Qualification
  const handleDeleteQualification = async (qid: string) => {
    if (!window.confirm('Delete this qualification?')) return;
    try {
      await apiFetch(`/staff/${staffId}/qualifications/${qid}`, { method: 'DELETE' });
      await fetchStaffDetails();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete qualification');
    }
  };

  // Save Experience
  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setExpSaving(true);
      const payload = {
        institution: expForm.institution.trim(),
        designation: expForm.designation.trim(),
        subjects: expForm.subjects.trim() || null,
        totalYears: expForm.totalYears ? parseFloat(expForm.totalYears) : null,
        startDate: expForm.startDate || null,
        endDate: expForm.isCurrent ? null : expForm.endDate || null,
        isCurrent: expForm.isCurrent,
        notes: expForm.notes.trim() || null,
      };

      if (editingExp) {
        await apiFetch(`/staff/${staffId}/experiences/${editingExp.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/staff/${staffId}/experiences`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setShowExpModal(false);
      setEditingExp(null);
      await fetchStaffDetails();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to save experience');
    } finally {
      setExpSaving(false);
    }
  };

  // Delete Experience
  const handleDeleteExperience = async (eid: string) => {
    if (!window.confirm('Delete this experience record?')) return;
    try {
      await apiFetch(`/staff/${staffId}/experiences/${eid}`, { method: 'DELETE' });
      await fetchStaffDetails();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete experience');
    }
  };

  // Upload Document
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) {
      setDocError('Please choose a document file to upload');
      return;
    }

    try {
      setDocUploading(true);
      setDocError(null);

      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('documentType', docForm.documentType);
      formData.append('displayName', docForm.displayName.trim() || docFile.name);
      if (docForm.expiryDate) formData.append('expiryDate', docForm.expiryDate);
      if (docForm.notes) formData.append('notes', docForm.notes.trim());

      const res = await apiFetch(`/staff/${staffId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        setShowDocModal(false);
        setDocFile(null);
        setDocForm({ documentType: 'ID_PROOF', displayName: '', expiryDate: '', notes: '' });
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setDocError(err.message || 'Failed to upload document');
    } finally {
      setDocUploading(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await apiFetch(`/staff/${staffId}/documents/${docId}`, { method: 'DELETE' });
      await fetchStaffDetails();
      onUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  // Reset Password from Account Tab
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordInput || resetPasswordInput.length < 6) {
      setResetMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    try {
      setResetLoading(true);
      setResetMsg(null);

      const res = await apiFetch(`/staff/${staffId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPasswordInput }),
      });

      if (res.success) {
        setResetMsg({
          type: 'success',
          text: `Password successfully updated to: ${res.data.permanentPassword}`,
        });
        setResetPasswordInput('');
        await fetchStaffDetails();
        onUpdated?.();
      }
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Failed to reset password' });
    } finally {
      setResetLoading(false);
    }
  };

  // Calculate profile completeness score
  const calculateCompleteness = () => {
    if (!staff) return 0;
    const checks = [
      Boolean(staff.user?.fullName),
      Boolean(staff.user?.email),
      Boolean(staff.user?.phone),
      Boolean(staff.employeeCode),
      Boolean(staff.designation),
      Boolean(staff.department),
      Boolean(staff.dob),
      Boolean(staff.gender),
      Boolean(staff.currentAddressLine1 && staff.currentCity),
      Boolean(staff.emergencyContactName && staff.emergencyContactPhone),
      Boolean(staff.qualifications && staff.qualifications.length > 0),
      Boolean(staff.documents && staff.documents.length > 0),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  };

  // Calculate length of service
  const calculateLengthOfService = (joiningDateStr?: string | null) => {
    if (!joiningDateStr) return 'Not recorded';
    const joining = new Date(joiningDateStr);
    const now = new Date();
    const diffMonths =
      (now.getFullYear() - joining.getFullYear()) * 12 + (now.getMonth() - joining.getMonth());
    if (diffMonths < 1) return 'Just joined';
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
    const years = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    return `${years} yr${years > 1 ? 's' : ''}${
      remainingMonths > 0 ? ` ${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}` : ''
    }`;
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center shadow-sm">
        <RefreshCw className="w-8 h-8 text-[#94A3B8] animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-[#006FFF]">Loading staff profile...</p>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-rose-900 mb-1">Failed to Load Profile</h3>
        <p className="text-sm text-rose-700 mb-4">{error || 'Staff member not found'}</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Staff Directory
        </button>
      </div>
    );
  }

  const completeness = calculateCompleteness();

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#006FFF] hover:text-[#0F172A] bg-white border border-[#E2E8F0] px-3.5 py-2 rounded-xl hover:bg-[#F8FAFC] transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Staff Directory</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleStatus}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors shadow-sm ${
              staff.user.isActive
                ? 'border-rose-300 text-rose-800 bg-rose-50/60 hover:bg-rose-100'
                : 'border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100'
            }`}
          >
            {staff.user.isActive ? 'Deactivate Employee' : 'Activate Employee'}
          </button>
        </div>
      </div>

      {/* Profile Header Banner */}
      <div className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            {/* Avatar with click-to-change */}
            <div className="relative group shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-2xl bg-[#006FFF] text-[#F7F2EF] flex items-center justify-center font-bold text-2xl border-2 border-white shadow-md overflow-hidden cursor-pointer relative group"
                title="Click to change profile picture"
              >
                {/* Fallback initials always rendered underneath */}
                <span className="select-none">
                  {staff.user.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                {staff.avatarUrl && (
                  <img
                    src={`/api/staff/${staff.id}/photo?v=${Date.now()}`}
                    alt={staff.user.fullName}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                {/* Overlay icon */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Camera className="w-5 h-5" />
                </div>
              </div>
              {photoUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white text-[10px] font-semibold">
                  Uploading...
                </div>
              )}
            </div>

            {/* Core Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                  {staff.user.fullName}
                </h1>
                {staff.user.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300">
                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Deactivated
                  </span>
                )}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                  {staff.employmentType?.replace('_', ' ') || 'FULL TIME'}
                </span>
              </div>

              <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-y-1 gap-x-4">
                <span className="font-semibold text-[#006FFF]">{staff.designation}</span>
                {staff.department && (
                  <>
                    <span className="text-[#D7CCC8]">•</span>
                    <span>{staff.department}</span>
                  </>
                )}
                <span className="text-[#D7CCC8]">•</span>
                <span className="font-mono bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-[11px] text-[#006FFF]">
                  {staff.employeeCode || 'No Code'}
                </span>
                {staff.joiningDate && (
                  <>
                    <span className="text-[#D7CCC8]">•</span>
                    <span>Joined {new Date(staff.joiningDate).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              <div className="text-xs text-[#94A3B8] flex flex-wrap items-center gap-y-1 gap-x-4 pt-0.5">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {staff.user.email}
                </span>
                {staff.user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {staff.user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-[#E2E8F0] pt-4 md:pt-0 md:pl-6 shrink-0 gap-3">
            <div className="text-right">
              <div className="text-[11px] text-[#94A3B8] font-medium">Profile Completeness</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-28 bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completeness >= 80
                        ? 'bg-emerald-600'
                        : completeness >= 50
                        ? 'bg-amber-600'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#006FFF]">{completeness}%</span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab('personal');
                setEditingPersonal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] hover:border-[#8D6E63] text-xs font-semibold text-[#006FFF] rounded-xl hover:bg-[#F8FAFC] transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[#E2E8F0] flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'personal', label: 'Personal Details', icon: User },
          { id: 'employment', label: 'Employment Details', icon: Briefcase },
          { id: 'qualifications', label: 'Qualifications & Experience', icon: GraduationCap },
          {
            id: 'assignments',
            label: `Teaching Assignments (${staff.assignments?.length || 0})`,
            icon: BookOpen,
          },
          { id: 'documents', label: `Documents (${staff.documents?.length || 0})`, icon: FileText },
          { id: 'account', label: 'Account & Access', icon: Key },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-[2px] ${
                isActive
                  ? 'border-[#006FFF] text-[#006FFF] bg-white rounded-t-xl'
                  : 'border-transparent text-[#94A3B8] hover:text-[#006FFF] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#006FFF]' : 'text-[#94A3B8]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Main Info Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                <span className="text-[11px] text-[#94A3B8] font-medium block">Length of Service</span>
                <span className="text-sm font-bold text-[#0F172A] mt-1 block">
                  {calculateLengthOfService(staff.joiningDate)}
                </span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                <span className="text-[11px] text-[#94A3B8] font-medium block">Batches Handled</span>
                <span className="text-sm font-bold text-[#0F172A] mt-1 block">
                  {staff.assignments?.length || 0} Active
                </span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                <span className="text-[11px] text-[#94A3B8] font-medium block">Qualifications</span>
                <span className="text-sm font-bold text-[#0F172A] mt-1 block">
                  {staff.qualifications?.length || 0} Registered
                </span>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                <span className="text-[11px] text-[#94A3B8] font-medium block">Documents</span>
                <span className="text-sm font-bold text-[#0F172A] mt-1 block">
                  {staff.documents?.length || 0} Verified
                </span>
              </div>
            </div>

            {/* Current Teaching Assignments Snippet */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#006FFF]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Current Teaching Assignments</h3>
                </div>
                <button
                  onClick={() => onOpenBatchAssignments(staff)}
                  className="text-xs font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                >
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {staff.assignments && staff.assignments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {staff.assignments.map((a) => {
                    const assignedSubs = staff.batchSubjects?.filter((bs) => bs.batchId === a.batch.id) || [];
                    return (
                      <div
                        key={a.id}
                        className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="font-bold text-xs text-[#0F172A]">{a.batch.name}</div>
                          <div className="text-[11px] text-[#94A3B8] mt-0.5">
                            Academic Year: {a.batch.academicYear}
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-[#F1F5F9]">
                          <span className="text-[10px] text-[#94A3B8] font-medium uppercase tracking-wider block mb-1">
                            Subjects Handled:
                          </span>
                          {assignedSubs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {assignedSubs.map((bs) => (
                                <span
                                  key={bs.id}
                                  className="text-[10px] font-semibold bg-white border border-[#E2E8F0] text-[#006FFF] px-2 py-0.5 rounded"
                                >
                                  {bs.subject.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-[#94A3B8] italic">All Subjects / General</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-[#94A3B8] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E2E8F0]">
                  No batch assignments configured yet.
                  <button
                    onClick={() => onOpenBatchAssignments(staff)}
                    className="block mx-auto mt-2 text-xs font-bold text-[#006FFF] underline"
                  >
                    Assign Batches Now
                  </button>
                </div>
              )}
            </div>

            {/* Qualifications Summary */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#006FFF]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Academic Qualifications</h3>
                </div>
                <button
                  onClick={() => setActiveTab('qualifications')}
                  className="text-xs font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                >
                  View Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {staff.qualifications && staff.qualifications.length > 0 ? (
                <div className="divide-y divide-[#EFEBE9]">
                  {staff.qualifications.map((q) => (
                    <div key={q.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#0F172A]">
                          {q.degree} {q.fieldOfStudy && `in ${q.fieldOfStudy}`}
                        </div>
                        <div className="text-[11px] text-[#64748B]">{q.institution}</div>
                      </div>
                      {q.yearOfCompletion && (
                        <span className="text-[11px] font-mono font-semibold text-[#94A3B8] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                          {q.yearOfCompletion}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#94A3B8] italic">No qualifications added yet.</div>
              )}
            </div>
          </div>

          {/* Column 3: Contact & Address Quick Glance */}
          <div className="space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#006FFF]" /> Contact Info
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Primary Phone</span>
                  <span className="font-semibold text-[#0F172A]">{staff.user.phone || 'Not provided'}</span>
                </div>
                {staff.altPhone && (
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Alternate Phone</span>
                    <span className="font-semibold text-[#0F172A]">{staff.altPhone}</span>
                  </div>
                )}
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Work Email (Login)</span>
                  <span className="font-semibold text-[#0F172A]">{staff.user.email}</span>
                </div>
                {staff.personalEmail && (
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Personal Email</span>
                    <span className="font-semibold text-[#0F172A]">{staff.personalEmail}</span>
                  </div>
                )}
                {staff.emergencyContactName && (
                  <div className="pt-2 border-t border-[#F1F5F9]">
                    <span className="text-[#94A3B8] text-[11px] block">Emergency Contact</span>
                    <span className="font-semibold text-[#0F172A] block">
                      {staff.emergencyContactName} ({staff.emergencyContactRelation || 'Contact'})
                    </span>
                    <span className="text-[#64748B]">{staff.emergencyContactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#006FFF]" /> Address Summary
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#94A3B8] text-[11px] font-medium block">Current Address</span>
                  {staff.currentAddressLine1 ? (
                    <p className="text-[#0F172A] mt-0.5 leading-relaxed">
                      {staff.currentAddressLine1}
                      {staff.currentAddressLine2 && `, ${staff.currentAddressLine2}`}
                      <br />
                      {staff.currentCity && `${staff.currentCity}, `}
                      {staff.currentState && `${staff.currentState} `}
                      {staff.currentPostalCode && `- ${staff.currentPostalCode}`}
                      {staff.currentCountry && `, ${staff.currentCountry}`}
                    </p>
                  ) : (
                    <span className="text-[#94A3B8] italic">Not provided</span>
                  )}
                </div>

                <div className="pt-2 border-t border-[#F1F5F9]">
                  <span className="text-[#94A3B8] text-[11px] font-medium block">Permanent Address</span>
                  {staff.sameAsCurrentAddress ? (
                    <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                      Same as current address
                    </span>
                  ) : staff.permanentAddressLine1 ? (
                    <p className="text-[#0F172A] mt-0.5 leading-relaxed">
                      {staff.permanentAddressLine1}
                      {staff.permanentAddressLine2 && `, ${staff.permanentAddressLine2}`}
                      <br />
                      {staff.permanentCity && `${staff.permanentCity}, `}
                      {staff.permanentState && `${staff.permanentState} `}
                      {staff.permanentPostalCode && `- ${staff.permanentPostalCode}`}
                      {staff.permanentCountry && `, ${staff.permanentCountry}`}
                    </p>
                  ) : (
                    <span className="text-[#94A3B8] italic">Not provided</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Personal Details */}
      {activeTab === 'personal' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F1F5F9]">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Personal & Contact Information</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Staff identity, contact numbers, and residential address details
              </p>
            </div>
            {!editingPersonal && (
              <button
                onClick={() => setEditingPersonal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Personal Details
              </button>
            )}
          </div>

          {personalError && (
            <div className="p-3 mb-6 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{personalError}</span>
            </div>
          )}

          {editingPersonal ? (
            <form onSubmit={handleSavePersonal} className="space-y-6">
              {/* Basic Details */}
              <div>
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Basic Identity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={personalForm.fullName}
                      onChange={(e) => setPersonalForm({ ...personalForm, fullName: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={personalForm.dob}
                      onChange={(e) => setPersonalForm({ ...personalForm, dob: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Gender</label>
                    <select
                      value={personalForm.gender}
                      onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Primary Phone
                    </label>
                    <input
                      type="tel"
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      value={personalForm.altPhone}
                      onChange={(e) => setPersonalForm({ ...personalForm, altPhone: e.target.value })}
                      placeholder="e.g. +91 9822233344"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Personal Email
                    </label>
                    <input
                      type="email"
                      value={personalForm.personalEmail}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, personalEmail: e.target.value })
                      }
                      placeholder="e.g. faculty@gmail.com"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={personalForm.emergencyContactName}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, emergencyContactName: e.target.value })
                      }
                      placeholder="e.g. Spouse / Parent"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={personalForm.emergencyContactRelation}
                      onChange={(e) =>
                        setPersonalForm({
                          ...personalForm,
                          emergencyContactRelation: e.target.value,
                        })
                      }
                      placeholder="e.g. Brother / Wife / Father"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={personalForm.emergencyContactPhone}
                      onChange={(e) =>
                        setPersonalForm({
                          ...personalForm,
                          emergencyContactPhone: e.target.value,
                        })
                      }
                      placeholder="Emergency contact phone"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Current Address */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Current Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={personalForm.currentAddressLine1}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, currentAddressLine1: e.target.value })
                      }
                      placeholder="House / Flat / Street address"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      value={personalForm.currentAddressLine2}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, currentAddressLine2: e.target.value })
                      }
                      placeholder="Apartment, suite, landmark"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">City</label>
                    <input
                      type="text"
                      value={personalForm.currentCity}
                      onChange={(e) => handleCurrentCityChange(e.target.value)}
                      placeholder="City"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">State</label>
                    <input
                      type="text"
                      value={personalForm.currentState}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, currentState: e.target.value })
                      }
                      placeholder="State"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={personalForm.currentPostalCode}
                      onChange={(e) => handleCurrentPostalCodeChange(e.target.value)}
                      placeholder="Postal code / PIN"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Country</label>
                    <input
                      type="text"
                      value={personalForm.currentCountry}
                      onChange={(e) =>
                        setPersonalForm({ ...personalForm, currentCountry: e.target.value })
                      }
                      placeholder="Country"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Permanent Address with "Same as Current" checkbox */}
              <div className="pt-4 border-t border-[#F1F5F9]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider">
                    Permanent Address
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#006FFF]">
                    <input
                      type="checkbox"
                      checked={personalForm.sameAsCurrentAddress}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPersonalForm({
                          ...personalForm,
                          sameAsCurrentAddress: checked,
                          permanentAddressLine1: checked
                            ? personalForm.currentAddressLine1
                            : personalForm.permanentAddressLine1,
                          permanentAddressLine2: checked
                            ? personalForm.currentAddressLine2
                            : personalForm.permanentAddressLine2,
                          permanentCity: checked
                            ? personalForm.currentCity
                            : personalForm.permanentCity,
                          permanentState: checked
                            ? personalForm.currentState
                            : personalForm.permanentState,
                          permanentPostalCode: checked
                            ? personalForm.currentPostalCode
                            : personalForm.permanentPostalCode,
                          permanentCountry: checked
                            ? personalForm.currentCountry
                            : personalForm.permanentCountry,
                        });
                      }}
                      className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#006FFF]/20"
                    />
                    <span>Same as current address</span>
                  </label>
                </div>

                {!personalForm.sameAsCurrentAddress && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                          Address Line 1
                        </label>
                        <input
                          type="text"
                          value={personalForm.permanentAddressLine1}
                          onChange={(e) =>
                            setPersonalForm({
                              ...personalForm,
                              permanentAddressLine1: e.target.value,
                            })
                          }
                          placeholder="Permanent house / street address"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                          Address Line 2 (Optional)
                        </label>
                        <input
                          type="text"
                          value={personalForm.permanentAddressLine2}
                          onChange={(e) =>
                            setPersonalForm({
                              ...personalForm,
                              permanentAddressLine2: e.target.value,
                            })
                          }
                          placeholder="Apartment, suite, landmark"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">City</label>
                        <input
                          type="text"
                          value={personalForm.permanentCity}
                          onChange={(e) => handlePermanentCityChange(e.target.value)}
                          placeholder="City"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">State</label>
                        <input
                          type="text"
                          value={personalForm.permanentState}
                          onChange={(e) =>
                            setPersonalForm({ ...personalForm, permanentState: e.target.value })
                          }
                          placeholder="State"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={personalForm.permanentPostalCode}
                          onChange={(e) => handlePermanentPostalCodeChange(e.target.value)}
                          placeholder="Postal code / PIN"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1">Country</label>
                        <input
                          type="text"
                          value={personalForm.permanentCountry}
                          onChange={(e) =>
                            setPersonalForm({ ...personalForm, permanentCountry: e.target.value })
                          }
                          placeholder="Country"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setEditingPersonal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={personalSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
                >
                  {personalSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{personalSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Basic Identity & Contacts
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Full Name</span>
                    <span className="font-bold text-[#0F172A] text-sm mt-0.5 block">
                      {staff.user.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Date of Birth</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.dob ? new Date(staff.dob).toLocaleDateString() : 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Gender</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.gender || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Primary Phone</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.user.phone || 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Alternate Phone</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.altPhone || 'Not provided'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Personal Email</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.personalEmail || 'Not provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F1F5F9]">
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Emergency Contact
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Contact Person</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.emergencyContactName || 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Relationship</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.emergencyContactRelation || 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[11px] block">Emergency Phone</span>
                    <span className="font-semibold text-[#0F172A] mt-0.5 block">
                      {staff.emergencyContactPhone || 'Not recorded'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F1F5F9]">
                <h4 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-3">
                  Address Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-4">
                    <span className="text-[11px] font-bold text-[#006FFF] block mb-1">
                      Current Residence
                    </span>
                    {staff.currentAddressLine1 ? (
                      <p className="text-[#0F172A] leading-relaxed">
                        {staff.currentAddressLine1}
                        {staff.currentAddressLine2 && `, ${staff.currentAddressLine2}`}
                        <br />
                        {staff.currentCity && `${staff.currentCity}, `}
                        {staff.currentState && `${staff.currentState} `}
                        {staff.currentPostalCode && `- ${staff.currentPostalCode}`}
                        {staff.currentCountry && `, ${staff.currentCountry}`}
                      </p>
                    ) : (
                      <span className="text-[#94A3B8] italic">No current address recorded</span>
                    )}
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-[#006FFF] block">
                        Permanent Address
                      </span>
                      {staff.sameAsCurrentAddress && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Same as current
                        </span>
                      )}
                    </div>
                    {staff.sameAsCurrentAddress ? (
                      <p className="text-[#0F172A] leading-relaxed">
                        {staff.currentAddressLine1}
                        {staff.currentAddressLine2 && `, ${staff.currentAddressLine2}`}
                        <br />
                        {staff.currentCity && `${staff.currentCity}, `}
                        {staff.currentState && `${staff.currentState} `}
                        {staff.currentPostalCode && `- ${staff.currentPostalCode}`}
                        {staff.currentCountry && `, ${staff.currentCountry}`}
                      </p>
                    ) : staff.permanentAddressLine1 ? (
                      <p className="text-[#0F172A] leading-relaxed">
                        {staff.permanentAddressLine1}
                        {staff.permanentAddressLine2 && `, ${staff.permanentAddressLine2}`}
                        <br />
                        {staff.permanentCity && `${staff.permanentCity}, `}
                        {staff.permanentState && `${staff.permanentState} `}
                        {staff.permanentPostalCode && `- ${staff.permanentPostalCode}`}
                        {staff.permanentCountry && `, ${staff.permanentCountry}`}
                      </p>
                    ) : (
                      <span className="text-[#94A3B8] italic">No permanent address recorded</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Employment Details */}
      {activeTab === 'employment' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F1F5F9]">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Employment & Institute Records</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Official role, department, tenure dates, and employment agreements
              </p>
            </div>
            {!editingEmployment && (
              <button
                onClick={() => setEditingEmployment(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Employment Details
              </button>
            )}
          </div>

          {employmentError && (
            <div className="p-3 mb-6 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{employmentError}</span>
            </div>
          )}

          {editingEmployment ? (
            <form onSubmit={handleSaveEmployment} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Employee Code *
                  </label>
                  <input
                    type="text"
                    value={employmentForm.employeeCode}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, employeeCode: e.target.value })
                    }
                    placeholder="e.g. APEX-EMP-001"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                  <span className="text-[10px] text-[#94A3B8] mt-1 block">
                    Unique identifier within this institute
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={employmentForm.designation}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, designation: e.target.value })
                    }
                    placeholder="e.g. Senior Physics Faculty"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={employmentForm.department}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, department: e.target.value })
                    }
                    placeholder="e.g. Science / Mathematics"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Employment Type
                  </label>
                  <select
                    value={employmentForm.employmentType}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, employmentType: e.target.value })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="VISITING">Visiting Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={employmentForm.joiningDate}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, joiningDate: e.target.value })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Probation End Date
                  </label>
                  <input
                    type="date"
                    value={employmentForm.probationEndDate}
                    onChange={(e) =>
                      setEmploymentForm({ ...employmentForm, probationEndDate: e.target.value })
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Work Location / Branch Campus
                </label>
                <input
                  type="text"
                  value={employmentForm.workLocation}
                  onChange={(e) =>
                    setEmploymentForm({ ...employmentForm, workLocation: e.target.value })
                  }
                  placeholder="e.g. Main Campus, Building A"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Employment Notes & Remarks
                </label>
                <textarea
                  rows={3}
                  value={employmentForm.employmentNotes}
                  onChange={(e) =>
                    setEmploymentForm({ ...employmentForm, employmentNotes: e.target.value })
                  }
                  placeholder="Internal administrative notes (confidential to Academic Admins)"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setEditingEmployment(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={employmentSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
                >
                  {employmentSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{employmentSaving ? 'Saving...' : 'Save Employment Details'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Employment Details View Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Employee Code</span>
                  <span className="font-mono font-bold text-[#006FFF] text-sm mt-0.5 inline-block bg-[#F8FAFC] px-2.5 py-1 rounded border border-[#E2E8F0]">
                    {staff.employeeCode || 'Not Assigned'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Designation</span>
                  <span className="font-bold text-[#0F172A] text-sm mt-0.5 block">
                    {staff.designation}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Department</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {staff.department || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Employment Type</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {staff.employmentType?.replace('_', ' ') || 'FULL TIME'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Joining Date</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {staff.joiningDate ? new Date(staff.joiningDate).toLocaleDateString() : 'Not recorded'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Probation End Date</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {staff.probationEndDate
                      ? new Date(staff.probationEndDate).toLocaleDateString()
                      : 'Completed / Not Applicable'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Work Location</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {staff.workLocation || 'Main Campus'}
                  </span>
                </div>
                <div>
                  <span className="text-[#94A3B8] text-[11px] block">Length of Service</span>
                  <span className="font-semibold text-[#0F172A] mt-0.5 block">
                    {calculateLengthOfService(staff.joiningDate)}
                  </span>
                </div>
              </div>

              {staff.employmentNotes && (
                <div className="pt-4 border-t border-[#F1F5F9]">
                  <span className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-wider block mb-1">
                    Administrative Remarks
                  </span>
                  <div className="p-3 bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl text-xs text-[#006FFF] whitespace-pre-wrap leading-relaxed">
                    {staff.employmentNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Qualifications & Experience */}
      {activeTab === 'qualifications' && (
        <div className="space-y-6">
          {/* Section A: Academic Qualifications */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Academic Qualifications</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Degrees, diplomas, and certifications earned by this staff member
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingQual(null);
                  setQualForm({
                    degree: '',
                    fieldOfStudy: '',
                    institution: '',
                    yearOfCompletion: '',
                    gradeScore: '',
                  });
                  setShowQualModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Qualification
              </button>
            </div>

            {staff.qualifications && staff.qualifications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC]">
                      <th className="py-2.5 px-3 font-bold">Degree / Diploma</th>
                      <th className="py-2.5 px-3 font-bold">Field / Specialization</th>
                      <th className="py-2.5 px-3 font-bold">Institution / University</th>
                      <th className="py-2.5 px-3 font-bold">Year</th>
                      <th className="py-2.5 px-3 font-bold">Grade / Score</th>
                      <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    {staff.qualifications.map((q) => (
                      <tr key={q.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-3 px-3 font-bold text-[#0F172A]">{q.degree}</td>
                        <td className="py-3 px-3 text-[#475569]">{q.fieldOfStudy || '—'}</td>
                        <td className="py-3 px-3 text-[#475569]">{q.institution}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-[#94A3B8]">
                          {q.yearOfCompletion || '—'}
                        </td>
                        <td className="py-3 px-3 text-[#475569]">{q.gradeScore || '—'}</td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingQual(q);
                                setQualForm({
                                  degree: q.degree,
                                  fieldOfStudy: q.fieldOfStudy || '',
                                  institution: q.institution,
                                  yearOfCompletion: q.yearOfCompletion ? String(q.yearOfCompletion) : '',
                                  gradeScore: q.gradeScore || '',
                                });
                                setShowQualModal(true);
                              }}
                              className="p-1 hover:bg-[#F8FAFC] rounded text-[#94A3B8] hover:text-[#006FFF]"
                              title="Edit qualification"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQualification(q.id)}
                              className="p-1 hover:bg-rose-50 rounded text-[#94A3B8] hover:text-rose-600"
                              title="Delete qualification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#94A3B8] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E2E8F0]">
                No educational qualifications added yet.
              </div>
            )}
          </div>

          {/* Section B: Teaching & Professional Experience */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Teaching & Professional Experience
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Chronological employment history, past institutes, and subject competencies
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingExp(null);
                  setExpForm({
                    institution: '',
                    designation: '',
                    subjects: '',
                    totalYears: '',
                    startDate: '',
                    endDate: '',
                    isCurrent: false,
                    notes: '',
                  });
                  setShowExpModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            </div>

            {staff.experiences && staff.experiences.length > 0 ? (
              <div className="space-y-3">
                {staff.experiences.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-4 bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#0F172A]">{exp.designation}</span>
                        <span className="text-xs text-[#64748B]">at</span>
                        <span className="font-semibold text-xs text-[#006FFF]">{exp.institution}</span>
                        {exp.isCurrent && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                            Current Role
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-x-3">
                        {exp.subjects && (
                          <span>
                            Subjects: <strong>{exp.subjects}</strong>
                          </span>
                        )}
                        {exp.totalYears && (
                          <span>
                            Total: <strong>{exp.totalYears} year(s)</strong>
                          </span>
                        )}
                        {(exp.startDate || exp.endDate) && (
                          <span className="text-[#94A3B8]">
                            ({exp.startDate ? new Date(exp.startDate).toLocaleDateString() : '—'} to{' '}
                            {exp.isCurrent
                              ? 'Present'
                              : exp.endDate
                              ? new Date(exp.endDate).toLocaleDateString()
                              : '—'}
                            )
                          </span>
                        )}
                      </div>

                      {exp.notes && (
                        <p className="text-xs text-[#94A3B8] italic pt-1">{exp.notes}</p>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingExp(exp);
                          setExpForm({
                            institution: exp.institution,
                            designation: exp.designation,
                            subjects: exp.subjects || '',
                            totalYears: exp.totalYears ? String(exp.totalYears) : '',
                            startDate: exp.startDate ? exp.startDate.split('T')[0] : '',
                            endDate: exp.endDate ? exp.endDate.split('T')[0] : '',
                            isCurrent: exp.isCurrent,
                            notes: exp.notes || '',
                          });
                          setShowExpModal(true);
                        }}
                        className="p-1 hover:bg-white rounded text-[#94A3B8] hover:text-[#006FFF]"
                        title="Edit experience"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteExperience(exp.id)}
                        className="p-1 hover:bg-rose-50 rounded text-[#94A3B8] hover:text-rose-600"
                        title="Delete experience"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#94A3B8] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E2E8F0]">
                No previous teaching experience records added yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Teaching Assignments */}
      {activeTab === 'assignments' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">
                Assigned Batches & Course Subjects
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Real-time active class assignments for this faculty member
              </p>
            </div>
            <button
              onClick={() => onOpenBatchAssignments(staff)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors shadow-sm"
            >
              <BookOpen className="w-4 h-4" /> Manage Batch Assignments
            </button>
          </div>

          {staff.assignments && staff.assignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.assignments.map((assignment) => {
                const fullBatch = batches.find((b) => b.id === assignment.batch.id);
                const assignedSubs =
                  staff.batchSubjects?.filter((bs) => bs.batchId === assignment.batch.id) || [];

                return (
                  <div
                    key={assignment.id}
                    className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-[#0F172A]">
                          {assignment.batch.name}
                        </span>
                        <span className="text-[10px] font-mono font-semibold bg-white border border-[#E2E8F0] text-[#006FFF] px-2 py-0.5 rounded">
                          {fullBatch?.code || 'BATCH'}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        Academic Year: <strong>{assignment.batch.academicYear}</strong>
                      </div>
                      {fullBatch?.schedule && (
                        <div className="text-xs text-[#94A3B8] flex items-center gap-1 mt-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>{fullBatch.schedule}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                      <span className="text-[11px] font-bold text-[#006FFF] block mb-2 uppercase tracking-wider">
                        Subjects Taught in this Batch
                      </span>
                      {assignedSubs.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedSubs.map((bs) => (
                            <span
                              key={bs.id}
                              className="text-xs font-semibold bg-white text-[#006FFF] border border-[#E2E8F0] px-2.5 py-1 rounded-lg"
                            >
                              {bs.subject.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-[#94A3B8] italic">
                          Assigned to entire batch / all subjects
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E2E8F0]">
              <BookOpen className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#006FFF]">No Batches Currently Assigned</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                Assign this faculty member to classes and curriculum subjects so they can manage attendance and grades.
              </p>
              <button
                onClick={() => onOpenBatchAssignments(staff)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
              >
                Assign Batches Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Documents */}
      {activeTab === 'documents' && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Staff Documents & Records</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Official certificates, ID verification, contracts, and uploaded credentials
              </p>
            </div>
            <button
              onClick={() => {
                setDocFile(null);
                setDocError(null);
                setDocForm({ documentType: 'ID_PROOF', displayName: '', expiryDate: '', notes: '' });
                setShowDocModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] transition-colors shadow-sm"
            >
              <UploadCloud className="w-4 h-4" /> Upload Document
            </button>
          </div>

          {staff.documents && staff.documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-[#E2E8F0] text-[#006FFF]">
                        {doc.documentType.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-[#94A3B8]">
                        {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-[#0F172A] mt-2 line-clamp-1">
                      {doc.displayName}
                    </h4>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 line-clamp-1">{doc.fileName}</p>

                    {doc.expiryDate && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-2 inline-block">
                        Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#F1F5F9]">
                    <a
                      href={`/api/staff/${staff.id}/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#006FFF] hover:text-[#0F172A]"
                    >
                      <Download className="w-3.5 h-3.5 text-[#94A3B8]" /> Download
                    </a>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E2E8F0]">
              <FileText className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#006FFF]">No Documents Uploaded</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                Upload Aadhaar/ID proof, degree certificates, joining contracts, or resumes.
              </p>
              <button
                onClick={() => setShowDocModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
              >
                Upload First Document
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Account & Access */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Account Status & Info */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#006FFF]" /> Account Status & Roles
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9]">
                <span className="text-[#94A3B8]">Login Email</span>
                <span className="font-bold text-[#0F172A]">{staff.user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9]">
                <span className="text-[#94A3B8]">System Role</span>
                <span className="font-mono font-bold text-[#006FFF] bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0]">
                  {staff.user.role}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9]">
                <span className="text-[#94A3B8]">Account Status</span>
                {staff.user.isActive ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Active & Permitted
                  </span>
                ) : (
                  <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-300">
                    Suspended / Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-[#F1F5F9]">
                <span className="text-[#94A3B8]">Last Login</span>
                <span className="text-[#64748B]">
                  {staff.user.lastLoginAt
                    ? new Date(staff.user.lastLoginAt).toLocaleString()
                    : 'Never logged in'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[#94A3B8]">Must Change Password</span>
                <span className="font-medium text-[#64748B]">
                  {staff.user.mustChangePassword ? 'Yes, upon next login' : 'No'}
                </span>
              </div>
            </div>

            {/* Quick Share Credentials Box */}
            <div className="pt-4 border-t border-[#F1F5F9]">
              <div className="p-4 bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#006FFF]">Staff Login Coordinates</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `Staff Login Portal\nEmail: ${staff.user.email}\nPortal URL: ${window.location.origin}`,
                        'coords'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF]"
                  >
                    {copiedKey === 'coords' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'coords' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-xs text-[#64748B] space-y-1">
                  <div>
                    Username: <span className="font-mono text-[#0F172A]">{staff.user.email}</span>
                  </div>
                  <div>
                    Institute Code:{' '}
                    <span className="font-mono text-[#0F172A]">{staff.employeeCode || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Reset Password Form */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Key className="w-5 h-5 text-[#006FFF]" /> Change Permanent Password
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Academic Admin can assign a new permanent password directly to this staff member. You can review and copy it below.
            </p>

            {resetMsg && (
              <div
                className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
                  resetMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
              >
                {resetMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resetMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#0F172A]">New Password</label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordInput(generateStrongPassword())}
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
                    placeholder="Type or auto-generate password"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-3 pr-10 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetInputPassword(!showResetInputPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#006FFF]"
                  >
                    {showResetInputPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading || !resetPasswordInput}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl transition shadow-md shadow-[#006FFF]/20 disabled:opacity-50"
              >
                {resetLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                <span>Update Permanent Password</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Qualification Modal */}
      {showQualModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h3 className="text-base font-bold text-[#0F172A]">
                {editingQual ? 'Edit Qualification' : 'Add Academic Qualification'}
              </h3>
              <button
                onClick={() => setShowQualModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQualification} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Degree / Diploma / Certification *
                </label>
                <input
                  type="text"
                  required
                  value={qualForm.degree}
                  onChange={(e) => setQualForm({ ...qualForm, degree: e.target.value })}
                  placeholder="e.g. M.Sc, B.Ed, Ph.D, B.Tech"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Field of Study / Specialization
                </label>
                <input
                  type="text"
                  value={qualForm.fieldOfStudy}
                  onChange={(e) => setQualForm({ ...qualForm, fieldOfStudy: e.target.value })}
                  placeholder="e.g. Physics, Applied Mathematics, Organic Chemistry"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Institution / University *
                </label>
                <input
                  type="text"
                  required
                  value={qualForm.institution}
                  onChange={(e) => setQualForm({ ...qualForm, institution: e.target.value })}
                  placeholder="e.g. University of Delhi"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Year of Completion
                  </label>
                  <input
                    type="number"
                    min="1950"
                    max="2035"
                    value={qualForm.yearOfCompletion}
                    onChange={(e) => setQualForm({ ...qualForm, yearOfCompletion: e.target.value })}
                    placeholder="e.g. 2018"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Grade / Percentage / CGPA
                  </label>
                  <input
                    type="text"
                    value={qualForm.gradeScore}
                    onChange={(e) => setQualForm({ ...qualForm, gradeScore: e.target.value })}
                    placeholder="e.g. 8.9 CGPA / 85%"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowQualModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={qualSaving}
                  className="px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
                >
                  {qualSaving ? 'Saving...' : editingQual ? 'Save Changes' : 'Add Qualification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Experience Modal */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h3 className="text-base font-bold text-[#0F172A]">
                {editingExp ? 'Edit Experience' : 'Add Teaching Experience'}
              </h3>
              <button
                onClick={() => setShowExpModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExperience} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Institution / School / Organization *
                </label>
                <input
                  type="text"
                  required
                  value={expForm.institution}
                  onChange={(e) => setExpForm({ ...expForm, institution: e.target.value })}
                  placeholder="e.g. Apex Coaching Institute"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Designation / Role *
                </label>
                <input
                  type="text"
                  required
                  value={expForm.designation}
                  onChange={(e) => setExpForm({ ...expForm, designation: e.target.value })}
                  placeholder="e.g. Senior Faculty / Lecturer"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Subjects Taught
                  </label>
                  <input
                    type="text"
                    value={expForm.subjects}
                    onChange={(e) => setExpForm({ ...expForm, subjects: e.target.value })}
                    placeholder="e.g. Physics, Mechanics"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Total Duration (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={expForm.totalYears}
                    onChange={(e) => setExpForm({ ...expForm, totalYears: e.target.value })}
                    placeholder="e.g. 3.5"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isCurrentExp"
                  checked={expForm.isCurrent}
                  onChange={(e) => setExpForm({ ...expForm, isCurrent: e.target.checked })}
                  className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#006FFF]/20"
                />
                <label htmlFor="isCurrentExp" className="text-xs font-semibold text-[#006FFF]">
                  This is my current organization / concurrent role
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={expForm.startDate}
                    onChange={(e) => setExpForm({ ...expForm, startDate: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                {!expForm.isCurrent && (
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">End Date</label>
                    <input
                      type="date"
                      value={expForm.endDate}
                      onChange={(e) => setExpForm({ ...expForm, endDate: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Key Achievements / Notes
                </label>
                <textarea
                  rows={2}
                  value={expForm.notes}
                  onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                  placeholder="Additional remarks or responsibilities handled"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowExpModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSaving}
                  className="px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
                >
                  {expSaving ? 'Saving...' : editingExp ? 'Save Changes' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E2E8F0] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <h3 className="text-base font-bold text-[#0F172A]">Upload Staff Document</h3>
              <button
                onClick={() => setShowDocModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {docError && (
              <div className="p-3 my-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{docError}</span>
              </div>
            )}

            <form onSubmit={handleUploadDocument} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Document Type *
                </label>
                <select
                  value={docForm.documentType}
                  onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="ID_PROOF">Government ID Proof (Aadhaar/PAN/Passport)</option>
                  <option value="CERTIFICATE">Academic Degree / Certification</option>
                  <option value="RESUME">Resume / Curriculum Vitae</option>
                  <option value="CONTRACT">Employment Contract / Agreement</option>
                  <option value="RELIEVING_LETTER">Relieving / Experience Letter</option>
                  <option value="OTHER">Other Official Document</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Display Title (Optional)
                </label>
                <input
                  type="text"
                  value={docForm.displayName}
                  onChange={(e) => setDocForm({ ...docForm, displayName: e.target.value })}
                  placeholder="e.g. Master's Degree Certificate"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Choose File (PDF or Image, max 25MB) *
                </label>
                <input
                  type="file"
                  required
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#006FFF] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#006FFF] file:text-white hover:file:bg-[#0F172A] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Expiration Date (if any)
                  </label>
                  <input
                    type="date"
                    value={docForm.expiryDate}
                    onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Notes</label>
                  <input
                    type="text"
                    value={docForm.notes}
                    onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                    placeholder="Short description"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={docUploading || !docFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4] disabled:opacity-50"
                >
                  {docUploading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{docUploading ? 'Uploading...' : 'Upload File'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
