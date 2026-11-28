import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  Archive,
  Layers,
  FolderKanban,
  Building2,
  Sparkles,
  FileText,
  PlayCircle,
  Loader2,
  X,
  RefreshCw,
  Tag,
  HelpCircle,
  Users,
  Globe,
  Check,
  AlertTriangle,
  ExternalLink,
  Download,
  Lock,
  ShieldCheck,
  ShieldOff,
  Sliders,
  PauseCircle,
  Paperclip,
  Wrench,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { useToast } from '../context/ToastContext';
import { openMediaResource, getMediaResourceMeta } from '../utils/mediaHelper';
import { CourseWizard } from '../components/CourseWizard';
import { CurriculumManager } from '../components/CurriculumManager';
import { IconRenderer } from '../components/IconPickerDropdown';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { formatCurrency } from '@tuition/shared';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  _count?: { courses: number };
}

export const CourseManagement: React.FC = () => {
  const toast = useToast();

  // Catalogue state
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [displayLayout, setDisplayLayout] = useState<'grid' | 'table'>('grid');
  const [expandedPreviewModules, setExpandedPreviewModules] = useState<Record<number, boolean>>({ 0: true });

  // Mode: catalogue | wizard
  const [viewMode, setViewMode] = useState<'catalogue' | 'wizard'>('catalogue');
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [creatingDraftVersion, setCreatingDraftVersion] = useState(false);
  const [statusActionCourseId, setStatusActionCourseId] = useState<string | null>(null);

  // Modals / Drawers
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', slug: '', description: '', icon: 'BookOpen', sortOrder: 0 });
  const [savingCategory, setSavingCategory] = useState(false);

  const [curriculumCourse, setCurriculumCourse] = useState<any | null>(null);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);

  const [previewCourse, setPreviewCourse] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [franchiseCourse, setFranchiseCourse] = useState<any | null>(null);
  const [franchisesList, setFranchisesList] = useState<any[]>([]);
  const [franchiseSelections, setFranchiseSelections] = useState<
    Record<string, { isPermitted: boolean; isEnabled: boolean; customPrice: string; loading?: boolean }>
  >({});
  const [loadingFranchises, setLoadingFranchises] = useState(false);
  const [bulkPermitting, setBulkPermitting] = useState(false);
  const [franchiseSearch, setFranchiseSearch] = useState('');

  // Custom Confirmation Dialog State for Course / Category Deletions
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    type: 'course' | 'category';
    item: any | null;
    loading: boolean;
  }>({
    isOpen: false,
    type: 'course',
    item: null,
    loading: false,
  });

  useBodyScrollLock(Boolean(showCategoriesModal || curriculumCourse || previewCourse || franchiseCourse || deleteModalState.isOpen));

  const fetchCatalogue = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const opts = forceRefresh ? { skipCache: true } : {};
      const [coursesRes, catsRes] = await Promise.all([
        apiFetch('/courses?limit=100', opts),
        apiFetch('/courses/categories', opts),
      ]);
      setCourses(coursesRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load course catalogue');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  // Filtered list
  const filteredCourses = courses.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && c.categoryId !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.slug || '').toLowerCase().includes(q) ||
        (c.subTitle || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // -----------------------------------------------------------
  // WIZARD ACTIONS
  // -----------------------------------------------------------
  const handleStartCreate = () => {
    setEditingCourse(null);
    setViewMode('wizard');
  };

  const handleStartEdit = async (courseId: string) => {
    setWizardLoading(true);
    try {
      const res = await apiFetch(`/courses/${courseId}`, { skipCache: true });
      setEditingCourse(res.data);
      setViewMode('wizard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load course details for editing');
    } finally {
      setWizardLoading(false);
    }
  };

  const handleCreateDraftFromWizard = async (courseId: string) => {
    setCreatingDraftVersion(true);
    try {
      await apiFetch(`/courses/${courseId}/versions`, { method: 'POST' });
      const res = await apiFetch(`/courses/${courseId}`, { skipCache: true });
      setEditingCourse(res.data);
      toast.success('New editable curriculum draft created — Step 8 is now unlocked!');
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create draft curriculum version');
    } finally {
      setCreatingDraftVersion(false);
    }
  };

  const handleWizardComplete = async (payload: any) => {
    setSavingCourse(true);
    try {
      if (editingCourse?.id) {
        // Send full payload including modules (backend now seamlessly updates media/videos/attachments in place even for published courses)
        await apiFetch(`/courses/${editingCourse.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Course and lesson resources updated successfully');
      } else {
        await apiFetch('/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Global course created successfully');
      }
      setViewMode('catalogue');
      setEditingCourse(null);
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save course');
    } finally {
      setSavingCourse(false);
    }
  };

  // -----------------------------------------------------------
  // CURRICULUM MANAGER DRAWER
  // -----------------------------------------------------------
  const openCurriculumDrawer = async (courseId: string) => {
    setLoadingCurriculum(true);
    try {
      const res = await apiFetch(`/courses/${courseId}`, { skipCache: true });
      setCurriculumCourse(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load curriculum versions');
    } finally {
      setLoadingCurriculum(false);
    }
  };

  const refreshCurriculumDrawer = async () => {
    if (!curriculumCourse?.id) return;
    await openCurriculumDrawer(curriculumCourse.id);
    await fetchCatalogue();
  };

  // -----------------------------------------------------------
  // PREVIEW MODAL
  // -----------------------------------------------------------
  const openPreviewModal = async (courseId: string) => {
    setLoadingPreview(true);
    try {
      const res = await apiFetch(`/courses/${courseId}`, { skipCache: true });
      setPreviewCourse(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load course preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  // -----------------------------------------------------------
  // STATUS & DELETE ACTIONS
  // -----------------------------------------------------------
  const handleStatusAction = async (course: any, nextStatus: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED') => {
    setStatusActionCourseId(course.id);
    try {
      if (nextStatus === 'PUBLISHED') {
        await apiFetch(`/courses/${course.id}/publish`, { method: 'POST' });
        toast.success(`"${course.title}" is now Published & Live`);
      } else {
        await apiFetch(`/courses/${course.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        toast.success(`Course moved to ${nextStatus}`);
      }
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update course status');
    } finally {
      setStatusActionCourseId(null);
    }
  };

  const getHumanErrorMessage = (err: any): string => {
    const raw = err?.data?.message || err?.data?.error || err?.message || '';
    if (raw.includes('violates RESTRICT') || raw.includes('CourseCurriculumVersion') || raw.includes('23001')) {
      return 'This course contains published curriculum versions and cannot be permanently deleted. It has been safely archived instead.';
    }
    if (raw.includes('enrollment') || raw.includes('enrolled')) {
      return 'This course cannot be deleted because students are actively or historically enrolled in it. You can archive it instead.';
    }
    if (raw.includes('Cannot delete category')) {
      return raw;
    }
    if (raw.includes('prisma') || raw.includes('ConnectorError') || raw.includes('QueryError') || raw.includes('invocation')) {
      return 'This item has associated database records and cannot be permanently removed. Please archive it instead.';
    }
    return raw || 'Operation could not be completed. Please try again.';
  };

  const openDeleteCourseModal = (course: any) => {
    setDeleteModalState({
      isOpen: true,
      type: 'course',
      item: course,
      loading: false,
    });
  };

  const openDeleteCategoryModal = (cat: Category) => {
    setDeleteModalState({
      isOpen: true,
      type: 'category',
      item: cat,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    const { type, item } = deleteModalState;
    if (!item) return;

    setDeleteModalState((prev) => ({ ...prev, loading: true }));
    try {
      if (type === 'course') {
        const res = await apiFetch(`/courses/${item.id}`, { method: 'DELETE' });
        setCourses((prev) => prev.filter((c) => c.id !== item.id));
        toast.success(res.message || 'Course permanently deleted successfully.');
      } else {
        const res = await apiFetch(`/courses/categories/${item.id}`, { method: 'DELETE' });
        setCategories((prev) => prev.filter((cat) => cat.id !== item.id));
        toast.success(res.message || 'Category deleted successfully.');
      }
      setDeleteModalState({ isOpen: false, type: 'course', item: null, loading: false });
      await fetchCatalogue(true);
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || '';
      if (err?.status === 404 || errMsg.toLowerCase().includes('not found')) {
        setCourses((prev) => prev.filter((c) => c.id !== item.id));
        setDeleteModalState({ isOpen: false, type: 'course', item: null, loading: false });
        toast.info('Course has already been removed.');
        await fetchCatalogue(true);
        return;
      }
      setDeleteModalState((prev) => ({ ...prev, loading: false }));
      toast.error(getHumanErrorMessage(err));
    }
  };

  // -----------------------------------------------------------
  // CATEGORY MANAGER
  // -----------------------------------------------------------
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    const slug = (categoryForm.slug || categoryForm.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    setSavingCategory(true);
    try {
      if (categoryForm.id) {
        await apiFetch(`/courses/categories/${categoryForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: categoryForm.name.trim(),
            slug,
            description: categoryForm.description.trim() || null,
            icon: categoryForm.icon.trim() || null,
            sortOrder: Number(categoryForm.sortOrder) || 0,
          }),
        });
        toast.success('Category updated');
      } else {
        await apiFetch('/courses/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: categoryForm.name.trim(),
            slug,
            description: categoryForm.description.trim() || null,
            icon: categoryForm.icon.trim() || null,
            sortOrder: Number(categoryForm.sortOrder) || 0,
          }),
        });
        toast.success('Category created');
      }
      setCategoryForm({ id: '', name: '', slug: '', description: '', icon: 'BookOpen', sortOrder: 0 });
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  // -----------------------------------------------------------
  // FRANCHISE GOVERNANCE & OFFERINGS MATRIX FOR A COURSE (Single-Query Optimized)
  // -----------------------------------------------------------
  const loadFranchiseMatrix = async (courseId: string) => {
    setLoadingFranchises(true);
    try {
      const matrixRes = await apiFetch(`/courses/${courseId}/franchise-matrix`, { skipCache: true });
      const rows = Array.isArray(matrixRes.data) ? matrixRes.data : [];
      setFranchisesList(rows);

      const selectionsMap: Record<
        string,
        { isPermitted: boolean; isEnabled: boolean; customPrice: string }
      > = {};
      rows.forEach((fr: any) => {
        selectionsMap[fr.id] = {
          isPermitted: Boolean(fr.isPermitted),
          isEnabled: Boolean(fr.isEnabled),
          customPrice:
            fr.customPrice !== null && fr.customPrice !== undefined
              ? String(fr.customPrice)
              : '',
        };
      });
      setFranchiseSelections(selectionsMap);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load franchises');
    } finally {
      setLoadingFranchises(false);
    }
  };

  const openFranchiseEnablement = async (course: any) => {
    if (course.status !== 'PUBLISHED') {
      toast.warning('Publish this course first before permitting it to franchises.');
      return;
    }
    setFranchiseCourse(course);
    await loadFranchiseMatrix(course.id);
  };

  const handleSetFranchisePermission = async (franchiseId: string, nextPermitted: boolean) => {
    if (!franchiseCourse) return;
    const current = franchiseSelections[franchiseId] || {
      isPermitted: false,
      isEnabled: false,
      customPrice: '',
    };

    setFranchiseSelections((prev) => ({
      ...prev,
      [franchiseId]: { ...current, loading: true },
    }));

    try {
      await apiFetch(`/courses/franchise/${franchiseId}/permit`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: franchiseCourse.id,
          isPermitted: nextPermitted,
          isEnabled: nextPermitted,
        }),
      });
      toast.success(
        nextPermitted
          ? 'HQ permission granted & course activated for franchise'
          : 'HQ permission revoked — course hidden from franchise offerings'
      );
      setFranchiseSelections((prev) => ({
        ...prev,
        [franchiseId]: {
          ...current,
          isPermitted: nextPermitted,
          isEnabled: nextPermitted,
          loading: false,
        },
      }));
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update HQ course permission');
      setFranchiseSelections((prev) => ({
        ...prev,
        [franchiseId]: { ...current, loading: false },
      }));
    }
  };

  const handleBulkFranchisePermission = async (nextPermitted: boolean) => {
    if (!franchiseCourse) return;
    setBulkPermitting(true);
    try {
      const res = await apiFetch(`/courses/${franchiseCourse.id}/franchise-permissions`, {
        method: 'POST',
        body: JSON.stringify({
          allActiveFranchises: true,
          isPermitted: nextPermitted,
          autoEnable: nextPermitted,
        }),
      });
      toast.success(res.message || 'Updated bulk franchise permissions');
      await Promise.all([loadFranchiseMatrix(franchiseCourse.id), fetchCatalogue()]);
    } catch (err: any) {
      toast.error(err.message || 'Bulk permission update failed');
    } finally {
      setBulkPermitting(false);
    }
  };

  const handleToggleFranchiseSelection = async (franchiseId: string, nextEnabled: boolean, overridePrice?: string) => {
    if (!franchiseCourse) return;
    const current = franchiseSelections[franchiseId] || {
      isPermitted: false,
      isEnabled: false,
      customPrice: '',
    };
    const priceVal = overridePrice !== undefined ? overridePrice : current.customPrice;

    setFranchiseSelections((prev) => ({
      ...prev,
      [franchiseId]: { ...current, isEnabled: nextEnabled, customPrice: priceVal, loading: true },
    }));

    try {
      await apiFetch(`/courses/franchise/${franchiseId}/select`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: franchiseCourse.id,
          isEnabled: nextEnabled,
          customPrice: priceVal.trim() !== '' ? Number(priceVal) : null,
        }),
      });
      toast.success(nextEnabled ? 'Course enabled for franchise' : 'Course disabled for franchise');
      setFranchiseSelections((prev) => ({
        ...prev,
        [franchiseId]: { ...current, isEnabled: nextEnabled, customPrice: priceVal, loading: false },
      }));
      await fetchCatalogue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update franchise selection');
      setFranchiseSelections((prev) => ({
        ...prev,
        [franchiseId]: { ...current, loading: false },
      }));
    }
  };

  // -----------------------------------------------------------
  // RENDER WIZARD MODE
  // -----------------------------------------------------------
  if (viewMode === 'wizard') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              {editingCourse ? `Edit Course: ${editingCourse.title}` : 'Create New Global Course'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Complete Course Authoring Studio — governs syllabus, marketing sections, media attachments, and extensible features.
            </p>
          </div>
        </div>

        <CourseWizard
          initialData={editingCourse}
          categories={categories}
          onCategoryCreated={(newCat) =>
            setCategories((prev) => [
              ...prev,
              {
                id: newCat.id,
                name: newCat.name,
                slug: newCat.slug,
                description: newCat.description || null,
                icon: newCat.icon || null,
                sortOrder: newCat.sortOrder ?? prev.length,
                _count: { courses: 0 },
              },
            ])
          }
          onComplete={handleWizardComplete}
          onCreateDraftVersion={handleCreateDraftFromWizard}
          creatingDraftVersion={creatingDraftVersion}
          onCancel={() => {
            setViewMode('catalogue');
            setEditingCourse(null);
          }}
          isSaving={savingCourse}
          isEditMode={Boolean(editingCourse)}
        />
      </div>
    );
  }

  // Stats
  const totalCount = courses.length;
  const publishedCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCount = courses.filter((c) => c.status === 'DRAFT').length;
  const totalModules = courses.reduce((sum, c) => sum + (c.modulesCount ?? c.activeCurriculumVersion?.modules?.length ?? 0), 0);
  const totalLessons = courses.reduce(
    (sum, c) =>
      sum +
      (c.lessonsCount ??
        (c.activeCurriculumVersion?.modules || []).reduce((mSum: number, m: any) => mSum + (m._count?.chapters ?? m.chapters?.length ?? 0), 0)),
    0
  );
  const totalEnrollments = courses.reduce((sum, c) => sum + (c._count?.enrollments || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#006FFF] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Master Course Library
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            Course Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and manage courses, modules, lessons, videos, and control which franchises can offer each course.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchCatalogue(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCategoriesModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 shadow-sm"
          >
            <Tag className="w-4 h-4 text-indigo-600" /> Categories ({categories.length})
          </button>
          <button
            type="button"
            onClick={handleStartCreate}
            className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-[#006FFF]/25"
          >
            <Plus className="w-4 h-4" /> Add New Course
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Courses</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{totalCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Published (Live)</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">{publishedCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Drafts</div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">{draftCount}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Modules &amp; Lessons</div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1 tabular-nums">
            {totalModules} <span className="text-sm font-semibold text-slate-500">/ {totalLessons}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-slate-500">Student Enrollments</div>
          <div className="text-2xl font-extrabold text-[#006FFF] mt-1 tabular-nums">{totalEnrollments}</div>
        </div>
      </div>

      {/* Filters Bar + Grid/Table Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by name or keyword..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#006FFF] outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white outline-none"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Software Layout Toggle: Cards vs Table */}
          <div className="flex bg-slate-100 p-1 rounded-xl" title="Switch view layout">
            <button
              type="button"
              onClick={() => setDisplayLayout('grid')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                displayLayout === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" /> Cards
            </button>
            <button
              type="button"
              onClick={() => setDisplayLayout('table')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                displayLayout === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" /> Table
            </button>
          </div>
        </div>
      </div>

      {/* Course List */}
      {loading || wizardLoading || loadingCurriculum || loadingPreview ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#006FFF] mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-600">Loading courses...</div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No courses found</h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            {courses.length === 0
              ? 'Get started by adding your first Digital Guru course.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {courses.length === 0 && (
            <button
              type="button"
              onClick={handleStartCreate}
              className="px-5 py-2.5 rounded-xl bg-[#006FFF] text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add New Course
            </button>
          )}
        </div>
      ) : displayLayout === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Course</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Curriculum</th>
                  <th className="px-4 py-3.5">Fee</th>
                  <th className="px-4 py-3.5">Franchises</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((course) => {
                  const modulesCount = course.modulesCount ?? course.activeCurriculumVersion?.modules?.length ?? 0;
                  const lessonsCount =
                    course.lessonsCount ??
                    (course.activeCurriculumVersion?.modules || []).reduce(
                      (sum: number, m: any) => sum + (m._count?.chapters ?? m.chapters?.length ?? 0),
                      0
                    );
                  const statusBadge =
                    course.status === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : course.status === 'DRAFT'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <tr key={course.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{course.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {course.duration || 'Flexible'} &bull; {course.level || 'All Levels'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {course.category ? (
                          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                            {course.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{modulesCount} Modules</div>
                        <div className="text-xs text-slate-500">{lessonsCount} Lessons</div>
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {Number(course.price) > 0 ? formatCurrency(course.price) : 'Custom Fee'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        <div className="font-semibold text-slate-800">
                          {course.permittedFranchisesCount ?? 0} Allowed
                        </div>
                        <div className="text-slate-500">
                          {course._count?.enrollments || 0} Students
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge}`}>
                          {course.status === 'PUBLISHED' ? 'Live' : course.status === 'DRAFT' ? 'Draft' : 'Archived'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPreviewModal(course.id)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 text-xs font-semibold text-slate-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(course.id)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-xs font-semibold text-[#006FFF]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openCurriculumDrawer(course.id)}
                            className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-xs font-semibold text-indigo-700"
                          >
                            Lessons
                          </button>
                          <button
                            type="button"
                            onClick={() => openFranchiseEnablement(course)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold text-emerald-800"
                          >
                            Franchises
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredCourses.map((course) => {
            const modulesCount = course.modulesCount ?? course.activeCurriculumVersion?.modules?.length ?? 0;
            const lessonsCount =
              course.lessonsCount ??
              (course.activeCurriculumVersion?.modules || []).reduce(
                (sum: number, m: any) => sum + (m._count?.chapters ?? m.chapters?.length ?? 0),
                0
              );
            const statusBadge =
              course.status === 'PUBLISHED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : course.status === 'DRAFT'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-100 text-slate-600 border-slate-200';

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 flex gap-4">
                  {/* Thumbnail */}
                  <div className="w-28 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <BookOpen className="w-8 h-8 text-slate-300 absolute -z-0 pointer-events-none" />
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge}`}>
                            {course.status === 'PUBLISHED' ? 'Live' : course.status === 'DRAFT' ? 'Draft' : 'Archived'}
                          </span>
                          {course.category && (
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                              {course.category.name}
                            </span>
                          )}
                          {course.activeCurriculumVersion && (
                            <span className="text-xs font-mono text-slate-500">
                              v{course.activeCurriculumVersion.version}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-xs font-mono text-slate-400 truncate">/{course.slug}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-slate-900 tabular-nums">
                          {Number(course.price) > 0 ? formatCurrency(course.price) : 'Custom Fee'}
                        </div>
                        {course.duration && (
                          <div className="text-xs text-slate-500">{course.duration}</div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 line-clamp-2 mt-2">
                      {course.subTitle || course.description || 'No description provided.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-[#006FFF]" /> {modulesCount} Modules · {lessonsCount} Lessons
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> {course.permittedFranchisesCount ?? 0} Franchises Allowed
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600" /> {course._count?.enrollments || 0} Students
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(course.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#006FFF] text-xs font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#006FFF]" /> Edit Course
                    </button>
                    <button
                      type="button"
                      onClick={() => openCurriculumDrawer(course.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-600" /> Lessons &amp; Media
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreviewModal(course.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-400 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" /> View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => openFranchiseEnablement(course)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Assign Franchises
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {course.status !== 'PUBLISHED' && (
                      <button
                        type="button"
                        disabled={statusActionCourseId === course.id}
                        onClick={() => handleStatusAction(course, 'PUBLISHED')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {statusActionCourseId === course.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Publish
                      </button>
                    )}
                    {course.status === 'PUBLISHED' && (
                      <button
                        type="button"
                        disabled={statusActionCourseId === course.id}
                        onClick={() => handleStatusAction(course, 'DRAFT')}
                        title="Move course back to Draft"
                        className="px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 disabled:opacity-50 text-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {statusActionCourseId === course.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PauseCircle className="w-3.5 h-3.5" />
                        )}
                        Move to Draft
                      </button>
                    )}
                    {course.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        disabled={statusActionCourseId === course.id}
                        onClick={() => handleStatusAction(course, 'ARCHIVED')}
                        title="Archive course (preserves student history)"
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 text-xs font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                      >
                        {statusActionCourseId === course.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                        Archive
                      </button>
                    )}
                    {course.status === 'ARCHIVED' && (
                      <button
                        type="button"
                        onClick={() => handleStatusAction(course, 'DRAFT')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 text-xs font-bold text-slate-700"
                      >
                        Restore
                      </button>
                    )}
                    {(course._count?.enrollments || 0) === 0 && (
                      <button
                        type="button"
                        onClick={() => openDeleteCourseModal(course)}
                        title="Delete course"
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: CATEGORY MANAGER                                         */}
      {/* ================================================================= */}
      {showCategoriesModal && (
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Tag className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-extrabold text-slate-900">Manage Course Categories</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCategoriesModal(false);
                  setCategoryForm({ id: '', name: '', slug: '', description: '', icon: 'BookOpen', sortOrder: 0 });
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <form onSubmit={handleSaveCategory} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {categoryForm.id ? 'Edit Category' : 'Add New Category'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCategoryForm((prev) => ({
                        ...prev,
                        name: val,
                        slug: prev.id ? prev.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                      }));
                    }}
                    placeholder="Category Name (e.g. Digital Marketing)"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                  <input
                    type="text"
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                    placeholder="slug-identifier"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Short description..."
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                  <input
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })}
                    placeholder="Sort Order"
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {categoryForm.id && (
                    <button
                      type="button"
                      onClick={() => setCategoryForm({ id: '', name: '', slug: '', description: '', icon: 'BookOpen', sortOrder: 0 })}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="px-4 py-2 rounded-xl bg-[#006FFF] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {savingCategory && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {categoryForm.id ? 'Update Category' : 'Add Category'}
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No categories created yet.</p>
                ) : (
                  categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{cat.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">/{cat.slug}</span> · {cat._count?.courses || 0} courses · Order #{cat.sortOrder}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCategoryForm({
                              id: cat.id,
                              name: cat.name,
                              slug: cat.slug,
                              description: cat.description || '',
                              icon: cat.icon || 'BookOpen',
                              sortOrder: cat.sortOrder || 0,
                            })
                          }
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteCategoryModal(cat)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: CURRICULUM VERSIONS & LESSON VIDEOS                      */}
      {/* ================================================================= */}
      {curriculumCourse && (
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Curriculum Versions & Lesson Media</h2>
                <p className="text-xs text-slate-500">{curriculumCourse.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setCurriculumCourse(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <CurriculumManager
                courseId={curriculumCourse.id}
                courseTitle={curriculumCourse.title}
                activeCurriculumVersionId={curriculumCourse.activeCurriculumVersionId}
                versions={curriculumCourse.curriculumVersions || []}
                onVersionChanged={refreshCurriculumDrawer}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: FRANCHISE PERMISSION GOVERNANCE & OFFERINGS              */}
      {/* ================================================================= */}
      {franchiseCourse && (
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#006FFF]" />
                  Franchise Governance &amp; Course Permissions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Course: <strong>{franchiseCourse.title}</strong> — Only HQ-permitted franchises can view, enable, or enroll students into this course.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFranchiseCourse(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={franchiseSearch}
                    onChange={(e) => setFranchiseSearch(e.target.value)}
                    placeholder="Filter franchises by name or code..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#006FFF]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={bulkPermitting || loadingFranchises}
                    onClick={() => handleBulkFranchisePermission(true)}
                    className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    {bulkPermitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Allow All Franchises
                  </button>
                  <button
                    type="button"
                    disabled={bulkPermitting || loadingFranchises}
                    onClick={() => handleBulkFranchisePermission(false)}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-xs font-bold flex items-center gap-1.5"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    Remove All
                  </button>
                </div>
              </div>

              {loadingFranchises ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-[#006FFF] mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Checking franchise governance matrix...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {franchisesList
                    .filter((fr) =>
                      !franchiseSearch.trim() ||
                      fr.name.toLowerCase().includes(franchiseSearch.toLowerCase()) ||
                      (fr.code || '').toLowerCase().includes(franchiseSearch.toLowerCase())
                    )
                    .map((fr) => {
                      const state = franchiseSelections[fr.id] || {
                        isPermitted: false,
                        isEnabled: false,
                        customPrice: '',
                      };
                      return (
                        <div
                          key={fr.id}
                          className={`p-4 rounded-2xl border transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                            state.isPermitted
                              ? state.isEnabled
                                ? 'border-emerald-200 bg-emerald-50/40'
                                : 'border-blue-200 bg-blue-50/30'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{fr.name}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                                {fr.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  state.isPermitted
                                    ? 'bg-blue-50 text-[#006FFF] border-blue-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {state.isPermitted ? 'HQ Permitted' : 'Not Permitted'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {fr.city || '—'}, {fr.state || '—'} · {fr._count?.branches || fr.branches?.length || 0} Branches
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={state.loading}
                              onClick={() => handleSetFranchisePermission(fr.id, !state.isPermitted)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                                state.isPermitted
                                  ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                                  : 'bg-[#006FFF] border-[#006FFF] text-white hover:bg-blue-700'
                              }`}
                            >
                              {state.loading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : state.isPermitted ? (
                                <>
                                  <ShieldOff className="w-3.5 h-3.5" /> Remove Access
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3.5 h-3.5" /> Allow Franchise
                                </>
                              )}
                            </button>

                            {state.isPermitted && (
                              <>
                                <input
                                  type="number"
                                  value={state.customPrice}
                                  onChange={(e) =>
                                    setFranchiseSelections((prev) => ({
                                      ...prev,
                                      [fr.id]: { ...prev[fr.id], customPrice: e.target.value },
                                    }))
                                  }
                                  placeholder="Custom Fee ₹"
                                  className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                                />
                                {state.customPrice !== '' && state.isEnabled && (
                                  <button
                                    type="button"
                                    disabled={state.loading}
                                    onClick={() => handleToggleFranchiseSelection(fr.id, true, state.customPrice)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold"
                                  >
                                    Save Fee
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={state.loading}
                                  onClick={() => handleToggleFranchiseSelection(fr.id, !state.isEnabled)}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                    state.isEnabled
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                      : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {state.isEnabled ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" /> Active
                                    </>
                                  ) : (
                                    'Turn On'
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 4: FULL 10-STEP + EXTENSIBLE COURSE PREVIEW                 */}
      {/* ================================================================= */}
      {previewCourse && (
        <div className="fixed inset-0 !m-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#006FFF]" />
                <h2 className="text-lg font-extrabold text-slate-900">Complete Course Preview (10 Sections + Extensible Config)</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCourse(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8">
              {/* Step 1: Hero Banner, Thumbnail, Meta & Pricing */}
              <div className="rounded-2xl bg-slate-900 text-white p-6 relative overflow-hidden">
                {previewCourse.bannerUrl && (
                  <img
                    src={previewCourse.bannerUrl}
                    alt={previewCourse.title}
                    className="w-full h-48 object-cover rounded-xl mb-5 opacity-95"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  {previewCourse.thumbnailUrl && (
                    <img
                      src={previewCourse.thumbnailUrl}
                      alt={`${previewCourse.title} card`}
                      className="w-28 h-24 rounded-xl object-cover border border-white/20 shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">
                        {previewCourse.format || 'Online / Classroom'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                        {previewCourse.level || 'Beginner to Advanced'}
                      </span>
                      {previewCourse.duration && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 text-xs font-bold">
                          {previewCourse.duration}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                        Career Services: {previewCourse.overviewJson?.showCareerFeatures !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <h1 className="text-2xl font-extrabold">{previewCourse.title}</h1>
                    {previewCourse.subTitle && <p className="text-slate-300 text-sm mt-1">{previewCourse.subTitle}</p>}
                    <p className="text-slate-300 text-sm mt-3 leading-relaxed">{previewCourse.description}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl px-4 py-3 text-right shrink-0">
                    <div className="text-[11px] uppercase tracking-wider text-slate-300 font-bold">Program Fee</div>
                    <div className="text-xl font-extrabold text-white mt-0.5">
                      {previewCourse.overviewJson?.discountedPrice ||
                        (Number(previewCourse.price) > 0 ? formatCurrency(previewCourse.price) : 'Custom Fee')}
                    </div>
                    {previewCourse.overviewJson?.originalPrice && (
                      <div className="text-xs text-slate-400 line-through">
                        {previewCourse.overviewJson.originalPrice}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-slate-300">
                  {previewCourse.overviewJson?.batchInfo && <span>Batch: {previewCourse.overviewJson.batchInfo}</span>}
                  {previewCourse.overviewJson?.location && <span>Locations: {previewCourse.overviewJson.location}</span>}
                  {previewCourse.prerequisites && <span>Prerequisites: {previewCourse.prerequisites}</span>}
                  {Array.isArray(previewCourse.slugAliases) && previewCourse.slugAliases.length > 0 && (
                    <span className="font-mono text-[11px] text-slate-400">
                      Aliases: {previewCourse.slugAliases.map((s: any) => s.oldSlug).join(', ')}
                    </span>
                  )}
                  {previewCourse.brochureUrl && (
                    <a
                      href={previewCourse.brochureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-amber-300 hover:underline font-bold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Brochure PDF
                    </a>
                  )}
                </div>
              </div>

              {/* Step 1 (continued): Overview, USPs & Outcomes */}
              {(previewCourse.overviewJson?.overviewDescription?.length > 0 ||
                previewCourse.overviewJson?.usps?.length > 0 ||
                previewCourse.learningOutcomes?.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-base font-extrabold text-slate-900">Course Overview, USPs &amp; Learning Outcomes</h3>
                  {Array.isArray(previewCourse.overviewJson?.overviewDescription) &&
                    previewCourse.overviewJson.overviewDescription.map((p: string, i: number) => (
                      <p key={i} className="text-sm text-slate-600 leading-relaxed">{p}</p>
                    ))}
                  {Array.isArray(previewCourse.overviewJson?.usps) && previewCourse.overviewJson.usps.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {previewCourse.overviewJson.usps.map((usp: string, i: number) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#006FFF]">
                          {usp}
                        </span>
                      ))}
                    </div>
                  )}
                  {Array.isArray(previewCourse.learningOutcomes) && previewCourse.learningOutcomes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {previewCourse.learningOutcomes.map((item: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Designed To Help */}
              {previewCourse.designedToHelpJson?.benefits?.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {previewCourse.designedToHelpJson.title || 'Designed To Help'}
                  </h3>
                  {previewCourse.designedToHelpJson.subtitle && (
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">{previewCourse.designedToHelpJson.subtitle}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewCourse.designedToHelpJson.benefits.map((b: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                        <IconRenderer name={b.iconName || 'Sparkles'} className="w-5 h-5 text-[#006FFF] shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-sm text-slate-900">{b.title}</div>
                          <p className="text-xs text-slate-600 mt-1">{b.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Numbered Features */}
              {previewCourse.numberedFeaturesJson?.features?.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {previewCourse.numberedFeaturesJson.sectionTitle || 'Course Features'}
                  </h3>
                  {previewCourse.numberedFeaturesJson.sectionSubtitle && (
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">{previewCourse.numberedFeaturesJson.sectionSubtitle}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {previewCourse.numberedFeaturesJson.features.map((f: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <span className="text-xs font-extrabold text-[#006FFF]">{f.number || `0${i + 1}`}</span>
                        <div className="font-bold text-sm text-slate-900 mt-1">{f.title}</div>
                        <p className="text-xs text-slate-600 mt-1">{f.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Why Digital Ghuru */}
              {previewCourse.whyDigitalGhuruJson?.features?.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {previewCourse.whyDigitalGhuruJson.sectionTitle || 'Why Digital Ghuru'}
                  </h3>
                  {previewCourse.whyDigitalGhuruJson.sectionSubtitle && (
                    <p className="text-xs text-slate-500 mt-0.5 mb-3">{previewCourse.whyDigitalGhuruJson.sectionSubtitle}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {previewCourse.whyDigitalGhuruJson.features.map((w: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <IconRenderer name={w.iconName || 'Award'} className="w-5 h-5 text-indigo-600 mb-2" />
                        <div className="font-bold text-sm text-slate-900">{w.title}</div>
                        <p className="text-xs text-slate-600 mt-1">{w.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Target Audience (Who Is This For) */}
              {Array.isArray(previewCourse.overviewJson?.whoIsThisForData) &&
                previewCourse.overviewJson.whoIsThisForData.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-3">Who Is This Program For?</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {previewCourse.overviewJson.whoIsThisForData.map((a: any, i: number) => {
                        const title = a.title || a.role || 'Learner Persona';
                        const desc = a.description || a.desc || '';
                        const bullets = Array.isArray(a.bullets) && a.bullets.length > 0
                          ? a.bullets
                          : (Array.isArray(a.points) ? a.points : []);
                        return (
                          <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-white">
                            <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                              <IconRenderer name={a.iconName || 'Users'} className="w-4 h-4 text-[#006FFF]" />
                              {title}
                            </div>
                            {desc && <p className="text-xs text-slate-600 mt-1">{desc}</p>}
                            {bullets.length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
                                {bullets.map((pt: string, bIdx: number) => (
                                  <li key={bIdx}>{pt}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Step 6: Highlights */}
              {Array.isArray(previewCourse.topHighlightsJson) && previewCourse.topHighlightsJson.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-3">Program Highlights</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {previewCourse.topHighlightsJson.map((hl: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                        <IconRenderer name={hl.iconName || 'Award'} className="w-5 h-5 text-[#006FFF] mb-2" />
                        <div className="font-bold text-sm text-slate-900">{hl.title}</div>
                        <div className="text-xs text-slate-600 mt-1">{hl.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 7: Tools Mastered */}
              {Array.isArray(previewCourse.overviewJson?.categorizedToolsData) &&
                previewCourse.overviewJson.categorizedToolsData.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-[#006FFF]" /> Tools &amp; Platforms Covered
                    </h3>
                    <div className="space-y-3">
                      {previewCourse.overviewJson.categorizedToolsData.map((grp: any, gIdx: number) => (
                        <div key={gIdx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                            {grp.category || grp.title || 'Tools'}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(grp.tools || grp.items || []).map((t: any, tIdx: number) => (
                              <span
                                key={tIdx}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800"
                              >
                                {t.iconUrl && (
                                  <img src={t.iconUrl} alt={t.name} className="w-4 h-4 object-contain" />
                                )}
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Step 8: Modules, Lessons, Videos & Attachments */}
              {Array.isArray(previewCourse.modules) && previewCourse.modules.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Curriculum Syllabus ({previewCourse.modules.length} Modules &middot;{' '}
                      {previewCourse.modules.reduce((s: number, m: any) => s + (m.chapters || m.lessons || []).length, 0)} Lessons)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allOpen: Record<number, boolean> = {};
                          previewCourse.modules.forEach((_: any, idx: number) => {
                            allOpen[idx] = true;
                          });
                          setExpandedPreviewModules(allOpen);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                      >
                        Expand All
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedPreviewModules({})}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {previewCourse.modules.map((mod: any, mIdx: number) => {
                      const isExpanded = Boolean(expandedPreviewModules[mIdx]);
                      const modLessons = mod.chapters || mod.lessons || [];
                      return (
                        <div key={mod.id || mIdx} className="rounded-2xl border border-slate-200 overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPreviewModules((prev) => ({
                                ...prev,
                                [mIdx]: !prev[mIdx],
                              }))
                            }
                            className="w-full bg-slate-50 hover:bg-slate-100 px-4 py-3 font-bold text-sm text-slate-900 flex items-center justify-between text-left transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#006FFF]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                              {mod.title}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold">{modLessons.length} lessons</span>
                          </button>
                          {isExpanded && (
                            <div className="divide-y divide-slate-100 bg-white">
                              {modLessons.map((ch: any, cIdx: number) => (
                                <div key={ch.id || cIdx} className="px-4 py-3 text-sm text-slate-700 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                                      <PlayCircle className="w-4 h-4 text-[#006FFF] shrink-0" /> {ch.title}
                                      {ch.isFree && (
                                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">
                                          Free Preview
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-slate-500 font-mono text-xs shrink-0">{ch.duration || '10:00'}</span>
                                  </div>
                                  {ch.description && <p className="text-xs text-slate-500 pl-6">{ch.description}</p>}
                                  <div className="flex flex-wrap items-center gap-3 pl-6 text-xs">
                                    {ch.videoUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openMediaResource({
                                            url: ch.videoUrl,
                                            courseId: previewCourse.id,
                                            type: 'video',
                                            onError: (msg) => toast.error(msg),
                                          })
                                        }
                                        className="text-[#006FFF] hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" /> Open Video
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 italic">No video attached</span>
                                    )}
                                    {ch.pdfUrl && (() => {
                                      const meta = getMediaResourceMeta(ch.pdfUrl);
                                      return (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openMediaResource({
                                              url: ch.pdfUrl,
                                              courseId: previewCourse.id,
                                              type: 'document',
                                              onError: (msg) => toast.error(msg),
                                            })
                                          }
                                          className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>Open {meta.label}</span>
                                          <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            {meta.badge}
                                          </span>
                                        </button>
                                      );
                                    })()}
                                    {Array.isArray(ch.attachments) && ch.attachments.length > 0 && (
                                      <span className="inline-flex flex-wrap items-center gap-2">
                                        {ch.attachments.map((a: any, aIdx: number) => (
                                          <button
                                            key={a.id || aIdx}
                                            type="button"
                                            onClick={() =>
                                              openMediaResource({
                                                url: a.fileUrl,
                                                courseId: previewCourse.id,
                                                type: 'attachment',
                                                onError: (msg) => toast.error(msg),
                                              })
                                            }
                                            className="text-indigo-700 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                                          >
                                            <Paperclip className="w-3.5 h-3.5" />
                                            {a.title} ({a.fileType})
                                          </button>
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 9: FAQs */}
              {Array.isArray(previewCourse.faqsJson) && previewCourse.faqsJson.length > 0 && (
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-3">Frequently Asked Questions</h3>
                  <div className="space-y-2">
                    {previewCourse.faqsJson.map((faq: any, i: number) => (
                      <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-[#006FFF]" /> {faq.question}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 pl-5">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 10/11: Extensible Architecture Config */}
              {previewCourse.overviewJson?.extensibleConfig && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-4">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Extensible Course Architecture &amp; Feature Configuration
                  </div>

                  {previewCourse.overviewJson.extensibleConfig.featureFlags && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                        XP Rewards: {previewCourse.overviewJson.extensibleConfig.featureFlags.xpEnabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                        Lesson XP: +{previewCourse.overviewJson.extensibleConfig.featureFlags.lessonXp ?? 10}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                        Completion Bonus: +{previewCourse.overviewJson.extensibleConfig.featureFlags.completionXp ?? 100} XP
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                        Certificates: {previewCourse.overviewJson.extensibleConfig.featureFlags.certificatesEnabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  )}

                  {Array.isArray(previewCourse.overviewJson.extensibleConfig.customAttributes) &&
                    previewCourse.overviewJson.extensibleConfig.customAttributes.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {previewCourse.overviewJson.extensibleConfig.customAttributes.map((attr: any, i: number) => (
                          <div key={i} className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs flex justify-between">
                            <span className="font-bold text-slate-700">{attr.label || attr.key}</span>
                            <span className="text-slate-600">{String(attr.value || '')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  {Array.isArray(previewCourse.overviewJson.extensibleConfig.customSections) &&
                    previewCourse.overviewJson.extensibleConfig.customSections.length > 0 && (
                      <div className="space-y-2">
                        {previewCourse.overviewJson.extensibleConfig.customSections.map((sec: any, sIdx: number) => (
                          <div key={sIdx} className="p-3.5 rounded-xl bg-white border border-slate-200">
                            <div className="font-bold text-xs text-slate-900">{sec.title}</div>
                            {sec.subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{sec.subtitle}</p>}
                            {Array.isArray(sec.items) && sec.items.length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
                                {sec.items.map((it: any, itIdx: number) => (
                                  <li key={itIdx}>
                                    <strong>{it.title}</strong>
                                    {it.description ? ` — ${it.description}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Course / Category */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title={deleteModalState.type === 'course' ? 'Delete Course' : 'Delete Category'}
        message={
          deleteModalState.type === 'course'
            ? `Are you sure you want to permanently delete "${deleteModalState.item?.title || 'this course'}"? This action cannot be undone.`
            : `Are you sure you want to delete category "${deleteModalState.item?.name || 'this category'}"? Any courses assigned to this category will need to be reassigned.`
        }
        confirmLabel={deleteModalState.type === 'course' ? 'Delete Course' : 'Delete Category'}
        cancelLabel="Cancel"
        variant="danger"
        loading={deleteModalState.loading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteModalState.loading) {
            setDeleteModalState({ isOpen: false, type: 'course', item: null, loading: false });
          }
        }}
      />
    </div>
  );
};

