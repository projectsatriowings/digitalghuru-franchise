import { markNotificationEntityAsRead } from '../services/notificationService';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  HelpCircle,
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Award,
  Play,
  Eye,
  Trash2,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';

interface QuizManagerProps {
  isStaffOrAdmin: boolean;
  isStudent: boolean;
  batches: any[];
}

export const QuizManager: React.FC<QuizManagerProps> = ({
  isStaffOrAdmin,
  isStudent,
  batches,
}) => {
  const toast = useToast();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Quiz Builder Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'questions'>('details');
  useBodyScrollLock(showCreateModal);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [isPublished, setIsPublished] = useState(true);
  const [questions, setQuestions] = useState<Array<{
    questionText: string;
    questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
    marks: number;
    explanation?: string;
    options: Array<{ optionText: string; isCorrect: boolean }>;
  }>>([
    {
      questionText: '',
      questionType: 'SINGLE_CHOICE',
      marks: 1,
      options: [
        { optionText: '', isCorrect: true },
        { optionText: '', isCorrect: false },
      ],
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Student Quiz Taking State
  const [activeQuizForTaker, setActiveQuizForTaker] = useState<any | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [takerTimerSeconds, setTakerTimerSeconds] = useState<number | null>(null);
  const [takerSubmitting, setTakerSubmitting] = useState(false);
  const [takerResult, setTakerResult] = useState<any | null>(null);
  const takerResultRef = useRef<any | null>(null);
  const selectedAnswersRef = useRef<Record<string, string[]>>({});
  const timerIntervalRef = useRef<any>(null);

  // Staff Submissions Analytics Drawer
  const [analyticsQuiz, setAnalyticsQuiz] = useState<any | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    try {
      setLoading(true);
      const res = await apiFetch('/quizzes');
      if (res.success) {
        setQuizzes(res.data.quizzes || []);
      }
    } catch (err: any) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  }

  // Derive available subjects for selected batch in builder
  const selectedBatchObj = batches.find((b) => b.id === batchId);
  const availableSubjects: any[] = selectedBatchObj?.batchSubjects?.map((bs: any) => bs.subject).filter(Boolean) || [];

  // Question builder helpers
  function handleAddQuestion() {
    setQuestions([
      ...questions,
      {
        questionText: '',
        questionType: 'SINGLE_CHOICE',
        marks: 1,
        options: [
          { optionText: '', isCorrect: true },
          { optionText: '', isCorrect: false },
        ],
      },
    ]);
  }

  function handleRemoveQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function handleAddOption(qIndex: number) {
    const next = [...questions];
    next[qIndex].options.push({ optionText: '', isCorrect: false });
    setQuestions(next);
  }

  function handleRemoveOption(qIndex: number, optIndex: number) {
    const next = [...questions];
    if (next[qIndex].options.length <= 2) return;
    next[qIndex].options = next[qIndex].options.filter((_, i) => i !== optIndex);
    setQuestions(next);
  }

  function handleToggleCorrect(qIndex: number, optIndex: number) {
    const next = [...questions];
    const q = next[qIndex];
    if (q.questionType === 'SINGLE_CHOICE') {
      q.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optIndex;
      });
    } else {
      q.options[optIndex].isCorrect = !q.options[optIndex].isCorrect;
    }
    setQuestions(next);
  }

  async function handleCreateQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) {
      setMessage({ text: 'Please select a batch for this quiz', type: 'error' });
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setMessage({ text: `Question ${i + 1} text cannot be empty`, type: 'error' });
        return;
      }
      const hasCorrect = q.options.some((o) => o.isCorrect);
      if (!hasCorrect) {
        setMessage({ text: `Question ${i + 1} must have at least one correct option checked`, type: 'error' });
        return;
      }
      for (const opt of q.options) {
        if (!opt.optionText.trim()) {
          setMessage({ text: `Question ${i + 1} has an empty option text`, type: 'error' });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const res = await apiFetch('/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          batchId,
          subjectId: subjectId || null,
          title: title.trim(),
          instructions: instructions.trim() || null,
          durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
          maxAttempts: maxAttempts ? parseInt(maxAttempts, 10) : 1,
          isPublished,
          questions,
        }),
      });

      if (res.success) {
        setMessage({
          text: isPublished
            ? 'Quiz published to enrolled students!'
            : 'Quiz saved as draft for faculty review.',
          type: 'success',
        });
        setShowCreateModal(false);
        resetForm();
        loadQuizzes();
      } else {
        setMessage({ text: res.error || 'Failed to create quiz', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create quiz', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle('');
    setInstructions('');
    setBatchId('');
    setSubjectId('');
    setDurationMinutes('15');
    setMaxAttempts('1');
    setIsPublished(true);
    setActiveModalTab('details');
    setQuestions([
      {
        questionText: '',
        questionType: 'SINGLE_CHOICE',
        marks: 1,
        options: [
          { optionText: '', isCorrect: true },
          { optionText: '', isCorrect: false },
        ],
      },
    ]);
  }

  async function handleTogglePublish(quiz: any) {
    try {
      const nextStatus = !quiz.isPublished;
      const res = await apiFetch(`/quizzes/${quiz.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: nextStatus }),
      });
      if (res.success) {
        toast.success(nextStatus ? 'Quiz published to enrolled students!' : 'Quiz moved to drafts.');
        loadQuizzes();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quiz status');
    }
  }

  async function handleToggleReleaseResults(quiz: any) {
    try {
      const nextStatus = !quiz.resultsReleased;
      const res = await apiFetch(`/quizzes/${quiz.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resultsReleased: nextStatus }),
      });
      if (res.success) {
        toast.success(nextStatus ? 'Answer key & results released to students!' : 'Quiz results hidden.');
        loadQuizzes();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle results release');
    }
  }

  async function handleDeleteQuiz(quizId: string) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      const res = await apiFetch(`/quizzes/${quizId}`, { method: 'DELETE' });
      if (res.success) {
        toast.success('Quiz deleted successfully');
        loadQuizzes();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete quiz');
    }
  }

  // Student Start Quiz Taker
  async function handleStartQuiz(quiz: any) {
    try {
      setTakerSubmitting(true);
      const res = await apiFetch(`/quizzes/${quiz.id}/start`, { method: 'POST' });
      if (res.success && res.data) {
        setActiveQuizForTaker(res.data.quiz);
        setCurrentAttempt(res.data.attempt);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        selectedAnswersRef.current = {};
        setTakerResult(null);

        // Timer setup
        if (res.data.quiz.durationMinutes) {
          const totalSecs = res.data.quiz.durationMinutes * 60;
          setTakerTimerSeconds(totalSecs);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = setInterval(() => {
            setTakerTimerSeconds((prev) => {
              if (prev !== null && prev <= 1) {
                clearInterval(timerIntervalRef.current);
                handleAutoSubmit(res.data.quiz.id, res.data.attempt.id);
                return 0;
              }
              return prev !== null ? prev - 1 : null;
            });
          }, 1000);
        }
      } else {
        toast.error(res.error || 'Failed to start quiz');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start quiz');
    } finally {
      setTakerSubmitting(false);
    }
  }

  // Student View Review of Completed Quiz
  async function handleViewReview(quiz: any) {
    try {
      setTakerSubmitting(true);
      const res = await apiFetch(`/quizzes/${quiz.id}`);
      if (res.success && res.data?.quiz) {
        const fullQuiz = res.data.quiz;
        const attempt = fullQuiz.myAttempt;
        const questions = fullQuiz.questions || [];
        const totalMarks = attempt?.totalMarks !== null && attempt?.totalMarks !== undefined
          ? Number(attempt.totalMarks)
          : questions.reduce((sum: number, q: any) => sum + Number(q.marks || 1), 0);
        const score = attempt?.score !== null && attempt?.score !== undefined ? Number(attempt.score) : 0;
        const percentage = attempt?.percentage !== null && attempt?.percentage !== undefined
          ? Number(attempt.percentage)
          : (totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(1)) : 0);
        const correctCount = attempt?.correctCount !== undefined
          ? attempt.correctCount
          : questions.filter((q: any) => q.isCorrect).length;

        setActiveQuizForTaker(fullQuiz);
        setCurrentAttempt(attempt);
        setTakerTimerSeconds(null);
        setTakerResult({
          score,
          totalMarks,
          percentage,
          correctCount,
          totalQuestions: questions.length,
          resultsReleased: true,
          questions,
        });
      } else {
        toast.error(res.error || 'Failed to load quiz review');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load quiz review');
    } finally {
      setTakerSubmitting(false);
    }
  }

  function handleSelectOption(qId: string, optId: string, qType: string) {
    setSelectedAnswers((prev) => {
      let next: Record<string, string[]>;
      if (qType === 'SINGLE_CHOICE') {
        next = {
          ...prev,
          [qId]: [optId],
        };
      } else {
        const current = prev[qId] || [];
        const exists = current.includes(optId);
        const updated = exists ? current.filter((id) => id !== optId) : [...current, optId];
        next = {
          ...prev,
          [qId]: updated,
        };
      }
      selectedAnswersRef.current = next;
      return next;
    });
  }

  async function handleAutoSubmit(quizId: string, attemptId: string) {
    await handleSubmitQuiz(quizId, attemptId);
  }

  async function handleSubmitQuiz(quizId?: string, attemptId?: string) {
    const qId = quizId || activeQuizForTaker?.id;
    const attId = attemptId || currentAttempt?.id;
    if (!qId || !attId) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const currentAnswers = {
      ...selectedAnswers,
      ...(selectedAnswersRef.current || {}),
    };

    const totalQuestions = activeQuizForTaker?.questions?.length || 0;
    const answeredCount = Object.values(currentAnswers).filter((opts) => opts && opts.length > 0).length;

    // Safety check so student doesn't accidentally submit blank quiz
    if (answeredCount === 0 && totalQuestions > 0) {
      const proceed = confirm('You have not selected an answer for this question. Do you still want to submit?');
      if (!proceed) return;
    }

    try {
      setTakerSubmitting(true);
      const answersPayload = Object.entries(currentAnswers).map(([questionId, selectedOptionIds]) => ({
        questionId,
        selectedOptionIds,
      }));

      const res = await apiFetch(`/quizzes/${qId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attId,
          answers: answersPayload,
        }),
      });

      if (res.success && res.data) {
        setTakerResult(res.data);
        toast.success('Quiz submitted and evaluated successfully!');
        loadQuizzes();
      } else {
        toast.error(res.error || 'Failed to submit quiz answers');
      }
    } catch (err: any) {
      toast.error(err.message || 'Submission error');
    } finally {
      setTakerSubmitting(false);
    }
  }

  // Staff Submissions & Analytics
  async function openAnalytics(quiz: any) {
    setAnalyticsQuiz(quiz);
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch(`/quizzes/${quiz.id}/submissions`);
      if (res.success) {
        setAnalyticsData(res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  const filteredQuizzes = quizzes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.instructions && q.instructions.toLowerCase().includes(search.toLowerCase()));

    const matchesBatch = selectedBatchFilter === 'ALL' || q.batchId === selectedBatchFilter;
    let matchesStatus = true;
    if (selectedStatusFilter === 'PUBLISHED') matchesStatus = q.isPublished === true;
    if (selectedStatusFilter === 'DRAFT') matchesStatus = q.isPublished === false;

    return matchesSearch && matchesBatch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Quiz Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-[#64748B]" />
            <span>Interactive Quizzes & Assessments</span>
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Timed single & multiple choice quizzes with instant automated scoring
          </p>
        </div>

        {isStaffOrAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl font-semibold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Create New Quiz
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2.5 ${
            message.type === 'success'
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
            placeholder="Search quizzes by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
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

          {isStaffOrAdmin && (
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Drafts Only</option>
            </select>
          )}
        </div>
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#94A3B8] text-xs flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#006FFF] animate-ping"></div>
          <span>Loading quizzes...</span>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-xs shadow-sm space-y-2">
          <HelpCircle className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="font-semibold text-sm">No quizzes found.</p>
          <p className="text-[11px] text-[#94A3B8]">
            {isStaffOrAdmin
              ? 'Click "Create New Quiz" to publish your first assessment.'
              : 'Quizzes assigned to your batches will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className={`p-5 rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 ${
                !quiz.isPublished ? 'border-amber-300 bg-amber-50/20' : 'border-[#E2E8F0]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
                    <HelpCircle className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!quiz.isPublished && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                        Draft
                      </span>
                    )}
                    {quiz.resultsReleased && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Results Out
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]">
                      {quiz._count?.questions || 0} Questions
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-[#0F172A] text-base leading-snug">{quiz.title}</h3>
                  {quiz.instructions && (
                    <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{quiz.instructions}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-[#64748B]">
                  <span className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    {quiz.batch?.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                    {quiz.subject?.name || 'All Subjects'}
                  </span>
                  {quiz.durationMinutes && (
                    <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {quiz.durationMinutes} mins
                    </span>
                  )}
                </div>

                {/* Student specific attempt banner */}
                {isStudent && quiz.myAttempt && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">Your Score</span>
                      <p className="text-sm font-extrabold text-emerald-950">
                        {quiz.myAttempt.score} / {quiz.myAttempt.totalMarks} ({quiz.myAttempt.percentage}%)
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Evaluated
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#94A3B8]">
                  {new Date(quiz.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1.5">
                  {isStudent && (
                    <>
                      {!quiz.myAttempt ? (
                        <button
                          onClick={() => handleStartQuiz(quiz)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Start Quiz
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewReview(quiz)}
                          className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0] flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-700" /> View Evaluation & Review
                        </button>
                      )}
                    </>
                  )}

                  {isStaffOrAdmin && (
                    <>
                      <button
                        onClick={() => openAnalytics(quiz)}
                        className="p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1 transition-colors font-medium text-xs"
                        title="View student results and analytics"
                      >
                        <Users className="w-3.5 h-3.5" /> Submissions
                      </button>

                      <button
                        onClick={() => handleToggleReleaseResults(quiz)}
                        className={`p-2 rounded-xl border text-[11px] font-semibold transition-colors ${
                          quiz.resultsReleased
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={quiz.resultsReleased ? 'Hide answers from students' : 'Release answer keys to students'}
                      >
                        {quiz.resultsReleased ? 'Answers Released' : 'Release Key'}
                      </button>

                      <button
                        onClick={() => handleTogglePublish(quiz)}
                        className={`p-2 rounded-xl border text-[11px] font-semibold transition-colors ${
                          quiz.isPublished
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {quiz.isPublished ? 'Draft' : 'Publish'}
                      </button>

                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Staff Quiz Builder Modal */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">Create Interactive Quiz</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Configure questions, options, automated grading, and duration
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F8FAFC] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper / Tab Navigation */}
            <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-1.5 rounded-2xl border border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setActiveModalTab('details');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeModalTab === 'details'
                    ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeModalTab === 'details'
                      ? 'bg-[#006FFF] text-white'
                      : title.trim() && batchId
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#D7CCC8] text-[#006FFF]'
                  }`}
                >
                  {title.trim() && batchId && activeModalTab !== 'details' ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    '1'
                  )}
                </div>
                <span>1. Quiz Details</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    setMessage({ text: 'Please enter a quiz title before proceeding to questions', type: 'error' });
                    return;
                  }
                  if (!batchId) {
                    setMessage({ text: 'Please select a target batch before proceeding to questions', type: 'error' });
                    return;
                  }
                  setMessage(null);
                  setActiveModalTab('questions');
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeModalTab === 'questions'
                    ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    activeModalTab === 'questions'
                      ? 'bg-[#006FFF] text-white'
                      : 'bg-[#D7CCC8] text-[#006FFF]'
                  }`}
                >
                  2
                </div>
                <span>2. Questions & Options</span>
                <span className="text-[10px] bg-[#F1F5F9] px-2 py-0.5 rounded-full text-[#006FFF] font-bold">
                  {questions.length}
                </span>
              </button>
            </div>

            {/* Error / Alert banner inside modal */}
            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-rose-50 border border-rose-300 text-rose-800'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateQuiz} className="flex-1 overflow-y-auto pr-1 flex flex-col justify-between">
              {/* TAB 1: Quiz Details */}
              {activeModalTab === 'details' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Quiz Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chapter 4 Quiz: Quadratic Equations"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Target Batch *</label>
                      <select
                        value={batchId}
                        onChange={(e) => {
                          setBatchId(e.target.value);
                          setSubjectId('');
                        }}
                        required
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
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
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Subject (Optional)</label>
                      <select
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        disabled={!batchId}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 disabled:opacity-50"
                      >
                        <option value="">All Batch Curriculum</option>
                        {availableSubjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Duration (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Max Attempts</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#006FFF] mb-1">Publication</label>
                      <select
                        value={isPublished ? 'PUB' : 'DRAFT'}
                        onChange={(e) => setIsPublished(e.target.value === 'PUB')}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                      >
                        <option value="PUB">Publish Immediately</option>
                        <option value="DRAFT">Save as Draft</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#006FFF] mb-1">Instructions (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Choose the best answer for each question. Negative marking is not applied."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Questions & Options */}
              {activeModalTab === 'questions' && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A]">Questions ({questions.length})</h3>
                      <p className="text-[11px] text-[#64748B]">Configure questions, answer choices, and mark the correct option.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-3.5 py-1.5 bg-[#006FFF] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-[#0058D4] shadow-sm transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {questions.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#006FFF] text-white flex items-center justify-center text-xs font-bold">
                              {qIdx + 1}
                            </span>
                            <span className="text-xs font-bold text-[#006FFF]">Question #{qIdx + 1}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={q.questionType}
                              onChange={(e) => {
                                const next = [...questions];
                                next[qIdx].questionType = e.target.value as any;
                                setQuestions(next);
                              }}
                              className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#0F172A]"
                            >
                              <option value="SINGLE_CHOICE">Single Choice (Radio)</option>
                              <option value="MULTIPLE_CHOICE">Multiple Choice (Checkboxes)</option>
                            </select>
                            {questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(qIdx)}
                                className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-lg transition"
                                title="Remove Question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder={`Enter question ${qIdx + 1} prompt...`}
                          value={q.questionText}
                          onChange={(e) => {
                            const next = [...questions];
                            next[qIdx].questionText = e.target.value;
                            setQuestions(next);
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                        />

                        {/* Options */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#64748B]">
                              Answer Options (Select correct answer):
                            </span>
                            <span className="text-[10px] text-[#94A3B8] italic">
                              {q.questionType === 'SINGLE_CHOICE' ? 'Select 1 correct option' : 'Select 1 or more correct options'}
                            </span>
                          </div>

                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type={q.questionType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                                name={`correct-q-${qIdx}`}
                                checked={opt.isCorrect}
                                onChange={() => handleToggleCorrect(qIdx, oIdx)}
                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-[#4E342E]"
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                placeholder={`Option ${oIdx + 1}...`}
                                value={opt.optionText}
                                onChange={(e) => {
                                  const next = [...questions];
                                  next[qIdx].options[oIdx].optionText = e.target.value;
                                  setQuestions(next);
                                }}
                                className={`flex-1 bg-white border rounded-xl px-3 py-1.5 text-xs text-[#0F172A] ${
                                  opt.isCorrect ? 'border-emerald-500 ring-1 ring-emerald-500/30 font-medium' : 'border-[#E2E8F0]'
                                }`}
                              />
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(qIdx, oIdx)}
                                  className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition"
                                  title="Remove Option"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIdx)}
                            className="text-[11px] text-[#006FFF] font-semibold hover:underline flex items-center gap-1 mt-1.5"
                          >
                            <Plus className="w-3 h-3" /> Add Option
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Footer Navigation Based on Active Tab */}
              <div className="pt-4 flex items-center justify-between border-t border-[#F1F5F9] mt-4">
                {activeModalTab === 'details' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!title.trim()) {
                          setMessage({ text: 'Please enter a quiz title before proceeding to questions', type: 'error' });
                          return;
                        }
                        if (!batchId) {
                          setMessage({ text: 'Please select a target batch before proceeding to questions', type: 'error' });
                          return;
                        }
                        setMessage(null);
                        setActiveModalTab('questions');
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md transition-all"
                    >
                      <span>Continue to Questions</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(null);
                        setActiveModalTab('details');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Details</span>
                    </button>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-md transition-all disabled:opacity-50"
                      >
                        <span>{submitting ? 'Creating Quiz...' : isPublished ? 'Create & Publish Quiz' : 'Save as Draft'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Student Quiz Taker Modal */}
      {activeQuizForTaker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 w-full max-h-[88vh] flex flex-col space-y-4 shadow-2xl transition-all ${
            takerResult ? 'max-w-3xl' : 'max-w-2xl'
          }`}>
            {/* Header with Title, Status & Timer */}
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {activeQuizForTaker.title} {takerResult && '— Evaluation & Review'}
                </h2>
                <span className="text-xs text-[#64748B]">
                  {takerResult
                    ? `Total: ${takerResult.totalQuestions ?? activeQuizForTaker.questions.length} Questions Reviewed`
                    : `Question ${currentQuestionIndex + 1} of ${activeQuizForTaker.questions.length}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!takerResult && takerTimerSeconds !== null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-mono text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    {Math.floor(takerTimerSeconds / 60)}:{(takerTimerSeconds % 60).toString().padStart(2, '0')}
                  </div>
                )}
                {takerResult && (
                  <button
                    onClick={() => {
                      setActiveQuizForTaker(null);
                      setTakerResult(null);
                    }}
                    className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-xl transition"
                    title="Close Review"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quiz Result View or Question Taking View */}
            {takerResult ? (
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {/* Result Hero Header */}
                <div className="text-center space-y-2 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center mx-auto shadow-sm">
                    <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0F172A]">Quiz Submitted & Evaluated!</h3>
                    <p className="text-xs text-[#64748B]">Here is your verified score breakdown and detailed answer key review.</p>
                  </div>
                </div>

                {/* Score Summary Metrics (3-column responsive card grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <span className="text-[11px] font-semibold text-[#64748B] block">Your Score</span>
                    <p className="text-2xl font-black text-[#006FFF] mt-0.5">
                      {takerResult.score} <span className="text-sm font-semibold text-[#94A3B8]">/ {takerResult.totalMarks}</span>
                    </p>
                    <span className="text-[10px] text-[#94A3B8] font-medium block mt-0.5">Total Marks Awarded</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                    <span className="text-[11px] font-semibold text-emerald-800 block">Overall Percentage</span>
                    <p className="text-2xl font-black text-emerald-900 mt-0.5">
                      {takerResult.percentage}%
                    </p>
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                      {Number(takerResult.percentage) >= 50 ? 'Passed • Good Job!' : 'Requires Improvement'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-center">
                    <span className="text-[11px] font-semibold text-sky-800 block">Correct Answers</span>
                    <p className="text-2xl font-black text-sky-900 mt-0.5">
                      {takerResult.correctCount ?? (takerResult.questions?.filter((q: any) => q.isCorrect).length || 0)}{' '}
                      <span className="text-sm font-semibold text-sky-700">/ {takerResult.totalQuestions ?? (takerResult.questions?.length || activeQuizForTaker.questions.length)}</span>
                    </p>
                    <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
                      Questions Answered Correctly
                    </span>
                  </div>
                </div>

                {/* Detailed Answer Key & Question Review Section */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                        Question Review & Answer Key
                      </h4>
                    </div>
                    <span className="text-[11px] text-[#64748B]">
                      Review what you selected vs. correct options
                    </span>
                  </div>

                  <div className="space-y-4">
                    {(takerResult.questions || activeQuizForTaker.questions).map((q: any, qIdx: number) => {
                      const studentSelectedIds = q.selectedOptionIds || selectedAnswers[q.id] || [];
                      const isQuestionCorrect = q.isCorrect !== undefined
                        ? q.isCorrect
                        : q.options?.every((opt: any) => Boolean(opt.isCorrect) === studentSelectedIds.includes(opt.id));
                      const marksAwarded = q.marksAwarded !== undefined
                        ? q.marksAwarded
                        : (isQuestionCorrect ? (q.marks || 1) : 0);

                      return (
                        <div
                          key={q.id || qIdx}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            isQuestionCorrect
                              ? 'bg-emerald-50/30 border-emerald-200'
                              : studentSelectedIds.length > 0
                              ? 'bg-rose-50/20 border-rose-200'
                              : 'bg-[#F8FAFC] border-[#E2E8F0]'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                  isQuestionCorrect
                                    ? 'bg-emerald-700 text-white'
                                    : studentSelectedIds.length > 0
                                    ? 'bg-rose-700 text-white'
                                    : 'bg-[#8D6E63] text-white'
                                }`}
                              >
                                {qIdx + 1}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-[#0F172A] leading-relaxed">
                                  {q.questionText}
                                </p>
                                <span className="text-[10px] text-[#94A3B8]">
                                  Weightage: {Number(q.marks || 1)} Mark{Number(q.marks || 1) > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            <div className="self-start sm:self-auto shrink-0">
                              {isQuestionCorrect ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Correct (+{marksAwarded} mark)
                                </span>
                              ) : studentSelectedIds.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-300">
                                  <X className="w-3.5 h-3.5 stroke-[3]" /> Incorrect (0 mark)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300">
                                  <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Unanswered (0 mark)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Options Breakdown */}
                          <div className="space-y-2 pt-1">
                            {q.options?.map((opt: any, optIdx: number) => {
                              const optLetter = String.fromCharCode(65 + optIdx);
                              const isStudentPick = studentSelectedIds.includes(opt.id);
                              const isCorrectAnswer = opt.isCorrect === true || q.correctOptionIds?.includes(opt.id);

                              let borderBg = 'bg-white border-[#F1F5F9] text-[#006FFF]';
                              let badge = null;

                              if (isCorrectAnswer && isStudentPick) {
                                borderBg = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold shadow-sm';
                                badge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-200/80 text-emerald-900 text-[10px] font-bold">
                                    <Check className="w-3 h-3 stroke-[3]" /> Your Choice (Correct Answer)
                                  </span>
                                );
                              } else if (isCorrectAnswer && !isStudentPick) {
                                borderBg = 'bg-emerald-50/60 border-emerald-400 text-emerald-950 font-medium';
                                badge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-[10px] font-bold border border-emerald-300">
                                    <Check className="w-3 h-3 stroke-[3]" /> Correct Answer
                                  </span>
                                );
                              } else if (!isCorrectAnswer && isStudentPick) {
                                borderBg = 'bg-rose-50 border-rose-400 text-rose-950 font-semibold shadow-sm';
                                badge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-200/80 text-rose-900 text-[10px] font-bold">
                                    <X className="w-3 h-3 stroke-[3]" /> Your Choice (Incorrect)
                                  </span>
                                );
                              }

                              return (
                                <div
                                  key={opt.id || optIdx}
                                  className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${borderBg}`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                        isCorrectAnswer
                                          ? 'bg-emerald-700 text-white'
                                          : isStudentPick
                                          ? 'bg-rose-700 text-white'
                                          : 'bg-[#F1F5F9] text-[#64748B]'
                                      }`}
                                    >
                                      {optLetter}
                                    </span>
                                    <span className="leading-snug">{opt.optionText}</span>
                                  </div>
                                  {badge && <div className="self-end sm:self-auto shrink-0">{badge}</div>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Optional Explanation */}
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
                              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                              <div className="leading-relaxed">
                                <span className="font-bold text-amber-900 block mb-0.5">Explanation / Note:</span>
                                <span>{q.explanation}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[11px] text-[#64748B]">Evaluation complete • Results saved to your academic record</span>
                  <button
                    onClick={() => {
                      setActiveQuizForTaker(null);
                      setTakerResult(null);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-md transition"
                  >
                    Close Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-5">
                {activeQuizForTaker.questions[currentQuestionIndex] && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {activeQuizForTaker.questions[currentQuestionIndex].questionText}
                    </p>

                    <div className="space-y-2.5">
                      {activeQuizForTaker.questions[currentQuestionIndex].options.map((opt: any, optIdx: number) => {
                        const qId = activeQuizForTaker.questions[currentQuestionIndex].id;
                        const isSelected = (selectedAnswers[qId] || []).includes(opt.id);
                        const optLetter = String.fromCharCode(65 + optIdx);
                        return (
                          <label
                            key={opt.id}
                            onClick={() =>
                              handleSelectOption(
                                qId,
                                opt.id,
                                activeQuizForTaker.questions[currentQuestionIndex].questionType
                              )
                            }
                            className={`p-3.5 rounded-2xl border text-xs cursor-pointer flex items-center justify-between gap-3 transition-all ${
                              isSelected
                                ? 'bg-[#006FFF] text-white border-[#006FFF] shadow-sm'
                                : 'bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-white text-[#006FFF]'
                                    : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                                }`}
                              >
                                {optLetter}
                              </span>
                              <span className="font-medium text-xs leading-relaxed">{opt.optionText}</span>
                            </div>
                            <span
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-white bg-white text-[#006FFF]'
                                  : 'border-[#8D6E63] bg-white'
                              }`}
                            >
                              {isSelected ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-transparent" />
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            {!takerResult && (
              <div className="pt-3 flex items-center justify-between border-t border-[#F1F5F9]">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] disabled:opacity-40 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>

                {currentQuestionIndex < activeQuizForTaker.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                    className="px-4 py-1.5 rounded-xl bg-[#006FFF] text-white text-xs font-semibold flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={takerSubmitting}
                    onClick={() => handleSubmitQuiz()}
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {takerSubmitting ? 'Submitting...' : 'Submit Answers'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff Quiz Submissions / Analytics Modal */}
      {analyticsQuiz && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">{analyticsQuiz.title} — Results</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Batch: {analyticsQuiz.batch?.name} • Total Marks: {analyticsQuiz.totalMarks}
                </p>
              </div>
              <button onClick={() => setAnalyticsQuiz(null)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAnalytics || !analyticsData ? (
              <div className="py-12 text-center text-xs text-[#94A3B8]">Loading submissions...</div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[11px] text-[#64748B] font-semibold">Total Students</span>
                    <p className="text-xl font-bold text-[#0F172A] mt-1">{analyticsData.analytics?.totalEligible}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 font-semibold">Completed</span>
                    <p className="text-xl font-bold text-emerald-900 mt-1">{analyticsData.analytics?.completedCount}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-[11px] text-amber-800 font-semibold">In Progress</span>
                    <p className="text-xl font-bold text-amber-900 mt-1">{analyticsData.analytics?.inProgressCount}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200">
                    <span className="text-[11px] text-sky-800 font-semibold">Average Score</span>
                    <p className="text-xl font-bold text-sky-900 mt-1">{analyticsData.analytics?.avgScore}</p>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#006FFF] font-semibold">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Admission No</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Score</th>
                        <th className="p-3">Percentage</th>
                        <th className="p-3">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFEBE9]">
                      {analyticsData.roster?.map((item: any) => (
                        <tr key={item.student.id} className="hover:bg-[#FAF7F5]">
                          <td className="p-3 font-medium text-[#0F172A]">
                            {item.student.firstName} {item.student.lastName}
                          </td>
                          <td className="p-3 text-[#64748B] font-mono">{item.student.admissionNumber}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-[#006FFF]">
                            {item.score !== null ? `${item.score} / ${item.totalMarks}` : '—'}
                          </td>
                          <td className="p-3 text-[#64748B]">{item.percentage !== null ? `${item.percentage}%` : '—'}</td>
                          <td className="p-3 text-[#94A3B8]">
                            {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-[#F1F5F9]">
              <button
                onClick={() => setAnalyticsQuiz(null)}
                className="px-5 py-2 rounded-xl bg-[#006FFF] text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

