import { prisma } from '../src/prisma.js';

async function main() {
  const c = await prisma.globalCourse.findUnique({
    where: { slug: 'ai-powered-digital-marketing' },
    include: {
      activeCurriculumVersion: {
        include: {
          modules: {
            include: { chapters: true },
            orderBy: { position: 'asc' },
          },
        },
      },
      curriculumVersions: {
        include: {
          modules: {
            include: { chapters: true },
          },
        },
      },
    },
  });

  if (!c) {
    console.log('Course not found');
    return;
  }

  console.log('Course:', c.id, c.title, c.slug);
  console.log('Versions:', c.curriculumVersions.map((v) => ({
    id: v.id,
    version: v.version,
    isPublished: v.isPublished,
    modules: v.modules.length,
    chapters: v.modules.reduce((sum, m) => sum + m.chapters.length, 0),
  })));

  if (c.activeCurriculumVersion) {
    console.log('\nActive Version Modules:');
    c.activeCurriculumVersion.modules.forEach((m, idx) => {
      console.log(`  Module ${idx + 1}: ${m.title} (lessons: ${m.chapters.length})`);
      m.chapters.forEach((ch, cidx) => {
        console.log(`    Lesson ${cidx + 1}: ${ch.title} | video: ${ch.videoUrl} | pdf: ${ch.pdfUrl}`);
      });
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
