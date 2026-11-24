import '../src/dns-preload.js';
import '../src/db-bridge.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/security.js';

const prisma = new PrismaClient();

const TABLES_TO_CLEAR = [
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
  'User',
];

async function main() {
  console.log('====================================================');
  console.log(' CLEARING ALL APPLICATION DATA EXCEPT DEMO LOGINS');
  console.log('====================================================\n');

  // Step 1: Truncate all non-catalog tables
  console.log('1. Truncating all operational, test, and transactional tables...');
  const quotedTables = TABLES_TO_CLEAR.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} CASCADE;`);
  console.log('   ✓ Truncate successful! All extraneous data removed.\n');

  // Step 2: Seed Demo Passwords
  console.log('2. Generating standard password hashes for demo accounts...');
  const defaultPassword = 'Password#123';
  const superAdminPassword = 'admin@123';
  const franchiseOwnerPassword = 'FranchiseOwner#2026';

  const defaultHash = await hashPassword(defaultPassword);
  const superAdminHash = await hashPassword(superAdminPassword);
  const franchiseOwnerHash = await hashPassword(franchiseOwnerPassword);
  console.log('   ✓ Hashes generated.\n');

  // Step 3: Seed Super Admin
  console.log('3. Seeding Super Admin demo account...');
  const superAdmin = await prisma.user.create({
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

  // Secondary Super Admin from .env (optional compatibility)
  await prisma.user.create({
    data: {
      email: 'superadmin@platform.local',
      fullName: 'Platform Administrator',
      phone: '9876543213',
      passwordHash: await hashPassword('AdminSecurePassword#2026'),
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log(`   ✓ Super Admin ready: ${superAdmin.email} | Pass: admin@123\n`);

  // Step 4: Seed Franchise Owner & Demo Franchise
  console.log('4. Seeding Franchise Owner & Demo Franchise...');
  // Primary (from Web Login.tsx)
  const franchiseOwner1 = await prisma.user.create({
    data: {
      email: 'rajesh.owner@digitalghuru.example.com',
      fullName: 'Rajesh Kumar (Franchise Owner)',
      phone: '9840123456',
      passwordHash: franchiseOwnerHash,
      role: 'FRANCHISE_OWNER',
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Secondary (from seed-demo-accounts.ts)
  const franchiseOwner2 = await prisma.user.create({
    data: {
      email: 'franchise.owner@digitalghuru.com',
      fullName: 'Vikram Sundaram (Franchise Owner)',
      phone: '8825948855',
      passwordHash: franchiseOwnerHash,
      role: 'FRANCHISE_OWNER',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const demoFranchise = await prisma.franchise.create({
    data: {
      code: 'DG-FR-1001',
      name: 'Digital Guru Chennai Central Franchise',
      ownerName: 'Rajesh Kumar',
      email: 'rajesh.owner@digitalghuru.example.com',
      phone: '9840123456',
      city: 'Chennai',
      state: 'Tamil Nadu',
      address: '12, 2nd Avenue, Anna Nagar, Chennai - 600040',
      status: 'ACTIVE',
      ownerUserId: franchiseOwner1.id,
      businessDetails: {
        gstin: '33AAAAA0000A1Z5',
        pan: 'ABCDE1234F',
        bankName: 'HDFC Bank',
        accountNumber: '5010099887766',
      },
    },
  });

  // Franchise Agreement
  await prisma.franchiseAgreement.create({
    data: {
      franchiseId: demoFranchise.id,
      agreementNumber: 'AGR-2026-0001',
      title: 'Master Franchise Agreement - Chennai',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2028-12-31'),
      royaltyPercentage: new Prisma.Decimal(50.0),
      royaltyBasis: 'TOTAL_COLLECTIONS',
      paymentFrequency: 'MONTHLY',
      dueDay: 10,
      status: 'ACTIVE',
      createdById: superAdmin.id,
    },
  });
  console.log(`   ✓ Franchise Owner ready: ${franchiseOwner1.email} | Pass: FranchiseOwner#2026`);
  console.log(`   ✓ Franchise ready: [${demoFranchise.code}] ${demoFranchise.name}\n`);

  // Step 5: Seed Demo Institute (Apex Tuition Academy)
  console.log('5. Seeding Demo Institute...');
  const demoInstitute = await prisma.institute.create({
    data: {
      code: 'APEX01',
      name: 'Apex Tuition Academy',
      email: 'info@apexacademy.com',
      phone: '9876500001',
      address: '123 Education Hub, Sector 4',
      status: 'ACTIVE',
      franchiseId: demoFranchise.id,
    },
  });
  console.log(`   ✓ Institute ready: [${demoInstitute.code}] ${demoInstitute.name}\n`);

  // Step 6: Seed Academic Admin (Branch Admin)
  console.log('6. Seeding Academic Admin...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@apexacademy.com',
      fullName: 'Dr. Rajesh Sharma (Director)',
      phone: '9876543211',
      passwordHash: defaultHash,
      role: 'ACADEMIC_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.create({
    data: {
      userId: adminUser.id,
      instituteId: demoInstitute.id,
      role: 'ACADEMIC_ADMIN',
      isActive: true,
    },
  });
  console.log(`   ✓ Academic Admin ready: ${adminUser.email} | Pass: Password#123\n`);

  // Step 7: Seed Batch & Subject
  console.log('7. Seeding Batch & Subject...');
  const batch = await prisma.batch.create({
    data: {
      instituteId: demoInstitute.id,
      name: 'Grade 10 - Science Batch A',
      academicYear: '2026-2027',
      startDate: new Date('2026-04-01'),
      isActive: true,
    },
  });

  const subject = await prisma.subject.create({
    data: {
      instituteId: demoInstitute.id,
      name: 'Physics & Chemistry',
      code: 'SCI10',
    },
  });

  await prisma.batchSubject.create({
    data: {
      batchId: batch.id,
      subjectId: subject.id,
    },
  });
  console.log(`   ✓ Batch ready: ${batch.name}`);
  console.log(`   ✓ Subject ready: [${subject.code}] ${subject.name}\n`);

  // Step 8: Seed Staff / Faculty (Teacher)
  console.log('8. Seeding Staff / Faculty...');
  const teacherUser = await prisma.user.create({
    data: {
      email: 'teacher@apexacademy.com',
      fullName: 'Prof. Anita Verma',
      phone: '9876543210',
      passwordHash: defaultHash,
      role: 'STAFF',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.create({
    data: {
      userId: teacherUser.id,
      instituteId: demoInstitute.id,
      role: 'STAFF',
      isActive: true,
    },
  });

  const staffProfile = await prisma.staffProfile.create({
    data: {
      instituteId: demoInstitute.id,
      userId: teacherUser.id,
      employeeCode: 'APEX-EMP-001',
      designation: 'Senior Physics Lecturer',
      qualification: 'M.Sc Physics',
    },
  });

  await prisma.staffBatchAssignment.create({
    data: {
      staffProfileId: staffProfile.id,
      batchId: batch.id,
    },
  });
  console.log(`   ✓ Teacher ready: ${teacherUser.email} | Pass: Password#123\n`);

  // Step 9: Seed Parent
  console.log('9. Seeding Parent...');
  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@apexacademy.com',
      phone: '9826444306',
      fullName: 'Vikram Mehta (Parent)',
      passwordHash: defaultHash,
      role: 'PARENT',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.create({
    data: {
      userId: parentUser.id,
      instituteId: demoInstitute.id,
      role: 'PARENT',
      isActive: true,
    },
  });

  const parentProfile = await prisma.parentProfile.create({
    data: {
      userId: parentUser.id,
      occupation: 'Software Architect',
      isPhoneVerified: true,
    },
  });
  console.log(`   ✓ Parent ready: ${parentUser.email} (Phone: 9826444306) | Pass: Password#123\n`);

  // Step 10: Seed Student
  console.log('10. Seeding Student...');
  const studentUser = await prisma.user.create({
    data: {
      email: 'student@apexacademy.com',
      phone: '9826444307',
      fullName: 'Aarav Mehta',
      passwordHash: defaultHash,
      role: 'STUDENT',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.create({
    data: {
      userId: studentUser.id,
      instituteId: demoInstitute.id,
      role: 'STUDENT',
      isActive: true,
    },
  });

  const student = await prisma.student.create({
    data: {
      instituteId: demoInstitute.id,
      userId: studentUser.id,
      admissionNumber: 'ADM-2026-001',
      rollNumber: 'R-101',
      firstName: 'Aarav',
      lastName: 'Mehta',
      status: 'ACTIVE',
    },
  });

  // Link Parent to Student
  await prisma.studentParentRelation.create({
    data: {
      studentId: student.id,
      parentId: parentProfile.id,
      relation: 'FATHER',
      isPrimaryContact: true,
      canReceiveSms: true,
    },
  });

  // Enroll Student in Batch & Subject
  await prisma.studentEnrollment.create({
    data: {
      studentId: student.id,
      batchId: batch.id,
      subjectId: subject.id,
      isActive: true,
    },
  });
  console.log(`   ✓ Student ready: ${studentUser.email} (Admission: ADM-2026-001) | Pass: Password#123\n`);

  // Step 11: Seed Demo Learning Material (so materials tab has clean demo data)
  console.log('11. Seeding Demo Learning Material...');
  await prisma.learningMaterial.create({
    data: {
      instituteId: demoInstitute.id,
      batchId: batch.id,
      subjectId: subject.id,
      title: 'Chapter 1: Mechanics & Newton Laws of Motion',
      description: 'Comprehensive study material and formula sheet for Grade 10 Science.',
      fileUrl: '/materials/mechanics_ch1.pdf',
      fileName: 'mechanics_ch1.pdf',
      type: 'PDF',
      fileSize: 1048576,
      uploaderId: teacherUser.id,
    },
  });
  console.log('   ✓ Demo Learning Material added.\n');

  // Step 12: Final Verification
  console.log('====================================================');
  console.log(' DATABASE CLEANUP & DEMO VERIFICATION');
  console.log('====================================================');
  const userCount = await prisma.user.count();
  const franchiseCount = await prisma.franchise.count();
  const instituteCount = await prisma.institute.count();
  const studentCount = await prisma.student.count();
  const staffCount = await prisma.staffProfile.count();
  const parentCount = await prisma.parentProfile.count();
  const batchCount = await prisma.batch.count();
  const subjectCount = await prisma.subject.count();
  const paymentCount = await prisma.payment.count();
  const auditLogCount = await prisma.auditLog.count();
  const globalCourseCount = await prisma.globalCourse.count();

  console.log(`Users in DB:            ${userCount} (Only demo accounts)`);
  console.log(`Franchises in DB:       ${franchiseCount}`);
  console.log(`Institutes in DB:       ${instituteCount}`);
  console.log(`Students in DB:         ${studentCount}`);
  console.log(`Staff Profiles in DB:   ${staffCount}`);
  console.log(`Parent Profiles in DB:  ${parentCount}`);
  console.log(`Batches in DB:          ${batchCount}`);
  console.log(`Subjects in DB:         ${subjectCount}`);
  console.log(`Payments in DB:         ${paymentCount}`);
  console.log(`Audit Logs in DB:       ${auditLogCount}`);
  console.log(`Global Courses in DB:   ${globalCourseCount} (Master catalog preserved)`);
  console.log('====================================================');
  console.log(' ALL DATA CLEARED EXCEPT DEMO LOGINS SUCCESSFULLY!');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('[Error] Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
