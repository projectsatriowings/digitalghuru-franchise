import React, { useState, useEffect } from 'react';
import {
  FileVideo,
  Check,
  X,
  Pencil,
  Lock,
  Unlock,
  GitBranch,
  Plus,
  Rocket,
  Loader2,
  ExternalLink,
  FileText,
  Clock,
  Paperclip,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Layers,
  Save,
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../services/api';
import { useToast } from '../context/ToastContext';

interface Attachment {
  id?: string;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  isDownload?: boolean;
}

interface Chapter {
  id?: string;
  moduleId?: string;
  title: string;
  description?: string | null;
  videoUrl: string | null;
  pdfUrl?: string | null;
  duration?: string | null;
  position: number;
  isFree?: boolean;
  attachments?: Attachment[];
}

interface Module {
  id?: string;
  title: string;
  description?: string | null;
  position: number;
  chapters: Chapter[];
}

interface CurriculumVersion {
  id: string;
  version: number;
  title: string;
  isPublished: boolean;
  isLocked: boolean;
  publishedAt?: string | null;
  modules: Module[];
}

interface CurriculumManagerProps {
  courseId: string;
  courseTitle: string;
  activeCurriculumVersionId?: string | null;
  versions: CurriculumVersion[];
  onVersionChanged: () => void;
}

export const CurriculumManager: React.FC<CurriculumManagerProps> = ({
  courseId,
  courseTitle,
  activeCurriculumVersionId,
  versions,
  onVersionChanged,
}) => {
  const toast = useToast();
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    videoUrl: string;
    pdfUrl: string;
    duration: string;
    isFree: boolean;
    attachments: Attachment[];
  }>({
    title: '',
    description: '',
    videoUrl: '',
    pdfUrl: '',
    duration: '10:00',
    isFree: false,
    attachments: [],
  });
  const [savingChapter, setSavingChapter] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Full structural editor state for unlocked drafts (Add/Reorder/Delete modules & lessons)
  const [structureMode, setStructureMode] = useState(false);
  const [draftModules, setDraftModules] = useState<Module[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);

  useEffect(() => {
    if (versions.length > 0) {
      const unlockedDraft = versions.find((v) => !v.isLocked && !v.isPublished);
      if (unlockedDraft) {
        setSelectedVersionId(unlockedDraft.id);
      } else if (activeCurriculumVersionId) {
        setSelectedVersionId(activeCurriculumVersionId);
      } else {
        setSelectedVersionId(versions[0].id);
      }
    }
  }, [versions, activeCurriculumVersionId]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) || versions[0];
  const isVersionLocked = Boolean(selectedVersion?.isLocked || selectedVersion?.isPublished);

  useEffect(() => {
    if (selectedVersion && Array.isArray(selectedVersion.modules)) {
      setDraftModules(
        selectedVersion.modules.map((m, mIdx) => ({
          id: m.id,
          title: m.title || `Module ${mIdx + 1}`,
          description: m.description || '',
          position: mIdx,
          chapters: (m.chapters || []).map((c, cIdx) => ({
            id: c.id,
            moduleId: c.moduleId,
            title: c.title || `Lesson ${cIdx + 1}`,
            description: c.description || '',
            videoUrl: c.videoUrl || '',
            pdfUrl: c.pdfUrl || '',
            duration: c.duration || '10:00',
            position: cIdx,
            isFree: Boolean(c.isFree),
            attachments: Array.isArray(c.attachments)
              ? c.attachments.map((att) => ({
                  id: att.id,
                  title: att.title || 'Resource',
                  fileUrl: att.fileUrl,
                  fileType: att.fileType || 'PDF',
                  fileSize: att.fileSize || 0,
                  isDownload: att.isDownload !== undefined ? Boolean(att.isDownload) : true,
                }))
              : [],
          })),
        }))
      );
    } else {
      setDraftModules([]);
    }
    setStructureMode(false);
    setEditingChapterId(null);
  }, [selectedVersionId, versions]);

  const inferAttachmentType = (mimeType: string, filename: string): 'PDF' | 'ZIP' | 'DOCUMENT' | 'IMAGE' => {
    const m = (mimeType || '').toLowerCase();
    const ext = filename.toLowerCase();
    if (m.includes('pdf') || ext.endsWith('.pdf')) return 'PDF';
    if (m.includes('zip') || ext.endsWith('.zip')) return 'ZIP';
    if (m.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(ext)) return 'IMAGE';
    return 'DOCUMENT';
  };

  const uploadCourseFile = async (file: File, folder: 'resources' | 'attachments') => {
    setUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append('folder', folder);
      formData.append('file', file);
      const token = getAuthToken();
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const res = await fetch(`${apiBase}/courses/upload?folder=${encodeURIComponent(folder)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json();
      const uploadedUrl = json?.data?.fileUrl || json?.url;
      if (!res.ok || !json.success || !uploadedUrl) {
        throw new Error(json.message || 'Upload failed');
      }
      return uploadedUrl as string;
    } finally {
      setUploadingAsset(false);
    }
  };

  const handleStartEdit = (chapter: Chapter) => {
    if (isVersionLocked) {
      toast.warning('Locked version: Create a new draft version before editing lessons.');
      return;
    }
    setEditingChapterId(chapter.id || null);
    setEditForm({
      title: chapter.title || '',
      description: chapter.description || '',
      videoUrl: chapter.videoUrl || '',
      pdfUrl: chapter.pdfUrl || '',
      duration: chapter.duration || '10:00',
      isFree: Boolean(chapter.isFree),
      attachments: Array.isArray(chapter.attachments)
        ? chapter.attachments.map((a) => ({
            title: a.title || 'Resource',
            fileUrl: a.fileUrl,
            fileType: a.fileType || 'PDF',
            fileSize: a.fileSize || 0,
            isDownload: a.isDownload !== undefined ? Boolean(a.isDownload) : true,
          }))
        : [],
    });
  };

  const handleSaveChapter = async (chapterId: string) => {
    if (!editForm.title.trim()) {
      toast.error('Lesson title cannot be empty');
      return;
    }
    setSavingChapter(true);
    try {
      const cleanAttachments = editForm.attachments
        .filter((a) => a.title.trim() && a.fileUrl.trim())
        .map((a) => ({
          title: a.title.trim(),
          fileUrl: a.fileUrl.trim(),
          fileType: (a.fileType || 'PDF').toUpperCase(),
          fileSize: Number(a.fileSize) || 0,
          isDownload: a.isDownload !== undefined ? Boolean(a.isDownload) : true,
        }));

      await apiFetch(`/courses/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          videoUrl: editForm.videoUrl.trim() || null,
          pdfUrl: editForm.pdfUrl.trim() || null,
          duration: editForm.duration.trim() || '10:00',
          isFree: Boolean(editForm.isFree),
          attachments: cleanAttachments,
        }),
      });
      toast.success('Lesson & attachments updated successfully');
      setEditingChapterId(null);
      onVersionChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update lesson');
    } finally {
      setSavingChapter(false);
    }
  };

  const handleSaveStructure = async () => {
    if (!selectedVersion || isVersionLocked) return;
    if (draftModules.some((m) => !m.title.trim())) {
      toast.error('Every module must have a title');
      return;
    }
    setSavingStructure(true);
    try {
      const payload = {
        modules: draftModules.map((m, mIdx) => ({
          title: m.title.trim(),
          description: m.description?.trim() || null,
          position: mIdx,
          chapters: (m.chapters || []).map((c, cIdx) => ({
            title: c.title.trim() || `Lesson ${cIdx + 1}`,
            description: c.description?.trim() || null,
            videoUrl: c.videoUrl?.trim() || null,
            pdfUrl: c.pdfUrl?.trim() || null,
            duration: c.duration?.trim() || '10:00',
            position: cIdx,
            isFree: Boolean(c.isFree),
            attachments: (c.attachments || [])
              .filter((a) => a.title.trim() && a.fileUrl.trim())
              .map((a) => ({
                title: a.title.trim(),
                fileUrl: a.fileUrl.trim(),
                fileType: (a.fileType || 'PDF').toUpperCase(),
                fileSize: Number(a.fileSize) || 0,
                isDownload: a.isDownload !== undefined ? Boolean(a.isDownload) : true,
              })),
          })),
        })),
      };
      await apiFetch(`/courses/${courseId}/versions/${selectedVersion.id}/curriculum`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      toast.success('Draft curriculum structure saved');
      setStructureMode(false);
      onVersionChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft curriculum');
    } finally {
      setSavingStructure(false);
    }
  };

  const handleCreateDraft = async () => {
    setCreatingDraft(true);
    try {
      const res = await apiFetch(`/courses/${courseId}/versions`, {
        method: 'POST',
      });
      toast.success('New editable draft version created');
      if (res.data?.id) {
        setSelectedVersionId(res.data.id);
      }
      onVersionChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create draft version');
    } finally {
      setCreatingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await apiFetch(`/courses/${courseId}/publish`, {
        method: 'POST',
      });
      toast.success('Curriculum version published & locked!');
      onVersionChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish curriculum');
    } finally {
      setPublishing(false);
    }
  };

  const hasUnlockedDraft = versions.some((v) => !v.isLocked && !v.isPublished);

  return (
    <div className="space-y-5">
      {/* Version Control Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#006FFF]" />
            <span className="text-sm font-bold text-slate-900 font-display">{courseTitle}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {versions.map((v) => {
              const active = v.id === selectedVersion?.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVersionId(v.id);
                    setEditingChapterId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    active
                      ? 'bg-[#006FFF] text-white border-[#006FFF] shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {v.isLocked || v.isPublished ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                  v{v.version}.0 {v.isPublished ? '(Live)' : '(Draft)'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hasUnlockedDraft && (
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={creatingDraft}
              className="px-4 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition"
            >
              {creatingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Draft Version to Edit
            </button>
          )}
          {selectedVersion && !isVersionLocked && (
            <>
              <button
                type="button"
                onClick={() => setStructureMode((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                  structureMode
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {structureMode ? 'Exit Structure Editor' : 'Add / Reorder Modules & Lessons'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || structureMode}
                title={structureMode ? 'Save or exit structure editor before publishing' : undefined}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                Publish Draft v{selectedVersion.version}.0
              </button>
            </>
          )}
        </div>
      </div>

      {/* Immutability Notice Banner */}
      {isVersionLocked && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Immutable Published Version:</strong> Curriculum v{selectedVersion?.version}.0 is published and cryptographically locked at the database level so existing student progress &amp; certificates are never broken.{' '}
            {hasUnlockedDraft
              ? 'Switch to your unlocked Draft tab above to edit modules & lessons.'
              : 'Click "Create Draft Version to Edit" to clone this curriculum into an editable draft.'}
          </div>
        </div>
      )}

      {/* STRUCTURAL CURRICULUM BUILDER MODE (for unlocked drafts) */}
      {!isVersionLocked && structureMode ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-blue-900">
              Structural Editor for Draft v{selectedVersion?.version}.0 — add, rename, reorder, or remove modules & lessons, then save.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftModules((prev) => [
                    ...prev,
                    {
                      title: `Module ${prev.length + 1}`,
                      description: '',
                      position: prev.length,
                      chapters: [
                        {
                          title: 'New Lesson 1',
                          description: '',
                          videoUrl: '',
                          pdfUrl: '',
                          duration: '15:00',
                          position: 0,
                          isFree: false,
                          attachments: [],
                        },
                      ],
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-[#006FFF] text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Module
              </button>
              <button
                type="button"
                onClick={handleSaveStructure}
                disabled={savingStructure}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {savingStructure ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Curriculum Structure
              </button>
            </div>
          </div>

          {draftModules.map((mod, mIdx) => (
            <div key={mIdx} className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex-1 min-w-[220px] flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase text-[#006FFF] shrink-0">M{mIdx + 1}</span>
                  <input
                    type="text"
                    value={mod.title}
                    onChange={(e) => {
                      const next = [...draftModules];
                      next[mIdx] = { ...next[mIdx], title: e.target.value };
                      setDraftModules(next);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={mIdx === 0}
                    onClick={() => {
                      const next = [...draftModules];
                      [next[mIdx - 1], next[mIdx]] = [next[mIdx], next[mIdx - 1]];
                      setDraftModules(next);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 text-slate-600"
                    title="Move Module Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={mIdx === draftModules.length - 1}
                    onClick={() => {
                      const next = [...draftModules];
                      [next[mIdx], next[mIdx + 1]] = [next[mIdx + 1], next[mIdx]];
                      setDraftModules(next);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 text-slate-600"
                    title="Move Module Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...draftModules];
                      next[mIdx] = {
                        ...next[mIdx],
                        chapters: [
                          ...next[mIdx].chapters,
                          {
                            title: `Lesson ${next[mIdx].chapters.length + 1}`,
                            description: '',
                            videoUrl: '',
                            pdfUrl: '',
                            duration: '15:00',
                            position: next[mIdx].chapters.length,
                            isFree: false,
                            attachments: [],
                          },
                        ],
                      };
                      setDraftModules(next);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#006FFF] text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Lesson
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftModules((prev) => prev.filter((_, idx) => idx !== mIdx))}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                    title="Remove Module"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 p-3 space-y-2">
                {mod.chapters.map((ch, cIdx) => (
                  <div key={cIdx} className="pt-2 first:pt-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      value={ch.title}
                      onChange={(e) => {
                        const next = [...draftModules];
                        const chs = [...next[mIdx].chapters];
                        chs[cIdx] = { ...chs[cIdx], title: e.target.value };
                        next[mIdx] = { ...next[mIdx], chapters: chs };
                        setDraftModules(next);
                      }}
                      placeholder="Lesson Title"
                      className="md:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                    />
                    <input
                      type="url"
                      value={ch.videoUrl || ''}
                      onChange={(e) => {
                        const next = [...draftModules];
                        const chs = [...next[mIdx].chapters];
                        chs[cIdx] = { ...chs[cIdx], videoUrl: e.target.value };
                        next[mIdx] = { ...next[mIdx], chapters: chs };
                        setDraftModules(next);
                      }}
                      placeholder="Video URL"
                      className="md:col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      value={ch.duration || ''}
                      onChange={(e) => {
                        const next = [...draftModules];
                        const chs = [...next[mIdx].chapters];
                        chs[cIdx] = { ...chs[cIdx], duration: e.target.value };
                        next[mIdx] = { ...next[mIdx], chapters: chs };
                        setDraftModules(next);
                      }}
                      placeholder="15:00"
                      className="md:col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    />
                    <label className="md:col-span-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(ch.isFree)}
                        onChange={(e) => {
                          const next = [...draftModules];
                          const chs = [...next[mIdx].chapters];
                          chs[cIdx] = { ...chs[cIdx], isFree: e.target.checked };
                          next[mIdx] = { ...next[mIdx], chapters: chs };
                          setDraftModules(next);
                        }}
                      />
                      Free
                    </label>
                    <div className="md:col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={cIdx === 0}
                        onClick={() => {
                          const next = [...draftModules];
                          const chs = [...next[mIdx].chapters];
                          [chs[cIdx - 1], chs[cIdx]] = [chs[cIdx], chs[cIdx - 1]];
                          next[mIdx] = { ...next[mIdx], chapters: chs };
                          setDraftModules(next);
                        }}
                        className="p-1 rounded border border-slate-200 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={cIdx === mod.chapters.length - 1}
                        onClick={() => {
                          const next = [...draftModules];
                          const chs = [...next[mIdx].chapters];
                          [chs[cIdx], chs[cIdx + 1]] = [chs[cIdx + 1], chs[cIdx]];
                          next[mIdx] = { ...next[mIdx], chapters: chs };
                          setDraftModules(next);
                        }}
                        className="p-1 rounded border border-slate-200 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...draftModules];
                          next[mIdx] = {
                            ...next[mIdx],
                            chapters: next[mIdx].chapters.filter((_, j) => j !== cIdx),
                          };
                          setDraftModules(next);
                        }}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !selectedVersion || !selectedVersion.modules || selectedVersion.modules.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm text-slate-500">
            No modules found in this curriculum version.{' '}
            {!isVersionLocked ? 'Click "Add / Reorder Modules & Lessons" above or edit via Course Wizard.' : ''}
          </p>
        </div>
      ) : (
        /* NORMAL LESSON MEDIA & ATTACHMENT EDITOR */
        <div className="space-y-4">
          {selectedVersion.modules.map((mod, mIdx) => (
            <div key={mod.id || mIdx} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#006FFF]">Module {mIdx + 1}</span>
                  <h3 className="font-display text-sm font-bold text-slate-900">{mod.title}</h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">{mod.chapters?.length || 0} Lessons</span>
              </div>

              <div className="divide-y divide-slate-100">
                {(!mod.chapters || mod.chapters.length === 0) ? (
                  <p className="p-4 text-center text-xs text-slate-400 italic">No lessons in this module</p>
                ) : (
                  mod.chapters.map((ch, cIdx) => {
                    const isEditing = editingChapterId === ch.id;
                    const attachments = ch.attachments || [];
                    return (
                      <div key={ch.id || cIdx} className="p-4 hover:bg-slate-50/70 transition-colors">
                        {!isEditing ? (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <FileVideo className={`w-4 h-4 mt-0.5 shrink-0 ${ch.videoUrl ? 'text-[#006FFF]' : 'text-slate-300'}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800">
                                    {cIdx + 1}. {ch.title}
                                  </span>
                                  {ch.isFree && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                      Free Preview
                                    </span>
                                  )}
                                </div>
                                {ch.description && (
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ch.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {ch.duration || '10:00'}
                                  </span>
                                  {ch.videoUrl ? (
                                    <a
                                      href={ch.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#006FFF] hover:underline flex items-center gap-1 max-w-[300px] truncate"
                                    >
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{ch.videoUrl}</span>
                                    </a>
                                  ) : (
                                    <span className="text-amber-600 italic">No video link set</span>
                                  )}
                                  {ch.pdfUrl && (
                                    <a
                                      href={ch.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 hover:underline flex items-center gap-1"
                                    >
                                      <FileText className="w-3 h-3" /> Primary PDF
                                    </a>
                                  )}
                                  {attachments.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-indigo-600 font-semibold">
                                      <Paperclip className="w-3 h-3" /> {attachments.length} attachment(s)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {!isVersionLocked && ch.id && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(ch)}
                                className="self-start sm:self-center text-xs font-semibold flex items-center gap-1.5 text-slate-600 hover:text-[#006FFF] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 transition-colors shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit Lesson
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Lesson Title</label>
                                <input
                                  type="text"
                                  value={editForm.title}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#006FFF]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Duration</label>
                                <input
                                  type="text"
                                  value={editForm.duration}
                                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                                  placeholder="e.g. 15:00"
                                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#006FFF]"
                                />
                              </div>
                              <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editForm.isFree}
                                    onChange={(e) => setEditForm({ ...editForm, isFree: e.target.checked })}
                                  />
                                  Free Preview Lesson
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Lesson Description (Optional)</label>
                              <textarea
                                rows={2}
                                value={editForm.description}
                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                placeholder="Lesson notes or summary..."
                                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#006FFF]"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Video Link (Google Drive / YouTube / MP4)
                                </label>
                                <input
                                  type="url"
                                  value={editForm.videoUrl}
                                  onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })}
                                  placeholder="https://drive.google.com/file/d/.../view or YouTube link"
                                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#006FFF]"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Primary Lesson PDF / Resource Link
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editForm.pdfUrl}
                                    onChange={(e) => setEditForm({ ...editForm, pdfUrl: e.target.value })}
                                    placeholder="/api/courses/media/... or https://..."
                                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#006FFF]"
                                  />
                                  <label className="px-2.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1 shrink-0">
                                    <Upload className="w-3.5 h-3.5" /> PDF
                                    <input
                                      type="file"
                                      accept=".pdf"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                          const url = await uploadCourseFile(file, 'resources');
                                          setEditForm((prev) => ({ ...prev, pdfUrl: url }));
                                          toast.success('Primary PDF uploaded');
                                        } catch (err: any) {
                                          toast.error(err.message || 'PDF upload failed');
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>

                            {/* Multi-Attachments Manager */}
                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                  <Paperclip className="w-3.5 h-3.5 text-[#006FFF]" />
                                  Lesson Attachments ({editForm.attachments.length})
                                </span>
                                <div className="flex items-center gap-2">
                                  <label className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#006FFF] hover:bg-blue-100 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                                    {uploadingAsset ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    Upload File
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                          const url = await uploadCourseFile(file, 'attachments');
                                          const attType = inferAttachmentType(file.type || '', file.name);
                                          setEditForm((prev) => ({
                                            ...prev,
                                            attachments: [
                                              ...prev.attachments,
                                              {
                                                title: file.name,
                                                fileUrl: url,
                                                fileType: attType,
                                                fileSize: file.size,
                                                isDownload: true,
                                              },
                                            ],
                                          }));
                                          toast.success(`Attached "${file.name}"`);
                                        } catch (err: any) {
                                          toast.error(err.message || 'Attachment upload failed');
                                        }
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        attachments: [
                                          ...prev.attachments,
                                          { title: '', fileUrl: '', fileType: 'PDF', isDownload: true },
                                        ],
                                      }))
                                    }
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-bold"
                                  >
                                    + Add Link
                                  </button>
                                </div>
                              </div>

                              {editForm.attachments.map((att, aIdx) => (
                                <div key={aIdx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                  <input
                                    type="text"
                                    value={att.title}
                                    onChange={(e) => {
                                      const next = [...editForm.attachments];
                                      next[aIdx] = { ...next[aIdx], title: e.target.value };
                                      setEditForm({ ...editForm, attachments: next });
                                    }}
                                    placeholder="Attachment Title"
                                    className="md:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                  />
                                  <input
                                    type="text"
                                    value={att.fileUrl}
                                    onChange={(e) => {
                                      const next = [...editForm.attachments];
                                      next[aIdx] = { ...next[aIdx], fileUrl: e.target.value };
                                      setEditForm({ ...editForm, attachments: next });
                                    }}
                                    placeholder="URL or uploaded path"
                                    className="md:col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                                  />
                                  <select
                                    value={att.fileType}
                                    onChange={(e) => {
                                      const next = [...editForm.attachments];
                                      next[aIdx] = { ...next[aIdx], fileType: e.target.value };
                                      setEditForm({ ...editForm, attachments: next });
                                    }}
                                    className="md:col-span-2 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                                  >
                                    <option value="PDF">PDF</option>
                                    <option value="DOCUMENT">DOC / SHEET</option>
                                    <option value="ZIP">ZIP</option>
                                    <option value="IMAGE">IMAGE</option>
                                    <option value="EXTERNAL_LINK">LINK</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        attachments: prev.attachments.filter((_, j) => j !== aIdx),
                                      }))
                                    }
                                    className="md:col-span-1 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg justify-self-end"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingChapterId(null)}
                                disabled={savingChapter}
                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveChapter(ch.id!)}
                                disabled={savingChapter}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                              >
                                {savingChapter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Save Lesson
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CurriculumManager;
