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
import { resolveAbsolutePath, isPublicCourseFolder, getMimeType } from '../../utils/storage.js';

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

    const actualSavedFolder = req.file.path
      ? path.basename(path.dirname(req.file.path))
      : ((req.query?.folder as string) || (req.body?.folder as string) || 'general');
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

    const resolvedPath =
      resolveAbsolutePath(path.join('courses', 'public', sanitizedFolder, sanitizedFilename)) ||
      resolveAbsolutePath(path.join('courses', sanitizedFolder, sanitizedFilename)) ||
      resolveAbsolutePath(path.join('courses', sanitizedFilename));

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const stat = fs.statSync(resolvedPath);
    const contentType = getMimeType(path.extname(sanitizedFilename));

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    });

    fs.createReadStream(resolvedPath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Media stream error' });
  }
}

export async function streamProtectedMedia(req: Request, res: Response) {
  try {
    const { folder, filename } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const sanitizedFolder = (folder || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedFilename = path.basename(filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!sanitizedFolder || !sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename.startsWith('..')) {
      return res.status(400).json({ success: false, message: 'Invalid media path' });
    }

    const filePath =
      resolveAbsolutePath(path.join('courses', 'protected', sanitizedFolder, sanitizedFilename)) ||
      resolveAbsolutePath(path.join('courses', sanitizedFolder, sanitizedFilename)) ||
      resolveAbsolutePath(path.join('courses', sanitizedFilename));

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Media file not found' });
    }

    // -------------------------------------------------------------
    // DATABASE-DRIVEN ENROLLMENT & LESSON AUTHORIZATION
    // Never trust client-supplied courseId or file path parameters
    // -------------------------------------------------------------
    let resolvedCourseId: string | null = null;
    let isFreeLesson = false;

    // 1. Resolve through LessonAttachment record
    const attachment = await prisma.lessonAttachment.findFirst({
      where: {
        fileUrl: { contains: sanitizedFilename },
      },
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

    if (attachment?.chapter?.module?.curriculumVersion?.courseId) {
      resolvedCourseId = attachment.chapter.module.curriculumVersion.courseId;
      isFreeLesson = Boolean(attachment.chapter.isFree);
    }

    // 2. Resolve through CourseChapter (videoUrl or pdfUrl)
    if (!resolvedCourseId) {
      const chapter = await prisma.courseChapter.findFirst({
        where: {
          OR: [
            { videoUrl: { contains: sanitizedFilename } },
            { pdfUrl: { contains: sanitizedFilename } },
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

      if (chapter?.module?.curriculumVersion?.courseId) {
        resolvedCourseId = chapter.module.curriculumVersion.courseId;
        isFreeLesson = Boolean(chapter.isFree);
      }
    }

    // 3. Verify user authorization against resolved course & enrollment
    let isAuthorized = false;

    if (user.role === UserRole.SUPER_ADMIN) {
      // Super Admin retains authorized preview & management access across all course assets
      isAuthorized = true;
    } else if (resolvedCourseId) {
      if (user.role === UserRole.STUDENT) {
        const student = await prisma.student.findFirst({
          where: { userId: user.userId },
          select: { id: true },
        });

        if (student) {
          // Check for active or completed enrollment (supports both ONLINE and OFFLINE modes)
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
            // Free preview lesson check
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
      // Franchise owners, branch admins, and staff without enrolled student record are NOT granted student lesson access
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
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(sanitizedFilename).toLowerCase();
    const contentType = getMimeType(ext);

    const isDownload = req.query.download === 'true' || req.query.dl === '1';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${sanitizedFilename}"`);

    const range = req.headers.range;
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Range Not Satisfiable' });
      }

      let start: number;
      let end: number;

      if (match[1] === '' && match[2] !== '') {
        // Suffix range: bytes=-500 (last 500 bytes)
        const suffix = parseInt(match[2], 10);
        start = Math.max(0, fileSize - suffix);
        end = fileSize - 1;
      } else if (match[1] !== '' && match[2] === '') {
        // From start to EOF: bytes=1000-
        start = parseInt(match[1], 10);
        end = fileSize - 1;
      } else {
        start = parseInt(match[1], 10);
        end = parseInt(match[2], 10);
      }

      if (isNaN(start) || isNaN(end) || start > end || start >= fileSize || start < 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Range Not Satisfiable' });
      }

      end = Math.min(end, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Stream error' });
  }
}
