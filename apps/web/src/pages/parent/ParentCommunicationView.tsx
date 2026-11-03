import { markNotificationEntityAsRead } from '../../services/notificationService';
import React, { useEffect, useState, useRef } from 'react';
import { AudioWavePlayer } from '../../components/AudioWavePlayer';
import { fixWebmDuration } from '@fix-webm-duration/fix';
import { apiFetch } from '../../services/api';
import {
  MessageSquare,
  Send,
  User,
  GraduationCap,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  Search,
  BookOpen,
  MessageCircle,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  Calendar,
  Image as ImageIcon,
  Paperclip,
  Mic,
  Square,
  Volume2,
  FileText,
  Download,
  Loader2,
  X,
} from 'lucide-react';

interface ParentCommunicationViewProps {
  student: any;
}

export const ParentCommunicationView: React.FC<ParentCommunicationViewProps> = ({ student }) => {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'feedback'>('chat');

  // Chat State
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState<boolean>(true);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);

  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Feedback State
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(false);
  const [feedbackCategory, setFeedbackCategory] = useState<string>('Academic Progress');
  const [feedbackTargetStaffId, setFeedbackTargetStaffId] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // File & Voice attachments
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Lightbox for full image view
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch teachers assigned to student's batch
  useEffect(() => {
    async function loadTeachers() {
      if (!student?.id) return;
      try {
        setLoadingTeachers(true);
        const res = await apiFetch(`/parents/students/${student.id}/teachers`);
        if (res.success && res.data?.teachers) {
          setTeachers(res.data.teachers);
          if (res.data.teachers.length > 0 && !selectedTeacher) {
            handleSelectTeacher(res.data.teachers[0]);
          }
        }
      } catch (err: any) {
        console.error('[Load Teachers Error]', err);
        setError('Failed to load teachers for this class.');
      } finally {
        setLoadingTeachers(false);
      }
    }

    loadTeachers();
  }, [student?.id]);

  // Fetch feedback history when switching to feedback tab or student change
  useEffect(() => {
    if (activeSubTab === 'feedback' && student?.id) {
      loadFeedbacks();
    }
  }, [activeSubTab, student?.id]);

  const loadFeedbacks = async () => {
    try {
      setLoadingFeedbacks(true);
      const res = await apiFetch(`/feedback?studentId=${student.id}`);
      if (res.success && res.data?.feedbacks) {
        setFeedbacks(res.data.feedbacks);
      }
    } catch (err: any) {
      console.error('[Load Feedback Error]', err);
    } finally {
      setLoadingFeedbacks(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time SSE Connection for live messages and feedback responses
  useEffect(() => {
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    try {
      const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Real-time chat message delivery
          if (payload.type === 'MESSAGE_CREATED' && payload.data) {
            const { conversationId, message } = payload.data;
            if (activeConversation && conversationId === activeConversation.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
              });
            }
          }

          // Real-time feedback status & teacher response delivery
          if (payload.type === 'FEEDBACK_UPDATED' && payload.data) {
            const updated = payload.data;
            setFeedbacks((prev) =>
              prev.map((f) => (f.id === updated.id ? updated : f))
            );
          }
        } catch (e) {}
      };
    } catch (err) {
      console.warn('[ParentCommunicationView] SSE Setup warning:', err);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeConversation?.id]);

  // Clean up audio recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleSelectTeacher = async (teacher: any) => {
    setSelectedTeacher(teacher);
    setError(null);
    try {
      setLoadingMessages(true);
      // Retrieve or start conversation with teacher associated with student
      const convRes = await apiFetch('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({
          recipientUserId: teacher.userId,
          studentId: student?.id,
          title: `Discussion regarding ${student?.firstName} (${teacher.subjects?.join(', ') || 'Class'})`,
        }),
      });

      if (convRes.success && convRes.data?.conversation) {
        const conv = convRes.data.conversation;
        setActiveConversation(conv);
        markNotificationEntityAsRead('MESSAGE', conv.id);

        const msgRes = await apiFetch(`/messaging/conversations/${conv.id}/messages`);
        if (msgRes.success && msgRes.data?.messages) {
          setMessages(msgRes.data.messages);
        }
      }
    } catch (err: any) {
      console.error('[Select Teacher Conversation Error]', err);
      setError(err.message || 'Could not initiate communication with teacher.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeConversation?.id || sending) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    try {
      setSending(true);
      const res = await apiFetch(`/messaging/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: textToSend,
        }),
      });

      if (res.success && res.data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.message.id)) return prev;
          return [...prev, res.data.message];
        });
        setNewMessage('');
      }
    } catch (err: any) {
      console.error('[Send Message Error]', err);
      setError('Failed to deliver message. Please retry.');
      setNewMessage(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || feedbackText.trim().length < 5 || submittingFeedback) return;

    try {
      setSubmittingFeedback(true);
      setFeedbackSuccess(null);
      setError(null);

      const res = await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          staffId: feedbackTargetStaffId || null,
          category: feedbackCategory,
          feedbackText: feedbackText.trim(),
        }),
      });

      if (res.success && res.data?.feedback) {
        setFeedbacks((prev) => [res.data.feedback, ...prev]);
        setFeedbackText('');
        setFeedbackSuccess('Your feedback has been submitted successfully.');
        setTimeout(() => setFeedbackSuccess(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleResolveFeedback = async (id: string) => {
    try {
      const res = await apiFetch(`/feedback/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      if (res.success && res.data?.feedback) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: 'RESOLVED' } : f))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeConversation?.id) return;

    try {
      setUploadingAttachment(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await apiFetch(
        `/messaging/conversations/${activeConversation.id}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadRes.success || !uploadRes.data) {
        throw new Error(uploadRes.error || 'Failed to upload attachment');
      }

      const att = uploadRes.data;

      const msgRes = await apiFetch(
        `/messaging/conversations/${activeConversation.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: newMessage.trim() || (att.attachmentType === 'AUDIO' ? 'Voice Message' : att.fileName),
            attachmentUrl: att.fileUrl,
            attachmentType: att.attachmentType,
            attachmentName: att.fileName,
            attachmentSize: att.fileSize,
          }),
        }
      );

      if (msgRes.success && msgRes.data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msgRes.data.message.id)) return prev;
          return [...prev, msgRes.data.message];
        });
        setNewMessage('');
      }
    } catch (err: any) {
      console.error('[Upload File Error]', err);
      setError(err.message || 'Failed to send attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunksRef.current.length > 0) {
          const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const durationMs = Math.max(1000, Date.now() - recordingStartTimeRef.current);
          let finalBlob = rawBlob;
          try {
            finalBlob = await fixWebmDuration(rawBlob, durationMs);
          } catch (fixErr) {
            console.warn('[WebM Duration Fix]', fixErr);
          }
          const audioFile = new File([finalBlob], `voice_note_${Date.now()}.webm`, {
            type: 'audio/webm',
          });
          await handleFileUpload(audioFile);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone permission denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };
  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          day: 'numeric',
          month: 'short',
        }).format(d);
  };

  return (
    <div className="space-y-6">
      {/* View Header with Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#64748B]" /> Faculty Communication & Feedback
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Direct chat and structured feedback channels for{' '}
            <strong className="text-[#0F172A]">{student?.firstName}'s</strong> teachers
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="inline-flex p-1 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'chat'
                ? 'bg-[#006FFF] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Direct Chat
          </button>
          <button
            onClick={() => setActiveSubTab('feedback')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'feedback'
                ? 'bg-[#006FFF] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Structured Feedback ({feedbacks.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedbackSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* SUB-TAB 1: DIRECT FACULTY CHAT */}
      {activeSubTab === 'chat' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[640px]">
          {/* Left: Faculty Directory */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC]/60">
              <h3 className="text-xs font-bold text-[#006FFF] uppercase tracking-wider">
                Assigned Teachers ({teachers.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#EFEBE9]">
              {loadingTeachers ? (
                <div className="p-8 text-center text-xs text-[#94A3B8] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#64748B]" />
                  <span>Loading teachers...</span>
                </div>
              ) : teachers.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#94A3B8]">
                  No teachers currently assigned to {student?.firstName}'s batch.
                </div>
              ) : (
                teachers.map((t) => {
                  const isSelected = selectedTeacher?.userId === t.userId;
                  return (
                    <div
                      key={t.userId}
                      onClick={() => handleSelectTeacher(t)}
                      className={`p-4 transition-colors cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#F8FAFC] border-l-4 border-[#006FFF]'
                          : 'hover:bg-[#F8FAFC]/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center font-bold text-sm shrink-0">
                        {t.fullName?.[0] || 'T'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#0F172A] truncate">{t.fullName}</h4>
                        <p className="text-[11px] text-[#64748B] truncate">{t.designation}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.subjects?.map((sub: string, sIdx: number) => (
                            <span
                              key={sIdx}
                              className="text-[9px] font-semibold bg-[#006FFF]/10 text-[#006FFF] px-1.5 py-0.5 rounded"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Chat Conversation */}
          <div className="md:col-span-2 bg-white rounded-3xl border border-[#E2E8F0] shadow-sm flex flex-col overflow-hidden">
            {selectedTeacher ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC]/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-sm">
                      {selectedTeacher.fullName?.[0]}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#0F172A]">{selectedTeacher.fullName}</h3>
                      <p className="text-[11px] text-[#64748B]">
                        {selectedTeacher.designation} &bull; {selectedTeacher.subjects?.join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                    Live Channel
                  </div>
                </div>

                {/* Chat Messages Log */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F6]">
                  {loadingMessages ? (
                    <div className="p-12 text-center text-xs text-[#94A3B8] flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#64748B]" />
                      <span>Loading message history...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-xs text-[#94A3B8] space-y-2">
                      <MessageSquare className="w-8 h-8 mx-auto text-[#94A3B8]" />
                      <p>No messages yet. Send a message to start the conversation with {selectedTeacher.fullName}.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderId !== selectedTeacher.userId;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm space-y-2 ${
                              isMe
                                ? 'bg-[#006FFF] text-white rounded-tr-none'
                                : 'bg-white text-[#0F172A] border border-[#E2E8F0] rounded-tl-none'
                            }`}
                          >
                            {/* Image Attachment */}
                            {m.attachmentType === 'IMAGE' && m.attachmentUrl && (
                              <img
                                src={m.attachmentUrl}
                                alt="Attachment"
                                onClick={() => setLightboxImg(m.attachmentUrl)}
                                className="max-h-48 rounded-xl object-cover cursor-pointer hover:opacity-90"
                              />
                            )}

                            {/* Audio Voice Note */}
                            {m.attachmentType === 'AUDIO' && m.attachmentUrl && (
                              <div className="w-full max-w-sm">
                                <AudioWavePlayer
                                  src={m.attachmentUrl}
                                  title="Voice Note"
                                  className="!p-2.5 !rounded-xl !bg-white/80"
                                />
                              </div>
                            )}

                            {/* Document Attachment */}
                            {m.attachmentType === 'DOCUMENT' && m.attachmentUrl && (
                              <a
                                href={`${m.attachmentUrl}?download=true`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 p-2 bg-black/10 rounded-xl hover:bg-black/15 transition-colors"
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate flex-1 text-[11px] font-semibold">{m.attachmentName || 'Document.pdf'}</span>
                                <Download className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            )}

                            {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}

                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                                isMe ? 'text-[#D7CCC8]' : 'text-[#94A3B8]'
                              }`}
                            >
                              <span>{formatMessageTime(m.createdAt)}</span>
                              {isMe && (
                                m.isReadByRecipient ? (
                                  <span title="Read by faculty">
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                                  </span>
                                ) : (
                                  <span title="Delivered to server">
                                    <Check className="w-3.5 h-3.5 text-[#D7CCC8]" />
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Uploading progress indicator */}
                {uploadingAttachment && (
                  <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Sending attachment...</span>
                  </div>
                )}

                {/* Voice Recording Active Bar */}
                {isRecording ? (
                  <div className="p-3 border-t border-[#F1F5F9] bg-gradient-to-r from-rose-50 via-white to-rose-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                      <span className="text-xs font-bold text-rose-800 font-mono">
                        Recording: {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Animated Wave Bars */}
                    <div className="flex items-center gap-1 h-6 flex-1 max-w-xs justify-center px-4">
                      {[35, 70, 45, 85, 60, 30, 80, 40, 95, 65, 30, 75, 50, 60, 85, 35].map((h, i) => (
                        <span
                          key={i}
                          style={{
                            height: `${h}%`,
                            animationDelay: `${(i % 5) * 0.12}s`,
                          }}
                          className="w-1 bg-rose-500 rounded-full animate-pulse transition-all"
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={cancelRecording} className="px-2.5 py-1 text-xs text-[#64748B]">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Send Voice Note
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Chat Input Form */
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-[#F1F5F9] bg-white flex items-center gap-2">
                    <input
                      type="file"
                      ref={imageInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFileUpload(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      title="Attach Image"
                      className="p-2 text-[#94A3B8] hover:text-[#006FFF] rounded-xl hover:bg-[#F8FAFC]"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach Document"
                      className="p-2 text-[#94A3B8] hover:text-[#006FFF] rounded-xl hover:bg-[#F8FAFC]"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={startRecording}
                      title="Record Voice Note"
                      className="p-2 text-[#94A3B8] hover:text-rose-600 rounded-xl hover:bg-[#F8FAFC]"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Write message to ${selectedTeacher.fullName}...`}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      className="p-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] disabled:opacity-50 text-white transition-colors shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#94A3B8] text-xs space-y-2">
                <MessageSquare className="w-10 h-10 text-[#D7CCC8]" />
                <p>Select a faculty teacher from the left directory to view conversations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: STRUCTURED PARENT FEEDBACK */}
      {activeSubTab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Submit New Feedback */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-[#0F172A]">Submit Structured Feedback</h3>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#64748B] mb-1">Feedback Category</label>
                <select
                  value={feedbackCategory}
                  onChange={(e) => setFeedbackCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="Academic Progress">Academic Progress</option>
                  <option value="Teaching Method">Teaching Method</option>
                  <option value="Attendance">Attendance</option>
                  <option value="Student Behaviour">Student Behaviour</option>
                  <option value="Homework">Homework</option>
                  <option value="General Feedback">General Feedback</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#64748B] mb-1">Target Faculty (Optional)</label>
                <select
                  value={feedbackTargetStaffId}
                  onChange={(e) => setFeedbackTargetStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                >
                  <option value="">Any / General Faculty In-charge</option>
                  {teachers.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.fullName} ({t.designation || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#64748B] mb-1">
                  Feedback Details <span className="text-[#94A3B8] font-normal">({feedbackText.length}/2000)</span>
                </label>
                <textarea
                  rows={5}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share details regarding learning observations, syllabus pace, or questions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] text-xs text-[#0F172A] focus:ring-2 focus:ring-[#006FFF]/20"
                />
              </div>

              <button
                type="submit"
                disabled={feedbackText.trim().length < 5 || submittingFeedback}
                className="w-full py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold text-xs disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>

          {/* Right Column: Feedback History & Teacher Responses */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#64748B]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Submitted Feedback & Faculty Responses</h3>
              </div>
              <button
                onClick={loadFeedbacks}
                className="text-xs text-[#64748B] hover:text-[#0F172A] font-bold cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {loadingFeedbacks ? (
              <div className="p-12 text-center text-xs text-[#94A3B8]">Loading feedback history...</div>
            ) : feedbacks.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#94A3B8] space-y-2">
                <HelpCircle className="w-8 h-8 mx-auto text-[#94A3B8]" />
                <p>No feedback submitted yet. Use the form on the left to submit inquiries.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {feedbacks.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[#FAF8F6] border border-[#F1F5F9] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#006FFF]/10 text-[#006FFF]">
                          {item.category}
                        </span>
                        {item.status === 'RESOLVED' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            Resolved
                          </span>
                        ) : item.status === 'RESPONDED' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Responded
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            Open
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">{formatMessageTime(item.createdAt)}</span>
                    </div>

                    <p className="text-xs text-[#0F172A] leading-relaxed">{item.feedbackText}</p>

                    {item.staff && (
                      <p className="text-[11px] text-[#64748B]">
                        Assigned Faculty: <strong>{item.staff.fullName}</strong>
                      </p>
                    )}

                    {/* Teacher Response Box */}
                    {item.teacherResponse ? (
                      <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#006FFF] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Faculty Response ({item.respondedBy?.fullName || 'Teacher'}):
                          </span>
                          {item.respondedAt && (
                            <span className="text-[10px] text-[#94A3B8]">
                              {formatMessageTime(item.respondedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#0F172A] leading-relaxed italic">
                          "{item.teacherResponse}"
                        </p>
                        {item.status !== 'RESOLVED' && (
                          <button
                            onClick={() => handleResolveFeedback(item.id)}
                            className="mt-2 text-[10px] font-bold text-[#006FFF] hover:underline cursor-pointer"
                          >
                            Mark this issue as Resolved
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#94A3B8] italic">
                        Awaiting response from faculty in-charge.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={lightboxImg} alt="Preview" className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl" />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full text-black shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
