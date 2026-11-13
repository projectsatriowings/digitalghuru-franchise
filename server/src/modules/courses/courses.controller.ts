import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { CoursesService, CoursePermissionForbiddenError } from './courses.service.js';
import {
  CreateCourseCategorySchema,
  UpdateCourseCategorySchema,
  CreateGlobalCourseSchema,
  UpdateGlobalCourseSchema,
  UpdateChapterSchema,
  ReplaceDraftCurriculumSchema,
  FranchiseCoursePermissionSchema,
  BulkFranchisePermissionSchema,
  FranchiseCourseSelectionSchema,
  EnrollStudentSchema,
  TransferEnrollmentSchema,
  CompleteLessonSchema,
  ClaimCertificateSchema
} from './courses.types.js';
import { CourseStatus, LearningMode, EnrollmentStatus, UserRole } from '@prisma/client';
import { prisma } from '../../prisma.js';
import {
  resolveAbsolutePath,
  isPublicCourseFolder,
  isProtectedCourseFolder,
  getMimeType,
  StorageManager,
} from '../../utils/storage.js';
import {
  verifyAccessToken,
  verifyMediaToken,
  generateMediaToken,
} from '../../utils/security.js';

// -------------------------------------------------------------
// TENANT & OWNERSHIP AUTHORIZATION HELPERS
// -------------------------------------------------------------
async function authorizeFranchiseAccess(user: any, targetFranchiseId: string): Promise<{
  allowed: boolean;
  isBranchScoped: boolean;
  allowedInstituteIds: string[];
}> {
  if (!user) return { allowed: false, isBranchScoped: false, allowedInstituteIds: [] };
  if (user.role === UserRole.SUPER_ADMIN) {
    return { allowed: true, isBranchScoped: false, allowedInstituteIds: [] };
  }

  const userId = user.userId || user.id;
  if (!userId) return { allowed: false, isBranchScoped: false, allowedInstituteIds: [] };

  // Franchise owner owns their franchise(s)
  if (user.role === UserRole.FRANCHISE_OWNER) {
    const owned = await prisma.franchise.findFirst({
      where: { id: targetFranchiseId, ownerUserId: userId },
      select: { id: true },
    });
    if (owned || user.franchiseId === targetFranchiseId) {
      return { allowed: true, isBranchScoped: false, allowedInstituteIds: [] };
    }
  }

  // Branch/Academic Admin via active InstituteMembership
  const memberships = await prisma.instituteMembership.findMany({
    where: { userId, isActive: true },
    include: { institute: { select: { id: true, franchiseId: true } } },
  });

  const matchingInstIds = memberships
    .filter((m) => m.institute?.franchiseId === targetFranchiseId)
    .map((m) => m.instituteId);

  if (matchingInstIds.length > 0) {
    return { allowed: true, isBranchScoped: user.role !== UserRole.FRANCHISE_OWNER, allowedInstituteIds: matchingInstIds };
  }

  return { allowed: false, isBranchScoped: false, allowedInstituteIds: [] };
}

async function resolveAuthorizedStudentId(user: any, requestedStudentId?: string | null): Promise<{
  allowed: boolean;
  studentId?: string;
  message?: string;
}> {
  if (!user) return { allowed: false, message: 'Unauthorized' };
  const userId = user.userId || user.id;

  if (user.role === UserRole.SUPER_ADMIN) {
    if (!requestedStudentId) return { allowed: false, message: 'studentId is required' };
    return { allowed: true, studentId: requestedStudentId };
  }

  if (user.role === UserRole.STUDENT) {
    const student = await prisma.student.findFirst({ where: { userId }, select: { id: true } });
    if (!student) return { allowed: false, message: 'Student profile not found for account' };
    if (requestedStudentId && requestedStudentId !== student.id) {
      return { allowed: false, message: 'Forbidden: Students may only access their own learning records' };
    }
    return { allowed: true, studentId: student.id };
  }

  if (user.role === UserRole.PARENT) {
    const parent = await prisma.parentProfile.findFirst({
      where: { userId },
      include: { studentRelations: { select: { studentId: true } } },
    });
    const linkedIds = parent?.studentRelations.map((r) => r.studentId) || [];
    if (!requestedStudentId) return { allowed: false, message: 'studentId is required' };
    if (!linkedIds.includes(requestedStudentId)) {
      return { allowed: false, message: 'Forbidden: Parent is not linked to this student' };
    }
    return { allowed: true, studentId: requestedStudentId };
  }

  // Franchise Owner / Branch Admin / Academic Admin / Staff
  if (!requestedStudentId) return { allowed: false, message: 'studentId is required' };
  const student = await prisma.student.findUnique({
    where: { id: requestedStudentId },
    include: { institute: { select: { id: true, franchiseId: true } } },
  });
  if (!student) return { allowed: false, message: 'Student not found' };

  const studentFranchiseId = student.institute?.franchiseId || student.franchiseId;
  if (!studentFranchiseId) return { allowed: false, message: 'Student franchise context missing' };

  const auth = await authorizeFranchiseAccess(user, studentFranchiseId);
  if (!auth.allowed) {
    return { allowed: false, message: 'Forbidden: Student belongs to a different franchise' };
  }
  if (auth.isBranchScoped && student.instituteId && !auth.allowedInstituteIds.includes(student.instituteId)) {
    return { allowed: false, message: 'Forbidden: Student belongs to a different branch' };
  }

  return { allowed: true, studentId: student.id };
}

// -------------------------------------------------------------
// 1. CATEGORIES CONTROLLERS
// -------------------------------------------------------------
export async function listCategories(_req: Request, res: Response) {
  try {
    const categories = await CoursesService.listCategories();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list categories' });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const parse = CreateCourseCategorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const category = await CoursesService.createCategory(parse.data);
    res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create category' });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const parse = UpdateCourseCategorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const category = await CoursesService.updateCategory(id, parse.data);
    res.json({ success: true, data: category });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update category' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await CoursesService.deleteCategory(id);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete category' });
  }
}

// -------------------------------------------------------------
// 2. GLOBAL COURSES CONTROLLERS
// -------------------------------------------------------------
export async function listGlobalCourses(req: Request, res: Response) {
  try {
    const { status, categoryId, search, page, limit } = req.query;
    const courses = await CoursesService.listCourses({
      status: status as CourseStatus,
      categoryId: categoryId as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    res.json({ success: true, ...courses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list courses' });
  }
}

export async function getGlobalCourseById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const course = await CoursesService.getCourseByIdOrSlug(id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Format modules to support both legacy and versioned response shapes
    const modules = course.activeCurriculumVersion?.modules.map((mod: any) => ({
      ...mod,
      lessons: mod.chapters.map((ch: any) => ({
        ...ch,
        isFree: ch.isFree,
      }))
    })) || [];

    res.json({
      success: true,
      data: {
        ...course,
        modules,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch course' });
  }
}

function normalizeWhoIsThisFor(items: any[]): any[] {
  return items.map((a: any) => {
    if (typeof a === 'string') {
      return { title: a, role: a, description: '', desc: '', bullets: [], points: [] };
    }
    const title = a?.title || a?.role || '';
    const description = a?.description || a?.desc || '';
    const rawBullets = Array.isArray(a?.bullets) && a.bullets.length > 0
      ? a.bullets
      : (Array.isArray(a?.points) ? a.points : []);
    return {
      ...a,
      title,
      role: title,
      description,
      desc: description,
      bullets: rawBullets,
      points: rawBullets,
    };
  });
}

function normalizeWizardCoursePayload(rawBody: any) {
  const body = { ...rawBody };

  if (body.price === undefined) {
    const rawPrice = body.discountedPrice || body.originalPrice;
    if (rawPrice !== undefined && rawPrice !== '') {
      body.price = Number(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
    } else if (body.isUpdate === undefined) {
      body.price = 0;
    }
  }

  if (body.subTitle === undefined && body.subtitle !== undefined) {
    body.subTitle = body.subtitle;
  }

  if (body.thumbnailUrl === undefined && body.cardImage !== undefined) {
    body.thumbnailUrl = body.cardImage;
  }
  if (body.bannerUrl === undefined && body.bannerImage !== undefined) {
    body.bannerUrl = body.bannerImage;
  }

  if (body.status === undefined && body.isPublished !== undefined) {
    body.status = body.isPublished ? 'PUBLISHED' : 'DRAFT';
  }

  // Map rich 10-step marketing_data / marketingData if supplied directly from the wizard
  const m = body.marketing_data && typeof body.marketing_data === 'object'
    ? body.marketing_data
    : (body.marketingData && typeof body.marketingData === 'object' ? body.marketingData : null);

  if (m) {
    const normalizedAudiences = Array.isArray(m.whoIsThisForData)
      ? normalizeWhoIsThisFor(m.whoIsThisForData)
      : (body.overviewJson?.whoIsThisForData ?? []);

    const extensibleConfig =
      body.extensibleConfig ?? m.extensibleConfig ?? body.overviewJson?.extensibleConfig;

    body.overviewJson = {
      ...(body.overviewJson || {}),
      overviewDescription: m.overviewDescription ?? body.overviewJson?.overviewDescription ?? [],
      overviewLearnings: m.overviewLearnings ?? body.overviewJson?.overviewLearnings ?? [],
      originalPrice: body.originalPrice ?? m.originalPrice ?? body.overviewJson?.originalPrice ?? '',
      discountedPrice: body.discountedPrice ?? m.discountedPrice ?? body.overviewJson?.discountedPrice ?? '',
      batchInfo: body.batchInfo ?? m.batchInfo ?? body.overviewJson?.batchInfo ?? '',
      location: body.location ?? m.location ?? body.overviewJson?.location ?? '',
      showCareerFeatures:
        m.showCareerFeatures !== undefined
          ? m.showCareerFeatures
          : (extensibleConfig?.featureFlags?.showCareerFeatures !== undefined
            ? extensibleConfig.featureFlags.showCareerFeatures
            : true),
      whoIsThisForData: normalizedAudiences,
      categorizedToolsData: m.categorizedToolsData ?? body.overviewJson?.categorizedToolsData ?? [],
      ...(m.usps !== undefined ? { usps: m.usps } : {}),
      ...(extensibleConfig ? { extensibleConfig } : {}),
    };
    if (m.overviewLearnings) body.learningOutcomes = m.overviewLearnings;
    if (m.designedToHelp) body.designedToHelpJson = m.designedToHelp;
    if (m.numberedFeatures) body.numberedFeaturesJson = m.numberedFeatures;
    if (m.whyDigitalGhuru) body.whyDigitalGhuruJson = m.whyDigitalGhuru;
    if (m.highlightsData) body.topHighlightsJson = m.highlightsData;
    if (m.faqs) body.faqsJson = m.faqs;
    if (Array.isArray(normalizedAudiences)) {
      body.targetAudience = normalizedAudiences.map((a: any) => a.title || a.role).filter(Boolean);
    }
    if (Array.isArray(m.tools)) {
      body.toolsCovered = m.tools;
    }
  } else if (
    body.originalPrice !== undefined ||
    body.discountedPrice !== undefined ||
    body.batchInfo !== undefined ||
    body.location !== undefined ||
    body.extensibleConfig !== undefined
  ) {
    body.overviewJson = {
      ...(body.overviewJson || {}),
      ...(body.originalPrice !== undefined && { originalPrice: body.originalPrice }),
      ...(body.discountedPrice !== undefined && { discountedPrice: body.discountedPrice }),
      ...(body.batchInfo !== undefined && { batchInfo: body.batchInfo }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.extensibleConfig !== undefined && { extensibleConfig: body.extensibleConfig }),
    };
  }

  // Normalizing modules / lessons to chapters
  if (Array.isArray(body.modules)) {
    body.modules = body.modules.map((mod: any, mIdx: number) => ({
      title: mod.title || `Module ${mIdx + 1}`,
      description: mod.description || null,
      position: mod.position !== undefined ? mod.position : mIdx,
      chapters: (mod.chapters || mod.lessons || []).map((ch: any, cIdx: number) => ({
        title: ch.title || `Chapter ${cIdx + 1}`,
        description: ch.description || null,
        videoUrl: ch.videoUrl || null,
        pdfUrl: ch.pdfUrl || null,
        duration: ch.duration || '10:00',
        position: ch.position !== undefined ? ch.position : cIdx,
        isFree: Boolean(ch.isFree),
        attachments: (ch.attachments || ch.materials || []).map((att: any) => ({
          title: att.title || 'Resource',
          fileUrl: att.fileUrl,
          fileType: att.fileType || att.type || 'PDF',
          type: att.fileType || att.type || 'PDF',
          fileSize: Number(att.fileSize) || 0,
          isDownload: att.isDownload !== undefined ? Boolean(att.isDownload) : (att.isDownloadable !== undefined ? Boolean(att.isDownloadable) : true),
          isDownloadable: att.isDownload !== undefined ? Boolean(att.isDownload) : (att.isDownloadable !== undefined ? Boolean(att.isDownloadable) : true),
        })),
      }))
    }));
  }

  return body;
}

export async function createGlobalCourse(req: Request, res: Response) {
  try {
    const body = normalizeWizardCoursePayload(req.body);

    const parse = CreateGlobalCourseSchema.safeParse(body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const user = (req as any).user;
    const course = await CoursesService.createCourse(parse.data, user?.id || user?.userId);

    res.status(201).json({
      success: true,
      data: {
        ...course,
        modules: course.activeCurriculumVersion?.modules || [],
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create course' });
  }
}

export async function updateGlobalCourse(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = normalizeWizardCoursePayload({ ...req.body, isUpdate: true });

    const parse = UpdateGlobalCourseSchema.safeParse(body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const course = await CoursesService.updateCourse(id, parse.data);
    res.json({ success: true, data: course });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update course' });
  }
}

export async function updateDraftChapter(req: Request, res: Response) {
  try {
    const { chapterId } = req.params;
    const parse = UpdateChapterSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const chapter = await CoursesService.updateDraftChapter(chapterId, parse.data);
    res.json({ success: true, data: chapter });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update draft chapter' });
  }
}

export async function replaceDraftCurriculum(req: Request, res: Response) {
  try {
    const { id, versionId } = req.params;
    const rawModules = Array.isArray(req.body?.modules)
      ? req.body.modules.map((mod: any, mIdx: number) => ({
        title: mod.title || `Module ${mIdx + 1}`,
        description: mod.description || null,
        position: mod.position !== undefined ? mod.position : mIdx,
        chapters: (mod.chapters || mod.lessons || []).map((ch: any, cIdx: number) => ({
          title: ch.title || `Lesson ${cIdx + 1}`,
          description: ch.description || null,
          videoUrl: ch.videoUrl || null,
          pdfUrl: ch.pdfUrl || null,
          duration: ch.duration || '10:00',
          position: ch.position !== undefined ? ch.position : cIdx,
          isFree: Boolean(ch.isFree),
          attachments: (ch.attachments || ch.materials || []).map((att: any) => ({
            title: att.title || 'Resource',
            fileUrl: att.fileUrl,
            fileType: att.fileType || att.type || 'PDF',
            type: att.fileType || att.type || 'PDF',
            fileSize: Number(att.fileSize) || 0,
            isDownload: att.isDownload !== undefined ? Boolean(att.isDownload) : (att.isDownloadable !== undefined ? Boolean(att.isDownloadable) : true),
            isDownloadable: att.isDownload !== undefined ? Boolean(att.isDownload) : (att.isDownloadable !== undefined ? Boolean(att.isDownloadable) : true),
          })),
        })),
      }))
      : req.body?.modules;

    const parse = ReplaceDraftCurriculumSchema.safeParse({ modules: rawModules });
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const updatedVersion = await CoursesService.replaceDraftCurriculum(id, versionId, parse.data.modules);
    res.json({ success: true, message: 'Draft curriculum saved', data: updatedVersion });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update draft curriculum' });
  }
}

export async function publishGlobalCourse(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const course = await CoursesService.publishCourse(id);
    res.json({ success: true, message: 'Course and active curriculum version published successfully', data: course });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to publish course' });
  }
}

export async function createCourseDraftVersion(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const version = await CoursesService.createDraftVersion(id);
    res.status(201).json({ success: true, message: 'New draft curriculum version created', data: version });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to create draft version' });
  }
}

export async function updateGlobalCourseStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    if (status === 'PUBLISHED') {
      const course = await CoursesService.publishCourse(id);
      return res.json({ success: true, data: course });
    }
    const course = await CoursesService.updateCourse(id, { status });
    res.json({ success: true, data: course });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update course status' });
  }
}

export async function deleteGlobalCourse(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if active or historical enrollments exist
    const enrollmentCount = await prisma.courseEnrollment.count({
      where: { courseId: id }
    });

    if (enrollmentCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete course with ${enrollmentCount} existing student enrollment(s). Please archive it instead.`
      });
    }

    await prisma.globalCourse.delete({ where: { id } });
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to delete course' });
  }
}

// -------------------------------------------------------------
// 3. FRANCHISE SELECTION & OFFERINGS
// -------------------------------------------------------------
export async function getMyFranchiseCourseContext(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const userId = user?.userId || user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let franchiseId = (req.query.franchiseId as string) || '';
    let isBranchScoped = false;
    let allowedInstituteIds: string[] = [];

    if (user.role === UserRole.SUPER_ADMIN) {
      if (!franchiseId) {
        const firstFr = await prisma.franchise.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
        franchiseId = firstFr?.id || '';
      }
    } else if (user.role === UserRole.FRANCHISE_OWNER) {
      const owned = await prisma.franchise.findFirst({
        where: franchiseId ? { id: franchiseId, ownerUserId: userId } : { ownerUserId: userId },
        select: { id: true },
      });
      if (!owned) {
        return res.status(403).json({ success: false, message: 'No franchise assigned to this account' });
      }
      franchiseId = owned.id;
    } else {
      const memberships = await prisma.instituteMembership.findMany({
        where: { userId, isActive: true },
        include: { institute: { select: { id: true, franchiseId: true } } },
      });
      const matchingFranchises = memberships
        .map((m) => m.institute?.franchiseId)
        .filter((fid): fid is string => Boolean(fid));
      if (matchingFranchises.length === 0) {
        return res.status(403).json({ success: false, message: 'No franchise branch assigned to this account' });
      }
      franchiseId = franchiseId && matchingFranchises.includes(franchiseId) ? franchiseId : matchingFranchises[0];
      isBranchScoped = true;
      allowedInstituteIds = memberships
        .filter((m) => m.institute?.franchiseId === franchiseId)
        .map((m) => m.instituteId);
    }

    if (!franchiseId) {
      return res.json({ success: true, data: { franchise: null, branches: [], students: [], isBranchScoped } });
    }

    const franchise = await prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        branches: {
          where: isBranchScoped ? { id: { in: allowedInstituteIds } } : undefined,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            batches: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, academicYear: true },
            },
          },
        },
      },
    });

    const branchIds = (franchise?.branches || []).map((b) => b.id);
    const students = await prisma.student.findMany({
      where: isBranchScoped
        ? { instituteId: { in: allowedInstituteIds }, status: 'ACTIVE' }
        : {
          status: 'ACTIVE',
          OR: [
            { franchiseId },
            ...(branchIds.length > 0 ? [{ instituteId: { in: branchIds } }] : []),
          ],
        },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        phone: true,
        instituteId: true,
        franchiseId: true,
        user: { select: { email: true } },
      },
    });

    res.json({
      success: true,
      data: {
        franchise,
        branches: franchise?.branches || [],
        students,
        isBranchScoped,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to resolve franchise course context' });
  }
}

export async function listFranchiseCourses(req: Request, res: Response) {
  try {
    const { franchiseId } = req.params;
    const user = (req as any).user;
    const auth = await authorizeFranchiseAccess(user, franchiseId);
    if (!auth.allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized franchise access' });
    }
    const includeUnpermitted =
      user?.role === UserRole.SUPER_ADMIN && req.query.includeUnpermitted === 'true';
    const courses = await CoursesService.listFranchiseCourses(franchiseId, { includeUnpermitted });
    res.json({ success: true, data: courses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list franchise courses' });
  }
}

export async function setFranchiseCoursePermission(req: Request, res: Response) {
  try {
    const { franchiseId } = req.params;
    const user = (req as any).user;
    const parse = FranchiseCoursePermissionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const selection = await CoursesService.setFranchiseCoursePermission(
      franchiseId,
      parse.data.courseId,
      parse.data.isPermitted,
      user?.userId || user?.id || null,
      {
        isEnabled: parse.data.isEnabled,
        customPrice: parse.data.customPrice,
      }
    );
    res.json({
      success: true,
      message: parse.data.isPermitted ? 'Course permitted for franchise' : 'Course permission revoked for franchise',
      data: selection,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update franchise permission' });
  }
}

export async function bulkSetFranchisePermissions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const parse = BulkFranchisePermissionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const result = await CoursesService.bulkSetFranchiseCoursePermissions(id, {
      ...parse.data,
      permittedById: user?.userId || user?.id || null,
    });
    res.json({
      success: true,
      message: `Updated permissions across ${result.updatedCount} franchise(s)`,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update bulk franchise permissions' });
  }
}

export async function listFranchiseEnrollments(req: Request, res: Response) {
  try {
    const { franchiseId } = req.params;
    const user = (req as any).user;
    const auth = await authorizeFranchiseAccess(user, franchiseId);
    if (!auth.allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized franchise access' });
    }

    const { instituteId, courseId, mode, status } = req.query;
    let scopedInstituteId = typeof instituteId === 'string' && instituteId !== 'ALL' ? instituteId : undefined;

    if (auth.isBranchScoped) {
      if (scopedInstituteId && !auth.allowedInstituteIds.includes(scopedInstituteId)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Branch access denied' });
      }
      if (!scopedInstituteId && auth.allowedInstituteIds.length === 1) {
        scopedInstituteId = auth.allowedInstituteIds[0];
      }
    }

    const enrollments = await CoursesService.listFranchiseEnrollments(franchiseId, {
      instituteId: scopedInstituteId,
      courseId: typeof courseId === 'string' ? courseId : undefined,
      mode: mode === 'ONLINE' || mode === 'OFFLINE' ? (mode as LearningMode) : undefined,
      status: typeof status === 'string' && ['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED'].includes(status)
        ? (status as EnrollmentStatus)
        : undefined,
    });
    res.json({ success: true, data: enrollments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list franchise enrollments' });
  }
}

export async function toggleFranchiseCourseSelection(req: Request, res: Response) {
  try {
    const { franchiseId } = req.params;
    const user = (req as any).user;
    const auth = await authorizeFranchiseAccess(user, franchiseId);
    if (!auth.allowed || auth.isBranchScoped) {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Super Admin or Franchise Owner may enable/disable offerings' });
    }
    const parse = FranchiseCourseSelectionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }
    const selection = await CoursesService.toggleFranchiseCourseSelection(
      franchiseId,
      parse.data.courseId,
      parse.data.isEnabled,
      parse.data.customPrice,
      user?.role,
      user?.userId || user?.id || null
    );
    res.json({ success: true, data: selection });
  } catch (error: any) {
    const status = error instanceof CoursePermissionForbiddenError || error?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ success: false, message: error.message || 'Failed to toggle course selection' });
  }
}

// -------------------------------------------------------------
// 4. STUDENT ENROLLMENT & TRANSFERS
// -------------------------------------------------------------
export async function enrollStudentInCourse(req: Request, res: Response) {
  try {
    const body = { ...req.body };
    const user = (req as any).user;

    // Resolve franchiseId if not explicitly provided
    if (!body.franchiseId) {
      if (user?.franchiseId) {
        body.franchiseId = user.franchiseId;
      } else if (body.instituteId) {
        const institute = await prisma.institute.findUnique({
          where: { id: body.instituteId }
        });
        if (institute?.franchiseId) {
          body.franchiseId = institute.franchiseId;
        }
      } else if (body.studentId) {
        const student = await prisma.student.findUnique({
          where: { id: body.studentId },
          include: { institute: true }
        });
        if (student?.institute?.franchiseId) {
          body.franchiseId = student.institute.franchiseId;
        } else if (student?.franchiseId) {
          body.franchiseId = student.franchiseId;
        }
      } else if (user?.role === UserRole.FRANCHISE_OWNER) {
        const owned = await prisma.franchise.findFirst({ where: { ownerUserId: user.userId || user.id } });
        if (owned) body.franchiseId = owned.id;
      }
    }

    const parse = EnrollStudentSchema.safeParse(body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const auth = await authorizeFranchiseAccess(user, parse.data.franchiseId);
    if (!auth.allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot enroll students for another franchise' });
    }
    if (auth.isBranchScoped && parse.data.mode === LearningMode.OFFLINE && parse.data.instituteId && !auth.allowedInstituteIds.includes(parse.data.instituteId)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Branch admin cannot enroll into another branch' });
    }

    const enrollment = await CoursesService.enrollStudent(parse.data);
    res.status(201).json({ success: true, data: enrollment });
  } catch (error: any) {
    const status = error instanceof CoursePermissionForbiddenError || error?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ success: false, message: error.message || 'Failed to enroll student' });
  }
}

export async function transferStudentEnrollment(req: Request, res: Response) {
  try {
    const { enrollmentId } = req.params;
    const user = (req as any).user;

    const existing = await prisma.courseEnrollment.findUnique({ where: { id: enrollmentId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    const sourceAuth = await authorizeFranchiseAccess(user, existing.franchiseId);
    if (!sourceAuth.allowed) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized franchise enrollment transfer' });
    }

    const parse = TransferEnrollmentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const targetFranchiseId = parse.data.newFranchiseId || parse.data.franchiseId;
    if (targetFranchiseId && targetFranchiseId !== existing.franchiseId && user?.role !== UserRole.SUPER_ADMIN) {
      const targetAuth = await authorizeFranchiseAccess(user, targetFranchiseId);
      if (!targetAuth.allowed) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot transfer enrollment to another owner franchise' });
      }
    }

    const transferred = await CoursesService.transferEnrollment(enrollmentId, {
      newMode: parse.data.newMode || parse.data.mode,
      newFranchiseId: targetFranchiseId,
      newInstituteId: parse.data.newInstituteId !== undefined ? parse.data.newInstituteId : parse.data.instituteId,
      newBatchId: parse.data.newBatchId !== undefined ? parse.data.newBatchId : (parse.data.targetBatchId !== undefined ? parse.data.targetBatchId : parse.data.batchId),
      reason: parse.data.reason,
    });
    res.json({ success: true, message: 'Enrollment transferred successfully', data: transferred });
  } catch (error: any) {
    const status = error instanceof CoursePermissionForbiddenError || error?.statusCode === 403 ? 403 : 400;
    res.status(status).json({ success: false, message: error.message || 'Failed to transfer enrollment' });
  }
}

export async function listStudentCourseEnrollments(req: Request, res: Response) {
  try {
    const { studentId } = req.params;
    const auth = await resolveAuthorizedStudentId((req as any).user, studentId);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const enrollments = await CoursesService.listStudentEnrollments(auth.studentId);
    res.json({ success: true, data: enrollments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list enrollments' });
  }
}

// -------------------------------------------------------------
// 5. STUDENT LEARNING PLAYER & GAMIFICATION (ONLINE & OFFLINE)
// -------------------------------------------------------------
export async function getMyLearningDashboard(req: Request, res: Response) {
  try {
    const auth = await resolveAuthorizedStudentId((req as any).user, (req.query.studentId as string) || null);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const dashboard = await CoursesService.getStudentLearningDashboard(auth.studentId);
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load learning dashboard' });
  }
}

export async function getStudentCoursePlayer(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;

    const auth = await resolveAuthorizedStudentId(user, (req.query.studentId as string) || null);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const studentId = auth.studentId;

    const playerData = await CoursesService.getStudentCoursePlayer(studentId, courseId);

    // Fetch batch context if offline
    let batchName: string | null = null;
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: { in: ['ACTIVE', 'COMPLETED'] }
      },
      include: { batch: true }
    });
    if (enrollment?.batch) {
      batchName = enrollment.batch.name;
    }

    // Format curriculum for both 'chapters' and 'lessons' consumers
    const formattedModules = playerData.curriculum.map(m => ({
      ...m,
      lessons: m.chapters.map(c => ({
        ...c,
        isCompleted: c.isCompleted,
      }))
    }));

    res.json({
      success: true,
      data: {
        ...playerData,
        enrollmentContext: {
          mode: playerData.course.enrollmentMode,
          status: playerData.course.enrollmentStatus,
          batchName,
        },
        modules: formattedModules,
      }
    });
  } catch (error: any) {
    res.status(403).json({ success: false, message: error.message || 'Failed to load course player' });
  }
}

export async function completeLesson(req: Request, res: Response) {
  try {
    const parse = CompleteLessonSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const user = (req as any).user;
    if (!user || user.role !== UserRole.STUDENT) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only authenticated students may mark lessons complete',
      });
    }

    const auth = await resolveAuthorizedStudentId(user, req.body.studentId || null);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const studentId = auth.studentId;

    const result = await CoursesService.completeLesson(
      studentId,
      parse.data.courseId,
      parse.data.chapterId,
      parse.data.timeSpentSec
    );

    res.json({
      success: true,
      data: {
        ...result,
        xpEarned: result.xpAwarded,
        newLevel: result.level,
        leveledUp: result.leveledUp,
        alreadyCompleted: result.xpAwarded === 0,
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to complete lesson' });
  }
}

// -------------------------------------------------------------
// 6. CERTIFICATES
// -------------------------------------------------------------
export async function claimCourseCertificate(req: Request, res: Response) {
  try {
    const parse = ClaimCertificateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.format() });
    }

    const user = (req as any).user;
    if (!user || user.role !== UserRole.STUDENT) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only authenticated students may claim course certificates',
      });
    }

    const auth = await resolveAuthorizedStudentId(user, req.body.studentId || null);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const studentId = auth.studentId;

    const certificate = await CoursesService.claimCertificate(studentId, parse.data.courseId);
    res.status(201).json({ success: true, data: certificate });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to claim certificate' });
  }
}

export async function verifyCourseCertificate(req: Request, res: Response) {
  try {
    const { certificateNumber } = req.params;
    const cert = await CoursesService.verifyCertificate(certificateNumber);
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found' });
    }
    res.json({ success: true, data: cert });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to verify certificate' });
  }
}

export async function listStudentCertificates(req: Request, res: Response) {
  try {
    const { studentId } = req.params;
    const auth = await resolveAuthorizedStudentId((req as any).user, studentId);
    if (!auth.allowed || !auth.studentId) {
      return res.status(403).json({ success: false, message: auth.message || 'Forbidden' });
    }
    const certs = await CoursesService.listStudentCertificates(auth.studentId);
    res.json({ success: true, data: certs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to list student certificates' });
  }
}

// -------------------------------------------------------------
// 7. MEDIA ASSETS & HTTP 206 BYTE RANGE STREAMING
// -------------------------------------------------------------
export async function uploadCourseMedia(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const actualSavedFolder = req.file.destination
      ? path.basename(req.file.destination)
      : (req.file.path ? path.basename(path.dirname(req.file.path)) : ((req.query?.folder as string) || (req.body?.folder as string) || 'general'));
    const folder = actualSavedFolder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
    const isPublic = isPublicCourseFolder(folder);
    const scope = isPublic ? 'public' : 'protected';
    const fileUrl = `/api/courses/media/${scope}/${folder}/${req.file.filename}`;

    res.status(201).json({
      success: true,
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        fileUrl,
        folder,
        isProtected: !isPublic,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
}

export async function streamPublicMedia(req: Request, res: Response) {
  try {
    const { folder, filename } = req.params;
    const sanitizedFolder = (folder || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const sanitizedFilename = path.basename(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!sanitizedFolder || !sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename.startsWith('..')) {
      return res.status(400).json({ success: false, message: 'Invalid media path' });
    }

    // STRICT PUBLIC FOLDER ALLOWLIST: Lesson materials & videos require authentication
    if (!isPublicCourseFolder(sanitizedFolder)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required: Lesson materials and videos are protected and require enrollment authorization',
      });
    }

    try {
      const result = await StorageManager.getMediaStream({
        scope: 'public',
        folder: sanitizedFolder,
        filename: sanitizedFilename,
        rangeHeader: req.headers.range,
      });

      if (!result) {
        return res.status(404).json({ success: false, message: 'Media not found' });
      }

      res.writeHead(result.statusCode, {
        'Content-Length': result.contentLength,
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=86400',
        'Accept-Ranges': result.acceptRanges,
        ...(result.contentRange ? { 'Content-Range': result.contentRange } : {}),
      });

      result.stream.pipe(res);
    } catch (streamErr: any) {
      if (streamErr.statusCode === 416) {
        const totalSizeHeader = typeof streamErr.totalSize === 'number' ? streamErr.totalSize : '*';
        res.setHeader('Content-Range', `bytes */${totalSizeHeader}`);
        return res.status(416).json({ success: false, message: 'Range Not Satisfiable' });
      }
      throw streamErr;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Media stream error' });
  }
}

// -------------------------------------------------------------
// SHORT-LIVED MEDIA AUTHORIZATION TOKEN ISSUANCE (FIX C)
// -------------------------------------------------------------
export async function generateMediaTokenController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { courseId, mediaUrl, folder, filename } = req.body;

    let targetFolder = folder;
    let targetFilename = filename;

    if (mediaUrl) {
      const cleanUrl = String(mediaUrl).split('?')[0];
      const match = cleanUrl.match(/\/api\/courses\/media\/(protected|public)\/([^\/]+)\/([^\/]+)/);
      if (match) {
        targetFolder = match[2];
        targetFilename = match[3];
      } else {
        const parts = cleanUrl.split('/');
        if (parts.length >= 2) {
          targetFilename = parts[parts.length - 1];
          targetFolder = parts[parts.length - 2];
        }
      }
    }

    if (!targetFolder || !targetFilename) {
      return res.status(400).json({ success: false, message: 'folder and filename (or mediaUrl) are required' });
    }

    const sanitizedFolder = String(targetFolder).trim().toLowerCase();
    const sanitizedFilename = path.basename(String(targetFilename)).replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!isProtectedCourseFolder(sanitizedFolder)) {
      return res.status(400).json({
        success: false,
        message: `Folder "${sanitizedFolder}" is not a protected course media folder. Public assets do not require media tokens.`,
      });
    }

    // Exact database lookup to find owning course (never use loose substring search)
    const exactCandidates = [
      `/api/courses/media/protected/${sanitizedFolder}/${sanitizedFilename}`,
      `/api/courses/media/${sanitizedFolder}/${sanitizedFilename}`,
      `/uploads/courses/${sanitizedFolder}/${sanitizedFilename}`,
      `courses/protected/${sanitizedFolder}/${sanitizedFilename}`,
      `courses/${sanitizedFolder}/${sanitizedFilename}`,
    ];

    const matchingAttachments = await prisma.lessonAttachment.findMany({
      where: { fileUrl: { in: exactCandidates } },
      include: {
        chapter: {
          include: {
            module: {
              include: {
                curriculumVersion: {
                  select: { courseId: true },
                },
              },
            },
          },
        },
      },
    });

    const matchingChapters = await prisma.courseChapter.findMany({
      where: {
        OR: [
          { videoUrl: { in: exactCandidates } },
          { pdfUrl: { in: exactCandidates } },
        ],
      },
      include: {
        module: {
          include: {
            curriculumVersion: {
              select: { courseId: true },
            },
          },
        },
      },
    });

    const candidateCourseIds = new Set<string>();
    for (const att of matchingAttachments) {
      const cId = att.chapter?.module?.curriculumVersion?.courseId;
      if (cId) candidateCourseIds.add(cId);
    }
    for (const ch of matchingChapters) {
      const cId = ch.module?.curriculumVersion?.courseId;
      if (cId) candidateCourseIds.add(cId);
    }

    if (candidateCourseIds.size === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requested media object is not registered to any course curriculum in the database',
      });
    }

    let resolvedCourseId: string;
    if (courseId) {
      if (!candidateCourseIds.has(courseId)) {
        return res.status(403).json({
          success: false,
          message: 'Requested media does not belong to the specified course',
        });
      }
      resolvedCourseId = courseId;
    } else {
      if (candidateCourseIds.size > 1) {
        return res.status(409).json({
          success: false,
          message: 'Ambiguous media reference: multiple courses reference this asset. Please supply courseId.',
        });
      }
      resolvedCourseId = Array.from(candidateCourseIds)[0];
    }

    // Verify user authorization for resolvedCourseId
    let isAuthorized = false;
    if (user.role === UserRole.SUPER_ADMIN) {
      isAuthorized = true;
    } else if (user.role === UserRole.STUDENT) {
      const student = await prisma.student.findFirst({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (student) {
        const enrollment = await prisma.courseEnrollment.findFirst({
          where: {
            studentId: student.id,
            courseId: resolvedCourseId,
            status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
          },
          select: { id: true },
        });
        if (enrollment) {
          isAuthorized = true;
        } else {
          // Check free preview
          const matchingFreeChapter = matchingChapters.find(
            (c) => c.module?.curriculumVersion?.courseId === resolvedCourseId && c.isFree
          );
          if (matchingFreeChapter) {
            isAuthorized = true;
          }
        }
      }
    } else if (user.role === UserRole.PARENT) {
      const parent = await prisma.parentProfile.findFirst({
        where: { userId: user.userId },
        include: { studentRelations: { select: { studentId: true } } },
      });
      const childIds = parent?.studentRelations.map((r) => r.studentId) || [];
      if (childIds.length > 0) {
        const childEnrollment = await prisma.courseEnrollment.findFirst({
          where: {
            studentId: { in: childIds },
            courseId: resolvedCourseId,
            status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
          },
          select: { id: true },
        });
        if (childEnrollment) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Active enrollment required to generate media access token',
      });
    }

    const token = generateMediaToken({
      userId: user.userId,
      role: user.role,
      courseId: resolvedCourseId,
      folder: sanitizedFolder,
      filename: sanitizedFilename,
      expiresInSeconds: 900, // 15 mins
    });

    const mediaUrlWithToken = `/api/courses/media/protected/${sanitizedFolder}/${sanitizedFilename}?mt=${encodeURIComponent(token)}`;

    return res.json({
      success: true,
      token,
      expiresIn: 900,
      expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
      mediaUrl: mediaUrlWithToken,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to issue media token' });
  }
}

export async function streamProtectedMedia(req: Request, res: Response) {
  try {
    const { folder, filename } = req.params;

    const sanitizedFolder = (folder || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    const sanitizedFilename = path.basename(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');

    if (
      !sanitizedFolder ||
      !sanitizedFilename ||
      sanitizedFilename === '.' ||
      sanitizedFilename.startsWith('..') ||
      !isProtectedCourseFolder(sanitizedFolder)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid or unauthorized media path' });
    }

    // -------------------------------------------------------------
    // AUTHENTICATION & SHORT-LIVED MEDIA TOKEN ENFORCEMENT (FIX C)
    // Query parameter token MUST be a dedicated short-lived media token.
    // Normal login JWTs passed in query parameters are strictly rejected.
    // -------------------------------------------------------------
    const queryToken = (req.query.mt || req.query.token) as string | undefined;
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

    let user: { userId: string; role: string } | null = null;
    let tokenCourseId: string | null = null;

    if (queryToken) {
      // 1. Prohibit normal login JWTs from being exposed in media URLs
      const normalJwtPayload = verifyAccessToken(queryToken);
      const mediaTokenPayload = verifyMediaToken(queryToken);

      if (normalJwtPayload && !mediaTokenPayload) {
        return res.status(401).json({
          success: false,
          error: 'Insecure URL credential: Normal login JWTs cannot be passed in media URLs. Please obtain a dedicated short-lived media token from /api/courses/media-token.',
        });
      }

      if (!mediaTokenPayload) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired media authorization token',
        });
      }

      // Check token bindings against requested file and folder
      if (
        mediaTokenPayload.filename !== sanitizedFilename ||
        mediaTokenPayload.folder.toLowerCase() !== sanitizedFolder
      ) {
        return res.status(403).json({
          success: false,
          error: `Media token mismatch: token is bound to "${mediaTokenPayload.folder}/${mediaTokenPayload.filename}", not "${sanitizedFolder}/${sanitizedFilename}"`,
        });
      }

      user = { userId: mediaTokenPayload.sub, role: mediaTokenPayload.role };
      tokenCourseId = mediaTokenPayload.courseId;
    } else if (headerToken) {
      // 2. Authorization header: accept either media token or direct login token (for API/curl clients)
      const mediaPayload = verifyMediaToken(headerToken);
      if (mediaPayload) {
        if (
          mediaPayload.filename !== sanitizedFilename ||
          mediaPayload.folder.toLowerCase() !== sanitizedFolder
        ) {
          return res.status(403).json({
            success: false,
            error: `Media token mismatch: token is bound to "${mediaPayload.folder}/${mediaPayload.filename}"`,
          });
        }
        user = { userId: mediaPayload.sub, role: mediaPayload.role };
        tokenCourseId = mediaPayload.courseId;
      } else {
        const accessPayload = verifyAccessToken(headerToken);
        if (accessPayload) {
          user = { userId: accessPayload.userId, role: accessPayload.role };
        } else {
          return res.status(401).json({ success: false, error: 'Invalid authentication token' });
        }
      }
    } else if ((req as any).user) {
      user = (req as any).user;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check media file presence in storage backend (disk volume or S3 bucket)
    const mediaExists = await StorageManager.mediaExists({
      scope: 'protected',
      folder: sanitizedFolder,
      filename: sanitizedFilename,
    });

    if (!mediaExists) {
      return res.status(404).json({ success: false, message: 'Media file not found' });
    }

    // -------------------------------------------------------------
    // DATABASE-DRIVEN EXACT MEDIA IDENTITY & OWNERSHIP (FIX B)
    // Exact match against database records. Never use loose substring contains or arbitrary findFirst.
    // -------------------------------------------------------------
    const exactCandidates = [
      `/api/courses/media/protected/${sanitizedFolder}/${sanitizedFilename}`,
      `/api/courses/media/${sanitizedFolder}/${sanitizedFilename}`,
      `/uploads/courses/${sanitizedFolder}/${sanitizedFilename}`,
      `courses/protected/${sanitizedFolder}/${sanitizedFilename}`,
      `courses/${sanitizedFolder}/${sanitizedFilename}`,
    ];

    const matchingAttachments = await prisma.lessonAttachment.findMany({
      where: { fileUrl: { in: exactCandidates } },
      include: {
        chapter: {
          include: {
            module: {
              include: {
                curriculumVersion: {
                  select: { courseId: true, isPublished: true },
                },
              },
            },
          },
        },
      },
    });

    const matchingChapters = await prisma.courseChapter.findMany({
      where: {
        OR: [
          { videoUrl: { in: exactCandidates } },
          { pdfUrl: { in: exactCandidates } },
        ],
      },
      include: {
        module: {
          include: {
            curriculumVersion: {
              select: { courseId: true, isPublished: true },
            },
          },
        },
      },
    });

    const referencingCourseIds = new Set<string>();
    let isFreeLesson = false;

    for (const att of matchingAttachments) {
      const cId = att.chapter?.module?.curriculumVersion?.courseId;
      if (cId) {
        referencingCourseIds.add(cId);
        if (att.chapter?.isFree) isFreeLesson = true;
      }
    }
    for (const ch of matchingChapters) {
      const cId = ch.module?.curriculumVersion?.courseId;
      if (cId) {
        referencingCourseIds.add(cId);
        if (ch.isFree) isFreeLesson = true;
      }
    }

    if (referencingCourseIds.size === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media asset is not referenced by any valid course curriculum in the database',
      });
    }

    let resolvedCourseId: string;
    if (tokenCourseId && referencingCourseIds.has(tokenCourseId)) {
      resolvedCourseId = tokenCourseId;
    } else if (referencingCourseIds.size === 1) {
      resolvedCourseId = Array.from(referencingCourseIds)[0];
    } else {
      return res.status(409).json({
        success: false,
        message: 'Ambiguous media reference: multiple courses reference this asset. Valid course-bound media token required.',
      });
    }

    // -------------------------------------------------------------
    // AUTHORIZATION AGAINST RESOLVED COURSE
    // -------------------------------------------------------------
    let isAuthorized = false;

    if (user.role === UserRole.SUPER_ADMIN) {
      isAuthorized = true;
    } else if (resolvedCourseId) {
      if (user.role === UserRole.STUDENT) {
        const student = await prisma.student.findFirst({
          where: { userId: user.userId },
          select: { id: true },
        });

        if (student) {
          const enrollment = await prisma.courseEnrollment.findFirst({
            where: {
              studentId: student.id,
              courseId: resolvedCourseId,
              status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
            },
            select: { id: true, status: true, mode: true },
          });

          if (enrollment) {
            isAuthorized = true;
          } else if (isFreeLesson) {
            const course = await prisma.globalCourse.findUnique({
              where: { id: resolvedCourseId },
              select: { overviewJson: true },
            });
            const allowFree = (course?.overviewJson as any)?.extensibleConfig?.featureFlags?.allowFreePreview !== false;
            if (allowFree) {
              isAuthorized = true;
            }
          }
        }
      } else if (user.role === UserRole.PARENT) {
        const parent = await prisma.parentProfile.findFirst({
          where: { userId: user.userId },
          include: { studentRelations: { select: { studentId: true } } },
        });
        const childIds = parent?.studentRelations.map((r) => r.studentId) || [];
        if (childIds.length > 0) {
          const childEnrollment = await prisma.courseEnrollment.findFirst({
            where: {
              studentId: { in: childIds },
              courseId: resolvedCourseId,
              status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
            },
            select: { id: true },
          });
          if (childEnrollment) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Active course enrollment required to access this lesson material',
      });
    }

    // -------------------------------------------------------------
    // HTTP BYTE-RANGE & STREAMING DELIVERY
    // -------------------------------------------------------------
    const isDownload = req.query.download === 'true' || req.query.dl === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${sanitizedFilename}"`);

    try {
      const result = await StorageManager.getMediaStream({
        scope: 'protected',
        folder: sanitizedFolder,
        filename: sanitizedFilename,
        rangeHeader: req.headers.range,
      });

      if (!result) {
        return res.status(404).json({ success: false, message: 'Media file not found' });
      }

      res.writeHead(result.statusCode, {
        'Content-Length': result.contentLength,
        'Content-Type': result.contentType,
        'Accept-Ranges': result.acceptRanges,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...(result.contentRange ? { 'Content-Range': result.contentRange } : {}),
      });

      result.stream.pipe(res);
    } catch (streamErr: any) {
      if (streamErr.statusCode === 416) {
        const totalSizeHeader = typeof streamErr.totalSize === 'number' ? streamErr.totalSize : '*';
        res.setHeader('Content-Range', `bytes */${totalSizeHeader}`);
        return res.status(416).json({ success: false, message: 'Range Not Satisfiable' });
      }
      throw streamErr;
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Stream error' });
  }
}
