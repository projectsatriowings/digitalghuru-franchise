import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  QuestionPaperBlueprintSchema,
  RegenerateQuestionSchema,
  QuestionPaperRecord,
} from './question-generator.types.js';
import {
  generateQuestionPaper,
  regenerateSingleQuestion,
  getAIProviderConfig,
  validateAndAuditGeneratedPaper,
} from './ai.service.js';
import {
  PRELOADED_CURRICULA,
  extractTextFromFile,
  sanitizeSyllabusText,
} from './syllabus-parser.service.js';
import { QuestionPaperStorageService } from './question-generator.storage.js';

/**
 * GET /api/question-generator/config
 * Provides configuration options, supported boards, degrees, preloaded curricula, and AI status.
 */
export async function getConfig(req: AuthenticatedRequest, res: Response) {
  try {
    const aiConfig = getAIProviderConfig();

    return res.json({
      success: true,
      data: {
        aiProvider: {
          provider: aiConfig.provider,
          model: aiConfig.model,
          isLiveAi: aiConfig.provider !== 'mock',
          description:
            aiConfig.provider === 'mock'
              ? 'Development Pedagogical Mock Engine (No GEMINI_API_KEY or OPENAI_API_KEY detected in environment)'
              : `Active Production Engine (${aiConfig.provider.toUpperCase()} - ${aiConfig.model})`,
        },
        supportedEducation: {
          school: {
            boards: [
              'Tamil Nadu State Board (Samacheer Kalvi)',
              'CBSE (Central Board of Secondary Education)',
              'ICSE (Council for the Indian School Certificate)',
              'Matriculation Board',
              'Other / Custom Board',
            ],
            standards: [
              'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
              'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
              'Class 11', 'Class 12',
            ],
            commonSubjects: [
              'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Science',
              'Computer Science', 'English', 'Tamil', 'Social Science', 'Accountancy',
              'Economics', 'Business Studies',
            ],
          },
          college: {
            degreeLevels: ['Diploma', 'Undergraduate (UG)', 'Postgraduate (PG)', 'Engineering & Tech', 'Arts & Science'],
            degrees: [
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
            ],
            semesters: [
              'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
              'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
            ],
          },
        },
        questionTypes: [
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
        ],
        preloadedCurricula: PRELOADED_CURRICULA,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/blueprint/validate
 * Validates blueprint calculations, question counts, internal choices, and marks sum.
 */
export async function validateBlueprint(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = QuestionPaperBlueprintSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const blueprint = parse.data;

    let totalPrintedMarks = 0;
    let totalAttemptedMarks = 0;
    let totalPrintedQuestions = 0;
    let totalAttemptedQuestions = 0;

    const sectionSummaries = blueprint.sections.map((sec, idx) => {
      const required = sec.requiredQuestions !== undefined ? sec.requiredQuestions : sec.numberOfQuestions;
      const printedMarks = sec.numberOfQuestions * sec.marksPerQuestion;
      const attemptedMarks = required * sec.marksPerQuestion;

      totalPrintedMarks += printedMarks;
      totalAttemptedMarks += attemptedMarks;
      totalPrintedQuestions += sec.numberOfQuestions;
      totalAttemptedQuestions += required;

      return {
        sectionIndex: idx + 1,
        sectionLabel: sec.sectionLabel,
        questionType: sec.questionType,
        numberOfQuestions: sec.numberOfQuestions,
        requiredQuestions: required,
        marksPerQuestion: sec.marksPerQuestion,
        sectionAttemptedMarks: attemptedMarks,
        sectionPrintedMarks: printedMarks,
        hasInternalChoice: !!sec.hasInternalChoice,
      };
    });

    return res.json({
      success: true,
      data: {
        isValid: true,
        summary: {
          totalMarksRequested: blueprint.totalMarks,
          totalAttemptedMarks,
          totalPrintedMarks,
          totalPrintedQuestions,
          totalAttemptedQuestions,
          durationMinutes: blueprint.durationMinutes,
          sectionsCount: blueprint.sections.length,
          marksMatch: totalAttemptedMarks === blueprint.totalMarks,
        },
        sections: sectionSummaries,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/extract-syllabus
 * Extracts and sanitizes syllabus text from an uploaded document (.txt, .pdf, .docx).
 */
export async function extractSyllabus(req: AuthenticatedRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      // Check if raw text was passed in body
      if (req.body.rawText) {
        const sanitized = sanitizeSyllabusText(req.body.rawText);
        return res.json({
          success: true,
          data: {
            extractedText: sanitized,
            charCount: sanitized.length,
          },
        });
      }
      return res.status(400).json({ success: false, error: 'No syllabus file or text provided' });
    }

    const extracted = await extractTextFromFile(file.path, file.originalname, file.mimetype);

    return res.json({
      success: true,
      data: {
        extractedText: extracted,
        charCount: extracted.length,
        originalFilename: file.originalname,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/generate
 * Generates full question paper adhering strictly to blueprint.
 */
export async function generatePaper(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = QuestionPaperBlueprintSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Blueprint validation error',
        issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const blueprint = parse.data;
    const generationResult = await generateQuestionPaper(blueprint);

    return res.json({
      success: true,
      data: {
        blueprint,
        sections: generationResult.sections,
        aiMetadata: generationResult.aiMetadata,
      },
    });
  } catch (err: any) {
    console.error('[QuestionGeneratorController] Generation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/regenerate-question
 * Regenerates an individual question in a section.
 */
export async function regenerateQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = RegenerateQuestionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for question regeneration',
        issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const { blueprint, sectionId, questionId, previousQuestionText } = parse.data;

    const newQuestion = await regenerateSingleQuestion(
      blueprint,
      sectionId,
      questionId,
      previousQuestionText
    );

    return res.json({
      success: true,
      data: {
        question: newQuestion,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/papers
 * Saves a question paper record (draft or approved).
 */
export async function savePaper(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const body = req.body;
    const blueprint = body.blueprint;
    const sections = body.sections;
    const status = body.status || 'DRAFT';
    const paperId = body.id || `qp-${crypto.randomUUID()}`;
    const title = body.title || `${blueprint.subject} - ${blueprint.examType} (${blueprint.academicYear})`;

    const record: QuestionPaperRecord = {
      id: paperId,
      instituteId,
      title,
      educationLevel: blueprint.educationLevel,
      boardOrCourse: blueprint.educationLevel === 'SCHOOL' ? (blueprint.board || 'State Board') : (blueprint.degree || 'Degree'),
      standardOrDegree: blueprint.educationLevel === 'SCHOOL' ? (blueprint.standard || 'Class') : (blueprint.degree || 'Degree'),
      department: blueprint.department,
      semester: blueprint.semester,
      subject: blueprint.subject,
      subjectCode: blueprint.subjectCode,
      examType: blueprint.examType,
      language: blueprint.language,
      durationMinutes: blueprint.durationMinutes,
      totalMarks: blueprint.totalMarks,
      passingMarks: blueprint.passingMarks,
      academicYear: blueprint.academicYear,
      examDate: blueprint.examDate,
      instituteName: blueprint.instituteName,
      instituteAddress: blueprint.instituteAddress,
      instituteLogoUrl: blueprint.instituteLogoUrl,
      generalInstructions: blueprint.generalInstructions || [
        'Read all instructions carefully before writing the answers.',
        'Answer all questions according to the section guidelines.',
        'Write neatly and legibly.',
      ],
      sections,
      syllabusSummary: blueprint.syllabusDetails.portionsSummary || `${blueprint.syllabusDetails.chaptersOrUnits.length} chapters/units covered`,
      status,
      aiMetadata: body.aiMetadata || {
        provider: 'tuition-system',
        model: 'v1.0',
        isMock: false,
        generatedAt: new Date().toISOString(),
      },
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: req.user?.userId || 'unknown-user',
    };

    const saved = QuestionPaperStorageService.savePaper(instituteId, record);

    return res.json({
      success: true,
      data: {
        paper: saved,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/question-generator/papers
 * Lists saved papers for the active institute.
 */
export async function listPapers(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const status = req.query.status as string;
    const subject = req.query.subject as string;

    const list = QuestionPaperStorageService.listPapers(instituteId, { status, subject });

    // Exclude full answer key from summary list for lightweight network response
    const sanitizedList = list.map((p) => ({
      id: p.id,
      title: p.title,
      educationLevel: p.educationLevel,
      boardOrCourse: p.boardOrCourse,
      standardOrDegree: p.standardOrDegree,
      subject: p.subject,
      examType: p.examType,
      totalMarks: p.totalMarks,
      durationMinutes: p.durationMinutes,
      academicYear: p.academicYear,
      examDate: p.examDate,
      status: p.status,
      isMock: p.aiMetadata?.isMock,
      provider: p.aiMetadata?.provider,
      updatedAt: p.updatedAt,
      sectionsCount: p.sections.length,
      questionsCount: p.sections.reduce((acc, s) => acc + s.questions.length, 0),
    }));

    return res.json({
      success: true,
      data: {
        papers: sanitizedList,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/question-generator/papers/:id
 * Retrieves full paper with questions (without teacher-only answer keys).
 */
export async function getPaperById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const paperId = req.params.id;
    const paper = QuestionPaperStorageService.getPaperById(instituteId, paperId);

    if (!paper) {
      return res.status(404).json({ success: false, error: 'Question paper not found' });
    }

    return res.json({
      success: true,
      data: {
        paper,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/question-generator/papers/:id/answer-key
 * Retrieves separate, teacher-only answer key with marking criteria.
 * STRICT SECURITY: Access is strictly checked for teacher/admin roles.
 */
export async function getAnswerKey(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const paperId = req.params.id;
    const paper = QuestionPaperStorageService.getPaperById(instituteId, paperId);

    if (!paper) {
      return res.status(404).json({ success: false, error: 'Question paper not found' });
    }

    // Build structured answer key
    const answerKeySections = paper.sections.map((sec) => ({
      sectionId: sec.sectionId,
      sectionLabel: sec.sectionLabel,
      questionType: sec.questionType,
      marksPerQuestion: sec.marksPerQuestion,
      questions: sec.questions.map((q) => ({
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        marks: q.marks,
        correctAnswer: q.correctAnswer,
        options: q.options,
        answerKeyGuidance: q.answerKeyGuidance || `Detailed answer evaluating key points for ${q.marks} marks.`,
        chapterOrUnit: q.chapterOrUnit,
        topic: q.topic,
        internalChoiceGroupId: q.internalChoiceGroupId,
        isAlternativeChoice: q.isAlternativeChoice,
      })),
    }));

    return res.json({
      success: true,
      data: {
        paperId: paper.id,
        paperTitle: paper.title,
        subject: paper.subject,
        standardOrDegree: paper.standardOrDegree,
        academicYear: paper.academicYear,
        totalMarks: paper.totalMarks,
        answerKeySections,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/question-generator/papers/:id/duplicate
 * Duplicates a paper into a fresh DRAFT.
 */
export async function duplicatePaper(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const paperId = req.params.id;
    const duplicated = QuestionPaperStorageService.duplicatePaper(
      instituteId,
      paperId,
      req.user?.userId || 'unknown-user'
    );

    if (!duplicated) {
      return res.status(404).json({ success: false, error: 'Source question paper not found' });
    }

    return res.json({
      success: true,
      data: {
        paper: duplicated,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/question-generator/papers/:id
 */
export async function deletePaper(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const paperId = req.params.id;
    const deleted = QuestionPaperStorageService.deletePaper(instituteId, paperId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Question paper not found' });
    }

    return res.json({
      success: true,
      message: 'Question paper successfully deleted',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
