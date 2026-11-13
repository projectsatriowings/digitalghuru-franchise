import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string, extra?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${desc}`);
    if (extra) console.error('    Detail:', extra);
    failed++;
  }
}

console.log('========================================================================');
console.log(' DATABASE SAFETY GUARD REJECTION UNIT TEST SUITE');
console.log('========================================================================\n');

// 1. Missing / Empty TEST_DATABASE_URL
let t1Passed = false;
try {
  assertSafeTestDatabase('');
} catch (err: any) {
  t1Passed = err.message.includes('No explicit TEST_DATABASE_URL configured');
}
assert(t1Passed, '1. Rejection: Missing or empty TEST_DATABASE_URL');

// 2. Remote non-Neon production host with test database name
let t2Passed = false;
try {
  assertSafeTestDatabase('postgresql://postgres:password@postgres.production.company.com:5432/dg_test_isolated');
} catch (err: any) {
  t2Passed = err.message.includes('violates safety requirements') && err.message.includes('recognized local/test host');
}
assert(t2Passed, '2. Rejection: Remote host with test database name (postgres.production.company.com/dg_test_isolated)');

// 3. Remote IP host with scratch database name
let t3Passed = false;
try {
  assertSafeTestDatabase('postgresql://admin:secret@198.51.100.45:5432/company_scratch');
} catch (err: any) {
  t3Passed = err.message.includes('violates safety requirements') && err.message.includes('recognized local/test host');
}
assert(t3Passed, '3. Rejection: Remote IP host with scratch database name (198.51.100.45/company_scratch)');

// 4. Local host with production-like database name
let t4Passed = false;
try {
  assertSafeTestDatabase('postgresql://postgres:password@localhost:5432/digitalghuru_production');
} catch (err: any) {
  t4Passed = err.message.includes('violates safety requirements') && err.message.includes('approved test identifier');
}
assert(t4Passed, '4. Rejection: Local host with production-like database name (localhost:5432/digitalghuru_production)');

// 5. Live Production Neon URL
let t5Passed = false;
try {
  assertSafeTestDatabase('postgresql://neondb_owner:npg_123456@ep-nameless-hat-a4s5b9.us-east-2.aws.neon.tech/neondb');
} catch (err: any) {
  t5Passed = err.message.includes('LIVE PRODUCTION NEON DATABASE');
}
assert(t5Passed, '5. Rejection: Live production Neon URL (ep-nameless-hat.us-east-2.aws.neon.tech/neondb)');

// 6. Local Neon TCP Bridge (port 5433)
let t6Passed = false;
try {
  assertSafeTestDatabase('postgresql://postgres:password@127.0.0.1:5433/neondb');
} catch (err: any) {
  t6Passed = err.message.includes('LIVE PRODUCTION NEON DATABASE');
}
assert(t6Passed, '6. Rejection: Local Neon TCP Bridge on port 5433 (127.0.0.1:5433/neondb)');

// 7. Tuition Management Database
let t7Passed = false;
try {
  assertSafeTestDatabase('postgresql://postgres:password@localhost:5432/tuition_management');
} catch (err: any) {
  t7Passed = err.message.includes('TUITION MANAGEMENT DATABASE');
}
assert(t7Passed, '7. Rejection: Tuition Management database target (localhost:5432/tuition_management)');

// 8. Positive Acceptance: localhost:5432/dg_test_isolated
let t8Passed = false;
try {
  const verified = assertSafeTestDatabase('postgresql://postgres:password@localhost:5432/dg_test_isolated');
  t8Passed = verified.isIsolatedTestDb && verified.database === '/dg_test_isolated' && verified.host === 'localhost:5432';
} catch (err: any) {
  console.error('Acceptance failed:', err.message);
}
assert(t8Passed, '8. Acceptance: Valid isolated test database (localhost:5432/dg_test_isolated)');

console.log('\n========================================================================');
console.log(` GUARD TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('========================================================================\n');

if (failed > 0) process.exit(1);
