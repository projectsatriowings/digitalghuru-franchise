# Digital Guru Franchise — Mobile Application Phase 1: Repository & Backend Audit

**Document:** `docs/mobile-repository-audit.md`  
**Date:** November 23, 2026  
**Status:** COMPLETE AUDIT  
**Scope:** Repository structure, Express backend, Prisma schema, authentication, permissions, file storage, notifications, and existing tests.

---

## 1. Executive Summary

This audit assesses the readiness of the existing **Digital Guru Franchise** monorepo to introduce a cross-platform (Android & iOS) mobile application under `apps/mobile` for three core user roles:
1. **Student**
2. **Parent**
3. **Teacher** (represented systemically as `STAFF`)

The audit confirms that the existing Express API server, Prisma schema (PostgreSQL via Neon Serverless), and shared domain packages contain the core foundational logic, models, authentication pipelines, and authorization mechanisms required to support the mobile client. However, because the backend was originally designed for the desktop web portal (`apps/web`), several endpoint optimizations (specifically dashboard aggregation, structured timetable endpoints, and push delivery services) will be required to ensure high-performance, low-latency mobile operations.

---

## 2. Monorepo & Directory Structure

The repository is structured as an npm-workspaces monorepo:

```
c:\Atriowings\digitalghuru-franchise\
├── apps/
│   └── web/                   # Existing React 18.2 + Vite + Tailwind CSS web portal
│   └── mobile/                # (TARGET LOCATION - NOT YET CREATED)
├── packages/
│   └── shared/                # Core domain types, theme design tokens, voice matching algorithms
├── server/                    # Node.js + Express + Prisma + Neon PostgreSQL API server
│   ├── prisma/
│   │   ├── schema.prisma      # 2,208 lines defining 45+ relational database models
│   │   └── migrations/        # PostgreSQL migration history
│   ├── scripts/               # 35+ automated validation, migration, and E2E verification scripts
│   ├── src/
│   │   ├── config/            # Environment parsing, database connection, storage config
│   │   ├── middleware/        # JWT auth, RBAC guards, tenant isolation, rate limiting
│   │   ├── modules/           # 22 feature domain modules with routes and controllers
│   │   ├── utils/             # Cryptography, caching, byte-range storage, logger
│   │   ├── index.ts           # Express server entry point and route mounting
│   │   └── prisma.ts          # Resilient PrismaClient instance with Neon socket reconnect
├── docs/                      # Enterprise integration and architecture audits
├── package.json               # Root workspaces: ["server", "apps/web", "packages/*"]
└── tsconfig.json              # Monorepo TypeScript configuration (TypeScript ^5.5.4)
```

### 2.1 Monorepo Workspace Configuration
- **Root `package.json`**:
  - `workspaces`: `["server", "apps/web", "packages/*"]`
  - React type dependencies: `@types/react: ~18.2.79`, `@types/react-dom: ~18.2.25`
  - TypeScript: `^5.5.4`
- **Existing Web Application (`apps/web`)**:
  - React: `18.2.0`, React Router DOM: `^6.26.2`, Tailwind CSS: `^3.4.11`, Lucide React: `^0.441.0`.
  - Reuses `@tuition/shared` for tokens, roles, and status enums.
- **Proposed Mobile Application (`apps/mobile`)**:
  - Must be added to `workspaces` in root `package.json`.
  - Must be built with Expo SDK 51 (React 18.2.0, React Native 0.74.x) to maintain strict peer dependency harmony with root and `apps/web`.

---

## 3. Existing Shared Package (`packages/shared`)

The `@tuition/shared` package serves as the shared domain contract:
- **`src/index.ts`**:
  - Enums: `UserRole` (`SUPER_ADMIN`, `FRANCHISE_OWNER`, `BRANCH_ADMIN`, `ACADEMIC_ADMIN`, `STAFF`, `PARENT`, `STUDENT`).
  - Status models: `StudentStatus`, `InstituteStatus`, `AttendanceType`, `AttendanceStatus`, `FeeFrequency`, `PaymentStatus`, `PaymentMethod`, `MaterialType`, `NotificationStatus`, `SubmissionStatus`.
  - Interfaces: `ApiResponse<T>`, `StudentAdmissionPayload`, `ToastMessage`.
- **`src/theme.ts`**:
  - Design tokens: Official Digital Guru brand colors (`brandBlue: '#006FFF'`, `brandGold: '#FEDC32'`, `brandOrange: '#FE4D01'`, `brandNavy: '#0F172A'`).
  - Spacing, radii, and typography scales.
  - React Native compatible elevation and shadow objects (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`, `elevation`) already declared.
- **`src/voiceMatching.ts`**:
  - Levenshtein phonetic distance and word-boundary matching utilities used for voice attendance transcription.

---

## 4. Database Schema & Prisma Architecture

The database is a dedicated Neon PostgreSQL serverless instance managed via Prisma (`server/prisma/schema.prisma`).

### 4.1 Relevant Domain Models

| Model | Schema Lines | Role / Domain | Key Relationships & Fields |
|---|---|---|---|
| `User` | L. 298–352 | All Roles | `id`, `email`, `phone`, `passwordHash`, `role`, `isActive`, `mustChangePassword`, `lastLoginAt` |
| `Institute` | L. 230–297 | Multi-Tenant Campus | `id`, `code`, `name`, `status`, `address`, `phone`, `email` |
| `InstituteMembership` | L. 353–372 | Campus User Binding | `userId`, `instituteId`, `role`, `isActive` |
| `Student` | L. 512–565 | Student Profile | `id`, `userId`, `instituteId`, `admissionNumber`, `firstName`, `lastName`, `status` |
| `ParentProfile` | L. 495–511 | Parent Profile | `id`, `userId`, `occupation`, `address`, `altPhone` |
| `StudentParentRelation` | L. 566–586 | Student-Parent Link | `studentId`, `parentId`, `relation`, `isPrimaryContact`, `canReceiveSms` |
| `StaffProfile` | L. 373–437 | Teacher / Staff | `id`, `userId`, `instituteId`, `employeeCode`, `designation`, `department` |
| `Batch` | L. 608–638 | Class / Cohort | `id`, `instituteId`, `name`, `code`, `academicYear`, `schedule` (text) |
| `Subject` | L. 587–607 | Subject / Course | `id`, `instituteId`, `name`, `code` |
| `BatchSubject` | L. 639–659 | Curriculum Allocation | `id`, `batchId`, `subjectId`, `staffProfileId`, `schedule` (text) |
| `StaffBatchAssignment` | L. 660–671 | Staff-Batch Association | `staffProfileId`, `batchId`, `assignedAt` |
| `StudentEnrollment` | L. 672–692 | Student Enrollment | `studentId`, `batchId`, `subjectId`, `isActive` |
| `AttendanceEvent` | L. 693–724 | Attendance Logs | `studentId`, `batchId`, `eventType`, `status`, `method`, `eventDate`, `eventTime` |
| `LearningMaterial` | L. 810–841 | Study Resources | `instituteId`, `title`, `type`, `fileUrl`, `fileSize`, `mimeType`, `batchId`, `subjectId` |
| `Examination` | L. 842–876 | Exams & Tests | `instituteId`, `title`, `batchId`, `subjectId`, `examDate`, `maxMarks`, `fileUrl` |
| `ExamMark` | L. 905–924 | Student Marks | `examId`, `studentId`, `marksObtained`, `isAbsent`, `remarks` |
| `HomeworkSubmission` | L. 877–904 | Submissions | `materialId`, `studentId`, `submissionFileUrl`, `marksAwarded`, `status` |
| `ProgressFeedback` | L. 925–960 | Academic Reviews | `instituteId`, `studentId`, `batchId`, `subjectId`, `authorStaffId`, `rating`, `feedback` |
| `ParentFeedback` | L. 1282–1313 | Grievances & Inquiries | `instituteId`, `studentId`, `parentId`, `category`, `feedbackText`, `status`, `response` |
| `FeeStructure` | L. 1050–1071 | Fee Master | `instituteId`, `name`, `amount`, `frequency`, `batchId` |
| `StudentFeeAssignment` | L. 1072–1096 | Assigned Charges | `studentId`, `feeStructureId`, `netAmount`, `paidAmount`, `status` |
| `Payment` | L. 1097–1145 | Receipts & Transactions| `instituteId`, `studentId`, `receiptNumber`, `amount`, `paymentMethod`, `status` |
| `OnlinePaymentOrder` | L. 1250–1281 | Razorpay Orders | `instituteId`, `studentId`, `razorpayOrderId`, `amount`, `status` |
| `Notification` | L. 756–791 | In-App Notifications | `instituteId`, `userId`, `role`, `title`, `message`, `entityType`, `entityId`, `isRead` |
| `DevicePushToken` | L. 792–805 | Mobile Push Tokens | `userId`, `token`, `platform` (`android`/`ios`), `deviceInfo` |
| `StaffAttendanceEvent` | L. 1394–1421 | Teacher Geofence Punch | `staffProfileId`, `eventType`, `eventTime`, `latitude`, `longitude`, `geofenceStatus` |

---

## 5. Existing Express API Architecture

The server routes are declared in `server/src/index.ts` and mounted symmetrically on both `/api/*` and `/*`:
- Total feature modules mounted: **22 module routers**.
- Global middleware stack:
  1. `helmet()` — HTTP security headers.
  2. `compression()` — GZIP/Deflate (bypasses byte-range requests and `/download` streams).
  3. `cors()` — Permits development origins, mobile clients (requests lacking browser `Origin`), and production domains.
  4. `express.json({ limit: '10mb' })` with `rawBody` preservation for Razorpay webhook verification.
  5. `apiRateLimiter` — Prevents denial of service.
  6. `serverCache` — Read-caching with automatic invalidation on mutating HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`).
  7. Centralized error handling and performance timing (`X-Response-Time`).

---

## 6. Storage & Upload Infrastructure

Storage logic is encapsulated in `server/src/utils/storage.ts`:
- **Supported Storage Drivers**: `local` (disk storage in `./uploads`), `volume` (Docker persistent volume), and `s3` (AWS S3 SDK v3).
- **Partitioning**:
  - `PUBLIC_COURSE_FOLDERS`: `thumbnails`, `banners`, `brochures`, `promotional`.
  - `PROTECTED_COURSE_FOLDERS`: `attachments`, `videos`, `lessons`, `materials`, `worksheets`.
- **Multer Engines**:
  - `fileUpload`: 25 MB max limit (`MAX_FILE_SIZE_BYTES`). Allowed types: PDF, Audio, Images (`ALLOWED_MIME_TYPES`).
  - `photoUpload`: 5 MB max limit (`MAX_PHOTO_SIZE_BYTES`). Allowed types: JPEG, PNG, WebP.
- **Streaming & Byte-Ranges**:
  - Full RFC 7233 HTTP byte-range parsing (`parseHttpRange`) supporting chunked streaming for audio, video, and PDF documents.

---

## 7. Notification & Real-Time Infrastructure

Existing notification capabilities (`server/src/modules/notifications`):
- **Database Notifications (`Notification`)**: Tracks in-app notices with `entityType`, `entityId`, `metadata`, and deep link URLs.
- **Server-Sent Events (SSE)**: `GET /api/notifications/stream` supports real-time notification pushes on web.
- **Push Device Token Registry**:
  - Model: `DevicePushToken` (`id`, `userId`, `token`, `platform`, `deviceInfo`).
  - Endpoints: `POST /api/notifications/push-token` and `DELETE /api/notifications/push-token`.
- **Push Dispatch Service**: In-app notifications are saved to database; however, the actual dispatch via Expo Push API / Firebase Cloud Messaging (FCM) is currently queued but requires an active push dispatcher worker.
- **SMS Queue**: `SmsNotification` queue with configurable provider (`mock` or HTTP SMS gateway).

---

## 8. Verification Scripts & Automated Test Suite

The server contains an extensive test suite in `server/scripts/`:
- `test-phase9-notification-deep-linking-parity.ts`: Validates notification deep-linking across Admin, Staff, Student, and Parent roles.
- `test-homework-exams-flow.ts`: Validates homework creation, submission, and exam grading.
- `test-messaging-and-feedback-e2e.ts`: Validates real-time conversation and parent feedback threads.
- `test-student-progress-security-unit.ts`: Verifies student progress isolation.
- `test-staff-geofence-attendance.ts` & `test-staff-wfh-attendance.ts`: Verifies staff attendance punch-in with geolocation and geofencing.

---

## 9. Conclusion of Repository Audit

The repository has a solid, enterprise-grade foundation. The core database tables and business logic already support the three target user personas (Student, Parent, and Teacher). No database replacements or business logic overhauls are needed. The work for mobile introduction involves adding `apps/mobile`, connecting to existing endpoints, introducing lightweight aggregator endpoints where mobile efficiency requires it, and wiring the Expo Push notification transport.
