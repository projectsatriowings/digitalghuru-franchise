"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimCertificateSchema = exports.UpdateProgressPositionSchema = exports.CompleteLessonSchema = exports.TransferEnrollmentSchema = exports.EnrollStudentSchema = exports.FranchisePricingSchema = exports.FranchiseCourseSelectionSchema = exports.BulkFranchisePermissionSchema = exports.FranchiseCoursePermissionSchema = exports.UpdateGlobalCourseSchema = exports.CreateGlobalCourseSchema = exports.ExtensibleConfigSchema = exports.ReplaceDraftCurriculumSchema = exports.UpdateModuleSchema = exports.CreateModuleSchema = exports.UpdateChapterSchema = exports.CreateChapterSchema = exports.CreateAttachmentSchema = exports.UpdateCourseCategorySchema = exports.CreateCourseCategorySchema = exports.AttachmentTypeEnum = exports.EnrollmentStatusEnum = exports.LearningModeEnum = exports.CourseStatusEnum = void 0;
const zod_1 = require("zod");
exports.CourseStatusEnum = zod_1.z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
exports.LearningModeEnum = zod_1.z.enum(['ONLINE', 'OFFLINE']);
exports.EnrollmentStatusEnum = zod_1.z.enum(['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED']);
exports.AttachmentTypeEnum = zod_1.z.enum(['PDF', 'ZIP', 'DOCUMENT', 'EXTERNAL_LINK', 'IMAGE']);
// -------------------------------------------------------------
// COURSE CATEGORIES
// -------------------------------------------------------------
exports.CreateCourseCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    slug: zod_1.z.string().min(2).max(100).regex(/^[a-z0-9-]+$/i, 'Slug must contain only alphanumeric characters and hyphens'),
    description: zod_1.z.string().optional().nullable(),
    icon: zod_1.z.string().optional().nullable(),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.UpdateCourseCategorySchema = exports.CreateCourseCategorySchema.partial();
// -------------------------------------------------------------
// CURRICULUM CHAPTER & MODULE SCHEMAS
// -------------------------------------------------------------
exports.CreateAttachmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    fileUrl: zod_1.z.string().min(1),
    fileKey: zod_1.z.string().optional().nullable(),
    fileSize: zod_1.z.number().int().default(0),
    mimeType: zod_1.z.string().optional().nullable(),
    type: exports.AttachmentTypeEnum.optional(),
    fileType: exports.AttachmentTypeEnum.optional(),
    isDownloadable: zod_1.z.boolean().optional(),
    isDownload: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.CreateChapterSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional().nullable(),
    videoUrl: zod_1.z.string().optional().nullable(),
    pdfUrl: zod_1.z.string().optional().nullable(),
    duration: zod_1.z.string().optional().default('10:00'),
    position: zod_1.z.number().int().default(0),
    isFree: zod_1.z.boolean().default(false),
    attachments: zod_1.z.array(exports.CreateAttachmentSchema).optional().default([]),
});
exports.UpdateChapterSchema = exports.CreateChapterSchema.partial();
exports.CreateModuleSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional().nullable(),
    position: zod_1.z.number().int().default(0),
    chapters: zod_1.z.array(exports.CreateChapterSchema).optional().default([]),
});
exports.UpdateModuleSchema = exports.CreateModuleSchema.partial();
exports.ReplaceDraftCurriculumSchema = zod_1.z.object({
    modules: zod_1.z.array(exports.CreateModuleSchema),
});
// -------------------------------------------------------------
// EXTENSIBLE FUTURE COURSE ARCHITECTURE CONFIG
// -------------------------------------------------------------
exports.ExtensibleConfigSchema = zod_1.z.object({
    schemaVersion: zod_1.z.number().int().default(1),
    featureFlags: zod_1.z.object({
        showCareerFeatures: zod_1.z.boolean().optional(),
        certificatesEnabled: zod_1.z.boolean().optional(),
        xpEnabled: zod_1.z.boolean().optional(),
        lessonXp: zod_1.z.number().int().min(0).max(500).optional(),
        completionXp: zod_1.z.number().int().min(0).max(5000).optional(),
        allowFreePreview: zod_1.z.boolean().optional(),
        quizzesEnabled: zod_1.z.boolean().optional(),
        assignmentsEnabled: zod_1.z.boolean().optional(),
        discussionsEnabled: zod_1.z.boolean().optional(),
        liveSessionsEnabled: zod_1.z.boolean().optional(),
    }).optional(),
    customAttributes: zod_1.z.array(zod_1.z.object({
        key: zod_1.z.string().min(1).max(100),
        label: zod_1.z.string().min(1).max(120),
        value: zod_1.z.string().max(500),
        type: zod_1.z.enum(['TEXT', 'NUMBER', 'URL', 'BADGE', 'BOOLEAN']).default('TEXT'),
    })).optional(),
    customSections: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        key: zod_1.z.string().min(1).max(100),
        title: zod_1.z.string().min(1).max(200),
        subtitle: zod_1.z.string().optional().nullable(),
        layoutType: zod_1.z.enum(['CARDS', 'BULLETS', 'METRICS', 'CTA', 'RESOURCES']).default('CARDS'),
        placement: zod_1.z.enum(['OVERVIEW', 'AFTER_HIGHLIGHTS', 'AFTER_CURRICULUM', 'SIDEBAR']).default('AFTER_CURRICULUM'),
        isVisible: zod_1.z.boolean().default(true),
        items: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string().min(1),
            subtitle: zod_1.z.string().optional().nullable(),
            description: zod_1.z.string().optional().nullable(),
            iconName: zod_1.z.string().optional().nullable(),
            badge: zod_1.z.string().optional().nullable(),
            url: zod_1.z.string().optional().nullable(),
        })).default([]),
    })).optional(),
});
// -------------------------------------------------------------
// GLOBAL COURSE (10-STEP WIZARD + EXTENSIBLE FIELDS)
// -------------------------------------------------------------
exports.CreateGlobalCourseSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(255),
    slug: zod_1.z.string().min(2).max(255).regex(/^[a-z0-9-]+$/i, 'Slug must contain only alphanumeric characters and hyphens'),
    categoryId: zod_1.z.string().uuid().optional().nullable(),
    subTitle: zod_1.z.string().optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    format: zod_1.z.string().default('Online / Classroom'),
    duration: zod_1.z.string().optional().nullable(),
    price: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).default(0),
    status: exports.CourseStatusEnum.default('DRAFT'),
    thumbnailUrl: zod_1.z.string().optional().nullable(),
    bannerUrl: zod_1.z.string().optional().nullable(),
    brochureUrl: zod_1.z.string().optional().nullable(),
    level: zod_1.z.string().default('Beginner to Advanced'),
    prerequisites: zod_1.z.string().optional().nullable(),
    learningOutcomes: zod_1.z.array(zod_1.z.string()).optional().default([]),
    skillsCovered: zod_1.z.array(zod_1.z.string()).optional().default([]),
    targetAudience: zod_1.z.array(zod_1.z.string()).optional().default([]),
    toolsCovered: zod_1.z.array(zod_1.z.string()).optional().default([]),
    overviewJson: zod_1.z.any().optional().nullable(),
    designedToHelpJson: zod_1.z.any().optional().nullable(),
    numberedFeaturesJson: zod_1.z.any().optional().nullable(),
    whyDigitalGhuruJson: zod_1.z.any().optional().nullable(),
    topHighlightsJson: zod_1.z.any().optional().nullable(),
    faqsJson: zod_1.z.any().optional().nullable(),
    extensibleConfig: exports.ExtensibleConfigSchema.optional().nullable(),
    modules: zod_1.z.array(exports.CreateModuleSchema).optional().default([]),
});
exports.UpdateGlobalCourseSchema = exports.CreateGlobalCourseSchema.partial();
// -------------------------------------------------------------
// FRANCHISE PERMISSION GOVERNANCE, SELECTION & PRICING
// -------------------------------------------------------------
exports.FranchiseCoursePermissionSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
    isPermitted: zod_1.z.boolean().default(true),
    isEnabled: zod_1.z.boolean().optional(),
    customPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional().nullable(),
});
exports.BulkFranchisePermissionSchema = zod_1.z.object({
    franchiseIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    allActiveFranchises: zod_1.z.boolean().optional().default(false),
    isPermitted: zod_1.z.boolean().default(true),
    autoEnable: zod_1.z.boolean().optional().default(false),
});
exports.FranchiseCourseSelectionSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
    isEnabled: zod_1.z.boolean().default(true),
    customPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional().nullable(),
});
exports.FranchisePricingSchema = zod_1.z.object({
    customPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).nullable(),
});
// -------------------------------------------------------------
// ENROLLMENT & TRANSFER SCHEMAS
// -------------------------------------------------------------
exports.EnrollStudentSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid(),
    courseId: zod_1.z.string().uuid(),
    franchiseId: zod_1.z.string().uuid(),
    mode: exports.LearningModeEnum.default('ONLINE'),
    instituteId: zod_1.z.string().uuid().optional().nullable(),
    batchId: zod_1.z.string().uuid().optional().nullable(),
});
exports.TransferEnrollmentSchema = zod_1.z.object({
    newMode: exports.LearningModeEnum.optional(),
    mode: exports.LearningModeEnum.optional(),
    newFranchiseId: zod_1.z.string().uuid().optional(),
    franchiseId: zod_1.z.string().uuid().optional(),
    newInstituteId: zod_1.z.string().uuid().optional().nullable(),
    instituteId: zod_1.z.string().uuid().optional().nullable(),
    newBatchId: zod_1.z.string().uuid().optional().nullable(),
    targetBatchId: zod_1.z.string().uuid().optional().nullable(),
    batchId: zod_1.z.string().uuid().optional().nullable(),
    reason: zod_1.z.string().optional(),
});
// -------------------------------------------------------------
// LEARNING PROGRESS & GAMIFICATION
// -------------------------------------------------------------
exports.CompleteLessonSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
    chapterId: zod_1.z.string().uuid(),
    timeSpentSec: zod_1.z.number().int().optional().default(60),
});
exports.UpdateProgressPositionSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
    chapterId: zod_1.z.string().uuid(),
    watchedSeconds: zod_1.z.number().int().default(0),
});
// -------------------------------------------------------------
// CERTIFICATE CLAIM
// -------------------------------------------------------------
exports.ClaimCertificateSchema = zod_1.z.object({
    courseId: zod_1.z.string().uuid(),
});
