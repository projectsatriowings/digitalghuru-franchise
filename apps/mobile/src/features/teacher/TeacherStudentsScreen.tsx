import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import { getTeacherStudentsApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertCircle,
  Phone,
  GraduationCap,
} from 'lucide-react-native';

export const TeacherStudentsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedBatch } = useTeacherStore();
  const [search, setSearch] = useState('');

  const {
    data: students = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-students', selectedBatch?.id, search],
    queryFn: () => getTeacherStudentsApi(selectedBatch?.id, search),
    enabled: !!selectedBatch?.id,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title="Student Directory"
        subtitle="Authorized Class Rosters & Daily Status"
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

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by student name or admission #..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.headerInfoRow}>
          <Text style={styles.sectionTitle}>ENROLLED STUDENTS</Text>
          <Text style={styles.countBadge}>{students.length} Total</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Fetching enrolled students...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Students</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve students for this batch. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : students.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Students Found</Text>
            <Text style={styles.emptyDesc}>
              {search.trim()
                ? `No students matching "${search}" in this batch.`
                : 'No active student enrollments found in this batch.'}
            </Text>
          </Card>
        ) : (
          students.map((student) => {
            const isPresent = student.todayStatus === 'PRESENT';
            const isDeparted = student.todayStatus === 'DEPARTED';

            return (
              <TouchableOpacity
                key={student.id}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate('TeacherStudentDetails', {
                    studentId: student.id,
                    batchId: selectedBatch?.id,
                  })
                }
              >
                <Card style={styles.studentCard}>
                  <View style={styles.studentCardRow}>
                    <View style={styles.avatarBox}>
                      <Text style={styles.avatarText}>
                        {(student.firstName?.[0] || 'S') + (student.lastName?.[0] || '')}
                      </Text>
                    </View>

                    <View style={styles.studentInfoCol}>
                      <Text style={styles.studentName}>{student.fullName}</Text>
                      <Text style={styles.studentAdm}>
                        Adm #{student.admissionNumber} • {student.batchName}
                      </Text>
                      {student.checkInTimeFormatted ? (
                        <View style={styles.timeRow}>
                          <Clock size={11} color="#16A34A" />
                          <Text style={styles.timeText}>
                            In: {student.checkInTimeFormatted}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.statusCol}>
                      <Badge
                        text={
                          isPresent
                            ? 'Present'
                            : isDeparted
                            ? 'Departed'
                            : 'Not Marked'
                        }
                        variant={isPresent ? 'success' : isDeparted ? 'info' : 'neutral'}
                      />
                      <ChevronRight size={16} color="#94A3B8" style={{ marginTop: 6 }} />
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  headerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  countBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FE4D01',
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
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  studentCard: {
    marginBottom: 10,
    padding: 14,
  },
  studentCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  studentInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentAdm: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  statusCol: {
    alignItems: 'flex-end',
  },
});
