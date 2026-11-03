import React from 'react';
import { QuestionPaperBlueprint } from '../types';
import { Building2, Calendar, MapPin, Image as ImageIcon } from 'lucide-react';

interface Step1Props {
  blueprint: QuestionPaperBlueprint;
  onChange: (updates: Partial<QuestionPaperBlueprint>) => void;
}

export const Step1Institute: React.FC<Step1Props> = ({ blueprint, onChange }) => {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="border-b border-[#F1F5F9] pb-4">
        <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#64748B]" />
          Step 1: Institute & Examination Header Details
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Specify your tuition centre or college details. These will appear on the printed question paper header.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Institute Name */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Institute / Tuition Centre Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={blueprint.instituteName}
              onChange={(e) => onChange({ instituteName: e.target.value })}
              placeholder="e.g. Sri Krishna Tuition Centre / Department of Computer Science"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 focus:border-[#6D4C41] shadow-sm font-medium"
              required
            />
          </div>
        </div>

        {/* Academic Year */}
        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Academic Year <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={blueprint.academicYear}
              onChange={(e) => onChange({ academicYear: e.target.value })}
              placeholder="e.g. 2026-2027"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 focus:border-[#6D4C41] shadow-sm font-medium"
            />
          </div>
        </div>

        {/* Examination Date */}
        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Examination Date <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={blueprint.examDate || ''}
              onChange={(e) => onChange({ examDate: e.target.value })}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 focus:border-[#6D4C41] shadow-sm font-medium"
            />
          </div>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Institute Address / Campus Location <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={blueprint.instituteAddress || ''}
              onChange={(e) => onChange({ instituteAddress: e.target.value })}
              placeholder="e.g. 124, Anna Salai, Chennai - 600002"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 focus:border-[#6D4C41] shadow-sm font-medium"
            />
          </div>
        </div>

        {/* Logo URL */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Institute Logo Image URL <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={blueprint.instituteLogoUrl || ''}
              onChange={(e) => onChange({ instituteLogoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 focus:border-[#6D4C41] shadow-sm font-medium"
            />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/70 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#64748B] shadow-sm shrink-0 border border-[#E2E8F0]/60">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="text-xs text-[#475569] leading-relaxed">
          <span className="font-bold text-[#0F172A]">Digital Guru Autofill:</span> Details are preloaded from your active institute session. You can customize them for specific examinations or branches without altering permanent institute records.
        </div>
      </div>
    </div>
  );
};

