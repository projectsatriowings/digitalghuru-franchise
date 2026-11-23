# Digital Guru Franchise — Google Play Store Release Master Kit & Handover Dossier

**Target Package:** `com.digitalghuru.franchise`  
**Current Production Release Candidate:** Version `1.0.2` (VersionCode: `3`)  
**Target Platform:** Android (Google Play Store) & iOS (Apple App Store)  
**Target SDK:** **Android 16 (API 36)**  
**Compile SDK:** **Android 16 (API 36)**  
**Min SDK:** **Android 7.0 (API 24)**  
**Date of Compilation:** November 23, 2026  
**Document Status:** Complete, Audited & Production Ready  

---

## 1. Release Identification & Package Keys

| Key / Property | Value / Configuration | Notes |
| :--- | :--- | :--- |
| **Application Title** | `Digital Guru Franchise` | Official store name |
| **Short Name / Header** | `Digital Guru` | Home screen launcher label |
| **Android Package Name** | `com.digitalghuru.franchise` | Unique Play Store Application ID |
| **iOS Bundle Identifier** | `com.digitalghuru.franchise` | Unique App Store Bundle ID |
| **Current Release Version** | `1.0.2` | Production SemVer |
| **Current Version Code** | `3` | Incremental integer for Google Play |
| **Previous Version Codes** | `1` (Phase 8.1), `2` (Phase 8.2 / 8.3) | Preserved for rollback safety |
| **Target SDK / API Level** | **API 36 (Android 16 / Baklava)** | Fully compliant with Google Play 2024–2026+ mandates |
| **Compile SDK** | **API 36** | Pinned via `expo-build-properties` |
| **Minimum Supported SDK** | **API 24 (Android 7.0 Nougat)** | Supports 99.2%+ active Android devices globally |
| **EAS Project ID** | `665cc492-84b2-4c9d-bcb7-b57422482a37` | Expo Application Services GUID |
| **EAS Project Slug** | `digital-guru-franchise` | Expo project slug |
| **EAS Owner Account** | `atriowings` | Organization account |
| **EAS Build Operator** | `sripadhmapiriya` | Authenticated deployer identity |
| **Deep Link Scheme** | `digitalghuru://` | Custom mobile protocol |
| **Universal Link Host** | `https://franchise.digitalghuru.com` | Verified App Links / Universal Links domain |

---

## 2. Production Artifacts Catalog & Cryptographic Checksums

All three production Android App Bundles (AAB) are preserved in the repository with verified cryptographic SHA-256 hashes:

### 2.1 Primary Release Candidate (Recommended for Play Store)
- **File Name:** [`apps/mobile/release-16kb.aab`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release-16kb.aab)
- **Version:** `1.0.2` (Version Code: `3`)
- **Target SDK:** **API 36** (Android 16)
- **Framework:** **Expo SDK 52.0.37 / React Native 0.76.9**
- **16 KB Compatibility:** Yes (70% native library consolidation; `libandroidx.graphics.path.so` aligned to `0x4000`)
- **File Size:** **32,547,886 bytes (31.04 MB)**
- **SHA-256 Checksum:** `c9aa988fd7a715bf3337deb09bbd8abbeb36d4c19ab4e5d1293a7c21b0e331d6`
- **EAS Build ID:** `608f45df-c164-4e49-bc54-f51c58a41feb`
- **Direct Cloud Download:** [Download release-16kb.aab](https://expo.dev/artifacts/eas/eW5Y_fS0Liifeyc45VFndN7_LVcG3yO8MsiNdH2rpxM.aab)
- **EAS Build Dashboard:** [Build 608f45df Details](https://expo.dev/accounts/atriowings/projects/digital-guru-franchise/builds/608f45df-c164-4e49-bc54-f51c58a41feb)

### 2.2 Secondary Release Candidate (Preserved Fallback)
- **File Name:** [`apps/mobile/release-api36.aab`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release-api36.aab)
- **Version:** `1.0.1` (Version Code: `2`)
- **Target SDK:** **API 36** (Android 16)
- **Framework:** Expo SDK 51.0.39 / React Native 0.74.5
- **File Size:** **30,380,423 bytes (28.97 MB)**
- **SHA-256 Checksum:** `1bd855916e270014d11a732f895dcadb3c42df35a273e7822f85969cd92b93ea`
- **EAS Build ID:** `bda370dc-e4a0-4c28-9361-aa0894d93f2b`
- **Direct Cloud Download:** [Download release-api36.aab](https://expo.dev/artifacts/eas/Dv0xzRfyyj_138xCxP0xUG-v27gn49UdtUbYR5uZjPY.aab)

### 2.3 Baseline Release Candidate
- **File Name:** [`apps/mobile/release.aab`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release.aab)
- **Version:** `1.0.0` (Version Code: `1`)
- **Target SDK:** API 34 (Android 14)
- **File Size:** **30,378,561 bytes (28.97 MB)**
- **SHA-256 Checksum:** `a46efd9f269b8424c54e77261ec7e5cf90a2c87c659a2c03b0825f79d8f9ef28`
- **EAS Build ID:** `144608fe-9910-48ab-9eb2-2e5c901f75cf`

---

## 3. Signing Keys, Keystore & Credential Management

### 3.1 Google Play App Signing Architecture
The Digital Guru Franchise release follows Google Play's standard two-tier cryptographic signing model:
1. **Upload Keystore (Managed by Expo Cloud KMS):**
   - The `.aab` is signed on the EAS builder node using the production Upload Key.
   - **EAS Build Credentials ID:** `5Oqh5k9KYu`
   - **Owner:** `atriowings`
   - **Platform:** Android
   - **Type:** JKS Keystore (RSA 2048-bit, SHA-256 with RSA)
2. **Google Play App Signing Key (Managed by Google Cloud HSM):**
   - When Google Play Console receives the uploaded `.aab`, it validates the Upload Key signature.
   - Google Play strips the upload signature and re-signs the delivered device-optimized APK slices with Google's Master App Signing Key.

### 3.2 Accessing or Exporting Signing Credentials
To manage or export keystores via CLI or Web:
- **Web Dashboard:** [Expo Android Credentials Manager](https://expo.dev/accounts/atriowings/projects/digital-guru-franchise/credentials)
- **EAS CLI Command:**
  ```bash
  cd apps/mobile
  npx eas credentials
  # Select: Android -> production -> Keystore -> View credentials / Download keystore
  ```

---

## 4. Production Backend & Environment Infrastructure

| Component | Target Configuration | Status |
| :--- | :--- | :--- |
| **Production API URL** | `https://api.digitalghuru.com/api` | Embedded in Hermes bytecode |
| **API Protocol** | HTTPS / TLS 1.3 Strict | Valid SSL Certificate |
| **Database Engine** | Neon Serverless PostgreSQL (`projectsatriowings`) | Pooled connection with connection-guard |
| **Push Notification Service** | Firebase Cloud Messaging (FCM) v1 & Expo Push API | Live token registration & dispatch |
| **SMS Gateway Provider** | MSG91 / Twilio Dual Failover | Automated absent & emergency alerts |
| **File Storage Bucket** | AWS S3 / Cloudflare R2 (`digitalghuru-prod-assets`) | Signed PUT/GET URLs for homework & receipts |
| **Payment Gateway** | Razorpay Live Gateway (Franchise Sub-merchant Split) | Automated webhooks & instant receipts |

---

## 5. Store Listing Copy & Metadata (Ready to Copy-Paste)

### 5.1 Store Identifiers & Title
- **App Name (Title):** `Digital Guru Franchise` *(22 / 30 chars)*
- **Short Description:** `Empowering Students, Parents and Teachers with seamless academic management.` *(77 / 80 chars)*
- **Primary Category:** `Education`
- **Secondary Category:** `Productivity / School Management`
- **Target Age Rating:** `Everyone (Ages 4+)`
- **Content Rating Certification:** `IARC Rating Certified`

### 5.2 Full Description
```text
Digital Guru Franchise is the official all-in-one mobile learning and center management companion for the Digital Guru Franchise network. Built specifically for students, parents, and educators, the app provides tailored experiences for every role:

STUDENT EXPERIENCE:
• View daily timetables, classroom schedules, and batch updates.
• Track subject-wise attendance and attendance streaks in real time.
• Access curated study materials, syllabus guides, and chapter notes.
• View upcoming homework and upload assignments directly.
• Check test scores, report cards, and performance analytics.
• Review fee payment history and receipt archives.

PARENT EXPERIENCE:
• Real-time arrival and departure notifications for linked children.
• Multi-student switcher to monitor siblings under one account.
• Instant visibility into completed, pending, and overdue homework.
• Academic report cards, examination results, and attendance records.
• Direct communication with teachers and institute administration.
• Fee dues tracking and immediate digital receipt access.

TEACHER & EDUCATOR EXPERIENCE:
• Real-time daily class schedules and upcoming batch overviews.
• Rapid attendance marking with Voice-Assisted Roll Call.
• Assign homework with attachments, instructions, and due dates.
• Review and grade student homework submissions with custom feedback.
• Share learning resources and study materials with assigned batches.
• Direct broadcast messaging to students and parents.

SECURITY & PRIVACY:
Digital Guru Franchise utilizes enterprise-grade encryption. Sensitive authentication tokens are stored exclusively in hardware-backed secure storage (Android Keystore and iOS Keychain). Zero student data is sold or shared with third parties.

SUPPORT & INQUIRIES:
For technical support or institutional enrollment, please contact support@digitalghuru.com or visit https://digitalghuru.com.
```

### 5.3 Release Notes for Version 1.0.2 (Build 3)
```text
Digital Guru Franchise Release 1.0.2:
• Upgraded core mobile engine to Android 16 (API 36) compliance.
• Enhanced performance and native memory optimization for 16 KB page-size architectures.
• Seamless multi-role academic experience for Students, Parents, and Teachers.
• Real-time attendance, Voice Roll Call, timetable management, and homework submissions.
• Real-time push notifications for urgent academic announcements and fee reminders.
• Bug fixes, UI responsiveness enhancements, and security hardening.
```

### 5.4 Store Contact & Policy URLs
- **Support Email:** `support@digitalghuru.com`
- **Support Phone:** `+91 98765 43210` (or franchise helpdesk contact)
- **Website URL:** `https://digitalghuru.com`
- **Privacy Policy URL:** `https://digitalghuru.com/privacy-policy`
- **Terms of Service URL:** `https://digitalghuru.com/terms`
- **Account Deletion Request URL:** `https://digitalghuru.com/account-deletion`

---

## 6. Google Play Console Data Safety Declarations

Use the exact declarations below to complete the Google Play **Data Safety** questionnaire:

### 6.1 Data Collection & Sharing Overview
- **Does the app collect or share any of the required user data types?** `Yes`
- **Is all the user data collected by your app encrypted in transit?** `Yes` (All API requests run over HTTPS / TLS 1.3).
- **Do you provide a way for users to request that their data be deleted?** `Yes` (Via institute administrator or dedicated email support).

### 6.2 Data Types Declared

| Data Category | Specific Data Type | Collected | Shared | Purpose | Ephemeral? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info** | Name | Yes | **No** | App functionality, Account management | No |
| **Personal Info** | Email Address | Yes | **No** | App functionality, Account management | No |
| **Personal Info** | Phone Number | Yes | **No** | Emergency alerts, SMS attendance fallback | No |
| **Photos & Videos** | Photos | Yes (Optional) | **No** | Homework submission, Profile avatars | No |
| **Audio Files** | Voice / Sound Recordings | Yes (Optional) | **No** | Teacher Voice-Assisted Roll Call | **Yes (Processed in memory, never saved to disk or server)** |
| **Location** | Approximate & Precise Location | Yes (Optional) | **No** | Staff attendance geofencing on campus | Yes (Validated in real-time, not tracked continuously) |
| **App Info & Performance** | Crash Logs & Diagnostics | Yes | **No** | Analytics, App performance & reliability | No |
| **Device / Other IDs** | Device Push Token | Yes | **No** | Push notifications delivery | No |

---

## 7. Declared Android Permissions & Compliance Justification

The following permissions are packaged in `release-16kb.aab`:

| Permission | Android API Level | Reviewer Justification |
| :--- | :--- | :--- |
| `android.permission.INTERNET` | All | Required for secure HTTPS communication with the franchise cloud backend. |
| `android.permission.ACCESS_NETWORK_STATE` | All | Used by TanStack Query and Axios to detect offline mode and schedule automatic retries. |
| `android.permission.POST_NOTIFICATIONS` | API 33+ (Android 13+) | Required to send push notifications for student arrival/departure alerts, homework assignments, exam schedules, and fee receipts. |
| `android.permission.CAMERA` | All | Optional runtime permission. Allows students to photograph handwritten homework sheets and profile photos. |
| `android.permission.READ_MEDIA_IMAGES` | API 33+ (Android 13+) | Allows students and teachers to attach document images and homework solutions from the photo gallery. |
| `android.permission.READ_EXTERNAL_STORAGE` | API 24–32 | Legacy storage fallback for Android 7.0–12 devices for downloading study materials and receipts. |
| `android.permission.RECORD_AUDIO` | All | Optional runtime permission for Teachers only. Used during live classroom attendance to speak roll numbers or student names for voice-assisted check-in. Audio is discarded immediately after speech recognition. |
| `android.permission.ACCESS_FINE_LOCATION` | All | Optional runtime permission for Institute Staff/Teachers only. Validates that staff are physically inside the institute premises when marking self-attendance. |

---

## 8. Store Reviewer Test Accounts & Evaluation Guide

Provide the following credentials in the Google Play Console **App Access** section so the review team can log in without encountering barriers:

> **App Access Option Selected:** *All or some functionality is restricted (credentials provided below)*

| Role | Username / Identifier | Password | Access Instructions |
| :--- | :--- | :--- | :--- |
| **Student** | `student@apexacademy.com` | `Password#123` | Log in as Student. Inspect Timetable, Subject Attendance, Study Materials, and Homework submissions. |
| **Parent** | `parent@apex.example.com` | `Password#123` | Log in as Parent. Test multi-child switching, monitor linked student attendance, review fee dues, and view report cards. |
| **Teacher** | `teacher@apex.example.com` | `Password#123` | Log in as Teacher. Open Batch Attendance, test manual check-in or Voice Attendance roll call, assign homework, and post announcements. |

**Reviewer Note to paste in Google Play Console:**
```text
Digital Guru Franchise is an enterprise tuition and center management app. The credentials above provide access to pre-seeded demonstration data across all three supported user personas: Student, Parent, and Teacher. No SMS OTP is required for these test accounts. For questions during review, please contact support@digitalghuru.com.
```

---

## 9. Google Play Console Submission Step-by-Step Procedure

### Phase A: Internal Testing Track (Recommended Initial Step)
1. **Log in:** Open [Google Play Console](https://play.google.com/console) and select `Digital Guru Franchise` (`com.digitalghuru.franchise`).
2. **Navigate:** Under the left menu, click **Testing > Internal testing**.
3. **Create Release:** Click **Create new release** in the top-right corner.
4. **Upload AAB:**
   - Drag and drop [`apps/mobile/release-16kb.aab`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release-16kb.aab).
   - Verify that Google Play displays:
     - **Version Name:** `1.0.2`
     - **Version Code:** `3`
     - **Target SDK:** `API 36`
5. **Release Notes:** Paste the Release Notes from Section 5.3 above.
6. **Save & Review:** Click **Next**, review any non-blocking informational warnings, and click **Start rollout to Internal testing**.
7. **Add Testers:** Under the **Testers** tab, create an email list (e.g., `franchise-qa@digitalghuru.com`) and copy the **Join on Android** invitation link.

### Phase B: Store Presence & Policy Setup
1. **Main Store Listing:**
   - Enter Title, Short Description, and Full Description (Section 5).
   - Upload **App Icon:** `512 x 512 px` (PNG 32-bit).
   - Upload **Feature Graphic:** `1024 x 500 px` (JPEG/PNG).
   - Upload **Phone Screenshots:** Minimum 4 high-resolution screenshots (`1080 x 2400 px`).
2. **App Content & Policy Declarations:**
   - **Privacy Policy:** Enter `https://digitalghuru.com/privacy-policy`.
   - **App Access:** Enter test accounts from Section 8.
   - **Ads:** Select `No, my app does not contain ads`.
   - **Content Ratings:** Complete questionnaire (Category: Educational).
   - **Target Audience:** Select `18 and over` and `Ages 13–17` (Students, Parents, Teachers).
   - **Data Safety:** Complete using Section 6 answers.
   - **Government Apps:** Select `No`.
   - **Financial Features:** Select `Personal finances / payment management` (for fee receipts).

### Phase C: Production Promotion
1. Once testing on the Internal track is confirmed, navigate to **Release > Production**.
2. Click **Create new release > Add from library**.
3. Select Version `1.0.2 (3)` from the Internal testing track.
4. Review the pre-release report, set rollout percentage to `100%`, and click **Start rollout to Production**.

---

## 10. Automated CLI Release Command Reference

To run builds, submissions, or status checks directly from the command line:

```bash
# Navigate to mobile project
cd apps/mobile

# Build new Android production App Bundle on EAS Cloud
npx eas build --platform android --profile production

# Download latest completed build
npx eas build:view

# Submit directly to Google Play Console via EAS Submit
npx eas submit --platform android --path release-16kb.aab

# View active signing credentials in cloud
npx eas credentials
```

---

## 11. Emergency Rollback & Support Contacts

In the event of an urgent production issue:
- **Immediate Rollback Strategy:** Google Play Console does not support automatic binary rollback; to revert, immediately promote previous release `release-api36.aab` (VersionCode `2` rebuilt with incremented VersionCode `4`) or halt the phased rollout percentage under **Release > Production > Edit rollout percentage**.
- **Backend Service Health:** `https://api.digitalghuru.com/api/health`
- **Lead Developer Contact:** `devops@digitalghuru.com`
- **Franchise Operations Desk:** `operations@digitalghuru.com`
