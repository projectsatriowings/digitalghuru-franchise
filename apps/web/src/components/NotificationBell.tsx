import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../services/api';
import { verifyNotificationTarget } from '../services/notificationService';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  LogOut,
  Clock,
  BookOpen,
  FileCheck,
  HelpCircle,
  CreditCard,
  MessageSquare,
  Award,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: any;
  studentId?: string | null;
  eventType?: 'CHECK_IN' | 'CHECK_OUT' | null;
  eventTime?: string | null;
  timeFormatted?: string;
  isRead: boolean;
  createdAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    photoUrl?: string | null;
  } | null;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filterUnread, setFilterUnread] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/notifications?limit=30${filterUnread ? '&unreadOnly=true' : ''}`);
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[NotificationBell] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, filterUnread]);

  // Real-time SSE Connection
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NOTIFICATION_CREATED' && payload.data) {
            const newNotif = payload.data;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((c) => c + 1);
          } else if (payload.type === 'UNREAD_COUNT_UPDATED') {
            if (typeof payload.unreadCount === 'number') {
              setUnreadCount(payload.unreadCount);
            }
            if (payload.entityType && payload.entityId) {
              setNotifications((prev) =>
                prev.map((n) =>
                  n.entityType === payload.entityType && n.entityId === payload.entityId
                    ? { ...n, isRead: true }
                    : n
                )
              );
            }
          }
        } catch (e) {
          // Ignore parse errors on keepalives
        }
      };

      eventSource.onerror = () => {
        // Fallback: will auto-reconnect or use polling
      };
    } catch (err) {
      console.warn('[NotificationBell] SSE setup warning:', err);
    }

    // Periodic poll fallback every 20 seconds
    const pollInterval = setInterval(() => {
      apiFetch('/notifications/unread-count')
        .then((res) => {
          if (res.success && res.data?.unreadCount !== undefined) {
            setUnreadCount(res.data.unreadCount);
          }
        })
        .catch(() => { });
    }, 20000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(pollInterval);
    };
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    // 1. Mark as read immediately on click
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    // 2. Target Verification
    if (notif.entityType && notif.entityId) {
      try {
        const verify = await verifyNotificationTarget(notif.entityType, notif.entityId);
        if (verify && verify.available === false) {
          toast.error('Content Unavailable: The requested item may have been deleted, unpublished, or is no longer accessible.');
          return;
        }
      } catch {
        // If verification check fails, proceed with navigation
      }
    }

    // 3. Exact Role-Based Deep Linking
    const role = user?.role;
    let targetUrl = notif.link || '/';

    if (notif.entityType && notif.entityId) {
      const eType = notif.entityType.toUpperCase();
      const eId = notif.entityId;

      if (role === 'PARENT') {
        const studentParam = notif.studentId ? `&studentId=${notif.studentId}` : '';
        switch (eType) {
          case 'HOMEWORK':
            targetUrl = `/parent_academics?homeworkId=${eId}${studentParam}`;
            break;
          case 'MATERIAL':
            targetUrl = `/parent_academics?materialId=${eId}${studentParam}`;
            break;
          case 'EXAM':
            targetUrl = `/parent_test_results?examId=${eId}${studentParam}`;
            break;
          case 'ATTENDANCE':
            targetUrl = `/parent_attendance${notif.studentId ? `?studentId=${notif.studentId}` : ''}`;
            break;
          case 'FEE':
            targetUrl = `/parent_fees?paymentId=${eId}`;
            break;
          case 'MESSAGE':
            targetUrl = `/parent_communication?conversationId=${eId}`;
            break;
          case 'PROGRESS_REPORT':
            targetUrl = `/parent_academics?reportId=${eId}${studentParam}`;
            break;
          default:
            targetUrl = notif.link || '/parent';
        }
      } else if (role === 'STUDENT') {
        switch (eType) {
          case 'HOMEWORK':
            targetUrl = `/homework?homeworkId=${eId}`;
            break;
          case 'MATERIAL':
            targetUrl = `/learning_materials?materialId=${eId}`;
            break;
          case 'QUIZ':
            targetUrl = `/homework?quizId=${eId}`;
            break;
          case 'EXAM':
            targetUrl = `/exams?examId=${eId}`;
            break;
          case 'ATTENDANCE':
            targetUrl = `/attendance`;
            break;
          case 'MESSAGE':
            targetUrl = `/messaging?conversationId=${eId}`;
            break;
          case 'PROGRESS_REPORT':
            targetUrl = `/progress_reviews?reportId=${eId}`;
            break;
          default:
            targetUrl = notif.link || '/';
        }
      } else {
        // STAFF / ACADEMIC_ADMIN / SUPER_ADMIN
        switch (eType) {
          case 'HOMEWORK':
            targetUrl = `/homework?homeworkId=${eId}${notif.metadata?.submissionId ? `&submissionId=${notif.metadata.submissionId}` : ''}`;
            break;
          case 'MATERIAL':
            targetUrl = `/learning_materials?materialId=${eId}`;
            break;
          case 'QUIZ':
            targetUrl = `/homework?quizId=${eId}`;
            break;
          case 'EXAM':
            targetUrl = `/exams?examId=${eId}`;
            break;
          case 'ATTENDANCE':
            targetUrl = `/attendance`;
            break;
          case 'FEE':
            targetUrl = `/fees?paymentId=${eId}`;
            break;
          case 'MESSAGE':
            targetUrl = `/messaging?conversationId=${eId}`;
            break;
          case 'PROGRESS_REPORT':
            targetUrl = `/progress_reviews?reportId=${eId}`;
            break;
          default:
            targetUrl = notif.link || '/';
        }
      }
    }

    // Dispatch tab change event and update browser history
    const [pathPart, searchPart] = targetUrl.split('?');
    const tab = pathPart.replace(/^\//, '');
    const search = searchPart ? `?${searchPart}` : '';
    window.history.pushState({}, '', targetUrl);
    window.dispatchEvent(new CustomEvent('tuitionos:tab-change', { detail: { tab, search } }));
  };

  const getNotificationIcon = (notif: NotificationItem) => {
    const isCheckIn = notif.eventType === 'CHECK_IN' || notif.title?.includes('Check-in') || notif.title?.includes('Checked In');
    const isCheckOut = notif.eventType === 'CHECK_OUT' || notif.title?.includes('Check-out') || notif.title?.includes('Checked Out');

    if (isCheckIn) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    if (isCheckOut) {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-amber-50 text-amber-700 border-amber-200">
          <LogOut className="w-4 h-4" />
        </div>
      );
    }

    const eType = notif.entityType?.toUpperCase();
    if (eType === 'HOMEWORK') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-indigo-50 text-indigo-700 border-indigo-200">
          <FileCheck className="w-4 h-4" />
        </div>
      );
    }
    if (eType === 'MATERIAL') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-blue-50 text-blue-700 border-blue-200">
          <BookOpen className="w-4 h-4" />
        </div>
      );
    }
    if (eType === 'QUIZ') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-purple-50 text-purple-700 border-purple-200">
          <HelpCircle className="w-4 h-4" />
        </div>
      );
    }
    if (eType === 'EXAM') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-rose-50 text-rose-700 border-rose-200">
          <Award className="w-4 h-4" />
        </div>
      );
    }
    if (eType === 'FEE') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-200">
          <CreditCard className="w-4 h-4" />
        </div>
      );
    }
    if (eType === 'MESSAGE') {
      return (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-sky-50 text-sky-700 border-sky-200">
          <MessageSquare className="w-4 h-4" />
        </div>
      );
    }

    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-[#006FFF]/10 text-[#006FFF] border-[#E2E8F0]">
        <Bell className="w-4 h-4" />
      </div>
    );
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]/60 transition-colors focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-black text-white bg-[#B91C1C] rounded-full shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-[#F1F5F9] bg-[#F8FAFC]/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[#0F172A]">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#006FFF]/10 text-[#006FFF] border border-[#E2E8F0]">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#F1F5F9] bg-white text-xs">
            <button
              onClick={() => setFilterUnread(false)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${!filterUnread
                  ? 'bg-[#006FFF] text-white shadow-xs'
                  : 'text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterUnread(true)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${filterUnread
                  ? 'bg-[#006FFF] text-white shadow-xs'
                  : 'text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
            >
              Unread only
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#EFEBE9]">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#94A3B8]">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#94A3B8] space-y-1">
                <Bell className="w-8 h-8 text-[#D7CCC8] mx-auto mb-2" />
                <p className="font-semibold text-[#475569]">No notifications yet</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Student check-in, check-out, and academic updates will appear here in real time.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-[#F8FAFC]/70 transition-colors cursor-pointer flex items-start gap-3 ${!notif.isRead ? 'bg-[#F8FAFC]/40 font-medium' : 'bg-white'
                    }`}
                >
                  {/* Icon */}
                  {getNotificationIcon(notif)}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#0F172A] truncate">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#B91C1C] shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-[#475569] mt-0.5 leading-snug break-words">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#94A3B8]">
                      <span className="flex items-center gap-1 font-semibold text-[#006FFF]">
                        <Clock className="w-3 h-3 text-[#64748B]" />
                        {notif.timeFormatted ||
                          new Intl.DateTimeFormat('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          }).format(new Date(notif.eventTime || notif.createdAt))}
                      </span>
                      {notif.student && (
                        <span>&bull; {notif.student.firstName}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-[#F8FAFC]/60 border-t border-[#F1F5F9] text-center text-[10px] text-[#94A3B8] font-medium flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-time in-app attendance & academic notifications active
          </div>
        </div>
      )}
    </div>
  );
};
