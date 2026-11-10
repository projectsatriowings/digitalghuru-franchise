export declare const UserRole: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly FRANCHISE_OWNER: "FRANCHISE_OWNER";
    readonly BRANCH_ADMIN: "BRANCH_ADMIN";
    readonly ACADEMIC_ADMIN: "ACADEMIC_ADMIN";
    readonly STAFF: "STAFF";
    readonly PARENT: "PARENT";
    readonly STUDENT: "STUDENT";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const FranchiseStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly SUSPENDED: "SUSPENDED";
    readonly TERMINATED: "TERMINATED";
};
export type FranchiseStatus = (typeof FranchiseStatus)[keyof typeof FranchiseStatus];
export declare const AgreementStatus: {
    readonly DRAFT: "DRAFT";
    readonly PENDING_SIGNATURE: "PENDING_SIGNATURE";
    readonly ACTIVE: "ACTIVE";
    readonly EXPIRED: "EXPIRED";
    readonly SUSPENDED: "SUSPENDED";
    readonly TERMINATED: "TERMINATED";
};
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];
export declare const AgreementBusinessModel: {
    readonly NEW_CENTRE_JOINT_INVESTMENT: "NEW_CENTRE_JOINT_INVESTMENT";
    readonly EXISTING_CENTRE: "EXISTING_CENTRE";
    readonly BRAND_AND_COURSE_SUPPORT: "BRAND_AND_COURSE_SUPPORT";
    readonly CUSTOM_AGREEMENT: "CUSTOM_AGREEMENT";
};
export type AgreementBusinessModel = (typeof AgreementBusinessModel)[keyof typeof AgreementBusinessModel];
export declare const RevenueCalculationBasis: {
    readonly GROSS_COURSE_FEES: "GROSS_COURSE_FEES";
    readonly NET_COURSE_REVENUE: "NET_COURSE_REVENUE";
    readonly PROFIT_AFTER_EXPENSES: "PROFIT_AFTER_EXPENSES";
};
export type RevenueCalculationBasis = (typeof RevenueCalculationBasis)[keyof typeof RevenueCalculationBasis];
export declare const SettlementFrequency: {
    readonly MONTHLY: "MONTHLY";
    readonly YEARLY: "YEARLY";
};
export type SettlementFrequency = (typeof SettlementFrequency)[keyof typeof SettlementFrequency];
export declare const ExpensePayerRole: {
    readonly DIGITAL_GURU: "DIGITAL_GURU";
    readonly PARTNER: "PARTNER";
    readonly SHARED: "SHARED";
    readonly CUSTOM: "CUSTOM";
};
export type ExpensePayerRole = (typeof ExpensePayerRole)[keyof typeof ExpensePayerRole];
export declare const RoyaltyFrequency: {
    readonly MONTHLY: "MONTHLY";
    readonly QUARTERLY: "QUARTERLY";
    readonly ANNUAL: "ANNUAL";
};
export type RoyaltyFrequency = (typeof RoyaltyFrequency)[keyof typeof RoyaltyFrequency];
export declare const RoyaltyBasis: {
    readonly TOTAL_COLLECTIONS: "TOTAL_COLLECTIONS";
    readonly TUITION_FEES_ONLY: "TUITION_FEES_ONLY";
    readonly NET_REVENUE: "NET_REVENUE";
};
export type RoyaltyBasis = (typeof RoyaltyBasis)[keyof typeof RoyaltyBasis];
export declare const RoyaltyPaymentStatus: {
    readonly PENDING: "PENDING";
    readonly PARTIALLY_PAID: "PARTIALLY_PAID";
    readonly PAID: "PAID";
    readonly OVERDUE: "OVERDUE";
};
export type RoyaltyPaymentStatus = (typeof RoyaltyPaymentStatus)[keyof typeof RoyaltyPaymentStatus];
export declare const InstallmentStatus: {
    readonly UPCOMING: "UPCOMING";
    readonly DUE: "DUE";
    readonly PARTIALLY_PAID: "PARTIALLY_PAID";
    readonly PAID: "PAID";
    readonly OVERDUE: "OVERDUE";
};
export type InstallmentStatus = (typeof InstallmentStatus)[keyof typeof InstallmentStatus];
export declare const RoyaltyCalculationMethod: {
    readonly FIXED_ANNUAL: "FIXED_ANNUAL";
    readonly PERCENTAGE_REVENUE: "PERCENTAGE_REVENUE";
    readonly PER_STUDENT: "PER_STUDENT";
};
export type RoyaltyCalculationMethod = (typeof RoyaltyCalculationMethod)[keyof typeof RoyaltyCalculationMethod];
export declare const StudentStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly PASSED_OUT: "PASSED_OUT";
    readonly DISCONTINUED: "DISCONTINUED";
};
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];
export declare const InstituteStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly SUSPENDED: "SUSPENDED";
    readonly PENDING_SETUP: "PENDING_SETUP";
};
export type InstituteStatus = (typeof InstituteStatus)[keyof typeof InstituteStatus];
export declare const AttendanceType: {
    readonly CHECK_IN: "CHECK_IN";
    readonly CHECK_OUT: "CHECK_OUT";
};
export type AttendanceType = (typeof AttendanceType)[keyof typeof AttendanceType];
export declare const AttendanceStatus: {
    readonly PRESENT: "PRESENT";
    readonly ABSENT: "ABSENT";
    readonly LATE: "LATE";
    readonly EXCUSED: "EXCUSED";
};
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
export declare const FeeFrequency: {
    readonly MONTHLY: "MONTHLY";
    readonly TERM_WISE: "TERM_WISE";
    readonly ONE_TIME: "ONE_TIME";
};
export type FeeFrequency = (typeof FeeFrequency)[keyof typeof FeeFrequency];
export declare const PaymentStatus: {
    readonly PENDING: "PENDING";
    readonly PARTIALLY_PAID: "PARTIALLY_PAID";
    readonly PAID: "PAID";
    readonly OVERDUE: "OVERDUE";
};
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export declare const PaymentMethod: {
    readonly CASH: "CASH";
    readonly UPI: "UPI";
    readonly BANK_TRANSFER: "BANK_TRANSFER";
    readonly CHEQUE: "CHEQUE";
    readonly ONLINE: "ONLINE";
};
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export declare const MaterialType: {
    readonly PDF: "PDF";
    readonly AUDIO: "AUDIO";
    readonly VOICE_NOTE: "VOICE_NOTE";
    readonly HOMEWORK: "HOMEWORK";
    readonly ANNOUNCEMENT: "ANNOUNCEMENT";
};
export type MaterialType = (typeof MaterialType)[keyof typeof MaterialType];
export declare const NotificationStatus: {
    readonly QUEUED: "QUEUED";
    readonly SENT: "SENT";
    readonly DELIVERED: "DELIVERED";
    readonly FAILED: "FAILED";
};
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
export declare const GuardianRelation: {
    readonly FATHER: "FATHER";
    readonly MOTHER: "MOTHER";
    readonly GUARDIAN: "GUARDIAN";
};
export type GuardianRelation = (typeof GuardianRelation)[keyof typeof GuardianRelation];
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}
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
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
    timestamp: string;
}
export declare const AttendanceMethod: {
    readonly MANUAL: "MANUAL";
    readonly QR_SCAN: "QR_SCAN";
    readonly VOICE_CONFIRMED: "VOICE_CONFIRMED";
};
export type AttendanceMethod = (typeof AttendanceMethod)[keyof typeof AttendanceMethod];
export * from './theme.js';
export * from './voiceMatching.js';
//# sourceMappingURL=index.d.ts.map