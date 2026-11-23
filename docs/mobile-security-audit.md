# Digital Guru Franchise — Mobile Security & Permission Boundary Audit

**Document:** `docs/mobile-security-audit.md`  
**Date:** November 23, 2026  
**Status:** COMPLETE AUDIT  
**Scope:** Verification of data isolation boundaries, role-based access controls, tenant isolation, attendance business guards, and mobile-specific security vectors.

---

## 1. Executive Summary

This security audit verifies the isolation boundaries enforced across the existing backend services for the three target mobile roles: **Student**, **Parent**, and **Teacher** (`STAFF`). It examines the middleware guards, Prisma query WHERE clause constructions, tenant boundary controls, and token security to ensure mobile clients cannot violate data privacy, escalate privileges, or access cross-tenant records.

---

## 2. Role & Permission Boundary Verification

### 2.1 Student Boundary Verification
- **Record Access Rule**: A student must only have access to their own academic, attendance, homework, and fee records.
- **Backend Implementation**:
  - `server/src/modules/students/student-authorization.service.ts` (L. 401–411):
    ```typescript
    if (role === 'STUDENT') {
      return {
        instituteId: instituteId || '',
        isStaff: false,
        assignedBatchIds: [],
        whereClause: {
          userId,
          ...(instituteId ? { instituteId } : {}),
        },
      };
    }
    ```
  - `GET /api/students/my/profile`: Explicitly retrieves the student record where `userId === req.user.userId`.
  - `GET /api/students/:id`: `isStudentAuthorized` verifies `student.userId === req.user.userId`. If a student attempts to query another student's UUID, the backend immediately halts and returns `403 Forbidden`.
  - `POST /api/homework/:id/submissions`: The student ID is resolved from `prisma.student.findFirst({ where: { userId: req.user.userId } })`, preventing student A from submitting homework on behalf of student B.
- **Audit Verdict**: **PASS** (Strictly Enforced).

### 2.2 Parent Boundary Verification
- **Record Access Rule**: A parent must only access records belonging to their legally linked children.
- **Backend Implementation**:
  - `server/src/modules/students/student-authorization.service.ts` (L. 384–398):
    ```typescript
    if (role === 'PARENT') {
      return {
        instituteId: instituteId || '',
        isStaff: false,
        assignedBatchIds: [],
        whereClause: {
          parentRelations: {
            some: {
              parent: { userId },
            },
          },
          ...(instituteId ? { instituteId } : {}),
        },
      };
    }
    ```
  - `GET /api/parents/students/:studentId/*`: Enforces `isStudentAuthorized(req, studentId, prisma)` which validates that an active record exists in `StudentParentRelation` connecting `req.user.userId`'s `ParentProfile` to `studentId`.
  - Fee statements (`/api/fees/students/:studentId/statement`) and academic reports (`/api/exams/students/:studentId/report-card`) invoke the same check. Any request for an unlinked student ID is rejected with `403 Forbidden: You are not authorized to view this student record`.
- **Audit Verdict**: **PASS** (Strictly Enforced).

### 2.3 Teacher (`STAFF`) Boundary Verification
- **Record Access Rule**: Teachers must only access batches, subjects, and student rosters explicitly assigned to them.
- **Backend Implementation**:
  - `getAuthorizedStaffAssignments` (`student-authorization.service.ts` L. 24–126):
    - Retrieves `staffProfile` matching `userId` and `instituteId`.
    - Gathers `authorizedBatchIds` and `subjectIdsByBatch` via `BatchSubject` (where `staffProfileId === staffProfile.id`) and `StaffBatchAssignment`.
  - If a staff member has no assigned batches, `whereClause: { id: '__DENIED_NO_ASSIGNMENTS__' }` is applied, returning zero records.
  - When accessing student rosters (`/api/students`), attendance rosters (`/api/attendance/voice-match`), or batch details (`/api/academics/batches/:id`), the backend verifies that `batchId` is contained in `assignments.authorizedBatchIds`. If not assigned, it halts with `403 Forbidden: You are not authorized to view students in this batch`.
- **Audit Verdict**: **PASS** (Strictly Enforced).

### 2.4 Franchise & Campus Tenant Boundary
- **Multi-Tenant Rule**: Campus-level data (attendance, students, staff, fees) must be strictly isolated by `instituteId` (Campus Branch) and `franchiseId`.
- **Backend Implementation**:
  - `requireInstituteContext` middleware (`server/src/middleware/auth.ts` L. 73–203):
    - Extracts `instituteId` from JWT payload or `x-institute-id` header.
    - Validates against `InstituteMembership` table for `userId` and `instituteId`.
    - Ensures `membership.isActive === true` and `institute.status === 'ACTIVE'`.
    - If the user attempts to send an `x-institute-id` for a campus where they do not possess an active membership, the request is rejected with `403 Forbidden: Active institute membership required`.
- **Audit Verdict**: **PASS** (Strictly Enforced).

---

## 3. Attendance Integrity & Validation Guards

The mobile application will permit teachers to record student attendance and punch their own work attendance. Existing rules verified in backend:
1. **Duplicate Check-in Prevention**:
   - `recordCheckIn` (`server/src/modules/attendance/attendance.controller.ts`): Queries for existing check-in on the current calendar date (`eventDate`). Duplicate check-ins within the same session/day are rejected with `400 Bad Request: Student already checked in today`.
2. **Sequential Punch Validation**:
   - `recordCheckOut`: Enforces that a check-in event MUST precede any check-out event. Checking out an absent or un-checked-in student is rejected.
3. **Staff Geofence Enforcement**:
   - `staffCheckIn` (`server/src/modules/staff-attendance/staff-attendance.controller.ts`): Calculates haversine distance between device `(latitude, longitude)` and campus coordinates configured on `Institute`. If distance exceeds `geofenceRadiusMeters` (default: 100m) and staff does not possess an approved WFH authorization, check-in is rejected with `403 Forbidden: Outside campus geofence boundary`.
4. **Correction Audit Trail**:
   - Attendance events cannot be silently mutated. Any manual adjustment by staff/admin creates an `AuditLog` entry tracking `userId`, `action: 'ATTENDANCE_CORRECTED'`, previous status, and justification remarks.

---

## 4. Mobile Security Gaps & Pre-Release Hardening Checklist

While the backend permission boundaries are mathematically sound, deploying to public mobile app stores introduces mobile-specific attack vectors that must be mitigated:

| Threat Vector | Severity | Vulnerability Description | Mitigation Required for Mobile Release |
|---|---|---|---|
| **1. Insecure Token Storage on Device** | **CRITICAL** | Storing JWT tokens in standard AsyncStorage or unencrypted local storage on Android/iOS exposes them to extraction on rooted/jailbroken devices or backup exploits. | The mobile app must exclusively store `accessToken` and `refreshToken` in hardware-backed secure storage: **Keychain Services** on iOS and **Android Keystore (EncryptedSharedPreferences)** on Android via `expo-secure-store`. |
| **2. Man-in-the-Middle (MitM) on Public Wi-Fi** | **HIGH** | Students and teachers often connect via unencrypted public Wi-Fi (cafes, transit). Without certificate pinning, compromised intermediate proxies could intercept tokens. | Implement TLS certificate / public key pinning in production mobile network clients, and strictly enforce HTTPS with HTTP Strict Transport Security (HSTS). |
| **3. Push Token Hijacking** | **HIGH** | If a push token is registered without user validation, malicious actors could register their device token against another user's ID to intercept student notifications. | The endpoint `POST /api/notifications/push-token` already binds the token to `req.user.userId` from the verified JWT token. Mobile client must re-register the token upon fresh login and de-register on logout (`DELETE /api/notifications/push-token`). |
| **4. Inactive / Suspended Account Token Lifetime** | **MEDIUM** | Access tokens are valid for 7 days (`JWT_EXPIRES_IN=7d`). If a student or staff member is deactivated or suspended by an admin, the 7-day token could remain valid until expiry unless refreshed. | Reduce mobile access token expiry to **15 minutes** while maintaining a **30-day refresh token**. The refresh token rotation (`POST /api/auth/refresh`) already checks `user.isActive === true` on every token refresh. |
| **5. Credential Self-Service Abuse** | **MEDIUM** | Mobile apps typically offer a "Forgot Password" button. However, the Digital Guru franchise policy states student and parent credentials are created and managed exclusively by authorized campus staff. | The mobile login screen must NOT offer a self-service password reset form that could bypass staff verification. Instead, it must display a "Need Help? Contact your campus center" support trigger. |
| **6. Mobile Endpoint Rate Limiting** | **MEDIUM** | Repeated biometric/PIN or login attempts on mobile could lead to credential stuffing. | The existing `authRateLimiter` (`server/src/middleware/rate-limiter.ts`) enforces rate limits per IP. Mobile client should implement client-side exponential backoff on failed attempts and device lockouts after 5 consecutive failed logins. |

---

## 5. Security Audit Verdict

The backend architecture satisfies enterprise tenant isolation and role-based security requirements:
- No student can view another student's data.
- No parent can view an unlinked child.
- No teacher can access batches or students outside their assigned curriculum.
- Cross-campus data leakage is strictly blocked by `requireInstituteContext`.

Implementing the 6 mobile-specific hardening measures above during Phase 2 will ensure an ironclad production deployment.
