# Digital Guru Franchise — Mobile Phase 2 Implementation Report

**Document:** `docs/mobile-phase-2-implementation-report.md`  
**Date:** November 23, 2026  
**Status:** COMPLETE & VERIFIED  
**Milestone:** Phase 2: Mobile Foundation & Authentication

---

## 1. Executive Summary

Phase 2 of the Digital Guru Franchise mobile application has been successfully implemented. A first-class cross-platform mobile workspace (`@tuition/mobile`) is now established inside `apps/mobile` using **Expo SDK 51**, **React Native 0.74.5**, and **TypeScript ^5.5.4**. The mobile client features a polished common login screen, hardware-backed secure token persistence via `expo-secure-store`, thread-safe token refresh interceptors, Zustand session management, and dynamic role-based navigation routing to distinct **Student**, **Parent**, and **Teacher** dashboard placeholders.

All existing web application assets (`apps/web`) and backend server routines (`server`) continue to build and function without regression or modification.

---

## 2. Files Created and Modified

### 2.1 Monorepo Configuration
- `package.json` *(Modified)*: Registered `"apps/mobile"` in workspaces; added scripts `"dev:mobile"` and `"build:mobile"`.

### 2.2 Mobile Workspace Configuration (`apps/mobile/`)
- `apps/mobile/package.json` *(Created)*: Expo SDK 51, React Native 0.74.5, React Navigation v6, TanStack Query v5, Zustand v4, Axios v1.7, Lucide Icons, and `@tuition/shared`.
- `apps/mobile/metro.config.js` *(Created)*: Monorepo-aware Metro bundler configuration with root `watchFolders` and `nodeModulesPaths`.
- `apps/mobile/tsconfig.json` *(Created)*: Extends `expo/tsconfig.base` with TypeScript 5.5.4 path aliases (`@/*`).
- `apps/mobile/babel.config.js` *(Created)*: Configured with `babel-preset-expo`.
- `apps/mobile/app.json` *(Created)*: Android package `com.digitalghuru.franchise`, iOS bundle ID `com.digitalghuru.franchise`, splash screen, and permissions (`CAMERA`, `READ_EXTERNAL_STORAGE`, `ACCESS_FINE_LOCATION`, `RECORD_AUDIO`).
- `apps/mobile/eas.json` *(Created)*: EAS Build configuration for `development`, `preview` (APK), and `production` (AAB/IPA).
- `apps/mobile/.env` *(Created)*: Environment variables (`EXPO_PUBLIC_API_URL=http://localhost:5000/api`).
- `apps/mobile/assets/*` *(Created)*: High-resolution brand assets (`icon.png`, `adaptive-icon.png`, `splash.png`).

### 2.3 Mobile Architecture & Source Code (`apps/mobile/src/`)
- `src/theme/colors.ts`: Digital Guru enterprise brand palette (`#0F172A`, `#0A2540`, `#006FFF`, `#FEDC32`, `#FE4D01`) and distinct role theme specs (`STUDENT`, `PARENT`, `STAFF`).
- `src/theme/index.ts`: Spacing, radii, and elevation/shadow constants.
- `src/types/auth.ts`: TypeScript contracts for `UserRole`, `UserProfile`, `UserMembership`, `LoginResponseData`, and `AuthState`.
- `src/utils/secureStore.ts`: `expo-secure-store` wrapper for iOS Keychain and Android Keystore with in-memory test fallback.
- `src/api/client.ts`: Axios client configured with base URL, token injection interceptors, and a thread-safe 401 token refresh queue.
- `src/api/auth.api.ts`: API service for `loginApi`, `refreshApi`, and `getCurrentUserApi`.
- `src/store/authStore.ts`: Zustand store managing auth state, tokens, active role, institute context, session restoration, and logout.
- `src/components/common/Button.tsx`: Role-themed interactive button with loading state.
- `src/components/common/Input.tsx`: Form input with label, validation error display, and secureTextEntry show/hide toggle.
- `src/components/common/Card.tsx`: Shadowed elevation card container.
- `src/components/common/Badge.tsx`: Role and status badge pill.
- `src/components/common/ScreenContainer.tsx`: SafeAreaView container.
- `src/components/common/Header.tsx`: Digital Guru branded top bar with active campus name and logout trigger.
- `src/features/auth/LoginScreen.tsx`: Common login screen with brand banner, login ID, password toggle, role selector pills, validation, generic error banner, and campus support contact pills.
- `src/features/student/StudentDashboardScreen.tsx`: Student dashboard placeholder with timetable preview, academic tasks, XP badge, and session details.
- `src/features/parent/ParentDashboardScreen.tsx`: Parent dashboard placeholder with linked student context bar, real-time arrival/departure punch banner, and fee overview.
- `src/features/teacher/TeacherDashboardScreen.tsx`: Teacher dashboard placeholder with geofence work punch card, voice attendance shortcut, and batch overview.
- `src/navigation/AuthNavigator.tsx`: Native stack navigator for unauthenticated flows.
- `src/navigation/StudentNavigator.tsx`: Bottom tab navigator for Student (Dashboard, Academics, Homework, Profile).
- `src/navigation/ParentNavigator.tsx`: Bottom tab navigator for Parent (Overview, Attendance, Fees, Inquiries).
- `src/navigation/TeacherNavigator.tsx`: Bottom tab navigator for Teacher (Classes, Attendance, Homework, Profile).
- `src/navigation/RootNavigator.tsx`: Dynamic router resolving `AuthStack` vs role-specific tab navigators based on authenticated backend role.
- `apps/mobile/App.tsx`: Root application mounting `QueryClientProvider`, `SafeAreaProvider`, and `RootNavigator`.

### 2.4 Test Suite & Automated Verification
- `server/scripts/test-mobile-auth-integration.ts` *(Created)*: Comprehensive end-to-end test suite testing real backend authentication, role verification, token rotation, and permission guards.

---

## 3. Dependencies and Compatibility Analysis

| Package | Version | Justification |
|---|---|---|
| `expo` | `~51.0.38` | Officially pairs with `react: "18.2.0"`. Matches existing web app React version and root peer dependencies. |
| `react` / `react-dom` | `18.2.0` | Exact match with `apps/web` and monorepo root. |
| `react-native` | `0.74.5` | Bundled with Expo SDK 51. Hermes engine enabled by default. |
| `typescript` | `^5.5.4` | Strict match with monorepo root and `@tuition/shared`. |
| `expo-secure-store` | `~13.0.2` | Hardware-backed encrypted storage (iOS Keychain, Android Keystore). Zero unencrypted `AsyncStorage`. |
| `@tanstack/react-query`| `^5.50.0` | Enterprise server-state caching, automatic background refetching, and offline mutations. |
| `zustand` | `^4.5.4` | Lightweight state store for session authentication and active child selection. |
| `@react-navigation/*` | `^6.x` | Industry standard navigation framework. |
| `axios` | `^1.7.4` | Flexible request/response interceptor engine. |
| `lucide-react-native` | `^0.441.0` | Design parity with desktop web application (`lucide-react`). |
| `@tuition/shared` | `*` (workspace) | Reused directly for theme tokens, status enums, and voice matching. |

### Why Expo SDK 51?
Expo SDK 51 was specifically selected over SDK 52 because SDK 51 is the LTS release that officially requires `react@18.2.0`. The existing web application (`apps/web`) and root `package.json` strictly depend on React 18.2.0. Upgrading to SDK 52 would have forced `react@18.3.1` or `19.x`, creating peer dependency conflicts across npm workspaces and destabilizing the existing production web app.

---

## 4. API Integrations Completed

| Endpoint | Method | Role | Mobile Flow Handled |
|---|---|---|---|
| `/api/auth/login` | `POST` | Any | Authenticates via Email/Phone/Admission No. Returns access token, refresh token, role, and active campus. |
| `/api/auth/refresh` | `POST` | Any | Automatically invoked by Axios 401 interceptor to renew expired tokens without interrupting user. |
| `/api/auth/me` | `GET` | Any | Restores session on app startup, validates token, and hydrates current user profile. |
| `/api/auth/change-password` | `POST` | Staff/Admin | Verified forbidden for Students and Parents; staff managed only. |

---

## 5. Authentication & Token Policy Analysis

### 5.1 Token Storage Policy
- Access and Refresh tokens are **never** stored in `AsyncStorage` or unencrypted SQLite.
- Both tokens are stored in **iOS Keychain Services** (accessible after first device unlock) and **Android Keystore (EncryptedSharedPreferences)** via `expo-secure-store`.

### 5.2 15-Minute Access Token Feasibility for Mobile
- **Investigation Outcome**: Feasible and Recommended for Phase 3.
- **Mechanism**: The backend `server/src/utils/security.ts` can accept an optional `expiresIn` parameter in `generateAccessToken(payload, expiresIn)`. When the mobile client sends `X-Client-Platform: android` or `X-Client-Platform: ios`, the server can issue an access token with a 15-minute expiration (`15m`), while desktop web sessions remain at `7d`.
- **Safety Guarantee**: The existing `POST /api/auth/refresh` endpoint already performs an active status verification (`user.isActive === true`) on every refresh invocation. If an account is suspended, the mobile app will be locked out within 15 minutes without requiring global JWT setting alterations.

### 5.3 Thread-Safe Token Refresh Queue
- Implemented in `apps/mobile/src/api/client.ts`.
- When multiple requests simultaneously receive a `401 Unauthorized`:
  1. The first request locks the refresh mutex (`isRefreshing = true`) and dispatches `POST /api/auth/refresh`.
  2. Subsequent concurrent requests are suspended in an in-memory queue (`failedQueue`).
  3. Once the refresh completes, all queued requests are updated with the new `Bearer <token>` and dispatched in parallel.
  4. If the refresh token is expired or revoked, the queue rejects all callers, clears SecureStore, and dispatches the global session expired callback.

---

## 6. Security Decisions & Guards Enforced

1. **Strictly Omitted Self-Service Password Reset**: Student and Parent credentials are institutional permanent credentials managed exclusively by authorized campus staff. The mobile login screen displays a clear support banner with center phone (`+91 8825948859`) and email, completely avoiding vulnerable self-service reset vectors.
2. **Server-Enforced Role Authority**: The role selector pills (Student, Parent, Teacher) on the login screen serve as client-side UX hints. The backend performs authoritative role matching; if a student selects "Teacher" and enters valid student credentials, the backend rejects the attempt with `403 Forbidden: Account role mismatch`.
3. **Password Hash Omission**: The authenticated `/api/auth/me` and `/api/auth/login` endpoints sanitize the user object, ensuring `passwordHash` is never transmitted to the mobile client.
4. **Data Isolation Across Roles**: Mobile state is strictly driven by the authenticated user's role:
   - Student &rarr; `StudentNavigator` (can only query own profile and enrolled batch data).
   - Parent &rarr; `ParentNavigator` (can only query linked children).
   - Teacher &rarr; `TeacherNavigator` (can only query assigned batch subjects).

---

## 7. Build & Test Verification Results

### 7.1 Workspace Build Checks
1. **Mobile Workspace Typecheck**:
   ```bash
   npm run build --workspace=@tuition/mobile
   # Command: tsc --noEmit
   # Result: 0 errors (Exit code: 0)
   ```
2. **Web Workspace Build**:
   ```bash
   npm run build:web
   # Command: vite build
   # Result: 2099 modules transformed, built in 9.47s (Exit code: 0)
   ```
3. **Server Workspace Build**:
   ```bash
   npm run build:server
   # Command: prisma generate && tsc
   # Result: Generated Prisma Client v5.22.0, compiled in 3.1s (Exit code: 0)
   ```

### 7.2 Backend Integration Test Suite (`test-mobile-auth-integration.ts`)
The automated verification suite was executed against the real Express server and Neon PostgreSQL database:

```text
================================================================
Digital Guru Franchise — Phase 2: Mobile Authentication Verification
================================================================

--- 1. Testing Student Account Authentication ---
  [PASS] Test 1: Student login returns 200 Success
  [PASS] Test 2: Student role is verified server-side
  [PASS] Test 3: Access token is returned
  [PASS] Test 4: Refresh token is returned
  [PASS] Test 5: Student is exempt from mandatory password change

--- 2. Testing Parent Account Authentication ---
  [PASS] Test 6: Parent login returns 200 Success
  [PASS] Test 7: Parent role is verified server-side
  [PASS] Test 8: Parent access token is returned

--- 3. Testing Teacher (STAFF) Account Authentication ---
  [PASS] Test 9: Teacher login returns 200 Success
  [PASS] Test 10: Teacher role is STAFF on backend
  [PASS] Test 11: Teacher access token is returned

--- 4. Testing Role Mismatch Security Enforcement ---
  [PASS] Test 12: Role mismatch is rejected with 403 Forbidden
  [PASS] Test 13: Server explicitly blocks login when selected role mismatches registered role

--- 5. Testing Invalid Credentials Rejection ---
  [PASS] Test 14: Invalid password rejected with 401 Unauthorized
  [PASS] Test 15: Generic error prevents user enumeration

--- 6. Testing Token Refresh Flow ---
  [PASS] Test 16: Token refresh returns 200 Success
  [PASS] Test 17: New access token generated
  [PASS] Test 18: New refresh token rotated

--- 7. Testing Authenticated User Session Retrieval (/api/auth/me) ---
  [PASS] Test 19: Authenticated /api/auth/me returns 200 Success
  [PASS] Test 20: Returns sanitized profile matching student user ID
  [PASS] Test 21: Returns correct STUDENT role in profile
  [PASS] Test 22: Password hash is strictly omitted from profile response

--- 8. Testing Prohibition of Student/Parent Password Modification ---
  [PASS] Test 23: Student cannot self-modify credentials (403 Forbidden)
  [PASS] Test 24: Enforces institutional rule: credentials managed exclusively by center staff

================================================================
Results: 24 / 24 tests passed (100%)
================================================================
```

---

## 8. Remaining Issues & Technical Notes

- **Network Configuration for Local Devices**: When testing on physical mobile hardware via Expo Go or development client, `EXPO_PUBLIC_API_URL` must point to the developer's LAN IP (e.g. `http://192.168.1.X:5000/api`) rather than `localhost`.
- **EAS Project ID**: `app.json` has a placeholder EAS project ID (`dg-franchise-mobile-prod-001`). When the project is initialized on Expo Application Services (`eas init`), this will be replaced with the team's official EAS GUID.

---

## 9. Recommended Phase 3 Implementation Tasks

With foundation, secure storage, and authentication verified, development should proceed to **Phase 3: Student Application**:
1. Implement the backend aggregator endpoint `GET /api/students/my/dashboard` to consolidate student profile, today's schedule, pending homework count, and recent attendance into a single roundtrip.
2. Build the live **Student Timetable Screen** utilizing structured batch schedule data.
3. Build the **Student Learning Materials Screen** with in-app PDF preview and offline caching.
4. Implement the **Homework Submission Flow** utilizing `expo-image-picker` and `expo-document-picker` uploading multipart forms to `POST /api/homework/:id/submissions`.
5. Connect student attendance history and academic report cards to live backend queries.
