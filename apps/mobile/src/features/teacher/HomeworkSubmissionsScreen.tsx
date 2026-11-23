import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { getHomeworkSubmissionsApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  User,
  Paperclip,
  ChevronRight,
  Award,
} from 'lucide-react-native';

export const HomeworkSubmissionsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { homeworkId, title, maxMarks, dueDate } = route.params || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'GRADED' | 'PENDING'>('ALL');

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-submissions', homeworkId],
    queryFn: () => getHomeworkSubmissionsApi(homeworkId),
    enabled: !!homeworkId,
  });

  const roster = data?.roster || [];
  const summary = data?.summary || {};

  const filteredRoster = useMemo(() => {
    let list = roster;
    if (statusFilter === 'SUBMITTED') {
      list = list.filter((item: any) => item.isSubmitted && !item.isGraded);
    } else if (statusFilter === 'GRADED') {
      list = list.filter((item: any) => item.isGraded);
    } else if (statusFilter === 'PENDING') {
      list = list.filter((item: any) => !item.isSubmitted);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item: any) =>
          item.student?.firstName?.toLowerCase().includes(q) ||
          item.student?.lastName?.toLowerCase().includes(q) ||
          item.student?.admissionNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [roster, statusFilter, searchQuery]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title={title || 'Assignment Submissions'}
        subtitle={maxMarks ? `Max Marks: ${maxMarks}` : 'Student Evaluation'}
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
        {/* Aggregate Summary */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text style={styles.metricValue}>{summary.totalEligible ?? roster.length}</Text>
            <Text style={styles.metricLabel}>Total Students</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: '#0284C7' }]}>
              {summary.submittedCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Submitted</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: '#16A34A' }]}>
              {summary.gradedCount ?? 0}
            </Text>
            <Text style={styles.metricLabel}>Graded</Text>
          </Card>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student by name or code..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'ALL' && styles.filterPillActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.filterText, statusFilter === 'ALL' && styles.filterTextActive]}>
              All ({roster.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'SUBMITTED' && styles.filterPillActive]}
            onPress={() => setStatusFilter('SUBMITTED')}
          >
            <Text style={[styles.filterText, statusFilter === 'SUBMITTED' && styles.filterTextActive]}>
              Awaiting Grade
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'GRADED' && styles.filterPillActive]}
            onPress={() => setStatusFilter('GRADED')}
          >
            <Text style={[styles.filterText, statusFilter === 'GRADED' && styles.filterTextActive]}>
              Graded
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'PENDING' && styles.filterPillActive]}
            onPress={() => setStatusFilter('PENDING')}
          >
            <Text style={[styles.filterText, statusFilter === 'PENDING' && styles.filterTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading roster & submissions...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Submissions</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : filteredRoster.length === 0 ? (
          <Card style={styles.emptyCard}>
            <User size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Students in View</Text>
            <Text style={styles.emptySubtitle}>No records matching the selected filter criteria.</Text>
          </Card>
        ) : (
          filteredRoster.map((item: any) => {
            const student = item.student;
            const sub = item.submission;
            const isGraded = item.isGraded || !!sub?.grade;
            const isSubmitted = item.isSubmitted || !!sub;
            const studentName = `${student.firstName} ${student.lastName}`;

            return (
              <Card key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>{student.firstName[0]}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{studentName}</Text>
                    <Text style={styles.studentCode}>Adm: {student.admissionNumber}</Text>
                  </View>
                  <Badge
                    label={
                      isGraded
                        ? `Grade: ${sub?.grade}`
                        : isSubmitted
                        ? 'Submitted'
                        : item.isOverdue
                        ? 'Overdue'
                        : 'Not Submitted'
                    }
                    variant={
                      isGraded
                        ? 'success'
                        : isSubmitted
                        ? 'info'
                        : item.isOverdue
                        ? 'error'
                        : 'neutral'
                    }
                    size="sm"
                  />
                </View>

                {/* Submission note or file preview */}
                {sub && (
                  <View style={styles.subDetailBox}>
                    {sub.studentNotes ? (
                      <Text style={styles.subNotes} numberOfLines={2}>
                        "{sub.studentNotes}"
                      </Text>
                    ) : null}
                    {sub.fileUrl ? (
                      <TouchableOpacity
                        style={styles.fileLink}
                        onPress={() => Linking.openURL(sub.fileUrl)}
                      >
                        <Paperclip size={14} color="#0284C7" />
                        <Text style={styles.fileLinkText} numberOfLines={1}>
                          {sub.fileName || 'Attached Submission File'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {sub.feedback ? (
                      <Text style={styles.feedbackText}>Teacher Feedback: {sub.feedback}</Text>
                    ) : null}
                  </View>
                )}

                {/* Grade Action button */}
                {sub ? (
                  <TouchableOpacity
                    style={styles.gradeBtn}
                    onPress={() =>
                      navigation.navigate('EvaluateHomework', {
                        submissionId: sub.id,
                        studentName,
                        admissionNumber: student.admissionNumber,
                        maxMarks,
                        studentNotes: sub.studentNotes,
                        fileUrl: sub.fileUrl,
                        fileName: sub.fileName,
                        currentGrade: sub.grade,
                        currentFeedback: sub.feedback,
                        homeworkId,
                      })
                    }
                  >
                    <Award size={16} color="#0A2540" />
                    <Text style={styles.gradeBtnText}>
                      {isGraded ? 'Update Grade & Feedback' : 'Evaluate & Grade'}
                    </Text>
                    <ChevronRight size={16} color="#0A2540" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pendingStatusRow}>
                    <Clock size={14} color="#94A3B8" />
                    <Text style={styles.pendingStatusText}>Awaiting student submission</Text>
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0A2540',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTextActive: {
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
  studentCard: {
    marginBottom: 10,
    padding: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentCode: {
    fontSize: 12,
    color: '#64748B',
  },
  subDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    gap: 4,
  },
  subNotes: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },
  fileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fileLinkText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
  },
  feedbackText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  gradeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
  },
  pendingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pendingStatusText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
