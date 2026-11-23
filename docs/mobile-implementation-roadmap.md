# Digital Guru Franchise — Mobile Implementation Roadmap

**Document:** `docs/mobile-implementation-roadmap.md`  
**Date:** November 23, 2026  
**Status:** COMPLETE ROADMAP  
**Scope:** Phased execution plan spanning 8 sequential milestones from monorepo initialization to production release.

---

## 1. Roadmap Overview & Milestones

The mobile application development is structured into 8 phases designed to ensure zero regression in the existing web application, maintain continuous verification against the existing database, and achieve complete feature parity for Student, Parent, and Teacher roles.

```
Phase 1: Repository & Backend Audit (COMPLETE)
   |
   v
Phase 2: Mobile Foundation & Workspace Setup
   |
   v
Phase 3: Common Authentication & Role-Based Routing
   |
   v
Phase 4: Student Mobile Application
   |
   v
Phase 5: Parent Mobile Application
   |
   v
Phase 6: Teacher Mobile Application (Full Scope & Voice)
   |
   v
Phase 7: Real-Time Push Notifications & Deep Linking
   |
   v
Phase 8: Cross-Platform Testing & Production Builds
```

---

## 2. Phase-by-Phase Execution Plan

### Phase 2: Mobile Foundation & Monorepo Integration
- **Objective**: Establish the `apps/mobile` workspace within npm workspaces without disrupting `apps/web` or `server`.
- **Backend Changes Required**: None.
- **Mobile Deliverables**:
  1. Initialize Expo SDK 51 application in `apps/mobile` with TypeScript template.
  2. Register `"apps/mobile"` in root `package.json` `workspaces` array.
  3. Symlink and consume `@tuition/shared` package for brand tokens, roles, and types.
  4. Configure `metro.config.js` with monorepo resolution (watch folders for `packages/shared`).
  5. Setup Axios HTTP client with base URL configuration (`API_BASE_URL` pointing to local server or staging API).
  6. Configure TanStack Query v5 `QueryClientProvider` and root theme providers.
- **Verification**: Run `npm run build --workspaces` and verify both web and mobile compile without type or workspace errors.

---

### Phase 3: Common Authentication & Role Routing
- **Objective**: Deliver the single unified login screen that dynamically routes to Student, Parent, or Teacher navigation stacks.
- **Backend Changes Required**:
  - *(Optional Hardening)*: Add mobile client identification header logging in `server/src/modules/auth/auth.controller.ts`.
- **Mobile Deliverables**:
  1. Implement `LoginScreen.tsx` with email/phone/admission number input, password toggle, and campus code selector.
  2. Implement SecureStore token storage layer (`accessToken`, `refreshToken`, user context).
  3. Configure Axios 401 response interceptor with automatic token refresh queuing.
  4. Create Zustand `authStore` to hold session state and active role.
  5. Build `RootNavigator.tsx` switching between `AuthStack`, `StudentStack`, `ParentStack`, and `TeacherStack`.
  6. Implement logout and session revocation.
- **Verification**: Test login with 3 demo accounts (`student@apexacademy.com`, `parent@apexacademy.com`, `teacher@apexacademy.com`) and confirm proper role stack activation.

---

### Phase 4: Student Mobile Application
- **Objective**: Deliver a student experience covering timetable, materials, homework submissions, and academic progress.
- **Backend Changes Required**:
  - **Add `GET /api/students/my/dashboard`**: Single aggregator endpoint returning student profile, today's schedule, pending homework count, recent attendance %, and unread notification count.
  - **Add `GET /api/students/my/timetable`**: Formats `Batch.schedule` strings into daily structured schedule objects.
- **Mobile Deliverables**:
  1. **Student Dashboard**: Timetable carousel, gamified XP points banner, pending homework alert cards.
  2. **Timetable Screen**: Weekly schedule with subject names, teacher names, and timings.
  3. **Materials Screen**: Subject-wise folder view, PDF document viewer (`react-native-pdf` or webview), download manager.
  4. **Homework Screen**: Tabbed list ("Pending" / "Submitted"), camera capture / file picker for submission, instant status updates.
  5. **Attendance Screen**: Monthly attendance log with check-in/out timestamps and color-coded status.
  6. **Academic Progress Screen**: Exam marks report cards and teacher feedback reviews.
- **Verification**: Complete end-to-end flow: Student views new homework &rarr; takes photo &rarr; submits &rarr; verifies submission recorded in database.

---

### Phase 5: Parent Mobile Application
- **Objective**: Deliver the parent experience supporting linked children tracking, attendance monitoring, fee payments, and teacher inquiries.
- **Backend Changes Required**:
  - **Add `GET /api/parents/students/:studentId/homework`**: Returns batch homework assignments enriched with individual child's submission and grading status.
- **Mobile Deliverables**:
  1. **Child Switcher**: Sticky top bar allowing multi-child parents to switch context instantly.
  2. **Daily Overview Dashboard**: Real-time child check-in and check-out status, today's homework status, upcoming due fees.
  3. **Attendance History**: Interactive monthly calendar with daily status indicators (Green = Present, Red = Absent, Yellow = Late).
  4. **Fee Management & Payments**:
     - Itemized fee statements and outstanding balances.
     - Integration of Razorpay mobile checkout SDK for UPI, Netbanking, and Card payments.
     - Payment receipts history and downloadable PDF vouchers.
  5. **Teacher Feedback & Inquiries**:
     - Inquiry composer with categorization (Academic, Attendance, Fees, General).
     - Conversation history with teacher replies and resolution status.
- **Verification**: Parent switches between two children &rarr; verifies distinct attendance and fee balances &rarr; completes a test online payment.

---

### Phase 6: Teacher Mobile Application (Full Functionality)
- **Objective**: Equip teachers with tools for daily teaching, attendance marking (manual + voice), homework grading, and parent inquiries.
- **Backend Changes Required**:
  - **Add `GET /api/staff/my/dashboard`**: Returns teacher's daily class schedule, attendance marking status for today's batches, and count of ungraded submissions.
- **Mobile Deliverables**:
  1. **Teacher Dashboard**: Today's assigned lectures, quick link to mark attendance, work attendance punch card.
  2. **Class Attendance Module**:
     - Manual student checklist with bulk "Mark All Present" toggle.
     - **Voice Attendance Screen**: Integrates mobile microphone with speech recognition, sending transcript to `POST /api/attendance/voice-match` and highlighting matched students for one-tap confirmation.
  3. **Homework Management**:
     - Create new homework assignment with camera document attachment and due dates.
     - Submission review inbox: View student submission images, zoom in, enter marks and text feedback.
  4. **Teacher Geofence Attendance**:
     - Staff GPS punch-in/out verifying coordinates against campus boundary.
  5. **Parent Inquiry Responses**:
     - Inbox of parent inquiries with thread view and response composer.
- **Verification**: Teacher records attendance using voice match &rarr; creates homework &rarr; grades a student submission &rarr; confirms parent receives update.

---

### Phase 7: Real-Time Notifications & Deep Linking
- **Objective**: Implement native mobile push notifications and deep linking across all 3 roles.
- **Backend Changes Required**:
  - **Add Push Dispatcher Service**: Worker in `server/src/modules/notifications/notification.service.ts` that dispatches database notifications to the Expo Push HTTP API (`https://exp.host/--/api/v2/push/send`) targeting records in `DevicePushToken`.
- **Mobile Deliverables**:
  1. Register device push token upon user login via `POST /api/notifications/push-token`.
  2. Configure foreground notification presentation handler in `expo-notifications`.
  3. Configure notification response listener:
     - Parses `entityType` and `entityId`.
     - Directs navigation router to the specific screen (e.g. `HOMEWORK` &rarr; `HomeworkDetailScreen`, `ATTENDANCE` &rarr; `AttendanceScreen`, `FEE` &rarr; `FeeStatementScreen`).
  4. Handle token removal upon logout via `DELETE /api/notifications/push-token`.
- **Verification**: Trigger a check-in event on server &rarr; verify parent's phone displays native lock-screen notification &rarr; tap notification &rarr; verify app opens directly to child's attendance record.

---

### Phase 8: Cross-Platform Testing & Production Builds
- **Objective**: Perform rigorous QA on physical Android and iOS devices, security audits, and generate production binaries.
- **Backend Changes Required**: Production CORS and rate-limiting validation.
- **Mobile Deliverables**:
  1. Device testing on Android (Android 10, 12, 14) and iOS (iOS 16, 17, 18).
  2. Verification of offline fallbacks (TanStack Query offline cache displaying cached records when network disconnects).
  3. Production security check: Confirm zero tokens stored in unencrypted storage; verify all tokens in `expo-secure-store`.
  4. EAS Build profile configuration (`eas.json`) for Android AAB and iOS IPA.
  5. App Store & Google Play metadata, privacy descriptions, and release packaging.
- **Verification**: Run production builds on EAS, install on physical iPhone and Android test devices, and run full test checklist.

---

## 3. Strict Development Invariants

1. **Web App Safety**: No changes made to `apps/web` components, routes, or assets.
2. **Business Rule Preservation**: Existing rules for fees, attendance, homework, and permissions remain authoritative in `server/src/`.
3. **Database Guard**: No new database or schema resets. All queries use the existing Neon PostgreSQL database.
4. **Endpoint Extension Standard**: When adding mobile aggregator endpoints (e.g. `GET /api/students/my/dashboard`), they must reside in existing modules (`server/src/modules/students/`) and reuse existing Prisma queries.
