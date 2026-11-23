import React, { useState, useCallback } from 'react';
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
import { getParentHomeworkApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  CheckSquare,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Award,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react-native';

type FilterTab = 'ALL' | 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'OVERDUE';

export const ParentHomeworkScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const studentId = selectedChild?.studentId || '';

  const {
    data: homeworkList = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-child-homework', studentId],
    queryFn: () => getParentHomeworkApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const filteredList = homeworkList.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.submissionStatus === activeTab;
  });

  const pendingCount = homeworkList.filter(
    (h) => h.submissionStatus === 'PENDING' || h.submissionStatus === 'OVERDUE'
  ).length;

  return (
    <ScreenContainer>
      <Header
        title="Homework & Tasks"
        subtitle="Assignment Tracking & Submission Status"
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

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {(['ALL', 'PENDING', 'SUBMITTED', 'EVALUATED', 'OVERDUE'] as FilterTab[]).map(
              (tab) => {
                const isActive = activeTab === tab;
                const count =
                  tab === 'ALL'
                    ? homeworkList.length
                    : homeworkList.filter((h) => h.submissionStatus === tab).length;

                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text
                      style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}
                    >
                      {tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching homework items...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Homework</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve assignments. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : filteredList.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckSquare size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Assignments Found</Text>
            <Text style={styles.emptyText}>
              There are no {activeTab === 'ALL' ? '' : activeTab.toLowerCase()} assignments for this student.
            </Text>
          </Card>
        ) : (
          filteredList.map((item) => {
            const isEvaluated = item.submissionStatus === 'EVALUATED';
            const isSubmitted = item.submissionStatus === 'SUBMITTED';
            const isOverdue = item.submissionStatus === 'OVERDUE';
            const isPending = item.submissionStatus === 'PENDING';

            const badgeVariant = isEvaluated
              ? 'success'
              : isSubmitted
              ? 'info'
              : isOverdue
              ? 'error'
              : 'warning';

            return (
              <Card key={item.id} style={styles.hwCard}>
                <View style={styles.hwHeaderRow}>
                  <View style={styles.hwTitleCol}>
                    <Text style={styles.hwTitle}>{item.title}</Text>
                    <Text style={styles.hwSubject}>
                      {item.subject?.name || 'General Subject'}
                    </Text>
                  </View>
                  <Badge
                    text={
                      isEvaluated
                        ? 'Evaluated'
                        : isSubmitted
                        ? 'Submitted'
                        : isOverdue
                        ? 'Overdue'
                        : 'Pending'
                    }
                    variant={badgeVariant}
                  />
                </View>

                {item.description ? (
                  <Text style={styles.hwDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.hwDatesRow}>
                  <View style={styles.dateItem}>
                    <Calendar size={12} color="#64748B" />
                    <Text style={styles.dateLabel}>Due: </Text>
                    <Text
                      style={[
                        styles.dateValue,
                        isOverdue && { color: '#EF4444', fontWeight: '700' },
                      ]}
                    >
                      {new Date(item.dueDate).toLocaleDateString()}
                    </Text>
                  </View>

                  {item.maxMarks ? (
                    <View style={styles.dateItem}>
                      <Award size={12} color="#64748B" />
                      <Text style={styles.dateLabel}>Max Marks: </Text>
                      <Text style={styles.dateValue}>{item.maxMarks}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Submission Details Box (if submitted or evaluated) */}
                {item.submission && (
                  <View style={styles.submissionBox}>
                    <View style={styles.submissionHeader}>
                      <Text style={styles.submissionTitle}>Child Submission Details</Text>
                      {item.submission.score !== null && item.submission.score !== undefined && (
                        <View style={styles.scorePill}>
                          <Text style={styles.scorePillText}>
                            Score: {item.submission.score}/{item.maxMarks || 100}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.submittedAtText}>
                      Submitted on: {new Date(item.submission.submittedAt).toLocaleDateString()}
                    </Text>

                    {item.submission.feedback ? (
                      <View style={styles.feedbackRow}>
                        <MessageSquare size={12} color="#006FFF" />
                        <Text style={styles.feedbackText}>
                          Teacher Feedback: {item.submission.feedback}
                        </Text>
                      </View>
                    ) : null}
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
  tabsContainer: {
    marginBottom: 14,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FEDC32',
    fontWeight: '700',
  },
  hwCard: {
    marginBottom: 12,
    padding: 14,
  },
  hwHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hwTitleCol: {
    flex: 1,
    paddingRight: 10,
  },
  hwTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  hwSubject: {
    fontSize: 12,
    color: '#006FFF',
    fontWeight: '600',
    marginTop: 2,
  },
  hwDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  hwDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  submissionBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submissionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  scorePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  submittedAtText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  feedbackText: {
    fontSize: 12,
    color: '#0F172A',
    flex: 1,
    fontStyle: 'italic',
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
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
});
