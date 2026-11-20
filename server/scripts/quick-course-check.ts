import { prisma } from '../src/prisma.js';

async function main() {
  const courses = await prisma.globalCourse.findMany({
    include: {
      category: true,
      activeCurriculumVersion: {
        include: {
          modules: {
            include: { chapters: true },
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });
  console.log('Courses count in Neon DB:', courses.length);
  for (const c of courses) {
    const modules = c.activeCurriculumVersion?.modules || [];
    const totalChapters = modules.reduce((acc, m) => acc + m.chapters.length, 0);
    console.log(`\nCourse: ${c.title} (slug: ${c.slug})`);
    console.log(`  - Category: ${c.category?.name || 'None'}`);
    console.log(`  - Price: ${c.price}`);
    console.log(`  - Duration: ${c.duration}, Format: ${c.format}`);
    console.log(`  - BrochureUrl: ${c.brochureUrl}`);
    console.log(`  - Modules: ${modules.length}`);
    console.log(`  - Lessons/Chapters: ${totalChapters}`);
    console.log(`  - OverviewJson: ${!!c.overviewJson}, DesignedToHelp: ${!!c.designedToHelpJson}, Features: ${!!c.numberedFeaturesJson}, WhyDG: ${!!c.whyDigitalGhuruJson}, TopHighlights: ${!!c.topHighlightsJson}, FAQs: ${!!c.faqsJson}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
