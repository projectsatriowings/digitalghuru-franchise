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
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { brandColors, theme } from '../../theme';
import { getStudentAttendanceHistoryApi } from '../../api/student.api';
import {
  CheckCircle2,
  Clock,
  QrCode,
  Mic,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react-native';

export const StudentAttendanceScreen: React.FC = () => {
  const {
    data: attendanceData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-attendance'],
    queryFn: getStudentAttendanceHistoryApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Attendance Record" subtitle="Loading check-in history..." showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading attendance record...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !attendanceData) {
    return (
      <ScreenContainer>
        <Header title="Attendance Record" subtitle="Session tracking" showBack />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Attendance</Text>
          <Text style={styles.errorSubtitle}>
            Failed to retrieve attendance logs. Tap retry to refresh.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const { stats, events = [] } = attendanceData;

  const renderMethodIcon = (method: string) => {
    switch (method) {
      case 'QR_SCAN':
        return <QrCode size={14} color={brandColors.blue} />;
      case 'VOICE_CONFIRMED':
        return <Mic size={14} color="#059669" />;
      default:
        return <FileCheck size={14} color={brandColors.textSecondary} />;
    }
  };

  return (
    <ScreenContainer>
      <Header
        title="Attendance Record"
        subtitle="Verified classroom attendance"
        showBack
      />

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
        {/* Attendance Summary Hero Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.percentageCircle}>
              <Text style={styles.percentageText}>{stats?.percentage ?? 0}%</Text>
              <Text style={styles.percentageLabel}>Overall</Text>
            </View>
            <View style={styles.summaryStatsColumn}>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>Total Sessions</Text>
                <Text style={styles.statValue}>{stats?.totalDays ?? 0}</Text>
              </View>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>On-Time Check-Ins</Text>
                <Text style={[styles.statValue, { color: brandColors.success }]}>
                  {Math.max(0, (stats?.presentDays ?? 0) - (stats?.lateDays ?? 0))}
                </Text>
              </View>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>Late Check-Ins</Text>
                <Text style={[styles.statValue, { color: '#D97706' }]}>
                  {stats?.lateDays ?? 0}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Calendar size={18} color={brandColors.blue} />
          <Text style={styles.sectionTitle}>Attendance Event Log</Text>
        </View>

        {events.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle2 size={40} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Attendance Records Yet</Text>
            <Text style={styles.emptySubtitle}>
              When you scan your QR pass or your teacher takes attendance, your check-in logs will appear here.
            </Text>
          </Card>
        ) : (
          events.map((event) => {
            const eventDateStr = new Date(event.eventTime || event.eventDate).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const eventTimeStr = new Date(event.eventTime).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={event.id} style={styles.eventCard}>
                <View style={styles.eventRow}>
                  <View style={styles.eventLeft}>
                    <View style={styles.eventBadgeRow}>
                      <Badge
                        text={event.eventType === 'CHECK_IN' ? 'Check-In' : 'Check-Out'}
                        variant={event.eventType === 'CHECK_IN' ? 'student' : 'neutral'}
                      />
                      {event.isLate && (
                        <Badge text="Late" variant="warning" />
                      )}
                    </View>
                    <Text style={styles.eventDateText}>{eventDateStr}</Text>
                    {event.batch?.name && (
                      <Text style={styles.eventBatchText}>
                        Batch: {event.batch.name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.eventRight}>
                    <View style={styles.timeWrap}>
                      <Clock size={14} color={brandColors.textSecondary} />
                      <Text style={styles.eventTimeText}>{eventTimeStr}</Text>
                    </View>
                    <View style={styles.methodPill}>
                      {renderMethodIcon(event.method)}
                      <Text style={styles.methodText}>
                        {event.method.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </View>

                {event.remarks && (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksText}>
                      Note: {event.remarks}
                    </Text>
                  </View>
                )}
              </Card>
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  percentageCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: brandColors.white,
    borderWidth: 4,
    borderColor: brandColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 22,
    fontWeight: '800',
    color: brandColors.blue,
  },
  percentageLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: brandColors.textMuted,
  },
  summaryStatsColumn: {
    flex: 1,
    gap: 6,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.sm,
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
  eventCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventLeft: {
    flex: 1,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  eventDateText: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginTop: 2,
  },
  eventBatchText: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 2,
  },
  eventRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: brandColors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  methodText: {
    fontSize: 10,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  remarksBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: brandColors.borderLight,
  },
  remarksText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: brandColors.textSecondary,
  },
});
