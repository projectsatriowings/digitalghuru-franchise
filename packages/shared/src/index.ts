// User Roles across the platform
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FRANCHISE_OWNER: 'FRANCHISE_OWNER',
  BRANCH_ADMIN: 'BRANCH_ADMIN',
  ACADEMIC_ADMIN: 'ACADEMIC_ADMIN',
  STAFF: 'STAFF',
  PARENT: 'PARENT',
  STUDENT: 'STUDENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Franchise Status
export const FranchiseStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type FranchiseStatus = (typeof FranchiseStatus)[keyof typeof FranchiseStatus];

// Agreement Status
export const AgreementStatus = {
  DRAFT: 'DRAFT',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];

// Agreement Business Models
export const AgreementBusinessModel = {
  NEW_CENTRE_JOINT_INVESTMENT: 'NEW_CENTRE_JOINT_INVESTMENT',
  EXISTING_CENTRE: 'EXISTING_CENTRE',
  BRAND_AND_COURSE_SUPPORT: 'BRAND_AND_COURSE_SUPPORT',
  CUSTOM_AGREEMENT: 'CUSTOM_AGREEMENT',
} as const;
export type AgreementBusinessModel = (typeof AgreementBusinessModel)[keyof typeof AgreementBusinessModel];

// Revenue Calculation Basis
export const RevenueCalculationBasis = {
  GROSS_COURSE_FEES: 'GROSS_COURSE_FEES',
  NET_COURSE_REVENUE: 'NET_COURSE_REVENUE',
  PROFIT_AFTER_EXPENSES: 'PROFIT_AFTER_EXPENSES',
} as const;
export type RevenueCalculationBasis = (typeof RevenueCalculationBasis)[keyof typeof RevenueCalculationBasis];

// Settlement Frequency
export const SettlementFrequency = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type SettlementFrequency = (typeof SettlementFrequency)[keyof typeof SettlementFrequency];

// Expense Payer Role
export const ExpensePayerRole = {
  DIGITAL_GURU: 'DIGITAL_GURU',
  PARTNER: 'PARTNER',
  SHARED: 'SHARED',
  CUSTOM: 'CUSTOM',
} as const;
export type ExpensePayerRole = (typeof ExpensePayerRole)[keyof typeof ExpensePayerRole];

// Royalty Frequency
export const RoyaltyFrequency = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
} as const;
export type RoyaltyFrequency = (typeof RoyaltyFrequency)[keyof typeof RoyaltyFrequency];

// Royalty Calculation Basis
export const RoyaltyBasis = {
  TOTAL_COLLECTIONS: 'TOTAL_COLLECTIONS',
  TUITION_FEES_ONLY: 'TUITION_FEES_ONLY',
  NET_REVENUE: 'NET_REVENUE',
} as const;
export type RoyaltyBasis = (typeof RoyaltyBasis)[keyof typeof RoyaltyBasis];

// Royalty Payment Status
export const RoyaltyPaymentStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type RoyaltyPaymentStatus = (typeof RoyaltyPaymentStatus)[keyof typeof RoyaltyPaymentStatus];

// Installment Status
export const InstallmentStatus = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type InstallmentStatus = (typeof InstallmentStatus)[keyof typeof InstallmentStatus];

// Royalty Calculation Method
export const RoyaltyCalculationMethod = {
  FIXED_ANNUAL: 'FIXED_ANNUAL',
  PERCENTAGE_REVENUE: 'PERCENTAGE_REVENUE',
  PER_STUDENT: 'PER_STUDENT',
} as const;
export type RoyaltyCalculationMethod = (typeof RoyaltyCalculationMethod)[keyof typeof RoyaltyCalculationMethod];

// Student Status
export const StudentStatus = {
  ACTIVE: 'ACTIVE',
  PASSED_OUT: 'PASSED_OUT',
  DISCONTINUED: 'DISCONTINUED',
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

// Institute Status
export const InstituteStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_SETUP: 'PENDING_SETUP',
} as const;
export type InstituteStatus = (typeof InstituteStatus)[keyof typeof InstituteStatus];

// Attendance Event & Status
export const AttendanceType = {
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
} as const;
export type AttendanceType = (typeof AttendanceType)[keyof typeof AttendanceType];

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

// Fee Types & Statuses
export const FeeFrequency = {
  MONTHLY: 'MONTHLY',
  TERM_WISE: 'TERM_WISE',
  ONE_TIME: 'ONE_TIME',
} as const;
export type FeeFrequency = (typeof FeeFrequency)[keyof typeof FeeFrequency];

export const PaymentStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  ONLINE: 'ONLINE',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// Learning Materials
export const MaterialType = {
  PDF: 'PDF',
  AUDIO: 'AUDIO',
  VOICE_NOTE: 'VOICE_NOTE',
  HOMEWORK: 'HOMEWORK',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
} as const;
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];

// SMS Notification Delivery
export const NotificationStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

// Guardian Relation
export const GuardianRelation = {
  FATHER: 'FATHER',
  MOTHER: 'MOTHER',
  GUARDIAN: 'GUARDIAN',
} as const;
export type GuardianRelation = (typeof GuardianRelation)[keyof typeof GuardianRelation];

// Global Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Student Admission Payload
export interface StudentAdmissionPayload {
  firstName: string;
  lastName: string;
  studentPhone?: string;
  dob?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  bloodGroup?: string;
  notes?: string;
  admissionDate?: string;
  batchId?: string;
  createLoginAccount?: boolean;
  email?: string;
  phone?: string;
  initialPassword?: string;
  parentFullName?: string;
  parentRelationship?: 'FATHER' | 'MOTHER' | 'GUARDIAN';
  parentPhone?: string;
  parentEmail?: string;
  parentInitialPassword?: string;
  parentCanReceiveSms?: boolean;
}

// Common Standard API Response Format
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export const AttendanceMethod = {
  MANUAL: 'MANUAL',
  QR_SCAN: 'QR_SCAN',
  VOICE_CONFIRMED: 'VOICE_CONFIRMED',
} as const;
export type AttendanceMethod = (typeof AttendanceMethod)[keyof typeof AttendanceMethod];

// Export Shared Design Tokens
export * from './theme.js';
export * from './voiceMatching.js';
