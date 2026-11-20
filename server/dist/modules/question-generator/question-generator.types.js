"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegenerateQuestionSchema = exports.SaveQuestionPaperSchema = exports.QuestionPaperBlueprintSchema = exports.BlueprintSectionSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// STRICT ZOD VALIDATION SCHEMAS
// ============================================================================
exports.BlueprintSectionSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Section ID is required'),
    sectionLabel: zod_1.z.string().min(1, 'Section label is required'),
    sectionTitle: zod_1.z.string().optional(),
    instructions: zod_1.z.string().optional(),
    questionType: zod_1.z.enum([
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
    marksPerQuestion: zod_1.z.number().positive('Marks per question must be greater than 0'),
    numberOfQuestions: zod_1.z.number().int().min(1, 'Number of questions must be at least 1'),
    requiredQuestions: zod_1.z.number().int().min(1).optional(),
    hasInternalChoice: zod_1.z.boolean().optional(),
    chapterOrUnitFilters: zod_1.z.array(zod_1.z.string()).optional(),
}).refine((data) => {
    if (data.requiredQuestions !== undefined) {
        return data.requiredQuestions <= data.numberOfQuestions;
    }
    return true;
}, {
    message: 'Required questions cannot exceed total printed questions in the section',
    path: ['requiredQuestions'],
});
exports.QuestionPaperBlueprintSchema = zod_1.z.object({
    instituteName: zod_1.z.string().min(2, 'Institute name is required'),
    instituteAddress: zod_1.z.string().optional(),
    instituteLogoUrl: zod_1.z.string().optional(),
    academicYear: zod_1.z.string().min(4, 'Academic year is required (e.g. 2026-2027)'),
    examDate: zod_1.z.string().optional(),
    educationLevel: zod_1.z.enum(['SCHOOL', 'COLLEGE']),
    board: zod_1.z.string().optional(),
    standard: zod_1.z.string().optional(),
    degreeLevel: zod_1.z.string().optional(),
    degree: zod_1.z.string().optional(),
    department: zod_1.z.string().optional(),
    semester: zod_1.z.string().optional(),
    subject: zod_1.z.string().min(2, 'Subject name is required'),
    subjectCode: zod_1.z.string().optional(),
    examType: zod_1.z.enum([
        'Unit Test',
        'Monthly Test',
        'Quarterly Exam',
        'Half-Yearly Exam',
        'Model Exam',
        'Semester Exam',
        'Final Exam',
        'Custom Exam',
    ]),
    language: zod_1.z.enum(['ENGLISH', 'TAMIL', 'BILINGUAL']).default('ENGLISH'),
    durationMinutes: zod_1.z.number().int().positive('Exam duration must be positive'),
    totalMarks: zod_1.z.number().int().positive('Total marks must be positive'),
    passingMarks: zod_1.z.number().nonnegative().optional(),
    negativeMarking: zod_1.z.boolean().optional(),
    generalInstructions: zod_1.z.array(zod_1.z.string()).optional(),
    syllabusDetails: zod_1.z.object({
        mode: zod_1.z.enum(['MANUAL', 'PASTE', 'FILE_UPLOAD', 'PRELOADED']),
        coverageType: zod_1.z.enum(['FULL', 'PORTIONS']),
        portionsSummary: zod_1.z.string().optional(),
        chaptersOrUnits: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string().min(1, 'Chapter/Unit name required'),
            topics: zod_1.z.array(zod_1.z.string()).optional(),
            weightagePercent: zod_1.z.number().optional(),
        })).default([]),
        rawText: zod_1.z.string().optional(),
    }),
    sections: zod_1.z.array(exports.BlueprintSectionSchema).min(1, 'At least one question section is required'),
    difficulty: zod_1.z.enum(['EASY', 'MEDIUM', 'HARD', 'BALANCED']).default('BALANCED'),
    cognitiveMix: zod_1.z.object({
        rememberingPercent: zod_1.z.number().optional(),
        understandingPercent: zod_1.z.number().optional(),
        applyingPercent: zod_1.z.number().optional(),
        analyzingPercent: zod_1.z.number().optional(),
    }).optional(),
    learningOutcomes: zod_1.z.string().optional(),
}).superRefine((data, ctx) => {
    // Validate education-level specific requirements
    if (data.educationLevel === 'SCHOOL') {
        if (!data.standard || data.standard.trim().length === 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Standard / Class is required for School education',
                path: ['standard'],
            });
        }
    }
    else if (data.educationLevel === 'COLLEGE') {
        if (!data.degree || data.degree.trim().length === 0) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
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
            code: zod_1.z.ZodIssueCode.custom,
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
            code: zod_1.z.ZodIssueCode.custom,
            message: `Total Marks Mismatch: Requested total is ${data.totalMarks} marks, but sections sum to ${totalCalculatedAttemptedMarks} attempted marks (${totalCalculatedPrintedMarks} marks printed). Adjust your sections or requested total.`,
            path: ['totalMarks'],
        });
    }
});
exports.SaveQuestionPaperSchema = zod_1.z.object({
    blueprint: exports.QuestionPaperBlueprintSchema,
    sections: zod_1.z.array(zod_1.z.any()).min(1, 'Sections required'),
    status: zod_1.z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']).default('DRAFT'),
    title: zod_1.z.string().min(2, 'Title is required'),
});
exports.RegenerateQuestionSchema = zod_1.z.object({
    paperId: zod_1.z.string().optional(),
    blueprint: exports.QuestionPaperBlueprintSchema,
    sectionId: zod_1.z.string().min(1, 'Section ID is required'),
    questionId: zod_1.z.string().min(1, 'Question ID to replace is required'),
    previousQuestionText: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
});
