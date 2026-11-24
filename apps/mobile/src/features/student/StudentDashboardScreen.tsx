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
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { brandColors, roleThemes, theme } from '../../theme';
import { getStudentDashboardApi } from '../../api/student.api';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Bell,
  FileText,
  Award,
  ChevronRight,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from 'lucide-react-native';

export const StudentDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: getStudentDashboardApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading your learning dashboard...</Text>
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
            Please check your connection and tap retry to refresh your student portal.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const {
    student,
    institute,
    batch,
    todayClasses,
    attendanceOverview,
    homeworkOverview,
    recentMaterials,
    academicProgress,
    notificationsOverview,
  } = dashboard;

  const safeTodayClasses = Array.isArray(todayClasses) ? todayClasses : [];
  const safeRecentMaterials = Array.isArray(recentMaterials) ? recentMaterials : [];
  const safeUpcomingHomework = Array.isArray(homeworkOverview?.upcoming) ? homeworkOverview.upcoming : [];
  const unreadCount = notificationsOverview?.unreadCount || 0;

  return (
    <ScreenContainer>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(student?.firstName?.[0] || 'S') + (student?.lastName?.[0] || '')}
            </Text>
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greetingSub}>Welcome back,</Text>
            <Text style={styles.studentName} numberOfLines={1}>
              {student?.fullName || `${student?.firstName} ${student?.lastName}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('StudentNotifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={22} color={brandColors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
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
            colors={[brandColors.blue]}
            tintColor={brandColors.blue}
          />
        }
      >
        {/* Banner: Batch & Campus Info */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.batchInfoContainer}>
              <View style={styles.badgeRow}>
                <Badge text={student?.admissionNumber || 'Student'} variant="student" />
                <Badge text={student?.status || 'ACTIVE'} variant="success" />
              </View>
              <Text style={styles.batchTitle}>
                {batch?.name || 'Enrolled Student'}
              </Text>
              <Text style={styles.instituteSubtitle}>
                {institute?.name || 'Digital Guru Learning Center'}
              </Text>
            </View>
            <View style={styles.bannerIconCircle}>
              <GraduationCap size={28} color={brandColors.blue} />
            </View>
          </View>
        </Card>

        {/* Quick Metrics Bar */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentAttendance')}
            activeOpacity={0.7}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <CheckCircle2 size={20} color={brandColors.blue} />
            </View>
            <Text style={styles.metricValue}>
              {attendanceOverview?.percentage ?? 0}%
            </Text>
            <Text style={styles.metricLabel}>Attendance</Text>
            <Text style={styles.metricSub}>
              {attendanceOverview?.presentCount ?? 0} sessions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentHomework')}
            activeOpacity={0.7}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={20} color="#D97706" />
            </View>
            <Text style={styles.metricValue}>
              {homeworkOverview?.pendingCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Pending HW</Text>
            <Text style={styles.metricSub}>
              {homeworkOverview?.totalCount ?? 0} total assigned
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentProgress')}
            activeOpacity={0.7}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Award size={20} color="#059669" />
            </View>
            <Text style={styles.metricValue}>
              {academicProgress?.recentMarks?.length ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Exam Marks</Text>
            <Text style={styles.metricSub}>View progress</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Timetable Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Calendar size={18} color={brandColors.blue} />
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('StudentTimetable')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Full Timetable</Text>
            <ChevronRight size={16} color={brandColors.blue} />
          </TouchableOpacity>
        </View>

        {safeTodayClasses.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={32} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Classes Scheduled Today</Text>
            <Text style={styles.emptySubtitle}>
              You have no active class slots scheduled for today. Enjoy your study time!
            </Text>
          </Card>
        ) : (
          safeTodayClasses.map((slot, index) => (
            <Card key={slot.id || index} style={styles.classCard}>
              <View style={styles.classTimeColumn}>
                <Clock size={16} color={brandColors.blue} />
                <Text style={styles.classTimeText}>{slot.timeDisplay}</Text>
              </View>
              <View style={styles.classDivider} />
              <View style={styles.classDetailsColumn}>
                <Text style={styles.classSubject}>{slot.subjectName}</Text>
                {slot.teacherName ? (
                  <Text style={styles.classTeacher}>Teacher: {slot.teacherName}</Text>
                ) : (
                  <Text style={styles.classBatch}>{slot.batchName}</Text>
                )}
              </View>
            </Card>
          ))
        )}

        {/* Pending Homework Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={18} color="#D97706" />
            <Text style={styles.sectionTitle}>Upcoming Homework</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('StudentHomework')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>View All</Text>
            <ChevronRight size={16} color={brandColors.blue} />
          </TouchableOpacity>
        </View>

        {safeUpcomingHomework.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle2 size={32} color={brandColors.success} />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              No pending homework submissions due. Great job staying on track!
            </Text>
          </Card>
        ) : (
          safeUpcomingHomework.map((hw) => (
            <Card key={hw.id} style={styles.homeworkCard}>
              <View style={styles.homeworkHeader}>
                <Badge text={hw.subject || 'Assignment'} variant="student" />
                <Text style={styles.dueDateText}>
                  Due {new Date(hw.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.homeworkTitle}>{hw.title}</Text>
              {hw.description ? (
                <Text style={styles.homeworkDesc} numberOfLines={2}>
                  {hw.description}
                </Text>
              ) : null}
              <View style={styles.homeworkFooter}>
                <Text style={[
                  styles.submissionStatus,
                  hw.isSubmitted ? styles.statusSubmitted : styles.statusPending,
                ]}>
                  {hw.isSubmitted ? 'Submitted' : 'Pending Submission'}
                </Text>
                <TouchableOpacity
                  style={styles.actionPill}
                  onPress={() => navigation.navigate('StudentHomework')}
                >
                  <Text style={styles.actionPillText}>
                    {hw.isSubmitted ? 'View Submission' : 'Submit Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Recent Learning Materials */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <FileText size={18} color={brandColors.blue} />
            <Text style={styles.sectionTitle}>Recent Study Materials</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('StudentMaterials')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Browse</Text>
            <ChevronRight size={16} color={brandColors.blue} />
          </TouchableOpacity>
        </View>

        {safeRecentMaterials.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BookOpen size={32} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Materials Yet</Text>
            <Text style={styles.emptySubtitle}>
              Course notes and documents shared by your teachers will appear here.
            </Text>
          </Card>
        ) : (
          safeRecentMaterials.map((mat) => (
            <Card key={mat.id} style={styles.materialCard}>
              <View style={styles.materialIconWrap}>
                <FileText size={20} color={brandColors.blue} />
              </View>
              <View style={styles.materialInfo}>
                <Text style={styles.materialTitle} numberOfLines={1}>{mat.title}</Text>
                <Text style={styles.materialMeta}>
                  {mat.subject || 'General'} • {mat.type || 'DOCUMENT'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.materialBtn}
                onPress={() => navigation.navigate('StudentMaterials')}
              >
                <Text style={styles.materialBtnText}>Open</Text>
              </TouchableOpacity>
            </Card>
          ))
        )}

        {/* Recent Academic Marks */}
        {academicProgress?.recentMarks && academicProgress.recentMarks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Award size={18} color="#059669" />
                <Text style={styles.sectionTitle}>Recent Exam Marks</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('StudentProgress')}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>All Results</Text>
                <ChevronRight size={16} color={brandColors.blue} />
              </TouchableOpacity>
            </View>

            {academicProgress.recentMarks.map((mark) => (
              <Card key={mark.id} style={styles.markCard}>
                <View style={styles.markRow}>
                  <View>
                    <Text style={styles.examTitle}>{mark.examTitle}</Text>
                    <Text style={styles.examSubject}>
                      {mark.subjectName} • {new Date(mark.examDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>
                      {mark.isAbsent ? 'ABSENT' : `${mark.marksObtained} / ${mark.totalMarks}`}
                    </Text>
                    {!mark.isAbsent && (
                      <Text style={[
                        styles.passTag,
                        mark.marksObtained >= mark.passingMarks ? styles.passColor : styles.failColor
                      ]}>
                        {mark.marksObtained >= mark.passingMarks ? 'PASSED' : 'NEEDS IMPROVEMENT'}
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            ))}
          </>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brandColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  avatarText: {
    color: brandColors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  greetingContainer: {
    flex: 1,
  },
  greetingSub: {
    fontSize: 12,
    color: brandColors.textMuted,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brandColors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: brandColors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    color: brandColors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  bannerCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: theme.spacing.md,
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchInfoContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  batchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 2,
  },
  instituteSubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
  },
  bannerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: brandColors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: brandColors.borderLight,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  metricSub: {
    fontSize: 10,
    color: brandColors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.blue,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.sm,
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 12,
    color: brandColors.textMuted,
    textAlign: 'center',
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  classTimeColumn: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  classTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.textPrimary,
    textAlign: 'center',
  },
  classDivider: {
    width: 1,
    height: 36,
    backgroundColor: brandColors.borderLight,
    marginHorizontal: theme.spacing.sm,
  },
  classDetailsColumn: {
    flex: 1,
  },
  classSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  classTeacher: {
    fontSize: 12,
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  classBatch: {
    fontSize: 12,
    color: brandColors.textMuted,
  },
  homeworkCard: {
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  homeworkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dueDateText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  homeworkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginBottom: 2,
  },
  homeworkDesc: {
    fontSize: 12,
    color: brandColors.textSecondary,
    marginBottom: 6,
  },
  homeworkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  submissionStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPending: {
    color: '#D97706',
  },
  statusSubmitted: {
    color: brandColors.success,
  },
  actionPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionPillText: {
    color: brandColors.blue,
    fontSize: 11,
    fontWeight: '600',
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  materialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
  },
  materialMeta: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 2,
  },
  materialBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: brandColors.surfaceMuted,
  },
  materialBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  markCard: {
    marginBottom: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  markRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.textPrimary,
  },
  examSubject: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  passTag: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  passColor: {
    color: brandColors.success,
  },
  failColor: {
    color: brandColors.error,
  },
});
