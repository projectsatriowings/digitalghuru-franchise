import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/security.js';

const prisma = new PrismaClient();

async function main() {
  const teacherUser = await prisma.user.findFirst({
    where: { email: 'teacher@apex.example.com' },
    include: { staffProfile: true },
  });

  if (!teacherUser) {
    console.error('Teacher user not found');
    return;
  }

  // Ensure password is Password#123
  const hash = await hashPassword('Password#123');
  await prisma.user.update({
    where: { id: teacherUser.id },
    data: { passwordHash: hash },
  });
  console.log('Teacher password reset to Password#123');

  // Find Apex Science Batch A
  const batch = await prisma.batch.findFirst({
    where: { name: 'Grade 10 - Science Batch A' },
    include: { batchSubjects: { include: { subject: true } } },
  });

  if (batch && teacherUser.staffProfile) {
    // Assign teacher to batch if not already assigned
    const existingAssignment = await prisma.staffBatchAssignment.findFirst({
      where: {
        staffProfileId: teacherUser.staffProfile.id,
        batchId: batch.id,
      },
    });

    if (!existingAssignment) {
      await prisma.staffBatchAssignment.create({
        data: {
          staffProfileId: teacherUser.staffProfile.id,
          batchId: batch.id,
        },
      });
      console.log('Assigned teacher to batch:', batch.name);
    } else {
      console.log('Teacher already assigned to batch:', batch.name);
    }

    // Assign teacher to batch subject (e.g. Science or Physics)
    for (const bs of batch.batchSubjects) {
      await prisma.batchSubject.update({
        where: { id: bs.id },
        data: { staffProfileId: teacherUser.staffProfile.id },
      });
      console.log(`Assigned teacher to batch subject: ${bs.subject.name}`);
    }
  }

  console.log('Teacher setup verified.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
