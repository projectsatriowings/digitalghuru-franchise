import React from 'react';
import { QuestionPaperBlueprint, DifficultyLevel } from '../types';
import { Settings2, Brain, Sliders, ListOrdered, Plus, Trash2 } from 'lucide-react';

interface Step5Props {
  blueprint: QuestionPaperBlueprint;
  onChange: (updates: Partial<QuestionPaperBlueprint>) => void;
}

export const Step5Settings: React.FC<Step5Props> = ({ blueprint, onChange }) => {
  const instructions = blueprint.generalInstructions || [
    'Check whether the question paper contains all printed pages and questions.',
    'Answer all questions in Section A. Read choices carefully in other sections.',
    'Write neatly and legibly. Use of standard non-programmable calculators is allowed where specified.',
  ];

  function addInstruction() {
    onChange({
      generalInstructions: [...instructions, ''],
    });
  }

  function updateInstruction(idx: number, text: string) {
    const updated = [...instructions];
    updated[idx] = text;
    onChange({ generalInstructions: updated });
  }

  function removeInstruction(idx: number) {
    const updated = instructions.filter((_, i) => i !== idx);
    onChange({ generalInstructions: updated });
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="border-b border-[#F1F5F9] pb-4">
        <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[#64748B]" />
          Step 5: Cognitive Rigor & Examination Settings
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Tune the pedagogical complexity, Bloom's Taxonomy cognitive distribution, and candidate instructions.
        </p>
      </div>

      {/* Difficulty Level Selector */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider">
          Examination Difficulty Level <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['EASY', 'MEDIUM', 'HARD', 'BALANCED'] as DifficultyLevel[]).map((lvl) => {
            const isSelected = blueprint.difficulty === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange({ difficulty: lvl })}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'bg-[#0F172A] border-[#3E2723] text-white shadow-md'
                    : 'bg-white border-[#E2E8F0] text-[#006FFF] hover:border-[#6D4C41]'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider">{lvl}</div>
                <div className={`text-[10px] mt-1 ${isSelected ? 'text-[#D7CCC8]' : 'text-[#94A3B8]'}`}>
                  {lvl === 'EASY' && 'Foundational, direct recall questions'}
                  {lvl === 'MEDIUM' && 'Conceptual clarity and standard problems'}
                  {lvl === 'HARD' && 'Advanced analytical & application-heavy'}
                  {lvl === 'BALANCED' && '30% Recall, 40% Conceptual, 30% Analytical'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specific Learning Outcomes / Focus Instructions for AI */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] space-y-2">
        <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#64748B]" />
          Specific Focus Areas & Learning Outcomes <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
        </label>
        <textarea
          rows={3}
          value={blueprint.learningOutcomes || ''}
          onChange={(e) => onChange({ learningOutcomes: e.target.value })}
          placeholder="e.g. Focus heavily on Newton's Laws derivations in Section B, and numerical problems on velocity in Section C..."
          className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
        />
      </div>

      {/* Candidate Instructions */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-[#64748B]" />
            General Instructions for Candidates
          </label>
          <button
            type="button"
            onClick={addInstruction}
            className="flex items-center gap-1 text-xs font-semibold text-[#64748B] hover:text-[#0F172A]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </div>

        <div className="space-y-2">
          {instructions.map((inst, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#E2E8F0]">
                {idx + 1}
              </span>
              <input
                type="text"
                value={inst}
                onChange={(e) => updateInstruction(idx, e.target.value)}
                placeholder="Enter candidate instruction..."
                className="flex-1 bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30"
              />
              {instructions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInstruction(idx)}
                  className="text-[#94A3B8] hover:text-rose-600 p-1 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

