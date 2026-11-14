import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import { Franchise, FranchiseAgreement, FranchiseRoyaltyInstallment } from '../types';
import {
  Building2,
  DollarSign,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Users,
  ChevronRight,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  ExternalLink,
  Edit3,
  ShieldCheck,
  RefreshCw,
  Key,
  MapPin,
  Phone,
  Mail,
  Globe,
  Info,
  X,
  Printer,
  Lock,
  Check,
  Loader2,
  Eye,
  Copy,
  GraduationCap,
  UserX,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const FranchiseManagement: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'franchises' | 'agreements' | 'installments' | 'monthly_settlements'>('franchises');
  const [loading, setLoading] = useState(true);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Lists
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedFranchiseFilter, setSelectedFranchiseFilter] = useState<string>('ALL');

  // Monthly Royalty Records & Calculations
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [calculateForm, setCalculateForm] = useState({
    franchiseId: '',
    periodLabel: new Date().toISOString().slice(0, 7),
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    revenueCalculationBasis: 'GROSS_COURSE_FEES',
    deductibleExpenses: 0,
    deductions: 0,
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'profile' | 'model' | 'financials' | 'review'>('profile');
  const [createdResultModal, setCreatedResultModal] = useState<any>(null);
  const createModalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCreateModal) {
      createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [createModalTab, showCreateModal]);

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [selectedFranchiseForBranch, setSelectedFranchiseForBranch] = useState<Franchise | null>(null);
  const [branchModalMode, setBranchModalMode] = useState<'existing' | 'new'>('existing');
  const [unassignedBranches, setUnassignedBranches] = useState<any[]>([]);
  const [selectedExistingBranchId, setSelectedExistingBranchId] = useState('');
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<string | null>(null);

  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [selectedInstallmentForPayment, setSelectedInstallmentForPayment] = useState<any>(null);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedAgreementForRenew, setSelectedAgreementForRenew] = useState<any>(null);

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedFranchiseForReset, setSelectedFranchiseForReset] = useState<any>(null);
  const [resetResult, setResetResult] = useState<any>(null);

  // Franchise Details Drawer State
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [showAmendModal, setShowAmendModal] = useState(false);
  const [selectedAgreementForAmend, setSelectedAgreementForAmend] = useState<any>(null);

  // Revision Modal State
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [selectedAgreementForRevise, setSelectedAgreementForRevise] = useState<any>(null);
  const [selectedFranchiseForRevise, setSelectedFranchiseForRevise] = useState<any>(null);
  const [reviseForm, setReviseForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    agreementType: 'NEW_CENTRE_JOINT_INVESTMENT' as any,
    calculationMethod: 'PERCENTAGE_REVENUE' as any,
    annualRoyaltyAmount: 200000,
    perStudentFee: 2000,
    royaltyPercentage: 50.0,
    digitalGuruRevenuePercentage: 50.0,
    partnerRevenuePercentage: 50.0,
    revenueCalculationBasis: 'GROSS_COURSE_FEES',
    settlementFrequency: 'MONTHLY',
    totalInvestment: 200000,
    digitalGuruInvestmentAmount: 100000,
    partnerInvestmentAmount: 100000,
    digitalGuruInvestmentPercentage: 50.0,
    partnerInvestmentPercentage: 50.0,
    operationalSetupContribution: 50000,
    investmentNotes: '',
    expenseResponsibilities: {
      rent: 'PARTNER',
      trainerSalaries: 'DIGITAL_GURU',
      staffSalaries: 'PARTNER',
      operationalSetup: 'SHARED',
      utilities: 'PARTNER',
      marketing: 'DIGITAL_GURU',
      other: 'PARTNER',
    } as Record<string, string>,
    marketingResponsibleParty: 'DIGITAL_GURU',
    marketingSupportDurationMonths: 3,
    marketingPostSupportParty: 'PARTNER',
    marketingBudget: 50000,
    marketingEffectiveStartDate: '',
    marketingNotes: '',
    courseSoftwareAccessEnabled: true,
    courseSoftwarePricingNotes: '',
    terms: '',
    notes: '',
  });

  // Agreement Model Templates dynamically loaded from backend
  const [agreementTemplates, setAgreementTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const loadAgreementTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await apiFetch('/franchises/agreement-templates');
      if (res.success && Array.isArray(res.data?.templates)) {
        setAgreementTemplates(res.data.templates);
      } else {
        setTemplatesError(res.error || 'Failed to load agreement templates from server.');
      }
    } catch (err: any) {
      setTemplatesError(err.message || 'Network error loading agreement templates.');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const initialCreateForm = {
    code: '',
    name: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    authorizedContact: {
      name: '',
      phone: '',
      email: '',
      designation: '',
    },
    gstin: '',
    pan: '',
    branchOption: 'NONE' as 'NONE' | 'LINK_EXISTING' | 'CREATE_NEW',
    linkedInstituteId: '',
    newBranch: {
      name: '',
      code: '',
      city: '',
      state: '',
      address: '',
      phone: '',
      email: '',
    },
    initialAgreement: {
      agreementType: 'NEW_CENTRE_JOINT_INVESTMENT' as any,
      title: 'Annual Master Franchise Agreement',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      calculationMethod: 'PERCENTAGE_REVENUE' as 'FIXED_ANNUAL' | 'PERCENTAGE_REVENUE' | 'PER_STUDENT',
      annualRoyaltyAmount: 200000,
      royaltyPercentage: 50.0,
      digitalGuruRevenuePercentage: 50.0,
      partnerRevenuePercentage: 50.0,
      revenueCalculationBasis: 'GROSS_COURSE_FEES' as any,
      settlementFrequency: 'MONTHLY' as any,
      totalInvestment: 200000,
      digitalGuruInvestmentAmount: 100000,
      partnerInvestmentAmount: 100000,
      digitalGuruInvestmentPercentage: 50.0,
      partnerInvestmentPercentage: 50.0,
      operationalSetupContribution: 50000,
      investmentNotes: 'Illustrative 50:50 joint initial setup and capital expenditure contribution (editable)',
      expenseResponsibilities: {
        rent: 'PARTNER',
        trainerSalaries: 'DIGITAL_GURU',
        staffSalaries: 'PARTNER',
        operationalSetup: 'SHARED',
        utilities: 'PARTNER',
        marketing: 'DIGITAL_GURU',
        other: 'PARTNER',
      } as Record<string, string>,
      marketingResponsibleParty: 'DIGITAL_GURU',
      marketingSupportDurationMonths: 3,
      marketingPostSupportParty: 'PARTNER',
      marketingBudget: 50000,
      courseSoftwareAccessEnabled: true,
      courseSoftwarePricingNotes: 'Full Course Management Software access included',
      royaltyBasis: 'TOTAL_COLLECTIONS',
      perStudentFee: 2000,
      dueDay: 10,
      terms: 'Standard Digital Guru franchise license terms. Two annual installments due per agreement year.',
      notes: '',
    },
  };

  // Forms
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [isSubmittingFranchise, setIsSubmittingFranchise] = useState(false);

  // Edit Franchise & Manage Linked Institutes State
  const [showEditFranchiseModal, setShowEditFranchiseModal] = useState(false);
  const [selectedFranchiseForEdit, setSelectedFranchiseForEdit] = useState<Franchise | null>(null);
  const [editFranchiseTab, setEditFranchiseTab] = useState<'details' | 'campuses'>('details');
  const [editForm, setEditForm] = useState({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    notes: '',
  });
  const [editLinkInstituteId, setEditLinkInstituteId] = useState('');
  const [editNewBranch, setEditNewBranch] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    email: '',
  });

  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    email: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amountPaid: '',
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: '',
    remarks: '',
    paymentDate: new Date().toISOString().split('T')[0],
  });

  const [renewForm, setRenewForm] = useState({
    title: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    calculationMethod: 'FIXED_ANNUAL' as 'FIXED_ANNUAL' | 'PERCENTAGE_REVENUE' | 'PER_STUDENT',
    annualRoyaltyAmount: 200000,
    royaltyPercentage: 50.0,
    royaltyBasis: 'TOTAL_COLLECTIONS',
    perStudentFee: 2000,
    dueDay: 10,
    terms: '',
    notes: '',
  });

  const [amendForm, setAmendForm] = useState({
    note: '',
    royaltyPercentage: 50.0,
    annualRoyaltyAmount: 200000,
  });

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, listRes, instRes, unassignedRes, monthlyRes] = await Promise.all([
        apiFetch('/franchises/dashboard/super-admin'),
        apiFetch('/franchises'),
        apiFetch('/franchises/all/installments').catch(() => ({ success: false, data: { installments: [] } })),
        apiFetch('/franchises/unassigned-branches').catch(() => ({ success: false, data: { branches: [] } })),
        apiFetch('/franchises/all/royalties').catch(() => ({ success: false, data: { royaltyRecords: [] } })),
      ]);

      if (dashRes.success) {
        setDashboardStats(dashRes.data);
      }

      if (listRes.success) {
        const fetchedFranchises: Franchise[] = listRes.data.franchises || [];
        setFranchises(fetchedFranchises);
      }

      if (instRes.success && Array.isArray(instRes.data?.installments)) {
        setInstallments(instRes.data.installments);
      }

      if (unassignedRes.success && Array.isArray(unassignedRes.data?.branches)) {
        setUnassignedBranches(unassignedRes.data.branches);
      }

      if (monthlyRes.success && Array.isArray(monthlyRes.data?.royaltyRecords)) {
        setMonthlyRecords(monthlyRes.data.royaltyRecords);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load franchise data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyRecords = async () => {
    try {
      setLoadingMonthly(true);
      const res = await apiFetch('/franchises/all/royalties');
      if (res.success && res.data?.royaltyRecords) {
        setMonthlyRecords(res.data.royaltyRecords);
      }
    } catch (err: any) {
      // Non-blocking
    } finally {
      setLoadingMonthly(false);
    }
  };

  const handleCalculateMonthlyRoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculateForm.franchiseId) {
      showToast('Please select a franchise to calculate royalty for.', 'warning');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        periodLabel: calculateForm.periodLabel,
        startDate: calculateForm.startDate,
        endDate: calculateForm.endDate,
        revenueCalculationBasis: calculateForm.revenueCalculationBasis,
        deductibleExpenses: Number(calculateForm.deductibleExpenses || 0),
        deductions: Number(calculateForm.deductions || 0),
      };
      const res = await apiFetch(`/franchises/${calculateForm.franchiseId}/royalties/calculate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success) {
        showToast('Monthly royalty calculated and statement recorded successfully!', 'success');
        setShowCalculateModal(false);
        await loadMonthlyRecords();
        await loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to calculate monthly royalty', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadAgreementTemplates();
  }, []);

  // Filter Franchises
  const filteredFranchises = franchises.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter Installments
  const filteredInstallments = installments.filter((i) => {
    if (selectedFranchiseFilter !== 'ALL' && i.franchiseId !== selectedFranchiseFilter) {
      return false;
    }
    if (
      searchTerm &&
      !i.franchiseName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !i.franchiseCode?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !i.periodLabel?.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // -------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------

  const validateProfileStep = () => {
    if (!createForm.name?.trim()) {
      showToast('Franchise / Center Name is required', 'error');
      return false;
    }
    if (!createForm.ownerName?.trim()) {
      showToast('Owner Full Name is required', 'error');
      return false;
    }
    if (!createForm.email?.trim()) {
      showToast('Owner Email Address is required', 'error');
      return false;
    }
    if (!createForm.phone?.trim()) {
      showToast('Primary Mobile Number is required', 'error');
      return false;
    }
    if (!createForm.address?.trim()) {
      showToast('Full Business Address is required', 'error');
      return false;
    }
    if (!createForm.city?.trim()) {
      showToast('City is required', 'error');
      return false;
    }
    if (!createForm.state?.trim()) {
      showToast('State is required', 'error');
      return false;
    }
    if (!createForm.postalCode?.trim()) {
      showToast('Postal / PIN Code is required', 'error');
      return false;
    }
    return true;
  };

  const validateModelStep = () => {
    if (!createForm.initialAgreement.startDate) {
      showToast('Agreement Start Date is required', 'error');
      return false;
    }
    if (!createForm.initialAgreement.endDate) {
      showToast('Agreement End Date is required', 'error');
      return false;
    }
    return true;
  };

  const validateFinancialsStep = () => {
    const dg = Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 0);
    const pt = Number(createForm.initialAgreement.partnerRevenuePercentage || 0);
    if (dg + pt !== 100) {
      showToast(`Revenue share total must equal 100% (currently ${dg + pt}%)`, 'error');
      return false;
    }
    if (createForm.initialAgreement.calculationMethod === 'FIXED_ANNUAL' && !Number(createForm.initialAgreement.annualRoyaltyAmount)) {
      showToast('Please specify the agreed Annual Commercial Fee', 'error');
      return false;
    }
    if (createForm.initialAgreement.calculationMethod === 'PER_STUDENT' && !Number(createForm.initialAgreement.perStudentFee)) {
      showToast('Please specify the fee per active student', 'error');
      return false;
    }
    return true;
  };

  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{
    emailConflict?: { isDuplicate: boolean; model?: string; message?: string; canReuseAsOwner?: boolean };
    phoneConflict?: { isDuplicate: boolean; model?: string; message?: string };
    codeConflict?: { isDuplicate: boolean; message?: string };
    isChecking?: boolean;
  }>({});

  useEffect(() => {
    if (!showCreateModal) {
      setDuplicateCheckResult({});
      return;
    }

    const emailTrimmed = createForm.email?.trim().toLowerCase();
    const phoneTrimmed = createForm.phone?.trim();
    const codeTrimmed = createForm.code?.trim().toUpperCase();

    if (!emailTrimmed && !phoneTrimmed && !codeTrimmed) {
      setDuplicateCheckResult({});
      return;
    }

    setDuplicateCheckResult((prev) => ({ ...prev, isChecking: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch('/franchises/check-duplicates', {
          method: 'POST',
          body: JSON.stringify({
            email: emailTrimmed || undefined,
            phone: phoneTrimmed || undefined,
            code: codeTrimmed || undefined,
          }),
        });

        if (res.success && res.data) {
          setDuplicateCheckResult({
            emailConflict: res.data.email,
            phoneConflict: res.data.phone,
            codeConflict: res.data.code,
            isChecking: false,
          });
        } else {
          setDuplicateCheckResult((prev) => ({ ...prev, isChecking: false }));
        }
      } catch {
        setDuplicateCheckResult((prev) => ({ ...prev, isChecking: false }));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [createForm.email, createForm.phone, createForm.code, showCreateModal]);

  const duplicateFranchiseMatch = React.useMemo(() => {
    if (!createForm.email?.trim()) return null;
    const norm = createForm.email.trim().toLowerCase();
    return franchises.find((f) => f.email?.trim().toLowerCase() === norm) || null;
  }, [createForm.email, franchises]);

  const hasBlockingConflict = Boolean(
    duplicateFranchiseMatch ||
    (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise') ||
    duplicateCheckResult.phoneConflict?.isDuplicate ||
    duplicateCheckResult.codeConflict?.isDuplicate
  );

  const isProfileStepComplete = Boolean(
    createForm.name?.trim() &&
    createForm.ownerName?.trim() &&
    createForm.email?.trim() &&
    !hasBlockingConflict &&
    createForm.phone?.trim() &&
    createForm.address?.trim() &&
    createForm.city?.trim() &&
    createForm.state?.trim() &&
    createForm.postalCode?.trim()
  );

  const isModelStepComplete = Boolean(
    isProfileStepComplete &&
    createForm.initialAgreement.startDate &&
    createForm.initialAgreement.endDate
  );

  const isFinancialsStepComplete = Boolean(
    isModelStepComplete &&
    Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 0) +
    Number(createForm.initialAgreement.partnerRevenuePercentage || 0) === 100 &&
    (createForm.initialAgreement.calculationMethod !== 'FIXED_ANNUAL' || Number(createForm.initialAgreement.annualRoyaltyAmount) > 0) &&
    (createForm.initialAgreement.calculationMethod !== 'PER_STUDENT' || Number(createForm.initialAgreement.perStudentFee) > 0)
  );

  const handleTabClick = (targetTab: 'profile' | 'model' | 'financials' | 'review') => {
    if (targetTab === createModalTab) return;

    const stepOrder: ('profile' | 'model' | 'financials' | 'review')[] = ['profile', 'model', 'financials', 'review'];
    const currentIndex = stepOrder.indexOf(createModalTab);
    const targetIndex = stepOrder.indexOf(targetTab);

    // Navigating back to an earlier step is always permitted
    if (targetIndex < currentIndex) {
      setCreateModalTab(targetTab);
      createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // Moving forward requires step-by-step validation
    if (targetIndex >= 1 && !validateProfileStep()) {
      return;
    }
    if (targetIndex >= 2 && !validateModelStep()) {
      return;
    }
    if (targetIndex >= 3 && !validateFinancialsStep()) {
      return;
    }

    setCreateModalTab(targetTab);
    createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleCreateFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingFranchise) return;

    if (hasBlockingConflict) {
      const conflictMsg =
        (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise'
          ? duplicateCheckResult.emailConflict.message
          : null) ||
        (duplicateCheckResult.codeConflict?.isDuplicate ? duplicateCheckResult.codeConflict.message : null) ||
        (duplicateCheckResult.phoneConflict?.isDuplicate ? duplicateCheckResult.phoneConflict.message : null) ||
        (duplicateFranchiseMatch ? `Cannot create franchise: '${createForm.email}' is already registered to ${duplicateFranchiseMatch.name} (${duplicateFranchiseMatch.code}).` : 'Please resolve the highlighted duplicate conflicts before submitting.');
      showToast(conflictMsg, 'error');
      setCreateModalTab('profile');
      return;
    }

    setIsSubmittingFrmittingFranchise:
    setIsSubmittingFranchise(true);
    try {
      const dgPct = Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 50);
      const partnerPct = createForm.initialAgreement.calculationMethod === 'PERCENTAGE_REVENUE'
        ? (100 - dgPct)
        : Number(createForm.initialAgreement.partnerRevenuePercentage || 50);

      const payload: any = {
        code: createForm.code?.trim().toUpperCase() || undefined,
        name: createForm.name.trim(),
        ownerName: createForm.ownerName.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
        password: createForm.password || undefined,
        address: createForm.address.trim() || undefined,
        city: createForm.city.trim() || undefined,
        state: createForm.state.trim() || undefined,
        postalCode: createForm.postalCode.trim() || undefined,
        country: createForm.country || 'India',
        authorizedContact: createForm.authorizedContact.name ? createForm.authorizedContact : undefined,
        businessDetails: {
          gstin: createForm.gstin.trim() || undefined,
          pan: createForm.pan.trim() || undefined,
        },
        // Optional Campus / Institute Association
        branchOption: createForm.branchOption,
        linkedInstituteId: createForm.branchOption === 'LINK_EXISTING' ? createForm.linkedInstituteId : undefined,
        newBranch: createForm.branchOption === 'CREATE_NEW' && createForm.newBranch.name.trim()
          ? {
            name: createForm.newBranch.name.trim(),
            code: createForm.newBranch.code.trim() || undefined,
            city: createForm.newBranch.city.trim() || createForm.city.trim(),
            state: createForm.newBranch.state.trim() || createForm.state.trim(),
            address: createForm.newBranch.address.trim() || createForm.address.trim(),
            phone: createForm.newBranch.phone.trim() || createForm.phone.trim(),
            email: createForm.newBranch.email.trim() || createForm.email.trim().toLowerCase(),
          }
          : undefined,
        initialAgreement: {
          agreementType: createForm.initialAgreement.agreementType,
          title: createForm.initialAgreement.title,
          startDate: createForm.initialAgreement.startDate,
          endDate: createForm.initialAgreement.endDate,
          calculationMethod: createForm.initialAgreement.calculationMethod,
          annualRoyaltyAmount: Number(createForm.initialAgreement.annualRoyaltyAmount || 0),
          royaltyPercentage: dgPct,
          digitalGuruRevenuePercentage: dgPct,
          partnerRevenuePercentage: partnerPct,
          revenueCalculationBasis: createForm.initialAgreement.revenueCalculationBasis,
          settlementFrequency: createForm.initialAgreement.settlementFrequency,
          totalInvestment: Number(createForm.initialAgreement.totalInvestment || 0),
          digitalGuruInvestmentAmount: Number(createForm.initialAgreement.digitalGuruInvestmentAmount || 0),
          partnerInvestmentAmount: Number(createForm.initialAgreement.partnerInvestmentAmount || 0),
          digitalGuruInvestmentPercentage: Number(createForm.initialAgreement.digitalGuruInvestmentPercentage || 0),
          partnerInvestmentPercentage: Number(createForm.initialAgreement.partnerInvestmentPercentage || 0),
          operationalSetupContribution: Number(createForm.initialAgreement.operationalSetupContribution || 0),
          investmentNotes: createForm.initialAgreement.investmentNotes,
          expenseResponsibilities: createForm.initialAgreement.expenseResponsibilities,
          marketingResponsibleParty: createForm.initialAgreement.marketingResponsibleParty,
          marketingSupportDurationMonths: Number(createForm.initialAgreement.marketingSupportDurationMonths || 0),
          marketingPostSupportParty: createForm.initialAgreement.marketingPostSupportParty,
          marketingBudget: Number(createForm.initialAgreement.marketingBudget || 0),
          courseSoftwareAccessEnabled: Boolean(createForm.initialAgreement.courseSoftwareAccessEnabled),
          courseSoftwarePricingNotes: createForm.initialAgreement.courseSoftwarePricingNotes,
          royaltyBasis: createForm.initialAgreement.royaltyBasis,
          perStudentFee:
            createForm.initialAgreement.calculationMethod === 'PER_STUDENT'
              ? Number(createForm.initialAgreement.perStudentFee)
              : undefined,
          dueDay: Number(createForm.initialAgreement.dueDay || 10),
          terms: createForm.initialAgreement.terms,
          notes: createForm.initialAgreement.notes,
        },
      };

      const res = await apiFetch('/franchises', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast(
          createForm.initialAgreement.settlementFrequency === 'YEARLY'
            ? 'Franchise, Owner Account, and 2 Annual Installments created successfully!'
            : 'Franchise, Owner Account, and Monthly Settlement Agreement created successfully!',
          'success'
        );
        setShowCreateModal(false);
        setCreatedResultModal(res.data);
        setCreateForm(initialCreateForm);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create franchise', 'error');
    } finally {
      setIsSubmittingFranchise(false);
    }
  };

  // ----------------------------------------------------
  // EDIT FRANCHISE & LINKED CAMPUSES HANDLERS
  // ----------------------------------------------------
  const openEditFranchiseModal = async (fr: Franchise) => {
    setSelectedFranchiseForEdit(fr);
    setEditForm({
      name: fr.name || '',
      ownerName: fr.ownerName || '',
      phone: fr.phone || '',
      address: fr.address || '',
      city: fr.city || '',
      state: fr.state || '',
      postalCode: fr.postalCode || '',
      country: fr.country || 'India',
      notes: fr.notes || '',
    });
    setEditLinkInstituteId('');
    setEditNewBranch({
      name: '',
      code: '',
      city: fr.city || '',
      state: fr.state || '',
      address: fr.address || '',
      phone: fr.phone || '',
      email: '',
    });
    setEditFranchiseTab('details');
    setShowEditFranchiseModal(true);

    try {
      const res = await apiFetch('/franchises/unassigned-branches');
      if (res.success && Array.isArray(res.data?.branches)) {
        setUnassignedBranches(res.data.branches);
      }
    } catch {
      // non-blocking
    }
  };

  const handleSaveFranchiseProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForEdit) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      if (res.success) {
        showToast('Franchise profile updated successfully', 'success');
        setShowEditFranchiseModal(false);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update franchise', 'error');
    }
  };

  const handleLinkBranchInEdit = async () => {
    if (!selectedFranchiseForEdit || !editLinkInstituteId) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}/branches`, {
        method: 'POST',
        body: JSON.stringify({ instituteId: editLinkInstituteId }),
      });
      if (res.success) {
        showToast('Institute successfully linked to franchise!', 'success');
        setEditLinkInstituteId('');
        const refreshed = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}`);
        if (refreshed.success && refreshed.data?.franchise) {
          setSelectedFranchiseForEdit(refreshed.data.franchise);
        }
        const unassigned = await apiFetch('/franchises/unassigned-branches');
        if (unassigned.success && Array.isArray(unassigned.data?.branches)) {
          setUnassignedBranches(unassigned.data.branches);
        }
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to link branch', 'error');
    }
  };

  const handleCreateBranchInEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForEdit || !editNewBranch.name.trim()) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          createNew: true,
          name: editNewBranch.name.trim(),
          code: editNewBranch.code.trim() || undefined,
          city: editNewBranch.city.trim() || undefined,
          state: editNewBranch.state.trim() || undefined,
          address: editNewBranch.address.trim() || undefined,
          phone: editNewBranch.phone.trim() || undefined,
          email: editNewBranch.email.trim() || undefined,
        }),
      });
      if (res.success) {
        showToast('New campus branch created and linked to franchise!', 'success');
        setEditNewBranch({
          name: '',
          code: '',
          city: selectedFranchiseForEdit.city || '',
          state: selectedFranchiseForEdit.state || '',
          address: selectedFranchiseForEdit.address || '',
          phone: selectedFranchiseForEdit.phone || '',
          email: '',
        });
        const refreshed = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}`);
        if (refreshed.success && refreshed.data?.franchise) {
          setSelectedFranchiseForEdit(refreshed.data.franchise);
        }
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create branch', 'error');
    }
  };

  const handleDetachBranchInEdit = async (branchId: string, branchName: string) => {
    if (!selectedFranchiseForEdit) return;
    if (
      !window.confirm(
        `Are you sure you want to detach "${branchName}" from this franchise? All records will remain completely preserved.`
      )
    ) {
      return;
    }
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}/branches/${branchId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        showToast(`Campus "${branchName}" detached successfully`, 'success');
        const refreshed = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}`);
        if (refreshed.success && refreshed.data?.franchise) {
          setSelectedFranchiseForEdit(refreshed.data.franchise);
        }
        const unassigned = await apiFetch('/franchises/unassigned-branches');
        if (unassigned.success && Array.isArray(unassigned.data?.branches)) {
          setUnassignedBranches(unassigned.data.branches);
        }
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to detach branch', 'error');
    }
  };

  const handleReviseAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForRevise || !selectedAgreementForRevise) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForRevise.id}/agreements/${selectedAgreementForRevise.id}/revise`, {
        method: 'POST',
        body: JSON.stringify({
          title: reviseForm.title,
          startDate: reviseForm.startDate,
          endDate: reviseForm.endDate,
          agreementType: reviseForm.agreementType,
          calculationMethod: reviseForm.calculationMethod,
          annualRoyaltyAmount: Number(reviseForm.annualRoyaltyAmount || 0),
          perStudentFee: reviseForm.calculationMethod === 'PER_STUDENT' ? Number(reviseForm.perStudentFee || 0) : undefined,
          digitalGuruRevenuePercentage: Number(reviseForm.digitalGuruRevenuePercentage || 50),
          partnerRevenuePercentage: Number(reviseForm.partnerRevenuePercentage || 50),
          royaltyPercentage: Number(reviseForm.digitalGuruRevenuePercentage || 50),
          revenueCalculationBasis: reviseForm.revenueCalculationBasis,
          settlementFrequency: reviseForm.settlementFrequency,
          totalInvestment: Number(reviseForm.totalInvestment || 0),
          digitalGuruInvestmentAmount: Number(reviseForm.digitalGuruInvestmentAmount || 0),
          partnerInvestmentAmount: Number(reviseForm.partnerInvestmentAmount || 0),
          digitalGuruInvestmentPercentage: Number(reviseForm.digitalGuruInvestmentPercentage || 0),
          partnerInvestmentPercentage: Number(reviseForm.partnerInvestmentPercentage || 0),
          operationalSetupContribution: Number(reviseForm.operationalSetupContribution || 0),
          investmentNotes: reviseForm.investmentNotes,
          expenseResponsibilities: reviseForm.expenseResponsibilities,
          marketingResponsibleParty: reviseForm.marketingResponsibleParty,
          marketingSupportDurationMonths: Number(reviseForm.marketingSupportDurationMonths || 0),
          marketingPostSupportParty: reviseForm.marketingPostSupportParty,
          marketingBudget: Number(reviseForm.marketingBudget || 0),
          marketingEffectiveStartDate: reviseForm.marketingEffectiveStartDate || undefined,
          marketingNotes: reviseForm.marketingNotes,
          courseSoftwareAccessEnabled: Boolean(reviseForm.courseSoftwareAccessEnabled),
          courseSoftwarePricingNotes: reviseForm.courseSoftwarePricingNotes,
          terms: reviseForm.terms,
          notes: reviseForm.notes,
        }),
      });
      if (res.success) {
        showToast(res.message || 'Agreement revised successfully!', 'success');
        setShowReviseModal(false);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to revise agreement', 'error');
    }
  };

  const handleStatusToggle = async (franchiseId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const reason = prompt(`Enter reason for updating status to ${nextStatus}:`, 'Administrative update');
    if (reason === null) return;

    try {
      const res = await apiFetch(`/franchises/${franchiseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      if (res.success) {
        showToast(`Franchise status updated to ${nextStatus}`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleResetPassword = async (franchise: any) => {
    setSelectedFranchiseForReset(franchise);
    setResetResult(null);
    setShowResetPasswordModal(true);
  };

  const handleCloseResetPasswordModal = () => {
    setShowResetPasswordModal(false);
    setSelectedFranchiseForReset(null);
    setResetResult(null);
  };

  const executeResetPassword = async () => {
    if (!selectedFranchiseForReset) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForReset.id}/owner/reset-password`, {
        method: 'POST',
      });
      if (res.success && res.data) {
        setResetResult(res.data);
        showToast('Password reset successfully. Please securely share the credentials with the owner.', 'success');
        if (selectedFranchiseId === selectedFranchiseForReset.id) {
          fetchFranchiseDetails(selectedFranchiseForReset.id);
        }
      } else {
        showToast(res.error || 'Failed to reset password', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    }
  };

  const fetchFranchiseDetails = async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiFetch(`/franchises/${id}`, { skipCache: true });
      if (res.success && res.data) {
        setDetailData(res.data);
      } else {
        setDetailError(res.error || 'Failed to load franchise details');
      }
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load franchise details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetails = (id: string) => {
    setSelectedFranchiseId(id);
    fetchFranchiseDetails(id);
  };

  const handleCloseDetails = () => {
    setSelectedFranchiseId(null);
    setDetailData(null);
    setDetailError(null);
  };

  const openAddBranchModal = async (fr: Franchise) => {
    setSelectedFranchiseForBranch(fr);
    setBranchModalMode('existing');
    setSelectedExistingBranchId('');
    setShowAddBranchModal(true);
    try {
      const res = await apiFetch('/franchises/unassigned-branches');
      if (res.success && Array.isArray(res.data?.branches)) {
        setUnassignedBranches(res.data.branches);
        if (res.data.branches.length === 0) {
          setBranchModalMode('new');
        }
      }
    } catch {
      setUnassignedBranches([]);
      setBranchModalMode('new');
    }
  };

  const handleAssignExistingBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForBranch || !selectedExistingBranchId) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForBranch.id}/branches`, {
        method: 'POST',
        body: JSON.stringify({ instituteId: selectedExistingBranchId }),
      });
      if (res.success) {
        showToast('Existing campus branch successfully assigned to franchise!', 'success');
        setShowAddBranchModal(false);
        setSelectedExistingBranchId('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to assign branch', 'error');
    }
  };

  const handleDetachBranch = async (franchiseId: string, branchId: string, branchName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to detach "${branchName}" from this franchise? All student, staff, fee, and attendance records will remain completely preserved.`
      )
    ) {
      return;
    }
    try {
      const res = await apiFetch(`/franchises/${franchiseId}/branches/${branchId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        showToast(`Campus "${branchName}" detached successfully`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to detach branch', 'error');
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForBranch) return;

    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForBranch.id}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          createNew: true,
          name: branchForm.name,
          code: branchForm.code,
          city: branchForm.city,
          state: branchForm.state,
          address: branchForm.address,
          phone: branchForm.phone,
          email: branchForm.email,
        }),
      });

      if (res.success) {
        showToast('Campus branch successfully attached to franchise!', 'success');
        setShowAddBranchModal(false);
        setBranchForm({ name: '', code: '', city: '', state: '', address: '', phone: '', email: '' });
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to attach branch', 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallmentForPayment) return;

    try {
      const res = await apiFetch(
        `/franchises/${selectedInstallmentForPayment.franchiseId}/installments/${selectedInstallmentForPayment.id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            amountPaid: Number(paymentForm.amountPaid),
            paymentMethod: paymentForm.paymentMethod,
            transactionReference: paymentForm.transactionReference.trim() || undefined,
            remarks: paymentForm.remarks || undefined,
            paymentDate: paymentForm.paymentDate,
          }),
        }
      );

      if (res.success) {
        showToast('Royalty payment recorded and verified successfully!', 'success');
        setShowRecordPaymentModal(false);
        setPaymentForm({
          amountPaid: '',
          paymentMethod: 'BANK_TRANSFER',
          transactionReference: '',
          remarks: '',
          paymentDate: new Date().toISOString().split('T')[0],
        });
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment', 'error');
    }
  };

  const handleOpenReceipt = async (paymentId: string, franchiseId: string) => {
    try {
      const res = await apiFetch(`/franchises/${franchiseId}/payments/${paymentId}/receipt`);
      if (res.success) {
        setReceiptData(res.data);
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load receipt details', 'error');
    }
  };

  const handleRenewAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgreementForRenew) return;

    try {
      const res = await apiFetch(
        `/franchises/${selectedAgreementForRenew.franchiseId}/agreements/${selectedAgreementForRenew.id}/renew`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: renewForm.title || `Renewed Master Agreement (${new Date(renewForm.startDate).getFullYear()})`,
            startDate: renewForm.startDate,
            endDate: renewForm.endDate,
            calculationMethod: renewForm.calculationMethod,
            annualRoyaltyAmount:
              renewForm.calculationMethod === 'FIXED_ANNUAL' ? Number(renewForm.annualRoyaltyAmount) : undefined,
            royaltyPercentage:
              renewForm.calculationMethod === 'PERCENTAGE_REVENUE' ? Number(renewForm.royaltyPercentage) : 50.0,
            royaltyBasis: renewForm.royaltyBasis,
            perStudentFee:
              renewForm.calculationMethod === 'PER_STUDENT' ? Number(renewForm.perStudentFee) : undefined,
            dueDay: Number(renewForm.dueDay),
            terms: renewForm.terms,
            notes: renewForm.notes,
          }),
        }
      );

      if (res.success) {
        showToast('Agreement renewed successfully with 2 new installments!', 'success');
        setShowRenewModal(false);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to renew agreement', 'error');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
            Partially Paid
          </span>
        );
      case 'DUE':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
            Due
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse">
            Overdue
          </span>
        );
      case 'UPCOMING':
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20">
            Upcoming
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B0F19] text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FEDC32]/10 to-transparent pointer-events-none"></div>

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEDC32]/20 text-[#FEDC32] border border-[#FEDC32]/30">
              Super Admin Control Center
            </span>
            <span className="text-xs text-slate-400">Digital Guru Franchise Enterprise</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Franchise & Royalty Management</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Register and manage Franchisee Admins, enforce two-installment annual royalty schedules, attach branch campuses, and track verified payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={() => loadData()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              apiFetch('/franchises/unassigned-branches')
                .then((res) => {
                  if (res.success && Array.isArray(res.data?.branches)) {
                    setUnassignedBranches(res.data.branches);
                  }
                })
                .catch(() => { });
              setCreateModalTab('profile');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Register Franchisee Admin
          </button>
        </div>
      </div>

      {/* KPI Stats Grid - Balanced Alignment & Unified Card Heights */}
      {dashboardStats?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {/* 1. Total Franchises */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Franchises</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#006FFF] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap tabular-nums" title={String(dashboardStats.summary.totalFranchises)}>
                {dashboardStats.summary.totalFranchises}
              </div>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {dashboardStats.summary.activeFranchises} Active
            </div>
          </div>

          {/* 2. Branch Campuses */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Campuses</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap tabular-nums" title={String(dashboardStats.summary.totalBranches)}>
                {dashboardStats.summary.totalBranches}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap" title={`${dashboardStats.summary.totalStudents} Active Students`}>
              {dashboardStats.summary.totalStudents} Active Students
            </div>
          </div>

          {/* 3. Total Royalty */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Royalty</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#006FFF] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-sm sm:text-base xl:text-[15px] 2xl:text-lg font-black text-[#006FFF] tracking-tight whitespace-nowrap tabular-nums" title={`₹${Number(dashboardStats.summary.totalRoyaltyObligations || 0).toLocaleString('en-IN')}`}>
                ₹{Number(dashboardStats.summary.totalRoyaltyObligations || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-medium whitespace-nowrap">2-Installment Sched.</div>
          </div>

          {/* 4. Royalty Received */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Received</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-sm sm:text-base xl:text-[15px] 2xl:text-lg font-black text-emerald-600 tracking-tight whitespace-nowrap tabular-nums" title={`₹${Number(dashboardStats.summary.totalRoyaltyReceived || 0).toLocaleString('en-IN')}`}>
                ₹{Number(dashboardStats.summary.totalRoyaltyReceived || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold whitespace-nowrap">Verified Receipts</div>
          </div>

          {/* 5. Outstanding */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-sm sm:text-base xl:text-[15px] 2xl:text-lg font-black text-amber-600 tracking-tight whitespace-nowrap tabular-nums" title={`₹${Number(dashboardStats.summary.outstandingRoyalty || 0).toLocaleString('en-IN')}`}>
                ₹{Number(dashboardStats.summary.outstandingRoyalty || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[11px] text-amber-600 font-medium whitespace-nowrap">
              {dashboardStats.summary.dueInstallmentsCount || 0} Installments Due
            </div>
          </div>

          {/* 6. Overdue Amount */}
          <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[110px] min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overdue</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1">
              <div className="text-sm sm:text-base xl:text-[15px] 2xl:text-lg font-black text-rose-600 tracking-tight whitespace-nowrap tabular-nums" title={`₹${Number(dashboardStats.summary.overdueRoyalty || 0).toLocaleString('en-IN')}`}>
                ₹{Number(dashboardStats.summary.overdueRoyalty || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[11px] text-rose-600 font-medium whitespace-nowrap">
              {dashboardStats.summary.overdueInstallmentsCount || 0} Overdue
            </div>
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl gap-6">
        <button
          onClick={() => setActiveTab('franchises')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'franchises'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <Building2 className="w-4 h-4" /> Franchises & Owners ({franchises.length})
        </button>

        <button
          onClick={() => setActiveTab('installments')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'installments'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <DollarSign className="w-4 h-4" /> 2-Installment Royalty Schedule ({installments.length})
        </button>

        <button
          onClick={() => setActiveTab('agreements')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'agreements'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <FileText className="w-4 h-4" /> Agreements & Renewals
        </button>

        <button
          onClick={() => setActiveTab('monthly_settlements')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'monthly_settlements'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <Layers className="w-4 h-4" /> Monthly Royalty Settlements ({monthlyRecords.length})
        </button>
      </div>

      {/* TAB 1: FRANCHISES */}
      {activeTab === 'franchises' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search franchise name, code, owner, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] focus:outline-none"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing {filteredFranchises.length} of {franchises.length} registered franchises
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap w-28">Code</th>
                  <th className="px-4 py-3">Franchise Center</th>
                  <th className="px-4 py-3">Owner Contact</th>
                  <th className="px-4 py-3">Location & Address</th>
                  <th className="px-4 py-3">Campuses</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFranchises.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                      No franchises found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFranchises.map((fr) => (
                    <React.Fragment key={fr.id}>
                      <tr
                        onClick={() => handleOpenDetails(fr.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs bg-blue-50 text-[#006FFF] px-2.5 py-1 rounded border border-blue-200 whitespace-nowrap inline-block tracking-wide">
                            {fr.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 group-hover:text-[#006FFF] transition-colors">{fr.name}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900">{fr.ownerName}</div>
                          <div className="text-xs text-slate-500">{fr.email}</div>
                          <div className="text-xs text-slate-500">{fr.phone}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-slate-800 font-medium">
                            {fr.city}, {fr.state}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">{fr.address || 'Address on file'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">PIN: {fr.postalCode || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedFranchiseId(expandedFranchiseId === fr.id ? null : fr.id);
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors inline-flex items-center gap-1.5"
                            title="Click to view assigned branches and manage assignments"
                          >
                            <Building2 className="w-3.5 h-3.5 text-[#006FFF]" />
                            {fr.branches?.length || 0} Branch(es)
                            <span className="text-[10px] text-slate-500">{expandedFranchiseId === fr.id ? '▲' : '▼'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${fr.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                          >
                            {fr.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetails(fr.id);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-blue-50 text-[#006FFF] rounded-md transition-all inline-flex items-center gap-1 border border-blue-200 shadow-xs"
                            title="View full franchise details and owner credentials"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditFranchiseModal(fr);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-[#006FFF] rounded-md transition-all inline-flex items-center gap-1 border border-blue-200"
                            title="Edit franchise details and manage linked institutes"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddBranchModal(fr);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-all"
                            title="Assign existing branch or create new campus"
                          >
                            + Campus
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetPassword(fr);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-all inline-flex items-center gap-1"
                            title="Reset Franchise Owner Password"
                          >
                            <Key className="w-3 h-3" /> Password
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusToggle(fr.id, fr.status);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${fr.status === 'ACTIVE'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              }`}
                          >
                            {fr.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                      {expandedFranchiseId === fr.id && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={7} className="p-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-[#006FFF]" /> Assigned Campus Branches ({fr.branches?.length || 0})
                                </h4>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openEditFranchiseModal(fr)}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#006FFF] text-xs font-bold rounded-lg border border-blue-200 inline-flex items-center gap-1 shadow-xs"
                                  >
                                    <Edit3 className="w-3 h-3" /> Manage in Edit
                                  </button>
                                  <button
                                    onClick={() => openAddBranchModal(fr)}
                                    className="px-3 py-1 bg-[#006FFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-lg shadow-sm"
                                  >
                                    + Assign / Add Branch
                                  </button>
                                </div>
                              </div>

                              {(!fr.branches || fr.branches.length === 0) ? (
                                <div className="text-xs text-slate-400 py-4 text-center">
                                  No campus branches currently assigned to this franchise center.
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {fr.branches.map((b: any) => (
                                    <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-start justify-between">
                                          <div className="font-bold text-xs text-slate-900">{b.name}</div>
                                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100 text-[#006FFF] rounded font-bold">
                                            {b.code}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-1">
                                          {b.city ? `${b.city}, ${b.state || ''}` : 'Location on record'}
                                        </div>
                                      </div>
                                      <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500">Status: {b.status || 'ACTIVE'}</span>
                                        <button
                                          onClick={() => handleDetachBranch(fr.id, b.id, b.name)}
                                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                                          title="Detach branch from franchise (preserves all records)"
                                        >
                                          Detach
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: 2-INSTALLMENT ROYALTY SCHEDULE */}
      {activeTab === 'installments' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={selectedFranchiseFilter}
                onChange={(e) => setSelectedFranchiseFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006FFF]"
              >
                <option value="ALL">All Franchises ({installments.length} installments)</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>

              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter schedule..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006FFF]"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Showing {filteredInstallments.length} installments (2 per agreement year)
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Franchise</th>
                  <th className="px-4 py-3">Installment Period</th>
                  <th className="px-4 py-3">Calculation Basis</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Paid / Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Payment Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstallments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                      No installments found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredInstallments.map((inst) => {
                    const isFullyPaid = Number(inst.outstandingBalance) <= 0;
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{inst.franchiseName}</div>
                          <div className="text-xs font-mono text-[#006FFF] whitespace-nowrap">{inst.franchiseCode}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{inst.periodLabel}</div>
                          <div className="text-xs text-slate-500">
                            {inst.agreement?.agreementNumber || 'Annual Agreement'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-semibold text-slate-800">
                            {inst.calculationBasis === 'FIXED_ANNUAL'
                              ? 'Fixed Annual'
                              : inst.calculationBasis === 'PER_STUDENT'
                                ? 'Per-Student'
                                : 'Revenue Share'}
                          </div>
                          {inst.calculationBreakdown?.formula && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {inst.calculationBreakdown.formula}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800">
                            {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          ₹{Number(inst.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-emerald-600 font-semibold">
                            Paid: ₹{Number(inst.paidAmount).toLocaleString('en-IN')}
                          </div>
                          <div className="text-xs text-rose-600 font-medium">
                            Balance: ₹{Number(inst.outstandingBalance).toLocaleString('en-IN')}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{renderStatusBadge(inst.liveStatus || inst.status)}</td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          {!isFullyPaid ? (
                            <button
                              onClick={() => {
                                setSelectedInstallmentForPayment(inst);
                                setPaymentForm({
                                  amountPaid: String(Number(inst.outstandingBalance)),
                                  paymentMethod: 'BANK_TRANSFER',
                                  transactionReference: '',
                                  remarks: `Installment #${inst.installmentNumber} payment`,
                                  paymentDate: new Date().toISOString().split('T')[0],
                                });
                                setShowRecordPaymentModal(true);
                              }}
                              className="px-3 py-1.5 text-xs font-bold bg-[#006FFF] hover:bg-[#0055CC] text-white rounded-lg shadow-sm transition-all"
                            >
                              Record Payment
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-emerald-600">Settled</span>
                          )}

                          {inst.payments && inst.payments.length > 0 && (
                            <button
                              onClick={() => handleOpenReceipt(inst.payments[0].id, inst.franchiseId)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg inline-flex items-center gap-1 transition-all"
                              title="View Official Receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" /> Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AGREEMENTS & RENEWALS */}
      {activeTab === 'agreements' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="text-sm text-slate-600">
            Official annual agreements governing franchise operations, calculation basis, and royalty schedules.
          </div>

          <div className="space-y-4">
            {franchises.map((fr) => (
              <div key={fr.id} className="border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 text-lg">{fr.name}</h3>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {fr.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Owner: {fr.ownerName} | Location: {fr.city}, {fr.state}
                    </div>
                  </div>

                  {fr.agreements && fr.agreements.length > 0 && (
                    <button
                      onClick={() => {
                        const activeAgr = fr.agreements?.find((a) => a.status === 'ACTIVE') || fr.agreements![0];
                        setSelectedAgreementForRenew(activeAgr);
                        setRenewForm({
                          title: `Annual Master Franchise Renewal (${new Date().getFullYear() + 1})`,
                          startDate: new Date(activeAgr.endDate).toISOString().split('T')[0],
                          endDate: new Date(new Date(activeAgr.endDate).getTime() + 365 * 24 * 60 * 60 * 1000)
                            .toISOString()
                            .split('T')[0],
                          calculationMethod: (activeAgr.calculationMethod || 'FIXED_ANNUAL') as any,
                          annualRoyaltyAmount: Number(activeAgr.annualRoyaltyAmount || 200000),
                          royaltyPercentage: Number(activeAgr.royaltyPercentage || 50),
                          royaltyBasis: activeAgr.royaltyBasis || 'TOTAL_COLLECTIONS',
                          perStudentFee: Number(activeAgr.perStudentFee || 2000),
                          dueDay: activeAgr.dueDay || 10,
                          terms: activeAgr.terms || '',
                          notes: '',
                        });
                        setShowRenewModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Renew Agreement (Next Year)
                    </button>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Agreements History
                  </div>
                  <div className="space-y-2">
                    {fr.agreements?.map((agr) => (
                      <div
                        key={agr.id}
                        className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 p-3 rounded-lg text-xs gap-2"
                      >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{agr.agreementNumber}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${agr.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                                }`}
                            >
                              {agr.status}
                            </span>
                            <span className="font-medium text-slate-600">({agr.title})</span>
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Period:{' '}
                            {new Date(agr.startDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            to{' '}
                            {new Date(agr.endDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">
                              {agr.calculationMethod === 'FIXED_ANNUAL'
                                ? `₹${Number(agr.annualRoyaltyAmount || 0).toLocaleString('en-IN')}/yr`
                                : agr.calculationMethod === 'PER_STUDENT'
                                  ? `₹${Number(agr.perStudentFee || 0).toLocaleString('en-IN')}/student`
                                  : `${agr.royaltyPercentage}% Collections`}
                            </div>
                            <div className="text-[10px] text-slate-500">2 Installments</div>
                          </div>

                          {agr.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setSelectedAgreementForRevise(agr);
                                setSelectedFranchiseForRevise(fr);
                                setReviseForm({
                                  title: `${agr.title} (Rev v${(agr.version || 1) + 1})`,
                                  startDate: new Date().toISOString().split('T')[0],
                                  endDate: agr.endDate ? new Date(agr.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  agreementType: agr.agreementType || 'NEW_CENTRE_JOINT_INVESTMENT',
                                  calculationMethod: agr.calculationMethod || 'PERCENTAGE_REVENUE',
                                  annualRoyaltyAmount: Number(agr.annualRoyaltyAmount || 200000),
                                  perStudentFee: Number(agr.perStudentFee || 2000),
                                  royaltyPercentage: Number(agr.digitalGuruRevenuePercentage || agr.royaltyPercentage || 50),
                                  digitalGuruRevenuePercentage: Number(agr.digitalGuruRevenuePercentage || agr.royaltyPercentage || 50),
                                  partnerRevenuePercentage: Number(agr.partnerRevenuePercentage || 50),
                                  revenueCalculationBasis: agr.revenueCalculationBasis || 'GROSS_COURSE_FEES',
                                  settlementFrequency: agr.settlementFrequency || 'MONTHLY',
                                  totalInvestment: Number(agr.totalInvestment || 0),
                                  digitalGuruInvestmentAmount: Number(agr.digitalGuruInvestmentAmount || 0),
                                  partnerInvestmentAmount: Number(agr.partnerInvestmentAmount || 0),
                                  digitalGuruInvestmentPercentage: Number(agr.digitalGuruInvestmentPercentage || 0),
                                  partnerInvestmentPercentage: Number(agr.partnerInvestmentPercentage || 0),
                                  operationalSetupContribution: Number(agr.operationalSetupContribution || 0),
                                  investmentNotes: agr.investmentNotes || '',
                                  expenseResponsibilities: (agr.expenseResponsibilities && typeof agr.expenseResponsibilities === 'object') ? agr.expenseResponsibilities : {
                                    rent: 'PARTNER',
                                    trainerSalaries: 'DIGITAL_GURU',
                                    staffSalaries: 'PARTNER',
                                    operationalSetup: 'SHARED',
                                    utilities: 'PARTNER',
                                    marketing: 'DIGITAL_GURU',
                                    other: 'PARTNER',
                                  },
                                  marketingResponsibleParty: agr.marketingResponsibleParty || 'DIGITAL_GURU',
                                  marketingSupportDurationMonths: Number(agr.marketingSupportDurationMonths || 3),
                                  marketingPostSupportParty: agr.marketingPostSupportParty || 'PARTNER',
                                  marketingBudget: Number(agr.marketingBudget || 50000),
                                  marketingEffectiveStartDate: agr.marketingEffectiveStartDate ? new Date(agr.marketingEffectiveStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  marketingNotes: agr.marketingNotes || '',
                                  courseSoftwareAccessEnabled: agr.courseSoftwareAccessEnabled !== false,
                                  courseSoftwarePricingNotes: agr.courseSoftwarePricingNotes || '',
                                  terms: agr.terms || '',
                                  notes: agr.notes || '',
                                });
                                setShowReviseModal(true);
                              }}
                              className="px-2.5 py-1 text-[#006FFF] hover:text-blue-800 font-semibold bg-white border border-blue-200 rounded text-xs"
                              title="Create revision version N+1 linked via parent agreement"
                            >
                              Revise (v{(agr.version || 1) + 1})
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedAgreementForAmend(agr);
                              setAmendForm({
                                note: '',
                                royaltyPercentage: Number(agr.royaltyPercentage || 50),
                                annualRoyaltyAmount: Number(agr.annualRoyaltyAmount || 200000),
                              });
                              setShowAmendModal(true);
                            }}
                            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold bg-white border border-slate-200 rounded"
                          >
                            Amend
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MONTHLY ROYALTY SETTLEMENTS & RECORDS */}
      {activeTab === 'monthly_settlements' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#006FFF]" /> Monthly Royalty Statements & Collections
              </h3>
              <p className="text-xs text-slate-500">
                Monthly royalty settlements recorded on actual course fee collections, deductible operating expenses, and agreed sharing percentages.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadMonthlyRecords}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  if (franchises.length > 0 && !calculateForm.franchiseId) {
                    setCalculateForm({ ...calculateForm, franchiseId: franchises[0].id });
                  }
                  setShowCalculateModal(true);
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 rounded-lg shadow transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Calculate Monthly Royalty
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Franchise & Campus</th>
                  <th className="px-4 py-3">Collections</th>
                  <th className="px-4 py-3">Calculation Basis</th>
                  <th className="px-4 py-3">Deductible / Net</th>
                  <th className="px-4 py-3">Digital Guru Share</th>
                  <th className="px-4 py-3">Partner Share</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                      {loadingMonthly ? 'Loading monthly royalty statements...' : 'No monthly royalty records found. Click "+ Calculate Monthly Royalty" to generate monthly statements.'}
                    </td>
                  </tr>
                ) : (
                  monthlyRecords.map((rec) => {
                    const dgShare = Number(rec.royaltyPayable || 0);
                    const gross = Number(rec.grossCollection || 0);
                    const net = Number(rec.eligibleRevenue || 0);
                    const partnerShare = Math.round((net - dgShare) * 100) / 100;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors text-xs">
                        <td className="px-4 py-3 font-mono font-bold text-[#006FFF]">
                          {rec.periodLabel}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{rec.franchise?.name || 'Franchise'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {rec.institute?.name ? `Campus: ${rec.institute.name}` : 'All Assigned Campuses'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          ₹{gross.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold">
                            {rec.calculationDetails?.calculationBasis || 'GROSS_COURSE_FEES'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div>Distributable: ₹{net.toLocaleString('en-IN')}</div>
                          {rec.calculationDetails?.deductibleExpenses > 0 && (
                            <div className="text-[10px] text-rose-600">
                              -₹{Number(rec.calculationDetails.deductibleExpenses).toLocaleString('en-IN')} Exp
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-emerald-700">
                            ₹{dgShare.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {Number(rec.royaltyPercentage)}% DG Share
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-sky-700">
                            ₹{partnerShare.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {100 - Number(rec.royaltyPercentage)}% Retained
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">
                          {new Date(rec.dueDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${rec.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.status === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 1: REGISTER FRANCHISE OWNER (SECTION-BY-SECTION WIZARD) */}
      {/* ============================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl my-2 sm:my-4 border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Modal Header with Stepper Tabs */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-display flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#006FFF]" />
                    Register Franchisee Admin
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Multi-step setup for franchise profile, agreement model, financial terms, and pre-submission review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wizard Tabs / Stepper */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-1">
                {[
                  { id: 'profile', step: '1', title: 'Business Profile', desc: 'Owner & Address', isComplete: isProfileStepComplete, isAccessible: true },
                  { id: 'model', step: '2', title: 'Agreement Model', desc: 'Preset & Duration', isComplete: isModelStepComplete, isAccessible: isProfileStepComplete },
                  { id: 'financials', step: '3', title: 'Financial Terms', desc: 'Investment & Rev Share', isComplete: isFinancialsStepComplete, isAccessible: isProfileStepComplete && isModelStepComplete },
                  { id: 'review', step: '4', title: 'Review & Submit', desc: 'Summary & Confirm', isComplete: false, isAccessible: isProfileStepComplete && isModelStepComplete && isFinancialsStepComplete },
                ].map((t) => {
                  const isActive = createModalTab === t.id;
                  const isLocked = !t.isAccessible;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTabClick(t.id as any)}
                      title={isLocked ? 'Complete the previous section to unlock this step' : undefined}
                      className={`text-left p-2.5 rounded-xl border transition-all ${isActive
                          ? 'bg-blue-50/90 border-[#006FFF] shadow-xs ring-1 ring-[#006FFF]'
                          : isLocked
                            ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                            : t.isComplete
                              ? 'bg-emerald-50/40 border-emerald-300 text-slate-700 hover:bg-emerald-50 cursor-pointer'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isActive
                                ? 'bg-[#006FFF] text-white'
                                : t.isComplete
                                  ? 'bg-emerald-600 text-white'
                                  : isLocked
                                    ? 'bg-slate-200 text-slate-400'
                                    : 'bg-slate-200 text-slate-700'
                              }`}
                          >
                            {t.isComplete && !isActive ? '✓' : t.step}
                          </span>
                          <span className={`text-xs font-bold leading-tight ${isActive ? 'text-[#006FFF]' : isLocked ? 'text-slate-400' : 'text-slate-800'
                            }`}>
                            {t.title}
                          </span>
                        </div>
                        {isLocked && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 pl-7 hidden sm:block truncate">
                        {isLocked ? 'Locked until section filled' : t.isComplete ? 'Section completed ✓' : t.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleCreateFranchise} className="flex flex-col flex-1 min-h-0">
              <div ref={createModalBodyRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* --------------------------------------------------------- */}
                {/* STEP 1: BUSINESS PROFILE & OWNER DETAILS                  */}
                {/* --------------------------------------------------------- */}
                {createModalTab === 'profile' && (
                  <div className="space-y-5">
                    {/* Subsection 1: Business Profile */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1">
                        1. Franchise Business Profile
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Franchise / Center Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Digital Guru Chennai Central"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Franchise Code (Optional)</label>
                          <input
                            type="text"
                            placeholder="Auto-generated if left blank (e.g. DG-FR-1001)"
                            value={createForm.code}
                            onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${duplicateCheckResult.codeConflict?.isDuplicate ? 'border-rose-400 bg-rose-50/40 text-rose-900' : ''
                              }`}
                          />
                          {duplicateCheckResult.codeConflict?.isDuplicate && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {duplicateCheckResult.codeConflict.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Owner Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Rajesh Kannan"
                            value={createForm.ownerName}
                            onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Owner Email Address *</label>
                          <input
                            type="email"
                            required
                            placeholder="owner@dgchennai.com"
                            value={createForm.email}
                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${(duplicateFranchiseMatch || (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise'))
                                ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                                : duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'User'
                                  ? 'border-blue-400 bg-blue-50/30'
                                  : ''
                              }`}
                          />
                          {(duplicateFranchiseMatch || (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise')) && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {duplicateCheckResult.emailConflict?.message || `A franchise with this email already exists (${duplicateFranchiseMatch?.name} [${duplicateFranchiseMatch?.code}]).`}
                            </p>
                          )}
                          {!duplicateFranchiseMatch && duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'User' && (
                            <p className="mt-1 text-xs text-blue-600 font-medium flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              {duplicateCheckResult.emailConflict.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Primary Mobile Number *</label>
                          <input
                            type="tel"
                            required
                            placeholder="+91 98765 43210"
                            value={createForm.phone}
                            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${duplicateCheckResult.phoneConflict?.isDuplicate ? 'border-rose-400 bg-rose-50/40 text-rose-900' : ''
                              }`}
                          />
                          {duplicateCheckResult.phoneConflict?.isDuplicate && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {duplicateCheckResult.phoneConflict.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-slate-700">Full Business Address *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Suite 402, Anna Salai Commercial Complex"
                            value={createForm.address}
                            onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">City *</label>
                          <input
                            type="text"
                            required
                            placeholder="Chennai"
                            value={createForm.city}
                            onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">State *</label>
                          <input
                            type="text"
                            required
                            placeholder="Tamil Nadu"
                            value={createForm.state}
                            onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Postal / PIN Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="600002"
                            value={createForm.postalCode}
                            onChange={(e) => setCreateForm({ ...createForm, postalCode: e.target.value })}
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subsection 2: Authorized Alternate Contact */}
                    <div className="space-y-3 pt-3 border-t">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1">
                        2. Authorized Contact Person (If Different from Owner)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Contact Person Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Priya Sharma"
                            value={createForm.authorizedContact.name}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                authorizedContact: { ...createForm.authorizedContact, name: e.target.value },
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Designation / Role</label>
                          <input
                            type="text"
                            placeholder="e.g. Managing Partner / Director"
                            value={createForm.authorizedContact.designation}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                authorizedContact: { ...createForm.authorizedContact, designation: e.target.value },
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subsection 3: Campus / Institute Association (Optional) */}
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-center justify-between border-b pb-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#006FFF]" />
                          3. Campus / Institute Association (Optional)
                        </div>
                        <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Optional • Can also be attached later via Edit option
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        Link an existing operational campus or create a new branch directly for this franchise. You can skip this step and add campuses anytime later through the franchise Edit option.
                      </p>

                      {/* Radio Selector Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div
                          onClick={() => setCreateForm({ ...createForm, branchOption: 'NONE' })}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${createForm.branchOption === 'NONE'
                              ? 'bg-blue-50/70 border-[#006FFF] ring-1 ring-[#006FFF]'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">Skip for now</span>
                            <input
                              type="radio"
                              name="branchOption"
                              checked={createForm.branchOption === 'NONE'}
                              onChange={() => setCreateForm({ ...createForm, branchOption: 'NONE' })}
                              className="text-[#006FFF]"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Create franchise first. Attach or create campus branches later using the Edit option.
                          </p>
                        </div>

                        <div
                          onClick={() => setCreateForm({ ...createForm, branchOption: 'LINK_EXISTING' })}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${createForm.branchOption === 'LINK_EXISTING'
                              ? 'bg-blue-50/70 border-[#006FFF] ring-1 ring-[#006FFF]'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">Link Existing Institute</span>
                            <input
                              type="radio"
                              name="branchOption"
                              checked={createForm.branchOption === 'LINK_EXISTING'}
                              onChange={() => setCreateForm({ ...createForm, branchOption: 'LINK_EXISTING' })}
                              className="text-[#006FFF]"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Select from available unassigned institutes ({unassignedBranches.length} available).
                          </p>
                        </div>

                        <div
                          onClick={() => {
                            setCreateForm({
                              ...createForm,
                              branchOption: 'CREATE_NEW',
                              newBranch: {
                                ...createForm.newBranch,
                                name: createForm.newBranch.name || (createForm.name ? `${createForm.name} Campus` : ''),
                                city: createForm.newBranch.city || createForm.city,
                                state: createForm.newBranch.state || createForm.state,
                                address: createForm.newBranch.address || createForm.address,
                                phone: createForm.newBranch.phone || createForm.phone,
                                email: createForm.newBranch.email || createForm.email,
                              },
                            });
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${createForm.branchOption === 'CREATE_NEW'
                              ? 'bg-blue-50/70 border-[#006FFF] ring-1 ring-[#006FFF]'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">Create & Link New Campus</span>
                            <input
                              type="radio"
                              name="branchOption"
                              checked={createForm.branchOption === 'CREATE_NEW'}
                              onChange={() => { }}
                              className="text-[#006FFF]"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Set up a new campus branch attached directly to this franchise.
                          </p>
                        </div>
                      </div>

                      {/* Conditional sub-form: LINK_EXISTING */}
                      {createForm.branchOption === 'LINK_EXISTING' && (
                        <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl space-y-2 mt-2">
                          <label className="block text-xs font-bold text-slate-800">
                            Select Unassigned Institute / Campus Branch:
                          </label>
                          {unassignedBranches.length === 0 ? (
                            <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                              No unassigned institutes currently available. You can select &ldquo;Create & Link New Campus&rdquo; or &ldquo;Skip for now&rdquo; to link via Edit later.
                            </div>
                          ) : (
                            <select
                              value={createForm.linkedInstituteId}
                              onChange={(e) => setCreateForm({ ...createForm, linkedInstituteId: e.target.value })}
                              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#006FFF]"
                            >
                              <option value="">-- Choose an institute to link --</option>
                              {unassignedBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code} - {b.name} ({b.city || 'Tamil Nadu'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* Conditional sub-form: CREATE_NEW */}
                      {createForm.branchOption === 'CREATE_NEW' && (
                        <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3 mt-2">
                          <div className="text-xs font-bold text-slate-800">New Campus Branch Details:</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Campus / Branch Name *</label>
                              <input
                                type="text"
                                placeholder="e.g. Digital Guru Adyar Campus"
                                value={createForm.newBranch.name}
                                onChange={(e) =>
                                  setCreateForm({
                                    ...createForm,
                                    newBranch: { ...createForm.newBranch, name: e.target.value },
                                  })
                                }
                                className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#006FFF]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Campus Code (Optional, auto-generated)</label>
                              <input
                                type="text"
                                placeholder="e.g. BR-005"
                                value={createForm.newBranch.code}
                                onChange={(e) =>
                                  setCreateForm({
                                    ...createForm,
                                    newBranch: { ...createForm.newBranch, code: e.target.value },
                                  })
                                }
                                className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#006FFF]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700">City</label>
                              <input
                                type="text"
                                placeholder="e.g. Chennai"
                                value={createForm.newBranch.city}
                                onChange={(e) =>
                                  setCreateForm({
                                    ...createForm,
                                    newBranch: { ...createForm.newBranch, city: e.target.value },
                                  })
                                }
                                className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#006FFF]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700">Phone</label>
                              <input
                                type="tel"
                                placeholder="+91 98765 43210"
                                value={createForm.newBranch.phone}
                                onChange={(e) =>
                                  setCreateForm({
                                    ...createForm,
                                    newBranch: { ...createForm.newBranch, phone: e.target.value },
                                  })
                                }
                                className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#006FFF]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* STEP 2: MASTER AGREEMENT & BUSINESS MODEL PRESET          */}
                {/* --------------------------------------------------------- */}
                {createModalTab === 'model' && (
                  <div className="space-y-5">
                    <div className="space-y-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1 flex items-center justify-between">
                        <span>Select Agreement Business Model Preset</span>
                        <span className="text-[10px] text-[#006FFF] font-semibold">Authoritative Dynamic Templates</span>
                      </div>

                      {/* Preset Business Model Selector */}
                      <div>
                        {templatesLoading ? (
                          <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                            <div className="w-4 h-4 border-2 border-[#006FFF] border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading agreement templates from server...</span>
                          </div>
                        ) : templatesError ? (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                            <span className="font-medium">Failed to load templates: {templatesError}</span>
                            <button
                              type="button"
                              onClick={loadAgreementTemplates}
                              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition text-[11px]"
                            >
                              Retry Loading
                            </button>
                          </div>
                        ) : agreementTemplates.length === 0 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            No agreement templates available on server.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {agreementTemplates.map((tmpl: any) => {
                              const isSelected = createForm.initialAgreement.agreementType === tmpl.type;
                              const defs = tmpl.defaults || {};
                              return (
                                <button
                                  key={tmpl.type}
                                  type="button"
                                  onClick={() => {
                                    const normExpenses: Record<string, string> = {};
                                    if (defs.expenseResponsibilities && typeof defs.expenseResponsibilities === 'object') {
                                      for (const [k, v] of Object.entries(defs.expenseResponsibilities)) {
                                        normExpenses[k] = typeof v === 'object' && v !== null && (v as any).payer ? (v as any).payer : String(v);
                                      }
                                    }
                                    setCreateForm({
                                      ...createForm,
                                      initialAgreement: {
                                        ...createForm.initialAgreement,
                                        agreementType: tmpl.type as any,
                                        title: defs.title || createForm.initialAgreement.title,
                                        calculationMethod: defs.calculationMethod || createForm.initialAgreement.calculationMethod,
                                        annualRoyaltyAmount: defs.annualRoyaltyAmount !== undefined ? defs.annualRoyaltyAmount : createForm.initialAgreement.annualRoyaltyAmount,
                                        digitalGuruRevenuePercentage: defs.digitalGuruRevenuePercentage !== undefined ? defs.digitalGuruRevenuePercentage : 50,
                                        partnerRevenuePercentage: defs.partnerRevenuePercentage !== undefined ? defs.partnerRevenuePercentage : 50,
                                        royaltyPercentage: defs.digitalGuruRevenuePercentage !== undefined ? defs.digitalGuruRevenuePercentage : 50,
                                        revenueCalculationBasis: defs.revenueCalculationBasis || 'GROSS_COURSE_FEES',
                                        settlementFrequency: defs.settlementFrequency || 'MONTHLY',
                                        totalInvestment: defs.totalInvestment !== undefined ? defs.totalInvestment : 0,
                                        digitalGuruInvestmentAmount: defs.digitalGuruInvestmentAmount !== undefined ? defs.digitalGuruInvestmentAmount : 0,
                                        partnerInvestmentAmount: defs.partnerInvestmentAmount !== undefined ? defs.partnerInvestmentAmount : 0,
                                        digitalGuruInvestmentPercentage: defs.digitalGuruInvestmentPercentage !== undefined ? defs.digitalGuruInvestmentPercentage : 0,
                                        partnerInvestmentPercentage: defs.partnerInvestmentPercentage !== undefined ? defs.partnerInvestmentPercentage : 0,
                                        operationalSetupContribution: defs.operationalSetupContribution !== undefined ? defs.operationalSetupContribution : 0,
                                        investmentNotes: defs.investmentNotes || '',
                                        expenseResponsibilities: Object.keys(normExpenses).length > 0 ? normExpenses : createForm.initialAgreement.expenseResponsibilities,
                                        marketingResponsibleParty: defs.marketingResponsibleParty || 'DIGITAL_GURU',
                                        marketingSupportDurationMonths: defs.marketingSupportDurationMonths !== undefined ? defs.marketingSupportDurationMonths : 0,
                                        marketingPostSupportParty: defs.marketingPostSupportParty || 'PARTNER',
                                        marketingBudget: defs.marketingBudget !== undefined ? defs.marketingBudget : 0,
                                        courseSoftwareAccessEnabled: defs.courseSoftwareAccessEnabled !== undefined ? defs.courseSoftwareAccessEnabled : true,
                                        courseSoftwarePricingNotes: defs.courseSoftwarePricingNotes || '',
                                      },
                                    });
                                  }}
                                  className={`p-3 rounded-xl text-left border text-xs transition-all ${isSelected
                                      ? 'bg-blue-50 border-[#006FFF] text-[#006FFF] font-bold shadow-sm ring-1 ring-[#006FFF]'
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                  <div className="font-bold text-[12px] leading-tight">{tmpl.label}</div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    {defs.digitalGuruRevenuePercentage ?? 50}:{defs.partnerRevenuePercentage ?? 50} Rev • {defs.settlementFrequency || 'MONTHLY'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1.5 italic">
                          Presets provide illustrative defaults only. All values are independent and fully editable in the next step.
                        </p>
                      </div>

                      {/* Dates & Settlement Frequency */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Agreement Start Date *</label>
                          <input
                            type="date"
                            required
                            value={createForm.initialAgreement.startDate}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: { ...createForm.initialAgreement, startDate: e.target.value },
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Agreement End Date (1 Year) *</label>
                          <input
                            type="date"
                            required
                            value={createForm.initialAgreement.endDate}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: { ...createForm.initialAgreement, endDate: e.target.value },
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Settlement Frequency *</label>
                          <select
                            value={createForm.initialAgreement.settlementFrequency}
                            onChange={(e: any) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  settlementFrequency: e.target.value,
                                },
                              })
                            }
                            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#006FFF]"
                          >
                            <option value="MONTHLY">Monthly Settlement</option>
                            <option value="YEARLY">Yearly Settlement (2 Equal Installments)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* STEP 3: FINANCIAL TERMS & OPERATIONAL RESPONSIBILITIES   */}
                {/* --------------------------------------------------------- */}
                {createModalTab === 'financials' && (
                  <div className="space-y-4">
                    {/* Setup Investment */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="text-xs font-bold text-slate-800">Initial Setup Investment Configuration (Independent of Revenue Split)</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Total Setup Investment (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={createForm.initialAgreement.totalInvestment || ''}
                            onChange={(e) => {
                              const total = Number(e.target.value);
                              const dgPct = Number(createForm.initialAgreement.digitalGuruInvestmentPercentage || 50);
                              const dgAmt = Math.round((total * dgPct) / 100);
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  totalInvestment: total,
                                  digitalGuruInvestmentAmount: dgAmt,
                                  partnerInvestmentAmount: total - dgAmt,
                                },
                              });
                            }}
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                            placeholder="200000"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Digital Guru Investment (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={createForm.initialAgreement.digitalGuruInvestmentPercentage || ''}
                            onChange={(e) => {
                              const dgPct = Number(e.target.value);
                              const partnerPct = 100 - dgPct;
                              const total = Number(createForm.initialAgreement.totalInvestment || 0);
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  digitalGuruInvestmentPercentage: dgPct,
                                  partnerInvestmentPercentage: partnerPct,
                                  digitalGuruInvestmentAmount: Math.round((total * dgPct) / 100),
                                  partnerInvestmentAmount: Math.round((total * partnerPct) / 100),
                                },
                              });
                            }}
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                            placeholder="50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Partner Investment (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={createForm.initialAgreement.partnerInvestmentPercentage || ''}
                            onChange={(e) => {
                              const partnerPct = Number(e.target.value);
                              const dgPct = 100 - partnerPct;
                              const total = Number(createForm.initialAgreement.totalInvestment || 0);
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  partnerInvestmentPercentage: partnerPct,
                                  digitalGuruInvestmentPercentage: dgPct,
                                  digitalGuruInvestmentAmount: Math.round((total * dgPct) / 100),
                                  partnerInvestmentAmount: Math.round((total * partnerPct) / 100),
                                },
                              });
                            }}
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                            placeholder="50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700">Operational Setup Contribution (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={createForm.initialAgreement.operationalSetupContribution || ''}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              initialAgreement: {
                                ...createForm.initialAgreement,
                                operationalSetupContribution: Number(e.target.value),
                              },
                            })
                          }
                          className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                          placeholder="50000"
                        />
                      </div>
                    </div>

                    {/* Revenue Sharing & Calculation Basis */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">Revenue Sharing Configuration</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${Number(createForm.initialAgreement.digitalGuruRevenuePercentage) +
                              Number(createForm.initialAgreement.partnerRevenuePercentage) ===
                              100
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                            }`}
                        >
                          Total:{' '}
                          {Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 0) +
                            Number(createForm.initialAgreement.partnerRevenuePercentage || 0)}
                          % (Must = 100%)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Digital Guru Revenue Share (%) *</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={createForm.initialAgreement.digitalGuruRevenuePercentage}
                            onChange={(e) => {
                              const dg = Number(e.target.value);
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  digitalGuruRevenuePercentage: dg,
                                  partnerRevenuePercentage: 100 - dg,
                                  royaltyPercentage: dg,
                                },
                              });
                            }}
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Franchise Partner Revenue Share (%) *</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={createForm.initialAgreement.partnerRevenuePercentage}
                            onChange={(e) => {
                              const pt = Number(e.target.value);
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  partnerRevenuePercentage: pt,
                                  digitalGuruRevenuePercentage: 100 - pt,
                                  royaltyPercentage: 100 - pt,
                                },
                              });
                            }}
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700">Commercial Model *</label>
                          <select
                            value={createForm.initialAgreement.calculationMethod}
                            onChange={(e: any) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  calculationMethod: e.target.value,
                                },
                              })
                            }
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                          >
                            <option value="PERCENTAGE_REVENUE">Percentage of Revenue Collections</option>
                            <option value="FIXED_ANNUAL">Fixed Annual Commercial Fee</option>
                            <option value="PER_STUDENT">Per Enrolled Student Fee</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Revenue Calculation Basis *</label>
                          <select
                            value={createForm.initialAgreement.revenueCalculationBasis}
                            onChange={(e: any) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  revenueCalculationBasis: e.target.value,
                                },
                              })
                            }
                            className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                          >
                            <option value="GROSS_COURSE_FEES">Gross Course Fees Collected</option>
                            <option value="NET_COURSE_REVENUE">Net Course Revenue (After Refunds/Adjustments)</option>
                            <option value="PROFIT_AFTER_EXPENSES">Profit After Deductible Operating Expenses</option>
                          </select>
                        </div>

                        {createForm.initialAgreement.calculationMethod === 'FIXED_ANNUAL' && (
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700">
                              Annual Agreed Commercial Fee (₹) *
                              <span className="text-[10px] text-slate-500 font-normal ml-1">
                                (Generates 2 equal H1/H2 installments of ₹{Math.round(Number(createForm.initialAgreement.annualRoyaltyAmount || 0) / 2).toLocaleString('en-IN')} each when Yearly settlement is active)
                              </span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={createForm.initialAgreement.annualRoyaltyAmount || ''}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  initialAgreement: {
                                    ...createForm.initialAgreement,
                                    annualRoyaltyAmount: Number(e.target.value),
                                  },
                                })
                              }
                              className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-semibold text-slate-900 bg-white"
                              placeholder="e.g. 200000"
                            />
                          </div>
                        )}

                        {createForm.initialAgreement.calculationMethod === 'PER_STUDENT' && (
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700">
                              Fee Per Active Enrolled Student (₹) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={createForm.initialAgreement.perStudentFee || ''}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  initialAgreement: {
                                    ...createForm.initialAgreement,
                                    perStudentFee: Number(e.target.value),
                                  },
                                })
                              }
                              className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-semibold text-slate-900 bg-white"
                              placeholder="e.g. 2000"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Operational Expense Responsibilities */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="text-xs font-bold text-slate-800">Operational Expense Responsibilities</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { key: 'rent', label: 'Centre Rent' },
                          { key: 'trainerSalaries', label: 'Trainer Salaries' },
                          { key: 'staffSalaries', label: 'Staff Salaries' },
                          { key: 'operationalSetup', label: 'Operational Setup' },
                          { key: 'utilities', label: 'Utilities (Electricity/Net)' },
                          { key: 'marketing', label: 'Marketing Campaigns' },
                          { key: 'other', label: 'Other Sundry Expenses' },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="block text-[11px] font-medium text-slate-600">{label}</label>
                            <select
                              value={createForm.initialAgreement.expenseResponsibilities[key] || 'PARTNER'}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  initialAgreement: {
                                    ...createForm.initialAgreement,
                                    expenseResponsibilities: {
                                      ...createForm.initialAgreement.expenseResponsibilities,
                                      [key]: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="mt-0.5 w-full px-2 py-1 border rounded text-xs bg-white"
                            >
                              <option value="PARTNER">Partner</option>
                              <option value="DIGITAL_GURU">Digital Guru</option>
                              <option value="SHARED">Shared (50:50)</option>
                              <option value="CUSTOM">Custom</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Marketing & Course Software Access */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-xs font-bold text-slate-800">Marketing Support</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600">Responsible Party</label>
                            <select
                              value={createForm.initialAgreement.marketingResponsibleParty}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  initialAgreement: {
                                    ...createForm.initialAgreement,
                                    marketingResponsibleParty: e.target.value,
                                  },
                                })
                              }
                              className="mt-0.5 w-full px-2 py-1 border rounded text-xs bg-white"
                            >
                              <option value="DIGITAL_GURU">Digital Guru</option>
                              <option value="PARTNER">Partner</option>
                              <option value="SHARED">Shared</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600">Duration (Months)</label>
                            <input
                              type="number"
                              min="0"
                              value={createForm.initialAgreement.marketingSupportDurationMonths}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  initialAgreement: {
                                    ...createForm.initialAgreement,
                                    marketingSupportDurationMonths: Number(e.target.value),
                                  },
                                })
                              }
                              className="mt-0.5 w-full px-2 py-1 border rounded text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="text-xs font-bold text-slate-800">Course Software Access</div>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={createForm.initialAgreement.courseSoftwareAccessEnabled}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                initialAgreement: {
                                  ...createForm.initialAgreement,
                                  courseSoftwareAccessEnabled: e.target.checked,
                                },
                              })
                            }
                            className="rounded text-[#006FFF] focus:ring-[#006FFF] w-4 h-4"
                          />
                          <span className="font-semibold">Course Software Access Enabled</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Software pricing notes / terms"
                          value={createForm.initialAgreement.courseSoftwarePricingNotes}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              initialAgreement: {
                                ...createForm.initialAgreement,
                                courseSoftwarePricingNotes: e.target.value,
                              },
                            })
                          }
                          className="mt-1 w-full px-2 py-1 border rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* --------------------------------------------------------- */}
                {/* STEP 4: PRE-SUBMISSION REVIEW & SUMMARY                  */}
                {/* --------------------------------------------------------- */}
                {createModalTab === 'review' && (
                  <div className="space-y-4">
                    {/* Commercial Agreement Summary */}
                    <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 shadow-md border border-slate-700">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#FEDC32]" />
                          <span className="font-bold text-xs uppercase tracking-wider text-[#FEDC32]">Commercial Agreement Summary (Pre-Submission Review)</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900 text-blue-200 font-mono font-semibold">
                          {createForm.initialAgreement.settlementFrequency} • {createForm.initialAgreement.revenueCalculationBasis}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Digital Guru Column */}
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
                          <div className="font-bold text-sm text-[#FEDC32] flex items-center justify-between">
                            <span>Digital Guru (Franchisor)</span>
                            <span className="text-emerald-400 font-black">{createForm.initialAgreement.digitalGuruRevenuePercentage}% Rev</span>
                          </div>
                          <div className="space-y-1 text-slate-300 text-[11px]">
                            <div>
                              <span className="text-slate-400">Setup Capital Investment:</span>{' '}
                              <strong className="text-white">₹{Number(createForm.initialAgreement.digitalGuruInvestmentAmount || 0).toLocaleString('en-IN')}</strong> ({createForm.initialAgreement.digitalGuruInvestmentPercentage}%)
                            </div>
                            <div>
                              <span className="text-slate-400">Direct Expenses Paid:</span>{' '}
                              <span className="text-amber-200">
                                {Object.entries(createForm.initialAgreement.expenseResponsibilities || {})
                                  .filter(([_, v]) => v === 'DIGITAL_GURU' || (typeof v === 'object' && (v as any)?.payer === 'DIGITAL_GURU'))
                                  .map(([k]) => k === 'trainerSalaries' ? 'Certified Trainers' : k === 'marketing' ? 'Initial Marketing' : k)
                                  .join(', ') || 'Direct Trainer Salaries & Marketing'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Support Responsibilities:</span>{' '}
                              <span className="text-white">
                                {createForm.initialAgreement.marketingSupportDurationMonths || 0} Mos Marketing Support (₹{Number(createForm.initialAgreement.marketingBudget || 0).toLocaleString('en-IN')}), Certified Course Trainers, Software Access ({createForm.initialAgreement.courseSoftwareAccessEnabled ? 'Enabled' : 'Disabled'})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Franchise Partner Column */}
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
                          <div className="font-bold text-sm text-sky-400 flex items-center justify-between">
                            <span>Franchise Partner (Centre Operator)</span>
                            <span className="text-sky-300 font-black">{createForm.initialAgreement.partnerRevenuePercentage}% Rev</span>
                          </div>
                          <div className="space-y-1 text-slate-300 text-[11px]">
                            <div>
                              <span className="text-slate-400">Setup Capital Investment:</span>{' '}
                              <strong className="text-white">₹{Number(createForm.initialAgreement.partnerInvestmentAmount || 0).toLocaleString('en-IN')}</strong> ({createForm.initialAgreement.partnerInvestmentPercentage}%)
                            </div>
                            <div>
                              <span className="text-slate-400">Direct Expenses Paid:</span>{' '}
                              <span className="text-sky-200">
                                {Object.entries(createForm.initialAgreement.expenseResponsibilities || {})
                                  .filter(([_, v]) => v === 'PARTNER' || (typeof v === 'object' && (v as any)?.payer === 'PARTNER'))
                                  .map(([k]) => k === 'rent' ? 'Building Rent' : k === 'staffSalaries' ? 'Staff Salaries' : k === 'utilities' ? 'Utilities' : k)
                                  .join(', ') || 'Building Rent & Centre Operations'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Role & Operations:</span>{' '}
                              <span className="text-white">Campus Infrastructure, Local Operations, Post-Support Marketing</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 bg-blue-950/70 border border-blue-800 rounded-lg text-[11px] text-blue-200 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>DIRECT EXPENSE RULE:</strong> Direct expenses (such as Rent paid by Partner or Trainer Salaries paid by Digital Guru) are borne directly by each party and are <strong>NEVER</strong> automatically deducted from gross revenue collections. Deductions occur only when calculation basis is set to <em>Profit After Expenses</em> with approved deductible receipts.
                        </span>
                      </div>
                    </div>

                    {/* Campus Association Review Card */}
                    <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#006FFF]" />
                          Campus / Institute Association
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {createForm.branchOption === 'NONE' && 'Skipped for now (Optional)'}
                          {createForm.branchOption === 'LINK_EXISTING' && 'Link Existing Institute'}
                          {createForm.branchOption === 'CREATE_NEW' && 'Create New Campus Branch'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {createForm.branchOption === 'NONE' && (
                          <span>Franchise will be created without linked branches. You can link or create institutes anytime later via the franchise <strong>Edit</strong> option.</span>
                        )}
                        {createForm.branchOption === 'LINK_EXISTING' && (
                          <span>
                            Linking existing institute:{' '}
                            <strong className="text-slate-900">
                              {unassignedBranches.find((b) => b.id === createForm.linkedInstituteId)?.name || 'Selected Institute'}
                            </strong>{' '}
                            ({unassignedBranches.find((b) => b.id === createForm.linkedInstituteId)?.code || ''})
                          </span>
                        )}
                        {createForm.branchOption === 'CREATE_NEW' && (
                          <span>
                            Creating and attaching campus:{' '}
                            <strong className="text-slate-900">{createForm.newBranch.name || `${createForm.name} Campus`}</strong>
                            {createForm.newBranch.city ? ` in ${createForm.newBranch.city}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Password notice */}
                    <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800">
                        A strong temporary onboarding password will be automatically generated and displayed upon creation. Stored hashes are securely protected with argon2.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  {createModalTab === 'profile' ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  ) : createModalTab === 'model' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateModalTab('profile');
                        createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white transition cursor-pointer"
                    >
                      ← Back to Profile
                    </button>
                  ) : createModalTab === 'financials' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateModalTab('model');
                        createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white transition cursor-pointer"
                    >
                      ← Back to Model
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setCreateModalTab('financials');
                        createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white transition cursor-pointer"
                    >
                      ← Back to Financials
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-medium hidden sm:block">
                  Step {createModalTab === 'profile' ? '1' : createModalTab === 'model' ? '2' : createModalTab === 'financials' ? '3' : '4'} of 4
                </div>

                <div>
                  {createModalTab === 'profile' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (validateProfileStep()) {
                          setCreateModalTab('model');
                          createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                        }
                      }}
                      className="px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      Next: Agreement Model <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : createModalTab === 'model' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (validateModelStep()) {
                          setCreateModalTab('financials');
                          createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                        }
                      }}
                      className="px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      Next: Financial Terms <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : createModalTab === 'financials' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (validateFinancialsStep()) {
                          setCreateModalTab('review');
                          createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
                        }
                      }}
                      className="px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      Next: Review Summary <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmittingFranchise || Boolean(duplicateFranchiseMatch)}
                      className={`px-6 py-2.5 font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 ${isSubmittingFranchise || duplicateFranchiseMatch
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                          : 'bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 cursor-pointer'
                        }`}
                    >
                      {isSubmittingFranchise ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating Franchise & Installments...
                        </>
                      ) : createForm.initialAgreement.settlementFrequency === 'YEARLY' ? (
                        'Create Franchise & Generate 2 Annual Installments'
                      ) : (
                        'Create Franchise (Monthly Settlement)'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: CREATION SUCCESS & ONBOARDING CREDENTIALS            */}
      {/* ============================================================= */}
      {createdResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex items-center gap-3 text-emerald-600 mb-3">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Franchise Registered Successfully!</h3>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Franchise Code:</span>
                <span className="font-mono font-bold text-[#006FFF]">{createdResultModal.franchise?.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Business Name:</span>
                <span className="font-bold text-slate-900">{createdResultModal.franchise?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agreement Number:</span>
                <span className="font-mono text-slate-800">{createdResultModal.agreement?.agreementNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner Full Name:</span>
                <span className="font-bold text-slate-900">{createdResultModal.ownerCredentials?.fullName || createdResultModal.franchise?.ownerName}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                <span className="text-slate-500">Login Email / Username:</span>
                <span className="font-mono font-bold text-slate-900">{createdResultModal.ownerCredentials?.email}</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 block">Permanent Login Password:</span>
                  <span className="text-[11px] text-emerald-700">Account ready for direct login (no mandatory password change)</span>
                </div>
                <span className="font-mono font-bold text-emerald-950 text-base select-all">
                  {createdResultModal.ownerCredentials?.permanentPassword || createdResultModal.ownerCredentials?.password || createdResultModal.ownerCredentials?.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-blue-900">
                <span className="font-semibold block">Deliver Permanent Credentials to Owner:</span>
                <span className="text-[11px] text-blue-700">Copy permanent login credentials and portal URL to share with Franchise Owner securely.</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const email = createdResultModal.ownerCredentials?.email || '';
                    navigator.clipboard.writeText(email);
                    showToast('Owner email copied to clipboard!', 'success');
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copy Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pwd = createdResultModal.ownerCredentials?.permanentPassword || createdResultModal.ownerCredentials?.password || createdResultModal.ownerCredentials?.temporaryPassword || '';
                    navigator.clipboard.writeText(pwd);
                    showToast('Permanent password copied to clipboard!', 'success');
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copy Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pwd = createdResultModal.ownerCredentials?.permanentPassword || createdResultModal.ownerCredentials?.password || createdResultModal.ownerCredentials?.temporaryPassword || '';
                    const creds = [
                      `Digital Guru Franchise Center Onboarding`,
                      `Franchise Center: ${createdResultModal.franchise?.name} (${createdResultModal.franchise?.code})`,
                      `Owner: ${createdResultModal.ownerCredentials?.fullName || createdResultModal.franchise?.ownerName}`,
                      `Portal URL: ${window.location.origin}/login`,
                      `Login Username / Email: ${createdResultModal.ownerCredentials?.email}`,
                      `Permanent Password: ${pwd}`,
                    ].join('\n');
                    navigator.clipboard.writeText(creds);
                    showToast('Franchise owner credentials copied to clipboard!', 'success');
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy All Credentials
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Generated Installments (2 Due This Year):
              </div>
              <div className="space-y-1.5">
                {createdResultModal.installments?.map((inst: any) => (
                  <div
                    key={inst.id}
                    className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded text-xs"
                  >
                    <span className="font-medium text-slate-800">{inst.periodLabel}</span>
                    <span className="font-bold text-slate-900">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCreatedResultModal(null)}
                className="px-5 py-2 bg-[#006FFF] text-white font-bold rounded-lg text-sm"
              >
                Close & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 3: RECORD INSTALLMENT PAYMENT                           */}
      {/* ============================================================= */}
      {showRecordPaymentModal && selectedInstallmentForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Royalty Payment</h3>
                <p className="text-xs text-slate-500">
                  {selectedInstallmentForPayment.franchiseName} — {selectedInstallmentForPayment.periodLabel}
                </p>
              </div>
              <button onClick={() => setShowRecordPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border text-xs flex justify-between">
                <div>
                  <span className="text-slate-500 block">Total Installment:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{Number(selectedInstallmentForPayment.amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Outstanding Balance:</span>
                  <span className="font-bold text-rose-600 text-sm">
                    ₹{Number(selectedInstallmentForPayment.outstandingBalance).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Amount to Record (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={paymentForm.amountPaid}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#006FFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Payment Method *</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online Portal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Transaction Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-202611039872"
                  value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#006FFF]"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Prevents duplicate submissions per franchise.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Verified against H1 bank statement"
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-lg text-sm shadow"
                >
                  Confirm & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 4: OFFICIAL ROYALTY PAYMENT RECEIPT                     */}
      {/* ============================================================= */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl my-6 sm:my-8 border border-slate-200 space-y-6">
            {/* Printable Receipt Card */}
            <div className="border border-slate-300 rounded-xl p-6 bg-[#FCFDFE]">
              {/* Receipt Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xl font-black text-slate-900 tracking-tight">DIGITAL GURU</div>
                  <div className="text-xs text-slate-500 font-semibold">Franchise Enterprise</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Jaighurudeva Educational Academy Partner</div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-100 text-emerald-800">
                    OFFICIAL RECEIPT
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1.5">{receiptData.receiptNumber}</div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(receiptData.receiptDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Franchise Details */}
              <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                <div>
                  <div className="text-slate-400 uppercase font-semibold">Received From (Franchise):</div>
                  <div className="font-bold text-slate-900 mt-0.5">{receiptData.payer?.franchiseName}</div>
                  <div className="text-slate-600 font-mono">{receiptData.payer?.franchiseCode}</div>
                  <div className="text-slate-500">{receiptData.payer?.ownerName}</div>
                  <div className="text-slate-500">
                    {receiptData.payer?.city}, {receiptData.payer?.state}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 uppercase font-semibold">Royalty Particulars:</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {receiptData.installment?.periodLabel || receiptData.royaltyRecord?.periodLabel || 'Royalty Settlement'}
                  </div>
                  <div className="text-slate-600">
                    {receiptData.installment?.agreementNumber ? `Agreement: ${receiptData.installment.agreementNumber}` : 'Monthly Revenue Settlement'}
                  </div>
                  <div className="text-slate-500">Method: {receiptData.paymentMethod}</div>
                  {receiptData.transactionReference && (
                    <div className="text-slate-500 font-mono">Ref: {receiptData.transactionReference}</div>
                  )}
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center my-4">
                <div>
                  <div className="text-xs font-bold text-slate-600 uppercase">Amount Remitted</div>
                  <div className="text-[11px] text-slate-500">Platform Royalty Remittance</div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{Number(receiptData.amountPaid).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Footer Stamp */}
              <div className="flex justify-between items-end pt-3 border-t border-slate-200 text-[11px] text-slate-400">
                <div>Recorded By: {receiptData.issuer?.recordedBy}</div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-3.5 h-3.5" /> Digitally Verified
                  </div>
                  <div>Valid without physical seal</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 5: RENEW AGREEMENT (PRESERVES PREVIOUS AGREEMENT)       */}
      {/* ============================================================= */}
      {showRenewModal && selectedAgreementForRenew && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Renew Annual Franchise Agreement</h3>
                <p className="text-xs text-slate-500">
                  Retains previous agreement ({selectedAgreementForRenew.agreementNumber}) and generates 2 fresh installments.
                </p>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewAgreement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Agreement Title</label>
                <input
                  type="text"
                  required
                  value={renewForm.title}
                  onChange={(e) => setRenewForm({ ...renewForm, title: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">New Start Date</label>
                  <input
                    type="date"
                    required
                    value={renewForm.startDate}
                    onChange={(e) => setRenewForm({ ...renewForm, startDate: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">New End Date</label>
                  <input
                    type="date"
                    required
                    value={renewForm.endDate}
                    onChange={(e) => setRenewForm({ ...renewForm, endDate: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Calculation Method</label>
                <select
                  value={renewForm.calculationMethod}
                  onChange={(e: any) => setRenewForm({ ...renewForm, calculationMethod: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-medium"
                >
                  <option value="FIXED_ANNUAL">Fixed Annual Fee</option>
                  <option value="PERCENTAGE_REVENUE">Percentage of Revenue</option>
                  <option value="PER_STUDENT">Per Enrolled Student</option>
                </select>
              </div>

              {renewForm.calculationMethod === 'FIXED_ANNUAL' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">Annual Agreed Royalty (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={renewForm.annualRoyaltyAmount}
                    onChange={(e) => setRenewForm({ ...renewForm, annualRoyaltyAmount: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow"
                >
                  Confirm Renewal & Generate 2 Installments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 6: RESET OWNER PASSWORD (SUPER ADMIN ONLY)              */}
      {/* ============================================================= */}
      {showResetPasswordModal && selectedFranchiseForReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200 animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#006FFF] flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Owner Password</h3>
                  <p className="text-[11px] text-slate-500">Permanent Credential Generation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseResetPasswordModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!resetResult ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Generate a new permanent password for{' '}
                  <strong className="text-slate-900">{selectedFranchiseForReset.ownerName}</strong> ({selectedFranchiseForReset.email})?
                </p>
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    Security Notice
                  </div>
                  <div>
                    The owner's previous password will be invalidated immediately. The owner will be able to log in directly using the newly generated permanent password without forced password change.
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseResetPasswordModal}
                    className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeResetPassword}
                    className="px-5 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
                  >
                    Generate New Permanent Password
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2.5">
                  <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    Permanent Password Generated!
                  </div>
                  <div className="text-slate-700 flex justify-between items-center">
                    <span className="text-slate-500">Owner Name:</span>
                    <span className="font-semibold text-slate-900">{selectedFranchiseForReset?.ownerName || resetResult.fullName}</span>
                  </div>
                  <div className="text-slate-700 flex justify-between items-center">
                    <span className="text-slate-500">Login Email:</span>
                    <span className="font-mono font-semibold text-slate-900">{resetResult.email}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <span className="text-[11px] text-slate-500 block mb-1">New Permanent Password:</span>
                    <div className="font-mono font-bold text-emerald-950 text-base text-center tracking-wider selection:bg-emerald-100 select-all">
                      {resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    Please securely convey this permanent password to the Franchise Owner. It is now active for direct sign-in.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult.email);
                        showToast('Email copied to clipboard!', 'success');
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pwd = resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword;
                        navigator.clipboard.writeText(pwd);
                        showToast('Password copied to clipboard!', 'success');
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy Password
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword;
                      const creds = [
                        `Digital Guru Franchise Login Credentials`,
                        `Franchise: ${selectedFranchiseForReset?.name || 'Digital Guru Franchise'}`,
                        `Owner: ${selectedFranchiseForReset?.ownerName || resetResult.fullName}`,
                        `Portal URL: ${window.location.origin}/login`,
                        `Login Email: ${resetResult.email}`,
                        `Permanent Password: ${pwd}`,
                      ].join('\n');
                      navigator.clipboard.writeText(creds);
                      showToast('All credentials copied to clipboard!', 'success');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy All Credentials
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseResetPasswordModal}
                    className="px-5 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold rounded-xl text-xs shadow-xs transition"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 7: ASSIGN / ADD BRANCH CAMPUS (SUPER ADMIN ONLY)        */}
      {/* ============================================================= */}
      {showAddBranchModal && selectedFranchiseForBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Campus Branch</h3>
                <p className="text-xs text-slate-500">Franchise: {selectedFranchiseForBranch.name} ({selectedFranchiseForBranch.code})</p>
              </div>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setBranchModalMode('existing')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${branchModalMode === 'existing'
                  ? 'bg-white text-[#006FFF] shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Assign Existing ({unassignedBranches.length} Available)
              </button>
              <button
                type="button"
                onClick={() => setBranchModalMode('new')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${branchModalMode === 'new'
                  ? 'bg-white text-[#006FFF] shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Create & Attach New
              </button>
            </div>

            {/* MODE 1: ASSIGN EXISTING BRANCH */}
            {branchModalMode === 'existing' ? (
              <form onSubmit={handleAssignExistingBranch} className="space-y-4">
                {unassignedBranches.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    No unassigned campus branches are currently available. Please use &ldquo;Create & Attach New&rdquo; to establish a new campus for this franchise.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Select Available Campus Branch *
                    </label>
                    <select
                      required
                      value={selectedExistingBranchId}
                      onChange={(e) => setSelectedExistingBranchId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      <option value="">-- Choose an unassigned campus branch --</option>
                      {unassignedBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) - {b.city || 'Tamil Nadu'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Assigning this branch will grant the Franchisee Admin full operational access while preserving all historical students, staff, and tuition payments.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddBranchModal(false)}
                    className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={unassignedBranches.length === 0 || !selectedExistingBranchId}
                    className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow"
                  >
                    Assign Branch to Franchise
                  </button>
                </div>
              </form>
            ) : (
              /* MODE 2: CREATE & ATTACH NEW BRANCH */
              <form onSubmit={handleAddBranch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Campus / Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Digital Guru Guindy Campus"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">City *</label>
                    <input
                      type="text"
                      required
                      placeholder="Chennai"
                      value={branchForm.city}
                      onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">State *</label>
                    <input
                      type="text"
                      required
                      placeholder="Tamil Nadu"
                      value={branchForm.state}
                      onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Address</label>
                  <input
                    type="text"
                    placeholder="Campus address"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddBranchModal(false)}
                    className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-lg text-sm shadow"
                  >
                    Create & Attach Campus
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )
      }

      {/* ============================================================= */}
      {/* MODAL 8: REVISE AGREEMENT (NEW VERSION N+1)                   */}
      {/* ============================================================= */}
      {showReviseModal && selectedAgreementForRevise && selectedFranchiseForRevise && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">Revise Franchise Agreement</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-[#006FFF]">
                    Creates v{(selectedAgreementForRevise.version || 1) + 1}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revises agreement for {selectedFranchiseForRevise.name}. Previous version {selectedAgreementForRevise.agreementNumber} (v{selectedAgreementForRevise.version || 1}) will be marked EXPIRED with all historical payments preserved.
                </p>
              </div>
              <button onClick={() => setShowReviseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviseAgreement} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Revision Title *</label>
                  <input
                    type="text"
                    required
                    value={reviseForm.title}
                    onChange={(e) => setReviseForm({ ...reviseForm, title: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Business Model *</label>
                  <select
                    value={reviseForm.agreementType}
                    onChange={(e: any) => setReviseForm({ ...reviseForm, agreementType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white"
                  >
                    <option value="NEW_CENTRE_JOINT_INVESTMENT">New Centre Joint Investment</option>
                    <option value="EXISTING_CENTRE">Existing Centre</option>
                    <option value="BRAND_AND_COURSE_SUPPORT">Brand & Course Support</option>
                    <option value="CUSTOM_AGREEMENT">Custom Agreement</option>
                  </select>
                </div>
              </div>

              {/* Revenue Sharing Split */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Revenue Sharing Split & Basis</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${Number(reviseForm.digitalGuruRevenuePercentage) + Number(reviseForm.partnerRevenuePercentage) === 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                      }`}
                  >
                    Total: {Number(reviseForm.digitalGuruRevenuePercentage || 0) + Number(reviseForm.partnerRevenuePercentage || 0)}% (Must = 100%)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Digital Guru Revenue Share (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={reviseForm.digitalGuruRevenuePercentage}
                      onChange={(e) => {
                        const dg = Number(e.target.value);
                        setReviseForm({
                          ...reviseForm,
                          digitalGuruRevenuePercentage: dg,
                          partnerRevenuePercentage: 100 - dg,
                          royaltyPercentage: dg,
                        });
                      }}
                      className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Partner Revenue Share (%) *</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={reviseForm.partnerRevenuePercentage}
                      onChange={(e) => {
                        const pt = Number(e.target.value);
                        setReviseForm({
                          ...reviseForm,
                          partnerRevenuePercentage: pt,
                          digitalGuruRevenuePercentage: 100 - pt,
                          royaltyPercentage: 100 - pt,
                        });
                      }}
                      className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Commercial Model *</label>
                    <select
                      value={reviseForm.calculationMethod}
                      onChange={(e: any) => setReviseForm({ ...reviseForm, calculationMethod: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                    >
                      <option value="PERCENTAGE_REVENUE">Percentage of Revenue Collections</option>
                      <option value="FIXED_ANNUAL">Fixed Annual Commercial Fee</option>
                      <option value="PER_STUDENT">Per Enrolled Student Fee</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Calculation Basis *</label>
                    <select
                      value={reviseForm.revenueCalculationBasis}
                      onChange={(e: any) => setReviseForm({ ...reviseForm, revenueCalculationBasis: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                    >
                      <option value="GROSS_COURSE_FEES">Gross Course Fees Collected</option>
                      <option value="NET_COURSE_REVENUE">Net Course Revenue</option>
                      <option value="PROFIT_AFTER_EXPENSES">Profit After Deductible Expenses</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Settlement Frequency *</label>
                    <select
                      value={reviseForm.settlementFrequency}
                      onChange={(e: any) => setReviseForm({ ...reviseForm, settlementFrequency: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly (2 Equal Installments)</option>
                    </select>
                  </div>

                  {reviseForm.calculationMethod === 'FIXED_ANNUAL' && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-slate-700">
                        Annual Commercial Fee (₹) *
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (Generates 2 equal H1/H2 installments of ₹{Math.round(Number(reviseForm.annualRoyaltyAmount || 0) / 2).toLocaleString('en-IN')} each when Yearly settlement is active)
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={reviseForm.annualRoyaltyAmount || ''}
                        onChange={(e) => setReviseForm({ ...reviseForm, annualRoyaltyAmount: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-semibold text-slate-900 bg-white"
                        placeholder="e.g. 200000"
                      />
                    </div>
                  )}

                  {reviseForm.calculationMethod === 'PER_STUDENT' && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-slate-700">
                        Fee Per Active Enrolled Student (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={reviseForm.perStudentFee || ''}
                        onChange={(e) => setReviseForm({ ...reviseForm, perStudentFee: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-semibold text-slate-900 bg-white"
                        placeholder="e.g. 2000"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Marketing & Software Entitlement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">Marketing Support</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Responsible</label>
                      <select
                        value={reviseForm.marketingResponsibleParty}
                        onChange={(e) => setReviseForm({ ...reviseForm, marketingResponsibleParty: e.target.value })}
                        className="mt-0.5 w-full px-2 py-1 border rounded text-xs bg-white"
                      >
                        <option value="DIGITAL_GURU">Digital Guru</option>
                        <option value="PARTNER">Partner</option>
                        <option value="SHARED">Shared</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600">Months</label>
                      <input
                        type="number"
                        min="0"
                        value={reviseForm.marketingSupportDurationMonths}
                        onChange={(e) => setReviseForm({ ...reviseForm, marketingSupportDurationMonths: Number(e.target.value) })}
                        className="mt-0.5 w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-800">Course Software Access</div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={reviseForm.courseSoftwareAccessEnabled}
                      onChange={(e) => setReviseForm({ ...reviseForm, courseSoftwareAccessEnabled: e.target.checked })}
                      className="rounded text-[#006FFF] w-4 h-4"
                    />
                    <span className="font-semibold">Software Access Enabled</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Pricing notes"
                    value={reviseForm.courseSoftwarePricingNotes}
                    onChange={(e) => setReviseForm({ ...reviseForm, courseSoftwarePricingNotes: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
              </div>

              {/* Revision Commercial Summary Box */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 shadow-md border border-slate-700">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-[#FEDC32]">Revision Commercial Summary (v{(selectedAgreementForRevise.version || 1) + 1})</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900 text-blue-200 font-mono font-semibold">
                    {reviseForm.settlementFrequency} • {reviseForm.revenueCalculationBasis}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-1 text-[11px] text-slate-300">
                    <div className="font-bold text-sm text-[#FEDC32]">Digital Guru: {reviseForm.digitalGuruRevenuePercentage}% Rev</div>
                    <div>Marketing: {reviseForm.marketingSupportDurationMonths || 0} Months Support</div>
                    <div>Software: {reviseForm.courseSoftwareAccessEnabled ? 'Enabled' : 'Disabled'}</div>
                  </div>
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-1 text-[11px] text-slate-300">
                    <div className="font-bold text-sm text-sky-400">Partner: {reviseForm.partnerRevenuePercentage}% Rev</div>
                    <div>Post-Support Marketing: {reviseForm.marketingPostSupportParty}</div>
                    <div>Role: Campus Premise & Direct Operations</div>
                  </div>
                </div>

                <div className="p-2 bg-blue-950/70 border border-blue-800 rounded-lg text-[10px] text-blue-200">
                  <strong>DIRECT EXPENSE RULE:</strong> Direct expenses (rent, trainers) are not deducted from gross fees unless basis is Profit After Expenses. Historical installments, receipts and payments from v{selectedAgreementForRevise.version || 1} remain permanently preserved.
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-lg text-sm shadow transition-all"
                >
                  {reviseForm.settlementFrequency === 'YEARLY'
                    ? `Confirm Revision (v${(selectedAgreementForRevise.version || 1) + 1} & 2 Annual Installments)`
                    : `Confirm Revision (v${(selectedAgreementForRevise.version || 1) + 1} - Monthly Settlement)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CALCULATE MONTHLY ROYALTY */}
      {showCalculateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl my-6 sm:my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Calculate Monthly Royalty Statement</h3>
                <p className="text-xs text-slate-500">
                  Runs royalty calculation against actual payment collections for the specified month.
                </p>
              </div>
              <button onClick={() => setShowCalculateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCalculateMonthlyRoyalty} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Franchise *</label>
                <select
                  required
                  value={calculateForm.franchiseId}
                  onChange={(e) => setCalculateForm({ ...calculateForm, franchiseId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose Franchise --</option>
                  {franchises.map((fr) => (
                    <option key={fr.id} value={fr.id}>
                      {fr.name} ({fr.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period (YYYY-MM) *</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-11"
                    value={calculateForm.periodLabel}
                    onChange={(e) => setCalculateForm({ ...calculateForm, periodLabel: e.target.value })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={calculateForm.startDate}
                    onChange={(e) => setCalculateForm({ ...calculateForm, startDate: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={calculateForm.endDate}
                    onChange={(e) => setCalculateForm({ ...calculateForm, endDate: e.target.value })}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Calculation Basis *</label>
                <select
                  value={calculateForm.revenueCalculationBasis}
                  onChange={(e) => setCalculateForm({ ...calculateForm, revenueCalculationBasis: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="GROSS_COURSE_FEES">Gross Course Fees Collected</option>
                  <option value="NET_COURSE_REVENUE">Net Course Revenue (After Refunds/Adjustments)</option>
                  <option value="PROFIT_AFTER_EXPENSES">Profit After Deductible Expenses</option>
                </select>
              </div>

              {calculateForm.revenueCalculationBasis === 'PROFIT_AFTER_EXPENSES' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Deductible Expenses (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={calculateForm.deductibleExpenses}
                    onChange={(e) => setCalculateForm({ ...calculateForm, deductibleExpenses: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    placeholder="e.g. 25000"
                  />
                  <div className="text-[11px] text-amber-700 mt-1">
                    Note: Direct payer commitments (rent paid by partner, trainers paid by DG) are NOT deductible from gross collections unless contractually shared.
                  </div>
                </div>
              )}

              {calculateForm.revenueCalculationBasis === 'NET_COURSE_REVENUE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refunds & Fee Adjustments (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={calculateForm.deductions}
                    onChange={(e) => setCalculateForm({ ...calculateForm, deductions: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    placeholder="e.g. 5000"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCalculateModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-lg text-xs shadow transition-all"
                >
                  Calculate Royalty Statement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 9: EDIT FRANCHISE & MANAGE LINKED INSTITUTES            */}
      {/* ============================================================= */}
      {showEditFranchiseModal && selectedFranchiseForEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl my-6 sm:my-8 border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-[#006FFF] flex items-center justify-center border border-blue-400/30">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Edit Franchise Center
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700">
                      {selectedFranchiseForEdit.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedFranchiseForEdit.name} • Manage profile details and linked campus branches
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditFranchiseModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-4">
              <button
                type="button"
                onClick={() => setEditFranchiseTab('details')}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${editFranchiseTab === 'details'
                    ? 'border-[#006FFF] text-[#006FFF]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Building2 className="w-4 h-4" />
                Franchise Profile & Contact
              </button>
              <button
                type="button"
                onClick={() => setEditFranchiseTab('campuses')}
                className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${editFranchiseTab === 'campuses'
                    ? 'border-[#006FFF] text-[#006FFF]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                <MapPin className="w-4 h-4" />
                Linked Institutes / Campuses ({selectedFranchiseForEdit.branches?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* TAB 1: PROFILE DETAILS */}
              {editFranchiseTab === 'details' && (
                <form onSubmit={handleSaveFranchiseProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Franchise / Center Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.ownerName}
                        onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Primary Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Owner Email (Primary Login ID)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={selectedFranchiseForEdit.email}
                        className="w-full px-3 py-2 border rounded-xl text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                      />
                      <span className="text-[10px] text-slate-400">Email is unique and managed via admin security</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Business Address
                      </label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={editForm.state}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">PIN / Postal Code</label>
                      <input
                        type="text"
                        value={editForm.postalCode}
                        onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Administrative Notes
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Special commercial terms, geographic radius, or onboarding notes..."
                      className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#006FFF]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowEditFranchiseModal(false)}
                      className="px-4 py-2 border text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-xl text-xs shadow transition-all"
                    >
                      Save Franchise Details
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: LINKED INSTITUTES / CAMPUSES */}
              {editFranchiseTab === 'campuses' && (
                <div className="space-y-6">
                  {/* Current Linked Branches */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-[#006FFF]" />
                        Currently Associated Institutes & Branches ({selectedFranchiseForEdit.branches?.length || 0})
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Student counts & tuition records remain fully preserved
                      </span>
                    </div>

                    {(!selectedFranchiseForEdit.branches || selectedFranchiseForEdit.branches.length === 0) ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                        No institutes or campus branches are currently linked to this franchise center.
                        <br />
                        <span className="text-slate-400">Use either option below to link an existing institute or create a new branch.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedFranchiseForEdit.branches.map((b: any) => (
                          <div
                            key={b.id}
                            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-slate-300 transition"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#006FFF] border border-blue-200">
                                {b.code}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-900">{b.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {b.city ? `${b.city}, ${b.state || ''}` : 'Location on record'}
                                  {b._count?.students !== undefined && (
                                    <span className="ml-2 font-semibold text-slate-700">• {b._count.students} Students</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDetachBranchInEdit(b.id, b.name)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                              title="Detach branch from this franchise"
                            >
                              Detach
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section A: Link Existing Institute */}
                  <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-[#006FFF]" />
                        Option 1: Link Existing Institute / Branch
                      </div>
                      <span className="text-[11px] font-semibold text-[#006FFF]">
                        {unassignedBranches.length} Unassigned Available
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Select an existing unassigned institute to attach it immediately to this franchise.
                    </p>

                    {unassignedBranches.length === 0 ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-500">
                        No unassigned institutes are currently available. Use Option 2 below to create and attach a new campus.
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={editLinkInstituteId}
                          onChange={(e) => setEditLinkInstituteId(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#006FFF]"
                        >
                          <option value="">-- Select an unassigned institute --</option>
                          {unassignedBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code} - {b.name} ({b.city || 'Tamil Nadu'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!editLinkInstituteId}
                          onClick={handleLinkBranchInEdit}
                          className="px-4 py-2 bg-[#006FFF] hover:bg-[#0055CC] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition"
                        >
                          + Link Institute
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section B: Create & Attach New Campus */}
                  <form onSubmit={handleCreateBranchInEdit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      Option 2: Create & Link New Campus Branch
                    </div>

                    <p className="text-xs text-slate-600">
                      Need a new branch campus? Create it directly here and it will be attached immediately to this franchise center.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Campus Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Digital Guru T. Nagar Campus"
                          value={editNewBranch.name}
                          onChange={(e) => setEditNewBranch({ ...editNewBranch, name: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#006FFF]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Campus Code (Optional, auto-generated)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BR-008"
                          value={editNewBranch.code}
                          onChange={(e) => setEditNewBranch({ ...editNewBranch, code: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#006FFF]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          placeholder="Chennai"
                          value={editNewBranch.city}
                          onChange={(e) => setEditNewBranch({ ...editNewBranch, city: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#006FFF]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={editNewBranch.phone}
                          onChange={(e) => setEditNewBranch({ ...editNewBranch, phone: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#006FFF]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={!editNewBranch.name.trim()}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition"
                      >
                        + Create & Link Campus
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          FRANCHISE DETAILS SLIDE-OVER DRAWER
         ==================================================== */}
      {selectedFranchiseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCloseDetails}
        >
          <div
            className="bg-white border-l border-slate-200 w-full max-w-2xl h-full shadow-2xl flex flex-col text-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#006FFF]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {detailData?.franchise.name || 'Franchise Details'}
                    </h2>
                    {detailData?.franchise.status && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${detailData.franchise.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                          }`}
                      >
                        {detailData.franchise.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Franchise Code: <strong className="font-mono text-[#006FFF]">{detailData?.franchise.code || '...'}</strong></span>
                    {detailData?.franchise.createdAt && (
                      <>
                        <span>•</span>
                        <span>Registered {new Date(detailData.franchise.createdAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDetails}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#006FFF] mb-3" />
                  <span className="text-xs font-semibold">Loading franchise details...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              ) : detailData ? (
                <>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#006FFF]" /> Campuses
                      </div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {detailData.metrics?.totalBranches ?? detailData.franchise.branches?.length ?? 0}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> Active Students
                      </div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {detailData.metrics?.totalStudents ?? 0}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" /> Royalty Paid
                      </div>
                      <div className="text-xl font-bold text-emerald-600 mt-1">
                        ₹{(detailData.metrics?.totalRoyaltyPaid ?? 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-rose-600" /> Outstanding
                      </div>
                      <div className="text-xl font-bold text-rose-600 mt-1">
                        ₹{(detailData.metrics?.outstandingRoyalty ?? 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: OWNER LOGIN CREDENTIALS & ACCESS */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/50 via-white to-slate-50 border border-blue-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#006FFF]" /> Owner Login Credentials & Access
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(detailData.franchise)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#006FFF] hover:bg-[#0058D4] text-white transition shadow-sm cursor-pointer"
                        title="Generate permanent password and share with owner"
                      >
                        <Key className="w-3.5 h-3.5" /> Reset / Generate Permanent Password
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Owner Full Name</span>
                        <div className="font-semibold text-slate-900 text-sm">
                          {detailData.franchise.ownerName}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Login Email / Username</span>
                        <div className="font-mono font-bold text-[#006FFF] bg-white px-2.5 py-1 rounded border border-blue-200 inline-block">
                          {detailData.franchise.ownerUser?.email || detailData.franchise.email}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Contact Phone Number</span>
                        <div className="text-slate-900 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {detailData.franchise.phone || '—'}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Account Status</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(detailData.franchise.ownerUser ? detailData.franchise.ownerUser.isActive : (detailData.franchise.status === 'ACTIVE')) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                              <CheckCircle className="w-3 h-3 text-emerald-600" /> Active Account
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-300">
                              <UserX className="w-3 h-3 text-rose-600" /> Inactive Account
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Password Status</span>
                        <div>
                          {detailData.franchise.ownerUser?.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" /> Pending Change on Next Login
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-600" /> Permanent Password Set
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Password Last Updated</span>
                        <div className="text-slate-900">
                          {detailData.franchise.ownerUser?.updatedAt
                            ? new Date(detailData.franchise.ownerUser.updatedAt).toLocaleString()
                            : 'Initial Provisioning'}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Last Login Timestamp</span>
                        <div className="text-slate-900">
                          {detailData.franchise.ownerUser?.lastLoginAt
                            ? new Date(detailData.franchise.ownerUser.lastLoginAt).toLocaleString()
                            : 'Never logged in'}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">User Role</span>
                        <div className="font-mono text-slate-700">
                          {detailData.franchise.ownerUser?.role || 'FRANCHISE_OWNER'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-blue-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Password hashes are securely encrypted with Argon2. Plaintext passwords are never stored or exposed.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const loginUrl = `${window.location.origin}/login`;
                          const email = detailData.franchise.ownerUser?.email || detailData.franchise.email;
                          navigator.clipboard.writeText(`Franchise Portal URL: ${loginUrl}\nLogin Username / Email: ${email}`);
                          showToast('Login username & URL copied to clipboard', 'success');
                        }}
                        className="text-xs font-semibold text-[#006FFF] hover:text-[#0058D4] inline-flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Login URL
                      </button>
                    </div>
                  </div>

                  {/* SECTION 2: FRANCHISE CENTER DETAILS & REGISTERED ADDRESS */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" /> Center Overview & Registered Address
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditFranchiseModal(detailData.franchise)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-[#006FFF] hover:bg-slate-50 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Edit Center
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleStatusToggle(detailData.franchise.id, detailData.franchise.status);
                            fetchFranchiseDetails(detailData.franchise.id);
                          }}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${detailData.franchise.status === 'ACTIVE'
                              ? 'border-rose-300 text-rose-800 hover:bg-rose-50'
                              : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                            }`}
                        >
                          {detailData.franchise.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Franchise Center Name</span>
                        <div className="font-semibold text-slate-900">{detailData.franchise.name}</div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Franchise Code</span>
                        <div className="font-mono font-bold text-[#006FFF] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                          {detailData.franchise.code}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Contact Email</span>
                        <div className="text-slate-900 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {detailData.franchise.email}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Contact Phone</span>
                        <div className="text-slate-900 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {detailData.franchise.phone}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-slate-500 block mb-0.5">Registered Address</span>
                        <div className="text-slate-900 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>
                            {[
                              detailData.franchise.address,
                              detailData.franchise.city,
                              detailData.franchise.state,
                              detailData.franchise.postalCode ? `PIN: ${detailData.franchise.postalCode}` : null,
                              detailData.franchise.country,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'No registered address specified'}
                          </span>
                        </div>
                      </div>

                      {detailData.franchise.notes && (
                        <div className="sm:col-span-2">
                          <span className="text-slate-500 block mb-0.5">Internal Notes & History</span>
                          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            {detailData.franchise.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 3: ASSOCIATED CAMPUSES / BRANCHES */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-slate-400" /> Associated Branch Campuses ({detailData.franchise.branches?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={() => openAddBranchModal(detailData.franchise)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#006FFF] hover:bg-blue-100 transition border border-blue-200 cursor-pointer"
                      >
                        + Attach Campus
                      </button>
                    </div>

                    {!detailData.franchise.branches || detailData.franchise.branches.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No campuses currently attached to this franchise center. Click "+ Attach Campus" above to link or create one.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {detailData.franchise.branches.map((b: any) => (
                          <div
                            key={b.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{b.name}</span>
                                <span className="font-mono text-[10px] text-[#006FFF] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {b.code}
                                </span>
                              </div>
                              <div className="text-slate-500 flex items-center gap-2">
                                <span>{b.city || 'Location unassigned'}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">
                                  {b._count?.students ?? 0} Active Students
                                </span>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                            >
                              {b.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: AGREEMENTS & COMMERCIAL TERMS */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#006FFF] flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-400" /> Commercial Agreements & Royalty Terms
                      </span>
                      <span className="text-xs text-slate-500">
                        {detailData.franchise.agreements?.length || 0} Agreement(s)
                      </span>
                    </div>

                    {!detailData.franchise.agreements || detailData.franchise.agreements.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No agreements registered for this franchise center.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detailData.franchise.agreements.map((agr: any) => (
                          <div
                            key={agr.id}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-bold text-slate-900 block">{agr.title}</span>
                                <span className="font-mono text-[11px] text-[#006FFF]">{agr.agreementNumber}</span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${agr.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                              >
                                {agr.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                              <div>
                                <span className="text-slate-500 block">Calculation Method:</span>
                                <span className="font-semibold text-slate-800">{agr.royaltyCalculationMethod || agr.calculationMethod || 'PERCENTAGE_REVENUE'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Royalty Share:</span>
                                <span className="font-semibold text-slate-800">
                                  DG {agr.digitalGuruRevenuePercentage ?? 50}% / Partner {agr.partnerRevenuePercentage ?? 50}%
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Validity Period:</span>
                                <span className="text-slate-800">
                                  {agr.startDate ? new Date(agr.startDate).toLocaleDateString() : 'N/A'} → {agr.endDate ? new Date(agr.endDate).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                              {agr.upfrontRoyaltyFee > 0 && (
                                <div>
                                  <span className="text-slate-500 block">Upfront Royalty Fee:</span>
                                  <span className="font-semibold text-slate-800">₹{Number(agr.upfrontRoyaltyFee).toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              {agr.fixedMonthlyRoyalty > 0 && (
                                <div>
                                  <span className="text-slate-500 block">Fixed Monthly Royalty:</span>
                                  <span className="font-semibold text-slate-800">₹{Number(agr.fixedMonthlyRoyalty).toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              {agr.annualRoyaltyAmount > 0 && (
                                <div>
                                  <span className="text-slate-500 block">Annual Royalty Obligation:</span>
                                  <span className="font-semibold text-slate-800">₹{Number(agr.annualRoyaltyAmount).toLocaleString('en-IN')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Digital Guru Franchise Management Enterprise v2.0
              </div>
              <div className="flex items-center gap-2">
                {detailData?.franchise && (
                  <button
                    type="button"
                    onClick={() => handleResetPassword(detailData.franchise)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#006FFF] hover:bg-blue-50 rounded-xl transition border border-blue-200 cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 inline mr-1" /> Reset / Generate Permanent Password
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  className="px-5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition shadow-xs cursor-pointer"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

