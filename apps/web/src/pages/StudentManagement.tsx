import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { apiFetch } from '../services/api';
import { Student, Batch, StudentStatus } from '../types';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { StudentAvatar } from '../components/StudentAvatar';
import { StudentDetailsModal } from '../components/StudentDetailsModal';
import {
  GraduationCap,
  Plus,
  Search,
  CheckCircle,
  UserCheck,
  X,
  Phone,
  Mail,
  Eye,
  EyeOff,
  User,
  Shield,
  Key,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Users,
  MoreVertical,
  AlertTriangle,
  Loader2,
  Layers,
  BookOpen,
  Pencil,
  Camera,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const StudentManagement: React.FC = () => {
  const { showToast } = useToast();
  const { user, activeInstitute } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [admitStep, setAdmitStep] = useState<1 | 2 | 3 | 4>(1);
  useBodyScrollLock(showAdmitModal);
  const [admitLoading, setAdmitLoading] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);
  const [showParentPassword, setShowParentPassword] = useState(false);
  const [matchedParent, setMatchedParent] = useState<{
    found: boolean;
    isStudent?: boolean;
    message?: string;
    user?: {
      id: string;
      fullName: string;
      phone: string;
      email: string;
      role: string;
    };
    children?: Array<{ name: string; admissionNumber: string; relation?: string }>;
  } | null>(null);
  const [checkingParent, setCheckingParent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Assign Batch & Subjects Modal State
  const [assignBatchStudent, setAssignBatchStudent] = useState<Student | null>(null);
  const [selectedAssignBatchId, setSelectedAssignBatchId] = useState<string>('');
  const [selectedAssignSubjectIds, setSelectedAssignSubjectIds] = useState<string[]>([]);
  const [assignBatchLoading, setAssignBatchLoading] = useState(false);
  const [assignBatchError, setAssignBatchError] = useState<string | null>(null);

  // Edit Student Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    studentPhone: '',
    studentEmail: '',
    dob: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    bloodGroup: '',
    notes: '',
    batchId: '',
    subjectIds: [] as string[],
    parentFullName: '',
    parentRelationship: 'FATHER' as 'FATHER' | 'MOTHER' | 'GUARDIAN',
    parentPhone: '',
    parentEmail: '',
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setOpenActionMenuId(null);
    if (openActionMenuId) {
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [openActionMenuId]);

  // View & Reset Student & Parent Credentials Modal State
  const [viewingStudentCreds, setViewingStudentCreds] = useState<any | null>(null);
  const [credsActiveTab, setCredsActiveTab] = useState<'student' | 'parent'>('student');
  const [showStudentExistingPassword, setShowStudentExistingPassword] = useState(false);
  const [showParentExistingPassword, setShowParentExistingPassword] = useState(false);
  const [resetStudentPasswordInput, setResetStudentPasswordInput] = useState('');
  const [resetParentPasswordInput, setResetParentPasswordInput] = useState('');
  const [showResetStudentInputPassword, setShowResetStudentInputPassword] = useState(true);
  const [showResetParentInputPassword, setShowResetParentInputPassword] = useState(true);
  const [credsResetLoading, setCredsResetLoading] = useState(false);
  const [credsResetError, setCredsResetError] = useState<string | null>(null);
  const [credsResetSuccess, setCredsResetSuccess] = useState<string | null>(null);
  const [copiedCredsKey, setCopiedCredsKey] = useState<string | null>(null);

  const formatKolkataDateTime = (dateString?: string | null) => {
    if (!dateString) return 'Not available';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Not available';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  };
  
  // Status Confirmation Modal State
  const [statusConfirm, setStatusConfirm] = useState<{
    isOpen: boolean;
    student: Student | null;
    newStatus: StudentStatus | null;
    loading: boolean;
  }>({
    isOpen: false,
    student: null,
    newStatus: null,
    loading: false,
  });

  const [prefixInfo, setPrefixInfo] = useState<{
    prefix: string;
    currentYear: number;
    previewFormat: string;
  } | null>(null);

  const [admittedSuccess, setAdmittedSuccess] = useState<{
    admissionNumber: string;
    name: string;
    instituteCode: string;
    studentCredentials?: {
      fullName: string;
      admissionNumber: string;
      identifier: string;
      email?: string | null;
      phone?: string | null;
      temporaryPassword?: string;
    };
    parentCredentials?: {
      fullName: string;
      studentName: string;
      identifier: string;
      phone?: string | null;
      email?: string | null;
      isExistingAccount?: boolean;
      temporaryPassword?: string;
    };
  } | null>(null);

  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showStudentCreatedPassword, setShowStudentCreatedPassword] = useState(false);
  const [showParentCreatedPassword, setShowParentCreatedPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Enroll Existing Student Modal State
  const [showEnrollExistingModal, setShowEnrollExistingModal] = useState(false);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');
  const [enrollSearchResults, setEnrollSearchResults] = useState<any[]>([]);
  const [enrollSearching, setEnrollSearching] = useState(false);
  const [selectedEnrollStudent, setSelectedEnrollStudent] = useState<any | null>(null);
  const [selectedEnrollBatchId, setSelectedEnrollBatchId] = useState<string>('');
  const [selectedEnrollSubjectIds, setSelectedEnrollSubjectIds] = useState<string[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  // Real-time collision detection during new student creation
  const [detectedCollision, setDetectedCollision] = useState<{
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    phone?: string;
    email?: string;
    activeEnrollments?: any[];
  } | null>(null);
  const [checkingCollision, setCheckingCollision] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyFormattedCredentials = (
    role: string,
    fullName: string,
    identifier: string,
    pass?: string,
    instCode?: string,
    key = 'all'
  ) => {
    const code = instCode || activeInstitute?.code || 'INST';
    const text = `Digital Guru ${role} Login & Password
--------------------------------------
Account Name: ${fullName}
Role: ${role}
Institute Code: ${code}
Login Identifier: ${identifier}
${pass ? `Initial Password: ${pass}\r\n` : 'Account: Linked to existing verified parent account\r\n'}Login Portal: ${window.location.origin}
--------------------------------------
Important: Please keep these credentials confidential. Password must be changed upon first login.`;

    copyToClipboard(text, key);
  };

  const generateStrongPassword = (prefix = 'Pass') => {
    const chars = 'abcdefghijkmnpqrstuvwxyz';
    const nums = '23456789';
    const rand = (str: string, len: number) =>
      Array.from({ length: len }, () => str[Math.floor(Math.random() * str.length)]).join('');
    return `${prefix}#${rand(chars, 3)}${rand(nums, 4)}`;
  };

  const copyCredsToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCredsKey(key);
    setTimeout(() => {
      setCopiedCredsKey(null);
    }, 2000);
  };

  const copyFormattedStudentCredentials = (
    fullName: string,
    admNum: string,
    pass: string,
    instCode?: string,
    key = 'student_all'
  ) => {
    const code = instCode || activeInstitute?.code || 'INST';
    const text = `Digital Guru Student Login & Password
--------------------------------------
Student: ${fullName}
Role: Student
Institute Code: ${code}
Admission No / Login ID: ${admNum}
Password: ${pass}
Login Portal: ${window.location.origin}
--------------------------------------
Please keep this login and password safe. Use your Admission Number and Institute Code to log in.`;

    copyCredsToClipboard(text, key);
  };

  const copyFormattedParentCredentials = (
    parentName: string,
    studentName: string,
    phoneOrEmail: string,
    pass: string,
    instCode?: string,
    key = 'parent_all'
  ) => {
    const code = instCode || activeInstitute?.code || 'INST';
    const text = `Digital Guru Parent Login & Password
--------------------------------------
Parent / Guardian: ${parentName}
Student: ${studentName}
Role: Parent
Institute Code: ${code}
Login Phone / Email: ${phoneOrEmail}
Password: ${pass}
Login Portal: ${window.location.origin}
--------------------------------------
Please keep this login and password safe. Use your registered mobile number and Institute Code to log in.`;

    copyCredsToClipboard(text, key);
  };

  const handleOpenLoginCredentialsModal = (student: any) => {
    setViewingStudentCreds(student);
    setCredsActiveTab('student');
    setShowStudentExistingPassword(true);
    setShowParentExistingPassword(true);
    setResetStudentPasswordInput('');
    setResetParentPasswordInput('');
    setCredsResetError(null);
    setCredsResetSuccess(null);
  };

  const handleResetStudentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingStudentCreds) return;
    try {
      setCredsResetLoading(true);
      setCredsResetError(null);
      setCredsResetSuccess(null);

      const res = await apiFetch(`/students/${viewingStudentCreds.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          password: resetStudentPasswordInput || undefined,
        }),
      });

      const newPass = res.data?.permanentPassword || res.data?.temporaryPassword || resetStudentPasswordInput;

      setViewingStudentCreds((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          credentialsOnRecord: {
            ...(prev.credentialsOnRecord || {}),
            studentPassword: newPass,
          },
        };
      });

      setResetStudentPasswordInput('');
      setShowStudentExistingPassword(true);
      setCredsResetSuccess('Student password updated successfully! The new password is now active.');
      showToast('Student password updated successfully', 'success');
      fetchData();
    } catch (err: any) {
      setCredsResetError(err.message || 'Failed to reset student password');
    } finally {
      setCredsResetLoading(false);
    }
  };

  const handleResetParentPassword = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!viewingStudentCreds) return;
    try {
      setCredsResetLoading(true);
      setCredsResetError(null);
      setCredsResetSuccess(null);

      const res = await apiFetch(`/parents/${parentId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          password: resetParentPasswordInput || undefined,
        }),
      });

      const newPass = res.data?.permanentPassword || res.data?.temporaryPassword || resetParentPasswordInput;

      setViewingStudentCreds((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          credentialsOnRecord: {
            ...(prev.credentialsOnRecord || {}),
            parentPassword: newPass,
          },
        };
      });

      setResetParentPasswordInput('');
      setShowParentExistingPassword(true);
      setCredsResetSuccess('Parent password updated successfully! The new password is now active.');
      showToast('Parent password updated successfully', 'success');
      fetchData();
    } catch (err: any) {
      setCredsResetError(err.message || 'Failed to reset parent password');
    } finally {
      setCredsResetLoading(false);
    }
  };

  const handleOpenAssignBatchModal = (student: Student) => {
    setAssignBatchStudent(student);
    const matchingEnrollment = (student.enrollments || []).find(
      (e: any) => e.isActive !== false && e.batch?.id && (batchFilter ? e.batch.id === batchFilter : batches.some((b) => b.id === e.batch.id))
    );
    const currentBatchId = matchingEnrollment?.batch?.id || student.enrollments?.find((e: any) => e.isActive !== false)?.batch?.id || student.enrollments?.[0]?.batch?.id || '';
    setSelectedAssignBatchId(currentBatchId);

    // Existing allocated subjects for this specific batch
    const existingSubjectIds = (student.enrollments || [])
      .filter((e: any) => e.isActive !== false && e.subjectId && (!currentBatchId || e.batchId === currentBatchId))
      .map((e: any) => e.subjectId) || [];
    setSelectedAssignSubjectIds(existingSubjectIds);
    setAssignBatchError(null);
  };

  const handleBatchChangeInModal = (newBatchId: string) => {
    setSelectedAssignBatchId(newBatchId);
    const targetBatch = batches.find((b) => b.id === newBatchId);
    const batchSubIds = (targetBatch?.batchSubjects || []).map((bs: any) => bs.subject?.id || bs.subjectId);
    setSelectedAssignSubjectIds(batchSubIds);
  };

  const toggleSubjectAllocation = (subjectId: string) => {
    setSelectedAssignSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const handleSaveBatchAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignBatchStudent) return;
    try {
      setAssignBatchLoading(true);
      setAssignBatchError(null);
      const res = await apiFetch(`/students/${assignBatchStudent.id}/batch-assignment`, {
        method: 'PUT',
        body: JSON.stringify({
          batchId: selectedAssignBatchId || null,
          subjectIds: selectedAssignSubjectIds,
        }),
      });

      if (res.success) {
        showToast(res.message || 'Batch and subjects assigned successfully', 'success');
        setAssignBatchStudent(null);
        fetchData();
      } else {
        setAssignBatchError(res.error || 'Failed to assign batch');
      }
    } catch (err: any) {
      setAssignBatchError(err.message || 'Failed to assign batch and subjects');
    } finally {
      setAssignBatchLoading(false);
    }
  };

  const handleOpenEditStudentModal = (student: Student) => {
    setEditingStudent(student);
    setEditPhotoFile(null);
    setEditPhotoPreview(student.photoUrl || null);
    setEditError(null);

    // Parse userNotes out of student.notes if it was stored as JSON credentials
    let userNotes = '';
    if (student.notes) {
      if (
        student.notes.startsWith('{') &&
        (student.notes.includes('studentPassword') ||
          student.notes.includes('parentPassword') ||
          student.notes.includes('userNotes'))
      ) {
        try {
          const parsed = JSON.parse(student.notes);
          userNotes = parsed.userNotes || '';
        } catch {
          userNotes = student.notes;
        }
      } else {
        userNotes = student.notes;
      }
    }

    // Format DOB to YYYY-MM-DD for date input
    let dobFormatted = '';
    if (student.dob) {
      try {
        const d = new Date(student.dob);
        if (!isNaN(d.getTime())) {
          dobFormatted = d.toISOString().split('T')[0];
        }
      } catch {}
    }

    // Select batch that matches current user's authorized batches, or the active filter, or the student's authorized enrollment
    const matchingEnrollment = (student.enrollments || []).find(
      (e: any) => e.isActive !== false && e.batch?.id && (batchFilter ? e.batch.id === batchFilter : batches.some((b) => b.id === e.batch.id))
    );
    const authorizedStudentBatchId = (student.enrollments || []).find(
      (e: any) => e.isActive !== false && batches.some((b) => b.id === e.batch?.id)
    )?.batch?.id;
    const currentBatchId = matchingEnrollment?.batch?.id || authorizedStudentBatchId || (batches.length === 1 ? batches[0].id : '') || student.enrollments?.[0]?.batch?.id || '';

    // Extract allocated subject IDs strictly for this batch
    const currentSubjectIds = (student.enrollments || [])
      .filter((e: any) => e.isActive !== false && e.subjectId && (!currentBatchId || e.batchId === currentBatchId))
      .map((e: any) => e.subjectId as string);

    // If no specific subject was allocated, default to all subjects in currentBatchId
    const targetBatch = batches.find((b) => b.id === currentBatchId);
    const finalSubjectIds = currentSubjectIds.length > 0
      ? currentSubjectIds
      : (targetBatch?.batchSubjects || []).map((bs: any) => bs.subject?.id || bs.subjectId);

    // Extract primary parent
    const primaryRel = student.parentRelations?.[0];
    const parentFullName = primaryRel?.parent?.user?.fullName || (primaryRel?.parent as any)?.fullName || '';
    const parentRel = ((primaryRel?.relation || (primaryRel as any)?.relationship || 'FATHER').toUpperCase()) as 'FATHER' | 'MOTHER' | 'GUARDIAN';
    const parentPhone = primaryRel?.parent?.user?.phone || (primaryRel?.parent as any)?.phone || '';
    const parentEmail = primaryRel?.parent?.user?.email || (primaryRel?.parent as any)?.email || '';

    setEditFormData({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      studentPhone: student.phone || student.user?.phone || '',
      studentEmail: student.user?.email || '',
      dob: dobFormatted,
      gender: (student.gender as any) || 'MALE',
      bloodGroup: student.bloodGroup || '',
      notes: userNotes,
      batchId: currentBatchId,
      subjectIds: finalSubjectIds,
      parentFullName,
      parentRelationship: parentRel,
      parentPhone,
      parentEmail,
    });
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setEditError('Photo file size must not exceed 5MB.');
        return;
      }
      setEditPhotoFile(file);
      setEditPhotoPreview(URL.createObjectURL(file));
      setEditError(null);
    }
  };

  const handleEditBatchChange = (newBatchId: string) => {
    const targetBatch = batches.find((b) => b.id === newBatchId);
    const subIds = targetBatch
      ? (targetBatch.batchSubjects || []).map((bs: any) => bs.subject?.id || bs.subjectId)
      : [];

    setEditFormData((prev) => ({
      ...prev,
      batchId: newBatchId,
      subjectIds: subIds,
    }));
  };

  const toggleEditSubject = (subjectId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(subjectId)
        ? prev.subjectIds.filter((id) => id !== subjectId)
        : [...prev.subjectIds, subjectId],
    }));
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      setEditLoading(true);
      setEditError(null);

      // If photo was changed, upload it first
      let updatedPhotoUrl = editingStudent.photoUrl || undefined;
      if (editPhotoFile) {
        const fd = new FormData();
        fd.append('photo', editPhotoFile);
        const photoRes = await apiFetch(`/students/${editingStudent.id}/photo`, {
          method: 'POST',
          body: fd,
        });
        if (photoRes.success) {
          updatedPhotoUrl = photoRes.data?.photoUrl;
        } else {
          setEditError(photoRes.error || 'Failed to upload photo');
          setEditLoading(false);
          return;
        }
      }

      const cleanDob = editFormData.dob && editFormData.dob.trim() ? new Date(editFormData.dob).toISOString() : null;
      const cleanStudentEmail = editFormData.studentEmail.trim() || null;
      const cleanStudentPhone = editFormData.studentPhone.trim() || null;
      const cleanParentEmail = editFormData.parentEmail.trim() || null;
      const cleanParentPhone = editFormData.parentPhone.trim() || null;
      const cleanParentName = editFormData.parentFullName.trim() || null;

      const payload = {
        firstName: editFormData.firstName.trim(),
        lastName: editFormData.lastName.trim(),
        studentPhone: cleanStudentPhone,
        studentEmail: cleanStudentEmail,
        dob: cleanDob,
        gender: editFormData.gender,
        bloodGroup: editFormData.bloodGroup?.trim() || null,
        notes: editFormData.notes.trim() || null,
        photoUrl: updatedPhotoUrl || null,
        batchId: editFormData.batchId || null,
        subjectIds: editFormData.subjectIds,
        parentFullName: cleanParentName,
        parentRelationship: editFormData.parentRelationship,
        parentPhone: cleanParentPhone,
        parentEmail: cleanParentEmail,
      };

      const res = await apiFetch(`/students/${editingStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast('Student details updated successfully', 'success');
        setEditingStudent(null);
        fetchData();
      } else {
        setEditError(res.error || 'Failed to update student');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error updating student details');
    } finally {
      setEditLoading(false);
    }
  };

  // Form State
  const initialFormData = {
    firstName: '',
    lastName: '',
    studentPhone: '',
    studentEmail: '',
    studentInitialPassword: '',
    dob: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    bloodGroup: '',
    batchId: '',
    subjectIds: [] as string[],
    notes: '',
    // Parent/Guardian fields
    parentFullName: '',
    parentRelationship: 'FATHER' as 'FATHER' | 'MOTHER' | 'GUARDIAN',
    parentPhone: '',
    parentEmail: '',
    parentInitialPassword: '',
    parentCanReceiveSms: true,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAdmitError('Photo file size must not exceed 5MB.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setAdmitError(null);
    }
  };

  const availableSubjectsForFilter = useMemo(() => {
    if (batchFilter) {
      const b = batches.find((x) => x.id === batchFilter);
      return b?.batchSubjects || [];
    }
    const map = new Map<string, any>();
    for (const b of batches) {
      for (const bs of b.batchSubjects || []) {
        if (!map.has(bs.subject.id)) {
          map.set(bs.subject.id, bs.subject);
        }
      }
    }
    return Array.from(map.values()).map((s) => ({ subject: s }));
  }, [batches, batchFilter]);

  // Debounce search input to avoid spamming the backend on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load batches once per institute context
  const loadBatches = async () => {
    try {
      const res = await apiFetch('/academics/batches');
      setBatches(res.data?.batches || []);
    } catch (err: any) {
      console.warn('[StudentManagement] Failed to load batches:', err.message);
    }
  };

  const requestSeq = useRef(0);

  const fetchData = async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      setFetchError(null);
      const query = new URLSearchParams({
        search: debouncedSearch.trim(),
        ...(statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(batchFilter ? { batchId: batchFilter } : {}),
        ...(subjectFilter ? { subjectId: subjectFilter } : {}),
      });

      const studentsRes = await apiFetch(`/students?${query.toString()}`, { skipCache: true });
      if (seq === requestSeq.current) {
        setStudents(studentsRes.data?.students || []);
      }
    } catch (err: any) {
      if (seq === requestSeq.current) {
        console.error(err);
        setFetchError(err.message || 'Failed to fetch student data');
        showToast(err.message || 'Failed to fetch student data', 'error');
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadBatches();
  }, [activeInstitute?.id]);

  useEffect(() => {
    fetchData();
  }, [debouncedSearch, statusFilter, batchFilter, subjectFilter, activeInstitute?.id]);

  useEffect(() => {
    if (showAdmitModal) {
      apiFetch(`/students/admission-prefix${formData.batchId ? `?batchId=${formData.batchId}` : ''}`)
        .then((res) => {
          if (res.success && res.data) {
            setPrefixInfo(res.data);
          }
        })
        .catch(() => {});
    }
  }, [showAdmitModal, formData.batchId]);

  // Debounced parent account lookup for sibling auto-linking
  useEffect(() => {
    if (!showAdmitModal) {
      setMatchedParent(null);
      setCheckingParent(false);
      return;
    }

    const phone = formData.parentPhone.trim();
    const email = formData.parentEmail.trim();

    const hasPhoneQuery = phone.length >= 10;
    const hasEmailQuery = email.length >= 5 && email.includes('@');

    if (!hasPhoneQuery && !hasEmailQuery) {
      setMatchedParent(null);
      setCheckingParent(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingParent(true);
        const queryParam = hasPhoneQuery ? phone : email;
        const res = await apiFetch(`/students/lookup-parent?query=${encodeURIComponent(queryParam)}`);
        if (res.success && res.data?.found) {
          setMatchedParent(res.data);
          if (res.data.user && !res.data.isStudent) {
            // Auto-populate parent details if not already typed
            setFormData((prev) => ({
              ...prev,
              parentFullName: prev.parentFullName || res.data.user.fullName || '',
              parentEmail: prev.parentEmail || res.data.user.email || '',
            }));
          }
        } else {
          setMatchedParent(null);
        }
      } catch (err) {
        console.warn('Failed to lookup parent', err);
        setMatchedParent(null);
      } finally {
        setCheckingParent(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.parentPhone, formData.parentEmail, showAdmitModal]);

  // Debounced student lookup for collision detection during new student admission
  useEffect(() => {
    if (!showAdmitModal) {
      setDetectedCollision(null);
      setCheckingCollision(false);
      return;
    }

    const phone = formData.studentPhone.trim();
    const email = formData.studentEmail.trim();

    if (phone.length < 10 && (!email || !email.includes('@'))) {
      setDetectedCollision(null);
      setCheckingCollision(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingCollision(true);
        const query = phone.length >= 10 ? phone : email;
        const res = await apiFetch(`/students/lookup?search=${encodeURIComponent(query)}`);
        if (res.success && res.data?.students?.length > 0) {
          const match = res.data.students[0];
          setDetectedCollision(match);
        } else {
          setDetectedCollision(null);
        }
      } catch (err) {
        setDetectedCollision(null);
      } finally {
        setCheckingCollision(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.studentPhone, formData.studentEmail, showAdmitModal]);

  const availableEnrollSubjects = useMemo(() => {
    if (!selectedEnrollBatchId) return [];
    const b = batches.find((x) => x.id === selectedEnrollBatchId);
    return b?.batchSubjects || [];
  }, [batches, selectedEnrollBatchId]);

  const handleEnrollSearch = async (queryText: string) => {
    setEnrollSearchQuery(queryText);
    const q = queryText.trim();
    if (q.length < 2) {
      setEnrollSearchResults([]);
      return;
    }
    try {
      setEnrollSearching(true);
      const res = await apiFetch(`/students/lookup?search=${encodeURIComponent(q)}`);
      if (res.success && res.data?.students) {
        setEnrollSearchResults(res.data.students);
      } else {
        setEnrollSearchResults([]);
      }
    } catch (err) {
      console.warn('Failed to lookup students', err);
      setEnrollSearchResults([]);
    } finally {
      setEnrollSearching(false);
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollStudent) {
      setEnrollError('Please search and select a student to enroll.');
      return;
    }
    if (!selectedEnrollBatchId) {
      setEnrollError('Please select a batch.');
      return;
    }

    setEnrollLoading(true);
    setEnrollError(null);
    try {
      const res = await apiFetch(`/students/${selectedEnrollStudent.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedEnrollBatchId,
          subjectIds: selectedEnrollSubjectIds,
        }),
      });

      if (res.duplicate) {
        showToast(res.message, 'info');
      } else {
        showToast(res.message || 'Student enrolled successfully!', 'success');
      }

      setShowEnrollExistingModal(false);
      setSelectedEnrollStudent(null);
      setSelectedEnrollBatchId('');
      setSelectedEnrollSubjectIds([]);
      setEnrollSearchQuery('');
      setEnrollSearchResults([]);
      fetchData();
    } catch (err: any) {
      setEnrollError(err.message || 'Failed to enroll student');
      showToast(err.message || 'Failed to enroll student', 'error');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleProceedFromAdmitStep1 = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setAdmitError('Student first name and last name are required.');
      return;
    }
    setAdmitError(null);
    setAdmitStep(2);
  };

  const handleProceedFromAdmitStep2 = () => {
    setAdmitError(null);
    setAdmitStep(3);
  };

  const handleProceedFromAdmitStep3 = () => {
    if (!formData.parentFullName.trim()) {
      setAdmitError('Parent/Guardian full name is required.');
      return;
    }
    if (!formData.parentPhone.trim()) {
      setAdmitError('Parent/Guardian phone number is required.');
      return;
    }
    setAdmitError(null);
    setAdmitStep(4);
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmitError(null);

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setAdmitError('First name and last name are required.');
      return;
    }
    if (!formData.parentFullName.trim()) {
      setAdmitError('Parent/Guardian full name is required.');
      return;
    }
    if (!formData.parentPhone.trim()) {
      setAdmitError('Parent/Guardian phone number is required.');
      return;
    }

    setAdmitLoading(true);

    try {
      let uploadedPhotoKey: string | undefined = undefined;

      if (photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('photo', photoFile);
        const upRes = await apiFetch('/students/upload-photo', {
          method: 'POST',
          body: photoFormData,
        });
        if (upRes.success && upRes.data?.photoStorageKey) {
          uploadedPhotoKey = upRes.data.photoStorageKey;
        }
      }

      const res = await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          studentPhone: formData.studentPhone.trim() || undefined,
          studentEmail: formData.studentEmail.trim() || undefined,
          studentInitialPassword: formData.studentInitialPassword.trim() || undefined,
          dob: formData.dob || undefined,
          gender: formData.gender,
          bloodGroup: formData.bloodGroup.trim() || undefined,
          batchId: formData.batchId || undefined,
          subjectIds: formData.subjectIds.length > 0 ? formData.subjectIds : undefined,
          photoUrl: uploadedPhotoKey,
          notes: formData.notes.trim() || undefined,
          // Parent details
          parentFullName: formData.parentFullName.trim(),
          parentRelationship: formData.parentRelationship,
          parentPhone: formData.parentPhone.trim(),
          parentEmail: formData.parentEmail.trim() || undefined,
          parentInitialPassword: formData.parentInitialPassword.trim() || undefined,
          parentCanReceiveSms: formData.parentCanReceiveSms,
        }),
      });

      if (res.success) {
        setShowAdmitModal(false);
        const newStudent = res.data?.student;
        const generatedNum = res.data?.admissionNumber || newStudent?.admissionNumber || 'Assigned';
        const studentCreds = res.data?.studentCredentials;
        const parentCreds = res.data?.parentCredentials;

        setAdmittedSuccess({
          admissionNumber: generatedNum,
          name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
          instituteCode: activeInstitute?.code || 'INST',
          studentCredentials: studentCreds ? {
            fullName: studentCreds.fullName || `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            admissionNumber: studentCreds.admissionNumber || generatedNum,
            identifier: studentCreds.identifier || generatedNum,
            email: studentCreds.email,
            phone: studentCreds.phone,
            temporaryPassword: studentCreds.temporaryPassword,
          } : undefined,
          parentCredentials: parentCreds ? {
            fullName: parentCreds.fullName,
            studentName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            identifier: parentCreds.identifier,
            phone: parentCreds.phone,
            email: parentCreds.email,
            isExistingAccount: parentCreds.isExistingAccount,
            temporaryPassword: parentCreds.temporaryPassword,
          } : undefined,
        });

        showToast(`Student admitted successfully with admission number ${generatedNum}.`, 'success');

        setFormData(initialFormData);
        fetchData();
      }
    } catch (err: any) {
      if (err.data?.isExistingStudent && err.data?.existingStudent) {
        setDetectedCollision(err.data.existingStudent);
      }
      const msg = err.data?.error || err.data?.message || err.message || 'Failed to admit student';
      setAdmitError(msg);
      showToast(msg, 'error');
    } finally {
      setAdmitLoading(false);
    }
  };

  const openStatusConfirm = (student: Student, newStatus: StudentStatus) => {
    setStatusConfirm({
      isOpen: true,
      student,
      newStatus,
      loading: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusConfirm.student || !statusConfirm.newStatus) return;

    setStatusConfirm((prev) => ({ ...prev, loading: true }));
    try {
      await apiFetch(`/students/${statusConfirm.student.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusConfirm.newStatus,
          reason: `Status changed to ${statusConfirm.newStatus} by staff`,
        }),
      });

      showToast(
        `${statusConfirm.student.firstName} ${statusConfirm.student.lastName} is now marked as ${statusConfirm.newStatus.replace('_', ' ')}.`,
        'success'
      );

      setStatusConfirm({ isOpen: false, student: null, newStatus: null, loading: false });
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error updating student academic status.', 'error');
      setStatusConfirm((prev) => ({ ...prev, loading: false }));
    }
  };

  const getStatusBadge = (status: StudentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>;
      case 'PASSED_OUT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">Passed Out</span>;
      case 'DISCONTINUED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">Discontinued</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Student Admissions & Management</h1>
          <p className="text-sm text-[#64748B] mt-1">Enrollment, student lifecycle, and academic batch tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setEnrollSearchQuery('');
              setEnrollSearchResults([]);
              setSelectedEnrollStudent(null);
              setSelectedEnrollBatchId('');
              setSelectedEnrollSubjectIds([]);
              setEnrollError(null);
              setShowEnrollExistingModal(true);
            }}
            className="inline-flex items-center gap-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0] text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all"
          >
            <UserCheck className="w-4 h-4 text-[#64748B]" /> Enroll Existing Student
          </button>
          {user?.role !== 'ACADEMIC_ADMIN' && (
            <button
              type="button"
              onClick={() => {
                setDetectedCollision(null);
                setShowAdmitModal(true);
              }}
              className="inline-flex items-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-[#006FFF]/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Create New Student
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#F1F5F9] pb-4">
          {[
            { id: 'ALL', label: 'All Students' },
            { id: 'ACTIVE', label: 'Active Students' },
            { id: 'PASSED_OUT', label: 'Passed Out' },
            { id: 'DISCONTINUED', label: 'Discontinued' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? 'bg-[#006FFF] text-white shadow-md font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Batch dropdown */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, roll no, admission no..."
              className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748B] font-semibold">Batch:</span>
              <select
                value={batchFilter}
                onChange={(e) => {
                  setBatchFilter(e.target.value);
                  setSubjectFilter('');
                }}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              >
                <option value="">All Authorized Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.academicYear})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#64748B] font-semibold">Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              >
                <option value="">All Subjects</option>
                {availableSubjectsForFilter.map((bs: any) => (
                  <option key={bs.subject.id} value={bs.subject.id}>
                    {bs.subject.name} {bs.subject.code ? `(${bs.subject.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Students Table - No Horizontal Scroll, Responsive 3-Dots Actions */}
        <div className="w-full">
          <table className="w-full text-left text-xs divide-y divide-[#EFEBE9] table-auto">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC] uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 font-bold">Student Name</th>
                <th className="py-3 px-3 font-bold">Admission No</th>
                <th className="py-3 px-3 font-bold">Allocated Subjects</th>
                <th className="py-3 px-3 font-bold">Batch</th>
                <th className="py-3 px-3 font-bold">Linked Guardians</th>
                <th className="py-3 px-2 font-bold text-center">Status</th>
                <th className="py-3 px-3 font-bold text-right w-14">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE9]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                      <span>Loading student directory...</span>
                    </div>
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <p className="text-red-700 text-sm font-semibold">{fetchError}</p>
                    <button
                      onClick={() => setDebouncedSearch((s) => s)}
                      className="mt-3 px-3 py-1 bg-[#006FFF] text-white text-xs rounded-lg hover:bg-[#0058D4]"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748B]">No student records match the filters.</td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const isBottomRow = index >= students.length - 2 && students.length > 2;
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-[#FFFFFF] transition-colors cursor-pointer group"
                    >
                      <td
                        className="py-3 px-3.5 font-bold text-[#0F172A] text-xs group-hover:text-[#006FFF]"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <div className="flex items-center gap-2.5">
                          <StudentAvatar
                            studentId={student.id}
                            photoUrl={student.photoUrl}
                            name={`${student.firstName} ${student.lastName}`}
                            size="sm"
                          />
                          <span className="font-bold text-[#0F172A] truncate">{student.firstName} {student.lastName}</span>
                          <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">View</span>
                        </div>
                      </td>
                      <td
                        className="py-3 px-3 font-mono font-semibold text-[#006FFF]"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <span className="bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded text-xs whitespace-nowrap inline-block">
                          {student.admissionNumber}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 text-[#475569]"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <div
                          className="truncate max-w-[150px]"
                          title={student.enrollments?.filter((e: any) => e.subject).map((e: any) => e.subject.name).join(', ') || 'General Curriculum'}
                        >
                          {student.enrollments?.filter((e: any) => e.subject).map((e: any) => e.subject.name).join(', ') || (
                            <span className="text-[#94A3B8] italic">General Curriculum</span>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3 px-3 text-[#475569]"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
                          {(() => {
                            const activeBatchList = (student.enrollments || [])
                              .filter((e: any) => e.isActive !== false && e.batch?.name)
                              .filter((e: any) => {
                                if (batches.length > 0) {
                                  return batches.some((b) => b.id === e.batch?.id || b.id === e.batchId);
                                }
                                return true;
                              });
                            const uniqueBatches = Array.from(
                              new Map(activeBatchList.map((e: any) => [e.batch.id, e.batch.name])).entries()
                            );

                            if (uniqueBatches.length > 0) {
                              return uniqueBatches.map(([bId, bName]) => {
                                const isUserBatch = batches.some((b) => b.id === bId);
                                return (
                                  <span
                                    key={bId}
                                    title={`Batch: ${bName}`}
                                    className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap shadow-xs ${
                                      isUserBatch
                                        ? 'bg-amber-100 text-[#0F172A] border-amber-300 font-bold'
                                        : 'bg-[#F8FAFC] text-[#006FFF] border-[#E2E8F0]'
                                    }`}
                                  >
                                    {bName}
                                  </span>
                                );
                              });
                            }

                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAssignBatchModal(student);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-semibold transition"
                                title="Assign to batch"
                              >
                                <Plus className="w-3 h-3" /> Assign Batch
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                      <td
                        className="py-3 px-3 text-[#475569]"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        {student.parentRelations && student.parentRelations.length > 0 ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F8FAFC] text-[#006FFF] text-[11px] border border-[#E2E8F0] truncate max-w-[170px]"
                            title={`${student.parentRelations[0].parent.user.fullName} (${student.parentRelations[0].relation})`}
                          >
                            <UserCheck className="w-3 h-3 text-sky-700 shrink-0" />
                            <span className="truncate">
                              {student.parentRelations[0].parent.user.fullName} ({student.parentRelations[0].relation})
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-800 text-[11px] italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">No guardian</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-2 text-center whitespace-nowrap"
                        onClick={() => setSelectedStudentId(student.id)}
                      >
                        <div className="inline-flex items-center justify-center">
                          {getStatusBadge(student.status)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right relative" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === student.id ? null : student.id);
                            }}
                            className={`p-1.5 rounded-lg border transition shadow-sm ${
                              openActionMenuId === student.id
                                ? 'bg-[#006FFF] text-white border-[#006FFF]'
                                : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                            }`}
                            title="Actions menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionMenuId === student.id && (
                            <div
                              className={`absolute right-0 ${
                                isBottomRow ? 'bottom-full mb-1' : 'top-full mt-1'
                              } w-48 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] py-1.5 z-50 text-xs animate-in fade-in zoom-in-95`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedStudentId(student.id);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#FFFFFF] text-[#0F172A] flex items-center gap-2.5 font-medium transition"
                              >
                                <Eye className="w-4 h-4 text-[#94A3B8] shrink-0" />
                                <span>View Profile</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleOpenEditStudentModal(student);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#FFFFFF] text-[#0F172A] flex items-center gap-2.5 font-medium transition"
                              >
                                <Pencil className="w-4 h-4 text-[#94A3B8] shrink-0" />
                                <span>Edit Student</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleOpenLoginCredentialsModal(student);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#FFFFFF] text-[#0F172A] flex items-center gap-2.5 font-medium transition"
                              >
                                <Key className="w-4 h-4 text-[#94A3B8] shrink-0" />
                                <span>Login & Password</span>
                              </button>
                              <div className="border-t border-[#F1F5F9] my-1" />
                              {student.status === 'ACTIVE' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      openStatusConfirm(student, 'PASSED_OUT');
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-purple-800 flex items-center gap-2.5 font-medium transition"
                                  >
                                    <GraduationCap className="w-4 h-4 text-purple-700 shrink-0" />
                                    <span>Mark Passed Out</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      openStatusConfirm(student, 'DISCONTINUED');
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 flex items-center gap-2.5 font-medium transition"
                                  >
                                    <X className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>Discontinue</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    openStatusConfirm(student, 'ACTIVE');
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-800 flex items-center gap-2.5 font-medium transition"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span>Reactivate Student</span>
                                </button>
                              )}
                            </div>
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

      {/* Admit Student Modal */}
      {showAdmitModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl text-[#0F172A] animate-in fade-in zoom-in-95 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#E2E8F0] text-[#64748B] text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#006FFF]" /> Step {admitStep} of 4
                </div>
                <h2 className="text-xl font-extrabold text-[#0F172A]">
                  New Student Admission
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Admit student, assign batch curriculum, and provision guardian credentials
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdmitModal(false);
                  setAdmitStep(1);
                  setAdmitError(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#F8FAFC] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wizard Step Progress (4 Steps) */}
            <div className="py-4">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, label: 'Student' },
                  { num: 2, label: 'Academics' },
                  { num: 3, label: 'Guardian' },
                  { num: 4, label: 'Credentials' },
                ].map((s, idx) => (
                  <React.Fragment key={s.num}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          admitStep === s.num
                            ? 'bg-[#006FFF] text-white ring-4 ring-[#8D6E63]/20 shadow-md'
                            : admitStep > s.num
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]'
                        }`}
                      >
                        {admitStep > s.num ? <Check className="w-4 h-4" /> : s.num}
                      </div>
                      <span
                        className={`text-[10px] font-semibold mt-1.5 hidden sm:block ${
                          admitStep === s.num ? 'text-[#006FFF]' : 'text-[#94A3B8]'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < 3 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 transition-colors ${
                          admitStep > s.num ? 'bg-emerald-600' : 'bg-[#F1F5F9]'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {admitError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2.5 font-medium shadow-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{admitError}</span>
              </div>
            )}

            {detectedCollision && (
              <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-sm text-amber-900 block">Existing Student Profile Found</span>
                    <p className="text-amber-800 leading-relaxed">
                      A student named <strong>{detectedCollision.fullName || `${detectedCollision.firstName} ${detectedCollision.lastName}`}</strong> (Admission No: <span className="font-mono font-bold">{detectedCollision.admissionNumber}</span>) is already registered in this institute.
                    </p>
                    {detectedCollision.activeEnrollments && detectedCollision.activeEnrollments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[10px] font-semibold text-amber-900">Enrolled In:</span>
                        {detectedCollision.activeEnrollments.map((enr: any, idx: number) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-white text-[#006FFF] border border-amber-200">
                            {enr.batchName}{enr.subjectName ? ` - ${enr.subjectName}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdmitModal(false);
                      setSelectedEnrollStudent(detectedCollision);
                      setSelectedEnrollBatchId('');
                      setSelectedEnrollSubjectIds([]);
                      setShowEnrollExistingModal(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-semibold text-xs shadow-sm transition inline-flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Enroll This Existing Student Instead
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetectedCollision(null)}
                    className="text-xs text-amber-800 hover:underline px-2 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAdmitSubmit} className="space-y-4">
              {/* STEP 1: Student Identity & Photo */}
              {admitStep === 1 && (
                <div className="space-y-4">
                  {/* Photo Upload Card */}
                  <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E2E8F0] flex items-center gap-4">
                    <div className="relative shrink-0">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-[#8D6E63] shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0] flex flex-col items-center justify-center text-[10px] font-semibold text-center p-1">
                          <User className="w-6 h-6 mb-0.5 text-[#94A3B8]" />
                          No Photo
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <span className="text-xs font-bold text-[#006FFF] block">Student Photograph (Optional)</span>
                      <p className="text-[11px] text-[#94A3B8]">
                        Upload JPG/PNG portrait or capture via camera (Max 5MB)
                      </p>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm transition inline-flex items-center gap-1.5">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="hidden"
                            onChange={handlePhotoSelect}
                          />
                          📷 {photoPreview ? 'Change Photo' : 'Select / Capture Photo'}
                        </label>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview(null);
                            }}
                            className="text-xs text-rose-700 hover:underline font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Admission Number
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={prefixInfo ? `${prefixInfo.previewFormat} (7-char scheme)` : 'Auto-generated on save'}
                          className="w-full bg-[#F1F5F9]/60 border border-[#E2E8F0] text-[#94A3B8] font-mono font-semibold text-xs rounded-xl px-3.5 py-2.5 cursor-not-allowed select-none"
                        />
                        <span className="absolute right-2.5 top-2.5 text-[10px] bg-[#D7CCC8]/60 text-[#006FFF] font-bold px-1.5 py-0.5 rounded">
                          AUTO
                        </span>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5 italic">
                        Sequential number auto-assigned by institute format
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Student Phone Number (Optional)
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          value={formData.studentPhone}
                          onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
                          placeholder="e.g. +91 9876543210"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">
                        Optional student's own mobile. If sharing guardian's phone, you can leave this blank.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="e.g. Aarav"
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="e.g. Sharma"
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Student Email (Optional)
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                        <input
                          type="email"
                          value={formData.studentEmail}
                          onChange={(e) => setFormData({ ...formData, studentEmail: e.target.value })}
                          placeholder="e.g. student@example.com"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Blood Group</label>
                      <input
                        type="text"
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value.toUpperCase() })}
                        placeholder="e.g. O+, B+, A-"
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] uppercase focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Academics & Batch Allocation */}
              {admitStep === 2 && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1.5">
                        Class Batch Allocation
                      </label>
                      <select
                        value={formData.batchId}
                        onChange={(e) => setFormData({ ...formData, batchId: e.target.value, subjectIds: [] })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      >
                        <option value="">Select Class Batch (Optional)</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.academicYear})</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-[#94A3B8] mt-1">
                        Assigning a batch now enables instant attendance tracking and syllabus scheduling.
                      </p>
                    </div>

                    {/* Batch Subject Selection (if batch selected and subjects exist) */}
                    {(() => {
                      const selectedBatch = batches.find((b) => b.id === formData.batchId);
                      const subjects = selectedBatch?.batchSubjects || [];
                      if (!formData.batchId) {
                        return (
                          <div className="p-3 bg-white border border-dashed border-[#E2E8F0] rounded-xl text-center text-xs text-[#94A3B8]">
                            Select a class batch above to view and allocate curriculum subjects.
                          </div>
                        );
                      }
                      if (subjects.length === 0) {
                        return (
                          <div className="p-3 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#94A3B8]">
                            No specific subjects configured for this batch yet. The student will be enrolled in the general batch curriculum.
                          </div>
                        );
                      }
                      return (
                        <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-[#006FFF]">
                              Select Subjects to Allocate
                            </label>
                            <span className="text-[10px] font-semibold text-[#94A3B8] bg-[#FAF8F5] px-2 py-0.5 rounded-full border border-[#E2E8F0]">
                              {formData.subjectIds.length} of {subjects.length} selected
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {subjects.map((bs: any) => {
                              const isSelected = formData.subjectIds.includes(bs.subject.id);
                              return (
                                <button
                                  key={bs.subject.id}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected
                                      ? formData.subjectIds.filter((id) => id !== bs.subject.id)
                                      : [...formData.subjectIds, bs.subject.id];
                                    setFormData({ ...formData, subjectIds: next });
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                                    isSelected
                                      ? 'bg-[#006FFF] text-white shadow-sm'
                                      : 'bg-[#FAF8F5] border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                  <span>{bs.subject.name} {bs.subject.code ? `(${bs.subject.code})` : ''}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Notes / Medical Info</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Optional remarks (e.g. allergies, emergency instructions, academic background)"
                      className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Parent / Guardian Details */}
              {admitStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Parent / Guardian Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formData.parentFullName}
                        onChange={(e) => setFormData({ ...formData, parentFullName: e.target.value })}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Relationship to Student *
                      </label>
                      <select
                        value={formData.parentRelationship}
                        onChange={(e) => setFormData({ ...formData, parentRelationship: e.target.value as any })}
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      >
                        <option value="FATHER">Father</option>
                        <option value="MOTHER">Mother</option>
                        <option value="GUARDIAN">Legal Guardian</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#006FFF]">
                          Parent Phone Number * (Login Identifier)
                        </label>
                        {checkingParent && (
                          <span className="text-[10px] text-[#94A3B8] flex items-center gap-1 font-medium">
                            <Loader2 className="w-3 h-3 animate-spin text-[#94A3B8]" /> Checking...
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          required
                          value={formData.parentPhone}
                          onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5 italic">
                        If parent already exists for a sibling, they are linked automatically.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                        Parent Email (Optional)
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                        <input
                          type="email"
                          value={formData.parentEmail}
                          onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                          placeholder="e.g. parent@example.com"
                          className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Existing Parent / Sibling Found Banner */}
                  {matchedParent?.found && !matchedParent.isStudent && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Existing Parent Account Found: {matchedParent.user?.fullName}</span>
                        <span className="text-[10px] font-semibold bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full ml-auto">
                          Auto-Linking Active
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        This student will be automatically linked to <strong>{matchedParent.user?.fullName}</strong> ({matchedParent.user?.phone || matchedParent.user?.email})
                        {matchedParent.children && matchedParent.children.length > 0 && (
                          <> as a sibling of <strong>{matchedParent.children.map(c => `${c.name} (${c.admissionNumber})`).join(', ')}</strong></>
                        )}.
                        The parent's current login credentials will remain unchanged.
                      </p>
                    </div>
                  )}

                  {/* Student Account Collision Warning */}
                  {matchedParent?.found && matchedParent.isStudent && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{matchedParent.message}</span>
                    </div>
                  )}

                  <div className="p-3.5 bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="parentCanReceiveSms"
                      checked={formData.parentCanReceiveSms}
                      onChange={(e) => setFormData({ ...formData, parentCanReceiveSms: e.target.checked })}
                      className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#006FFF]/20 w-4 h-4"
                    />
                    <label htmlFor="parentCanReceiveSms" className="text-xs text-[#006FFF] font-medium cursor-pointer select-none">
                      Consent to instant SMS / in-app attendance and exam notification alerts
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 4: Account Provisioning & Summary */}
              {admitStep === 4 && (
                <div className="space-y-4">
                  {/* Overview Card */}
                  <div className="p-4 bg-[#FAF8F5] border border-[#E2E8F0] rounded-2xl space-y-3">
                    <span className="text-xs font-bold text-[#006FFF] uppercase tracking-wider block">
                      Admission Summary
                    </span>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-[#94A3B8]">Student:</span>{' '}
                        <span className="font-semibold text-[#0F172A]">{formData.firstName} {formData.lastName}</span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8]">Batch:</span>{' '}
                        <span className="font-semibold text-[#0F172A]">
                          {batches.find(b => b.id === formData.batchId)?.name || 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8]">Parent:</span>{' '}
                        <span className="font-semibold text-[#0F172A]">{formData.parentFullName} ({formData.parentRelationship})</span>
                      </div>
                      <div>
                        <span className="text-[#94A3B8]">Parent Phone:</span>{' '}
                        <span className="font-mono font-semibold text-[#0F172A]">{formData.parentPhone}</span>
                      </div>
                      {formData.subjectIds.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-[#94A3B8]">Allocated Subjects:</span>{' '}
                          <span className="font-semibold text-[#0F172A]">
                            {formData.subjectIds.length} subject(s) allocated
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Student Initial Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#006FFF]">
                        Initial Student Password (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, studentInitialPassword: generateStrongPassword('Stud') })}
                        className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> Auto-generate
                      </button>
                    </div>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                      <input
                        type={showStudentPassword ? 'text' : 'password'}
                        value={formData.studentInitialPassword}
                        onChange={(e) => setFormData({ ...formData, studentInitialPassword: e.target.value })}
                        placeholder="Leave blank to auto-generate password"
                        className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-10 py-2.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentPassword(!showStudentPassword)}
                        className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#006FFF]"
                      >
                        {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] mt-1 block">
                      Used for student portal login. Auto-generated by system if left blank.
                    </span>
                  </div>

                  {/* Parent Initial Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-[#006FFF]">
                        Initial Parent Password
                      </label>
                      {!matchedParent?.found && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, parentInitialPassword: generateStrongPassword('Parent') })}
                          className="text-[11px] font-semibold text-[#94A3B8] hover:text-[#006FFF] flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Auto-generate
                        </button>
                      )}
                    </div>
                    {matchedParent?.found && !matchedParent.isStudent ? (
                      <div className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#006FFF] flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-[11px]">
                          Existing login account is active for this guardian. Password will remain unchanged.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Key className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3.5 top-3" />
                          <input
                            type={showParentPassword ? 'text' : 'password'}
                            value={formData.parentInitialPassword}
                            onChange={(e) => setFormData({ ...formData, parentInitialPassword: e.target.value })}
                            placeholder="Leave blank to auto-generate password"
                            className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-10 py-2.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowParentPassword(!showParentPassword)}
                            className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#006FFF]"
                          >
                            {showParentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <span className="text-[10px] text-[#94A3B8] mt-1 block">
                          Used for parent mobile login. Auto-generated by system if left blank.
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Navigation Buttons */}
              <div className="flex items-center justify-between pt-5 border-t border-[#F1F5F9] mt-6">
                {admitStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAdmitError(null);
                      setAdmitStep((prev) => (prev - 1) as any);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdmitModal(false);
                      setAdmitStep(1);
                      setAdmitError(null);
                    }}
                    className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                  >
                    Cancel
                  </button>
                )}

                {admitStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (admitStep === 1) handleProceedFromAdmitStep1();
                      else if (admitStep === 2) handleProceedFromAdmitStep2();
                      else if (admitStep === 3) handleProceedFromAdmitStep3();
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#006FFF]/20 transition-all"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={admitLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#006FFF]/20 transition-all disabled:opacity-50"
                  >
                    {admitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Complete Admission</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Enroll Existing Student Modal */}
      {showEnrollExistingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#006FFF]" /> Enroll Existing Student
                </h2>
                <p className="text-xs text-[#64748B]">
                  Allocate an existing student to an authorized batch and subject(s) without duplicating accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEnrollExistingModal(false);
                  setSelectedEnrollStudent(null);
                  setEnrollError(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {enrollError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                {enrollError}
              </div>
            )}

            <form onSubmit={handleEnrollSubmit} className="space-y-4 mt-4">
              {/* Step 1: Search & Select Student */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#006FFF]">
                  1. Find Existing Student
                </label>
                {!selectedEnrollStudent ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={enrollSearchQuery}
                        onChange={(e) => handleEnrollSearch(e.target.value)}
                        placeholder="Search by name, admission no, or phone..."
                        className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                      {enrollSearching && (
                        <Loader2 className="w-4 h-4 text-[#94A3B8] animate-spin absolute right-3 top-2.5" />
                      )}
                    </div>

                    {enrollSearchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1.5 border border-[#F1F5F9] p-2 rounded-2xl bg-[#FFFFFF]">
                        {enrollSearchResults.map((stud) => (
                          <div
                            key={stud.id}
                            onClick={() => {
                              setSelectedEnrollStudent(stud);
                              setEnrollError(null);
                            }}
                            className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#8D6E63] hover:shadow-xs cursor-pointer transition flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-[#0F172A] flex items-center gap-2">
                                <span>{stud.fullName}</span>
                                <span className="font-mono text-[10px] bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                  {stud.admissionNumber}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#64748B] mt-0.5">
                                {stud.phone && <span>Phone: {stud.phone}</span>}
                                {stud.email && <span className="ml-2">Email: {stud.email}</span>}
                              </div>
                              {stud.activeEnrollments && stud.activeEnrollments.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {stud.activeEnrollments.map((enr: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#F1F5F9] text-[#006FFF]"
                                    >
                                      {enr.batchName}{enr.subjectName ? ` - ${enr.subjectName}` : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="px-2.5 py-1 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white text-[11px] font-semibold shrink-0"
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {enrollSearchQuery.trim().length >= 2 && !enrollSearching && enrollSearchResults.length === 0 && (
                      <p className="text-xs text-[#94A3B8] italic p-2">
                        No students found matching "{enrollSearchQuery}".
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-emerald-950 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>{selectedEnrollStudent.fullName || `${selectedEnrollStudent.firstName} ${selectedEnrollStudent.lastName}`}</span>
                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300">
                          {selectedEnrollStudent.admissionNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-1">
                        {selectedEnrollStudent.phone ? `Phone: ${selectedEnrollStudent.phone}` : ''}
                      </p>
                      {selectedEnrollStudent.activeEnrollments && selectedEnrollStudent.activeEnrollments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[10px] font-semibold text-emerald-900 mr-1">Current Enrollments:</span>
                          {selectedEnrollStudent.activeEnrollments.map((enr: any, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-white text-[#006FFF] border border-emerald-200">
                              {enr.batchName}{enr.subjectName ? ` • ${enr.subjectName}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEnrollStudent(null)}
                      className="text-xs text-emerald-800 hover:text-emerald-950 underline font-semibold shrink-0 ml-3"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Select Batch & Subjects */}
              <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
                <label className="block text-xs font-semibold text-[#006FFF]">
                  2. Select Authorized Batch & Subjects
                </label>
                <div>
                  <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                    Select Batch <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={selectedEnrollBatchId}
                    onChange={(e) => {
                      setSelectedEnrollBatchId(e.target.value);
                      setSelectedEnrollSubjectIds([]);
                    }}
                    required
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="">-- Choose an authorized batch --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.academicYear ? `(${b.academicYear})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEnrollBatchId && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#64748B] mb-1.5">
                      Select Subject(s) to Enroll:
                    </label>
                    {availableEnrollSubjects.length === 0 ? (
                      <p className="text-xs text-[#94A3B8] italic p-2 bg-[#FFFFFF] rounded-xl border border-[#F1F5F9]">
                        Standard batch curriculum.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl">
                        {availableEnrollSubjects.map((bs: any) => {
                          const sid = bs.subject.id;
                          const isChecked = selectedEnrollSubjectIds.includes(sid);
                          return (
                            <label
                              key={sid}
                              className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                isChecked
                                  ? 'bg-white border-[#006FFF] shadow-2xs font-semibold'
                                  : 'bg-white/60 border-[#F1F5F9] text-[#64748B]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEnrollSubjectIds([...selectedEnrollSubjectIds, sid]);
                                  } else {
                                    setSelectedEnrollSubjectIds(selectedEnrollSubjectIds.filter((x) => x !== sid));
                                  }
                                }}
                                className="rounded text-[#006FFF] focus:ring-[#006FFF]/20"
                              />
                              <span className="truncate">{bs.subject.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollExistingModal(false);
                    setSelectedEnrollStudent(null);
                    setEnrollError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollLoading || !selectedEnrollStudent || !selectedEnrollBatchId}
                  className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md shadow-[#006FFF]/20 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {enrollLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {enrollLoading ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admission Success & Credentials Modal */}
      {admittedSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-2xl text-[#0F172A] space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-inner">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Student Admitted & Credentials Created
                  </h3>
                  <p className="text-xs text-[#94A3B8]">{admittedSuccess.name}</p>
                </div>
              </div>
              <button
                onClick={() => setAdmittedSuccess(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admission Number Highlight */}
            <div className="bg-[#FFFFFF] border-2 border-dashed border-[#8D6E63]/40 rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-[#94A3B8] uppercase block">
                  Official Admission Number
                </span>
                <span className="text-xl font-mono font-black text-[#006FFF] tracking-wider select-all">
                  {admittedSuccess.admissionNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(admittedSuccess.admissionNumber, 'admn_no')}
                className="px-2.5 py-1.5 rounded-xl bg-[#F1F5F9] hover:bg-[#D7CCC8] text-[#006FFF] transition flex items-center gap-1.5 text-xs font-semibold"
              >
                {copiedKey === 'admn_no' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'admn_no' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* SECTION 1: Student Login Credentials */}
            {admittedSuccess.studentCredentials && (
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-1.5 font-bold text-[#006FFF] uppercase tracking-wider text-[11px]">
                    <Key className="w-3.5 h-3.5" /> Student Login Credentials
                  </div>
                  <span className="text-[10px] font-semibold bg-white border border-[#E2E8F0] text-[#006FFF] px-2 py-0.5 rounded-md">
                    Role: Student
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#64748B]">Student Name:</span>
                    <span className="font-semibold text-[#0F172A]">{admittedSuccess.studentCredentials.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#64748B]">Institute Code:</span>
                    <span className="font-mono font-bold text-[#006FFF]">{admittedSuccess.instituteCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#64748B]">Login Username / ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded select-all">
                        {admittedSuccess.studentCredentials.identifier}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(admittedSuccess.studentCredentials!.identifier, 'st_id')}
                        className="text-[#94A3B8] hover:text-[#0F172A]"
                        title="Copy Login Identifier"
                      >
                        {copiedKey === 'st_id' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {admittedSuccess.studentCredentials.temporaryPassword && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[#64748B]">Initial Password:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded select-all">
                          {showStudentCreatedPassword
                            ? admittedSuccess.studentCredentials.temporaryPassword
                            : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowStudentCreatedPassword(!showStudentCreatedPassword)}
                          className="text-[#94A3B8] hover:text-[#0F172A]"
                        >
                          {showStudentCreatedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(admittedSuccess.studentCredentials!.temporaryPassword!, 'st_pass')}
                          className="text-[#94A3B8] hover:text-[#0F172A]"
                          title="Copy Password"
                        >
                          {copiedKey === 'st_pass' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[10px] text-[#94A3B8] italic">
                    Student must change temporary password upon initial login.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyFormattedCredentials(
                        'Student',
                        admittedSuccess.studentCredentials!.fullName,
                        admittedSuccess.studentCredentials!.identifier,
                        admittedSuccess.studentCredentials!.temporaryPassword,
                        admittedSuccess.instituteCode,
                        'copy_student_full'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#006FFF] hover:text-[#0F172A] bg-white border border-[#E2E8F0] px-2.5 py-1 rounded-lg"
                  >
                    {copiedKey === 'copy_student_full' ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'copy_student_full' ? 'Copied Student Login' : 'Copy Student Details'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 2: Parent Login Credentials */}
            {admittedSuccess.parentCredentials && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 uppercase tracking-wider text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-amber-800" /> Parent Portal Credentials
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                    admittedSuccess.parentCredentials.isExistingAccount
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-white text-amber-900 border-amber-300'
                  }`}>
                    {admittedSuccess.parentCredentials.isExistingAccount ? 'Existing Account Linked' : 'New Account'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-amber-900/80">Guardian Name:</span>
                    <span className="font-semibold text-[#0F172A]">{admittedSuccess.parentCredentials.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-amber-900/80">Linked Student:</span>
                    <span className="font-semibold text-[#0F172A]">{admittedSuccess.parentCredentials.studentName}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-amber-900/80">Login ID (Phone / Email):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#0F172A] bg-white border border-amber-200 px-2 py-0.5 rounded select-all">
                        {admittedSuccess.parentCredentials.identifier}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(admittedSuccess.parentCredentials!.identifier, 'pr_id')}
                        className="text-amber-800 hover:text-amber-950"
                        title="Copy Parent Login ID"
                      >
                        {copiedKey === 'pr_id' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {admittedSuccess.parentCredentials.isExistingAccount ? (
                    <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-[11px] flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>
                        Guardian already has an active account for a sibling. Existing login and password remain unchanged.
                      </span>
                    </div>
                  ) : admittedSuccess.parentCredentials.temporaryPassword ? (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-amber-900/80">Initial Password:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded select-all">
                          {showParentCreatedPassword
                            ? admittedSuccess.parentCredentials.temporaryPassword
                            : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowParentCreatedPassword(!showParentCreatedPassword)}
                          className="text-amber-800 hover:text-amber-950"
                        >
                          {showParentCreatedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(admittedSuccess.parentCredentials!.temporaryPassword!, 'pr_pass')}
                          className="text-amber-800 hover:text-amber-950"
                          title="Copy Password"
                        >
                          {copiedKey === 'pr_pass' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="text-[10px] text-amber-900/70 italic">
                    {admittedSuccess.parentCredentials.isExistingAccount
                      ? 'Parent can log in immediately with their existing credentials.'
                      : 'Parent must change temporary password upon first login.'}
                  </span>
                  {!admittedSuccess.parentCredentials.isExistingAccount && (
                    <button
                      type="button"
                      onClick={() =>
                        copyFormattedCredentials(
                          'Parent',
                          admittedSuccess.parentCredentials!.fullName,
                          admittedSuccess.parentCredentials!.identifier,
                          admittedSuccess.parentCredentials!.temporaryPassword,
                          admittedSuccess.instituteCode,
                          'copy_parent_full'
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 hover:text-amber-950 bg-white border border-amber-300 px-2.5 py-1 rounded-lg"
                    >
                      {copiedKey === 'copy_parent_full' ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'copy_parent_full' ? 'Copied Parent Login' : 'Copy Parent Details'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Modal Bottom Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const inst = admittedSuccess.instituteCode;
                  const st = admittedSuccess.studentCredentials;
                  const pr = admittedSuccess.parentCredentials;
                  const text = `Digital Guru Admission Credentials (${admittedSuccess.name})
Institute Code: ${inst}
Portal: ${window.location.origin}
======================================
1. STUDENT LOGIN
Name: ${st?.fullName || admittedSuccess.name}
Admission No: ${admittedSuccess.admissionNumber}
Login ID: ${st?.identifier || admittedSuccess.admissionNumber}
${st?.temporaryPassword ? `Temporary Password: ${st.temporaryPassword}\r\n` : ''}
2. PARENT LOGIN
Guardian: ${pr?.fullName || 'Registered Guardian'}
Login ID: ${pr?.identifier || 'Registered Phone'}
${pr?.isExistingAccount ? 'Account: Existing verified parent account\r\n' : pr?.temporaryPassword ? `Temporary Password: ${pr.temporaryPassword}\r\n` : ''}======================================
Please keep credentials safe. Passwords must be changed upon first login.`;
                  copyToClipboard(text, 'copy_all');
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#006FFF] text-xs font-semibold py-2.5 px-4 rounded-xl transition shadow-sm"
              >
                {copiedKey === 'copy_all' ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'copy_all' ? 'Copied Full Credentials Package!' : 'Copy All Login Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAdmittedSuccess(null)}
                className="bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow-md"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Lifecycle Status Change */}
      <ConfirmationModal
        isOpen={statusConfirm.isOpen}
        title={
          statusConfirm.newStatus === 'PASSED_OUT'
            ? 'Mark Student as Passed Out'
            : statusConfirm.newStatus === 'DISCONTINUED'
            ? 'Discontinue Student'
            : 'Reactivate Student'
        }
        message={
          statusConfirm.newStatus === 'PASSED_OUT'
            ? `Are you sure you want to mark ${statusConfirm.student?.firstName} ${statusConfirm.student?.lastName} as Passed Out? Active batch enrollments will be archived and the student will complete their tenure.`
            : statusConfirm.newStatus === 'DISCONTINUED'
            ? `Are you sure you want to discontinue ${statusConfirm.student?.firstName} ${statusConfirm.student?.lastName}? Active enrollments will be suspended.`
            : `Are you sure you want to reactivate ${statusConfirm.student?.firstName} ${statusConfirm.student?.lastName}?`
        }
        confirmLabel={
          statusConfirm.newStatus === 'PASSED_OUT'
            ? 'Confirm Passed Out'
            : statusConfirm.newStatus === 'DISCONTINUED'
            ? 'Confirm Discontinue'
            : 'Reactivate'
        }
        variant={statusConfirm.newStatus === 'DISCONTINUED' ? 'danger' : statusConfirm.newStatus === 'PASSED_OUT' ? 'warning' : 'primary'}
        loading={statusConfirm.loading}
        onConfirm={handleConfirmStatusChange}
        onCancel={() => setStatusConfirm({ isOpen: false, student: null, newStatus: null, loading: false })}
      />

      {/* Comprehensive Student Details Modal */}
      {selectedStudentId && (
        <StudentDetailsModal
          studentId={selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          onStudentUpdated={fetchData}
          onEditStudent={(s) => {
            setSelectedStudentId(null);
            handleOpenEditStudentModal(s);
          }}
        />
      )}

      {/* Student & Parent Login & Password Modal */}
      {viewingStudentCreds && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto shadow-2xl text-[#0F172A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Student & Parent Login & Password</h2>
                  <p className="text-xs text-[#64748B]">
                    Manage login credentials for {viewingStudentCreds.firstName} {viewingStudentCreds.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudentCreds(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Credential Role Tabs */}
            <div className="flex border-b border-[#F1F5F9] mt-3">
              <button
                type="button"
                onClick={() => {
                  setCredsActiveTab('student');
                  setCredsResetError(null);
                  setCredsResetSuccess(null);
                }}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                  credsActiveTab === 'student'
                    ? 'text-[#006FFF] border-b-2 border-[#006FFF]'
                    : 'text-[#94A3B8] hover:text-[#006FFF]'
                }`}
              >
                <span>🎓 Student Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCredsActiveTab('parent');
                  setCredsResetError(null);
                  setCredsResetSuccess(null);
                }}
                className={`pb-2.5 px-4 text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                  credsActiveTab === 'parent'
                    ? 'text-[#006FFF] border-b-2 border-[#006FFF]'
                    : 'text-[#94A3B8] hover:text-[#006FFF]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Parent / Guardian Account</span>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {credsResetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{credsResetSuccess}</span>
                </div>
              )}

              {credsResetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                  {credsResetError}
                </div>
              )}

              {credsActiveTab === 'student' ? (
                <>
                  {/* Student Profile & Credential Card */}
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                    <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Institute Code:</span>
                      <span className="font-mono font-bold text-[#006FFF]">
                        {activeInstitute?.code || 'INST'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Student Name:</span>
                      <span className="font-semibold text-[#0F172A]">
                        {viewingStudentCreds.firstName} {viewingStudentCreds.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Admission No / Login ID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[#0F172A] select-all">
                          {viewingStudentCreds.admissionNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyCredsToClipboard(viewingStudentCreds.admissionNumber, 'view_adm')
                          }
                          className="text-[#94A3B8] hover:text-[#0F172A]"
                          title="Copy admission number"
                        >
                          {copiedCredsKey === 'view_adm' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Student Created Date & Time:</span>
                      <span className="font-mono font-semibold text-[#0F172A]">
                        {formatKolkataDateTime(viewingStudentCreds.createdAt)}
                      </span>
                    </div>
                    {viewingStudentCreds.user?.createdAt && (
                      <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                        <span className="text-[#64748B]">Student Login Created:</span>
                        <span className="font-mono text-[#0F172A]">
                          {formatKolkataDateTime(viewingStudentCreds.user.createdAt)}
                        </span>
                      </div>
                    )}
                    {viewingStudentCreds.user?.email && (
                      <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                        <span className="text-[#64748B]">Login Email:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#0F172A] select-all">
                            {viewingStudentCreds.user.email}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyCredsToClipboard(viewingStudentCreds.user.email, 'view_stud_email')
                            }
                            className="text-[#94A3B8] hover:text-[#0F172A]"
                            title="Copy email"
                          >
                            {copiedCredsKey === 'view_stud_email' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-[#64748B]">Permanent Password:</span>
                      {viewingStudentCreds.credentialsOnRecord?.studentPassword ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-xs select-all">
                            {showStudentExistingPassword
                              ? viewingStudentCreds.credentialsOnRecord.studentPassword
                              : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowStudentExistingPassword(!showStudentExistingPassword)}
                            className="text-[#94A3B8] hover:text-[#0F172A]"
                            title={showStudentExistingPassword ? 'Hide password' : 'Show password'}
                          >
                            {showStudentExistingPassword ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              copyCredsToClipboard(
                                viewingStudentCreds.credentialsOnRecord.studentPassword,
                                'view_stud_pass'
                              )
                            }
                            className="text-[#94A3B8] hover:text-emerald-700"
                            title="Copy password"
                          >
                            {copiedCredsKey === 'view_stud_pass' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8] italic text-[11px]">
                          Encrypted (Set new password below)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Copy Full Student Credentials */}
                  {viewingStudentCreds.credentialsOnRecord?.studentPassword && (
                    <button
                      type="button"
                      onClick={() =>
                        copyFormattedStudentCredentials(
                          `${viewingStudentCreds.firstName} ${viewingStudentCreds.lastName}`,
                          viewingStudentCreds.admissionNumber,
                          viewingStudentCreds.credentialsOnRecord.studentPassword,
                          activeInstitute?.code,
                          'stud_full_copy'
                        )
                      }
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow transition"
                    >
                      {copiedCredsKey === 'stud_full_copy' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedCredsKey === 'stud_full_copy'
                        ? 'Copied Student Login & Password!'
                        : 'Copy Student Login & Password to Give to Student'}
                    </button>
                  )}

                  {/* Set / Change Permanent Password for Student */}
                  <form
                    onSubmit={handleResetStudentPassword}
                    className="p-4 rounded-2xl border border-[#E2E8F0] space-y-3 bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8]" /> Set / Change Permanent Password
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setResetStudentPasswordInput(generateStrongPassword('Stud'));
                          setShowResetStudentInputPassword(true);
                        }}
                        className="text-[11px] text-[#006FFF] hover:text-[#0F172A] font-bold flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-md hover:bg-[#F1F5F9] transition"
                      >
                        <Sparkles className="w-3 h-3 text-[#94A3B8]" /> Auto-generate
                      </button>
                    </div>

                    <div className="relative">
                      <Key className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                      <input
                        type={showResetStudentInputPassword ? 'text' : 'password'}
                        value={resetStudentPasswordInput}
                        onChange={(e) => setResetStudentPasswordInput(e.target.value)}
                        placeholder="Type new password (or click Auto-generate)..."
                        className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-9 pr-10 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetStudentInputPassword(!showResetStudentInputPassword)}
                        className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#0F172A]"
                        title={showResetStudentInputPassword ? 'Hide password' : 'Show password'}
                      >
                        {showResetStudentInputPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-[#64748B]">
                      Updating this will immediately replace the student login password. They can use this new
                      permanent password right away.
                    </p>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={credsResetLoading || !resetStudentPasswordInput.trim()}
                        className="inline-flex items-center gap-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow transition disabled:opacity-50"
                      >
                        {credsResetLoading ? 'Saving...' : 'Save Permanent Password'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  {/* Parent Profile & Credential Card */}
                  {viewingStudentCreds.parentRelations && viewingStudentCreds.parentRelations.length > 0 ? (
                    (() => {
                      const rel = viewingStudentCreds.parentRelations[0];
                      const parentUser = rel?.parent?.user;
                      const parentId = rel?.parent?.id;
                      const loginIdentifier = parentUser?.phone || parentUser?.email || '';

                      return (
                        <>
                          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                            <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                              <span className="text-[#64748B]">Institute Code:</span>
                              <span className="font-mono font-bold text-[#006FFF]">
                                {activeInstitute?.code || 'INST'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                              <span className="text-[#64748B]">Guardian Name:</span>
                              <span className="font-semibold text-[#0F172A]">
                                {parentUser?.fullName} ({rel.relation})
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                              <span className="text-[#64748B]">Parent Login Phone / ID:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-[#0F172A] select-all">
                                  {loginIdentifier}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyCredsToClipboard(loginIdentifier, 'view_parent_id')}
                                  className="text-[#94A3B8] hover:text-[#0F172A]"
                                  title="Copy phone/login"
                                >
                                  {copiedCredsKey === 'view_parent_id' ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {parentUser?.email && (
                              <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                                <span className="text-[#64748B]">Parent Email:</span>
                                <span className="font-mono text-[#0F172A]">{parentUser.email}</span>
                              </div>
                            )}
                            {parentUser?.createdAt && (
                              <div className="flex justify-between items-center py-0.5 border-b border-[#F1F5F9]">
                                <span className="text-[#64748B]">Parent Account Created:</span>
                                <span className="font-mono text-[#0F172A]">
                                  {formatKolkataDateTime(parentUser.createdAt)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-[#64748B]">Permanent Password:</span>
                              {viewingStudentCreds.credentialsOnRecord?.parentPassword ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-[#0F172A] bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-xs select-all">
                                    {showParentExistingPassword
                                      ? viewingStudentCreds.credentialsOnRecord.parentPassword
                                      : '••••••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowParentExistingPassword(!showParentExistingPassword)}
                                    className="text-[#94A3B8] hover:text-[#0F172A]"
                                    title={showParentExistingPassword ? 'Hide password' : 'Show password'}
                                  >
                                    {showParentExistingPassword ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyCredsToClipboard(
                                        viewingStudentCreds.credentialsOnRecord.parentPassword,
                                        'view_parent_pass'
                                      )
                                    }
                                    className="text-[#94A3B8] hover:text-emerald-700"
                                    title="Copy password"
                                  >
                                    {copiedCredsKey === 'view_parent_pass' ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[#94A3B8] italic text-[11px]">
                                  Encrypted (Set new password below)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Copy Full Parent Credentials */}
                          {viewingStudentCreds.credentialsOnRecord?.parentPassword && (
                            <button
                              type="button"
                              onClick={() =>
                                copyFormattedParentCredentials(
                                  parentUser?.fullName || 'Parent',
                                  `${viewingStudentCreds.firstName} ${viewingStudentCreds.lastName}`,
                                  loginIdentifier,
                                  viewingStudentCreds.credentialsOnRecord.parentPassword,
                                  activeInstitute?.code,
                                  'parent_full_copy'
                                )
                              }
                              className="w-full inline-flex items-center justify-center gap-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow transition"
                            >
                              {copiedCredsKey === 'parent_full_copy' ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              {copiedCredsKey === 'parent_full_copy'
                                ? 'Copied Parent Login & Password!'
                                : 'Copy Parent Login & Password to Give to Parent'}
                            </button>
                          )}

                          {/* Set / Change Permanent Password for Parent */}
                          <form
                            onSubmit={(e) => handleResetParentPassword(e, parentId)}
                            className="p-4 rounded-2xl border border-[#E2E8F0] space-y-3 bg-white"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-xs font-bold text-[#006FFF] flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8]" /> Set / Change Permanent Password
                              </h3>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetParentPasswordInput(generateStrongPassword('Parent'));
                                  setShowResetParentInputPassword(true);
                                }}
                                className="text-[11px] text-[#006FFF] hover:text-[#0F172A] font-bold flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded-md hover:bg-[#F1F5F9] transition"
                              >
                                <Sparkles className="w-3 h-3 text-[#94A3B8]" /> Auto-generate
                              </button>
                            </div>

                            <div className="relative">
                              <Key className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                              <input
                                type={showResetParentInputPassword ? 'text' : 'password'}
                                value={resetParentPasswordInput}
                                onChange={(e) => setResetParentPasswordInput(e.target.value)}
                                placeholder="Type new password (or click Auto-generate)..."
                                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl pl-9 pr-10 py-2 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetParentInputPassword(!showResetParentInputPassword)}
                                className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#0F172A]"
                                title={showResetParentInputPassword ? 'Hide password' : 'Show password'}
                              >
                                {showResetParentInputPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            <p className="text-[11px] text-[#64748B]">
                              Updating this will immediately replace the parent login password. They can use this new
                              permanent password right away.
                            </p>

                            <div className="pt-1 flex justify-end">
                              <button
                                type="submit"
                                disabled={credsResetLoading || !resetParentPasswordInput.trim()}
                                className="inline-flex items-center gap-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow transition disabled:opacity-50"
                              >
                                {credsResetLoading ? 'Saving...' : 'Save Permanent Password'}
                              </button>
                            </div>
                          </form>
                        </>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      No parent or guardian is currently linked to this student record. You can link a guardian during
                      admission or edit the student profile.
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setViewingStudentCreds(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Batch & Subjects Modal */}
      {assignBatchStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#E2E8F0] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-[#0F172A]">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#F1F5F9] flex justify-between items-center bg-[#FFFFFF]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F1F5F9] text-[#006FFF] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[#006FFF]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A]">Assign Batch & Subjects</h2>
                  <p className="text-xs text-[#64748B]">
                    {assignBatchStudent.firstName} {assignBatchStudent.lastName} ({assignBatchStudent.admissionNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignBatchStudent(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignBatchError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs">
                {assignBatchError}
              </div>
            )}

            <form onSubmit={handleSaveBatchAssignment} className="p-6 space-y-5">
              {/* Batch Selection */}
              <div>
                <label className="block text-xs font-bold text-[#006FFF] mb-1.5 uppercase tracking-wider">
                  Select Academic Batch*
                </label>
                <select
                  required
                  value={selectedAssignBatchId}
                  onChange={(e) => handleBatchChangeInModal(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">-- Choose an Academic Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.academicYear})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Enrolling in a batch will link the student to the active class roster and timetable.
                </p>
              </div>

              {/* Subject Allocations */}
              {selectedAssignBatchId ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider">
                      Select Subjects to Allocate
                    </label>
                    {(() => {
                      const curBatch = batches.find((b) => b.id === selectedAssignBatchId);
                      const allIds = (curBatch?.batchSubjects || []).map((bs: any) => bs.subject?.id || bs.subjectId);
                      if (allIds.length === 0) return null;
                      const allSelected = allIds.every((id: string) => selectedAssignSubjectIds.includes(id));
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allSelected) {
                              setSelectedAssignSubjectIds([]);
                            } else {
                              setSelectedAssignSubjectIds(allIds);
                            }
                          }}
                          className="text-[11px] text-[#64748B] hover:text-[#0F172A] font-semibold underline"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      );
                    })()}
                  </div>

                  {(() => {
                    const curBatch = batches.find((b) => b.id === selectedAssignBatchId);
                    const subjects = curBatch?.batchSubjects || [];
                    if (subjects.length === 0) {
                      return (
                        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8] text-xs">
                          No subjects are configured inside this batch yet.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {subjects.map((bs: any) => {
                          const subId = bs.subject?.id || bs.subjectId;
                          const subName = bs.subject?.name || 'Subject';
                          const isChecked = selectedAssignSubjectIds.includes(subId);
                          return (
                            <label
                              key={subId}
                              className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-amber-50/70 border-amber-300 text-[#006FFF]'
                                  : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleSubjectAllocation(subId)}
                                  className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#006FFF]/20"
                                />
                                <span className="text-xs font-semibold">{subName}</span>
                              </div>
                              {bs.schedule && (
                                <span className="text-[10px] text-[#94A3B8] font-mono">
                                  {bs.schedule}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#94A3B8] text-center">
                  Please select an academic batch above to view and allocate subjects.
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#F1F5F9] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignBatchStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignBatchLoading || !selectedAssignBatchId}
                  className="inline-flex items-center gap-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {assignBatchLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Batch & Subjects'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-[#0F172A] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[#F1F5F9] bg-[#FFFFFF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center shadow-sm">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                    Edit Student Profile
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0]">
                      {editingStudent.admissionNumber}
                    </span>
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Update personal information, batch enrollment, subjects, and parent contact details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveStudentEdit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {editError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Student Photo */}
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] flex items-center gap-4">
                <div className="relative shrink-0">
                  {editPhotoPreview ? (
                    <img
                      src={editPhotoPreview}
                      alt="Student"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-[#8D6E63] shadow-sm"
                    />
                  ) : (
                    <StudentAvatar
                      studentId={editingStudent.id}
                      photoUrl={editingStudent.photoUrl}
                      name={`${editingStudent.firstName} ${editingStudent.lastName}`}
                      size="lg"
                      className="w-16 h-16 rounded-2xl border-2 border-[#E2E8F0]"
                    />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-[#006FFF] block">Student Photograph</span>
                  <p className="text-[11px] text-[#94A3B8]">
                    Upload an updated JPG, PNG, or WebP photo (max 5MB)
                  </p>
                  <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm transition inline-flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Choose New Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleEditPhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      First Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Last Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Student Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editFormData.studentPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, studentPhone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Student Email Address
                    </label>
                    <input
                      type="email"
                      value={editFormData.studentEmail}
                      onChange={(e) => setEditFormData({ ...editFormData, studentEmail: e.target.value })}
                      placeholder="student@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editFormData.dob}
                      onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Gender
                    </label>
                    <select
                      value={editFormData.gender}
                      onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Blood Group
                    </label>
                    <select
                      value={editFormData.bloodGroup}
                      onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    >
                      <option value="">Select Blood Group (Optional)</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Academic Batch & Subjects */}
              <div className="space-y-3 pt-3 border-t border-[#F1F5F9]">
                <h3 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Academic Batch & Subject Allocations
                </h3>
                <div>
                  <label className="block text-xs font-bold text-[#006FFF] mb-1">
                    Academic Batch
                  </label>
                  <select
                    value={editFormData.batchId}
                    onChange={(e) => handleEditBatchChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                  >
                    <option value="">-- No Batch Assigned --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.academicYear})
                      </option>
                    ))}
                  </select>
                </div>

                {editFormData.batchId && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-[#006FFF] uppercase tracking-wider">
                        Select Subjects to Allocate
                      </label>
                      {(() => {
                        const curBatch = batches.find((b) => b.id === editFormData.batchId);
                        const allIds = (curBatch?.batchSubjects || []).map((bs: any) => bs.subject?.id || bs.subjectId);
                        if (allIds.length === 0) return null;
                        const allSelected = allIds.every((id: string) => editFormData.subjectIds.includes(id));
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (allSelected) {
                                setEditFormData((prev) => ({ ...prev, subjectIds: [] }));
                              } else {
                                setEditFormData((prev) => ({ ...prev, subjectIds: allIds }));
                              }
                            }}
                            className="text-[11px] text-[#64748B] hover:text-[#0F172A] font-semibold underline"
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        );
                      })()}
                    </div>

                    {(() => {
                      const curBatch = batches.find((b) => b.id === editFormData.batchId);
                      const subjects = curBatch?.batchSubjects || [];
                      if (subjects.length === 0) {
                        return (
                          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8] text-xs">
                            No subjects configured in this batch.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {subjects.map((bs: any) => {
                            const subId = bs.subject?.id || bs.subjectId;
                            const subName = bs.subject?.name || 'Subject';
                            const isChecked = editFormData.subjectIds.includes(subId);
                            return (
                              <label
                                key={subId}
                                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition select-none ${
                                  isChecked
                                    ? 'bg-amber-50/70 border-amber-300 text-[#006FFF]'
                                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleEditSubject(subId)}
                                    className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#006FFF]/20"
                                  />
                                  <span className="text-xs font-semibold">{subName}</span>
                                </div>
                                {bs.schedule && (
                                  <span className="text-[10px] text-[#94A3B8] font-mono">
                                    {bs.schedule}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Section 3: Parent / Guardian Details */}
              <div className="space-y-3 pt-3 border-t border-[#F1F5F9]">
                <h3 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Parent / Guardian Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Parent / Guardian Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.parentFullName}
                      onChange={(e) => setEditFormData({ ...editFormData, parentFullName: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Relationship
                    </label>
                    <select
                      value={editFormData.parentRelationship}
                      onChange={(e) => setEditFormData({ ...editFormData, parentRelationship: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Parent Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={editFormData.parentPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, parentPhone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Parent Email Address
                    </label>
                    <input
                      type="email"
                      value={editFormData.parentEmail}
                      onChange={(e) => setEditFormData({ ...editFormData, parentEmail: e.target.value })}
                      placeholder="parent@example.com"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Notes / Remarks */}
              <div className="space-y-3 pt-3 border-t border-[#F1F5F9]">
                <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider">
                  Remarks / Medical Notes
                </label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Optional notes or remarks on the student..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] text-xs focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#006FFF]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  disabled={editLoading}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editFormData.firstName || !editFormData.lastName}
                  className="inline-flex items-center gap-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

