import { markNotificationEntityAsRead } from '../services/notificationService';
import React, { useEffect, useState, useRef } from 'react';
import { AudioWavePlayer } from '../components/AudioWavePlayer';
import { fixWebmDuration } from '@fix-webm-duration/fix';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  Send,
  User,
  Plus,
  Clock,
  ShieldCheck,
  Check,
  CheckCheck,
  Search,
  X,
  Mic,
  Square,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  AlertCircle,
  RefreshCw,
  Loader2,
  Volume2,
  Phone,
  Mail,
  GraduationCap,
} from 'lucide-react';

export const MessagingInbox: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  // New Conversation Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [eligibleContacts, setEligibleContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  // Attachment upload
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Lightbox for image preview
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [statusFilter]);

  // Load messages when selected conversation changes
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
      markNotificationEntityAsRead('MESSAGE', selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up audio recorder on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    try {
      const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            (payload.type === 'MESSAGE_CREATED' || payload.type === 'NEW_CHAT_MESSAGE') &&
            payload.data
          ) {
            const { conversationId, message } = payload.data;
            if (selectedConversation && conversationId === selectedConversation.id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === message?.id)) return prev;
                return [...prev, message];
              });
            }
            loadConversations();
          } else if (payload.type === 'NOTIFICATION_CREATED') {
            loadConversations();
          }
        } catch (e) {
          console.warn('[MessagingInbox SSE] parse error:', e);
        }
      };
    } catch (err) {
      console.warn('[MessagingInbox SSE] connect error:', err);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [selectedConversation?.id]);

  async function loadConversations(autoSelectId?: string) {
    try {
      setLoadingConvs(true);
      setConvError(null);
      const query = new URLSearchParams({
        filter: statusFilter,
        ...(search ? { search } : {}),
      });

      const res = await apiFetch(`/messaging/conversations?${query.toString()}`);
      if (res.success && res.data) {
        const list = res.data.conversations || [];
        setConversations(list);

        if (autoSelectId) {
          const match = list.find((c: any) => c.id === autoSelectId);
          if (match) setSelectedConversation(match);
        } else if (list.length > 0 && !selectedConversation) {
          setSelectedConversation(list[0]);
        }
      }
    } catch (err: any) {
      console.error('[Load Conversations Error]', err);
      setConvError(err.message || 'Failed to load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadMessages(convId: string) {
    try {
      setLoadingMessages(true);
      setMessageError(null);
      const res = await apiFetch(`/messaging/conversations/${convId}/messages`);
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
        // Update local conversation item to clear unread badge
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, isUnread: false, unreadCount: 0 } : c))
        );
      }
    } catch (err: any) {
      console.error('[Load Messages Error]', err);
      setMessageError(err.message || 'Failed to retrieve messages.');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadEligibleContacts() {
    try {
      setLoadingContacts(true);
      const res = await apiFetch('/messaging/eligible-contacts');
      if (res.success && res.data) {
        setEligibleContacts(res.data.contacts || []);
      }
    } catch (err: any) {
      console.error('[Load Contacts Error]', err);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedConversation || !messageBody.trim() || sending) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const textToSend = messageBody.trim();
    setMessageBody('');

    try {
      setSending(true);
      const res = await apiFetch(`/messaging/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: textToSend,
          clientTempId: tempId,
        }),
      });

      if (res.success && res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
        // Update lastMessage on conversation item
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessage: res.data.message,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
      }
    } catch (err: any) {
      setMessageError(err.message || 'Failed to send message. Please retry.');
      // Restore input if sending failed
      setMessageBody(textToSend);
    } finally {
      setSending(false);
    }
  }

  // Handle uploading and sending file attachments
  async function handleFileUpload(file: File) {
    if (!selectedConversation) return;

    try {
      setUploadingAttachment(true);
      setMessageError(null);

      const formData = new FormData();
      formData.append('file', file);

      // Upload file attachment
      const uploadRes = await apiFetch(
        `/messaging/conversations/${selectedConversation.id}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadRes.success || !uploadRes.data) {
        throw new Error(uploadRes.error || 'Failed to upload attachment');
      }

      const att = uploadRes.data;

      // Post message with attachment reference
      const tempId = `temp_att_${Date.now()}`;
      const msgRes = await apiFetch(
        `/messaging/conversations/${selectedConversation.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: messageBody.trim() || (att.attachmentType === 'AUDIO' ? 'Voice Message' : att.fileName),
            attachmentUrl: att.fileUrl,
            attachmentType: att.attachmentType,
            attachmentName: att.fileName,
            attachmentSize: att.fileSize,
            clientTempId: tempId,
          }),
        }
      );

      if (msgRes.success && msgRes.data?.message) {
        setMessages((prev) => [...prev, msgRes.data.message]);
        setMessageBody('');
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? {
                  ...c,
                  lastMessage: msgRes.data.message,
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error('[Upload File Error]', err);
      setMessageError(err.message || 'Failed to send attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  }

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
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
    } catch (err: any) {
      console.error('[Microphone Permission Error]', err);
      alert('Microphone access denied or not supported by this browser. Please allow microphone permissions.');
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
      audioChunksRef.current = []; // Discard chunks
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Start chat with an eligible parent
  const handleStartChatWithContact = async (contact: any) => {
    try {
      setStartingChat(true);
      const res = await apiFetch('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({
          recipientUserId: contact.parentUserId,
          studentId: contact.studentId,
          title: `Discussion regarding ${contact.studentName}`,
        }),
      });

      if (res.success && res.data?.conversation) {
        setShowNewModal(false);
        await loadConversations(res.data.conversation.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start conversation');
    } finally {
      setStartingChat(false);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredContacts = eligibleContacts.filter(
    (c) =>
      c.studentName?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.admissionNumber?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.parentName?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.batchName?.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-[#64748B]" />
            <span>Parent Messages & Faculty Communication Center</span>
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Authenticated, private channels between teachers and verified student guardians
          </p>
        </div>

        <button
          onClick={() => {
            setShowNewModal(true);
            loadEligibleContacts();
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-2xl text-xs font-semibold shadow-md transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Message a Parent
        </button>
      </div>

      {/* Main Messaging Layout */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl shadow-sm h-[720px] flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Conversation Directory */}
        <div className="w-full md:w-88 lg:w-96 border-r border-[#E2E8F0] flex flex-col bg-[#F8FAFC]/40 shrink-0">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-[#E2E8F0] space-y-3 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search parent, student, or admission #"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadConversations()}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              {(['ALL', 'UNREAD', 'READ'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setStatusFilter(mode)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    statusFilter === mode
                      ? 'bg-[#006FFF] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9]'
                  }`}
                >
                  {mode === 'ALL' ? 'All Chats' : mode === 'UNREAD' ? 'Unread' : 'Read'}
                </button>
              ))}
              <button
                onClick={() => loadConversations()}
                title="Refresh conversations"
                className="ml-auto p-1 text-[#94A3B8] hover:text-[#006FFF] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#EFEBE9]">
            {loadingConvs ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#64748B] mx-auto" />
                <p className="text-xs text-[#94A3B8]">Loading active conversations...</p>
              </div>
            ) : convError ? (
              <div className="p-6 text-center space-y-3">
                <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="text-xs text-rose-700 font-medium">{convError}</p>
                <button
                  onClick={() => loadConversations()}
                  className="px-3 py-1.5 bg-[#006FFF] text-white text-xs rounded-xl"
                >
                  Retry
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#D7CCC8]/30 flex items-center justify-center mx-auto text-[#64748B]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-[#0F172A]">No conversations found</h4>
                <p className="text-[11px] text-[#94A3B8] max-w-xs mx-auto">
                  {statusFilter === 'UNREAD'
                    ? 'No unread messages right now.'
                    : 'Start a direct message with any student guardian from your assigned batches.'}
                </p>
                <button
                  onClick={() => {
                    setShowNewModal(true);
                    loadEligibleContacts();
                  }}
                  className="mt-2 px-3 py-1.5 bg-[#006FFF] text-white text-xs font-semibold rounded-xl hover:bg-[#0058D4]"
                >
                  + New Conversation
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;
                const student = conv.student;
                const parent = conv.parent || conv.otherUser;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full p-4 text-left transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-[#006FFF]/10 border-l-4 border-[#006FFF]'
                        : 'hover:bg-white'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-2xl bg-[#006FFF]/15 text-[#006FFF] border border-[#E2E8F0] flex items-center justify-center font-bold text-sm shrink-0">
                      {parent?.fullName?.[0] || 'P'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[#0F172A] text-xs truncate">
                          {parent?.fullName || 'Parent'}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-[#94A3B8] font-mono shrink-0">
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* Student & Batch Context */}
                      {student && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-semibold text-[#64748B] truncate">
                            {student.fullName}
                          </span>
                          <span className="text-[10px] text-[#94A3B8] font-mono bg-[#F1F5F9] px-1.5 py-0.2 rounded">
                            {student.admissionNumber}
                          </span>
                        </div>
                      )}

                      {/* Last message preview */}
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p className="text-[11px] text-[#94A3B8] truncate">
                          {conv.lastMessage ? (
                            conv.lastMessage.attachmentType === 'AUDIO' ? (
                              <span className="flex items-center gap-1 text-[#64748B] font-medium">
                                <Volume2 className="w-3 h-3" /> Voice message
                              </span>
                            ) : conv.lastMessage.attachmentType === 'IMAGE' ? (
                              <span className="flex items-center gap-1 text-[#64748B] font-medium">
                                <ImageIcon className="w-3 h-3" /> Image attachment
                              </span>
                            ) : conv.lastMessage.attachmentType === 'DOCUMENT' ? (
                              <span className="flex items-center gap-1 text-[#64748B] font-medium">
                                <FileText className="w-3 h-3" /> Document
                              </span>
                            ) : (
                              conv.lastMessage.body
                            )
                          ) : (
                            <span className="italic">No messages yet</span>
                          )}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-[#006FFF] text-white text-[10px] font-bold rounded-full shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat History & Input */}
        <div className="flex-1 flex flex-col bg-[#FAF8F6]">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#E2E8F0] bg-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(selectedConversation.parent?.fullName || selectedConversation.otherUser?.fullName)?.[0] || 'P'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#0F172A] text-sm truncate">
                      {selectedConversation.parent?.fullName || selectedConversation.otherUser?.fullName || 'Guardian'}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] truncate">
                      {selectedConversation.student && (
                        <span>
                          Student: <strong>{selectedConversation.student.fullName}</strong> ({selectedConversation.student.admissionNumber})
                        </span>
                      )}
                      {selectedConversation.batch?.name && (
                        <span className="bg-[#F8FAFC] px-2 py-0.5 rounded text-[10px] font-semibold text-[#006FFF]">
                          {selectedConversation.batch.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Private & Verified</span>
                  </div>
                </div>
              </div>

              {/* Message History Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#94A3B8] gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#64748B]" />
                    <span>Loading message history...</span>
                  </div>
                ) : messageError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {messageError}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] text-xs space-y-2">
                    <MessageSquare className="w-8 h-8 text-[#94A3B8]" />
                    <p className="font-semibold text-[#006FFF]">No messages exchanged yet</p>
                    <p className="text-[11px] max-w-xs text-center">
                      Send a message, share student progress updates, or attach homework instructions.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user?.id || msg.isMine;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-md p-3.5 rounded-2xl text-xs space-y-2 shadow-sm ${
                            isMe
                              ? 'bg-[#006FFF] text-white rounded-br-none'
                              : 'bg-white text-[#0F172A] rounded-bl-none border border-[#E2E8F0]'
                          }`}
                        >
                          <span
                            className={`text-[10px] font-semibold block ${
                              isMe ? 'text-[#D7CCC8]' : 'text-[#64748B]'
                            }`}
                          >
                            {isMe ? 'You' : msg.sender?.fullName || 'Parent'}
                          </span>

                          {/* Image Attachment */}
                          {msg.attachmentType === 'IMAGE' && msg.attachmentUrl && (
                            <div className="rounded-xl overflow-hidden border border-black/10 my-1 bg-black/5">
                              <img
                                src={msg.attachmentUrl}
                                alt={msg.attachmentName || 'Attachment'}
                                onClick={() => setLightboxImg(msg.attachmentUrl)}
                                className="max-h-60 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                              />
                            </div>
                          )}

                          {/* Voice Note Audio Attachment */}
                          {msg.attachmentType === 'AUDIO' && msg.attachmentUrl && (
                            <div className="w-full max-w-sm">
                              <AudioWavePlayer
                                src={msg.attachmentUrl}
                                title="Voice Note"
                                className="!p-2.5 !rounded-xl !bg-white/80"
                              />
                            </div>
                          )}

                          {/* Document Attachment */}
                          {msg.attachmentType === 'DOCUMENT' && msg.attachmentUrl && (
                            <a
                              href={`${msg.attachmentUrl}?download=true`}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                                isMe
                                  ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white'
                                  : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#0F172A]'
                              }`}
                            >
                              <FileText className="w-5 h-5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">
                                  {msg.attachmentName || 'Document.pdf'}
                                </p>
                                <span className="text-[10px] opacity-75">
                                  {formatFileSize(msg.attachmentSize)} &bull; Tap to download
                                </span>
                              </div>
                              <Download className="w-4 h-4 shrink-0" />
                            </a>
                          )}

                          {/* Message Body */}
                          {msg.body && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>}
                        </div>

                        {/* Timestamp & read receipt */}
                        <div className="flex items-center gap-1.5 text-[10px] text-[#94A3B8] mt-1 px-1 font-mono">
                          <span>{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            msg.isReadByRecipient ? (
                              <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium" title="Read by recipient">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Read</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[10px] text-[#94A3B8]" title="Delivered">
                                <Check className="w-3.5 h-3.5" />
                                <span>Delivered</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Uploading progress indicator */}
              {uploadingAttachment && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Uploading attachment, please wait...</span>
                </div>
              )}

              {/* Active Voice Recording Bar */}
              {isRecording ? (
                <div className="p-4 border-t border-[#E2E8F0] bg-gradient-to-r from-rose-50 via-white to-rose-50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span className="text-xs font-bold text-rose-800 font-mono">
                      Recording: {Math.floor(recordingSeconds / 60)}:
                      {String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Animated Voice Equalizer Wave */}
                  <div className="flex items-center gap-1 h-6 flex-1 max-w-xs justify-center px-4">
                    {[40, 75, 50, 90, 60, 30, 85, 45, 95, 70, 35, 80, 55, 65, 90, 40].map((h, i) => (
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
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="px-3 py-1.5 text-xs text-[#64748B] hover:bg-rose-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop & Send
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Message Input Bar */
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 sm:p-4 border-t border-[#E2E8F0] bg-white flex items-center gap-2 sm:gap-3"
                >
                  {/* Hidden file inputs */}
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

                  {/* Attachment Buttons */}
                  <div className="flex items-center gap-1 text-[#94A3B8]">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      title="Attach photo"
                      className="p-2 hover:bg-[#F8FAFC] rounded-xl hover:text-[#006FFF] transition-colors"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach PDF Document"
                      className="p-2 hover:bg-[#F8FAFC] rounded-xl hover:text-[#006FFF] transition-colors"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={startRecording}
                      title="Record Voice Note"
                      className="p-2 hover:bg-[#F8FAFC] rounded-xl hover:text-rose-600 transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Text Input */}
                  <input
                    type="text"
                    placeholder="Type your message to parent..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[#0F172A] placeholder-[#8D6E63] focus:outline-none focus:ring-2 focus:ring-[#6D4C41]"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={sending || !messageBody.trim()}
                    className="p-2.5 bg-[#006FFF] hover:bg-[#0058D4] text-white rounded-xl shadow-sm disabled:opacity-50 transition-all shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#94A3B8] text-xs space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#D7CCC8]/30 flex items-center justify-center text-[#64748B]">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-[#0F172A]">Select a conversation to start chatting</h3>
              <p className="text-[11px] max-w-sm">
                Choose a parent message thread from the left directory, or start a new conversation regarding any student in your assigned batches.
              </p>
              <button
                onClick={() => {
                  setShowNewModal(true);
                  loadEligibleContacts();
                }}
                className="mt-2 px-4 py-2 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-2xl shadow-sm"
              >
                + Start New Message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal (Direct Contact Picker) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#64748B]" /> Message a Student's Parent
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Select an authorized student guardian from your assigned batches
                </p>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or parent name..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] focus:ring-2 focus:ring-[#6D4C41]"
              />
            </div>

            {/* Contact Cards List */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {loadingContacts ? (
                <div className="py-8 text-center text-xs text-[#94A3B8] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#64748B]" />
                  <span>Loading eligible students & parents...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  No eligible contacts found matching '{contactSearch}'.
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={`${contact.studentId}_${contact.parentUserId}`}
                    className="p-3.5 rounded-2xl border border-[#E2E8F0] bg-[#FAF8F6] hover:bg-white hover:border-[#6D4C41] transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#0F172A]">
                          {contact.parentName}
                        </span>
                        <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.2 rounded font-semibold">
                          {contact.relation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] mt-0.5">
                        <span>
                          Student: <strong>{contact.studentName}</strong> ({contact.admissionNumber})
                        </span>
                        <span>&bull;</span>
                        <span className="text-[#006FFF] font-medium">{contact.batchName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartChatWithContact(contact)}
                      disabled={startingChat}
                      className="px-3.5 py-1.5 bg-[#006FFF] hover:bg-[#0058D4] text-white text-xs font-semibold rounded-xl shadow-xs shrink-0 transition-all"
                    >
                      Chat
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Full Image View */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={lightboxImg}
              alt="Full preview"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setLightboxImg(null)}
              className="absolute -top-3 -right-3 p-2 bg-white rounded-full text-[#0F172A] shadow-lg hover:bg-[#F1F5F9]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
