import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '@tuition/shared';
import {
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Printer,
  FileText,
  X,
  Edit3,
  ShieldCheck,
  Send,
  Download,
} from 'lucide-react';

interface FranchiseRevenueSectionProps {
  franchiseId: string;
}

export const FranchiseRevenueSection: React.FC<FranchiseRevenueSectionProps> = ({ franchiseId }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Beneficiary Edit Modal
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [savingBank, setSavingBank] = useState(false);

  // Statement Review Modal
  const [activeStatement, setActiveStatement] = useState<any>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);

  const loadRevenueData = async () => {
    if (!franchiseId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/franchises/${franchiseId}/revenue-dashboard`, { skipCache: true });
      if (res.success && res.data) {
        setData(res.data);
        const f = res.data.franchise;
        setBankName(f.beneficiaryBankName || '');
        setBeneficiaryName(f.beneficiaryName || '');
        setIfsc(f.beneficiaryIfsc || '');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load revenue and settlements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenueData();
  }, [franchiseId]);

  const handleSaveBeneficiary = async () => {
    if (!beneficiaryName.trim() || !bankName.trim() || !accountNumber.trim() || !ifsc.trim()) {
      showToast('All bank account fields are required', 'warning');
      return;
    }

    try {
      setSavingBank(true);
      const res = await apiFetch(`/franchises/${franchiseId}/beneficiary-account`, {
        method: 'PUT',
        body: JSON.stringify({
          beneficiaryName: beneficiaryName.trim(),
          beneficiaryBankName: bankName.trim(),
          beneficiaryAccountNumber: accountNumber.trim(),
          beneficiaryIfsc: ifsc.trim().toUpperCase(),
        }),
      });

      if (res.success) {
        showToast('Beneficiary details submitted for verification', 'success');
        setShowBankModal(false);
        setAccountNumber('');
        loadRevenueData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update beneficiary account', 'error');
    } finally {
      setSavingBank(false);
    }
  };

  const openStatementDetail = async (statementId: string) => {
    try {
      setLoadingStatement(true);
      setShowStatementModal(true);
      const res = await apiFetch(`/settlements/${statementId}`);
      if (res.success && res.data) {
        setActiveStatement(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load statement details', 'error');
      setShowStatementModal(false);
    } finally {
      setLoadingStatement(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs">
        <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#006FFF]" />
        Loading your centralized revenue and monthly settlements...
      </div>
    );
  }

  const franchise = data?.franchise || {};
  const metrics = data?.metrics || {};
  const settlements = data?.settlements || [];
  const currentMonth = data?.currentMonth || '';

  return (
    <div className="space-y-6">
      {/* Revenue & Settlement Overview Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Centralized Student Payments
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">Consolidated Branch Settlements</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 font-display mt-1">
              Revenue Sharing & Monthly Statements
            </h3>
            <p className="text-xs text-slate-500">
              Students across all your campus branches pay centrally. Super Admin calculates and transfers your share monthly.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBankModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#006FFF]" /> Beneficiary Account
            </button>
            <button
              onClick={loadRevenueData}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Primary Financial KPI Cards (Section H) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Agreed Franchise Share
            </span>
            <span className="text-2xl font-black text-[#006FFF] mt-1 block">
              {franchise.revenueSharePercentage}%
            </span>
            <span className="text-[11px] text-slate-500 block">
              DigitalGhuru: {franchise.digitalGuruRevenuePercentage}%
            </span>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Total Earnings Received
            </span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">
              {formatCurrency(metrics.totalPaidToFranchise)}
            </span>
            <span className="text-[11px] text-emerald-600 block">
              {metrics.completedSettlementsCount} completed payouts
            </span>
          </div>

          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Pending Admin Approval
            </span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">
              {formatCurrency(metrics.pendingApprovalAmount)}
            </span>
            <span className="text-[11px] text-amber-600 block">
              {metrics.pendingSettlementsCount} statements in review
            </span>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
              Approved / Processing Payout
            </span>
            <span className="text-2xl font-black text-blue-900 mt-1 block">
              {formatCurrency(metrics.approvedPendingTransferAmount)}
            </span>
            <span className="text-[11px] text-blue-600 block">
              Queued for bank transfer
            </span>
          </div>
        </div>

        {/* Beneficiary Account Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800 uppercase tracking-wider">Settlement Beneficiary Account:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                franchise.beneficiaryStatus === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {franchise.beneficiaryStatus || 'PENDING VERIFICATION'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-600">
              <div>
                <span className="text-slate-400">Beneficiary:</span>{' '}
                <span className="font-bold text-slate-900">{franchise.beneficiaryName || 'Not configured'}</span>
              </div>
              <div>
                <span className="text-slate-400">Bank:</span>{' '}
                <span className="font-semibold text-slate-900">{franchise.beneficiaryBankName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">Account:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{franchise.beneficiaryAccountNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400">IFSC:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{franchise.beneficiaryIfsc || '—'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowBankModal(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 self-start md:self-auto cursor-pointer"
          >
            Update Bank Details
          </button>
        </div>
      </div>

      {/* Monthly Settlement Statements Table (Section H) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display">Settlement Statements History</h3>
            <p className="text-xs text-slate-500">Official monthly revenue statements across all assigned campuses.</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Asia/Kolkata Calendar Period</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Statement #</th>
                <th className="px-4 py-3">Billing Month</th>
                <th className="px-4 py-3">Student Collections</th>
                <th className="px-4 py-3">Refunds</th>
                <th className="px-4 py-3">Agreed Split</th>
                <th className="px-4 py-3">Franchise Share</th>
                <th className="px-4 py-3">Transferred</th>
                <th className="px-4 py-3">Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No monthly settlement statements generated yet for your franchise.
                    <div className="text-[11px] text-slate-400 mt-1">
                      Statements are computed at the close of each calendar month.
                    </div>
                  </td>
                </tr>
              ) : (
                settlements.map((s: any) => {
                  const payable = Number(s.franchisePayableAmount);
                  const transferred = Number(s.totalTransferredAmount || 0);
                  const remaining = Number(
                    s.remainingPayableAmount !== null && Number(s.remainingPayableAmount) >= 0
                      ? s.remainingPayableAmount
                      : Math.max(0, payable - transferred)
                  );

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {s.statementNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{s.settlementMonth}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(s.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {new Date(s.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatCurrency(s.totalCapturedPayments)}
                        <span className="block text-[10px] text-slate-400 font-normal">{s.transactionCount} transactions</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {Number(s.refundDeductions) > 0 ? (
                          <span className="text-rose-600 font-semibold">-{formatCurrency(s.refundDeductions)}</span>
                        ) : (
                          '₹0.00'
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#006FFF]">
                        {Number(s.applicableFranchisePercentage)}%
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {formatCurrency(s.franchisePayableAmount)}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        {formatCurrency(transferred)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {remaining > 0 ? (
                          <span className="text-blue-700">{formatCurrency(remaining)}</span>
                        ) : (
                          <span className="text-emerald-700">₹0.00 (Settled)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'COMPLETED' || s.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'PARTIALLY_PAID'
                            ? 'bg-purple-100 text-purple-800'
                            : s.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : s.status === 'PENDING_APPROVAL' || s.status === 'PENDING_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {s.status === 'COMPLETED' ? 'PAID' : s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openStatementDetail(s.id)}
                          className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          View Statement
                        </button>
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
      {/* BENEFICIARY ACCOUNT EDIT MODAL */}
      {/* ========================================================================= */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Update Beneficiary Bank Details</h3>
              <button onClick={() => setShowBankModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-500">
              Your franchise share will be transferred to this verified beneficiary account following monthly approval.
            </p>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Beneficiary Legal Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Edutech Pvt Ltd"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Account Number *</label>
                <input
                  type="text"
                  placeholder="Enter full bank account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank IFSC Code *</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBank}
                onClick={handleSaveBeneficiary}
                className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0057CC] text-white font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-[#006FFF]/20"
              >
                {savingBank ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Submit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATEMENT DETAIL & DOWNLOAD MODAL */}
      {/* ========================================================================= */}
      {showStatementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-[#006FFF]">
                  {activeStatement?.statementNumber}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-600 font-medium">Monthly Franchise Statement</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/50"
                  title="Print / Save PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowStatementModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {loadingStatement ? (
                <div className="py-12 text-center text-slate-400">
                  <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#006FFF]" />
                  Loading statement details...
                </div>
              ) : activeStatement ? (
                <>
                  <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-black text-slate-900 font-display">
                        {activeStatement.franchise?.name}
                      </h4>
                      <p className="text-slate-500">Franchise Code: {activeStatement.franchise?.code}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Billing Period: {activeStatement.startDate?.split('T')[0]} to {activeStatement.endDate?.split('T')[0]} (IST)
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Payable Share</span>
                      <span className="text-xl font-black text-[#006FFF]">
                        {formatCurrency(activeStatement.franchisePayableAmount)}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-semibold mt-0.5">
                        Status: {activeStatement.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Total Collections</span>
                      <span className="font-bold text-slate-900">{formatCurrency(activeStatement.totalCapturedPayments)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Franchise Share ({Number(activeStatement.applicableFranchisePercentage)}%)
                      </span>
                      <span className="font-bold text-[#006FFF]">{formatCurrency(activeStatement.franchisePayableAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Transferred to Bank</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(activeStatement.totalTransferredAmount || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Remaining Balance</span>
                      <span className="font-black text-slate-900">
                        {formatCurrency(
                          activeStatement.remainingPayableAmount !== null && Number(activeStatement.remainingPayableAmount) >= 0
                            ? activeStatement.remainingPayableAmount
                            : Math.max(0, Number(activeStatement.franchisePayableAmount) - Number(activeStatement.totalTransferredAmount || 0))
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Official Bank Transfers History */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Official Bank Transfers ({activeStatement.bankTransfers?.length || 0})
                      </h5>
                      <span className="text-[10px] text-slate-400">Direct Bank Payouts</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2">Transfer Date</th>
                            <th className="px-3 py-2">Method</th>
                            <th className="px-3 py-2">Bank Reference / UTR</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Proof</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {!activeStatement.bankTransfers || activeStatement.bankTransfers.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-slate-400">
                                No bank transfers recorded yet for this monthly settlement.
                              </td>
                            </tr>
                          ) : (
                            activeStatement.bankTransfers.map((trf: any) => (
                              <tr key={trf.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-1.5 text-slate-600">
                                  {new Date(trf.transferDate).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </td>
                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">
                                  {trf.transferMethod}
                                </td>
                                <td className="px-3 py-1.5 font-mono font-bold text-blue-700">
                                  {trf.utrNumber}
                                </td>
                                <td className="px-3 py-1.5 font-bold text-emerald-700">
                                  {formatCurrency(trf.amount)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {trf.paymentProofUrl ? (
                                    <a
                                      href={trf.paymentProofUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#006FFF] hover:underline font-semibold"
                                    >
                                      View Receipt
                                    </a>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
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

                  {/* Transaction breakdown */}
                  <div className="space-y-2">
                    <h5 className="font-bold text-slate-800 text-xs">Underlying Student Transactions</h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Receipt #</th>
                            <th className="px-3 py-2">Student</th>
                            <th className="px-3 py-2">Campus</th>
                            <th className="px-3 py-2">Paid</th>
                            <th className="px-3 py-2">Your Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeStatement.payments?.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-3 py-1.5 text-slate-500">
                                {new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </td>
                              <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{p.receiptNumber}</td>
                              <td className="px-3 py-1.5 text-slate-800">{p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Student'}</td>
                              <td className="px-3 py-1.5 text-slate-600">{p.institute?.name || 'Main Center'}</td>
                              <td className="px-3 py-1.5 font-bold text-slate-900">{formatCurrency(p.amountPaid)}</td>
                              <td className="px-3 py-1.5 font-bold text-[#006FFF]">
                                {formatCurrency(p.franchiseShareAmount || (Number(p.amountPaid) * 0.5))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FranchiseRevenueSection;
