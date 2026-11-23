# Digital Guru Franchise — Mobile Feature API Mapping

**Document:** `docs/mobile-api-mapping.md`  
**Date:** November 23, 2026  
**Status:** COMPLETE AUDIT  
**Scope:** Exhaustive API mapping for Student, Parent, and Teacher roles across existing Express backend routes.

---

## 1. Classification Methodology

Every requested feature is classified under one of three strict statuses:
- **`EXISTING`**: A fully functional backend endpoint currently exists, handles required business logic, enforces authentication/role permissions, and returns required data.
- **`NEEDS_EXTENSION`**: The underlying business logic and database entities exist, but the current endpoint either requires query optimization, multi-endpoint client roundtrips, or minor response enrichment specifically tailored for mobile ergonomics and bandwidth savings.
- **`NOT_AVAILABLE`**: No specific endpoint currently exists in the backend routing table for this capability, requiring a new router handler in the existing Express modules.

---

## 2. Common Authentication & Profile APIs

| Feature | Status | Method | Endpoint | Description & Auth Requirements |
|---|---|---|---|---|
| Common Login | `EXISTING` | `POST` | `/api/auth/login` | Authenticates User by Email / Phone / Admission Number + Password. Returns JWT access token (7d), refresh token (30d), user profile, role, active memberships, and institute context. Role is validated server-side. |
| Token Refresh | `EXISTING` | `POST` | `/api/auth/refresh` | Renews expired access token using valid `refreshToken`. Enforces user active state check. |
| Current Session | `EXISTING` | `GET` | `/api/auth/me` | Returns sanitized current authenticated user record and active memberships. Requires `Bearer <accessToken>`. |
| Password Change | `EXISTING` | `POST` | `/api/auth/change-password` | Authorized for `STAFF`, `ACADEMIC_ADMIN`, `SUPER_ADMIN`. (Students & Parents are explicitly forbidden; their credentials are staff-managed). |
| Push Token Register | `EXISTING` | `POST` | `/api/notifications/push-token` | Upserts mobile device push token (`token`, `platform`: `android`\|`ios`, `deviceInfo`) to `DevicePushToken` table. |
| Push Token Remove | `EXISTING` | `DELETE` | `/api/notifications/push-token` | De-registers device push token upon logout. Body: `{ token: string }`. |

---

## 3. Student Role API Mapping

| Feature | Status | Method | Endpoint | Request Details | Response Details | Authorization | Gap Analysis / Extension Needed |
|---|---|---|---|---|---|---|---|
| **Dashboard** | `NEEDS_EXTENSION` | `GET` | `/api/students/my/profile` *(+ multiple calls)* | Query: none. Headers: `Authorization: Bearer <token>` | Returns student record, current enrollments, institute info, recent 10 attendance events. | `requireRole('STUDENT')` | Existing web client synthesizes dashboard by firing 5 parallel requests (`/students/my/profile`, `/courses/learning/my-dashboard`, `/materials`, `/homework`, `/quizzes`). Mobile requires a unified composite endpoint `GET /api/students/my/dashboard` to conserve battery and cellular bandwidth. |
| **Timetable** | `NEEDS_EXTENSION` | `GET` | `/api/academics/batches` | Query: none. Headers: `Authorization`, `x-institute-id` | Returns student's enrolled batches with `batchSubjects` and unstructured `schedule` text string (e.g. `"Mon-Fri 4:00 PM - 6:00 PM"`). | `requireRole('STUDENT', ...)` | Schedule is stored as free-form string on `Batch.schedule` and `BatchSubject.schedule`. Mobile needs a structured daily timetable resolver endpoint `GET /api/students/my/timetable` parsing days and time slots. |
| **Attendance** | `EXISTING` | `GET` | `/api/students/my/profile` | Headers: `Authorization: Bearer <token>` | Contains `attendanceEvents` array with latest 10 attendance events (check-in, check-out, timestamp). | `requireRole('STUDENT')` | Historical attendance view requires pagination. `GET /api/attendance/reports` is restricted to staff/admins. Recommend exposing `GET /api/students/my/attendance-history?page=1&limit=30`. |
| **Learning Materials** | `EXISTING` | `GET` | `/api/materials` | Query: `batchId?`, `subjectId?`, `search?`. | Returns list of learning materials with title, description, fileUrl, fileSize, mimeType, and creation date filtered to student's batches. | Any authenticated user in institute | Fully functional. File downloads handled via `/api/materials/:id/download`. Interaction tracking supported via `POST /api/materials/:id/track`. |
| **Homework** | `EXISTING` | `GET` | `/api/homework` | Query: `batchId?`, `subjectId?`, `status?`. | Returns homework assignments filtered to student's enrolled batches with due dates, attachments, and max marks. | Any authenticated user in institute | Fully functional. Returns assignment metadata, deadline, and instructions. |
| **Homework Submissions** | `EXISTING` | `POST` | `/api/homework/:id/submissions` | Multipart form: `file` (single document/photo, max 25MB), body: `studentNotes?`. | Returns created `HomeworkSubmission` record (`id`, `materialId`, `studentId`, `submissionFileUrl`, `submittedAt`, `status: 'SUBMITTED'`). | `requireRole('STUDENT')` | Fully functional. Automatically captures student ID from token and links to target homework. |
| **Academic Progress** | `EXISTING` | `GET` | `/api/progress/students/:studentId` | Path: `:studentId` (validated against own student ID). | Returns progress feedback entries with ratings, metrics, teacher notes, and exam mark summaries. | `requireRole('STUDENT', ...)` | Fully functional. Enforces student authorization check (`student.userId === req.user.userId`). |
| **Notifications** | `EXISTING` | `GET` | `/api/notifications` | Query: `page?`, `limit?`, `isRead?`. | Returns paginated notifications with `id`, `title`, `message`, `type`, `entityType`, `entityId`, `link`, `isRead`, `createdAt`. | Authenticated user | Unread count available via `GET /api/notifications/unread-count`. Mark single read via `PATCH /api/notifications/:id/read`. Mark all read via `POST /api/notifications/mark-all-read`. |
| **Profile** | `EXISTING` | `GET` | `/api/students/my/profile` | Headers: `Authorization: Bearer <token>` | Returns complete student personal info, admission number, parents, active batches, and XP points. | `requireRole('STUDENT')` | Fully functional. |

---

## 4. Parent Role API Mapping

| Feature | Status | Method | Endpoint | Request Details | Response Details | Authorization | Gap Analysis / Extension Needed |
|---|---|---|---|---|---|---|---|
| **Dashboard** | `EXISTING` | `GET` | `/api/parents/my/dashboard-summary` | Headers: `Authorization: Bearer <token>` | Returns aggregated summary for all linked children: today's attendance, monthly attendance rates, outstanding fee balances, upcoming due dates, and recent performance. | `requireRole('PARENT')` | Fully functional and pre-optimized. Returns children array with contextual indicators. |
| **Linked Children** | `EXISTING` | `GET` | `/api/parents/my/children` | Headers: `Authorization: Bearer <token>` | Returns array of verified linked children (`studentId`, `firstName`, `lastName`, `admissionNumber`, `batchName`, `relationship`, `isPrimaryContact`, `canReceiveSms`). | `requireRole('PARENT')` | Fully functional. Only returns students linked via `StudentParentRelation`. |
| **Attendance** | `EXISTING` | `GET` | `/api/parents/students/:studentId/attendance` | Path: `:studentId`. Query: `month?`, `year?`. | Returns daily attendance register for the requested child, check-in/out timestamps, attendance percentage, and status (PRESENT, ABSENT, LATE). | Verified Parent | Validates caller is linked to `:studentId` via `isStudentAuthorized`. |
| **Attendance History** | `EXISTING` | `GET` | `/api/parents/students/:studentId/attendance` | Path: `:studentId`. Query: `month`, `year`. | Full monthly breakdown of punches and attendance events. | Verified Parent | Fully functional. |
| **Academic Progress** | `EXISTING` | `GET` | `/api/parents/students/:studentId/academics` | Path: `:studentId`. | Returns report cards, exam marks, progress feedback, teacher ratings, and subject-wise averages. | Verified Parent | Fully functional. Securely isolates records to linked child. |
| **Homework Tracking** | `NEEDS_EXTENSION` | `GET` | `/api/homework` | Query: `batchId` (from child's batch). | Lists homework for the batch. Does NOT currently embed individual child's submission status in list view. | Authenticated user | Parent needs to see whether *their child* submitted or missed the homework. Extension recommended: `GET /api/parents/students/:studentId/homework` returning assignments with child-specific submission status (`PENDING`, `SUBMITTED`, `GRADED`, `OVERDUE`). |
| **Fees** | `EXISTING` | `GET` | `/api/fees/students/:studentId/statement` | Path: `:studentId`. | Returns detailed fee statement: assigned fee structures, total fee amount, amount paid, discount/adjustments, and outstanding balance. | `requireRole('PARENT', ...)` | Verified against linked child. Returns itemized structure. |
| **Payment History** | `EXISTING` | `GET` | `/api/fees/payments` | Query: `studentId`. | Returns list of payment receipts, payment dates, amounts, transaction references, payment mode (UPI, Cash, Online), and receipt URLs. | `requireRole('PARENT', ...)` | Fully functional. Receipt PDF/data viewable via `/api/fees/payments/:id/receipt`. Online payments initiated via `POST /api/fees/online/create-order` (Razorpay). |
| **Teacher Feedback** | `EXISTING` | `POST` & `GET` | `/api/feedback` | POST body: `{ studentId, category, feedbackText }`. GET query: `studentId?`. | Submits inquiry/feedback to teachers and retrieves existing conversation threads with teacher replies and resolution status. | `requireRole('PARENT')` | Fully functional. Supported categories: Academic, Discipline, Attendance, Transport, Fees, General. |
| **Notifications** | `EXISTING` | `GET` | `/api/notifications` | Query: `page?`, `limit?`. | Real-time alerts for child check-in, check-out, fee due dates, exam announcements, and teacher replies. | Authenticated user | Fully functional. |
| **Profile** | `EXISTING` | `GET` | `/api/auth/me` | Headers: `Authorization: Bearer <token>` | Returns parent user profile, linked children count, and registered contact phone/email. | Authenticated user | Fully functional. |

---

## 5. Teacher Role API Mapping (`STAFF`)

| Feature | Status | Method | Endpoint | Request Details | Response Details | Authorization | Gap Analysis / Extension Needed |
|---|---|---|---|---|---|---|---|
| **Dashboard** | `NEEDS_EXTENSION` | `GET` | `/api/institutes/dashboard/summary` | Headers: `Authorization`, `x-institute-id` | Currently returns institute-wide totals (total students, batches, staff), not teacher-specific daily task counts. | `requireRole('STAFF', ...)` | Teachers need a personal dashboard: today's assigned classes, students to mark present, pending homework to grade, unread parent feedback. Extension needed: `GET /api/staff/my/dashboard`. |
| **Assigned Batches** | `EXISTING` | `GET` | `/api/academics/batches` | Headers: `Authorization`, `x-institute-id` | Automatically scopes to batches assigned to this staff member via `StaffBatchAssignment` or `BatchSubject`. Returns batch ID, name, code, academicYear, and subject list. | `requireRole('STAFF', ...)` | Fully functional. Backend filters automatically in `listBatches` when role is `STAFF`. |
| **Assigned Subjects** | `EXISTING` | `GET` | `/api/academics/batches` | Headers: `Authorization`, `x-institute-id` | Returns `batchSubjects` array within each batch where `staffProfileId` matches teacher. | `requireRole('STAFF', ...)` | Fully functional. |
| **Student List** | `EXISTING` | `GET` | `/api/students` | Query: `batchId?`, `search?`, `page?`, `limit?`. | Returns students enrolled in the teacher's assigned batches. Enforces `getAuthorizedStudentScope`. | `requireRole('STAFF', ...)` | Fully functional. Blocks staff from viewing students in unassigned batches. |
| **Student Details** | `EXISTING` | `GET` | `/api/students/:id` | Path: `:id` (student UUID). | Returns detailed profile, parent contacts, academic enrollment, and attendance records. | `requireRole('STAFF', ...)` | Enforces `isStudentAuthorized`. Fully functional. |
| **Attendance (Mark)** | `EXISTING` | `POST` | `/api/attendance/check-in` & `/check-out` | Body: `{ studentId, batchId, status: 'PRESENT'\|'ABSENT'\|'LATE', method: 'MANUAL'\|'VOICE_CONFIRMED' }`. | Records check-in / check-out attendance event with validation and parent notification trigger. | `requireRole('STAFF', ...)` | Validates staff is assigned to batch. Fully functional. |
| **Voice Attendance** | `EXISTING` | `POST` | `/api/attendance/voice-match` | Body: `{ transcript: string, batchId: string, subjectId?: string }`. | Uses phonetic Levenshtein matching against active batch student roster. Returns matched students with confidence scores. | `requireRole('STAFF', ...)` | Fully functional. Works in conjunction with mobile microphone speech-to-text. |
| **Material Uploads** | `EXISTING` | `POST` | `/api/materials` | Multipart form: `file` (max 25MB), body: `title`, `description`, `type`, `batchId`, `subjectId`. | Uploads file to storage driver and registers `LearningMaterial` database record. | `requireRole('STAFF', ...)` | Fully functional. |
| **Homework Creation** | `EXISTING` | `POST` | `/api/homework` | Multipart form: `file` (optional worksheet/attachment), body: `title`, `description`, `batchId`, `subjectId`, `dueDate`, `maxMarks`. | Creates `LearningMaterial` of type `HOMEWORK` and triggers notifications to enrolled students/parents. | `requireRole('STAFF', ...)` | Fully functional. |
| **Homework Submissions** | `EXISTING` | `GET` & `PATCH` | `GET /api/homework/:id/submissions`<br>`PATCH /api/homework/submissions/:submissionId/grade` | GET: Lists all submissions for homework.<br>PATCH body: `{ marksAwarded, feedback }`. | GET: returns student submissions with download links.<br>PATCH: updates marks and notifies student. | `requireRole('STAFF', ...)` | Fully functional. |
| **Marks & Progress** | `EXISTING` | `POST` | `/api/exams/:id/marks`<br>`POST /api/progress` | Body: marks array `[{ studentId, marksObtained, isAbsent, remarks }]`. | Enters exam marks and records teacher progress reviews. | `requireRole('STAFF', ...)` | Fully functional. |
| **Parent Feedback** | `EXISTING` | `GET` & `POST` | `GET /api/feedback`<br>`POST /api/feedback/:id/respond` | GET query: `status?`. POST body: `{ responseText: string }`. | Lists inquiries from parents of assigned students and posts teacher response. | `requireRole('STAFF', ...)` | Fully functional. Validates staff teaches the student. |
| **Teacher Attendance** | `EXISTING` | `POST` | `/api/staff-attendance/check-in` & `/check-out` | Body: `{ latitude, longitude }`. | Records teacher punch-in/out with GPS coordinates against campus geofence. | `requireRole('STAFF', ...)` | Fully functional. |
| **Notifications** | `EXISTING` | `GET` | `/api/notifications` | Query: `page?`, `limit?`. | Staff-targeted alerts (batch assignments, parent messages, submission alerts). | Authenticated user | Fully functional. |
| **Profile** | `EXISTING` | `GET` | `/api/staff/:id` | Path: `:id` (staff profile ID). | Returns qualifications, experience, employee code, designation, and bio. | `requireRole('STAFF', ...)` | Fully functional. |

---

## 6. Summary of Backend Endpoints Requiring Extension

| Role | Proposed New Endpoint | Type | Justification |
|---|---|---|---|
| **Student** | `GET /api/students/my/dashboard` | Aggregator | Combines student profile, today's timetable, pending homework, recent attendance percentage, and unread notification count into a single response to optimize mobile startup. |
| **Student** | `GET /api/students/my/timetable` | Structured Formatter | Converts unstructured `Batch.schedule` strings into normalized day-by-day JSON arrays `[{ day: 'MONDAY', slots: [{ time: '16:00 - 17:00', subject: 'Physics', teacher: 'John Doe' }] }]`. |
| **Parent** | `GET /api/parents/students/:studentId/homework` | Extension | Provides homework assignments enriched with that specific child's submission and grading status (`PENDING`, `SUBMITTED`, `GRADED`, `OVERDUE`). |
| **Teacher** | `GET /api/staff/my/dashboard` | Aggregator | Returns today's teaching schedule, total assigned students, attendance marking status for today's batches, and count of ungraded homework submissions. |
| **All Roles** | `POST /api/notifications/dispatch-push` *(internal worker)* | Infrastructure Worker | Connects database notification creation to the Expo Push Notification service so background and locked-screen mobile devices receive instant pushes. |

All remaining 35+ core endpoints are **EXISTING** and fully functional without modifying existing business rules or database schema.
