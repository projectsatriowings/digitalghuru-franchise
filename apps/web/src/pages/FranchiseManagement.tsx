import React, { useState, useEffect } from 'react';
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
  const [createdResultModal, setCreatedResultModal] = useState<any>(null);

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

  // Forms
  const [createForm, setCreateForm] = useState({
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
      const dashRes = await apiFetch('/franchises/dashboard/super-admin');
      if (dashRes.success) {
        setDashboardStats(dashRes.data);
      }

      const listRes = await apiFetch('/franchises');
      if (listRes.success) {
        const fetchedFranchises: Franchise[] = listRes.data.franchises || [];
        setFranchises(fetchedFranchises);

        // Collect all installments across franchises
        const allInsts: any[] = [];
        for (const fr of fetchedFranchises) {
          try {
            const instRes = await apiFetch(`/franchises/${fr.id}/installments`);
            if (instRes.success && instRes.data.installments) {
              for (const item of instRes.data.installments) {
                allInsts.push({
                  ...item,
                  franchiseName: fr.name,
                  franchiseCode: fr.code,
                  ownerName: fr.ownerName,
                });
              }
            }
          } catch (e) {
            // Ignore individual fetch failure
          }
        }
        setInstallments(allInsts);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load franchise data', 'error');
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

  const handleCreateFranchise = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: createForm.name,
        ownerName: createForm.ownerName,
        email: createForm.email,
        phone: createForm.phone,
        password: createForm.password || undefined,
        address: createForm.address,
        city: createForm.city,
        state: createForm.state,
        postalCode: createForm.postalCode,
        country: createForm.country || 'India',
        authorizedContact: createForm.authorizedContact.name ? createForm.authorizedContact : undefined,
        businessDetails: {
          gstin: createForm.gstin,
          pan: createForm.pan,
        },
        initialAgreement: {
          agreementType: createForm.initialAgreement.agreementType,
          title: createForm.initialAgreement.title,
          startDate: createForm.initialAgreement.startDate,
          endDate: createForm.initialAgreement.endDate,
          calculationMethod: createForm.initialAgreement.calculationMethod,
          annualRoyaltyAmount: Number(createForm.initialAgreement.annualRoyaltyAmount || 0),
          royaltyPercentage: Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 50),
          digitalGuruRevenuePercentage: Number(createForm.initialAgreement.digitalGuruRevenuePercentage || 50),
          partnerRevenuePercentage: Number(createForm.initialAgreement.partnerRevenuePercentage || 50),
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
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create franchise', 'error');
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

  const executeResetPassword = async () => {
    if (!selectedFranchiseForReset) return;
    try {
      const res = await apiFetch(`/franchises/${selectedFranchiseForReset.id}/owner/reset-password`, {
        method: 'POST',
      });
      if (res.success) {
        setResetResult(res.data);
        showToast('Password reset successfully', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    }
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 font-bold rounded-xl shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Register Franchisee Admin
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {dashboardStats?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Franchises</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{dashboardStats.summary.totalFranchises}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">
              {dashboardStats.summary.activeFranchises} Active
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Branch Campuses</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{dashboardStats.summary.totalBranches}</div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {dashboardStats.summary.totalStudents} Active Students
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Royalty</div>
            <div className="text-2xl font-black text-[#006FFF] mt-1">
              ₹{Number(dashboardStats.summary.totalRoyaltyObligations || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">2-Installment Schedule</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Royalty Received</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              ₹{Number(dashboardStats.summary.totalRoyaltyReceived || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Verified Receipts</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Outstanding</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              ₹{Number(dashboardStats.summary.outstandingRoyalty || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">
              {dashboardStats.summary.dueInstallmentsCount || 0} Installments Due
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase">Overdue Amount</div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              ₹{Number(dashboardStats.summary.overdueRoyalty || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-1">
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
                  <th className="px-4 py-3">Code & Name</th>
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
                    <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                      No franchises found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredFranchises.map((fr) => (
                    <React.Fragment key={fr.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{fr.name}</div>
                          <div className="text-xs font-mono font-semibold text-[#006FFF]">{fr.code}</div>
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
                            onClick={() => setExpandedFranchiseId(expandedFranchiseId === fr.id ? null : fr.id)}
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
                            className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              fr.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {fr.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => openAddBranchModal(fr)}
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-all"
                            title="Assign existing branch or create new campus"
                          >
                            + Campus
                          </button>
                          <button
                            onClick={() => handleResetPassword(fr)}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-all inline-flex items-center gap-1"
                          >
                            <Key className="w-3 h-3" /> Password
                          </button>
                          <button
                            onClick={() => handleStatusToggle(fr.id, fr.status)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                              fr.status === 'ACTIVE'
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
                          <td colSpan={6} className="p-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-[#006FFF]" /> Assigned Campus Branches ({fr.branches?.length || 0})
                                </h4>
                                <button
                                  onClick={() => openAddBranchModal(fr)}
                                  className="px-3 py-1 bg-[#006FFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-lg shadow-sm"
                                >
                                  + Assign / Add Branch
                                </button>
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
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{inst.franchiseName}</div>
                          <div className="text-xs font-mono text-[#006FFF]">{inst.franchiseCode}</div>
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
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              rec.status === 'PAID'
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
      {/* MODAL 1: REGISTER FRANCHISE OWNER                             */}
      {/* ============================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register Franchisee Admin</h3>
                <p className="text-xs text-slate-500">
                  Collects full contact details, configures annual agreement, and generates two installments.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFranchise} className="space-y-5 mt-4">
              {/* Section 1: Business Details */}
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
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Primary Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                    />
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

              {/* Section 2: Authorized Alternate Contact */}
              <div className="space-y-3">
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

              {/* Section 3: Master Agreement & Business Model Configuration */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1 flex items-center justify-between">
                  <span>3. Master Agreement & Business Model Configuration</span>
                  <span className="text-[10px] text-[#006FFF] font-semibold">Four Dynamic Commercial Models</span>
                </div>

                {/* Preset Business Model Selector (Dynamically Loaded from Backend) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Select Agreement Business Model Preset:
                    </label>
                    {agreementTemplates.length > 0 && (
                      <span className="text-[10px] text-emerald-600 font-medium">✓ Authoritative API Templates Loaded</span>
                    )}
                  </div>

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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                            className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                              isSelected
                                ? 'bg-blue-50 border-[#006FFF] text-[#006FFF] font-bold shadow-sm ring-1 ring-[#006FFF]'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="font-bold text-[11px] leading-tight">{tmpl.label}</div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {defs.digitalGuruRevenuePercentage ?? 50}:{defs.partnerRevenuePercentage ?? 50} Rev • {defs.settlementFrequency || 'MONTHLY'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    Presets provide illustrative defaults only. All values are independent and fully editable below.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                </div>

                {/* Initial Setup Investment Configuration */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
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
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Revenue Sharing Configuration</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        Number(createForm.initialAgreement.digitalGuruRevenuePercentage) +
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
                        className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm font-medium"
                      >
                        <option value="MONTHLY">Monthly Settlement</option>
                        <option value="YEARLY">Yearly Settlement (2 Equal Installments)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Operational Expense Responsibilities */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
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

              {/* Commercial Agreement Summary (Pre-Submission Review) */}
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

              {/* Password notice */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  A strong temporary onboarding password will be automatically generated and displayed upon creation. Stored hashes are securely protected with argon2.
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#FEDC32] hover:bg-[#FEDC32]/90 text-slate-900 font-bold rounded-lg text-sm shadow transition-all"
                >
                  {createForm.initialAgreement.settlementFrequency === 'YEARLY'
                    ? 'Create Franchise & Generate 2 Annual Installments'
                    : 'Create Franchise (Monthly Settlement)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL 2: CREATION SUCCESS & ONBOARDING CREDENTIALS            */}
      {/* ============================================================= */}
      {createdResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
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
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-slate-500">Login Email:</span>
                <span className="font-bold text-slate-900">{createdResultModal.ownerCredentials?.email}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                <span className="text-xs font-semibold text-amber-800">Initial Temporary Password:</span>
                <span className="font-mono font-bold text-amber-950 text-sm">
                  {createdResultModal.ownerCredentials?.temporaryPassword}
                </span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 space-y-6">
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
                  <div className="text-slate-400 uppercase font-semibold">Installment Particulars:</div>
                  <div className="font-bold text-slate-900 mt-0.5">{receiptData.installment?.periodLabel}</div>
                  <div className="text-slate-600">Agreement: {receiptData.installment?.agreementNumber}</div>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
      {/* MODAL 6: RESET OWNER PASSWORD                                 */}
      {/* ============================================================= */}
      {showResetPasswordModal && selectedFranchiseForReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Reset Owner Password</h3>
              <button onClick={() => setShowResetPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!resetResult ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Are you sure you want to generate a new temporary password for{' '}
                  <strong>{selectedFranchiseForReset.ownerName}</strong> ({selectedFranchiseForReset.email})?
                </p>
                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordModal(false)}
                    className="px-4 py-2 border text-slate-600 rounded-lg text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeResetPassword}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm shadow"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-emerald-800 text-sm">Password Reset Successful!</div>
                  <div className="text-slate-600">Email: {resetResult.email}</div>
                  <div className="bg-white p-2.5 rounded border border-emerald-200 font-mono font-bold text-emerald-950 text-base text-center">
                    {resetResult.temporaryPassword}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Hand this temporary password securely to the franchisee admin. They will be prompted to update it upon sign in.
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowResetPasswordModal(false)}
                    className="px-5 py-2 bg-[#006FFF] text-white font-bold rounded-lg text-sm"
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
      {/* MODAL 7: ASSIGN / ADD BRANCH CAMPUS (SUPER ADMIN ONLY)        */}
      {/* ============================================================= */}
      {showAddBranchModal && selectedFranchiseForBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 border border-slate-200">
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
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      Number(reviseForm.digitalGuruRevenuePercentage) + Number(reviseForm.partnerRevenuePercentage) === 100
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

                <div className="grid grid-cols-2 gap-3">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
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
    </div >
  );
};

