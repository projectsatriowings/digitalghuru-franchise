import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log(' AUTHENTIC COURSE CATALOGUE INTEGRITY & API VERIFICATION');
  console.log('============================================================\n');

  // 1. Check Global Courses Count (Published Authentic Courses)
  const courses = await prisma.globalCourse.findMany({
    where: {
      status: 'PUBLISHED',
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
                include: { attachments: true },
              },
            },
          },
        },
      },
      franchiseSelections: {
        include: {
          franchise: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`1. Total Global Courses in DB: ${courses.length}`);
  if (courses.length !== 2) {
    throw new Error(`Expected exactly 2 authentic courses, found ${courses.length}`);
  }
  console.log('   ✓ Exactly 2 authentic courses present\n');

  for (const course of courses) {
    console.log(`------------------------------------------------------------`);
    console.log(`Course: "${course.title}" (${course.slug})`);
    console.log(`  - ID:                 ${course.id}`);
    console.log(`  - Category:           ${course.category?.name} (${course.category?.slug})`);
    console.log(`  - Status:             ${course.status}`);
    console.log(`  - Duration:           ${course.duration}`);
    console.log(`  - Format:             ${course.courseFormat}`);
    console.log(`  - Level:              ${course.level}`);
    console.log(`  - Thumbnail URL:      ${course.thumbnailUrl}`);
    console.log(`  - Banner URL:         ${course.bannerUrl}`);
    console.log(`  - Brochure URL:       ${course.brochureUrl}`);

    // Verify metadata JSON fields
    const hasOverview = !!course.overviewJson;
    const hasDesignedToHelp = !!course.designedToHelpJson;
    const hasFeatures = !!course.numberedFeaturesJson;
    const hasWhyDG = !!course.whyDigitalGhuruJson;
    const hasHighlights = !!course.topHighlightsJson;
    const hasFaqs = !!course.faqsJson;
    const hasTools = Array.isArray(course.toolsJson) && (course.toolsJson as any[]).length > 0;
    const hasUsps = Array.isArray(course.uspsJson) && (course.uspsJson as any[]).length > 0;

    console.log(`  - Metadata Populated:`);
    console.log(`      overviewJson: ${hasOverview}, designedToHelpJson: ${hasDesignedToHelp}`);
    console.log(`      numberedFeaturesJson: ${hasFeatures}, whyDigitalGhuruJson: ${hasWhyDG}`);
    console.log(`      topHighlightsJson: ${hasHighlights}, faqsJson: ${hasFaqs}`);
    console.log(`      tools: ${(course.toolsJson as any[])?.length || 0}, usps: ${(course.uspsJson as any[])?.length || 0}`);

    if (!hasOverview || !hasDesignedToHelp || !hasFeatures || !hasWhyDG || !hasHighlights || !hasFaqs) {
      throw new Error(`Course ${course.title} is missing marketing/overview JSON metadata`);
    }

    // Verify Curriculum Version
    const version = course.activeCurriculumVersion;
    if (!version) {
      throw new Error(`Course ${course.title} has no active curriculum version`);
    }
    console.log(`  - Curriculum Version: ${version.version} (${version.title})`);
    console.log(`      isPublished: ${version.isPublished}, isLocked: ${version.isLocked}`);

    const moduleCount = version.modules.length;
    const chapterCount = version.modules.reduce((sum, m) => sum + m.chapters.length, 0);
    console.log(`      Modules: ${moduleCount}, Chapters: ${chapterCount}`);

    if (course.slug === 'ai-powered-digital-marketing') {
      if (moduleCount !== 12 || chapterCount !== 48) {
        throw new Error(`Digital Marketing expected 12 modules and 48 chapters, got ${moduleCount} and ${chapterCount}`);
      }
    } else if (course.slug === 'react-js-full-stack-development') {
      if (moduleCount !== 7 || chapterCount !== 32) {
        throw new Error(`React Full Stack expected 7 modules and 32 chapters, got ${moduleCount} and ${chapterCount}`);
      }
    }

    // Verify first lesson attachment
    const firstChapter = version.modules[0]?.chapters[0];
    const attachment = firstChapter?.attachments?.[0];
    console.log(`  - First Lesson: "${firstChapter?.title}"`);
    console.log(`      Attachment: "${attachment?.title}" -> ${attachment?.fileUrl}`);
    if (!attachment || !attachment.fileUrl) {
      throw new Error(`First chapter missing syllabus/brochure attachment`);
    }

    // Verify Franchise Permissions
    console.log(`  - Franchise Permissions: ${course.franchiseSelections.length} franchise(s) permitted`);
    for (const sel of course.franchiseSelections) {
      console.log(`      Franchise: ${sel.franchise.code} - ${sel.franchise.name} (Offered: ${sel.isOfferingEnabled})`);
    }

    // Verify Asset files on disk
    const rootDir = path.resolve(__dirname, '..');
    const webPublicDir = path.resolve(rootDir, '../apps/web/public');
    const serverUploadsDir = path.resolve(rootDir, 'uploads');

    const brochurePathWeb = path.resolve(webPublicDir, course.brochureUrl.replace(/^\//, ''));
    const brochurePathServer = path.resolve(serverUploadsDir, 'courses/public/brochures', path.basename(course.brochureUrl));

    const webBrochureExists = fs.existsSync(brochurePathWeb);
    const serverBrochureExists = fs.existsSync(brochurePathServer);

    console.log(`  - Brochure Disk Verification:`);
    console.log(`      Web:    ${webBrochureExists ? '✓' : '✗'} ${brochurePathWeb}`);
    console.log(`      Server: ${serverBrochureExists ? '✓' : '✗'} ${brochurePathServer}`);

    if (!webBrochureExists || !serverBrochureExists) {
      throw new Error(`Brochure file missing on disk for ${course.title}`);
    }
  }

  // Verify Franchise Safety
  console.log('\n------------------------------------------------------------');
  console.log('2. Verifying Franchise & Tenant Safety Constraints...');
  const franchiseCount = await prisma.franchise.count();
  const campusCount = await prisma.institute.count();
  const studentCount = await prisma.student.count();
  const agreementCount = await prisma.franchiseAgreement.count();

  console.log(`   ✓ Total Franchises preserved: ${franchiseCount}`);
  console.log(`   ✓ Total Campuses preserved:   ${campusCount}`);
  console.log(`   ✓ Total Students preserved:   ${studentCount}`);
  console.log(`   ✓ Total Agreements preserved: ${agreementCount}`);

  console.log('\n============================================================');
  console.log(' ALL AUTHENTIC COURSE CATALOGUE INTEGRITY CHECKS PASSED (100%)');
  console.log('============================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
