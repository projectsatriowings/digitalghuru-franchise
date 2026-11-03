import React from 'react';
import { QuestionPaperBlueprint, EducationLevel, ExamType, QuestionPaperLanguage } from '../types';
import { GraduationCap, School, BookOpen, Layers, Globe } from 'lucide-react';

interface Step2Props {
  blueprint: QuestionPaperBlueprint;
  onChange: (updates: Partial<QuestionPaperBlueprint>) => void;
}

const SCHOOL_BOARDS = [
  'Tamil Nadu State Board (Samacheer Kalvi)',
  'CBSE (Central Board of Secondary Education)',
  'ICSE (Council for the Indian School Certificate)',
  'Matriculation Board',
  'Other / Custom Board',
];

const SCHOOL_STANDARDS = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
];

const COLLEGE_DEGREE_LEVELS = [
  'Diploma',
  'Undergraduate (UG)',
  'Postgraduate (PG)',
  'Engineering & Tech',
  'Arts & Science',
];

const COLLEGE_DEGREES = [
  'B.E. Computer Science and Engineering',
  'B.Tech Artificial Intelligence & Data Science',
  'B.E. Electronics & Communication Engineering',
  'B.E. Mechanical Engineering',
  'B.E. Electrical & Electronics Engineering',
  'B.Tech Information Technology',
  'B.Sc Computer Science',
  'B.Sc Mathematics',
  'B.Sc Physics',
  'B.Sc Chemistry',
  'B.Com General / Corporate Secretaryship',
  'BBA (Bachelor of Business Administration)',
  'BCA (Bachelor of Computer Applications)',
  'M.E. Computer Science and Engineering',
  'M.Sc Computer Science',
  'MCA (Master of Computer Applications)',
  'MBA (Master of Business Administration)',
];

const COLLEGE_SEMESTERS = [
  'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
  'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
];

const EXAM_TYPES: ExamType[] = [
  'Unit Test',
  'Monthly Test',
  'Quarterly Exam',
  'Half-Yearly Exam',
  'Model Exam',
  'Semester Exam',
  'Final Exam',
  'Custom Exam',
];

export const Step2Education: React.FC<Step2Props> = ({ blueprint, onChange }) => {
  const isSchool = blueprint.educationLevel === 'SCHOOL';

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="border-b border-[#F1F5F9] pb-4">
        <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#64748B]" />
          Step 2: Education Level & Examination Parameters
        </h2>
        <p className="text-xs text-[#64748B] mt-1">
          Select education tier. The blueprint dynamically adjusts relevant fields for School or Higher Education.
        </p>
      </div>

      {/* Education Level Switcher */}
      <div>
        <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-2">
          Select Education Tier <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() =>
              onChange({
                educationLevel: 'SCHOOL',
                standard: blueprint.standard || 'Class 10',
                board: blueprint.board || 'Tamil Nadu State Board (Samacheer Kalvi)',
              })
            }
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              isSchool
                ? 'bg-[#0F172A] border-[#3E2723] text-white shadow-md shadow-[#006FFF]/20'
                : 'bg-white border-[#E2E8F0] text-[#006FFF] hover:border-[#6D4C41]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isSchool ? 'bg-white/10 text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">School Education</div>
              <div className={`text-[11px] ${isSchool ? 'text-[#D7CCC8]' : 'text-[#94A3B8]'}`}>
                Classes 1–12 &bull; State Board, CBSE, ICSE
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              onChange({
                educationLevel: 'COLLEGE',
                degreeLevel: blueprint.degreeLevel || 'Engineering & Tech',
                degree: blueprint.degree || 'B.E. Computer Science and Engineering',
                semester: blueprint.semester || 'Semester 4',
              })
            }
            className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 ${
              !isSchool
                ? 'bg-[#0F172A] border-[#3E2723] text-white shadow-md shadow-[#006FFF]/20'
                : 'bg-white border-[#E2E8F0] text-[#006FFF] hover:border-[#6D4C41]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                !isSchool ? 'bg-white/10 text-white' : 'bg-[#F8FAFC] text-[#64748B]'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">College Education</div>
              <div className={`text-[11px] ${!isSchool ? 'text-[#D7CCC8]' : 'text-[#94A3B8]'}`}>
                UG, PG, Engineering, Arts & Science &bull; Semesters
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Dynamic Tier Fields */}
      {isSchool ? (
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] space-y-4 shadow-sm">
          <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <School className="w-4 h-4 text-[#64748B]" />
            School Examination Configuration
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Educational Board <span className="text-rose-500">*</span>
              </label>
              <select
                value={blueprint.board || SCHOOL_BOARDS[0]}
                onChange={(e) => onChange({ board: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
              >
                {SCHOOL_BOARDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Class / Standard <span className="text-rose-500">*</span>
              </label>
              <select
                value={blueprint.standard || 'Class 10'}
                onChange={(e) => onChange({ standard: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
              >
                {SCHOOL_STANDARDS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] space-y-4 shadow-sm">
          <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#64748B]" />
            University & College Configuration
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Tier / Degree Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={blueprint.degreeLevel || COLLEGE_DEGREE_LEVELS[3]}
                onChange={(e) => onChange({ degreeLevel: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
              >
                {COLLEGE_DEGREE_LEVELS.map((dl) => (
                  <option key={dl} value={dl}>{dl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Degree / Programme <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="degrees-list"
                value={blueprint.degree || ''}
                onChange={(e) => onChange({ degree: e.target.value })}
                placeholder="e.g. B.E. Computer Science"
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
              />
              <datalist id="degrees-list">
                {COLLEGE_DEGREES.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Semester / Academic Year <span className="text-rose-500">*</span>
              </label>
              <select
                value={blueprint.semester || 'Semester 4'}
                onChange={(e) => onChange({ semester: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
              >
                {COLLEGE_SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Common Subject and Exam Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Subject Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={blueprint.subject}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder={isSchool ? 'e.g. Mathematics / Physics' : 'e.g. Design & Analysis of Algorithms'}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-semibold shadow-sm"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Subject Code <span className="text-xs font-normal text-[#94A3B8]">(Optional)</span>
          </label>
          <input
            type="text"
            value={blueprint.subjectCode || ''}
            onChange={(e) => onChange({ subjectCode: e.target.value })}
            placeholder="e.g. CS8451 / MAT-10"
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5">
            Examination Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={blueprint.examType}
            onChange={(e) => onChange({ examType: e.target.value as ExamType })}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium shadow-sm"
          >
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#64748B]" /> Medium / Language <span className="text-rose-500">*</span>
          </label>
          <select
            value={blueprint.language}
            onChange={(e) => onChange({ language: e.target.value as QuestionPaperLanguage })}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium shadow-sm"
          >
            <option value="ENGLISH">English Only</option>
            <option value="TAMIL">Tamil Only (தமிழ்)</option>
            <option value="BILINGUAL">Bilingual (English + Tamil Translation)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

