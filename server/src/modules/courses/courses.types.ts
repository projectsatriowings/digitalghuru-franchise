import { z } from 'zod';

export const CourseStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const LearningModeEnum = z.enum(['ONLINE', 'OFFLINE']);
export const EnrollmentStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED']);
export const AttachmentTypeEnum = z.enum(['PDF', 'ZIP', 'DOCUMENT', 'EXTERNAL_LINK', 'IMAGE']);

// -------------------------------------------------------------
// COURSE CATEGORIES
// -------------------------------------------------------------
export const CreateCourseCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/i, 'Slug must contain only alphanumeric characters and hyphens'),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const UpdateCourseCategorySchema = CreateCourseCategorySchema.partial();

// -------------------------------------------------------------
// CURRICULUM CHAPTER & MODULE SCHEMAS
// -------------------------------------------------------------
export const CreateAttachmentSchema = z.object({
  title: z.string().min(1).max(255),
  fileUrl: z.string().min(1),
  fileKey: z.string().optional().nullable(),
  fileSize: z.number().int().default(0),
  mimeType: z.string().optional().nullable(),
  type: AttachmentTypeEnum.optional(),
  fileType: AttachmentTypeEnum.optional(),
  isDownloadable: z.boolean().optional(),
  isDownload: z.boolean().optional(),
  sortOrder: z.number().int().default(0),
});

export const CreateChapterSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  pdfUrl: z.string().optional().nullable(),
  duration: z.string().optional().default('10:00'),
  position: z.number().int().default(0),
  isFree: z.boolean().default(false),
  attachments: z.array(CreateAttachmentSchema).optional().default([]),
});

export const UpdateChapterSchema = CreateChapterSchema.partial();

export const CreateModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  position: z.number().int().default(0),
  chapters: z.array(CreateChapterSchema).optional().default([]),
});

export const UpdateModuleSchema = CreateModuleSchema.partial();

export const ReplaceDraftCurriculumSchema = z.object({
  modules: z.array(CreateModuleSchema),
});

// -------------------------------------------------------------
// EXTENSIBLE FUTURE COURSE ARCHITECTURE CONFIG
// -------------------------------------------------------------
export const ExtensibleConfigSchema = z.object({
  schemaVersion: z.number().int().default(1),
  featureFlags: z.object({
    showCareerFeatures: z.boolean().optional(),
    certificatesEnabled: z.boolean().optional(),
    xpEnabled: z.boolean().optional(),
    lessonXp: z.number().int().min(0).max(500).optional(),
    completionXp: z.number().int().min(0).max(5000).optional(),
    allowFreePreview: z.boolean().optional(),
    quizzesEnabled: z.boolean().optional(),
    assignmentsEnabled: z.boolean().optional(),
    discussionsEnabled: z.boolean().optional(),
    liveSessionsEnabled: z.boolean().optional(),
  }).optional(),
  customAttributes: z.array(z.object({
    key: z.string().min(1).max(100),
    label: z.string().min(1).max(120),
    value: z.string().max(500),
    type: z.enum(['TEXT', 'NUMBER', 'URL', 'BADGE', 'BOOLEAN']).default('TEXT'),
  })).optional(),
  customSections: z.array(z.object({
    id: z.string().optional(),
    key: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    subtitle: z.string().optional().nullable(),
    layoutType: z.enum(['CARDS', 'BULLETS', 'METRICS', 'CTA', 'RESOURCES']).default('CARDS'),
    placement: z.enum(['OVERVIEW', 'AFTER_HIGHLIGHTS', 'AFTER_CURRICULUM', 'SIDEBAR']).default('AFTER_CURRICULUM'),
    isVisible: z.boolean().default(true),
    items: z.array(z.object({
      title: z.string().min(1),
      subtitle: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      iconName: z.string().optional().nullable(),
      badge: z.string().optional().nullable(),
      url: z.string().optional().nullable(),
    })).default([]),
  })).optional(),
});

// -------------------------------------------------------------
// GLOBAL COURSE (10-STEP WIZARD + EXTENSIBLE FIELDS)
// -------------------------------------------------------------
export const CreateGlobalCourseSchema = z.object({
  title: z.string().min(2).max(255),
  slug: z.string().min(2).max(255).regex(/^[a-z0-9-]+$/i, 'Slug must contain only alphanumeric characters and hyphens'),
  categoryId: z.string().uuid().optional().nullable(),
  subTitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  format: z.string().default('Online / Classroom'),
  duration: z.string().optional().nullable(),
  price: z.union([z.number(), z.string()]).default(0),
  status: CourseStatusEnum.default('DRAFT'),
  thumbnailUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  brochureUrl: z.string().optional().nullable(),
  level: z.string().default('Beginner to Advanced'),
  prerequisites: z.string().optional().nullable(),
  learningOutcomes: z.array(z.string()).optional().default([]),
  skillsCovered: z.array(z.string()).optional().default([]),
  targetAudience: z.array(z.string()).optional().default([]),
  toolsCovered: z.array(z.string()).optional().default([]),
  overviewJson: z.any().optional().nullable(),
  designedToHelpJson: z.any().optional().nullable(),
  numberedFeaturesJson: z.any().optional().nullable(),
  whyDigitalGhuruJson: z.any().optional().nullable(),
  topHighlightsJson: z.any().optional().nullable(),
  faqsJson: z.any().optional().nullable(),
  extensibleConfig: ExtensibleConfigSchema.optional().nullable(),
  modules: z.array(CreateModuleSchema).optional().default([]),
});

export const UpdateGlobalCourseSchema = CreateGlobalCourseSchema.partial();

// -------------------------------------------------------------
// FRANCHISE PERMISSION GOVERNANCE, SELECTION & PRICING
// -------------------------------------------------------------
export const FranchiseCoursePermissionSchema = z.object({
  courseId: z.string().uuid(),
  isPermitted: z.boolean().default(true),
  isEnabled: z.boolean().optional(),
  customPrice: z.union([z.number(), z.string()]).optional().nullable(),
});

export const BulkFranchisePermissionSchema = z.object({
  franchiseIds: z.array(z.string().uuid()).optional(),
  allActiveFranchises: z.boolean().optional().default(false),
  isPermitted: z.boolean().default(true),
  autoEnable: z.boolean().optional().default(false),
});

export const FranchiseCourseSelectionSchema = z.object({
  courseId: z.string().uuid(),
  isEnabled: z.boolean().default(true),
  customPrice: z.union([z.number(), z.string()]).optional().nullable(),
});

export const FranchisePricingSchema = z.object({
  customPrice: z.union([z.number(), z.string()]).nullable(),
});

// -------------------------------------------------------------
// ENROLLMENT & TRANSFER SCHEMAS
// -------------------------------------------------------------
export const EnrollStudentSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  franchiseId: z.string().uuid(),
  mode: LearningModeEnum.default('ONLINE'),
  instituteId: z.string().uuid().optional().nullable(),
  batchId: z.string().uuid().optional().nullable(),
});

export const TransferEnrollmentSchema = z.object({
  newMode: LearningModeEnum.optional(),
  mode: LearningModeEnum.optional(),
  newFranchiseId: z.string().uuid().optional(),
  franchiseId: z.string().uuid().optional(),
  newInstituteId: z.string().uuid().optional().nullable(),
  instituteId: z.string().uuid().optional().nullable(),
  newBatchId: z.string().uuid().optional().nullable(),
  targetBatchId: z.string().uuid().optional().nullable(),
  batchId: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
});

// -------------------------------------------------------------
// LEARNING PROGRESS & GAMIFICATION
// -------------------------------------------------------------
export const CompleteLessonSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  timeSpentSec: z.number().int().optional().default(60),
});

export const UpdateProgressPositionSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  watchedSeconds: z.number().int().default(0),
});

// -------------------------------------------------------------
// CERTIFICATE CLAIM
// -------------------------------------------------------------
export const ClaimCertificateSchema = z.object({
  courseId: z.string().uuid(),
});
