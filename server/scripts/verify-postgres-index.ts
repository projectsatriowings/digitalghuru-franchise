import { prisma } from '../src/prisma';

async function main() {
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Institute'
      AND indexname = 'Institute_email_normalized_unique_idx';
  `);

  console.log('PG_INDEXES QUERY RESULT:');
  console.log(JSON.stringify(rows, null, 2));

  if (rows.length === 0) {
    throw new Error('Index "Institute_email_normalized_unique_idx" was NOT found in pg_indexes!');
  }

  const def = rows[0].indexdef;
  console.log('\nACTUAL INDEXDEF:');
  console.log(def);

  // Validate properties
  const isUnique = def.startsWith('CREATE UNIQUE INDEX');
  const hasFunctionalExpr = def.includes('lower(TRIM(BOTH FROM email))') || def.includes('lower(btrim(email))') || def.includes('LOWER(TRIM(email))') || def.includes('lower(trim(email))');
  const hasPredicate = def.includes('email IS NOT NULL') && (def.includes("TRIM(BOTH FROM email) <> ''::text") || def.includes("email <> ''") || def.includes("btrim(email) <> ''"));

  console.log('\nINDEX PROPERTIES CHECK:');
  console.log(`- Is Unique Index: ${isUnique}`);
  console.log(`- Has Functional Expression (LOWER/TRIM): ${hasFunctionalExpr}`);
  console.log(`- Has Filter Predicate (WHERE email IS NOT NULL AND ...): ${hasPredicate}`);

  if (!isUnique || !hasFunctionalExpr) {
    throw new Error('Index does not match required functional unique specifications!');
  }

  console.log('\n[CONFIRMED] PostgreSQL Functional Unique Index is Active and Enforcing Uniqueness!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
