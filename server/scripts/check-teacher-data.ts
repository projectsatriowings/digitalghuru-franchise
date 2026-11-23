import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.user.findMany({
    where: { role: 'STAFF' },
    include: {
      staffProfile: {
        include: {
          assignments: { include: { batch: true } },
          institute: true,
        },
      },
      memberships: { include: { institute: true } },
    },
  });

  // Check Apex batches and batch subjects
  const apexBatches = await prisma.batch.findMany({
    include: {
      batchSubjects: {
        include: {
          subject: true,
          staffProfile: { include: { user: true } },
        },
      },
      staffAssignments: {
        include: {
          staffProfile: { include: { user: true } },
        },
      },
      enrollments: {
        where: { isActive: true },
        include: { student: true },
      },
    },
  });

  console.log('\n--- Batches in System ---');
  for (const b of apexBatches) {
    console.log({
      id: b.id,
      name: b.name,
      instituteId: b.instituteId,
      studentsCount: b.enrollments.length,
      staffAssignments: b.staffAssignments.map((sa) => sa.staffProfile?.user?.fullName),
      subjects: b.batchSubjects.map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subject.name,
        teacher: s.staffProfile?.user?.fullName || 'None',
        staffProfileId: s.staffProfileId,
      })),
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
