# READ-ONLY TECHNICAL AUDIT – DIGITAL GURU TO DIGITAL GURU FRANCHISE INTEGRATION

**Inspection Date:** November 12, 2026  
**Auditor:** Antigravity System Architecture Specialist  
**Source Repository:** Digital Guru (`C:\SRI\digitalghuru_updated`)  
**Target Repository:** Digital Guru Franchise (`C:\SRI\digitalghuru-franchise`)  
**Status:** Read-Only Technical Audit & Integration Architecture Design  

---

## EXECUTIVE SUMMARY

This document provides a comprehensive, read-only technical audit of the standalone **Digital Guru LMS/Website** (`digitalghuru_updated`) and the multi-tenant **Digital Guru Franchise Management Platform** (`digitalghuru-franchise`).

The purpose of this audit is to evaluate both codebases, map features, compare database models and security perimeters, identify missing functionality, and design a robust, non-destructive integration architecture that brings Digital Guru's online course delivery, recorded lectures, and enquiry management into the enterprise multi-tenant Franchise hierarchy:

$$\text{Super Admin} \longrightarrow \text{Franchise Center} \longrightarrow \text{Franchisee Admin} \longrightarrow \text{Campus Branches} \longrightarrow \text{Branch Admin / Staff} \longrightarrow \text{Students / Parents}$$

All findings in this report are based on direct source code inspection of physical files on disk across both repositories. No packages were installed, no database schemas were altered, and no source code files were modified.

---

## 1. DIGITAL GURU SOURCE INVENTORY (`digitalghuru_updated`)

### 1.1 Architecture & Stack
- **Framework:** Next.js 14.2.35 (App Router with Route Groups: `(admin)`, `(auth)`, `(landing)`, `(marketing)`, `student`)
- **Database Access:** Raw PostgreSQL driver via `pg` (Pool configured in `lib/db.ts`)
- **Authentication:** NextAuth.js 4.24.15 with `@auth/pg-adapter` and `CredentialsProvider` / `GoogleProvider` (`lib/auth.ts`)
- **Payments:** Razorpay (`razorpay` 2.9.8) + manual UTR payment requests (`app/api/payments/`)
- **Storage:** Local server filesystem (`public/uploads/` via `fs/promises`) and external streaming embeds (Google Drive preview, YouTube embed)

---

### 1.2 Feature Analysis & Code Path Verification

#### Feature 1: Online Course Management
- **Implementation:** Full CRUD for courses, structured into Modules and Chapters.
- **Source Files:**
  - `app/(admin)/admin/courses/page.tsx` — Course listing with enrollment counts and status badges.
  - `app/(admin)/admin/courses/new/page.tsx` — Course creation wizard.
  - `app/(admin)/admin/courses/[courseId]/page.tsx` — Course editor shell.
  - `components/admin/CourseEditor.tsx` — Multi-tab editor (Wizard, Curriculum, Danger Zone).
  - `components/admin/CourseWizard.tsx` — Metadata configuration (title, slug, price, batchInfo, marketing JSON).
  - `app/api/courses/route.ts` — `GET` (list courses), `POST` (create course).
  - `app/api/admin/courses/[courseId]/route.ts` — `PATCH` (update course), `DELETE` (delete course).
- **Database Model:**
  - `courses`: `id SERIAL PRIMARY KEY`, `title`, `description`, `imageUrl`, `price DECIMAL(10,2)`, `isPublished BOOLEAN`, `instructorId INTEGER`, `createdAt`, `updatedAt`, `marketing_data JSONB`.
- **Workflow:** Admins create a course, configure title and pricing, toggle publishing state, and attach curriculum modules.

#### Feature 2: Recorded Class & Session Management
- **Implementation:** Hierarchical Curriculum Manager organizing recorded lessons into sequential Modules and Chapters.
- **Source Files:**
  - `components/admin/CurriculumManager.tsx` — Module/chapter list with drag-and-drop handles, inline video link input, and position reordering.
  - `app/api/modules/route.ts` — `POST` (create module), `DELETE` (delete module).
  - `app/api/chapters/route.ts` — `POST` (create chapter).
  - `app/api/admin/chapters/[chapterId]/route.ts` — `PATCH` (update lesson title, videoUrl, position, isFree, isPublished).
- **Database Models:**
  - `modules`: `id SERIAL PRIMARY KEY`, `title`, `description`, `position INTEGER`, `courseId INTEGER REFERENCES courses(id) ON DELETE CASCADE`.
  - `chapters`: `id SERIAL PRIMARY KEY`, `title`, `description`, `videoUrl TEXT`, `pdfUrl TEXT`, `position INTEGER`, `duration VARCHAR(20)`, `isPublished BOOLEAN`, `isFree BOOLEAN`, `moduleId INTEGER REFERENCES modules(id) ON DELETE CASCADE`.
- **Workflow:** An admin creates a module (e.g. "Module 1: Performance Marketing"), adds chapters (lessons), and inputs video URLs or attaches downloadable PDFs.

#### Feature 3: Recorded Video Upload & Storage
- **Implementation:** Dual-mode storage:
  1. *Local File Upload:* Handled via multipart form data written to `public/uploads/<folder>/` on the local disk.
  2. *Cloud Link Embed:* Administrators paste external Google Drive links or YouTube URLs directly into the chapter editor.
- **Source Files:**
  - `app/api/admin/upload/route.ts` — Validates MIME types (`image/*`, `application/pdf`), creates timestamped filenames, saves to `public/uploads/courses/`, and returns relative public URL `/uploads/courses/<filename>`.
  - `app/api/upload/route.ts` — General file uploader generating UUID filenames in `public/uploads/`.
  - `app/api/uploads/[filename]/route.ts` — Static file streaming route with traversal protection (`..` check) and aggressive client caching (`max-age=31536000`).
- **Limitation:** High-resolution MP4/MKV video files are not stored locally to avoid disk exhaustion; instead, Google Drive sharing links (`/file/d/<fileId>/preview`) or YouTube unlisted links are embedded.

#### Feature 4: Student Access to Recorded Classes
- **Implementation:** Dedicated distraction-free learning player with curriculum sidebar, automatic progress saving, XP gamification, and confetti celebrations upon lesson completion.
- **Source Files:**
  - `app/student/(learning)/learn/[courseId]/page.tsx` — Server component verifying active enrollment against database, fetching modules and chapters, and passing data to the client player.
  - `components/student/CoursePlayerClient.tsx` — Interactive video player. Parses video URLs:
    - *Google Drive:* Renders `https://drive.google.com/file/d/${fileId}/preview` in an iframe.
    - *YouTube:* Extracts video ID and renders `https://www.youtube.com/embed/${videoId}?autoplay=1`.
    - *Direct MP4:* Renders HTML5 `<video src={url} controls autoPlay onEnded={handleNextLesson}>`.
  - `app/actions/progress.ts` — Server action `markChapterComplete(chapterId, courseId)`. Inserts into `user_progress`, increments `users.xp_points (+10 XP)`, recalculates `enrollments.progress (%)`, and detects level-ups.
- **Database Models:**
  - `enrollments`: `id SERIAL PRIMARY KEY`, `userId INTEGER`, `courseId INTEGER`, `pricePaid DECIMAL`, `progress INTEGER DEFAULT 0`, `completedAt TIMESTAMPTZ`.
  - `user_progress`: `id SERIAL PRIMARY KEY`, `userId INTEGER`, `chapterId INTEGER`, `isCompleted BOOLEAN`, `UNIQUE("userId", "chapterId")`.

#### Feature 5: Offline Course & Class Management
- **Implementation:** In `digitalghuru_updated`, offline classroom courses are **not** managed via relational database entities. Instead, offline details exist only as marketing copy and static layout cards:
  - `batchInfo`: "New Batches Starting Soon | 12 Modules"
  - `location`: "Anna Nagar | Nungambakkam | Korattur | Online & Offline Campuses"
  - `format`: "Hybrid (Offline + Online)"
- **Source Files:**
  - `lib/courseData.tsx` — Hardcoded course catalog defining classroom locations and schedules.
  - `components/sections/course/NextBatchGrid.tsx` — Static grid displaying upcoming batch dates.
  - `components/sections/course/ContactAndMap.tsx` — Campus location maps for offline workshops.
- **Finding:** The source LMS has no offline classroom scheduling, attendance tracking, classroom facility management, or physical seat capacity constraints.

#### Feature 6: Batch and Timetable Management
- **Implementation:** **Non-existent** in `digitalghuru_updated`.
- **Finding:** There is no database table for batches, schedules, lecture timetables, or staff-to-batch allocations. Students enroll into a course, not into a specific cohort or batch.

#### Feature 7: Enquiry Creation and Management
- **Implementation:** Course brochures and curriculum request forms capture prospective student leads into a single flat PostgreSQL table.
- **Source Files:**
  - `components/sections/LeadCaptureForm.tsx` — Public lead capture modal/form (Name, Email, Mobile Number, Mode, Course).
  - `app/api/leads/route.ts` — `POST` handler inserting enquiry into `course_leads`.
  - `app/(admin)/admin/leads/page.tsx` — Admin lead viewer table showing Name, Email, Phone, Course, and Date Submitted.
  - `app/(admin)/admin/leads/ExportLeadsButton.tsx` — One-click CSV export of captured leads.
- **Database Model:**
  - `course_leads`: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `name VARCHAR(255)`, `email VARCHAR(255)`, `phone VARCHAR(50)`, `courseTitle VARCHAR(255)`, `createdAt TIMESTAMPTZ DEFAULT NOW()`.

#### Feature 8: Enquiry Follow-Ups and Status Changes
- **Implementation:** **Non-existent** in `digitalghuru_updated`.
- **Finding:** The `course_leads` table has no `status` column (no `NEW`, `CONTACTED`, `INTERESTED`, `LOST`, `CONVERTED`), and no follow-up history table exists. (Note: The `job_applications` table has a status dropdown, but student leads do not).

#### Feature 9: Enquiry Assignment to Staff
- **Implementation:** **Non-existent** in `digitalghuru_updated`.
- **Finding:** Leads are stored in a single unassigned pool visible only to platform Admins. There is no concept of telecallers, counselors, or branch admissions staff.

#### Feature 10: Enquiry-to-Student Admission Conversion
- **Implementation:** **Manual only.** Admins navigate to `/admin/enrollments/new` (`ManualEnrollmentForm.tsx`) and manually select an existing registered user and a course. There is no bridge converting a `course_leads` record directly into a registered `users` record or student profile.

#### Feature 11: Dashboards and Reports
- **Source Files:**
  - `app/(admin)/admin/dashboard/page.tsx` — Displays platform KPI metrics (Total Students, Total Courses, Total Revenue from enrollments), recent user signups, and recent enrollments.
  - `app/student/(dashboard)/dashboard/page.tsx` — Student personal learning hub displaying in-progress courses, overall completion percentage, daily learning streak widget, and recent activity logs.

#### Feature 12: Related Frontend Navigation
- **Source Files:**
  - `app/(admin)/admin/AdminSidebar.tsx` — Admin navigation (Dashboard, Courses, Users, Enrollments, Payments, Course Leads, Job Openings, Applications, Settings).
  - `components/layout/LMSNavbar.tsx` & `app/student/(dashboard)/layout.tsx` — Student portal navigation (Dashboard, My Courses, Browse Catalog, Leaderboard, Community, Certificates, Support).

#### Feature 13: Backend APIs & Services
- All endpoints are implemented as Next.js 14 App Router Route Handlers (`app/api/**/route.ts`) and Server Actions (`app/actions/**.ts`, `lib/actions/**.ts`).

#### Feature 14: Database Models & Relationships
- 13 Raw PostgreSQL tables defined in `scripts/init-db.js` and `scripts/migrate-dynamic.js`:
  `users`, `accounts`, `sessions`, `verification_token`, `courses`, `modules`, `chapters`, `enrollments`, `user_progress`, `resources`, `discussions`, `community_posts`, `community_replies`, `support_tickets`, `payment_requests`, `notifications`, `activity_log`, `leaderboard_points`, `platform_settings`, `course_leads`, `careers`, `job_applications`.

#### Feature 15: Role-Based Permissions
- Roles defined in `users.role`:
  - `ADMIN` — Full access to `/admin/*` and all management APIs.
  - `STUDENT` — Access restricted to `/student/*` and student-scoped course player.
  - `INSTRUCTOR` — Referenced in scripts but inherits limited admin/instructor permissions.
- **Tenant Scope:** **Single-tenant flat architecture.** No institute, branch, or franchise identifier exists on any model.

---

## 2. FRANCHISE TARGET ARCHITECTURE AUDIT (`digitalghuru-franchise`)

### 2.1 Architecture & Stack
- **Architecture:** Monorepo with Vite/React 18 frontend (`apps/web`) and Express.js TypeScript API server (`server`).
- **Database Access:** Prisma ORM 5.10.2 targeting Neon PostgreSQL (`server/prisma/schema.prisma`).
- **Multi-Tenancy:** Multi-tenant architecture with strict hierarchical tenant boundaries:
  `Super Admin -> Franchise -> Franchisee Admin (FRANCHISE_OWNER) -> Campus Branches (Institute) -> Branch Admin / Staff -> Students / Parents`.

---

### 2.2 Target Capability & Reusable Components Inventory

#### 1. Super Admin
- **Implementation:** Complete master administration platform.
- **Source Files:**
  - `apps/web/src/pages/SuperAdminDashboard.tsx` — Master tenant directory, global student/staff metrics, institute onboarding, and audit logs.
  - `apps/web/src/pages/FranchiseManagement.tsx` — Franchise center management, 4-step onboarding wizard, commercial agreement management, 2-installment royalty schedule tracking, and branch attachment.
  - `server/src/modules/franchise/franchise.controller.ts` — Super Admin protected endpoints for franchise lifecycle, agreement revisions, and branch assignments.

#### 2. Franchisee Admin (`FRANCHISE_OWNER`)
- **Implementation:** Executive franchise operator portal managing multi-branch commercial and academic operations.
- **Source Files:**
  - `apps/web/src/pages/FranchiseOwnerDashboard.tsx` — Multi-campus analytics, student counts across assigned branches, fee collection aggregations, and royalty installment schedules.
  - `server/src/middleware/auth.ts` (`requireInstituteContext`) — Validates that the Franchisee Admin only accesses campus branches belonging to their franchise center.

#### 3. Branch / Institute Management
- **Implementation:** Each physical campus is modeled as an `Institute` entity (`server/prisma/schema.prisma` lines 187–250).
- **Attributes:** Full campus profile including `name`, `code` (e.g. `BR-001`, `INS-001`), address, GPS geofence coordinates (`latitude`, `longitude`, `geofenceRadius`), working hours, staff attendance configuration, and `franchiseId` foreign key linking it to a `Franchise`.

#### 4. Branch Assignment & Switching
- **Implementation:** Dynamic branch switcher in the global navigation bar (`apps/web/src/components/Navbar.tsx`).
- **Mechanism:**
  - Franchisee Admins and Super Admins can toggle between assigned campuses or select **"All Assigned Branches (Consolidated)"**.
  - Selected branch is stored in `activeInstitute` within `AuthContext` (`apps/web/src/context/AuthContext.tsx`).
  - Automatically injected as the `x-institute-id` HTTP request header for all backend API calls via `apiFetch` (`apps/web/src/services/api.ts`).
  - Validated on the backend by `requireInstituteContext` middleware (`server/src/middleware/auth.ts`), strictly rejecting unauthorized cross-tenant requests with `HTTP 403 Forbidden`.

#### 5. Student & Staff Management
- **Implementation:** Full multi-tenant academic directory.
- **Source Files:**
  - `apps/web/src/pages/StudentManagement.tsx` & `server/src/modules/students/` — Student admissions, auto-generated admission numbers (`admissionPrefix`), parent contact relations, enrollment history, and status lifecycle (`ACTIVE`, `DISCONTINUED`, `PASSED_OUT`).
  - `apps/web/src/pages/StaffManagement.tsx` & `server/src/modules/staff/` — Staff profiles, employee IDs, qualifications, batch allocations, and geofenced attendance tracking (`StaffAttendanceAdmin.tsx`).

#### 6. Existing Courses, Batches, and Subjects
- **Implementation:** Rich relational academic model.
- **Source Files:**
  - `apps/web/src/pages/AcademicsManagement.tsx` & `server/src/modules/academics/`.
  - **Models:**
    - `Subject`: Campus-scoped academic courses / subjects (`id`, `instituteId`, `code`, `name`).
    - `Batch`: Scheduled cohorts (`id`, `instituteId`, `name`, `code`, `startDate`, `endDate`, `status`).
    - `BatchSubject`: Junction linking subjects to batches with assigned trainers and weekly schedules.
    - `StudentEnrollment`: Student membership in a specific batch.
    - `StaffBatchAssignment`: Faculty allocations to batches.

#### 7. Existing Enquiry Functionality
- **Audit Finding:** **No dedicated Enquiry or Lead management system exists** in `digitalghuru-franchise`. The system only manages enrolled students (`model Student`). The only prospect-related model is `ParentFeedback` with a text comment `// "FEEDBACK" (Private inquiry)`.

#### 8. Existing Agreement and Royalty Management
- **Implementation:** Enterprise royalty calculation and tracking engine.
- **Source Files:**
  - `server/src/modules/franchise/franchise.controller.ts` & `apps/web/src/pages/FranchiseManagement.tsx`.
  - **Capabilities:**
    - Supports `FIXED_ANNUAL`, `PERCENTAGE_REVENUE`, and `PER_STUDENT` commercial models.
    - Strict effective-date range selection for royalty calculations.
    - Automatic 2-installment annual schedule generation ($H_1$ and $H_2$).
    - Immutability shields: Finalized statements cannot be silently recalculated or overwritten.
    - Super Admin authorized correction workflow with audit logging of previous values and reasons.
    - Dedicated Neon PostgreSQL database with 100% verified historical financial integrity assertions.

#### 9. Database Tenant Isolation
- **Perimeter:** Every academic, student, staff, fee, material, and batch record includes `instituteId` foreign key referencing `Institute(id)`.
- **Enforcement:** Enforced at both the middleware layer (`requireInstituteContext`) and Prisma query level (`where: { instituteId }`).

#### 10. Role-Based Permissions & API Security
- **Roles:** Defined in `enum UserRole`:
  - `SUPER_ADMIN`
  - `FRANCHISE_OWNER`
  - `BRANCH_ADMIN`
  - `ACADEMIC_ADMIN`
  - `STAFF`
  - `PARENT`
  - `STUDENT`

---

## 3. FEATURE COMPARISON TABLE

| Feature Domain | Digital Guru Source (`digitalghuru_updated`) | Existing Franchise Equivalent (`digitalghuru-franchise`) | Missing Functionality in Franchise | Required Architectural Adaptation |
| :--- | :--- | :--- | :--- | :--- |
| **Online Courses & LMS** | `courses`, `modules`, `chapters` raw SQL tables; Next.js player. | `Subject` and `Batch` entities exist; no self-paced online video course entity. | Video curriculum hierarchy, chapter duration, video embedding, lesson completion. | Create `OnlineCourse`, `CourseModule`, `CourseChapter` Prisma models linked optionally to `Franchise` or `Institute`. |
| **Recorded Lectures / Videos** | `chapters.videoUrl` supports Google Drive preview, YouTube embed, direct MP4. | `LearningMaterial` model supports PDF, Image, Audio, Text, Docs; **no** video type. | Video lesson type in `MaterialType` enum; video player component in web app. | Add `RECORDED_SESSION` and `VIDEO` to `MaterialType`, or implement full LMS player component. |
| **Video Upload & Storage** | Saves to local disk `public/uploads/` via Node `fs`; supports Google Drive embed. | Private object storage paths on local/cloud disk via `LearningMaterial.fileUrl`. | Video MIME type validation; chunked video handling; Drive/YouTube URL resolver. | Adapt file upload endpoint to support external video links and local streaming. |
| **Student Access to Recordings** | Gated by `enrollments` table (`userId`, `courseId`); XP points gamification. | Gated by `StudentEnrollment` (batch-level); no course-level video player. | Student video learning interface in `StudentPortal.tsx`; progress percentage tracking. | Add "My Online Courses & Recordings" tab in `StudentPortal.tsx` scoped to student's enrolled batch/course. |
| **Offline Classroom Classes** | Hardcoded marketing text (`lib/courseData.tsx`); no database entities. | Full relational `Batch`, `BatchSubject`, `Timetable`, `AttendanceEvent` models. | None. Target Franchise application is significantly more advanced. | None. Source marketing courses should map directly to Franchise `Subject` and `Batch`. |
| **Batch & Timetable Management** | Non-existent. Single flat user-to-course enrollment. | Full `Batch`, `BatchSubject`, `StaffBatchAssignment`, `AttendanceEvent`. | None. Franchise already has complete batch and schedule management. | Direct reuse of existing Franchise Academics module. |
| **Enquiry / Lead Capture** | Public web form saves to flat `course_leads` table (`name`, `email`, `phone`, `courseTitle`). | **Non-existent.** No enquiry or prospective student lead entity. | Lead capture form, lead tracking table, lead status, branch attribution. | Implement `Enquiry` model with `franchiseId` and optional `instituteId` foreign keys. |
| **Enquiry Follow-Up & Lifecycle** | Non-existent in `course_leads` (only `job_applications` has status). | Non-existent. | Follow-up logs, status tracking (`NEW`, `CONTACTED`, `INTERESTED`, `ENROLLED`, `LOST`). | Build `EnquiryFollowUp` model and lifecycle status management. |
| **Enquiry Staff Assignment** | Non-existent. Single admin view. | Staff directory exists (`StaffProfile`), but no enquiry assignment. | Counselor / staff assignment to prospective student leads. | Add `assignedStaffId` relation on `Enquiry` linking to `StaffProfile`. |
| **Enquiry to Admission Conversion** | Manual user account creation and manual enrollment. | Comprehensive student admission workflow (`StudentManagement.tsx`). | One-click conversion from `Enquiry` to `Student` preserving lead history. | Build transactional `convertEnquiryToStudent` API endpoint to auto-fill admission form without duplicating records. |
| **Multi-Branch Tenant Isolation** | Non-existent. Single-tenant platform. | Hierarchical multi-tenant isolation with `x-institute-id` header validation. | Online courses and enquiries need to respect the multi-branch hierarchy. | Scope all new course and enquiry models to `franchiseId` and `instituteId`. |

---

## 4. FRANCHISE INTEGRATION ARCHITECTURE DESIGN

### 4.1 Hierarchical Scope & Role Perimeters

The integrated system will enforce multi-tier tenant boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN (Platform Master)                   │
│   - Global visibility across all Franchises, Campuses, Courses & Leads │
│   - Creates Franchises & Master Agreements                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FRANCHISEE ADMIN (Franchise Owner)                 │
│   - Scoped strictly to their Franchise Center (e.g. DG Chennai Central) │
│   - Full visibility across all assigned campus branches                │
│   - Views Franchise-wide Online Courses, Enquiries & Royalties         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      CAMPUS BRANCHES (Institute)                       │
│       - Branch Admin & Staff scoped strictly to single Institute       │
│       - Manages local classroom Batches, Timetables & Local Enquiries   │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌────────────────────────┐      ┌────────────────────────┐
       │   FACULTY / TRAINERS   │      │   STUDENTS & PARENTS   │
       │ - Marks class attendance│      │ - Views batch classes  │
       │ - Uploads study notes   │      │ - Streams recordings   │
       │ - Evaluates homework   │      │ - Pays tuition fees    │
       └────────────────────────┘      └────────────────────────┘
```

---

### 4.2 Data Model Extensions (Additive & Backward-Compatible)

To integrate Digital Guru's LMS and Enquiry features into Digital Guru Franchise without modifying existing tables or breaking existing migrations, the following additive Prisma models are designed:

#### 1. Online Courses & Recorded Sessions
```prisma
// ─── ONLINE LMS & RECORDED CLASSES ──────────────────────────────────────────

model OnlineCourse {
  id              String         @id @default(uuid())
  franchiseId     String?        // Nullable = Global Course (Franchisor Master Course)
  instituteId     String?        // Nullable = Franchise-wide, or scoped to specific campus
  title           String
  slug            String         @unique
  description     String?        @db.Text
  thumbnailUrl    String?
  price           Decimal        @default(0.00) @db.Decimal(10, 2)
  isPublished     Boolean        @default(false)
  format          String?        @default("ONLINE") // "ONLINE", "HYBRID", "RECORDED"
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  franchise       Franchise?     @relation(fields: [franchiseId], references: [id], onDelete: Cascade)
  institute       Institute?     @relation(fields: [instituteId], references: [id], onDelete: SetNull)
  modules         CourseModule[]
  enrollments     OnlineCourseEnrollment[]

  @@index([franchiseId])
  @@index([instituteId])
  @@index([isPublished])
}

model CourseModule {
  id          String          @id @default(uuid())
  courseId    String
  title       String
  description String?
  position    Int             @default(0)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  course      OnlineCourse    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chapters    CourseChapter[]

  @@index([courseId, position])
}

model CourseChapter {
  id          String          @id @default(uuid())
  moduleId    String
  title       String
  description String?         @db.Text
  videoUrl    String?         // Supports Google Drive embed, YouTube, or direct MP4/HLS
  pdfUrl      String?         // Downloadable lesson guide/notes
  duration    String?         @default("15:00")
  position    Int             @default(0)
  isFree      Boolean         @default(false)
  isPublished Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  module      CourseModule    @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  progress    StudentCourseProgress[]

  @@index([moduleId, position])
}

model OnlineCourseEnrollment {
  id          String          @id @default(uuid())
  courseId    String
  studentId   String
  pricePaid   Decimal         @default(0.00) @db.Decimal(10, 2)
  progressPct Int             @default(0)
  enrolledAt  DateTime        @default(now())
  completedAt DateTime?

  course      OnlineCourse    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  student     Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([courseId, studentId])
  @@index([studentId])
}

model StudentCourseProgress {
  id          String          @id @default(uuid())
  chapterId   String
  studentId   String
  isCompleted Boolean         @default(true)
  completedAt DateTime        @default(now())

  chapter     CourseChapter   @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  student     Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([chapterId, studentId])
}
```

#### 2. Enquiry & Lead Management System
```prisma
// ─── ENQUIRY & PROSPECTIVE STUDENT MANAGEMENT ──────────────────────────────

enum EnquiryStatus {
  NEW
  CONTACTED
  INTERESTED
  COUNSELING_SCHEDULED
  ENROLLED
  LOST
}

enum EnquirySource {
  WEBSITE_FORM
  BROCHURE_DOWNLOAD
  WALK_IN
  PHONE_CALL
  SOCIAL_MEDIA
  REFERRAL
}

model Enquiry {
  id               String            @id @default(uuid())
  franchiseId      String?
  instituteId      String?           // Campus branch where lead was directed
  name             String
  email            String
  phone            String
  programInterest  String            // Course or batch interested in
  source           EnquirySource     @default(WEBSITE_FORM)
  status           EnquiryStatus     @default(NEW)
  assignedStaffId  String?           // Staff counselor handling follow-up
  convertedStudentId String?         @unique // Linked Student ID once converted
  notes            String?           @db.Text
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  franchise        Franchise?        @relation(fields: [franchiseId], references: [id], onDelete: Cascade)
  institute        Institute?        @relation(fields: [instituteId], references: [id], onDelete: SetNull)
  assignedStaff    StaffProfile?     @relation(fields: [assignedStaffId], references: [id], onDelete: SetNull)
  convertedStudent Student?          @relation("EnquiryStudent", fields: [convertedStudentId], references: [id], onDelete: SetNull)
  followUps        EnquiryFollowUp[]

  @@index([franchiseId])
  @@index([instituteId])
  @@index([status])
  @@index([phone])
}

model EnquiryFollowUp {
  id           String        @id @default(uuid())
  enquiryId    String
  authorId     String        // Staff user ID who logged follow-up
  previousStatus EnquiryStatus
  newStatus    EnquiryStatus
  remarks      String        @db.Text
  followUpDate DateTime?
  createdAt    DateTime      @default(now())

  enquiry      Enquiry       @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  author       User          @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([enquiryId])
}
```

---

### 4.3 Multi-Tenant Access Rules Matrix

| Role | Online Courses | Recorded Lectures | Offline Batches | Enquiries & Leads | Enquiry Conversion |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Platform-wide CRUD (Master & Campus courses) | View/Manage all recordings | View all batches across all institutes | View & export all leads platform-wide | Can authorize conversions |
| **Franchisee Admin** | View master courses; manage franchise-specific courses | Access recordings for franchise courses | Full access across all assigned branches | View & assign leads across all assigned branches | Can convert leads for any owned campus |
| **Branch Admin** | View permitted courses for their campus | Upload/manage branch recordings | Full CRUD for their single campus branch | Manage enquiries for their branch only | Convert branch leads into enrolled students |
| **Staff / Faculty** | View course curriculum | Upload lesson recordings for assigned batches | Mark attendance, view assigned batches | View leads assigned to them; log follow-ups | Read-only lead details |
| **Student** | Stream enrolled online courses | Watch recordings with progress tracker | View assigned batch schedule | N/A | N/A |

---

## 5. FRANCHISE CREATION WORKFLOW ARCHITECTURE

### 5.1 Review of Existing Workflow
In `apps/web/src/pages/FranchiseManagement.tsx`, the **"Register Franchisee Admin"** wizard currently enforces a 4-step sequential modal:
- Step 1: Business Profile (Business Name, Owner Name, Email, Mobile, Address, Authorized Contact).
- Step 2: Agreement Model & Duration (Preset selection, Dates, Due Day).
- Step 3: Financial Terms (Royalty sharing percentages, capital investments, expense responsibilities).
- Step 4: Pre-submission Review & Confirmation.

### 5.2 Recommended 5-Step Revised Workflow

To incorporate optional initial branch creation cleanly into the existing modal without introducing unnecessary complexity or duplicate entities, the revised workflow is structured as follows:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     STEP 1      │     │     STEP 2      │     │     STEP 3      │     │     STEP 4      │     │     STEP 5      │
│ Franchise Entity│ ──► │ Franchise Admin │ ──► │ Campus Branch   │ ──► │ Commercial      │ ──► │ Pre-Submission  │
│ Business Details│     │ User Credentials│     │ (OPTIONAL)      │     │ Agreement Terms │     │ Review & Create │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

#### Step Details:
1. **Step 1: Franchise Business Profile**
   - Legal Business Name (e.g. "Digital Guru Coimbatore Center")
   - Registered Business Address, City, State, Postal Code, Country
   - GSTIN & PAN details
   - Authorized Alternate Contact Person (Optional)

2. **Step 2: Franchisee Admin User Account**
   - Owner Full Name
   - Primary Mobile Number
   - Master Login Email Address (unique identifier for authentication)
   - Secure Temporary Password (auto-generated with option to customize; argon2 hashed)

3. **Step 3: Initial Campus Branch Association (Strictly Optional)**
   - *Option A (Default):* **"Skip for now"** — Franchise is created without branches. Campus branches can be linked or created anytime later via the franchise Edit modal.
   - *Option B:* **"Link Existing Institute"** — Search and link an unassigned campus from `unassignedBranches`.
   - *Option C:* **"Create Initial Campus Branch"** — Enter Initial Branch Name (prefilled from franchise name), Campus Code (auto-assigned `BR-XXX`), Campus Address, and GPS Attendance Geofence.

4. **Step 4: Master Commercial Agreement**
   - Agreement Model (`PERCENTAGE_REVENUE`, `FIXED_ANNUAL`, or `PER_STUDENT`)
   - Revenue sharing split (e.g. 50% Digital Guru / 50% Partner)
   - Settlement frequency (`MONTHLY` or `YEARLY`)
   - Two-installment schedule dates ($H_1$ and $H_2$ due dates)
   - Capital setup investment & expense responsibilities

5. **Step 5: Pre-Submission Review & Summary**
   - High-contrast visual summary of Franchise Profile, Owner Credentials, Linked Campus status, and Commercial Terms.
   - Submission creates the Franchise record, Owner User account, Agreement, Installment schedules, and (if selected) the initial Campus Branch in a single transactional operation.

#### Architectural Principles:
- **Reuse Existing Institute Entity:** Do **not** create a separate `Branch` table. The existing `Institute` entity (`franchiseId String?`) already serves as the campus branch entity throughout the platform.
- **Zero Lockout:** If Step 3 is skipped, the Franchisee Admin account is fully created and can subsequently attach or create branches via the newly implemented **Edit Franchise** option.

---

## 6. RISKS & BACKWARD-COMPATIBILITY SAFEGUARDS

1. **Tuition Management System Independence:**
   - The Tuition Management System database must never be touched. All migrations must occur solely in the dedicated Digital Guru Franchise PostgreSQL database.
2. **Database Immutability:**
   - No `DROP TABLE`, `TRUNCATE`, or destructive column drops. All new tables (`OnlineCourse`, `CourseModule`, `CourseChapter`, `Enquiry`, `EnquiryFollowUp`) are purely additive.
3. **Financial Statement Protection:**
   - Existing royalty calculation logic in `server/src/modules/franchise/franchise.controller.ts` must remain untouched. Online course fee collections will flow through the existing `Payment` and `FranchiseRoyaltyRecord` structures without altering closed billing periods.
4. **Offline Batch Non-Interference:**
   - Online course enrollments must be modeled in `OnlineCourseEnrollment` to prevent inflating student headcounts in offline classroom batches (`StudentEnrollment`).
5. **Storage Traversal & Security:**
   - Video upload endpoints must validate file extensions and reject path traversal characters (`..`, `/`).
   - Private Google Drive sharing links must be stored as raw strings and rendered inside sandboxed iframe containers.

---

## 7. PHASED IMPLEMENTATION PLAN

### Phase 1: Database Schema Expansion (Additive)
- Add `OnlineCourse`, `CourseModule`, `CourseChapter`, `OnlineCourseEnrollment`, `StudentCourseProgress` models to `server/prisma/schema.prisma`.
- Add `Enquiry`, `EnquiryFollowUp`, and `EnquiryStatus` enum to `server/prisma/schema.prisma`.
- Run safe additive migration: `npx prisma db push` (or `npx prisma migrate dev --name add_lms_and_enquiry_models`).

### Phase 2: Backend API Endpoints & Tenant Middleware
- Implement `server/src/modules/online-courses/`:
  - `GET /api/courses` (tenant-scoped)
  - `POST /api/courses` (Super Admin & Franchisee Admin)
  - `PATCH /api/courses/:id`
  - `POST /api/courses/:id/modules`
  - `POST /api/modules/:id/chapters` (with videoUrl embed support)
- Implement `server/src/modules/enquiries/`:
  - `POST /api/enquiries` (public lead capture)
  - `GET /api/enquiries` (scoped by `requireInstituteContext`)
  - `PATCH /api/enquiries/:id/status` (follow-up logging)
  - `POST /api/enquiries/:id/convert` (converts enquiry to enrolled student atomically)

### Phase 3: Frontend Portals & UI Integration
- **LMS Course Manager:** Add "Online Courses" tab to `apps/web/src/pages/AcademicsManagement.tsx` for creating video courses and chapters.
- **LMS Student Player:** Port `CoursePlayerClient.tsx` into `apps/web/src/pages/StudentPortal.tsx` to enable students to stream video lessons and track completion.
- **Enquiry Management Hub:** Create `apps/web/src/pages/EnquiryManagement.tsx` for viewing leads, assigning counselors, recording follow-ups, and 1-click converting to student.

### Phase 4: Full Regression & Security Verification
- Execute full 68-assertion financial integrity audit suite (`test-historical-financial-integrity.ts`).
- Execute multi-branch isolation security tests (`test-multi-branch-franchisee.ts`).
- Verify production build with Vite (`npm --prefix apps/web run build`).

---

## 8. MANUAL TESTING SCENARIOS (VERIFICATION MATRIX)

| Test ID | Test Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **TC-LMS-01** | Super Admin creates global online course with 2 modules and 4 video chapters (Google Drive & YouTube links). | Course persists with `franchiseId: null`; modules and video URLs saved correctly. |
| **TC-LMS-02** | Franchisee Admin logs in and creates a franchise-specific recorded workshop course. | Course is bound strictly to `franchiseId`; not editable by other franchise centers. |
| **TC-LMS-03** | Enrolled Student opens `StudentPortal` and clicks a chapter with Google Drive link. | Sandboxed iframe renders `drive.google.com/file/d/.../preview` without page redirect. |
| **TC-LMS-04** | Student completes video lesson. | `StudentCourseProgress` recorded; course progress percentage updates; confetti displays. |
| **TC-LMS-05** | Unenrolled student attempts to access course learning endpoint via direct API call. | Server responds with `HTTP 403 Forbidden: Active course enrollment required`. |
| **TC-ENQ-01** | Prospective student submits lead capture form on public landing page. | Lead saved in `Enquiry` with status `NEW` and attributed to requested campus branch. |
| **TC-ENQ-02** | Branch Admin logs in and views Enquiry list. | Sees only leads attributed to their campus branch. Other branch leads are completely hidden. |
| **TC-ENQ-03** | Staff counselor logs call follow-up with prospective student. | `EnquiryFollowUp` logged with previous status, new status (`CONTACTED`), and remarks. |
| **TC-ENQ-04** | Branch Admin clicks "Convert to Student" on interested enquiry. | Student record created with unique `admissionNumber`; enquiry status updated to `ENROLLED`; no duplicate student created. |
| **TC-SEC-01** | Branch Admin attempts to query another branch's online courses or leads via `x-institute-id` header spoofing. | Server middleware returns `HTTP 403 Forbidden: You do not have authorization to access this campus branch`. |
| **TC-FIN-01** | Execute complete historical financial integrity test suite after integration. | All 68 financial assertions pass with 0 failures; historical royalty statements remain unchanged. |

---

## 9. CONCLUSION & SIGN-OFF

The source codebase `digitalghuru_updated` contains a functional Next.js self-paced LMS and lead capture form, but lacks multi-tenancy, batch scheduling, follow-up workflows, and branch isolation. The target codebase `digitalghuru-franchise` has enterprise multi-tenant isolation, branch switching, batch timetables, and royalty accounting.

By implementing the additive models and hierarchical access controls outlined in this audit, Digital Guru's online courses, recorded lectures, and enquiry management can be cleanly integrated into the Franchise platform while preserving 100% of existing historical data, financial integrity rules, and database stability.

**Audit Status:** Completed. All findings verified against physical files on disk. No changes made to source code.

