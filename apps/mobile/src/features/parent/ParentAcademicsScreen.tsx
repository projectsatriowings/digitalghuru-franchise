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
import { ChildSelectorCard } from '../../components/parent/ChildSelectorCard';
import { useParentStore } from '../../store/parentStore';
import { getParentAcademicsApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  Award,
  BookOpen,
  Calendar,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Star,
  MessageSquare,
} from 'lucide-react-native';

export const ParentAcademicsScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const studentId = selectedChild?.studentId || '';

  const {
    data: academicsData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-child-academics', studentId],
    queryFn: () => getParentAcademicsApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const summary = academicsData?.summary;
  const publishedMarks = academicsData?.marks || [];
  const teacherEvaluations = academicsData?.teacherEvaluations || [];

  return (
    <ScreenContainer>
      <Header
        title="Academics & Reports"
        subtitle="Child Exam Results & Teacher Evaluations"
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
        <ChildSelectorCard />

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching academic records...</Text>
          </View>
        ) : isError || !academicsData ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Academic Records</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve exam scores and evaluations. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {/* Academic Performance Snapshot Banner */}
            <Card style={styles.snapshotCard}>
              <View style={styles.snapshotHeader}>
                <View style={styles.iconCircle}>
                  <Award size={22} color="#FEDC32" />
                </View>
                <View style={styles.snapshotHeaderCol}>
                  <Text style={styles.snapshotTitle}>Overall Exam Average</Text>
                  <Text style={styles.snapshotSubTitle}>
                    Across all published assessments
                  </Text>
                </View>
                <View style={styles.percentageBadge}>
                  <Text style={styles.percentageValue}>
                    {summary?.averagePercentage ?? 0}%
                  </Text>
                </View>
              </View>

              <View style={styles.snapshotStatsRow}>
                <View style={styles.snapshotStatItem}>
                  <Text style={styles.statLabel}>Exams Taken</Text>
                  <Text style={styles.statNumber}>{summary?.examsTaken ?? 0}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.snapshotStatItem}>
                  <Text style={styles.statLabel}>Subjects</Text>
                  <Text style={styles.statNumber}>
                    {academicsData.subjects?.length ?? 0}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.snapshotStatItem}>
                  <Text style={styles.statLabel}>Top Score</Text>
                  <Text style={styles.statNumber}>
                    {publishedMarks.length > 0
                      ? Math.max(...publishedMarks.map((m) => m.marksObtained))
                      : '—'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Published Exam Report Cards */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>PUBLISHED EXAM REPORT CARDS</Text>
              <Text style={styles.sectionCount}>
                {publishedMarks.length} Exam Records
              </Text>
            </View>

            {publishedMarks.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No published exam report cards available yet for this student.
                </Text>
              </Card>
            ) : (
              publishedMarks.map((mark) => {
                const percentage =
                  mark.totalMarks > 0
                    ? Math.round((mark.marksObtained / mark.totalMarks) * 100)
                    : 0;
                const isPassed = !mark.isAbsent && percentage >= 40;

                return (
                  <Card key={mark.id} style={styles.markCard}>
                    <View style={styles.markHeaderRow}>
                      <View style={styles.markTitleCol}>
                        <Text style={styles.examTitle}>{mark.examTitle}</Text>
                        <Text style={styles.examSubject}>
                          Subject: {mark.subject}
                        </Text>
                        {mark.examDate && (
                          <Text style={styles.examDate}>
                            Date: {new Date(mark.examDate).toLocaleDateString()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.markScoreCol}>
                        {mark.isAbsent ? (
                          <Badge text="Absent" variant="error" />
                        ) : (
                          <>
                            <Text style={styles.scoreText}>
                              {mark.marksObtained}
                              <Text style={styles.scoreTotalText}>
                                /{mark.totalMarks}
                              </Text>
                            </Text>
                            <Badge
                              text={`${percentage}% • ${isPassed ? 'Passed' : 'Needs Focus'}`}
                              variant={isPassed ? 'success' : 'warning'}
                              style={styles.gradeBadge}
                            />
                          </>
                        )}
                      </View>
                    </View>

                    {mark.remarks ? (
                      <View style={styles.remarksBox}>
                        <MessageSquare size={12} color="#64748B" />
                        <Text style={styles.remarksText}>{mark.remarks}</Text>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}

            {/* Teacher Progress Feedback & Remarks */}
            {teacherEvaluations.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                  <Text style={styles.sectionTitle}>TEACHER EVALUATION & FEEDBACK</Text>
                </View>

                {teacherEvaluations.map((evalItem: any) => (
                  <Card key={evalItem.id} style={styles.evaluationCard}>
                    <View style={styles.evalHeaderRow}>
                      <View style={styles.evalTitleCol}>
                        <Text style={styles.evalCategory}>
                          {evalItem.category || 'Academic Progress'}
                        </Text>
                        <Text style={styles.evalDate}>
                          Evaluated on{' '}
                          {new Date(evalItem.createdAt).toLocaleDateString()}
                        </Text>
                      </View>

                      {evalItem.rating ? (
                        <View style={styles.ratingBadge}>
                          <Star size={12} color="#D97706" fill="#D97706" />
                          <Text style={styles.ratingText}>{evalItem.rating}/5</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.evalRemarks}>{evalItem.remarks}</Text>
                  </Card>
                ))}
              </>
            )}
          </>
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
  snapshotCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(254, 220, 50, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  snapshotHeaderCol: {
    flex: 1,
  },
  snapshotTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  snapshotSubTitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  percentageBadge: {
    backgroundColor: '#FEDC32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  percentageValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  snapshotStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  snapshotStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sectionHeader: {
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
  sectionCount: {
    fontSize: 11,
    color: '#94A3B8',
  },
  markCard: {
    marginBottom: 12,
    padding: 14,
  },
  markHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  markTitleCol: {
    flex: 1,
    paddingRight: 12,
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  examSubject: {
    fontSize: 13,
    color: '#006FFF',
    fontWeight: '600',
    marginTop: 2,
  },
  examDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  markScoreCol: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreTotalText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  gradeBadge: {
    marginTop: 4,
  },
  remarksBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  remarksText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    fontStyle: 'italic',
  },
  evaluationCard: {
    marginBottom: 10,
    padding: 14,
  },
  evalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  evalTitleCol: {
    flex: 1,
  },
  evalCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  evalDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  evalRemarks: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
