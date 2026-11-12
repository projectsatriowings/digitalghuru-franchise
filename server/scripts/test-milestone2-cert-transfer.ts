import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/security.js';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string, detail?: any) {
  if (cond) {
    console.log(`  ✓ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${msg}`);
    if (detail) console.error('    Detail:', detail);
    failed++;
  }
}

const BASE_URL = 'http://127.0.0.1:5000';

async function testCertAndTransfer() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: CERTIFICATE, TRANSFER & INTEGRITY TEST');
  console.log('================================================================\n');

  try {
    // 1. Resolve Course with Active Curriculum
    const course = await prisma.globalCourse.findFirst({
      where: { status: 'PUBLISHED', activeCurriculumVersionId: { not: null } },
      orderBy: { createdAt: 'desc' },
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
    assert(!!course && !!course.activeCurriculumVersion, '1. Found published course with active curriculum');

    // 2. Resolve Franchise Owner and Campus
    const franchiseOwner = await prisma.user.findFirst({
      where: {
        role: 'FRANCHISE_OWNER',
        ownedFranchises: {
          some: {
            branches: {
              some: {}
            }
          }
        }
      },
      include: {
        ownedFranchises: {
          include: { branches: true },
        },
      },
    });
    assert(!!franchiseOwner && franchiseOwner.ownedFranchises.length > 0, '2a. Franchise Owner found with registered franchise');
    const franchise = franchiseOwner!.ownedFranchises[0];
    const franchiseId = franchise.id;
    const branch = franchise.branches[0];

    const franchiseOwnerToken = generateAccessToken({
      userId: franchiseOwner!.id,
      email: franchiseOwner!.email || 'owner@test.local',
      role: 'FRANCHISE_OWNER',
      franchiseId,
    });

    // Resolve Student Actor under this branch campus
    let student = await prisma.student.findFirst({
      where: { instituteId: branch.id, status: 'ACTIVE', userId: { not: null } },
      include: { user: true, institute: true }
    });

    if (!student || !student.user) {
      student = await prisma.student.findFirst({
        where: { status: 'ACTIVE', userId: { not: null } },
        include: { user: true, institute: true },
      });
      if (student) {
        await prisma.student.update({
          where: { id: student.id },
          data: { instituteId: branch.id }
        });
        student.instituteId = branch.id;
      }
    }
    assert(!!student && !!student.user, '2b. Active student resolved with linked user login');

    const studentToken = generateAccessToken({
      userId: student!.user!.id,
      email: student!.user!.email || 'student@test.local',
      role: 'STUDENT',
    });

    // 3. Resolve or Create Active Initial Batch and Enrollment
    let initialBatch = await prisma.batch.findFirst({
      where: { instituteId: student!.instituteId!, isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    if (!initialBatch) {
      initialBatch = await prisma.batch.create({
        data: {
          name: 'Morning Batch Alpha',
          code: `BT-INIT-${Date.now()}`,
          instituteId: student!.instituteId!,
          academicYear: '2026-2027',
          startDate: new Date(),
          isActive: true,
        }
      });
    }

    // Ensure an ACTIVE enrollment exists for transfer testing
    let activeEnrollment = await prisma.courseEnrollment.findFirst({
      where: {
        studentId: student!.id,
        courseId: course!.id,
        status: 'ACTIVE'
      }
    });

    if (!activeEnrollment) {
      activeEnrollment = await prisma.courseEnrollment.create({
        data: {
          studentId: student!.id,
          courseId: course!.id,
          curriculumVersionId: course!.activeCurriculumVersionId!,
          franchiseId,
          instituteId: student!.instituteId,
          batchId: initialBatch.id,
          mode: 'OFFLINE',
          status: 'ACTIVE',
        }
      });
    }
    assert(!!activeEnrollment, '3. Active enrollment established for student');

    // 4. Test Enrollment Transfer Lifecycle (ACTIVE -> TRANSFERRED)
    console.log('\n--- 4. Testing Enrollment Transfer Lifecycle ---');
    let targetBatch = await prisma.batch.findFirst({
      where: {
        instituteId: student!.instituteId!,
        id: { not: activeEnrollment.batchId || undefined },
        isActive: true,
      }
    });

    if (!targetBatch) {
      targetBatch = await prisma.batch.create({
        data: {
          name: 'Evening Batch Beta (Transfer Target)',
          code: `BT-TRANS-${Date.now()}`,
          instituteId: student!.instituteId!,
          academicYear: '2026-2027',
          startDate: new Date(),
          isActive: true,
        }
      });
    }
    assert(!!targetBatch, '4a. Valid target batch prepared for transfer');

    const transferRes = await fetch(`${BASE_URL}/api/courses/enrollments/${activeEnrollment.id}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        targetBatchId: targetBatch.id,
        reason: 'Student requested transfer to evening batch',
      }),
    });
    const transferJson = await transferRes.json();
    assert(transferRes.status === 200 && transferJson.success, '4b. Enrollment transfer executed successfully', transferJson);
    assert(transferJson.data.status === 'ACTIVE' && transferJson.data.batchId === targetBatch.id, '4c. Transferred enrollment is ACTIVE with new batch');
    assert((transferJson.data.transferredFromEnrollmentId || transferJson.data.previousEnrollmentId) === activeEnrollment.id, '4d. Provenance preserved: transferredFromEnrollmentId points to original enrollment');

    const prevCheck = await prisma.courseEnrollment.findUnique({ where: { id: activeEnrollment.id } });
    assert(prevCheck?.status === 'TRANSFERRED', '4e. Source enrollment marked as TRANSFERRED (Audit trail intact)');

    // 5. Complete all curriculum chapters for 100% course completion
    console.log('\n--- 5. Completing Chapters & Earning XP on Active Enrollment ---');
    const allChapters = course!.activeCurriculumVersion!.modules.flatMap(m => m.chapters);
    for (const ch of allChapters) {
      await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ courseId: course!.id, chapterId: ch.id }),
      });
    }

    const playerRes = await fetch(`${BASE_URL}/api/courses/learning/${course!.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const playerJson = await playerRes.json();
    const currentProgress = playerJson.data.stats?.progressPercent ?? playerJson.data.course?.progressPercent ?? playerJson.data.progressPercent;
    assert(currentProgress === 100, `5a. Student achieved 100% curriculum progress (Progress: ${currentProgress}%)`);

    // 6. Claim Certificate
    console.log('\n--- 6. Claiming Course Certificate ---');
    const claimRes = await fetch(`${BASE_URL}/api/courses/certificates/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: course!.id }),
    });
    const claimJson = await claimRes.json();
    assert((claimRes.status === 200 || claimRes.status === 201) && claimJson.success, '6a. Certificate successfully generated and issued', claimJson);
    const certNum = claimJson.data.certificateNumber;
    assert(!!certNum && certNum.startsWith('DG-CERT-'), `6b. Certificate number follows standard pattern: ${certNum}`);

    // Replay certificate claim (Idempotent)
    const replayClaimRes = await fetch(`${BASE_URL}/api/courses/certificates/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId: course!.id }),
    });
    const replayClaimJson = await replayClaimRes.json();
    assert((replayClaimRes.status === 200 || replayClaimRes.status === 201) && replayClaimJson.data.certificateNumber === certNum, '6c. Replay certificate claim is idempotent (returns existing cert)');

    // 7. Public Certificate Verification (No auth required)
    console.log('\n--- 7. Public Certificate Verification ---');
    const verifyRes = await fetch(`${BASE_URL}/api/courses/certificates/verify/${certNum}`);
    const verifyJson = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyJson.success, '7a. Public certificate verification endpoint responded 200 OK');
    assert(verifyJson.data.isAuthentic === true, '7b. Cryptographic HMAC-SHA256 signature verification PASSED (isAuthentic = true)');
    assert(verifyJson.data.courseTitle === course!.title, '7c. Certificate reflects correct verified course title');

    // 8. DB Constraint: idx_course_enrollment_unique_active
    console.log('\n--- 8. Verifying DB Constraint: idx_course_enrollment_unique_active ---');
    let constraintViolated = false;
    try {
      // Find current active enrollment
      const currentActive = await prisma.courseEnrollment.findFirst({
        where: { studentId: student!.id, courseId: course!.id, status: 'ACTIVE' }
      });
      if (currentActive) {
        await prisma.courseEnrollment.create({
          data: {
            studentId: student!.id,
            courseId: course!.id,
            curriculumVersionId: course!.activeCurriculumVersionId!,
            franchiseId,
            instituteId: student!.instituteId,
            batchId: targetBatch.id,
            mode: currentActive.mode,
            status: 'ACTIVE', // Attempt duplicate ACTIVE enrollment
          }
        });
      } else {
        // Create one active and try a second active
        await prisma.courseEnrollment.create({
          data: {
            studentId: student!.id,
            courseId: course!.id,
            curriculumVersionId: course!.activeCurriculumVersionId!,
            franchiseId,
            mode: 'ONLINE',
            status: 'ACTIVE',
          }
        });
        await prisma.courseEnrollment.create({
          data: {
            studentId: student!.id,
            courseId: course!.id,
            curriculumVersionId: course!.activeCurriculumVersionId!,
            franchiseId,
            mode: 'ONLINE',
            status: 'ACTIVE',
          }
        });
      }
    } catch (err: any) {
      constraintViolated = true;
      assert(err.message.includes('idx_course_enrollment_unique_active') || err.message.includes('Unique constraint failed'), '8a. PostgreSQL blocked duplicate ACTIVE enrollment via partial unique index');
    }
    assert(constraintViolated, '8b. Database integrity enforced: at most 1 ACTIVE enrollment per student/course/mode');

    console.log('\n================================================================');
    console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test script failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCertAndTransfer();