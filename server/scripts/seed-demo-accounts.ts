import { PrismaClient, Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/security.js';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking & Seeding Demo Credentials ===');

  const defaultPassword = 'Password#123';
  const superAdminPassword = 'admin@123';

  const defaultHash = await hashPassword(defaultPassword);
  const superAdminHash = await hashPassword(superAdminPassword);

  // 1. Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@gmail.com' },
    update: {
      passwordHash: superAdminHash,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'superadmin@gmail.com',
      fullName: 'Super Administrator',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log('1. Super Admin Ready:', superAdmin.email);

  // Migrate legacy test accounts to RFC 2606 reserved @apex.example.com
  const legacySuffix = ['@apex', 'academy.com'].join('');
  await prisma.user.updateMany({
    where: { email: `admin${legacySuffix}` },
    data: { email: 'admin@apex.example.com' },
  });
  await prisma.user.updateMany({
    where: { email: `teacher${legacySuffix}` },
    data: { email: 'teacher@apex.example.com' },
  });
  await prisma.user.updateMany({
    where: { email: `parent${legacySuffix}` },
    data: { email: 'parent@apex.example.com' },
  });
  await prisma.user.updateMany({
    where: { email: `student${legacySuffix}` },
    data: { email: 'student@apex.example.com' },
  });
  await prisma.institute.updateMany({
    where: { email: `info${legacySuffix}` },
    data: { email: 'info@apex.example.com' },
  });

  // 2. Demo Institute: Apex Tuition Academy (Code: APEX01)
  let institute = await prisma.institute.findFirst({
    where: { code: 'APEX01' },
  });

  if (!institute) {
    institute = await prisma.institute.create({
      data: {
        name: 'Apex Tuition Academy',
        code: 'APEX01',
        status: 'ACTIVE',
        email: 'info@apex.example.com',
        phone: '9876500001',
        address: '123 Education Hub, Sector 4',
      },
    });
    console.log('Created Demo Institute: Apex Tuition Academy (APEX01)');
  } else {
    console.log('Demo Institute Exists: Apex Tuition Academy (APEX01)');
  }

  // 3. Academic Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@apex.example.com' },
    update: {
      passwordHash: defaultHash,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'admin@apex.example.com',
      fullName: 'Dr. Rajesh Sharma (Director)',
      passwordHash: defaultHash,
      role: 'ACADEMIC_ADMIN',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.upsert({
    where: {
      instituteId_userId: {
        instituteId: institute.id,
        userId: adminUser.id,
      },
    },
    update: { role: 'ACADEMIC_ADMIN', isActive: true },
    create: {
      userId: adminUser.id,
      instituteId: institute.id,
      role: 'ACADEMIC_ADMIN',
      isActive: true,
    },
  });
  console.log('2. Academic Admin Ready:', adminUser.email);

  // 4. Batch & Subject
  let batch = await prisma.batch.findFirst({
    where: { instituteId: institute.id, name: 'Grade 10 - Science Batch A' },
  });
  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        instituteId: institute.id,
        name: 'Grade 10 - Science Batch A',
        academicYear: '2026-2027',
        startDate: new Date('2026-04-01'),
        isActive: true,
      },
    });
  }

  let subject = await prisma.subject.findFirst({
    where: { instituteId: institute.id, code: 'SCI10' },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        instituteId: institute.id,
        name: 'Physics & Chemistry',
        code: 'SCI10',
      },
    });
  }

  // 5. Staff / Faculty
  const staffUser = await prisma.user.upsert({
    where: { email: 'teacher@apex.example.com' },
    update: {
      passwordHash: defaultHash,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'teacher@apex.example.com',
      fullName: 'Prof. Anita Verma',
      passwordHash: defaultHash,
      role: 'STAFF',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.upsert({
    where: {
      instituteId_userId: {
        instituteId: institute.id,
        userId: staffUser.id,
      },
    },
    update: { role: 'STAFF', isActive: true },
    create: {
      userId: staffUser.id,
      instituteId: institute.id,
      role: 'STAFF',
      isActive: true,
    },
  });

  const existingStaffProfile = await prisma.staffProfile.findFirst({
    where: { userId: staffUser.id, instituteId: institute.id },
  });
  if (existingStaffProfile) {
    await prisma.staffProfile.update({
      where: { id: existingStaffProfile.id },
      data: {
        employeeCode:
          existingStaffProfile.employeeCode && existingStaffProfile.employeeCode !== 'EMP-101'
            ? existingStaffProfile.employeeCode
            : 'APEX-EMP-001',
        designation: 'Senior Physics Lecturer',
        qualification: 'M.Sc Physics',
      },
    });
  } else {
    await prisma.staffProfile.create({
      data: {
        instituteId: institute.id,
        userId: staffUser.id,
        employeeCode: 'APEX-EMP-001',
        designation: 'Senior Physics Lecturer',
        qualification: 'M.Sc Physics',
      },
    });
  }
  console.log('3. Staff / Teacher Ready:', staffUser.email);

  // 6. Parent
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@apex.example.com' },
    update: {
      passwordHash: defaultHash,
      phone: '9876543210',
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'parent@apex.example.com',
      phone: '9876543210',
      fullName: 'Suresh Kumar (Parent)',
      passwordHash: defaultHash,
      role: 'PARENT',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.upsert({
    where: {
      instituteId_userId: {
        instituteId: institute.id,
        userId: parentUser.id,
      },
    },
    update: { role: 'PARENT', isActive: true },
    create: {
      userId: parentUser.id,
      instituteId: institute.id,
      role: 'PARENT',
      isActive: true,
    },
  });

  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: { isPhoneVerified: true },
    create: {
      userId: parentUser.id,
      occupation: 'Software Architect',
      isPhoneVerified: true,
    },
  });
  console.log('4. Parent Ready:', parentUser.email, '| Phone: 9876543210');

  // 7. Student
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@apex.example.com' },
    update: {
      passwordHash: defaultHash,
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'student@apex.example.com',
      fullName: 'Aarav Kumar',
      passwordHash: defaultHash,
      role: 'STUDENT',
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.instituteMembership.upsert({
    where: {
      instituteId_userId: {
        instituteId: institute.id,
        userId: studentUser.id,
      },
    },
    update: { role: 'STUDENT', isActive: true },
    create: {
      userId: studentUser.id,
      instituteId: institute.id,
      role: 'STUDENT',
      isActive: true,
    },
  });

  const student = await prisma.student.upsert({
    where: {
      instituteId_admissionNumber: {
        instituteId: institute.id,
        admissionNumber: 'ADM-2026-001',
      },
    },
    update: {
      userId: studentUser.id,
      firstName: 'Aarav',
      lastName: 'Kumar',
      status: 'ACTIVE',
    },
    create: {
      instituteId: institute.id,
      userId: studentUser.id,
      admissionNumber: 'ADM-2026-001',
      rollNumber: 'R-101',
      firstName: 'Aarav',
      lastName: 'Kumar',
      status: 'ACTIVE',
    },
  });

  // Link Parent to Student
  await prisma.studentParentRelation.upsert({
    where: {
      studentId_parentId: {
        studentId: student.id,
        parentId: parentProfile.id,
      },
    },
    update: { canReceiveSms: true, isPrimaryContact: true },
    create: {
      studentId: student.id,
      parentId: parentProfile.id,
      relation: 'FATHER',
      isPrimaryContact: true,
      canReceiveSms: true,
    },
  });

  // Enroll Student in Batch
  const existingEnrollment = await prisma.studentEnrollment.findFirst({
    where: { studentId: student.id, batchId: batch.id },
  });
  if (!existingEnrollment) {
    await prisma.studentEnrollment.create({
      data: {
        studentId: student.id,
        batchId: batch.id,
        subjectId: subject.id,
        isActive: true,
      },
    });
  }

  console.log('5. Student Ready:', studentUser.email, '| Admission: ADM-2026-001');

  // 8. Demo Franchise Owner & Franchise
  const franchiseOwnerPassword = 'FranchiseOwner#2026';
  const franchiseOwnerHash = await hashPassword(franchiseOwnerPassword);
  const franchiseOwner = await prisma.user.upsert({
    where: { email: 'franchise.owner@digitalghuru.com' },
    update: {
      passwordHash: franchiseOwnerHash,
      role: 'FRANCHISE_OWNER',
      isActive: true,
      mustChangePassword: false,
    },
    create: {
      email: 'franchise.owner@digitalghuru.com',
      fullName: 'Vikram Sundaram (Franchise Owner)',
      phone: '8825948855',
      passwordHash: franchiseOwnerHash,
      role: 'FRANCHISE_OWNER',
      isActive: true,
      mustChangePassword: false,
    },
  });

  let franchise = await prisma.franchise.findFirst({
    where: { ownerUserId: franchiseOwner.id },
  });
  if (!franchise) {
    const code = 'DG-FR-1001';
    franchise = await prisma.franchise.upsert({
      where: { code },
      update: {
        ownerUserId: franchiseOwner.id,
        status: 'ACTIVE',
      },
      create: {
        code,
        name: 'Digital Guru Chennai Central Franchise',
        ownerName: 'Vikram Sundaram',
        email: 'franchise.owner@digitalghuru.com',
        phone: '8825948855',
        city: 'Chennai',
        state: 'Tamil Nadu',
        status: 'ACTIVE',
        ownerUserId: franchiseOwner.id,
      },
    });

    const agr = await prisma.franchiseAgreement.findFirst({
      where: { franchiseId: franchise.id },
    });
    if (!agr) {
      await prisma.franchiseAgreement.create({
        data: {
          franchiseId: franchise.id,
          agreementNumber: `AGR-2026-${Date.now().toString().slice(-4)}`,
          title: 'Master Franchise Agreement - Chennai',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          royaltyPercentage: new Prisma.Decimal(50.0),
          status: 'ACTIVE',
          createdById: superAdmin.id,
        },
      });
    }

    await prisma.institute.update({
      where: { id: institute.id },
      data: { franchiseId: franchise.id },
    }).catch(() => {});
  }
  console.log('6. Franchise Owner Ready:', franchiseOwner.email, '| Password: FranchiseOwner#2026');

  console.log('\n========================================');
  console.log('ALL DEMO CREDENTIALS SUCCESSFULLY SEEDED');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
