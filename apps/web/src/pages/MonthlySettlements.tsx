import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Printer,
  X,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  Send,
  DollarSign,
  Plus,
  ChevronDown,
  Info,
  ExternalLink,
  Lock,
  Download,
} from 'lucide-react';

export const MonthlySettlements: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    count: 0,
    totalEligibleCollections: 0,
    totalFranchisePayable: 0,
    totalDgShare: 0,
    totalTransferredAmount: 0,
    totalRemainingBalance: 0,
    pendingApprovalCount: 0,
    approvedAmount: 0,
    partiallyPaidCount: 0,
    completedAmount: 0,
  });

  // Filters & Tabs
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PARTIAL' | 'PAID' | 'HOLD'>('ALL');
  const [franchisesList, setFranchisesList] = useState<any[]>([]);
  const [loadingFranchises, setLoadingFranchises] = useState<boolean>(false);

  // Detailed Audit Modal
  const [activeSettlement, setActiveSettlement] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Statement Generation Modal
  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [genMonth, setGenMonth] = useState<string>(currentMonthStr);
  const [genFranchiseId, setGenFranchiseId] = useState<string>('ALL');
  const [generating, setGenerating] = useState<boolean>(false);

  // Manual Bank Transfer Modal
  const [showManualTransferModal, setShowManualTransferModal] = useState<boolean>(false);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferDate, setTransferDate] = useState<string>('');
  const [transferMethod, setTransferMethod] = useState<'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'OTHER'>('NEFT');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [recipientBankName, setRecipientBankName] = useState<string>('');
  const [recipientAccountLast4, setRecipientAccountLast4] = useState<string>('');
  const [recipientIfsc, setRecipientIfsc] = useState<string>('');
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');
  const [transferRemarks, setTransferRemarks] = useState<string>('');
  const [submittingTransfer, setSubmittingTransfer] = useState<boolean>(false);

  // Adjustment Modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [adjType, setAdjType] = useState<string>('POST_SETTLEMENT_REFUND');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>('');
  const [submittingAdj, setSubmittingAdj] = useState<boolean>(false);

  // Action Reason Modal (for Reject / On Hold)
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'ON_HOLD' | 'REJECTED' | 'CANCELLED' | 'PENDING_APPROVAL' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Load franchises for dropdown filter
  const loadFranchises = async () => {
    try {
      setLoadingFranchises(true);
      const res = await apiFetch<any>('/franchises', { skipCache: true });
      if (res && res.success) {
        const list = Array.isArray(res.data?.franchises)
          ? res.data.franchises
          : Array.isArray(res.data)
          ? res.data
          : [];
        setFranchisesList(list);
      }
    } catch (err) {
      console.error('Failed to load franchises for settlements:', err);
    } finally {
      setLoadingFranchises(false);
    }
  };

  // Load settlements list
  const loadSettlements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== 'ALL') params.append('settlementMonth', selectedMonth);
      if (selectedFranchiseId && selectedFranchiseId !== 'ALL') params.append('franchiseId', selectedFranchiseId);

      // Status resolution based on tab or dropdown
      let statusToQuery = selectedStatus;
      if (activeTab === 'PENDING') statusToQuery = 'PENDING_APPROVAL';
      else if (activeTab === 'APPROVED') statusToQuery = 'APPROVED';
      else if (activeTab === 'PARTIAL') statusToQuery = 'PARTIALLY_PAID';
      else if (activeTab === 'PAID') statusToQuery = 'PAID';
      else if (activeTab === 'HOLD') statusToQuery = 'ON_HOLD';

      if (statusToQuery && statusToQuery !== 'ALL') params.append('status', statusToQuery);

      const res = await apiFetch(`/settlements?${params.toString()}`);
      if (res.success && res.data) {
        setSettlements(res.data.settlements || []);
        setSummary(res.data.summary || {});
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load settlements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFranchises();
  }, []);

  useEffect(() => {
    loadSettlements();
  }, [selectedMonth, selectedFranchiseId, selectedStatus, activeTab]);

  const openSettlementDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      setShowDetailModal(true);
      const res = await apiFetch(`/settlements/${id}`);
      if (res.success && res.data) {
        setActiveSettlement(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load settlement details', 'error');
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApproveSettlement = async (id: string) => {
    try {
      const res = await apiFetch(`/settlements/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved by Super Admin for manual bank transfer' }),
      });
      if (res.success) {
        showToast('Settlement approved successfully', 'success');
        loadSettlements();
        if (activeSettlement?.id === id) {
          openSettlementDetail(id);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Approval failed', 'error');
    }
  };

  const handleUpdateStatus = async () => {
    if (!activeSettlement || !actionType || !actionReason.trim()) return;
    try {
      setSubmittingAction(true);
      const res = await apiFetch(`/settlements/${activeSettlement.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: actionType, reason: actionReason.trim() }),
      });
      if (res.success) {
        showToast(`Settlement status updated to ${actionType}`, 'success');
        setShowActionModal(false);
        setActionReason('');
        loadSettlements();
        openSettlementDetail(activeSettlement.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const openManualTransferModal = (settlement: any) => {
    setActiveSettlement(settlement);
    const payable = Number(settlement.franchisePayableAmount);
    const transferred = Number(settlement.totalTransferredAmount || 0);
    const remaining = Number(
      settlement.remainingPayableAmount !== null && Number(settlement.remainingPayableAmount) >= 0
        ? settlement.remainingPayableAmount
        : Math.max(0, payable - transferred)
    );

    setTransferAmount(remaining > 0 ? remaining : payable);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferMethod('NEFT');
    setUtrNumber('');
    setRecipientBankName(settlement.franchise?.beneficiaryBankName || '');
    setRecipientAccountLast4(
      settlement.franchise?.beneficiaryAccountNumber
        ? settlement.franchise.beneficiaryAccountNumber.slice(-4)
        : ''
    );
    setRecipientIfsc(settlement.franchise?.beneficiaryIfsc || '');
    setPaymentProofUrl('');
    setTransferRemarks('');
    setShowManualTransferModal(true);
  };

  const handleRecordManualTransfer = async () => {
    if (!activeSettlement) return;
    if (transferAmount <= 0) {
      showToast('Transfer amount must be greater than zero', 'warning');
      return;
    }
    if (!utrNumber.trim()) {
      showToast('Bank transaction reference / UTR number is required', 'warning');
      return;
    }

    try {
      setSubmittingTransfer(true);
      const res = await apiFetch(`/settlements/${activeSettlement.id}/transfers/manual`, {
        method: 'POST',
        body: JSON.stringify({
          amount: transferAmount,
          transferDate: transferDate || undefined,
          transferMethod,
          utrNumber: utrNumber.trim(),
          recipientBankName: recipientBankName.trim() || undefined,
          recipientAccountLast4: recipientAccountLast4.trim() || undefined,
          recipientIfsc: recipientIfsc.trim().toUpperCase() || undefined,
          paymentProofUrl: paymentProofUrl.trim() || undefined,
          remarks: transferRemarks.trim() || undefined,
          status: 'VERIFIED',
        }),
      });

      if (res.success) {
        showToast(res.message || 'Manual bank transfer recorded successfully', 'success');
        setShowManualTransferModal(false);
        loadSettlements();
        openSettlementDetail(activeSettlement.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to record bank transfer', 'error');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!activeSettlement || adjAmount <= 0 || !adjReason.trim()) return;
    try {
      setSubmittingAdj(true);
      const res = await apiFetch(`/settlements/${activeSettlement.id}/adjustments`, {
        method: 'POST',
        body: JSON.stringify({
          adjustmentType: adjType,
          amount: adjAmount,
          reason: adjReason.trim(),
        }),
      });
      if (res.success) {
        showToast('Auditable adjustment recorded', 'success');
        setShowAdjustmentModal(false);
        setAdjAmount(0);
        setAdjReason('');
        loadSettlements();
        openSettlementDetail(activeSettlement.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add adjustment', 'error');
    } finally {
      setSubmittingAdj(false);
    }
  };

  const handleGenerateStatements = async () => {
    try {
      setGenerating(true);
      const res = await apiFetch('/settlements/generate', {
        method: 'POST',
        body: JSON.stringify({
          settlementMonth: genMonth,
          franchiseId: genFranchiseId !== 'ALL' ? genFranchiseId : undefined,
          autoSubmit: true,
        }),
      });
      if (res.success) {
        showToast(res.message || 'Settlements generated successfully', 'success');
        setShowGenModal(false);
        setSelectedMonth(genMonth);
        loadSettlements();
      }
    } catch (err: any) {
      showToast(err.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Clock className="w-3.5 h-3.5" /> Partially Paid
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'PENDING_APPROVAL':
      case 'PENDING_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Lock className="w-3.5 h-3.5" /> On Hold
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#006FFF]/10 text-[#006FFF]">
              Payment & Settlement Operations
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Manual Monthly Bank Transfers</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-display mt-1 tracking-tight">
            Monthly Franchise Settlements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Super Admin monthly statement review, approvals, and manual bank transfer recording (NEFT / RTGS / IMPS).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (franchisesList.length === 0) {
                loadFranchises();
              }
              setShowGenModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-sm shadow-md shadow-[#006FFF]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Generate Settlements
          </button>
          <button
            onClick={() => {
              loadSettlements();
              loadFranchises();
            }}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Eligible Collections</span>
          <span className="text-lg font-black text-slate-900 mt-1 block">
            ₹{summary.totalEligibleCollections?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">{summary.count || 0} statements</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Franchise Payable</span>
          <span className="text-lg font-black text-[#006FFF] mt-1 block">
            ₹{summary.totalFranchisePayable?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Total franchise share</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">DigitalGhuru Share</span>
          <span className="text-lg font-black text-emerald-600 mt-1 block">
            ₹{summary.totalDgShare?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Retained platform fee</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 block uppercase tracking-wider">Pending Review</span>
          <span className="text-lg font-black text-amber-900 mt-1 block">
            {summary.pendingApprovalCount || 0}
          </span>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Awaiting approval</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm">
          <span className="text-xs font-semibold text-blue-700 block uppercase tracking-wider">Approved Payable</span>
          <span className="text-lg font-black text-blue-900 mt-1 block">
            ₹{summary.totalRemainingBalance?.toLocaleString('en-IN') || summary.approvedAmount?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-blue-600 mt-0.5 block">Ready for bank transfer</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 block uppercase tracking-wider">Transferred Payouts</span>
          <span className="text-lg font-black text-emerald-900 mt-1 block">
            ₹{summary.totalTransferredAmount?.toLocaleString('en-IN') || summary.completedAmount?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Transferred via bank</span>
        </div>
      </div>

      {/* Quick Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Statements
        </button>
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'PENDING'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Pending Review
          {summary.pendingApprovalCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {summary.pendingApprovalCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'APPROVED'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Approved (Awaiting Transfer)
        </button>
        <button
          onClick={() => setActiveTab('PARTIAL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'PARTIAL'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Partially Paid
        </button>
        <button
          onClick={() => setActiveTab('PAID')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'PAID'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Fully Paid
        </button>
        <button
          onClick={() => setActiveTab('HOLD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'HOLD'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          On Hold / Cancelled
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
          </div>

          {/* Franchise Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Franchise:</span>
            <select
              value={selectedFranchiseId}
              onChange={(e) => setSelectedFranchiseId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 max-w-[220px]"
            >
              <option value="ALL">All Franchises</option>
              {franchisesList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} - {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing {settlements.length} statements
        </span>
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Statement #</th>
                <th className="px-4 py-3.5">Franchise</th>
                <th className="px-4 py-3.5">Period</th>
                <th className="px-4 py-3.5">Collections</th>
                <th className="px-4 py-3.5">Refunds</th>
                <th className="px-4 py-3.5">Split %</th>
                <th className="px-4 py-3.5">Franchise Share</th>
                <th className="px-4 py-3.5">Transferred</th>
                <th className="px-4 py-3.5">Remaining</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#006FFF]" />
                    Loading monthly statements...
                  </td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No settlements found matching the selected filters.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => {
                  const payable = Number(s.franchisePayableAmount);
                  const transferred = Number(s.totalTransferredAmount || 0);
                  const remaining = Number(
                    s.remainingPayableAmount !== null && Number(s.remainingPayableAmount) >= 0
                      ? s.remainingPayableAmount
                      : Math.max(0, payable - transferred)
                  );
                  const isEligibleForTransfer =
                    (s.status === 'APPROVED' || s.status === 'PARTIALLY_PAID') && remaining > 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {s.statementNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.franchise?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{s.franchise?.code}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold">{s.settlementMonth}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(s.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {new Date(s.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        ₹{Number(s.totalCapturedPayments).toLocaleString('en-IN')}
                        <span className="block text-[10px] text-slate-400 font-normal">{s.transactionCount} txns</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(s.refundDeductions) > 0 ? (
                          <span className="text-rose-600 font-semibold">-₹{Number(s.refundDeductions).toLocaleString('en-IN')}</span>
                        ) : (
                          '₹0'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#006FFF]">{Number(s.applicableFranchisePercentage)}%</span>
                        <span className="text-slate-400"> / {Number(s.applicableDigitalGuruPercentage)}%</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        ₹{payable.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        ₹{transferred.toLocaleString('en-IN')}
                        {s.bankTransfers && s.bankTransfers.length > 0 && (
                          <span className="block text-[10px] text-emerald-600 font-normal">
                            {s.bankTransfers.length} transfer{s.bankTransfers.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {remaining > 0 ? (
                          <span className="text-blue-700 font-bold">₹{remaining.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-emerald-700 font-bold">₹0 (Settled)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {renderStatusBadge(s.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openSettlementDetail(s.id)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                          {(s.status === 'PENDING_APPROVAL' || s.status === 'PENDING_REVIEW') && (
                            <button
                              onClick={() => handleApproveSettlement(s.id)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {isEligibleForTransfer && (
                            <button
                              onClick={() => openManualTransferModal(s)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#006FFF] hover:bg-[#0057CC] text-white transition-colors cursor-pointer"
                              title="Record manual bank transfer"
                            >
                              Record Transfer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED SETTLEMENT AUDIT MODAL */}
      {/* ========================================================================= */}
      {showDetailModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-black text-[#006FFF]">
                    {activeSettlement?.statementNumber}
                  </span>
                  {activeSettlement && renderStatusBadge(activeSettlement.status)}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {activeSettlement?.franchise?.name} ({activeSettlement?.franchise?.code})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculation Period: {activeSettlement?.startDate?.split('T')[0]} to {activeSettlement?.endDate?.split('T')[0]} (Asia/Kolkata Calendar)
                </p>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {loadingDetail ? (
                <div className="py-16 text-center text-slate-400">
                  <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#006FFF]" />
                  Loading statement details...
                </div>
              ) : activeSettlement && (
                <>
                  {/* Summary Metric Boxes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block uppercase">Eligible Collections</span>
                      <span className="text-base font-black text-slate-900 mt-0.5 block">
                        ₹{Number(activeSettlement.totalEligibleCollections).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{activeSettlement.transactionCount} transactions</span>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
                      <span className="text-[11px] font-semibold text-blue-700 block uppercase">
                        Franchise Share ({Number(activeSettlement.applicableFranchisePercentage)}%)
                      </span>
                      <span className="text-base font-black text-[#006FFF] mt-0.5 block">
                        ₹{Number(activeSettlement.franchisePayableAmount).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-blue-600 block">Total approved share</span>
                    </div>

                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-semibold text-emerald-700 block uppercase">Transferred Amount</span>
                      <span className="text-base font-black text-emerald-800 mt-0.5 block">
                        ₹{Number(activeSettlement.totalTransferredAmount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-emerald-600 block">
                        {activeSettlement.bankTransfers?.length || 0} manual transfer{activeSettlement.bankTransfers?.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="text-[11px] font-semibold text-amber-700 block uppercase">Remaining Balance</span>
                      <span className="text-base font-black text-amber-900 mt-0.5 block">
                        ₹{Number(
                          activeSettlement.remainingPayableAmount !== null && Number(activeSettlement.remainingPayableAmount) >= 0
                            ? activeSettlement.remainingPayableAmount
                            : Math.max(0, Number(activeSettlement.franchisePayableAmount) - Number(activeSettlement.totalTransferredAmount || 0))
                        ).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-amber-700 block">
                        {Number(activeSettlement.remainingPayableAmount || 0) <= 0 && activeSettlement.status === 'PAID'
                          ? 'Fully Settled'
                          : 'Due for bank transfer'}
                      </span>
                    </div>
                  </div>

                  {/* Beneficiary Information Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Franchise Bank Transfer Beneficiary Account
                      </span>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700">
                        <div>
                          <span className="text-slate-400">Beneficiary:</span>{' '}
                          <span className="font-bold">{activeSettlement.franchise?.beneficiaryName || 'Not configured'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Bank:</span>{' '}
                          <span className="font-bold">{activeSettlement.franchise?.beneficiaryBankName || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Account:</span>{' '}
                          <span className="font-mono font-bold">
                            {activeSettlement.franchise?.beneficiaryAccountNumber
                              ? `****${activeSettlement.franchise.beneficiaryAccountNumber.slice(-4)}`
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">IFSC:</span>{' '}
                          <span className="font-mono font-bold">{activeSettlement.franchise?.beneficiaryIfsc || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {activeSettlement.transferEligibility ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                          Beneficiary Details Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300">
                          Beneficiary Details Incomplete
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recorded Manual Bank Transfers Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        Recorded Manual Bank Transfers ({activeSettlement.bankTransfers?.length || 0})
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">DigitalGhuru Bank Transfer Audits</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Method</th>
                            <th className="px-3 py-2.5">Bank Reference / UTR</th>
                            <th className="px-3 py-2.5">Amount Transferred</th>
                            <th className="px-3 py-2.5">Recipient Bank Account</th>
                            <th className="px-3 py-2.5">Recorded By</th>
                            <th className="px-3 py-2.5">Receipt Proof</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {!activeSettlement.bankTransfers || activeSettlement.bankTransfers.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-slate-400">
                                No manual bank transfers recorded yet for this statement.
                              </td>
                            </tr>
                          ) : (
                            activeSettlement.bankTransfers.map((trf: any) => (
                              <tr key={trf.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 text-slate-600">
                                  {new Date(trf.transferDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                  {trf.transferMethod}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-blue-700">
                                  {trf.utrNumber}
                                </td>
                                <td className="px-3 py-2 font-black text-slate-900">
                                  ₹{Number(trf.amount).toLocaleString('en-IN')}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {trf.recipientBankName || '—'}{' '}
                                  {trf.recipientAccountLast4 ? `(****${trf.recipientAccountLast4})` : ''}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {trf.recordedBy?.fullName || 'Super Admin'}
                                </td>
                                <td className="px-3 py-2">
                                  {trf.paymentProofUrl ? (
                                    <a
                                      href={trf.paymentProofUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[#006FFF] hover:underline font-semibold"
                                    >
                                      View Proof <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    trf.status === 'VERIFIED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {trf.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transaction-Level Breakdown Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">
                        Captured Student Payments Included ({activeSettlement.payments?.length || 0})
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">Authoritative Gateway Records</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5">Date (IST)</th>
                            <th className="px-3 py-2.5">Receipt #</th>
                            <th className="px-3 py-2.5">Gateway Payment ID</th>
                            <th className="px-3 py-2.5">Student</th>
                            <th className="px-3 py-2.5">Branch Campus</th>
                            <th className="px-3 py-2.5">Gross Paid</th>
                            <th className="px-3 py-2.5">Franchise %</th>
                            <th className="px-3 py-2.5">Franchise Share</th>
                            <th className="px-3 py-2.5">Payment Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeSettlement.payments?.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-6 text-center text-slate-400">
                                No captured payments included in this monthly settlement period.
                              </td>
                            </tr>
                          ) : (
                            activeSettlement.payments?.map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 text-slate-600">
                                  {new Date(p.paidAt).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{p.receiptNumber}</td>
                                <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{p.gatewayPaymentId || p.transactionReference || '—'}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">
                                  {p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student'}
                                  <span className="block text-[10px] text-slate-400 font-mono">{p.student?.admissionNumber}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{p.institute?.name || 'Main Center'}</td>
                                <td className="px-3 py-2 font-bold text-slate-900">₹{Number(p.amountPaid).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 font-semibold text-[#006FFF]">
                                  {p.franchisePercentage !== null ? `${Number(p.franchisePercentage)}%` : `${Number(activeSettlement.applicableFranchisePercentage)}%`}
                                </td>
                                <td className="px-3 py-2 font-bold text-slate-900">
                                  ₹{Number(p.franchiseShareAmount || (Number(p.amountPaid) * (Number(activeSettlement.applicableFranchisePercentage) / 100))).toLocaleString('en-IN')}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    p.status === 'SUCCESS' || p.status === 'CAPTURED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : p.status === 'REFUNDED'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {p.status || 'SUCCESS'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Auditable Adjustments Section */}
                  {activeSettlement.adjustments && activeSettlement.adjustments.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-900 text-sm">Post-Approval Auditable Adjustments</h3>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Amount</th>
                              <th className="px-3 py-2">Reason</th>
                              <th className="px-3 py-2">Authorized By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeSettlement.adjustments.map((a: any) => (
                              <tr key={a.id}>
                                <td className="px-3 py-2 text-slate-500">{new Date(a.createdAt).toLocaleDateString('en-IN')}</td>
                                <td className="px-3 py-2 font-mono font-bold">{a.adjustmentType}</td>
                                <td className="px-3 py-2 font-bold text-rose-600">₹{Number(a.amount).toLocaleString('en-IN')}</td>
                                <td className="px-3 py-2 text-slate-700">{a.reason}</td>
                                <td className="px-3 py-2 text-slate-600">{a.authorizedBy?.fullName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Download / Print Statement
                </button>
                {(activeSettlement?.status === 'APPROVED' || activeSettlement?.status === 'PARTIALLY_PAID') && (
                  <button
                    onClick={() => setShowAdjustmentModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Adjustment
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {(activeSettlement?.status === 'PENDING_APPROVAL' || activeSettlement?.status === 'PENDING_REVIEW') && (
                  <>
                    <button
                      onClick={() => {
                        setActionType('ON_HOLD');
                        setShowActionModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Put On Hold
                    </button>
                    <button
                      onClick={() => {
                        setActionType('CANCELLED');
                        setShowActionModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Cancel Statement
                    </button>
                    <button
                      onClick={() => handleApproveSettlement(activeSettlement.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      Approve Settlement
                    </button>
                  </>
                )}

                {(activeSettlement?.status === 'APPROVED' || activeSettlement?.status === 'PARTIALLY_PAID') && (
                  <button
                    onClick={() => openManualTransferModal(activeSettlement)}
                    disabled={Number(activeSettlement.remainingPayableAmount || 0) <= 0 && activeSettlement.status === 'PAID'}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Record Bank Transfer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* RECORD MANUAL BANK TRANSFER MODAL */}
      {/* ========================================================================= */}
      {showManualTransferModal && activeSettlement && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" /> Record Manual Bank Transfer
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Record official NEFT / RTGS / IMPS payout details to the franchise bank account.
                </p>
              </div>
              <button
                onClick={() => setShowManualTransferModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Settlement Balance Info Banner */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Approved</span>
                <span className="font-bold text-slate-900">
                  ₹{Number(activeSettlement.franchisePayableAmount).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Already Transferred</span>
                <span className="font-bold text-emerald-800">
                  ₹{Number(activeSettlement.totalTransferredAmount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-blue-700 uppercase block font-semibold">Remaining Payable</span>
                <span className="font-black text-blue-900">
                  ₹{Number(
                    activeSettlement.remainingPayableAmount !== null && Number(activeSettlement.remainingPayableAmount) >= 0
                      ? activeSettlement.remainingPayableAmount
                      : Math.max(0, Number(activeSettlement.franchisePayableAmount) - Number(activeSettlement.totalTransferredAmount || 0))
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Transfer Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Supports partial payments</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Transfer Method *</label>
                  <select
                    value={transferMethod}
                    onChange={(e) => setTransferMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium bg-white"
                  >
                    <option value="NEFT">NEFT (National Electronic Funds Transfer)</option>
                    <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                    <option value="IMPS">IMPS (Immediate Payment Service)</option>
                    <option value="UPI">UPI (Corporate Bank Transfer)</option>
                    <option value="OTHER">Other Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bank Reference / UTR Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. CMS123456789012"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Unique transaction reference</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <label className="font-semibold text-slate-500 block text-[10px]">Recipient Bank</label>
                  <input
                    type="text"
                    value={recipientBankName}
                    onChange={(e) => setRecipientBankName(e.target.value)}
                    placeholder="Bank name"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block text-[10px]">Account (Last 4)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={recipientAccountLast4}
                    onChange={(e) => setRecipientAccountLast4(e.target.value)}
                    placeholder="e.g. 5678"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] bg-white font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-500 block text-[10px]">IFSC Code</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={recipientIfsc}
                    onChange={(e) => setRecipientIfsc(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] bg-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Payment Proof / Receipt URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={paymentProofUrl}
                  onChange={(e) => setPaymentProofUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Internal Remarks / Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Transferred via DigitalGhuru primary account..."
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowManualTransferModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingTransfer || transferAmount <= 0 || !utrNumber.trim()}
                onClick={handleRecordManualTransfer}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingTransfer ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Bank Transfer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* GENERATE SETTLEMENTS MODAL */}
      {/* ========================================================================= */}
      {showGenModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 font-display">Generate Monthly Settlements</h3>
              <button onClick={() => setShowGenModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Aggregates all branch student collections for the calendar month (Asia/Kolkata: 1st to last day) and generates auditable statements.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Settlement Month</label>
                <input
                  type="month"
                  value={genMonth}
                  onChange={(e) => setGenMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Franchise Target</label>
                <select
                  value={genFranchiseId}
                  onChange={(e) => setGenFranchiseId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  <option value="ALL">All Active Franchises (Batch Generation)</option>
                  {loadingFranchises && franchisesList.length === 0 && (
                    <option disabled value="">Loading franchises...</option>
                  )}
                  {franchisesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} - {f.name}{f.status && f.status !== 'ACTIVE' ? ` (${f.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateStatements}
                className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                {generating ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Generate Statements
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* AUDITABLE ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {showAdjustmentModal && activeSettlement && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Auditable Adjustment</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Adjustment Type</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                >
                  <option value="POST_SETTLEMENT_REFUND">Post-Settlement Student Refund</option>
                  <option value="MANUAL_CORRECTION">Manual Calculation Correction</option>
                  <option value="DISPUTE_DEDUCTION">Fee Dispute Deduction</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason *</label>
                <textarea
                  rows={2}
                  placeholder="Detailed explanation for audit log..."
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAdj || adjAmount <= 0 || !adjReason.trim()}
                onClick={handleAddAdjustment}
                className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {submittingAdj ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Record Adjustment
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* ACTION REASON MODAL (ON_HOLD / REJECTED / CANCELLED) */}
      {/* ========================================================================= */}
      {showActionModal && activeSettlement && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {actionType === 'ON_HOLD' ? 'Place Settlement On Hold' : 'Cancel Settlement Statement'}
              </h3>
              <button onClick={() => setShowActionModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500">
              Please specify a clear reason for the audit log before updating statement status.
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Reason *</label>
              <textarea
                rows={3}
                placeholder="Reason for audit log..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || !actionReason.trim()}
                onClick={handleUpdateStatus}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                {submittingAction ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MonthlySettlements;
