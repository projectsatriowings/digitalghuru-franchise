import { prisma } from '../src/prisma.js';
import { SOURCE_COURSES, SOURCE_CATEGORIES, resolveBrochureAttachment } from './import-catalogue.js';
import { CourseStatus } from '@prisma/client';

async function main() {
  const course = SOURCE_COURSES.find((c) => c.slug === 'ai-powered-digital-marketing')!;
  const existing = await prisma.globalCourse.findUnique({
    where: { slug: course.slug },
    include: {
      activeCurriculumVersion: {
        include: {
          modules: {
            include: { chapters: true },
          },
        },
      },
      curriculumVersions: true,
      enrollments: true,
      certificates: true,
      franchiseSelections: true,
    },
  });

  console.log('Existing course ID:', existing?.id);
  console.log('Existing enrollments:', existing?.enrollments.length);
  console.log('Existing certificates:', existing?.certificates.length);
  console.log('Existing franchise selections:', existing?.franchiseSelections.length);

  const cat = await prisma.courseCategory.findUnique({ where: { slug: course.categorySlug } });

  if (existing) {
    console.log('Updating existing course with authentic 10-step wizard metadata...');
    await prisma.globalCourse.update({
      where: { id: existing.id },
      data: {
        title: course.title,
        subTitle: course.subTitle,
        description: course.description,
        categoryId: cat?.id || existing.categoryId,
        format: course.format,
        duration: course.duration,
        level: course.level,
        price: course.price,
        status: course.status,
        thumbnailUrl: course.thumbnailUrl,
        bannerUrl: course.bannerUrl,
        brochureUrl: course.brochureUrl,
        learningOutcomes: course.learningOutcomes,
        targetAudience: course.targetAudience,
        toolsCovered: course.toolsCovered,
        overviewJson: course.overviewJson as any,
        designedToHelpJson: course.designedToHelpJson as any,
        numberedFeaturesJson: course.numberedFeaturesJson as any,
        whyDigitalGhuruJson: course.whyDigitalGhuruJson as any,
        topHighlightsJson: course.topHighlightsJson as any,
        faqsJson: course.faqsJson as any,
      },
    });

    // Check if authentic curriculum version already exists or create Version 2 with authentic 12 modules / 48 lessons
    const existingMods = existing.activeCurriculumVersion?.modules.length || 0;
    console.log(`Current active curriculum version has ${existingMods} modules.`);

    if (existingMods < 12) {
      console.log('Creating authentic published curriculum version (12 modules, 48 lessons)...');
      const maxVersion = Math.max(...existing.curriculumVersions.map((v) => v.version), 0);
      const newVersionNum = maxVersion + 1;

      const newVersion = await prisma.courseCurriculumVersion.create({
        data: {
          courseId: existing.id,
          version: newVersionNum,
          title: `Version ${newVersionNum}.0 (Authentic Complete Curriculum)`,
          isPublished: false,
          isLocked: false,
          modules: {
            create: course.curriculum.map((mod, mIdx) => ({
              title: mod.title,
              position: mIdx,
              chapters: {
                create: mod.topics.map((topic, cIdx) => {
                  const isFirstChapter = mIdx === 0 && cIdx === 0;
                  const resolvedBrochure = isFirstChapter ? resolveBrochureAttachment(course.brochureUrl) : null;
                  return {
                    title: topic,
                    position: cIdx,
                    duration: '10:00',
                    isFree: isFirstChapter,
                    videoUrl: isFirstChapter ? 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview' : null,
                    pdfUrl: isFirstChapter ? '/uploads/courses/materials/lesson1-notes.pdf' : null,
                    ...(resolvedBrochure
                      ? {
                          attachments: {
                            create: [
                              {
                                title: `${course.title} Syllabus & Brochure`,
                                fileUrl: resolvedBrochure.fileUrl,
                                fileSize: resolvedBrochure.fileSize,
                                isDownload: true,
                              },
                            ],
                          },
                        }
                      : {}),
                  };
                }),
              },
            })),
          },
        },
      });

      await prisma.courseCurriculumVersion.update({
        where: { id: newVersion.id },
        data: {
          isPublished: true,
          isLocked: true,
          publishedAt: new Date(),
        },
      });

      await prisma.globalCourse.update({
        where: { id: existing.id },
        data: { activeCurriculumVersionId: newVersion.id },
      });

      console.log(`Successfully activated Version ${newVersionNum} for ${course.slug}!`);
    }
  }

  // Final check of all 5 courses
  const allCourses = await prisma.globalCourse.findMany({
    where: {
      slug: {
        in: [
          'ai-powered-digital-marketing',
          'react-js-full-stack-development',
          'ai-super-kids-grade-11-12',
          'data-science-with-ai',
          'creative-design-and-video-editing',
        ],
      },
    },
    include: {
      category: true,
      activeCurriculumVersion: {
        include: {
          modules: {
            include: {
              chapters: {
                include: { attachments: true },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  console.log('\n============================================================');
  console.log('AUTHENTIC GLOBAL COURSE CATALOGUE VERIFICATION:');
  console.log('============================================================');
  let grandTotalModules = 0;
  let grandTotalChapters = 0;

  for (const c of allCourses) {
    const mods = c.activeCurriculumVersion?.modules || [];
    const chaps = mods.reduce((sum, m) => sum + m.chapters.length, 0);
    grandTotalModules += mods.length;
    grandTotalChapters += chaps.length;

    console.log(`\n✓ Course: ${c.title}`);
    console.log(`  - Slug: ${c.slug}`);
    console.log(`  - Category: ${c.category?.name}`);
    console.log(`  - Duration: ${c.duration} | Format: ${c.format} | Level: ${c.level}`);
    console.log(`  - Active Version: ${c.activeCurriculumVersion?.version} (Published: ${c.activeCurriculumVersion?.isPublished})`);
    console.log(`  - Modules: ${mods.length}`);
    console.log(`  - Lessons: ${chaps}`);
    console.log(`  - Brochure: ${c.brochureUrl}`);
    console.log(`  - 10-Step Wizard Data: Overview=${!!c.overviewJson}, DesignedToHelp=${!!c.designedToHelpJson}, Features=${!!c.numberedFeaturesJson}, WhyDG=${!!c.whyDigitalGhuruJson}, TopHighlights=${!!c.topHighlightsJson}, FAQs=${!!c.faqsJson}`);
  }

  console.log(`\nGrand Totals: ${allCourses.length} courses, ${grandTotalModules} modules, ${grandTotalChapters} lessons.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
