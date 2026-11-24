import React, { useState, useCallback } from 'react';
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
import {
  getParentNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../../api/parent.api';
import { handleNotificationDeepLink } from '../../services/deepLinkService';
import { brandColors, theme } from '../../theme';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  AlertCircle,
  Clock,
  Info,
  Calendar,
} from 'lucide-react-native';

export const ParentNotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-notifications'],
    queryFn: getParentNotificationsApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard-summary'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsReadApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['parent-dashboard-summary'] });
    },
  });

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'UNREAD') return !item.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ScreenContainer>
      <Header
        title="Notifications"
        subtitle="Institute Announcements & Updates"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[brandColors.navy]}
          />
        }
      >
        {/* Filter Toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'ALL' && styles.filterBtnActive]}
            onPress={() => setFilter('ALL')}
          >
            <Text
              style={[
                styles.filterBtnText,
                filter === 'ALL' && styles.filterBtnTextActive,
              ]}
            >
              All Updates ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterBtn, filter === 'UNREAD' && styles.filterBtnActive]}
            onPress={() => setFilter('UNREAD')}
          >
            <Text
              style={[
                styles.filterBtnText,
                filter === 'UNREAD' && styles.filterBtnTextActive,
              ]}
            >
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
            <CheckCheck size={16} color="#006FFF" />
            <Text style={styles.markAllBtnText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching notifications...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Notifications</Text>
            <Text style={styles.errorDesc}>
              Please check your connection and tap retry.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Bell size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              {filter === 'UNREAD'
                ? 'You have caught up with all updates.'
                : 'There are no announcements currently published.'}
            </Text>
          </Card>
        ) : (
          filteredNotifications.map((item) => {
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => {
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
                }}
              >
                <Card
                  style={[
                    styles.notifCard,
                    !item.isRead && styles.notifCardUnread,
                  ]}
                >
                  <View style={styles.notifRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        !item.isRead && styles.iconCircleUnread,
                      ]}
                    >
                      <Bell
                        size={18}
                        color={!item.isRead ? '#006FFF' : '#64748B'}
                      />
                    </View>

                    <View style={styles.notifContentCol}>
                      <View style={styles.notifHeaderRow}>
                        <Text style={styles.notifTitle}>{item.title}</Text>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </View>

                      <Text style={styles.notifMessage}>{item.message}</Text>

                      <Text style={styles.notifDate}>
                        {new Date(item.createdAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    marginVertical: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterRow: {
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
    color: '#006FFF',
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterBtnTextActive: {
    color: '#FEDC32',
    fontWeight: '700',
  },
  notifCard: {
    marginBottom: 10,
    padding: 14,
  },
  notifCardUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCircleUnread: {
    backgroundColor: '#EFF6FF',
  },
  notifContentCol: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#006FFF',
    marginLeft: 6,
  },
  notifMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  notifDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
});
