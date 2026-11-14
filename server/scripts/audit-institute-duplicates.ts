import { prisma } from '../src/prisma.js';

async function auditInstitutes() {
  console.log('Auditing existing institutes for duplicate emails...');
  const institutes = await prisma.institute.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      franchiseId: true,
    },
  });

  console.log(`Total institutes found: ${institutes.length}`);

  const emailMap = new Map<string, typeof institutes>();
  const phoneMap = new Map<string, typeof institutes>();
  const nameMap = new Map<string, typeof institutes>();

  for (const inst of institutes) {
    if (inst.email && inst.email.trim()) {
      const normEmail = inst.email.trim().toLowerCase();
      const existing = emailMap.get(normEmail) || [];
      existing.push(inst);
      emailMap.set(normEmail, existing);
    }

    if (inst.phone && inst.phone.trim()) {
      const normPhone = inst.phone.replace(/[\s\-\(\)\+]/g, '');
      const existing = phoneMap.get(normPhone) || [];
      existing.push(inst);
      phoneMap.set(normPhone, existing);
    }

    const normName = inst.name.trim().toLowerCase();
    const existing = nameMap.get(normName) || [];
    existing.push(inst);
    nameMap.set(normName, existing);
  }

  const duplicateEmails = Array.from(emailMap.entries()).filter(([_, list]) => list.length > 1);
  const duplicatePhones = Array.from(phoneMap.entries()).filter(([_, list]) => list.length > 1);
  const duplicateNames = Array.from(nameMap.entries()).filter(([_, list]) => list.length > 1);

  console.log(`\n=== DUPLICATE NORMALIZED EMAILS AUDIT ===`);
  if (duplicateEmails.length === 0) {
    console.log('No duplicate normalized institute emails found! Safe to apply unique index.');
  } else {
    console.log(`Found ${duplicateEmails.length} conflicting email group(s):`);
    for (const [email, list] of duplicateEmails) {
      console.log(`- Email "${email}" is used by ${list.length} institutes:`);
      for (const inst of list) {
        console.log(`  * ID: ${inst.id}, Code: ${inst.code}, Name: "${inst.name}", Raw Email: "${inst.email}"`);
      }
    }
  }

  console.log(`\n=== DUPLICATE PHONES AUDIT (Informational) ===`);
  if (duplicatePhones.length === 0) {
    console.log('No duplicate phone numbers found.');
  } else {
    console.log(`Found ${duplicatePhones.length} phone number(s) shared across institutes:`);
    for (const [phone, list] of duplicatePhones) {
      console.log(`- Phone "${phone}":`);
      for (const inst of list) {
        console.log(`  * ID: ${inst.id}, Code: ${inst.code}, Name: "${inst.name}", Raw Phone: "${inst.phone}"`);
      }
    }
  }

  console.log(`\n=== DUPLICATE NAMES AUDIT (Informational) ===`);
  if (duplicateNames.length === 0) {
    console.log('No duplicate institute names found.');
  } else {
    console.log(`Found ${duplicateNames.length} institute name(s) shared:`);
    for (const [name, list] of duplicateNames) {
      console.log(`- Name "${name}":`);
      for (const inst of list) {
        console.log(`  * ID: ${inst.id}, Code: ${inst.code}, City: "${inst.city}", Franchise: ${inst.franchiseId || 'None (Standalone)'}`);
      }
    }
  }

  await prisma.$disconnect();
}

auditInstitutes().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

