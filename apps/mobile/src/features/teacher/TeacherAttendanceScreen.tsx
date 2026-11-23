import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import {
  getTeacherStudentsApi,
  checkInStudentApi,
  checkOutStudentApi,
} from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  Mic,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Sparkles,
  Calendar,
} from 'lucide-react-native';

export const TeacherAttendanceScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch } = useTeacherStore();
  const batchId = selectedBatch?.id || '';

  const {
    data: students = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-students', batchId],
    queryFn: () => getTeacherStudentsApi(batchId),
    enabled: !!batchId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const checkInMutation = useMutation({
    mutationFn: (studentId: string) =>
      checkInStudentApi({ studentId, batchId, method: 'MANUAL' }),
    onSuccess: (data, studentId) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-students', batchId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
    onError: (err: any) => {
      Alert.alert('Attendance Notice', err.message || 'Could not record check-in.');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (studentId: string) => checkOutStudentApi({ studentId, batchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-students', batchId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    },
    onError: (err: any) => {
      Alert.alert('Attendance Notice', err.message || 'Could not record departure.');
    },
  });

  const presentCount = students.filter((s) => s.todayStatus === 'PRESENT').length;
  const departedCount = students.filter((s) => s.todayStatus === 'DEPARTED').length;
  const notMarkedCount = students.filter((s) => s.todayStatus === 'NOT_MARKED').length;
  const attendanceRate =
    students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;

  return (
    <ScreenContainer>
      <Header
        title="Class Attendance"
        subtitle="Daily Roster & Fast Roll Call"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={['#FE4D01']}
            tintColor="#FE4D01"
          />
        }
      >
        <BatchSelectorCard />

        {/* Start Voice Attendance Button */}
        <TouchableOpacity
          style={styles.voiceButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('VoiceAttendance', { batchId })}
        >
          <View style={styles.voiceIconRing}>
            <Mic size={22} color="#FFFFFF" />
          </View>
          <View style={styles.voiceTextCol}>
            <Text style={styles.voiceButtonTitle}>Start Voice Attendance</Text>
            <Text style={styles.voiceButtonSubtitle}>
              Speak names aloud for hands-free, automated check-in
            </Text>
          </View>
        </TouchableOpacity>

        {/* Attendance Metric Snapshot */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Text style={[styles.metricVal, { color: '#EA580C' }]}>{attendanceRate}%</Text>
            <Text style={styles.metricLabel}>Rate</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.metricVal, { color: '#16A34A' }]}>{presentCount}</Text>
            <Text style={styles.metricLabel}>Present</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Text style={[styles.metricVal, { color: '#006FFF' }]}>{departedCount}</Text>
            <Text style={styles.metricLabel}>Departed</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.metricVal, { color: '#64748B' }]}>{notMarkedCount}</Text>
            <Text style={styles.metricLabel}>Unmarked</Text>
          </View>
        </View>

        {/* Student Roll Call List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>STUDENT ATTENDANCE SHEET</Text>
          <Text style={styles.countText}>{students.length} Enrolled</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading class roster...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Attendance</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve student list. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : students.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Students in this Batch</Text>
            <Text style={styles.emptyDesc}>
              There are no enrolled students to take attendance for in this batch.
            </Text>
          </Card>
        ) : (
          students.map((student) => {
            const isPresent = student.todayStatus === 'PRESENT';
            const isDeparted = student.todayStatus === 'DEPARTED';

            return (
              <Card key={student.id} style={styles.studentCard}>
                <View style={styles.studentRow}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {(student.firstName?.[0] || 'S') + (student.lastName?.[0] || '')}
                    </Text>
                  </View>

                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.fullName}</Text>
                    <Text style={styles.studentAdm}>
                      Adm #{student.admissionNumber}
                    </Text>
                    {student.checkInTimeFormatted ? (
                      <Text style={styles.timeLabel}>
                        Check-in: {student.checkInTimeFormatted}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.actionsCol}>
                    <Badge
                      text={
                        isPresent
                          ? 'Present'
                          : isDeparted
                          ? 'Departed'
                          : 'Not Marked'
                      }
                      variant={isPresent ? 'success' : isDeparted ? 'info' : 'neutral'}
                      style={styles.badge}
                    />

                    {!isPresent && !isDeparted && (
                      <TouchableOpacity
                        style={styles.quickCheckInBtn}
                        onPress={() => checkInMutation.mutate(student.id)}
                        disabled={checkInMutation.isPending}
                      >
                        <Text style={styles.quickCheckInText}>Check-in</Text>
                      </TouchableOpacity>
                    )}

                    {isPresent && (
                      <TouchableOpacity
                        style={styles.quickCheckOutBtn}
                        onPress={() => checkOutMutation.mutate(student.id)}
                        disabled={checkOutMutation.isPending}
                      >
                        <Text style={styles.quickCheckOutText}>Departure</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
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
    paddingBottom: 40,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A2540',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  voiceIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FE4D01',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  voiceTextCol: {
    flex: 1,
  },
  voiceButtonTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  voiceButtonSubtitle: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  countText: {
    fontSize: 11,
    color: '#94A3B8',
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
  emptyDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  studentCard: {
    marginBottom: 8,
    padding: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FEDC32',
    fontSize: 14,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentAdm: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  timeLabel: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    marginBottom: 2,
  },
  quickCheckInBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  quickCheckInText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickCheckOutBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickCheckOutText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
});
