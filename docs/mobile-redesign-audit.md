# Digital Guru Franchise – Complete Mobile UI Redesign and Functional Architecture Audit

**Document:** `docs/mobile-redesign-audit.md`  
**Branch:** `feat/mobile-role-redesign`  
**Date:** November 24, 2026  
**Status:** Complete Architectural Baseline  

---

## 1. Executive Summary

This audit establishes the comprehensive technical baseline for redesigning the Digital Guru Franchise mobile application into a modern, fluid, glass-inspired educational enterprise client. The mobile app serves three primary user personas:
1. **Student** (Identity Accent: Modern Blue `#006FFF`)
2. **Parent** (Identity Accent: Deep/Primary Navy `#0F172A`)
3. **Teacher / Staff** (Identity Accent: Vibrant Orange `#FE4D01`)

The overhaul preserves 100% of the live backend integration with Neon PostgreSQL (`https://franchise.digitalghuru.com/api`), token lifecycle authentication, offline demo credential exploration, and institute tenant isolation.

---

## 2. Monorepo & Technology Stack Inspection

### 2.1 Workspace Structure
* **`apps/mobile`**: React Native 0.76.9 / Expo SDK 52 / React 18.3.1 / React Navigation 6 / TanStack Query v5 / Zustand v4 / Lucide React Native / Expo BlurView / Expo LinearGradient.
* **`apps/web`**: React 18.3.1 / Vite 5 / TailwindCSS / Lucide React / TanStack Query.
* **`server`**: Node.js Express / TypeScript / Prisma 5.22.0 / Neon PostgreSQL / JWT Authentication / Multer File Uploads / Razorpay Payments.
* **`packages/shared`**: Shared TypeScript types, branding tokens, and validation contracts.

### 2.2 Native Compatibility Audit
* **Expo SDK Version:** `52.0.49`
* **React Native:** `0.76.9`
* **Hermes Engine:** Enabled (`hermes` bytecode compilation active).
* **Target Android SDK:** API 36 (Android 16 compatibility confirmed).
* **Memory Page Alignment:** 16 KB page-size compatibility validated across native `.so` binaries.
* **Edge-to-Edge & Safe Areas:** Handled dynamically via `react-native-safe-area-context` (`useSafeAreaInsets` + `StatusBar.currentHeight`).
* **Visual Polish Dependencies:** `expo-blur` (`~14.0.3`) and `expo-linear-gradient` (`~14.0.2`) integrated and deduplicated under unified `react@18.3.1`.

---

## 3. Current Mobile Screen Inventory vs. Target Experience

| Role | Screen | File Path | Existing State | Redesign Objective |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | LoginScreen | `apps/mobile/src/features/auth/LoginScreen.tsx` | Standard form with role tabs | Split-hero layout with deep navy upper hero, overlapping rounded glass panel, animated role segmented selector, expandable demo drawer |
| **Student** | StudentDashboard | `apps/mobile/src/features/student/StudentDashboardScreen.tsx` | Vertical cards list | ChalkChamp + Studyhall aesthetic, glass stat pills, live schedule carousel, homework highlights, materials preview |
| **Student** | StudentTimetable | `apps/mobile/src/features/student/StudentTimetableScreen.tsx` | Tab list | Horizontal day selector pill, time-slotted timeline cards with live status badge |
| **Student** | StudentAttendance | `apps/mobile/src/features/student/StudentAttendanceScreen.tsx` | Stat box & event list | Circular progress hero, monthly attendance calendar grid, check-in method badges |
| **Student** | StudentHomework | `apps/mobile/src/features/student/StudentHomeworkScreen.tsx` | Basic filter list | Tabbed submission manager (Pending / Submitted), PDF attachment preview, modal submission uploader |
| **Student** | StudentMaterials | `apps/mobile/src/features/student/StudentMaterialsScreen.tsx` | Basic file cards | Subject filtering pills, file-type icons, direct document viewer launcher |
| **Student** | StudentProgress | `apps/mobile/src/features/student/StudentProgressScreen.tsx` | Mark list | Subject performance charts, exam score breakdown, pass/needs improvement badges |
| **Student** | StudentNotifications | `apps/mobile/src/features/student/StudentNotificationsScreen.tsx` | Simple list | Category-grouped notifications, read/unread states, deep-link triggers |
| **Student** | StudentProfile | `apps/mobile/src/features/student/StudentProfileScreen.tsx` | Contact card & logout | Student ID badge, enrollment info, parent contact link, secure logout |
| **Parent** | ParentDashboard | `apps/mobile/src/features/parent/ParentDashboardScreen.tsx` | Summary boxes | ChalkChamp + Verve aesthetic, active child switcher pill, attendance & fee alert hero |
| **Parent** | ParentAttendance | `apps/mobile/src/features/parent/ParentAttendanceScreen.tsx` | Calendar list | Child attendance overview, monthly calendar view, check-in/out timestamps |
| **Parent** | ParentAcademics | `apps/mobile/src/features/parent/ParentAcademicsScreen.tsx` | Marks table | Academic progress tracker, report card downloader, teacher remarks |
| **Parent** | ParentHomework | `apps/mobile/src/features/parent/ParentHomeworkScreen.tsx` | HW list | Homework tracking for linked child, submission status indicator |
| **Parent** | ParentTimetable | `apps/mobile/src/features/parent/ParentTimetableScreen.tsx` | Timetable list | Child's weekly schedule with live subject timings |
| **Parent** | ParentMaterials | `apps/mobile/src/features/parent/ParentMaterialsScreen.tsx` | File list | Access to child's study material repository |
| **Parent** | ParentFees | `apps/mobile/src/features/parent/ParentFeesScreen.tsx` | Fee summary | Itemized fee statement, payment receipts, payment portal redirect |
| **Parent** | ParentFeedback | `apps/mobile/src/features/parent/ParentFeedbackScreen.tsx` | Feedback list | Direct inquiry form to teachers/center admin with reply threads |
| **Parent** | ParentNotifications | `apps/mobile/src/features/parent/ParentNotificationsScreen.tsx` | Notification list | Center announcements, attendance alerts, child-specific notices |
| **Parent** | ParentProfile | `apps/mobile/src/features/parent/ParentProfileScreen.tsx` | Profile card | Parent contact info, linked children list, security options |
| **Teacher** | TeacherDashboard | `apps/mobile/src/features/teacher/TeacherDashboardScreen.tsx` | Basic metrics | ChalkChamp + Quillsprig aesthetic, quick action bar (Voice Attendance, Add HW, Upload Material), batch list |
| **Teacher** | TeacherBatches | `apps/mobile/src/features/teacher/TeacherBatchesScreen.tsx` | Batch cards | Assigned batches list with student count and subject breakdown |
| **Teacher** | TeacherStudents | `apps/mobile/src/features/teacher/TeacherStudentsScreen.tsx` | Student roster | Searchable and filterable student roster per batch |
| **Teacher** | TeacherStudentDetails | `apps/mobile/src/features/teacher/TeacherStudentDetailsScreen.tsx` | Student profile | Individual student attendance history, parent contacts, marks |
| **Teacher** | TeacherAttendance | `apps/mobile/src/features/teacher/TeacherAttendanceScreen.tsx` | Check-in list | Batch attendance taker, one-tap present/absent toggling |
| **Teacher** | VoiceAttendance | `apps/mobile/src/features/teacher/VoiceAttendanceScreen.tsx` | Mic UI | AI voice-matching attendance with phonetic fallback and multi-match disambiguation |
| **Teacher** | TeacherHomework | `apps/mobile/src/features/teacher/TeacherHomeworkScreen.tsx` | HW list | Assignment manager, pending evaluation counters, floating create button |
| **Teacher** | CreateHomework | `apps/mobile/src/features/teacher/CreateHomeworkScreen.tsx` | Basic form | Multi-batch homework creator with due-date picker and document attachment |
| **Teacher** | HomeworkSubmissions | `apps/mobile/src/features/teacher/HomeworkSubmissionsScreen.tsx` | Submissions list | Submission review list with evaluation status filters |
| **Teacher** | EvaluateHomework | `apps/mobile/src/features/teacher/EvaluateHomeworkScreen.tsx` | Grading form | Document viewer, grade selector, written feedback input |
| **Teacher** | TeacherMaterials | `apps/mobile/src/features/teacher/TeacherMaterialsScreen.tsx` | Material list | Study materials management with upload launcher |
| **Teacher** | UploadMaterial | `apps/mobile/src/features/teacher/UploadMaterialScreen.tsx` | Upload form | Material uploader with subject tagger, file picker, and publish toggle |
| **Teacher** | TeacherProgress | `apps/mobile/src/features/teacher/TeacherProgressScreen.tsx` | Progress list | Batch academic evaluation and test mark entry |
| **Teacher** | TeacherTimetable | `apps/mobile/src/features/teacher/TeacherTimetableScreen.tsx` | Schedule list | Teacher's personal weekly teaching schedule |
| **Teacher** | TeacherNotifications | `apps/mobile/src/features/teacher/TeacherNotificationsScreen.tsx` | Notice list | Staff announcements and center communications |
| **Teacher** | TeacherProfile | `apps/mobile/src/features/teacher/TeacherProfileScreen.tsx` | Profile card | Teacher credentials, assigned subjects, logout |

---

## 4. Key Security & Role Navigation Audit

### 4.1 Root Navigator Role Routing Fix
* **Current Flaw in `RootNavigator.tsx`:**
  ```tsx
  case 'STAFF':
  case 'ACADEMIC_ADMIN':
  case 'BRANCH_ADMIN':
  case 'FRANCHISE_OWNER':
  case 'SUPER_ADMIN':
    return <TeacherNavigator />;
  ```
  This allowed institutional administrators and franchise owners to land in the teacher portal, which violated role isolation principles.
* **Correction:**
  Strictly restrict `TeacherNavigator` to `STAFF` (and verified teacher roles). Users logging in with pure administrative roles (`ACADEMIC_ADMIN`, `BRANCH_ADMIN`, `FRANCHISE_OWNER`, `SUPER_ADMIN`) must be routed to an authorized **Admin Portal Notice Screen** that directs them to the full web console or provides appropriate restricted management actions.

---

## 5. Design System Requirements

The design system will be established in `apps/mobile/src/components/design-system/`:
1. **`GlassCard`**: Translucent container with border highlights and subtle shadows.
2. **`GlassSurface`**: Backdrop surface utilizing `expo-blur` on supported devices with solid fallback.
3. **`GlassButton`**: Role-accented interactive button with spring scale animations and loading state.
4. **`GlassBottomSheet`**: Modal sheet for filters, submission uploaders, and child switchers.
5. **`AnimatedTabBar`**: Floating pill bottom navigation bar with animated indicator and role tints.
6. **`AnimatedPressable`**: Micro-interaction wrapper providing haptic-feeling spring scaling on tap.
7. **`RoleBadge`**: Segmented role pill for Student, Parent, Teacher with official brand palette.
8. **`DashboardStatCard`**: High-impact metric card with icon container, value, and trend subtitle.
9. **`SectionHeader`**: Consistent section title with icon and optional "See All" action.
10. **`EmptyState`**: Polished empty state with contextual icon, title, description, and action button.
11. **`LoadingState`**: Centered brand spinner with contextual loading copy.
12. **`ErrorState`**: User-friendly error message with retry trigger.
13. **`FormField`**: Rounded input container with label, validation message, and icon slot.
14. **`NotificationBadge`**: Count pill for active notifications.
15. **`DynamicStatusCapsule`**: Floating top status capsule for background operations (voice match, sync, file upload).
