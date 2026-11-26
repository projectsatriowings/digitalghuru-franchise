import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../src/utils/security.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Synchronizing Super Admin and Demo Accounts in Neon DB...');

  const passwordAdmin = 'admin@123';
  const hashAdmin = await hashPassword(passwordAdmin);

  const password123 = 'Password#123';
  const hashPassword123 = await hashPassword(password123);

  const passwordOwner = 'FranchiseOwner#2026';
  const hashOwner = await hashPassword(passwordOwner);

  // 1. Super Admin: superadmin@gmail.com
  const superAdminGmail = await prisma.user.upsert({
    where: { email: 'superadmin@gmail.com' },
    create: {
      email: 'superadmin@gmail.com',
      fullName: 'Super Administrator',
      role: 'SUPER_ADMIN',
      passwordHash: hashAdmin,
      isActive: true,
      mustChangePassword: false,
    },
    update: {
      role: 'SUPER_ADMIN',
      passwordHash: hashAdmin,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log(`✓ Super Admin ready: ${superAdminGmail.email} (Password: ${passwordAdmin})`);

  // 2. Super Admin: superadmin@platform.local (in case any internal script references it)
  const superAdminLocal = await prisma.user.upsert({
    where: { email: 'superadmin@platform.local' },
    create: {
      email: 'superadmin@platform.local',
      fullName: 'Super Administrator',
      role: 'SUPER_ADMIN',
      passwordHash: hashAdmin,
      isActive: true,
      mustChangePassword: false,
    },
    update: {
      role: 'SUPER_ADMIN',
      passwordHash: hashAdmin,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log(`✓ Super Admin Local ready: ${superAdminLocal.email} (Password: ${passwordAdmin})`);

  // 3. Academic Admin: admin@apexacademy.com
  await prisma.user.upsert({
    where: { email: 'admin@apexacademy.com' },
    create: {
      email: 'admin@apexacademy.com',
      fullName: 'Apex Admin',
      role: 'ACADEMIC_ADMIN',
      passwordHash: hashPassword123,
      isActive: true,
      mustChangePassword: false,
    },
    update: {
      passwordHash: hashPassword123,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log(`✓ Academic Admin ready: admin@apexacademy.com (Password: ${password123})`);

  // 4. Franchise Owner: rajesh.owner@digitalghuru.example.com
  const owner = await prisma.user.findFirst({
    where: { email: 'rajesh.owner@digitalghuru.example.com' },
  });
  if (owner) {
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        passwordHash: hashOwner,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`✓ Franchise Owner ready: ${owner.email} (Password: ${passwordOwner})`);
  }

  // 5. Verification check
  const testSuper = await prisma.user.findUnique({ where: { email: 'superadmin@gmail.com' } });
  const verified = await verifyPassword(testSuper!.passwordHash, 'admin@123');
  console.log(`\n✅ Password verification for superadmin@gmail.com with 'admin@123': ${verified}`);
}

main()
  .catch((e) => {
    console.error('Error synchronizing accounts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
