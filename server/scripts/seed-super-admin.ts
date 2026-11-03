import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/security.js';
import { config } from '../src/config/index.js';

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  console.log('--- Initial Super Admin Provisioning ---');
  const email = config.superAdmin.email;
  const password = config.superAdmin.defaultPassword;
  const name = config.superAdmin.name;

  if (!email || !password) {
    console.error('[Error] SUPER_ADMIN_EMAIL or SUPER_ADMIN_DEFAULT_PASSWORD is not set.');
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { role: 'SUPER_ADMIN' }],
    },
  });

  if (existing) {
    console.log(`[Info] Super Admin already exists: ${existing.email} (ID: ${existing.id})`);
    return;
  }

  const passwordHash = await hashPassword(password);

  const superAdmin = await prisma.user.create({
    data: {
      email,
      fullName: name,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: true, // Forces password change on initial login for security
    },
  });

  console.log(`[Success] Super Admin created successfully.`);
  console.log(` -> ID: ${superAdmin.id}`);
  console.log(` -> Email: ${superAdmin.email}`);
  console.log(` -> Role: ${superAdmin.role}`);
  console.log(` -> Must Change Password: ${superAdmin.mustChangePassword}`);
}

seedSuperAdmin()
  .catch((err) => {
    console.error('[Error] Failed to seed Super Admin:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
