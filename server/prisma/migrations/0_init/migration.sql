-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT');

-- CreateEnum
CREATE TYPE "FranchiseStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AgreementBusinessModel" AS ENUM ('NEW_CENTRE_JOINT_INVESTMENT', 'EXISTING_CENTRE', 'BRAND_AND_COURSE_SUPPORT', 'CUSTOM_AGREEMENT');

-- CreateEnum
CREATE TYPE "RevenueCalculationBasis" AS ENUM ('GROSS_COURSE_FEES', 'NET_COURSE_REVENUE', 'PROFIT_AFTER_EXPENSES');

-- CreateEnum
CREATE TYPE "SettlementFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ExpensePayerRole" AS ENUM ('DIGITAL_GURU', 'PARTNER', 'SHARED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RoyaltyFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "RoyaltyBasis" AS ENUM ('TOTAL_COLLECTIONS', 'TUITION_FEES_ONLY', 'NET_REVENUE');

-- CreateEnum
CREATE TYPE "RoyaltyPaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InstituteStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_SETUP');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'PASSED_OUT', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR_SCAN', 'VOICE_CONFIRMED');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'TERM_WISE', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PDF', 'IMAGE', 'AUDIO', 'VOICE_NOTE', 'TEXT', 'DOCUMENT', 'HOMEWORK', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ATTENDANCE', 'ACADEMIC', 'GENERAL', 'MESSAGE');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "GuardianRelation" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'COMPLETED', 'LATE', 'GRADED', 'RESUBMISSION_REQUESTED');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TRANSFERRED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PDF', 'ZIP', 'DOCUMENT', 'EXTERNAL_LINK', 'IMAGE');

-- CreateEnum
CREATE TYPE "LearningMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "StaffAttendanceMode" AS ENUM ('ON_SITE', 'WFH');

-- CreateEnum
CREATE TYPE "WFHAuthorizationScope" AS ENUM ('INSTITUTE_WIDE', 'INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "WFHAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WFHReasonCategory" AS ENUM ('WEATHER_DISRUPTION', 'ONLINE_CLASSES', 'INSTITUTE_CLOSURE', 'INDIVIDUAL_REQUEST', 'MANAGEMENT_APPROVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('NOT_CHECKED_IN', 'CHECKED_IN', 'CHECKED_OUT', 'LATE', 'INCOMPLETE', 'ABSENT', 'ON_LEAVE', 'MANUALLY_CORRECTED');

-- CreateEnum
CREATE TYPE "StaffAttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'MANUAL_CORRECTION', 'SYSTEM_FLAG');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Institute" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "InstituteStatus" NOT NULL DEFAULT 'ACTIVE',
    "logoUrl" TEXT,
    "admissionPrefix" TEXT,
    "settingsJson" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geofenceRadius" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "locationVerified" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI,SAT',
    "workStartTime" TEXT NOT NULL DEFAULT '09:00',
    "workEndTime" TEXT NOT NULL DEFAULT '18:00',
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "gpsAccuracyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "requireCheckoutGeofence" BOOLEAN NOT NULL DEFAULT true,
    "allowStaffWfhRequests" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "franchiseId" TEXT,

    CONSTRAINT "Institute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "xpPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteMembership" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstituteMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT,
    "designation" TEXT,
    "qualification" TEXT,
    "permissionsJson" JSONB,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "altPhone" TEXT,
    "personalEmail" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactRelation" TEXT,
    "emergencyContactPhone" TEXT,
    "avatarUrl" TEXT,
    "currentAddressLine1" TEXT,
    "currentAddressLine2" TEXT,
    "currentCity" TEXT,
    "currentState" TEXT,
    "currentPostalCode" TEXT,
    "currentCountry" TEXT DEFAULT 'India',
    "permanentAddressLine1" TEXT,
    "permanentAddressLine2" TEXT,
    "permanentCity" TEXT,
    "permanentState" TEXT,
    "permanentPostalCode" TEXT,
    "permanentCountry" TEXT DEFAULT 'India',
    "sameAsCurrentAddress" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "employmentType" TEXT DEFAULT 'FULL_TIME',
    "joiningDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "probationEndDate" TIMESTAMP(3),
    "workLocation" TEXT,
    "employmentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffQualification" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "institution" TEXT NOT NULL,
    "yearOfPassing" INTEGER,
    "gradeOrScore" TEXT,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffExperience" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "subjectsTaught" TEXT,
    "totalYears" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occupation" TEXT,
    "address" TEXT,
    "altPhone" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT,
    "franchiseId" TEXT,
    "userId" TEXT,
    "admissionNumber" TEXT NOT NULL,
    "rollNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "bloodGroup" TEXT,
    "phone" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoUrl" TEXT,
    "createdByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentParentRelation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "relation" "GuardianRelation" NOT NULL DEFAULT 'GUARDIAN',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "canReceiveSms" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentParentRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "academicYear" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchSubject" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "staffProfileId" TEXT,
    "description" TEXT,
    "schedule" TEXT,
    "meetingLink" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBatchAssignment" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffBatchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventType" "AttendanceType" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionNumber" INTEGER NOT NULL DEFAULT 1,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctionNote" TEXT,
    "idempotencyKey" TEXT,
    "markedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsNotification" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendanceEventId" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "messageBody" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledRetryAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'ATTENDANCE',
    "studentId" TEXT,
    "attendanceEventId" TEXT,
    "eventType" "AttendanceType",
    "eventTime" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "pushStatus" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "pushError" TEXT,
    "link" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevicePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMaterial" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "type" "MaterialType" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "dueDate" TIMESTAMP(3),
    "maxMarks" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "totalMarks" DECIMAL(5,2) NOT NULL,
    "passingMarks" DECIMAL(5,2) NOT NULL,
    "examDate" DATE NOT NULL,
    "academicYear" TEXT,
    "description" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "instructions" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "isResultsPublished" BOOLEAN NOT NULL DEFAULT false,
    "resultsPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "studentNotes" TEXT,
    "grade" TEXT,
    "feedback" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamMark" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DECIMAL(5,2) NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressFeedback" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT,
    "staffId" TEXT NOT NULL,
    "termName" TEXT NOT NULL,
    "periodType" TEXT DEFAULT 'TERM',
    "startDate" DATE,
    "endDate" DATE,
    "remarks" TEXT NOT NULL,
    "rating" INTEGER,
    "strengths" TEXT,
    "improvements" TEXT,
    "recommendations" TEXT,
    "attendanceRate" DECIMAL(5,2),
    "homeworkRate" DECIMAL(5,2),
    "examAverage" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentReview" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FEEDBACK',
    "subject" TEXT,
    "category" TEXT DEFAULT 'GENERAL',
    "rating" INTEGER,
    "reviewText" TEXT NOT NULL,
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "isPublicConsent" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT,
    "title" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "attachmentName" TEXT,
    "attachmentSize" INTEGER,
    "clientTempId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT,
    "frequency" "FeeFrequency" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDay" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "termLabel" TEXT,
    "academicYear" TEXT,
    "baseAmount" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeAssignmentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "transactionReference" TEXT,
    "idempotencyKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAdjustment" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT,
    "paymentId" TEXT,
    "feeAssignmentId" TEXT,
    "adjustmentType" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionSequence" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSerial" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePaymentOrder" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeAssignmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "receiptNumber" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewaySignature" TEXT,
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentFeedback" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "staffId" TEXT,
    "category" TEXT NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "teacherResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceSession" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "workDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isManuallyCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "correctedById" TEXT,
    "correctedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attendanceMode" "StaffAttendanceMode" NOT NULL DEFAULT 'ON_SITE',
    "wfhAuthorizationId" TEXT,

    CONSTRAINT "StaffAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "eventType" "StaffAttendanceEventType" NOT NULL,
    "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "distanceFromCenter" DOUBLE PRECISION,
    "isWithinGeofence" BOOLEAN NOT NULL DEFAULT false,
    "validationOutcome" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "remarks" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendanceMode" "StaffAttendanceMode" DEFAULT 'ON_SITE',
    "wfhAuthorizationId" TEXT,

    CONSTRAINT "StaffAttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWFHAuthorization" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "staffId" TEXT,
    "scope" "WFHAuthorizationScope" NOT NULL DEFAULT 'INDIVIDUAL',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reasonCategory" "WFHReasonCategory" NOT NULL DEFAULT 'INDIVIDUAL_REQUEST',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "WFHAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWFHAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WFHAuthorizationStaff" (
    "id" TEXT NOT NULL,
    "authorizationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WFHAuthorizationStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOnlineClassLog" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "batchSubjectId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "meetingLink" VARCHAR(500),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffOnlineClassLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialInteraction" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "progressPercent" DOUBLE PRECISION,
    "durationSeconds" DOUBLE PRECISION,
    "lastPositionSec" DOUBLE PRECISION,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "durationMinutes" INTEGER,
    "totalMarks" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "passingMarks" DECIMAL(5,2),
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "resultsReleased" BOOLEAN NOT NULL DEFAULT false,
    "resultsReleasedAt" TIMESTAMP(3),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "marks" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "totalMarks" DECIMAL(5,2),
    "percentage" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "marksAwarded" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'India',
    "authorizedContact" JSONB,
    "businessDetails" JSONB,
    "status" "FranchiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Franchise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseAgreement" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "annualRoyaltyAmount" DECIMAL(12,2),
    "calculationMethod" TEXT DEFAULT 'FIXED_ANNUAL',
    "perStudentFee" DECIMAL(10,2),
    "royaltyPercentage" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "royaltyBasis" "RoyaltyBasis" NOT NULL DEFAULT 'TOTAL_COLLECTIONS',
    "paymentFrequency" "RoyaltyFrequency" NOT NULL DEFAULT 'ANNUAL',
    "dueDay" INTEGER NOT NULL DEFAULT 10,
    "installmentCount" INTEGER NOT NULL DEFAULT 2,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "documentName" TEXT,
    "terms" TEXT,
    "amendments" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agreementType" "AgreementBusinessModel" NOT NULL DEFAULT 'CUSTOM_AGREEMENT',
    "totalInvestment" DECIMAL(12,2),
    "digitalGuruInvestmentAmount" DECIMAL(12,2),
    "partnerInvestmentAmount" DECIMAL(12,2),
    "digitalGuruInvestmentPercentage" DECIMAL(5,2),
    "partnerInvestmentPercentage" DECIMAL(5,2),
    "operationalSetupContribution" DECIMAL(12,2),
    "investmentNotes" TEXT,
    "digitalGuruRevenuePercentage" DECIMAL(5,2) DEFAULT 50.00,
    "partnerRevenuePercentage" DECIMAL(5,2) DEFAULT 50.00,
    "revenueCalculationBasis" "RevenueCalculationBasis" DEFAULT 'GROSS_COURSE_FEES',
    "settlementFrequency" "SettlementFrequency" DEFAULT 'YEARLY',
    "expenseResponsibilities" JSONB,
    "marketingResponsibleParty" "ExpensePayerRole" DEFAULT 'DIGITAL_GURU',
    "marketingSupportDurationMonths" INTEGER DEFAULT 3,
    "marketingPostSupportParty" "ExpensePayerRole" DEFAULT 'PARTNER',
    "marketingBudget" DECIMAL(12,2),
    "marketingEffectiveStartDate" DATE,
    "marketingNotes" TEXT,
    "courseSoftwareAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
    "courseSoftwarePricingNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentAgreementId" TEXT,

    CONSTRAINT "FranchiseAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseRoyaltyInstallment" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "outstandingBalance" DECIMAL(12,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'UPCOMING',
    "calculationBasis" TEXT NOT NULL,
    "calculationBreakdown" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseRoyaltyInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseRoyaltyRecord" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "instituteId" TEXT,
    "periodLabel" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "grossCollection" DECIMAL(12,2) NOT NULL,
    "eligibleRevenue" DECIMAL(12,2) NOT NULL,
    "royaltyPercentage" DECIMAL(5,2) NOT NULL,
    "royaltyPayable" DECIMAL(12,2) NOT NULL,
    "royaltyPaid" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "outstandingBalance" DECIMAL(12,2) NOT NULL,
    "status" "RoyaltyPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" DATE NOT NULL,
    "calculationDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseRoyaltyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseRoyaltyPayment" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "royaltyRecordId" TEXT,
    "installmentId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "transactionReference" TEXT,
    "recordedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FranchiseRoyaltyPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalCourse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subTitle" TEXT,
    "description" TEXT,
    "categoryId" TEXT,
    "format" TEXT NOT NULL DEFAULT 'Hybrid (Online + Offline)',
    "duration" TEXT,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "thumbnailUrl" TEXT,
    "bannerUrl" TEXT,
    "brochureUrl" TEXT,
    "level" TEXT NOT NULL DEFAULT 'Beginner to Advanced',
    "prerequisites" TEXT,
    "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skillsCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetAudience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "toolsCovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overviewJson" JSONB,
    "designedToHelpJson" JSONB,
    "numberedFeaturesJson" JSONB,
    "whyDigitalGhuruJson" JSONB,
    "topHighlightsJson" JSONB,
    "faqsJson" JSONB,
    "activeCurriculumVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseSlugAlias" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCurriculumVersion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Published Version',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseCurriculumVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseChapter" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "pdfUrl" TEXT,
    "duration" TEXT NOT NULL DEFAULT '15:00',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAttachment" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" "AttachmentType" NOT NULL DEFAULT 'PDF',
    "fileSize" INTEGER,
    "isDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseCourseSelection" (
    "id" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "localFeeOverride" DECIMAL(10,2),
    "maxCapacityPerBatch" INTEGER,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseCourseSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "mode" "LearningMode" NOT NULL DEFAULT 'ONLINE',
    "instituteId" TEXT,
    "batchId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "transferredFromEnrollmentId" TEXT,
    "transferReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLessonProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "completedViaMode" "LearningMode",

    CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentXpLedger" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT,
    "courseId" TEXT,
    "amount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentXpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseCertificate" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "qualifyingEnrollmentId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfDownloadUrl" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "CourseCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institute_code_key" ON "Institute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Institute_admissionPrefix_key" ON "Institute"("admissionPrefix");

-- CreateIndex
CREATE INDEX "Institute_status_idx" ON "Institute"("status");

-- CreateIndex
CREATE INDEX "Institute_name_idx" ON "Institute"("name");

-- CreateIndex
CREATE INDEX "Institute_franchiseId_idx" ON "Institute"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "InstituteMembership_instituteId_idx" ON "InstituteMembership"("instituteId");

-- CreateIndex
CREATE INDEX "InstituteMembership_userId_idx" ON "InstituteMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteMembership_instituteId_userId_key" ON "InstituteMembership"("instituteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_instituteId_idx" ON "StaffProfile"("instituteId");

-- CreateIndex
CREATE INDEX "StaffProfile_instituteId_department_idx" ON "StaffProfile"("instituteId", "department");

-- CreateIndex
CREATE INDEX "StaffProfile_instituteId_designation_idx" ON "StaffProfile"("instituteId", "designation");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_instituteId_employeeCode_key" ON "StaffProfile"("instituteId", "employeeCode");

-- CreateIndex
CREATE INDEX "StaffQualification_staffProfileId_idx" ON "StaffQualification"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffExperience_staffProfileId_idx" ON "StaffExperience"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffDocument_staffProfileId_idx" ON "StaffDocument"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffDocument_instituteId_idx" ON "StaffDocument"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_instituteId_idx" ON "Student"("instituteId");

-- CreateIndex
CREATE INDEX "Student_instituteId_status_idx" ON "Student"("instituteId", "status");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "Student_firstName_lastName_idx" ON "Student"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Student_createdByUserId_idx" ON "Student"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_instituteId_admissionNumber_key" ON "Student"("instituteId", "admissionNumber");

-- CreateIndex
CREATE INDEX "StudentParentRelation_studentId_idx" ON "StudentParentRelation"("studentId");

-- CreateIndex
CREATE INDEX "StudentParentRelation_parentId_idx" ON "StudentParentRelation"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentParentRelation_studentId_parentId_key" ON "StudentParentRelation"("studentId", "parentId");

-- CreateIndex
CREATE INDEX "Subject_instituteId_idx" ON "Subject"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_instituteId_name_key" ON "Subject"("instituteId", "name");

-- CreateIndex
CREATE INDEX "Batch_instituteId_idx" ON "Batch"("instituteId");

-- CreateIndex
CREATE INDEX "Batch_instituteId_code_idx" ON "Batch"("instituteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_instituteId_name_academicYear_key" ON "Batch"("instituteId", "name", "academicYear");

-- CreateIndex
CREATE INDEX "BatchSubject_batchId_idx" ON "BatchSubject"("batchId");

-- CreateIndex
CREATE INDEX "BatchSubject_subjectId_idx" ON "BatchSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchSubject_batchId_subjectId_key" ON "BatchSubject"("batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffBatchAssignment_staffProfileId_batchId_key" ON "StaffBatchAssignment"("staffProfileId", "batchId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_batchId_idx" ON "StudentEnrollment"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_batchId_subjectId_key" ON "StudentEnrollment"("studentId", "batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_idempotencyKey_key" ON "AttendanceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AttendanceEvent_instituteId_eventDate_idx" ON "AttendanceEvent"("instituteId", "eventDate");

-- CreateIndex
CREATE INDEX "AttendanceEvent_batchId_eventDate_idx" ON "AttendanceEvent"("batchId", "eventDate");

-- CreateIndex
CREATE INDEX "AttendanceEvent_studentId_eventDate_idx" ON "AttendanceEvent"("studentId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_studentId_eventDate_eventType_sessionNumber_key" ON "AttendanceEvent"("studentId", "eventDate", "eventType", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SmsNotification_idempotencyKey_key" ON "SmsNotification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SmsNotification_instituteId_status_idx" ON "SmsNotification"("instituteId", "status");

-- CreateIndex
CREATE INDEX "SmsNotification_attendanceEventId_idx" ON "SmsNotification"("attendanceEventId");

-- CreateIndex
CREATE INDEX "SmsNotification_scheduledRetryAt_idx" ON "SmsNotification"("scheduledRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_instituteId_createdAt_idx" ON "Notification"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_attendanceEventId_idx" ON "Notification"("attendanceEventId");

-- CreateIndex
CREATE INDEX "Notification_studentId_idx" ON "Notification"("studentId");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");

-- CreateIndex
CREATE INDEX "DevicePushToken_userId_idx" ON "DevicePushToken"("userId");

-- CreateIndex
CREATE INDEX "LearningMaterial_instituteId_batchId_idx" ON "LearningMaterial"("instituteId", "batchId");

-- CreateIndex
CREATE INDEX "LearningMaterial_type_idx" ON "LearningMaterial"("type");

-- CreateIndex
CREATE INDEX "Examination_instituteId_batchId_idx" ON "Examination"("instituteId", "batchId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_materialId_idx" ON "HomeworkSubmission"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_materialId_studentId_key" ON "HomeworkSubmission"("materialId", "studentId");

-- CreateIndex
CREATE INDEX "ExamMark_studentId_idx" ON "ExamMark"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMark_examId_studentId_key" ON "ExamMark"("examId", "studentId");

-- CreateIndex
CREATE INDEX "ProgressFeedback_studentId_idx" ON "ProgressFeedback"("studentId");

-- CreateIndex
CREATE INDEX "ProgressFeedback_batchId_idx" ON "ProgressFeedback"("batchId");

-- CreateIndex
CREATE INDEX "ProgressFeedback_subjectId_idx" ON "ProgressFeedback"("subjectId");

-- CreateIndex
CREATE INDEX "ParentReview_instituteId_idx" ON "ParentReview"("instituteId");

-- CreateIndex
CREATE INDEX "ParentReview_parentId_idx" ON "ParentReview"("parentId");

-- CreateIndex
CREATE INDEX "ParentReview_studentId_idx" ON "ParentReview"("studentId");

-- CreateIndex
CREATE INDEX "Conversation_instituteId_idx" ON "Conversation"("instituteId");

-- CreateIndex
CREATE INDEX "Conversation_studentId_idx" ON "Conversation"("studentId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_clientTempId_idx" ON "Message"("clientTempId");

-- CreateIndex
CREATE INDEX "FeeStructure_instituteId_idx" ON "FeeStructure"("instituteId");

-- CreateIndex
CREATE INDEX "StudentFeeAssignment_status_idx" ON "StudentFeeAssignment"("status");

-- CreateIndex
CREATE INDEX "StudentFeeAssignment_studentId_idx" ON "StudentFeeAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAssignment_studentId_feeStructureId_termLabel_key" ON "StudentFeeAssignment"("studentId", "feeStructureId", "termLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_instituteId_paidAt_idx" ON "Payment"("instituteId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_instituteId_idx" ON "PaymentAdjustment"("instituteId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_paymentId_idx" ON "PaymentAdjustment"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAdjustment_feeAssignmentId_idx" ON "PaymentAdjustment"("feeAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditLog_instituteId_createdAt_idx" ON "AuditLog"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdmissionSequence_instituteId_year_idx" ON "AdmissionSequence"("instituteId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSequence_instituteId_year_key" ON "AdmissionSequence"("instituteId", "year");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_isRead_idx" ON "InAppNotification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "InAppNotification_instituteId_createdAt_idx" ON "InAppNotification"("instituteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentOrder_orderId_key" ON "OnlinePaymentOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentOrder_idempotencyKey_key" ON "OnlinePaymentOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OnlinePaymentOrder_instituteId_idx" ON "OnlinePaymentOrder"("instituteId");

-- CreateIndex
CREATE INDEX "OnlinePaymentOrder_studentId_idx" ON "OnlinePaymentOrder"("studentId");

-- CreateIndex
CREATE INDEX "OnlinePaymentOrder_orderId_idx" ON "OnlinePaymentOrder"("orderId");

-- CreateIndex
CREATE INDEX "OnlinePaymentOrder_status_idx" ON "OnlinePaymentOrder"("status");

-- CreateIndex
CREATE INDEX "ParentFeedback_instituteId_idx" ON "ParentFeedback"("instituteId");

-- CreateIndex
CREATE INDEX "ParentFeedback_studentId_idx" ON "ParentFeedback"("studentId");

-- CreateIndex
CREATE INDEX "ParentFeedback_parentId_idx" ON "ParentFeedback"("parentId");

-- CreateIndex
CREATE INDEX "ParentFeedback_staffId_idx" ON "ParentFeedback"("staffId");

-- CreateIndex
CREATE INDEX "ParentFeedback_status_idx" ON "ParentFeedback"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_instituteId_attendanceDate_idx" ON "StaffAttendanceSession"("instituteId", "attendanceDate");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_staffId_idx" ON "StaffAttendanceSession"("staffId");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_status_idx" ON "StaffAttendanceSession"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_attendanceMode_idx" ON "StaffAttendanceSession"("attendanceMode");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_instituteId_status_attendanceDate_idx" ON "StaffAttendanceSession"("instituteId", "status", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceSession_instituteId_staffId_attendanceDate_key" ON "StaffAttendanceSession"("instituteId", "staffId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceEvent_idempotencyKey_key" ON "StaffAttendanceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StaffAttendanceEvent_sessionId_idx" ON "StaffAttendanceEvent"("sessionId");

-- CreateIndex
CREATE INDEX "StaffAttendanceEvent_staffId_idx" ON "StaffAttendanceEvent"("staffId");

-- CreateIndex
CREATE INDEX "StaffAttendanceEvent_instituteId_serverTimestamp_idx" ON "StaffAttendanceEvent"("instituteId", "serverTimestamp");

-- CreateIndex
CREATE INDEX "StaffWFHAuthorization_instituteId_startDate_endDate_idx" ON "StaffWFHAuthorization"("instituteId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffWFHAuthorization_instituteId_staffId_status_idx" ON "StaffWFHAuthorization"("instituteId", "staffId", "status");

-- CreateIndex
CREATE INDEX "StaffWFHAuthorization_instituteId_scope_status_idx" ON "StaffWFHAuthorization"("instituteId", "scope", "status");

-- CreateIndex
CREATE INDEX "WFHAuthorizationStaff_staffId_idx" ON "WFHAuthorizationStaff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "WFHAuthorizationStaff_authorizationId_staffId_key" ON "WFHAuthorizationStaff"("authorizationId", "staffId");

-- CreateIndex
CREATE INDEX "StaffOnlineClassLog_instituteId_deliveryDate_idx" ON "StaffOnlineClassLog"("instituteId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOnlineClassLog_staffId_batchSubjectId_deliveryDate_key" ON "StaffOnlineClassLog"("staffId", "batchSubjectId", "deliveryDate");

-- CreateIndex
CREATE INDEX "MaterialInteraction_studentId_idx" ON "MaterialInteraction"("studentId");

-- CreateIndex
CREATE INDEX "MaterialInteraction_materialId_idx" ON "MaterialInteraction"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialInteraction_materialId_studentId_interactionType_key" ON "MaterialInteraction"("materialId", "studentId", "interactionType");

-- CreateIndex
CREATE INDEX "Quiz_instituteId_batchId_idx" ON "Quiz"("instituteId", "batchId");

-- CreateIndex
CREATE INDEX "Quiz_status_idx" ON "Quiz"("status");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");

-- CreateIndex
CREATE INDEX "QuizOption_questionId_idx" ON "QuizOption"("questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_attemptNumber_key" ON "QuizAttempt"("quizId", "studentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_code_key" ON "Franchise"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_email_key" ON "Franchise"("email");

-- CreateIndex
CREATE INDEX "Franchise_status_idx" ON "Franchise"("status");

-- CreateIndex
CREATE INDEX "Franchise_name_idx" ON "Franchise"("name");

-- CreateIndex
CREATE INDEX "Franchise_code_idx" ON "Franchise"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseAgreement_agreementNumber_key" ON "FranchiseAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_franchiseId_idx" ON "FranchiseAgreement"("franchiseId");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_status_idx" ON "FranchiseAgreement"("status");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_agreementNumber_idx" ON "FranchiseAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_endDate_idx" ON "FranchiseAgreement"("endDate");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_agreementType_idx" ON "FranchiseAgreement"("agreementType");

-- CreateIndex
CREATE INDEX "FranchiseAgreement_parentAgreementId_idx" ON "FranchiseAgreement"("parentAgreementId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyInstallment_franchiseId_idx" ON "FranchiseRoyaltyInstallment"("franchiseId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyInstallment_agreementId_idx" ON "FranchiseRoyaltyInstallment"("agreementId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyInstallment_status_idx" ON "FranchiseRoyaltyInstallment"("status");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyInstallment_dueDate_idx" ON "FranchiseRoyaltyInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseRoyaltyInstallment_agreementId_installmentNumber_key" ON "FranchiseRoyaltyInstallment"("agreementId", "installmentNumber");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyRecord_franchiseId_idx" ON "FranchiseRoyaltyRecord"("franchiseId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyRecord_status_idx" ON "FranchiseRoyaltyRecord"("status");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyRecord_dueDate_idx" ON "FranchiseRoyaltyRecord"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseRoyaltyRecord_franchiseId_periodLabel_instituteId_key" ON "FranchiseRoyaltyRecord"("franchiseId", "periodLabel", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseRoyaltyPayment_receiptNumber_key" ON "FranchiseRoyaltyPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyPayment_franchiseId_idx" ON "FranchiseRoyaltyPayment"("franchiseId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyPayment_installmentId_idx" ON "FranchiseRoyaltyPayment"("installmentId");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyPayment_paymentDate_idx" ON "FranchiseRoyaltyPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "FranchiseRoyaltyPayment_receiptNumber_idx" ON "FranchiseRoyaltyPayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCategory_name_key" ON "CourseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCategory_slug_key" ON "CourseCategory"("slug");

-- CreateIndex
CREATE INDEX "CourseCategory_slug_idx" ON "CourseCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalCourse_slug_key" ON "GlobalCourse"("slug");

-- CreateIndex
CREATE INDEX "GlobalCourse_slug_idx" ON "GlobalCourse"("slug");

-- CreateIndex
CREATE INDEX "GlobalCourse_status_idx" ON "GlobalCourse"("status");

-- CreateIndex
CREATE INDEX "GlobalCourse_categoryId_idx" ON "GlobalCourse"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseSlugAlias_slug_key" ON "CourseSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "CourseSlugAlias_slug_idx" ON "CourseSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "CourseCurriculumVersion_courseId_isPublished_idx" ON "CourseCurriculumVersion"("courseId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCurriculumVersion_courseId_version_key" ON "CourseCurriculumVersion"("courseId", "version");

-- CreateIndex
CREATE INDEX "CourseModule_curriculumVersionId_position_idx" ON "CourseModule"("curriculumVersionId", "position");

-- CreateIndex
CREATE INDEX "CourseModule_curriculumVersionId_isArchived_idx" ON "CourseModule"("curriculumVersionId", "isArchived");

-- CreateIndex
CREATE INDEX "CourseChapter_moduleId_position_idx" ON "CourseChapter"("moduleId", "position");

-- CreateIndex
CREATE INDEX "CourseChapter_moduleId_isArchived_idx" ON "CourseChapter"("moduleId", "isArchived");

-- CreateIndex
CREATE INDEX "LessonAttachment_chapterId_idx" ON "LessonAttachment"("chapterId");

-- CreateIndex
CREATE INDEX "FranchiseCourseSelection_franchiseId_isEnabled_idx" ON "FranchiseCourseSelection"("franchiseId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseCourseSelection_franchiseId_courseId_key" ON "FranchiseCourseSelection"("franchiseId", "courseId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_courseId_mode_idx" ON "CourseEnrollment"("studentId", "courseId", "mode");

-- CreateIndex
CREATE INDEX "CourseEnrollment_studentId_status_idx" ON "CourseEnrollment"("studentId", "status");

-- CreateIndex
CREATE INDEX "CourseEnrollment_franchiseId_mode_status_idx" ON "CourseEnrollment"("franchiseId", "mode", "status");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_status_idx" ON "CourseEnrollment"("courseId", "status");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_studentId_courseId_curriculumVersionI_idx" ON "StudentLessonProgress"("studentId", "courseId", "curriculumVersionId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_studentId_isCompleted_idx" ON "StudentLessonProgress"("studentId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLessonProgress_studentId_chapterId_key" ON "StudentLessonProgress"("studentId", "chapterId");

-- CreateIndex
CREATE INDEX "StudentXpLedger_studentId_createdAt_idx" ON "StudentXpLedger"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentXpLedger_userId_idx" ON "StudentXpLedger"("userId");

-- CreateIndex
CREATE INDEX "StudentXpLedger_courseId_idx" ON "StudentXpLedger"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentXpLedger_studentId_action_referenceId_key" ON "StudentXpLedger"("studentId", "action", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCertificate_certificateNumber_key" ON "CourseCertificate"("certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCertificate_verificationCode_key" ON "CourseCertificate"("verificationCode");

-- CreateIndex
CREATE INDEX "CourseCertificate_certificateNumber_idx" ON "CourseCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "CourseCertificate_verificationCode_idx" ON "CourseCertificate"("verificationCode");

-- CreateIndex
CREATE INDEX "CourseCertificate_studentId_idx" ON "CourseCertificate"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseCertificate_studentId_courseId_key" ON "CourseCertificate"("studentId", "courseId");

-- AddForeignKey
ALTER TABLE "Institute" ADD CONSTRAINT "Institute_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteMembership" ADD CONSTRAINT "InstituteMembership_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteMembership" ADD CONSTRAINT "InstituteMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffExperience" ADD CONSTRAINT "StaffExperience_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentParentRelation" ADD CONSTRAINT "StudentParentRelation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentParentRelation" ADD CONSTRAINT "StudentParentRelation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSubject" ADD CONSTRAINT "BatchSubject_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSubject" ADD CONSTRAINT "BatchSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSubject" ADD CONSTRAINT "BatchSubject_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBatchAssignment" ADD CONSTRAINT "StaffBatchAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBatchAssignment" ADD CONSTRAINT "StaffBatchAssignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsNotification" ADD CONSTRAINT "SmsNotification_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsNotification" ADD CONSTRAINT "SmsNotification_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsNotification" ADD CONSTRAINT "SmsNotification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsNotification" ADD CONSTRAINT "SmsNotification_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningMaterial" ADD CONSTRAINT "LearningMaterial_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Examination" ADD CONSTRAINT "Examination_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "LearningMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Examination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressFeedback" ADD CONSTRAINT "ProgressFeedback_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressFeedback" ADD CONSTRAINT "ProgressFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressFeedback" ADD CONSTRAINT "ProgressFeedback_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressFeedback" ADD CONSTRAINT "ProgressFeedback_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressFeedback" ADD CONSTRAINT "ProgressFeedback_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentReview" ADD CONSTRAINT "ParentReview_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAssignment" ADD CONSTRAINT "StudentFeeAssignment_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_feeAssignmentId_fkey" FOREIGN KEY ("feeAssignmentId") REFERENCES "StudentFeeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_feeAssignmentId_fkey" FOREIGN KEY ("feeAssignmentId") REFERENCES "StudentFeeAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionSequence" ADD CONSTRAINT "AdmissionSequence_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentOrder" ADD CONSTRAINT "OnlinePaymentOrder_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentOrder" ADD CONSTRAINT "OnlinePaymentOrder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentOrder" ADD CONSTRAINT "OnlinePaymentOrder_feeAssignmentId_fkey" FOREIGN KEY ("feeAssignmentId") REFERENCES "StudentFeeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentFeedback" ADD CONSTRAINT "ParentFeedback_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_wfhAuthorizationId_fkey" FOREIGN KEY ("wfhAuthorizationId") REFERENCES "StaffWFHAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_wfhAuthorizationId_fkey" FOREIGN KEY ("wfhAuthorizationId") REFERENCES "StaffWFHAuthorization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StaffAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWFHAuthorization" ADD CONSTRAINT "StaffWFHAuthorization_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WFHAuthorizationStaff" ADD CONSTRAINT "WFHAuthorizationStaff_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "StaffWFHAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WFHAuthorizationStaff" ADD CONSTRAINT "WFHAuthorizationStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnlineClassLog" ADD CONSTRAINT "StaffOnlineClassLog_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnlineClassLog" ADD CONSTRAINT "StaffOnlineClassLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnlineClassLog" ADD CONSTRAINT "StaffOnlineClassLog_batchSubjectId_fkey" FOREIGN KEY ("batchSubjectId") REFERENCES "BatchSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialInteraction" ADD CONSTRAINT "MaterialInteraction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "LearningMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialInteraction" ADD CONSTRAINT "MaterialInteraction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Franchise" ADD CONSTRAINT "Franchise_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseAgreement" ADD CONSTRAINT "FranchiseAgreement_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseAgreement" ADD CONSTRAINT "FranchiseAgreement_parentAgreementId_fkey" FOREIGN KEY ("parentAgreementId") REFERENCES "FranchiseAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyInstallment" ADD CONSTRAINT "FranchiseRoyaltyInstallment_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyInstallment" ADD CONSTRAINT "FranchiseRoyaltyInstallment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "FranchiseAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyRecord" ADD CONSTRAINT "FranchiseRoyaltyRecord_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyRecord" ADD CONSTRAINT "FranchiseRoyaltyRecord_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyPayment" ADD CONSTRAINT "FranchiseRoyaltyPayment_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyPayment" ADD CONSTRAINT "FranchiseRoyaltyPayment_royaltyRecordId_fkey" FOREIGN KEY ("royaltyRecordId") REFERENCES "FranchiseRoyaltyRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyPayment" ADD CONSTRAINT "FranchiseRoyaltyPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "FranchiseRoyaltyInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseRoyaltyPayment" ADD CONSTRAINT "FranchiseRoyaltyPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalCourse" ADD CONSTRAINT "GlobalCourse_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CourseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalCourse" ADD CONSTRAINT "GlobalCourse_activeCurriculumVersionId_fkey" FOREIGN KEY ("activeCurriculumVersionId") REFERENCES "CourseCurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalCourse" ADD CONSTRAINT "GlobalCourse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSlugAlias" ADD CONSTRAINT "CourseSlugAlias_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCurriculumVersion" ADD CONSTRAINT "CourseCurriculumVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CourseCurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonAttachment" ADD CONSTRAINT "LessonAttachment_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseCourseSelection" ADD CONSTRAINT "FranchiseCourseSelection_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FranchiseCourseSelection" ADD CONSTRAINT "FranchiseCourseSelection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CourseCurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_transferredFromEnrollmentId_fkey" FOREIGN KEY ("transferredFromEnrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CourseCurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentXpLedger" ADD CONSTRAINT "StudentXpLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentXpLedger" ADD CONSTRAINT "StudentXpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentXpLedger" ADD CONSTRAINT "StudentXpLedger_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CourseCurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseCertificate" ADD CONSTRAINT "CourseCertificate_qualifyingEnrollmentId_fkey" FOREIGN KEY ("qualifyingEnrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

