import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type EducationLevel = 'SCHOOL' | 'COLLEGE';

export type ExamType =
  | 'Unit Test'
  | 'Monthly Test'
  | 'Quarterly Exam'
  | 'Half-Yearly Exam'
  | 'Model Exam'
  | 'Semester Exam'
  | 'Final Exam'
  | 'Custom Exam';

export type QuestionPaperLanguage = 'ENGLISH' | 'TAMIL' | 'BILINGUAL';

export type QuestionPaperStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'BALANCED';

export type CognitiveLevel =
  | 'REMEMBERING'
  | 'UNDERSTANDING'
  | 'APPLYING'
  | 'ANALYZING'
  | 'EVALUATING'
  | 'CREATING';

export type QuestionType =
  | 'MCQ'
  | 'FILL_IN_BLANKS'
  | 'TRUE_FALSE'
  | 'MATCH_FOLLOWING'
  | 'VERY_SHORT_ANSWER'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER'
  | 'ESSAY'
  | 'NUMERICAL_PROBLEM'
  | 'APPLICATION_BASED'
  | 'CASE_STUDY';

// ============================================================================
// BLUEPRINT INTERFACES & SCHEMAS
// ============================================================================

export interface BlueprintSection {
  id: string;
  sectionLabel: string; // e.g. "PART - A", "SECTION I"
  sectionTitle?: string; // e.g. "Objective Questions", "Short Answer Questions"
  instructions?: string; // e.g. "Answer all questions. Each question carries 1 mark."
  questionType: QuestionType;
  marksPerQuestion: number;
  numberOfQuestions: number; // Questions printed on the paper
  requiredQuestions?: number; // Questions the candidate must answer (for "Answer any N")
  hasInternalChoice?: boolean; // Whether questions are organized into "Either / Or" pairs
  chapterOrUnitFilters?: string[]; // Specific chapters or units for this section
}

export interface QuestionPaperBlueprint {
  instituteName: string;
  instituteAddress?: string;
  instituteLogoUrl?: string;
  academicYear: string;
  examDate?: string;
  educationLevel: EducationLevel;
  // School-specific
  board?: string; // "Tamil Nadu State Board", "CBSE", "ICSE", etc.
  standard?: string; // "Class 10", "Class 12", etc.
  // College-specific
  degreeLevel?: string; // "UG", "PG", "Diploma", "Engineering"
  degree?: string; // "B.E. Computer Science", "B.Sc Mathematics", etc.
  department?: string; // "Computer Science and Engineering"
  semester?: string; // "Semester 5"
  // Common
  subject: string;
  subjectCode?: string;
  examType: ExamType;
  language: QuestionPaperLanguage;
  durationMinutes: number;
  totalMarks: number;
  passingMarks?: number;
  negativeMarking?: boolean;
  generalInstructions?: string[];
  syllabusDetails: {
    mode: 'MANUAL' | 'PASTE' | 'FILE_UPLOAD' | 'PRELOADED';
    coverageType: 'FULL' | 'PORTIONS';
    portionsSummary?: string;
    chaptersOrUnits: Array<{
      name: string;
      topics?: string[];
      weightagePercent?: number;
    }>;
    rawText?: string;
  };
  sections: BlueprintSection[];
  difficulty: DifficultyLevel;
  cognitiveMix?: {
    rememberingPercent?: number;
    understandingPercent?: number;
    applyingPercent?: number;
    analyzingPercent?: number;
  };
  learningOutcomes?: string;
}

// ============================================================================
// QUESTION & PAPER MODELS
// ============================================================================

export interface QuestionChoiceOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface MatchPair {
  leftKey: string;
  leftText: string;
  rightKey: string;
  rightText: string;
}

export interface GeneratedQuestion {
  id: string;
  sectionId: string;
  questionNumber: number;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  chapterOrUnit?: string;
  topic?: string;
  cognitiveLevel?: CognitiveLevel;
  options?: QuestionChoiceOption[]; // For MCQs
  matchPairs?: MatchPair[]; // For Match the following
  correctAnswer?: string; // For MCQ key or concise answer
  answerKeyGuidance?: string; // Expected solution steps, key points, marking scheme
  internalChoiceGroupId?: string; // Questions sharing the same choice ID are "Either / Or" alternatives
  isAlternativeChoice?: boolean; // True if this question is the "OR" option
}

export interface QuestionPaperSectionResult {
  sectionId: string;
  sectionLabel: string;
  sectionTitle?: string;
  instructions: string;
  questionType: QuestionType;
  marksPerQuestion: number;
  printedQuestionCount: number;
  requiredQuestionCount: number;
  sectionTotalMarks: number;
  questions: GeneratedQuestion[];
}

export interface QuestionPaperRecord {
  id: string;
  instituteId: string;
  title: string;
  educationLevel: EducationLevel;
  boardOrCourse: string;
  standardOrDegree: string;
  department?: string;
  semester?: string;
  subject: string;
  subjectCode?: string;
  examType: ExamType;
  language: QuestionPaperLanguage;
  durationMinutes: number;
  totalMarks: number;
  passingMarks?: number;
  academicYear: string;
  examDate?: string;
  instituteName: string;
  instituteAddress?: string;
  instituteLogoUrl?: string;
  generalInstructions: string[];
  sections: QuestionPaperSectionResult[];
  syllabusSummary: string;
  status: QuestionPaperStatus;
  aiMetadata: {
    provider: string;
    model: string;
    isMock: boolean;
    generatedAt: string;
    qualityAuditNotes?: string[];
  };
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

// ============================================================================
// STRICT ZOD VALIDATION SCHEMAS
// ============================================================================

export const BlueprintSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  sectionLabel: z.string().min(1, 'Section label is required'),
  sectionTitle: z.string().optional(),
  instructions: z.string().optional(),
  questionType: z.enum([
    'MCQ',
    'FILL_IN_BLANKS',
    'TRUE_FALSE',
    'MATCH_FOLLOWING',
    'VERY_SHORT_ANSWER',
    'SHORT_ANSWER',
    'LONG_ANSWER',
    'ESSAY',
    'NUMERICAL_PROBLEM',
    'APPLICATION_BASED',
    'CASE_STUDY',
  ]),
  marksPerQuestion: z.number().positive('Marks per question must be greater than 0'),
  numberOfQuestions: z.number().int().min(1, 'Number of questions must be at least 1'),
  requiredQuestions: z.number().int().min(1).optional(),
  hasInternalChoice: z.boolean().optional(),
  chapterOrUnitFilters: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.requiredQuestions !== undefined) {
      return data.requiredQuestions <= data.numberOfQuestions;
    }
    return true;
  },
  {
    message: 'Required questions cannot exceed total printed questions in the section',
    path: ['requiredQuestions'],
  }
);

export const QuestionPaperBlueprintSchema = z.object({
  instituteName: z.string().min(2, 'Institute name is required'),
  instituteAddress: z.string().optional(),
  instituteLogoUrl: z.string().optional(),
  academicYear: z.string().min(4, 'Academic year is required (e.g. 2026-2027)'),
  examDate: z.string().optional(),
  educationLevel: z.enum(['SCHOOL', 'COLLEGE']),
  board: z.string().optional(),
  standard: z.string().optional(),
  degreeLevel: z.string().optional(),
  degree: z.string().optional(),
  department: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().min(2, 'Subject name is required'),
  subjectCode: z.string().optional(),
  examType: z.enum([
    'Unit Test',
    'Monthly Test',
    'Quarterly Exam',
    'Half-Yearly Exam',
    'Model Exam',
    'Semester Exam',
    'Final Exam',
    'Custom Exam',
  ]),
  language: z.enum(['ENGLISH', 'TAMIL', 'BILINGUAL']).default('ENGLISH'),
  durationMinutes: z.number().int().positive('Exam duration must be positive'),
  totalMarks: z.number().int().positive('Total marks must be positive'),
  passingMarks: z.number().nonnegative().optional(),
  negativeMarking: z.boolean().optional(),
  generalInstructions: z.array(z.string()).optional(),
  syllabusDetails: z.object({
    mode: z.enum(['MANUAL', 'PASTE', 'FILE_UPLOAD', 'PRELOADED']),
    coverageType: z.enum(['FULL', 'PORTIONS']),
    portionsSummary: z.string().optional(),
    chaptersOrUnits: z.array(
      z.object({
        name: z.string().min(1, 'Chapter/Unit name required'),
        topics: z.array(z.string()).optional(),
        weightagePercent: z.number().optional(),
      })
    ).default([]),
    rawText: z.string().optional(),
  }),
  sections: z.array(BlueprintSectionSchema).min(1, 'At least one question section is required'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'BALANCED']).default('BALANCED'),
  cognitiveMix: z.object({
    rememberingPercent: z.number().optional(),
    understandingPercent: z.number().optional(),
    applyingPercent: z.number().optional(),
    analyzingPercent: z.number().optional(),
  }).optional(),
  learningOutcomes: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validate education-level specific requirements
  if (data.educationLevel === 'SCHOOL') {
    if (!data.standard || data.standard.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Standard / Class is required for School education',
        path: ['standard'],
      });
    }
  } else if (data.educationLevel === 'COLLEGE') {
    if (!data.degree || data.degree.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Degree / Course is required for College education',
        path: ['degree'],
      });
    }
  }

  // Syllabus presence validation
  const hasChapters = data.syllabusDetails.chaptersOrUnits.length > 0;
  const hasRawText = data.syllabusDetails.rawText && data.syllabusDetails.rawText.trim().length > 10;
  if (!hasChapters && !hasRawText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Syllabus details are required (enter chapters, paste syllabus, or upload a document)',
      path: ['syllabusDetails'],
    });
  }

  // Strict marks validation
  let totalCalculatedAttemptedMarks = 0;
  let totalCalculatedPrintedMarks = 0;

  for (let idx = 0; idx < data.sections.length; idx++) {
    const sec = data.sections[idx];
    const attemptedCount = sec.requiredQuestions !== undefined ? sec.requiredQuestions : sec.numberOfQuestions;
    const sectionAttemptedMarks = attemptedCount * sec.marksPerQuestion;
    const sectionPrintedMarks = sec.numberOfQuestions * sec.marksPerQuestion;

    totalCalculatedAttemptedMarks += sectionAttemptedMarks;
    totalCalculatedPrintedMarks += sectionPrintedMarks;
  }

  if (totalCalculatedAttemptedMarks !== data.totalMarks) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Total Marks Mismatch: Requested total is ${data.totalMarks} marks, but sections sum to ${totalCalculatedAttemptedMarks} attempted marks (${totalCalculatedPrintedMarks} marks printed). Adjust your sections or requested total.`,
      path: ['totalMarks'],
    });
  }
});

export const SaveQuestionPaperSchema = z.object({
  blueprint: QuestionPaperBlueprintSchema,
  sections: z.array(z.any()).min(1, 'Sections required'),
  status: z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']).default('DRAFT'),
  title: z.string().min(2, 'Title is required'),
});

export const RegenerateQuestionSchema = z.object({
  paperId: z.string().optional(),
  blueprint: QuestionPaperBlueprintSchema,
  sectionId: z.string().min(1, 'Section ID is required'),
  questionId: z.string().min(1, 'Question ID to replace is required'),
  previousQuestionText: z.string().optional(),
  reason: z.string().optional(),
});
