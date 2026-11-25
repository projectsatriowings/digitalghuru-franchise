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
import { StudentAvatar } from '../../components/student/StudentAvatar';
import { brandColors, theme } from '../../theme';
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
  Flame,
  Target,
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
          <Text style={styles.loadingText}>Loading student portal...</Text>
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
            Please check your connection and tap retry to refresh your portal.
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

  const studentName = student?.firstName || 'Student';

  return (
    <ScreenContainer backgroundColor={brandColors.surface}>
      {/* Top Header Bar with Character Avatar */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <StudentAvatar
            gender={student?.gender}
            name={student?.fullName || student?.firstName}
            size="md"
          />
          <View style={styles.brandTitleWrap}>
            <View style={styles.portalTagRow}>
              <Text style={styles.brandSubtitleText}>STUDENT PORTAL</Text>
              <View style={styles.streakTag}>
                <Flame size={10} color="#FF6B00" />
                <Text style={styles.streakText}>5 Days</Text>
              </View>
            </View>
            <Text style={styles.studentNameHeader} numberOfLines={1}>
              Hey, {studentName}! 🚀
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('StudentNotifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={20} color={brandColors.textPrimary} />
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
        {/* Student Level & Enrollment Hero Card */}
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <View style={styles.batchInfoContainer}>
              <View style={styles.badgeRow}>
                <View style={styles.levelPill}>
                  <Sparkles size={11} color="#D97706" />
                  <Text style={styles.levelPillText}>Level 5 Scholar</Text>
                </View>
                <Badge text={student?.admissionNumber || 'APEX-101'} variant="student" />
              </View>
              <Text style={styles.batchTitle}>
                {batch?.name || 'Grade 10 - Science Batch A'}
              </Text>
              <Text style={styles.instituteSubtitle}>
                {institute?.name || 'Digital Guru Learning Center'}
              </Text>
            </View>
            <View style={styles.bannerIconCircle}>
              <GraduationCap size={26} color={brandColors.blue} />
            </View>
          </View>
        </Card>

        {/* Quick Animated Metrics Bar */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentAttendance')}
            activeOpacity={0.75}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <CheckCircle2 size={18} color={brandColors.blue} />
            </View>
            <Text style={styles.metricValue}>
              {attendanceOverview?.percentage ?? 0}%
            </Text>
            <Text style={styles.metricLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentHomework')}
            activeOpacity={0.75}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={18} color="#D97706" />
            </View>
            <Text style={styles.metricValue}>
              {homeworkOverview?.pendingCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Pending HW</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('StudentProgress')}
            activeOpacity={0.75}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Award size={18} color="#059669" />
            </View>
            <Text style={styles.metricValue}>
              {academicProgress?.recentMarks?.length ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Exam Marks</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Homework Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={16} color="#D97706" />
            <Text style={styles.sectionTitle}>Upcoming Homework</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('StudentHomework')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>View All</Text>
            <ChevronRight size={14} color={brandColors.blue} />
          </TouchableOpacity>
        </View>

        {safeUpcomingHomework.length === 0 ? (
          <TouchableOpacity
            style={styles.compactRowCard}
            onPress={() => navigation.navigate('StudentHomework')}
            activeOpacity={0.75}
          >
            <View style={styles.compactRowLeft}>
              <View style={[styles.compactIconBox, { backgroundColor: '#ECFDF5' }]}>
                <CheckCircle2 size={18} color="#059669" />
              </View>
              <Text style={styles.compactRowText}>All caught up! No pending homework</Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
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
            <FileText size={16} color={brandColors.blue} />
            <Text style={styles.sectionTitle}>Recent Study Materials</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('StudentMaterials')}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>Browse</Text>
            <ChevronRight size={14} color={brandColors.blue} />
          </TouchableOpacity>
        </View>

        {safeRecentMaterials.length === 0 ? (
          <TouchableOpacity
            style={styles.compactRowCard}
            onPress={() => navigation.navigate('StudentMaterials')}
            activeOpacity={0.75}
          >
            <View style={styles.compactRowLeft}>
              <View style={[styles.compactIconBox, { backgroundColor: '#F8FAFC' }]}>
                <BookOpen size={18} color="#64748B" />
              </View>
              <Text style={styles.compactRowText}>No new study materials uploaded</Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          safeRecentMaterials.map((mat) => (
            <Card key={mat.id} style={styles.materialCard}>
              <View style={styles.materialIconWrap}>
                <FileText size={18} color={brandColors.blue} />
              </View>
              <View style={styles.materialInfo}>
                <Text style={styles.materialTitle} numberOfLines={1}>{mat.title}</Text>
                <Text style={styles.materialMeta}>
                  {typeof mat.subject === 'object' && mat.subject ? (mat.subject as any).name : (mat.subject || 'General')} • {mat.type || 'DOCUMENT'}
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
                <Award size={16} color="#059669" />
                <Text style={styles.sectionTitle}>Recent Exam Marks</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('StudentProgress')}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>All Results</Text>
                <ChevronRight size={14} color={brandColors.blue} />
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
    fontSize: 14,
    color: brandColors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  errorSubtitle: {
    fontSize: 13,
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  brandTitleWrap: {
    justifyContent: 'center',
    flex: 1,
  },
  portalTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  brandSubtitleText: {
    fontSize: 10,
    fontWeight: '800',
    color: brandColors.blue,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  streakTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  streakText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C2410C',
  },
  studentNameHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: brandColors.textPrimary,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
    paddingBottom: 80,
  },
  bannerCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: theme.spacing.md,
    padding: 14,
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
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 2,
  },
  instituteSubtitle: {
    fontSize: 12,
    color: brandColors.textSecondary,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: brandColors.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: brandColors.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.blue,
  },
  compactRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
  },
  compactRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
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
