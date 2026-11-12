import { markNotificationEntityAsRead } from '../services/notificationService';
import { MaterialViewerModal } from '../components/MaterialViewerModal';
import { AudioWavePlayer } from '../components/AudioWavePlayer';
import { LiveAudioVisualizer } from '../components/LiveAudioVisualizer';
import { fixWebmDuration } from '@fix-webm-duration/fix';
import React, { useEffect, useState, useRef } from 'react';
import { apiFetch, getMaterialDownloadUrl, downloadFileToDevice } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  FileText,
  Headphones,
  Mic,
  Bell,
  Upload,
  Download,
  Trash2,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  X,
  Image as ImageIcon,
  FileCode,
  Eye,
  Layers,
  Sparkles,
  ExternalLink,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Users,
  Clock,
  BarChart2,
  CheckCircle2,
  EyeOff,
} from 'lucide-react';

export const MaterialsManagement: React.FC = () => {
  const { user, activeInstitute } = useAuth();
  const isStaffOrAdmin =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'FRANCHISE_OWNER' ||
    user?.role === 'BRANCH_ADMIN' ||
    user?.role === 'ACADEMIC_ADMIN' ||
    user?.role === 'STAFF';

  const [materials, setMaterials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('PDF');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Text Note Reader Modal
  const [readingMaterial, setReadingMaterial] = useState<any | null>(null);
  const [previewMaterial, setPreviewMaterial] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Voice Recording State (Phase 3)
  const [audioInputMode, setAudioInputMode] = useState<'UPLOAD' | 'RECORD'>('UPLOAD');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Material Analytics Modal (Phase 4)
  const [selectedMaterialForAnalytics, setSelectedMaterialForAnalytics] = useState<any | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  async function openAnalyticsModal(mat: any) {
    setSelectedMaterialForAnalytics(mat);
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch(`/materials/${mat.id}/interactions`);
      if (res.success) {
        setAnalyticsData(res.data.interactions || []);
      }
    } catch (err: any) {
      console.error('Failed to load interactions:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const durationMs = Math.max(1000, Date.now() - recordingStartTimeRef.current);
        let finalBlob = rawBlob;
        try {
          finalBlob = await fixWebmDuration(rawBlob, durationMs);
        } catch (fixErr) {
          console.warn('[WebM Duration Fix]', fixErr);
        }

        const audioUrl = URL.createObjectURL(finalBlob);
        setRecordedAudioUrl(audioUrl);
        const recordedFile = new File([finalBlob], `voice-lesson-${Date.now()}.webm`, { type: 'audio/webm' });
        setFile(recordedFile);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert('Microphone access denied or not supported in this browser. Please allow microphone permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }

  function discardRecording() {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setRecordedAudioUrl(null);
    setRecordingDuration(0);
    setFile(null);
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function handleSaveToDevice(materialId: string, filename: string) {
    try {
      setDownloadingId(materialId);
      const downloadUrl = getMaterialDownloadUrl(materialId, true);
      await downloadFileToDevice(downloadUrl, filename);
    } catch (err: any) {
      alert(err.message || 'Failed to download file to device');
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    loadMaterials();
    if (isStaffOrAdmin) {
      loadBatches();
    }
  }, [activeInstitute?.id]);

  async function loadMaterials() {
    try {
      setLoading(true);
      const res = await apiFetch('/materials');
      if (res.success) {
        setMaterials(res.data.materials || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBatches() {
    try {
      const bRes = await apiFetch('/academics/batches');
      if (bRes.success) {
        setBatches(bRes.data.batches || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Derive subjects belonging specifically to the chosen batch
  const selectedBatchObj = batches.find((b) => b.id === batchId);
  const availableSubjects: any[] = selectedBatchObj?.batchSubjects?.map((bs: any) => bs.subject).filter(Boolean) || [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) {
      setMessage({ text: 'Please select a batch for this material', type: 'error' });
      return;
    }

    if (type !== 'TEXT' && type !== 'ANNOUNCEMENT' && !file) {
      setMessage({ text: 'Please attach a file for this material type, or select Text Notes', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);

      const formData = new FormData();
      formData.append('title', title.trim());
      if (description) formData.append('description', description.trim());
      if (content) formData.append('content', content.trim());
      formData.append('type', type);
      formData.append('batchId', batchId);
      if (subjectId) formData.append('subjectId', subjectId);
      formData.append('isPublished', String(isPublished));
      if (file) formData.append('file', file);

      const token = localStorage.getItem('tuition_token');
      const instId = localStorage.getItem('tuition_active_institute_id');

      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(instId ? { 'x-institute-id': instId } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setMessage({
        text: isPublished
          ? 'Learning material published successfully to student portal!'
          : 'Learning material saved as draft (visible to faculty only).',
        type: 'success',
      });
      setShowCreateModal(false);
      resetForm();
      loadMaterials();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish(mat: any) {
    try {
      const nextStatus = !mat.isPublished;
      const res = await apiFetch(`/materials/${mat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: nextStatus }),
      });
      if (res.success) {
        setMessage({
          text: nextStatus
            ? 'Material published to enrolled students!'
            : 'Material moved back to drafts.',
          type: 'success',
        });
        loadMaterials();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update publication status');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to remove this learning material?')) return;
    try {
      await apiFetch(`/materials/${id}`, { method: 'DELETE' });
      loadMaterials();
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setContent('');
    setType('PDF');
    setBatchId('');
    setSubjectId('');
    setIsPublished(true);
    setFile(null);
    discardRecording();
    setAudioInputMode('UPLOAD');
  }

  const filteredMaterials = materials.filter((m) => {
    // Homework assignments belong exclusively to the Homework & Tasks page
    if (m.type === 'HOMEWORK') return false;

    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase())) ||
      (m.content && m.content.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType === 'ALL' || m.type === selectedType;
    const matchesBatch = selectedBatch === 'ALL' || m.batchId === selectedBatch;

    let matchesStatus = true;
    if (selectedStatus === 'PUBLISHED') matchesStatus = m.isPublished === true;
    if (selectedStatus === 'DRAFT') matchesStatus = m.isPublished === false;

    return matchesSearch && matchesType && matchesBatch && matchesStatus;
  });

  const getTypeIcon = (mType: string) => {
    switch (mType) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-rose-600" />;
      case 'IMAGE':
        return <ImageIcon className="w-5 h-5 text-indigo-600" />;
      case 'AUDIO':
        return <Headphones className="w-5 h-5 text-sky-600" />;
      case 'VOICE_NOTE':
        return <Mic className="w-5 h-5 text-amber-600" />;
      case 'TEXT':
        return <FileCode className="w-5 h-5 text-emerald-600" />;
      case 'ANNOUNCEMENT':
        return <Bell className="w-5 h-5 text-[#64748B]" />;
      default:
        return <BookOpen className="w-5 h-5 text-[#64748B]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-[#64748B]" />
            <span>Learning Materials & Educational Resources</span>
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Access chapter notes, recorded lectures, formula sheets, diagrams, and study materials
          </p>
        </div>

        {isStaffOrAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl font-semibold text-sm shadow-sm transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Upload / Create Material
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-current hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search notes, topics, formulas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-2 text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
          >
            <option value="ALL">All Material Types</option>
            <option value="PDF">PDF Notes</option>
            <option value="IMAGE">Images & Diagrams</option>
            <option value="AUDIO">Audio Lectures</option>
            <option value="VOICE_NOTE">Voice Notes</option>
            <option value="TEXT">Text Notes & Guides</option>
            <option value="ANNOUNCEMENT">Announcements</option>
          </select>

          {isStaffOrAdmin && batches.length > 0 && (
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            >
              <option value="ALL">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {isStaffOrAdmin && (
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Drafts Only</option>
            </select>
          )}
        </div>
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="p-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-3">
          <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping"></div>
          <span>Loading curriculum materials...</span>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm space-y-2">
          <BookOpen className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="font-medium">No learning materials found matching your criteria.</p>
          <p className="text-xs text-[#94A3B8]">Materials assigned to your batches and subjects will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              className={`group rounded-2xl bg-white border transition-all duration-200 hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                !mat.isPublished ? 'border-amber-300/80 bg-amber-50/10' : 'border-[#E2E8F0]/80 hover:border-[#CBD5E1]'
              }`}
            >
              {/* Card Main Body */}
              <div className="p-5 space-y-3.5">
                {/* Header: Icon, Type & Status Badges (Left), Quick Action Buttons (Right) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-center shrink-0">
                      {getTypeIcon(mat.type)}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#006FFF] border border-[#E2E8F0]/60 whitespace-nowrap">
                        {mat.type.replace('_', ' ')}
                      </span>
                      {mat.isPublished ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Draft
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Staff Management Icon Actions */}
                  {isStaffOrAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleTogglePublish(mat)}
                        className={`p-1.5 rounded-lg border text-xs transition-all active:scale-95 ${
                          mat.isPublished
                            ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                        title={mat.isPublished ? 'Unpublish (Save as Draft)' : 'Publish to Students'}
                      >
                        {mat.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="p-1.5 rounded-lg border border-rose-200/80 text-rose-600 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95"
                        title="Delete Material"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Title & Description */}
                <div>
                  <h3
                    className="font-bold text-[#0F172A] text-base leading-snug line-clamp-1 group-hover:text-[#006FFF] transition-colors"
                    title={mat.title}
                  >
                    {mat.title}
                  </h3>
                  {mat.description ? (
                    <p className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-relaxed">
                      {mat.description}
                    </p>
                  ) : (
                    <p className="text-xs text-[#94A3B8] italic mt-1">No description provided</p>
                  )}
                  {mat.content && (
                    <p className="text-xs text-[#94A3B8] mt-2 line-clamp-2 font-mono bg-[#F8FAFC] p-2.5 rounded-xl border border-[#F1F5F9] leading-relaxed">
                      {mat.content}
                    </p>
                  )}
                </div>

                {/* Batch & Subject Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]/70 text-[11px] font-medium text-[#006FFF]">
                    <Users className="w-3 h-3 text-[#94A3B8]" />
                    <span>{mat.batch?.name || 'Class Batch'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]/70 text-[11px] font-medium text-[#006FFF]">
                    <BookOpen className="w-3 h-3 text-[#94A3B8]" />
                    <span>{mat.subject?.name ? mat.subject.name : 'Entire Batch (All Subjects)'}</span>
                  </span>
                </div>
              </div>

              {/* Card Footer: Divided into 2 clean, spacious rows */}
              <div className="px-5 py-3.5 bg-[#FAF7F5]/80 border-t border-[#F1F5F9] space-y-2.5">
                {/* Meta Row: Date & Analytics Views */}
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#94A3B8] font-medium">
                    <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {new Date(mat.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>

                  {isStaffOrAdmin && (
                    <button
                      onClick={() => openAnalyticsModal(mat)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/90 font-semibold text-[11px] transition-colors whitespace-nowrap active:scale-95"
                      title="View student engagement analytics"
                    >
                      <BarChart2 className="w-3 h-3 text-sky-600 shrink-0" />
                      <span>{mat._count?.interactions !== undefined ? `${mat._count.interactions} views` : 'Analytics'}</span>
                    </button>
                  )}
                </div>

                {/* Action Buttons Row: Symmetrical, equal width, 100% inside container */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => { setPreviewMaterial(mat); markNotificationEntityAsRead('MATERIAL', mat.id); }}
                    className={`py-2 px-3 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#006FFF] border border-[#E2E8F0] flex items-center justify-center gap-1.5 font-semibold text-xs transition-all active:scale-95 shadow-sm hover:border-[#CBD5E1] ${
                      mat.fileUrl ? 'flex-1' : 'w-full'
                    }`}
                    title="Open in-page modal preview"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>Preview</span>
                  </button>

                  {mat.fileUrl && (
                    <button
                      onClick={() => handleSaveToDevice(mat.id, mat.fileName || `${mat.title}.${(mat.type || 'bin').toLowerCase()}`)}
                      disabled={downloadingId === mat.id}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white flex items-center justify-center gap-1.5 font-semibold text-xs shadow transition-all active:scale-95 disabled:opacity-50"
                      title="Download and save directly to your device"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{downloadingId === mat.id ? 'Saving...' : 'Download'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text Note Full Reader Modal */}
      {previewMaterial && (
        <MaterialViewerModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
        />
      )}

      {readingMaterial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">{readingMaterial.title}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B]">
                  <span>{readingMaterial.batch?.name}</span>
                  <span>&bull;</span>
                  <span>{readingMaterial.subject?.name || 'Batch-wide'}</span>
                  <span>&bull;</span>
                  <span>{new Date(readingMaterial.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setReadingMaterial(null)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm text-[#0F172A]">
              {readingMaterial.description && (
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] text-xs text-[#64748B]">
                  <strong className="block text-[#006FFF] mb-0.5">Overview / Instructions:</strong>
                  {readingMaterial.description}
                </div>
              )}

              <div className="prose max-w-none whitespace-pre-wrap font-sans leading-relaxed p-4 bg-[#FAF7F5] rounded-2xl border border-[#E2E8F0]">
                {readingMaterial.content || 'No text content attached.'}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end border-t border-[#F1F5F9]">
              <button
                onClick={() => setReadingMaterial(null)}
                className="px-4 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl text-xs font-semibold"
              >
                Close Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#64748B]" /> Create / Upload Learning Material
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4 - Geometry Formula Sheet & Proofs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">Batch *</label>
                  <select
                    required
                    value={batchId}
                    onChange={(e) => {
                      setBatchId(e.target.value);
                      setSubjectId(''); // Reset subject when batch changes
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="">Select Target Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                    Subject Allocation
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    disabled={!batchId}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 disabled:opacity-50"
                  >
                    <option value="">Entire Batch (All Subjects)</option>
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">Material Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="PDF">PDF Notes / Document</option>
                    <option value="IMAGE">Image / Diagram / Chart</option>
                    <option value="AUDIO">Audio Lecture (MP3, WAV)</option>
                    <option value="VOICE_NOTE">Voice Note</option>
                    <option value="TEXT">Text Notes & Study Instructions</option>
                    <option value="ANNOUNCEMENT">Announcement / Syllabus Guide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">Publication Status *</label>
                  <select
                    value={isPublished ? 'PUBLISHED' : 'DRAFT'}
                    onChange={(e) => setIsPublished(e.target.value === 'PUBLISHED')}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                  >
                    <option value="PUBLISHED">Publish to Students Immediately</option>
                    <option value="DRAFT">Save as Draft (Faculty Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#006FFF] mb-1">Description / Summary (Optional)</label>
                <input
                  type="text"
                  placeholder="Brief note or chapter reference..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              {type === 'TEXT' && (
                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                    Study Notes / Study Instructions (Text Content) *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Enter study guide, derivation, equations, or key instructions for students..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20 font-mono text-xs"
                  />
                </div>
              )}

              {type !== 'TEXT' && (type === 'AUDIO' || type === 'VOICE_NOTE') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#006FFF]">
                      Audio Input Method *
                    </label>
                    <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
                      <button
                        type="button"
                        onClick={() => {
                          setAudioInputMode('UPLOAD');
                          discardRecording();
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          audioInputMode === 'UPLOAD'
                            ? 'bg-[#006FFF] text-white shadow-sm'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        Upload Audio File
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioInputMode('RECORD');
                          setFile(null);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          audioInputMode === 'RECORD'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        Record with Mic
                      </button>
                    </div>
                  </div>

                  {audioInputMode === 'RECORD' ? (
                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                      {!isRecording && !recordedAudioUrl && (
                        <div className="text-center py-4 space-y-3">
                          <p className="text-xs text-[#64748B]">
                            Click the button below to start recording your voice lesson directly from your microphone.
                          </p>
                          <button
                            type="button"
                            onClick={startRecording}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow transition-all active:scale-95"
                          >
                            <Mic className="w-4 h-4 animate-bounce" />
                            Start Recording
                          </button>
                        </div>
                      )}

                      {isRecording && (
                        <LiveAudioVisualizer
                          stream={mediaStreamRef.current}
                          duration={recordingDuration}
                          onStop={stopRecording}
                          formatDuration={formatDuration}
                        />
                      )}

                      {recordedAudioUrl && !isRecording && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              Voice Recording Complete ({formatDuration(recordingDuration)})
                            </span>
                            <button
                              type="button"
                              onClick={discardRecording}
                              className="text-rose-600 hover:underline flex items-center gap-1 font-medium text-xs transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Discard & Re-record
                            </button>
                          </div>

                          {/* Animated Audio Line & Waveform Player */}
                          <AudioWavePlayer
                            src={recordedAudioUrl}
                            duration={recordingDuration}
                            title="Recorded Voice Lesson"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="file"
                        required={!file}
                        accept="audio/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#006FFF] file:text-white hover:file:bg-[#0F172A]"
                      />
                      <p className="text-[11px] text-[#94A3B8]">
                        Upload MP3, WAV, AAC, or M4A audio files up to 25MB.
                      </p>

                      {file && (
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-[#006FFF] mb-2 flex items-center gap-1.5">
                            <Headphones className="w-3.5 h-3.5 text-[#94A3B8]" />
                            Selected Audio Preview: {file.name}
                          </p>
                          <AudioWavePlayer
                            src={URL.createObjectURL(file)}
                            title={file.name}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {type !== 'TEXT' && type !== 'AUDIO' && type !== 'VOICE_NOTE' && (
                <div>
                  <label className="block text-xs font-semibold text-[#006FFF] mb-1">
                    Attachment File {type === 'ANNOUNCEMENT' ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="file"
                    required={type !== 'ANNOUNCEMENT'}
                    accept={
                      type === 'PDF'
                        ? 'application/pdf'
                        : type === 'IMAGE'
                        ? 'image/*'
                        : '*/*'
                    }
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-[#64748B] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#006FFF] file:text-white hover:file:bg-[#0F172A]"
                  />
                  <p className="text-[11px] text-[#94A3B8] mt-1">
                    Supports PDFs, PNG, JPG, WebP images up to 25MB.
                  </p>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {submitting ? 'Saving Material...' : isPublished ? 'Publish Material' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Engagement & Views Analytics Modal (Phase 4) */}
      {selectedMaterialForAnalytics && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[85vh] flex flex-col space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]">
                    {selectedMaterialForAnalytics.type}
                  </span>
                  <h2 className="text-xl font-bold text-[#0F172A]">
                    {selectedMaterialForAnalytics.title} — Analytics
                  </h2>
                </div>
                <p className="text-xs text-[#64748B] mt-1">
                  Batch: {selectedMaterialForAnalytics.batch?.name} • Subject: {selectedMaterialForAnalytics.subject?.name || 'All Batch Subjects'}
                </p>
              </div>
              <button
                onClick={() => setSelectedMaterialForAnalytics(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F8FAFC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4 shrink-0 text-sky-700" />
              <span>
                <strong>Student Engagement Tracking:</strong>{' '}
                {selectedMaterialForAnalytics?.type === 'VOICE_NOTE'
                  ? 'Monitors student interaction — view who opened this audio lesson, tracked listening progress, and verified completion.'
                  : 'Monitors student interaction — view who opened, viewed, and completed this learning material.'}
              </span>
            </div>

            {loadingAnalytics ? (
              <div className="py-12 text-center text-[#94A3B8] text-sm flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full bg-[#006FFF] animate-ping"></div>
                <span>Loading engagement analytics...</span>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[11px] font-semibold text-[#64748B]">Unique Student Views</span>
                    <p className="text-2xl font-bold text-[#0F172A] mt-1">
                      {new Set(analyticsData.map((i: any) => i.studentId)).size}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800">Completed / Fully Read</span>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {analyticsData.filter((i: any) => i.interactionType === 'AUDIO_COMPLETED' || i.isCompleted).length}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-semibold text-sky-800">Total Interactions</span>
                    <p className="text-2xl font-bold text-sky-900 mt-1">
                      {analyticsData.length}
                    </p>
                  </div>
                </div>

                {/* Student Interaction Roster */}
                <div>
                  <h3 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider mb-2">
                    Student Interaction Breakdown
                  </h3>
                  {analyticsData.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8] text-xs">
                      No student views or interactions recorded for this material yet.
                    </div>
                  ) : (
                    <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#006FFF] font-semibold">
                          <tr>
                            <th className="p-3">Student Name</th>
                            <th className="p-3">Admission No</th>
                            <th className="p-3">Interaction Type</th>
                            <th className="p-3">
                              {selectedMaterialForAnalytics?.type === 'VOICE_NOTE'
                                ? 'Audio Progress'
                                : 'Study Progress'}
                            </th>
                            <th className="p-3">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEBE9]">
                          {analyticsData.map((interaction: any) => (
                            <tr key={interaction.id} className="hover:bg-[#FAF7F5]">
                              <td className="p-3 font-medium text-[#0F172A]">
                                {interaction.student?.firstName} {interaction.student?.lastName}
                              </td>
                              <td className="p-3 text-[#64748B] font-mono">
                                {interaction.student?.admissionNumber || '—'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  interaction.interactionType === 'AUDIO_COMPLETED' || interaction.isCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : interaction.interactionType === 'AUDIO_PLAYING'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {interaction.interactionType}
                                </span>
                              </td>
                              <td className="p-3 text-[#64748B]">
                                {interaction.progressPercent !== null && interaction.progressPercent !== undefined
                                  ? `${Math.round(interaction.progressPercent)}%`
                                  : interaction.isCompleted
                                  ? '100%'
                                  : '—'}
                              </td>
                              <td className="p-3 text-[#94A3B8]">
                                {new Date(interaction.updatedAt || interaction.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-[#F1F5F9]">
              <button
                onClick={() => setSelectedMaterialForAnalytics(null)}
                className="px-5 py-2 rounded-xl bg-[#006FFF] text-white text-xs font-semibold hover:bg-[#0058D4]"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
