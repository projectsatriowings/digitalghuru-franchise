import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import {
  Building2,
  BookOpen,
  ArrowRight,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Coins,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle,
  FileText,
  Percent,
} from 'lucide-react';

interface SuperAdminDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [franchiseList, setFranchiseList] = useState<any[]>([]);
  const [courseList, setCourseList] = useState<any[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [franchiseDashRes, franchisesRes, coursesRes] = await Promise.all([
        apiFetch('/franchises/dashboard/super-admin', { skipCache: true }),
        apiFetch('/franchises', { skipCache: true }),
        apiFetch('/courses', { skipCache: true }),
      ]);

      if (franchiseDashRes.success) {
        setDashboardData(franchiseDashRes.data);
      }
      if (franchisesRes.success && Array.isArray(franchisesRes.data?.franchises)) {
        setFranchiseList(franchisesRes.data.franchises);
      }
      if (coursesRes.success && Array.isArray(coursesRes.data)) {
        setCourseList(coursesRes.data);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load Super Admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const summary = dashboardData?.summary || {};
  const totalFranchises = franchiseList.length || summary.totalFranchises || 0;
  const activeFranchises = franchiseList.filter((f) => f.status === 'ACTIVE').length;
  const suspendedFranchises = franchiseList.filter((f) => f.status === 'SUSPENDED').length;

  const totalCourses = courseList.length || 0;
  const publishedCourses = courseList.filter((c) => c.status === 'PUBLISHED').length;

  const totalBranches = franchiseList.reduce((sum, f) => sum + (f.branches?.length || 0), 0);
  const totalStudents = summary.totalStudents || 0;

  const totalRoyaltyObligations = Number(summary.totalRoyaltyObligations || 0);
  const totalRoyaltyReceived = Number(summary.totalRoyaltyReceived || 0);
  const outstandingRoyalty = Number(summary.outstandingRoyalty || 0);
  const overdueRoyalty = Number(summary.overdueRoyalty || 0);

  const upcomingRenewals: any[] = dashboardData?.upcomingRenewals || [];
  const overdueInstallments: any[] = dashboardData?.overdueInstallments || [];
  const recentPayments: any[] = dashboardData?.recentPayments || [];

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-display">
              Super Admin Executive Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#006FFF] border border-blue-200">
              Platform Headquarters
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform overview across franchise partners, course offerings, commercial royalties, and active campuses.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchDashboard}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh Dashboard KPIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <div className="text-[11px] text-slate-400 hidden sm:block">
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Primary Action Modules Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Franchise Operations Card */}
        <div
          onClick={() => onNavigateTab?.('franchise_management')}
          className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all cursor-pointer group border border-slate-800 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-36 h-36 bg-[#006FFF]/10 rounded-full blur-2xl group-hover:bg-[#006FFF]/20 transition-all pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-300 group-hover:translate-x-1 transition-transform">
              <span>Open Franchise Console</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-5 space-y-1">
            <div className="text-xl font-bold text-white flex items-center gap-2.5">
              Franchise Governance &amp; Partners
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manage franchise centers, annual master agreements, royalty revenue sharing, and authorized campus branches.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Centers</span>
                <span className="text-lg font-black text-white">{totalFranchises}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Active Status</span>
                <span className="text-lg font-black text-emerald-400">{activeFranchises}</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Campuses</span>
                <span className="text-lg font-black text-amber-300">{totalBranches}</span>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
              Manage Centers &rarr;
            </span>
          </div>
        </div>

        {/* Global Course Curriculum Card */}
        <div
          onClick={() => onNavigateTab?.('course_management')}
          className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all cursor-pointer group border border-emerald-800/50 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 -mt-6 -mr-6 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-300 group-hover:translate-x-1 transition-transform">
              <span>Open Course Studio</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-5 space-y-1">
            <div className="text-xl font-bold text-white flex items-center gap-2.5">
              Course Studio &amp; Curriculum
            </div>
            <p className="text-xs text-emerald-100/70 leading-relaxed">
              Design master courses, author video modules &amp; downloadable resources, and govern franchise permission offerings.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">Total Catalog</span>
                <span className="text-lg font-black text-white">{totalCourses}</span>
              </div>
              <div className="h-6 w-px bg-emerald-800/60" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Published Live</span>
                <span className="text-lg font-black text-emerald-300">{publishedCourses}</span>
              </div>
              <div className="h-6 w-px bg-emerald-800/60" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">Draft Studio</span>
                <span className="text-lg font-black text-amber-300">{totalCourses - publishedCourses}</span>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 group-hover:bg-emerald-400 group-hover:text-slate-950 transition-colors">
              Manage Catalog &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Platform Real-Time KPI Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#006FFF]" /> Enterprise Core Operations
          </h2>
          <span className="text-[11px] text-slate-400">Live PostgreSQL aggregated state</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Franchise Centers */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Franchise Centers</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#006FFF]">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2 font-display">
                {loading ? '...' : totalFranchises}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>{activeFranchises} Active</span>
                {suspendedFranchises > 0 && (
                  <span className="text-rose-600 font-medium">· {suspendedFranchises} Suspended</span>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Total Partners</span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('franchise_management')}
                className="text-[#006FFF] font-bold hover:underline cursor-pointer"
              >
                View Centers &rarr;
              </button>
            </div>
          </div>

          {/* Card 2: Campus Branches */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Campus Branches</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2 font-display">
                {loading ? '...' : totalBranches}
              </div>
              <div className="text-xs text-slate-500 mt-1">Operational branch campuses</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Physical Centers</span>
              <span className="font-semibold text-emerald-700">HQ Verified</span>
            </div>
          </div>

          {/* Card 3: Global Master Courses */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Master Courses</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2 font-display">
                {loading ? '...' : totalCourses}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="text-emerald-700 font-bold">{publishedCourses} Live</span>
                <span className="text-slate-400">· {totalCourses - publishedCourses} Draft</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Curriculum Studio</span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('course_management')}
                className="text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                View Syllabus &rarr;
              </button>
            </div>
          </div>

          {/* Card 4: Total Student Registrations */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Students</span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mt-2 font-display">
                {loading ? '...' : totalStudents}
              </div>
              <div className="text-xs text-slate-500 mt-1">Enrolled across franchise branches</div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Academic Roster</span>
              <span className="font-semibold text-sky-700">Multi-tenant LMS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Royalty & Financial Oversight Grid */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-emerald-600" /> Commercial Royalty &amp; Settlement Oversight
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab?.('monthly_settlements')}
            className="text-xs font-bold text-[#006FFF] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Open Settlement Ledger</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-bold tracking-wider">
              <span>Contracted Obligations</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              ₹{totalRoyaltyObligations.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total annual installment commitments</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-emerald-700 uppercase font-bold tracking-wider">
              <span>Remitted Royalty</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">
              ₹{totalRoyaltyReceived.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-800/80 mt-1">Verified payments settled to HQ</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-700 uppercase font-bold tracking-wider">
              <span>Outstanding Balance</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-800 mt-2">
              ₹{outstandingRoyalty.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Upcoming scheduled commitments</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs text-rose-700 uppercase font-bold tracking-wider">
              <span>Overdue Arrears</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className={`text-2xl font-black mt-2 ${overdueRoyalty > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              ₹{overdueRoyalty.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {overdueRoyalty > 0 ? (
                <span className="text-rose-600 font-semibold">Immediate collection attention required</span>
              ) : (
                <span className="text-emerald-700 font-semibold">All installments up to date</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Deep-Dive: Active Franchise Centers & Recent Platform Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Registered Franchise Centers Overview */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#006FFF]" /> Registered Franchise Centers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary legal partners, contract status, and operating branches
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('franchise_management')}
              className="text-xs font-bold text-[#006FFF] hover:underline cursor-pointer"
            >
              View Full Directory &rarr;
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading franchise centers...</div>
          ) : franchiseList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No franchise centers registered yet. Click &ldquo;Franchise Management&rdquo; to add your first franchise.
            </div>
          ) : (
            <div className="space-y-3">
              {franchiseList.map((fr) => {
                const branches = fr.branches || [];
                const latestAgreement = (fr.agreements && fr.agreements[0]) || null;
                const revenuePct = fr.revenueSharePercentage !== null && fr.revenueSharePercentage !== undefined
                  ? fr.revenueSharePercentage
                  : 50;
                return (
                  <div
                    key={fr.id}
                    onClick={() => onNavigateTab?.('franchise_management')}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-[#006FFF]/40 hover:bg-slate-50/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-[#006FFF] transition-colors">
                          {fr.name}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#006FFF] border border-blue-200">
                          {fr.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fr.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {fr.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Owner: <strong className="text-slate-700">{fr.ownerName}</strong></span>
                        <span>•</span>
                        <span>Location: {fr.city || 'Tamil Nadu'}{fr.state ? `, ${fr.state}` : ''}</span>
                        <span>•</span>
                        <span>Split: <strong className="text-slate-700">{revenuePct}% Partner</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Attached Campuses</span>
                        <span className="text-xs font-bold text-slate-800">
                          {branches.length} {branches.length === 1 ? 'Campus' : 'Campuses'}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-[#006FFF] group-hover:text-white flex items-center justify-center text-slate-400 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (1 span): Commercial Remittances & Quick Actions */}
        <div className="space-y-6">
          {/* Recent Royalty Remittances */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Recent Remittances
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Verified</span>
            </div>

            {recentPayments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No royalty payments recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentPayments.slice(0, 4).map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{pay.franchise?.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {pay.installment?.periodLabel || 'Royalty Settlement'} · {pay.paymentMethod}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-700">
                        +₹{Number(pay.amountPaid).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(pay.paymentDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick HQ Directives */}
          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-3xl p-6 space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#006FFF] uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> Super Admin Operational Hub
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Standard operating procedures for platform leadership:
            </p>
            <ul className="text-xs text-slate-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006FFF] mt-1.5 shrink-0" />
                <span>To grant a franchise permission to deliver courses, open <strong>Course Management &rarr; Franchise Permissions</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006FFF] mt-1.5 shrink-0" />
                <span>To register physical teaching locations under a partner, click <strong>Franchise Management &rarr; Add Branch</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006FFF] mt-1.5 shrink-0" />
                <span>All video links &amp; downloadable PDFs can now be updated on published courses directly without breaking student records.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
