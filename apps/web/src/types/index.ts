export type UserRole = 'SUPER_ADMIN' | 'FRANCHISE_OWNER' | 'BRANCH_ADMIN' | 'ACADEMIC_ADMIN' | 'STAFF' | 'PARENT' | 'STUDENT';
export type InstituteStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP';
export type StudentStatus = 'ACTIVE' | 'PASSED_OUT' | 'DISCONTINUED';

export interface Franchise {
  id: string;
  code: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  authorizedContact?: {
    name?: string;
    phone?: string;
    email?: string;
    designation?: string;
  } | null;
  businessDetails?: any;
  notes?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  createdAt: string;
  branches?: Institute[];
  agreements?: FranchiseAgreement[];
  installments?: FranchiseRoyaltyInstallment[];
  _count?: {
    branches: number;
  };
}

export interface FranchiseAgreement {
  id: string;
  franchiseId: string;
  agreementNumber: string;
  title: string;
  startDate: string;
  endDate: string;
  annualRoyaltyAmount?: number | null;
  calculationMethod?: 'FIXED_ANNUAL' | 'PERCENTAGE_REVENUE' | 'PER_STUDENT';
  perStudentFee?: number | null;
  royaltyPercentage: number;
  royaltyBasis: string;
  paymentFrequency: string;
  dueDay: number;
  installmentCount?: number;
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TERMINATED';
  terms?: string | null;
  amendments?: any;
  notes?: string | null;
  createdAt: string;
  installments?: FranchiseRoyaltyInstallment[];
  agreementType?: 'NEW_CENTRE_JOINT_INVESTMENT' | 'EXISTING_CENTRE' | 'BRAND_AND_COURSE_SUPPORT' | 'CUSTOM_AGREEMENT';
  totalInvestment?: number | null;
  digitalGuruInvestmentAmount?: number | null;
  partnerInvestmentAmount?: number | null;
  digitalGuruInvestmentPercentage?: number | null;
  partnerInvestmentPercentage?: number | null;
  operationalSetupContribution?: number | null;
  investmentNotes?: string | null;
  digitalGuruRevenuePercentage?: number | null;
  partnerRevenuePercentage?: number | null;
  revenueCalculationBasis?: 'GROSS_COURSE_FEES' | 'NET_COURSE_REVENUE' | 'PROFIT_AFTER_EXPENSES';
  settlementFrequency?: 'MONTHLY' | 'YEARLY';
  expenseResponsibilities?: Record<string, string> | null;
  marketingResponsibleParty?: string | null;
  marketingSupportDurationMonths?: number | null;
  marketingPostSupportParty?: string | null;
  marketingBudget?: number | null;
  marketingEffectiveStartDate?: string | null;
  marketingNotes?: string | null;
  courseSoftwareAccessEnabled?: boolean | null;
  courseSoftwarePricingNotes?: string | null;
  version?: number;
  parentAgreementId?: string | null;
}

export type InstallmentStatus = 'UPCOMING' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface FranchiseRoyaltyInstallment {
  id: string;
  franchiseId: string;
  agreementId: string;
  installmentNumber: number;
  periodLabel: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  outstandingBalance: number;
  status: InstallmentStatus;
  calculationBasis: string;
  calculationBreakdown?: any;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: FranchiseRoyaltyPayment[];
  agreement?: FranchiseAgreement;
  franchise?: Franchise;
}

export interface FranchiseRoyaltyRecord {
  id: string;
  franchiseId: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  grossCollection: number;
  eligibleRevenue: number;
  royaltyPercentage: number;
  royaltyPayable: number;
  royaltyPaid: number;
  outstandingBalance: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  dueDate: string;
  institute?: { id: string; name: string; code: string };
  payments?: FranchiseRoyaltyPayment[];
}

export interface FranchiseRoyaltyPayment {
  id: string;
  franchiseId: string;
  royaltyRecordId?: string | null;
  installmentId?: string | null;
  receiptNumber: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string | null;
  remarks?: string | null;
}

export interface User {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

export interface Institute {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  status: InstituteStatus;
  franchiseId?: string | null;
  franchise?: {
    id: string;
    code: string;
    name: string;
    city?: string | null;
    ownerName?: string | null;
  } | null;
  createdAt: string;
  _count?: {
    students: number;
    staffProfiles: number;
    batches: number;
    subjects?: number;
  };
}

export interface StaffQualification {
  id: string;
  staffProfileId: string;
  degree: string;
  fieldOfStudy?: string | null;
  institution: string;
  yearOfCompletion?: number | null;
  gradeScore?: string | null;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffExperience {
  id: string;
  staffProfileId: string;
  institution: string;
  designation: string;
  subjects?: string | null;
  totalYears?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffDocument {
  id: string;
  staffProfileId: string;
  instituteId: string;
  documentType: string;
  displayName: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  instituteId: string;
  userId: string;
  employeeCode?: string | null;
  designation: string;
  qualification?: string | null;
  permissionsJson?: Record<string, any> | null;
  createdAt: string;
  updatedAt?: string;
  user: User;

  // Personal Info
  dob?: string | null;
  gender?: string | null;
  altPhone?: string | null;
  personalEmail?: string | null;
  emergencyContactName?: string | null;
  emergencyContactRelation?: string | null;
  emergencyContactPhone?: string | null;
  avatarUrl?: string | null;

  // Address
  currentAddressLine1?: string | null;
  currentAddressLine2?: string | null;
  currentCity?: string | null;
  currentState?: string | null;
  currentPostalCode?: string | null;
  currentCountry?: string | null;

  permanentAddressLine1?: string | null;
  permanentAddressLine2?: string | null;
  permanentCity?: string | null;
  permanentState?: string | null;
  permanentPostalCode?: string | null;
  permanentCountry?: string | null;
  sameAsCurrentAddress?: boolean;

  // Employment Details
  department?: string | null;
  employmentType?: string; // 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'VISITING'
  joiningDate?: string | null;
  probationEndDate?: string | null;
  workLocation?: string | null;
  employmentNotes?: string | null;

  // Relational collections
  qualifications?: StaffQualification[];
  experiences?: StaffExperience[];
  documents?: StaffDocument[];

  assignments?: Array<{
    id: string;
    batch: {
      id: string;
      name: string;
      academicYear: string;
    };
  }>;
  batchSubjects?: Array<{
    id: string;
    batchId: string;
    subjectId: string;
    batch: {
      id: string;
      name: string;
      code?: string | null;
    };
    subject: {
      id: string;
      name: string;
      code?: string | null;
    };
  }>;
}

export interface Student {
  id: string;
  instituteId?: string | null;
  franchiseId?: string | null;
  userId?: string | null;
  admissionNumber: string;
  rollNumber?: string | null;
  firstName: string;
  lastName: string;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  status: StudentStatus;
  admissionDate: string;
  photoUrl?: string | null;
  createdByUserId?: string | null;
  createdByUser?: User | null;
  notes?: string | null;
  phone?: string | null;
  user?: User | null;
  institute?: {
    id: string;
    name: string;
    code: string;
  } | null;
  franchise?: {
    id: string;
    name: string;
    code: string;
  } | null;
  courseEnrollments?: Array<{
    id: string;
    mode: 'ONLINE' | 'OFFLINE';
    status: string;
    progress?: number;
    course: {
      id: string;
      title: string;
      slug: string;
    };
    batch?: {
      id: string;
      name: string;
    } | null;
  }>;
  enrollments?: Array<{
    id: string;
    batchId?: string;
    subjectId?: string | null;
    batch: {
      id: string;
      name: string;
      academicYear: string;
    };
    subject?: {
      id: string;
      name: string;
    };
  }>;
  parentRelations?: Array<{
    id: string;
    relation: string;
    isPrimaryContact: boolean;
    canReceiveSms: boolean;
    parent: {
      id: string;
      user: {
        id: string;
        fullName: string;
        phone: string | null;
        email: string | null;
      };
    };
  }>;
}

export interface Parent {
  id: string;
  userId: string;
  occupation?: string | null;
  address?: string | null;
  altPhone?: string | null;
  isPhoneVerified: boolean;
  createdAt: string;
  user: User;
  studentRelations?: Array<{
    id: string;
    relation: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      admissionNumber: string;
      rollNumber?: string | null;
      status: StudentStatus;
    };
  }>;
}

export interface Batch {
  id: string;
  instituteId: string;
  name: string;
  code?: string | null;
  academicYear: string;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  schedule?: string | null;
  isActive: boolean;
  batchSubjects?: Array<{
    id: string;
    batchId?: string;
    subjectId: string;
    description?: string | null;
    schedule?: string | null;
    isActive?: boolean;
    staffProfileId?: string | null;
    staffProfile?: {
      id: string;
      user: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
      };
    } | null;
    subject: Subject;
  }>;
  staffAssignments?: Array<{
    id: string;
    staffProfileId: string;
    staffProfile: {
      id: string;
      user: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
      };
    };
  }>;
  enrollments?: Array<{
    id: string;
    studentId: string;
    isActive: boolean;
    student: {
      id: string;
      admissionNumber: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      photoUrl?: string | null;
      status: StudentStatus;
    };
    subject?: {
      id: string;
      name: string;
      code?: string | null;
    } | null;
  }>;
  enrolledStudents?: Array<{
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    photoUrl?: string | null;
    status: StudentStatus;
    enrolledAt?: string;
    allocatedSubjects?: Array<{
      id: string;
      name: string;
      code?: string | null;
    }>;
  }>;
  _count?: {
    enrollments: number;
    staffAssignments: number;
    batchSubjects?: number;
  };
}

export interface Subject {
  id: string;
  instituteId: string;
  name: string;
  code?: string | null;
  description?: string | null;
  _count?: {
    batchSubjects?: number;
    enrollments?: number;
  };
}
