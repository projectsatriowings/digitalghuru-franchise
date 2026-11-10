import { markNotificationEntityAsRead } from '../services/notificationService';
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp,
  Star,
  MessageCircle,
  Plus,
  User,
  Send,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  X,
  RotateCw,
  AlertCircle,
  BookOpen,
  Award,
  Filter,
  Search,
  Eye,
  Edit3,
  Clock,
  Check,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ArrowLeft,
  FileText,
} from 'lucide-react';

export const ProgressReviewsManagement: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isParent = user?.role === 'PARENT';
  const isStudent = user?.role === 'STUDENT';
  const isStaffOrAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ACADEMIC_ADMIN' || user?.role === 'STAFF';

  // Sub-tabs
  const [activeTab, setActiveTab] = useState<'progress' | 'log-report' | 'parent_inquiries' | 'inquiries'>('progress');
  const [activeFormSection, setActiveFormSection] = useState<'all' | 'target' | 'metrics' | 'remarks'>('all');
  // Enforce role visibility
  useEffect(() => {
    if (isStudent && activeTab !== 'progress') {
      setActiveTab('progress');
    } else if (isParent && activeTab === 'log-report') {
      setActiveTab('progress');
    }
  }, [isStudent, isParent, activeTab]);

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff Parent Feedback State
  const [parentFeedbacks, setParentFeedbacks] = useState<any[]>([]);
  const [feedbackFilterStatus, setFeedbackFilterStatus] = useState<string>('ALL');
  const [feedbackFilterCategory, setFeedbackFilterCategory] = useState<string>('ALL');
  const [respondingFeedback, setRespondingFeedback] = useState<any | null>(null);
  const [staffResponseText, setStaffResponseText] = useState<string>('');
  const [staffResponseStatus, setStaffResponseStatus] = useState<'RESPONDED' | 'RESOLVED'>('RESPONDED');
  const [submittingStaffResponse, setSubmittingStaffResponse] = useState<boolean>(false);

  // Tab 1: Academic Progress Reports
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Tab 2: Parent Inquiries
  const [reviews, setReviews] = useState<any[]>([]);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('ALL');
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'REPLIED' | 'RESOLVED'>('REPLIED');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Parent form states
  const [myChildren, setMyChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryCategory, setInquiryCategory] = useState('ACADEMIC');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  // Staff Progress Report Form State
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [loadingBatchStudents, setLoadingBatchStudents] = useState(false);
  const [formBatchId, setFormBatchId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formTermName, setFormTermName] = useState('Quarter 1 Progress Review');
  const [formPeriodType, setFormPeriodType] = useState<'WEEKLY' | 'MONTHLY' | 'TERM' | 'ANNUAL'>('TERM');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formRecommendations, setFormRecommendations] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Real-time metrics preview
  const [metricsPreview, setMetricsPreview] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    loadInitialFilters();
  }, []);

  useEffect(() => {
    if (activeTab === 'parent_inquiries') {
      loadParentFeedbacks();
    } else {
      loadData();
    }
  }, [activeTab, selectedBatchFilter, selectedSubjectFilter, selectedStatusFilter, selectedPeriodFilter, feedbackFilterStatus, feedbackFilterCategory]);

  useEffect(() => {
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'FEEDBACK_CREATED' || payload.type === 'FEEDBACK_UPDATED') {
            if (activeTab === 'parent_inquiries') {
              loadParentFeedbacks();
            }
          }
        } catch (e) {}
      };
    } catch (err) {}

    return () => {
      if (es) es.close();
    };
  }, [activeTab, feedbackFilterStatus, feedbackFilterCategory]);

  async function loadParentFeedbacks() {
    try {
      setLoading(true);
      let queryParams: string[] = [];
      if (feedbackFilterStatus && feedbackFilterStatus !== 'ALL') {
        queryParams.push(`status=${feedbackFilterStatus}`);
      }
      if (feedbackFilterCategory && feedbackFilterCategory !== 'ALL') {
        queryParams.push(`category=${encodeURIComponent(feedbackFilterCategory)}`);
      }
      const qs = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await apiFetch(`/feedback${qs}`);
      if (res.success && res.data?.feedbacks) {
        setParentFeedbacks(res.data.feedbacks);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffSubmitResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!respondingFeedback || !staffResponseText.trim() || submittingStaffResponse) return;

    try {
      setSubmittingStaffResponse(true);
      const res = await apiFetch(`/feedback/${respondingFeedback.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          response: staffResponseText.trim(),
          status: staffResponseStatus,
        }),
      });

      if (res.success) {
        setRespondingFeedback(null);
        setStaffResponseText('');
        setStaffResponseStatus('RESPONDED');
        await loadParentFeedbacks();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmittingStaffResponse(false);
    }
  }

  async function handleStaffUpdateStatus(id: string, status: 'OPEN' | 'RESPONDED' | 'RESOLVED') {
    try {
      const res = await apiFetch(`/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res.success) {
        await loadParentFeedbacks();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update feedback status');
    }
  }

  // Load batch/subject filters and linked children
  async function loadInitialFilters() {
    try {
      if (isStaffOrAdmin) {
        const [batchesRes, subjectsRes] = await Promise.all([
          apiFetch('/academics/batches').catch(() => ({ success: false, data: { batches: [] } })),
          apiFetch('/academics/subjects').catch(() => ({ success: false, data: { subjects: [] } })),
        ]);
        if (batchesRes.success && batchesRes.data?.batches) {
          setBatches(batchesRes.data.batches);
        }
        if (subjectsRes.success && subjectsRes.data?.subjects) {
          setSubjects(subjectsRes.data.subjects);
        }
      } else if (isParent) {
        const childRes = await apiFetch('/parents/my/children').catch(() => ({ success: false, data: { children: [] } }));
        if (childRes.success && childRes.data?.children) {
          const kids = childRes.data.children;
          setMyChildren(kids);
          if (kids.length > 0 && !selectedChildId) {
            setSelectedChildId(kids[0].student.id);
          }
        }
      }
    } catch (e) {
      console.warn('[Initial filters load warning]', e);
    }
  }

  // Fetch data based on active tab
  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'progress') {
        const queryParams = new URLSearchParams();
        if (selectedBatchFilter) queryParams.set('batchId', selectedBatchFilter);
        if (selectedSubjectFilter) queryParams.set('subjectId', selectedSubjectFilter);
        if (selectedStatusFilter !== 'ALL') queryParams.set('status', selectedStatusFilter);
        if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());

        const qStr = queryParams.toString();
        const res = await apiFetch(`/progress${qStr ? '?' + qStr : ''}`);
        if (res.success && res.data?.feedbacks) {
          setFeedbacks(res.data.feedbacks);
        } else {
          setFeedbacks([]);
        }
      } else if (activeTab === 'inquiries') {
        if (isStudent) return;
        const res = await apiFetch('/reviews?type=FEEDBACK');
        if (res.success && res.data?.reviews) {
          setReviews(res.data.reviews);
        } else {
          setReviews([]);
        }
      }
    } catch (err: any) {
      console.error('[Progress & Reviews Load Error]', err);
      setError(err.message || 'Unable to load records from the server.');
    } finally {
      setLoading(false);
    }
  }

  // Derive subjects specifically for the selected batch in the creation/editing modal
  const selectedBatchObj = batches.find((b) => b.id === formBatchId);
  const modalAvailableSubjects: any[] = selectedBatchObj?.batchSubjects?.map((bs: any) => bs.subject).filter(Boolean) || [];

  // When staff selects a batch in the modal, load enrolled students
  async function handleBatchChange(batchId: string) {
    setFormBatchId(batchId);
    setFormStudentId('');
    setBatchStudents([]);
    setMetricsPreview(null);

    // Auto-select single subject if only 1 exists for this batch/staff, otherwise reset
    const batchObj = batches.find((b) => b.id === batchId);
    const batchSubs = batchObj?.batchSubjects?.map((bs: any) => bs.subject).filter(Boolean) || [];
    if (batchSubs.length === 1) {
      setFormSubjectId(batchSubs[0].id);
    } else {
      setFormSubjectId('');
    }

    if (!batchId) return;

    try {
      setLoadingBatchStudents(true);
      const res = await apiFetch(`/students?batchId=${batchId}&status=ACTIVE&limit=100`);
      if (res.success && res.data?.students) {
        setBatchStudents(res.data.students);
      }
    } catch (err) {
      console.error('[Load batch students error]', err);
    } finally {
      setLoadingBatchStudents(false);
    }
  }

  // When student or dates change in modal, fetch real-time performance indicators
  useEffect(() => {
    if (!formStudentId || !formBatchId) {
      setMetricsPreview(null);
      return;
    }

    let active = true;
    async function fetchMetrics() {
      try {
        setLoadingMetrics(true);
        const q = new URLSearchParams({
          studentId: formStudentId,
          batchId: formBatchId,
          ...(formSubjectId ? { subjectId: formSubjectId } : {}),
          ...(formStartDate ? { startDate: formStartDate } : {}),
          ...(formEndDate ? { endDate: formEndDate } : {}),
        });
        const res = await apiFetch(`/progress/metrics-preview?${q.toString()}`);
        if (active && res.success && res.data?.metrics) {
          setMetricsPreview(res.data.metrics);
        }
      } catch (e) {
        console.warn('[Fetch metrics preview warning]', e);
      } finally {
        if (active) setLoadingMetrics(false);
      }
    }

    fetchMetrics();
    return () => {
      active = false;
    };
  }, [formStudentId, formBatchId, formSubjectId, formStartDate, formEndDate]);

  // Handle Create or Update Progress Report
  async function handleSubmitFeedback(isPublishAction: boolean) {
    if (!formStudentId || !formBatchId || !formRemarks.trim()) {
      toast.warning('Please select student, batch, and provide teacher remarks.');
      return;
    }

    try {
      setSubmittingFeedback(true);
      const payload = {
        studentId: formStudentId,
        batchId: formBatchId,
        subjectId: formSubjectId || null,
        termName: formTermName.trim(),
        periodType: formPeriodType,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
        remarks: formRemarks.trim(),
        rating: Number(formRating),
        strengths: formStrengths.trim() || null,
        improvements: formImprovements.trim() || null,
        recommendations: formRecommendations.trim() || null,
        isPublished: isPublishAction,
      };

      let res;
      if (editingFeedbackId) {
        res = await apiFetch(`/progress/${editingFeedbackId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch('/progress', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (res.success) {
        toast.success(
          isPublishAction
            ? 'Academic progress report published successfully!'
            : 'Progress report draft saved successfully.'
        );
        resetFeedbackForm();
        setActiveTab('progress');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save progress report');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  // Publish a draft report directly from list
  async function handleDirectPublish(feedbackId: string) {
    if (!window.confirm('Publish this report officially? The student and linked parents will be notified immediately.')) return;
    try {
      const res = await apiFetch(`/progress/${feedbackId}/publish`, { method: 'PATCH' });
      if (res.success) {
        toast.success('Report published officially!');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish report');
    }
  }

  // Delete a report
  async function handleDeleteFeedback(feedbackId: string) {
    if (!window.confirm('Are you sure you want to delete this progress report?')) return;
    try {
      const res = await apiFetch(`/progress/${feedbackId}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Progress report deleted successfully');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete report');
    }
  }

  // Open Edit Form in Section Tab
  function handleEditReport(fb: any) {
    setEditingFeedbackId(fb.id);
    setFormBatchId(fb.batchId);
    setFormSubjectId(fb.subjectId || '');
    setFormStudentId(fb.studentId);
    setFormTermName(fb.termName);
    setFormPeriodType(fb.periodType || 'TERM');
    setFormStartDate(fb.startDate ? fb.startDate.slice(0, 10) : '');
    setFormEndDate(fb.endDate ? fb.endDate.slice(0, 10) : '');
    setFormRemarks(fb.remarks || '');
    setFormRating(fb.rating || 5);
    setFormStrengths(fb.strengths || '');
    setFormImprovements(fb.improvements || '');
    setFormRecommendations(fb.recommendations || '');
    handleBatchChange(fb.batchId);
    setActiveFormSection('all');
    setActiveTab('log-report');
  }

  function resetFeedbackForm() {
    setEditingFeedbackId(null);
    setFormBatchId('');
    setFormSubjectId('');
    setFormStudentId('');
    setFormTermName('Quarter 1 Progress Review');
    setFormPeriodType('TERM');
    setFormStartDate('');
    setFormEndDate('');
    setFormRemarks('');
    setFormRating(5);
    setFormStrengths('');
    setFormImprovements('');
    setFormRecommendations('');
    setBatchStudents([]);
    setMetricsPreview(null);
    setActiveFormSection('all');
  }

  // Parent submits private inquiry/feedback
  async function handleSubmitInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryMessage.trim()) return;

    try {
      setSubmittingInquiry(true);
      const res = await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          type: 'FEEDBACK',
          studentId: selectedChildId || null,
          subject: inquirySubject.trim() || 'Parent Feedback',
          category: inquiryCategory,
          reviewText: inquiryMessage.trim(),
        }),
      });

      if (res.success) {
        toast.success('Thank you! Your private feedback has been delivered to faculty.');
        setInquirySubject('');
        setInquiryMessage('');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingInquiry(false);
    }
  }

  // Staff replies to private feedback or review
  async function handleSendReply(reviewId: string) {
    if (!replyText.trim()) return;

    try {
      setSubmittingReply(true);
      const res = await apiFetch(`/reviews/${reviewId}/reply`, {
        method: 'PATCH',
        body: JSON.stringify({
          replyText: replyText.trim(),
          status: replyStatus,
        }),
      });

      if (res.success) {
        toast.success('Reply delivered successfully');
        setReplyingReviewId(null);
        setReplyText('');
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setSubmittingReply(false);
    }
  }

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (selectedPeriodFilter !== 'ALL' && fb.periodType !== selectedPeriodFilter) return false;
    return true;
  });

  const filteredInquiries = reviews.filter((r) => {
    if (inquiryStatusFilter !== 'ALL' && r.status !== inquiryStatusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-[#64748B]" />
            <span>{isStudent ? 'Academic Progress Reports' : 'Academic Progress & Parent Reviews'}</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            {isStudent
              ? 'Official faculty evaluations, milestone reports, and teacher observations for your academic journey'
              : 'Teacher observations, student milestone reports, and confidential parent inquiries'}
          </p>
        </div>

        {isStaffOrAdmin && activeTab === 'progress' && (
          <button
            onClick={() => {
              resetFeedbackForm();
              setActiveTab('log-report');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl font-bold text-xs shadow-sm self-start sm:self-auto transition-all"
          >
            <Plus className="w-4 h-4" /> Log Progress Report
          </button>
        )}
      </div>

      {/* Primary Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'progress'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Academic Progress Reports
          {feedbacks.length > 0 && (
            <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[10px]">
              {feedbacks.length}
            </span>
          )}
        </button>

        {isStaffOrAdmin && (
          <button
            onClick={() => {
              if (activeTab !== 'log-report') {
                resetFeedbackForm();
              }
              setActiveTab('log-report');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'log-report'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Plus className="w-4 h-4" /> {editingFeedbackId ? 'Edit Progress Report' : 'Log Academic Report'}
          </button>
        )}
        {isStaffOrAdmin && (
          <button
            onClick={() => setActiveTab('parent_inquiries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'parent_inquiries'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Parent Feedback & Inquiries
          </button>
        )}
        {!isStudent && (
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Private Parent Inquiries
            {reviews.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded-full text-[10px]">
                {reviews.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ERROR STATE WITH RETRY */}
      {error && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Failed to Load Progress & Reviews</p>
              <p className="text-rose-700">{error}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex-shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* TAB 1: ACADEMIC PROGRESS REPORTS */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          {/* Filters Bar (Student) */}
          {isStudent && (
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#006FFF]">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </div>

              {/* Period Type Filter */}
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-medium focus:ring-1 focus:ring-[#006FFF]/20"
              >
                <option value="ALL">All Periods</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="TERM">Term / Midterm</option>
                <option value="ANNUAL">Annual</option>
              </select>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search evaluations or remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                />
              </div>

              {(selectedPeriodFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedPeriodFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-[#94A3B8] hover:text-[#0F172A] underline font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Filters Bar (Staff & Admin) */}
          {isStaffOrAdmin && (
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#006FFF]">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </div>

              {/* Batch Filter */}
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-medium focus:ring-1 focus:ring-[#006FFF]/20"
              >
                <option value="">All Assigned Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-medium focus:ring-1 focus:ring-[#006FFF]/20"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-medium focus:ring-1 focus:ring-[#006FFF]/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="DRAFT">Drafts Only</option>
              </select>

              {/* Period Type Filter */}
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-medium focus:ring-1 focus:ring-[#006FFF]/20"
              >
                <option value="ALL">All Periods</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="TERM">Term / Midterm</option>
                <option value="ANNUAL">Annual</option>
              </select>

              {/* Search Bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search student or remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                />
              </div>

              {(selectedBatchFilter || selectedSubjectFilter || selectedStatusFilter !== 'ALL' || selectedPeriodFilter !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedBatchFilter('');
                    setSelectedSubjectFilter('');
                    setSelectedStatusFilter('ALL');
                    setSelectedPeriodFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-[#94A3B8] hover:text-[#0F172A] underline font-medium"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {/* LOADING STATE */}
          {loading ? (
            <div className="p-16 text-center text-[#94A3B8] text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#006FFF] animate-ping" />
              <span className="font-bold text-[#006FFF]">Loading academic progress reports...</span>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-xs shadow-sm space-y-3">
              <Sparkles className="w-8 h-8 text-[#94A3B8] mx-auto opacity-40" />
              <h3 className="font-bold text-[#0F172A] text-sm">No Progress Reports Found</h3>
              <p className="max-w-md mx-auto text-[#64748B]">
                {isStaffOrAdmin
                  ? 'No academic progress reports match the selected filters. Click "Log Progress Report" to draft an evaluation.'
                  : 'No published progress reports are available for your account at this time.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredFeedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]">
                          {fb.periodType || 'TERM'} &bull; {fb.termName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${fb.isPublished
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                        >
                          {fb.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-[#0F172A] text-base mt-2">
                        {fb.student ? `${fb.student.firstName} ${fb.student.lastName}` : 'Enrolled Student'}
                        {fb.student?.admissionNumber && (
                          <span className="text-xs text-[#94A3B8] font-normal ml-2">
                            ({fb.student.admissionNumber})
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-[#64748B] flex items-center gap-2 mt-0.5">
                        <span>Batch: <strong>{fb.batch?.name}</strong></span>
                        {fb.subject && <span>&bull; Subject: <strong>{fb.subject.name}</strong></span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                      <span>{fb.rating || 5}/5</span>
                    </div>
                  </div>

                  {/* Auto-Calculated Metrics Bar */}
                  {(fb.attendanceRate !== null || fb.homeworkRate !== null || fb.examAverage !== null) && (
                    <div className="grid grid-cols-3 gap-2 bg-[#F8FAFC] p-2.5 rounded-2xl border border-[#E2E8F0]/60 text-center">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8]">Attendance</span>
                        <strong className="text-xs font-black text-[#0F172A]">
                          {fb.attendanceRate !== null ? `${Number(fb.attendanceRate)}%` : 'N/A'}
                        </strong>
                      </div>
                      <div className="border-x border-[#E2E8F0]/60">
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8]">Homework</span>
                        <strong className="text-xs font-black text-[#0F172A]">
                          {fb.homeworkRate !== null ? `${Number(fb.homeworkRate)}%` : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8]">Test Average</span>
                        <strong className="text-xs font-black text-[#0F172A]">
                          {fb.examAverage !== null ? `${Number(fb.examAverage)}%` : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Teacher Observations / Remarks */}
                  <p className="text-xs text-[#0F172A] leading-relaxed bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                    "{fb.remarks}"
                  </p>

                  {/* Strengths, Improvements, Recommendations */}
                  <div className="space-y-2 text-xs">
                    {fb.strengths && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <strong className="block text-[10px] uppercase font-bold text-emerald-800 mb-0.5">
                          Key Strengths:
                        </strong>
                        {fb.strengths}
                      </div>
                    )}
                    {fb.improvements && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                        <strong className="block text-[10px] uppercase font-bold text-amber-800 mb-0.5">
                          Growth Areas:
                        </strong>
                        {fb.improvements}
                      </div>
                    )}
                    {fb.recommendations && (
                      <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900">
                        <strong className="block text-[10px] uppercase font-bold text-sky-800 mb-0.5">
                          Recommended Actions:
                        </strong>
                        {fb.recommendations}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#94A3B8]">
                    <span>
                      Faculty: <strong>{fb.staff?.fullName || 'Assigned Staff'}</strong> &bull;{' '}
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>

                    {/* Staff Actions */}
                    {isStaffOrAdmin && (
                      <div className="flex items-center gap-2">
                        {!fb.isPublished && (
                          <button
                            onClick={() => handleDirectPublish(fb.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] shadow-sm transition-all"
                          >
                            Publish Now
                          </button>
                        )}
                        <button
                          onClick={() => handleEditReport(fb)}
                          className="p-1 text-[#64748B] hover:text-[#0F172A]"
                          title="Edit Report"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="p-1 text-rose-600 hover:text-rose-800"
                          title="Delete Report"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Parent Feedback & Inquiries */}
      {activeTab === 'parent_inquiries' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['ALL', 'OPEN', 'RESPONDED', 'RESOLVED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFeedbackFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    feedbackFilterStatus === st
                      ? 'bg-[#006FFF] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {st === 'ALL' ? 'All Feedback' : st === 'OPEN' ? 'Open / Pending' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#64748B]">Category:</label>
              <select
                value={feedbackFilterCategory}
                onChange={(e) => setFeedbackFilterCategory(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              >
                <option value="ALL">All Categories</option>
                <option value="Academic Progress">Academic Progress</option>
                <option value="Teaching Method">Teaching Method</option>
                <option value="Attendance">Attendance</option>
                <option value="Student Behaviour">Student Behaviour</option>
                <option value="Homework">Homework</option>
                <option value="General Feedback">General Feedback</option>
              </select>
            </div>
          </div>

          {/* Feedback List */}
          {loading ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm">Loading parent feedback & inquiries...</div>
          ) : parentFeedbacks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-[#94A3B8]" />
              <p>No parent feedback found matching the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {parentFeedbacks.map((fb) => (
                <div
                  key={fb.id}
                  className="bg-white border border-[#E2E8F0] rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#006FFF]/10 text-[#006FFF] border border-[#E2E8F0]">
                        {fb.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          fb.status === 'RESOLVED'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : fb.status === 'RESPONDED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {fb.status === 'OPEN' ? 'Awaiting Response' : fb.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {new Intl.DateTimeFormat('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(fb.createdAt))}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#94A3B8]">Student:</span>{' '}
                      <strong className="text-[#0F172A]">
                        {fb.student?.firstName} {fb.student?.lastName}
                      </strong>{' '}
                      {fb.student?.admissionNumber && (
                        <span className="text-[11px] text-[#64748B]">({fb.student.admissionNumber})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#94A3B8]">Submitted By:</span>{' '}
                      <strong className="text-[#0F172A]">
                        {fb.parent?.user?.fullName || 'Parent'}
                      </strong>
                      {fb.parent?.user?.phone && (
                        <span className="text-[11px] text-[#64748B] ml-1">({fb.parent.user.phone})</span>
                      )}
                    </div>
                  </div>

                  {/* Feedback Text */}
                  <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] leading-relaxed">
                    "{fb.feedbackText}"
                  </div>

                  {/* Teacher Response Display */}
                  {fb.teacherResponse && (
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 mb-1">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          Faculty Response {fb.respondedBy?.fullName ? `(${fb.respondedBy.fullName})` : ''}:
                        </span>
                        {fb.respondedAt && (
                          <span className="text-[10px] font-normal text-emerald-700">
                            {new Intl.DateTimeFormat('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(fb.respondedAt))}
                          </span>
                        )}
                      </div>
                      <p className="leading-relaxed">{fb.teacherResponse}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {isStaffOrAdmin && (
                    <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-[#F1F5F9]">
                      {fb.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleStaffUpdateStatus(fb.id, 'RESOLVED')}
                          className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-all"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRespondingFeedback(fb);
                          setStaffResponseText(fb.teacherResponse || '');
                          setStaffResponseStatus(fb.status === 'RESOLVED' ? 'RESOLVED' : 'RESPONDED');
                        }}
                        className="px-4 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {fb.teacherResponse ? 'Update Response' : 'Reply to Parent'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Response Modal for Parent Feedback */}
      {respondingFeedback && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-[#E2E8F0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#006FFF]" /> Respond to Parent Feedback
              </h3>
              <button
                onClick={() => setRespondingFeedback(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#64748B] font-semibold">
                <span>Student: {respondingFeedback.student?.firstName} {respondingFeedback.student?.lastName}</span>
                <span>Category: {respondingFeedback.category}</span>
              </div>
              <p className="italic">"{respondingFeedback.feedbackText}"</p>
            </div>

            <form onSubmit={handleStaffSubmitResponse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">Your Response *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide detailed feedback or resolution actions for the parent..."
                  value={staffResponseText}
                  onChange={(e) => setStaffResponseText(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-[11px] text-[#64748B] font-semibold">Update Status:</label>
                  <select
                    value={staffResponseStatus}
                    onChange={(e) => setStaffResponseStatus(e.target.value as any)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1 text-xs font-semibold text-[#0F172A]"
                  >
                    <option value="RESPONDED">Responded</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRespondingFeedback(null)}
                    className="px-3 py-1.5 text-xs text-[#64748B] hover:bg-[#F8FAFC] rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingStaffResponse}
                    className="px-4 py-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingStaffResponse ? 'Saving...' : 'Submit Response'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PRIVATE PARENT INQUIRIES */}
      {!isStudent && activeTab === 'inquiries' && (
        <div className="space-y-6">
          {/* Parent Submission Card */}
          {isParent && (
            <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#64748B]" /> Send Private Feedback to Faculty
              </h2>
              <p className="text-xs text-[#64748B]">
                Messages submitted here are strictly confidential and shared only with authorized teaching staff and administrators.
              </p>

              <form onSubmit={handleSubmitInquiry} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Select Child *</label>
                    <select
                      required
                      value={selectedChildId}
                      onChange={(e) => setSelectedChildId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                    >
                      <option value="">Select Child</option>
                      {myChildren.map((c) => (
                        <option key={c.student.id} value={c.student.id}>
                          {c.student.firstName} {c.student.lastName} ({c.student.admissionNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Category *</label>
                    <select
                      value={inquiryCategory}
                      onChange={(e) => setInquiryCategory(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                    >
                      <option value="ACADEMIC">Academic Progress</option>
                      <option value="SCHEDULE">Class Timetable</option>
                      <option value="FACILITIES">Course Center Facilities</option>
                      <option value="BEHAVIOR">Student Behavior / Attendance</option>
                      <option value="BILLING">Fee & Finances</option>
                      <option value="GENERAL">General Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Subject / Topic *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mathematics problem sheet help"
                      value={inquirySubject}
                      onChange={(e) => setInquirySubject(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">Message Details *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details regarding your query or observation..."
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingInquiry}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submittingInquiry ? 'Sending...' : 'Send Private Inquiry'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Inquiries List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0F172A]">
                {isParent ? 'Your Feedback & Responses' : 'Parent Inquiries Feed'} ({filteredInquiries.length})
              </h3>

              {isStaffOrAdmin && (
                <div className="flex items-center gap-2">
                  <select
                    value={inquiryStatusFilter}
                    onChange={(e) => setInquiryStatusFilter(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1 text-xs text-[#0F172A]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="NEW">New Inquiries</option>
                    <option value="REPLIED">Replied</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#94A3B8]">Loading inquiries...</div>
            ) : filteredInquiries.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-xs text-[#94A3B8]">
                No private parent feedback records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInquiries.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D7CCC8]/40 text-[#006FFF]">
                            {rev.category || 'GENERAL'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${rev.status === 'NEW'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : rev.status === 'RESOLVED'
                                  ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                          >
                            {rev.status}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-[#0F172A] text-sm mt-1.5">{rev.subject}</h4>
                        <span className="text-[11px] text-[#64748B]">
                          From: <strong>{rev.parent?.user?.fullName || 'Parent'}</strong>
                          {rev.student && (
                            <> &bull; Regarding: <strong>{rev.student.firstName} {rev.student.lastName}</strong></>
                          )}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">{new Date(rev.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] leading-relaxed">
                      "{rev.reviewText}"
                    </p>

                    {/* Reply Section */}
                    {rev.replyText && (
                      <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
                        <strong className="text-[10px] uppercase font-bold text-emerald-900 block flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-700" /> Faculty Response:
                        </strong>
                        <p className="text-emerald-950 leading-relaxed">{rev.replyText}</p>
                        {rev.repliedAt && (
                          <span className="text-[10px] text-emerald-700 block text-right">
                            {new Date(rev.repliedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Staff Reply Controls */}
                    {isStaffOrAdmin && replyingReviewId !== rev.id && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => {
                            setReplyingReviewId(rev.id);
markNotificationEntityAsRead('PROGRESS_REPORT', rev.id);
                            setReplyText(rev.replyText || '');
                          }}
                          className="flex items-center gap-1 text-xs text-[#006FFF] hover:underline font-bold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {rev.replyText ? 'Edit Response' : 'Reply to Parent'}
                        </button>
                      </div>
                    )}

                    {isStaffOrAdmin && replyingReviewId === rev.id && (
                      <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                        <textarea
                          rows={2}
                          placeholder="Type faculty response..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#006FFF]/20"
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs">
                            <label className="text-[11px] text-[#64748B] font-semibold">Mark as:</label>
                            <select
                              value={replyStatus}
                              onChange={(e) => setReplyStatus(e.target.value as any)}
                              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2 py-0.5 text-xs"
                            >
                              <option value="REPLIED">Replied</option>
                              <option value="RESOLVED">Resolved</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setReplyingReviewId(null)}
                              className="px-2.5 py-1 text-xs text-[#94A3B8]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSendReply(rev.id)}
                              disabled={submittingReply}
                              className="px-3.5 py-1 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-lg text-xs font-bold"
                            >
                              {submittingReply ? 'Sending...' : 'Submit Reply'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LOG / EDIT ACADEMIC PROGRESS REPORT (IN-PAGE SECTION TAB) */}
      {isStaffOrAdmin && activeTab === 'log-report' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-6">
            {/* Header with Title & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9] text-[#006FFF]">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-[#0F172A]">
                      {editingFeedbackId ? 'Edit Academic Progress Report' : 'Log Academic Progress Report'}
                    </h2>
                    {editingFeedbackId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Editing Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Official faculty evaluation, database-verified student performance aggregates, and actionable recommendations.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    resetFeedbackForm();
                    setActiveTab('progress');
                  }}
                  className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-xl transition-all border border-[#E2E8F0] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Reports List
                </button>
              </div>
            </div>

            {/* In-Form Section Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveFormSection('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFormSection === 'all'
                    ? 'bg-[#006FFF] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                All Sections
              </button>
              <button
                type="button"
                onClick={() => setActiveFormSection('target')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFormSection === 'target'
                    ? 'bg-[#006FFF] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                1. Target Student & Term
              </button>
              <button
                type="button"
                onClick={() => setActiveFormSection('metrics')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFormSection === 'metrics'
                    ? 'bg-[#006FFF] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                2. System Performance Aggregates
              </button>
              <button
                type="button"
                onClick={() => setActiveFormSection('remarks')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFormSection === 'remarks'
                    ? 'bg-[#006FFF] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                3. Teacher Observations & Actions
              </button>
            </div>

            <div className="space-y-6">
              {/* SECTION 1: TARGET STUDENT & ACADEMIC ALLOCATION */}
              {(activeFormSection === 'all' || activeFormSection === 'target') && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF7F5] border border-[#F1F5F9] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#F1F5F9]">
                    <span className="w-6 h-6 rounded-lg bg-[#006FFF] text-white text-xs font-bold flex items-center justify-center">1</span>
                    <h3 className="text-sm font-bold text-[#0F172A]">Target Student & Academic Term Details</h3>
                  </div>

                  {/* Batch, Subject, Student Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Batch *</label>
                      <select
                        required
                        disabled={!!editingFeedbackId}
                        value={formBatchId}
                        onChange={(e) => handleBatchChange(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-medium shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
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
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Subject (Optional)</label>
                      <select
                        disabled={!formBatchId}
                        value={formSubjectId}
                        onChange={(e) => setFormSubjectId(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-medium shadow-sm focus:ring-1 focus:ring-[#006FFF]/20 disabled:opacity-50"
                      >
                        <option value="">All / Comprehensive (Batch-wide)</option>
                        {modalAvailableSubjects.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `(${s.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">
                        Student * {loadingBatchStudents && <span className="font-normal text-[10px] text-[#94A3B8]">(Loading students...)</span>}
                      </label>
                      <select
                        required
                        disabled={!!editingFeedbackId || !formBatchId}
                        value={formStudentId}
                        onChange={(e) => setFormStudentId(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-medium shadow-sm focus:ring-1 focus:ring-[#006FFF]/20 disabled:opacity-50"
                      >
                        <option value="">Select Enrolled Student</option>
                        {batchStudents.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.firstName} {st.lastName} ({st.admissionNumber})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Term, Period Type, Rating Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Report Title / Term *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. October Monthly Progress Review"
                        value={formTermName}
                        onChange={(e) => setFormTermName(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Period Type</label>
                      <select
                        value={formPeriodType}
                        onChange={(e) => setFormPeriodType(e.target.value as any)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="TERM">Term / Midterm</option>
                        <option value="ANNUAL">Annual</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Overall Rating</label>
                      <select
                        value={formRating}
                        onChange={(e) => setFormRating(parseInt(e.target.value, 10))}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      >
                        <option value={5}>5 Stars - Excellent</option>
                        <option value={4}>4 Stars - Very Good</option>
                        <option value={3}>3 Stars - Satisfactory</option>
                        <option value={2}>2 Stars - Needs Attention</option>
                        <option value={1}>1 Star - Unsatisfactory</option>
                      </select>
                    </div>
                  </div>

                  {/* Date Range Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Period Start Date (Optional)</label>
                      <input
                        type="date"
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">Period End Date (Optional)</label>
                      <input
                        type="date"
                        value={formEndDate}
                        onChange={(e) => setFormEndDate(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: SYSTEM PERFORMANCE AGGREGATES */}
              {(activeFormSection === 'all' || activeFormSection === 'metrics') && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF7F5] border border-[#F1F5F9] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#006FFF] text-white text-xs font-bold flex items-center justify-center">2</span>
                      <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-[#64748B]" /> System Performance Aggregates
                      </h3>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] italic">
                      Derived in real-time from active database records
                    </span>
                  </div>

                  {loadingMetrics ? (
                    <div className="text-center py-6 text-xs text-[#94A3B8] flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full bg-[#006FFF] animate-ping" />
                      <span>Calculating performance statistics...</span>
                    </div>
                  ) : metricsPreview ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-center text-xs">
                      <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-[#94A3B8] block tracking-wider">Attendance Rate</span>
                        <strong className="text-xl font-black text-[#0F172A] mt-1 block">
                          {metricsPreview.attendance.attendanceRate !== null ? `${metricsPreview.attendance.attendanceRate}%` : 'N/A'}
                        </strong>
                        <span className="text-[11px] text-[#94A3B8] mt-0.5 block">
                          {metricsPreview.attendance.presentCount} of {metricsPreview.attendance.totalSessions} sessions attended
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-[#94A3B8] block tracking-wider">Homework Completion</span>
                        <strong className="text-xl font-black text-[#0F172A] mt-1 block">
                          {metricsPreview.homework.homeworkRate !== null ? `${metricsPreview.homework.homeworkRate}%` : 'N/A'}
                        </strong>
                        <span className="text-[11px] text-[#94A3B8] mt-0.5 block">
                          {metricsPreview.homework.completedCount} of {metricsPreview.homework.totalAssigned} tasks submitted
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-[#94A3B8] block tracking-wider">Exams Average</span>
                        <strong className="text-xl font-black text-[#0F172A] mt-1 block">
                          {metricsPreview.exams.examAverage !== null ? `${metricsPreview.exams.examAverage}%` : 'N/A'}
                        </strong>
                        <span className="text-[11px] text-[#94A3B8] mt-0.5 block">
                          {metricsPreview.exams.passedCount} of {metricsPreview.exams.totalExams} tests passed
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[#94A3B8] bg-white rounded-2xl border border-dashed border-[#E2E8F0]">
                      Select an enrolled student to automatically load attendance, homework, and exam statistics.
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: TEACHER OBSERVATIONS & RECOMMENDATIONS */}
              {(activeFormSection === 'all' || activeFormSection === 'remarks') && (
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF7F5] border border-[#F1F5F9] space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#F1F5F9]">
                    <span className="w-6 h-6 rounded-lg bg-[#006FFF] text-white text-xs font-bold flex items-center justify-center">3</span>
                    <h3 className="text-sm font-bold text-[#0F172A]">Teacher Observations & Recommendations</h3>
                  </div>

                  {/* Teacher Remarks */}
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">
                      Teacher Remarks & Observations <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Assess student comprehension, engagement, homework discipline, class participation, and areas of growth..."
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20 leading-relaxed"
                    />
                  </div>

                  {/* Strengths & Growth Areas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Key Strengths</label>
                      <input
                        type="text"
                        placeholder="e.g. Quick problem solving, neat presentations, active questions"
                        value={formStrengths}
                        onChange={(e) => setFormStrengths(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#006FFF] mb-1">Growth Areas</label>
                      <input
                        type="text"
                        placeholder="e.g. Needs to practice quadratic formula proofs and speed"
                        value={formImprovements}
                        onChange={(e) => setFormImprovements(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                      />
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  <div>
                    <label className="block text-xs font-bold text-[#006FFF] mb-1">Recommended Actions for Student / Parent</label>
                    <input
                      type="text"
                      placeholder="e.g. 20 minutes daily revision and attend Friday doubt-clearing sessions"
                      value={formRecommendations}
                      onChange={(e) => setFormRecommendations(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] shadow-sm focus:ring-1 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Form Actions */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => {
                  resetFeedbackForm();
                  setActiveTab('progress');
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-[#64748B] hover:text-[#0F172A] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-xl transition-colors border border-[#E2E8F0]"
              >
                Cancel & Discard
              </button>

              <div className="w-full sm:w-auto flex items-center gap-3">
                <button
                  type="button"
                  disabled={submittingFeedback}
                  onClick={() => handleSubmitFeedback(false)}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#FAF7F5] hover:bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0] rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submittingFeedback}
                  onClick={() => handleSubmitFeedback(true)}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{submittingFeedback ? 'Publishing...' : 'Publish Official Report'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
