import '../src/dns-preload.js';
import '../src/db-bridge.js';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/security.js';

const prisma = new PrismaClient();

const OPERATIONAL_TABLES = [
  'AttendanceEvent',
  'StaffAttendanceEvent',
  'StaffAttendanceSession',
  'StaffWFHAuthorization',
  'WFHAuthorizationStaff',
  'StaffOnlineClassLog',
  'SmsNotification',
  'Notification',
  'InAppNotification',
  'DevicePushToken',
  'Examination',
  'ExamMark',
  'HomeworkSubmission',
  'ProgressFeedback',
  'ParentReview',
  'ParentFeedback',
  'Message',
  'ConversationMember',
  'Conversation',
  'PaymentAdjustment',
  'OnlinePaymentOrder',
  'Payment',
  'StudentFeeAssignment',
  'FeeStructure',
  'QuizAnswer',
  'QuizAttempt',
  'QuizOption',
  'QuizQuestion',
  'Quiz',
  'ManualBankTransfer',
  'SettlementAdjustment',
  'SettlementTransfer',
  'FranchiseSettlement',
  'FranchiseRoyaltyPayment',
  'FranchiseRoyaltyInstallment',
  'FranchiseRoyaltyRecord',
  'FranchiseAgreement',
  'CourseCertificate',
  'StudentXpLedger',
  'StudentLessonProgress',
  'CourseEnrollment',
  'FranchiseCourseSelection',
  'MaterialInteraction',
  'LearningMaterial',
  'StaffDocument',
  'StaffExperience',
  'StaffQualification',
  'StaffBatchAssignment',
  'StudentEnrollment',
  'StudentParentRelation',
  'BatchSubject',
  'Batch',
  'Subject',
  'Student',
  'ParentProfile',
  'StaffProfile',
  'InstituteMembership',
  'PasswordResetToken',
  'AuditLog',
  'AdmissionSequence',
  'Institute',
  'Franchise',
];

async function main() {
  console.log('====================================================');
  console.log(' PURGING ALL SAMPLE DATA - RETAINING ONLY SUPER ADMIN');
  console.log('====================================================\n');

  // Step 1: Truncate operational and relational tenant tables
  console.log('1. Truncating operational and tenant tables...');
  const quotedTables = OPERATIONAL_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} CASCADE;`);
  console.log('   ✓ Truncate successful! All operational and sample data removed.\n');

  // Step 2: Delete all non-SUPER_ADMIN users
  console.log('2. Deleting all non-SUPER_ADMIN users from User table...');
  const deleteResult = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'SUPER_ADMIN',
      },
    },
  });
  console.log(`   ✓ Deleted ${deleteResult.count} sample user(s).\n`);

  // Step 3: Ensure Super Admin accounts exist and are active
  console.log('3. Verifying and configuring Super Admin accounts...');
  const superAdminPassword = 'admin@123';
  const superAdminHash = await hashPassword(superAdminPassword);

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: 'superadmin@gmail.com' },
  });

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        role: 'SUPER_ADMIN',
        passwordHash: superAdminHash,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('   ✓ Updated existing superadmin@gmail.com with active status and password (admin@123)');
  } else {
    await prisma.user.create({
      data: {
        email: 'superadmin@gmail.com',
        fullName: 'Super Administrator',
        phone: '9876543212',
        passwordHash: superAdminHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('   ✓ Created superadmin@gmail.com with active status and password (admin@123)');
  }

  // Ensure secondary superadmin account
  const secondaryHash = await hashPassword('AdminSecurePassword#2026');
  const existingSecondary = await prisma.user.findFirst({
    where: { email: 'superadmin@platform.local' },
  });

  if (existingSecondary) {
    await prisma.user.update({
      where: { id: existingSecondary.id },
      data: {
        role: 'SUPER_ADMIN',
        passwordHash: secondaryHash,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('   ✓ Verified superadmin@platform.local');
  } else {
    await prisma.user.create({
      data: {
        email: 'superadmin@platform.local',
        fullName: 'Platform Administrator',
        phone: '9876543213',
        passwordHash: secondaryHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log('   ✓ Created superadmin@platform.local');
  }

  // Step 4: Summary of database state
  const remainingUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  const franchiseCount = await prisma.franchise.count();
  const instituteCount = await prisma.institute.count();
  const courseCount = await prisma.globalCourse.count();

  console.log('\n====================================================');
  console.log(' CURRENT DATABASE STATUS:');
  console.log(' Remaining Users:');
  remainingUsers.forEach((u) => {
    console.log(`   - [${u.role}] ${u.email} (${u.fullName}) | Active: ${u.isActive}`);
  });
  console.log(` Franchises: ${franchiseCount}`);
  console.log(` Institutes: ${instituteCount}`);
  console.log(` Global Catalog Courses: ${courseCount}`);
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('Purge error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
