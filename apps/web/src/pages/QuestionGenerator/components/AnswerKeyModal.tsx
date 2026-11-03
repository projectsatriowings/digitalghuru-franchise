import React from 'react';
import { QuestionPaperBlueprint, QuestionPaperSectionResult } from '../types';
import { KeyRound, Printer, X, CheckCircle, Award } from 'lucide-react';

interface AnswerKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprint: QuestionPaperBlueprint;
  sections: QuestionPaperSectionResult[];
}

export const AnswerKeyModal: React.FC<AnswerKeyModalProps> = ({
  isOpen,
  onClose,
  blueprint,
  sections,
}) => {
  if (!isOpen) return null;

  function handlePrintAnswerKey() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col text-[#0F172A]">
        {/* MODAL HEADER (Hidden in print) */}
        <div className="no-print p-6 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Confidential Teacher Answer Key & Marking Scheme
              </h2>
              <p className="text-xs text-[#64748B]">
                {blueprint.subject} &bull; {blueprint.examType} ({blueprint.academicYear})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintAnswerKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Answer Key</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE ANSWER KEY CONTENT */}
        <div className="p-6 sm:p-10 overflow-y-auto space-y-6 print-container text-black font-sans">
          <div className="text-center border-b-2 border-black pb-4 space-y-1">
            <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-100 text-amber-900 px-3 py-1 rounded-full border border-amber-300">
              Confidential &bull; Faculty / Evaluator Reference Only
            </span>
            <h1 className="text-xl font-black uppercase text-black pt-2">
              {blueprint.instituteName}
            </h1>
            <div className="text-sm font-bold uppercase text-black">
              EVALUATION KEY & MARKING SCHEME &bull; {blueprint.examType}
            </div>
            <div className="text-xs font-semibold text-gray-700">
              SUBJECT: {blueprint.subject.toUpperCase()} &bull; MAX MARKS: {blueprint.totalMarks}
            </div>
          </div>

          <div className="space-y-6">
            {sections.map((sec) => (
              <div key={sec.sectionId} className="space-y-3 border-b border-gray-200 pb-4">
                <div className="font-extrabold text-xs uppercase bg-gray-100 px-3 py-1 rounded border border-gray-300 text-black">
                  {sec.sectionLabel} {sec.sectionTitle ? `- ${sec.sectionTitle}` : ''} ({sec.marksPerQuestion} Marks Each)
                </div>

                <div className="space-y-3">
                  {sec.questions.map((q) => (
                    <div key={q.id} className="text-xs space-y-1.5 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="flex items-start justify-between gap-3 font-semibold text-black">
                        <div>
                          Q{q.questionNumber}. {q.questionText}
                        </div>
                        <span className="shrink-0 font-mono font-bold">[{q.marks}M]</span>
                      </div>

                      {q.questionType === 'MCQ' && q.correctAnswer && (
                        <div className="flex items-center gap-2 text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Correct Option: ({q.correctAnswer}) {q.options?.find((o) => o.key === q.correctAnswer)?.text}</span>
                        </div>
                      )}

                      <div className="text-gray-800 text-[11px] leading-relaxed pt-1">
                        <strong className="text-black">Marking Scheme / Expected Points:</strong>{' '}
                        {q.answerKeyGuidance || `Award ${q.marks} marks for technically accurate and complete response.`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="no-print p-4 border-t border-[#F1F5F9] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#006FFF] text-white text-xs font-semibold shadow hover:bg-[#0058D4] transition"
          >
            Close Answer Key
          </button>
        </div>
      </div>
    </div>
  );
};

