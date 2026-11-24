# Digital Guru Franchise – Website to Mobile Feature Parity Matrix

**Document:** `docs/website-to-mobile-feature-matrix.md`  
**Branch:** `feat/mobile-role-redesign`  
**Date:** November 24, 2026  
**Status:** Complete Feature Mapping  

---

## 1. Feature Parity Matrix Overview

This matrix maps every website module from the live Digital Guru Franchise web platform (`apps/web` & `server/src/modules`) to the mobile application (`apps/mobile`), specifically focusing on the three authorized mobile personas:
* **Student** (Mobile Portal)
* **Parent** (Mobile Portal)
* **Teacher** (Mobile Portal)

*(Note: Administrative management features for Franchise Owner, Super Admin, and Academic Admin remain exclusive to the desktop web portal due to complex table grids and system configuration requirements).*

---

## 2. Feature Mapping & Parity Table

| Website Module | Web Route & Component | Role | Mobile Equivalent Screen | Real API Endpoint | Parity Status | Required Mobile Implementation / Enhancement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `/login` (`Login.tsx`) | All | `LoginScreen.tsx` | `POST /api/auth/login` | **Complete** | Split-hero design with deep navy background, rounded bottom panel, segmented role switcher, 1-tap demo credentials drawer. |
| **Session Restore** | App init (`AuthContext.tsx`) | All | `RootNavigator.tsx` | `GET /api/auth/me` & `POST /api/auth/refresh` | **Complete** | Branded splash screen with official logo and animated spinner during token restoration. |
| **Student Dashboard** | `/student/portal` (`StudentPortal.tsx`) | Student | `StudentDashboardScreen.tsx` | `GET /api/students/my/dashboard` | **Complete** | ChalkChamp + Studyhall layout, logo header, metric cards, timetable snapshot, pending homework, recent study materials. |
| **Student Timetable** | `/student/portal` (`TimetableTab`) | Student | `StudentTimetableScreen.tsx` | `GET /api/students/my/timetable` | **Complete** | Horizontal weekday pill selector, live time-slotted subject cards, room and teacher tags. |
| **Student Attendance** | `/student/portal` (`AttendanceTab`) | Student | `StudentAttendanceScreen.tsx` | `GET /api/students/my/attendance-history` | **Complete** | Monthly percentage hero circle, day-by-day attendance events, check-in method badges (QR, Voice, Manual). |
| **Student Homework** | `/student/portal` (`HomeworkTab`) | Student | `StudentHomeworkScreen.tsx` | `GET /api/homework`, `POST /api/homework/:id/submit` | **Complete** | Pending vs. Submitted segment tabs, assignment deadline indicators, document/camera picker modal submission. |
| **Student Materials** | `/student/portal` (`MaterialsTab`) | Student | `StudentMaterialsScreen.tsx` | `GET /api/materials` | **Complete** | Subject category filter pills, PDF/doc attachment card launcher with in-app browser or viewer. |
| **Student Progress** | `/student/portal` (`ProgressTab`) | Student | `StudentProgressScreen.tsx` | `GET /api/students/my/dashboard` (academicProgress) | **Complete** | Recent exam marks card list, score percentages, passing status indicators. |
| **Student Profile** | `/student/portal` (`ProfileTab`) | Student | `StudentProfileScreen.tsx` | `GET /api/students/my/profile` | **Complete** | Student admission card, enrolled batch & subjects, guardian details, secure logout action. |
| **Parent Dashboard** | `/parent/portal` (`ParentDashboardView.tsx`) | Parent | `ParentDashboardScreen.tsx` | `GET /api/parents/my/dashboard-summary` | **Complete** | ChalkChamp + Verve layout, multi-child dropdown/pill switcher, attendance summary, fee status alert, quick actions. |
| **Parent Child Switching** | Active child state in parent context | Parent | `ParentDashboardScreen.tsx` & `parentStore.ts` | `GET /api/parents/my/children` | **Complete** | Reactive child selection that invalidates and refreshes all child-dependent queries (attendance, homework, fees). |
| **Parent Attendance** | `/parent/portal` (`ParentAttendanceView.tsx`) | Parent | `ParentAttendanceScreen.tsx` | `GET /api/parents/students/:id/attendance` | **Complete** | Calendar-style attendance log for selected child with punch-in/out timestamps. |
| **Parent Academics** | `/parent/portal` (`ParentTestResultsView.tsx`) | Parent | `ParentAcademicsScreen.tsx` | `GET /api/parents/students/:id/academics` | **Complete** | Subject marks cards, grading remarks, term progress evaluation. |
| **Parent Homework** | `/parent/portal` (`ParentHomeworkView.tsx`) | Parent | `ParentHomeworkScreen.tsx` | `GET /api/parents/students/:id/homework` | **Complete** | Child assignment tracker with submission verification indicators. |
| **Parent Timetable** | `/parent/portal` (`ParentTimetableView.tsx`) | Parent | `ParentTimetableScreen.tsx` | `GET /api/parents/students/:id/timetable` | **Complete** | Weekly schedule view for the currently selected child. |
| **Parent Materials** | `/parent/portal` (`ParentMaterialsView.tsx`) | Parent | `ParentMaterialsScreen.tsx` | `GET /api/materials` | **Complete** | Access to educational study resources assigned to child's enrolled batch. |
| **Parent Fees & Billing** | `/parent/portal` (`ParentFeesView.tsx`) | Parent | `ParentFeesScreen.tsx` | `GET /api/fees/students/:id/statement`, `GET /api/fees/payments` | **Complete** | Itemized invoice breakdown, due amounts, payment history, and payment gateway launcher. |
| **Parent Teacher Inquiries** | `/parent/portal` (`ParentCommunicationView.tsx`) | Parent | `ParentFeedbackScreen.tsx` | `GET /api/feedback`, `POST /api/feedback` | **Complete** | Direct messaging thread with center administration and teachers, inquiry creation modal. |
| **Parent Notifications** | `/parent/portal` (`ParentNotificationsView.tsx`) | Parent | `ParentNotificationsScreen.tsx` | `GET /api/notifications` | **Complete** | In-app notification center for institute circulars and child attendance alerts. |
| **Parent Profile** | `/parent/portal` (`ParentProfileView.tsx`) | Parent | `ParentProfileScreen.tsx` | `GET /api/parents/my/dashboard-summary` | **Complete** | Parent contact details, address, linked children list, secure sign-out. |
| **Teacher Dashboard** | Staff Home (`StaffManagement.tsx`) | Teacher | `TeacherDashboardScreen.tsx` | `GET /api/staff/my/dashboard` | **Complete** | ChalkChamp + Quillsprig layout, action buttons (Voice Attendance, Create HW, Upload Material), batch list. |
| **Teacher Batches** | `/academics` (`AcademicsManagement.tsx`) | Teacher | `TeacherBatchesScreen.tsx` | `GET /api/academics/batches` | **Complete** | Assigned class batches with student headcounts, academic year, and schedule preview. |
| **Teacher Students Roster** | `/students` (`StudentManagement.tsx`) | Teacher | `TeacherStudentsScreen.tsx` | `GET /api/staff/my/students` | **Complete** | Searchable list of students across teacher's assigned batches with status indicators. |
| **Teacher Student Details** | Student drawer in `/students` | Teacher | `TeacherStudentDetailsScreen.tsx` | `GET /api/students/:id` | **Complete** | Detailed student profile, guardian phone number, roll number, and academic record. |
| **Teacher Attendance** | `/attendance` (`AttendanceManagement.tsx`) | Teacher | `TeacherAttendanceScreen.tsx` | `GET /api/attendance/reports`, `POST /api/attendance/check-in` | **Complete** | Interactive student roll-call with one-tap toggle for Present, Absent, and Late. |
| **Teacher Voice Attendance** | Voice match tool in attendance | Teacher | `VoiceAttendanceScreen.tsx` | `POST /api/attendance/voice-match`, `POST /api/attendance/check-in` | **Complete** | Speech-to-text name recognition, backend phonetic matching, single-match auto-mark, multi-match selector. |
| **Teacher Homework Manager** | `/homework` (`HomeworkManagement.tsx`) | Teacher | `TeacherHomeworkScreen.tsx` | `GET /api/homework?batchId=...` | **Complete** | Homework list filtered by batch, submission count pill, button to create new assignment. |
| **Teacher Create Homework** | Add Homework modal in web | Teacher | `CreateHomeworkScreen.tsx` | `POST /api/homework` | **Complete** | Form with batch selector, subject, title, description, due date, max marks, and file attachment. |
| **Teacher Submissions Review** | Submissions drawer in web | Teacher | `HomeworkSubmissionsScreen.tsx` | `GET /api/homework/:id/submissions` | **Complete** | Student submissions list with submitted file links and grading status. |
| **Teacher Grade Submission** | Grading modal in web | Teacher | `EvaluateHomeworkScreen.tsx` | `PATCH /api/homework/submissions/:id/grade` | **Complete** | Grade entry (marks or letter grade), written teacher remarks, and confirmation toast. |
| **Teacher Materials Repository**| `/materials` (`MaterialsManagement.tsx`) | Teacher | `TeacherMaterialsScreen.tsx` | `GET /api/materials?batchId=...` | **Complete** | Study documents list with filter by batch/subject and delete capability. |
| **Teacher Upload Material** | Upload material modal in web | Teacher | `UploadMaterialScreen.tsx` | `POST /api/materials` | **Complete** | Material upload form with document picker, subject selector, description, and title. |
| **Teacher Timetable** | `/staff/attendance` (`StaffMyAttendance.tsx`) | Teacher | `TeacherTimetableScreen.tsx` | `GET /api/staff/my/timetable` | **Complete** | Personal weekly lecture and batch teaching timetable. |
| **Teacher Notifications** | Notification bell in web | Teacher | `TeacherNotificationsScreen.tsx` | `GET /api/notifications` | **Complete** | Staff notices and institutional alerts. |
| **Teacher Profile** | Staff profile menu | Teacher | `TeacherProfileScreen.tsx` | `GET /api/staff/my/profile` | **Complete** | Teacher employee code, assigned subjects, phone/email, and logout. |

---

## 3. Data Integrity & Live Backend Directives
1. **Zero Static Mocks in Production:** All dashboard stats, roster items, attendance lists, and homework cards connect to `https://franchise.digitalghuru.com/api` with live JWT Bearer authentication.
2. **Defensive Schema Guards:** Every API parser handles both raw arrays and nested `{ data: { [key]: [...] } }` wrappers gracefully.
3. **Tenant & Institute Context:** The `x-institute-id` header is automatically populated on every outgoing request via the Axios request interceptor.
