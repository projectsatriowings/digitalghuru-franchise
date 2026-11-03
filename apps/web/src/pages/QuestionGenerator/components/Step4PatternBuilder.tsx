import React from 'react';
import { QuestionPaperBlueprint, BlueprintSection, QuestionType } from '../types';
import {
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Layers,
  Clock,
  Award,
} from 'lucide-react';

interface Step4Props {
  blueprint: QuestionPaperBlueprint;
  onChange: (updates: Partial<QuestionPaperBlueprint>) => void;
  questionTypesList?: Array<{ type: string; label: string; defaultMarks: number }>;
}

const DEFAULT_QUESTION_TYPES = [
  { type: 'MCQ', label: 'Multiple Choice (MCQs)', defaultMarks: 1 },
  { type: 'FILL_IN_BLANKS', label: 'Fill in the Blanks', defaultMarks: 1 },
  { type: 'TRUE_FALSE', label: 'True / False', defaultMarks: 1 },
  { type: 'MATCH_FOLLOWING', label: 'Match the Following', defaultMarks: 4 },
  { type: 'VERY_SHORT_ANSWER', label: 'Very Short Answers (VSA)', defaultMarks: 2 },
  { type: 'SHORT_ANSWER', label: 'Short Answers (SA)', defaultMarks: 3 },
  { type: 'NUMERICAL_PROBLEM', label: 'Numerical / Problem Solving', defaultMarks: 5 },
  { type: 'LONG_ANSWER', label: 'Long Answers / Detailed (LA)', defaultMarks: 5 },
  { type: 'ESSAY', label: 'Essay / Descriptive Questions', defaultMarks: 10 },
  { type: 'APPLICATION_BASED', label: 'Application-Oriented Questions', defaultMarks: 8 },
  { type: 'CASE_STUDY', label: 'Case Study / Scenario Analysis', defaultMarks: 12 },
];

export const Step4PatternBuilder: React.FC<Step4Props> = ({
  blueprint,
  onChange,
  questionTypesList = DEFAULT_QUESTION_TYPES,
}) => {
  const sections = blueprint.sections || [];

  // Calculate live marks math
  let totalAttemptedMarks = 0;
  let totalPrintedMarks = 0;
  let totalAttemptedQuestions = 0;
  let totalPrintedQuestions = 0;

  sections.forEach((sec) => {
    const required = sec.requiredQuestions !== undefined ? sec.requiredQuestions : sec.numberOfQuestions;
    totalAttemptedMarks += required * sec.marksPerQuestion;
    totalPrintedMarks += sec.numberOfQuestions * sec.marksPerQuestion;
    totalAttemptedQuestions += required;
    totalPrintedQuestions += sec.numberOfQuestions;
  });

  const marksMatch = totalAttemptedMarks === blueprint.totalMarks;
  const marksDifference = totalAttemptedMarks - blueprint.totalMarks;

  function addSection() {
    const nextIdx = sections.length + 1;
    const labelLetter = String.fromCharCode(64 + nextIdx); // A, B, C...
    const newSection: BlueprintSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sectionLabel: `Part ${labelLetter}`,
      sectionTitle: `Section ${labelLetter}`,
      questionType: 'SHORT_ANSWER',
      marksPerQuestion: 2,
      numberOfQuestions: 5,
      requiredQuestions: 5,
      hasInternalChoice: false,
    };
    onChange({ sections: [...sections, newSection] });
  }

  function updateSection(idx: number, updates: Partial<BlueprintSection>) {
    const updated = [...sections];
    updated[idx] = { ...updated[idx], ...updates };
    onChange({ sections: updated });
  }

  function removeSection(idx: number) {
    const updated = sections.filter((_, i) => i !== idx);
    onChange({ sections: updated });
  }

  // Quick Blueprint Presets
  function applyPreset(name: 'SCHOOL_50' | 'SCHOOL_100' | 'COLLEGE_100' | 'UNIT_25') {
    if (name === 'UNIT_25') {
      onChange({
        totalMarks: 25,
        durationMinutes: 45,
        sections: [
          {
            id: 'sec-a',
            sectionLabel: 'Part A',
            sectionTitle: 'Objective',
            questionType: 'MCQ',
            marksPerQuestion: 1,
            numberOfQuestions: 5,
            requiredQuestions: 5,
          },
          {
            id: 'sec-b',
            sectionLabel: 'Part B',
            sectionTitle: 'Short Answer',
            questionType: 'SHORT_ANSWER',
            marksPerQuestion: 2,
            numberOfQuestions: 5,
            requiredQuestions: 5,
          },
          {
            id: 'sec-c',
            sectionLabel: 'Part C',
            sectionTitle: 'Long Answer',
            questionType: 'LONG_ANSWER',
            marksPerQuestion: 5,
            numberOfQuestions: 2,
            requiredQuestions: 2,
          },
        ],
      });
    } else if (name === 'SCHOOL_50') {
      onChange({
        totalMarks: 50,
        durationMinutes: 90,
        sections: [
          {
            id: 'sec-1',
            sectionLabel: 'Section A',
            sectionTitle: 'Multiple Choice Questions',
            questionType: 'MCQ',
            marksPerQuestion: 1,
            numberOfQuestions: 10,
            requiredQuestions: 10,
          },
          {
            id: 'sec-2',
            sectionLabel: 'Section B',
            sectionTitle: 'Short Answer (Answer 5 of 7)',
            questionType: 'SHORT_ANSWER',
            marksPerQuestion: 2,
            numberOfQuestions: 7,
            requiredQuestions: 5,
          },
          {
            id: 'sec-3',
            sectionLabel: 'Section C',
            sectionTitle: 'Detailed Questions (Answer 4 of 6)',
            questionType: 'LONG_ANSWER',
            marksPerQuestion: 5,
            numberOfQuestions: 6,
            requiredQuestions: 4,
          },
          {
            id: 'sec-4',
            sectionLabel: 'Section D',
            sectionTitle: 'Practical / Essay',
            questionType: 'ESSAY',
            marksPerQuestion: 10,
            numberOfQuestions: 1,
            requiredQuestions: 1,
          },
        ],
      });
    } else if (name === 'COLLEGE_100') {
      onChange({
        totalMarks: 100,
        durationMinutes: 180,
        sections: [
          {
            id: 'sec-a',
            sectionLabel: 'Part A',
            sectionTitle: 'Questions 1 to 10 (Short Answer - 2 Marks each)',
            instructions: 'Answer ALL questions. (10 x 2 = 20 Marks)',
            questionType: 'VERY_SHORT_ANSWER',
            marksPerQuestion: 2,
            numberOfQuestions: 10,
            requiredQuestions: 10,
            hasInternalChoice: false,
          },
          {
            id: 'sec-b',
            sectionLabel: 'Part B',
            sectionTitle: 'Questions 11 to 15 (Either or Choice - 13 Marks each)',
            instructions: 'Answer ALL questions choosing either (a) or (b). (5 x 13 = 65 Marks)',
            questionType: 'LONG_ANSWER',
            marksPerQuestion: 13,
            numberOfQuestions: 10,
            requiredQuestions: 5,
            hasInternalChoice: true,
          },
          {
            id: 'sec-c',
            sectionLabel: 'Part C',
            sectionTitle: 'Question 16 (Comprehensive Application - 15 Marks)',
            instructions: 'Answer Question 16 choosing either (a) or (b). (1 x 15 = 15 Marks)',
            questionType: 'APPLICATION_BASED',
            marksPerQuestion: 15,
            numberOfQuestions: 2,
            requiredQuestions: 1,
            hasInternalChoice: true,
          },
        ],
      });
    } else if (name === 'SCHOOL_100') {
      onChange({
        totalMarks: 100,
        durationMinutes: 180,
        sections: [
          {
            id: 'sec-1',
            sectionLabel: 'Part I',
            sectionTitle: 'One Mark Questions',
            questionType: 'MCQ',
            marksPerQuestion: 1,
            numberOfQuestions: 14,
            requiredQuestions: 14,
          },
          {
            id: 'sec-2',
            sectionLabel: 'Part II',
            sectionTitle: 'Two Marks (Answer 10 out of 14)',
            questionType: 'SHORT_ANSWER',
            marksPerQuestion: 2,
            numberOfQuestions: 14,
            requiredQuestions: 10,
          },
          {
            id: 'sec-3',
            sectionLabel: 'Part III',
            sectionTitle: 'Five Marks (Answer 10 out of 14)',
            questionType: 'LONG_ANSWER',
            marksPerQuestion: 5,
            numberOfQuestions: 14,
            requiredQuestions: 10,
          },
          {
            id: 'sec-4',
            sectionLabel: 'Part IV',
            sectionTitle: 'Eight Marks (Either/Or Choice - Answer 2 out of 4)',
            questionType: 'ESSAY',
            marksPerQuestion: 8,
            numberOfQuestions: 4,
            requiredQuestions: 2,
            hasInternalChoice: true,
          },
        ],
      });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="border-b border-[#F1F5F9] pb-4">
        <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#64748B]" />
          Step 4: Marks, Duration & Question Pattern Builder
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Configure sections, question weights, counts, and optional choice rules. Real-time validation checks for exact mark alignment.
        </p>
      </div>

      {/* Exam Scale Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#64748B]" /> Total Maximum Marks <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min={5}
            max={500}
            value={blueprint.totalMarks}
            onChange={(e) => onChange({ totalMarks: Number(e.target.value) })}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 shadow-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#64748B]" /> Duration (Minutes) <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min={15}
            max={360}
            step={5}
            value={blueprint.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 shadow-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Passing Marks <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
          </label>
          <input
            type="number"
            min={0}
            max={blueprint.totalMarks}
            value={blueprint.passingMarks || ''}
            onChange={(e) => onChange({ passingMarks: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g. 35"
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 shadow-sm"
          />
        </div>
      </div>

      {/* LIVE MARKS VALIDATION BANNER */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          marksMatch
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-sm'
            : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                marksMatch ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {marksMatch ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                {marksMatch ? 'Strict Marks Validation Passed' : 'Total Marks Mismatch Alert'}
              </div>
              <div className="text-xs font-medium mt-0.5">
                {marksMatch ? (
                  <span>
                    Calculated attempted marks strictly equal the requested total of{' '}
                    <strong className="font-bold underline">{blueprint.totalMarks} Marks</strong> ({totalPrintedMarks} marks printed).
                  </span>
                ) : (
                  <span>
                    Your sections total <strong>{totalAttemptedMarks} Attempted Marks</strong>, but you requested{' '}
                    <strong>{blueprint.totalMarks} Marks</strong> ({marksDifference > 0 ? `+${marksDifference}` : marksDifference} Marks difference).
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-current text-xs font-bold text-center">
              <div>{totalAttemptedQuestions} / {totalPrintedQuestions}</div>
              <div className="text-[10px] font-normal opacity-80">Questions (Att / Print)</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/80 border border-current text-xs font-bold text-center">
              <div>{totalAttemptedMarks} / {blueprint.totalMarks}</div>
              <div className="text-[10px] font-normal opacity-80">Marks (Att / Req)</div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK PRESETS */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mr-2">
          <Sparkles className="w-3.5 h-3.5" /> Pattern Blueprints:
        </span>
        <button
          type="button"
          onClick={() => applyPreset('UNIT_25')}
          className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] text-xs font-semibold border border-[#E2E8F0]/80 transition"
        >
          25 Marks (Unit Test)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('SCHOOL_50')}
          className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] text-xs font-semibold border border-[#E2E8F0]/80 transition"
        >
          50 Marks (School Terminal)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('SCHOOL_100')}
          className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] text-xs font-semibold border border-[#E2E8F0]/80 transition"
        >
          100 Marks (State Board 10/12)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('COLLEGE_100')}
          className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#006FFF] text-xs font-semibold border border-[#E2E8F0]/80 transition"
        >
          100 Marks (University Pattern: 20 + 65 + 15)
        </button>
      </div>

      {/* SECTION BUILDER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#006FFF] uppercase tracking-wider">
            Examination Sections ({sections.length})
          </span>
          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Section</span>
          </button>
        </div>

        {sections.map((sec, idx) => {
          const secRequired = sec.requiredQuestions !== undefined ? sec.requiredQuestions : sec.numberOfQuestions;
          const secAttemptedMarks = secRequired * sec.marksPerQuestion;
          const secPrintedMarks = sec.numberOfQuestions * sec.marksPerQuestion;

          return (
            <div
              key={sec.id || idx}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-4 relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-xl bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={sec.sectionLabel}
                    onChange={(e) => updateSection(idx, { sectionLabel: e.target.value })}
                    placeholder="e.g. Part A / Section I"
                    className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] font-bold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 w-36"
                  />
                  <input
                    type="text"
                    value={sec.sectionTitle || ''}
                    onChange={(e) => updateSection(idx, { sectionTitle: e.target.value })}
                    placeholder="Section Title (e.g. Multiple Choice / Either or Choice)"
                    className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#006FFF] font-medium focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 flex-1"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="font-bold text-[#0F172A]">{secAttemptedMarks} Marks</span>
                    <span className="text-[10px] text-[#94A3B8] block">
                      ({secRequired} of {sec.numberOfQuestions} questions)
                    </span>
                  </div>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      className="text-[#94A3B8] hover:text-rose-600 p-1.5 rounded-lg transition"
                      title="Remove section"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Section Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1">
                    Question Type
                  </label>
                  <select
                    value={sec.questionType}
                    onChange={(e) => updateSection(idx, { questionType: e.target.value as QuestionType })}
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-medium focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30"
                  >
                    {questionTypesList.map((qt) => (
                      <option key={qt.type} value={qt.type}>{qt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1">
                    Marks per Question
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={sec.marksPerQuestion}
                    onChange={(e) => updateSection(idx, { marksPerQuestion: Number(e.target.value) })}
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-bold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1">
                    Questions Printed
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={sec.numberOfQuestions}
                    onChange={(e) => {
                      const count = Number(e.target.value);
                      updateSection(idx, {
                        numberOfQuestions: count,
                        requiredQuestions:
                          sec.requiredQuestions && sec.requiredQuestions > count ? count : sec.requiredQuestions,
                      });
                    }}
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#475569] mb-1 flex items-center justify-between">
                    <span>Required to Answer</span>
                    <span className="text-[10px] text-[#94A3B8] font-normal">
                      {secRequired < sec.numberOfQuestions ? 'Optional' : 'All'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={sec.numberOfQuestions}
                    value={secRequired}
                    onChange={(e) => updateSection(idx, { requiredQuestions: Number(e.target.value) })}
                    className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30"
                  />
                </div>
              </div>

              {/* Internal Choice Switch and Instructions */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!sec.hasInternalChoice}
                    onChange={(e) => updateSection(idx, { hasInternalChoice: e.target.checked })}
                    className="rounded border-[#E2E8F0] text-[#006FFF] focus:ring-[#6D4C41]"
                  />
                  <span className="text-xs font-semibold text-[#006FFF]">
                    Organize as "Either / Or" Internal Choice pairs (e.g. Q11(a) OR Q11(b))
                  </span>
                </label>

                <div className="text-[11px] text-[#94A3B8]">
                  Printed: {secPrintedMarks} Marks &bull; Attempted: {secAttemptedMarks} Marks
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

