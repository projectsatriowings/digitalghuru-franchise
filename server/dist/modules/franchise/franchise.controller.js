"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBeneficiaryAccountSchema = exports.updateRevenueShareSchema = exports.checkFranchiseDuplicatesSchema = void 0;
exports.verifyFranchiseAccess = verifyFranchiseAccess;
exports.computeInstallmentLiveStatus = computeInstallmentLiveStatus;
exports.computeSafeDueDates = computeSafeDueDates;
exports.generateAnnualInstallments = generateAnnualInstallments;
exports.checkFranchiseDuplicates = checkFranchiseDuplicates;
exports.createFranchise = createFranchise;
exports.listFranchises = listFranchises;
exports.getFranchiseById = getFranchiseById;
exports.updateFranchise = updateFranchise;
exports.updateFranchiseStatus = updateFranchiseStatus;
exports.resetFranchiseOwnerPassword = resetFranchiseOwnerPassword;
exports.addBranchToFranchise = addBranchToFranchise;
exports.listFranchiseBranches = listFranchiseBranches;
exports.removeBranchFromFranchise = removeBranchFromFranchise;
exports.getMyAssignedBranches = getMyAssignedBranches;
exports.getUnassignedBranches = getUnassignedBranches;
exports.getAgreementTemplates = getAgreementTemplates;
exports.createAgreement = createAgreement;
exports.reviseAgreement = reviseAgreement;
exports.renewAgreement = renewAgreement;
exports.listAgreements = listAgreements;
exports.updateAgreementStatus = updateAgreementStatus;
exports.addAgreementAmendment = addAgreementAmendment;
exports.getAgreementPdfData = getAgreementPdfData;
exports.listFranchiseInstallments = listFranchiseInstallments;
exports.listAgreementInstallments = listAgreementInstallments;
exports.recordInstallmentPayment = recordInstallmentPayment;
exports.getRoyaltyPaymentReceipt = getRoyaltyPaymentReceipt;
exports.calculateRoyalty = calculateRoyalty;
exports.listRoyaltyRecords = listRoyaltyRecords;
exports.recordRoyaltyPayment = recordRoyaltyPayment;
exports.getSuperAdminFranchiseDashboard = getSuperAdminFranchiseDashboard;
exports.getFranchiseOwnerDashboard = getFranchiseOwnerDashboard;
exports.updateRevenueShare = updateRevenueShare;
exports.updateBeneficiaryAccount = updateBeneficiaryAccount;
exports.getFranchiseRevenueDashboard = getFranchiseRevenueDashboard;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const security_js_1 = require("../../utils/security.js");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const cache_js_1 = require("../../utils/cache.js");
// ============================================================================
// HELPER: TENANT ISOLATION CHECK
// ============================================================================
async function verifyFranchiseAccess(userId, userRole, franchiseId) {
    const franchise = await prisma_js_1.prisma.franchise.findUnique({
        where: { id: franchiseId },
        include: {
            branches: {
                include: {
                    _count: {
                        select: { students: true },
                    },
                },
            },
            agreements: { orderBy: { createdAt: 'desc' } },
            ownerUser: {
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    mustChangePassword: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
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
async function generateFranchiseCode() {
    const count = await prisma_js_1.prisma.franchise.count();
    const nextNum = 1001 + count;
    let code = `DG-FR-${nextNum}`;
    let exists = await prisma_js_1.prisma.franchise.findUnique({ where: { code } });
    let offset = 1;
    while (exists) {
        code = `DG-FR-${nextNum + offset}`;
        exists = await prisma_js_1.prisma.franchise.findUnique({ where: { code } });
        offset++;
    }
    return code;
}
// Generate unique sequential Receipt Number: ROY-REC-2026-0001
async function generateRoyaltyReceiptNumber(dbClient = prisma_js_1.prisma) {
    const year = new Date().getFullYear();
    const count = await dbClient.franchiseRoyaltyPayment.count();
    const nextSerial = String(count + 1).padStart(4, '0');
    let receipt = `ROY-REC-${year}-${nextSerial}`;
    let exists = await dbClient.franchiseRoyaltyPayment.findUnique({ where: { receiptNumber: receipt } });
    let offset = 1;
    while (exists) {
        receipt = `ROY-REC-${year}-${String(count + 1 + offset).padStart(4, '0')}`;
        exists = await dbClient.franchiseRoyaltyPayment.findUnique({ where: { receiptNumber: receipt } });
        offset++;
    }
    return receipt;
}
// Generate unique sequential Agreement Number: AGR-2026-001
async function generateUniqueAgreementNumber(year) {
    const count = await prisma_js_1.prisma.franchiseAgreement.count();
    let candidate = `AGR-${year}-${String(count + 1).padStart(3, '0')}`;
    let exists = await prisma_js_1.prisma.franchiseAgreement.findUnique({ where: { agreementNumber: candidate } });
    let offset = 1;
    while (exists) {
        candidate = `AGR-${year}-${String(count + 1 + offset).padStart(3, '0')}`;
        exists = await prisma_js_1.prisma.franchiseAgreement.findUnique({ where: { agreementNumber: candidate } });
        offset++;
    }
    return candidate;
}
// Evaluate live installment status based on clear rules
function computeInstallmentLiveStatus(inst) {
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
function computeSafeDueDates(startDate, endDate, midPoint, dueDay = 10, explicitDue1, explicitDue2) {
    let due1;
    let due2;
    if (explicitDue1) {
        due1 = new Date(explicitDue1);
    }
    else {
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
    }
    else {
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
async function generateAnnualInstallments(params) {
    const db = params.prismaClient || prisma_js_1.prisma;
    const { franchiseId, agreementId, startDate, endDate, calculationMethod, annualRoyaltyAmount, royaltyPercentage, royaltyBasis, perStudentFee, dueDay, installment1DueDate, installment2DueDate, } = params;
    const durationMs = endDate.getTime() - startDate.getTime();
    const midPoint = new Date(startDate.getTime() + durationMs / 2);
    let inst1Amount = 0;
    let inst2Amount = 0;
    let breakdown1 = {};
    let breakdown2 = {};
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
    }
    else if (calculationMethod === 'PER_STUDENT') {
        const feePerStudent = Number(perStudentFee || 0);
        const franchiseBranches = await db.institute.findMany({
            where: { franchiseId },
            select: { id: true },
        });
        const branchIds = franchiseBranches.map((b) => b.id);
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
    }
    else {
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
    const { due1, due2 } = computeSafeDueDates(startDate, endDate, midPoint, dueDay || 10, installment1DueDate, installment2DueDate);
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
            amount: new client_1.Prisma.Decimal(inst1Amount),
            paidAmount: new client_1.Prisma.Decimal(0.0),
            outstandingBalance: new client_1.Prisma.Decimal(inst1Amount),
            status: status1,
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
            amount: new client_1.Prisma.Decimal(inst2Amount),
            paidAmount: new client_1.Prisma.Decimal(0.0),
            outstandingBalance: new client_1.Prisma.Decimal(inst2Amount),
            status: status2,
            calculationBasis: calculationMethod,
            calculationBreakdown: breakdown2,
        },
    });
    return [inst1, inst2];
}
// ============================================================================
// 1. FRANCHISE CREATION & ACCOUNT SETUP
// ============================================================================
const createFranchiseSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Franchise/business name is required'),
    ownerName: zod_1.z.string().min(2, "Owner's full name is required"),
    email: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().email('Valid email is required')),
    phone: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().min(7, 'Primary mobile number is required')),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
    address: zod_1.z.string().optional().default('Main Campus Address'),
    city: zod_1.z.string().optional().default('Chennai'),
    state: zod_1.z.string().optional().default('Tamil Nadu'),
    postalCode: zod_1.z.string().optional().default('600001'),
    country: zod_1.z.string().default('India'),
    authorizedContact: zod_1.z.object({
        name: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        designation: zod_1.z.string().optional(),
    }).optional(),
    code: zod_1.z.string().optional(),
    businessDetails: zod_1.z.record(zod_1.z.any()).optional(),
    notes: zod_1.z.string().optional(),
    initialAgreement: zod_1.z.object({
        title: zod_1.z.string().default('Annual Master Franchise Agreement'),
        startDate: zod_1.z.string(),
        endDate: zod_1.z.string(),
        agreementType: zod_1.z.string().optional(),
        calculationMethod: zod_1.z.enum(['FIXED_ANNUAL', 'PERCENTAGE_REVENUE', 'PER_STUDENT']).default('FIXED_ANNUAL'),
        annualRoyaltyAmount: zod_1.z.number().min(0).optional(),
        royaltyPercentage: zod_1.z.number().min(0).max(100).default(50.0),
        digitalGuruRevenuePercentage: zod_1.z.number().min(0).max(100).optional(),
        partnerRevenuePercentage: zod_1.z.number().min(0).max(100).optional(),
        revenueCalculationBasis: zod_1.z.string().optional(),
        settlementFrequency: zod_1.z.string().optional(),
        totalInvestment: zod_1.z.number().min(0).optional(),
        digitalGuruInvestmentAmount: zod_1.z.number().min(0).optional(),
        partnerInvestmentAmount: zod_1.z.number().min(0).optional(),
        digitalGuruInvestmentPercentage: zod_1.z.number().min(0).max(100).optional(),
        partnerInvestmentPercentage: zod_1.z.number().min(0).max(100).optional(),
        operationalSetupContribution: zod_1.z.number().min(0).optional(),
        investmentNotes: zod_1.z.string().optional(),
        expenseResponsibilities: zod_1.z.record(zod_1.z.any()).optional(),
        marketingResponsibleParty: zod_1.z.string().optional(),
        marketingSupportDurationMonths: zod_1.z.number().int().min(0).optional(),
        marketingPostSupportParty: zod_1.z.string().optional(),
        marketingBudget: zod_1.z.number().min(0).optional(),
        marketingEffectiveStartDate: zod_1.z.string().optional(),
        marketingNotes: zod_1.z.string().optional(),
        courseSoftwareAccessEnabled: zod_1.z.boolean().optional(),
        courseSoftwarePricingNotes: zod_1.z.string().optional(),
        royaltyBasis: zod_1.z.enum(['TOTAL_COLLECTIONS', 'TUITION_FEES_ONLY', 'NET_REVENUE']).default('TOTAL_COLLECTIONS'),
        paymentFrequency: zod_1.z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).default('ANNUAL').optional(),
        perStudentFee: zod_1.z.number().min(0).optional(),
        dueDay: zod_1.z.number().int().min(1).max(31).default(10),
        installment1DueDate: zod_1.z.string().optional(),
        installment2DueDate: zod_1.z.string().optional(),
        terms: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }).optional(),
    branchOption: zod_1.z.enum(['NONE', 'LINK_EXISTING', 'CREATE_NEW']).optional().default('NONE'),
    linkedInstituteIds: zod_1.z.array(zod_1.z.string()).optional(),
    linkedInstituteId: zod_1.z.string().optional(),
    newBranch: zod_1.z.object({
        name: zod_1.z.string().min(2, 'Branch name is required'),
        code: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
    }).optional(),
});
exports.checkFranchiseDuplicatesSchema = zod_1.z.object({
    email: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().email('Invalid email address').optional().nullable().or(zod_1.z.literal(''))),
    phone: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().optional().nullable().or(zod_1.z.literal(''))),
    code: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
    name: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
});
/**
 * Pre-validate availability of franchise email, owner phone, and franchise code
 */
async function checkFranchiseDuplicates(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can check duplicates' });
        }
        const parse = exports.checkFranchiseDuplicatesSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid parameters' });
        }
        const { email, phone, code, name } = parse.data;
        let emailConflict = { isDuplicate: false };
        const normEmail = email && email.trim() ? email.trim().toLowerCase() : '';
        if (normEmail) {
            const franchiseMatch = await prisma_js_1.prisma.franchise.findFirst({
                where: { email: { equals: normEmail, mode: 'insensitive' } },
                select: { id: true, code: true, name: true },
            });
            if (franchiseMatch) {
                emailConflict = {
                    isDuplicate: true,
                    model: 'Franchise',
                    message: `A franchise with email '${normEmail}' already exists (${franchiseMatch.name} [${franchiseMatch.code}]).`,
                    canReuseAsOwner: false,
                };
            }
            else {
                const userMatch = await prisma_js_1.prisma.user.findFirst({
                    where: { email: { equals: normEmail, mode: 'insensitive' } },
                    select: { id: true, email: true, role: true },
                });
                if (userMatch) {
                    emailConflict = {
                        isDuplicate: true,
                        model: 'User',
                        message: `An existing user account was found with email '${normEmail}'. This account will be designated as the Franchise Owner.`,
                        canReuseAsOwner: true,
                    };
                }
            }
        }
        let phoneConflict = { isDuplicate: false };
        if (phone && phone.trim()) {
            const cleanPhone = phone.trim();
            const userPhoneMatch = await prisma_js_1.prisma.user.findFirst({
                where: { phone: cleanPhone },
                select: { id: true, email: true, role: true },
            });
            if (userPhoneMatch) {
                const isSameUser = normEmail && userPhoneMatch.email?.toLowerCase() === normEmail;
                if (!isSameUser) {
                    phoneConflict = {
                        isDuplicate: true,
                        model: 'User',
                        message: `A user account with phone '${cleanPhone}' already exists. Please provide a unique phone number.`,
                    };
                }
            }
        }
        let codeConflict = { isDuplicate: false };
        if (code && code.trim()) {
            const cleanCode = code.trim().toUpperCase();
            const codeMatch = await prisma_js_1.prisma.franchise.findUnique({
                where: { code: cleanCode },
                select: { id: true, name: true },
            });
            if (codeMatch) {
                codeConflict = {
                    isDuplicate: true,
                    message: `A franchise with code '${cleanCode}' already exists (${codeMatch.name}).`,
                };
            }
        }
        const hasBlockingConflict = Boolean((emailConflict.isDuplicate && emailConflict.model === 'Franchise') ||
            codeConflict.isDuplicate ||
            phoneConflict.isDuplicate);
        if (req.query.strict === 'true' && hasBlockingConflict) {
            return res.status(409).json({
                success: false,
                error: emailConflict.model === 'Franchise' ? emailConflict.message : (codeConflict.message || phoneConflict.message || 'Duplicate detected'),
                data: {
                    email: emailConflict,
                    phone: phoneConflict,
                    code: codeConflict,
                },
            });
        }
        return res.status(200).json({
            success: true,
            data: {
                email: emailConflict,
                phone: phoneConflict,
                code: codeConflict,
            },
        });
    }
    catch (err) {
        console.error('[checkFranchiseDuplicates error]', err);
        return res.status(500).json({ success: false, error: 'Failed to check duplicates' });
    }
}
async function createFranchise(req, res) {
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
        const normalizedEmail = data.email.trim().toLowerCase();
        const cleanPhone = data.phone.trim();
        // Check if franchise email already exists (case-insensitive)
        const existingFranchise = await prisma_js_1.prisma.franchise.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existingFranchise) {
            return res.status(409).json({
                success: false,
                error: `Franchise contact email is already registered to ${existingFranchise.name} (${existingFranchise.code}). Please provide a unique email address.`,
            });
        }
        // Check if manually supplied franchise code already exists
        if (data.code && data.code.trim()) {
            const existingCode = await prisma_js_1.prisma.franchise.findUnique({
                where: { code: data.code.trim().toUpperCase() },
            });
            if (existingCode) {
                return res.status(409).json({
                    success: false,
                    error: `Franchise code '${data.code.trim().toUpperCase()}' already exists. Please provide a unique franchise code.`,
                });
            }
        }
        // Check if phone number is already registered to a different user
        const existingUserPhone = await prisma_js_1.prisma.user.findFirst({
            where: { phone: cleanPhone },
        });
        const existingUserEmail = await prisma_js_1.prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (existingUserPhone && (!existingUserEmail || existingUserPhone.id !== existingUserEmail.id)) {
            return res.status(409).json({
                success: false,
                error: `Phone number '${cleanPhone}' already belongs to another franchise or user account. Please provide a unique phone number.`,
            });
        }
        // Pre-validate initialAgreement parameters before creating any records
        const agreementStartDate = data.initialAgreement?.startDate
            ? new Date(data.initialAgreement.startDate)
            : new Date();
        const agreementEndDate = data.initialAgreement?.endDate
            ? new Date(data.initialAgreement.endDate)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        if (isNaN(agreementStartDate.getTime()) || isNaN(agreementEndDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid initialAgreement startDate or endDate format' });
        }
        if (agreementStartDate > agreementEndDate) {
            return res.status(400).json({ success: false, error: 'initialAgreement startDate must be before or equal to endDate' });
        }
        const calculationMethod = data.initialAgreement?.calculationMethod || 'FIXED_ANNUAL';
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
                    error: `Revenue sharing percentages must total 100% (currently Digital Ghuru: ${dgPct}%, Partner: ${partnerPct}%)`,
                });
            }
        }
        const code = data.code ? data.code.trim().toUpperCase() : await generateFranchiseCode();
        // 1. Franchise Owner User Account & Permanent Password Handling (at least 16 bytes entropy)
        const permanentPassword = data.password || (0, security_js_1.generatePermanentPassword)(16);
        const passwordHash = await (0, security_js_1.hashPassword)(permanentPassword);
        const year = agreementStartDate.getFullYear();
        const agreementNumber = await generateUniqueAgreementNumber(year);
        const annualRoyaltyAmount = data.initialAgreement?.annualRoyaltyAmount !== undefined
            ? new client_1.Prisma.Decimal(data.initialAgreement.annualRoyaltyAmount)
            : new client_1.Prisma.Decimal(200000);
        const royaltyPercentage = new client_1.Prisma.Decimal(data.initialAgreement?.royaltyPercentage ?? 50.0);
        const royaltyBasis = data.initialAgreement?.royaltyBasis || 'TOTAL_COLLECTIONS';
        const perStudentFee = data.initialAgreement?.perStudentFee !== undefined
            ? new client_1.Prisma.Decimal(data.initialAgreement.perStudentFee)
            : null;
        const dueDay = data.initialAgreement?.dueDay || 10;
        const isMonthly = data.initialAgreement?.settlementFrequency === 'MONTHLY';
        const installmentCount = isMonthly ? 0 : 2;
        // Execute entire creation atomically inside a single transaction with extended timeout for Neon cloud PostgreSQL WAN latency
        const txResult = await prisma_js_1.prisma.$transaction(async (tx) => {
            // Find existing user or create owner user
            let ownerUser = await tx.user.findFirst({
                where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
            });
            if (!ownerUser) {
                ownerUser = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        phone: cleanPhone,
                        fullName: data.ownerName.trim(),
                        passwordHash,
                        role: 'FRANCHISE_OWNER',
                        isActive: true,
                        mustChangePassword: false, // Permanent Franchise Owner credentials: no forced first-login change
                    },
                });
            }
            else {
                // Promote/activate existing user as franchise owner with permanent credentials
                ownerUser = await tx.user.update({
                    where: { id: ownerUser.id },
                    data: {
                        role: 'FRANCHISE_OWNER',
                        isActive: true,
                        passwordHash,
                        mustChangePassword: false,
                        ...(!ownerUser.phone ? { phone: cleanPhone } : {}),
                    },
                });
            }
            // 2. Create Franchise Record with complete address and contact details
            const franchise = await tx.franchise.create({
                data: {
                    code,
                    name: data.name.trim(),
                    ownerName: data.ownerName.trim(),
                    email: normalizedEmail,
                    phone: cleanPhone,
                    address: data.address?.trim() || null,
                    city: data.city?.trim() || null,
                    state: data.state?.trim() || null,
                    postalCode: data.postalCode?.trim() || null,
                    country: data.country || 'India',
                    authorizedContact: data.authorizedContact || {},
                    businessDetails: {
                        ...(typeof data.businessDetails === 'object' && data.businessDetails !== null ? data.businessDetails : {}),
                        initialPassword: permanentPassword,
                    },
                    status: 'ACTIVE',
                    ownerUserId: ownerUser.id,
                    notes: data.notes || null,
                    revenueSharePercentage: new client_1.Prisma.Decimal(partnerPct),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(dgPct),
                },
                include: {
                    ownerUser: { select: { id: true, email: true, fullName: true, phone: true } },
                },
            });
            // 3. Create Annual Franchise Agreement (or default if omitted)
            const agreement = await tx.franchiseAgreement.create({
                data: {
                    franchiseId: franchise.id,
                    agreementNumber,
                    title: data.initialAgreement?.title || 'Annual Master Franchise Agreement',
                    startDate: agreementStartDate,
                    endDate: agreementEndDate,
                    agreementType: data.initialAgreement?.agreementType || 'CUSTOM_AGREEMENT',
                    annualRoyaltyAmount,
                    calculationMethod,
                    perStudentFee,
                    royaltyPercentage,
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(dgPct),
                    partnerRevenuePercentage: new client_1.Prisma.Decimal(partnerPct),
                    revenueCalculationBasis: data.initialAgreement?.revenueCalculationBasis || 'GROSS_COURSE_FEES',
                    settlementFrequency: data.initialAgreement?.settlementFrequency || (isMonthly ? 'MONTHLY' : 'YEARLY'),
                    totalInvestment: data.initialAgreement?.totalInvestment !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.totalInvestment) : null,
                    digitalGuruInvestmentAmount: data.initialAgreement?.digitalGuruInvestmentAmount !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.digitalGuruInvestmentAmount) : null,
                    partnerInvestmentAmount: data.initialAgreement?.partnerInvestmentAmount !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.partnerInvestmentAmount) : null,
                    digitalGuruInvestmentPercentage: data.initialAgreement?.digitalGuruInvestmentPercentage !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.digitalGuruInvestmentPercentage) : null,
                    partnerInvestmentPercentage: data.initialAgreement?.partnerInvestmentPercentage !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.partnerInvestmentPercentage) : null,
                    operationalSetupContribution: data.initialAgreement?.operationalSetupContribution !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.operationalSetupContribution) : null,
                    investmentNotes: data.initialAgreement?.investmentNotes || null,
                    expenseResponsibilities: data.initialAgreement?.expenseResponsibilities ?? client_1.Prisma.DbNull,
                    marketingResponsibleParty: data.initialAgreement?.marketingResponsibleParty || 'DIGITAL_GURU',
                    marketingSupportDurationMonths: data.initialAgreement?.marketingSupportDurationMonths !== undefined ? Number(data.initialAgreement.marketingSupportDurationMonths) : 3,
                    marketingPostSupportParty: data.initialAgreement?.marketingPostSupportParty || 'PARTNER',
                    marketingBudget: data.initialAgreement?.marketingBudget !== undefined ? new client_1.Prisma.Decimal(data.initialAgreement.marketingBudget) : null,
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
            let installments = [];
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
                    prismaClient: tx,
                });
            }
            // 4.5. Optional Institute / Campus Linking or Creation
            let attachedBranches = [];
            if (data.branchOption === 'LINK_EXISTING' || (data.linkedInstituteIds && data.linkedInstituteIds.length > 0) || data.linkedInstituteId) {
                const instituteIds = data.linkedInstituteIds || (data.linkedInstituteId ? [data.linkedInstituteId] : []);
                if (instituteIds.length > 0) {
                    await tx.institute.updateMany({
                        where: { id: { in: instituteIds } },
                        data: { franchiseId: franchise.id },
                    });
                    attachedBranches = await tx.institute.findMany({
                        where: { id: { in: instituteIds } },
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            city: true,
                            state: true,
                            status: true,
                            _count: { select: { students: true } },
                        },
                    });
                }
            }
            else if (data.branchOption === 'CREATE_NEW' && data.newBranch?.name) {
                const branchName = data.newBranch.name.trim();
                let branchCode = data.newBranch.code?.trim();
                if (!branchCode) {
                    const count = await tx.institute.count();
                    branchCode = `BR-${String(count + 1).padStart(3, '0')}`;
                    let exists = await tx.institute.findUnique({ where: { code: branchCode } });
                    let offset = 1;
                    while (exists) {
                        branchCode = `BR-${String(count + 1 + offset).padStart(3, '0')}`;
                        exists = await tx.institute.findUnique({ where: { code: branchCode } });
                        offset++;
                    }
                }
                const branchEmail = data.newBranch.email?.trim() ? data.newBranch.email.trim().toLowerCase() : null;
                const newInst = await tx.institute.create({
                    data: {
                        name: branchName,
                        code: branchCode,
                        city: data.newBranch.city?.trim() || data.city?.trim() || null,
                        state: data.newBranch.state?.trim() || data.state?.trim() || null,
                        address: data.newBranch.address?.trim() || data.address?.trim() || null,
                        phone: data.newBranch.phone?.trim() || cleanPhone,
                        email: branchEmail,
                        franchiseId: franchise.id,
                        status: 'ACTIVE',
                    },
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        city: true,
                        state: true,
                        status: true,
                        _count: { select: { students: true } },
                    },
                });
                attachedBranches = [newInst];
            }
            return {
                franchise,
                agreement,
                installments,
                attachedBranches,
            };
        }, {
            timeout: 35000,
            maxWait: 10000,
        });
        const franchiseWithBranches = {
            ...txResult.franchise,
            branches: txResult.attachedBranches,
        };
        return res.status(201).json({
            success: true,
            message: isMonthly
                ? 'Franchise, Owner Account, and Agreement created successfully with monthly settlement'
                : 'Franchise, Owner Account, and 2 Annual Installments created successfully',
            data: {
                franchise: franchiseWithBranches,
                agreement: txResult.agreement,
                initialAgreement: txResult.agreement,
                installments: txResult.installments,
                ownerCredentials: {
                    fullName: data.ownerName.trim(),
                    email: normalizedEmail,
                    password: permanentPassword,
                    permanentPassword,
                    temporaryPassword: permanentPassword,
                    role: 'FRANCHISE_OWNER',
                    mustChangePassword: false,
                },
            },
        });
    }
    catch (err) {
        console.error('[Create Franchise Error]', err);
        if (err.code === 'P2002') {
            const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : String(err.meta?.target || '');
            const model = err.meta?.modelName || '';
            if (target.toLowerCase().includes('email') || target.includes('email_normalized')) {
                return res.status(409).json({
                    success: false,
                    error: model === 'User'
                        ? `Owner email '${req.body?.email || ''}' already belongs to an existing account.`
                        : `Franchise contact email is already registered. Please provide a unique email address.`,
                });
            }
            if (target.toLowerCase().includes('phone')) {
                return res.status(409).json({
                    success: false,
                    error: `Phone number already belongs to another franchise or user account. Please provide a unique phone number.`,
                });
            }
            if (target.toLowerCase().includes('code')) {
                return res.status(409).json({
                    success: false,
                    error: `Franchise code already exists. Please choose a unique code.`,
                });
            }
            return res.status(409).json({
                success: false,
                error: `A record with this ${target || 'unique field'} already exists. Please verify franchise email, code, and phone.`,
            });
        }
        return res.status(500).json({ success: false, error: err.message || 'Failed to create franchise' });
    }
}
async function listFranchises(req, res) {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.userId;
        let where = {};
        if (userRole === 'FRANCHISE_OWNER') {
            where = { ownerUserId: userId };
        }
        const { status, search } = req.query;
        const cacheKey = `franchises:list:${userRole}:${userRole === 'FRANCHISE_OWNER' ? userId : 'all'}:${status || ''}:${search || ''}`;
        const cached = cache_js_1.serverCache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
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
        const franchises = await prisma_js_1.prisma.franchise.findMany({
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
                },
                installments: {
                    orderBy: { dueDate: 'asc' },
                    select: {
                        id: true,
                        installmentNumber: true,
                        periodLabel: true,
                        dueDate: true,
                        amount: true,
                        paidAmount: true,
                        outstandingBalance: true,
                        status: true,
                    },
                },
                _count: {
                    select: { branches: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const responsePayload = {
            success: true,
            data: {
                franchises,
                total: franchises.length,
            },
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 15000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[List Franchises Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve franchises' });
    }
}
async function getFranchiseById(req, res) {
    try {
        const { id } = req.params;
        const { authorized, franchise } = await verifyFranchiseAccess(req.user.userId, req.user.role, id);
        if (!authorized || !franchise) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You do not have permission to access this franchise',
            });
        }
        // Self-healing: if ownerUser was not loaded because ownerUserId was null or unlinked
        if (!franchise.ownerUser && franchise.email) {
            const normEmail = franchise.email.trim().toLowerCase();
            const matchedUser = await prisma_js_1.prisma.user.findFirst({
                where: { email: { equals: normEmail, mode: 'insensitive' } },
                select: {
                    id: true,
                    email: true,
                    fullName: true,
                    phone: true,
                    role: true,
                    isActive: true,
                    mustChangePassword: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            if (matchedUser) {
                if (!franchise.ownerUserId) {
                    await prisma_js_1.prisma.franchise.update({
                        where: { id: franchise.id },
                        data: { ownerUserId: matchedUser.id },
                    });
                }
                franchise.ownerUser = matchedUser;
            }
        }
        // Compute aggregate metrics for this franchise
        const branchIds = franchise.branches.map((b) => b.id);
        const totalStudents = await prisma_js_1.prisma.student.count({
            where: { instituteId: { in: branchIds }, status: 'ACTIVE' },
        });
        const paymentAgg = await prisma_js_1.prisma.payment.aggregate({
            where: { instituteId: { in: branchIds }, status: 'SUCCESS' },
            _sum: { amountPaid: true },
        });
        const totalRevenue = Number(paymentAgg._sum.amountPaid || 0);
        const installments = await prisma_js_1.prisma.franchiseRoyaltyInstallment.findMany({
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
        const bizDetails = franchise.businessDetails || {};
        const ownerPassword = bizDetails.initialPassword || null;
        return res.json({
            success: true,
            data: {
                franchise: {
                    ...franchise,
                    ownerPassword,
                },
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
    }
    catch (err) {
        console.error('[Get Franchise Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve franchise details' });
    }
}
async function updateFranchise(req, res) {
    try {
        const { id } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, id);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const { name, ownerName, phone, address, city, state, postalCode, country, authorizedContact, businessDetails, notes, 
        // Optional branch linking / creation / detachment inside Edit
        branchOption, linkedInstituteIds, linkedInstituteId, detachInstituteId, newBranch, } = req.body;
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const revenueSharePercentage = (isSuperAdmin && req.body.revenueSharePercentage !== undefined)
            ? Number(req.body.revenueSharePercentage)
            : undefined;
        const digitalGuruRevenuePercentage = revenueSharePercentage !== undefined
            ? Number((100 - revenueSharePercentage).toFixed(2))
            : undefined;
        // 1. Update franchise profile details
        await prisma_js_1.prisma.franchise.update({
            where: { id },
            data: {
                ...(isSuperAdmin && name && { name }),
                ...(ownerName && { ownerName }),
                ...(phone && { phone }),
                ...(address !== undefined && { address }),
                ...(city !== undefined && { city }),
                ...(state !== undefined && { state }),
                ...(postalCode !== undefined && { postalCode }),
                ...(country !== undefined && { country }),
                ...(authorizedContact !== undefined && { authorizedContact }),
                ...(businessDetails !== undefined && { businessDetails }),
                ...(isSuperAdmin && notes !== undefined && { notes }),
                ...(revenueSharePercentage !== undefined && {
                    revenueSharePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                }),
            },
        });
        if (revenueSharePercentage !== undefined) {
            const activeAgreement = await prisma_js_1.prisma.franchiseAgreement.findFirst({
                where: { franchiseId: id, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
            });
            if (activeAgreement) {
                await prisma_js_1.prisma.franchiseAgreement.update({
                    where: { id: activeAgreement.id },
                    data: {
                        partnerRevenuePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                        digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                        royaltyPercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                    },
                });
            }
            const pendingSettlements = await prisma_js_1.prisma.franchiseSettlement.findMany({
                where: {
                    franchiseId: id,
                    status: { in: ['DRAFT', 'PENDING_APPROVAL', 'PENDING_REVIEW'] },
                },
            });
            for (const s of pendingSettlements) {
                const netCollections = Number(s.totalEligibleCollections);
                const newFranchiseShare = Math.round(netCollections * (revenueSharePercentage / 100) * 100) / 100;
                const newDgShare = Math.round((netCollections - newFranchiseShare) * 100) / 100;
                const totalTransferred = Number(s.totalTransferredAmount || 0);
                const newRemaining = Math.max(0, Math.round((newFranchiseShare - totalTransferred) * 100) / 100);
                await prisma_js_1.prisma.franchiseSettlement.update({
                    where: { id: s.id },
                    data: {
                        applicableFranchisePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                        applicableDigitalGuruPercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                        franchisePayableAmount: new client_1.Prisma.Decimal(newFranchiseShare),
                        digitalGuruShareAmount: new client_1.Prisma.Decimal(newDgShare),
                        remainingPayableAmount: new client_1.Prisma.Decimal(newRemaining),
                    },
                });
            }
        }
        // 2. Manage branch associations if Super Admin
        if (isSuperAdmin) {
            // Detach branch
            if (detachInstituteId) {
                await prisma_js_1.prisma.institute.updateMany({
                    where: { id: detachInstituteId, franchiseId: id },
                    data: { franchiseId: null },
                });
            }
            // Link existing institute(s)
            const idsToLink = linkedInstituteIds || (linkedInstituteId ? [linkedInstituteId] : []);
            if (idsToLink.length > 0) {
                await prisma_js_1.prisma.institute.updateMany({
                    where: { id: { in: idsToLink } },
                    data: { franchiseId: id },
                });
            }
            // Create and attach new campus branch
            if (newBranch && newBranch.name) {
                let branchCode = newBranch.code;
                if (!branchCode) {
                    const count = await prisma_js_1.prisma.institute.count();
                    branchCode = `BR-${String(count + 1).padStart(3, '0')}`;
                    let exists = await prisma_js_1.prisma.institute.findUnique({ where: { code: branchCode } });
                    let offset = 1;
                    while (exists) {
                        branchCode = `BR-${String(count + 1 + offset).padStart(3, '0')}`;
                        exists = await prisma_js_1.prisma.institute.findUnique({ where: { code: branchCode } });
                        offset++;
                    }
                }
                await prisma_js_1.prisma.institute.create({
                    data: {
                        name: newBranch.name,
                        code: branchCode,
                        city: newBranch.city || undefined,
                        state: newBranch.state || undefined,
                        address: newBranch.address || undefined,
                        phone: newBranch.phone || undefined,
                        email: newBranch.email?.trim() ? newBranch.email.trim().toLowerCase() : null,
                        franchiseId: id,
                        status: 'ACTIVE',
                    },
                });
            }
        }
        // 3. Return fresh franchise record including branches
        const updated = await prisma_js_1.prisma.franchise.findUnique({
            where: { id },
            include: {
                branches: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        city: true,
                        state: true,
                        status: true,
                        _count: { select: { students: true } },
                    },
                },
                ownerUser: { select: { id: true, email: true, fullName: true, phone: true } },
            },
        });
        return res.json({
            success: true,
            message: 'Franchise details and institute links updated successfully',
            data: { franchise: updated },
        });
    }
    catch (err) {
        console.error('[Update Franchise Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update franchise' });
    }
}
async function updateFranchiseStatus(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can update franchise status' });
        }
        const { id } = req.params;
        const { status, reason } = req.body;
        if (!['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid franchise status' });
        }
        const franchise = await prisma_js_1.prisma.franchise.update({
            where: { id },
            data: {
                status,
                ...(reason && { notes: `[Status changed to ${status} on ${new Date().toISOString()}]: ${reason}` }),
            },
            include: { ownerUser: true },
        });
        // Update user active status
        if (franchise.ownerUserId) {
            await prisma_js_1.prisma.user.update({
                where: { id: franchise.ownerUserId },
                data: { isActive: status === 'ACTIVE' },
            });
        }
        cache_js_1.serverCache.invalidate();
        return res.json({
            success: true,
            message: `Franchise status successfully updated to ${status}`,
            data: { franchise },
        });
    }
    catch (err) {
        console.error('[Franchise Status Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update franchise status' });
    }
}
// Super Admin resets Franchise Owner password securely
async function resetFranchiseOwnerPassword(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can reset franchise owner passwords' });
        }
        const { id } = req.params;
        let franchise = await prisma_js_1.prisma.franchise.findUnique({
            where: { id },
            include: {
                ownerUser: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        phone: true,
                        role: true,
                        isActive: true,
                        mustChangePassword: true,
                        lastLoginAt: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        let ownerUser = franchise.ownerUser;
        // Self-healing: if ownerUser relation is missing, attempt to find user by email or create owner account
        if (!ownerUser) {
            const normEmail = franchise.email?.trim().toLowerCase();
            if (normEmail) {
                const found = await prisma_js_1.prisma.user.findFirst({
                    where: { email: { equals: normEmail, mode: 'insensitive' } },
                });
                if (found) {
                    ownerUser = {
                        id: found.id,
                        email: found.email,
                        fullName: found.fullName,
                        phone: found.phone,
                        role: found.role,
                        isActive: found.isActive,
                        mustChangePassword: found.mustChangePassword,
                        lastLoginAt: found.lastLoginAt,
                        createdAt: found.createdAt,
                        updatedAt: found.updatedAt,
                    };
                    await prisma_js_1.prisma.franchise.update({
                        where: { id: franchise.id },
                        data: { ownerUserId: found.id },
                    });
                }
                else {
                    // Provision missing owner user account
                    const initialPwd = (0, security_js_1.generatePermanentPassword)(16);
                    const initialHash = await (0, security_js_1.hashPassword)(initialPwd);
                    const created = await prisma_js_1.prisma.user.create({
                        data: {
                            email: normEmail,
                            phone: franchise.phone || `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
                            fullName: franchise.ownerName || franchise.name,
                            passwordHash: initialHash,
                            role: 'FRANCHISE_OWNER',
                            isActive: franchise.status === 'ACTIVE',
                            mustChangePassword: false,
                        },
                    });
                    ownerUser = {
                        id: created.id,
                        email: created.email,
                        fullName: created.fullName,
                        phone: created.phone,
                        role: created.role,
                        isActive: created.isActive,
                        mustChangePassword: created.mustChangePassword,
                        lastLoginAt: created.lastLoginAt,
                        createdAt: created.createdAt,
                        updatedAt: created.updatedAt,
                    };
                    await prisma_js_1.prisma.franchise.update({
                        where: { id: franchise.id },
                        data: { ownerUserId: created.id },
                    });
                }
            }
        }
        if (!ownerUser) {
            return res.status(404).json({ success: false, error: 'Franchise owner user account could not be found or provisioned' });
        }
        const customPwd = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        if (customPwd && customPwd.length < 8) {
            return res.status(400).json({ success: false, error: 'Custom password must be at least 8 characters long' });
        }
        const permanentPassword = customPwd || (0, security_js_1.generatePermanentPassword)(16);
        const passwordHash = await (0, security_js_1.hashPassword)(permanentPassword);
        await prisma_js_1.prisma.user.update({
            where: { id: ownerUser.id },
            data: {
                passwordHash,
                mustChangePassword: false,
                updatedAt: new Date(),
            },
        });
        // Update franchise businessDetails with the updated permanent password for super admin view
        const currentBizDetails = franchise.businessDetails || {};
        await prisma_js_1.prisma.franchise.update({
            where: { id: franchise.id },
            data: {
                businessDetails: {
                    ...currentBizDetails,
                    initialPassword: permanentPassword,
                    lastPasswordResetAt: new Date().toISOString(),
                },
            },
        });
        // Invalidate any active password reset tokens for this user
        await prisma_js_1.prisma.passwordResetToken.deleteMany({
            where: { userId: ownerUser.id },
        }).catch(() => { });
        // Record the password reset in audit log (without logging password or hash)
        await prisma_js_1.prisma.auditLog.create({
            data: {
                userId: req.user?.userId || null,
                action: 'FRANCHISE_OWNER_PASSWORD_RESET',
                entityType: 'User',
                entityId: ownerUser.id,
                newValues: {
                    franchiseId: franchise.id,
                    franchiseCode: franchise.code,
                    franchiseName: franchise.name,
                    ownerEmail: ownerUser.email,
                    ownerName: ownerUser.fullName,
                    resetBy: req.user?.userId || 'SUPER_ADMIN',
                    mustChangePassword: false,
                    resetAt: new Date().toISOString(),
                },
            },
        }).catch((logErr) => {
            console.error('[AuditLog Error]', logErr?.message || logErr);
        });
        // Ensure reset response is not cached
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.json({
            success: true,
            message: 'Owner permanent password generated and updated successfully',
            data: {
                email: ownerUser.email,
                fullName: ownerUser.fullName,
                password: permanentPassword,
                permanentPassword,
                temporaryPassword: permanentPassword,
                mustChangePassword: false,
            },
        });
    }
    catch (err) {
        console.error('[Reset Password Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to reset owner password' });
    }
}
// ============================================================================
// 2. BRANCH / INSTITUTE MANAGEMENT (SUPER_ADMIN & FRANCHISE_OWNER)
// ============================================================================
async function addBranchToFranchise(req, res) {
    try {
        let { id: franchiseId } = req.params;
        // If 'my-branches' or franchiseId not specified, find user's franchise
        if (franchiseId === 'my-branches' || !franchiseId) {
            if (req.user?.role === 'FRANCHISE_OWNER') {
                const owned = await prisma_js_1.prisma.franchise.findFirst({
                    where: { ownerUserId: req.user.userId },
                    select: { id: true, name: true, code: true },
                });
                if (!owned) {
                    return res.status(404).json({ success: false, error: 'No franchise found for this user' });
                }
                franchiseId = owned.id;
            }
        }
        // Role verification: Super Admin can add to any franchise; Franchise Owner can only add to their own
        if (req.user?.role !== 'SUPER_ADMIN') {
            if (req.user?.role === 'FRANCHISE_OWNER') {
                const owned = await prisma_js_1.prisma.franchise.findFirst({
                    where: { id: franchiseId, ownerUserId: req.user.userId },
                });
                if (!owned) {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: You can only add institutes to your own franchise.',
                    });
                }
            }
            else {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: Insufficient privileges to add branches.',
                });
            }
        }
        const { instituteId, instituteIds, name, code, city, state, address, postalCode, legalName, phone, email, createNew, admissionPrefix } = req.body;
        // Verify franchise exists and enforce single branch rule (1:1 relationship)
        const targetFranchise = await prisma_js_1.prisma.franchise.findUnique({
            where: { id: franchiseId },
            select: {
                id: true,
                name: true,
                code: true,
                ownerUserId: true,
                branches: { select: { id: true, name: true } },
            },
        });
        if (!targetFranchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        if (targetFranchise.branches && targetFranchise.branches.length >= 1) {
            return res.status(400).json({
                success: false,
                error: `Franchise '${targetFranchise.name}' already has an authorized campus branch (${targetFranchise.branches[0].name}). Each franchise can only have one branch.`,
            });
        }
        // Case 1: Bulk assign multiple existing branches
        if (Array.isArray(instituteIds) && instituteIds.length > 0) {
            await prisma_js_1.prisma.institute.updateMany({
                where: { id: { in: instituteIds } },
                data: { franchiseId },
            });
            const updatedBranches = await prisma_js_1.prisma.institute.findMany({
                where: { id: { in: instituteIds } },
            });
            // Also ensure franchise owner has membership for each linked branch
            if (targetFranchise.ownerUserId) {
                for (const b of updatedBranches) {
                    await prisma_js_1.prisma.instituteMembership.upsert({
                        where: {
                            instituteId_userId: {
                                instituteId: b.id,
                                userId: targetFranchise.ownerUserId,
                            },
                        },
                        create: {
                            userId: targetFranchise.ownerUserId,
                            instituteId: b.id,
                            role: 'FRANCHISE_OWNER',
                            isActive: true,
                        },
                        update: {
                            isActive: true,
                        },
                    }).catch(() => { });
                }
            }
            cache_js_1.serverCache.invalidate();
            return res.status(200).json({
                success: true,
                message: `${updatedBranches.length} branch(es) successfully assigned to ${targetFranchise.name}`,
                data: { branches: updatedBranches },
            });
        }
        // Case 2: Create brand new branch and attach
        let branch;
        if (createNew || (!instituteId && name)) {
            let branchCode = code?.trim()?.toUpperCase();
            if (!branchCode) {
                for (let attempt = 0; attempt < 15; attempt++) {
                    const suffix = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
                    const candidate = `INS-${suffix}`;
                    const exists = await prisma_js_1.prisma.institute.findUnique({ where: { code: candidate } });
                    if (!exists) {
                        branchCode = candidate;
                        break;
                    }
                }
                if (!branchCode) {
                    branchCode = `INS-${Date.now().toString(36).toUpperCase()}`;
                }
            }
            else {
                const existing = await prisma_js_1.prisma.institute.findUnique({ where: { code: branchCode } });
                if (existing) {
                    return res.status(409).json({ success: false, error: `An institute with code '${branchCode}' already exists` });
                }
            }
            let cleanAdmissionPrefix = admissionPrefix?.trim()?.toUpperCase() || null;
            if (cleanAdmissionPrefix) {
                const existingPrefix = await prisma_js_1.prisma.institute.findUnique({ where: { admissionPrefix: cleanAdmissionPrefix } });
                if (existingPrefix) {
                    return res.status(409).json({ success: false, error: `An institute with admission prefix '${cleanAdmissionPrefix}' already exists` });
                }
            }
            branch = await prisma_js_1.prisma.institute.create({
                data: {
                    name: name.trim(),
                    legalName: legalName?.trim() || null,
                    code: branchCode,
                    admissionPrefix: cleanAdmissionPrefix,
                    city: city?.trim() || null,
                    state: state?.trim() || null,
                    address: address?.trim() || null,
                    postalCode: postalCode?.trim() || null,
                    phone: phone?.trim() || null,
                    email: email?.trim() ? email.trim().toLowerCase() : null,
                    franchiseId,
                    status: 'ACTIVE',
                },
            });
            // Grant institute membership to the franchise owner
            const franchiseOwnerId = targetFranchise.ownerUserId;
            if (franchiseOwnerId) {
                await prisma_js_1.prisma.instituteMembership.upsert({
                    where: {
                        instituteId_userId: {
                            instituteId: branch.id,
                            userId: franchiseOwnerId,
                        },
                    },
                    create: {
                        userId: franchiseOwnerId,
                        instituteId: branch.id,
                        role: 'FRANCHISE_OWNER',
                        isActive: true,
                    },
                    update: {
                        isActive: true,
                    },
                }).catch(() => { });
            }
        }
        else {
            // Case 3: Attach single existing branch
            if (!instituteId) {
                return res.status(400).json({ success: false, error: 'instituteId or instituteIds is required to attach existing branches' });
            }
            const existingBranch = await prisma_js_1.prisma.institute.findUnique({
                where: { id: instituteId },
            });
            if (!existingBranch) {
                return res.status(404).json({ success: false, error: `Branch with ID "${instituteId}" not found` });
            }
            branch = await prisma_js_1.prisma.institute.update({
                where: { id: instituteId },
                data: { franchiseId },
            });
        }
        cache_js_1.serverCache.invalidate();
        return res.status(201).json({
            success: true,
            message: 'Institute successfully created and assigned to franchise',
            data: { branch },
        });
    }
    catch (err) {
        console.error('[Add Branch Error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to add branch' });
    }
}
async function listFranchiseBranches(req, res) {
    try {
        const { id: franchiseId } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const branches = await prisma_js_1.prisma.institute.findMany({
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
    }
    catch (err) {
        console.error('[List Branches Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list branches' });
    }
}
async function removeBranchFromFranchise(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Only Super Admin can detach branches from a franchise.',
            });
        }
        const { id: franchiseId, branchId } = req.params;
        const branch = await prisma_js_1.prisma.institute.findUnique({
            where: { id: branchId },
        });
        if (!branch || branch.franchiseId !== franchiseId) {
            return res.status(404).json({
                success: false,
                error: 'Branch not found or not assigned to this franchise',
            });
        }
        await prisma_js_1.prisma.institute.update({
            where: { id: branchId },
            data: { franchiseId: null },
        });
        return res.json({
            success: true,
            message: 'Branch successfully detached from franchise',
        });
    }
    catch (err) {
        console.error('[Remove Branch Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to remove branch' });
    }
}
async function getMyAssignedBranches(req, res) {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        if (userRole === 'SUPER_ADMIN') {
            const targetFranchiseId = req.query.franchiseId;
            const where = {};
            if (targetFranchiseId) {
                where.franchiseId = targetFranchiseId;
            }
            const branches = await prisma_js_1.prisma.institute.findMany({
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
        const franchise = await prisma_js_1.prisma.franchise.findFirst({
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
    }
    catch (err) {
        console.error('[Get My Assigned Branches Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve assigned branches' });
    }
}
async function getUnassignedBranches(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const branches = await prisma_js_1.prisma.institute.findMany({
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
    }
    catch (err) {
        console.error('[Get Unassigned Branches Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve unassigned branches' });
    }
}
// ============================================================================
// 3. AGREEMENTS & ANNUAL TWO-INSTALLMENT RENEWALS / REVISIONS
// ============================================================================
async function getAgreementTemplates(req, res) {
    try {
        const templates = [
            {
                id: 'NEW_CENTRE_JOINT_INVESTMENT',
                type: 'NEW_CENTRE_JOINT_INVESTMENT',
                label: 'New Centre (Joint Investment)',
                subtitle: 'Joint Setup • 50:50 Rev • Monthly',
                description: 'Joint establishment of new centre. 50:50 initial setup investment (e.g. ₹1–2 Lakh illustrative default), shared revenue, Digital Ghuru supplies & pays trainers, initial 3 months marketing support.',
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
                        trainerSalaries: { payer: 'DIGITAL_GURU', notes: 'Digital Ghuru supplies trainers and bears trainer costs directly' },
                        staffSalaries: { payer: 'PARTNER', notes: 'Partner pays administrative staff salaries directly' },
                        operationalSetup: { payer: 'SHARED', sharedDgPercentage: 50, sharedPartnerPercentage: 50, notes: '50:50 shared initial operational setup' },
                        utilitiesMaintenance: { payer: 'PARTNER', notes: 'Utilities, power, water, internet borne directly by Partner' },
                        marketingAdvertising: { payer: 'DIGITAL_GURU', notes: 'Digital Ghuru supports initial 3 months marketing directly' },
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
                subtitle: 'Existing Infra • 45:55 Rev • Monthly',
                description: 'Existing centre onboarded with active infrastructure. Digital Ghuru supplies certified trainers and covers initial 3 months marketing; partner handles premises rent and operations. Revenue share 45:55 or 55:45 (fully editable).',
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
                        trainerSalaries: { payer: 'DIGITAL_GURU', notes: 'Digital Ghuru supplies certified course trainers and bears trainer costs directly' },
                        staffSalaries: { payer: 'PARTNER', notes: 'Partner pays center staff salaries directly' },
                        operationalSetup: { payer: 'PARTNER', notes: 'Existing setup utilized' },
                        utilitiesMaintenance: { payer: 'PARTNER', notes: 'Partner pays utilities directly' },
                        marketingAdvertising: { payer: 'DIGITAL_GURU', notes: 'Digital Ghuru supports initial 3 months marketing directly' },
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
                id: 'CUSTOM_AGREEMENT',
                type: 'CUSTOM_AGREEMENT',
                label: 'Custom Agreement',
                subtitle: 'Custom Share & Terms',
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
    }
    catch (err) {
        console.error('[Get Agreement Templates Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve agreement templates' });
    }
}
async function createAgreement(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can create agreements' });
        }
        const { id: franchiseId } = req.params;
        const { title, startDate, endDate, agreementType, calculationMethod: requestedCalculationMethod, annualRoyaltyAmount, royaltyPercentage, digitalGuruRevenuePercentage, partnerRevenuePercentage, revenueCalculationBasis, settlementFrequency, totalInvestment, digitalGuruInvestmentAmount, partnerInvestmentAmount, digitalGuruInvestmentPercentage, partnerInvestmentPercentage, operationalSetupContribution, investmentNotes, expenseResponsibilities, marketingResponsibleParty, marketingSupportDurationMonths, marketingPostSupportParty, marketingBudget, marketingEffectiveStartDate, marketingNotes, courseSoftwareAccessEnabled, courseSoftwarePricingNotes, royaltyBasis, perStudentFee, dueDay, installment1DueDate, installment2DueDate, terms, notes, } = req.body;
        const franchise = await prisma_js_1.prisma.franchise.findUnique({ where: { id: franchiseId } });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        if (!title || !startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Title, start date, and end date are required' });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid startDate or endDate format' });
        }
        if (start > end) {
            return res.status(400).json({ success: false, error: 'startDate must be before or equal to endDate' });
        }
        // Default calculation method based on agreementType if not explicitly passed
        const calculationMethod = requestedCalculationMethod || (agreementType === 'BRAND_AND_COURSE_SUPPORT' ? 'FIXED_ANNUAL' : 'PERCENTAGE_REVENUE');
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
                    error: `Revenue sharing percentages must total 100% (currently Digital Ghuru: ${effectiveDgRevenuePct}%, Partner: ${effectivePartnerRevenuePct}%)`,
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
        const agreement = await prisma_js_1.prisma.franchiseAgreement.create({
            data: {
                franchiseId,
                agreementNumber,
                title,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                agreementType: agreementType || 'CUSTOM_AGREEMENT',
                calculationMethod,
                annualRoyaltyAmount: annualRoyaltyAmount !== undefined ? new client_1.Prisma.Decimal(annualRoyaltyAmount) : null,
                perStudentFee: perStudentFee !== undefined ? new client_1.Prisma.Decimal(perStudentFee) : null,
                royaltyPercentage: new client_1.Prisma.Decimal(effectiveDgRevenuePct),
                digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(effectiveDgRevenuePct),
                partnerRevenuePercentage: new client_1.Prisma.Decimal(effectivePartnerRevenuePct),
                revenueCalculationBasis: revenueCalculationBasis || royaltyBasis || 'GROSS_COURSE_FEES',
                settlementFrequency: settlementFrequency || 'YEARLY',
                totalInvestment: totalInvestment !== undefined ? new client_1.Prisma.Decimal(totalInvestment) : null,
                digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined ? new client_1.Prisma.Decimal(digitalGuruInvestmentAmount) : null,
                partnerInvestmentAmount: partnerInvestmentAmount !== undefined ? new client_1.Prisma.Decimal(partnerInvestmentAmount) : null,
                digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined ? new client_1.Prisma.Decimal(digitalGuruInvestmentPercentage) : null,
                partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined ? new client_1.Prisma.Decimal(partnerInvestmentPercentage) : null,
                operationalSetupContribution: operationalSetupContribution !== undefined ? new client_1.Prisma.Decimal(operationalSetupContribution) : null,
                investmentNotes: investmentNotes || null,
                expenseResponsibilities: expenseResponsibilities ?? client_1.Prisma.DbNull,
                marketingResponsibleParty: marketingResponsibleParty || 'DIGITAL_GURU',
                marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined ? Number(marketingSupportDurationMonths) : 3,
                marketingPostSupportParty: marketingPostSupportParty || 'PARTNER',
                marketingBudget: marketingBudget !== undefined ? new client_1.Prisma.Decimal(marketingBudget) : null,
                marketingEffectiveStartDate: marketingEffectiveStartDate ? new Date(marketingEffectiveStartDate) : null,
                marketingNotes: marketingNotes || null,
                courseSoftwareAccessEnabled: courseSoftwareAccessEnabled !== undefined ? Boolean(courseSoftwareAccessEnabled) : true,
                courseSoftwarePricingNotes: courseSoftwarePricingNotes || null,
                version: 1,
                royaltyBasis: royaltyBasis || 'TOTAL_COLLECTIONS',
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
        let installments = [];
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
    }
    catch (err) {
        console.error('[Create Agreement Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to create agreement' });
    }
}
// Revise agreement: creates version N+1 linked via parentAgreementId, preserving previous agreement history
async function reviseAgreement(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can revise agreements' });
        }
        const { id: franchiseId, agreementId } = req.params;
        const previousAgreement = await prisma_js_1.prisma.franchiseAgreement.findUnique({
            where: { id: agreementId },
        });
        if (!previousAgreement || previousAgreement.franchiseId !== franchiseId) {
            return res.status(404).json({ success: false, error: 'Previous agreement not found for this franchise' });
        }
        const { title, startDate, endDate, agreementType, calculationMethod, annualRoyaltyAmount, perStudentFee, royaltyPercentage, digitalGuruRevenuePercentage, partnerRevenuePercentage, revenueCalculationBasis, settlementFrequency, totalInvestment, digitalGuruInvestmentAmount, partnerInvestmentAmount, digitalGuruInvestmentPercentage, partnerInvestmentPercentage, operationalSetupContribution, investmentNotes, expenseResponsibilities, marketingResponsibleParty, marketingSupportDurationMonths, marketingPostSupportParty, marketingBudget, marketingEffectiveStartDate, marketingNotes, courseSoftwareAccessEnabled, courseSoftwarePricingNotes, dueDay, terms, notes, revisionReason, } = req.body;
        const newStart = new Date(startDate || previousAgreement.startDate);
        const newEnd = new Date(endDate || previousAgreement.endDate);
        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid startDate or endDate format' });
        }
        if (newStart > newEnd) {
            return res.status(400).json({ success: false, error: 'startDate must be before or equal to endDate' });
        }
        const effectiveDgPct = digitalGuruRevenuePercentage !== undefined
            ? Number(digitalGuruRevenuePercentage)
            : (royaltyPercentage !== undefined ? Number(royaltyPercentage) : Number(previousAgreement.digitalGuruRevenuePercentage ?? 50.0));
        const effectivePartnerPct = partnerRevenuePercentage !== undefined
            ? Number(partnerRevenuePercentage)
            : (100 - effectiveDgPct);
        if (Math.round((effectiveDgPct + effectivePartnerPct) * 100) / 100 !== 100) {
            return res.status(400).json({
                success: false,
                error: `Revenue sharing percentages must total 100% (currently Digital Ghuru: ${effectiveDgPct}%, Partner: ${effectivePartnerPct}%)`,
            });
        }
        const effSettlementFreq = settlementFrequency || previousAgreement.settlementFrequency || 'YEARLY';
        const isMonthly = effSettlementFreq === 'MONTHLY';
        const installmentCount = isMonthly ? 0 : 2;
        const newVersion = (previousAgreement.version || 1) + 1;
        const baseNumber = previousAgreement.agreementNumber.split('-v')[0];
        const agreementNumber = `${baseNumber}-v${newVersion}`;
        const { newAgreement, installments } = await prisma_js_1.prisma.$transaction(async (tx) => {
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
                        ? new client_1.Prisma.Decimal(annualRoyaltyAmount)
                        : previousAgreement.annualRoyaltyAmount,
                    perStudentFee: perStudentFee !== undefined
                        ? new client_1.Prisma.Decimal(perStudentFee)
                        : previousAgreement.perStudentFee,
                    royaltyPercentage: new client_1.Prisma.Decimal(effectiveDgPct),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(effectiveDgPct),
                    partnerRevenuePercentage: new client_1.Prisma.Decimal(effectivePartnerPct),
                    revenueCalculationBasis: revenueCalculationBasis || previousAgreement.revenueCalculationBasis,
                    settlementFrequency: effSettlementFreq,
                    totalInvestment: totalInvestment !== undefined
                        ? new client_1.Prisma.Decimal(totalInvestment)
                        : previousAgreement.totalInvestment,
                    digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined
                        ? new client_1.Prisma.Decimal(digitalGuruInvestmentAmount)
                        : previousAgreement.digitalGuruInvestmentAmount,
                    partnerInvestmentAmount: partnerInvestmentAmount !== undefined
                        ? new client_1.Prisma.Decimal(partnerInvestmentAmount)
                        : previousAgreement.partnerInvestmentAmount,
                    digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined
                        ? new client_1.Prisma.Decimal(digitalGuruInvestmentPercentage)
                        : previousAgreement.digitalGuruInvestmentPercentage,
                    partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined
                        ? new client_1.Prisma.Decimal(partnerInvestmentPercentage)
                        : previousAgreement.partnerInvestmentPercentage,
                    operationalSetupContribution: operationalSetupContribution !== undefined
                        ? new client_1.Prisma.Decimal(operationalSetupContribution)
                        : previousAgreement.operationalSetupContribution,
                    investmentNotes: investmentNotes !== undefined ? investmentNotes : previousAgreement.investmentNotes,
                    expenseResponsibilities: expenseResponsibilities ?? previousAgreement.expenseResponsibilities ?? client_1.Prisma.DbNull,
                    marketingResponsibleParty: marketingResponsibleParty || previousAgreement.marketingResponsibleParty,
                    marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined
                        ? Number(marketingSupportDurationMonths)
                        : previousAgreement.marketingSupportDurationMonths,
                    marketingPostSupportParty: marketingPostSupportParty || previousAgreement.marketingPostSupportParty,
                    marketingBudget: marketingBudget !== undefined ? new client_1.Prisma.Decimal(marketingBudget) : previousAgreement.marketingBudget,
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
            let createdInstallments = [];
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
            // 4. Keep franchise active revenue share percentage in sync with revised agreement
            await tx.franchise.update({
                where: { id: franchiseId },
                data: {
                    revenueSharePercentage: new client_1.Prisma.Decimal(effectivePartnerPct),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(effectiveDgPct),
                },
            });
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
    }
    catch (err) {
        console.error('[Revise Agreement Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to revise agreement' });
    }
}
// Renew agreement: marks previous agreement EXPIRED and generates new annual agreement + 2 installments
async function renewAgreement(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can renew agreements' });
        }
        const { id: franchiseId, agreementId } = req.params;
        const { title, startDate, endDate, agreementType, calculationMethod, annualRoyaltyAmount, royaltyPercentage, digitalGuruRevenuePercentage, partnerRevenuePercentage, revenueCalculationBasis, settlementFrequency, totalInvestment, digitalGuruInvestmentAmount, partnerInvestmentAmount, digitalGuruInvestmentPercentage, partnerInvestmentPercentage, operationalSetupContribution, investmentNotes, expenseResponsibilities, marketingResponsibleParty, marketingSupportDurationMonths, marketingPostSupportParty, marketingBudget, marketingEffectiveStartDate, marketingNotes, courseSoftwareAccessEnabled, courseSoftwarePricingNotes, royaltyBasis, perStudentFee, dueDay, installment1DueDate, installment2DueDate, terms, notes, } = req.body;
        const previousAgreement = await prisma_js_1.prisma.franchiseAgreement.findUnique({
            where: { id: agreementId },
            include: { installments: true },
        });
        if (!previousAgreement || previousAgreement.franchiseId !== franchiseId) {
            return res.status(404).json({ success: false, error: 'Previous agreement not found for this franchise' });
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'startDate and endDate are required for agreement renewal' });
        }
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);
        if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid startDate or endDate format' });
        }
        if (newStart > newEnd) {
            return res.status(400).json({ success: false, error: 'startDate must be before or equal to endDate' });
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
                    error: `Revenue sharing percentages must total 100% (currently Digital Ghuru: ${effectiveDgRevenuePct}%, Partner: ${effectivePartnerRevenuePct}%)`,
                });
            }
        }
        const effSettlementFreq = settlementFrequency || previousAgreement.settlementFrequency || 'YEARLY';
        const isMonthly = effSettlementFreq === 'MONTHLY';
        const installmentCount = isMonthly ? 0 : 2;
        const year = new Date(startDate || Date.now()).getFullYear();
        const agreementNumber = await generateUniqueAgreementNumber(year);
        const { newAgreement, installments } = await prisma_js_1.prisma.$transaction(async (tx) => {
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
                        ? new client_1.Prisma.Decimal(annualRoyaltyAmount)
                        : previousAgreement.annualRoyaltyAmount,
                    calculationMethod: calculationMethod || previousAgreement.calculationMethod || 'FIXED_ANNUAL',
                    perStudentFee: perStudentFee !== undefined
                        ? new client_1.Prisma.Decimal(perStudentFee)
                        : previousAgreement.perStudentFee,
                    royaltyPercentage: new client_1.Prisma.Decimal(effectiveDgRevenuePct),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(effectiveDgRevenuePct),
                    partnerRevenuePercentage: new client_1.Prisma.Decimal(effectivePartnerRevenuePct),
                    revenueCalculationBasis: revenueCalculationBasis || previousAgreement.revenueCalculationBasis,
                    settlementFrequency: effSettlementFreq,
                    totalInvestment: totalInvestment !== undefined
                        ? new client_1.Prisma.Decimal(totalInvestment)
                        : previousAgreement.totalInvestment,
                    digitalGuruInvestmentAmount: digitalGuruInvestmentAmount !== undefined
                        ? new client_1.Prisma.Decimal(digitalGuruInvestmentAmount)
                        : previousAgreement.digitalGuruInvestmentAmount,
                    partnerInvestmentAmount: partnerInvestmentAmount !== undefined
                        ? new client_1.Prisma.Decimal(partnerInvestmentAmount)
                        : previousAgreement.partnerInvestmentAmount,
                    digitalGuruInvestmentPercentage: digitalGuruInvestmentPercentage !== undefined
                        ? new client_1.Prisma.Decimal(digitalGuruInvestmentPercentage)
                        : previousAgreement.digitalGuruInvestmentPercentage,
                    partnerInvestmentPercentage: partnerInvestmentPercentage !== undefined
                        ? new client_1.Prisma.Decimal(partnerInvestmentPercentage)
                        : previousAgreement.partnerInvestmentPercentage,
                    operationalSetupContribution: operationalSetupContribution !== undefined
                        ? new client_1.Prisma.Decimal(operationalSetupContribution)
                        : previousAgreement.operationalSetupContribution,
                    investmentNotes: investmentNotes !== undefined ? investmentNotes : previousAgreement.investmentNotes,
                    expenseResponsibilities: expenseResponsibilities ?? previousAgreement.expenseResponsibilities ?? client_1.Prisma.DbNull,
                    marketingResponsibleParty: marketingResponsibleParty || previousAgreement.marketingResponsibleParty,
                    marketingSupportDurationMonths: marketingSupportDurationMonths !== undefined
                        ? Number(marketingSupportDurationMonths)
                        : previousAgreement.marketingSupportDurationMonths,
                    marketingPostSupportParty: marketingPostSupportParty || previousAgreement.marketingPostSupportParty,
                    marketingBudget: marketingBudget !== undefined ? new client_1.Prisma.Decimal(marketingBudget) : previousAgreement.marketingBudget,
                    marketingEffectiveStartDate: marketingEffectiveStartDate ? new Date(marketingEffectiveStartDate) : previousAgreement.marketingEffectiveStartDate,
                    marketingNotes: marketingNotes !== undefined ? marketingNotes : previousAgreement.marketingNotes,
                    courseSoftwareAccessEnabled: courseSoftwareAccessEnabled !== undefined ? Boolean(courseSoftwareAccessEnabled) : previousAgreement.courseSoftwareAccessEnabled,
                    courseSoftwarePricingNotes: courseSoftwarePricingNotes !== undefined ? courseSoftwarePricingNotes : previousAgreement.courseSoftwarePricingNotes,
                    version: 1,
                    royaltyBasis: royaltyBasis || previousAgreement.royaltyBasis,
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
            let createdInstallments = [];
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
            // 4. Keep franchise active revenue share percentage in sync with renewed agreement
            await tx.franchise.update({
                where: { id: franchiseId },
                data: {
                    revenueSharePercentage: new client_1.Prisma.Decimal(effectivePartnerRevenuePct),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(effectiveDgRevenuePct),
                },
            });
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
    }
    catch (err) {
        console.error('[Renew Agreement Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to renew agreement' });
    }
}
async function listAgreements(req, res) {
    try {
        const { id: franchiseId } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const agreements = await prisma_js_1.prisma.franchiseAgreement.findMany({
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
    }
    catch (err) {
        console.error('[List Agreements Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list agreements' });
    }
}
async function updateAgreementStatus(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can update agreement status' });
        }
        const { id: franchiseId, agreementId } = req.params;
        const { status, note } = req.body;
        const validStatuses = ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'TERMINATED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid agreement status' });
        }
        const existing = await prisma_js_1.prisma.franchiseAgreement.findUnique({
            where: { id: agreementId },
        });
        if (!existing || existing.franchiseId !== franchiseId) {
            return res.status(404).json({ success: false, error: 'Agreement not found for this franchise' });
        }
        const updated = await prisma_js_1.prisma.franchiseAgreement.update({
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
    }
    catch (err) {
        console.error('[Update Agreement Status Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update agreement status' });
    }
}
async function addAgreementAmendment(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can record amendments' });
        }
        const { id: franchiseId, agreementId } = req.params;
        const { note, changes, newRoyaltyPercentage, newAnnualAmount } = req.body;
        const agreement = await prisma_js_1.prisma.franchiseAgreement.findUnique({
            where: { id: agreementId },
        });
        if (!agreement || agreement.franchiseId !== franchiseId) {
            return res.status(404).json({ success: false, error: 'Agreement not found for this franchise' });
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
        const updateData = {
            amendments: [...existingAmendments, newAmendment],
        };
        if (newRoyaltyPercentage !== undefined) {
            updateData.royaltyPercentage = new client_1.Prisma.Decimal(newRoyaltyPercentage);
        }
        if (newAnnualAmount !== undefined) {
            updateData.annualRoyaltyAmount = new client_1.Prisma.Decimal(newAnnualAmount);
        }
        const updated = await prisma_js_1.prisma.franchiseAgreement.update({
            where: { id: agreementId },
            data: updateData,
        });
        return res.json({
            success: true,
            message: 'Agreement amendment recorded successfully',
            data: { agreement: updated },
        });
    }
    catch (err) {
        console.error('[Agreement Amendment Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to record amendment' });
    }
}
async function getAgreementPdfData(req, res) {
    try {
        const { id: franchiseId, agreementId } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const agreement = await prisma_js_1.prisma.franchiseAgreement.findUnique({
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
        if (!agreement || agreement.franchiseId !== franchiseId) {
            return res.status(404).json({ success: false, error: 'Agreement not found for this franchise' });
        }
        return res.json({
            success: true,
            data: {
                agreement,
                company: {
                    name: 'Digital Ghuru',
                    brand: 'Digital Ghuru Franchise Enterprise',
                    partner: 'Jaighurudeva Educational Academy',
                    royaltySplit: `50% Super Admin / 50% Franchise Owner (${agreement.calculationMethod === 'FIXED_ANNUAL' ? `Fixed Annual Royalty: ₹${Number(agreement.annualRoyaltyAmount || 0).toLocaleString('en-IN')}` : `${agreement.royaltyPercentage}% Collections`})`,
                },
            },
        });
    }
    catch (err) {
        console.error('[Agreement PDF Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to generate agreement data' });
    }
}
// ============================================================================
// 4. TWO-INSTALLMENT ROYALTY WORKFLOW & RECEIPT MANAGEMENT
// ============================================================================
async function listFranchiseInstallments(req, res) {
    try {
        const { id: franchiseId } = req.params;
        const isSuperAdminAll = franchiseId === 'all' && req.user.role === 'SUPER_ADMIN';
        if (!isSuperAdminAll) {
            const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
            if (!authorized) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }
        const whereClause = isSuperAdminAll ? {} : { franchiseId };
        const installments = await prisma_js_1.prisma.franchiseRoyaltyInstallment.findMany({
            where: whereClause,
            include: {
                franchise: { select: { id: true, name: true, code: true, ownerName: true } },
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
            franchiseName: inst.franchise?.name,
            franchiseCode: inst.franchise?.code,
            ownerName: inst.franchise?.ownerName,
            liveStatus: computeInstallmentLiveStatus(inst),
        }));
        return res.json({
            success: true,
            data: {
                installments: withLiveStatus,
                total: withLiveStatus.length,
            },
        });
    }
    catch (err) {
        console.error('[List Installments Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list installments' });
    }
}
async function listAgreementInstallments(req, res) {
    try {
        const { id: franchiseId, agreementId } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const installments = await prisma_js_1.prisma.franchiseRoyaltyInstallment.findMany({
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
    }
    catch (err) {
        console.error('[List Agreement Installments Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list agreement installments' });
    }
}
async function recordInstallmentPayment(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can record royalty payments' });
        }
        const { id: franchiseId, installmentId } = req.params;
        const { amountPaid, paymentMethod, transactionReference, remarks, paymentDate } = req.body;
        if (!amountPaid || Number(amountPaid) <= 0 || isNaN(Number(amountPaid))) {
            return res.status(400).json({ success: false, error: 'Amount paid must be a valid number greater than zero' });
        }
        const franchise = await prisma_js_1.prisma.franchise.findUnique({ where: { id: franchiseId } });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        if (franchise.status === 'TERMINATED') {
            return res.status(400).json({ success: false, error: 'Cannot record royalty payments for a terminated franchise' });
        }
        const installment = await prisma_js_1.prisma.franchiseRoyaltyInstallment.findUnique({
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
        // Atomic transaction for payment creation and balance update with safe WAN latency timeouts
        let result;
        try {
            result = await prisma_js_1.prisma.$transaction(async (tx) => {
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
                const receiptNumber = await generateRoyaltyReceiptNumber(tx);
                const payment = await tx.franchiseRoyaltyPayment.create({
                    data: {
                        franchiseId,
                        installmentId,
                        receiptNumber,
                        amountPaid: new client_1.Prisma.Decimal(paidNum),
                        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                        paymentMethod: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(paymentMethod)
                            ? paymentMethod
                            : 'BANK_TRANSFER',
                        transactionReference: transactionReference?.trim() || null,
                        remarks: remarks || null,
                        recordedById: req.user.userId,
                    },
                });
                const currentPaid = Number(freshInst.paidAmount || 0);
                const newPaid = Math.round((currentPaid + paidNum) * 100) / 100;
                const newOutstanding = Math.max(0, Math.round((Number(freshInst.amount) - newPaid) * 100) / 100);
                const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
                const updatedInstallment = await tx.franchiseRoyaltyInstallment.update({
                    where: { id: installmentId },
                    data: {
                        paidAmount: new client_1.Prisma.Decimal(newPaid),
                        outstandingBalance: new client_1.Prisma.Decimal(newOutstanding),
                        status: newStatus,
                    },
                });
                return { payment, updatedInstallment, receiptNumber };
            }, {
                maxWait: 15000,
                timeout: 30000,
            });
        }
        catch (txErr) {
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
    }
    catch (err) {
        console.error('[Record Installment Payment Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to record installment payment' });
    }
}
async function getRoyaltyPaymentReceipt(req, res) {
    try {
        const { id: franchiseId, paymentId } = req.params;
        const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const payment = await prisma_js_1.prisma.franchiseRoyaltyPayment.findUnique({
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
                royaltyRecord: {
                    select: {
                        id: true,
                        periodLabel: true,
                        startDate: true,
                        endDate: true,
                        royaltyPayable: true,
                        royaltyPaid: true,
                        outstandingBalance: true,
                        status: true,
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
                royaltyRecord: payment.royaltyRecord
                    ? {
                        id: payment.royaltyRecord.id,
                        periodLabel: payment.royaltyRecord.periodLabel,
                        startDate: payment.royaltyRecord.startDate,
                        endDate: payment.royaltyRecord.endDate,
                        royaltyPayable: Number(payment.royaltyRecord.royaltyPayable),
                        royaltyPaid: Number(payment.royaltyRecord.royaltyPaid),
                        outstandingBalance: Number(payment.royaltyRecord.outstandingBalance),
                        status: payment.royaltyRecord.status,
                    }
                    : null,
                issuer: {
                    organization: 'Digital Ghuru Franchise Enterprise',
                    partner: 'Jaighurudeva Educational Academy',
                    recordedBy: payment.recordedBy?.fullName || 'Super Admin',
                    verified: true,
                },
            },
        });
    }
    catch (err) {
        console.error('[Get Payment Receipt Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve receipt' });
    }
}
// ============================================================================
// 5. LEGACY / MONTHLY ROYALTY CALCULATION & PAYMENTS
// ============================================================================
async function calculateRoyalty(req, res) {
    try {
        const { id: franchiseId } = req.params;
        const { startDate, endDate, periodLabel, instituteId } = req.body;
        if (!startDate || !endDate || !periodLabel) {
            return res.status(400).json({
                success: false,
                error: 'startDate, endDate, and periodLabel (e.g. "2026-11") are required',
            });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid startDate or endDate format',
            });
        }
        if (start > end) {
            return res.status(400).json({
                success: false,
                error: 'startDate must be before or equal to endDate',
            });
        }
        const queryEndDate = new Date(end);
        if (typeof endDate === 'string' && endDate.length <= 10) {
            queryEndDate.setUTCHours(23, 59, 59, 999);
        }
        const franchise = await prisma_js_1.prisma.franchise.findUnique({
            where: { id: franchiseId },
            include: {
                branches: true,
            },
        });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        if (instituteId && !franchise.branches.some((b) => b.id === instituteId)) {
            return res.status(400).json({
                success: false,
                error: `Specified branch "${instituteId}" does not belong to this franchise.`,
            });
        }
        const branchIds = instituteId ? [instituteId] : franchise.branches.map((b) => b.id);
        // 1. AGREEMENT RESOLUTION & BOUNDARY VALIDATION (AUDIT 1)
        let applicableAgreement = null;
        if (req.body.agreementId) {
            applicableAgreement = await prisma_js_1.prisma.franchiseAgreement.findFirst({
                where: { id: req.body.agreementId, franchiseId },
            });
            if (!applicableAgreement) {
                return res.status(404).json({
                    success: false,
                    error: `Specified agreement "${req.body.agreementId}" not found for this franchise.`,
                });
            }
            if (applicableAgreement.startDate > end || applicableAgreement.endDate < start) {
                return res.status(400).json({
                    success: false,
                    error: `The specified agreement "${applicableAgreement.title}" does not cover the requested calculation period (${startDate} to ${endDate}).`,
                    code: 'AGREEMENT_PERIOD_MISMATCH',
                });
            }
        }
        if (!applicableAgreement) {
            // Find all agreements of the franchise that overlap the requested calculation period [start, end]
            // Overlap condition: agreement.startDate <= end AND agreement.endDate >= start
            const overlappingAgreements = await prisma_js_1.prisma.franchiseAgreement.findMany({
                where: {
                    franchiseId,
                    startDate: { lte: end },
                    endDate: { gte: start },
                },
                orderBy: [
                    { version: 'desc' },
                    { createdAt: 'desc' },
                ],
            });
            if (overlappingAgreements.length === 0) {
                // Audit 1 Rule: Never fall back to an unrelated ACTIVE agreement when no agreement covers the requested period
                return res.status(400).json({
                    success: false,
                    error: `No franchise agreement covers the requested calculation period (${startDate} to ${endDate}). Please ensure a franchise agreement is effective for this period before calculating royalties.`,
                    code: 'NO_APPLICABLE_AGREEMENT',
                });
            }
            // Check for agreements that FULLY cover the requested period: agreement.startDate <= start AND agreement.endDate >= end
            const fullyCoveringAgreements = overlappingAgreements.filter((a) => a.startDate <= start && a.endDate >= end);
            // Check if any overlapping agreement starts or ends inside the requested calculation period
            const hasMidPeriodBoundaries = overlappingAgreements.some((a) => (a.startDate > start && a.startDate <= end) || (a.endDate >= start && a.endDate < end));
            // If no agreement fully covers the period, OR if there are multiple overlapping agreements with mid-period boundaries:
            if (fullyCoveringAgreements.length === 0 || (overlappingAgreements.length > 1 && hasMidPeriodBoundaries)) {
                // Audit 1 Rule: Reject periods that cross agreement versions or have mid-period transitions with clear validation error.
                const spanDetails = overlappingAgreements.map((a) => ({
                    id: a.id,
                    title: a.title,
                    version: a.version,
                    status: a.status,
                    startDate: a.startDate.toISOString().split('T')[0],
                    endDate: a.endDate.toISOString().split('T')[0],
                }));
                return res.status(400).json({
                    success: false,
                    error: `The requested calculation period (${startDate} to ${endDate}) spans across multiple agreement effective periods. Segmented calculations must be run separately for each applicable agreement period.`,
                    code: 'PERIOD_SPANS_MULTIPLE_AGREEMENTS',
                    overlappingAgreements: spanDetails,
                });
            }
            // Single fully covering agreement found
            applicableAgreement = fullyCoveringAgreements.find((a) => a.status === 'ACTIVE') || fullyCoveringAgreements[0];
        }
        // 2. COMMERCIAL MODEL & REVENUE SHARING RESOLUTION
        const dgPercentage = applicableAgreement?.digitalGuruRevenuePercentage
            ? Number(applicableAgreement.digitalGuruRevenuePercentage)
            : (applicableAgreement?.royaltyPercentage ? Number(applicableAgreement.royaltyPercentage) : 50.0);
        const partnerPercentage = applicableAgreement?.partnerRevenuePercentage
            ? Number(applicableAgreement.partnerRevenuePercentage)
            : (100 - dgPercentage);
        const calculationBasis = req.body.revenueCalculationBasis ||
            applicableAgreement?.revenueCalculationBasis ||
            'GROSS_COURSE_FEES';
        const calculationMethod = req.body.calculationMethod ||
            applicableAgreement?.calculationMethod ||
            'PERCENTAGE_REVENUE';
        // Query fee payments in scope
        const payments = await prisma_js_1.prisma.payment.findMany({
            where: {
                instituteId: { in: branchIds },
                paidAt: { gte: start, lte: queryEndDate },
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
        const grossCollection = Math.round(payments.reduce((sum, p) => sum + Number(p.amountPaid), 0) * 100) / 100;
        // Determine eligible revenue / profit pool based on calculationBasis
        let eligibleRevenue = grossCollection;
        let deductionsOrExpenses = 0;
        if (calculationBasis === 'NET_COURSE_REVENUE') {
            const adjustments = await prisma_js_1.prisma.paymentAdjustment.findMany({
                where: {
                    adjustmentType: 'REFUND',
                    payment: {
                        instituteId: { in: branchIds },
                        paidAt: { gte: start, lte: queryEndDate },
                        status: 'SUCCESS',
                    },
                },
                select: { amount: true },
            });
            deductionsOrExpenses =
                Math.round((adjustments.reduce((sum, a) => sum + Number(a.amount), 0) + Number(req.body.deductions || 0)) * 100) / 100;
            eligibleRevenue = Math.round(Math.max(0, grossCollection - deductionsOrExpenses) * 100) / 100;
        }
        else if (calculationBasis === 'PROFIT_AFTER_EXPENSES') {
            deductionsOrExpenses =
                Math.round(Number(req.body.deductibleExpenses ?? req.body.operatingExpenses ?? req.body.expenses ?? 0) * 100) / 100;
            eligibleRevenue = Math.round(Math.max(0, grossCollection - deductionsOrExpenses) * 100) / 100;
        }
        // 3. COMMERCIAL CALCULATION & HISTORICAL STUDENT ELIGIBILITY (AUDIT 2)
        let royaltyPayable = 0;
        let partnerShare = 0;
        let activeStudentCount = null;
        let perStudentFee = null;
        let annualRoyaltyAmount = null;
        if (calculationMethod === 'PER_STUDENT') {
            perStudentFee = Number(req.body.perStudentFee ?? applicableAgreement?.perStudentFee ?? 0);
            // Query candidate students in franchise branch(es) admitted on or before period end
            const candidateStudents = await prisma_js_1.prisma.student.findMany({
                where: {
                    instituteId: { in: branchIds },
                    OR: [
                        { admissionDate: { lte: queryEndDate } },
                        { createdAt: { lte: queryEndDate } },
                    ],
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    instituteId: true,
                    admissionDate: true,
                    createdAt: true,
                    updatedAt: true,
                    status: true,
                },
            });
            // Filter students eligible during [start, end]
            // 1. PASSED_OUT students are excluded per agreed commercial eligibility policy.
            // 2. ACTIVE students admitted on or before end are included (full-month policy for mid-period joiners).
            // 3. DISCONTINUED students: if they were discontinued AFTER end (e.g. discontinued in November for an August period),
            //    they were active during [start, end] and must count. If discontinued on or before end, they are excluded.
            const discontinuedCandidateIds = candidateStudents
                .filter((s) => s.status === 'DISCONTINUED')
                .map((s) => s.id);
            const statusLogsMap = new Map();
            if (discontinuedCandidateIds.length > 0) {
                const statusLogs = await prisma_js_1.prisma.auditLog.findMany({
                    where: {
                        entityType: 'Student',
                        entityId: { in: discontinuedCandidateIds },
                        action: 'STUDENT_STATUS_CHANGED',
                    },
                    orderBy: { createdAt: 'desc' },
                    select: { entityId: true, createdAt: true },
                });
                for (const log of statusLogs) {
                    if (!statusLogsMap.has(log.entityId)) {
                        statusLogsMap.set(log.entityId, log.createdAt);
                    }
                }
            }
            const eligibleStudents = [];
            for (const s of candidateStudents) {
                // Exclude alumni / passed out
                if (s.status === 'PASSED_OUT') {
                    continue;
                }
                // Student admitted after period end cannot count
                const effectiveAdmission = s.admissionDate || s.createdAt;
                if (effectiveAdmission > queryEndDate) {
                    continue;
                }
                if (s.status === 'ACTIVE') {
                    eligibleStudents.push(s);
                }
                else if (s.status === 'DISCONTINUED') {
                    // Determine when discontinuation occurred via AuditLog, fallback to updatedAt
                    const discontinuedAt = statusLogsMap.get(s.id) || s.updatedAt;
                    // If discontinuation occurred AFTER period end, student was active during this calculation period
                    if (discontinuedAt > queryEndDate) {
                        eligibleStudents.push(s);
                    }
                }
            }
            // Deduplicate by student ID across campuses
            const uniqueStudentMap = new Map();
            for (const s of eligibleStudents) {
                uniqueStudentMap.set(s.id, s);
            }
            activeStudentCount = uniqueStudentMap.size;
            royaltyPayable = Math.round(activeStudentCount * perStudentFee * 100) / 100;
            partnerShare = Math.round(Math.max(0, eligibleRevenue - royaltyPayable) * 100) / 100;
        }
        else if (calculationMethod === 'FIXED_ANNUAL') {
            annualRoyaltyAmount = Number(req.body.annualRoyaltyAmount ?? applicableAgreement?.annualRoyaltyAmount ?? 0);
            const monthlyFee = Math.round((annualRoyaltyAmount / 12) * 100) / 100;
            royaltyPayable = monthlyFee;
            partnerShare = Math.round(Math.max(0, eligibleRevenue - royaltyPayable) * 100) / 100;
        }
        else {
            // Default: PERCENTAGE_REVENUE
            royaltyPayable = Math.round(((eligibleRevenue * dgPercentage) / 100) * 100) / 100;
            partnerShare = Math.round((eligibleRevenue - royaltyPayable) * 100) / 100;
        }
        const dueDay = applicableAgreement?.dueDay || 10;
        const dueDate = new Date(end);
        if (dueDate.getDate() >= dueDay) {
            dueDate.setMonth(dueDate.getMonth() + 1);
        }
        dueDate.setDate(dueDay);
        const calculationDetailsPayload = {
            paymentCount: payments.length,
            calculationBasis,
            calculationMethod,
            perStudentFee,
            activeStudentCount,
            annualRoyaltyAmount,
            historicalEligibilityRule: calculationMethod === 'PER_STUDENT' ? 'ADMISSION_AND_DISCONTINUATION_DATE_SCOPED' : null,
            prorationPolicy: calculationMethod === 'PER_STUDENT' ? 'FULL_MONTH_STANDARD' : null,
            unresolvedEligibilityNotes: calculationMethod === 'PER_STUDENT'
                ? 'Full-period head-count applied for active students enrolled on or before period end date. Client commercial terms do not currently specify day-level proration for students joining or discontinuing mid-period. This rule requires formal client UAT sign-off.'
                : null,
            periodLabel,
            agreementId: applicableAgreement?.id || null,
            agreementVersion: applicableAgreement?.version || 1,
            agreementNumber: applicableAgreement?.agreementNumber || null,
            agreementType: applicableAgreement?.agreementType || 'CUSTOM_AGREEMENT',
            effectiveStartDate: applicableAgreement?.startDate ? applicableAgreement.startDate.toISOString().split('T')[0] : null,
            effectiveEndDate: applicableAgreement?.endDate ? applicableAgreement.endDate.toISOString().split('T')[0] : null,
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
            settlementFrequency: applicableAgreement?.settlementFrequency || 'MONTHLY',
            directPayerExpensesIgnored: true,
            zeroProfitFloorApplied: grossCollection < deductionsOrExpenses,
            paymentsSummary: payments.slice(0, 50),
            calculatedAt: new Date().toISOString(),
            calculatedById: req.user?.userId || null,
            calculatedByEmail: req.user?.email || null,
        };
        // 4. STATEMENT FINALIZATION & RECALCULATION GUARD (AUDIT 3 & AUDIT 4)
        let record = await prisma_js_1.prisma.franchiseRoyaltyRecord.findFirst({
            where: {
                franchiseId,
                periodLabel,
                instituteId: instituteId || null,
            },
            include: {
                payments: true,
            },
        });
        if (record) {
            const isFinalized = Boolean(record.status === 'PAID' ||
                Number(record.royaltyPaid) > 0 ||
                (record.payments && record.payments.length > 0));
            // AUDIT 4: Comprehensive comparison across every financially relevant field
            const existingDetails = record.calculationDetails || {};
            const existingAgreementId = existingDetails.agreementId || null;
            const proposedAgreementId = applicableAgreement?.id || null;
            const existingAgreementVersion = Number(existingDetails.agreementVersion || 1);
            const proposedAgreementVersion = Number(applicableAgreement?.version || 1);
            const existingCalculationBasis = existingDetails.calculationBasis || 'GROSS_COURSE_FEES';
            const proposedCalculationBasis = calculationBasis;
            const existingCalculationMethod = existingDetails.calculationMethod || 'PERCENTAGE_REVENUE';
            const proposedCalculationMethod = calculationMethod;
            const existingGrossCollection = Number(record.grossCollection);
            const proposedGrossCollection = grossCollection;
            const existingEligibleRevenue = Number(record.eligibleRevenue);
            const proposedEligibleRevenue = eligibleRevenue;
            const existingDeductibleExpenses = Number(existingDetails.deductibleExpenses ?? existingDetails.deductionsOrExpenses ?? 0);
            const proposedDeductibleExpenses = Number(deductionsOrExpenses);
            const existingDgPercentage = Number(record.royaltyPercentage);
            const proposedDgPercentage = dgPercentage;
            const existingPartnerPercentage = Number(existingDetails.partnerPercentage ?? (100 - existingDgPercentage));
            const proposedPartnerPercentage = partnerPercentage;
            const existingRoyaltyPayable = Number(record.royaltyPayable);
            const proposedRoyaltyPayable = royaltyPayable;
            const existingActiveStudentCount = existingDetails.activeStudentCount != null ? Number(existingDetails.activeStudentCount) : null;
            const proposedActiveStudentCount = activeStudentCount != null ? Number(activeStudentCount) : null;
            const existingPerStudentFee = existingDetails.perStudentFee != null ? Number(existingDetails.perStudentFee) : null;
            const proposedPerStudentFee = perStudentFee != null ? Number(perStudentFee) : null;
            const financiallyRelevantChanged = existingAgreementId !== proposedAgreementId ||
                existingAgreementVersion !== proposedAgreementVersion ||
                existingCalculationBasis !== proposedCalculationBasis ||
                existingCalculationMethod !== proposedCalculationMethod ||
                Math.abs(existingGrossCollection - proposedGrossCollection) > 0.01 ||
                Math.abs(existingEligibleRevenue - proposedEligibleRevenue) > 0.01 ||
                Math.abs(existingDeductibleExpenses - proposedDeductibleExpenses) > 0.01 ||
                Math.abs(existingDgPercentage - proposedDgPercentage) > 0.01 ||
                Math.abs(existingPartnerPercentage - proposedPartnerPercentage) > 0.01 ||
                Math.abs(existingRoyaltyPayable - proposedRoyaltyPayable) > 0.01 ||
                existingActiveStudentCount !== proposedActiveStudentCount ||
                (existingPerStudentFee != null && proposedPerStudentFee != null && Math.abs(existingPerStudentFee - proposedPerStudentFee) > 0.01);
            if (isFinalized && financiallyRelevantChanged) {
                const isCorrection = req.body.isCorrection === true;
                const correctionReason = req.body.correctionReason;
                if (isCorrection && req.user?.role !== 'SUPER_ADMIN') {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: Only Super Admin can perform authorized corrections on finalized royalty statements.',
                    });
                }
                if (!isCorrection || !correctionReason || typeof correctionReason !== 'string' || !correctionReason.trim()) {
                    return res.status(409).json({
                        success: false,
                        error: `Royalty statement for ${periodLabel} is finalized (Status: ${record.status}, Paid: ₹${Number(record.royaltyPaid)}) and cannot be modified without authorized correction. Please provide 'isCorrection: true' and a non-empty 'correctionReason'.`,
                        isFinalized: true,
                        royaltyRecord: record,
                    });
                }
                // AUDIT 3: Overpayment Accounting & Explicit Representation
                const paidAmount = Number(record.royaltyPaid);
                const overpaymentAmount = Math.max(0, paidAmount - royaltyPayable);
                const outstandingBalance = Math.max(0, royaltyPayable - paidAmount);
                if (overpaymentAmount > 0) {
                    calculationDetailsPayload.hasOverpayment = true;
                    calculationDetailsPayload.overpaymentAmount = overpaymentAmount;
                    calculationDetailsPayload.overpaymentStatus = 'AWAITING_CLIENT_DECISION';
                    calculationDetailsPayload.overpaymentNotes = `Overpayment of ₹${overpaymentAmount.toLocaleString('en-IN')} detected after authorized correction (Original payable: ₹${Number(record.royaltyPayable)}, Revised payable: ₹${royaltyPayable}, Remittances on record: ₹${paidAmount}). Accounting treatment is pending client commercial policy approval (credit carry-forward vs bank refund).`;
                }
                // Append to correction history
                const priorHistory = Array.isArray(existingDetails.correctionHistory) ? existingDetails.correctionHistory : [];
                const correctionEntry = {
                    correctionId: `CORR-${Date.now()}`,
                    correctedAt: new Date().toISOString(),
                    correctedById: req.user?.userId || null,
                    correctedByEmail: req.user?.email || null,
                    correctionReason: correctionReason.trim(),
                    previousSnapshot: {
                        grossCollection: Number(record.grossCollection),
                        eligibleRevenue: Number(record.eligibleRevenue),
                        royaltyPercentage: Number(record.royaltyPercentage),
                        royaltyPayable: Number(record.royaltyPayable),
                        royaltyPaid: paidAmount,
                        outstandingBalance: Number(record.outstandingBalance),
                        status: record.status,
                        agreementId: existingDetails.agreementId,
                        agreementVersion: existingDetails.agreementVersion,
                        calculationBasis: existingDetails.calculationBasis,
                        calculationMethod: existingDetails.calculationMethod,
                        activeStudentCount: existingDetails.activeStudentCount,
                        perStudentFee: existingDetails.perStudentFee,
                    },
                    newSnapshot: {
                        grossCollection,
                        eligibleRevenue,
                        royaltyPercentage: dgPercentage,
                        royaltyPayable,
                        royaltyPaid: paidAmount,
                        outstandingBalance,
                        overpaymentAmount,
                        overpaymentStatus: overpaymentAmount > 0 ? 'AWAITING_CLIENT_DECISION' : null,
                        status: outstandingBalance <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIALLY_PAID' : (new Date() > dueDate ? 'OVERDUE' : 'PENDING')),
                        agreementId: applicableAgreement?.id,
                        agreementVersion: applicableAgreement?.version,
                        calculationBasis,
                        calculationMethod,
                        activeStudentCount,
                        perStudentFee,
                    },
                    accountingTreatment: overpaymentAmount > 0 ? 'AWAITING_CLIENT_DECISION' : 'STANDARD_COLLECTION',
                };
                calculationDetailsPayload.correctionHistory = [...priorHistory, correctionEntry];
                calculationDetailsPayload.isCorrected = true;
                calculationDetailsPayload.lastCorrectionReason = correctionReason.trim();
                calculationDetailsPayload.lastCorrectedAt = correctionEntry.correctedAt;
                // Transactional execution of correction
                const targetRecordId = record.id;
                record = await prisma_js_1.prisma.$transaction(async (tx) => {
                    return await tx.franchiseRoyaltyRecord.update({
                        where: { id: targetRecordId },
                        data: {
                            grossCollection: new client_1.Prisma.Decimal(grossCollection),
                            eligibleRevenue: new client_1.Prisma.Decimal(eligibleRevenue),
                            royaltyPercentage: new client_1.Prisma.Decimal(dgPercentage),
                            royaltyPayable: new client_1.Prisma.Decimal(royaltyPayable),
                            outstandingBalance: new client_1.Prisma.Decimal(outstandingBalance),
                            status: (outstandingBalance <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIALLY_PAID' : (new Date() > dueDate ? 'OVERDUE' : 'PENDING'))),
                            calculationDetails: calculationDetailsPayload,
                        },
                        include: {
                            payments: true,
                        },
                    });
                });
            }
            else if (isFinalized && !financiallyRelevantChanged) {
                // Idempotent retrieval of finalized record without mutation
                const paidAmount = Number(record.royaltyPaid);
                const overpaymentAmount = Math.max(0, paidAmount - Number(record.royaltyPayable));
                return res.json({
                    success: true,
                    message: `Settlement for ${periodLabel} is finalized and verified with no changes.`,
                    data: {
                        royaltyRecord: record,
                        summary: {
                            periodLabel,
                            franchiseId,
                            branchId: instituteId || null,
                            agreementVersion: record.calculationDetails?.agreementVersion || applicableAgreement?.version || 1,
                            agreementType: record.calculationDetails?.agreementType || applicableAgreement?.agreementType || 'CUSTOM_AGREEMENT',
                            branchesCovered: branchIds.length,
                            paymentsCount: payments.length,
                            grossCollection: Number(record.grossCollection),
                            calculationBasis,
                            calculationMethod,
                            perStudentFee,
                            activeStudentCount,
                            annualRoyaltyAmount,
                            deductionsOrExpenses,
                            deductibleExpenses: calculationBasis === 'PROFIT_AFTER_EXPENSES' ? deductionsOrExpenses : 0,
                            refundsAndAdjustments: calculationBasis === 'NET_COURSE_REVENUE' ? deductionsOrExpenses : 0,
                            eligibleRevenue: Number(record.eligibleRevenue),
                            distributableAmount: Number(record.eligibleRevenue),
                            royaltyPercentage: Number(record.royaltyPercentage),
                            digitalGuruRevenuePercentage: dgPercentage,
                            partnerRevenuePercentage: partnerPercentage,
                            royaltyPayable: Number(record.royaltyPayable),
                            digitalGuruShare: Number(record.royaltyPayable),
                            superAdminShare: Number(record.royaltyPayable),
                            partnerShare,
                            franchiseOwnerShare: partnerShare,
                            settlementFrequency: applicableAgreement?.settlementFrequency || 'MONTHLY',
                            directPayerExpensesIgnored: true,
                            calculatedAt: record.calculationDetails?.calculatedAt || new Date().toISOString(),
                            calculatedBy: req.user?.email || req.user?.userId,
                            isFinalized: true,
                            hasOverpayment: overpaymentAmount > 0,
                            overpaymentAmount,
                            overpaymentStatus: overpaymentAmount > 0 ? 'AWAITING_CLIENT_DECISION' : null,
                        },
                    },
                });
            }
            else {
                // Open draft statement: update in-place idempotently
                const paidAmount = Number(record.royaltyPaid);
                const outstanding = Math.max(0, royaltyPayable - paidAmount);
                const status = outstanding <= 0
                    ? 'PAID'
                    : paidAmount > 0
                        ? 'PARTIALLY_PAID'
                        : new Date() > dueDate
                            ? 'OVERDUE'
                            : 'PENDING';
                record = await prisma_js_1.prisma.franchiseRoyaltyRecord.update({
                    where: { id: record.id },
                    data: {
                        grossCollection: new client_1.Prisma.Decimal(grossCollection),
                        eligibleRevenue: new client_1.Prisma.Decimal(eligibleRevenue),
                        royaltyPercentage: new client_1.Prisma.Decimal(dgPercentage),
                        royaltyPayable: new client_1.Prisma.Decimal(royaltyPayable),
                        outstandingBalance: new client_1.Prisma.Decimal(outstanding),
                        status: status,
                        calculationDetails: calculationDetailsPayload,
                    },
                    include: {
                        payments: true,
                    },
                });
            }
        }
        else {
            const status = new Date() > dueDate ? 'OVERDUE' : 'PENDING';
            record = await prisma_js_1.prisma.franchiseRoyaltyRecord.create({
                data: {
                    franchiseId,
                    instituteId: instituteId || null,
                    periodLabel,
                    startDate: start,
                    endDate: end,
                    grossCollection: new client_1.Prisma.Decimal(grossCollection),
                    eligibleRevenue: new client_1.Prisma.Decimal(eligibleRevenue),
                    royaltyPercentage: new client_1.Prisma.Decimal(dgPercentage),
                    royaltyPayable: new client_1.Prisma.Decimal(royaltyPayable),
                    royaltyPaid: new client_1.Prisma.Decimal(0.0),
                    outstandingBalance: new client_1.Prisma.Decimal(royaltyPayable),
                    status: status,
                    dueDate,
                    calculationDetails: calculationDetailsPayload,
                },
                include: {
                    payments: true,
                },
            });
        }
        const paidAmount = Number(record.royaltyPaid);
        const overpaymentAmount = Math.max(0, paidAmount - Number(record.royaltyPayable));
        const outstandingBalance = Number(record.outstandingBalance);
        return res.json({
            success: true,
            message: `Settlement for ${periodLabel} calculated successfully at ${dgPercentage}% (DG) : ${partnerPercentage}% (Partner) on ${calculationBasis}`,
            data: {
                royaltyRecord: record,
                summary: {
                    periodLabel,
                    franchiseId,
                    branchId: instituteId || null,
                    agreementVersion: applicableAgreement?.version || 1,
                    agreementType: applicableAgreement?.agreementType || 'CUSTOM_AGREEMENT',
                    branchesCovered: branchIds.length,
                    paymentsCount: payments.length,
                    grossCollection,
                    calculationBasis,
                    calculationMethod,
                    perStudentFee,
                    activeStudentCount,
                    annualRoyaltyAmount,
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
                    settlementFrequency: applicableAgreement?.settlementFrequency || 'MONTHLY',
                    directPayerExpensesIgnored: true,
                    calculatedAt: new Date().toISOString(),
                    calculatedBy: req.user?.email || req.user?.userId,
                    royaltyPaid: paidAmount,
                    outstandingBalance,
                    hasOverpayment: overpaymentAmount > 0,
                    overpaymentAmount,
                    overpaymentStatus: overpaymentAmount > 0 ? 'AWAITING_CLIENT_DECISION' : null,
                },
            },
        });
    }
    catch (err) {
        console.error('[Calculate Royalty Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to calculate royalty' });
    }
}
async function listRoyaltyRecords(req, res) {
    try {
        const { id: franchiseId } = req.params;
        const isSuperAdminAll = franchiseId === 'all' && req.user.role === 'SUPER_ADMIN';
        if (!isSuperAdminAll) {
            const { authorized } = await verifyFranchiseAccess(req.user.userId, req.user.role, franchiseId);
            if (!authorized) {
                return res.status(403).json({ success: false, error: 'Forbidden' });
            }
        }
        const whereClause = isSuperAdminAll ? {} : { franchiseId };
        const records = await prisma_js_1.prisma.franchiseRoyaltyRecord.findMany({
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
    }
    catch (err) {
        console.error('[List Royalty Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list royalty records' });
    }
}
async function recordRoyaltyPayment(req, res) {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Only Super Admin can record royalty payments' });
        }
        const { id: franchiseId } = req.params;
        const { royaltyRecordId, amountPaid, paymentMethod, transactionReference, remarks, paymentDate } = req.body;
        if (!amountPaid || Number(amountPaid) <= 0 || isNaN(Number(amountPaid))) {
            return res.status(400).json({ success: false, error: 'Amount paid must be a valid number greater than zero' });
        }
        const paidAmount = Number(amountPaid);
        const paymentDateTime = paymentDate ? new Date(paymentDate) : new Date();
        if (isNaN(paymentDateTime.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid paymentDate format' });
        }
        const franchise = await prisma_js_1.prisma.franchise.findUnique({ where: { id: franchiseId } });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        if (franchise.status === 'TERMINATED') {
            return res.status(400).json({ success: false, error: 'Cannot record royalty payments for a terminated franchise' });
        }
        if (royaltyRecordId) {
            const targetRecord = await prisma_js_1.prisma.franchiseRoyaltyRecord.findUnique({
                where: { id: royaltyRecordId },
            });
            if (!targetRecord || targetRecord.franchiseId !== franchiseId) {
                return res.status(404).json({ success: false, error: 'Royalty statement record not found for this franchise' });
            }
            if (targetRecord.status === 'PAID' && Number(targetRecord.outstandingBalance) <= 0) {
                return res.status(400).json({ success: false, error: 'This royalty statement has already been fully paid' });
            }
            if (paidAmount > Number(targetRecord.outstandingBalance)) {
                return res.status(400).json({
                    success: false,
                    error: `Payment amount of ₹${paidAmount.toLocaleString('en-IN')} exceeds the outstanding balance of ₹${Number(targetRecord.outstandingBalance).toLocaleString('en-IN')} for this royalty statement.`,
                });
            }
        }
        let result;
        try {
            result = await prisma_js_1.prisma.$transaction(async (tx) => {
                if (transactionReference && transactionReference.trim()) {
                    const existingPayment = await tx.franchiseRoyaltyPayment.findFirst({
                        where: { franchiseId, transactionReference: transactionReference.trim() },
                    });
                    if (existingPayment) {
                        throw new Error('DUPLICATE_REFERENCE');
                    }
                }
                if (royaltyRecordId) {
                    const freshRecCheck = await tx.franchiseRoyaltyRecord.findUnique({ where: { id: royaltyRecordId } });
                    if (!freshRecCheck) {
                        throw new Error('RECORD_NOT_FOUND');
                    }
                    if (paidAmount > Number(freshRecCheck.outstandingBalance)) {
                        throw new Error('OVERPAYMENT_CONCURRENT');
                    }
                }
                const receiptNumber = await generateRoyaltyReceiptNumber(tx);
                const payment = await tx.franchiseRoyaltyPayment.create({
                    data: {
                        franchiseId,
                        royaltyRecordId: royaltyRecordId || null,
                        receiptNumber,
                        amountPaid: new client_1.Prisma.Decimal(paidAmount),
                        paymentDate: paymentDateTime,
                        paymentMethod: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].includes(paymentMethod)
                            ? paymentMethod
                            : 'BANK_TRANSFER',
                        transactionReference: transactionReference?.trim() || null,
                        remarks: remarks || null,
                        recordedById: req.user.userId,
                    },
                });
                let updatedRecord = null;
                if (royaltyRecordId) {
                    const freshRecord = await tx.franchiseRoyaltyRecord.findUnique({
                        where: { id: royaltyRecordId },
                    });
                    if (freshRecord) {
                        const currentPaid = Number(freshRecord.royaltyPaid || 0);
                        const newPaid = Math.round((currentPaid + paidAmount) * 100) / 100;
                        const newOutstanding = Math.max(0, Math.round((Number(freshRecord.royaltyPayable) - newPaid) * 100) / 100);
                        const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
                        updatedRecord = await tx.franchiseRoyaltyRecord.update({
                            where: { id: royaltyRecordId },
                            data: {
                                royaltyPaid: new client_1.Prisma.Decimal(newPaid),
                                outstandingBalance: new client_1.Prisma.Decimal(newOutstanding),
                                status: newStatus,
                            },
                        });
                    }
                }
                return { payment, updatedRecord };
            }, {
                maxWait: 15000,
                timeout: 30000,
            });
        }
        catch (txErr) {
            if (txErr.message === 'DUPLICATE_REFERENCE') {
                return res.status(409).json({
                    success: false,
                    error: `Payment with transaction reference "${transactionReference?.trim()}" has already been recorded for this franchise.`,
                });
            }
            if (txErr.message === 'OVERPAYMENT_CONCURRENT') {
                return res.status(400).json({
                    success: false,
                    error: 'Payment amount exceeds current outstanding balance on this royalty statement.',
                });
            }
            throw txErr;
        }
        return res.status(201).json({
            success: true,
            message: 'Royalty payment recorded successfully',
            data: { payment: result.payment, royaltyRecord: result.updatedRecord },
        });
    }
    catch (err) {
        console.error('[Record Royalty Payment Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to record royalty payment' });
    }
}
// ============================================================================
// 6. DASHBOARDS (SUPER ADMIN & FRANCHISE OWNER)
// ============================================================================
async function getSuperAdminFranchiseDashboard(req, res) {
    try {
        const cacheKey = 'franchises:dashboard:super-admin';
        const cached = cache_js_1.serverCache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const fetchDashboard = async () => {
            const [totalFranchises, activeFranchises, suspendedFranchises, totalBranches, totalStudents, installmentAgg, recentPayments, activeAgreements, allInstallments,] = await Promise.all([
                prisma_js_1.prisma.franchise.count(),
                prisma_js_1.prisma.franchise.count({ where: { status: 'ACTIVE' } }),
                prisma_js_1.prisma.franchise.count({ where: { status: 'SUSPENDED' } }),
                prisma_js_1.prisma.institute.count({ where: { franchiseId: { not: null } } }),
                prisma_js_1.prisma.student.count({ where: { status: 'ACTIVE' } }),
                prisma_js_1.prisma.franchiseRoyaltyInstallment.aggregate({
                    _sum: {
                        amount: true,
                        paidAmount: true,
                        outstandingBalance: true,
                    },
                }),
                prisma_js_1.prisma.franchiseRoyaltyPayment.findMany({
                    take: 6,
                    orderBy: { paymentDate: 'desc' },
                    include: {
                        franchise: { select: { name: true, code: true } },
                        installment: { select: { installmentNumber: true, periodLabel: true } },
                    },
                }),
                prisma_js_1.prisma.franchiseAgreement.findMany({
                    where: { status: 'ACTIVE' },
                    include: { franchise: { select: { name: true, code: true } } },
                    orderBy: { endDate: 'asc' },
                    take: 10,
                }),
                prisma_js_1.prisma.franchiseRoyaltyInstallment.findMany({
                    take: 200,
                    select: {
                        id: true,
                        installmentNumber: true,
                        periodLabel: true,
                        dueDate: true,
                        amount: true,
                        paidAmount: true,
                        outstandingBalance: true,
                        status: true,
                        franchise: { select: { name: true, code: true } },
                        agreement: { select: { agreementNumber: true, title: true } },
                    },
                    orderBy: { dueDate: 'asc' },
                }),
            ]);
            const now = new Date();
            const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
            const upcomingRenewals = activeAgreements.filter((a) => new Date(a.endDate) <= in60Days && new Date(a.endDate) >= now);
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
        }
        catch (transientErr) {
            console.warn('[Dashboard Warning] Reconnecting to Neon...');
            await prisma_js_1.prisma.$disconnect().catch(() => { });
            await prisma_js_1.prisma.$connect().catch(() => { });
            data = await fetchDashboard();
        }
        const responsePayload = {
            success: true,
            data,
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 60000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[Super Admin Franchise Dashboard Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to load Super Admin Franchise Dashboard' });
    }
}
async function getFranchiseOwnerDashboard(req, res) {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const rawBranchId = req.query.branchId || req.headers['x-institute-id'] || undefined;
        // Cache lookup for rapid re-entry
        const cacheKey = `franchises:dashboard:owner:${userId}:${rawBranchId || 'all'}`;
        const cached = cache_js_1.serverCache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Support Super Admin inspecting a franchise, or Franchise Owner inspecting their own franchise
        let franchiseWhere = { ownerUserId: userId };
        if (userRole === 'SUPER_ADMIN' && req.query.franchiseId) {
            franchiseWhere = { id: req.query.franchiseId };
        }
        const franchise = await prisma_js_1.prisma.franchise.findFirst({
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
        const allBranchIds = franchise.branches.map((b) => b.id);
        let targetBranchIds = allBranchIds;
        let selectedBranch = null;
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
        // Today date bounds & start of month
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        // Consolidated single Promise.all across top KPIs & branch groupings (Zero N+1)
        const [totalStudents, totalStaff, activeBatches, todayPresent, todayLate, monthlyPaymentAgg, monthlyRefundAgg, totalPaymentAgg, totalRefundAgg, pendingAssignments, upcomingExamsList, upcomingExamsCount, homeworkCount, materialsCount, studentCountsByBranch, staffCountsByBranch, batchCountsByBranch, attendanceByBranch, totalPaymentsByBranch, monthlyPaymentsByBranch,] = await Promise.all([
            prisma_js_1.prisma.student.count({
                where: { instituteId: { in: targetBranchIds }, status: 'ACTIVE' },
            }),
            prisma_js_1.prisma.staffProfile.count({
                where: { instituteId: { in: targetBranchIds }, user: { isActive: true } },
            }),
            prisma_js_1.prisma.batch.count({
                where: { instituteId: { in: targetBranchIds }, isActive: true },
            }),
            prisma_js_1.prisma.attendanceEvent.count({
                where: {
                    instituteId: { in: targetBranchIds },
                    eventDate: { gte: todayStart, lte: todayEnd },
                    eventType: 'CHECK_IN',
                },
            }),
            prisma_js_1.prisma.attendanceEvent.count({
                where: {
                    instituteId: { in: targetBranchIds },
                    eventDate: { gte: todayStart, lte: todayEnd },
                    eventType: 'CHECK_IN',
                    isLate: true,
                },
            }),
            prisma_js_1.prisma.payment.aggregate({
                where: {
                    instituteId: { in: targetBranchIds },
                    status: 'SUCCESS',
                    paidAt: { gte: startOfMonth },
                },
                _sum: { amountPaid: true },
            }),
            prisma_js_1.prisma.paymentAdjustment.aggregate({
                where: {
                    adjustmentType: 'REFUND',
                    payment: {
                        instituteId: { in: targetBranchIds },
                        status: 'SUCCESS',
                        paidAt: { gte: startOfMonth },
                    },
                },
                _sum: { amount: true },
            }),
            prisma_js_1.prisma.payment.aggregate({
                where: {
                    instituteId: { in: targetBranchIds },
                    status: 'SUCCESS',
                },
                _sum: { amountPaid: true },
            }),
            prisma_js_1.prisma.paymentAdjustment.aggregate({
                where: {
                    adjustmentType: 'REFUND',
                    payment: {
                        instituteId: { in: targetBranchIds },
                        status: 'SUCCESS',
                    },
                },
                _sum: { amount: true },
            }),
            prisma_js_1.prisma.studentFeeAssignment.findMany({
                where: {
                    student: { instituteId: { in: allBranchIds } },
                    status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
                },
                select: {
                    finalAmount: true,
                    student: { select: { instituteId: true } },
                    payments: {
                        where: { status: 'SUCCESS' },
                        select: {
                            amountPaid: true,
                            adjustments: { where: { adjustmentType: 'REFUND' }, select: { amount: true } },
                        },
                    },
                },
            }),
            prisma_js_1.prisma.examination.findMany({
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
            }),
            prisma_js_1.prisma.examination.count({
                where: {
                    instituteId: { in: targetBranchIds },
                    examDate: { gte: todayStart },
                },
            }),
            prisma_js_1.prisma.learningMaterial.count({
                where: { instituteId: { in: targetBranchIds }, type: 'HOMEWORK' },
            }),
            prisma_js_1.prisma.learningMaterial.count({
                where: { instituteId: { in: targetBranchIds }, type: { not: 'HOMEWORK' } },
            }),
            // Branch-level grouped metrics (1 query each instead of per-branch sequential queries)
            prisma_js_1.prisma.student.groupBy({
                by: ['instituteId'],
                where: { instituteId: { in: allBranchIds }, status: 'ACTIVE' },
                _count: true,
            }),
            prisma_js_1.prisma.staffProfile.groupBy({
                by: ['instituteId'],
                where: { instituteId: { in: allBranchIds }, user: { isActive: true } },
                _count: true,
            }),
            prisma_js_1.prisma.batch.groupBy({
                by: ['instituteId'],
                where: { instituteId: { in: allBranchIds }, isActive: true },
                _count: true,
            }),
            prisma_js_1.prisma.attendanceEvent.groupBy({
                by: ['instituteId'],
                where: {
                    instituteId: { in: allBranchIds },
                    eventDate: { gte: todayStart, lte: todayEnd },
                    eventType: 'CHECK_IN',
                },
                _count: true,
            }),
            prisma_js_1.prisma.payment.groupBy({
                by: ['instituteId'],
                where: { instituteId: { in: allBranchIds }, status: 'SUCCESS' },
                _sum: { amountPaid: true },
            }),
            prisma_js_1.prisma.payment.groupBy({
                by: ['instituteId'],
                where: { instituteId: { in: allBranchIds }, status: 'SUCCESS', paidAt: { gte: startOfMonth } },
                _sum: { amountPaid: true },
            }),
        ]);
        const todayAbsent = Math.max(0, totalStudents - todayPresent);
        const todayTotalMarked = totalStudents > 0 ? totalStudents : todayPresent;
        const attendanceRate = todayTotalMarked > 0 ? Number(((todayPresent / todayTotalMarked) * 100).toFixed(1)) : 100.0;
        const monthlyFeeCollection = Math.max(0, Math.round((Number(monthlyPaymentAgg._sum?.amountPaid || 0) - Number(monthlyRefundAgg._sum?.amount || 0)) * 100) / 100);
        const totalRevenue = Math.max(0, Math.round((Number(totalPaymentAgg._sum?.amountPaid || 0) - Number(totalRefundAgg._sum?.amount || 0)) * 100) / 100);
        // Group maps for branch-level cards
        const studentCountMap = new Map();
        studentCountsByBranch.forEach((s) => { if (s.instituteId)
            studentCountMap.set(s.instituteId, s._count); });
        const staffCountMap = new Map();
        staffCountsByBranch.forEach((s) => { if (s.instituteId)
            staffCountMap.set(s.instituteId, s._count); });
        const batchCountMap = new Map();
        batchCountsByBranch.forEach((b) => { if (b.instituteId)
            batchCountMap.set(b.instituteId, b._count); });
        const attendanceMap = new Map();
        attendanceByBranch.forEach((a) => { if (a.instituteId)
            attendanceMap.set(a.instituteId, a._count); });
        const totalRevenueMap = new Map();
        totalPaymentsByBranch.forEach((p) => { if (p.instituteId)
            totalRevenueMap.set(p.instituteId, Number(p._sum?.amountPaid || 0)); });
        const monthlyRevenueMap = new Map();
        monthlyPaymentsByBranch.forEach((p) => { if (p.instituteId)
            monthlyRevenueMap.set(p.instituteId, Number(p._sum?.amountPaid || 0)); });
        // Group pending fees by branch and top KPI in a single in-memory pass
        const pendingByBranchMap = new Map();
        let topPendingFees = 0;
        for (const a of pendingAssignments) {
            const netPaidSum = a.payments.reduce((acc, p) => {
                const refunded = (p.adjustments || []).reduce((rAcc, adj) => rAcc + Number(adj.amount), 0);
                return acc + Number(p.amountPaid) - refunded;
            }, 0);
            const remaining = Math.max(0, Number(a.finalAmount) - netPaidSum);
            const bId = a.student?.instituteId;
            if (bId) {
                pendingByBranchMap.set(bId, (pendingByBranchMap.get(bId) || 0) + remaining);
                if (targetBranchIds.includes(bId)) {
                    topPendingFees += remaining;
                }
            }
        }
        const pendingFees = Math.round(topPendingFees * 100) / 100;
        // Fast in-memory assembly of branch cards (Zero database roundtrips)
        const branchCards = franchise.branches.map((b) => {
            const bStudents = studentCountMap.get(b.id) || 0;
            const bStaff = staffCountMap.get(b.id) || 0;
            const bBatches = batchCountMap.get(b.id) || 0;
            const bTotalRev = Math.round((totalRevenueMap.get(b.id) || 0) * 100) / 100;
            const bMonthlyRev = Math.round((monthlyRevenueMap.get(b.id) || 0) * 100) / 100;
            const bPresent = attendanceMap.get(b.id) || 0;
            const bAbsent = Math.max(0, bStudents - bPresent);
            const bTotalMarked = bStudents > 0 ? bStudents : bPresent;
            const bRate = bTotalMarked > 0 ? Number(((bPresent / bTotalMarked) * 100).toFixed(1)) : 100.0;
            const bPending = Math.round((pendingByBranchMap.get(b.id) || 0) * 100) / 100;
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
                totalRevenue: bTotalRev,
                monthlyRevenue: bMonthlyRev,
                pendingFees: bPending,
                attendanceRate: bRate,
                todayAttendance: {
                    present: bPresent,
                    absent: bAbsent,
                    totalMarked: bTotalMarked,
                    rate: bRate,
                },
            };
        });
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
        const responsePayload = {
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
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 15000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[Franchise Owner Dashboard Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to load Franchisee Admin Dashboard' });
    }
}
// ============================================================================
// CENTRALIZED REVENUE SHARING & BENEFICIARY MANAGEMENT (RULES 3-9, SECTION G)
// ============================================================================
exports.updateRevenueShareSchema = zod_1.z.object({
    revenueSharePercentage: zod_1.z.number().min(0).max(100, 'Franchise revenue percentage must be between 0% and 100%'),
});
exports.updateBeneficiaryAccountSchema = zod_1.z.object({
    razorpayAccountId: zod_1.z.string().optional().nullable(),
    beneficiaryName: zod_1.z.string().min(2, 'Beneficiary name is required'),
    beneficiaryBankName: zod_1.z.string().min(2, 'Bank name is required'),
    beneficiaryAccountNumber: zod_1.z.string().min(6, 'Valid bank account number required'),
    beneficiaryIfsc: zod_1.z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Valid 11-character Indian IFSC code required (e.g. HDFC0001234)'),
    beneficiaryStatus: zod_1.z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
});
/**
 * Super Admin updates franchise revenue sharing percentage (Rules 3, 5, 6, 7)
 */
async function updateRevenueShare(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateRevenueShareSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { revenueSharePercentage } = parse.data;
        const digitalGuruRevenuePercentage = Number((100 - revenueSharePercentage).toFixed(2));
        const franchise = await prisma_js_1.prisma.franchise.findUnique({ where: { id } });
        if (!franchise) {
            return res.status(404).json({ success: false, error: 'Franchise not found' });
        }
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const record = await tx.franchise.update({
                where: { id },
                data: {
                    revenueSharePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                    digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                },
            });
            // Update active agreement if one exists so commercial terms stay in sync
            const activeAgreement = await tx.franchiseAgreement.findFirst({
                where: { franchiseId: id, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
            });
            if (activeAgreement) {
                await tx.franchiseAgreement.update({
                    where: { id: activeAgreement.id },
                    data: {
                        partnerRevenuePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                        digitalGuruRevenuePercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                        royaltyPercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                    },
                });
            }
            // Update pending / draft settlements for immediate consistency
            const pendingSettlements = await tx.franchiseSettlement.findMany({
                where: {
                    franchiseId: id,
                    status: { in: ['DRAFT', 'PENDING_APPROVAL', 'PENDING_REVIEW'] },
                },
            });
            for (const s of pendingSettlements) {
                const netCollections = Number(s.totalEligibleCollections);
                const newFranchiseShare = Math.round(netCollections * (revenueSharePercentage / 100) * 100) / 100;
                const newDgShare = Math.round((netCollections - newFranchiseShare) * 100) / 100;
                const totalTransferred = Number(s.totalTransferredAmount || 0);
                const newRemaining = Math.max(0, Math.round((newFranchiseShare - totalTransferred) * 100) / 100);
                await tx.franchiseSettlement.update({
                    where: { id: s.id },
                    data: {
                        applicableFranchisePercentage: new client_1.Prisma.Decimal(revenueSharePercentage),
                        applicableDigitalGuruPercentage: new client_1.Prisma.Decimal(digitalGuruRevenuePercentage),
                        franchisePayableAmount: new client_1.Prisma.Decimal(newFranchiseShare),
                        digitalGuruShareAmount: new client_1.Prisma.Decimal(newDgShare),
                        remainingPayableAmount: new client_1.Prisma.Decimal(newRemaining),
                    },
                });
            }
            await tx.auditLog.create({
                data: {
                    userId: req.user.userId,
                    action: 'FRANCHISE_REVENUE_PERCENTAGE_UPDATED',
                    entityType: 'Franchise',
                    entityId: id,
                    oldValues: {
                        revenueSharePercentage: Number(franchise.revenueSharePercentage),
                        digitalGuruRevenuePercentage: Number(franchise.digitalGuruRevenuePercentage),
                    },
                    newValues: {
                        revenueSharePercentage,
                        digitalGuruRevenuePercentage,
                    },
                },
            });
            return record;
        });
        cache_js_1.serverCache.invalidate();
        return res.json({
            success: true,
            message: `Franchise revenue percentage updated to ${revenueSharePercentage}% (DigitalGhuru: ${digitalGuruRevenuePercentage}%)`,
            data: {
                id: updated.id,
                revenueSharePercentage: Number(updated.revenueSharePercentage),
                digitalGuruRevenuePercentage: Number(updated.digitalGuruRevenuePercentage),
            },
        });
    }
    catch (err) {
        console.error('[Update Revenue Share Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update revenue sharing percentage' });
    }
}
/**
 * Update franchise beneficiary account details (Section G)
 */
async function updateBeneficiaryAccount(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.userId;
        const access = await verifyFranchiseAccess(userId, userRole, id);
        if (!access.authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify this franchise' });
        }
        const parse = exports.updateBeneficiaryAccountSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const data = parse.data;
        // Only Super Admin can mark a beneficiary VERIFIED
        let targetStatus = data.beneficiaryStatus || 'PENDING';
        if (userRole !== 'SUPER_ADMIN') {
            targetStatus = 'PENDING';
        }
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const record = await tx.franchise.update({
                where: { id },
                data: {
                    razorpayAccountId: data.razorpayAccountId || undefined,
                    beneficiaryName: data.beneficiaryName,
                    beneficiaryBankName: data.beneficiaryBankName,
                    beneficiaryAccountNumber: data.beneficiaryAccountNumber,
                    beneficiaryIfsc: data.beneficiaryIfsc.toUpperCase(),
                    beneficiaryStatus: targetStatus,
                },
            });
            await tx.auditLog.create({
                data: {
                    userId: req.user.userId,
                    action: 'FRANCHISE_BENEFICIARY_ACCOUNT_UPDATED',
                    entityType: 'Franchise',
                    entityId: id,
                    newValues: {
                        beneficiaryName: data.beneficiaryName,
                        bankName: data.beneficiaryBankName,
                        ifsc: data.beneficiaryIfsc.toUpperCase(),
                        razorpayAccountId: data.razorpayAccountId,
                        status: targetStatus,
                    },
                },
            });
            return record;
        });
        cache_js_1.serverCache.invalidate();
        return res.json({
            success: true,
            message: 'Beneficiary account details saved successfully',
            data: {
                id: updated.id,
                beneficiaryName: updated.beneficiaryName,
                beneficiaryBankName: updated.beneficiaryBankName,
                beneficiaryAccountNumber: `****${updated.beneficiaryAccountNumber?.slice(-4)}`,
                beneficiaryIfsc: updated.beneficiaryIfsc,
                razorpayAccountId: updated.razorpayAccountId,
                beneficiaryStatus: updated.beneficiaryStatus,
            },
        });
    }
    catch (err) {
        console.error('[Update Beneficiary Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update beneficiary account' });
    }
}
/**
 * Franchise Owner Revenue & Settlement Overview (Section H)
 */
async function getFranchiseRevenueDashboard(req, res) {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.userId;
        const access = await verifyFranchiseAccess(userId, userRole, id);
        if (!access.authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden: Access to franchise financial records denied' });
        }
        const franchise = access.franchise;
        // Current month in Asia/Kolkata
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        // Get all settlements for this franchise
        const settlements = await prisma_js_1.prisma.franchiseSettlement.findMany({
            where: { franchiseId: id },
            orderBy: { settlementMonth: 'desc' },
            include: {
                approvedBy: { select: { fullName: true } },
                _count: { select: { payments: true, transfers: true } },
            },
        });
        // Compute live metrics
        let totalPaidToFranchise = 0;
        let pendingApprovalAmount = 0;
        let approvedPendingTransferAmount = 0;
        let totalEligibleAllTime = 0;
        for (const s of settlements) {
            const payable = Number(s.franchisePayableAmount);
            totalEligibleAllTime += Number(s.totalEligibleCollections);
            if (s.status === 'COMPLETED') {
                totalPaidToFranchise += payable;
            }
            else if (s.status === 'PENDING_APPROVAL') {
                pendingApprovalAmount += payable;
            }
            else if (s.status === 'APPROVED') {
                approvedPendingTransferAmount += payable;
            }
        }
        return res.json({
            success: true,
            data: {
                franchise: {
                    id: franchise.id,
                    code: franchise.code,
                    name: franchise.name,
                    revenueSharePercentage: Number(franchise.revenueSharePercentage || 50),
                    digitalGuruRevenuePercentage: Number(franchise.digitalGuruRevenuePercentage || 50),
                    razorpayAccountId: franchise.razorpayAccountId,
                    beneficiaryName: franchise.beneficiaryName,
                    beneficiaryBankName: franchise.beneficiaryBankName,
                    beneficiaryAccountNumber: franchise.beneficiaryAccountNumber ? `****${franchise.beneficiaryAccountNumber.slice(-4)}` : null,
                    beneficiaryIfsc: franchise.beneficiaryIfsc,
                    beneficiaryStatus: franchise.beneficiaryStatus,
                    branchesCount: franchise.branches?.length || 0,
                },
                currentMonth: currentMonthStr,
                metrics: {
                    totalEligibleAllTime: Number(totalEligibleAllTime.toFixed(2)),
                    totalPaidToFranchise: Number(totalPaidToFranchise.toFixed(2)),
                    pendingApprovalAmount: Number(pendingApprovalAmount.toFixed(2)),
                    approvedPendingTransferAmount: Number(approvedPendingTransferAmount.toFixed(2)),
                    completedSettlementsCount: settlements.filter((s) => s.status === 'COMPLETED').length,
                    pendingSettlementsCount: settlements.filter((s) => s.status === 'PENDING_APPROVAL').length,
                },
                settlements,
                branches: franchise.branches,
            },
        });
    }
    catch (err) {
        console.error('[Franchise Revenue Dashboard Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to load revenue dashboard' });
    }
}
