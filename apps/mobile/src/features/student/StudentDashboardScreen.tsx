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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { StudentAvatar } from '../../components/student/StudentAvatar';
import { brandColors, theme } from '../../theme';
import { getStudentDashboardApi } from '../../api/student.api';
import {
  BookOpen,
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
  Zap,
  Star,
  Target,
  ArrowUpRight,
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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Unlocking your student universe...</Text>
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
    attendanceOverview,
    homeworkOverview,
    recentMaterials,
    academicProgress,
    notificationsOverview,
  } = dashboard;

  const safeRecentMaterials = Array.isArray(recentMaterials) ? recentMaterials : [];
  const safeUpcomingHomework = Array.isArray(homeworkOverview?.upcoming) ? homeworkOverview.upcoming : [];
  const unreadCount = notificationsOverview?.unreadCount || 0;

  const studentName = student?.firstName || 'Scholar';

  return (
    <ScreenContainer backgroundColor="#F8FAFC">
      {/* Playful & Vibrant Top Header Bar */}
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
                <Flame size={11} color="#EA580C" />
                <Text style={styles.streakText}>5 Days 🔥</Text>
              </View>
            </View>
            <Text style={styles.studentNameHeader} numberOfLines={1}>
              Hey, {studentName}! ⚡
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => navigation.navigate('StudentNotifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={20} color="#0F172A" />
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
        {/* Vibrant Gamified Scholar Level Hero Banner */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroTextCol}>
              <View style={styles.levelBadgeRow}>
                <View style={styles.xpPill}>
                  <Star size={11} color="#D97706" fill="#FEDC32" />
                  <Text style={styles.xpText}>1,250 XP</Text>
                </View>
                <View style={styles.levelPill}>
                  <Zap size={11} color="#006FFF" />
                  <Text style={styles.levelPillText}>Level 5 Scholar</Text>
                </View>
              </View>

              <Text style={styles.batchTitle}>
                {batch?.name || 'Grade 10 - Science Batch A'}
              </Text>
              <Text style={styles.instituteSubtitle}>
                {institute?.name || 'Digital Guru Learning Center'}
              </Text>
            </View>

            <View style={styles.heroIconCircle}>
              <GraduationCap size={28} color="#FEDC32" />
            </View>
          </View>
        </View>

        {/* Vibrant Interactive Metrics Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
            onPress={() => navigation.navigate('StudentAttendance')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#006FFF' }]}>
              <CheckCircle2 size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.metricValue, { color: '#006FFF' }]}>
              {attendanceOverview?.percentage ?? 0}%
            </Text>
            <Text style={styles.metricLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
            onPress={() => navigation.navigate('StudentHomework')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#EA580C' }]}>
              <Target size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.metricValue, { color: '#EA580C' }]}>
              {homeworkOverview?.pendingCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Pending HW</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
            onPress={() => navigation.navigate('StudentProgress')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#10B981' }]}>
              <Award size={16} color="#FFFFFF" />
            </View>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>
              {academicProgress?.recentMarks?.length ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Exam Marks</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Homework Missions Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: '#FFF7ED' }]}>
              <Clock size={15} color="#EA580C" />
            </View>
            <Text style={styles.sectionTitle}>Homework Missions</Text>
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
            activeOpacity={0.8}
          >
            <View style={styles.compactRowLeft}>
              <View style={[styles.compactIconBox, { backgroundColor: '#ECFDF5' }]}>
                <CheckCircle2 size={18} color="#10B981" />
              </View>
              <Text style={styles.compactRowText}>All homework missions completed! 🎉</Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          safeUpcomingHomework.map((hw) => (
            <Card key={hw.id} style={styles.homeworkCard}>
              <View style={styles.homeworkHeader}>
                <Badge text={hw.subject || 'Assignment'} variant="student" />
                <View style={styles.dueDateBadge}>
                  <Clock size={11} color="#D97706" />
                  <Text style={styles.dueDateText}>
                    Due {new Date(hw.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
              <Text style={styles.homeworkTitle}>{hw.title}</Text>
              {hw.description ? (
                <Text style={styles.homeworkDesc} numberOfLines={2}>
                  {hw.description}
                </Text>
              ) : null}
              <View style={styles.homeworkFooter}>
                <View style={styles.statusPill}>
                  <Text style={[
                    styles.submissionStatus,
                    hw.isSubmitted ? styles.statusSubmitted : styles.statusPending,
                  ]}>
                    {hw.isSubmitted ? 'Submitted 🎉' : 'Mission Pending 🎯'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => navigation.navigate('StudentHomework')}
                >
                  <Text style={styles.actionPillBtnText}>
                    {hw.isSubmitted ? 'View Work' : 'Submit Work 🚀'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Recent Study Materials Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: '#EFF6FF' }]}>
              <BookOpen size={15} color="#006FFF" />
            </View>
            <Text style={styles.sectionTitle}>Course Study Materials</Text>
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
            activeOpacity={0.8}
          >
            <View style={styles.compactRowLeft}>
              <View style={[styles.compactIconBox, { backgroundColor: '#F8FAFC' }]}>
                <BookOpen size={18} color="#64748B" />
              </View>
              <Text style={styles.compactRowText}>No new course materials uploaded</Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          safeRecentMaterials.map((mat) => (
            <Card key={mat.id} style={styles.materialCard}>
              <View style={styles.materialIconWrap}>
                <FileText size={18} color="#006FFF" />
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
                <Text style={styles.materialBtnText}>Preview</Text>
                <ArrowUpRight size={12} color="#006FFF" />
              </TouchableOpacity>
            </Card>
          ))
        )}

        {/* Academic Exam Results */}
        {academicProgress?.recentMarks && academicProgress.recentMarks.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIconBadge, { backgroundColor: '#ECFDF5' }]}>
                  <Award size={15} color="#10B981" />
                </View>
                <Text style={styles.sectionTitle}>Exam Results & Marks</Text>
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
                  <View style={styles.markTitleCol}>
                    <Text style={styles.examTitle}>{mark.examTitle}</Text>
                    <Text style={styles.examSubject}>
                      Subject: {mark.subjectName} • {new Date(mark.examDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>
                      {mark.isAbsent ? 'ABSENT' : `${mark.marksObtained} / ${mark.totalMarks}`}
                    </Text>
                    {!mark.isAbsent && (
                      <View style={[
                        styles.passTagPill,
                        mark.marksObtained >= mark.passingMarks ? styles.passPillBg : styles.failPillBg
                      ]}>
                        <Text style={[
                          styles.passTagText,
                          mark.marksObtained >= mark.passingMarks ? styles.passColor : styles.failColor
                        ]}>
                          {mark.marksObtained >= mark.passingMarks ? 'PASSED 🌟' : 'NEEDS WORK'}
                        </Text>
                      </View>
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
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
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
    color: '#006FFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  streakTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  streakText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  studentNameHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    marginBottom: theme.spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 220, 50, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 220, 50, 0.3)',
  },
  xpText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FEDC32',
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 111, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 111, 255, 0.4)',
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#60A5FA',
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  instituteSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(254, 220, 50, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(254, 220, 50, 0.3)',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
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
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006FFF',
  },
  compactRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
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
    fontWeight: '700',
    color: '#0F172A',
  },
  homeworkCard: {
    marginBottom: theme.spacing.xs,
    padding: 14,
    borderRadius: 16,
  },
  homeworkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dueDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  homeworkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  homeworkDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 17,
  },
  homeworkFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusPill: {},
  submissionStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPending: {
    color: '#D97706',
  },
  statusSubmitted: {
    color: '#10B981',
  },
  actionPillBtn: {
    backgroundColor: '#006FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionPillBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    padding: 12,
    borderRadius: 14,
  },
  materialIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  materialInfo: {
    flex: 1,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  materialMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  materialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  materialBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006FFF',
  },
  markCard: {
    marginBottom: theme.spacing.xs,
    padding: 14,
    borderRadius: 16,
  },
  markRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  markTitleCol: {
    flex: 1,
  },
  examTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  examSubject: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  passTagPill: {
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  passPillBg: {
    backgroundColor: '#ECFDF5',
  },
  failPillBg: {
    backgroundColor: '#FEF2F2',
  },
  passTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  passColor: {
    color: '#10B981',
  },
  failColor: {
    color: '#EF4444',
  },
});
