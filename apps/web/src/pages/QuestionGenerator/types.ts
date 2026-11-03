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

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'BALANCED';

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

export interface QuestionChoiceOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
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
  cognitiveLevel?: string;
  options?: QuestionChoiceOption[];
  correctAnswer?: string;
  answerKeyGuidance?: string;
  internalChoiceGroupId?: string;
  isAlternativeChoice?: boolean;
}

export interface BlueprintSection {
  id: string;
  sectionLabel: string;
  sectionTitle?: string;
  instructions?: string;
  questionType: QuestionType;
  marksPerQuestion: number;
  numberOfQuestions: number;
  requiredQuestions?: number;
  hasInternalChoice?: boolean;
}

export interface ChapterOrUnit {
  name: string;
  topics?: string[];
  weightagePercent?: number;
}

export interface QuestionPaperBlueprint {
  instituteName: string;
  instituteAddress?: string;
  instituteLogoUrl?: string;
  academicYear: string;
  examDate?: string;
  educationLevel: EducationLevel;
  board?: string;
  standard?: string;
  degreeLevel?: string;
  degree?: string;
  department?: string;
  semester?: string;
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
    chaptersOrUnits: ChapterOrUnit[];
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

export interface SavedPaperSummary {
  id: string;
  title: string;
  educationLevel: EducationLevel;
  boardOrCourse: string;
  standardOrDegree: string;
  subject: string;
  examType: ExamType;
  totalMarks: number;
  durationMinutes: number;
  academicYear: string;
  examDate?: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
  isMock: boolean;
  provider: string;
  updatedAt: string;
  sectionsCount: number;
  questionsCount: number;
}

