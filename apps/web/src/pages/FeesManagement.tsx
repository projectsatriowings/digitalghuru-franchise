import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Printer,
  RotateCcw,
  Receipt,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
  Calendar,
  X,
  RefreshCw,
  Building2,
} from 'lucide-react';

export const FeesManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ACADEMIC_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'dashboard' | 'assignments' | 'structures' | 'payments' | 'adjustments'>('dashboard');

  // Dashboard state
  const [summary, setSummary] = useState<any>(null);
  const [collectionsReport, setCollectionsReport] = useState<any>(null);
  const [outstandingReport, setOutstandingReport] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);

  // Fee Structures state
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [loadingStructures, setLoadingStructures] = useState<boolean>(false);
  const [showCreateStructureModal, setShowCreateStructureModal] = useState<boolean>(false);

  // Assignments state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState<boolean>(false);
  const [assignmentSearch, setAssignmentSearch] = useState<string>('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [showBatchAssignModal, setShowBatchAssignModal] = useState<boolean>(false);

  // Payments & Receipts state
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<boolean>(false);
  const [selectedAssignmentForPayment, setSelectedAssignmentForPayment] = useState<any>(null);

  // Refunds state
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<any>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [processingRefund, setProcessingRefund] = useState<boolean>(false);

  // Adjustments state
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState<boolean>(false);

  // Common metadata
  const [batches, setBatches] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  // Form states
  const [newStructure, setNewStructure] = useState({
    batchId: '',
    name: '',
    description: '',
    academicYear: '2026-2027',
    frequency: 'MONTHLY',
    amount: 0,
    dueDay: 10,
  });

  const [newAssignment, setNewAssignment] = useState({
    studentId: '',
    feeStructureId: '',
    termLabel: '',
    academicYear: '2026-2027',
    discountAmount: 0,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
  });

  const [newBatchAssignment, setNewBatchAssignment] = useState({
    batchId: '',
    feeStructureId: '',
    termLabel: '',
    academicYear: '2026-2027',
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    defaultDiscount: 0,
  });

  const [newPayment, setNewPayment] = useState({
    amountPaid: 0,
    method: 'CASH',
    transactionReference: '',
    remarks: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!isAdmin) return;
    loadDashboardData();
    loadBatches();
    loadStudents();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'structures') loadFeeStructures();
    if (activeTab === 'assignments') loadAssignments();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'adjustments') loadAdjustments();
  }, [activeTab, isAdmin]);

  const loadDashboardData = async () => {
    try {
      setLoadingDashboard(true);
      const [sumRes, colRes, outRes] = await Promise.all([
        apiFetch('/fees/reports/summary'),
        apiFetch('/fees/reports/collections'),
        apiFetch('/fees/reports/outstanding'),
      ]);
      if (sumRes.success) setSummary(sumRes.data);
      if (colRes.success) setCollectionsReport(colRes.data);
      if (outRes.success) setOutstandingReport(outRes.data);
    } catch (err: any) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadBatches = async () => {
    try {
      const res = await apiFetch('/academics/batches');
      if (res.success && res.data?.batches) setBatches(res.data.batches);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStudents = async () => {
    try {
      const res = await apiFetch('/students');
      if (res.success && res.data?.students) setStudents(res.data.students);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFeeStructures = async () => {
    try {
      setLoadingStructures(true);
      const res = await apiFetch('/fees/structures');
      if (res.success && res.data?.feeStructures) setFeeStructures(res.data.feeStructures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStructures(false);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoadingAssignments(true);
      let query = '/fees/assignments?limit=100';
      if (assignmentStatusFilter) query += `&status=${assignmentStatusFilter}`;
      const res = await apiFetch(query);
      if (res.success && res.data?.assignments) setAssignments(res.data.assignments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await apiFetch('/fees/payments?limit=100');
      if (res.success && res.data?.payments) setPayments(res.data.payments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPayments(false);
    }
  };

  const loadAdjustments = async () => {
    try {
      setLoadingAdjustments(true);
      const res = await apiFetch('/fees/adjustments?limit=100');
      if (res.success && res.data?.adjustments) setAdjustments(res.data.adjustments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdjustments(false);
    }
  };

  const openReceipt = async (paymentIdOrReceipt: string) => {
    try {
      const res = await apiFetch(`/fees/payments/${paymentIdOrReceipt}/receipt`);
      if (res.success && res.data?.receipt) {
        setActiveReceipt(res.data.receipt);
        setShowReceiptModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch('/fees/structures', {
        method: 'POST',
        body: JSON.stringify(newStructure),
      });
      if (res.success) {
        setActionSuccess('Fee structure created successfully.');
        setShowCreateStructureModal(false);
        setNewStructure({
          batchId: '',
          name: '',
          description: '',
          academicYear: '2026-2027',
          frequency: 'MONTHLY',
          amount: 0,
          dueDay: 10,
        });
        loadFeeStructures();
        loadDashboardData();
      } else {
        setActionError(res.error || 'Failed to create fee structure');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error creating fee structure');
    }
  };

  const handleAssignIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch('/fees/assignments', {
        method: 'POST',
        body: JSON.stringify(newAssignment),
      });
      if (res.success) {
        setActionSuccess('Fee assigned successfully to student.');
        setShowAssignModal(false);
        setNewAssignment({
          studentId: '',
          feeStructureId: '',
          termLabel: '',
          academicYear: '2026-2027',
          discountAmount: 0,
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        });
        loadAssignments();
        loadDashboardData();
      } else {
        setActionError(res.error || 'Failed to assign fee');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error assigning fee');
    }
  };

  const handleAssignBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch('/fees/assignments/batch', {
        method: 'POST',
        body: JSON.stringify(newBatchAssignment),
      });
      if (res.success) {
        const { assignedCount, skippedCount } = res.data || {};
        setActionSuccess(`Batch fee assignment complete: ${assignedCount} assigned, ${skippedCount} skipped.`);
        setShowBatchAssignModal(false);
        setNewBatchAssignment({
          batchId: '',
          feeStructureId: '',
          termLabel: '',
          academicYear: '2026-2027',
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          defaultDiscount: 0,
        });
        loadAssignments();
        loadDashboardData();
      } else {
        setActionError(res.error || 'Failed to assign batch fee');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error running batch assignment');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentForPayment) return;
    setActionError(null);

    try {
      const res = await apiFetch(`/fees/assignments/${selectedAssignmentForPayment.id}/payments`, {
        method: 'POST',
        body: JSON.stringify(newPayment),
      });

      if (res.success) {
        setActionSuccess('Payment recorded and receipt generated.');
        setShowRecordPaymentModal(false);
        setSelectedAssignmentForPayment(null);
        loadAssignments();
        loadPayments();
        loadDashboardData();

        if (res.data?.payment?.id) {
          openReceipt(res.data.payment.id);
        }
      } else {
        setActionError(res.error || 'Failed to record payment');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error recording payment');
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;
    setProcessingRefund(true);
    setActionError(null);

    try {
      const res = await apiFetch(`/fees/payments/${selectedPaymentForRefund.id}/refunds`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(refundAmount),
          reason: refundReason,
        }),
      });

      if (res.success) {
        setActionSuccess(`Refund of ₹${refundAmount} recorded successfully.`);
        setShowRefundModal(false);
        setSelectedPaymentForRefund(null);
        setRefundAmount(0);
        setRefundReason('');
        loadPayments();
        loadAdjustments();
        loadDashboardData();
      } else {
        setActionError(res.error || 'Failed to process refund');
      }
    } catch (err: any) {
      setActionError(err.message || 'Error processing refund');
    } finally {
      setProcessingRefund(false);
    }
  };

  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fully Paid
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1 w-fit">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Partially Paid
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Overdue
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] flex items-center gap-1 w-fit">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" /> Pending
          </span>
        );
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-[#64748B]" /> Fees, Payments & Financial Operations
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Exact-decimal financial tracking, safe receipt generation, refunds, and collections
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setActionError(null);
                setShowCreateStructureModal(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#006FFF]/10 hover:bg-[#006FFF] text-[#006FFF] hover:text-white border border-[#E2E8F0] flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Fee Structure
            </button>
            <button
              onClick={() => {
                setActionError(null);
                loadFeeStructures();
                setShowAssignModal(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#006FFF] hover:bg-[#0058D4] text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Assign Fee to Student
            </button>
            <button
              onClick={() => {
                setActionError(null);
                loadFeeStructures();
                setShowBatchAssignModal(true);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#006FFF] hover:bg-[#006FFF] text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Layers className="w-4 h-4" /> Assign to Batch
            </button>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#D7CCC8]/30'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Financial Dashboard
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'assignments'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#D7CCC8]/30'
          }`}
        >
          <FileText className="w-4 h-4" /> Student Fee Assignments
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'payments'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#D7CCC8]/30'
          }`}
        >
          <Receipt className="w-4 h-4" /> Payments & Receipts
        </button>
        <button
          onClick={() => setActiveTab('structures')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'structures'
              ? 'bg-[#006FFF] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#D7CCC8]/30'
          }`}
        >
          <Layers className="w-4 h-4" /> Fee Structures
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'adjustments'
                ? 'bg-[#006FFF] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#D7CCC8]/30'
            }`}
          >
            <RotateCcw className="w-4 h-4" /> Refunds & Adjustments
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: FINANCIAL DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {loadingDashboard ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#64748B]" /> Loading financial reports...
            </div>
          ) : (
            <>
              {/* Primary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Total Fees Assigned</div>
                  <div className="text-2xl font-black text-[#0F172A]">{formatCurrency(summary?.totalAssigned)}</div>
                  <div className="text-[11px] text-[#64748B]">All student terms in current scope</div>
                </div>

                <div className="p-5 rounded-3xl bg-white border border-emerald-300 shadow-sm space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Net Fees Collected</div>
                  <div className="text-2xl font-black text-emerald-800">{formatCurrency(summary?.totalCollected)}</div>
                  <div className="text-[11px] text-emerald-700">Realized collections (minus refunds)</div>
                </div>

                <div className="p-5 rounded-3xl bg-white border border-amber-300 shadow-sm space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800">Total Outstanding</div>
                  <div className="text-2xl font-black text-amber-800">{formatCurrency(summary?.totalOutstanding)}</div>
                  <div className="text-[11px] text-amber-700">Pending & partial student dues</div>
                </div>

                <div className="p-5 rounded-3xl bg-white border border-rose-300 shadow-sm space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-800">Overdue Dues</div>
                  <div className="text-2xl font-black text-rose-800">{formatCurrency(summary?.totalOverdue)}</div>
                  <div className="text-[11px] text-rose-700">{summary?.counts?.overdue || 0} overdue student accounts</div>
                </div>
              </div>

              {/* Status Breakdown & Payment Methods */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account Status Counts */}
                <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Fee Account Status Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-xs text-emerald-800 font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Fully Paid Accounts
                      </span>
                      <span className="text-sm font-black text-emerald-900">{summary?.counts?.fullyPaid || 0}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50 border border-amber-200">
                      <span className="text-xs text-amber-800 font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-600" /> Partially Paid Accounts
                      </span>
                      <span className="text-sm font-black text-amber-900">{summary?.counts?.partiallyPaid || 0}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-xs text-[#64748B] font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#94A3B8]" /> Pending Accounts
                      </span>
                      <span className="text-sm font-black text-[#0F172A]">{summary?.counts?.pending || 0}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-50 border border-rose-200">
                      <span className="text-xs text-rose-800 font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" /> Overdue Accounts
                      </span>
                      <span className="text-sm font-black text-rose-900">{summary?.counts?.overdue || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Collections by Payment Method */}
                <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Payment Method Distribution</h3>
                    <span className="text-xs text-[#64748B]">Total Transactions: {collectionsReport?.transactionCount || 0}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].map((method) => {
                      const data = collectionsReport?.methodBreakdown?.[method] || { count: 0, total: 0 };
                      return (
                        <div key={method} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                          <span className="text-[10px] uppercase font-bold text-[#94A3B8] block tracking-wider">{method.replace('_', ' ')}</span>
                          <span className="text-base font-black text-[#0F172A] block">{formatCurrency(data.total)}</span>
                          <span className="text-[10px] text-[#64748B] block">{data.count} receipts</span>
                        </div>
                      );
                    })}
                  </div>

                  {summary?.totalRefunds > 0 && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                      <span>Total Authorized Refunds Processed</span>
                      <span className="font-bold">{formatCurrency(summary.totalRefunds)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: STUDENT FEE ASSIGNMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by student name or admission no..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={assignmentStatusFilter}
                onChange={(e) => setAssignmentStatusFilter(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
              >
                <option value="">All Statuses</option>
                <option value="PAID">Fully Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
              </select>

              <button
                onClick={loadAssignments}
                className="p-2 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]"
                title="Refresh assignments"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadingAssignments ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm">Loading fee assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm">
              No student fee assignments found. Create a fee structure and assign to students.
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Fee Structure & Term</th>
                      <th className="py-3 px-4">Base Fee</th>
                      <th className="py-3 px-4">Discount</th>
                      <th className="py-3 px-4">Payable</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Balance</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    {assignments
                      .filter((a) => {
                        if (!assignmentSearch) return true;
                        const s = a.student;
                        const fullName = `${s?.firstName} ${s?.lastName}`.toLowerCase();
                        const adm = (s?.admissionNumber || '').toLowerCase();
                        return fullName.includes(assignmentSearch.toLowerCase()) || adm.includes(assignmentSearch.toLowerCase());
                      })
                      .map((a) => {
                        return (
                          <tr key={a.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-[#0F172A]">
                                {a.student?.firstName} {a.student?.lastName}
                              </div>
                              <div className="text-[11px] text-[#64748B] font-mono">
                                Adm: {a.student?.admissionNumber}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#0F172A]">{a.feeStructure?.name}</div>
                              <div className="text-[11px] text-[#64748B] font-medium">{a.termLabel} ({a.academicYear})</div>
                            </td>
                            <td className="py-3 px-4 text-[#64748B]">{formatCurrency(a.baseAmount)}</td>
                            <td className="py-3 px-4 text-emerald-800 font-medium">{formatCurrency(a.discountAmount)}</td>
                            <td className="py-3 px-4 font-bold text-[#0F172A]">{formatCurrency(a.finalAmount)}</td>
                            <td className="py-3 px-4 text-emerald-800 font-semibold">{formatCurrency(a.netPaid)}</td>
                            <td className="py-3 px-4 font-black text-amber-800">{formatCurrency(a.remainingBalance)}</td>
                            <td className="py-3 px-4 text-[#64748B]">
                              {new Date(a.dueDate).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(a.calculatedStatus || a.status)}</td>
                            <td className="py-3 px-4 text-right">
                              {a.remainingBalance > 0 ? (
                                <button
                                  onClick={() => {
                                    setSelectedAssignmentForPayment(a);
                                    setNewPayment({
                                      amountPaid: a.remainingBalance,
                                      method: 'CASH',
                                      transactionReference: '',
                                      remarks: `Payment for ${a.termLabel}`,
                                    });
                                    setActionError(null);
                                    setShowRecordPaymentModal(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#006FFF] hover:bg-[#0058D4] text-white shadow-sm transition-all"
                                >
                                  Collect
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-[#94A3B8]">Settled</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: PAYMENTS & RECEIPTS */}
      {/* ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Authoritative Payment History</h3>
            <button
              onClick={loadPayments}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[#006FFF] hover:bg-[#F8FAFC] text-xs flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingPayments ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm">
              No payments recorded yet.
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Receipt No</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Fee Period</th>
                      <th className="py-3 px-4">Amount Paid</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Recorded Date</th>
                      <th className="py-3 px-4">Recorded By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    {payments.map((p) => {
                      const refundedTotal = (p.adjustments || [])
                        .filter((adj: any) => adj.adjustmentType === 'REFUND')
                        .reduce((acc: number, cur: any) => acc + Number(cur.amount), 0);
                      const netRetained = Number(p.amountPaid) - refundedTotal;

                      return (
                        <tr key={p.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#006FFF]">{p.receiptNumber}</td>
                          <td className="py-3 px-4 font-semibold text-[#0F172A]">
                            {p.student?.firstName} {p.student?.lastName}
                          </td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {p.feeAssignment?.feeStructure?.name} ({p.feeAssignment?.termLabel})
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-emerald-800">{formatCurrency(p.amountPaid)}</span>
                            {refundedTotal > 0 && (
                              <span className="block text-[10px] text-rose-800">
                                Refunded: {formatCurrency(refundedTotal)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#F8FAFC] text-[#006FFF] border border-[#E2E8F0]">
                              {p.method}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[#64748B] text-[11px]">
                            {p.transactionReference || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-[#64748B]">
                            {new Date(p.paidAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4 text-[#0F172A]">{p.recordedBy?.fullName}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openReceipt(p.id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#006FFF]/10 hover:bg-[#006FFF] text-[#006FFF] hover:text-white border border-[#E2E8F0] transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Printer className="w-3 h-3" /> Receipt
                              </button>

                              {isAdmin && netRetained > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedPaymentForRefund(p);
                                    setRefundAmount(netRetained);
                                    setRefundReason('');
                                    setShowRefundModal(true);
                                  }}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-600 text-rose-800 hover:text-white border border-rose-200 transition-all shadow-sm"
                                  title="Authorized Refund"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: FEE STRUCTURES */}
      {/* ========================================================================= */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Institute Fee Configurations</h3>
          </div>

          {loadingStructures ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm">Loading fee structures...</div>
          ) : feeStructures.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm">
              No fee structures configured. Click "New Fee Structure" above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {feeStructures.map((fs) => (
                <div key={fs.id} className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1] uppercase">
                        {fs.frequency}
                      </span>
                      <h4 className="text-base font-bold text-[#0F172A] mt-1.5">{fs.name}</h4>
                      <p className="text-xs text-[#64748B]">{fs.batch?.name || 'All Batches'} &bull; {fs.academicYear}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-800">{formatCurrency(fs.amount)}</span>
                      {fs.dueDay && (
                        <span className="block text-[10px] text-[#94A3B8]">Due Day: {fs.dueDay}th</span>
                      )}
                    </div>
                  </div>

                  {fs.description && (
                    <p className="text-xs text-[#64748B] pt-2 border-t border-[#F1F5F9]">{fs.description}</p>
                  )}

                  <div className="pt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>{fs._count?.assignments || 0} active assignments</span>
                    <span className="text-emerald-800 font-semibold">{fs.isActive ? 'Active' : 'Archived'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 5: REFUNDS & ADJUSTMENTS AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'adjustments' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Financial Adjustments & Audit Trail</h3>
          </div>

          {loadingAdjustments ? (
            <div className="p-12 text-center text-[#94A3B8] text-sm">Loading adjustments...</div>
          ) : adjustments.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm">
              No adjustments or refunds recorded.
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Reference / Receipt</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Authorized By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    {adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                        <td className="py-3 px-4 text-[#64748B]">
                          {new Date(adj.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              adj.adjustmentType === 'REFUND'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]'
                            }`}
                          >
                            {adj.adjustmentType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#0F172A]">
                          {adj.payment?.student
                            ? `${adj.payment.student.firstName} ${adj.payment.student.lastName}`
                            : adj.feeAssignment?.student
                            ? `${adj.feeAssignment.student.firstName} ${adj.feeAssignment.student.lastName}`
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#006FFF]">
                          {adj.payment?.receiptNumber || adj.feeAssignment?.termLabel || 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-800">{formatCurrency(adj.amount)}</td>
                        <td className="py-3 px-4 text-[#64748B]">{adj.reason}</td>
                        <td className="py-3 px-4 text-[#0F172A]">{adj.authorizedBy?.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD PAYMENT */}
      {/* ========================================================================= */}
      {showRecordPaymentModal && selectedAssignmentForPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> Record Offline / Manual Fee Payment
              </h3>
              <button
                onClick={() => setShowRecordPaymentModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Student:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedAssignmentForPayment.student?.firstName} {selectedAssignmentForPayment.student?.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Fee Period:</span>
                <span className="text-[#006FFF] font-semibold">{selectedAssignmentForPayment.termLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Total Payable:</span>
                <span className="text-[#0F172A] font-bold">{formatCurrency(selectedAssignmentForPayment.finalAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#E2E8F0] pt-2">
                <span className="text-amber-800 font-bold">Outstanding Balance:</span>
                <span className="text-amber-800 font-black text-sm">
                  {formatCurrency(selectedAssignmentForPayment.remainingBalance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006FFF] font-medium mb-1">
                  Amount Received (₹) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAssignmentForPayment.remainingBalance}
                  required
                  value={newPayment.amountPaid}
                  onChange={(e) => setNewPayment({ ...newPayment, amountPaid: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-bold text-base focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
                <span className="text-[11px] text-[#64748B] mt-0.5 block">
                  Cannot exceed outstanding balance of {formatCurrency(selectedAssignmentForPayment.remainingBalance)}
                </span>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Payment Method</label>
                <select
                  value={newPayment.method}
                  onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI (PhonePe / GPay / Paytm)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS / RTGS)</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="ONLINE">Online Portal</option>
                </select>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">
                  Transaction / Cheque Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., UPI Transaction ID or Bank Ref No"
                  value={newPayment.transactionReference}
                  onChange={(e) => setNewPayment({ ...newPayment, transactionReference: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="Optional notes for receipt"
                  value={newPayment.remarks}
                  onChange={(e) => setNewPayment({ ...newPayment, remarks: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#006FFF] hover:bg-[#0058D4] text-white shadow-sm flex items-center gap-1.5"
                >
                  Confirm & Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PRINT-FRIENDLY RECEIPT PREVIEW */}
      {/* ========================================================================= */}
      {showReceiptModal && activeReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3 no-print">
              <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-[#64748B]" /> Official Fee Receipt
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="text-[#94A3B8] hover:text-[#0F172A] p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Box */}
            <div id="tuition-receipt" className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] space-y-6">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-[#E2E8F0] pb-4 gap-4">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A]">{activeReceipt.institute?.name}</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">{activeReceipt.institute?.address || 'Tuition Center'}</p>
                  <p className="text-xs text-[#64748B]">
                    Phone: {activeReceipt.institute?.phone || 'N/A'} &bull; Email: {activeReceipt.institute?.email || 'N/A'}
                  </p>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs font-mono uppercase tracking-widest text-[#006FFF] font-bold block">
                    {activeReceipt.receiptNumber}
                  </span>
                  <span className="text-xs text-[#94A3B8] mt-1 block">
                    Date: {new Date(activeReceipt.receiptDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Student Details */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-white p-4 rounded-xl border border-[#E2E8F0]">
                <div>
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Student Name</span>
                  <span className="text-[#0F172A] font-bold text-sm">{activeReceipt.student?.fullName}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Admission No</span>
                  <span className="text-[#0F172A] font-mono font-bold text-sm">{activeReceipt.student?.admissionNumber}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Batch / Section</span>
                  <span className="text-[#0F172A] font-medium">{activeReceipt.student?.batchName}</span>
                </div>
                <div>
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Academic Year</span>
                  <span className="text-[#0F172A] font-medium">{activeReceipt.student?.academicYear}</span>
                </div>
              </div>

              {/* Fee Transaction Ledger */}
              <div className="space-y-3">
                <table className="w-full text-xs text-left bg-white rounded-xl overflow-hidden border border-[#E2E8F0]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-[10px] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Total Payable</th>
                      <th className="py-2.5 px-3 text-right">Prior Paid</th>
                      <th className="py-2.5 px-3 text-right">Current Paid</th>
                      <th className="py-2.5 px-3 text-right">Remaining Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEBE9]">
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-[#0F172A] block">{activeReceipt.feeDetails?.feeName}</span>
                        <span className="text-[11px] text-[#64748B]">{activeReceipt.feeDetails?.termLabel}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-[#0F172A]">
                        {formatCurrency(activeReceipt.feeDetails?.totalPayable)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#64748B]">
                        {formatCurrency(activeReceipt.feeDetails?.priorPaid)}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-800 text-sm">
                        {formatCurrency(activeReceipt.feeDetails?.amountPaid)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-800">
                        {formatCurrency(activeReceipt.feeDetails?.remainingBalanceAfter)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment Details */}
              <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Payment Method</span>
                  <span className="text-[#0F172A] font-semibold">{activeReceipt.payment?.method}</span>
                  {activeReceipt.payment?.transactionReference && (
                    <span className="text-[11px] font-mono text-[#64748B] block mt-0.5">
                      Ref: {activeReceipt.payment.transactionReference}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">Issued By</span>
                  <span className="text-[#0F172A] font-semibold">{activeReceipt.payment?.recordedBy}</span>
                  <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">Payment Verified</span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="text-[10px] text-[#94A3B8] text-center pt-3 border-t border-[#E2E8F0]">
                {activeReceipt.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE FEE STRUCTURE */}
      {/* ========================================================================= */}
      {showCreateStructureModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#64748B]" /> Create Fee Structure
              </h3>
              <button
                onClick={() => setShowCreateStructureModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStructure} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Applicable Batch</label>
                <select
                  required
                  value={newStructure.batchId}
                  onChange={(e) => setNewStructure({ ...newStructure, batchId: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Fee Structure Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Monthly Tuition - Class 10"
                  value={newStructure.name}
                  onChange={(e) => setNewStructure({ ...newStructure, name: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Frequency</label>
                  <select
                    value={newStructure.frequency}
                    onChange={(e) => setNewStructure({ ...newStructure, frequency: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="TERM_WISE">Term-wise</option>
                    <option value="ONE_TIME">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={newStructure.amount}
                    onChange={(e) => setNewStructure({ ...newStructure, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-bold focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={newStructure.academicYear}
                    onChange={(e) => setNewStructure({ ...newStructure, academicYear: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Default Due Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newStructure.dueDay}
                    onChange={(e) => setNewStructure({ ...newStructure, dueDay: parseInt(e.target.value) || 10 })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Includes lab access, monthly mock exams, etc."
                  value={newStructure.description}
                  onChange={(e) => setNewStructure({ ...newStructure, description: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowCreateStructureModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#006FFF] hover:bg-[#0058D4] text-white shadow-sm"
                >
                  Save Fee Structure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ASSIGN FEE TO INDIVIDUAL STUDENT */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#64748B]" /> Assign Fee to Student
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignIndividual} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Select Student</label>
                <select
                  required
                  value={newAssignment.studentId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, studentId: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} (Adm: {s.admissionNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Fee Structure</label>
                <select
                  required
                  value={newAssignment.feeStructureId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, feeStructureId: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Fee Structure...</option>
                  {feeStructures.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.name} - ₹{fs.amount} ({fs.frequency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Term Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., November 2026 or Term 1"
                    value={newAssignment.termLabel}
                    onChange={(e) => setNewAssignment({ ...newAssignment, termLabel: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Concession / Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAssignment.discountAmount}
                    onChange={(e) => setNewAssignment({ ...newAssignment, discountAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={newAssignment.dueDate}
                  onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#006FFF] hover:bg-[#0058D4] text-white shadow-sm"
                >
                  Assign Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BATCH FEE ASSIGNMENT */}
      {/* ========================================================================= */}
      {showBatchAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#64748B]" /> Assign Fee to Entire Batch
              </h3>
              <button onClick={() => setShowBatchAssignModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#006FFF]">
              Safe Transactional Operation: Automatically skips students already assigned for the specified term label.
            </div>

            <form onSubmit={handleAssignBatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Target Batch</label>
                <select
                  required
                  value={newBatchAssignment.batchId}
                  onChange={(e) => setNewBatchAssignment({ ...newBatchAssignment, batchId: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">Fee Structure</label>
                <select
                  required
                  value={newBatchAssignment.feeStructureId}
                  onChange={(e) => setNewBatchAssignment({ ...newBatchAssignment, feeStructureId: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Select Fee Structure...</option>
                  {feeStructures.map((fs) => (
                    <option key={fs.id} value={fs.id}>
                      {fs.name} - ₹{fs.amount}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Term Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., November 2026"
                    value={newBatchAssignment.termLabel}
                    onChange={(e) => setNewBatchAssignment({ ...newBatchAssignment, termLabel: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
                <div>
                  <label className="block text-[#006FFF] font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newBatchAssignment.dueDate}
                    onChange={(e) => setNewBatchAssignment({ ...newBatchAssignment, dueDate: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowBatchAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-[#006FFF] hover:bg-[#006FFF] text-white shadow-sm"
                >
                  Execute Batch Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: REFUND PAYMENT CONFIRMATION */}
      {/* ========================================================================= */}
      {showRefundModal && selectedPaymentForRefund && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" /> Process Authorized Refund
              </h3>
              <button onClick={() => setShowRefundModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <div>Receipt: <strong className="font-mono text-rose-900">{selectedPaymentForRefund.receiptNumber}</strong></div>
              <div>Student: <strong>{selectedPaymentForRefund.student?.firstName} {selectedPaymentForRefund.student?.lastName}</strong></div>
              <div>Original Amount Paid: <strong>{formatCurrency(selectedPaymentForRefund.amountPaid)}</strong></div>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#006FFF] font-medium mb-1">
                  Refund Amount (₹) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedPaymentForRefund.amountPaid}
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-bold text-base focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div>
                <label className="block text-[#006FFF] font-medium mb-1">
                  Reason for Refund (Mandatory & Audited) <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the clear administrative or financial reason for this refund..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="px-5 py-2.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  {processingRefund ? 'Processing...' : 'Confirm & Process Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
