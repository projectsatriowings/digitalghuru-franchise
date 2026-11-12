import crypto from 'crypto';
import { Prisma, CourseStatus, LearningMode, EnrollmentStatus } from '@prisma/client';
import { prisma } from '../../prisma.js';

const XP_LEVEL_THRESHOLDS = [0, 50, 150, 350, 600, 1000, 1500, 2200, 3000, 4000, 5500];

function getQualifiedObject(name: string): string {
  const schemaMatch = (process.env.DATABASE_URL || '').match(/[?&]schema=([a-zA-Z0-9_]+)/);
  return schemaMatch ? `"${schemaMatch[1]}"."${name}"` : `"${name}"`;
}

function getCertificateSigningSecret(): string {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('Cryptographic configuration error: CERTIFICATE_SIGNING_SECRET is not configured on the server');
  }
  return secret.trim();
}

export class CoursePermissionForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'Forbidden: This course has not been permitted for your franchise by Super Admin.') {
    super(message);
    this.name = 'CoursePermissionForbiddenError';
  }
}

export class CoursesService {
  // -------------------------------------------------------------
  // 1. CATEGORIES
  // -------------------------------------------------------------
  static async listCategories() {
    return prisma.courseCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { courses: true }
        }
      }
    });
  }

  static async createCategory(data: { name: string; slug: string; description?: string | null; icon?: string | null; sortOrder?: number }) {
    return prisma.courseCategory.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        icon: data.icon || null,
        sortOrder: data.sortOrder || 0,
      }
    });
  }

  static async updateCategory(id: string, data: Partial<{ name: string; slug: string; description?: string | null; icon?: string | null; sortOrder?: number }>) {
    return prisma.courseCategory.update({
      where: { id },
      data,
    });
  }

  static async deleteCategory(id: string) {
    const coursesCount = await prisma.globalCourse.count({ where: { categoryId: id } });
    if (coursesCount > 0) {
      throw new Error(`Cannot delete category: ${coursesCount} courses are assigned to it.`);
    }
    return prisma.courseCategory.delete({ where: { id } });
  }

  // -------------------------------------------------------------
  // 2. GLOBAL COURSES CRUD & 10-STEP WIZARD
  // -------------------------------------------------------------
  static async listCourses(params: {
    status?: CourseStatus;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.GlobalCourseWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, courses] = await Promise.all([
      prisma.globalCourse.count({ where }),
      prisma.globalCourse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          activeCurriculumVersion: {
            include: {
              modules: {
                orderBy: { position: 'asc' },
                include: {
                  chapters: {
                    orderBy: { position: 'asc' },
                    include: {
                      attachments: { orderBy: { createdAt: 'asc' } }
                    }
                  }
                }
              }
            }
          },
          franchiseSelections: {
            select: {
              franchiseId: true,
              isPermitted: true,
              isEnabled: true,
            }
          },
          _count: {
            select: { enrollments: true, franchiseSelections: true }
          }
        }
      })
    ]);

    const enrichedCourses = courses.map((course: any) => {
      const selections = course.franchiseSelections || [];
      const permittedFranchisesCount = selections.filter((s: any) => s.isPermitted).length;
      const enabledFranchisesCount = selections.filter((s: any) => s.isPermitted && s.isEnabled).length;
      const { franchiseSelections, ...rest } = course;
      return {
        ...rest,
        permittedFranchisesCount,
        enabledFranchisesCount,
      };
    });

    return { total, page, limit, totalPages: Math.ceil(total / limit), data: enrichedCourses };
  }

  static async getCourseByIdOrSlug(idOrSlug: string): Promise<any> {
    let course = await prisma.globalCourse.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
      },
      include: {
        category: true,
        activeCurriculumVersion: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: {
                chapters: {
                  orderBy: { position: 'asc' },
                  include: {
                    attachments: {
                      orderBy: { createdAt: 'asc' }
                    }
                  }
                }
              }
            }
          }
        },
        curriculumVersions: {
          orderBy: { version: 'desc' },
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: {
                chapters: {
                  orderBy: { position: 'asc' },
                  include: {
                    attachments: { orderBy: { createdAt: 'asc' } }
                  }
                }
              }
            }
          }
        },
        slugAliases: true,
      }
    });

    if (!course) {
      // Check slug alias
      const alias = await prisma.courseSlugAlias.findUnique({
        where: { slug: idOrSlug },
        include: { course: true }
      });
      if (alias) {
        return this.getCourseByIdOrSlug(alias.courseId);
      }
    }

    return course;
  }

  static async createCourse(data: any, createdById?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Ensure slug uniqueness across active courses and historical aliases
      const [existing, aliasCollision] = await Promise.all([
        tx.globalCourse.findUnique({ where: { slug: data.slug } }),
        tx.courseSlugAlias.findUnique({ where: { slug: data.slug } }),
      ]);
      if (existing) {
        throw new Error(`A course with slug '${data.slug}' already exists.`);
      }
      if (aliasCollision) {
        throw new Error(`Slug '${data.slug}' is a reserved historical alias for another course.`);
      }

      const mergedOverviewJson = data.extensibleConfig
        ? { ...(data.overviewJson || {}), extensibleConfig: data.extensibleConfig }
        : (data.overviewJson || null);

      // 2. Create Global Course
      const course = await tx.globalCourse.create({
        data: {
          title: data.title,
          slug: data.slug,
          subTitle: data.subTitle || null,
          description: data.description || null,
          categoryId: data.categoryId || null,
          format: data.format || 'Online / Classroom',
          duration: data.duration || null,
          price: data.price ? new Prisma.Decimal(data.price) : new Prisma.Decimal(0),
          status: data.status || CourseStatus.DRAFT,
          thumbnailUrl: data.thumbnailUrl || null,
          bannerUrl: data.bannerUrl || null,
          brochureUrl: data.brochureUrl || null,
          level: data.level || 'Beginner to Advanced',
          prerequisites: data.prerequisites || null,
          learningOutcomes: data.learningOutcomes || [],
          skillsCovered: data.skillsCovered || [],
          targetAudience: data.targetAudience || [],
          toolsCovered: data.toolsCovered || [],
          overviewJson: mergedOverviewJson,
          designedToHelpJson: data.designedToHelpJson || null,
          numberedFeaturesJson: data.numberedFeaturesJson || null,
          whyDigitalGhuruJson: data.whyDigitalGhuruJson || null,
          topHighlightsJson: data.topHighlightsJson || null,
          faqsJson: data.faqsJson || null,
          createdById: createdById || null,
        }
      });

      // 3. Create initial Curriculum Version (v1) with nested modules, chapters, and attachments
      const isInitialPublish = data.status === CourseStatus.PUBLISHED;
      const modulesCreate = (Array.isArray(data.modules) ? data.modules : []).map((modInput: any, mIdx: number) => {
        const chaptersRaw = Array.isArray(modInput.chapters) ? modInput.chapters : (Array.isArray(modInput.lessons) ? modInput.lessons : []);
        return {
          title: modInput.title,
          description: modInput.description || null,
          position: modInput.position !== undefined ? modInput.position : mIdx,
          chapters: {
            create: chaptersRaw.map((chInput: any, cIdx: number) => {
              const attachmentsRaw = Array.isArray(chInput.attachments) ? chInput.attachments : (Array.isArray(chInput.materials) ? chInput.materials : []);
              return {
                title: chInput.title,
                description: chInput.description || null,
                videoUrl: chInput.videoUrl || null,
                pdfUrl: chInput.pdfUrl || null,
                duration: chInput.duration || '10:00',
                position: chInput.position !== undefined ? chInput.position : cIdx,
                isFree: Boolean(chInput.isFree),
                attachments: {
                  create: attachmentsRaw.map((att: any) => ({
                    title: att.title,
                    fileUrl: att.fileUrl,
                    fileType: att.fileType || att.type || 'PDF',
                    fileSize: att.fileSize || 0,
                    isDownload: att.isDownload !== undefined ? att.isDownload : (att.isDownloadable !== undefined ? att.isDownloadable : true),
                  }))
                }
              };
            })
          }
        };
      });

      const version = await tx.courseCurriculumVersion.create({
        data: {
          courseId: course.id,
          version: 1,
          title: 'Version 1.0 (Initial)',
          isPublished: false,
          isLocked: false,
          modules: modulesCreate.length > 0 ? { create: modulesCreate } : undefined,
        }
      });

      if (isInitialPublish) {
        await tx.courseCurriculumVersion.update({
          where: { id: version.id },
          data: {
            isPublished: true,
            isLocked: true,
            publishedAt: new Date(),
          }
        });
      }

      // 4. Update course active version pointer
      const updatedCourse = await tx.globalCourse.update({
        where: { id: course.id },
        data: { activeCurriculumVersionId: version.id },
        include: {
          activeCurriculumVersion: {
            include: {
              modules: {
                include: { chapters: { include: { attachments: true } } }
              }
            }
          }
        }
      });

      return updatedCourse;
    }, { maxWait: 20000, timeout: 60000 });
  }

  static async updateCourse(id: string, data: any) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.globalCourse.findUnique({
        where: { id },
        include: {
          activeCurriculumVersion: true,
          curriculumVersions: { orderBy: { version: 'desc' } }
        }
      });
      if (!current) throw new Error('Course not found');

      // If slug changed, validate uniqueness & record old slug in alias
      if (data.slug && data.slug !== current.slug) {
        const collision = await tx.globalCourse.findUnique({ where: { slug: data.slug } });
        if (collision && collision.id !== id) {
          throw new Error(`Slug '${data.slug}' is already in use by another course.`);
        }
        const aliasCollision = await tx.courseSlugAlias.findUnique({ where: { slug: data.slug } });
        if (aliasCollision && aliasCollision.courseId !== id) {
          throw new Error(`Slug '${data.slug}' is a reserved historical alias for another course.`);
        }
        await tx.courseSlugAlias.upsert({
          where: { slug: current.slug },
          update: {},
          create: { courseId: current.id, slug: current.slug }
        });
      }

      // If modules payload provided, update the unlocked draft curriculum version (if one exists)
      if (Array.isArray(data.modules)) {
        const draftVersion = current.curriculumVersions.find((v) => !v.isLocked && !v.isPublished);
        if (!draftVersion) {
          throw new Error('Cannot modify modules/lessons on a locked published curriculum. Create a new draft version first.');
        }

        // Safely replace modules/chapters/attachments in bottom-up order inside the draft version
        const existingModules = await tx.courseModule.findMany({
          where: { curriculumVersionId: draftVersion.id },
          include: { chapters: { select: { id: true } } }
        });
        const existingChapterIds = existingModules.flatMap((m) => m.chapters.map((c) => c.id));
        if (existingChapterIds.length > 0) {
          await tx.lessonAttachment.deleteMany({ where: { chapterId: { in: existingChapterIds } } });
          await tx.courseChapter.deleteMany({ where: { id: { in: existingChapterIds } } });
        }
        if (existingModules.length > 0) {
          await tx.courseModule.deleteMany({ where: { curriculumVersionId: draftVersion.id } });
        }

        for (let mIdx = 0; mIdx < data.modules.length; mIdx++) {
          const modInput = data.modules[mIdx];
          const chaptersRaw = Array.isArray(modInput.chapters) ? modInput.chapters : (Array.isArray(modInput.lessons) ? modInput.lessons : []);
          await tx.courseModule.create({
            data: {
              curriculumVersionId: draftVersion.id,
              title: modInput.title || `Module ${mIdx + 1}`,
              description: modInput.description || null,
              position: modInput.position !== undefined ? modInput.position : mIdx,
              chapters: {
                create: chaptersRaw.map((chInput: any, cIdx: number) => {
                  const attachmentsRaw = Array.isArray(chInput.attachments) ? chInput.attachments : (Array.isArray(chInput.materials) ? chInput.materials : []);
                  return {
                    title: chInput.title || `Lesson ${cIdx + 1}`,
                    description: chInput.description || null,
                    videoUrl: chInput.videoUrl || null,
                    pdfUrl: chInput.pdfUrl || null,
                    duration: chInput.duration || '10:00',
                    position: chInput.position !== undefined ? chInput.position : cIdx,
                    isFree: Boolean(chInput.isFree),
                    attachments: {
                      create: attachmentsRaw.map((att: any) => ({
                        title: att.title,
                        fileUrl: att.fileUrl,
                        fileType: att.fileType || att.type || 'PDF',
                        fileSize: att.fileSize || 0,
                        isDownload: att.isDownload !== undefined ? att.isDownload : (att.isDownloadable !== undefined ? att.isDownloadable : true),
                      }))
                    }
                  };
                })
              }
            }
          });
        }
      }

      const updateData: any = { ...data };
      delete updateData.modules;
      delete updateData.id;
      delete updateData.extensibleConfig;

      if (data.extensibleConfig !== undefined) {
        const baseOverview =
          updateData.overviewJson && typeof updateData.overviewJson === 'object'
            ? updateData.overviewJson
            : (current.overviewJson && typeof current.overviewJson === 'object' ? current.overviewJson : {});
        updateData.overviewJson = {
          ...(baseOverview as Record<string, any>),
          extensibleConfig: data.extensibleConfig,
        };
      }

      if (updateData.price !== undefined) {
        updateData.price = new Prisma.Decimal(updateData.price);
      }

      return tx.globalCourse.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          activeCurriculumVersion: {
            include: {
              modules: {
                orderBy: { position: 'asc' },
                include: {
                  chapters: {
                    orderBy: { position: 'asc' },
                    include: { attachments: true }
                  }
                }
              }
            }
          },
          curriculumVersions: {
            orderBy: { version: 'desc' },
            include: {
              modules: {
                orderBy: { position: 'asc' },
                include: {
                  chapters: {
                    orderBy: { position: 'asc' },
                    include: { attachments: true }
                  }
                }
              }
            }
          }
        }
      });
    }, { maxWait: 20000, timeout: 60000 });
  }

  static async updateDraftChapter(
    chapterId: string,
    data: {
      title?: string;
      description?: string | null;
      videoUrl?: string | null;
      pdfUrl?: string | null;
      duration?: string;
      position?: number;
      isFree?: boolean;
      attachments?: Array<{
        title: string;
        fileUrl: string;
        fileType?: 'PDF' | 'ZIP' | 'DOCUMENT' | 'EXTERNAL_LINK' | 'IMAGE';
        type?: 'PDF' | 'ZIP' | 'DOCUMENT' | 'EXTERNAL_LINK' | 'IMAGE';
        fileSize?: number;
        isDownload?: boolean;
        isDownloadable?: boolean;
      }>;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const chapter = await tx.courseChapter.findUnique({
        where: { id: chapterId },
        include: {
          module: {
            include: { curriculumVersion: true }
          }
        }
      });
      if (!chapter) throw new Error('Chapter not found');
      if (chapter.module.curriculumVersion.isLocked || chapter.module.curriculumVersion.isPublished) {
        throw new Error('Cannot edit lesson in a locked or published curriculum version. Create a new draft version first.');
      }

      if (Array.isArray(data.attachments)) {
        await tx.lessonAttachment.deleteMany({ where: { chapterId } });
        if (data.attachments.length > 0) {
          await tx.lessonAttachment.createMany({
            data: data.attachments.map((att) => ({
              chapterId,
              title: att.title,
              fileUrl: att.fileUrl,
              fileType: att.fileType || att.type || 'PDF',
              fileSize: att.fileSize || 0,
              isDownload: att.isDownload !== undefined ? att.isDownload : (att.isDownloadable !== undefined ? att.isDownloadable : true),
            })),
          });
        }
      }

      return tx.courseChapter.update({
        where: { id: chapterId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
          ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
          ...(data.duration !== undefined && { duration: data.duration }),
          ...(data.position !== undefined && { position: data.position }),
          ...(data.isFree !== undefined && { isFree: data.isFree }),
        },
        include: {
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  static async replaceDraftCurriculum(courseId: string, versionId: string, modules: any[]) {
    return prisma.$transaction(async (tx) => {
      const version = await tx.courseCurriculumVersion.findFirst({
        where: { id: versionId, courseId },
      });
      if (!version) throw new Error('Curriculum version not found for this course');
      if (version.isLocked || version.isPublished) {
        throw new Error('Cannot modify modules or lessons on a locked or published curriculum version. Create a new draft version first.');
      }

      const existingModules = await tx.courseModule.findMany({
        where: { curriculumVersionId: versionId },
        include: { chapters: { select: { id: true } } },
      });
      const existingChapterIds = existingModules.flatMap((m) => m.chapters.map((c) => c.id));
      if (existingChapterIds.length > 0) {
        await tx.lessonAttachment.deleteMany({ where: { chapterId: { in: existingChapterIds } } });
        await tx.courseChapter.deleteMany({ where: { id: { in: existingChapterIds } } });
      }
      if (existingModules.length > 0) {
        await tx.courseModule.deleteMany({ where: { curriculumVersionId: versionId } });
      }

      for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        const modInput = modules[mIdx];
        const chaptersRaw = Array.isArray(modInput.chapters)
          ? modInput.chapters
          : (Array.isArray(modInput.lessons) ? modInput.lessons : []);

        await tx.courseModule.create({
          data: {
            curriculumVersionId: versionId,
            title: modInput.title || `Module ${mIdx + 1}`,
            description: modInput.description || null,
            position: modInput.position !== undefined ? modInput.position : mIdx,
            chapters: {
              create: chaptersRaw.map((chInput: any, cIdx: number) => {
                const attachmentsRaw = Array.isArray(chInput.attachments)
                  ? chInput.attachments
                  : (Array.isArray(chInput.materials) ? chInput.materials : []);
                return {
                  title: chInput.title || `Lesson ${cIdx + 1}`,
                  description: chInput.description || null,
                  videoUrl: chInput.videoUrl || null,
                  pdfUrl: chInput.pdfUrl || null,
                  duration: chInput.duration || '10:00',
                  position: chInput.position !== undefined ? chInput.position : cIdx,
                  isFree: Boolean(chInput.isFree),
                  attachments: {
                    create: attachmentsRaw.map((att: any) => ({
                      title: att.title,
                      fileUrl: att.fileUrl,
                      fileType: att.fileType || att.type || 'PDF',
                      fileSize: att.fileSize || 0,
                      isDownload: att.isDownload !== undefined
                        ? att.isDownload
                        : (att.isDownloadable !== undefined ? att.isDownloadable : true),
                    })),
                  },
                };
              }),
            },
          },
        });
      }

      return tx.courseCurriculumVersion.findUnique({
        where: { id: versionId },
        include: {
          modules: {
            orderBy: { position: 'asc' },
            include: {
              chapters: {
                orderBy: { position: 'asc' },
                include: { attachments: { orderBy: { createdAt: 'asc' } } },
              },
            },
          },
        },
      });
    }, { maxWait: 20000, timeout: 60000 });
  }

  static async publishCourse(courseId: string) {
    const globalCourseTable = getQualifiedObject('GlobalCourse');
    return prisma.$transaction(async (tx) => {
      // 1. Exclusive row lock on GlobalCourse
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM ${globalCourseTable} WHERE "id" = $1 FOR UPDATE;`,
        courseId
      );

      const course = await tx.globalCourse.findUnique({
        where: { id: courseId },
        include: {
          curriculumVersions: {
            where: { isPublished: false, isLocked: false },
            orderBy: { version: 'desc' },
            take: 1
          }
        }
      });

      if (!course) throw new Error('Course not found');

      // Lock draft version if exists
      let targetVersionId = course.activeCurriculumVersionId;
      if (course.curriculumVersions.length > 0) {
        const draft = course.curriculumVersions[0];
        await tx.courseCurriculumVersion.update({
          where: { id: draft.id },
          data: {
            isPublished: true,
            isLocked: true,
            publishedAt: new Date()
          }
        });
        targetVersionId = draft.id;
      } else if (course.activeCurriculumVersionId) {
        await tx.courseCurriculumVersion.update({
          where: { id: course.activeCurriculumVersionId },
          data: {
            isPublished: true,
            isLocked: true,
            publishedAt: new Date()
          }
        });
      }

      return tx.globalCourse.update({
        where: { id: courseId },
        data: {
          status: CourseStatus.PUBLISHED,
          activeCurriculumVersionId: targetVersionId
        },
        include: { activeCurriculumVersion: true }
      });
    }, { maxWait: 15000, timeout: 30000 });
  }

  static async createDraftVersion(courseId: string) {
    return prisma.$transaction(async (tx) => {
      const course = await tx.globalCourse.findUnique({
        where: { id: courseId },
        include: {
          curriculumVersions: { orderBy: { version: 'desc' }, take: 1 },
          activeCurriculumVersion: {
            include: {
              modules: {
                include: {
                  chapters: { include: { attachments: true } }
                }
              }
            }
          }
        }
      });

      if (!course) throw new Error('Course not found');

      const lastVersionNum = course.curriculumVersions[0]?.version || 0;
      const newVersionNum = lastVersionNum + 1;

      // Clone existing active modules and chapters if available
      const modulesCreate = (course.activeCurriculumVersion?.modules || []).map((mod: any) => ({
        title: mod.title,
        description: mod.description,
        position: mod.position,
        chapters: {
          create: (mod.chapters || []).map((ch: any) => ({
            title: ch.title,
            description: ch.description,
            videoUrl: ch.videoUrl,
            pdfUrl: ch.pdfUrl,
            duration: ch.duration,
            position: ch.position,
            isFree: ch.isFree,
            attachments: {
              create: (ch.attachments || []).map((att: any) => ({
                title: att.title,
                fileUrl: att.fileUrl,
                fileType: att.fileType || att.type || 'PDF',
                fileSize: att.fileSize || 0,
                isDownload: att.isDownload !== undefined ? att.isDownload : (att.isDownloadable !== undefined ? att.isDownloadable : true),
              }))
            }
          }))
        }
      }));

      // Create new draft version
      const newVersion = await tx.courseCurriculumVersion.create({
        data: {
          courseId,
          version: newVersionNum,
          title: `Version ${newVersionNum}.0 (Draft)`,
          isPublished: false,
          isLocked: false,
          modules: modulesCreate.length > 0 ? { create: modulesCreate } : undefined,
        }
      });

      return newVersion;
    }, { maxWait: 20000, timeout: 60000 });
  }

  // -------------------------------------------------------------
  // 3. FRANCHISE PERMISSION GOVERNANCE & OFFERINGS
  // -------------------------------------------------------------
  static async listFranchiseCourses(
    franchiseId: string,
    options?: { includeUnpermitted?: boolean }
  ) {
    const courses = await prisma.globalCourse.findMany({
      where: { status: CourseStatus.PUBLISHED },
      include: {
        category: true,
        franchiseSelections: {
          where: { franchiseId }
        },
        _count: {
          select: { enrollments: { where: { franchiseId, status: EnrollmentStatus.ACTIVE } } }
        }
      },
      orderBy: { title: 'asc' }
    });

    const filtered = options?.includeUnpermitted
      ? courses
      : courses.filter((c) => c.franchiseSelections[0]?.isPermitted === true);

    return filtered.map((c) => {
      const selection = c.franchiseSelections[0] || null;
      const isPermitted = Boolean(selection?.isPermitted);
      const isSelected = isPermitted && Boolean(selection?.isEnabled);
      return {
        ...c,
        isPermitted,
        permittedAt: selection?.permittedAt || null,
        isSelected,
        franchiseCustomPrice: selection?.localFeeOverride || null,
        activeEnrollmentsCount: c._count.enrollments,
      };
    });
  }

  static async setFranchiseCoursePermission(
    franchiseId: string,
    courseId: string,
    isPermitted: boolean,
    permittedById?: string | null,
    options?: { isEnabled?: boolean; customPrice?: number | string | null }
  ) {
    const [franchise, course] = await Promise.all([
      prisma.franchise.findUnique({ where: { id: franchiseId }, select: { id: true } }),
      prisma.globalCourse.findUnique({ where: { id: courseId }, select: { id: true, status: true } }),
    ]);

    if (!franchise) throw new Error('Franchise not found');
    if (!course) throw new Error('Global course not found');
    if (isPermitted && course.status !== CourseStatus.PUBLISHED) {
      throw new Error('Only published global courses can be permitted to franchises');
    }

    const rawCustomPrice = options?.customPrice;
    const hasCustomPrice = rawCustomPrice !== undefined;
    const feeOverride =
      rawCustomPrice !== undefined && rawCustomPrice !== null && rawCustomPrice !== ''
        ? new Prisma.Decimal(rawCustomPrice)
        : null;

    if (!isPermitted) {
      const existing = await prisma.franchiseCourseSelection.findUnique({
        where: { franchiseId_courseId: { franchiseId, courseId } },
      });
      if (!existing) {
        return prisma.franchiseCourseSelection.create({
          data: {
            franchiseId,
            courseId,
            isPermitted: false,
            isEnabled: false,
            permittedAt: null,
            permittedById: permittedById || null,
          },
        });
      }
      return prisma.franchiseCourseSelection.update({
        where: { franchiseId_courseId: { franchiseId, courseId } },
        data: {
          isPermitted: false,
          isEnabled: false,
        },
      });
    }

    return prisma.franchiseCourseSelection.upsert({
      where: { franchiseId_courseId: { franchiseId, courseId } },
      update: {
        isPermitted: true,
        permittedAt: new Date(),
        permittedById: permittedById || null,
        ...(options?.isEnabled !== undefined ? { isEnabled: options.isEnabled } : {}),
        ...(hasCustomPrice ? { localFeeOverride: feeOverride } : {}),
      },
      create: {
        franchiseId,
        courseId,
        isPermitted: true,
        permittedAt: new Date(),
        permittedById: permittedById || null,
        isEnabled: options?.isEnabled !== undefined ? options.isEnabled : false,
        localFeeOverride: feeOverride,
      },
    });
  }

  static async bulkSetFranchiseCoursePermissions(
    courseId: string,
    params: {
      franchiseIds?: string[];
      allActiveFranchises?: boolean;
      isPermitted: boolean;
      autoEnable?: boolean;
      permittedById?: string | null;
    }
  ) {
    const course = await prisma.globalCourse.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });
    if (!course) throw new Error('Global course not found');
    if (params.isPermitted && course.status !== CourseStatus.PUBLISHED) {
      throw new Error('Only published global courses can be permitted to franchises');
    }

    let targetFranchiseIds = Array.isArray(params.franchiseIds) ? params.franchiseIds : [];
    if (params.allActiveFranchises) {
      const activeFranchises = await prisma.franchise.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      targetFranchiseIds = activeFranchises.map((f) => f.id);
    }

    const uniqueFranchiseIds = Array.from(new Set(targetFranchiseIds));
    const results = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const franchiseId of uniqueFranchiseIds) {
        const row = await tx.franchiseCourseSelection.upsert({
          where: { franchiseId_courseId: { franchiseId, courseId } },
          update: params.isPermitted
            ? {
                isPermitted: true,
                permittedAt: new Date(),
                permittedById: params.permittedById || null,
                ...(params.autoEnable ? { isEnabled: true } : {}),
              }
            : {
                isPermitted: false,
                isEnabled: false,
              },
          create: {
            franchiseId,
            courseId,
            isPermitted: params.isPermitted,
            permittedAt: params.isPermitted ? new Date() : null,
            permittedById: params.permittedById || null,
            isEnabled: params.isPermitted ? Boolean(params.autoEnable) : false,
          },
        });
        out.push(row);
      }
      return out;
    }, { maxWait: 20000, timeout: 60000 });

    return {
      courseId,
      updatedCount: results.length,
      selections: results,
    };
  }

  static async toggleFranchiseCourseSelection(
    franchiseId: string,
    courseId: string,
    isEnabled: boolean,
    customPrice?: number | string | null,
    callerRole?: string,
    callerUserId?: string | null
  ) {
    const course = await prisma.globalCourse.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });
    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new Error('Only published global courses can be offered by franchises');
    }

    const existing = await prisma.franchiseCourseSelection.findUnique({
      where: { franchiseId_courseId: { franchiseId, courseId } },
    });

    const isSuperAdmin = callerRole === 'SUPER_ADMIN';
    if (!isSuperAdmin && (!existing || !existing.isPermitted)) {
      throw new CoursePermissionForbiddenError(
        'Forbidden: This course has not been permitted for your franchise by Digital Guru HQ (Super Admin).'
      );
    }

    const hasCustomPrice = customPrice !== undefined;
    const feeOverride =
      hasCustomPrice && customPrice !== null && customPrice !== ''
        ? new Prisma.Decimal(customPrice)
        : null;

    if (!existing) {
      return prisma.franchiseCourseSelection.create({
        data: {
          franchiseId,
          courseId,
          isPermitted: isEnabled,
          permittedAt: isEnabled ? new Date() : null,
          permittedById: isEnabled ? (callerUserId || null) : null,
          isEnabled,
          localFeeOverride: feeOverride,
        },
      });
    }

    return prisma.franchiseCourseSelection.update({
      where: { franchiseId_courseId: { franchiseId, courseId } },
      data: {
        ...(isSuperAdmin && isEnabled && !existing.isPermitted
          ? { isPermitted: true, permittedAt: new Date(), permittedById: callerUserId || null }
          : {}),
        isEnabled,
        ...(hasCustomPrice ? { localFeeOverride: feeOverride } : {}),
      },
    });
  }

  // -------------------------------------------------------------
  // 4. STUDENT ENROLLMENT & ANTI-TAMPERING ENGINE
  // -------------------------------------------------------------
  static async enrollStudent(data: {
    studentId: string;
    courseId: string;
    franchiseId: string;
    mode: LearningMode;
    instituteId?: string | null;
    batchId?: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch Student with Institute
      const student = await tx.student.findUnique({
        where: { id: data.studentId },
        include: { institute: true }
      });
      if (!student) throw new Error('Student record not found');

      // 2. Validate Franchise Ownership
      if (student.instituteId && student.institute) {
        if (student.institute.franchiseId !== data.franchiseId) {
          throw new Error('Student institute does not belong to the operating franchise');
        }
      } else if (student.franchiseId && student.franchiseId !== data.franchiseId) {
        throw new Error('Student does not belong to the target franchise');
      }

      // 3. Validate OFFLINE Hierarchy
      if (data.mode === LearningMode.OFFLINE) {
        if (!data.instituteId || !data.batchId) {
          throw new Error('instituteId and batchId are mandatory for OFFLINE enrollments');
        }

        const batch = await tx.batch.findUnique({
          where: { id: data.batchId },
          include: { institute: true }
        });
        if (!batch || batch.instituteId !== data.instituteId) {
          throw new Error('Specified batch does not belong to the specified institute');
        }
        if (batch.institute.franchiseId !== data.franchiseId) {
          throw new Error('Target institute does not belong to the operating franchise');
        }
      }

      // 4. Verify Course is published & enabled for this franchise
      const course = await tx.globalCourse.findUnique({ where: { id: data.courseId } });
      if (!course || course.status !== CourseStatus.PUBLISHED || !course.activeCurriculumVersionId) {
        throw new Error('Course is not published or has no active curriculum version');
      }

      const selection = await tx.franchiseCourseSelection.findUnique({
        where: { franchiseId_courseId: { franchiseId: data.franchiseId, courseId: data.courseId } }
      });
      if (!selection || !selection.isPermitted) {
        throw new CoursePermissionForbiddenError('This course has not been permitted for the selected franchise by Super Admin.');
      }
      if (!selection.isEnabled) {
        throw new Error('This course is not enabled for the selected franchise. Enable it in Franchise Offerings first.');
      }

      // 5. Check if ACTIVE enrollment already exists in this exact mode
      const existingActive = await tx.courseEnrollment.findFirst({
        where: {
          studentId: data.studentId,
          courseId: data.courseId,
          mode: data.mode,
          status: EnrollmentStatus.ACTIVE
        }
      });
      if (existingActive) {
        return existingActive; // Idempotent return
      }

      // 6. Create Enrollment (ONLINE strictly stores null instituteId & batchId)
      return tx.courseEnrollment.create({
        data: {
          studentId: data.studentId,
          courseId: data.courseId,
          curriculumVersionId: course.activeCurriculumVersionId,
          franchiseId: data.franchiseId,
          instituteId: data.mode === LearningMode.ONLINE ? null : (data.instituteId || null),
          batchId: data.mode === LearningMode.ONLINE ? null : (data.batchId || null),
          mode: data.mode,
          status: EnrollmentStatus.ACTIVE,
        },
        include: {
          course: { select: { title: true, slug: true } },
          franchise: { select: { name: true } },
        }
      });
    }, { maxWait: 15000, timeout: 30000 });
  }

  static async transferEnrollment(
    sourceEnrollmentId: string,
    params: {
      newMode?: LearningMode;
      newFranchiseId?: string;
      newInstituteId?: string | null;
      newBatchId?: string | null;
      reason?: string | null;
    }
  ) {
    const enrollmentTable = getQualifiedObject('CourseEnrollment');
    return prisma.$transaction(async (tx) => {
      // 1. Exclusive row lock on source enrollment
      await tx.$queryRawUnsafe(
        `SELECT "id" FROM ${enrollmentTable} WHERE "id" = $1 FOR UPDATE;`,
        sourceEnrollmentId
      );

      const source = await tx.courseEnrollment.findUnique({
        where: { id: sourceEnrollmentId },
        include: { student: { include: { institute: true } } }
      });

      if (!source || source.status !== EnrollmentStatus.ACTIVE) {
        throw new Error('Source enrollment is not active or does not exist');
      }

      const targetMode = params.newMode || source.mode;
      const targetFranchiseId = params.newFranchiseId || source.franchiseId;
      const targetInstituteId =
        targetMode === LearningMode.ONLINE
          ? null
          : params.newInstituteId !== undefined
          ? params.newInstituteId
          : source.instituteId;
      const targetBatchId =
        targetMode === LearningMode.ONLINE
          ? null
          : params.newBatchId !== undefined
          ? params.newBatchId
          : source.batchId;

      // 2. Validate Ownership on destination
      if (targetMode === LearningMode.OFFLINE) {
        if (!targetInstituteId || !targetBatchId) {
          throw new Error('instituteId and batchId are mandatory for OFFLINE mode transfer');
        }
        const batch = await tx.batch.findUnique({
          where: { id: targetBatchId },
          include: { institute: true }
        });
        if (!batch || batch.instituteId !== targetInstituteId) {
          throw new Error('Destination batch does not belong to the destination institute');
        }
        if (batch.institute.franchiseId !== targetFranchiseId) {
          throw new Error('Destination institute does not belong to the target franchise');
        }
      }

      // Verify target franchise has course permitted & enabled
      const targetSelection = await tx.franchiseCourseSelection.findUnique({
        where: { franchiseId_courseId: { franchiseId: targetFranchiseId, courseId: source.courseId } }
      });
      if (!targetSelection || !targetSelection.isPermitted) {
        throw new CoursePermissionForbiddenError('Target franchise is not permitted to offer this course by Super Admin');
      }
      if (!targetSelection.isEnabled) {
        throw new Error('Target franchise does not have this course enabled');
      }

      // Check for another active enrollment in the target mode (e.g. concurrent dual enrollment transfer collision)
      const conflictingActive = await tx.courseEnrollment.findFirst({
        where: {
          id: { not: source.id },
          studentId: source.studentId,
          courseId: source.courseId,
          mode: targetMode,
          status: EnrollmentStatus.ACTIVE,
        }
      });
      if (conflictingActive) {
        throw new Error(`Student already holds an active ${targetMode} enrollment for this course`);
      }

      // 3. Mark source enrollment as TRANSFERRED FIRST (releases the unique active partial index slot)
      await tx.courseEnrollment.update({
        where: { id: source.id },
        data: {
          status: EnrollmentStatus.TRANSFERRED,
          transferredAt: new Date(),
          transferReason: params.reason || null,
        }
      });

      // 4. Create new ACTIVE enrollment
      const newEnrollment = await tx.courseEnrollment.create({
        data: {
          studentId: source.studentId,
          courseId: source.courseId,
          curriculumVersionId: source.curriculumVersionId,
          franchiseId: targetFranchiseId,
          instituteId: targetInstituteId || null,
          batchId: targetBatchId || null,
          mode: targetMode,
          status: EnrollmentStatus.ACTIVE,
          transferredFromEnrollmentId: source.id,
          transferReason: params.reason || null,
        }
      });

      // Student lesson progress remains 100% active and preserved
      return newEnrollment;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 15000,
      timeout: 30000
    });
  }

  static async listFranchiseEnrollments(
    franchiseId: string,
    filters?: { instituteId?: string; courseId?: string; mode?: LearningMode; status?: EnrollmentStatus }
  ) {
    const where: Prisma.CourseEnrollmentWhereInput = { franchiseId };
    if (filters?.instituteId) where.instituteId = filters.instituteId;
    if (filters?.courseId) where.courseId = filters.courseId;
    if (filters?.mode) where.mode = filters.mode;
    if (filters?.status) where.status = filters.status;

    return prisma.courseEnrollment.findMany({
      where,
      orderBy: { enrolledAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            phone: true,
            user: { select: { email: true } },
          },
        },
        course: { select: { id: true, title: true, slug: true, duration: true } },
        institute: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, academicYear: true } },
      }
    });
  }

  static async listStudentEnrollments(studentId: string) {
    return prisma.courseEnrollment.findMany({
      where: { studentId },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          include: {
            category: true,
            activeCurriculumVersion: {
              include: {
                modules: {
                  include: { chapters: true }
                }
              }
            }
          }
        },
        franchise: { select: { id: true, name: true } },
        institute: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } }
      }
    });
  }

  // -------------------------------------------------------------
  // 5. STUDENT LEARNING PLAYER & XP ENGINE (ONLINE & OFFLINE)
  // -------------------------------------------------------------
  static async getStudentCoursePlayer(studentId: string, courseId: string) {
    // 1. Authorize: Student must have ACTIVE or COMPLETED enrollment (ONLINE or OFFLINE)
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        studentId,
        courseId,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] }
      }
    });

    if (!enrollment) {
      throw new Error('Unauthorized: Student does not have an active enrollment in this course');
    }

    // 2. Fetch Course with active curriculum
    const course = await prisma.globalCourse.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        activeCurriculumVersion: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: {
                chapters: {
                  orderBy: { position: 'asc' },
                  include: {
                    attachments: {
                      orderBy: { createdAt: 'asc' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!course || !course.activeCurriculumVersion) {
      throw new Error('Course curriculum is not published');
    }

    // 3. Fetch Student Progress for all chapters in this curriculum
    const allChapters = course.activeCurriculumVersion.modules.flatMap(m => m.chapters);
    const chapterIds = allChapters.map(c => c.id);

    const progressRecords = await prisma.studentLessonProgress.findMany({
      where: {
        studentId,
        chapterId: { in: chapterIds }
      }
    });

    const progressMap = new Map<string, boolean>();
    progressRecords.forEach(p => {
      if (p.isCompleted) progressMap.set(p.chapterId, true);
    });

    const completedCount = progressMap.size;
    const totalCount = allChapters.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Attach completion flag to chapters
    const curriculum = course.activeCurriculumVersion.modules.map(mod => ({
      ...mod,
      chapters: mod.chapters.map(ch => ({
        ...ch,
        isCompleted: progressMap.get(ch.id) || false
      }))
    }));

    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        subTitle: course.subTitle,
        description: course.description,
        thumbnailUrl: course.thumbnailUrl,
        enrollmentMode: enrollment.mode,
        enrollmentStatus: enrollment.status,
      },
      stats: {
        totalChapters: totalCount,
        completedChapters: completedCount,
        progressPercent,
        isCourseCompleted: completedCount === totalCount && totalCount > 0
      },
      curriculum
    };
  }

  static async completeLesson(studentId: string, courseId: string, chapterId: string, timeSpentSec = 60) {
    // 1. Fetch chapter, course & enrollment before transaction
    const [chapter, course, enrollment] = await Promise.all([
      prisma.courseChapter.findUnique({
        where: { id: chapterId },
        include: {
          module: {
            select: {
              curriculumVersionId: true,
              curriculumVersion: { select: { courseId: true } },
            },
          },
        },
      }),
      prisma.globalCourse.findUnique({
        where: { id: courseId },
        include: {
          activeCurriculumVersion: {
            include: {
              modules: {
                include: { chapters: { select: { id: true } } },
              },
            },
          },
        },
      }),
      prisma.courseEnrollment.findFirst({
        where: {
          studentId,
          courseId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
      }),
    ]);

    if (!enrollment) throw new Error('Unauthorized: Student is not enrolled in this course');
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.module.curriculumVersion.courseId !== courseId) {
      throw new Error('Integrity error: Requested lesson does not belong to the requested course');
    }

    const versionId = chapter.module.curriculumVersionId;
    const allChapterIds = course?.activeCurriculumVersion?.modules.flatMap((m) => m.chapters.map((c) => c.id)) || [];

    const flags = ((course?.overviewJson as any)?.extensibleConfig?.featureFlags || {}) as Record<string, any>;
    const xpEnabled = flags.xpEnabled !== false;
    const xpChapterAmount = xpEnabled ? (typeof flags.lessonXp === 'number' && flags.lessonXp >= 0 ? Math.floor(flags.lessonXp) : 10) : 0;
    const xpCourseAmount = xpEnabled ? (typeof flags.completionXp === 'number' && flags.completionXp >= 0 ? Math.floor(flags.completionXp) : 100) : 0;

    const xpLedgerTable = getQualifiedObject('StudentXpLedger');
    const progressTable = getQualifiedObject('StudentLessonProgress');

    // 2. Lean atomic transaction (concurrency-safe upsert + atomic XP ledger + enrollment progress)
    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `INSERT INTO ${progressTable} (
          "id", "studentId", "chapterId", "courseId", "curriculumVersionId", "isCompleted", "completedAt", "timeSpentSec"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, TRUE, NOW(), $5
        )
        ON CONFLICT ("studentId", "chapterId") DO UPDATE SET
          "isCompleted" = TRUE,
          "completedAt" = COALESCE(${progressTable}."completedAt", NOW()),
          "timeSpentSec" = ${progressTable}."timeSpentSec" + EXCLUDED."timeSpentSec";`,
        studentId,
        chapterId,
        courseId,
        versionId,
        timeSpentSec
      );

      let awardedChapterXp = false;
      if (xpChapterAmount > 0) {
        const xpChapterAction = 'COMPLETE_CHAPTER';
        const referenceId = `ch_${chapterId}`;

        const xpResult: Array<{ id: string; amount: number }> = await tx.$queryRawUnsafe(
          `INSERT INTO ${xpLedgerTable} (
            "id", "studentId", "courseId", "amount", "action", "referenceId", "description", "createdAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          )
          ON CONFLICT ("studentId", "action", "referenceId") DO NOTHING
          RETURNING "id", "amount";`,
          studentId,
          courseId,
          xpChapterAmount,
          xpChapterAction,
          referenceId,
          `Completed chapter: ${chapter.title}`
        );

        awardedChapterXp = xpResult.length > 0;
      }

      // Check course completion & sync progress %
      let awardedCourseXp = false;
      let courseJustCompleted = false;

      if (allChapterIds.length > 0) {
        const completedCount = await tx.studentLessonProgress.count({
          where: {
            studentId,
            chapterId: { in: allChapterIds },
            isCompleted: true,
          },
        });
        const pct = Math.min(100, Math.round((completedCount / allChapterIds.length) * 100));

        await tx.courseEnrollment.updateMany({
          where: {
            studentId,
            courseId,
            status: EnrollmentStatus.ACTIVE,
          },
          data: {
            progress: pct,
          },
        });

        if (completedCount === allChapterIds.length) {
          const completedUpdate = await tx.courseEnrollment.updateMany({
            where: {
              studentId,
              courseId,
              status: EnrollmentStatus.ACTIVE,
            },
            data: {
              status: EnrollmentStatus.COMPLETED,
              progress: 100,
              completedAt: new Date(),
            },
          });
          courseJustCompleted = completedUpdate.count > 0;

          if (xpCourseAmount > 0) {
            const xpCourseAction = 'COMPLETE_COURSE';
            const courseRefId = `course_${courseId}`;

            const courseXpResult: Array<{ id: string }> = await tx.$queryRawUnsafe(
              `INSERT INTO ${xpLedgerTable} (
                "id", "studentId", "courseId", "amount", "action", "referenceId", "description", "createdAt"
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
              )
              ON CONFLICT ("studentId", "action", "referenceId") DO NOTHING
              RETURNING "id";`,
              studentId,
              courseId,
              xpCourseAmount,
              xpCourseAction,
              courseRefId,
              `Completed full course: ${course?.title || ''}`
            );

            if (courseXpResult.length > 0) {
              awardedCourseXp = true;
            }
          }
        }
      }

      return { awardedChapterXp, awardedCourseXp, courseJustCompleted };
    }, { maxWait: 15000, timeout: 30000 });

    // 3. Post-transaction live total XP and level update
    const totalXpRows: Array<{ total: string | null }> = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("amount"), 0)::text as total FROM ${xpLedgerTable} WHERE "studentId" = $1;`,
      studentId
    );
    const totalXp = parseInt(totalXpRows[0]?.total || '0', 10);
    const xpAwarded = (txResult.awardedChapterXp ? xpChapterAmount : 0) + (txResult.awardedCourseXp ? xpCourseAmount : 0);
    const xpBeforeThisCall = Math.max(0, totalXp - xpAwarded);

    let level = 1;
    let previousLevel = 1;
    for (let i = XP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= XP_LEVEL_THRESHOLDS[i] && level === 1) {
        level = i + 1;
      }
      if (xpBeforeThisCall >= XP_LEVEL_THRESHOLDS[i] && previousLevel === 1) {
        previousLevel = i + 1;
      }
    }

    const studentRec = await prisma.student.findUnique({ where: { id: studentId } });
    if (studentRec?.userId) {
      await prisma.user.update({
        where: { id: studentRec.userId },
        data: { xpPoints: totalXp, level },
      }).catch(console.error);
    }

    return {
      lessonCompleted: true,
      xpAwarded,
      totalXp,
      level,
      previousLevel,
      leveledUp: level > previousLevel,
      courseJustCompleted: txResult.courseJustCompleted,
    };
  }

  static async getStudentLearningDashboard(studentId: string) {
    const [enrollments, progressRows, xpRows, certificates] = await Promise.all([
      prisma.courseEnrollment.findMany({
        where: {
          studentId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
        },
        orderBy: { enrolledAt: 'desc' },
        include: {
          course: {
            include: {
              category: true,
              activeCurriculumVersion: {
                include: {
                  modules: {
                    orderBy: { position: 'asc' },
                    include: {
                      chapters: {
                        orderBy: { position: 'asc' },
                        select: { id: true, title: true },
                      },
                    },
                  },
                },
              },
            },
          },
          franchise: { select: { id: true, name: true, code: true } },
          institute: { select: { id: true, name: true, code: true } },
          batch: { select: { id: true, name: true } },
        },
      }),
      prisma.studentLessonProgress.findMany({
        where: { studentId, isCompleted: true },
        select: { chapterId: true, courseId: true },
      }),
      prisma.studentXpLedger.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.courseCertificate.findMany({
        where: { studentId },
        orderBy: { issuedAt: 'desc' },
        include: { course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } } },
      }),
    ]);

    const completedSet = new Set(progressRows.map((p) => p.chapterId));
    const totalXpResult: Array<{ total: string | null }> = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("amount"), 0)::text as total FROM ${getQualifiedObject('StudentXpLedger')} WHERE "studentId" = $1;`,
      studentId
    );
    const totalXp = parseInt(totalXpResult[0]?.total || '0', 10);

    let level = 1;
    for (let i = XP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= XP_LEVEL_THRESHOLDS[i]) {
        level = i + 1;
        break;
      }
    }
    const currentFloor = XP_LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = XP_LEVEL_THRESHOLDS[level] ?? null;

    const certByCourseId = new Map(certificates.map((c) => [c.courseId, c]));

    const enrichedEnrollments = enrollments.map((enr) => {
      const chapters = enr.course.activeCurriculumVersion?.modules.flatMap((m) => m.chapters) || [];
      const totalLessons = chapters.length;
      const completedLessons = chapters.filter((ch) => completedSet.has(ch.id)).length;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : enr.progress;
      const isCompleted = enr.status === EnrollmentStatus.COMPLETED || (totalLessons > 0 && completedLessons === totalLessons);

      return {
        ...enr,
        totalLessons,
        completedLessons,
        progressPercent,
        isCompleted,
        certificate: certByCourseId.get(enr.courseId) || null,
      };
    });

    return {
      xp: {
        totalXp,
        level,
        currentLevelFloor: currentFloor,
        nextLevelThreshold: nextThreshold,
        recentLedger: xpRows,
      },
      enrollments: enrichedEnrollments,
      certificates,
    };
  }

  // -------------------------------------------------------------
  // 6. CERTIFICATES & HMAC CRYPTOGRAPHY
  // -------------------------------------------------------------
  static async claimCertificate(studentId: string, courseId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Check if already issued
      const existing = await tx.courseCertificate.findUnique({
        where: { studentId_courseId: { studentId, courseId } }
      });
      if (existing) return existing;

      // 2. Verify 100% completion of active curriculum
      const course = await tx.globalCourse.findUnique({
        where: { id: courseId },
        include: {
          activeCurriculumVersion: {
            include: {
              modules: {
                include: { chapters: true }
              }
            }
          }
        }
      });

      if (!course?.activeCurriculumVersion) {
        throw new Error('Course has no active published curriculum version');
      }

      const certFlags = ((course.overviewJson as any)?.extensibleConfig?.featureFlags || {}) as Record<string, any>;
      if (certFlags.certificatesEnabled === false) {
        throw new Error('Certificates are disabled for this course');
      }

      const allChapterIds = course.activeCurriculumVersion.modules.flatMap(m => m.chapters.map(c => c.id));
      const completedProgressCount = await tx.studentLessonProgress.count({
        where: {
          studentId,
          chapterId: { in: allChapterIds },
          isCompleted: true
        }
      });

      if (completedProgressCount !== allChapterIds.length || allChapterIds.length === 0) {
        throw new Error(`Cannot issue certificate: course is ${completedProgressCount}/${allChapterIds.length} complete`);
      }

      // 3. Find qualifying enrollment
      const qualifyingEnrollment = await tx.courseEnrollment.findFirst({
        where: {
          studentId,
          courseId,
          status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] }
        },
        orderBy: { enrolledAt: 'desc' }
      });

      if (!qualifyingEnrollment) {
        throw new Error('Student has no eligible enrollment record');
      }

      // 4. Fetch student details for name
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: { user: true }
      });
      const recipientName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Digital Guru Student';

      // 5. Atomically allocate sequence number (respecting isolated schema when configured)
      const schemaMatch = (process.env.DATABASE_URL || '').match(/[?&]schema=([a-zA-Z0-9_]+)/);
      const qualifiedSeq = schemaMatch ? `"${schemaMatch[1]}"."course_certificate_seq"` : 'course_certificate_seq';
      const seqRows: Array<{ nextval: string }> = await tx.$queryRawUnsafe(
        `SELECT nextval('${qualifiedSeq}')::text;`
      );
      const certNum = `DG-CERT-${new Date().getFullYear()}-${seqRows[0].nextval.padStart(6, '0')}`;

      // 6. Cryptographic HMAC-SHA256 signature
      const secret = getCertificateSigningSecret();
      const payload = `${studentId}:${courseId}:${course.activeCurriculumVersion.id}:${certNum}`;
      const verificationCode = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      return tx.courseCertificate.create({
        data: {
          studentId,
          courseId,
          curriculumVersionId: course.activeCurriculumVersion.id,
          qualifyingEnrollmentId: qualifyingEnrollment.id,
          certificateNumber: certNum,
          verificationCode,
          recipientName,
          courseTitle: course.title,
          issuedAt: new Date(),
          metadataJson: {
            mode: qualifyingEnrollment.mode,
            chaptersCompleted: allChapterIds.length,
            franchiseId: qualifyingEnrollment.franchiseId
          }
        }
      });
    }, { maxWait: 15000, timeout: 30000 });
  }

  static async verifyCertificate(certificateNumber: string) {
    const cert = await prisma.courseCertificate.findUnique({
      where: { certificateNumber },
      include: {
        course: { select: { title: true, slug: true, thumbnailUrl: true } },
        student: { select: { firstName: true, lastName: true } }
      }
    });

    if (!cert) return null;

    // Verify authenticity hash
    const secret = getCertificateSigningSecret();
    const payload = `${cert.studentId}:${cert.courseId}:${cert.curriculumVersionId}:${cert.certificateNumber}`;
    const expectedCode = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const isAuthentic = cert.verificationCode === expectedCode;

    return {
      certificateNumber: cert.certificateNumber,
      recipientName: cert.recipientName,
      courseTitle: cert.courseTitle,
      issuedAt: cert.issuedAt,
      isAuthentic,
      metadata: cert.metadataJson,
    };
  }

  static async listStudentCertificates(studentId: string) {
    return prisma.courseCertificate.findMany({
      where: { studentId },
      orderBy: { issuedAt: 'desc' },
      include: {
        course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } }
      }
    });
  }
}
