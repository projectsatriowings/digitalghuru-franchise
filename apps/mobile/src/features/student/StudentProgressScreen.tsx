import React, { useMemo, useCallback } from 'react';
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
import { getStudentDashboardApi } from '../../api/student.api';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Percent,
} from 'lucide-react-native';

export const StudentProgressScreen: React.FC = () => {
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

  const marks = useMemo(() => {
    return dashboard?.academicProgress?.recentMarks || [];
  }, [dashboard]);

  // Calculate cumulative average
  const performanceStats = useMemo(() => {
    if (marks.length === 0) return { average: 0, passedCount: 0, totalExams: 0 };
    let totalScore = 0;
    let totalMax = 0;
    let passed = 0;

    marks.forEach((m) => {
      if (!m.isAbsent) {
        totalScore += Number(m.marksObtained);
        totalMax += Number(m.totalMarks);
        if (Number(m.marksObtained) >= Number(m.passingMarks)) {
          passed++;
        }
      }
    });

    const average = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
    return {
      average,
      passedCount: passed,
      totalExams: marks.length,
    };
  }, [marks]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Academic Progress" subtitle="Loading exam marks..." showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading academic results...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !dashboard) {
    return (
      <ScreenContainer>
        <Header title="Academic Progress" subtitle="Exam marks & reports" showBack />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Results</Text>
          <Text style={styles.errorSubtitle}>
            Failed to retrieve exam reports. Tap retry to reload.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title="Academic Progress"
        subtitle="Exam assessments & marks"
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
        {/* Performance Overview Banner */}
        <Card style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.circleMetric}>
              <Text style={styles.circleMetricValue}>{performanceStats.average}%</Text>
              <Text style={styles.circleMetricLabel}>Average</Text>
            </View>
            <View style={styles.overviewStatsCol}>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>Recorded Assessments</Text>
                <Text style={styles.statValue}>{performanceStats.totalExams}</Text>
              </View>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>Passed Assessments</Text>
                <Text style={[styles.statValue, { color: brandColors.success }]}>
                  {performanceStats.passedCount}
                </Text>
              </View>
              <View style={styles.statLine}>
                <Text style={styles.statTitle}>Enrolled Batch</Text>
                <Text style={styles.statValue} numberOfLines={1}>
                  {dashboard.batch?.name || 'Class'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Exam Marks Section */}
        <View style={styles.sectionHeader}>
          <Award size={18} color={brandColors.blue} />
          <Text style={styles.sectionTitle}>Published Assessments</Text>
        </View>

        {marks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Award size={40} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Exam Marks Published</Text>
            <Text style={styles.emptySubtitle}>
              When tests and terminal examinations are evaluated and published by your instructors, your marks will appear here.
            </Text>
          </Card>
        ) : (
          marks.map((mark) => {
            const isPassed = !mark.isAbsent && Number(mark.marksObtained) >= Number(mark.passingMarks);
            const scorePercent = Number(mark.totalMarks) > 0
              ? Math.round((Number(mark.marksObtained) / Number(mark.totalMarks)) * 100)
              : 0;

            return (
              <Card key={mark.id} style={styles.markCard}>
                <View style={styles.markTopRow}>
                  <View style={styles.markInfoCol}>
                    <Badge text={mark.subjectName || 'Subject'} variant="student" />
                    <Text style={styles.examTitleText}>{mark.examTitle}</Text>
                    <View style={styles.examDateRow}>
                      <Calendar size={12} color={brandColors.textMuted} />
                      <Text style={styles.examDateText}>
                        {new Date(mark.examDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.markScoreCol}>
                    {mark.isAbsent ? (
                      <Badge text="Absent" variant="error" />
                    ) : (
                      <>
                        <Text style={styles.scoreNumber}>
                          {mark.marksObtained} <Text style={styles.scoreMax}>/ {mark.totalMarks}</Text>
                        </Text>
                        <Badge
                          text={isPassed ? `${scorePercent}% • Passed` : `${scorePercent}% • Needs Work`}
                          variant={isPassed ? 'success' : 'error'}
                        />
                      </>
                    )}
                  </View>
                </View>

                {/* Passing Marks & Remarks */}
                <View style={styles.markFooter}>
                  <Text style={styles.passingMarksText}>
                    Passing score required: {mark.passingMarks}
                  </Text>
                  {mark.remarks ? (
                    <Text style={styles.remarksText}>
                      Teacher Remarks: {mark.remarks}
                    </Text>
                  ) : null}
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
    paddingBottom: theme.spacing.xxl,
  },
  overviewCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  circleMetric: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: brandColors.white,
    borderWidth: 4,
    borderColor: brandColors.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleMetricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: brandColors.blue,
  },
  circleMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: brandColors.textMuted,
  },
  overviewStatsCol: {
    flex: 1,
    gap: 6,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: brandColors.textSecondary,
  },
  statValue: {
    fontSize: 13,
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
  markCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  markTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  markInfoCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  examTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginTop: 4,
    marginBottom: 2,
  },
  examDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  examDateText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  markScoreCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: brandColors.textPrimary,
  },
  scoreMax: {
    fontSize: 13,
    fontWeight: '500',
    color: brandColors.textMuted,
  },
  markFooter: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: brandColors.borderLight,
    gap: 2,
  },
  passingMarksText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  remarksText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: brandColors.textSecondary,
    marginTop: 2,
  },
});
