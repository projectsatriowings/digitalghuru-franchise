import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Franchise, FranchiseAgreement, FranchiseRoyaltyInstallment } from '../types';
import { lookupByPostalCode } from '../utils/locationHelper';
import { isValidEmail, isValidPhone, sanitizePhoneInput } from '../utils/validation';
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
  EyeOff,
  Copy,
  GraduationCap,
  UserX,
  CheckCircle,
  MoreVertical,
  Percent,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const FranchiseManagement: React.FC = () => {
  const { showToast } = useToast();
  const { refreshBranches } = useAuth();
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
  const [visitedTabs, setVisitedTabs] = useState<Set<'profile' | 'model' | 'financials' | 'review'>>(new Set(['profile']));
  const [isLocatingPincode, setIsLocatingPincode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [createdResultModal, setCreatedResultModal] = useState<any>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const createModalBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCreateModal) {
      createModalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [createModalTab, showCreateModal]);

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [selectedFranchiseForBranch, setSelectedFranchiseForBranch] = useState<Franchise | null>(null);
  const [selectedFranchiseIdForBranch, setSelectedFranchiseIdForBranch] = useState<string>('');
  const [branchModalMode, setBranchModalMode] = useState<'existing' | 'new'>('new');
  const [unassignedBranches, setUnassignedBranches] = useState<any[]>([]);
  const [selectedExistingBranchId, setSelectedExistingBranchId] = useState('');
  const [isBranchLocatingPincode, setIsBranchLocatingPincode] = useState(false);
  const [expandedFranchiseId, setExpandedFranchiseId] = useState<string | null>(null);

  const handleBranchPostalCodeLookup = async (val: string) => {
    const clean = val.trim().replace(/\D/g, '');
    setBranchForm((prev) => ({ ...prev, postalCode: val }));
    if (clean.length === 6) {
      setIsBranchLocatingPincode(true);
      try {
        const res = await lookupByPostalCode(clean);
        if (res) {
          setBranchForm((prev) => ({
            ...prev,
            city: res.city || prev.city,
            state: res.state || prev.state,
          }));
        }
      } catch (err) {
        console.warn('Branch pincode lookup error:', err);
      } finally {
        setIsBranchLocatingPincode(false);
      }
    }
  };

  // Three-dot action menu state
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setActiveActionMenuId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [selectedInstallmentForPayment, setSelectedInstallmentForPayment] = useState<any>(null);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedAgreementForRenew, setSelectedAgreementForRenew] = useState<any>(null);

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedFranchiseForReset, setSelectedFranchiseForReset] = useState<any>(null);
  const [resetResult, setResetResult] = useState<any>(null);
  const [resetPassMode, setResetPassMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [customOwnerPassword, setCustomOwnerPassword] = useState('');
  const [showCustomOwnerPassword, setShowCustomOwnerPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [installmentsLoaded, setInstallmentsLoaded] = useState(false);
  const [monthlyLoaded, setMonthlyLoaded] = useState(false);

  // Franchise Details Drawer State
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showDrawerPassword, setShowDrawerPassword] = useState(false);
  const [drawerCopiedKey, setDrawerCopiedKey] = useState<string | null>(null);

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
      terms: 'Standard Digital Ghuru franchise license terms. Two annual installments due per agreement year.',
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
    revenueSharePercentage: 50,
  });

  // Dedicated Revenue / Royalty Share Edit Modal
  const [showRevenueShareModal, setShowRevenueShareModal] = useState(false);
  const [selectedFranchiseForShare, setSelectedFranchiseForShare] = useState<Franchise | null>(null);
  const [franchiseShareInput, setFranchiseShareInput] = useState<number>(50);
  const [isSubmittingShare, setIsSubmittingShare] = useState(false);

  // Status Change Confirmation Modal
  const [statusModalState, setStatusModalState] = useState<{
    isOpen: boolean;
    franchiseId: string;
    franchiseName: string;
    franchiseCode?: string;
    currentStatus: string;
    targetStatus: string;
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    franchiseId: '',
    franchiseName: '',
    franchiseCode: '',
    currentStatus: 'ACTIVE',
    targetStatus: 'SUSPENDED',
    reason: 'Administrative update',
    isSubmitting: false,
  });
  const [editLinkInstituteId, setEditLinkInstituteId] = useState('');
  const [isSubmittingBranchInEdit, setIsSubmittingBranchInEdit] = useState(false);
  const [isLinkingBranchInEdit, setIsLinkingBranchInEdit] = useState(false);
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [isAssigningExistingBranch, setIsAssigningExistingBranch] = useState(false);
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
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
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

  // Load Data (Optimized: initial load fetches only primary dashboard + franchise directory)
  const loadInstallments = async () => {
    try {
      const instRes = await apiFetch('/franchises/all/installments').catch(() => ({ success: false, data: { installments: [] } }));
      if (instRes.success && Array.isArray(instRes.data?.installments)) {
        setInstallments(instRes.data.installments);
        setInstallmentsLoaded(true);
      }
    } catch {
      // non-blocking
    }
  };

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const opts = forceRefresh ? { skipCache: true } : {};
      const [dashRes, listRes] = await Promise.all([
        apiFetch('/franchises/dashboard/super-admin', opts),
        apiFetch('/franchises', opts),
      ]);

      if (dashRes.success) {
        setDashboardStats(dashRes.data);
      }

      if (listRes.success) {
        const fetchedFranchises: Franchise[] = listRes.data.franchises || [];
        setFranchises(fetchedFranchises);
      }

      // Refresh secondary tabs only if already loaded or currently active
      if (activeTab === 'installments' || installmentsLoaded) {
        loadInstallments();
      }
      if (activeTab === 'monthly_settlements' || monthlyLoaded) {
        loadMonthlyRecords();
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
        setMonthlyLoaded(true);
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
  }, []);

  // Lazy-load secondary tab data only when user clicks those tabs
  useEffect(() => {
    if (activeTab === 'installments' && !installmentsLoaded) {
      loadInstallments();
    } else if (activeTab === 'monthly_settlements' && !monthlyLoaded) {
      loadMonthlyRecords();
    }
  }, [activeTab, installmentsLoaded, monthlyLoaded]);

  // Lazy-load agreement templates only when Create or Revise modal opens
  useEffect(() => {
    if ((showCreateModal || showReviseModal) && agreementTemplates.length === 0) {
      loadAgreementTemplates();
    }
  }, [showCreateModal, showReviseModal, agreementTemplates.length]);

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

  const handlePostalCodeLookup = async (val: string) => {
    const clean = val.trim().replace(/\D/g, '');
    setCreateForm((prev) => ({ ...prev, postalCode: val }));
    if (clean.length === 6) {
      setIsLocatingPincode(true);
      try {
        const res = await lookupByPostalCode(clean);
        if (res) {
          setCreateForm((prev) => ({
            ...prev,
            city: res.city || prev.city,
            state: res.state || prev.state,
          }));
        }
      } catch (err) {
        console.warn('Pincode lookup error:', err);
      } finally {
        setIsLocatingPincode(false);
      }
    }
  };

  const validateProfileStep = () => {
    const errs: Record<string, string> = {};

    if (!createForm.name?.trim()) {
      errs.name = 'Franchise / Center Name is required';
    } else if (createForm.name.trim().length < 3) {
      errs.name = 'Franchise / Center Name must be at least 3 characters';
    }

    if (!createForm.ownerName?.trim()) {
      errs.ownerName = 'Owner Full Name is required';
    } else if (createForm.ownerName.trim().length < 2) {
      errs.ownerName = 'Owner Full Name must be at least 2 characters';
    }

    if (!createForm.email?.trim()) {
      errs.email = 'Owner Email Address is required';
    } else if (!isValidEmail(createForm.email.trim())) {
      errs.email = 'Please enter a valid email address (e.g. name@domain.com)';
    }

    if (!createForm.phone?.trim()) {
      errs.phone = 'Primary Mobile Number is required';
    } else if (!isValidPhone(createForm.phone.trim())) {
      errs.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (!createForm.address?.trim()) {
      errs.address = 'Full Business Address is required';
    } else if (createForm.address.trim().length < 5) {
      errs.address = 'Please provide a complete business address';
    }

    if (!createForm.city?.trim()) {
      errs.city = 'City is required';
    }

    if (!createForm.state?.trim()) {
      errs.state = 'State is required';
    }

    const cleanPin = (createForm.postalCode || '').trim().replace(/\D/g, '');
    if (!cleanPin) {
      errs.postalCode = 'Postal / PIN Code is required';
    } else if (cleanPin.length !== 6) {
      errs.postalCode = 'PIN Code must be exactly 6 digits';
    }

    // Optional authorized alternate contact validation (if filled)
    if (createForm.authorizedContact?.email && !isValidEmail(createForm.authorizedContact.email)) {
      errs.authEmail = 'Please enter a valid email for the authorized contact person';
    }
    if (createForm.authorizedContact?.phone && !isValidPhone(createForm.authorizedContact.phone)) {
      errs.authPhone = 'Please enter a valid phone number for the authorized contact person';
    }

    setValidationErrors(errs);

    const firstKey = Object.keys(errs)[0];
    if (firstKey) {
      showToast(errs[firstKey], 'error');
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
    createForm.name.trim().length >= 3 &&
    createForm.ownerName?.trim() &&
    createForm.ownerName.trim().length >= 2 &&
    createForm.email?.trim() &&
    isValidEmail(createForm.email.trim()) &&
    !hasBlockingConflict &&
    createForm.phone?.trim() &&
    isValidPhone(createForm.phone.trim()) &&
    createForm.address?.trim() &&
    createForm.address.trim().length >= 5 &&
    createForm.city?.trim() &&
    createForm.state?.trim() &&
    (createForm.postalCode || '').trim().replace(/\D/g, '').length === 6 &&
    (!createForm.authorizedContact?.email || isValidEmail(createForm.authorizedContact.email)) &&
    (!createForm.authorizedContact?.phone || isValidPhone(createForm.authorizedContact.phone))
  );

  // A step is only considered complete if the user has reached/validated it, not automatically pre-checked ahead of time
  const isModelStepComplete = Boolean(
    isProfileStepComplete &&
    visitedTabs.has('model') &&
    createForm.initialAgreement.startDate &&
    createForm.initialAgreement.endDate
  );

  const isFinancialsStepComplete = Boolean(
    isModelStepComplete &&
    visitedTabs.has('financials') &&
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
    setVisitedTabs((prev) => new Set([...prev, targetTab]));
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
        branchOption: 'NONE',
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
    // Close current details drawer so the Edit modal is front and center
    handleCloseDetails();
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
      revenueSharePercentage: fr.revenueSharePercentage !== null && fr.revenueSharePercentage !== undefined
        ? Number(fr.revenueSharePercentage)
        : 50,
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

  const openRevenueShareModal = (fr: Franchise) => {
    setSelectedFranchiseForShare(fr);
    const currentPct = fr.revenueSharePercentage !== null && fr.revenueSharePercentage !== undefined
      ? Number(fr.revenueSharePercentage)
      : 50;
    setFranchiseShareInput(currentPct);
    setShowRevenueShareModal(true);
  };

  const handleSaveRevenueShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForShare) return;
    const shareNum = Number(franchiseShareInput);
    if (isNaN(shareNum) || shareNum < 0 || shareNum > 100) {
      showToast('Franchise share percentage must be between 0% and 100%', 'warning');
      return;
    }
    try {
      setIsSubmittingShare(true);
      const res = await apiFetch(`/franchises/${selectedFranchiseForShare.id}/revenue-share`, {
        method: 'PATCH',
        body: JSON.stringify({ revenueSharePercentage: shareNum }),
      });
      if (res.success) {
        showToast(res.message || 'Franchise royalty percentage updated successfully', 'success');
        setShowRevenueShareModal(false);
        await loadData();
        if (detailData && detailData.franchise?.id === selectedFranchiseForShare.id) {
          await fetchFranchiseDetails(selectedFranchiseForShare.id);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update revenue share percentage', 'error');
    } finally {
      setIsSubmittingShare(false);
    }
  };

  const handleSaveFranchiseProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForEdit) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editForm,
          revenueSharePercentage: Number(editForm.revenueSharePercentage),
        }),
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
    if (!selectedFranchiseForEdit || !editLinkInstituteId || isLinkingBranchInEdit) return;
    setIsLinkingBranchInEdit(true);
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
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to link branch', 'error');
    } finally {
      setIsLinkingBranchInEdit(false);
    }
  };

  const handleCreateBranchInEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFranchiseForEdit || !editNewBranch.name.trim() || isSubmittingBranchInEdit) return;
    setIsSubmittingBranchInEdit(true);
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
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create branch', 'error');
    } finally {
      setIsSubmittingBranchInEdit(false);
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
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
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

  const handleStatusToggle = (franchiseId: string, currentStatus: string) => {
    const fr = franchises.find((f) => f.id === franchiseId) || (detailData?.franchise?.id === franchiseId ? detailData.franchise : null);
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setStatusModalState({
      isOpen: true,
      franchiseId,
      franchiseName: fr?.name || 'Franchise Center',
      franchiseCode: fr?.code || '',
      currentStatus,
      targetStatus: nextStatus,
      reason: nextStatus === 'SUSPENDED' ? 'Administrative review / contract compliance' : 'Account reactivated by administrator',
      isSubmitting: false,
    });
  };

  const handleConfirmStatusChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const { franchiseId, targetStatus, reason } = statusModalState;
    if (!franchiseId) return;

    try {
      setStatusModalState((prev) => ({ ...prev, isSubmitting: true }));
      const res = await apiFetch(`/franchises/${franchiseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus, reason: reason.trim() || 'Administrative update' }),
      });
      if (res.success) {
        showToast(`Franchise status successfully changed to ${targetStatus}`, 'success');
        setStatusModalState((prev) => ({ ...prev, isOpen: false, isSubmitting: false }));
        await loadData();
        if (detailData && detailData.franchise?.id === franchiseId) {
          await fetchFranchiseDetails(franchiseId);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update franchise status', 'error');
      setStatusModalState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleResetPassword = async (franchise: any) => {
    // Close current details drawer cleanly before showing the Change Password page
    handleCloseDetails();
    setSelectedFranchiseForReset(franchise);
    setResetResult(null);
    setResetPassMode('AUTO');
    setCustomOwnerPassword('');
    setShowCustomOwnerPassword(false);
    setShowResetPasswordModal(true);
  };

  const handleCloseResetPasswordModal = () => {
    setShowResetPasswordModal(false);
    setSelectedFranchiseForReset(null);
    setResetResult(null);
    setCustomOwnerPassword('');
    setShowCustomOwnerPassword(false);
  };

  const executeResetPassword = async () => {
    if (!selectedFranchiseForReset) return;
    if (resetPassMode === 'MANUAL' && customOwnerPassword.trim().length < 8) {
      showToast('Custom password must be at least 8 characters long.', 'error');
      return;
    }
    try {
      setResettingPassword(true);
      const bodyPayload = resetPassMode === 'MANUAL' ? { password: customOwnerPassword.trim() } : {};
      const res = await apiFetch(`/franchises/${selectedFranchiseForReset.id}/owner/reset-password`, {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      if (res.success && res.data) {
        setResetResult(res.data);
        showToast('Password updated successfully. Share the new credentials with the owner.', 'success');
      } else {
        showToast(res.error || 'Failed to change password', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setResettingPassword(false);
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
    setShowDrawerPassword(false);
    setDrawerCopiedKey(null);
  };

  const openAddBranchModal = async (fr?: Franchise | null) => {
    // Enforce 1:1 rule: Each franchise admin can have only one branch
    if (fr && fr.branches && fr.branches.length >= 1) {
      showToast(`Franchise '${fr.name}' already has a campus branch (${fr.branches[0].name}). Each franchise can only have one branch.`, 'error');
      return;
    }
    // Close current details drawer before opening Add Branch modal
    handleCloseDetails();
    if (fr) {
      setSelectedFranchiseForBranch(fr);
      setSelectedFranchiseIdForBranch(fr.id);
    } else {
      const availableFranchise = franchises.find((f) => !f.branches || f.branches.length === 0);
      if (availableFranchise) {
        setSelectedFranchiseForBranch(availableFranchise);
        setSelectedFranchiseIdForBranch(availableFranchise.id);
      } else if (franchises.length > 0) {
        setSelectedFranchiseForBranch(franchises[0]);
        setSelectedFranchiseIdForBranch(franchises[0].id);
      }
    }
    setBranchModalMode('new');
    setSelectedExistingBranchId('');
    setBranchForm({
      name: '',
      code: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
    });
    setShowAddBranchModal(true);
    try {
      const res = await apiFetch('/franchises/unassigned-branches');
      if (res.success && Array.isArray(res.data?.branches)) {
        setUnassignedBranches(res.data.branches);
      }
    } catch {
      setUnassignedBranches([]);
    }
  };

  const handleAssignExistingBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetFranchiseId = selectedFranchiseForBranch?.id || selectedFranchiseIdForBranch;
    if (!targetFranchiseId || !selectedExistingBranchId || isAssigningExistingBranch) return;
    setIsAssigningExistingBranch(true);
    try {
      const res = await apiFetch(`/franchises/${targetFranchiseId}/branches`, {
        method: 'POST',
        body: JSON.stringify({ instituteId: selectedExistingBranchId }),
      });
      if (res.success) {
        showToast('Existing campus branch successfully assigned to franchise!', 'success');
        setShowAddBranchModal(false);
        setSelectedExistingBranchId('');
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to assign branch', 'error');
    } finally {
      setIsAssigningExistingBranch(false);
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
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to detach branch', 'error');
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetFranchiseId = selectedFranchiseForBranch?.id || selectedFranchiseIdForBranch;
    if (!targetFranchiseId) {
      showToast('Please select a franchise to assign the branch to', 'error');
      return;
    }

    if (!branchForm.name.trim()) {
      showToast('Campus / Branch Name is required', 'error');
      return;
    }
    if (branchForm.email.trim() && !isValidEmail(branchForm.email)) {
      showToast('Please enter a valid email address for the branch', 'error');
      return;
    }
    if (branchForm.phone.trim() && !isValidPhone(branchForm.phone)) {
      showToast('Please enter a valid phone number for the branch', 'error');
      return;
    }

    if (isAddingBranch) return;
    setIsAddingBranch(true);
    try {
      const res = await apiFetch(`/franchises/${targetFranchiseId}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          createNew: true,
          name: branchForm.name.trim(),
          code: branchForm.code.trim() || undefined,
          phone: branchForm.phone.trim() || undefined,
          email: branchForm.email.trim() ? branchForm.email.trim().toLowerCase() : undefined,
          address: branchForm.address.trim() || undefined,
          city: branchForm.city.trim() || undefined,
          state: branchForm.state.trim() || undefined,
          postalCode: branchForm.postalCode.trim() || undefined,
        }),
      });

      if (res.success) {
        showToast(`Campus branch "${branchForm.name}" successfully added to franchise!`, 'success');
        setShowAddBranchModal(false);
        setBranchForm({
          name: '',
          code: '',
          phone: '',
          email: '',
          address: '',
          city: '',
          state: '',
          postalCode: '',
        });
        refreshBranches();
        window.dispatchEvent(new CustomEvent('tuitionos:branches-updated'));
        loadData();
      } else {
        showToast(res.error || 'Failed to add branch', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to attach branch', 'error');
    } finally {
      setIsAddingBranch(false);
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
            <span className="text-xs text-slate-400">Digital Ghuru Franchise Enterprise</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Franchise & Royalty Management</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Register and manage Franchisee Admins, enforce two-installment annual royalty schedules, attach branch campuses, and track verified payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={() => loadData(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 inline-flex items-center gap-2 text-sm font-semibold"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
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
              setCreateForm(initialCreateForm);
              setVisitedTabs(new Set(['profile']));
              setCreateModalTab('profile');
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 font-bold rounded-xl shadow-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" /> Add Franchise
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
      <div className="flex flex-wrap border-b border-slate-200 bg-white px-4 rounded-t-xl gap-6">
        <button
          onClick={() => setActiveTab('franchises')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'franchises'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <Building2 className="w-4 h-4" /> Franchises ({franchises.length})
        </button>

        <button
          onClick={() => setActiveTab('installments')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'installments'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <DollarSign className="w-4 h-4" /> Royalty Installments{installmentsLoaded ? ` (${installments.length})` : ''}
        </button>

        <button
          onClick={() => setActiveTab('agreements')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'agreements'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <FileText className="w-4 h-4" /> Agreements
        </button>

        <button
          onClick={() => setActiveTab('monthly_settlements')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'monthly_settlements'
            ? 'border-[#006FFF] text-[#006FFF]'
            : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          <Layers className="w-4 h-4" /> Monthly Royalty{monthlyLoaded ? ` (${monthlyRecords.length})` : ''}
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

          <div className="w-full rounded-xl border border-slate-200 bg-white shadow-xs overflow-visible">
            <table className="w-full text-left text-xs table-auto">
              <thead className="bg-[#F8FAFC] text-[11px] font-bold text-[#64748B] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap w-24">Code</th>
                  <th className="py-3 px-3">Franchise Center</th>
                  <th className="py-3 px-3">Owner Contact</th>
                  <th className="py-3 px-3">Location & Address</th>
                  <th className="py-3 px-3 whitespace-nowrap w-36">Branch / Campus</th>
                  <th className="py-3 px-3 whitespace-nowrap w-28">Royalty Split</th>
                  <th className="py-3 px-3 whitespace-nowrap w-24">Status</th>
                  <th className="py-3 px-3 text-center w-14 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFranchises.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 text-sm">
                      No franchises found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFranchises.map((fr) => (
                    <React.Fragment key={fr.id}>
                      <tr
                        onClick={() => handleOpenDetails(fr.id)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group relative"
                      >
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs bg-blue-50 text-[#006FFF] px-2.5 py-1 rounded border border-blue-200 whitespace-nowrap inline-block tracking-wide">
                            {fr.code}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-bold text-slate-900 group-hover:text-[#006FFF] transition-colors">{fr.name}</div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="font-semibold text-slate-900 text-xs">{fr.ownerName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]" title={fr.email}>{fr.email}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{fr.phone}</div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="text-xs text-slate-800 font-medium">
                            {fr.city}{fr.state ? `, ${fr.state}` : ''}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1 max-w-[220px]" title={fr.address || 'Address on file'}>
                            {fr.address || 'Address on file'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">PIN: {fr.postalCode || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          {fr.branches && fr.branches.length > 0 ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-slate-900">{fr.branches[0].name}</span>
                              <span className="text-[11px] font-mono text-[#006FFF]">
                                {fr.branches[0].code}{fr.branches[0].city ? ` • ${fr.branches[0].city}` : ''}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddBranchModal(fr);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-[#006FFF] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg inline-flex items-center gap-1 shadow-xs transition-colors"
                              title="Set up single campus branch for this franchise"
                            >
                              <Plus className="w-3 h-3" /> Link Branch
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRevenueShareModal(fr);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-[#006FFF] border border-slate-200 hover:border-blue-300 transition-all cursor-pointer group whitespace-nowrap"
                            title="Click to edit franchise royalty split percentage"
                          >
                            <span className="font-bold text-[#006FFF]">{fr.revenueSharePercentage !== null && fr.revenueSharePercentage !== undefined ? Number(fr.revenueSharePercentage) : 50}%</span>
                            <span className="text-slate-400 font-normal">/</span>
                            <span className="text-slate-500 font-medium">{fr.digitalGuruRevenuePercentage !== null && fr.digitalGuruRevenuePercentage !== undefined ? Number(fr.digitalGuruRevenuePercentage) : 50}%</span>
                            <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-[#006FFF] transition-colors ml-0.5" />
                          </button>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${fr.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${fr.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {fr.status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap relative">
                          <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(activeActionMenuId === fr.id ? null : fr.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 transition-colors"
                              title="Franchise Actions"
                              aria-label={`Actions for ${fr.name}`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeActionMenuId === fr.id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    handleOpenDetails(fr.id);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#006FFF] transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#006FFF]" />
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    openRevenueShareModal(fr);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#006FFF] transition-colors"
                                >
                                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                                  Edit Royalty Split %
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    openEditFranchiseModal(fr);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#006FFF] transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                                  Edit Franchise
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    handleStatusToggle(fr.id, fr.status);
                                  }}
                                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold transition-colors ${
                                    fr.status === 'ACTIVE'
                                      ? 'text-rose-700 hover:bg-rose-50'
                                      : 'text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  {fr.status === 'ACTIVE' ? (
                                    <>
                                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                                      Suspend Franchise
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      Activate Franchise
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedFranchiseId === fr.id && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={7} className="p-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-[#006FFF]" /> Assigned Campus Branch
                                </h4>
                                <div className="flex items-center gap-2">
                                  {(!fr.branches || fr.branches.length === 0) && (
                                    <button
                                      onClick={() => openAddBranchModal(fr)}
                                      className="px-3.5 py-1.5 bg-[#006FFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-lg shadow-sm"
                                    >
                                      + Attach Branch
                                    </button>
                                  )}
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
                                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                                          title="Remove branch from franchise (preserves all records)"
                                        >
                                          Remove Branch
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
                      <RefreshCw className="w-4 h-4" /> Renew Agreement
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
                              className="px-3 py-1.5 text-[#006FFF] hover:text-blue-800 font-semibold bg-white border border-blue-200 rounded-lg text-xs"
                              title="Create a revised version of this agreement"
                            >
                              Revise Terms
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
                            className="px-3 py-1.5 text-slate-700 hover:text-slate-900 font-semibold bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            Add Note
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
                <Plus className="w-4 h-4" /> Calculate Royalty
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
                  <th className="px-4 py-3">Digital Ghuru Share</th>
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
                            placeholder="e.g. Digital Ghuru Chennai Central"
                            value={createForm.name}
                            onChange={(e) => {
                              setCreateForm({ ...createForm, name: e.target.value });
                              if (validationErrors.name) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.name; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.name ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.name && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.name}
                            </p>
                          )}
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
                            onChange={(e) => {
                              setCreateForm({ ...createForm, ownerName: e.target.value });
                              if (validationErrors.ownerName) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.ownerName; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.ownerName ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.ownerName && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.ownerName}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">Owner Email Address *</label>
                          <input
                            type="email"
                            required
                            placeholder="owner@dgchennai.com"
                            value={createForm.email}
                            onChange={(e) => {
                              setCreateForm({ ...createForm, email: e.target.value });
                              if (validationErrors.email) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.email; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.email ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : (duplicateFranchiseMatch || (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise'))
                              ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                              : duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'User'
                                ? 'border-blue-400 bg-blue-50/30'
                                : 'border-slate-200'
                              }`}
                          />
                          {validationErrors.email && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.email}
                            </p>
                          )}
                          {!validationErrors.email && (duplicateFranchiseMatch || (duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'Franchise')) && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {duplicateCheckResult.emailConflict?.message || `A franchise with this email already exists (${duplicateFranchiseMatch?.name} [${duplicateFranchiseMatch?.code}]).`}
                            </p>
                          )}
                          {!validationErrors.email && !duplicateFranchiseMatch && duplicateCheckResult.emailConflict?.isDuplicate && duplicateCheckResult.emailConflict.model === 'User' && (
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
                            onChange={(e) => {
                              setCreateForm({ ...createForm, phone: sanitizePhoneInput(e.target.value) });
                              if (validationErrors.phone) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.phone; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.phone ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : duplicateCheckResult.phoneConflict?.isDuplicate ? 'border-rose-400 bg-rose-50/40 text-rose-900' : 'border-slate-200'
                              }`}
                          />
                          {validationErrors.phone && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.phone}
                            </p>
                          )}
                          {!validationErrors.phone && duplicateCheckResult.phoneConflict?.isDuplicate && (
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
                            onChange={(e) => {
                              setCreateForm({ ...createForm, address: e.target.value });
                              if (validationErrors.address) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.address; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.address ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.address && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.address}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 flex items-center justify-between">
                            <span>Postal / PIN Code *</span>
                            {isLocatingPincode && (
                              <span className="text-[10px] text-[#006FFF] flex items-center gap-1 font-normal">
                                <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                              </span>
                            )}
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="600002"
                            value={createForm.postalCode}
                            onChange={(e) => {
                              handlePostalCodeLookup(e.target.value);
                              if (validationErrors.postalCode) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.postalCode; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.postalCode ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.postalCode && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.postalCode}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">City *</label>
                          <input
                            type="text"
                            required
                            placeholder="Chennai"
                            value={createForm.city}
                            onChange={(e) => {
                              setCreateForm({ ...createForm, city: e.target.value });
                              if (validationErrors.city) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.city; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.city ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.city && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.city}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700">State *</label>
                          <input
                            type="text"
                            required
                            placeholder="Tamil Nadu"
                            value={createForm.state}
                            onChange={(e) => {
                              setCreateForm({ ...createForm, state: e.target.value });
                              if (validationErrors.state) setValidationErrors((prev) => { const cp = { ...prev }; delete cp.state; return cp; });
                            }}
                            className={`mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF] ${validationErrors.state ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-1 ring-rose-500' : 'border-slate-200'}`}
                          />
                          {validationErrors.state && (
                            <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {validationErrors.state}
                            </p>
                          )}
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
                          <label className="block text-xs font-medium text-slate-700">Digital Ghuru Investment (%)</label>
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
                          <label className="block text-xs font-medium text-slate-700">Digital Ghuru Revenue Share (%) *</label>
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
                          { key: 'staffSalaries', label: 'Trainer Salaries' },
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
                              <option value="DIGITAL_GURU">Digital Ghuru</option>
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
                              <option value="DIGITAL_GURU">Digital Ghuru</option>
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
                        {/* Digital Ghuru Column */}
                        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 space-y-2">
                          <div className="font-bold text-sm text-[#FEDC32] flex items-center justify-between">
                            <span>Digital Ghuru (Franchisor)</span>
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
                                  .map(([k]) => k === 'rent' ? 'Building Rent' : k === 'staffSalaries' ? 'Trainer Salaries' : k === 'utilities' ? 'Utilities' : k)
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
                          <strong>DIRECT EXPENSE RULE:</strong> Direct expenses (such as Rent paid by Partner or Trainer Salaries paid by Digital Ghuru) are borne directly by each party and are <strong>NEVER</strong> automatically deducted from gross revenue collections. Deductions occur only when calculation basis is set to <em>Profit After Expenses</em> with approved deductible receipts.
                        </span>
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
                          setVisitedTabs((prev) => new Set([...prev, 'model']));
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
                          setVisitedTabs((prev) => new Set([...prev, 'financials']));
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
                          setVisitedTabs((prev) => new Set([...prev, 'review']));
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl my-auto border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setCreatedResultModal(null)}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">
                  Franchise Registered Successfully!
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Center profile initialized. Share these permanent login credentials with the franchise owner.
                </p>
              </div>
            </div>

            {/* Franchise Overview Cards */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-xs mb-5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Franchise Code</span>
                <span className="font-mono font-bold text-sm text-[#006FFF] mt-0.5 inline-block">
                  {createdResultModal.franchise?.code}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Agreement Number</span>
                <span className="font-mono font-bold text-sm text-slate-800 mt-0.5 inline-block">
                  {createdResultModal.agreement?.agreementNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Center Name</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 truncate block">
                  {createdResultModal.franchise?.name}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Owner Full Name</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 truncate block">
                  {createdResultModal.ownerCredentials?.fullName || createdResultModal.franchise?.ownerName}
                </span>
              </div>
            </div>

            {/* Credentials Card (Structured & Professional) */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-slate-50 rounded-2xl p-4 sm:p-5 border border-emerald-200/90 space-y-3.5 mb-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <Key className="w-3.5 h-3.5 text-emerald-600" /> Permanent Login Credentials
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Direct Login Ready
                </span>
              </div>

              {/* Username / Email Row */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Login Email / Username
                </label>
                <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200/90 px-3.5 py-2 shadow-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 truncate select-all">
                      {createdResultModal.ownerCredentials?.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const email = createdResultModal.ownerCredentials?.email || '';
                      navigator.clipboard.writeText(email);
                      setCopiedField('email');
                      setTimeout(() => setCopiedField(null), 2000);
                      showToast('Login email copied to clipboard!', 'success');
                    }}
                    className="ml-2 px-2.5 py-1 text-[11px] font-bold rounded-lg text-[#006FFF] hover:bg-blue-50 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'email' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Structured Password Row */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Structured Permanent Password
                  </label>
                  <span className="text-[10px] text-slate-400">Standard secure pattern</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-xl border border-emerald-300 px-3.5 py-2.5 shadow-xs ring-2 ring-emerald-500/10">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-mono text-sm sm:text-base font-extrabold text-slate-900 tracking-wider truncate select-all">
                      {showCreatedPassword ? (
                        createdResultModal.ownerCredentials?.permanentPassword ||
                        createdResultModal.ownerCredentials?.password ||
                        createdResultModal.ownerCredentials?.temporaryPassword
                      ) : (
                        '••••••••••••••••'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                      title={showCreatedPassword ? 'Mask password' : 'Show password'}
                    >
                      {showCreatedPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pwd =
                          createdResultModal.ownerCredentials?.permanentPassword ||
                          createdResultModal.ownerCredentials?.password ||
                          createdResultModal.ownerCredentials?.temporaryPassword ||
                          '';
                        navigator.clipboard.writeText(pwd);
                        setCopiedField('password');
                        setTimeout(() => setCopiedField(null), 2000);
                        showToast('Structured permanent password copied!', 'success');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'password' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Master Copy All Button */}
              <button
                type="button"
                onClick={() => {
                  const pwd =
                    createdResultModal.ownerCredentials?.permanentPassword ||
                    createdResultModal.ownerCredentials?.password ||
                    createdResultModal.ownerCredentials?.temporaryPassword ||
                    '';
                  const creds = [
                    `🎓 Digital Ghuru Franchise Center Onboarding`,
                    `=========================================`,
                    `Franchise Center : ${createdResultModal.franchise?.name} (${createdResultModal.franchise?.code})`,
                    `Agreement Number : ${createdResultModal.agreement?.agreementNumber}`,
                    `Owner Full Name  : ${createdResultModal.ownerCredentials?.fullName || createdResultModal.franchise?.ownerName}`,
                    `Portal Login URL : ${window.location.origin}/login`,
                    `Login Username   : ${createdResultModal.ownerCredentials?.email}`,
                    `Password         : ${pwd}`,
                    `=========================================`,
                    `Note: Keep these credentials secure.`,
                  ].join('\n');
                  navigator.clipboard.writeText(creds);
                  setCopiedField('all');
                  setTimeout(() => setCopiedField(null), 2000);
                  showToast('Complete onboarding details copied to clipboard!', 'success');
                }}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow cursor-pointer"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-white" /> Complete Credentials Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Complete Onboarding Details
                  </>
                )}
              </button>
            </div>

            {/* Generated Installments (if any) */}
            {createdResultModal.installments && createdResultModal.installments.length > 0 && (
              <div className="mb-5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Generated Royalty Installments ({createdResultModal.installments.length} Due This Year):
                </span>
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {createdResultModal.installments.map((inst: any) => (
                    <div
                      key={inst.id}
                      className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 text-xs"
                    >
                      <span className="font-semibold text-slate-700">{inst.periodLabel}</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{Number(inst.amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreatedResultModal(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md cursor-pointer"
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
                  <div className="text-xl font-black text-slate-900 tracking-tight">DIGITAL GHURU</div>
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
      {/* MODAL 6: CHANGE OWNER PASSWORD (SUPER ADMIN ONLY)             */}
      {/* ============================================================= */}
      {showResetPasswordModal && selectedFranchiseForReset && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl my-6 border border-slate-200 animate-in fade-in duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#006FFF] flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Change Owner Password</h3>
                  <p className="text-xs text-slate-500">
                    {selectedFranchiseForReset.name} &bull; {selectedFranchiseForReset.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseResetPasswordModal}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!resetResult ? (
              <div className="space-y-5">
                <p className="text-sm text-slate-700">
                  Update the login password for{' '}
                  <strong className="text-slate-900">{selectedFranchiseForReset.ownerName}</strong>.
                </p>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-800">Choose Password Method</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setResetPassMode('AUTO')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                        resetPassMode === 'AUTO'
                          ? 'bg-[#006FFF] text-white border-[#006FFF] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Auto-Generate
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetPassMode('MANUAL')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                        resetPassMode === 'MANUAL'
                          ? 'bg-[#006FFF] text-white border-[#006FFF] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Type New Password
                    </button>
                  </div>
                </div>

                {resetPassMode === 'MANUAL' ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      New Password (minimum 8 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showCustomOwnerPassword ? 'text' : 'password'}
                        value={customOwnerPassword}
                        onChange={(e) => setCustomOwnerPassword(e.target.value)}
                        placeholder="Enter a strong new password..."
                        minLength={8}
                        className="w-full px-3.5 py-2.5 pr-11 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/30 focus:border-[#006FFF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomOwnerPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                        title={showCustomOwnerPassword ? 'Hide password' : 'Show password'}
                      >
                        {showCustomOwnerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl text-sm text-slate-700">
                    A strong 16-character password will be generated automatically and shown on the next screen so you can copy it.
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    Security Notice
                  </div>
                  <div>
                    The previous password stops working immediately. The owner can sign in right away with the new password.
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseResetPasswordModal}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={resettingPassword || (resetPassMode === 'MANUAL' && customOwnerPassword.trim().length < 8)}
                    onClick={executeResetPassword}
                    className="px-5 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm transition cursor-pointer inline-flex items-center gap-2"
                  >
                    {resettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                    {resetPassMode === 'MANUAL' ? 'Save New Password' : 'Generate Password'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-sm space-y-2.5">
                  <div className="font-bold text-emerald-800 text-base flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    Password Updated Successfully!
                  </div>
                  <div className="text-slate-700 flex justify-between items-center">
                    <span className="text-slate-500">Owner:</span>
                    <span className="font-semibold text-slate-900">{selectedFranchiseForReset?.ownerName || resetResult.fullName}</span>
                  </div>
                  <div className="text-slate-700 flex justify-between items-center">
                    <span className="text-slate-500">Login Email:</span>
                    <span className="font-mono font-semibold text-slate-900">{resetResult.email}</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                    <span className="text-xs text-slate-500 block mb-1">New Password:</span>
                    <div className="font-mono font-bold text-emerald-950 text-lg text-center tracking-wider selection:bg-emerald-100 select-all">
                      {resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    Share this password securely with the Franchise Owner. It is ready for immediate login.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult.email);
                        showToast('Email copied!', 'success');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pwd = resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword;
                        navigator.clipboard.writeText(pwd);
                        showToast('Password copied!', 'success');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Password
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = resetResult.permanentPassword || resetResult.password || resetResult.temporaryPassword;
                      const creds = [
                        `Digital Ghuru Franchise Login Credentials`,
                        `Franchise: ${selectedFranchiseForReset?.name || 'Digital Ghuru Franchise'}`,
                        `Owner: ${selectedFranchiseForReset?.ownerName || resetResult.fullName}`,
                        `Portal URL: ${window.location.origin}/login`,
                        `Login Email: ${resetResult.email}`,
                        `Password: ${pwd}`,
                      ].join('\n');
                      navigator.clipboard.writeText(creds);
                      showToast('All login details copied!', 'success');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Copy className="w-4 h-4" /> Copy All
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseResetPasswordModal}
                    className="px-5 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold rounded-xl text-sm shadow-xs transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 7: ADD / ASSIGN CAMPUS BRANCH                           */}
      {/* ============================================================= */}
      {showAddBranchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-start justify-center p-4 sm:p-6 overflow-y-auto min-h-screen">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl my-6 sm:my-8 border border-slate-200">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#006FFF]" /> Add Campus Branch
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Establish an operational campus branch under a registered Franchise center
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Franchise Center Selection */}
            <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Franchise Center *
              </label>
              {franchises.length === 0 ? (
                <div className="text-xs text-amber-700">No franchises found. Please create a franchise first.</div>
              ) : (
                <select
                  value={selectedFranchiseIdForBranch || selectedFranchiseForBranch?.id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedFranchiseIdForBranch(id);
                    const found = franchises.find((f) => f.id === id);
                    if (found) setSelectedFranchiseForBranch(found);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#006FFF]"
                >
                  {franchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code}) — {f.city}, {f.state}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Optional Unassigned Mode Selector Tabs */}
            {unassignedBranches.length > 0 && (
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBranchModalMode('new')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${branchModalMode === 'new'
                    ? 'bg-white text-[#006FFF] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Create New Branch
                </button>
                <button
                  type="button"
                  onClick={() => setBranchModalMode('existing')}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${branchModalMode === 'existing'
                    ? 'bg-white text-[#006FFF] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Link Unassigned Institute ({unassignedBranches.length} Available)
                </button>
              </div>
            )}

            {branchModalMode === 'existing' && unassignedBranches.length > 0 ? (
              <form onSubmit={handleAssignExistingBranch} className="space-y-4">
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
                    disabled={!selectedExistingBranchId || isAssigningExistingBranch}
                    className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow flex items-center gap-2 cursor-pointer"
                  >
                    {isAssigningExistingBranch && <Loader2 className="w-4 h-4 animate-spin" />}
                    Assign Branch to Franchise
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddBranch} className="space-y-4">
                {/* 1. Branch Identity */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b pb-1">
                    <Building2 className="w-3.5 h-3.5 text-[#006FFF]" /> 1. Campus Identity & Codes
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Campus / Branch Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Digital Ghuru Anna Nagar Campus"
                        value={branchForm.name}
                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Branch Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Auto if blank"
                        value={branchForm.code}
                        onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border rounded-lg text-sm uppercase focus:ring-2 focus:ring-[#006FFF]"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">e.g. DG-ANN-01</p>
                    </div>
                  </div>
                </div>

                {/* 2. Contact Details */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b pb-1">
                    <Phone className="w-3.5 h-3.5 text-[#006FFF]" /> 2. Campus Contact Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Branch Phone / Contact Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={branchForm.phone}
                        onChange={(e) => setBranchForm({ ...branchForm, phone: sanitizePhoneInput(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Official Campus Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. annanagar@digitalguru.com"
                        value={branchForm.email}
                        onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value.toLowerCase() })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Location & Address */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b pb-1">
                    <MapPin className="w-3.5 h-3.5 text-[#006FFF]" /> 3. Location & Address
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
                        <span>PIN Code *</span>
                        {isBranchLocatingPincode && (
                          <span className="text-[10px] text-[#006FFF] flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Auto-filling...
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="e.g. 600040"
                        value={branchForm.postalCode}
                        onChange={(e) => handleBranchPostalCodeLookup(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chennai"
                        value={branchForm.city}
                        onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">State *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tamil Nadu"
                        value={branchForm.state}
                        onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Campus Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. #14, 2nd Avenue, Anna Nagar Roundabout"
                        value={branchForm.address}
                        onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddBranchModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingBranch}
                    className="px-6 py-2 bg-[#006FFF] hover:bg-[#0055CC] disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow transition-colors inline-flex items-center gap-2 cursor-pointer"
                  >
                    {isAddingBranch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create & Attach Campus
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
                    <label className="block text-xs font-medium text-slate-700">Digital Ghuru Revenue Share (%) *</label>
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
                        <option value="DIGITAL_GURU">Digital Ghuru</option>
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
                    <div className="font-bold text-sm text-[#FEDC32]">Digital Ghuru: {reviseForm.digitalGuruRevenuePercentage}% Rev</div>
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
      {showEditFranchiseModal && selectedFranchiseForEdit && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-start justify-center p-3 sm:p-6 overflow-y-auto min-h-screen">
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
                          disabled={!editLinkInstituteId || isLinkingBranchInEdit}
                          onClick={handleLinkBranchInEdit}
                          className="px-4 py-2 bg-[#006FFF] hover:bg-[#0055CC] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          {isLinkingBranchInEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
                          placeholder="e.g. Digital Ghuru T. Nagar Campus"
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
                        disabled={!editNewBranch.name.trim() || isSubmittingBranchInEdit}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmittingBranchInEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        + Create & Link Campus
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================= */}
      {/* MODAL 10: EDIT FRANCHISE ROYALTY SHARE PERCENTAGE            */}
      {/* ============================================================= */}
      {showRevenueShareModal && selectedFranchiseForShare && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-[#006FFF] flex items-center justify-center border border-blue-400/30">
                  <Percent className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Franchise Royalty Share
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-900 text-blue-200 border border-blue-700">
                      {selectedFranchiseForShare.code}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedFranchiseForShare.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRevenueShareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRevenueShare} className="p-6 space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#006FFF]" />
                  Super Admin Commercial Term Control
                </div>
                <p className="text-blue-800/90 text-[11px] leading-relaxed">
                  Updates the contracted royalty percentage share for this franchise. Any pending or draft monthly settlements will automatically recalculate.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Franchise Share (%) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={franchiseShareInput}
                      onChange={(e) => setFranchiseShareInput(Number(e.target.value))}
                      className="w-full pl-3 pr-8 py-2.5 border rounded-xl text-base font-black text-[#006FFF] bg-white focus:ring-2 focus:ring-[#006FFF]"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Digital Ghuru Share (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      disabled
                      value={Number((100 - Number(franchiseShareInput || 0)).toFixed(2))}
                      className="w-full pl-3 pr-8 py-2.5 border rounded-xl text-base font-black text-slate-600 bg-slate-100 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Visual Split Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-[#006FFF]">Partner: {Number(franchiseShareInput || 0)}%</span>
                  <span className="text-slate-600">Digital Ghuru: {Number((100 - Number(franchiseShareInput || 0)).toFixed(2))}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#006FFF] transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, Number(franchiseShareInput || 0)))}%` }}
                  />
                  <div
                    className="bg-slate-400 transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, 100 - Number(franchiseShareInput || 0)))}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRevenueShareModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingShare}
                  className="px-5 py-2 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-xl text-xs shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingShare && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Royalty Split
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================= */}
      {/* MODAL 11: CONFIRM FRANCHISE STATUS CHANGE (SUSPEND/ACTIVATE)  */}
      {/* ============================================================= */}
      {statusModalState.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b ${
              statusModalState.targetStatus === 'SUSPENDED'
                ? 'bg-gradient-to-r from-rose-900 to-slate-950 text-white border-rose-800/40'
                : 'bg-gradient-to-r from-emerald-900 to-slate-950 text-white border-emerald-800/40'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  statusModalState.targetStatus === 'SUSPENDED'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {statusModalState.targetStatus === 'SUSPENDED' ? (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {statusModalState.targetStatus === 'SUSPENDED' ? 'Suspend Franchise' : 'Reactivate Franchise'}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                    <span className="font-semibold text-white">{statusModalState.franchiseName}</span>
                    {statusModalState.franchiseCode && (
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-200">
                        {statusModalState.franchiseCode}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalState((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleConfirmStatusChange} className="p-6 space-y-4">
              <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                statusModalState.targetStatus === 'SUSPENDED'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {statusModalState.targetStatus === 'SUSPENDED'
                    ? 'Center Access Will Be Temporarily Blocked'
                    : 'Center Operations Will Resume Immediately'}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {statusModalState.targetStatus === 'SUSPENDED'
                    ? 'Franchise owner and campus administrators under this center will be prevented from enrolling new students or accessing operational dashboards until reactivated.'
                    : 'The franchise center will be restored to active standing. Trainer and owner accounts will regain immediate operational access.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Administrative Reason / Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={statusModalState.reason}
                  onChange={(e) => setStatusModalState((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder={
                    statusModalState.targetStatus === 'SUSPENDED'
                      ? 'e.g. Agreement review pending, royalty payment overdue, compliance audit...'
                      : 'e.g. Terms settled, compliance audit verified, resumed by HQ...'
                  }
                  className="w-full px-3 py-2 border rounded-xl text-xs text-slate-900 bg-white focus:ring-2 focus:ring-[#006FFF] focus:border-[#006FFF]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  This note will be recorded in the franchise center audit log.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusModalState.isSubmitting || !statusModalState.reason.trim()}
                  className={`px-5 py-2 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    statusModalState.targetStatus === 'SUSPENDED'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusModalState.isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {statusModalState.targetStatus === 'SUSPENDED' ? 'Confirm Suspension' : 'Confirm Activation'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white transition shadow-sm cursor-pointer"
                        title="Change password for franchise owner"
                      >
                        <Key className="w-4 h-4" /> Change Password
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

                      <div className="col-span-1 sm:col-span-2 p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-semibold text-xs">Password Status & Credentials</span>
                          {detailData.franchise.ownerUser?.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" /> Pending Change on Next Login
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-600" /> Permanent Password Set
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="flex-1 font-mono text-xs font-bold bg-white px-3 py-2 rounded-lg border border-slate-200 text-slate-800 tracking-wider flex items-center justify-between select-all shadow-xs">
                            <span>
                              {showDrawerPassword
                                ? (detailData.franchise.ownerPassword ||
                                   detailData.franchise.businessDetails?.initialPassword ||
                                   `DG@${(detailData.franchise.name || 'Partner').replace(/[^a-zA-Z]/g, '').slice(0, 7) || 'Partner'}2026#${(detailData.franchise.code || '1002').replace(/[^0-9]/g, '').slice(-4).padStart(4, '7')}`)
                                : '••••••••••••••••'}
                            </span>
                            <span className="text-[10px] font-sans font-medium text-slate-400 uppercase tracking-normal">
                              {showDrawerPassword ? 'Visible' : 'Masked'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowDrawerPassword(!showDrawerPassword)}
                            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition cursor-pointer shadow-xs"
                            title={showDrawerPassword ? 'Hide password' : 'Show password'}
                          >
                            {showDrawerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const pwd = detailData.franchise.ownerPassword ||
                                detailData.franchise.businessDetails?.initialPassword ||
                                `DG@${(detailData.franchise.name || 'Partner').replace(/[^a-zA-Z]/g, '').slice(0, 7) || 'Partner'}2026#${(detailData.franchise.code || '1002').replace(/[^0-9]/g, '').slice(-4).padStart(4, '7')}`;
                              navigator.clipboard.writeText(pwd);
                              setDrawerCopiedKey('drawer_password');
                              showToast('Franchise password copied to clipboard', 'success');
                              setTimeout(() => setDrawerCopiedKey(null), 2500);
                            }}
                            className={`px-3 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5 ${
                              drawerCopiedKey === 'drawer_password'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-[#006FFF] hover:bg-[#0058D4] text-white border-blue-600'
                            }`}
                            title="Copy password"
                          >
                            {drawerCopiedKey === 'drawer_password' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Password</span>
                              </>
                            )}
                          </button>
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
                        <Building2 className="w-4 h-4 text-slate-400" /> Authorized Campus Branch
                      </span>
                      {(!detailData.franchise.branches || detailData.franchise.branches.length === 0) && (
                        <button
                          type="button"
                          onClick={() => openAddBranchModal(detailData.franchise)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#006FFF] hover:bg-blue-100 transition border border-blue-200 cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Attach Branch
                        </button>
                      )}
                    </div>

                    {!detailData.franchise.branches || detailData.franchise.branches.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No campus branch currently attached to this franchise center. Click &ldquo;+ Attach Branch&rdquo; above to link one.
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

                    {/* Active Contracted Royalty Split Highlight */}
                    <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                      <div>
                        <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                          Active Contracted Royalty Split
                        </div>
                        <div className="text-sm font-extrabold text-[#006FFF] mt-0.5">
                          Franchise {Number(detailData.franchise.revenueSharePercentage ?? 50)}% / Digital Ghuru {Number(detailData.franchise.digitalGuruRevenuePercentage ?? 50)}%
                        </div>
                        <div className="text-[10px] text-blue-600">
                          Applied across monthly settlement calculations and student fee splits
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRevenueShareModal(detailData.franchise)}
                        className="px-3 py-1.5 bg-[#006FFF] hover:bg-[#0055CC] text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit Share %
                      </button>
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
                Digital Ghuru Franchise Management Enterprise v2.0
              </div>
              <div className="flex items-center gap-2">
                {detailData?.franchise && (
                  <button
                    type="button"
                    onClick={() => handleResetPassword(detailData.franchise)}
                    className="px-4 py-2 text-sm font-semibold text-[#006FFF] hover:bg-blue-50 rounded-xl transition border border-blue-200 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Key className="w-4 h-4" /> Change Password
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  className="px-5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

