import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  RefreshCw,
  Loader2,
  Check,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '@tuition/shared';

export const FranchiseCourses: React.FC = () => {
  const { user, activeInstitute } = useAuth();
  const toast = useToast();
  const canToggleOfferings = user?.role === 'FRANCHISE_OWNER' || user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [franchise, setFranchise] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const opts = forceRefresh ? { skipCache: true } : {};
      const ctxRes = await apiFetch('/courses/my-franchise-context', opts);
      const ctx = ctxRes.data || {};
      setFranchise(ctx.franchise || null);
      setBranches(ctx.branches || []);

      if (ctx.franchise?.id) {
        const coursesRes = await apiFetch(`/courses/franchise/${ctx.franchise.id}`, opts);
        const fetchedCourses = coursesRes.data || [];
        setCourses(fetchedCourses);
        const feesMap: Record<string, string> = {};
        fetchedCourses.forEach((c: any) => {
          feesMap[c.id] =
            c.franchiseCustomPrice !== null && c.franchiseCustomPrice !== undefined
              ? String(c.franchiseCustomPrice)
              : '';
        });
        setFeeInputs(feesMap);
      } else {
        setCourses([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load franchise courses');
    } finally {
      setLoading(false);
    }
  }, [activeInstitute?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle course offering enable/disable or save fee
  const handleToggleOffering = async (course: any, nextEnabled: boolean) => {
    if (!franchise?.id || !canToggleOfferings) return;
    setTogglingCourseId(course.id);
    const feeStr = feeInputs[course.id] ?? '';
    try {
      await apiFetch(`/courses/franchise/${franchise.id}/select`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          isEnabled: nextEnabled,
          customPrice: feeStr.trim() !== '' ? Number(feeStr) : null,
        }),
      });
      toast.success(nextEnabled ? `"${course.title}" enabled for your campus` : `"${course.title}" disabled`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update course offering');
    } finally {
      setTogglingCourseId(null);
    }
  };

  const enabledCourses = courses.filter((c) => c.isSelected);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#006FFF] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> {franchise ? `${franchise.name} (${franchise.code})` : 'Franchise LMS Hub'}
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Course Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Turn on courses for your branch and set local fees for permitted HQ offerings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Enabled Offerings</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {enabledCourses.length} <span className="text-xs font-semibold text-slate-400">/ {courses.length}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Available HQ Courses</div>
          <div className="text-2xl font-extrabold text-[#006FFF] mt-1">
            {courses.length}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Authorized Campus</div>
          <div className="text-base font-extrabold text-slate-900 mt-1 truncate">
            {branches[0]?.name || activeInstitute?.name || 'Assigned Campus'}
          </div>
        </div>
      </div>

      {/* Available Courses Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <div className="px-4 py-2.5 rounded-t-xl text-sm font-bold bg-[#006FFF] text-white shadow-sm">
          Available Courses ({courses.length})
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#006FFF] mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading franchise course catalogue...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-[#006FFF] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong>HQ Catalogue Governance:</strong> Only global Digital Ghuru courses explicitly permitted to your franchise by Super Admin (HQ) appear below. You can enable/disable offerings and customize local franchise fees, while master syllabus and assets remain centrally governed by Digital Ghuru HQ.
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">
                {!franchise ? 'No Franchise Assigned to This Branch' : 'No HQ-permitted courses available yet'}
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {!franchise
                  ? 'Your current branch is not connected to a franchise network. Contact your platform administrator to link this branch to a franchise.'
                  : 'Courses permitted for your franchise by Digital Ghuru HQ (Super Admin) will appear here for activation.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className={`rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                    course.isSelected ? 'border-emerald-300 ring-1 ring-emerald-500/15' : 'border-slate-200'
                  }`}
                >
                  <div>
                    {course.thumbnail ? (
                      <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm ${
                            course.isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-900/80 backdrop-blur-sm text-slate-200'
                          }`}
                        >
                          {course.isSelected ? 'Active in Campus' : 'Off'}
                        </span>
                      </div>
                    ) : (
                      <div className="h-44 w-full bg-gradient-to-br from-slate-100 to-blue-50/50 flex items-center justify-center relative border-b border-slate-100">
                        <BookOpen className="w-12 h-12 text-slate-300" />
                        <span
                          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm ${
                            course.isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-900/80 backdrop-blur-sm text-slate-200'
                          }`}
                        >
                          {course.isSelected ? 'Active in Campus' : 'Off'}
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#006FFF] text-[10px] font-bold font-mono">
                          {course.code || 'COURSE'}
                        </span>
                        {course.academicLevel && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {course.academicLevel}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-base text-slate-900 leading-snug line-clamp-2">
                        {course.title}
                      </h3>

                      {course.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">HQ Master Price</span>
                          <span className="font-bold text-slate-800">
                            {formatCurrency(course.effectivePrice || course.basePrice || 0)}
                          </span>
                        </div>

                        {canToggleOfferings && (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-xs text-slate-600 font-semibold">Local Fee</span>
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                                ₹
                              </span>
                              <input
                                type="number"
                                min={0}
                                placeholder={String(course.effectivePrice || course.basePrice || 0)}
                                value={feeInputs[course.id] ?? ''}
                                onChange={(e) =>
                                  setFeeInputs({ ...feeInputs, [course.id]: e.target.value })
                                }
                                onBlur={() => {
                                  if (course.isSelected) {
                                    handleToggleOffering(course, true);
                                  }
                                }}
                                className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-right outline-none focus:border-[#006FFF]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    {canToggleOfferings ? (
                      <button
                        type="button"
                        disabled={togglingCourseId === course.id}
                        onClick={() => handleToggleOffering(course, !course.isSelected)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                          course.isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        {togglingCourseId === course.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : course.isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Active
                          </>
                        ) : (
                          'Turn On Course'
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Managed by Franchise Owner</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
