import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  DollarSign,
  TrendingUp,
  FileText,
  Users,
  Layers,
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  Printer,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const FranchiseOwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Active view tab inside owner portal
  const [activeTab, setActiveTab] = useState<'overview' | 'installments' | 'campuses' | 'agreement'>('overview');

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/franchises/dashboard/owner');
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load franchise owner dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleOpenReceipt = async (paymentId: string) => {
    if (!data?.franchise?.id) return;
    try {
      const res = await apiFetch(`/franchises/${data.franchise.id}/payments/${paymentId}/receipt`);
      if (res.success) {
        setReceiptData(res.data);
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch receipt details', 'error');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-xs">
        <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping mr-3"></div>
        Loading your franchise center...
      </div>
    );
  }

  const franchise = data?.franchise || {};
  const metrics = data?.metrics || {};
  const activeAgreement = data?.activeAgreement;
  const installments = data?.installments || [];
  const branches = data?.branches || [];
  const recentPayments = data?.recentPayments || [];

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
      {/* Franchise Banner */}
      <div className="bg-[#0B0F19] text-white p-6 md:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FEDC32]/10 to-transparent pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#006FFF]/30 text-[#38A3FF] border border-[#006FFF]/40">
                {franchise.code || 'DG-FR-OWNER'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {franchise.status || 'ACTIVE'}
              </span>
              <span className="text-xs text-slate-400">Digital Guru Official Franchise Center</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{franchise.name}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#FEDC32]" />
                Owner: <strong className="text-white">{franchise.ownerName}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {franchise.address ? `${franchise.address}, ` : ''}
                {franchise.city}, {franchise.state} {franchise.postalCode ? `(${franchise.postalCode})` : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {franchise.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {franchise.email}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDashboard()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-2 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Operating Campuses</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{branches.length}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">{metrics.totalStudents ?? 0} Students</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Annual Royalty</div>
          <div className="text-2xl font-black text-[#006FFF] mt-1">
            ₹{Number(metrics.totalRoyaltyObligations || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">2 Annual Installments</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Royalty Remitted</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            ₹{Number(metrics.totalRoyaltyPaid || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Verified Receipts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Outstanding Balance</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            ₹{Number(metrics.outstandingRoyalty || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">Current Agreement Year</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Overdue Amount</div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            ₹{Number(metrics.overdueRoyalty || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            {metrics.overdueRoyalty > 0 ? 'Immediate Attention' : 'All Dues Current'}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-[#006FFF] text-[#006FFF]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" /> Overview & Profile
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
          onClick={() => setActiveTab('campuses')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'campuses'
              ? 'border-[#006FFF] text-[#006FFF]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Campus Locations ({branches.length})
        </button>

        <button
          onClick={() => setActiveTab('agreement')}
          className={`py-3.5 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'agreement'
              ? 'border-[#006FFF] text-[#006FFF]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" /> Master Agreement
        </button>
      </div>

      {/* TAB 1: OVERVIEW & PROFILE */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Franchise Contact & Business Profile */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#006FFF]" /> Franchise Center Profile
            </h3>

            <div className="space-y-3 text-sm divide-y divide-slate-100">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Center Name:</span>
                <span className="font-bold text-slate-900">{franchise.name}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Center Code:</span>
                <span className="font-mono font-bold text-[#006FFF]">{franchise.code}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Registered Owner:</span>
                <span className="font-semibold text-slate-900">{franchise.ownerName}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Primary Mobile:</span>
                <span className="text-slate-900">{franchise.phone}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Email Address:</span>
                <span className="text-slate-900">{franchise.email}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Business Address:</span>
                <span className="text-slate-900 text-right max-w-xs">{franchise.address || 'Address on record'}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">City, State, Postal:</span>
                <span className="text-slate-900">
                  {franchise.city}, {franchise.state} {franchise.postalCode ? `- ${franchise.postalCode}` : ''}
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Country:</span>
                <span className="text-slate-900">{franchise.country || 'India'}</span>
              </div>
            </div>

            {franchise.authorizedContact?.name && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Authorized Contact Person</div>
                <div className="font-bold text-slate-900 text-sm">{franchise.authorizedContact.name}</div>
                {franchise.authorizedContact.designation && (
                  <div className="text-xs text-slate-500">{franchise.authorizedContact.designation}</div>
                )}
                {franchise.authorizedContact.phone && (
                  <div className="text-xs text-slate-500 mt-1">Phone: {franchise.authorizedContact.phone}</div>
                )}
              </div>
            )}
          </div>

          {/* Card: Active Agreement Snapshot */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FEDC32]" /> Active Annual Agreement Snapshot
            </h3>

            {activeAgreement ? (
              <div className="space-y-3 text-sm divide-y divide-slate-100">
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Agreement Number:</span>
                  <span className="font-mono font-bold text-slate-900">{activeAgreement.agreementNumber}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Agreement Title:</span>
                  <span className="font-semibold text-slate-900">{activeAgreement.title}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Valid Period:</span>
                  <span className="text-slate-900">
                    {new Date(activeAgreement.startDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    to{' '}
                    {new Date(activeAgreement.endDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Calculation Method:</span>
                  <span className="font-bold text-[#006FFF]">
                    {activeAgreement.calculationMethod === 'FIXED_ANNUAL'
                      ? 'Fixed Annual Fee'
                      : activeAgreement.calculationMethod === 'PER_STUDENT'
                      ? 'Per Student Rate'
                      : 'Revenue Share'}
                  </span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-slate-500">Installments:</span>
                  <span className="font-bold text-slate-900">Exactly 2 Installments / Year</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">No active agreement currently on file.</div>
            )}

            {/* Quick Link to Installment Schedule */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-xs text-blue-900 flex justify-between items-center mt-4">
              <div>
                <div className="font-bold">Two-Installment Royalty Schedule</div>
                <div className="text-blue-700 text-[11px]">
                  View installment dates, amount breakdowns, and verified digital receipts.
                </div>
              </div>
              <button
                onClick={() => setActiveTab('installments')}
                className="px-3 py-1.5 bg-[#006FFF] text-white font-bold rounded-lg shadow-sm"
              >
                View Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 2-INSTALLMENT SCHEDULE & PAYMENT HISTORY */}
      {activeTab === 'installments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Annual Royalty Two-Installment Schedule</h3>
              <p className="text-xs text-slate-500">
                Your annual agreement defines exactly two installments per agreement year. All receipts are digitally verified.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Installment</th>
                    <th className="px-4 py-3">Period & Agreement</th>
                    <th className="px-4 py-3">Calculation Breakdown</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Paid / Outstanding</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {installments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                        No installments recorded for your franchise yet.
                      </td>
                    </tr>
                  ) : (
                    installments.map((inst: any) => (
                      <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-slate-900">Installment #{inst.installmentNumber}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{inst.periodLabel}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {inst.agreement?.agreementNumber || activeAgreement?.agreementNumber}
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
                            <div className="text-[11px] text-slate-500">{inst.calculationBreakdown.formula}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verified Payment Receipts History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" /> Verified Payment Receipts & Remittances
            </h3>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Receipt Number</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Method & Reference</th>
                    <th className="px-4 py-3">Amount Remitted</th>
                    <th className="px-4 py-3 text-right">Official Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No payment remittances recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentPayments.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-[#006FFF]">{p.receiptNumber}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold text-slate-800">{p.paymentMethod}</span>
                          {p.transactionReference && (
                            <span className="text-slate-500 font-mono block">Ref: {p.transactionReference}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          ₹{Number(p.amountPaid).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenReceipt(p.id)}
                            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg inline-flex items-center gap-1 transition-all"
                          >
                            <Receipt className="w-3.5 h-3.5" /> View Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAMPUSES */}
      {activeTab === 'campuses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Authorized Campus Locations</h3>
              <p className="text-xs text-slate-500">
                Operating campuses authorized under your franchise license. New campuses are created and attached exclusively by Super Admin.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded text-slate-600 font-semibold">
              {branches.length} Campus(es)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {branches.map((b: any) => (
              <div key={b.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                    <span className="text-xs font-mono font-semibold text-[#006FFF]">{b.code}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">
                    {b.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {b.city || 'Campus location on file'}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-xs text-slate-500">
                  <span>Students: {b._count?.students || 0}</span>
                  <span>Batches: {b._count?.batches || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MASTER AGREEMENT */}
      {activeTab === 'agreement' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Master Franchise Agreement</h3>
              <p className="text-xs text-slate-500">
                Terms and legal conditions established with Digital Guru Platform.
              </p>
            </div>
            {activeAgreement && (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                {activeAgreement.status}
              </span>
            )}
          </div>

          {activeAgreement ? (
            <div className="space-y-4 text-xs leading-relaxed text-slate-700">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-slate-400 font-semibold uppercase">Agreement No:</div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{activeAgreement.agreementNumber}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold uppercase">Start Date:</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {new Date(activeAgreement.startDate).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold uppercase">End Date:</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {new Date(activeAgreement.endDate).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 font-semibold uppercase">Calculation Basis:</div>
                  <div className="font-bold text-[#006FFF] mt-0.5">
                    {activeAgreement.calculationMethod || 'FIXED_ANNUAL'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 text-sm">Key Operating Terms</div>
                <p>
                  1. <strong>Two-Installment Royalty:</strong> Exactly two installments are due per agreement year according to the schedule in the portal.
                </p>
                <p>
                  2. <strong>Franchise Operation:</strong> The Franchise Owner is authorized to manage students, admissions, staff, class schedules, exams, and tuition fees within their authorized campus locations.
                </p>
                <p>
                  3. <strong>Brand & Integrity:</strong> Official Digital Guru materials, badges, and learning systems are licensed for use during the active agreement term.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">No active agreement data found.</div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: OFFICIAL ROYALTY RECEIPT VIEWER                         */}
      {/* ============================================================= */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 space-y-6">
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

              {/* Payer and Installment Particulars */}
              <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                <div>
                  <div className="text-slate-400 uppercase font-semibold">Received From:</div>
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

              {/* Amount */}
              <div className="bg-slate-100 p-4 rounded-xl flex justify-between items-center my-4">
                <div>
                  <div className="text-xs font-bold text-slate-600 uppercase">Amount Remitted</div>
                  <div className="text-[11px] text-slate-500">Verified Platform Royalty Remittance</div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{Number(receiptData.amountPaid).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end pt-3 border-t border-slate-200 text-[11px] text-slate-400">
                <div>Authorized By: {receiptData.issuer?.organization}</div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-700 flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-3.5 h-3.5" /> Digitally Verified
                  </div>
                  <div>Valid without physical signature</div>
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
    </div>
  );
};
