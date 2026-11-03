import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { apiFetch } from '../../services/api';
import { Batch, StaffMember } from '../../types';
import {
  X,
  User,
  Briefcase,
  GraduationCap,
  Key,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Building,
  Camera,
  Upload,
} from 'lucide-react';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (
    newStaff: StaffMember,
    credentials: {
      fullName: string;
      email: string;
      permanentPassword: string;
      employeeCode?: string;
      instituteCode?: string;
    }
  ) => void;
  batches?: Batch[];
  activeInstituteCode?: string;
}

function formatUserFriendlyError(rawError?: string | null): string {
  if (!rawError || typeof rawError !== 'string') {
    return 'Failed to create staff member. Please check your information and try again.';
  }

  // If already clean, single line without technical keywords
  if (
    !rawError.includes('\n') &&
    !rawError.includes('invocation') &&
    !rawError.includes('Prisma') &&
    !rawError.includes('Unknown argument') &&
    !rawError.includes('C:\\')
  ) {
    return rawError;
  }

  if (rawError.includes('phone') || rawError.includes('already exists')) {
    return 'A staff account with this phone number, email, or employee code already exists.';
  }

  if (rawError.includes('dob') || rawError.includes('Date')) {
    return 'Please check the Date of Birth or Joining Date format.';
  }

  return 'Unable to save staff profile. Please verify the entered details and try again.';
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeInstituteCode,
}) => {
  useBodyScrollLock(isOpen);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Basic Information & Photo
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Employment Details
  const [employeeCode, setEmployeeCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [workLocation, setWorkLocation] = useState('');

  // Step 3: Qualifications & Experience
  const [qualificationDegree, setQualificationDegree] = useState('');
  const [qualificationField, setQualificationField] = useState('');
  const [qualificationInstitution, setQualificationInstitution] = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  // Step 4: Account Provisioning
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate employee code on modal open
  const fetchNextCode = async () => {
    try {
      const res = await apiFetch('/staff/next-code');
      const code = res.data?.employeeCode || res.data?.nextCode;
      if (res.success && code) {
        setEmployeeCode(code);
      }
    } catch (e) {
      // Fallback
      if (activeInstituteCode) {
        setEmployeeCode(`${activeInstituteCode}-EMP-001`);
      }
    }
  };

  const generateStrongPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const rand = (str: string, len: number) =>
      Array.from({ length: len }, () => str[Math.floor(Math.random() * str.length)]).join('');
    return `Pass#${rand(chars, 3)}${rand(nums, 4)}`;
  };

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setFullName('');
      setPhone('');
      setPersonalEmail('');
      setDob('');
      setGender('');
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setDesignation('');
      setDepartment('');
      setEmploymentType('FULL_TIME');
      setJoiningDate(new Date().toISOString().split('T')[0]);
      setWorkLocation('');
      setQualificationDegree('');
      setQualificationField('');
      setQualificationInstitution('');
      setExperienceYears('');
      setLoginEmail('');
      setPassword(generateStrongPassword());
      fetchNextCode();
    }
  }, [isOpen]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Photograph file size must not exceed 5MB.');
        return;
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a valid image file (JPG, PNG, or WebP).');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sync login email from name/institute when step 1 progresses
  const handleProceedFromStep1 = () => {
    if (!fullName.trim()) {
      setError('Staff full name is required');
      return;
    }
    setError(null);
    if (!loginEmail) {
      const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const domain = activeInstituteCode
        ? `${activeInstituteCode.toLowerCase()}.edu`
        : 'digitalghuru.internal';
      setLoginEmail(`${cleanName}@${domain}`);
    }
    setStep(2);
  };

  const handleProceedFromStep2 = () => {
    if (!designation.trim()) {
      setError('Designation is required (e.g. Senior Mathematics Faculty)');
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleProceedFromStep3 = () => {
    setError(null);
    setStep(4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !designation.trim() || !loginEmail.trim() || !password.trim()) {
      setError('Please fill in all mandatory fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 1. If photo selected, upload photograph first
      let uploadedPhotoKey: string | null = null;
      if (photoFile) {
        try {
          const photoFormData = new FormData();
          photoFormData.append('photo', photoFile);
          const upRes = await apiFetch('/staff/upload-photo', {
            method: 'POST',
            body: photoFormData,
          });
          if (upRes.success && (upRes.data?.photoStorageKey || upRes.data?.key)) {
            uploadedPhotoKey = upRes.data.photoStorageKey || upRes.data.key;
          }
        } catch (photoErr: any) {
          console.warn('Pre-creation staff photo upload failed, continuing creation:', photoErr);
        }
      }

      // 2. Submit staff creation payload
      const payload = {
        fullName: fullName.trim(),
        email: loginEmail.trim().toLowerCase(),
        phone: phone.trim() || null,
        employeeCode: employeeCode.trim() || null,
        designation: designation.trim(),
        temporaryPassword: password,
        avatarUrl: uploadedPhotoKey,

        // Personal Details
        personalEmail: personalEmail.trim() || null,
        dob: dob || null,
        gender: gender || null,

        // Employment Details
        department: department.trim() || null,
        employmentType,
        joiningDate: joiningDate || null,
        workLocation: workLocation.trim() || null,
      };

      const res = await apiFetch('/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const staffObj = res.data?.staff;
      const staffId = staffObj?.id || res.data?.staffId;
      if (res.success && (staffObj || staffId)) {
        const createdStaff: StaffMember = staffObj || {
          id: staffId,
          instituteId: res.data?.institute?.id || '',
          userId: res.data?.user?.id || '',
          employeeCode: res.data?.employeeCode || employeeCode,
          designation,
          qualification: qualificationDegree || null,
          avatarUrl: uploadedPhotoKey,
          createdAt: new Date().toISOString(),
          user: res.data?.user || {
            id: res.data?.user?.id || '',
            fullName,
            email: loginEmail,
            phone: phone || null,
            role: 'STAFF',
            isActive: true,
            mustChangePassword: false,
          },
        };

        if (uploadedPhotoKey) {
          createdStaff.avatarUrl = uploadedPhotoKey;
        }

        // If qualification details provided, save them
        if (qualificationDegree.trim() && qualificationInstitution.trim()) {
          try {
            await apiFetch(`/staff/${createdStaff.id}/qualifications`, {
              method: 'POST',
              body: JSON.stringify({
                degree: qualificationDegree.trim(),
                fieldOfStudy: qualificationField.trim() || null,
                institution: qualificationInstitution.trim(),
              }),
            });
          } catch (e) {
            console.warn('Initial qualification save skipped', e);
          }
        }

        // If experiences provided, save them
        if (experienceYears.trim()) {
          try {
            await apiFetch(`/staff/${createdStaff.id}/experiences`, {
              method: 'POST',
              body: JSON.stringify({
                institution: 'Previous Institute',
                designation: designation.trim(),
                totalYears: parseFloat(experienceYears) || 0,
              }),
            });
          } catch (e) {
            console.warn('Initial experience save skipped', e);
          }
        }

        onSuccess(createdStaff, {
          fullName: createdStaff.user.fullName,
          email: createdStaff.user.email || loginEmail,
          permanentPassword: password,
          employeeCode: createdStaff.employeeCode || employeeCode,
          instituteCode: activeInstituteCode,
        });

        onClose();
      } else {
        setError(formatUserFriendlyError(res.error));
      }
    } catch (err: any) {
      setError(formatUserFriendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#E2E8F0] animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E2E8F0] text-[#64748B] text-[10px] font-bold uppercase tracking-wider mb-1.5">
              <User className="w-3 h-3 text-[#006FFF]" /> Step {step} of 4
            </div>
            <h2 className="text-xl font-extrabold text-[#0F172A]">
              Provision New Staff & Faculty
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Step-by-step profile onboarding and portal account provisioning
            </p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F8FAFC]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Progress (4 Steps) */}
        <div className="py-4">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Identity' },
              { num: 2, label: 'Employment' },
              { num: 3, label: 'Qualifications' },
              { num: 4, label: 'Account' },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === s.num
                        ? 'bg-[#006FFF] text-white ring-4 ring-[#8D6E63]/20 shadow-md'
                        : step > s.num
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]'
                    }`}
                  >
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span
                    className={`text-[10px] font-semibold mt-1.5 hidden sm:block ${
                      step === s.num ? 'text-[#006FFF]' : 'text-[#94A3B8]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 transition-colors ${
                      step > s.num ? 'bg-emerald-600' : 'bg-[#F1F5F9]'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start justify-between gap-2.5 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 text-xs p-0.5 rounded transition-colors"
              title="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Step 1: Basic Identity & Photograph */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Staff Photograph Upload Card */}
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E2E8F0] flex flex-col sm:flex-row items-center gap-4">
              <div className="relative shrink-0">
                {photoPreview ? (
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#8D6E63] shadow-xs bg-stone-100 flex items-center justify-center shrink-0">
                      <img
                        src={photoPreview}
                        alt="Staff Preview"
                        className="w-full h-full object-cover block"
                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 shadow-md transition-colors z-10"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#F1F5F9] text-[#94A3B8] border-2 border-dashed border-[#E2E8F0] flex flex-col items-center justify-center text-center p-2 shrink-0">
                    <Camera className="w-6 h-6 mb-1 text-[#94A3B8]" />
                    <span className="text-[10px] font-bold text-[#64748B]">Photo</span>
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <span className="text-xs font-bold text-[#0F172A]">
                    Staff Photograph <span className="text-[#94A3B8] font-normal">(Optional)</span>
                  </span>
                  {photoFile && (
                    <span className="hidden sm:inline-flex text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Photo attached
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Upload JPG, PNG or WebP portrait for staff directory and portal profile (Max 5MB)
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition inline-flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>{photoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </label>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs text-rose-700 hover:text-rose-800 font-semibold px-2 py-1"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Full Name *
              </label>
              <input
                type="text"
                autoFocus
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma / Prof. Anita Verma"
                className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Primary Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Personal Email (Optional)
                </label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="e.g. faculty.personal@gmail.com"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Employment Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#0F172A]">
                    Employee Code *
                  </label>
                  <button
                    type="button"
                    onClick={fetchNextCode}
                    className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="e.g. APEX-EMP-001"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Designation / Primary Role *
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Physics Faculty"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Academic Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Science / Mathematics"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Employment Type
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="VISITING">Visiting Faculty</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Joining Date
                </label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Work Location / Campus
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
                  <input
                    type="text"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="e.g. Main Campus / South Block"
                    className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Qualifications & Initial Experience */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Highest Degree / Qualification
              </label>
              <input
                type="text"
                value={qualificationDegree}
                onChange={(e) => setQualificationDegree(e.target.value)}
                placeholder="e.g. M.Sc, M.Phil, Ph.D, B.Ed"
                className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Field of Study / Specialization
                </label>
                <input
                  type="text"
                  value={qualificationField}
                  onChange={(e) => setQualificationField(e.target.value)}
                  placeholder="e.g. Theoretical Physics / Pure Mathematics"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  College / University
                </label>
                <input
                  type="text"
                  value={qualificationInstitution}
                  onChange={(e) => setQualificationInstitution(e.target.value)}
                  placeholder="e.g. University of Madras"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Prior Teaching Experience (Total Years)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="e.g. 5"
                className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
              <span className="text-[10px] text-[#94A3B8] mt-1 block">
                Additional qualifications, past jobs, and certificates can be added later in the staff profile.
              </span>
            </div>
          </div>
        )}

        {/* Step 4: Account Provisioning & Permanent Password */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl flex items-center gap-4">
              {photoPreview ? (
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#8D6E63] shadow-xs bg-stone-100 shrink-0">
                  <img
                    src={photoPreview}
                    alt="Staff Thumbnail"
                    className="w-full h-full object-cover block"
                    style={{ width: '56px', height: '56px', objectFit: 'cover' }}
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-[#006FFF] font-bold text-sm flex items-center justify-center border border-[#E2E8F0] shrink-0">
                  {fullName.slice(0, 2).toUpperCase() || 'ST'}
                </div>
              )}
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#94A3B8]">Name:</span>{' '}
                  <span className="font-semibold text-[#0F172A]">{fullName}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Code:</span>{' '}
                  <span className="font-mono font-bold text-[#0F172A]">{employeeCode}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Role:</span>{' '}
                  <span className="font-semibold text-[#0F172A]">{designation}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8]">Department:</span>{' '}
                  <span className="font-semibold text-[#0F172A]">{department || 'General'}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Portal Login Email *
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="faculty@institute.edu"
                className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
              <span className="text-[10px] text-[#94A3B8] mt-1 block">
                This will be the employee's username for web & mobile app login.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#0F172A]">
                  Permanent Login Password *
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateStrongPassword())}
                  className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Auto-generate
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Type or generate permanent password"
                  className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#006FFF]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-[#94A3B8] mt-1 block">
                Permanent password generated by admin. You will receive credentials to copy after creation.
              </span>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-[#F1F5F9] mt-6">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1) handleProceedFromStep1();
                else if (step === 2) handleProceedFromStep2();
                else if (step === 3) handleProceedFromStep3();
              }}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#006FFF]/20 transition-all"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#006FFF]/20 transition-all disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>Create Staff Member</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
