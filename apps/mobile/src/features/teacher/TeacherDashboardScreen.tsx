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
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useAuthStore } from '../../store/authStore';
import { useTeacherStore } from '../../store/teacherStore';
import { getTeacherDashboardApi, getTeacherBatchesApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  Mic,
  CalendarCheck,
  Users,
  CheckSquare,
  BookOpen,
  Calendar,
  Bell,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  AlertCircle,
  Award,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react-native';

export const TeacherDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, activeInstitute } = useAuthStore();
  const { setBatches, selectedBatch } = useTeacherStore();

  const {
    data: dashboard,
    isLoading: isLoadingDashboard,
    isError: isErrorDashboard,
    refetch: refetchDashboard,
    isRefetching: isRefetchingDashboard,
  } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: getTeacherDashboardApi,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['teacher-batches'],
    queryFn: getTeacherBatchesApi,
  });

  useEffect(() => {
    if (batches.length > 0) {
      setBatches(batches);
    }
  }, [batches, setBatches]);

  const onRefresh = useCallback(() => {
    refetchDashboard();
  }, [refetchDashboard]);

  if (isLoadingDashboard) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FE4D01" />
          <Text style={styles.loadingText}>Loading faculty dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isErrorDashboard || !dashboard) {
    return (
      <ScreenContainer>
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorSubtitle}>
            Please check your connection and tap retry to refresh teacher portal.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetchDashboard()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const { teacher, metrics, todayClasses = [], recentNotifications = [] } = dashboard;
  const unreadNotifs = recentNotifications.filter((n: any) => !n.isRead).length;

  return (
    <ScreenContainer>
      {/* Teacher Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.teacherAvatar}>
            <Text style={styles.avatarText}>
              {(teacher?.fullName || user?.fullName || 'T')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </Text>
          </View>
          <View style={styles.headerTitles}>
            <Text style={styles.welcomeSubtitle}>FACULTY PORTAL</Text>
            <Text style={styles.teacherName} numberOfLines={1}>
              {teacher?.fullName || user?.fullName || 'Faculty Member'}
            </Text>
            <Text style={styles.designationText} numberOfLines={1}>
              {teacher?.designation || 'Classroom Instructor'} • {activeInstitute?.name || 'Franchise Center'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => navigation.navigate('TeacherNotifications')}
          accessibilityLabel="Notifications"
        >
          <Bell size={20} color="#0F172A" />
          {unreadNotifs > 0 && (
            <View style={styles.notifDot}>
              <Text style={styles.notifDotText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingDashboard}
            onRefresh={onRefresh}
            colors={['#FE4D01']}
            tintColor="#FE4D01"
          />
        }
      >
        {/* Active Class Batch Selector */}
        <BatchSelectorCard />

        {/* Hero Voice Attendance Banner */}
        <TouchableOpacity
          style={styles.voiceHeroCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('VoiceAttendance', { batchId: selectedBatch?.id })}
        >
          <View style={styles.voiceHeroContent}>
            <View style={styles.voiceIconRing}>
              <Mic size={24} color="#FFFFFF" />
            </View>
            <View style={styles.voiceHeroTextCol}>
              <View style={styles.voiceBadgeRow}>
                <Badge text="Fast Roll Call" variant="warning" style={styles.fastBadge} />
              </View>
              <Text style={styles.voiceHeroTitle}>Start Voice Attendance</Text>
              <Text style={styles.voiceHeroSubtitle}>
                Speak student names aloud to mark campus check-in with phonetic AI matching
              </Text>
            </View>
            <ChevronRight size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Real-Time Academic Performance Metrics */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Text style={[styles.metricNumber, { color: '#EA580C' }]}>
              {metrics?.todayAttendance?.percentage ?? 0}%
            </Text>
            <Text style={styles.metricLabel}>Attendance Rate</Text>
            <Text style={styles.metricSub}>
              {metrics?.todayAttendance?.presentCount ?? 0}/{metrics?.totalStudents ?? 0} Present
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={[styles.metricNumber, { color: '#006FFF' }]}>
              {metrics?.pendingHomeworkEvaluations ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Pending Reviews</Text>
            <Text style={styles.metricSub}>Homework Submissions</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.metricNumber, { color: '#16A34A' }]}>
              {metrics?.totalStudents ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Permitted Students</Text>
            <Text style={styles.metricSub}>In Assigned Batches</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
            <Text style={[styles.metricNumber, { color: '#9333EA' }]}>
              {metrics?.todayClassesCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Today's Classes</Text>
            <Text style={styles.metricSub}>Scheduled Periods</Text>
          </View>
        </View>

        {/* Today's Scheduled Classes */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <Clock size={16} color="#FE4D01" />
            <Text style={styles.sectionTitle}>TODAY'S SCHEDULED SESSIONS</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TeacherTimetable')}>
            <Text style={styles.sectionActionText}>Full Week →</Text>
          </TouchableOpacity>
        </View>

        {todayClasses.length === 0 ? (
          <Card style={styles.emptyScheduleCard}>
            <Calendar size={28} color="#94A3B8" />
            <Text style={styles.emptyScheduleTitle}>No Classes Scheduled for Today</Text>
            <Text style={styles.emptyScheduleDesc}>
              You have no active class periods assigned for today on your timetable.
            </Text>
          </Card>
        ) : (
          todayClasses.map((cls, idx) => (
            <Card key={idx} style={styles.classCard}>
              <View style={styles.classCardRow}>
                <View style={styles.classTimeCol}>
                  <Text style={styles.classStartTime}>{cls.startTime}</Text>
                  <Text style={styles.classEndTime}>{cls.endTime}</Text>
                </View>

                <View style={styles.classDetailsCol}>
                  <Text style={styles.classSubject}>{cls.subject}</Text>
                  <Text style={styles.classBatch}>{cls.batchName}</Text>
                  {cls.room ? (
                    <Text style={styles.classRoom}>Room: {cls.room}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.takeAttendanceBtn}
                  onPress={() =>
                    navigation.navigate('TeacherAttendance', {
                      batchId: cls.batchId || selectedBatch?.id,
                    })
                  }
                >
                  <Text style={styles.takeAttendanceText}>Roll Call</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Quick Academic Actions Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>CLASSROOM SERVICES</Text>
        </View>

        <View style={styles.actionsGrid}>
          {/* My Students */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('TeacherStudents')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Users size={22} color="#006FFF" />
            </View>
            <Text style={styles.actionTitle}>Students</Text>
            <Text style={styles.actionDesc}>Roster & Profiles</Text>
          </TouchableOpacity>

          {/* Create Homework */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('CreateHomework')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FFF7ED' }]}>
              <CheckSquare size={22} color="#EA580C" />
            </View>
            <Text style={styles.actionTitle}>Homework</Text>
            <Text style={styles.actionDesc}>Create & Assign</Text>
          </TouchableOpacity>

          {/* Evaluate Submissions */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('TeacherHomework')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F0FDF4' }]}>
              <Award size={22} color="#16A34A" />
            </View>
            <Text style={styles.actionTitle}>Evaluate</Text>
            <Text style={styles.actionDesc}>Grade Submissions</Text>
          </TouchableOpacity>

          {/* Learning Materials */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('TeacherMaterials')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
              <BookOpen size={22} color="#D97706" />
            </View>
            <Text style={styles.actionTitle}>Materials</Text>
            <Text style={styles.actionDesc}>Upload Notes & PDFs</Text>
          </TouchableOpacity>

          {/* Progress Reviews */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('TeacherProgress')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FAF5FF' }]}>
              <TrendingUp size={22} color="#9333EA" />
            </View>
            <Text style={styles.actionTitle}>Progress</Text>
            <Text style={styles.actionDesc}>Student Evaluations</Text>
          </TouchableOpacity>

          {/* Assigned Batches */}
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('TeacherBatches')}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#F1F5F9' }]}>
              <Layers size={22} color="#475569" />
            </View>
            <Text style={styles.actionTitle}>My Batches</Text>
            <Text style={styles.actionDesc}>Curriculum & Allocations</Text>
          </TouchableOpacity>
        </View>
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
  teacherAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FE4D01',
  },
  avatarText: {
    color: '#FEDC32',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitles: {
    flex: 1,
  },
  welcomeSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FE4D01',
    letterSpacing: 0.5,
  },
  teacherName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  designationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  notifBtn: {
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
  notifDot: {
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
  notifDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  voiceHeroCard: {
    backgroundColor: '#0A2540',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  voiceHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FE4D01',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  voiceHeroTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  voiceBadgeRow: {
    marginBottom: 4,
  },
  fastBadge: {
    alignSelf: 'flex-start',
  },
  voiceHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  voiceHeroSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FE4D01',
  },
  emptyScheduleCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyScheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  emptyScheduleDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  classCard: {
    marginBottom: 10,
    padding: 14,
  },
  classCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classTimeCol: {
    width: 75,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingRight: 10,
    marginRight: 12,
    alignItems: 'center',
  },
  classStartTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  classEndTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  classDetailsCol: {
    flex: 1,
  },
  classSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  classBatch: {
    fontSize: 12,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 1,
  },
  classRoom: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  takeAttendanceBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  takeAttendanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
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
});
