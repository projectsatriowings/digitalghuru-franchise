/**
 * TEST DATABASE SAFETY GUARD (PHASE 1.1.2)
 * 
 * Enforces strict operational restriction: Tests must never execute against or mutate
 * the dedicated Digital Guru Franchise live production Neon database (neither directly nor via TCP bridges).
 */

export interface VerifiedTestDbIdentity {
  host: string;
  database: string;
  isIsolatedTestDb: boolean;
}

export function assertSafeTestDatabase(): VerifiedTestDbIdentity {
  // Database tests STRICTLY require an explicit TEST_DATABASE_URL.
  // Never silently fall back to DATABASE_URL if it points to production or the local Neon TCP bridge.
  const testDbUrl = process.env.TEST_DATABASE_URL;

  if (!testDbUrl || !testDbUrl.trim()) {
    throw new Error(
      `\n====================================================================\n` +
      ` [CRITICAL SAFETY GUARD VIOLATION PREVENTED]\n` +
      ` Refusing to execute test suite: No explicit TEST_DATABASE_URL configured.\n` +
      `\n` +
      ` Operational Restriction: Tests must never execute against the live Neon database.\n` +
      ` Configure TEST_DATABASE_URL pointing to an isolated local or disposable test database.\n` +
      ` Example:\n` +
      `   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dg_test"\n` +
      `====================================================================\n`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(testDbUrl);
  } catch (err: any) {
    throw new Error(`[CRITICAL DATABASE SAFETY GUARD]: Malformed TEST_DATABASE_URL: ${err.message}`);
  }

  const rawUrl = testDbUrl.toLowerCase();
  const hostname = (parsed.hostname || '').toLowerCase();
  const port = parsed.port || '';
  const pathname = (parsed.pathname || '').toLowerCase();
  const optionsParam = (parsed.searchParams.get('options') || '').toLowerCase();

  // Strict check: Positively REJECT any production Neon host or identifier,
  // including the local TCP bridge (127.0.0.1:5433 / endpoint=ep-...)
  const isProductionNeon =
    hostname.includes('neon.tech') ||
    hostname.includes('ep-') ||
    hostname.includes('aws.neon') ||
    optionsParam.includes('endpoint=ep-') ||
    optionsParam.includes('ep-nameless-hat') ||
    rawUrl.includes('ep-nameless-hat') ||
    rawUrl.includes('3.14.138.241') ||
    (hostname === '127.0.0.1' && port === '5433'); // Local Neon TCP Bridge port

  if (isProductionNeon) {
    throw new Error(
      `\n====================================================================\n` +
      ` [CRITICAL SAFETY GUARD REJECTION]\n` +
      ` Target database is identified as the LIVE PRODUCTION NEON DATABASE!\n` +
      ` Host: ${hostname}:${port} (Neon endpoint / bridge detected)\n` +
      ` Tests must NEVER run against production databases.\n` +
      `====================================================================\n`
    );
  }

  // Strict check: Positively REJECT any Tuition Management database
  const isTuitionDb =
    rawUrl.includes('tuition') ||
    pathname.includes('tuition') ||
    rawUrl.includes('tuition_management') ||
    pathname.includes('tuition_management');

  if (isTuitionDb) {
    throw new Error(
      `\n====================================================================\n` +
      ` [CRITICAL SAFETY GUARD REJECTION]\n` +
      ` Target database is identified as the TUITION MANAGEMENT DATABASE!\n` +
      ` Database: ${pathname}\n` +
      ` Tests must NEVER run against or mutate Tuition Management databases.\n` +
      `====================================================================\n`
    );
  }

  const isLocalOrTestHost =
    hostname === 'localhost' ||
    (hostname === '127.0.0.1' && port !== '5433') ||
    hostname === 'host.docker.internal' ||
    hostname.endsWith('.test');

  const isTestDbName = pathname.includes('test') || pathname.includes('scratch') || pathname.includes('isolated');

  if (!isLocalOrTestHost && !isTestDbName) {
    throw new Error(
      `[CRITICAL DATABASE SAFETY GUARD]: Database "${hostname}:${port}${pathname}" cannot be positively identified as an isolated test database. ` +
      `Refusing to proceed. Ensure TEST_DATABASE_URL points to a local or test-named database.`
    );
  }

  console.log('------------------------------------------------------------');
  console.log('[Database Safety Guard] Verified SAFE isolated test database:');
  console.log(`  Host:     ${hostname}:${port}`);
  console.log(`  Database: ${pathname}`);
  console.log('------------------------------------------------------------');

  return {
    host: `${hostname}:${port}`,
    database: pathname,
    isIsolatedTestDb: true,
  };
}
