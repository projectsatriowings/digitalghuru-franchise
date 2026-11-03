import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('--- Starting Staff Photo Upload & Creation Test ---');

  // 1. Admin login
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@apex.example.com',
      password: 'Password#123',
    }),
  });

  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  const instituteId = loginData.data?.institute?.id || loginData.data?.user?.memberships?.[0]?.institute?.id;
  if (!loginRes.ok || !token || !instituteId) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginData)}`);
  }
  console.log('✓ Admin login successful. Institute ID:', instituteId);

  // 2. Prepare 1x1 test PNG image buffer
  const testPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="test_staff_photo.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    ),
    testPngBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  // 3. Test pre-creation photo upload: POST /api/staff/upload-photo
  const uploadRes = await fetch(`${BASE_URL}/staff/upload-photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Institute-Id': instituteId,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const uploadData = await uploadRes.json();
  console.log('Upload response status:', uploadRes.status, uploadData);
  if (!uploadRes.ok || !uploadData.success || !uploadData.data?.photoStorageKey) {
    throw new Error(`Upload photo failed: ${JSON.stringify(uploadData)}`);
  }
  const photoStorageKey = uploadData.data.photoStorageKey;
  console.log('✓ Staff photo uploaded successfully before creation. Key:', photoStorageKey);

  // 4. Test raw photo streaming: GET /api/staff/photo-raw/:key
  const rawPhotoRes = await fetch(`${BASE_URL}/staff/photo-raw/${encodeURIComponent(photoStorageKey)}`);
  if (!rawPhotoRes.ok) {
    throw new Error(`Raw photo streaming failed with status ${rawPhotoRes.status}`);
  }
  const contentType = rawPhotoRes.headers.get('content-type');
  console.log('✓ Raw photo streamed successfully. Content-Type:', contentType);

  // 5. Create new staff member with avatarUrl
  const testEmail = `phototest_${Date.now()}@apex.edu`;
  const createRes = await fetch(`${BASE_URL}/staff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Institute-Id': instituteId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: 'Prof. Photo Test Staff',
      email: testEmail,
      phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
      designation: 'Senior Faculty',
      department: 'Science',
      temporaryPassword: 'TestPassword123!',
      avatarUrl: photoStorageKey,
    }),
  });

  const createData = await createRes.json();
  console.log('Create staff status:', createRes.status, createData);
  if (!createRes.ok || !createData.success) {
    throw new Error(`Create staff failed: ${JSON.stringify(createData)}`);
  }
  const createdStaffId = createData.data?.staff?.id || createData.data?.staffId;
  console.log('✓ Staff created successfully. ID:', createdStaffId);

  // 6. Verify in database that avatarUrl is persisted
  const dbStaff = await prisma.staffProfile.findUnique({
    where: { id: createdStaffId },
    include: { user: true },
  });
  if (!dbStaff || dbStaff.avatarUrl !== photoStorageKey) {
    throw new Error(`Staff avatarUrl mismatch in DB! Expected: ${photoStorageKey}, got: ${dbStaff?.avatarUrl}`);
  }
  console.log('✓ DB verification passed: avatarUrl correctly stored in StaffProfile:', dbStaff.avatarUrl);

  // 7. Verify streaming via GET /api/staff/:id/photo
  const staffPhotoRes = await fetch(`${BASE_URL}/staff/${createdStaffId}/photo`);
  if (!staffPhotoRes.ok) {
    throw new Error(`Staff photo streaming failed with status ${staffPhotoRes.status}`);
  }
  console.log('✓ Staff photo streamed via /api/staff/:id/photo successfully');

  // 8. Cleanup test record
  await prisma.staffProfile.delete({ where: { id: createdStaffId } });
  if (dbStaff.userId) {
    await prisma.user.delete({ where: { id: dbStaff.userId } });
  }
  console.log('✓ Cleanup complete. Test staff removed.');

  console.log('\n🎉 ALL STAFF PHOTO UPLOAD AND CREATION TESTS PASSED!');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
