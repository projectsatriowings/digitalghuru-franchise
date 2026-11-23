# Digital Guru Franchise — Mobile Phase 5: Teacher API Mapping

**Date:** November 23, 2026  
**Audience:** Mobile Engineering & Backend API Consumers  
**Target Platform:** React Native + Expo (Android & iOS)  
**Role:** `STAFF` (Teacher / Faculty)

---

## 1. Authentication & Security Principles

All Teacher endpoints enforce:
1. **Bearer Token Authentication:** Every request must include `Authorization: Bearer <accessToken>` in the HTTP headers.
2. **Institute Isolation (`requireInstituteContext`):** Automatically bound through the teacher's active membership or `X-Institute-Id` header.
3. **Role Authorization (`requireRole('STAFF', ...)`):** The token's decoded role must be `STAFF` or an administrative role (`ACADEMIC_ADMIN`, `SUPER_ADMIN`).
4. **Pedagogical Scope Defense:** A teacher can **only** inspect and interact with batches, subjects, students, homework, attendance sessions, and materials assigned to them in `StaffBatchAssignment` and `BatchSubject`. Any attempt to access unassigned batches, subjects, or students returns `403 Forbidden`.

---

## 2. API Endpoint Inventory

### 2.1 Teacher Identity & Dashboard

#### `GET /api/staff/my/profile`
- **Purpose:** Retrieves the authenticated teacher's staff profile, qualifications, employment details, and active batch/subject assignments.
- **Authorization:** `STAFF`, `ACADEMIC_ADMIN`, `SUPER_ADMIN`
- **Headers:** `Authorization: Bearer <token>`
- **Response Shape:**
  ```json
  {
    "success": true,
    "data": {
      "profile": {
        "id": "8e4c9948-ca18-411d-9952-931f728896f8",
        "employeeCode": "APEX-EMP-001",
        "designation": "Senior Physics Lecturer",
        "avatarUrl": null,
        "dob": "1988-06-15T00:00:00.000Z",
        "gender": "Female",
        "altPhone": "9876543210",
        "user": {
          "id": "da569de3-a202-406a-8782-0792d840c41d",
          "fullName": "Prof. Anita Verma",
          "email": "teacher@apex.example.com",
          "phone": "9876543210"
        },
        "institute": {
          "id": "fe91e4a2-8c89-44d9-8609-3509b6d577d3",
          "name": "Apex Tuition Academy",
          "code": "APEX-01"
        },
        "assignedBatches": [
          {
            "id": "e9a2c729-884d-420c-92f8-2c5ed55d08f4",
            "name": "Grade 10 - Science Batch A",
            "code": "G10-SCI-A",
            "academicYear": "2026-2027"
          }
        ],
        "assignedSubjects": [
          {
            "batchId": "e9a2c729-884d-420c-92f8-2c5ed55d08f4",
            "batchName": "Grade 10 - Science Batch A",
            "subjectId": "sub-101",
            "subjectName": "Physics"
          }
        ]
      }
    }
  }
  ```

#### `GET /api/staff/my/dashboard`
- **Purpose:** Aggregates real-time figures for the teacher's daily mobile dashboard.
- **Authorization:** `STAFF`
- **Response Shape:**
  ```json
  {
    "success": true,
    "data": {
      "teacher": {
        "id": "8e4c9948-ca18-411d-9952-931f728896f8",
        "fullName": "Prof. Anita Verma",
        "designation": "Senior Physics Lecturer",
        "employeeCode": "APEX-EMP-001",
        "avatarUrl": null
      },
      "institute": {
        "id": "fe91e4a2-8c89-44d9-8609-3509b6d577d3",
        "name": "Apex Tuition Academy"
      },
      "metrics": {
        "totalBatches": 2,
        "totalSubjects": 3,
        "totalStudents": 45,
        "pendingHomeworkEvaluations": 4,
        "todayClassesCount": 2,
        "todayAttendance": {
          "presentCount": 38,
          "totalEnrolled": 45,
          "percentage": 84
        }
      },
      "todayClasses": [
        {
          "startTime": "09:00 AM",
          "endTime": "10:30 AM",
          "subject": "Physics",
          "batchName": "Grade 10 - Science Batch A",
          "room": "Lab 2"
        }
      ],
      "recentNotifications": []
    }
  }
  ```

---

### 2.2 Assigned Batches & Subjects

#### `GET /api/academics/batches`
- **Purpose:** Retrieves only the batches assigned to the authenticated teacher.
- **Authorization:** `STAFF` (automatically scoped on backend via `getAuthorizedStaffAssignments`)
- **Response Shape:**
  ```json
  {
    "success": true,
    "data": {
      "batches": [
        {
          "id": "e9a2c729-884d-420c-92f8-2c5ed55d08f4",
          "name": "Grade 10 - Science Batch A",
          "code": "G10-SCI-A",
          "academicYear": "2026-2027",
          "schedule": "Monday, Wednesday, Friday 09:00 AM - 10:30 AM",
          "studentsCount": 22,
          "batchSubjects": [
            {
              "id": "bs-01",
              "subject": { "id": "sub-01", "name": "Physics", "code": "PHY10" }
            }
          ]
        }
      ]
    }
  }
  ```

#### `GET /api/academics/batches/:id`
- **Purpose:** Retrieves batch curriculum, roster, and subject allocations.
- **Authorization:** `STAFF` (guarded by `isStaffAssignedToBatch`; 403 Forbidden if unassigned)

---

### 2.3 Student Directory & Student Details

#### `GET /api/students`
- **Query Parameters:** `?batchId=...&subjectId=...&search=...&page=1&limit=20`
- **Purpose:** Searches students within the teacher's permitted batch/subject scope.
- **Authorization:** `STAFF` (strictly enforces `isStaffAssignedToBatch` and `isStaffAssignedToBatchSubject`)

#### `GET /api/students/:id`
- **Purpose:** Retrieves student profile, enrollments, course enrollments, and academic identity.
- **Authorization:** `STAFF` (guarded by `isStudentAuthorized`; parent-private fields withheld)

#### `GET /api/staff/my/students`
- **Purpose:** Convenience directory returning all students authorized for the logged-in teacher across their assigned batches, enriched with today's attendance status.
- **Authorization:** `STAFF`

---

### 2.4 Voice & Standard Attendance

#### `POST /api/attendance/voice-match` & `GET /api/attendance/voice-match`
- **Body / Query:**
  ```json
  {
    "transcript": "Aarav Kumar",
    "batchId": "e9a2c729-884d-420c-92f8-2c5ed55d08f4",
    "subjectId": "sub-01"
  }
  ```
- **Purpose:** Matches the spoken student name against authorized batch students using phonetic/fuzzy matching.
- **Response Shape (Single Match):**
  ```json
  {
    "success": true,
    "status": "EXACT_SINGLE",
    "matchCount": 1,
    "bestMatch": {
      "id": "student-uuid",
      "firstName": "Aarav",
      "lastName": "Kumar",
      "admissionNumber": "ADM-2026-001",
      "alreadyCheckedIn": false,
      "recommendedAction": "CHECK_IN"
    },
    "autoActionEligible": true
  }
  ```
- **Response Shape (Multiple Matches):**
  ```json
  {
    "success": true,
    "status": "EXACT_MULTIPLE",
    "matchCount": 2,
    "matches": [ ... ]
  }
  ```

#### `POST /api/attendance/check-in`
- **Body:**
  ```json
  {
    "studentId": "student-uuid",
    "batchId": "e9a2c729-884d-420c-92f8-2c5ed55d08f4",
    "subjectId": "sub-01",
    "method": "VOICE_CONFIRMED"
  }
  ```
- **Duplicate Prevention:** If student is already checked in, returns `409 Conflict` with `alreadyCheckedIn: true` and the previous check-in time.
- **Authorization:** Guarded by `isStaffAssignedToBatch` and `isStudentAuthorized`.

#### `POST /api/attendance/check-out`
- **Body:** `{ "studentId": "...", "batchId": "..." }`
- **Purpose:** Records student campus departure.

#### `GET /api/attendance/reports`
- **Query:** `?batchId=...&date=YYYY-MM-DD`
- **Purpose:** Retrieves batch attendance sheet with student-level status (`PRESENT`, `ABSENT`, `LATE`).

---

### 2.5 Homework & Assignment Management

#### `GET /api/homework`
- **Query:** `?batchId=...&subjectId=...`
- **Purpose:** Lists existing homework assignments created for permitted batches/subjects.

#### `POST /api/homework`
- **Content-Type:** `multipart/form-data`
- **Form Fields:** `batchId`, `subjectId`, `title`, `description`, `dueDate`, `maxMarks`, `file` (optional attachment)
- **Authorization:** `STAFF` (guarded by `isStaffAssignedToBatch` and `isStaffAssignedToBatchSubject`)

#### `GET /api/homework/:id/submissions`
- **Purpose:** Lists all student submissions for a homework assignment.
- **Response Shape:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "sub-123",
        "student": { "id": "s-1", "firstName": "Aarav", "lastName": "Kumar", "admissionNumber": "ADM-001" },
        "submittedAt": "2026-11-20T10:00:00Z",
        "fileUrl": "...",
        "studentNotes": "Completed all questions",
        "score": 95,
        "feedback": "Excellent derivation",
        "gradedAt": "2026-11-21T14:00:00Z"
      }
    ]
  }
  ```

#### `PATCH /api/homework/submissions/:submissionId/grade`
- **Body:** `{ "score": 95, "feedback": "Excellent work" }`
- **Purpose:** Submits grade and evaluation remarks. Guarded against evaluating another teacher's assignment.

---

### 2.6 Learning Materials

#### `GET /api/materials`
- **Query:** `?batchId=...&subjectId=...`
- **Purpose:** Lists class study materials and notes within the teacher's scope.

#### `POST /api/materials`
- **Content-Type:** `multipart/form-data`
- **Form Fields:** `batchId`, `subjectId`, `title`, `description`, `fileType`, `file`
- **Authorization:** `STAFF`

#### `DELETE /api/materials/:id`
- **Purpose:** Deletes uploaded learning material owned by the teacher.

---

### 2.7 Student Progress & Teacher Evaluations

#### `GET /api/progress`
- **Query:** `?batchId=...&subjectId=...`
- **Purpose:** Retrieves progress review records and evaluations.

#### `POST /api/progress`
- **Body:**
  ```json
  {
    "studentId": "student-uuid",
    "batchId": "batch-uuid",
    "subjectId": "subject-uuid",
    "category": "Academic Progress",
    "rating": 5,
    "remarks": "Strong conceptual foundation in mechanics."
  }
  ```
- **Authorization:** `STAFF` (guarded by `isStaffAssignedToBatch`)

---

### 2.8 Timetable

#### `GET /api/staff/my/timetable`
- **Purpose:** Resolves and returns weekly structured schedule (Monday–Saturday) for all classes assigned to the teacher.
- **Authorization:** `STAFF`

---

### 2.9 Notifications

#### `GET /api/notifications`
- **Purpose:** Lists center announcements and academic alerts.

#### `PATCH /api/notifications/:id/read`
- **Purpose:** Marks an alert as read.
