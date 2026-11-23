# Digital Guru Franchise — Play Store Release Quick Reference & Keys

> **Master Dossier Location:** Complete details, questionnaires, and policies are located at:  
> [`docs/GOOGLE_PLAY_STORE_RELEASE_MASTER_KIT.md`](file:///c:/Atriowings/digitalghuru-franchise/docs/GOOGLE_PLAY_STORE_RELEASE_MASTER_KIT.md)

---

## 1. Fast Release Summary

- **Package ID:** `com.digitalghuru.franchise`
- **Recommended Play Store AAB:** [`apps/mobile/release-16kb.aab`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release-16kb.aab) (SHA-256: `c9aa988fd7a715...`)
- **Direct Installable APK:** [`apps/mobile/release-demo.apk`](file:///c:/Atriowings/digitalghuru-franchise/apps/mobile/release-demo.apk)
  - **Size:** 62.91 MB (`65,969,808 bytes`)
  - **SHA-256:** `a632a40a66590cc3c34aa6b112a8a03c970cb552f18ccd88480018c7568faf65`
  - **EAS Build ID:** `19a58973-42a1-43df-9cb2-60144bfe539f`
  - **Direct Download:** [Download release-demo.apk](https://expo.dev/artifacts/eas/I7De_q76j6Q2jkpzKFuoXsPhAxrAFcOPad5B8OsMaYM.apk)
  - **Install Webpage / QR:** [EAS Install Page](https://expo.dev/accounts/atriowings/projects/digital-guru-franchise/builds/19a58973-42a1-43df-9cb2-60144bfe539f)
- **Version Name / Code:** `1.0.2` / `3`
- **Target SDK:** **Android 16 (API 36)**
- **Compile SDK:** **Android 16 (API 36)**
- **Min SDK:** **Android 7.0 (API 24)**
- **Production API:** `https://api.digitalghuru.com/api`

---

## 2. Reviewer Test Credentials for Google Play Console

| Persona | Login Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Student** | `student@apexacademy.com` | `Password#123` | Homework, Timetable, Attendance, Results |
| **Parent** | `parent@apex.example.com` | `Password#123` | Multi-student switch, Fee receipts, Alerts |
| **Teacher** | `teacher@apex.example.com` | `Password#123` | Voice Attendance, Homework grading, Schedule |

---

## 3. Store Listing Copy (Quick Copy)

- **Title:** `Digital Guru Franchise`
- **Short Description (Max 80):** `Empowering Students, Parents and Teachers with seamless academic management.`
- **Support Email:** `support@digitalghuru.com`
- **Privacy Policy:** `https://digitalghuru.com/privacy-policy`

---

## 4. Key EAS Commands

```bash
# Upload directly to Play Console from CLI
npx eas submit --platform android --path release-16kb.aab

# Manage or download production keystore
npx eas credentials
```
