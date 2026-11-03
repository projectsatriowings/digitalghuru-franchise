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
  const [activeTab, setActiveTab] = useState<'franchises' | 'agreements' | 'installments'>('franchises');
  const [loading, setLoading] = useState(true);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Lists
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedFranchiseFilter, setSelectedFranchiseFilter] = useState<string>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdResultModal, setCreatedResultModal] = useState<any>(null);

  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [selectedFranchiseForBranch, setSelectedFranchiseForBranch] = useState<Franchise | null>(null);

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
      title: 'Annual Master Franchise Agreement',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      calculationMethod: 'FIXED_ANNUAL' as 'FIXED_ANNUAL' | 'PERCENTAGE_REVENUE' | 'PER_STUDENT',
      annualRoyaltyAmount: 200000,
      royaltyPercentage: 50.0,
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
          title: createForm.initialAgreement.title,
          startDate: createForm.initialAgreement.startDate,
          endDate: createForm.initialAgreement.endDate,
          calculationMethod: createForm.initialAgreement.calculationMethod,
          annualRoyaltyAmount:
            createForm.initialAgreement.calculationMethod === 'FIXED_ANNUAL'
              ? Number(createForm.initialAgreement.annualRoyaltyAmount)
              : undefined,
          royaltyPercentage:
            createForm.initialAgreement.calculationMethod === 'PERCENTAGE_REVENUE'
              ? Number(createForm.initialAgreement.royaltyPercentage)
              : 50.0,
          royaltyBasis: createForm.initialAgreement.royaltyBasis,
          perStudentFee:
            createForm.initialAgreement.calculationMethod === 'PER_STUDENT'
              ? Number(createForm.initialAgreement.perStudentFee)
              : undefined,
          dueDay: Number(createForm.initialAgreement.dueDay),
          terms: createForm.initialAgreement.terms,
          notes: createForm.initialAgreement.notes,
        },
      };

      const res = await apiFetch('/franchises', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        showToast('Franchise, Owner Account, and 2 Annual Installments created successfully!', 'success');
        setShowCreateModal(false);
        setCreatedResultModal(res.data);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create franchise', 'error');
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
            Register and manage Franchise Owners, enforce two-installment annual royalty schedules, attach branch campuses, and track verified payments.
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
            <Plus className="w-4 h-4" /> Register Franchise Owner
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
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'franchises'
              ? 'border-[#006FFF] text-[#006FFF]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Franchises & Owners ({franchises.length})
        </button>

        <button
          onClick={() => setActiveTab('installments')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'installments'
              ? 'border-[#006FFF] text-[#006FFF]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" /> 2-Installment Royalty Schedule ({installments.length})
        </button>

        <button
          onClick={() => setActiveTab('agreements')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'agreements'
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
                    <tr key={fr.id} className="hover:bg-slate-50 transition-colors">
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
                        <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-slate-100 text-slate-800">
                          {fr.branches?.length || 0} Branch(es)
                        </span>
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
                          onClick={() => {
                            setSelectedFranchiseForBranch(fr);
                            setShowAddBranchModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-all"
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
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                agr.status === 'ACTIVE'
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

      {/* ============================================================= */}
      {/* MODAL 1: REGISTER FRANCHISE OWNER                             */}
      {/* ============================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl my-8 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register Franchise Owner</h3>
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

              {/* Section 3: Annual Agreement & 2-Installment Royalty */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b pb-1">
                  3. Annual Master Agreement & Royalty Calculation Basis
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

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Royalty Calculation Method *</label>
                    <select
                      value={createForm.initialAgreement.calculationMethod}
                      onChange={(e: any) =>
                        setCreateForm({
                          ...createForm,
                          initialAgreement: { ...createForm.initialAgreement, calculationMethod: e.target.value },
                        })
                      }
                      className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#006FFF]"
                    >
                      <option value="FIXED_ANNUAL">Fixed Annual Fee (Split into 2 Equal Installments)</option>
                      <option value="PERCENTAGE_REVENUE">Percentage of Gross Revenue (50/50 Split)</option>
                      <option value="PER_STUDENT">Per Enrolled Active Student</option>
                    </select>
                  </div>

                  {createForm.initialAgreement.calculationMethod === 'FIXED_ANNUAL' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Annual Agreed Royalty Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="200000"
                        value={createForm.initialAgreement.annualRoyaltyAmount}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            initialAgreement: {
                              ...createForm.initialAgreement,
                              annualRoyaltyAmount: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Will generate 2 installments of ₹{(Number(createForm.initialAgreement.annualRoyaltyAmount) / 2).toLocaleString('en-IN')} each.
                      </span>
                    </div>
                  )}

                  {createForm.initialAgreement.calculationMethod === 'PERCENTAGE_REVENUE' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Royalty Percentage (%) *</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={createForm.initialAgreement.royaltyPercentage}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            initialAgreement: {
                              ...createForm.initialAgreement,
                              royaltyPercentage: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                  )}

                  {createForm.initialAgreement.calculationMethod === 'PER_STUDENT' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700">Fee Per Student (₹ / yr) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={createForm.initialAgreement.perStudentFee}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            initialAgreement: {
                              ...createForm.initialAgreement,
                              perStudentFee: Number(e.target.value),
                            },
                          })
                        }
                        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#006FFF]"
                      />
                    </div>
                  )}
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
                  Create Franchise & Generate 2 Installments
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
                    Hand this temporary password securely to the franchise owner. They will be prompted to update it upon sign in.
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
      {/* MODAL 7: ADD BRANCH CAMPUS (SUPER ADMIN ONLY)                 */}
      {/* ============================================================= */}
      {showAddBranchModal && selectedFranchiseForBranch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Attach Branch Campus</h3>
                <p className="text-xs text-slate-500">Franchise: {selectedFranchiseForBranch.name}</p>
              </div>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                  Attach Branch Campus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

