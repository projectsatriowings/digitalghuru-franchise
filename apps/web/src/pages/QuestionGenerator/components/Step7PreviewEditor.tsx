import React, { useState } from 'react';
import {
  QuestionPaperBlueprint,
  QuestionPaperSectionResult,
  GeneratedQuestion,
} from '../types';
import { apiFetch } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import {
  Printer,
  Download,
  KeyRound,
  Save,
  CheckCircle,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  ChevronLeft,
  FileCheck,
  AlertCircle,
  Building,
} from 'lucide-react';

interface Step7Props {
  blueprint: QuestionPaperBlueprint;
  sections: QuestionPaperSectionResult[];
  aiMetadata?: any;
  paperId?: string;
  paperStatus: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  onUpdateSections: (sections: QuestionPaperSectionResult[]) => void;
  onUpdateStatus: (status: 'DRAFT' | 'APPROVED' | 'ARCHIVED') => void;
  onSave: () => void;
  onBackToEdit: () => void;
  onOpenAnswerKey: () => void;
  onDuplicate: () => void;
  isSaving: boolean;
}

export const Step7PreviewEditor: React.FC<Step7Props> = ({
  blueprint,
  sections,
  aiMetadata,
  paperId,
  paperStatus,
  onUpdateSections,
  onUpdateStatus,
  onSave,
  onBackToEdit,
  onOpenAnswerKey,
  onDuplicate,
  isSaving,
}) => {
  const toast = useToast();
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Print Question Paper
  function handlePrint() {
    window.print();
  }

  // Update a question in place
  function handleQuestionChange(
    sectionId: string,
    questionId: string,
    updates: Partial<GeneratedQuestion>
  ) {
    const updated = sections.map((sec) => {
      if (sec.sectionId !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
      };
    });
    onUpdateSections(updated);
  }

  // Delete a question
  function handleDeleteQuestion(sectionId: string, questionId: string) {
    if (!window.confirm('Are you sure you want to remove this question?')) return;
    const updated = sections.map((sec) => {
      if (sec.sectionId !== sectionId) return sec;
      return {
        ...sec,
        questions: sec.questions.filter((q) => q.id !== questionId),
        printedQuestionCount: sec.questions.length - 1,
      };
    });
    onUpdateSections(updated);
    toast.info('Question removed. Remember to review section marks if needed.');
  }

  // Regenerate an individual question
  async function handleRegenerateQuestion(sectionId: string, question: GeneratedQuestion) {
    try {
      setRegeneratingId(question.id);
      const res = await apiFetch('/question-generator/regenerate-question', {
        method: 'POST',
        body: JSON.stringify({
          blueprint,
          sectionId,
          questionId: question.id,
          previousQuestionText: question.questionText,
          reason: 'Teacher requested fresh alternative question',
        }),
      });

      if (res.success && res.data?.question) {
        handleQuestionChange(sectionId, question.id, res.data.question);
        toast.success(`Question #${question.questionNumber} regenerated successfully!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate question');
    } finally {
      setRegeneratingId(null);
    }
  }

  // Add question manually to a section
  function handleAddQuestion(sectionId: string) {
    const sec = sections.find((s) => s.sectionId === sectionId);
    if (!sec) return;

    const totalQuestionsCount = sections.reduce((acc, s) => acc + s.questions.length, 0);
    const newQuestion: GeneratedQuestion = {
      id: `q-manual-${Date.now()}`,
      sectionId,
      questionNumber: totalQuestionsCount + 1,
      questionText: 'Enter your custom question text here...',
      questionType: sec.questionType,
      marks: sec.marksPerQuestion,
      difficulty: 'MEDIUM',
      chapterOrUnit: 'General',
      topic: 'Custom',
      options:
        sec.questionType === 'MCQ'
          ? [
              { key: 'A', text: 'Option A' },
              { key: 'B', text: 'Option B' },
              { key: 'C', text: 'Option C' },
              { key: 'D', text: 'Option D' },
            ]
          : undefined,
      correctAnswer: sec.questionType === 'MCQ' ? 'A' : undefined,
      answerKeyGuidance: `Marking criteria for ${sec.marksPerQuestion} marks.`,
    };

    const updated = sections.map((s) => {
      if (s.sectionId !== sectionId) return s;
      return {
        ...s,
        questions: [...s.questions, newQuestion],
        printedQuestionCount: s.questions.length + 1,
      };
    });

    onUpdateSections(updated);
    setEditingQuestionId(newQuestion.id);
    toast.success('Custom question added. You can edit the text directly.');
  }

  // Calculate total marks across updated sections
  let totalAttemptedMarks = 0;
  sections.forEach((sec) => {
    const req = sec.requiredQuestionCount ?? sec.questions.length;
    totalAttemptedMarks += req * sec.marksPerQuestion;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ACTION BAR (Hidden in Print) */}
      <div className="no-print p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onBackToEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Blueprint Stepper</span>
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                paperStatus === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              Status: {paperStatus}
            </span>

            {aiMetadata?.isMock && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]">
                Safe Mock Generated
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onOpenAnswerKey}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
            <span>Teacher Answer Key</span>
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#006FFF] transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-md transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {paperStatus !== 'APPROVED' && (
            <button
              type="button"
              onClick={() => {
                onUpdateStatus('APPROVED');
                onSave();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-[#2D1E18] text-white text-xs font-bold shadow-md transition"
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Approve Paper</span>
            </button>
          )}
        </div>
      </div>

      {/* PRINT CONTAINER / A4 QUESTION PAPER PREVIEW */}
      <div className="print-container bg-white border border-[#E2E8F0] rounded-3xl p-8 sm:p-12 shadow-xl text-[#1A1A1A] max-w-4xl mx-auto space-y-6">
        {/* HEADER SECTION */}
        <div className="text-center border-b-2 border-black pb-4 space-y-1">
          {blueprint.instituteLogoUrl && (
            <div className="flex justify-center mb-2">
              <img
                src={blueprint.instituteLogoUrl}
                alt="Institute Logo"
                className="h-14 object-contain"
              />
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
            {blueprint.instituteName}
          </h1>

          {blueprint.instituteAddress && (
            <p className="text-xs text-gray-700 font-medium">{blueprint.instituteAddress}</p>
          )}

          <div className="text-sm font-bold uppercase tracking-wider pt-1 text-black">
            {blueprint.examType} &bull; {blueprint.academicYear}
          </div>

          <div className="text-xs font-semibold text-gray-800">
            {blueprint.educationLevel === 'SCHOOL'
              ? `${blueprint.standard} &bull; ${blueprint.board || 'State Board'}`
              : `${blueprint.degree} &bull; ${blueprint.semester || 'Semester'} ${blueprint.department ? `(${blueprint.department})` : ''}`}
          </div>

          <div className="text-base font-extrabold uppercase pt-1 text-black">
            SUBJECT: {blueprint.subject.toUpperCase()} {blueprint.subjectCode ? `(${blueprint.subjectCode})` : ''}
          </div>
        </div>

        {/* METADATA BAR (DATE, DURATION, MARKS) */}
        <div className="flex items-center justify-between text-xs font-bold border-b border-black pb-2 pt-1 text-black">
          <div>
            {blueprint.examDate && (
              <span>Date: {new Date(blueprint.examDate).toLocaleDateString()}</span>
            )}
          </div>
          <div>Duration: {blueprint.durationMinutes} Minutes</div>
          <div>Maximum Marks: {blueprint.totalMarks}</div>
        </div>

        {/* CANDIDATE INSTRUCTIONS */}
        {blueprint.generalInstructions && blueprint.generalInstructions.length > 0 && (
          <div className="p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs space-y-1">
            <span className="font-bold block uppercase text-[11px] text-black">
              Instructions for Candidates:
            </span>
            <ol className="list-decimal list-inside space-y-0.5 text-gray-800 leading-relaxed text-[11px]">
              {blueprint.generalInstructions.map((inst, idx) => (
                <li key={idx}>{inst}</li>
              ))}
            </ol>
          </div>
        )}

        {/* SECTIONS & QUESTIONS */}
        <div className="space-y-8 pt-2">
          {sections.map((section, sIdx) => {
            let runningNumber = 1;
            // Calculate previous questions count
            for (let i = 0; i < sIdx; i++) {
              runningNumber += sections[i].questions.length;
            }

            return (
              <div key={section.sectionId} className="section-container space-y-4">
                {/* SECTION HEADING */}
                <div className="text-center border-y border-black py-1.5 bg-gray-50">
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-black">
                    {section.sectionLabel} {section.sectionTitle ? `- ${section.sectionTitle}` : ''}
                  </h2>
                  <div className="text-[11px] font-semibold text-gray-800 italic">
                    {section.instructions}
                  </div>
                </div>

                {/* QUESTIONS LIST */}
                <div className="space-y-4">
                  {section.questions.map((q, qIdx) => {
                    const isEditing = editingQuestionId === q.id;
                    const isRegenerating = regeneratingId === q.id;

                    return (
                      <div
                        key={q.id}
                        className={`question-item p-3 rounded-xl transition ${
                          isEditing
                            ? 'bg-amber-50/50 border border-amber-300'
                            : 'hover:bg-gray-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-sm text-black shrink-0">
                                {q.questionNumber || qIdx + 1}.
                              </span>

                              {isEditing ? (
                                <textarea
                                  rows={2}
                                  value={q.questionText}
                                  onChange={(e) =>
                                    handleQuestionChange(section.sectionId, q.id, {
                                      questionText: e.target.value,
                                    })
                                  }
                                  className="w-full bg-white border border-gray-400 rounded-lg p-2 text-xs text-black font-serif"
                                />
                              ) : (
                                <div className="text-xs sm:text-sm font-serif text-black leading-relaxed">
                                  {q.questionText}
                                </div>
                              )}
                            </div>

                            {/* MCQ OPTIONS */}
                            {q.questionType === 'MCQ' && q.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                                {q.options.map((opt, oIdx) => (
                                  <div key={opt.key || oIdx} className="text-xs text-gray-900 font-serif flex items-center gap-1.5">
                                    <span className="font-bold">({opt.key})</span>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={opt.text}
                                        onChange={(e) => {
                                          const newOpts = [...q.options!];
                                          newOpts[oIdx] = { ...opt, text: e.target.value };
                                          handleQuestionChange(section.sectionId, q.id, {
                                            options: newOpts,
                                          });
                                        }}
                                        className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs flex-1"
                                      />
                                    ) : (
                                      <span>{opt.text}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* EITHER / OR CHOICE INDICATOR */}
                            {q.internalChoiceGroupId && q.isAlternativeChoice && (
                              <div className="text-center font-bold text-xs uppercase text-gray-700 py-1">
                                [ OR ]
                              </div>
                            )}
                          </div>

                          {/* MARKS DISPLAY */}
                          <div className="shrink-0 text-right">
                            <span className="font-bold text-xs sm:text-sm text-black font-mono">
                              [{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}]
                            </span>
                          </div>
                        </div>

                        {/* QUESTION CONTROLS (Hidden during print) */}
                        <div className="no-print mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                          <div className="flex items-center gap-3">
                            <span>Chapter: <strong className="text-gray-700">{q.chapterOrUnit || 'General'}</strong></span>
                            <span>&bull;</span>
                            <span>Cognitive: <strong className="text-gray-700">{q.cognitiveLevel || 'Understanding'}</strong></span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                              className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 flex items-center gap-1 font-medium transition"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isEditing ? 'Done' : 'Edit'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRegenerateQuestion(section.sectionId, q)}
                              disabled={isRegenerating}
                              className="px-2 py-1 rounded hover:bg-gray-200 text-gray-700 flex items-center gap-1 font-medium transition"
                              title="Regenerate this question with AI"
                            >
                              <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-[#64748B]' : ''}`} />
                              <span>Regenerate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(section.sectionId, q.id)}
                              className="px-2 py-1 rounded hover:bg-rose-100 text-rose-600 flex items-center gap-1 font-medium transition"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADD QUESTION BUTTON (Hidden during print) */}
                <div className="no-print pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleAddQuestion(section.sectionId)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-[#E2E8F0] hover:border-[#6D4C41] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question to {section.sectionLabel}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="text-center border-t border-black pt-4 text-xs font-bold tracking-wider text-black">
          *** END OF QUESTION PAPER ***
        </div>
      </div>
    </div>
  );
};

