// User Roles across the platform
export const UserRole = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    FRANCHISE_OWNER: 'FRANCHISE_OWNER',
    BRANCH_ADMIN: 'BRANCH_ADMIN',
    ACADEMIC_ADMIN: 'ACADEMIC_ADMIN',
    STAFF: 'STAFF',
    PARENT: 'PARENT',
    STUDENT: 'STUDENT',
};
// Franchise Status
export const FranchiseStatus = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    TERMINATED: 'TERMINATED',
};
// Agreement Status
export const AgreementStatus = {
    DRAFT: 'DRAFT',
    PENDING_SIGNATURE: 'PENDING_SIGNATURE',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
    SUSPENDED: 'SUSPENDED',
    TERMINATED: 'TERMINATED',
};
// Agreement Business Models
export const AgreementBusinessModel = {
    NEW_CENTRE_JOINT_INVESTMENT: 'NEW_CENTRE_JOINT_INVESTMENT',
    EXISTING_CENTRE: 'EXISTING_CENTRE',
    BRAND_AND_COURSE_SUPPORT: 'BRAND_AND_COURSE_SUPPORT',
    CUSTOM_AGREEMENT: 'CUSTOM_AGREEMENT',
};
// Revenue Calculation Basis
export const RevenueCalculationBasis = {
    GROSS_COURSE_FEES: 'GROSS_COURSE_FEES',
    NET_COURSE_REVENUE: 'NET_COURSE_REVENUE',
    PROFIT_AFTER_EXPENSES: 'PROFIT_AFTER_EXPENSES',
};
// Settlement Frequency
export const SettlementFrequency = {
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
};
// Expense Payer Role
export const ExpensePayerRole = {
    DIGITAL_GURU: 'DIGITAL_GURU',
    PARTNER: 'PARTNER',
    SHARED: 'SHARED',
    CUSTOM: 'CUSTOM',
};
// Royalty Frequency
export const RoyaltyFrequency = {
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    ANNUAL: 'ANNUAL',
};
// Royalty Calculation Basis
export const RoyaltyBasis = {
    TOTAL_COLLECTIONS: 'TOTAL_COLLECTIONS',
    TUITION_FEES_ONLY: 'TUITION_FEES_ONLY',
    NET_REVENUE: 'NET_REVENUE',
};
// Royalty Payment Status
export const RoyaltyPaymentStatus = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
};
// Installment Status
export const InstallmentStatus = {
    UPCOMING: 'UPCOMING',
    DUE: 'DUE',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
};
// Royalty Calculation Method
export const RoyaltyCalculationMethod = {
    FIXED_ANNUAL: 'FIXED_ANNUAL',
    PERCENTAGE_REVENUE: 'PERCENTAGE_REVENUE',
    PER_STUDENT: 'PER_STUDENT',
};
// Student Status
export const StudentStatus = {
    ACTIVE: 'ACTIVE',
    PASSED_OUT: 'PASSED_OUT',
    DISCONTINUED: 'DISCONTINUED',
};
// Institute Status
export const InstituteStatus = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    PENDING_SETUP: 'PENDING_SETUP',
};
// Attendance Event & Status
export const AttendanceType = {
    CHECK_IN: 'CHECK_IN',
    CHECK_OUT: 'CHECK_OUT',
};
export const AttendanceStatus = {
    PRESENT: 'PRESENT',
    ABSENT: 'ABSENT',
    LATE: 'LATE',
    EXCUSED: 'EXCUSED',
};
// Fee Types & Statuses
export const FeeFrequency = {
    MONTHLY: 'MONTHLY',
    TERM_WISE: 'TERM_WISE',
    ONE_TIME: 'ONE_TIME',
};
export const PaymentStatus = {
    PENDING: 'PENDING',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
};
export const PaymentMethod = {
    CASH: 'CASH',
    UPI: 'UPI',
    BANK_TRANSFER: 'BANK_TRANSFER',
    CHEQUE: 'CHEQUE',
    ONLINE: 'ONLINE',
};
// Learning Materials
export const MaterialType = {
    PDF: 'PDF',
    AUDIO: 'AUDIO',
    VOICE_NOTE: 'VOICE_NOTE',
    HOMEWORK: 'HOMEWORK',
    ANNOUNCEMENT: 'ANNOUNCEMENT',
};
// SMS Notification Delivery
export const NotificationStatus = {
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
};
// Guardian Relation
export const GuardianRelation = {
    FATHER: 'FATHER',
    MOTHER: 'MOTHER',
    GUARDIAN: 'GUARDIAN',
};
export const AttendanceMethod = {
    MANUAL: 'MANUAL',
    QR_SCAN: 'QR_SCAN',
    VOICE_CONFIRMED: 'VOICE_CONFIRMED',
};
// Export Shared Design Tokens
export * from './theme.js';
export * from './voiceMatching.js';
