import { markNotificationEntityAsRead } from '../services/notificationService';
import React, { useEffect, useState } from 'react';
import { apiFetch, getMaterialDownloadUrl, getSubmissionDownloadUrl, downloadFileToDevice } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { QuizManager } from '../components/QuizManager';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  Calendar,
  Award,
  MessageSquare,
  Plus,
  Search,
  Eye,
  X,
  Download,
  CheckSquare,
  Users,
  AlertCircle,
  FileCheck,
  Send,
  ExternalLink,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { MaterialViewerModal } from '../components/MaterialViewerModal';

export const HomeworkManagement: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isStaffOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ACADEMIC_ADMIN' || user?.role === 'STAFF';
  const isStudent = user?.role === 'STUDENT';

  // Section switcher: Homework vs Quizzes (Phase 6)
  const [activeSection, setActiveSection] = useState<'HOMEWORK' | 'QUIZZES'>('HOMEWORK');

  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Homework creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Student submission modal
  const [selectedHwForSubmit, setSelectedHwForSubmit] = useState<any>(null);
  const [studentNotes, setStudentNotes] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);

  // Student simple complete confirmation modal
  const [confirmCompleteHw, setConfirmCompleteHw] = useState<any>(null);

  // Staff completion monitoring drawer/modal
  const [selectedHwForReview, setSelectedHwForReview] = useState<any>(null);
  const [reviewData, setReviewData] = useState<{
    homework?: any;
    summary?: any;
    roster?: any[];
    submissions?: any[];
  } | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [evaluatingSubId, setEvaluatingSubId] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'COMPLETED' | 'AWAITING_REVIEW' | 'SUBMITTED' | 'NOT_COMPLETED' | 'OVERDUE'>('ALL');
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');

  useEffect(() => {
    loadHomework();
    if (isStaffOrAdmin) {
      loadBatches();
    }
  }, []);

  // Lock background page scrolling when completion review modal is open and handle Escape key safely
  useEffect(() => {
    if (!selectedHwForReview && !previewMaterial) return;

    // Save previous overflow values
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const mainEl = document.querySelector('main');
    const prevMainOverflow = mainEl ? mainEl.style.overflow : '';

    // Lock scrolling on document and main container
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (mainEl) {
      mainEl.style.overflow = 'hidden';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewMaterial) {
          setPreviewMaterial(null);
        } else if (selectedHwForReview) {
          setSelectedHwForReview(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      if (mainEl) {
        mainEl.style.overflow = prevMainOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedHwForReview, previewMaterial]);

  async function loadHomework() {
    try {
      setLoading(true);
      const res = await apiFetch('/homework');
      if (res.success) {
        setHomeworkList(res.data.homework || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBatches() {
    try {
      const bRes = await apiFetch('/academics/batches');
      if (bRes.success) setBatches(bRes.data.batches || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Derive subjects specifically for the selected batch in the creation form
  const selectedBatchObj = batches.find((b) => b.id === batchId);
  const availableSubjects: any[] = selectedBatchObj?.batchSubjects?.map((bs: any) => bs.subject).filter(Boolean) || [];

  async function handleCreateHomework(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) {
      setMessage({ text: 'Please select a batch', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const combinedDue = `${dueDate}T${dueTime || '23:59'}:00.000Z`;

      const formData = new FormData();
      formData.append('title', title.trim());
      if (description) formData.append('description', description.trim());
      formData.append('batchId', batchId);
      if (subjectId) formData.append('subjectId', subjectId);
      formData.append('dueDate', combinedDue);
      formData.append('isPublished', String(isPublished));
      if (attachmentFile) formData.append('file', attachmentFile);

      const token = localStorage.getItem('tuition_token');
      const instId = localStorage.getItem('tuition_active_institute_id');

      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(instId ? { 'x-institute-id': instId } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create homework');

      const successMsg = isPublished
        ? 'Homework assignment published to all enrolled students!'
        : 'Homework assignment saved as draft (faculty only).';
      toast.success(successMsg);
      setMessage({
        text: successMsg,
        type: 'success',
      });
      setShowCreateModal(false);
      resetCreateForm();
      loadHomework();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create homework');
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('23:59');
    setBatchId('');
    setSubjectId('');
    setIsPublished(true);
    setAttachmentFile(null);
  }

  // Action: Mark as Completed (simple completion task)
  async function handleMarkCompleted(hw: any) {
    try {
      setSubmitting(true);
      const res = await apiFetch(`/homework/${hw.id}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ isCompleted: true, status: 'COMPLETED' }),
      });
      if (res.success) {
        setMessage({ text: 'Assignment marked as completed!', type: 'success' });
        setConfirmCompleteHw(null);
        loadHomework();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete assignment');
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Student Submit work with notes and optional attachment
  async function handleStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHwForSubmit) return;

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('studentNotes', studentNotes.trim());
      if (submissionFile) formData.append('file', submissionFile);

      const token = localStorage.getItem('tuition_token');
      const instId = localStorage.getItem('tuition_active_institute_id');

      const res = await fetch(`/api/homework/${selectedHwForSubmit.id}/submissions`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(instId ? { 'x-institute-id': instId } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      setMessage({ text: data.message || 'Assignment submitted successfully!', type: 'success' });
      setSelectedHwForSubmit(null);
      setStudentNotes('');
      setSubmissionFile(null);
      loadHomework();
    } catch (err: any) {
      toast.error(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  }

  // Action: Open Staff Completion Review
  async function openReviewDrawer(hw: any) {
    setSelectedHwForReview(hw);
    setReviewData(null);
    setLoadingReview(true);
    setRosterFilter('ALL');
    setRosterSearch('');
    try {
      const res = await apiFetch(`/homework/${hw.id}/submissions`);
      if (res.success) {
        setReviewData(res.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load submissions');
    } finally {
      setLoadingReview(false);
    }
  }

  // Action: Grade a student submission
  async function handleGradeSubmission(submissionId: string) {
    try {
      const res = await apiFetch(`/homework/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade: gradeInput, feedback: feedbackInput }),
      });
      if (res.success) {
        setEvaluatingSubId(null);
        setGradeInput('');
        setFeedbackInput('');
        openReviewDrawer(selectedHwForReview);
        loadHomework();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to grade submission');
    }
  }

  const filteredHomework = homeworkList.filter((hw) => {
    const matchesSearch =
      hw.title.toLowerCase().includes(search.toLowerCase()) ||
      (hw.description && hw.description.toLowerCase().includes(search.toLowerCase()));

    const matchesBatch = selectedBatchFilter === 'ALL' || hw.batchId === selectedBatchFilter;

    let matchesStatus = true;
    if (selectedStatusFilter === 'COMPLETED') {
      matchesStatus = hw.studentStatus === 'COMPLETED' || hw.studentStatus === 'GRADED' || hw.studentStatus === 'SUBMITTED';
    } else if (selectedStatusFilter === 'PENDING') {
      matchesStatus = hw.studentStatus === 'NOT_STARTED' && !hw.isOverdue;
    } else if (selectedStatusFilter === 'OVERDUE') {
      matchesStatus = hw.isOverdue || hw.studentStatus === 'OVERDUE';
    }

    return matchesSearch && matchesBatch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs (Phase 5 vs Phase 6) */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3">
        <button
          onClick={() => setActiveSection('HOMEWORK')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === 'HOMEWORK'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
        >
          <FileText className="w-4 h-4" /> Homework & Tasks
        </button>
        <button
          onClick={() => setActiveSection('QUIZZES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSection === 'QUIZZES'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}
        >
          <HelpCircle className="w-4 h-4" /> Interactive Quizzes & Assessments
        </button>
      </div>

      {activeSection === 'QUIZZES' ? (
        <QuizManager
          isStaffOrAdmin={isStaffOrAdmin}
          isStudent={isStudent}
          batches={batches}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-[#0F172A] flex items-center gap-2.5">
                <FileText className="w-7 h-7 text-[#64748B]" />
                <span>Homework & Academic Assignments</span>
              </h1>
              <p className="text-sm text-[#64748B] mt-1">
                Track assignment deadlines, verify student submissions, and review grades
              </p>
            </div>

            {isStaffOrAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl font-semibold text-sm shadow-sm transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Create Homework / Task
              </button>
            )}
          </div>

          {message && (
            <div
              className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2.5 ${message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
              <button onClick={() => setMessage(null)} className="text-current hover:opacity-75">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search assignments, topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {isStaffOrAdmin && batches.length > 0 && (
                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="ALL">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}

              {isStudent && (
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="ALL">All Assignments</option>
                  <option value="PENDING">Pending / Not Started</option>
                  <option value="COMPLETED">Submitted & Completed</option>
                  <option value="OVERDUE">Overdue Deadlines</option>
                </select>
              )}
            </div>
          </div>

          {/* Homework Cards */}
          {loading ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping"></div>
              <span>Loading homework assignments...</span>
            </div>
          ) : filteredHomework.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm space-y-2">
              <FileText className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <p className="font-medium">No homework assignments found.</p>
              <p className="text-xs text-[#94A3B8]">All upcoming tasks and assignments will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredHomework.map((hw) => {
                const hasSubmitted = Boolean(hw.mySubmission);
                const subStatus = hw.mySubmission?.status;
                const isLate = hw.mySubmission?.isLate;

                return (
                  <div
                    key={hw.id}
                    className={`p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4 ${!hw.isPublished ? 'border-amber-300 bg-amber-50/20' : 'border-[#E2E8F0]'
                      }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]">
                            {hw.subject?.name ? hw.subject.name : 'Batch-wide'}
                          </span>
                          {hw.batch?.name && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#F8FAFC] text-[#64748B] border border-[#F1F5F9]">
                              {hw.batch.name}
                            </span>
                          )}
                        </div>

                        {!hw.isPublished ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Draft
                          </span>
                        ) : hw.isOverdue ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-[#0F172A] text-base leading-snug">{hw.title}</h3>
                        {hw.description && <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{hw.description}</p>}
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>Due: {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : 'No date'}</span>
                        </span>
                      </div>

                      {hw.fileUrl && (
                        <div className="flex items-center gap-2 pt-1">
                          <a
                            href={getMaterialDownloadUrl(hw.id, false)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#006FFF] hover:underline font-semibold"
                            title="Open/Preview Worksheet in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View Worksheet
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadFileToDevice(getMaterialDownloadUrl(hw.id, true), hw.fileName || 'worksheet')}
                            className="inline-flex items-center gap-1 text-xs text-[#006FFF] hover:text-[#0F172A] font-semibold bg-[#006FFF]/10 px-2 py-0.5 rounded-lg border border-[#E2E8F0]"
                            title="Download and save worksheet to device"
                          >
                            <Download className="w-3.5 h-3.5" /> Save
                          </button>
                        </div>
                      )}

                      {/* Student View Submission Status & Actions */}
                      {isStudent && (
                        <div className="pt-2 space-y-2">
                          {hasSubmitted ? (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                              <div className="flex items-center justify-between font-semibold">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                  {subStatus === 'GRADED' || hw.mySubmission?.grade
                                    ? `Graded${hw.mySubmission.grade ? ` (${hw.mySubmission.grade})` : ''}`
                                    : subStatus === 'COMPLETED'
                                      ? 'Completed'
                                      : 'Submitted (Awaiting Review)'}
                                </span>
                                {isLate && <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded">Late</span>}
                              </div>

                              <div className="text-[11px] text-[#64748B]">
                                Submitted on {new Date(hw.mySubmission.submittedAt).toLocaleString()}
                              </div>

                              {hw.mySubmission.studentNotes && (
                                <p className="text-[11px] text-[#0F172A] bg-white/80 p-2 rounded border border-emerald-200">
                                  "{hw.mySubmission.studentNotes}"
                                </p>
                              )}

                              {hw.mySubmission.grade && (
                                <div className="text-[11px] text-[#0F172A] pt-1 border-t border-emerald-200 flex items-center justify-between">
                                  <span>
                                    Grade: <strong className="text-amber-800 font-bold">{hw.mySubmission.grade}</strong>
                                  </span>
                                  {hw.mySubmission.feedback && (
                                    <span className="text-[#64748B] italic">"{hw.mySubmission.feedback}"</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setConfirmCompleteHw(hw)}
                                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-1 transition-all"
                              >
                                <CheckSquare className="w-3.5 h-3.5" /> Complete
                              </button>

                              <button
                                onClick={() => setSelectedHwForSubmit(hw)}
                                className="flex-1 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center gap-1 transition-all"
                              >
                                <Upload className="w-3.5 h-3.5" /> Submit Work
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Staff Completion Summary Metrics */}
                      {isStaffOrAdmin && hw.summary && (
                        <div className="pt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
                          <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9]">
                            <span className="text-[#94A3B8] block">Eligible</span>
                            <strong className="text-[#0F172A] font-bold text-xs">{hw.summary.totalEligible}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            <span className="text-emerald-800 block">Done</span>
                            <strong className="text-emerald-800 font-bold text-xs">
                              {hw.summary.submittedCount + hw.summary.completedCount}
                            </strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-[#FAF7F5] border border-[#E2E8F0]">
                            <span className="text-[#94A3B8] block">Pending</span>
                            <strong className="text-[#64748B] font-bold text-xs">{hw.summary.notStartedCount}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200">
                            <span className="text-rose-800 block">Overdue</span>
                            <strong className="text-rose-800 font-bold text-xs">{hw.summary.overdueCount}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Staff Actions */}
                    {isStaffOrAdmin && (
                      <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                        <span className="text-[#94A3B8] text-[11px] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {hw.submissions?.length || 0} Submissions
                        </span>
                        <button
                          onClick={() => openReviewDrawer(hw)}
                          className="px-3 py-1.5 rounded-xl bg-[#006FFF]/10 hover:bg-[#006FFF] text-[#006FFF] hover:text-white border border-[#E2E8F0] font-semibold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Progress & Grade
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Staff Completion Monitoring & Grading Drawer/Modal */}
          {selectedHwForReview && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedHwForReview(null);
              }}
              onWheel={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              onTouchMove={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              <div
                className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden min-w-0"
                role="dialog"
                aria-modal="true"
                aria-labelledby="completion-progress-title"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3 mb-3 shrink-0 min-w-0">
                  <div className="min-w-0 pr-3">
                    <h2 id="completion-progress-title" className="text-lg sm:text-xl font-bold text-[#0F172A] flex items-center gap-2 truncate">
                      <FileCheck className="w-5 h-5 text-[#64748B] shrink-0" />
                      <span className="truncate">Completion Progress: {selectedHwForReview.title}</span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mt-1">
                      <span className="font-semibold">Batch: {selectedHwForReview.batch?.name}</span>
                      <span>&bull;</span>
                      <span>Due: {new Date(selectedHwForReview.dueDate).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHwForReview(null)}
                    className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shrink-0"
                    title="Close (Esc)"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {loadingReview ? (
                  <div className="p-12 text-center text-[#94A3B8] text-sm flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#006FFF] animate-ping" />
                      <span>Loading student completion data...</span>
                    </div>
                  </div>
                ) : reviewData ? (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Summary Metric Badges (Informative counts, TuitionOS neutral palette) */}
                    {reviewData.summary && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center mb-3 shrink-0 min-w-0">
                        <div className="p-2 sm:p-2.5 rounded-xl bg-[#FAF8F5] border border-[#F1F5F9]">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] block truncate">Enrolled</span>
                          <strong className="text-sm font-bold text-[#0F172A]">{reviewData.summary.totalEligible ?? 0}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 block truncate">Completed</span>
                          <strong className="text-sm font-bold text-emerald-800">{reviewData.summary.completedCount ?? 0}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] block truncate">Not Started</span>
                          <strong className="text-sm font-bold text-[#64748B]">{reviewData.summary.notCompletedCount ?? reviewData.summary.notStartedCount ?? 0}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-800 block truncate">Submitted</span>
                          <strong className="text-sm font-bold text-indigo-800">{reviewData.summary.submittedCount ?? 0}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-blue-800 block truncate">Awaiting Review</span>
                          <strong className="text-sm font-bold text-blue-800">{reviewData.summary.awaitingReviewCount ?? 0}</strong>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50/60 border border-rose-100">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-rose-800 block truncate">Overdue</span>
                          <strong className="text-sm font-bold text-rose-800">{reviewData.summary.overdueCount ?? 0}</strong>
                        </div>
                      </div>
                    )}

                    {/* Compact Filter Dropdown & Search Toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3 shrink-0 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <label htmlFor="roster-status-filter" className="text-xs font-semibold text-[#64748B] shrink-0">
                          Filter:
                        </label>
                        <div className="relative min-w-[170px] sm:min-w-[210px]">
                          <select
                            id="roster-status-filter"
                            value={rosterFilter}
                            onChange={(e) => setRosterFilter(e.target.value as any)}
                            className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] font-semibold focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#6D4C41] focus:outline-none transition-colors cursor-pointer appearance-none shadow-xs"
                          >
                            <option value="ALL">All Students ({reviewData.summary?.totalEligible ?? 0})</option>
                            <option value="COMPLETED">Completed ({reviewData.summary?.completedCount ?? 0})</option>
                            <option value="NOT_COMPLETED">Not Started ({reviewData.summary?.notCompletedCount ?? reviewData.summary?.notStartedCount ?? 0})</option>
                            <option value="SUBMITTED">Submitted ({reviewData.summary?.submittedCount ?? 0})</option>
                            <option value="AWAITING_REVIEW">Awaiting Review ({reviewData.summary?.awaitingReviewCount ?? 0})</option>
                            <option value="OVERDUE">Overdue ({reviewData.summary?.overdueCount ?? 0})</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#94A3B8]">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      <div className="relative min-w-0 flex-1 sm:max-w-xs">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input
                          type="text"
                          placeholder="Search student or admission no..."
                          value={rosterSearch}
                          onChange={(e) => setRosterSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-xl focus:ring-1 focus:ring-[#006FFF]/20 focus:border-[#6D4C41] text-[#0F172A] focus:outline-none placeholder-[#8D6E63]/60 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Student-wise Completion Roster - only this scrolls vertically */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-3 pr-1">
                      {(() => {
                        let items = reviewData.roster || [];
                        if (rosterFilter !== 'ALL') {
                          if (rosterFilter === 'COMPLETED') {
                            items = items.filter((r: any) => r.status === 'GRADED' || r.status === 'SELF_COMPLETED' || r.status === 'COMPLETED');
                          } else if (rosterFilter === 'NOT_COMPLETED') {
                            items = items.filter((r: any) => !r.isSubmitted && !r.submission);
                          } else if (rosterFilter === 'SUBMITTED') {
                            items = items.filter((r: any) => r.isSubmitted || r.submission);
                          } else if (rosterFilter === 'AWAITING_REVIEW') {
                            items = items.filter((r: any) => r.isAwaitingReview || r.status === 'AWAITING_REVIEW');
                          } else if (rosterFilter === 'OVERDUE') {
                            items = items.filter((r: any) => (!r.isSubmitted && !r.submission) && r.isOverdue);
                          }
                        }

                        if (rosterSearch.trim()) {
                          const q = rosterSearch.toLowerCase();
                          items = items.filter((r: any) =>
                            r.student?.firstName?.toLowerCase().includes(q) ||
                            r.student?.lastName?.toLowerCase().includes(q) ||
                            r.student?.admissionNumber?.toLowerCase().includes(q)
                          );
                        }

                        if (items.length === 0) {
                          return (
                            <div className="p-8 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                              No students match the selected filter criteria.
                            </div>
                          );
                        }

                        return items.map((r: any) => {
                          const st = r.student;
                          const sub = r.submission;

                          const isGraded = r.status === 'GRADED' || sub?.status === 'GRADED';
                          const isSelfComplete = r.status === 'SELF_COMPLETED' || (sub?.status === 'COMPLETED' && !sub?.fileUrl);
                          const isAwaiting = r.status === 'AWAITING_REVIEW' || r.isAwaitingReview;
                          const isOverdue = r.isOverdue && !sub;

                          return (
                            <div
                              key={st.id}
                              className="p-3.5 sm:p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 min-w-0"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full bg-[#006FFF] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                    {st.firstName?.[0] || 'S'}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-[#0F172A] text-sm block truncate">
                                      {st.firstName} {st.lastName}
                                    </span>
                                    <span className="text-xs text-[#64748B] font-mono block truncate">
                                      Adm: {st.admissionNumber}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {r.submissionType && r.submissionType !== 'NONE' && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-[#E2E8F0] text-[#64748B]">
                                      {r.submissionType === 'FILE_UPLOAD' ? 'File Upload' : r.submissionType === 'TEXT_SUBMISSION' ? 'Text Response' : 'Self-Marked'}
                                    </span>
                                  )}

                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isGraded
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isSelfComplete
                                          ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                          : isAwaiting
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : isOverdue
                                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                              : 'bg-gray-100 text-gray-700 border border-gray-300'
                                      }`}
                                  >
                                    {isGraded ? 'Graded' : isSelfComplete ? 'Self-Completed' : isAwaiting ? 'Awaiting Review' : isOverdue ? 'Overdue' : 'Not Submitted'}
                                  </span>
                                </div>
                              </div>

                              {sub && (
                                <div className="space-y-2 pt-2 border-t border-[#E2E8F0]/60 text-xs min-w-0">
                                  <div className="flex flex-wrap items-center justify-between text-[#94A3B8] text-[11px] gap-1">
                                    <span>Submitted: {new Date(sub.submittedAt).toLocaleString()}</span>
                                    {sub.isLate && <strong className="text-rose-800">Late Submission</strong>}
                                  </div>

                                  {sub.studentNotes && (
                                    <p className="text-xs text-[#0F172A] bg-white p-2.5 rounded-lg border border-[#E2E8F0] break-words">
                                      "{sub.studentNotes}"
                                    </p>
                                  )}

                                  {sub.fileUrl && (
                                    <div className="flex flex-wrap items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewMaterial({
                                          id: sub.materialId,
                                          title: `${st.firstName}'s Submission - ${reviewData.homework?.title}`,
                                          fileUrl: sub.fileUrl,
                                          fileName: sub.fileName,
                                          mimeType: sub.mimeType,
                                          type: 'DOCUMENT',
                                        })}
                                        className="inline-flex items-center gap-1.5 text-xs text-[#006FFF] hover:underline font-semibold"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> Preview Submission File
                                      </button>
                                      <a
                                        href={getSubmissionDownloadUrl(sub.id)}
                                        download={sub.fileName || 'submission'}
                                        className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:underline"
                                      >
                                        <Download className="w-3 h-3" /> Save File
                                      </a>
                                    </div>
                                  )}

                                  {/* Grading input */}
                                  {evaluatingSubId === sub.id ? (
                                    <div className="pt-2 space-y-2 bg-white p-3 rounded-xl border border-[#E2E8F0] min-w-0">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input
                                          type="text"
                                          placeholder="Grade (e.g. A+ or 18/20)"
                                          value={gradeInput}
                                          onChange={(e) => setGradeInput(e.target.value)}
                                          className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                                        />
                                        <input
                                          type="text"
                                          placeholder="Feedback / Remarks"
                                          value={feedbackInput}
                                          onChange={(e) => setFeedbackInput(e.target.value)}
                                          className="sm:col-span-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2 pt-1">
                                        <button
                                          type="button"
                                          onClick={() => setEvaluatingSubId(null)}
                                          className="px-2.5 py-1 text-xs text-[#94A3B8] hover:text-[#0F172A]"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleGradeSubmission(sub.id)}
                                          className="px-3 py-1 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-lg text-xs font-semibold"
                                        >
                                          Save Grade
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 min-w-0">
                                      <span className="text-[#0F172A] text-xs">
                                        Grade: <strong className="text-[#64748B]">{sub.grade || 'Not Graded Yet'}</strong>
                                        {sub.feedback && <span className="ml-2 text-[#94A3B8] italic">"{sub.feedback}"</span>}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEvaluatingSubId(sub.id);
                                          setGradeInput(sub.grade || '');
                                          setFeedbackInput(sub.feedback || '');
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-[#006FFF]/10 hover:bg-[#006FFF] text-[#006FFF] hover:text-white border border-[#E2E8F0] text-xs font-medium transition-colors shrink-0"
                                      >
                                        {sub.grade ? 'Edit Grade' : 'Assign Grade'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Student Confirm Mark Completed Modal */}
          {confirmCompleteHw && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-4 shadow-2xl text-center">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
                <h2 className="text-lg font-bold text-[#0F172A]">Mark Task as Completed?</h2>
                <p className="text-xs text-[#64748B]">
                  Confirm that you have finished <strong>"{confirmCompleteHw.title}"</strong>. This will notify your faculty that the task is complete.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCompleteHw(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleMarkCompleted(confirmCompleteHw)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Confirming...' : 'Yes, Mark Completed'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Student Submit Work Modal */}
          {selectedHwForSubmit && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 shadow-2xl my-6">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">Submit Work: {selectedHwForSubmit.title}</h2>
                    <p className="text-xs text-[#64748B]">Enter answers or attach your completed solution sheet</p>
                  </div>
                  <button onClick={() => setSelectedHwForSubmit(null)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Submission Notes / Explanations / Answers *
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Detail your completed answers, question steps, or work summary..."
                      value={studentNotes}
                      onChange={(e) => setStudentNotes(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Attach Solution File (Optional)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#64748B] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#006FFF] file:text-white"
                    />
                    <p className="text-[11px] text-[#94A3B8] mt-1">Accepts PDF and images up to 25MB.</p>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
                    <button
                      type="button"
                      onClick={() => setSelectedHwForSubmit(null)}
                      className="px-3 py-2 rounded-xl text-xs text-[#64748B] hover:bg-[#F8FAFC]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {submitting ? 'Submitting...' : 'Confirm Submission'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Staff Create Homework Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl my-8">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#64748B]" /> Create Homework / Task
                  </h2>
                  <button onClick={() => setShowCreateModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateHomework} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Assignment Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chemical Bonding Practice Set & Exercise Questions"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Batch *</label>
                      <select
                        required
                        value={batchId}
                        onChange={(e) => {
                          setBatchId(e.target.value);
                          setSubjectId('');
                        }}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                      >
                        <option value="">Select Batch</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Subject Allocation</label>
                      <select
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        disabled={!batchId}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20 disabled:opacity-50"
                      >
                        <option value="">Entire Batch (Batch-wide)</option>
                        {availableSubjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `(${s.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Due Date *</label>
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Due Time</label>
                      <input
                        type="time"
                        value={dueTime}
                        onChange={(e) => setDueTime(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Publication Status *</label>
                    <select
                      value={isPublished ? 'PUBLISHED' : 'DRAFT'}
                      onChange={(e) => setIsPublished(e.target.value === 'PUBLISHED')}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                    >
                      <option value="PUBLISHED">Publish to Students Immediately</option>
                      <option value="DRAFT">Save as Draft (Faculty Only)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Instructions / Description</label>
                    <textarea
                      rows={2}
                      placeholder="Instructions for exercises, questions, or completion guidelines..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                      Attachment Worksheet / PDF (Optional)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#64748B] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#006FFF] file:text-white"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-[#F1F5F9]">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-3 py-2 text-xs text-[#64748B] hover:bg-[#F8FAFC] rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                    >
                      {submitting ? 'Publishing...' : isPublished ? 'Publish Homework' : 'Save Draft'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* Learning Material / Submission Preview Modal */}
          {previewMaterial && (
            <MaterialViewerModal
              material={previewMaterial}
              onClose={() => setPreviewMaterial(null)}
            />
          )}
        </>
      )}
    </div>
  );
};
