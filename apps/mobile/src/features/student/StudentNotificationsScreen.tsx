import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { brandColors, theme } from '../../theme';
import {
  getStudentNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../../api/student.api';
import { handleNotificationDeepLink } from '../../services/deepLinkService';
import { NotificationItem } from '../../types/student';
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle2,
} from 'lucide-react-native';

export const StudentNotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: getStudentNotificationsApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
  });

  // Mark all as read
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
  });

  const handleNotificationPress = (item: NotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    handleNotificationDeepLink({
      notificationId: item.id,
      entityType: item.entityType || item.type,
      entityId: item.entityId,
      studentId: item.studentId,
      link: item.link,
      ...(item.metadata || {}),
    });
  };

  const handleMarkAllRead = () => {
    markAllMutation.mutate();
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Notifications" subtitle="Loading updates..." showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading notification inbox...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <Header title="Notifications" subtitle="Campus updates" showBack />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Notifications</Text>
          <Text style={styles.errorSubtitle}>
            Failed to retrieve notification updates. Tap retry to reload.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread announcements` : 'All caught up'}
        showBack
      />

      {/* Top Action Bar */}
      {unreadCount > 0 && (
        <View style={styles.topActionBar}>
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markAllMutation.isPending}
            activeOpacity={0.7}
          >
            <CheckCheck size={16} color={brandColors.blue} />
            <Text style={styles.markAllBtnText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[brandColors.blue]}
            tintColor={brandColors.blue}
          />
        }
      >
        {notifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Bell size={40} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>Notification Inbox is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Announcements, assignment notices, and academic reminders from your institute will appear here.
            </Text>
          </Card>
        ) : (
          notifications.map((item) => {
            const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            const timeStr = new Date(item.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.8}
              >
                <Card style={[styles.notificationCard, !item.isRead && styles.unreadCard]}>
                  <View style={styles.notifRow}>
                    <View style={[styles.iconWrap, !item.isRead && styles.unreadIconWrap]}>
                      <Bell size={18} color={!item.isRead ? brandColors.blue : brandColors.textMuted} />
                    </View>

                    <View style={styles.notifContent}>
                      <View style={styles.notifHeaderRow}>
                        <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>
                          {item.title}
                        </Text>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </View>

                      <Text style={styles.notifMessage}>{item.message}</Text>

                      <Text style={styles.notifTimeText}>
                        {dateStr} at {timeStr}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: brandColors.textSecondary,
  },
  errorTitle: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  errorSubtitle: {
    fontSize: theme.typography.caption.fontSize,
    color: brandColors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: brandColors.blue,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: brandColors.white,
    fontWeight: '600',
  },
  topActionBar: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
    alignItems: 'flex-end',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.blue,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: brandColors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  notificationCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
    borderLeftWidth: 4,
    borderLeftColor: brandColors.blue,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: brandColors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  notifContent: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.textSecondary,
    flex: 1,
  },
  unreadTitle: {
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandColors.blue,
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 13,
    color: brandColors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  notifTimeText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
});
