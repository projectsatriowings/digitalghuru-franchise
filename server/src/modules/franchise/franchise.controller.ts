import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { hashPassword } from '../../utils/security.js';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

// ============================================================================
// HELPER: TENANT ISOLATION CHECK
// ============================================================================
export async function verifyFranchiseAccess(
  userId: string,
  userRole: string,
  franchiseId: string
): Promise<{ authorized: boolean; franchise?: any }> {
  const franchise = await prisma.franchise.findUnique({
    where: { id: franchiseId },
    include: {
      branches: true,
      agreements: { orderBy: { createdAt: 'desc' } },
      ownerUser: { select: { id: true, email: true, fullName: true, phone: true } },
    },
  });

  if (!franchise) {
    return { authorized: false };
  }

  // Super Admin has universal access
  if (userRole === 'SUPER_ADMIN') {
    return { authorized: true, franchise };
  }

  // Franchise Owner must own this specific franchise
  if (userRole === 'FRANCHISE_OWNER' && franchise.ownerUserId === userId) {
    return { authorized: true, franchise };
  }

  return { authorized: false, franchise };
}

// Generate unique sequential Franchise Code: DG-FR-1001, etc.
async function generateFranchiseCode(): Promise<string> {
  const count = await prisma.franchise.count();
  const nextNum = 1001 + count;
  let code = `DG-FR-${nextNum}`;
  let exists = await prisma.franchise.findUnique({ where: { code } });
  let offset = 1;
  while (exists) {
    code = `DG-FR-${nextNum + offset}`;
    exists = await prisma.franchise.findUnique({ where: { code } });
    offset++;
  }
  return code;
}

// Generate unique sequential Receipt Number: ROY-REC-2026-0001
async function generateRoyaltyReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.franchiseRoyaltyPayment.count();
  const nextSerial = String(count + 1).padStart(4, '0');
  let receipt = `ROY-REC-${year}-${nextSerial}`;
  let exists = await prisma.franchiseRoyaltyPayment.findUnique({ where: { receiptNumber: receipt } });
  let offset = 1;
  while (exists) {
    receipt = `ROY-REC-${year}-${String(count + 1 + offset).padStart(4, '0')}`;
    exists = await prisma.franchiseRoyaltyPayment.findUnique({ where: { receiptNumber: receipt } });
    offset++;
  }
  return receipt;
}

// Generate unique sequential Agreement Number: AGR-2026-001
async function generateUniqueAgreementNumber(year: number): Promise<string> {
  const count = await prisma.franchiseAgreement.count();
  let candidate = `AGR-${year}-${String(count + 1).padStart(3, '0')}`;
  let exists = await prisma.franchiseAgreement.findUnique({ where: { agreementNumber: candidate } });
  let offset = 1;
  while (exists) {
    candidate = `AGR-${year}-${String(count + 1 + offset).padStart(3, '0')}`;
    exists = await prisma.franchiseAgreement.findUnique({ where: { agreementNumber: candidate } });
    offset++;
  }
  return candidate;
}

// Evaluate live installment status based on clear rules
export function computeInstallmentLiveStatus(inst: {
  amount: number | Prisma.Decimal;
  paidAmount: number | Prisma.Decimal;
  dueDate: Date | string;
  status?: string;
}): 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'DUE' | 'UPCOMING' {
  const amt = Number(inst.amount);
  const paid = Number(inst.paidAmount || 0);
  const due = new Date(inst.dueDate);
  const now = new Date();

  if (paid >= amt && amt > 0) {
    return 'PAID';
  }
  if (paid > 0 && paid < amt) {
    return now > due ? 'OVERDUE' : 'PARTIALLY_PAID';
  }
  if (now > due) {
    return 'OVERDUE';
  }
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (due <= thirtyDaysFromNow) {
    return 'DUE';
  }
  return 'UPCOMING';
}

// Safely compute due dates for installments, respecting leap years, month-ends, and mid-year starts
export function computeSafeDueDates(
  startDate: Date,
  endDate: Date,
  midPoint: Date,
  dueDay: number = 10,
  explicitDue1?: Date | string | null,
  explicitDue2?: Date | string | null
): { due1: Date; due2: Date } {
  let due1: Date;
  let due2: Date;

  if (explicitDue1) {
    due1 = new Date(explicitDue1);
  } else {
    // Aligned to month-start + 30 days or safe calendar month
    const targetMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    const maxDays = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    due1 = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(dueDay, maxDays));
    if (due1 <= startDate) {
      due1 = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (explicitDue2) {
    due2 = new Date(explicitDue2);
  } else {
    const midMonth = new Date(midPoint.getFullYear(), midPoint.getMonth(), 1);
    const maxDays = new Date(midMonth.getFullYear(), midMonth.getMonth() + 1, 0).getDate();
    due2 = new Date(midMonth.getFullYear(), midMonth.getMonth(), Math.min(dueDay, maxDays));
    if (due2 <= due1) {
      due2 = new Date(midPoint.getTime() + 10 * 24 * 60 * 60 * 1000);
    }
  }

  // Fallbacks ensuring valid dates within range
  if (isNaN(due1.getTime()) || due1 < startDate) {
    due1 = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  if (isNaN(due2.getTime()) || due2 <= due1 || due2 > endDate) {
    due2 = new Date(Math.min(endDate.getTime(), Math.max(due1.getTime() + 24 * 60 * 60 * 1000, midPoint.getTime() + 10 * 24 * 60 * 60 * 1000)));
  }

  return { due1, due2 };
}

// Generate exactly two installments for an annual agreement
export async function generateAnnualInstallments(params: {
  franchiseId: string;
  agreementId: string;
  startDate: Date;
  endDate: Date;
  calculationMethod: string;
  annualRoyaltyAmount?: number | null;
  royaltyPercentage?: number | null;
  royaltyBasis?: string;
  perStudentFee?: number | null;
  dueDay?: number;
  installment1DueDate?: Date | string | null;
  installment2DueDate?: Date | string | null;
  prismaClient?: any;
}) {
  const db = params.prismaClient || prisma;
  const {
    franchiseId,
    agreementId,
    startDate,
    endDate,
    calculationMethod,
    annualRoyaltyAmount,
    royaltyPercentage,
    royaltyBasis,
    perStudentFee,
    dueDay,
    installment1DueDate,
    installment2DueDate,
  } = params;

  const durationMs = endDate.getTime() - startDate.getTime();
  const midPoint = new Date(startDate.getTime() + durationMs / 2);

  let inst1Amount = 0;
  let inst2Amount = 0;
  let breakdown1: any = {};
  let breakdown2: any = {};

  if (calculationMethod === 'FIXED_ANNUAL') {
    const annual = Number(annualRoyaltyAmount || 0);
    inst1Amount = Math.round((annual / 2) * 100) / 100;
    inst2Amount = Math.round((annual - inst1Amount) * 100) / 100;
    breakdown1 = {
      basis: 'FIXED_ANNUAL',
      annualAgreedRoyalty: annual,
      installmentNumber: 1,
      fraction: '50%',
      formula: `Annual Royalty (₹${annual.toLocaleString('en-IN')}) ÷ 2 installments = ₹${inst1Amount.toLocaleString('en-IN')}`,
    };
    breakdown2 = {
      basis: 'FIXED_ANNUAL',
      annualAgreedRoyalty: annual,
      installmentNumber: 2,
      fraction: '50%',
      formula: `Annual Royalty (₹${annual.toLocaleString('en-IN')}) ÷ 2 installments = ₹${inst2Amount.toLocaleString('en-IN')}`,
    };
  } else if (calculationMethod === 'PER_STUDENT') {
    const feePerStudent = Number(perStudentFee || 0);
    const franchiseBranches = await db.institute.findMany({
      where: { franchiseId },
      select: { id: true },
    });
    const branchIds = franchiseBranches.map((b: any) => b.id);
    const activeStudentCount = await db.student.count({
      where: { instituteId: { in: branchIds }, status: 'ACTIVE' },
    });
    const annual = activeStudentCount * feePerStudent;
    inst1Amount = Math.round((annual / 2) * 100) / 100;
    inst2Amount = Math.round((annual - inst1Amount) * 100) / 100;
    breakdown1 = {
      basis: 'PER_STUDENT',
      activeStudentCount,
      ratePerStudent: feePerStudent,
      annualTotal: annual,
      installmentNumber: 1,
      fraction: '50%',
      formula: `${activeStudentCount} active enrolled students × ₹${feePerStudent.toLocaleString('en-IN')} ÷ 2 installments = ₹${inst1Amount.toLocaleString('en-IN')}`,
    };
    breakdown2 = {
      basis: 'PER_STUDENT',
      activeStudentCount,
      ratePerStudent: feePerStudent,
      annualTotal: annual,
      installmentNumber: 2,
      fraction: '50%',
      formula: `${activeStudentCount} active enrolled students × ₹${feePerStudent.toLocaleString('en-IN')} ÷ 2 installments = ₹${inst2Amount.toLocaleString('en-IN')}`,
    };
  } else {
    // PERCENTAGE_REVENUE
    const pct = Number(royaltyPercentage || 0);
    const basisLabel = royaltyBasis || 'TOTAL_COLLECTIONS';
    const annualBase = Number(annualRoyaltyAmount || 0);
    inst1Amount = Math.round((annualBase / 2) * 100) / 100;
    inst2Amount = Math.round((annualBase - inst1Amount) * 100) / 100;
    breakdown1 = {
      basis: 'PERCENTAGE_REVENUE',
      royaltyPercentage: pct,
      royaltyBasis: basisLabel,
      annualBaseAmount: annualBase,
      installmentNumber: 1,
      fraction: '50% of annual royalty / H1 collections',
      formula: `${pct}% share of ${basisLabel} (Base estimate: ₹${inst1Amount.toLocaleString('en-IN')})`,
    };
    breakdown2 = {
      basis: 'PERCENTAGE_REVENUE',
      royaltyPercentage: pct,
      royaltyBasis: basisLabel,
      annualBaseAmount: annualBase,
      installmentNumber: 2,
      fraction: '50% of annual royalty / H2 collections',
      formula: `${pct}% share of ${basisLabel} (Base estimate: ₹${inst2Amount.toLocaleString('en-IN')})`,
    };
  }

  const { due1, due2 } = computeSafeDueDates(
    startDate,
    endDate,
    midPoint,
    dueDay || 10,
    installment1DueDate,
    installment2DueDate
  );

  const status1 = computeInstallmentLiveStatus({ amount: inst1Amount, paidAmount: 0, dueDate: due1 });
  const status2 = computeInstallmentLiveStatus({ amount: inst2Amount, paidAmount: 0, dueDate: due2 });

  const inst1 = await db.franchiseRoyaltyInstallment.create({
    data: {
      franchiseId,
      agreementId,
      installmentNumber: 1,
      periodLabel: `Installment 1 of 2 (H1: ${startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${midPoint.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
      startDate,
      endDate: midPoint,
      dueDate: due1,
      amount: new Prisma.Decimal(inst1Amount),
      paidAmount: new Prisma.Decimal(0.0),
      outstandingBalance: new Prisma.Decimal(inst1Amount),
      status: status1 as any,
      calculationBasis: calculationMethod,
      calculationBreakdown: breakdown1,
    },
  });

  const inst2 = await db.franchiseRoyaltyInstallment.create({
    data: {
      franchiseId,
      agreementId,
      installmentNumber: 2,
      periodLabel: `Installment 2 of 2 (H2: ${midPoint.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
      startDate: midPoint,
      endDate,
      dueDate: due2,
      amount: new Prisma.Decimal(inst2Amount),
      paidAmount: new Prisma.Decimal(0.0),
      outstandingBalance: new Prisma.Decimal(inst2Amount),
      status: status2 as any,
      calculationBasis: calculationMethod,
      calculationBreakdown: breakdown2,
    },
  });

  return [inst1, inst2];
}

// ============================================================================
// 1. FRANCHISE CREATION & ACCOUNT SETUP
// ============================================================================

const createFranchiseSchema = z.object({
  name: z.string().min(2, 'Franchise/business name is required'),
  ownerName: z.string().min(2, "Owner's full name is required"),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(7, 'Primary mobile number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  address: z.string().optional().default('Main Campus Address'),
  city: z.string().optional().default('Chennai'),
  state: z.string().optional().default('Tamil Nadu'),
  postalCode: z.string().optional().default('600001'),
  country: z.string().default('India'),
  authorizedContact: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    designation: z.string().optional(),
  }).optional(),
  code: z.string().optional(),
  businessDetails: z.record(z.any()).optional(),
  notes: z.string().optional(),
  initialAgreement: z.object({
    title: z.string().default('Annual Master Franchise Agreement'),
    startDate: z.string(),
    endDate: z.string(),
    agreementType: z.string().optional(),
    calculationMethod: z.enum(['FIXED_ANNUAL', 'PERCENTAGE_REVENUE', 'PER_STUDENT']).default('FIXED_ANNUAL'),
    annualRoyaltyAmount: z.number().min(0).optional(),
    royaltyPercentage: z.number().min(0).max(100).default(50.0),
    digitalGuruRevenuePercentage: z.number().min(0).max(100).optional(),
    partnerRevenuePercentage: z.number().min(0).max(100).optional(),
    revenueCalculationBasis: z.string().optional(),
    settlementFrequency: z.string().optional(),
    totalInvestment: z.number().min(0).optional(),
    digitalGuruInvestmentAmount: z.number().min(0).optional(),
    partnerInvestmentAmount: z.number().min(0).optional(),
    digitalGuruInvestmentPercentage: z.number().min(0).max(100).optional(),
    partnerInvestmentPercentage: z.number().min(0).max(100).optional(),
    operationalSetupContribution: z.number().min(0).optional(),
    investmentNotes: z.string().optional(),
    expenseResponsibilities: z.record(z.any()).optional(),
    marketingResponsibleParty: z.string().optional(),
    marketingSupportDurationMonths: z.number().int().min(0).optional(),
    marketingPostSupportParty: z.string().optional(),
    marketingBudget: z.number().min(0).optional(),
    marketingEffectiveStartDate: z.string().optional(),
    marketingNotes: z.string().optional(),
    courseSoftwareAccessEnabled: z.boolean().optional(),
    courseSoftwarePricingNotes: z.string().optional(),
    royaltyBasis: z.enum(['TOTAL_COLLECTIONS', 'TUITION_FEES_ONLY', 'NET_REVENUE']).default('TOTAL_COLLECTIONS'),
    paymentFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).default('ANNUAL').optional(),
    perStudentFee: z.number().min(0).optional(),
    dueDay: z.number().int().min(1).max(31).default(10),
    installment1DueDate: z.string().optional(),
    installment2DueDate: z.string().optional(),
    terms: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

export async function createFranchise(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can create franchise accounts' });
    }

    const parse = createFranchiseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid input data',
        details: parse.error.errors,
      });
    }

    const data = parse.data;

    // Check if franchise email already exists
    const existingFranchise = await prisma.franchise.findUnique({ where: { email: data.email } });
    if (existingFranchise) {
      return res.status(400).json({ success: false, error: 'A franchise with this email address already exists' });
    }

    const code = data.code || await generateFranchiseCode();

    // 1. Franchise Owner User Account & Password Handling
    let ownerUser = await prisma.user.findFirst({ where: { email: data.email } });
    const initialPassword = data.password || `DG#Owner_${crypto.randomBytes(3).toString('hex')}!`;
    const passwordHash = await hashPassword(initialPassword);

    if (!ownerUser) {
      ownerUser = await prisma.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          fullName: data.ownerName,
          passwordHash,
          role: 'FRANCHISE_OWNER',
          isActive: true,
          mustChangePassword: !data.password,
        },
      });
    } else {
      // Update role & activate if existing
      await prisma.user.update({
        where: { id: ownerUser.id },
        data: { role: 'FRANCHISE_OWNER', isActive: true, passwordHash },
      });
    }

    // 2. Create Franchise Record with complete address and contact details
    const franchise = await prisma.franchise.create({
      data: {
        code,
        name: data.name,
        ownerName: data.ownerName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'India',
        authorizedContact: data.authorizedContact || {},
        businessDetails: data.businessDetails || {},
        status: 'ACTIVE',
        ownerUserId: ownerUser.id,
        notes: data.notes,
      },
      include: {
        ownerUser: { select: { id: true, email: true, fullName: true, phone: true } },
      },
    });

    // 3. Create Annual Franchise Agreement (or default if omitted)
    const agreementStartDate = data.initialAgreement?.startDate
      ? new Date(data.initialAgreement.startDate)
      : new Date();
    const agreementEndDate = data.initialAgreement?.endDate
      ? new Date(data.initialAgreement.endDate)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const year = agreementStartDate.getFullYear();
    const agreementNumber = await generateUniqueAgreementNumber(year);

    const calculationMethod = data.initialAgreement?.calculationMethod || 'FIXED_ANNUAL';
    const annualRoyaltyAmount = data.initialAgreement?.annualRoyaltyAmount !== undefined
      ? new Prisma.Decimal(data.initialAgreement.annualRoyaltyAmount)
      : new Prisma.Decimal(200000);
    const royaltyPercentage = new Prisma.Decimal(data.initialAgreement?.royaltyPercentage ?? 50.0);
    const royaltyBasis = (data.initialAgreement?.royaltyBasis as any) || 'TOTAL_COLLECTIONS';
    const perStudentFee = data.initialAgreement?.perStudentFee !== undefined
      ? new Prisma.Decimal(data.initialAgreement.perStudentFee)
      : null;
    const dueDay = data.initialAgreement?.dueDay || 10;

    const dgPct = data.initialAgreement?.digitalGuruRevenuePercentage !== undefined
      ? Number(data.initialAgreement.digitalGuruRevenuePercentage)
      : Number(data.initialAgreement?.royaltyPercentage ?? 50.0);
    const partnerPct = data.initialAgreement?.partnerRevenuePercentage !== undefined
      ? Number(data.initialAgreement.partnerRevenuePercentage)
      : (100 - dgPct);

    if (calculationMethod === 'PERCENTAGE_REVENUE') {
      if (Math.round((dgPct + partnerPct) * 100) / 100 !== 100) {
        return res.status(400).json({
          success: false,
          error: `Revenue sharing percentages must total 100% (currently Digital Guru: ${dgPct}%, Partner: ${partnerPct}%)`,
        });
      }
    }

    const isMonthly = data.initialAgreement?.settlementFrequency === 'MONTHLY';
    const installmentCount = isMonthly ? 0 : 2;

    const agreement = await prisma.franchiseAgreement.create({
      data: {
        franchiseId: franchise.id,
        agreementNumber,
        title: data.initialAgreement?.title || 'Annual Master Franchise Agreement',
        startDate: agreementStartDate,
        endDate: agreementEndDate,
        agreementType: (data.initialAgreement?.agreementType as any) || 'CUSTOM_AGREEMENT',
        annualRoyaltyAmount,
        calculationMethod,
        perStudentFee,
        royaltyPercentage,
        digitalGuruRevenuePercentage: new Prisma.Decimal(dgPct),
        partnerRevenuePercentage: new Prisma.Decimal(partnerPct),
        revenueCalculationBasis: (data.initialAgreement?.revenueCalculationBasis as any) || 'GROSS_COURSE_FEES',
        settlementFrequency: (data.initialAgreement?.settlementFrequency as any) || (isMonthly ? 'MONTHLY' : 'YEARLY'),
        totalInvestment: data.initialAgreement?.totalInvestment !== undefined ? new Prisma.Decimal(data.initialAgreement.totalInvestment) : null,
        digitalGuruInvestmentAmount: data.initialAgreement?.digitalGuruInvestmentAmount !== undefined ? new Prisma.Decimal(data.initialAgreement.digitalGuruInvestmentAmount) : null,
        partnerInvestmentAmount: data.initialAgreement?.partnerInvestmentAmount !== undefined ? new Prisma.Decimal(data.initialAgreement.partnerInvestmentAmount) : null,
        digitalGuruInvestmentPercentage: data.initialAgreement?.digitalGuruInvestmentPercentage !== undefined ? new Prisma.Decimal(data.initialAgreement.digitalGuruInvestmentPercentage) : null,
        partnerInvestmentPercentage: data.initialAgreement?.partnerInvestmentPercentage !== undefined ? new Prisma.Decimal(data.initialAgreement.partnerInvestmentPercentage) : null,
        operationalSetupContribution: data.initialAgreement?.operationalSetupContribution !== undefined ? new Prisma.Decimal(data.initialAgreement.operationalSetupContribution) : null,
        investmentNotes: data.initialAgreement?.investmentNotes || null,
        expenseResponsibilities: (data.initialAgreement?.expenseResponsibilities as any) ?? Prisma.DbNull,
        marketingResponsibleParty: (data.initialAgreement?.marketingResponsibleParty as any) || 'DIGITAL_GURU',
        marketingSupportDurationMonths: data.initialAgreement?.marketingSupportDurationMonths !== undefined ? Number(data.initialAgreement.marketingSupportDurationMonths) : 3,
        marketingPostSupportParty: (data.initialAgreement?.marketingPostSupportParty as any) || 'PARTNER',
        marketingBudget: data.initialAgreement?.marketingBudget !== undefined ? new Prisma.Decimal(data.initialAgreement.marketingBudget) : null,
        marketingEffectiveStartDate: data.initialAgreement?.marketingEffectiveStartDate ? new Date(data.initialAgreement.marketingEffectiveStartDate) : null,
        marketingNotes: data.initialAgreement?.marketingNotes || null,
        courseSoftwareAccessEnabled: data.initialAgreement?.courseSoftwareAccessEnabled !== undefined ? Boolean(data.initialAgreement.courseSoftwareAccessEnabled) : true,
        courseSoftwarePricingNotes: data.initialAgreement?.courseSoftwarePricingNotes || null,
        version: 1,
        royaltyBasis,
        paymentFrequency: isMonthly ? 'MONTHLY' : 'ANNUAL',
        dueDay,
        installmentCount,
        status: 'ACTIVE',
        terms: data.initialAgreement?.terms,
        notes: data.initialAgreement?.notes,
        createdById: req.user?.userId,
      },
    });

    // 4. Generate installments ONLY for YEARLY settlement frequency
    let installments: any[] = [];
    if (!isMonthly) {
      installments = await generateAnnualInstallments({
        franchiseId: franchise.id,
        agreementId: agreement.id,
        startDate: agreementStartDate,
        endDate: agreementEndDate,
        calculationMethod,
        annualRoyaltyAmount: Number(annualRoyaltyAmount),
        royaltyPercentage: Number(royaltyPercentage),
        royaltyBasis,
        perStudentFee: perStudentFee ? Number(perStudentFee) : null,
        dueDay,
        installment1DueDate: data.initialAgreement?.installment1DueDate,
        installment2DueDate: data.initialAgreement?.installment2DueDate,
      });
    }

    return res.status(201).json({
      success: true,
      message: isMonthly
        ? 'Franchise, Owner Account, and Agreement created successfully with monthly settlement'
        : 'Franchise, Owner Account, and 2 Annual Installments created successfully',
      data: {
        franchise,
        agreement,
        initialAgreement: agreement,
        installments,
        ownerCredentials: {
          email: data.email,
          temporaryPassword: initialPassword,
          role: 'FRANCHISE_OWNER',
        },
      },
    });
  } catch (err: any) {
    console.error('[Create Franchise Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create franchise' });
  }
}

export async function listFranchises(req: AuthenticatedRequest, res: Response) {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    let where: any = {};
    if (userRole === 'FRANCHISE_OWNER') {
      where = { ownerUserId: userId };
    }

    const { status, search } = req.query;
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const franchises = await prisma.franchise.findMany({
      where,
      include: {
        branches: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            status: true,
            _count: { select: { students: true } },
          },
        },
        agreements: {
          where: { status: 'ACTIVE' },
          take: 1,
          orderBy: { endDate: 'desc' },
          include: {
            installments: {
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        installments: {
          orderBy: { dueDate: 'asc' },
        },
        _count: {
          select: { branches: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: {
        franchises,
        total: franchises.length,
      },
    });
  } catch (err: any) {
    console.error('[List Franchises Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve franchises' });
  }
}

export async function getFranchiseById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { authorized, franchise } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, id);

    if (!authorized || !franchise) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to access this franchise',
      });
    }

    // Compute aggregate metrics for this franchise
    const branchIds = franchise.branches.map((b: any) => b.id);
    const totalStudents = await prisma.student.count({
      where: { instituteId: { in: branchIds }, status: 'ACTIVE' },
    });

    const paymentAgg = await prisma.payment.aggregate({
      where: { instituteId: { in: branchIds }, status: 'SUCCESS' },
      _sum: { amountPaid: true },
    });
    const totalRevenue = Number(paymentAgg._sum.amountPaid || 0);

    const installments = await prisma.franchiseRoyaltyInstallment.findMany({
      where: { franchiseId: id },
      include: {
        agreement: { select: { id: true, agreementNumber: true, title: true } },
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const totalInstallmentAmount = installments.reduce((sum, inst) => sum + Number(inst.amount), 0);
    const totalInstallmentPaid = installments.reduce((sum, inst) => sum + Number(inst.paidAmount), 0);
    const totalOutstanding = installments.reduce((sum, inst) => sum + Number(inst.outstandingBalance), 0);
    const totalOverdue = installments
      .filter((inst) => computeInstallmentLiveStatus(inst) === 'OVERDUE')
      .reduce((sum, inst) => sum + Number(inst.outstandingBalance), 0);

    return res.json({
      success: true,
      data: {
        franchise,
        installments: installments.map((inst) => ({
          ...inst,
          liveStatus: computeInstallmentLiveStatus(inst),
        })),
        metrics: {
          totalBranches: franchise.branches.length,
          totalStudents,
          totalRevenue,
          totalRoyaltyObligations: totalInstallmentAmount,
          totalRoyaltyPaid: totalInstallmentPaid,
          outstandingRoyalty: totalOutstanding,
          overdueRoyalty: totalOverdue,
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Franchise Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve franchise details' });
  }
}

export async function updateFranchise(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, id);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const {
      name,
      ownerName,
      phone,
      address,
      city,
      state,
      postalCode,
      country,
      authorizedContact,
      businessDetails,
      notes,
    } = req.body;

    const updated = await prisma.franchise.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(ownerName && { ownerName }),
        ...(phone && { phone }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(postalCode !== undefined && { postalCode }),
        ...(country !== undefined && { country }),
        ...(authorizedContact !== undefined && { authorizedContact }),
        ...(businessDetails !== undefined && { businessDetails }),
        ...(notes !== undefined && { notes }),
      },
    });

    return res.json({
      success: true,
      message: 'Franchise details updated successfully',
      data: { franchise: updated },
    });
  } catch (err: any) {
    console.error('[Update Franchise Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update franchise' });
  }
}

export async function updateFranchiseStatus(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can update franchise status' });
    }

    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid franchise status' });
    }

    const franchise = await prisma.franchise.update({
      where: { id },
      data: {
        status,
        ...(reason && { notes: `[Status changed to ${status} on ${new Date().toISOString()}]: ${reason}` }),
      },
      include: { ownerUser: true },
    });

    // Update user active status
    if (franchise.ownerUserId) {
      await prisma.user.update({
        where: { id: franchise.ownerUserId },
        data: { isActive: status === 'ACTIVE' },
      });
    }

    return res.json({
      success: true,
      message: `Franchise status successfully updated to ${status}`,
      data: { franchise },
    });
  } catch (err: any) {
    console.error('[Franchise Status Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update franchise status' });
  }
}

// Super Admin resets Franchise Owner password securely
export async function resetFranchiseOwnerPassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can reset franchise owner passwords' });
    }

    const { id } = req.params;
    const franchise = await prisma.franchise.findUnique({
      where: { id },
      include: { ownerUser: true },
    });

    if (!franchise || !franchise.ownerUser) {
      return res.status(404).json({ success: false, error: 'Franchise or owner user not found' });
    }

    const temporaryPassword = `DG#Reset_${crypto.randomBytes(3).toString('hex')}!`;
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: franchise.ownerUser.id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return res.json({
      success: true,
      message: 'Owner password reset successfully',
      data: {
        email: franchise.ownerUser.email,
        temporaryPassword,
        mustChangePassword: true,
      },
    });
  } catch (err: any) {
    console.error('[Reset Password Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to reset owner password' });
  }
}

// ============================================================================
// 2. BRANCH MANAGEMENT (STRICTLY SUPER_ADMIN)
// ============================================================================

export async function addBranchToFranchise(req: AuthenticatedRequest, res: Response) {
  try {
    // Strictly disallow Franchise Owner
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Franchisee Admins cannot create or add branches. Only Super Admin has this privilege.',
      });
    }

    const { id: franchiseId } = req.params;
    const { instituteId, instituteIds, name, code, city, state, address, phone, email, createNew } = req.body;

    // Verify franchise exists
    const targetFranchise = await prisma.franchise.findUnique({
      where: { id: franchiseId },
      select: { id: true, name: true, code: true },
    });
    if (!targetFranchise) {
      return res.status(404).json({ success: false, error: 'Franchise not found' });
    }

    // Case 1: Bulk assign multiple existing branches
    if (Array.isArray(instituteIds) && instituteIds.length > 0) {
      await prisma.institute.updateMany({
        where: { id: { in: instituteIds } },
        data: { franchiseId },
      });
      const updatedBranches = await prisma.institute.findMany({
        where: { id: { in: instituteIds } },
      });
      return res.status(200).json({
        success: true,
        message: `${updatedBranches.length} branch(es) successfully assigned to ${targetFranchise.name}`,
        data: { branches: updatedBranches },
      });
    }

    // Case 2: Create brand new branch and attach
    let branch;
    if (createNew || (!instituteId && name)) {
      let branchCode = code;
      if (!branchCode) {
        const count = await prisma.institute.count();
        branchCode = `BR-${String(count + 1).padStart(3, '0')}`;
        let exists = await prisma.institute.findUnique({ where: { code: branchCode } });
        let offset = 1;
        while (exists) {
          branchCode = `BR-${String(count + 1 + offset).padStart(3, '0')}`;
          exists = await prisma.institute.findUnique({ where: { code: branchCode } });
          offset++;
        }
      }

      branch = await prisma.institute.create({
        data: {
          name,
          code: branchCode,
          city,
          state,
          address,
          phone,
          email,
          franchiseId,
          status: 'ACTIVE',
        },
      });
    } else {
      // Case 3: Attach single existing branch
      if (!instituteId) {
        return res.status(400).json({ success: false, error: 'instituteId or instituteIds is required to attach existing branches' });
      }

      branch = await prisma.institute.update({
        where: { id: instituteId },
        data: { franchiseId },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Branch successfully associated with franchise',
      data: { branch },
    });
  } catch (err: any) {
    console.error('[Add Branch Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to add branch' });
  }
}

export async function listFranchiseBranches(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const branches = await prisma.institute.findMany({
      where: { franchiseId },
      include: {
        _count: {
          select: {
            students: true,
            batches: true,
            staffProfiles: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      data: { branches, total: branches.length },
    });
  } catch (err: any) {
    console.error('[List Branches Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list branches' });
  }
}

export async function removeBranchFromFranchise(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only Super Admin can detach branches from a franchise.',
      });
    }

    const { id: franchiseId, branchId } = req.params;

    await prisma.institute.update({
      where: { id: branchId },
      data: { franchiseId: null },
    });

    return res.json({
      success: true,
      message: 'Branch successfully detached from franchise',
    });
  } catch (err: any) {
    console.error('[Remove Branch Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to remove branch' });
  }
}

export async function getMyAssignedBranches(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'SUPER_ADMIN') {
      const targetFranchiseId = req.query.franchiseId as string;
      const where: any = {};
      if (targetFranchiseId) {
        where.franchiseId = targetFranchiseId;
      }
      const branches = await prisma.institute.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          status: true,
          address: true,
          phone: true,
          email: true,
          franchiseId: true,
          franchise: { select: { id: true, code: true, name: true } },
          _count: { select: { students: true, batches: true, staffProfiles: true } },
        },
        orderBy: { name: 'asc' },
      });
      return res.json({
        success: true,
        data: {
          branches,
          total: branches.length,
        },
      });
    }

    // For FRANCHISE_OWNER (Franchisee Admin):
    const franchise = await prisma.franchise.findFirst({
      where: { ownerUserId: userId },
      include: {
        branches: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            status: true,
            address: true,
            phone: true,
            email: true,
            _count: { select: { students: true, batches: true, staffProfiles: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'No franchise associated with your user account',
      });
    }

    return res.json({
      success: true,
      data: {
        franchise: {
          id: franchise.id,
          code: franchise.code,
          name: franchise.name,
          ownerName: franchise.ownerName,
          status: franchise.status,
        },
        branches: franchise.branches,
        total: franchise.branches.length,
      },
    });
  } catch (err: any) {
    console.error('[Get My Assigned Branches Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve assigned branches' });
  }
}

export async function getUnassignedBranches(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const branches = await prisma.institute.findMany({
      where: {
        franchiseId: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        address: true,
        status: true,
        _count: { select: { students: true, batches: true, staffProfiles: true } },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      data: {
        branches,
        total: branches.length,
      },
    });
  } catch (err: any) {
    console.error('[Get Unassigned Branches Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve unassigned branches' });
  }
}

// ============================================================================
// 3. AGREEMENTS & ANNUAL TWO-INSTALLMENT RENEWALS / REVISIONS
// ============================================================================

export async function getAgreementTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    const templates = [
      {
        id: 'NEW_CENTRE_JOINT_INVESTMENT',
        type: 'NEW_CENTRE_JOINT_INVESTMENT',
        label: 'New Centre (Joint Investment)',
        description: 'Joint establishment of new centre. 50:50 initial setup investment (e.g. ₹1–2 Lakh illustrative default), shared revenue, Digital Guru supplies & pays trainers, initial 3 months marketing support.',
        defaults: {
          title: 'New Centre Joint Investment Master Agreement',
          agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
          calculationMethod: 'PERCENTAGE_REVENUE',
          totalInvestment: 200000,
          digitalGuruInvestmentAmount: 100000,
          partnerInvestmentAmount: 100000,
          digitalGuruInvestmentPercentage: 50.00,
          partnerInvestmentPercentage: 50.00,
          operationalSetupContribution: 50000,
          investmentNotes: 'Illustrative 50:50 joint initial setup and capital expenditure contribution (editable)',
          digitalGuruRevenuePercentage: 50.00,
          partnerRevenuePercentage: 50.00,
          revenueCalculationBasis: 'GROSS_COURSE_FEES',
          settlementFrequency: 'MONTHLY',
          expenseResponsibilities: {
            rent: { payer: 'PARTNER', notes: 'Partner pays building rent & lease deposit directly' },
            trainerSalaries: { payer: 'DIGITAL_GURU', notes: 'Digital Guru supplies trainers and bears trainer costs directly' },
            staffSalaries: { payer: 'PARTNER', notes: 'Partner pays administrative staff salaries directly' },
            operationalSetup: { payer: 'SHARED', sharedDgPercentage: 50, sharedPartnerPercentage: 50, notes: '50:50 shared initial operational setup' },
            utilitiesMaintenance: { payer: 'PARTNER', notes: 'Utilities, power, water, internet borne directly by Partner' },
            marketingAdvertising: { payer: 'DIGITAL_GURU', notes: 'Digital Guru supports initial 3 months marketing directly' },
            other: { payer: 'PARTNER', notes: 'Local compliance and center operations borne directly by Partner' },
          },
          marketingResponsibleParty: 'DIGITAL_GURU',
          marketingSupportDurationMonths: 3,
          marketingPostSupportParty: 'PARTNER',
          marketingBudget: 50000,
          courseSoftwareAccessEnabled: true,
          courseSoftwarePricingNotes: 'Full Course Management Software access included',
        },
      },
      {
        id: 'EXISTING_CENTRE',
        type: 'EXISTING_CENTRE',
        label: 'Existing Centre (Conversion)',
        description: 'Existing centre onboarded with active infrastructure. Digital Guru supplies certified trainers and covers initial 3 months marketing; partner handles premises rent and operations. Revenue share 45:55 or 55:45 (fully editable).',
        defaults: {
          title: 'Existing Centre Conversion Agreement',
          agreementType: 'EXISTING_CENTRE',
          calculationMethod: 'PERCENTAGE_REVENUE',
          totalInvestment: 0,
          digitalGuruInvestmentAmount: 0,
          partnerInvestmentAmount: 0,
          digitalGuruInvestmentPercentage: 0,
          partnerInvestmentPercentage: 0,
          operationalSetupContribution: 0,
          investmentNotes: 'Existing centre infrastructure utilized',
          digitalGuruRevenuePercentage: 45.00,
          partnerRevenuePercentage: 55.00,
          revenueCalculationBasis: 'GROSS_COURSE_FEES',
          settlementFrequency: 'MONTHLY',
          expenseResponsibilities: {
            rent: { payer: 'PARTNER', notes: 'Partner bears existing building rent directly' },
            trainerSalaries: { payer: 'DIGITAL_GURU', notes: 'Digital Guru supplies certified course trainers and bears trainer costs directly' },
            staffSalaries: { payer: 'PARTNER', notes: 'Partner pays center staff salaries directly' },
            operationalSetup: { payer: 'PARTNER', notes: 'Existing setup utilized' },
            utilitiesMaintenance: { payer: 'PARTNER', notes: 'Partner pays utilities directly' },
            marketingAdvertising: { payer: 'DIGITAL_GURU', notes: 'Digital Guru supports initial 3 months marketing directly' },
            other: { payer: 'PARTNER' },
          },
          marketingResponsibleParty: 'DIGITAL_GURU',
          marketingSupportDurationMonths: 3,
          marketingPostSupportParty: 'PARTNER',
          marketingBudget: 30000,
          courseSoftwareAccessEnabled: true,
          courseSoftwarePricingNotes: 'Course Management Software access enabled',
        },
      },
      {
        id: 'BRAND_AND_COURSE_SUPPORT',
        type: 'BRAND_AND_COURSE_SUPPORT',
        label: 'Brand & Course Support',
        description: 'Brand licensing, curriculum, exams, and LMS support. Partner operates centre independently with fixed annual commercial royalty (e.g. ₹2,00,000) or revenue share.',
        defaults: {
          title: 'Brand Licensing & Course Support Agreement',
          agreementType: 'BRAND_AND_COURSE_SUPPORT',
          calculationMethod: 'FIXED_ANNUAL',
          annualRoyaltyAmount: 200000,
          totalInvestment: 0,
          digitalGuruInvestmentAmount: 0,
          partnerInvestmentAmount: 0,
          digitalGuruInvestmentPercentage: 0,
          partnerInvestmentPercentage: 0,
          operationalSetupContribution: 0,
          digitalGuruRevenuePercentage: 50.00,
          partnerRevenuePercentage: 50.00,
          revenueCalculationBasis: 'GROSS_COURSE_FEES',
          settlementFrequency: 'YEARLY',
          expenseResponsibilities: {
            rent: { payer: 'PARTNER', notes: 'Partner bears building rent directly' },
            trainerSalaries: { payer: 'PARTNER', notes: 'Partner handles trainer salaries directly' },
            staffSalaries: { payer: 'PARTNER', notes: 'Partner handles staff salaries directly' },
            operationalSetup: { payer: 'PARTNER', notes: 'Partner handles centre setup' },
            utilitiesMaintenance: { payer: 'PARTNER', notes: 'Partner pays utilities directly' },
            marketingAdvertising: { payer: 'PARTNER', notes: 'Partner funds local marketing directly' },
            other: { payer: 'PARTNER' },
          },
          marketingResponsibleParty: 'PARTNER',
          marketingSupportDurationMonths: 0,
          marketingPostSupportParty: 'PARTNER',
          marketingBudget: 0,
          courseSoftwareAccessEnabled: true,
          courseSoftwarePricingNotes: 'Digital Guru LMS & Course Management Software license (standard terms apply)',
        },
      },
      {
        id: 'CUSTOM_AGREEMENT',
        type: 'CUSTOM_AGREEMENT',
        label: 'Custom Agreement',
        description: 'Fully custom agreement where all investment, revenue share, direct expense allocations, marketing, and settlement frequency are tailored with zero hidden dependencies.',
        defaults: {
          title: 'Custom Franchise Agreement',
          agreementType: 'CUSTOM_AGREEMENT',
          calculationMethod: 'PERCENTAGE_REVENUE',
          totalInvestment: 0,
          digitalGuruInvestmentAmount: 0,
          partnerInvestmentAmount: 0,
          digitalGuruInvestmentPercentage: 0,
          partnerInvestmentPercentage: 0,
          operationalSetupContribution: 0,
          digitalGuruRevenuePercentage: 50.00,
          partnerRevenuePercentage: 50.00,
          revenueCalculationBasis: 'GROSS_COURSE_FEES',
          settlementFrequency: 'MONTHLY',
          expenseResponsibilities: {},
          marketingResponsibleParty: 'DIGITAL_GURU',
          marketingSupportDurationMonths: 3,
          marketingPostSupportParty: 'PARTNER',
          courseSoftwareAccessEnabled: true,
        },
      },
    ];

    return res.json({ success: true, data: { templates } });
  } catch (err: any) {
    console.error('[Get Agreement Templates Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve agreement templates' });
  }
}

export async function createAgreement(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can create agreements' });
    }

    const { id: franchiseId } = req.params;
    const {
      title,
      startDate,
      endDate,
      agreementType,
      calculationMethod: requestedCalculationMethod,
      annualRoyaltyAmount,
      royaltyPercentage,
      digitalGuruRevenuePercentage,
      partnerRevenuePercentage,
      revenueCalculationBasis,
      settlementFrequency,
      totalInvestment,
      digitalGuruInvestmentAmount,
      partnerInvestmentAmount,
      digitalGuruInvestmentPercentage,
      partnerInvestmentPercentage,
      operationalSetupContribution,
      investmentNotes,
      expenseResponsibilities,
      marketingResponsibleParty,
      marketingSupportDurationMonths,
      marketingPostSupportParty,
      marketingBudget,
      marketingEffectiveStartDate,
      marketingNotes,
      courseSoftwareAccessEnabled,
      courseSoftwarePricingNotes,
      royaltyBasis,
      perStudentFee,
      dueDay,
      installment1DueDate,
      installment2DueDate,
      terms,
      notes,
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Title, start date, and end date are required' });
    }

    // Default calculation method based on agreementType if not explicitly passed
    const calculationMethod = requestedCalculationMethod || (
      agreementType === 'BRAND_AND_COURSE_SUPPORT' ? 'FIXED_ANNUAL' : 'PERCENTAGE_REVENUE'
    );

    if (!['FIXED_ANNUAL', 'PERCENTAGE_REVENUE', 'PER_STUDENT'].includes(calculationMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Calculation method is mandatory: choose FIXED_ANNUAL, PERCENTAGE_REVENUE, or PER_STUDENT',
      });
    }

    // Revenue Sharing Validation
    const effectiveDgRevenuePct = digitalGuruRevenuePercentage !== undefined
      ? Number(digitalGuruRevenuePercentage)
      : (royaltyPercentage !== undefined ? Number(royaltyPercentage) : 50.0);

    const effectivePartnerRevenuePct = partnerRevenuePercentage !== undefined
      ? Number(partnerRevenuePercentage)
      : (100 - effectiveDgRevenuePct);

    if (digitalGuruRevenuePercentage !== undefined || partnerRevenuePercentage !== undefined) {
      if (Math.round((effectiveDgRevenuePct + effectivePartnerRevenuePct) * 100) / 100 !== 100) {
        return res.status(400).json({
          success: false,
          error: `Revenue sharing percentages must total 100% (currently Digital Guru: ${effectiveDgRevenuePct}%, Partner: ${effectivePartnerRevenuePct}%)`,
        });
      }
    }

    if (calculationMethod === 'FIXED_ANNUAL' && (annualRoyaltyAmount === undefined || Number(annualRoyaltyAmount) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'FIXED_ANNUAL calculation method requires an explicit positive annualRoyaltyAmount',
      });
    }

    if (calculationMethod === 'PERCENTAGE_REVENUE' && effectiveDgRevenuePct <= 0) {
      return res.status(400).json({
        success: false,
        error: 'PERCENTAGE_REVENUE calculation method requires an explicit positive royaltyPercentage or digitalGuruRevenuePercentage',
      });
    }

    if (calculationMethod === 'PER_STUDENT' && (perStudentFee === undefined || Number(perStudentFee) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'PER_STUDENT calculation method requires an explicit positive perStudentFee',
      });
    }

    if (installment1DueDate && installment2DueDate && new Date(installment1DueDate) >= new Date(installment2DueDate)) {
      return res.status(400).json({
        success: false,
        error: 'Installment 1 due date must be strictly before Installment 2 due date',
      });
    }

    const year = new Date(startDate).getFullYear();
    const agreementNumber = await generateUniqueAgreementNumber(year);

    const agreement = await prisma.franchiseAgreement.create({
      data: {
        franchiseId,
        agreementNumber,
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        agreementType: agreementType || 'CUSTOM_AGREEMENT',
        calculationMethod,
        annualRoyaltyAmount: annualRoyaltyAmount !== undefined ? new Prisma.Decimal(annualRoyaltyAmount) : null,
        perStudentFee: perStudentFee !== undefined ? new Prisma.Decimal(perStudentFee) : null,
        royaltyPercentage: new Prisma.Decimal(effectiveDgRevenuePct),
        digitalGuruRevenuePercentage: new Prisma.Decimal(effectiveDgRevenuePct),
        partnerRevenuePercentage: new Prisma.Decimal(effectivePartnerRevenuePct),
        revenueCalculationBasis: revenueCalculationBasis || (royaltyBasis as any) || 'GROSS_COURSE_FEES',
        settlementFrequency: settlementFrequency || 'YEARLY',
        totalInvestment: totalInvestment !== undefined ? new Prisma.Decimal(totalInvestment) : null,
        digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined ? new Prisma.Decimal(digitalGuruInvestmentAmount) : null,
        partnerInvestmentAmount: partnerInvestmentAmount !== undefined ? new Prisma.Decimal(partnerInvestmentAmount) : null,
        digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined ? new Prisma.Decimal(digitalGuruInvestmentPercentage) : null,
        partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined ? new Prisma.Decimal(partnerInvestmentPercentage) : null,
        operationalSetupContribution: operationalSetupContribution !== undefined ? new Prisma.Decimal(operationalSetupContribution) : null,
        investmentNotes: investmentNotes || null,
        expenseResponsibilities: (expenseResponsibilities as any) ?? Prisma.DbNull,
        marketingResponsibleParty: marketingResponsibleParty || 'DIGITAL_GURU',
        marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined ? Number(marketingSupportDurationMonths) : 3,
        marketingPostSupportParty: marketingPostSupportParty || 'PARTNER',
        marketingBudget: marketingBudget !== undefined ? new Prisma.Decimal(marketingBudget) : null,
        marketingEffectiveStartDate: marketingEffectiveStartDate ? new Date(marketingEffectiveStartDate) : null,
        marketingNotes: marketingNotes || null,
        courseSoftwareAccessEnabled: courseSoftwareAccessEnabled !== undefined ? Boolean(courseSoftwareAccessEnabled) : true,
        courseSoftwarePricingNotes: courseSoftwarePricingNotes || null,
        version: 1,
        royaltyBasis: (royaltyBasis as any) || 'TOTAL_COLLECTIONS',
        paymentFrequency: settlementFrequency === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL',
        dueDay: dueDay ? Number(dueDay) : 10,
        installmentCount: settlementFrequency === 'MONTHLY' ? 0 : 2,
        status: 'ACTIVE',
        terms,
        notes,
        createdById: req.user?.userId,
      },
    });

    const isMonthly = settlementFrequency === 'MONTHLY';
    let installments: any[] = [];
    if (!isMonthly) {
      installments = await generateAnnualInstallments({
        franchiseId,
        agreementId: agreement.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        calculationMethod: agreement.calculationMethod || 'FIXED_ANNUAL',
        annualRoyaltyAmount: agreement.annualRoyaltyAmount ? Number(agreement.annualRoyaltyAmount) : null,
        royaltyPercentage: Number(agreement.royaltyPercentage),
        royaltyBasis: agreement.royaltyBasis,
        perStudentFee: agreement.perStudentFee ? Number(agreement.perStudentFee) : null,
        dueDay: agreement.dueDay,
        installment1DueDate,
        installment2DueDate,
      });
    }

    return res.status(201).json({
      success: true,
      message: isMonthly
        ? 'Franchise agreement created successfully with monthly settlement'
        : 'Franchise agreement and 2 annual installments created successfully',
      data: { agreement, installments },
    });
  } catch (err: any) {
    console.error('[Create Agreement Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create agreement' });
  }
}

// Revise agreement: creates version N+1 linked via parentAgreementId, preserving previous agreement history
export async function reviseAgreement(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can revise agreements' });
    }

    const { id: franchiseId, agreementId } = req.params;
    const previousAgreement = await prisma.franchiseAgreement.findUnique({
      where: { id: agreementId },
    });

    if (!previousAgreement) {
      return res.status(404).json({ success: false, error: 'Previous agreement not found' });
    }

    const {
      title,
      startDate,
      endDate,
      agreementType,
      calculationMethod,
      annualRoyaltyAmount,
      perStudentFee,
      royaltyPercentage,
      digitalGuruRevenuePercentage,
      partnerRevenuePercentage,
      revenueCalculationBasis,
      settlementFrequency,
      totalInvestment,
      digitalGuruInvestmentAmount,
      partnerInvestmentAmount,
      digitalGuruInvestmentPercentage,
      partnerInvestmentPercentage,
      operationalSetupContribution,
      investmentNotes,
      expenseResponsibilities,
      marketingResponsibleParty,
      marketingSupportDurationMonths,
      marketingPostSupportParty,
      marketingBudget,
      marketingEffectiveStartDate,
      marketingNotes,
      courseSoftwareAccessEnabled,
      courseSoftwarePricingNotes,
      dueDay,
      terms,
      notes,
      revisionReason,
    } = req.body;

    const effectiveDgPct = digitalGuruRevenuePercentage !== undefined
      ? Number(digitalGuruRevenuePercentage)
      : (royaltyPercentage !== undefined ? Number(royaltyPercentage) : Number(previousAgreement.digitalGuruRevenuePercentage ?? 50.0));

    const effectivePartnerPct = partnerRevenuePercentage !== undefined
      ? Number(partnerRevenuePercentage)
      : (100 - effectiveDgPct);

    if (Math.round((effectiveDgPct + effectivePartnerPct) * 100) / 100 !== 100) {
      return res.status(400).json({
        success: false,
        error: `Revenue sharing percentages must total 100% (currently Digital Guru: ${effectiveDgPct}%, Partner: ${effectivePartnerPct}%)`,
      });
    }

    const effSettlementFreq = settlementFrequency || previousAgreement.settlementFrequency || 'YEARLY';
    const isMonthly = effSettlementFreq === 'MONTHLY';
    const installmentCount = isMonthly ? 0 : 2;

    const newVersion = (previousAgreement.version || 1) + 1;
    const baseNumber = previousAgreement.agreementNumber.split('-v')[0];
    const agreementNumber = `${baseNumber}-v${newVersion}`;

    const { newAgreement, installments } = await prisma.$transaction(async (tx: any) => {
      // 1. Mark previous agreement as EXPIRED (preserving all historical installments, payments, and receipts)
      await tx.franchiseAgreement.update({
        where: { id: agreementId },
        data: { status: 'EXPIRED' },
      });

      // 2. Create revised agreement version
      const createdAgreement = await tx.franchiseAgreement.create({
        data: {
          franchiseId,
          agreementNumber,
          title: title || `${previousAgreement.title} (Rev v${newVersion})`,
          startDate: new Date(startDate || previousAgreement.startDate),
          endDate: new Date(endDate || previousAgreement.endDate),
          agreementType: agreementType || previousAgreement.agreementType,
          calculationMethod: calculationMethod || previousAgreement.calculationMethod || 'PERCENTAGE_REVENUE',
          annualRoyaltyAmount: annualRoyaltyAmount !== undefined
            ? new Prisma.Decimal(annualRoyaltyAmount)
            : previousAgreement.annualRoyaltyAmount,
          perStudentFee: perStudentFee !== undefined
            ? new Prisma.Decimal(perStudentFee)
            : previousAgreement.perStudentFee,
          royaltyPercentage: new Prisma.Decimal(effectiveDgPct),
          digitalGuruRevenuePercentage: new Prisma.Decimal(effectiveDgPct),
          partnerRevenuePercentage: new Prisma.Decimal(effectivePartnerPct),
          revenueCalculationBasis: revenueCalculationBasis || previousAgreement.revenueCalculationBasis,
          settlementFrequency: effSettlementFreq,
          totalInvestment: totalInvestment !== undefined
            ? new Prisma.Decimal(totalInvestment)
            : previousAgreement.totalInvestment,
          digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined
            ? new Prisma.Decimal(digitalGuruInvestmentAmount)
            : previousAgreement.digitalGuruInvestmentAmount,
          partnerInvestmentAmount: partnerInvestmentAmount !== undefined
            ? new Prisma.Decimal(partnerInvestmentAmount)
            : previousAgreement.partnerInvestmentAmount,
          digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined
            ? new Prisma.Decimal(digitalGuruInvestmentPercentage)
            : previousAgreement.digitalGuruInvestmentPercentage,
          partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined
            ? new Prisma.Decimal(partnerInvestmentPercentage)
            : previousAgreement.partnerInvestmentPercentage,
          operationalSetupContribution: operationalSetupContribution !== undefined
            ? new Prisma.Decimal(operationalSetupContribution)
            : previousAgreement.operationalSetupContribution,
          investmentNotes: investmentNotes !== undefined ? investmentNotes : previousAgreement.investmentNotes,
          expenseResponsibilities: (expenseResponsibilities as any) ?? previousAgreement.expenseResponsibilities ?? Prisma.DbNull,
          marketingResponsibleParty: marketingResponsibleParty || previousAgreement.marketingResponsibleParty,
          marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined
            ? Number(marketingSupportDurationMonths)
            : previousAgreement.marketingSupportDurationMonths,
          marketingPostSupportParty: marketingPostSupportParty || previousAgreement.marketingPostSupportParty,
          marketingBudget: marketingBudget !== undefined ? new Prisma.Decimal(marketingBudget) : previousAgreement.marketingBudget,
          marketingEffectiveStartDate: marketingEffectiveStartDate ? new Date(marketingEffectiveStartDate) : previousAgreement.marketingEffectiveStartDate,
          marketingNotes: marketingNotes !== undefined ? marketingNotes : previousAgreement.marketingNotes,
          courseSoftwareAccessEnabled: courseSoftwareAccessEnabled !== undefined ? Boolean(courseSoftwareAccessEnabled) : previousAgreement.courseSoftwareAccessEnabled,
          courseSoftwarePricingNotes: courseSoftwarePricingNotes !== undefined ? courseSoftwarePricingNotes : previousAgreement.courseSoftwarePricingNotes,
          version: newVersion,
          parentAgreementId: previousAgreement.id,
          paymentFrequency: isMonthly ? 'MONTHLY' : 'ANNUAL',
          dueDay: dueDay ? Number(dueDay) : previousAgreement.dueDay,
          installmentCount,
          status: 'ACTIVE',
          terms: terms || previousAgreement.terms,
          notes: notes || (revisionReason ? `[Revision v${newVersion}]: ${revisionReason}` : `Revised from ${previousAgreement.agreementNumber}`),
          createdById: req.user?.userId,
        },
      });

      // 3. Generate installments for revised agreement ONLY IF YEARLY
      let createdInstallments: any[] = [];
      if (!isMonthly) {
        createdInstallments = await generateAnnualInstallments({
          franchiseId,
          agreementId: createdAgreement.id,
          startDate: createdAgreement.startDate,
          endDate: createdAgreement.endDate,
          calculationMethod: createdAgreement.calculationMethod || 'FIXED_ANNUAL',
          annualRoyaltyAmount: createdAgreement.annualRoyaltyAmount ? Number(createdAgreement.annualRoyaltyAmount) : null,
          royaltyPercentage: Number(createdAgreement.royaltyPercentage),
          royaltyBasis: createdAgreement.royaltyBasis,
          perStudentFee: createdAgreement.perStudentFee ? Number(createdAgreement.perStudentFee) : null,
          dueDay: createdAgreement.dueDay,
          prismaClient: tx,
        });
      }

      return { newAgreement: createdAgreement, installments: createdInstallments };
    });

    return res.status(201).json({
      success: true,
      message: `Agreement revised successfully to version ${newVersion}. Historical agreement ${previousAgreement.agreementNumber} preserved.`,
      data: {
        agreement: newAgreement,
        installments,
        previousAgreementId: previousAgreement.id,
        version: newVersion,
      },
    });
  } catch (err: any) {
    console.error('[Revise Agreement Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to revise agreement' });
  }
}

// Renew agreement: marks previous agreement EXPIRED and generates new annual agreement + 2 installments
export async function renewAgreement(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can renew agreements' });
    }

    const { id: franchiseId, agreementId } = req.params;
    const {
      title,
      startDate,
      endDate,
      agreementType,
      calculationMethod,
      annualRoyaltyAmount,
      royaltyPercentage,
      digitalGuruRevenuePercentage,
      partnerRevenuePercentage,
      revenueCalculationBasis,
      settlementFrequency,
      totalInvestment,
      digitalGuruInvestmentAmount,
      partnerInvestmentAmount,
      digitalGuruInvestmentPercentage,
      partnerInvestmentPercentage,
      operationalSetupContribution,
      investmentNotes,
      expenseResponsibilities,
      marketingResponsibleParty,
      marketingSupportDurationMonths,
      marketingPostSupportParty,
      marketingBudget,
      marketingEffectiveStartDate,
      marketingNotes,
      courseSoftwareAccessEnabled,
      courseSoftwarePricingNotes,
      royaltyBasis,
      perStudentFee,
      dueDay,
      installment1DueDate,
      installment2DueDate,
      terms,
      notes,
    } = req.body;

    const previousAgreement = await prisma.franchiseAgreement.findUnique({
      where: { id: agreementId },
      include: { installments: true },
    });

    if (!previousAgreement) {
      return res.status(404).json({ success: false, error: 'Previous agreement not found' });
    }

    // Revenue Sharing Validation
    const effectiveDgRevenuePct = digitalGuruRevenuePercentage !== undefined
      ? Number(digitalGuruRevenuePercentage)
      : (royaltyPercentage !== undefined ? Number(royaltyPercentage) : Number(previousAgreement.digitalGuruRevenuePercentage ?? previousAgreement.royaltyPercentage ?? 50.0));

    const effectivePartnerRevenuePct = partnerRevenuePercentage !== undefined
      ? Number(partnerRevenuePercentage)
      : (100 - effectiveDgRevenuePct);

    if (digitalGuruRevenuePercentage !== undefined || partnerRevenuePercentage !== undefined) {
      if (Math.round((effectiveDgRevenuePct + effectivePartnerRevenuePct) * 100) / 100 !== 100) {
        return res.status(400).json({
          success: false,
          error: `Revenue sharing percentages must total 100% (currently Digital Guru: ${effectiveDgRevenuePct}%, Partner: ${effectivePartnerRevenuePct}%)`,
        });
      }
    }

    const effSettlementFreq = settlementFrequency || previousAgreement.settlementFrequency || 'YEARLY';
    const isMonthly = effSettlementFreq === 'MONTHLY';
    const installmentCount = isMonthly ? 0 : 2;

    const year = new Date(startDate || Date.now()).getFullYear();
    const agreementNumber = await generateUniqueAgreementNumber(year);

    const { newAgreement, installments } = await prisma.$transaction(async (tx: any) => {
      // 1. Mark previous agreement as EXPIRED (retaining all history, installments, and receipts)
      await tx.franchiseAgreement.update({
        where: { id: agreementId },
        data: { status: 'EXPIRED' },
      });

      // 2. Create renewed agreement
      const createdAgreement = await tx.franchiseAgreement.create({
        data: {
          franchiseId,
          agreementNumber,
          title: title || `Annual Master Agreement (${year})`,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          agreementType: agreementType || previousAgreement.agreementType,
          annualRoyaltyAmount: annualRoyaltyAmount !== undefined
            ? new Prisma.Decimal(annualRoyaltyAmount)
            : previousAgreement.annualRoyaltyAmount,
          calculationMethod: calculationMethod || previousAgreement.calculationMethod || 'FIXED_ANNUAL',
          perStudentFee: perStudentFee !== undefined
            ? new Prisma.Decimal(perStudentFee)
            : previousAgreement.perStudentFee,
          royaltyPercentage: new Prisma.Decimal(effectiveDgRevenuePct),
          digitalGuruRevenuePercentage: new Prisma.Decimal(effectiveDgRevenuePct),
          partnerRevenuePercentage: new Prisma.Decimal(effectivePartnerRevenuePct),
          revenueCalculationBasis: revenueCalculationBasis || previousAgreement.revenueCalculationBasis,
          settlementFrequency: effSettlementFreq,
          totalInvestment: totalInvestment !== undefined
            ? new Prisma.Decimal(totalInvestment)
            : previousAgreement.totalInvestment,
          digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined
            ? new Prisma.Decimal(digitalGuruInvestmentAmount)
            : previousAgreement.digitalGuruInvestmentAmount,
          partnerInvestmentAmount: partnerInvestmentAmount !== undefined
            ? new Prisma.Decimal(partnerInvestmentAmount)
            : previousAgreement.partnerInvestmentAmount,
          digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined
            ? new Prisma.Decimal(digitalGuruInvestmentPercentage)
            : previousAgreement.digitalGuruInvestmentPercentage,
          partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined
            ? new Prisma.Decimal(partnerInvestmentPercentage)
            : previousAgreement.partnerInvestmentPercentage,
          operationalSetupContribution: operationalSetupContribution !== undefined
            ? new Prisma.Decimal(operationalSetupContribution)
            : previousAgreement.operationalSetupContribution,
          investmentNotes: investmentNotes !== undefined ? investmentNotes : previousAgreement.investmentNotes,
          expenseResponsibilities: (expenseResponsibilities as any) ?? previousAgreement.expenseResponsibilities ?? Prisma.DbNull,
          marketingResponsibleParty: marketingResponsibleParty || previousAgreement.marketingResponsibleParty,
          marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined
            ? Number(marketingSupportDurationMonths)
            : previousAgreement.marketingSupportDurationMonths,
          marketingPostSupportParty: marketingPostSupportParty || previousAgreement.marketingPostSupportParty,
          marketingBudget: marketingBudget !== undefined ? new Prisma.Decimal(marketingBudget) : previousAgreement.marketingBudget,
          marketingEffectiveStartDate: marketingEffectiveStartDate ? new Date(marketingEffectiveStartDate) : previousAgreement.marketingEffectiveStartDate,
          marketingNotes: marketingNotes !== undefined ? marketingNotes : previousAgreement.marketingNotes,
          courseSoftwareAccessEnabled: courseSoftwareAccessEnabled !== undefined ? Boolean(courseSoftwareAccessEnabled) : previousAgreement.courseSoftwareAccessEnabled,
          courseSoftwarePricingNotes: courseSoftwarePricingNotes !== undefined ? courseSoftwarePricingNotes : previousAgreement.courseSoftwarePricingNotes,
          version: 1,
          royaltyBasis: (royaltyBasis as any) || previousAgreement.royaltyBasis,
          paymentFrequency: isMonthly ? 'MONTHLY' : 'ANNUAL',
          dueDay: dueDay ? Number(dueDay) : previousAgreement.dueDay,
          installmentCount,
          status: 'ACTIVE',
          terms: terms || previousAgreement.terms,
          notes: notes ? `[Renewed from ${previousAgreement.agreementNumber}]: ${notes}` : `Renewed from ${previousAgreement.agreementNumber}`,
          createdById: req.user?.userId,
        },
      });

      // 3. Generate installments only for YEARLY settlement frequency
      let createdInstallments: any[] = [];
      if (!isMonthly) {
        createdInstallments = await generateAnnualInstallments({
          franchiseId,
          agreementId: createdAgreement.id,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          calculationMethod: createdAgreement.calculationMethod || 'FIXED_ANNUAL',
          annualRoyaltyAmount: createdAgreement.annualRoyaltyAmount ? Number(createdAgreement.annualRoyaltyAmount) : null,
          royaltyPercentage: Number(createdAgreement.royaltyPercentage),
          royaltyBasis: createdAgreement.royaltyBasis,
          perStudentFee: createdAgreement.perStudentFee ? Number(createdAgreement.perStudentFee) : null,
          dueDay: createdAgreement.dueDay,
          installment1DueDate,
          installment2DueDate,
          prismaClient: tx,
        });
      }

      return { newAgreement: createdAgreement, installments: createdInstallments };
    });

    return res.status(201).json({
      success: true,
      message: 'Agreement renewed successfully. Previous agreement and installments preserved.',
      data: {
        newAgreement,
        agreement: newAgreement,
        installments,
        previousAgreementId: previousAgreement.id,
      },
    });
  } catch (err: any) {
    console.error('[Renew Agreement Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to renew agreement' });
  }
}

export async function listAgreements(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const agreements = await prisma.franchiseAgreement.findMany({
      where: { franchiseId },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
          include: { payments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: { agreements, total: agreements.length },
    });
  } catch (err: any) {
    console.error('[List Agreements Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list agreements' });
  }
}

export async function updateAgreementStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId, agreementId } = req.params;
    const { status, note } = req.body;

    const validStatuses = ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid agreement status' });
    }

    const updated = await prisma.franchiseAgreement.update({
      where: { id: agreementId },
      data: {
        status,
        ...(note && { notes: note }),
      },
    });

    return res.json({
      success: true,
      message: `Agreement status updated to ${status}`,
      data: { agreement: updated },
    });
  } catch (err: any) {
    console.error('[Update Agreement Status Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update agreement status' });
  }
}

export async function addAgreementAmendment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId, agreementId } = req.params;
    const { note, changes, newRoyaltyPercentage, newAnnualAmount } = req.body;

    const agreement = await prisma.franchiseAgreement.findUnique({
      where: { id: agreementId },
    });
    if (!agreement) {
      return res.status(404).json({ success: false, error: 'Agreement not found' });
    }

    const existingAmendments = Array.isArray(agreement.amendments) ? agreement.amendments : [];
    const newAmendment = {
      date: new Date().toISOString(),
      authorizedBy: req.user?.email || req.user?.userId,
      note,
      changes,
      previousRoyaltyPercentage: agreement.royaltyPercentage.toString(),
      previousAnnualAmount: agreement.annualRoyaltyAmount ? agreement.annualRoyaltyAmount.toString() : null,
    };

    const updateData: any = {
      amendments: [...existingAmendments, newAmendment],
    };
    if (newRoyaltyPercentage !== undefined) {
      updateData.royaltyPercentage = new Prisma.Decimal(newRoyaltyPercentage);
    }
    if (newAnnualAmount !== undefined) {
      updateData.annualRoyaltyAmount = new Prisma.Decimal(newAnnualAmount);
    }

    const updated = await prisma.franchiseAgreement.update({
      where: { id: agreementId },
      data: updateData,
    });

    return res.json({
      success: true,
      message: 'Agreement amendment recorded successfully',
      data: { agreement: updated },
    });
  } catch (err: any) {
    console.error('[Agreement Amendment Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to record amendment' });
  }
}

export async function getAgreementPdfData(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId, agreementId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const agreement = await prisma.franchiseAgreement.findUnique({
      where: { id: agreementId },
      include: {
        franchise: {
          include: {
            branches: { select: { name: true, code: true, city: true } },
          },
        },
        installments: {
          orderBy: { installmentNumber: 'asc' },
          include: { payments: true },
        },
      },
    });

    if (!agreement) {
      return res.status(404).json({ success: false, error: 'Agreement not found' });
    }

    return res.json({
      success: true,
      data: {
        agreement,
        company: {
          name: 'Digital Ghuru',
          brand: 'Digital Guru Franchise Enterprise',
          partner: 'Jaighurudeva Educational Academy',
          royaltySplit: `50% Super Admin / 50% Franchise Owner (${agreement.calculationMethod === 'FIXED_ANNUAL' ? `Fixed Annual Royalty: ₹${Number(agreement.annualRoyaltyAmount || 0).toLocaleString('en-IN')}` : `${agreement.royaltyPercentage}% Collections`})`,
        },
      },
    });
  } catch (err: any) {
    console.error('[Agreement PDF Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to generate agreement data' });
  }
}

// ============================================================================
// 4. TWO-INSTALLMENT ROYALTY WORKFLOW & RECEIPT MANAGEMENT
// ============================================================================

export async function listFranchiseInstallments(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const installments = await prisma.franchiseRoyaltyInstallment.findMany({
      where: { franchiseId },
      include: {
        agreement: { select: { id: true, agreementNumber: true, title: true, status: true, calculationMethod: true } },
        payments: {
          select: {
            id: true,
            receiptNumber: true,
            amountPaid: true,
            paymentDate: true,
            paymentMethod: true,
            transactionReference: true,
            remarks: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: [{ agreement: { startDate: 'desc' } }, { installmentNumber: 'asc' }],
    });

    const withLiveStatus = installments.map((inst) => ({
      ...inst,
      liveStatus: computeInstallmentLiveStatus(inst),
    }));

    return res.json({
      success: true,
      data: {
        installments: withLiveStatus,
        total: withLiveStatus.length,
      },
    });
  } catch (err: any) {
    console.error('[List Installments Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list installments' });
  }
}

export async function listAgreementInstallments(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId, agreementId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const installments = await prisma.franchiseRoyaltyInstallment.findMany({
      where: { franchiseId, agreementId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { installmentNumber: 'asc' },
    });

    const withLiveStatus = installments.map((inst) => ({
      ...inst,
      liveStatus: computeInstallmentLiveStatus(inst),
    }));

    return res.json({
      success: true,
      data: {
        installments: withLiveStatus,
        total: withLiveStatus.length,
      },
    });
  } catch (err: any) {
    console.error('[List Agreement Installments Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list agreement installments' });
  }
}

export async function recordInstallmentPayment(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can record royalty payments' });
    }

    const { id: franchiseId, installmentId } = req.params;
    const { amountPaid, paymentMethod, transactionReference, remarks, paymentDate } = req.body;

    if (!amountPaid || Number(amountPaid) <= 0 || isNaN(Number(amountPaid))) {
      return res.status(400).json({ success: false, error: 'Amount paid must be a valid number greater than zero' });
    }

    const franchise = await prisma.franchise.findUnique({ where: { id: franchiseId } });
    if (!franchise) {
      return res.status(404).json({ success: false, error: 'Franchise not found' });
    }
    if (franchise.status === 'TERMINATED') {
      return res.status(400).json({ success: false, error: 'Cannot record royalty payments for a terminated franchise' });
    }

    const installment = await prisma.franchiseRoyaltyInstallment.findUnique({
      where: { id: installmentId },
      include: { agreement: true },
    });

    if (!installment || installment.franchiseId !== franchiseId) {
      return res.status(404).json({ success: false, error: 'Royalty installment not found for this franchise' });
    }

    if (installment.status === 'PAID' && Number(installment.outstandingBalance) <= 0) {
      return res.status(400).json({ success: false, error: 'This installment has already been fully paid' });
    }

    const paidNum = Number(amountPaid);

    // Overpayment check against current installment snapshot
    const currentOutstanding = Number(installment.outstandingBalance);
    if (paidNum > currentOutstanding) {
      return res.status(400).json({
        success: false,
        error: `Payment amount of ₹${paidNum.toLocaleString('en-IN')} exceeds the outstanding balance of ₹${currentOutstanding.toLocaleString('en-IN')} for Installment #${installment.installmentNumber}. Overpayment is strictly rejected.`,
      });
    }

    const receiptNumber = await generateRoyaltyReceiptNumber();

    // Atomic transaction for payment creation and balance update with safe WAN latency timeouts
    let result;
    try {
      result = await prisma.$transaction(
        async (tx) => {
          // Re-check duplicate transaction reference within transaction
          if (transactionReference && transactionReference.trim()) {
            const existingPayment = await tx.franchiseRoyaltyPayment.findFirst({
              where: { franchiseId, transactionReference: transactionReference.trim() },
            });
            if (existingPayment) {
              throw new Error('DUPLICATE_REFERENCE');
            }
          }

          // Re-read installment to ensure latest balance under transaction
          const freshInst = await tx.franchiseRoyaltyInstallment.findUnique({
            where: { id: installmentId },
          });
          if (!freshInst) {
            throw new Error('INSTALLMENT_NOT_FOUND');
          }

          const freshOutstanding = Number(freshInst.outstandingBalance);
          if (paidNum > freshOutstanding) {
            throw new Error('OVERPAYMENT_CONCURRENT');
          }

          const payment = await tx.franchiseRoyaltyPayment.create({
            data: {
              franchiseId,
              installmentId,
              receiptNumber,
              amountPaid: new Prisma.Decimal(paidNum),
              paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
              paymentMethod: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(paymentMethod)
                ? paymentMethod
                : 'BANK_TRANSFER',
              transactionReference: transactionReference?.trim() || null,
              remarks: remarks || null,
              recordedById: req.user!.userId,
            },
          });

          const currentPaid = Number(freshInst.paidAmount || 0);
          const newPaid = Math.round((currentPaid + paidNum) * 100) / 100;
          const newOutstanding = Math.max(0, Math.round((Number(freshInst.amount) - newPaid) * 100) / 100);
          const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          const updatedInstallment = await tx.franchiseRoyaltyInstallment.update({
            where: { id: installmentId },
            data: {
              paidAmount: new Prisma.Decimal(newPaid),
              outstandingBalance: new Prisma.Decimal(newOutstanding),
              status: newStatus,
            },
          });

          return { payment, updatedInstallment, receiptNumber };
        },
        {
          maxWait: 15000,
          timeout: 30000,
        }
      );
    } catch (txErr: any) {
      if (txErr.message === 'DUPLICATE_REFERENCE') {
        return res.status(409).json({
          success: false,
          error: `Duplicate payment detected: transaction reference "${transactionReference?.trim()}" has already been recorded for this franchise.`,
        });
      }
      if (txErr.message === 'OVERPAYMENT_CONCURRENT') {
        return res.status(400).json({
          success: false,
          error: 'Payment amount exceeds current outstanding balance due to a concurrent transaction.',
        });
      }
      throw txErr;
    }

    return res.status(201).json({
      success: true,
      message: `Royalty payment of ₹${paidNum.toLocaleString('en-IN')} recorded successfully against Installment #${installment.installmentNumber}`,
      data: {
        payment: result.payment,
        installment: {
          ...result.updatedInstallment,
          liveStatus: computeInstallmentLiveStatus(result.updatedInstallment),
        },
        receiptNumber: result.receiptNumber,
      },
    });
  } catch (err: any) {
    console.error('[Record Installment Payment Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to record installment payment' });
  }
}

export async function getRoyaltyPaymentReceipt(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId, paymentId } = req.params;
    const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const payment = await prisma.franchiseRoyaltyPayment.findUnique({
      where: { id: paymentId },
      include: {
        franchise: {
          select: {
            id: true,
            code: true,
            name: true,
            ownerName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
            businessDetails: true,
          },
        },
        installment: {
          include: {
            agreement: {
              select: {
                id: true,
                agreementNumber: true,
                title: true,
                startDate: true,
                endDate: true,
                calculationMethod: true,
              },
            },
          },
        },
        recordedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!payment || payment.franchiseId !== franchiseId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    return res.json({
      success: true,
      data: {
        receiptNumber: payment.receiptNumber,
        receiptDate: payment.paymentDate,
        amountPaid: Number(payment.amountPaid),
        paymentMethod: payment.paymentMethod,
        transactionReference: payment.transactionReference,
        remarks: payment.remarks,
        paymentDetails: {
          amountPaid: Number(payment.amountPaid),
          paymentMethod: payment.paymentMethod,
          transactionReference: payment.transactionReference,
          paymentDate: payment.paymentDate,
          remarks: payment.remarks,
        },
        payer: {
          franchiseName: payment.franchise.name,
          franchiseCode: payment.franchise.code,
          ownerName: payment.franchise.ownerName,
          phone: payment.franchise.phone,
          email: payment.franchise.email,
          address: payment.franchise.address,
          city: payment.franchise.city,
          state: payment.franchise.state,
          postalCode: payment.franchise.postalCode,
          country: payment.franchise.country,
          businessDetails: payment.franchise.businessDetails,
        },
        installment: payment.installment
          ? {
            installmentNumber: payment.installment.installmentNumber,
            periodLabel: payment.installment.periodLabel,
            installmentAmount: Number(payment.installment.amount),
            totalPaidToDate: Number(payment.installment.paidAmount),
            outstandingBalance: Number(payment.installment.outstandingBalance),
            status: payment.installment.status,
            agreementNumber: payment.installment.agreement?.agreementNumber,
            agreementTitle: payment.installment.agreement?.title,
            calculationBasis: payment.installment.calculationBasis,
            calculationBreakdown: payment.installment.calculationBreakdown,
          }
          : null,
        issuer: {
          organization: 'Digital Guru Franchise Enterprise',
          partner: 'Jaighurudeva Educational Academy',
          recordedBy: payment.recordedBy.fullName,
          verified: true,
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Payment Receipt Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve receipt' });
  }
}

// ============================================================================
// 5. LEGACY / MONTHLY ROYALTY CALCULATION & PAYMENTS
// ============================================================================

export async function calculateRoyalty(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const { startDate, endDate, periodLabel, instituteId } = req.body;

    if (!startDate || !endDate || !periodLabel) {
      return res.status(400).json({
        success: false,
        error: 'startDate, endDate, and periodLabel (e.g. "2026-11") are required',
      });
    }

    const franchise = await prisma.franchise.findUnique({
      where: { id: franchiseId },
      include: {
        branches: true,
        agreements: { where: { status: 'ACTIVE' }, take: 1, orderBy: [{ createdAt: 'desc' }, { endDate: 'desc' }] },
      },
    });

    if (!franchise) {
      return res.status(404).json({ success: false, error: 'Franchise not found' });
    }

    const branchIds = instituteId ? [instituteId] : franchise.branches.map((b) => b.id);
    const activeAgreement = franchise.agreements[0];
    
    // Revenue sharing percentages & calculation basis resolution
    const dgPercentage = activeAgreement?.digitalGuruRevenuePercentage
      ? Number(activeAgreement.digitalGuruRevenuePercentage)
      : (activeAgreement?.royaltyPercentage ? Number(activeAgreement.royaltyPercentage) : 50.0);
    const partnerPercentage = activeAgreement?.partnerRevenuePercentage
      ? Number(activeAgreement.partnerRevenuePercentage)
      : (100 - dgPercentage);
    
    const calculationBasis = (req.body.revenueCalculationBasis as string) || 
      activeAgreement?.revenueCalculationBasis || 
      'GROSS_COURSE_FEES';

    const start = new Date(startDate);
    const end = new Date(endDate);

    const payments = await prisma.payment.findMany({
      where: {
        instituteId: { in: branchIds },
        paidAt: { gte: start, lte: end },
        status: 'SUCCESS',
      },
      select: {
        id: true,
        receiptNumber: true,
        amountPaid: true,
        method: true,
        paidAt: true,
        studentId: true,
        instituteId: true,
      },
    });

    const grossCollection = payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    
    // Determine eligible revenue / profit based on calculationBasis
    let eligibleRevenue = grossCollection;
    let deductionsOrExpenses = 0;

    if (calculationBasis === 'NET_COURSE_REVENUE') {
      const adjustments = await prisma.paymentAdjustment.findMany({
        where: {
          payment: {
            instituteId: { in: branchIds },
            paidAt: { gte: start, lte: end },
          },
        },
        select: { amount: true },
      });
      deductionsOrExpenses = adjustments.reduce((sum, a) => sum + Number(a.amount), 0) + Number(req.body.deductions || 0);
      eligibleRevenue = Math.max(0, grossCollection - deductionsOrExpenses);
    } else if (calculationBasis === 'PROFIT_AFTER_EXPENSES') {
      deductionsOrExpenses = Number(req.body.deductibleExpenses ?? req.body.operatingExpenses ?? req.body.expenses ?? 0);
      eligibleRevenue = Math.max(0, grossCollection - deductionsOrExpenses);
    }

    const royaltyPayable = Math.round(((eligibleRevenue * dgPercentage) / 100) * 100) / 100;
    const partnerShare = Math.round((eligibleRevenue - royaltyPayable) * 100) / 100;

    const calculationDetailsPayload = {
      paymentCount: payments.length,
      calculationBasis,
      periodLabel,
      agreementId: activeAgreement?.id || null,
      agreementVersion: activeAgreement?.version || 1,
      agreementType: activeAgreement?.agreementType || 'CUSTOM_AGREEMENT',
      grossCollection,
      deductionsOrExpenses,
      deductibleExpenses: calculationBasis === 'PROFIT_AFTER_EXPENSES' ? deductionsOrExpenses : 0,
      refundsAndAdjustments: calculationBasis === 'NET_COURSE_REVENUE' ? deductionsOrExpenses : 0,
      eligibleRevenue,
      distributableAmount: eligibleRevenue,
      digitalGuruPercentage: dgPercentage,
      partnerPercentage,
      digitalGuruShare: royaltyPayable,
      partnerShare,
      settlementFrequency: activeAgreement?.settlementFrequency || 'MONTHLY',
      directPayerExpensesIgnored: true,
      zeroProfitFloorApplied: grossCollection < deductionsOrExpenses,
      paymentsSummary: payments.slice(0, 50),
      calculatedAt: new Date().toISOString(),
      calculatedById: req.user?.userId || null,
      calculatedByEmail: req.user?.email || null,
    };

    let record = await prisma.franchiseRoyaltyRecord.findFirst({
      where: {
        franchiseId,
        periodLabel,
        instituteId: instituteId || null,
      },
    });

    const dueDay = activeAgreement?.dueDay || 10;
    const dueDate = new Date(end);
    dueDate.setDate(dueDay);

    if (record) {
      const outstanding = royaltyPayable - Number(record.royaltyPaid);
      const status =
        outstanding <= 0
          ? 'PAID'
          : Number(record.royaltyPaid) > 0
            ? 'PARTIALLY_PAID'
            : new Date() > dueDate
              ? 'OVERDUE'
              : 'PENDING';

      record = await prisma.franchiseRoyaltyRecord.update({
        where: { id: record.id },
        data: {
          grossCollection: new Prisma.Decimal(grossCollection),
          eligibleRevenue: new Prisma.Decimal(eligibleRevenue),
          royaltyPercentage: new Prisma.Decimal(dgPercentage),
          royaltyPayable: new Prisma.Decimal(royaltyPayable),
          outstandingBalance: new Prisma.Decimal(outstanding),
          status: status as any,
          calculationDetails: calculationDetailsPayload,
        },
      });
    } else {
      const status = new Date() > dueDate ? 'OVERDUE' : 'PENDING';
      record = await prisma.franchiseRoyaltyRecord.create({
        data: {
          franchiseId,
          instituteId: instituteId || null,
          periodLabel,
          startDate: start,
          endDate: end,
          grossCollection: new Prisma.Decimal(grossCollection),
          eligibleRevenue: new Prisma.Decimal(eligibleRevenue),
          royaltyPercentage: new Prisma.Decimal(dgPercentage),
          royaltyPayable: new Prisma.Decimal(royaltyPayable),
          royaltyPaid: new Prisma.Decimal(0.0),
          outstandingBalance: new Prisma.Decimal(royaltyPayable),
          status: status as any,
          dueDate,
          calculationDetails: calculationDetailsPayload,
        },
      });
    }

    return res.json({
      success: true,
      message: `Settlement for ${periodLabel} calculated successfully at ${dgPercentage}% (DG) : ${partnerPercentage}% (Partner) on ${calculationBasis}`,
      data: {
        royaltyRecord: record,
        summary: {
          periodLabel,
          franchiseId,
          branchId: instituteId || null,
          agreementVersion: activeAgreement?.version || 1,
          agreementType: activeAgreement?.agreementType || 'CUSTOM_AGREEMENT',
          branchesCovered: branchIds.length,
          paymentsCount: payments.length,
          grossCollection,
          calculationBasis,
          deductionsOrExpenses,
          deductibleExpenses: calculationBasis === 'PROFIT_AFTER_EXPENSES' ? deductionsOrExpenses : 0,
          refundsAndAdjustments: calculationBasis === 'NET_COURSE_REVENUE' ? deductionsOrExpenses : 0,
          eligibleRevenue,
          distributableAmount: eligibleRevenue,
          royaltyPercentage: dgPercentage,
          digitalGuruRevenuePercentage: dgPercentage,
          partnerRevenuePercentage: partnerPercentage,
          royaltyPayable,
          digitalGuruShare: royaltyPayable,
          superAdminShare: royaltyPayable,
          partnerShare,
          franchiseOwnerShare: partnerShare,
          settlementFrequency: activeAgreement?.settlementFrequency || 'MONTHLY',
          directPayerExpensesIgnored: true,
          calculatedAt: new Date().toISOString(),
          calculatedBy: req.user?.email || req.user?.userId,
        },
      },
    });
  } catch (err: any) {
    console.error('[Calculate Royalty Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate royalty' });
  }
}

export async function listRoyaltyRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const isSuperAdminAll = franchiseId === 'all' && req.user!.role === 'SUPER_ADMIN';

    if (!isSuperAdminAll) {
      const { authorized } = await verifyFranchiseAccess(req.user!.userId, req.user!.role, franchiseId);
      if (!authorized) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    const whereClause = isSuperAdminAll ? {} : { franchiseId };

    const records = await prisma.franchiseRoyaltyRecord.findMany({
      where: whereClause,
      include: {
        franchise: { select: { id: true, name: true, code: true, ownerName: true } },
        institute: { select: { id: true, name: true, code: true } },
        payments: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return res.json({
      success: true,
      data: { records, royaltyRecords: records, total: records.length },
    });
  } catch (err: any) {
    console.error('[List Royalty Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list royalty records' });
  }
}

export async function recordRoyaltyPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: franchiseId } = req.params;
    const { royaltyRecordId, amountPaid, paymentMethod, transactionReference, remarks, paymentDate } = req.body;

    if (!amountPaid || Number(amountPaid) <= 0 || isNaN(Number(amountPaid))) {
      return res.status(400).json({ success: false, error: 'Amount paid must be a valid number greater than zero' });
    }

    const franchise = await prisma.franchise.findUnique({ where: { id: franchiseId } });
    if (!franchise) {
      return res.status(404).json({ success: false, error: 'Franchise not found' });
    }
    if (franchise.status === 'TERMINATED') {
      return res.status(400).json({ success: false, error: 'Cannot record royalty payments for a terminated franchise' });
    }

    if (transactionReference && transactionReference.trim()) {
      const existingPayment = await prisma.franchiseRoyaltyPayment.findFirst({
        where: { franchiseId, transactionReference: transactionReference.trim() },
      });
      if (existingPayment) {
        return res.status(409).json({
          success: false,
          error: `Payment with transaction reference "${transactionReference.trim()}" has already been recorded for this franchise.`,
          data: { payment: existingPayment },
        });
      }
    }

    const receiptNumber = await generateRoyaltyReceiptNumber();
    const paidAmount = Number(amountPaid);

    const payment = await prisma.franchiseRoyaltyPayment.create({
      data: {
        franchiseId,
        royaltyRecordId: royaltyRecordId || null,
        receiptNumber,
        amountPaid: new Prisma.Decimal(paidAmount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(paymentMethod)
          ? paymentMethod
          : 'BANK_TRANSFER',
        transactionReference: transactionReference?.trim() || null,
        remarks: remarks || null,
        recordedById: req.user!.userId,
      },
    });

    if (royaltyRecordId) {
      const record = await prisma.franchiseRoyaltyRecord.findUnique({
        where: { id: royaltyRecordId },
      });

      if (record) {
        if (record.franchiseId !== franchiseId) {
          return res.status(400).json({ success: false, error: 'Royalty record does not belong to this franchise' });
        }
        const newPaid = Number(record.royaltyPaid) + paidAmount;
        const newOutstanding = Math.max(0, Number(record.royaltyPayable) - newPaid);
        const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await prisma.franchiseRoyaltyRecord.update({
          where: { id: royaltyRecordId },
          data: {
            royaltyPaid: new Prisma.Decimal(newPaid),
            outstandingBalance: new Prisma.Decimal(newOutstanding),
            status: newStatus as any,
          },
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Royalty payment recorded successfully',
      data: { payment },
    });
  } catch (err: any) {
    console.error('[Record Royalty Payment Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to record royalty payment' });
  }
}

// ============================================================================
// 6. DASHBOARDS (SUPER ADMIN & FRANCHISE OWNER)
// ============================================================================

export async function getSuperAdminFranchiseDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    const fetchDashboard = async () => {
      const [
        totalFranchises,
        activeFranchises,
        suspendedFranchises,
        totalBranches,
        totalStudents,
        installmentAgg,
        recentPayments,
        activeAgreements,
        allInstallments,
      ] = await prisma.$transaction([
        prisma.franchise.count(),
        prisma.franchise.count({ where: { status: 'ACTIVE' } }),
        prisma.franchise.count({ where: { status: 'SUSPENDED' } }),
        prisma.institute.count({ where: { franchiseId: { not: null } } }),
        prisma.student.count({ where: { status: 'ACTIVE' } }),
        prisma.franchiseRoyaltyInstallment.aggregate({
          _sum: {
            amount: true,
            paidAmount: true,
            outstandingBalance: true,
          },
        }),
        prisma.franchiseRoyaltyPayment.findMany({
          take: 6,
          orderBy: { paymentDate: 'desc' },
          include: {
            franchise: { select: { name: true, code: true } },
            installment: { select: { installmentNumber: true, periodLabel: true } },
          },
        }),
        prisma.franchiseAgreement.findMany({
          where: { status: 'ACTIVE' },
          include: { franchise: { select: { name: true, code: true } } },
          orderBy: { endDate: 'asc' },
          take: 10,
        }),
        prisma.franchiseRoyaltyInstallment.findMany({
          include: {
            franchise: { select: { name: true, code: true } },
            agreement: { select: { agreementNumber: true, title: true } },
          },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

      const now = new Date();
      const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      const upcomingRenewals = activeAgreements.filter(
        (a) => new Date(a.endDate) <= in60Days && new Date(a.endDate) >= now
      );

      // Compute overdue & due installment metrics
      const overdueInstallments = allInstallments
        .filter((i) => computeInstallmentLiveStatus(i) === 'OVERDUE')
        .map((i) => ({ ...i, liveStatus: 'OVERDUE' }));

      const dueInstallments = allInstallments
        .filter((i) => computeInstallmentLiveStatus(i) === 'DUE')
        .map((i) => ({ ...i, liveStatus: 'DUE' }));

      const totalOverdueAmount = overdueInstallments.reduce((sum, i) => sum + Number(i.outstandingBalance), 0);

      return {
        summary: {
          totalFranchises,
          activeFranchises,
          suspendedFranchises,
          totalBranches,
          totalStudents,
          totalRoyaltyObligations: Number(installmentAgg._sum.amount || 0),
          totalRoyaltyReceived: Number(installmentAgg._sum.paidAmount || 0),
          outstandingRoyalty: Number(installmentAgg._sum.outstandingBalance || 0),
          overdueRoyalty: totalOverdueAmount,
          overdueInstallmentsCount: overdueInstallments.length,
          dueInstallmentsCount: dueInstallments.length,
        },
        upcomingRenewals,
        overdueInstallments,
        dueInstallments,
        recentPayments,
      };
    };

    let data;
    try {
      data = await fetchDashboard();
    } catch (transientErr) {
      console.warn('[Dashboard Warning] Reconnecting to Neon...');
      await prisma.$disconnect().catch(() => { });
      await prisma.$connect().catch(() => { });
      data = await fetchDashboard();
    }

    return res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error('[Super Admin Franchise Dashboard Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to load Super Admin Franchise Dashboard' });
  }
}

export async function getFranchiseOwnerDashboard(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Support Super Admin inspecting a franchise, or Franchise Owner inspecting their own franchise
    let franchiseWhere: any = { ownerUserId: userId };
    if (userRole === 'SUPER_ADMIN' && req.query.franchiseId) {
      franchiseWhere = { id: req.query.franchiseId as string };
    }

    const franchise = await prisma.franchise.findFirst({
      where: franchiseWhere,
      include: {
        branches: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true,
            address: true,
            phone: true,
            email: true,
            status: true,
            _count: { select: { students: true, batches: true, staffProfiles: true } },
          },
          orderBy: { name: 'asc' },
        },
        agreements: {
          orderBy: { createdAt: 'desc' },
          include: {
            installments: {
              orderBy: { installmentNumber: 'asc' },
            },
          },
        },
        installments: {
          orderBy: { dueDate: 'asc' },
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
        royaltyPayments: {
          orderBy: { paymentDate: 'desc' },
          take: 6,
        },
        royaltyRecords: {
          orderBy: { startDate: 'desc' },
          take: 24,
          include: {
            institute: { select: { id: true, name: true, code: true } },
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
      },
    });

    if (!franchise) {
      return res.status(404).json({
        success: false,
        error: 'No franchise associated with your user account',
      });
    }

    // Branch scoping: check query param or header
    const rawBranchId = (req.query.branchId as string) || (req.headers['x-institute-id'] as string) || undefined;
    const allBranchIds = franchise.branches.map((b) => b.id);

    let targetBranchIds: string[] = allBranchIds;
    let selectedBranch: any = null;
    let isConsolidated = true;

    if (rawBranchId && rawBranchId !== 'ALL' && rawBranchId !== 'all') {
      const matched = franchise.branches.find((b) => b.id === rawBranchId);
      if (!matched) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have authorization to access this campus branch',
          timestamp: new Date().toISOString(),
        });
      }
      targetBranchIds = [rawBranchId];
      selectedBranch = matched;
      isConsolidated = false;
    }

    // 1. Student Count
    const totalStudents = await prisma.student.count({
      where: { instituteId: { in: targetBranchIds }, status: 'ACTIVE' },
    });

      // 2. Staff Count
      const totalStaff = await prisma.staffProfile.count({
        where: { instituteId: { in: targetBranchIds }, user: { isActive: true } },
      });

      // 3. Batches Count
      const activeBatches = await prisma.batch.count({
        where: { instituteId: { in: targetBranchIds }, isActive: true },
      });

      // 4. Today's Student Attendance
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayPresent = await prisma.attendanceEvent.count({
        where: {
          instituteId: { in: targetBranchIds },
          eventDate: { gte: todayStart, lte: todayEnd },
          eventType: 'CHECK_IN',
        },
      });

      const todayLate = await prisma.attendanceEvent.count({
        where: {
          instituteId: { in: targetBranchIds },
          eventDate: { gte: todayStart, lte: todayEnd },
          eventType: 'CHECK_IN',
          isLate: true,
        },
      });

      const todayAbsent = Math.max(0, totalStudents - todayPresent);
      const todayTotalMarked = totalStudents > 0 ? totalStudents : todayPresent;
      const attendanceRate = todayTotalMarked > 0 ? Number(((todayPresent / todayTotalMarked) * 100).toFixed(1)) : 100.0;

      // 5. Monthly & Total Fee Collections
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyPaymentAgg = await prisma.payment.aggregate({
        where: {
          instituteId: { in: targetBranchIds },
          status: 'SUCCESS',
          paidAt: { gte: startOfMonth },
        },
        _sum: { amountPaid: true },
      });
      const monthlyFeeCollection = Number(monthlyPaymentAgg._sum?.amountPaid || 0);

      const totalPaymentAgg = await prisma.payment.aggregate({
        where: {
          instituteId: { in: targetBranchIds },
          status: 'SUCCESS',
        },
        _sum: { amountPaid: true },
      });
      const totalRevenue = Number(totalPaymentAgg._sum?.amountPaid || 0);

      // 6. Pending Fees
      const pendingAssignments = await prisma.studentFeeAssignment.findMany({
        where: {
          student: { instituteId: { in: targetBranchIds } },
          status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        include: {
          payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } },
        },
      });
      let pendingFees = 0;
      for(const a of pendingAssignments) {
        const paidSum = a.payments.reduce((acc, p) => acc + Number(p.amountPaid), 0);
        pendingFees += Math.max(0, Number(a.finalAmount) - paidSum);
      }

    // 7. Upcoming Examinations
    const upcomingExamsList = await prisma.examination.findMany({
        where: {
          instituteId: { in: targetBranchIds },
          examDate: { gte: todayStart },
        },
        include: {
          subject: { select: { name: true, code: true } },
          institute: { select: { id: true, name: true, code: true } },
        },
        orderBy: { examDate: 'asc' },
        take: 5,
      });
      const upcomingExamsCount = await prisma.examination.count({
        where: {
          instituteId: { in: targetBranchIds },
          examDate: { gte: todayStart },
        },
      });

      // 8. Homework & Learning Activity
      const homeworkCount = await prisma.learningMaterial.count({
        where: { instituteId: { in: targetBranchIds }, type: 'HOMEWORK' },
      });
      const materialsCount = await prisma.learningMaterial.count({
        where: { instituteId: { in: targetBranchIds }, type: { not: 'HOMEWORK' } },
      });

      // 9. Branch Performance Cards (Individual Branch Statistics for Comparison)
      const branchCards = await Promise.all(
        franchise.branches.map(async (b) => {
          const bStudents = await prisma.student.count({
            where: { instituteId: b.id, status: 'ACTIVE' },
          });
          const bStaff = await prisma.staffProfile.count({
            where: { instituteId: b.id, user: { isActive: true } },
          });
          const bBatches = await prisma.batch.count({
            where: { instituteId: b.id, isActive: true },
          });
          const bPayment = await prisma.payment.aggregate({
            where: { instituteId: b.id, status: 'SUCCESS' },
            _sum: { amountPaid: true },
          });
          const bMonthly = await prisma.payment.aggregate({
            where: { instituteId: b.id, status: 'SUCCESS', paidAt: { gte: startOfMonth } },
            _sum: { amountPaid: true },
          });
          const bPresent = await prisma.attendanceEvent.count({
            where: {
              instituteId: b.id,
              eventDate: { gte: todayStart, lte: todayEnd },
              eventType: 'CHECK_IN',
            },
          });
          const bAbsent = Math.max(0, bStudents - bPresent);
          const bTotalMarked = bStudents > 0 ? bStudents : bPresent;
          const bRate = bTotalMarked > 0 ? Number(((bPresent / bTotalMarked) * 100).toFixed(1)) : 100.0;

          const bAssignments = await prisma.studentFeeAssignment.findMany({
            where: {
              student: { instituteId: b.id },
              status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
            },
            include: { payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } } },
          });
          let bPending = 0;
          for (const a of bAssignments) {
            const pSum = a.payments.reduce((acc, p) => acc + Number(p.amountPaid), 0);
            bPending += Math.max(0, Number(a.finalAmount) - pSum);
          }

          return {
            id: b.id,
            code: b.code,
            name: b.name,
            city: b.city,
            state: b.state,
            address: b.address,
            phone: b.phone,
            email: b.email,
            status: b.status,
            activeStudents: bStudents,
            staffCount: bStaff,
            activeBatches: bBatches,
            totalRevenue: Number(bPayment._sum?.amountPaid || 0),
            monthlyRevenue: Number(bMonthly._sum?.amountPaid || 0),
            pendingFees: bPending,
            attendanceRate: bRate,
            todayAttendance: {
              present: bPresent,
              absent: bAbsent,
              totalMarked: bTotalMarked,
              rate: bRate,
            },
          };
        })
      );

      // 10. Franchise Agreement & Two-Installment Schedule
      const activeAgreement = franchise.agreements.find((a) => a.status === 'ACTIVE');
      const installmentsWithStatus = franchise.installments.map((inst) => ({
        ...inst,
        liveStatus: computeInstallmentLiveStatus(inst),
      }));

      const totalObligations = installmentsWithStatus.reduce((sum, i) => sum + Number(i.amount), 0);
      const totalPaid = installmentsWithStatus.reduce((sum, i) => sum + Number(i.paidAmount), 0);
      const totalOutstanding = installmentsWithStatus.reduce((sum, i) => sum + Number(i.outstandingBalance), 0);
      const totalOverdue = installmentsWithStatus
        .filter((i) => i.liveStatus === 'OVERDUE')
        .reduce((sum, i) => sum + Number(i.outstandingBalance), 0);

      return res.json({
        success: true,
        data: {
          franchise: {
            id: franchise.id,
            code: franchise.code,
            name: franchise.name,
            ownerName: franchise.ownerName,
            email: franchise.email,
            phone: franchise.phone,
            address: franchise.address,
            city: franchise.city,
            state: franchise.state,
            postalCode: franchise.postalCode,
            country: franchise.country,
            authorizedContact: franchise.authorizedContact,
            status: franchise.status,
          },
          selectedBranch,
          isConsolidated,
          activeAgreement,
          agreements: franchise.agreements,
          installments: installmentsWithStatus,
          metrics: {
            totalBranches: franchise.branches.length,
            activeBranchesCount: franchise.branches.filter((b) => b.status === 'ACTIVE').length,
            totalStudents,
            totalStaff,
            activeBatches,
            todayAttendance: {
              present: todayPresent,
              absent: todayAbsent,
              late: todayLate,
              totalMarked: todayTotalMarked,
              rate: attendanceRate,
            },
            monthlyFeeCollection,
            totalRevenue,
            pendingFees,
            upcomingExamsCount,
            homeworkCount,
            materialsCount,
            annualRoyaltyAmount: activeAgreement?.annualRoyaltyAmount
              ? Number(activeAgreement.annualRoyaltyAmount)
              : totalObligations,
            calculationMethod: activeAgreement?.calculationMethod || 'FIXED_ANNUAL',
            totalRoyaltyObligations: totalObligations,
            totalRoyaltyPaid: totalPaid,
            outstandingRoyalty: totalOutstanding,
            overdueRoyalty: totalOverdue,
          },
          upcomingExaminations: upcomingExamsList,
          branches: franchise.branches,
          branchCards,
          recentPayments: franchise.royaltyPayments,
          royaltyRecords: franchise.royaltyRecords || [],
        },
      });
    } catch (err: any) {
      console.error('[Franchise Owner Dashboard Error]', err);
      return res.status(500).json({ success: false, error: 'Failed to load Franchisee Admin Dashboard' });
    }
  }
