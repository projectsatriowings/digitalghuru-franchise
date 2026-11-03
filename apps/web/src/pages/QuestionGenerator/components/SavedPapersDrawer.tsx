import React, { useState, useEffect } from 'react';
import { SavedPaperSummary } from '../types';
import { apiFetch } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import {
  FolderArchive,
  X,
  Search,
  FileText,
  Calendar,
  Award,
  Clock,
  Copy,
  Trash2,
  ExternalLink,
  Plus,
} from 'lucide-react';

interface SavedPapersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPaper: (paperId: string) => void;
  onCreateNew: () => void;
}

export const SavedPapersDrawer: React.FC<SavedPapersDrawerProps> = ({
  isOpen,
  onClose,
  onSelectPaper,
  onCreateNew,
}) => {
  const toast = useToast();
  const [papers, setPapers] = useState<SavedPaperSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'APPROVED'>('ALL');

  useEffect(() => {
    if (isOpen) {
      loadPapers();
    }
  }, [isOpen]);

  async function loadPapers() {
    try {
      setLoading(true);
      const res = await apiFetch('/question-generator/papers');
      if (res.success) {
        setPapers(res.data.papers || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load saved papers');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(paperId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this question paper?')) return;
    try {
      const res = await apiFetch(`/question-generator/papers/${paperId}`, {
        method: 'DELETE',
      });
      if (res.success) {
        toast.success('Question paper deleted');
        setPapers((prev) => prev.filter((p) => p.id !== paperId));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete paper');
    }
  }

  async function handleDuplicate(paperId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/question-generator/papers/${paperId}/duplicate`, {
        method: 'POST',
      });
      if (res.success && res.data?.paper) {
        toast.success('Paper duplicated into new draft');
        loadPapers();
        onSelectPaper(res.data.paper.id);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate paper');
    }
  }

  if (!isOpen) return null;

  const filteredPapers = papers.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.subject.toLowerCase().includes(search.toLowerCase()) ||
      p.standardOrDegree.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="fixed inset-0 z-[9990] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border-l border-[#E2E8F0] w-full max-w-lg h-full shadow-2xl flex flex-col text-[#0F172A]">
        {/* DRAWER HEADER */}
        <div className="p-6 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]/60 flex items-center justify-center text-[#64748B] shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Question Papers Repository</h2>
              <p className="text-xs text-[#64748B]">Browse saved drafts and approved examination papers</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="p-4 border-b border-[#F1F5F9] bg-[#FFFFFF] space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject, standard, or exam title..."
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]/30 font-medium"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(['ALL', 'DRAFT', 'APPROVED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-[#006FFF] text-white shadow-sm'
                      : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                onCreateNew();
                onClose();
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Paper</span>
            </button>
          </div>
        </div>

        {/* PAPERS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#94A3B8]">Loading saved papers...</div>
          ) : filteredPapers.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#94A3B8] space-y-2">
              <FileText className="w-8 h-8 mx-auto text-[#94A3B8]" />
              <div className="font-semibold text-[#006FFF]">No papers match your filter</div>
              <p className="text-[11px]">Generate and save an exam blueprint to see it here.</p>
            </div>
          ) : (
            filteredPapers.map((paper) => (
              <div
                key={paper.id}
                onClick={() => {
                  onSelectPaper(paper.id);
                  onClose();
                }}
                className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#6D4C41] shadow-sm hover:shadow-md transition cursor-pointer space-y-3 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        paper.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                    >
                      {paper.status}
                    </span>
                    <h3 className="text-xs font-bold text-[#0F172A] group-hover:text-[#006FFF]">
                      {paper.title}
                    </h3>
                    <div className="text-[11px] text-[#64748B]">
                      {paper.educationLevel} &bull; {paper.standardOrDegree} &bull; {paper.examType}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(paper.id, e)}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition"
                      title="Duplicate as new draft"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(paper.id, e)}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete paper"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-2 border-t border-[#F1F5F9]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-[#006FFF]">
                      <Award className="w-3 h-3 text-[#64748B]" /> {paper.totalMarks} Marks
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {paper.durationMinutes}m
                    </span>
                    <span>&bull;</span>
                    <span>{paper.questionsCount} Questions</span>
                  </div>

                  <span className="text-[10px]">
                    {new Date(paper.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

