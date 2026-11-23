import React, { useState, useMemo, useCallback } from 'react';
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
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  getTeacherNotificationsApi,
  markTeacherNotificationReadApi,
  markAllTeacherNotificationsReadApi,
} from '../../api/teacher.api';
import { handleNotificationDeepLink } from '../../services/deepLinkService';
import { NotificationItem } from '../../types/student';
import { brandColors, theme } from '../../theme';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  AlertCircle,
  Calendar,
  BookOpen,
  Info,
} from 'lucide-react-native';

export const TeacherNotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-notifications'],
    queryFn: () => getTeacherNotificationsApi(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markTeacherNotificationReadApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllTeacherNotificationsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
  });

  const handleNotificationPress = (item: any) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    handleNotificationDeepLink({
      notificationId: item.id,
      entityType: item.entityType || item.type,
      entityId: item.entityId,
      studentId: item.studentId,
      batchId: item.metadata?.batchId,
      homeworkId: item.metadata?.homeworkId,
      link: item.link,
      ...(item.metadata || {}),
    });
  };

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'UNREAD') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, activeTab]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer>
      <Header
        title="Notifications & Alerts"
        subtitle={unreadCount > 0 ? `${unreadCount} unread announcements` : 'All caught up'}
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#FE4D01"
            colors={['#FE4D01']}
          />
        }
      >
        {/* Tab Filters */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ALL' && styles.tabActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'UNREAD' && styles.tabActive]}
            onPress={() => setActiveTab('UNREAD')}
          >
            <Text style={[styles.tabText, activeTab === 'UNREAD' && styles.tabTextActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            activeOpacity={0.7}
          >
            <CheckCheck size={16} color="#FE4D01" />
            <Text style={styles.markAllBtnText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Notifications</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Bell size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'UNREAD'
                ? 'You have reviewed all center notifications and updates.'
                : 'There are no announcements or alerts for your account.'}
            </Text>
          </Card>
        ) : (
          filteredNotifications.map((item) => {
            const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.8}
              >
                <Card
                  style={[styles.notifCard, !item.isRead && styles.unreadCard]}
                >
                  <View style={styles.notifHeader}>
                    <View style={styles.iconCircle}>
                      <Info size={18} color={item.isRead ? '#64748B' : '#FE4D01'} />
                    </View>
                    <View style={styles.titleInfo}>
                      <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>
                        {item.title}
                      </Text>
                      <Text style={styles.notifDate}>{formattedDate}</Text>
                    </View>
                    {!item.isRead && (
                      <TouchableOpacity
                        style={styles.markReadBtn}
                        onPress={() => markReadMutation.mutate(item.id)}
                      >
                        <CheckCircle2 size={16} color="#0A2540" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.notifBody}>{item.message}</Text>
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FE4D01',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#0A2540',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  notifCard: {
    marginBottom: 10,
    padding: 14,
  },
  unreadCard: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#FE4D01',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  notifDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  markReadBtn: {
    padding: 4,
  },
  notifBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
});
