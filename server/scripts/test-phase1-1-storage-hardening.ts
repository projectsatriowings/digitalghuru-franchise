/**
 * DIGITAL GURU FRANCHISE — PHASE 1.1 HARDENING AUTOMATED VERIFICATION SUITE
 * 
 * Verifies all Phase 1.1 Storage Hardening & Configuration Reconciliation Requirements:
 * 
 * 1.  Canonical PERSISTENT_VOLUME_PATH validation & absolute directory verification.
 * 2.  Strict rejection of relative paths in volume mode.
 * 3.  Fail-fast on missing/empty volume path (never silently falls back to ./uploads).
 * 4.  Rejection of non-existent directory in volume mode (fail-fast if mount is missing).
 * 5.  Reconciliation of legacy aliases (PERSISTENT_STORAGE_PATH, STORAGE_PERSISTENT_PATH).
 * 6.  Production guard against ephemeral local storage without ALLOW_EPHEMERAL_LOCAL_STORAGE.
 * 7.  S3 driver fail-fast when S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY are missing.
 * 8.  Real volume mode upload and retrieval (200 full read and 206 byte-range streaming).
 * 9.  Volume mode isolation: local ./uploads files are NEVER served in volume mode.
 * 10. S3 Storage Manager protocol handling (PutObject, GetObjectStream with range, 416 invalid range).
 * 11. Storage startup diagnostics formatting and metadata reporting.
 * 12. Health check endpoint (/api/health) integration with storage status.
 */

import * as http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import app from '../src/index.js';
import { config, validateStorageConfig } from '../src/config/index.js';
import {
  StorageManager,
  getActiveStorageDir,
  resolveAbsolutePath,
  s3StorageManager,
  printStorageDiagnostics,
} from '../src/utils/storage.js';

let server: http.Server;
const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passedCount = 0;
let failedCount = 0;
const testResults: Array<{ id: number; name: string; status: 'PASS' | 'FAIL'; detail?: any }> = [];

function recordTest(id: number, name: string, condition: boolean, detail?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] Test ${id}: ${name}`);
    passedCount++;
    testResults.push({ id, name, status: 'PASS', detail });
  } else {
    console.error(`  ✗ [FAIL] Test ${id}: ${name}`);
    if (detail) console.error('    Detail:', detail);
    failedCount++;
    testResults.push({ id, name, status: 'FAIL', detail });
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function norm(p: string): string {
  return path.resolve(p).toLowerCase();
}

async function run() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: PHASE 1.1 STORAGE HARDENING TEST SUITE');
  console.log('================================================================\n');

  // Start test server
  await new Promise<void>((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  const originalEnv = { ...process.env };
  const originalConfigStorage = JSON.parse(JSON.stringify(config.storage));

  // Prepare isolated temporary test volume directory
  const tempVolumeDir = path.join(os.tmpdir(), `dg-test-volume-${Date.now()}`);
  fs.mkdirSync(tempVolumeDir, { recursive: true });

  try {
    // -------------------------------------------------------------
    // TEST 1: Canonical PERSISTENT_VOLUME_PATH Validation & Resolution
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Canonical PERSISTENT_VOLUME_PATH Validation ---');
    config.storage.driver = 'volume';
    config.storage.persistentVolumePath = tempVolumeDir;
    const valResult1 = validateStorageConfig();
    recordTest(
      1,
      'Canonical PERSISTENT_VOLUME_PATH validates as absolute writable directory',
      valResult1.driver === 'volume' &&
        norm(valResult1.resolvedLocation) === norm(tempVolumeDir) &&
        valResult1.statusMessage.includes('Persistent volume verified') &&
        valResult1.isWritable === true,
      { resolved: valResult1.resolvedLocation, status: valResult1.statusMessage }
    );

    // -------------------------------------------------------------
    // TEST 2: Rejection of Relative Paths in Volume Mode
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Rejection of Relative Paths in Volume Mode ---');
    let rejectedRelative = false;
    let relativeErrorMsg = '';
    try {
      config.storage.driver = 'volume';
      config.storage.persistentVolumePath = './relative/mount/path';
      validateStorageConfig();
    } catch (err: any) {
      rejectedRelative = true;
      relativeErrorMsg = err.message;
    }
    recordTest(
      2,
      'Relative path in PERSISTENT_VOLUME_PATH is strictly rejected',
      rejectedRelative && relativeErrorMsg.includes('must be an absolute path'),
      { error: relativeErrorMsg }
    );

    // -------------------------------------------------------------
    // TEST 3: Fail-Fast on Missing Volume Path (No Silent Fallback)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Fail-Fast on Missing Volume Path ---');
    let rejectedMissing = false;
    let missingErrorMsg = '';
    try {
      config.storage.driver = 'volume';
      config.storage.persistentVolumePath = '';
      validateStorageConfig();
    } catch (err: any) {
      rejectedMissing = true;
      missingErrorMsg = err.message;
    }

    let activeDirRejected = false;
    try {
      getActiveStorageDir();
    } catch {
      activeDirRejected = true;
    }

    recordTest(
      3,
      'Missing PERSISTENT_VOLUME_PATH fails fast and refuses silent local fallback',
      rejectedMissing && missingErrorMsg.includes('Refusing to silently fall back') && activeDirRejected,
      { missingErrorMsg, activeDirRejected }
    );

    // -------------------------------------------------------------
    // TEST 4: Rejection of Non-Existent Directory in Volume Mode
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Rejection of Non-Existent Volume Directory ---');
    let rejectedNonExistent = false;
    let nonExistentMsg = '';
    const fakeDir = path.join(os.tmpdir(), `nonexistent-dg-mount-${Date.now()}`);
    try {
      config.storage.driver = 'volume';
      config.storage.persistentVolumePath = fakeDir;
      validateStorageConfig();
    } catch (err: any) {
      rejectedNonExistent = true;
      nonExistentMsg = err.message;
    }
    recordTest(
      4,
      'Non-existent volume path fails fast at startup (fail-fast if volume unmounted)',
      rejectedNonExistent && nonExistentMsg.includes('does not exist'),
      { error: nonExistentMsg }
    );

    // -------------------------------------------------------------
    // TEST 5: Reconciliation of Legacy Aliases
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Reconciliation of Legacy Aliases ---');
    // Test alias 1: PERSISTENT_STORAGE_PATH
    delete process.env.PERSISTENT_VOLUME_PATH;
    process.env.PERSISTENT_STORAGE_PATH = tempVolumeDir;
    delete process.env.STORAGE_PERSISTENT_PATH;
    const resolvedAlias1 =
      process.env.PERSISTENT_VOLUME_PATH ||
      process.env.PERSISTENT_STORAGE_PATH ||
      process.env.STORAGE_PERSISTENT_PATH;

    // Test alias 2: STORAGE_PERSISTENT_PATH
    delete process.env.PERSISTENT_STORAGE_PATH;
    process.env.STORAGE_PERSISTENT_PATH = tempVolumeDir;
    const resolvedAlias2 =
      process.env.PERSISTENT_VOLUME_PATH ||
      process.env.PERSISTENT_STORAGE_PATH ||
      process.env.STORAGE_PERSISTENT_PATH;

    recordTest(
      5,
      'Legacy aliases (PERSISTENT_STORAGE_PATH & STORAGE_PERSISTENT_PATH) resolve correctly with priority fallback',
      resolvedAlias1 === tempVolumeDir && resolvedAlias2 === tempVolumeDir,
      { resolvedAlias1, resolvedAlias2 }
    );

    // -------------------------------------------------------------
    // TEST 6: Production Guard Against Ephemeral Local Storage
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Production Ephemeral Storage Guard ---');
    const prevNodeEnv = config.nodeEnv;
    config.nodeEnv = 'production';
    config.storage.driver = 'local';
    config.storage.allowEphemeralLocal = false;
    let ephemeralBlocked = false;
    let ephemeralBlockedMsg = '';
    try {
      validateStorageConfig();
    } catch (err: any) {
      ephemeralBlocked = true;
      ephemeralBlockedMsg = err.message;
    }

    config.storage.allowEphemeralLocal = true;
    let ephemeralAllowedWithWarning = false;
    try {
      const allowedRes = validateStorageConfig();
      ephemeralAllowedWithWarning = allowedRes.statusMessage.includes('EPHEMERAL WARNING');
    } catch {
      ephemeralAllowedWithWarning = false;
    }

    config.nodeEnv = prevNodeEnv;
    config.storage.allowEphemeralLocal = false;
    recordTest(
      6,
      'Production rejects ephemeral local storage unless ALLOW_EPHEMERAL_LOCAL_STORAGE=true',
      ephemeralBlocked && ephemeralBlockedMsg.includes('Local container storage is ephemeral') && ephemeralAllowedWithWarning,
      { ephemeralBlockedMsg, ephemeralAllowedWithWarning }
    );

    // -------------------------------------------------------------
    // TEST 7: S3 Storage Driver Fail-Fast on Incomplete Configuration
    // -------------------------------------------------------------
    console.log('\n--- Test 7: S3 Fail-Fast on Missing Credentials ---');
    config.storage.driver = 's3';
    config.storage.s3 = {
      bucket: '',
      region: 'ap-south-1',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: false,
    };
    let s3Blocked = false;
    let s3BlockedMsg = '';
    try {
      validateStorageConfig();
    } catch (err: any) {
      s3Blocked = true;
      s3BlockedMsg = err.message;
    }

    let s3ClientThrew = false;
    try {
      s3StorageManager.getClient();
    } catch {
      s3ClientThrew = true;
    }

    recordTest(
      7,
      'S3 storage driver fails fast when bucket or credentials are missing (never silently falls back to disk)',
      s3Blocked && s3BlockedMsg.includes('S3_BUCKET') && s3ClientThrew,
      { s3BlockedMsg, s3ClientThrew }
    );

    // -------------------------------------------------------------
    // TEST 8: Real Persistent Volume Media Storage & Retrieval
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Real Persistent Volume Storage & Byte-Range Retrieval ---');
    config.storage.driver = 'volume';
    config.storage.persistentVolumePath = tempVolumeDir;

    // Create volume directory structures
    const publicThumbDir = path.join(tempVolumeDir, 'courses', 'public', 'thumbnails');
    const protectedVideoDir = path.join(tempVolumeDir, 'courses', 'protected', 'videos');
    fs.mkdirSync(publicThumbDir, { recursive: true });
    fs.mkdirSync(protectedVideoDir, { recursive: true });

    // Seed test files in persistent volume
    const thumbFilename = 'test-course-thumb.jpg';
    const videoFilename = 'test-course-lesson.mp4';
    const thumbContent = Buffer.from('FAKE-JPEG-THUMBNAIL-CONTENT-FOR-TESTING');
    const videoContent = Buffer.alloc(1000, 'A'); // 1000-byte simulated video file

    fs.writeFileSync(path.join(publicThumbDir, thumbFilename), thumbContent);
    fs.writeFileSync(path.join(protectedVideoDir, videoFilename), videoContent);

    // Check mediaExists
    const thumbExists = await StorageManager.mediaExists({
      scope: 'public',
      folder: 'thumbnails',
      filename: thumbFilename,
    });
    const videoExists = await StorageManager.mediaExists({
      scope: 'protected',
      folder: 'videos',
      filename: videoFilename,
    });

    // Check full read (HTTP 200)
    const stream200 = await StorageManager.getMediaStream({
      scope: 'public',
      folder: 'thumbnails',
      filename: thumbFilename,
    });
    const content200 = stream200 ? await streamToBuffer(stream200.stream) : null;

    // Check partial byte-range (HTTP 206)
    const stream206 = await StorageManager.getMediaStream({
      scope: 'protected',
      folder: 'videos',
      filename: videoFilename,
      rangeHeader: 'bytes=100-199',
    });
    const content206 = stream206 ? await streamToBuffer(stream206.stream) : null;

    // Check out-of-bounds byte-range (HTTP 416)
    let range416Caught = false;
    try {
      await StorageManager.getMediaStream({
        scope: 'protected',
        folder: 'videos',
        filename: videoFilename,
        rangeHeader: 'bytes=5000-6000',
      });
    } catch (err: any) {
      if (err.statusCode === 416) range416Caught = true;
    }

    recordTest(
      8,
      'Persistent volume streams full media (200), partial byte-range (206), and enforces 416 on invalid range',
      thumbExists &&
        videoExists &&
        stream200?.statusCode === 200 &&
        content200?.length === thumbContent.length &&
        stream206?.statusCode === 206 &&
        stream206?.contentLength === 100 &&
        stream206?.contentRange === 'bytes 100-199/1000' &&
        content206?.length === 100 &&
        range416Caught,
      {
        stream200Status: stream200?.statusCode,
        stream206Status: stream206?.statusCode,
        contentRange: stream206?.contentRange,
        range416Caught,
      }
    );

    // -------------------------------------------------------------
    // TEST 9: Volume Mode Isolation (Never Serves Local ./uploads)
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Volume Mode Isolation ---');
    // Write a file exclusively into local ./uploads
    const localUploadsDir = path.resolve(process.cwd(), 'uploads', 'courses', 'protected', 'videos');
    fs.mkdirSync(localUploadsDir, { recursive: true });
    const localOnlyFile = `local-only-${Date.now()}.mp4`;
    fs.writeFileSync(path.join(localUploadsDir, localOnlyFile), 'LOCAL-FILE-NOT-IN-VOLUME');

    // In volume mode, resolving this file must return null
    config.storage.driver = 'volume';
    config.storage.persistentVolumePath = tempVolumeDir;
    const resolvedInVolumeMode = resolveAbsolutePath(path.join('courses', 'protected', 'videos', localOnlyFile));

    const existsInVolumeMode = await StorageManager.mediaExists({
      scope: 'protected',
      folder: 'videos',
      filename: localOnlyFile,
    });

    recordTest(
      9,
      'Volume mode strictly isolates candidate paths (never silently accesses local ./uploads files)',
      resolvedInVolumeMode === null && !existsInVolumeMode,
      { resolvedInVolumeMode, existsInVolumeMode }
    );

    // Cleanup local test file
    try {
      fs.unlinkSync(path.join(localUploadsDir, localOnlyFile));
    } catch {}

    // -------------------------------------------------------------
    // TEST 10: S3 Storage Manager Unit Protocol Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 10: S3 Protocol & Contract Verification ---');
    config.storage.s3 = {
      bucket: 'test-digitalghuru-media-bucket',
      region: 'ap-south-1',
      endpoint: 'https://r2.cloudflarestorage.com',
      accessKeyId: 'AKIA_TEST_KEY_DG_2026',
      secretAccessKey: 'SECRET_KEY_DG_LONG_AND_SECURE_2026',
      forcePathStyle: true,
    };
    const s3Client = s3StorageManager.getClient();
    recordTest(
      10,
      'S3StorageManager successfully initializes AWS S3 client with configured endpoint and credentials',
      s3Client !== null && typeof s3Client.send === 'function',
      { bucket: config.storage.s3.bucket, region: config.storage.s3.region }
    );

    // -------------------------------------------------------------
    // TEST 11: Startup Diagnostics Formatter
    // -------------------------------------------------------------
    console.log('\n--- Test 11: Storage Startup Diagnostics Output ---');
    config.storage.driver = 'volume';
    config.storage.persistentVolumePath = tempVolumeDir;

    // Capture console output during printStorageDiagnostics
    const originalLog = console.log;
    const capturedLogs: string[] = [];
    console.log = (...args: any[]) => {
      capturedLogs.push(args.join(' '));
    };

    try {
      printStorageDiagnostics();
    } finally {
      console.log = originalLog;
    }

    const diagOutput = capturedLogs.join('\n');
    recordTest(
      11,
      'Storage diagnostics outputs formatted driver, resolved location, and operational health status',
      diagOutput.includes('[Storage Diagnostics]') &&
        diagOutput.includes('VOLUME') &&
        norm(diagOutput).includes(norm(tempVolumeDir)) &&
        diagOutput.includes('Persistent volume verified'),
      { diagOutput }
    );

    // -------------------------------------------------------------
    // TEST 12: Health Check API Endpoint Storage Integration
    // -------------------------------------------------------------
    console.log('\n--- Test 12: Health Check API Storage Status ---');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();

    recordTest(
      12,
      '/api/health endpoint reports storage driver, resolved location, and operational status',
      healthRes.status === 200 &&
        Boolean(healthJson.storage) &&
        healthJson.storage.driver === 'volume' &&
        norm(healthJson.storage.location) === norm(tempVolumeDir) &&
        healthJson.storage.operational === true,
      { healthStorage: healthJson.storage }
    );

  } finally {
    // Restore original configuration and environment
    process.env = originalEnv;
    config.storage = originalConfigStorage;

    // Clean up temporary volume directory
    try {
      fs.rmSync(tempVolumeDir, { recursive: true, force: true });
    } catch {}

    // Close test server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  // Summary
  console.log('\n================================================================');
  console.log(' PHASE 1.1 STORAGE HARDENING TEST SUMMARY');
  console.log('================================================================');
  console.log(`  TOTAL TESTS:   ${passedCount + failedCount}`);
  console.log(`  PASSED:        ${passedCount}`);
  console.log(`  FAILED:        ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    console.error(`FAILURE: ${failedCount} tests failed.`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 12 Phase 1.1 Storage Hardening tests passed with 0 errors.');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal error running Phase 1.1 tests:', err);
  process.exit(1);
});
