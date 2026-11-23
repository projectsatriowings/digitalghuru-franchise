import { prisma } from '../src/prisma.js';

async function main() {
  const existing = await prisma.student.findFirst({
    where: { firstName: 'Pooja', lastName: 'Kumar' },
  });

  if (existing) {
    console.log('Pooja Kumar already exists:', existing.id);
    return;
  }

  // Create second child for Suresh Kumar to verify multi-child selection & switching
  const pooja = await prisma.student.create({
    data: {
      instituteId: 'fe91e4a2-8c89-44d9-8609-3509b6d577d3',
      admissionNumber: 'ADM-2026-002',
      firstName: 'Pooja',
      lastName: 'Kumar',
      gender: 'FEMALE',
      dob: new Date('2011-08-15'),
      admissionDate: new Date('2026-01-10'),
      status: 'ACTIVE',
      parentRelations: {
        create: {
          parentId: '673547f2-fdeb-4c51-bd76-c12534ed2a6b', // Suresh Kumar
          relation: 'FATHER',
          isPrimaryContact: true,
          canReceiveSms: true,
        },
      },
      enrollments: {
        create: {
          batchId: 'e9a2c729-884d-420c-92f8-2c5ed55d08f4', // Grade 10 - Science Batch A
          isActive: true,
        },
      },
    },
  });

  console.log('Created sibling Pooja Kumar:', pooja.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
