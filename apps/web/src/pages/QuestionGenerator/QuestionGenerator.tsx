import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../services/api';
import {
  QuestionPaperBlueprint,
  QuestionPaperSectionResult,
  EducationLevel,
} from './types';
import { Step1Institute } from './components/Step1Institute';
import { Step2Education } from './components/Step2Education';
import { Step3Syllabus } from './components/Step3Syllabus';
import { Step4PatternBuilder } from './components/Step4PatternBuilder';
import { Step5Settings } from './components/Step5Settings';
import { Step6ValidateGenerate } from './components/Step6ValidateGenerate';
import { Step7PreviewEditor } from './components/Step7PreviewEditor';
import { AnswerKeyModal } from './components/AnswerKeyModal';
import { SavedPapersDrawer } from './components/SavedPapersDrawer';
import {
  Sparkles,
  Building,
  GraduationCap,
  BookOpen,
  Calculator,
  Settings2,
  ShieldCheck,
  Eye,
  FolderArchive,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

const STEP_DEFINITIONS = [
  { step: 1, label: 'Institute', icon: Building, desc: 'Branding & header' },
  { step: 2, label: 'Education', icon: GraduationCap, desc: 'School vs College' },
  { step: 3, label: 'Syllabus', icon: BookOpen, desc: 'Chapters & topics' },
  { step: 4, label: 'Marks Pattern', icon: Calculator, desc: 'Sections & math' },
  { step: 5, label: 'Settings', icon: Settings2, desc: 'Rigor & rules' },
  { step: 6, label: 'Generate', icon: ShieldCheck, desc: 'AI synthesis' },
  { step: 7, label: 'Preview & Export', icon: Eye, desc: 'Edit, print, key' },
];

export const QuestionGenerator: React.FC = () => {
  const { user, activeInstitute } = useAuth();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isAnswerKeyOpen, setIsAnswerKeyOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Loaded config from backend
  const [configData, setConfigData] = useState<any>(null);

  // Active Question Paper State
  const [paperId, setPaperId] = useState<string | undefined>(undefined);
  const [paperStatus, setPaperStatus] = useState<'DRAFT' | 'APPROVED' | 'ARCHIVED'>('DRAFT');
  const [generatedSections, setGeneratedSections] = useState<QuestionPaperSectionResult[]>([]);
  const [aiMetadata, setAiMetadata] = useState<any>(null);

  // Default Blueprint
  const [blueprint, setBlueprint] = useState<QuestionPaperBlueprint>({
    instituteName: activeInstitute?.name || 'Tuition Academy',
    academicYear: '2026-2027',
    educationLevel: 'SCHOOL',
    board: 'Tamil Nadu State Board (Samacheer Kalvi)',
    standard: 'Class 10',
    subject: 'Mathematics',
    examType: 'Quarterly Exam',
    language: 'ENGLISH',
    durationMinutes: 90,
    totalMarks: 50,
    passingMarks: 20,
    generalInstructions: [
      'Check whether the question paper contains all printed pages and questions.',
      'Answer all questions in Section A. Read choices carefully in other sections.',
      'Write neatly and legibly. Use of standard non-programmable calculators is allowed where specified.',
    ],
    syllabusDetails: {
      mode: 'PRELOADED',
      coverageType: 'FULL',
      chaptersOrUnits: [
        { name: 'Relations and Functions', topics: ['Ordered Pairs', 'Relations', 'Functions'] },
        { name: 'Numbers and Sequences', topics: ['Euclid Division Lemma', 'AP and GP'] },
        { name: 'Algebra', topics: ['Quadratic Equations', 'Matrices'] },
      ],
    },
    sections: [
      {
        id: 'sec-1',
        sectionLabel: 'Part A',
        sectionTitle: 'Multiple Choice Questions',
        questionType: 'MCQ',
        marksPerQuestion: 1,
        numberOfQuestions: 10,
        requiredQuestions: 10,
      },
      {
        id: 'sec-2',
        sectionLabel: 'Part B',
        sectionTitle: 'Short Answer Questions',
        questionType: 'SHORT_ANSWER',
        marksPerQuestion: 2,
        numberOfQuestions: 7,
        requiredQuestions: 5,
      },
      {
        id: 'sec-3',
        sectionLabel: 'Part C',
        sectionTitle: 'Detailed Questions (Answer 4 of 6)',
        questionType: 'LONG_ANSWER',
        marksPerQuestion: 5,
        numberOfQuestions: 6,
        requiredQuestions: 4,
      },
      {
        id: 'sec-4',
        sectionLabel: 'Part D',
        sectionTitle: 'Practical / Problem Solving',
        questionType: 'ESSAY',
        marksPerQuestion: 10,
        numberOfQuestions: 1,
        requiredQuestions: 1,
      },
    ],
    difficulty: 'BALANCED',
  });

  // Fetch config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Update institute defaults when active institute changes
  useEffect(() => {
    if (activeInstitute) {
      setBlueprint((prev) => ({
        ...prev,
        instituteName: activeInstitute.name || prev.instituteName,
      }));
    }
  }, [activeInstitute]);

  async function loadConfig() {
    try {
      const res = await apiFetch('/question-generator/config');
      if (res.success) {
        setConfigData(res.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch generator config:', err);
    }
  }

  function updateBlueprint(updates: Partial<QuestionPaperBlueprint>) {
    setBlueprint((prev) => ({ ...prev, ...updates }));
  }

  function handleResetTemplate() {
    if (!window.confirm('Reset blueprint to initial default template?')) return;
    setPaperId(undefined);
    setPaperStatus('DRAFT');
    setGeneratedSections([]);
    setAiMetadata(null);
    setCurrentStep(1);
    toast.info('Blueprint reset to defaults.');
  }

  async function handleLoadSavedPaper(selectedId: string) {
    try {
      const res = await apiFetch(`/question-generator/papers/${selectedId}`);
      if (res.success && res.data?.paper) {
        const p = res.data.paper;
        setPaperId(p.id);
        setPaperStatus(p.status);
        setGeneratedSections(p.sections || []);
        setAiMetadata(p.aiMetadata);

        setBlueprint({
          instituteName: p.instituteName,
          instituteAddress: p.instituteAddress,
          instituteLogoUrl: p.instituteLogoUrl,
          academicYear: p.academicYear,
          examDate: p.examDate,
          educationLevel: p.educationLevel,
          board: p.educationLevel === 'SCHOOL' ? p.boardOrCourse : undefined,
          standard: p.educationLevel === 'SCHOOL' ? p.standardOrDegree : undefined,
          degree: p.educationLevel === 'COLLEGE' ? p.standardOrDegree : undefined,
          department: p.department,
          semester: p.semester,
          subject: p.subject,
          subjectCode: p.subjectCode,
          examType: p.examType,
          language: p.language,
          durationMinutes: p.durationMinutes,
          totalMarks: p.totalMarks,
          passingMarks: p.passingMarks,
          generalInstructions: p.generalInstructions,
          syllabusDetails: {
            mode: 'MANUAL',
            coverageType: 'FULL',
            chaptersOrUnits: [],
            portionsSummary: p.syllabusSummary,
          },
          sections: p.sections.map((s: any) => ({
            id: s.sectionId,
            sectionLabel: s.sectionLabel,
            sectionTitle: s.sectionTitle,
            instructions: s.instructions,
            questionType: s.questionType,
            marksPerQuestion: s.marksPerQuestion,
            numberOfQuestions: s.printedQuestionCount,
            requiredQuestions: s.requiredQuestionCount,
          })),
          difficulty: 'BALANCED',
        });

        setCurrentStep(7);
        toast.success(`Loaded "${p.title}" successfully.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load paper details');
    }
  }

  async function handleSavePaper() {
    try {
      setIsSaving(true);
      const res = await apiFetch('/question-generator/papers', {
        method: 'POST',
        body: JSON.stringify({
          id: paperId,
          blueprint,
          sections: generatedSections,
          status: paperStatus,
          aiMetadata,
          title: `${blueprint.subject} - ${blueprint.examType} (${blueprint.academicYear})`,
        }),
      });

      if (res.success && res.data?.paper) {
        setPaperId(res.data.paper.id);
        toast.success(`Question paper saved as ${paperStatus}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save question paper');
    } finally {
      setIsSaving(false);
    }
  }

  function handleGenerationSuccess(result: any) {
    setGeneratedSections(result.sections || []);
    setAiMetadata(result.aiMetadata);
    setCurrentStep(7);
  }

  return (
    <div className="space-y-6">
      {/* MODULE HEADER BAR */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#E2E8F0] p-5 sm:p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3E2723] to-[#6D4C41] flex items-center justify-center font-bold text-white shadow-md shadow-[#006FFF]/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-[#0F172A] tracking-tight">
                AI Question Paper Generator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#006FFF]/10 text-[#006FFF] border border-[#6D4C41]/30">
                School &bull; College
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Production exam blueprinting with strict marks calculation, multi-board curricula, and print-ready export.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            type="button"
            onClick={handleResetTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition"
            title="Reset to default blueprint template"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSavedDrawerOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-md transition"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Saved Papers</span>
          </button>
        </div>
      </div>

      {/* STEPPER NAVIGATION BAR (Hidden in Step 7 preview or during print) */}
      <div className="no-print bg-white border border-[#E2E8F0] rounded-2xl p-3 shadow-sm overflow-x-auto">
        <div className="flex items-center min-w-[700px] justify-between">
          {STEP_DEFINITIONS.map((def, idx) => {
            const Icon = def.icon;
            const isCompleted = currentStep > def.step;
            const isCurrent = currentStep === def.step;

            return (
              <React.Fragment key={def.step}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(def.step)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left ${
                    isCurrent
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : isCompleted
                      ? 'text-[#0F172A] hover:bg-[#F8FAFC]'
                      : 'text-[#94A3B8] hover:text-[#006FFF]'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-white/20 text-white'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-[#F8FAFC] text-[#94A3B8]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">
                      Step {def.step}: {def.label}
                    </div>
                    <div
                      className={`text-[10px] leading-tight ${
                        isCurrent ? 'text-[#D7CCC8]' : 'text-[#94A3B8]'
                      }`}
                    >
                      {def.desc}
                    </div>
                  </div>
                </button>

                {idx < STEP_DEFINITIONS.length - 1 && (
                  <div className="w-4 h-[1px] bg-[#D7CCC8] shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP BODY CONTAINER */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-sm">
        {currentStep === 1 && (
          <Step1Institute blueprint={blueprint} onChange={updateBlueprint} />
        )}

        {currentStep === 2 && (
          <Step2Education blueprint={blueprint} onChange={updateBlueprint} />
        )}

        {currentStep === 3 && (
          <Step3Syllabus
            blueprint={blueprint}
            onChange={updateBlueprint}
            preloadedCurricula={configData?.preloadedCurricula}
          />
        )}

        {currentStep === 4 && (
          <Step4PatternBuilder
            blueprint={blueprint}
            onChange={updateBlueprint}
            questionTypesList={configData?.questionTypes}
          />
        )}

        {currentStep === 5 && (
          <Step5Settings blueprint={blueprint} onChange={updateBlueprint} />
        )}

        {currentStep === 6 && (
          <Step6ValidateGenerate
            blueprint={blueprint}
            aiProviderInfo={configData?.aiProvider}
            onGenerateSuccess={handleGenerationSuccess}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
          />
        )}

        {currentStep === 7 && (
          <Step7PreviewEditor
            blueprint={blueprint}
            sections={generatedSections}
            aiMetadata={aiMetadata}
            paperId={paperId}
            paperStatus={paperStatus}
            onUpdateSections={setGeneratedSections}
            onUpdateStatus={setPaperStatus}
            onSave={handleSavePaper}
            onBackToEdit={() => setCurrentStep(4)}
            onOpenAnswerKey={() => setIsAnswerKeyOpen(true)}
            onDuplicate={() => {
              if (paperId) {
                apiFetch(`/question-generator/papers/${paperId}/duplicate`, { method: 'POST' })
                  .then((res) => {
                    if (res.success && res.data?.paper) {
                      setPaperId(res.data.paper.id);
                      setPaperStatus('DRAFT');
                      toast.success('Paper duplicated into fresh draft');
                    }
                  })
                  .catch((err) => toast.error(err.message));
              } else {
                setPaperId(undefined);
                setPaperStatus('DRAFT');
                toast.success('Paper duplicated into new draft');
              }
            }}
            isSaving={isSaving}
          />
        )}

        {/* STEPPER PREV / NEXT BUTTONS (Hidden in Step 7 and in print) */}
        {currentStep < 7 && (
          <div className="no-print flex items-center justify-between pt-8 mt-8 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(7, prev + 1))}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-bold shadow-md transition"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ANSWER KEY MODAL */}
      <AnswerKeyModal
        isOpen={isAnswerKeyOpen}
        onClose={() => setIsAnswerKeyOpen(false)}
        blueprint={blueprint}
        sections={generatedSections}
      />

      {/* SAVED PAPERS DRAWER */}
      <SavedPapersDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        onSelectPaper={handleLoadSavedPaper}
        onCreateNew={handleResetTemplate}
      />
    </div>
  );
};

