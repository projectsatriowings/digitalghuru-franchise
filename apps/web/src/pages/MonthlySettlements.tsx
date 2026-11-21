import React, { useState, useEffect } from 'react';
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
    pendingApprovalCount: 0,
    approvedAmount: 0,
    completedAmount: 0,
  });

  // Filters
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [franchisesList, setFranchisesList] = useState<any[]>([]);

  // Detailed Modal
  const [activeSettlement, setActiveSettlement] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Generation Modal
  const [showGenModal, setShowGenModal] = useState<boolean>(false);
  const [genMonth, setGenMonth] = useState<string>(currentMonthStr);
  const [genFranchiseId, setGenFranchiseId] = useState<string>('ALL');
  const [generating, setGenerating] = useState<boolean>(false);

  // Transfer Confirmation Modal
  const [showTransferConfirmModal, setShowTransferConfirmModal] = useState<boolean>(false);
  const [initiatingTransfers, setInitiatingTransfers] = useState<boolean>(false);

  // Direct Bank Transfer Modal
  const [showDirectTransferModal, setShowDirectTransferModal] = useState<boolean>(false);
  const [directTxRef, setDirectTxRef] = useState<string>('');
  const [directReceiptUrl, setDirectReceiptUrl] = useState<string>('');
  const [directNotes, setDirectNotes] = useState<string>('');
  const [submittingDirect, setSubmittingDirect] = useState<boolean>(false);

  // Adjustment Modal
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [adjType, setAdjType] = useState<string>('POST_SETTLEMENT_REFUND');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>('');
  const [submittingAdj, setSubmittingAdj] = useState<boolean>(false);

  // Action Reason Modal (for Reject / On Hold)
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'ON_HOLD' | 'REJECTED' | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Load franchises for dropdown filter
  const loadFranchises = async () => {
    try {
      const res = await apiFetch('/franchises');
      if (res.success && Array.isArray(res.data)) {
        setFranchisesList(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load settlements list
  const loadSettlements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== 'ALL') params.append('settlementMonth', selectedMonth);
      if (selectedFranchiseId && selectedFranchiseId !== 'ALL') params.append('franchiseId', selectedFranchiseId);
      if (selectedStatus && selectedStatus !== 'ALL') params.append('status', selectedStatus);

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
  }, [selectedMonth, selectedFranchiseId, selectedStatus]);

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
        body: JSON.stringify({ notes: 'Approved by Super Admin' }),
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

  const handleInitiateTransfers = async () => {
    if (!activeSettlement) return;
    try {
      setInitiatingTransfers(true);
      const res = await apiFetch(`/settlements/${activeSettlement.id}/transfers/initiate`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      if (res.success) {
        showToast(res.message || 'Transfers processed successfully', 'success');
        setShowTransferConfirmModal(false);
        loadSettlements();
        openSettlementDetail(activeSettlement.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Transfer initiation failed', 'error');
    } finally {
      setInitiatingTransfers(false);
    }
  };

  const handleDirectPayout = async () => {
    if (!activeSettlement || !directTxRef.trim()) return;
    try {
      setSubmittingDirect(true);
      const res = await apiFetch(`/settlements/${activeSettlement.id}/transfers/direct`, {
        method: 'POST',
        body: JSON.stringify({
          transactionReference: directTxRef.trim(),
          bankReceiptUrl: directReceiptUrl.trim() || undefined,
          notes: directNotes.trim() || undefined,
        }),
      });
      if (res.success) {
        showToast('Direct bank payout recorded successfully', 'success');
        setShowDirectTransferModal(false);
        setDirectTxRef('');
        setDirectReceiptUrl('');
        setDirectNotes('');
        loadSettlements();
        openSettlementDetail(activeSettlement.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Direct payout recording failed', 'error');
    } finally {
      setSubmittingDirect(false);
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
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 animate-pulse">
            <RotateCw className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Approval
          </span>
        );
      case 'PARTIALLY_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Partially Failed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Lock className="w-3.5 h-3.5" /> On Hold
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
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
              Payment Management
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">Asia/Kolkata Calendar</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-display mt-1 tracking-tight">
            Monthly Franchise Settlements
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Super Admin approval-based revenue settlements & Razorpay Route transfers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-sm shadow-md shadow-[#006FFF]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Generate Settlements
          </button>
          <button
            onClick={loadSettlements}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Financial Metric Cards */}
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
          <span className="text-[11px] text-slate-400 mt-0.5 block">Franchise share pool</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">DigitalGhuru Share</span>
          <span className="text-lg font-black text-emerald-600 mt-1 block">
            ₹{summary.totalDgShare?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Platform revenue</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 block uppercase tracking-wider">Pending Approval</span>
          <span className="text-lg font-black text-amber-900 mt-1 block">
            {summary.pendingApprovalCount || 0}
          </span>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Requires review</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-sm">
          <span className="text-xs font-semibold text-blue-700 block uppercase tracking-wider">Approved Amount</span>
          <span className="text-lg font-black text-blue-900 mt-1 block">
            ₹{summary.approvedAmount?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-blue-600 mt-0.5 block">Ready for transfer</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 block uppercase tracking-wider">Completed Payouts</span>
          <span className="text-lg font-black text-emerald-900 mt-1 block">
            ₹{summary.completedAmount?.toLocaleString('en-IN') || '0'}
          </span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Transferred successfully</span>
        </div>
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

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="PARTIALLY_FAILED">Partially Failed</option>
              <option value="FAILED">Failed</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="REJECTED">Rejected</option>
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
                <th className="px-4 py-3.5">DG Share</th>
                <th className="px-4 py-3.5">Beneficiary</th>
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
                settlements.map((s) => (
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
                      ₹{Number(s.franchisePayableAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      ₹{Number(s.digitalGuruShareAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      {s.transferEligibility ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(s.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openSettlementDetail(s.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                          Review
                        </button>
                        {s.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => handleApproveSettlement(s.id)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED SETTLEMENT AUDIT MODAL (SECTION F) */}
      {/* ========================================================================= */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
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
                  Loading transaction-level breakdown...
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
                      <span className="text-[11px] font-semibold text-blue-700 block uppercase">Franchise Payable ({Number(activeSettlement.applicableFranchisePercentage)}%)</span>
                      <span className="text-base font-black text-[#006FFF] mt-0.5 block">
                        ₹{Number(activeSettlement.franchisePayableAmount).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-blue-600 block">Payable to beneficiary</span>
                    </div>

                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-semibold text-emerald-700 block uppercase">DigitalGhuru Share ({Number(activeSettlement.applicableDigitalGuruPercentage)}%)</span>
                      <span className="text-base font-black text-emerald-800 mt-0.5 block">
                        ₹{Number(activeSettlement.digitalGuruShareAmount).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-emerald-600 block">Retained platform fees</span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-500 block uppercase">Approval Audit</span>
                      <span className="text-xs font-bold text-slate-900 mt-1 block">
                        {activeSettlement.approvedBy?.fullName || 'Pending Review'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {activeSettlement.approvedAt ? new Date(activeSettlement.approvedAt).toLocaleString('en-IN') : 'Not approved yet'}
                      </span>
                    </div>
                  </div>

                  {/* Beneficiary Information Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Approved Beneficiary Account (Route Transfers)
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
                            {activeSettlement.franchise?.beneficiaryAccountNumber ? `****${activeSettlement.franchise.beneficiaryAccountNumber.slice(-4)}` : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">IFSC:</span>{' '}
                          <span className="font-mono font-bold">{activeSettlement.franchise?.beneficiaryIfsc || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Linked Account ID:</span>{' '}
                          <span className="font-mono font-bold text-[#006FFF]">
                            {activeSettlement.franchise?.razorpayAccountId || 'None'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {activeSettlement.transferEligibility ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                          Eligible for Transfer
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300">
                          Transfer Ineligible: Account Unverified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transaction-Level Breakdown Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">
                        Captured Payments Included in Statement ({activeSettlement.payments?.length || 0})
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">Authoritative Gateway Records</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">Date (IST)</th>
                            <th className="px-3 py-2.5">Receipt #</th>
                            <th className="px-3 py-2.5">Gateway Payment ID</th>
                            <th className="px-3 py-2.5">Student</th>
                            <th className="px-3 py-2.5">Branch Campus</th>
                            <th className="px-3 py-2.5">Gross Paid</th>
                            <th className="px-3 py-2.5">Franchise %</th>
                            <th className="px-3 py-2.5">Franchise Share</th>
                            <th className="px-3 py-2.5">Transfer Status</th>
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
                                  {new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
                                    p.transferStatus === 'PROCESSED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : p.transferStatus === 'FAILED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {p.transferStatus || 'PENDING'}
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
                {activeSettlement?.status === 'APPROVED' && (
                  <button
                    onClick={() => setShowAdjustmentModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Adjustment
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeSettlement?.status === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      onClick={() => {
                        setActionType('ON_HOLD');
                        setShowActionModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                    >
                      Put On Hold
                    </button>
                    <button
                      onClick={() => {
                        setActionType('REJECTED');
                        setShowActionModal(true);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs hover:bg-rose-100 transition-colors"
                    >
                      Reject Settlement
                    </button>
                    <button
                      onClick={() => handleApproveSettlement(activeSettlement.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                    >
                      Approve Settlement
                    </button>
                  </>
                )}

                {(activeSettlement?.status === 'APPROVED' || activeSettlement?.status === 'PARTIALLY_FAILED') && (
                  <>
                    <button
                      onClick={() => setShowDirectTransferModal(true)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                      title="Direct Bank Payout alternative"
                    >
                      Direct Bank Payout
                    </button>
                    <button
                      onClick={() => setShowTransferConfirmModal(true)}
                      disabled={!activeSettlement.transferEligibility}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-sm ${
                        activeSettlement.transferEligibility
                          ? 'bg-[#006FFF] hover:bg-[#0057CC] cursor-pointer'
                          : 'bg-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" /> Approve & Initiate Route Transfer
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GENERATE SETTLEMENTS MODAL */}
      {/* ========================================================================= */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                  {franchisesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} - {f.name}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPLICIT TRANSFER CONFIRMATION MODAL (SECTION F & G) */}
      {/* ========================================================================= */}
      {showTransferConfirmModal && activeSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#006FFF] flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Confirm Route Transfer Initiation</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to initiate real transfers of{' '}
                <strong className="text-slate-900 font-bold">
                  ₹{Number(activeSettlement.franchisePayableAmount).toLocaleString('en-IN')}
                </strong>{' '}
                to Linked Account{' '}
                <strong className="font-mono text-[#006FFF]">
                  {activeSettlement.franchise?.razorpayAccountId}
                </strong>{' '}
                for {activeSettlement.statementNumber}.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs">
              <strong>Financial Safeguard:</strong> Transfers are executed against each captured payment with idempotency keys. Double transfers are prevented.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={initiatingTransfers}
                onClick={handleInitiateTransfers}
                className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-[#006FFF]/20"
              >
                {initiatingTransfers ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Yes, Authorize Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT BANK PAYOUT MODAL */}
      {/* ========================================================================= */}
      {showDirectTransferModal && activeSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Record Direct Bank Payout</h3>
              <button onClick={() => setShowDirectTransferModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500">
              Record a direct bank transfer (NEFT/RTGS/IMPS) when Razorpay Route is not used. Marks the statement COMPLETED.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Reference / UTR Number *</label>
                <input
                  type="text"
                  placeholder="e.g. CMS123456789012"
                  value={directTxRef}
                  onChange={(e) => setDirectTxRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Receipt / Proof URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={directReceiptUrl}
                  onChange={(e) => setDirectReceiptUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Settled via HDFC Corporate Banking"
                  value={directNotes}
                  onChange={(e) => setDirectNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDirectTransferModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDirect || !directTxRef.trim()}
                onClick={handleDirectPayout}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {submittingDirect ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm Direct Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDITABLE ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      {showAdjustmentModal && activeSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATUS ACTION REASON MODAL (ON_HOLD / REJECT) */}
      {/* ========================================================================= */}
      {showActionModal && activeSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {actionType === 'ON_HOLD' ? 'Put Settlement On Hold' : 'Reject Settlement Statement'}
              </h3>
              <button onClick={() => setShowActionModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Reason / Notes *</label>
              <textarea
                rows={3}
                placeholder="State the reason for this action..."
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
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm ${
                  actionType === 'REJECTED' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'
                }`}
              >
                {submittingAction ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirm {actionType === 'ON_HOLD' ? 'Hold' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MonthlySettlements;
