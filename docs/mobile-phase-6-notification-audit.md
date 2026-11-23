# Digital Guru Franchise — Mobile Application Phase 6: Centralized Push Notifications and Deep-Link Audit

## 1. Executive Summary

This audit assesses the current state of push notifications, device token management, notification models, SMS services, and deep linking across the Digital Guru Franchise monorepo (`server/`, `apps/web/`, `apps/mobile/`, `packages/shared/`).

The audit establishes the blueprint for Phase 6: implementing centralized, asynchronous Expo push notification delivery, role-based notification dispatching, lifecycle device registration, and verified deep-link navigation across Student, Parent, and Teacher roles.

---

## 2. Existing Database & Prisma Schema Audit

### 2.1 `DevicePushToken` Model (Lines 792–804)
```prisma
model DevicePushToken {
  id         String   @id @default(uuid())
  userId     String
  token      String   @unique
  platform   String   @default("android") // "android" | "ios" | "web"
  deviceInfo String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
**Audit Findings:**
- **Capabilities:**
  - Token uniqueness is enforced via `@unique`.
  - Supports multiple devices per user (one `User` to many `DevicePushToken`).
  - Supports Android and iOS platforms via the `platform` field.
  - Cascades on user deletion (`onDelete: Cascade`).
- **Schema Gaps:** None. The model fully supports multi-device tracking, token updating via upsert, platform tagging, and device metadata storage without requiring a database migration.

### 2.2 `Notification` Model (Lines 756–790)
```prisma
model Notification {
  id                 String             @id @default(uuid())
  instituteId        String
  userId             String
  role               UserRole           // STUDENT, PARENT, STAFF, etc.
  title              String
  message            String
  type               NotificationType   // ATTENDANCE, ACADEMIC, GENERAL, MESSAGE
  studentId          String?
  attendanceEventId  String?
  eventType          AttendanceType?
  eventTime          DateTime?
  isRead             Boolean            @default(false)
  readAt             DateTime?
  pushStatus         PushDeliveryStatus @default(PENDING) // PENDING, DELIVERED, FAILED
  pushError          String?
  link               String?
  entityType         String?            // ATTENDANCE, HOMEWORK, EXAM, MATERIAL, FEE, MESSAGE, PROGRESS_REPORT
  entityId           String?
  metadata           Json?
  idempotencyKey     String?            @unique
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  ...
}
```
**Audit Findings:**
- **Capabilities:**
  - Complete role isolation (`userId`, `instituteId`, `role`).
  - Idempotency support (`idempotencyKey` with `@unique`).
  - Deep-link metadata (`link`, `entityType`, `entityId`, `studentId`, `metadata`).
  - Delivery status tracking (`pushStatus`, `pushError`).
  - Unread tracking (`isRead`, `readAt`).

### 2.3 `SmsNotification` Model (Lines 725–754)
- Dedicated table for SMS delivery with provider reference (`mock` or SMS gateway), template name, delivery status (`QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `FAILED`), and idempotency key.
- Operates completely independently from push notifications and app installations.

---

## 3. Backend Endpoints & Notification Services Audit

### 3.1 Push Token Endpoints (`server/src/modules/notifications/notifications.routes.ts`)
- `POST /api/notifications/push-token`: Upserts token for authenticated user (`userId`, `platform`, `deviceInfo`). Returns HTTP 200.
- `DELETE /api/notifications/push-token`: Deletes token on logout.

### 3.2 Notification Management Endpoints
- `GET /api/notifications`: Retrieves unified notification records with pagination, `unreadOnly`, and `studentId` filtering.
- `GET /api/notifications/unread-count`: Returns `{ success: true, data: { unreadCount: N } }`.
- `PATCH /api/notifications/:id/read`: Marks single notification as read.
- `PATCH /api/notifications/read-all` & `POST /api/notifications/mark-all-read`: Marks all notifications as read for authenticated user.
- `POST /api/notifications/mark-read-by-entity`: Marks all notifications matching `entityType` and `entityId` as read.
- `GET /api/notifications/verify-target`: Validates whether the linked resource (e.g. homework, exam, attendance event) exists and is active before navigating.
- `GET /api/notifications/stream`: Server-Sent Events (SSE) real-time stream.

### 3.3 Event Triggers in `InAppNotificationService`
The service currently implements 11 high-level business event triggers:
1. `createAttendanceNotifications`: Student Check-in / Check-out alerts for Parents and Students.
2. `notifyExamScheduled`: Examination timetable alerts for Students and Parents.
3. `notifyExamResultsPublished`: Examination scores published for Students and Parents.
4. `notifyProgressReportPublished`: Term feedback & observations for Students and Parents.
5. `notifyParentFeedbackReplied`: Staff inquiry response for Parents.
6. `notifyNewChatMessage`: Messaging chat alerts.
7. `notifyHomeworkSubmitted`: Homework submission alerts for assigned Teachers.
8. `notifyHomeworkGraded`: Graded homework notifications for Students and Parents.
9. `notifyFeePaymentRecorded`: Receipt and payment confirmation for Parents.
10. `notifyMaterialPublished`: Study materials and homework assignment alerts for Students and Parents.
11. `notifyQuizPublished`: Quiz release alerts for Students.

**Gap Identified in Dispatch:**
Currently, only `createAttendanceNotifications` calls `sendPushNotification` directly. The other 10 triggers create `Notification` records and broadcast via SSE, but do not invoke push notification dispatching to device tokens.
*Phase 6 Solution:* Introduce a centralized, non-blocking `dispatchPushForNotification(notification, tokens)` dispatcher used across all 11 notification triggers.

---

## 4. Mobile Dependencies & Client State Audit

### 4.1 Push Notification Libraries in `apps/mobile/`
- Expo SDK: `51.0.38`.
- Newly added packages:
  - `expo-notifications`: `^0.28.19` (compatible with Expo SDK 51).
  - `expo-device`: `~6.0.2` (for physical device and simulator detection).
- Secure storage: `expo-secure-store` is used for authentication tokens (`accessToken`, `refreshToken`). Tokens are never stored in AsyncStorage.

### 4.2 Mobile Notification Centers
- **Student:** `StudentNotificationsScreen.tsx` provides All/Unread filter tabs, mark-as-read, mark-all-as-read, and pull-to-refresh.
- **Parent:** `ParentNotificationsScreen.tsx` provides All/Unread filter tabs, mark-as-read, and child-scoped filtering.
- **Teacher:** `TeacherNotificationsScreen.tsx` provides All/Unread filter tabs, mark-as-read, and center alert management.

**Gap Identified in Mobile Navigation:**
Tapping on a notification item currently marks it as read, but does not execute deep-link routing to the target screen (e.g., jumping from an attendance notification to the child's attendance sheet, or from a homework submission notification to the teacher grading screen).

---

## 5. Deep-Link Navigation Architecture Blueprint

### 5.1 Route & Entity Mapping Matrix

| Role | Notification Type | Target Screen | Deep-Link Payload |
| :--- | :--- | :--- | :--- |
| **STUDENT** | `HOMEWORK` | `StudentHomework` | `{ homeworkId: entityId }` |
| **STUDENT** | `EXAM` | `StudentAcademics` | `{ examId: entityId }` |
| **STUDENT** | `MATERIAL` | `StudentMaterials` | `{ materialId: entityId }` |
| **STUDENT** | `ATTENDANCE` | `StudentAttendance` | `{ date: eventTime }` |
| **PARENT** | `ATTENDANCE` | `ParentAttendance` | `{ childId: studentId }` |
| **PARENT** | `HOMEWORK` | `ParentHomework` | `{ childId: studentId }` |
| **PARENT** | `EXAM` | `ParentAcademics` | `{ childId: studentId, examId: entityId }` |
| **PARENT** | `FEE` | `ParentFees` | `{ childId: studentId }` |
| **PARENT** | `FEEDBACK` | `ParentFeedback` | `{ reviewId: entityId }` |
| **TEACHER** | `HOMEWORK_SUBMISSION` | `HomeworkSubmissions` | `{ homeworkId: entityId }` |
| **TEACHER** | `ATTENDANCE` | `TeacherAttendance` | `{ batchId }` |
| **TEACHER** | `MATERIAL` | `TeacherMaterials` | `{ materialId: entityId }` |
| **TEACHER** | `TIMETABLE` | `TeacherTimetable` | `{}` |
| **TEACHER** | `PROGRESS_REPORT` | `TeacherProgress` | `{ studentId }` |

### 5.2 Deep-Link Security & Verification
1. Verify target resource exists via `GET /api/notifications/verify-target`.
2. Ensure authenticated role matches target screen (e.g., Parent cannot navigate to Teacher grading screen).
3. In Parent app: Ensure `studentId` belongs to parent's linked children before setting `selectedChild`.
4. In Teacher app: Ensure batch/homework belongs to teacher's authorized assignments before loading details.
5. In case of cold start: Wait for `isRestoringSession === false` and `isAuthenticated === true` before dispatching navigation actions.

---

## 6. SMS Separation Policy

- Parent attendance check-in/check-out SMS continues to be dispatched via `NotificationService.queueAttendanceNotification` and processed by `sms.worker.ts`.
- Push notifications run alongside SMS; neither service blocks or replaces the other.
- No personal phone numbers or sensitive student addresses are ever broadcast in push notification payloads.

---

## 7. Action Plan for Phase 6 Implementation

1. **Backend:**
   - Enhance `InAppNotificationService` with a centralized push dispatcher `dispatchPushForNotification`.
   - Implement automatic batching (up to 100 per chunk), transient retry, and removal of invalid push tokens (`DeviceNotRegistered`).
   - Wire push notification dispatch into all 11 existing notification triggers.
   - Add push token management helper methods.
2. **Mobile:**
   - Implement `apps/mobile/src/services/pushNotificationService.ts` to request permissions, obtain Expo push token, and register with backend.
   - Hook push token registration into `login()` and `restoreSession()` in `authStore.ts`.
   - Hook push token unregistration into `logout()` in `authStore.ts`.
   - Implement deep-link handler `apps/mobile/src/services/deepLinkService.ts` supporting cold-start and foreground/background notification responses.
   - Update `StudentNotificationsScreen.tsx`, `ParentNotificationsScreen.tsx`, and `TeacherNotificationsScreen.tsx` to handle tapping notification cards with deep navigation.
3. **Automated Testing:**
   - Build `server/scripts/test-mobile-phase6-notifications.ts` covering device registration, token cleanup, student/parent/teacher delivery, security isolation, deep-link validation, and SMS regression.
4. **Build & Quality Assurance:**
   - Run full monorepo TypeScript checks (`apps/mobile`, `server`, `apps/web`) and production web build.
   - Create `docs/mobile-phase-6-notification-implementation-report.md`.
