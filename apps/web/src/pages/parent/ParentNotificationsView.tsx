import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../services/api';
import { verifyNotificationTarget } from '../../services/notificationService';
import { useToast } from '../../context/ToastContext';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Calendar,
  CreditCard,
  Award,
  MessageSquare,
  AlertCircle,
  FileCheck,
  BookOpen,
} from 'lucide-react';

interface ParentNotificationsViewProps {
  onNavigateTab: (tab: string, context?: any) => void;
}

export const ParentNotificationsView: React.FC<ParentNotificationsViewProps> = ({ onNavigateTab }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);
  const toast = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/notifications?limit=50${filterUnreadOnly ? '&unreadOnly=true' : ''}`);
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[Fetch Notifications Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filterUnreadOnly]);

  // Real-time SSE listener for parent alerts
  useEffect(() => {
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    try {
      const es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'NOTIFICATION_CREATED' && payload.data) {
            const newNotif = payload.data;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
            setUnreadCount((c) => c + 1);
          }
        } catch (e) {
          // ignore keepalive parse
        }
      };

      es.onerror = () => {
        // SSE error - EventSource automatically attempts reconnection
      };
    } catch (err) {
      console.warn('[ParentNotificationsView] SSE connection error:', err);
    }

    // Polling fallback every 25 seconds
    const interval = setInterval(() => {
      apiFetch(`/notifications/unread-count`).then((res) => {
        if (res.success && res.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount);
        }
      }).catch(() => {});
    }, 25000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleNotificationClick = async (notif: any) => {
    try {
      // 1. Mark as read immediately
      if (!notif.isRead) {
        await apiFetch(`/notifications/${notif.id}/read`, { method: 'PATCH' }).catch(() => {
          return apiFetch(`/notifications/in-app/${notif.id}/read`, { method: 'PATCH' });
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      // 2. Target Verification
      if (notif.entityType && notif.entityId) {
        const verify = await verifyNotificationTarget(notif.entityType, notif.entityId);
        if (verify && verify.available === false) {
          toast.error('Content Unavailable: The requested item may have been deleted, unpublished, or is no longer accessible.');
          return;
        }
      }

      // 3. Navigate to exact parent tab & item
      const eType = (notif.entityType || notif.type || '').toUpperCase();
      if (eType === 'HOMEWORK' || eType === 'MATERIAL' || eType === 'PROGRESS_REPORT') {
        onNavigateTab('academics', { entityType: eType, entityId: notif.entityId, studentId: notif.studentId });
      } else if (eType === 'EXAM' || eType === 'TEST_RESULT') {
        onNavigateTab('results', { examId: notif.entityId, studentId: notif.studentId });
      } else if (eType === 'ATTENDANCE' || eType === 'ABSENCE') {
        onNavigateTab('attendance', { studentId: notif.studentId, eventId: notif.entityId });
      } else if (eType === 'FEE' || eType === 'FEE_DUE' || eType === 'FEE_PAID') {
        onNavigateTab('fees', { paymentId: notif.entityId });
      } else if (eType === 'MESSAGE' || eType === 'NEW_MESSAGE') {
        onNavigateTab('communication', { conversationId: notif.entityId });
      } else if (notif.link) {
        if (notif.link.includes('fees')) onNavigateTab('fees');
        else if (notif.link.includes('attendance')) onNavigateTab('attendance');
        else if (notif.link.includes('messaging') || notif.link.includes('communication')) onNavigateTab('communication');
        else if (notif.link.includes('exams') || notif.link.includes('results')) onNavigateTab('results');
        else if (notif.link.includes('academics') || notif.link.includes('homework') || notif.link.includes('materials')) onNavigateTab('academics');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' }).catch(() => {
        return apiFetch('/notifications/mark-all-read', { method: 'POST' });
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (notif: any) => {
    const eType = (notif.entityType || notif.type || '').toUpperCase();
    switch (eType) {
      case 'ATTENDANCE':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'ABSENCE':
        return <AlertCircle className="w-5 h-5 text-rose-600" />;
      case 'FEE':
      case 'FEE_DUE':
      case 'FEE_PAID':
        return <CreditCard className="w-5 h-5 text-amber-600" />;
      case 'EXAM':
      case 'TEST_RESULT':
        return <Award className="w-5 h-5 text-emerald-600" />;
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'HOMEWORK':
        return <FileCheck className="w-5 h-5 text-indigo-600" />;
      case 'MATERIAL':
        return <BookOpen className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-[#64748B]" />;
    }
  };

  const formatKolkataTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return isNaN(d.getTime())
      ? ''
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#64748B]" /> In-App Notification Center
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real-time attendance alerts, fee reminders, teacher updates, and examination results
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#64748B] cursor-pointer">
            <input
              type="checkbox"
              checked={filterUnreadOnly}
              onChange={(e) => setFilterUnreadOnly(e.target.checked)}
              className="rounded text-[#006FFF] focus:ring-[#006FFF]/20"
            />
            <span>Unread only</span>
          </label>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-[#006FFF] inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" /> Mark All as Read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-[#94A3B8]">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#94A3B8] space-y-2">
            <Bell className="w-10 h-10 mx-auto text-[#D7CCC8]" />
            <p>You have no notifications at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#EFEBE9]">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 sm:p-5 transition-colors cursor-pointer flex items-start gap-4 ${
                  !n.isRead ? 'bg-[#FAF8F6] border-l-4 border-[#006FFF]' : 'hover:bg-[#F8FAFC]/60'
                }`}
              >
                <div className="p-2.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs shrink-0 mt-0.5">
                  {getNotificationIcon(n)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[#0F172A]">{n.title}</h4>
                    <span className="text-[10px] text-[#94A3B8] shrink-0 font-medium">
                      {n.timeFormatted || formatKolkataTime(n.eventTime || n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed font-normal">{n.message}</p>
                  {!n.isRead && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#006FFF]"></span>
                      <span className="text-[10px] font-bold text-[#006FFF]">New &bull; Click to open</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
