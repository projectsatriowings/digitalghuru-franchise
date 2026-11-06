import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { useAuth, ALL_BRANCHES_SELECTION } from '../context/AuthContext';
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
  Sparkles,
  BookOpen,
  Award,
  ChevronRight,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const FranchiseOwnerDashboard: React.FC = () => {
  const { user, activeInstitute, isConsolidatedMode, setActiveInstitute } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Active view tab inside franchisee portal
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'installments' | 'agreement'>('overview');

  // Receipt modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const branchParam = activeInstitute && activeInstitute.id !== 'ALL' ? `?branchId=${activeInstitute.id}` : '';
      const res = await apiFetch(`/franchises/dashboard/owner${branchParam}`, { skipCache: true });
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load franchisee admin dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
}, [activeInstitute?.id]);

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
      <div className="flex items-center justify-center p-16 text-slate-500 text-xs">
        <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping mr-3"></div>
        Loading your multi-branch franchise center...
      </div>
      );
  }

      const franchise = data?.franchise || { };
      const metrics = data?.metrics || { };
      const activeAgreement = data?.activeAgreement;
      const installments = data?.installments || [];
      const branches = data?.branches || [];
      const branchCards = data?.branchCards || [];
      const recentPayments = data?.recentPayments || [];
      const upcomingExaminations = data?.upcomingExaminations || [];
      const selectedBranch = data?.selectedBranch;

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
                <div className="flex flex-wrap items-center gap-2">
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
                    Franchisee Admin: <strong className="text-white">{franchise.ownerName}</strong>
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

          {/* BRANCH SCOPE STATUS BAR */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${isConsolidatedMode
              ? 'bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border-[#006FFF]/30 text-blue-900'
              : 'bg-white border-slate-200 text-slate-800 shadow-sm'
            }`}>
            <div className="flex items-center gap-2.5">
              {isConsolidatedMode ? (
                <>
                  <div className="p-1.5 bg-[#006FFF] text-white rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Consolidated Multi-Branch View Active</span>
                    <p className="text-slate-600 text-[11px]">
                      Aggregating data from all {branches.length} campus branches assigned to your franchise.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-1.5 bg-[#006FFF] text-white rounded-lg">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">
                      Focused Campus: {selectedBranch?.name} ({selectedBranch?.code})
                    </span>
                    <p className="text-slate-600 text-[11px]">
                      Location: {selectedBranch?.city ? `${selectedBranch.city}, ${selectedBranch.state || ''}` : 'Active Campus'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {!isConsolidatedMode && (
              <button
                onClick={() => setActiveInstitute(ALL_BRANCHES_SELECTION)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-all text-xs self-start sm:self-auto"
              >
                ← View Consolidated (All Branches)
              </button>
            )}
          </div>

          {/* CONSOLIDATED OVERVIEW KPI CARDS (REQUIREMENT 3A) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Metric 1: Assigned Campuses */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Assigned Campuses</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{branches.length}</div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                {metrics.activeBranchesCount || branches.length} Active Branches
              </div>
            </div>

            {/* Metric 2: Active Students */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">Active Students</div>
                <div className="text-2xl font-black text-[#006FFF] mt-1">{metrics.totalStudents ?? 0}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Enrolled Students
                </div>
              </div>

              {/* Metric 3: Active Staff */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">Staff & Faculty</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalStaff ?? 0}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">Active Profiles</div>
              </div>

              {/* Metric 4: Today's Student Attendance */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">Today's Attendance</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {metrics.todayAttendance?.rate ?? 100}%
                </div>
                <div className="text-[11px] text-slate-600 font-medium mt-1 flex items-center gap-2">
                  <span>{metrics.todayAttendance?.present ?? 0} Present</span>
                  <span>•</span>
                  <span className="text-rose-600">{metrics.todayAttendance?.absent ?? 0} Absent</span>
                </div>
              </div>

              {/* Metric 5: Monthly Fee Collections */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">Monthly Collections</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  ₹{Number(metrics.monthlyFeeCollection || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Total: ₹{Number(metrics.totalRevenue || 0).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Metric 6: Pending Fees */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase">Pending Tuition Fees</div>
                <div className="text-2xl font-black text-amber-600 mt-1">
                  ₹{Number(metrics.pendingFees || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-1">Outstanding Balance</div>
              </div>

              {/* Metric 7: Active Batches */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Active Batches</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{metrics.activeBatches ?? 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">Running Schedules</div>
                </div>

                {/* Metric 8: Upcoming Exams */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Upcoming Exams</div>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{metrics.upcomingExamsCount ?? 0}</div>
                  <div className="text-[11px] text-indigo-700 font-medium mt-1">Scheduled Assessments</div>
                </div>

                {/* Metric 9: Learning & Homework */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Learning Materials</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">{metrics.materialsCount ?? 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">{metrics.homeworkCount ?? 0} Homework Tasks</div>
                </div>

                {/* Metric 10: Annual Royalty Balance */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Franchise Royalty</div>
                  <div className="text-2xl font-black text-[#006FFF] mt-1">
                    ₹{Number(metrics.outstandingRoyalty || 0).toLocaleString('en-IN')}
                  </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      {metrics.overdueRoyalty > 0 ? (
                        <span className="text-rose-600 font-bold">₹{Number(metrics.overdueRoyalty).toLocaleString('en-IN')} Overdue</span>
                      ) : (
                        <span className="text-emerald-600">All Dues Current</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs Bar */}
                  <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl gap-6 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('overview')}
                            ? 'border-[#006FFF] text-[#006FFF]'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                          }`}
        >
          <Layers className="w-4 h-4" /> Overview & Campus Performance
        </button>

        <button
          onClick={() => setActiveTab('branches')}
                    className={`py-3.5 px-2 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'branches'
                        ? 'border-[#006FFF] text-[#006FFF]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
        >
                    <Building2 className="w-4 h-4" /> Assigned Campuses ({branches.length})
                  </button>

                  <button
          onClick={() => setActiveTab('installments')}
                    className={`py-3.5 px-2 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'installments'
                        ? 'border-[#006FFF] text-[#006FFF]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    <DollarSign className="w-4 h-4" /> 2-Installment Royalty ({installments.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('agreement')}
                          ? 'border-[#006FFF] text-[#006FFF]'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
        >
          <FileText className="w-4 h-4" /> Master Agreement
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BRANCH CARDS (REQUIREMENT 3C) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* BRANCH CARDS GRID: INDIVIDUAL BRANCH SUMMARY & PERFORMANCE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#006FFF]" /> Assigned Branch Campuses & Performance Cards
                </h3>
                <p className="text-xs text-slate-500">
                  Select any campus card to instantly switch the dashboard and operational modules to that branch.
                </p>
              </div>
              <span className="text-xs font-mono bg-blue-50 text-[#006FFF] font-bold px-3 py-1 rounded-lg border border-blue-100">
                {branchCards.length} Campus{branchCards.length > 1 ? 'es' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branchCards.map((b: any) => {
                const isSelected = activeInstitute?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      setActiveInstitute({
                        id: b.id,
                        name: b.name,
                        code: b.code,
                        city: b.city,
                      });
                    }}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${isSelected
                                  ? 'bg-white border-[#006FFF] shadow-md ring-2 ring-[#006FFF]/20'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                                }`}
                            >
                              {isSelected && (
                                <div className="absolute top-0 right-0 bg-[#006FFF] text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg flex items-center gap-1">
                                  Active Campus
                                </div>
                              )}

                              <div className="flex items-start justify-between pr-12">
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#006FFF] transition-colors">
                                    {b.name}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                    <span className="font-mono text-[#006FFF] font-bold">{b.code}</span>
                                    {b.city && (
                                      <span className="flex items-center gap-0.5">
                                        • <MapPin className="w-3 h-3 text-slate-400" /> {b.city}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Operational metrics grid for this branch */}
                              <div className="grid grid-cols-3 gap-2 my-4 pt-3 border-t border-slate-100 text-center">
                                <div className="bg-slate-50 p-2 rounded-xl">
                                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Students</div>
                                  <div className="text-base font-bold text-slate-900 mt-0.5">{b.activeStudents}</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-xl">
                                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Staff</div>
                                  <div className="text-base font-bold text-slate-900 mt-0.5">{b.staffCount}</div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-xl">
                                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Today Att.</div>
                                  <div className="text-base font-bold text-emerald-600 mt-0.5">{b.todayAttendance?.rate}%</div>
                                </div>
                              </div>

                              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Monthly Fees:</span>
                                  <span className="font-bold text-emerald-700">₹{Number(b.monthlyRevenue || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Pending Fees:</span>
                                  <span className="font-bold text-amber-600">₹{Number(b.pendingFees || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Batches Running:</span>
                                  <span className="font-semibold text-slate-900">{b.activeBatches} active</span>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#006FFF]">
                                <span>{isSelected ? 'Currently Selected' : 'Open Campus Dashboard'}</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          );
                        })}
            </div>
          </div>

            {/* TWO COLUMN SECTION: UPCOMING EXAMS & FRANCHISE PROFILE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Upcoming Examinations */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Upcoming Examinations ({upcomingExaminations.length})
                </h3>

                      {upcomingExaminations.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  No upcoming examinations scheduled in this scope.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingExaminations.map((exam: any) => (
                    <div key={exam.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-slate-900">{exam.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-[#006FFF]">{exam.subject?.name || 'Subject'}</span>
                          <span>•</span>
                          <span>Campus: {exam.institute?.name}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {new Date(exam.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                        <div className="text-[10px] text-slate-400 font-semibold">{exam.examType || 'Exam'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 2: Active Agreement Snapshot */}
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
        </div>
      )}

      {/* TAB 2: ASSIGNED CAMPUSES LIST */}
      {activeTab === 'branches' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Authorized Campus Locations</h3>
              <p className="text-xs text-slate-500">
                Operating campuses authorized under your franchise license. Campus creation and assignment is handled exclusively by Super Admin.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded text-slate-600 font-semibold">
              {branches.length} Campus(es)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {branches.map((b: any) => {
              const isSelected = activeInstitute?.id === b.id;
              return (
                <div
                  key={b.id}
                  className={`border rounded-xl p-5 space-y-3 transition-all ${
                    isSelected ? 'border-[#006FFF] bg-blue-50/20 shadow-sm' : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                      <span className="text-xs font-mono font-semibold text-[#006FFF]">{b.code}</span>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 text-emerald-800">
                      {b.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {b.address ? `${b.address}, ` : ''}{b.city || 'Campus location on file'}
                    </div>
                    {b.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" /> {b.phone}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <div className="flex gap-4 text-slate-500">
                      <span>Students: <strong>{b._count?.students || 0}</strong></span>
                      <span>Batches: <strong>{b._count?.batches || 0}</strong></span>
                      <span>Staff: <strong>{b._count?.staffProfiles || 0}</strong></span>
                    </div>
                    <button
                      onClick={() => {
                        setActiveInstitute({
                          id: b.id,
                          name: b.name,
                          code: b.code,
                          city: b.city,
                        });
                        setActiveTab('overview');
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#006FFF] text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Select Branch'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: 2-INSTALLMENT SCHEDULE & PAYMENT HISTORY */}
      {activeTab === 'installments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Annual Royalty Schedule (Exactly 2 Installments)</h3>
              <p className="text-xs text-slate-500">
                Installment 1 and Installment 2 obligations for the active agreement year.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installments.map((inst: any) => (
                <div key={inst.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Installment #{inst.installmentNumber}: {inst.periodLabel}
                      </div>
                      <div className="text-xs text-slate-500">
                        Due Date: <strong>{new Date(inst.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                      </div>
                    </div>
                    {renderStatusBadge(inst.liveStatus)}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Obligation:</span>
                      <span className="font-bold text-slate-900">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Remitted:</span>
                      <span className="font-bold text-emerald-700">₹{Number(inst.paidAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Outstanding:</span>
                      <span className="font-bold text-amber-700">₹{Number(inst.outstandingBalance).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Royalty Payments & Receipts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Recent Royalty Remittances & Receipts</h3>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Receipt No</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Method & Ref</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                        No verified royalty payments on record yet.
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
                  2. <strong>Franchise Operation:</strong> The Franchisee Admin is authorized to manage students, admissions, staff, class schedules, exams, and tuition fees within their authorized campus locations.
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
