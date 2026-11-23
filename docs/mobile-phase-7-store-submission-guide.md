# Digital Guru Franchise – Mobile Phase 7: App Store & Google Play Submission Guide

## 1. Application Metadata Specification

### 1.1 Store Names & Identifiers
- **App Name**: `Digital Guru Franchise`
- **Short Name / Title**: `Digital Guru`
- **Package Name (Android)**: `com.digitalghuru.franchise`
- **Bundle Identifier (iOS)**: `com.digitalghuru.franchise`
- **Primary Category**: Education
- **Secondary Category (iOS)**: Productivity / Business
- **Target Age Group**: Ages 4+ (Students, Parents, Teachers)

---

### 1.2 Store Copy & Descriptions

#### iOS Subtitle (Max 30 characters)
`Tuition & Franchise Platform`

#### Google Play Short Description (Max 80 characters)
`Empowering Students, Parents and Teachers with seamless academic management.`

#### Full Description (Google Play & Apple App Store)
```text
Digital Guru Franchise is the official all-in-one mobile learning and center management companion for the Digital Guru Franchise network. Built specifically for students, parents, and educators, the app provides tailored experiences for every role:

STUDENT EXPERIENCE:
• View daily timetables, schedules, and classroom sessions.
• Track subject-wise attendance and attendance streaks.
• Access curated study materials, syllabus guides, and notes.
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
• Assign homework with attachments and due dates.
• Review and grade student homework submissions.
• Share learning resources and study materials with assigned batches.
• Direct broadcast messaging to students and parents.

SECURITY & PRIVACY:
Digital Guru Franchise utilizes enterprise-grade encryption. Sensitive authentication tokens are stored exclusively in hardware-backed secure storage (Android Keystore and iOS Keychain). Zero student data is sold or shared with third parties.

For support or institutional inquiries, please contact support@digitalghuru.com.
```

#### Keywords (iOS – Max 100 characters, comma-separated)
`tuition,franchise,coaching,student,parent,teacher,attendance,homework,marks,education,timetable,school`

---

## 2. Privacy, Permissions & Store Compliance Declarations

### 2.1 Apple App Store Privacy Declarations
In App Store Connect under **App Privacy**:
- **Data Used to Track You**: None. The app does not track users across other companies' apps or websites.
- **Data Linked to You**:
  - **Contact Info**: Name, Email Address, Phone Number (for account authentication and emergency notifications).
  - **User Content**: Photos and Documents (uploaded solely when submitting homework, receipts, or profile photos).
  - **Location**: Coarse/Fine Location (used only by staff for on-campus geofence attendance verification).
  - **Audio Data**: Voice/Microphone (used only by teachers for voice-assisted attendance roll call; audio is processed in memory and never stored).
  - **Device Identifiers**: Device Push Token (used solely for push notification delivery).
  - **Usage Data**: Crash logs and diagnostics (to maintain app reliability).

### 2.2 Google Play Data Safety Declarations
- **Data Collected & Shared**:
  - Personal Info: Name, Email, Phone number (Collected, NOT shared with third parties).
  - Photos and Videos: Optional (Collected for assignment uploads, NOT shared).
  - Audio: Optional (Captured in real time for teacher voice roll call, NOT shared, NOT stored).
  - App Info and Performance: Crash logs, diagnostic data.
  - Device or other IDs: Push Notification Token.
- **Security Practices**:
  - Data is encrypted in transit using HTTPS / TLS 1.3.
  - Users can request account and data deletion via institutional admin or email support.
  - The app adheres to Google Play Families Policy requirements.

---

## 3. Store Reviewer Test Accounts & Instructions

> [!IMPORTANT]
> The following sanitized demonstration credentials correspond to seeded test accounts across the three supported roles.

| Role | Username / Identifier | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Student** | `student@apexacademy.com` | `Password#123` | Student dashboard, timetable, attendance, test scores, homework submission |
| **Parent** | `parent@apex.example.com` | `Password#123` | Parent dashboard, linked children monitoring, fee receipts, teacher messages |
| **Teacher** | `teacher@apex.example.com` | `Password#123` | Teacher dashboard, class schedule, voice attendance roll call, homework grading |

### App Reviewer Notes (App Store & Google Play)
```text
Digital Guru Franchise is a closed-loop institutional management platform for educational centers. 
To evaluate the application:
1. Log in using any of the provided test credentials (Student, Parent, or Teacher).
2. The app dynamically directs the user to their corresponding role interface.
3. Test Voice Attendance: Log in as Teacher, tap on an active class, select "Voice Roll Call", and speak student names or tap student cards manually.
4. Push Notifications: The app registers push tokens securely with Expo APNs/FCM servers. Emulators will skip push registration gracefully.
```

---

## 4. Release Checklist & Store Submission Commands

### Android Production Build (AAB)
```bash
cd apps/mobile
eas build --platform android --profile production
```
- Output: `.aab` (Android App Bundle).
- Target: Upload to Google Play Console under Internal Testing / Closed Testing track.

### iOS Production Build (IPA)
```bash
cd apps/mobile
eas build --platform ios --profile production
```
- Output: `.ipa` signed with Apple Distribution Certificate & Provisioning Profile.
- Target: Upload to TestFlight / App Store Connect.
