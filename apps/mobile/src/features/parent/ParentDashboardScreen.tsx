import React, { useEffect, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ChildSelectorCard } from '../../components/parent/ChildSelectorCard';
import { useAuthStore } from '../../store/authStore';
import { useParentStore } from '../../store/parentStore';
import { getParentDashboardSummaryApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  CalendarCheck,
  CreditCard,
  BookOpen,
  Calendar,
  CheckSquare,
  MessageSquare,
  Bell,
  ChevronRight,
  Clock,
  Award,
  AlertCircle,
  FileText,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';

export const ParentDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, activeInstitute } = useAuthStore();
  const { selectedChild, setChildren } = useParentStore();

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-dashboard-summary'],
    queryFn: getParentDashboardSummaryApi,
  });

  // Sync children into Zustand store when fetched
  useEffect(() => {
    if (dashboard?.children) {
      setChildren(dashboard.children);
    }
  }, [dashboard, setChildren]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.navy} />
          <Text style={styles.loadingText}>Loading parent portal...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorSubtitle}>
            Please check your connection and tap retry to refresh parent portal.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Find the selected child's summary from the dashboard response
  const activeChild =
    dashboard.children.find((c) => c.studentId === selectedChild?.studentId) ||
    dashboard.children[0] ||
    null;

  const outstandingFees = dashboard.financialOverview?.totalOutstandingFees || 0;
  const unreadNotifications = dashboard.unreadCounts?.notifications || 0;

  return (
    <ScreenContainer backgroundColor={brandColors.surface}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitles}>
            <Text style={styles.welcomeSubtitle}>PARENT PORTAL</Text>
            <Text style={styles.parentName} numberOfLines={1}>
              {user?.fullName || 'Parent'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('ParentNotifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={20} color="#0F172A" />
          {unreadNotifications > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[brandColors.navy]}
            tintColor={brandColors.navy}
          />
        }
      >
        {/* Child Selector Card */}
        <ChildSelectorCard />

        {activeChild ? (
          <>
            {/* Campus Arrival & Departure Live Tracker */}
            <Card style={styles.attendanceTrackerCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderTitleRow}>
                  <Clock size={16} color="#006FFF" />
                  <Text style={styles.cardSectionTitle}>TODAY'S CAMPUS ATTENDANCE</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ParentAttendance')}
                >
                  <Text style={styles.viewDetailsText}>History →</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.arrivalDepartureRow}>
                {/* Arrival */}
                <View style={styles.punchBox}>
                  <Text style={styles.punchBoxLabel}>ARRIVAL</Text>
                  <Text style={styles.punchTimeText}>
                    {activeChild.todayAttendance?.checkInTime
                      ? new Date(activeChild.todayAttendance.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </Text>
                  <Badge
                    text={
                      activeChild.todayAttendance?.status === 'NOT_MARKED'
                        ? 'Not Marked'
                        : activeChild.todayAttendance?.isLate
                        ? 'Late Arrival'
                        : 'On Time'
                    }
                    variant={
                      activeChild.todayAttendance?.status === 'NOT_MARKED'
                        ? 'neutral'
                        : activeChild.todayAttendance?.isLate
                        ? 'warning'
                        : 'success'
                    }
                  />
                </View>

                <View style={styles.punchDividerVertical} />

                {/* Departure */}
                <View style={styles.punchBox}>
                  <Text style={styles.punchBoxLabel}>DEPARTURE</Text>
                  <Text style={styles.punchTimeText}>
                    {activeChild.todayAttendance?.checkOutTime
                      ? new Date(activeChild.todayAttendance.checkOutTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : activeChild.todayAttendance?.checkInTime
                      ? 'In Campus'
                      : '—'}
                  </Text>
                  <Badge
                    text={
                      activeChild.todayAttendance?.checkOutTime
                        ? 'Departed'
                        : activeChild.todayAttendance?.checkInTime
                        ? 'In Session'
                        : 'Pending'
                    }
                    variant={
                      activeChild.todayAttendance?.checkOutTime
                        ? 'info'
                        : activeChild.todayAttendance?.checkInTime
                        ? 'success'
                        : 'neutral'
                    }
                  />
                </View>
              </View>

              {/* Monthly Overview Bar */}
              <View style={styles.monthlyAttendanceBar}>
                <View style={styles.monthlyAttendanceLeft}>
                  <Text style={styles.monthlyAttendanceLabel}>
                    Monthly Attendance Rate
                  </Text>
                  <Text style={styles.monthlyDaysText}>
                    {activeChild.monthlyAttendance?.presentDays || 0} of{' '}
                    {activeChild.monthlyAttendance?.totalWorkingDays || 0} working days
                  </Text>
                </View>
                <View style={styles.attendancePercentBadge}>
                  <Text style={styles.attendancePercentText}>
                    {activeChild.monthlyAttendance?.percentage || 0}%
                  </Text>
                </View>
              </View>
            </Card>

            {/* Fee Overview Alert Banner */}
            <Card style={styles.feeBannerCard}>
              <View style={styles.feeBannerContent}>
                <View style={styles.feeBannerLeft}>
                  <View style={styles.feeIconCircle}>
                    <CreditCard size={20} color="#0F172A" />
                  </View>
                  <View>
                    <Text style={styles.feeTitle}>Fee Balance</Text>
                    <Text style={styles.feeAmount}>
                      {outstandingFees > 0
                        ? `₹${outstandingFees.toLocaleString('en-IN')}`
                        : 'All Clear'}
                    </Text>
                    <Text style={styles.feeStatusSubtitle}>
                      {outstandingFees > 0
                        ? dashboard.financialOverview?.nextUpcomingDueDate
                          ? `Due by ${new Date(dashboard.financialOverview.nextUpcomingDueDate).toLocaleDateString()}`
                          : 'Outstanding dues pending'
                        : 'No pending dues for linked children'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.feeViewBtn}
                  onPress={() => navigation.navigate('ParentFees')}
                >
                  <Text style={styles.feeViewBtnText}>Statement</Text>
                  <ChevronRight size={14} color="#006FFF" />
                </TouchableOpacity>
              </View>
            </Card>

            {/* Academic Performance Snapshot */}
            <Card style={styles.academicSnapshotCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderTitleRow}>
                  <Award size={16} color="#FEDC32" />
                  <Text style={styles.cardSectionTitle}>LATEST ACADEMIC RESULT</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ParentAcademics')}
                >
                  <Text style={styles.viewDetailsText}>Report Cards →</Text>
                </TouchableOpacity>
              </View>

              {activeChild.latestExamResult ? (
                <View style={styles.examResultRow}>
                  <View style={styles.examResultMain}>
                    <Text style={styles.examResultTitle}>
                      {activeChild.latestExamResult.examTitle}
                    </Text>
                    <Text style={styles.examResultSubject}>
                      Subject: {activeChild.latestExamResult.subject}
                    </Text>
                    <Text style={styles.examResultDate}>
                      Exam Date:{' '}
                      {new Date(activeChild.latestExamResult.examDate).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreNumber}>
                      {activeChild.latestExamResult.score}
                      <Text style={styles.scoreTotal}>
                        /{activeChild.latestExamResult.totalMarks}
                      </Text>
                    </Text>
                    <Text style={styles.scorePercentage}>
                      {activeChild.latestExamResult.percentage}%
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noDataRow}>
                  <Text style={styles.noDataText}>
                    No recent published exam results available for this term.
                  </Text>
                </View>
              )}
            </Card>

            {/* Quick Actions Portal Grid */}
            <View style={styles.quickActionsSection}>
              <Text style={styles.quickActionsHeader}>QUICK SERVICES</Text>
              <View style={styles.actionsGrid}>
                {/* Timetable */}
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => navigation.navigate('ParentTimetable')}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
                    <Calendar size={22} color="#006FFF" />
                  </View>
                  <Text style={styles.actionTitle}>Timetable</Text>
                  <Text style={styles.actionDesc}>Class Schedule</Text>
                </TouchableOpacity>

                {/* Homework */}
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => navigation.navigate('ParentHomework')}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
                    <CheckSquare size={22} color="#10B981" />
                  </View>
                  <Text style={styles.actionTitle}>Homework</Text>
                  <Text style={styles.actionDesc}>
                    {activeChild.fees?.pendingAssignmentsCount
                      ? `${activeChild.fees.pendingAssignmentsCount} Pending`
                      : 'Assignments'}
                  </Text>
                </TouchableOpacity>

                {/* Study Materials */}
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => navigation.navigate('ParentMaterials')}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <BookOpen size={22} color="#D97706" />
                  </View>
                  <Text style={styles.actionTitle}>Materials</Text>
                  <Text style={styles.actionDesc}>Notes & PDFs</Text>
                </TouchableOpacity>

                {/* Teacher Inquiries */}
                <TouchableOpacity
                  style={styles.actionTile}
                  onPress={() => navigation.navigate('ParentFeedback')}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#FAF5FF' }]}>
                    <MessageSquare size={22} color="#9333EA" />
                  </View>
                  <Text style={styles.actionTitle}>Inquiries</Text>
                  <Text style={styles.actionDesc}>Ask Teacher</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <Card style={styles.noChildrenCard}>
            <AlertCircle size={36} color="#64748B" />
            <Text style={styles.noChildrenTitle}>No Linked Students</Text>
            <Text style={styles.noChildrenDesc}>
              No student profiles have been connected to your parent account yet. Please contact your center administrator.
            </Text>
          </Card>
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
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  parentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FEDC32',
  },
  parentAvatarText: {
    color: '#FEDC32',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitles: {
    flex: 1,
  },
  welcomeSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  parentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  campusName: {
    fontSize: 12,
    color: '#006FFF',
    fontWeight: '500',
    marginTop: 1,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  attendanceTrackerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006FFF',
  },
  arrivalDepartureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  punchBox: {
    flex: 1,
    alignItems: 'center',
  },
  punchBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  punchTimeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  punchDividerVertical: {
    width: 1,
    height: 48,
    backgroundColor: '#E2E8F0',
  },
  monthlyAttendanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  monthlyAttendanceLeft: {
    flex: 1,
  },
  monthlyAttendanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  monthlyDaysText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  attendancePercentBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  attendancePercentText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006FFF',
  },
  feeBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  feeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  feeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  feeStatusSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  feeViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feeViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006FFF',
  },
  academicSnapshotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  examResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
  },
  examResultMain: {
    flex: 1,
  },
  examResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  examResultSubject: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  examResultDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreTotal: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  scorePercentage: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  noDataRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  quickActionsSection: {
    marginTop: 4,
  },
  quickActionsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionTile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  noChildrenCard: {
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
  },
  noChildrenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  noChildrenDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
