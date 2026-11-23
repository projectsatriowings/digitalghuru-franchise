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
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import { getTeacherHomeworkApi } from '../../api/teacher.api';
import { TeacherHomeworkItem } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  FileText,
  Calendar,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  BookOpen,
} from 'lucide-react-native';

export const TeacherHomeworkScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedBatch } = useTeacherStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'PAST_DUE'>('ALL');

  const {
    data: homeworkList = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-homework', selectedBatch?.id],
    queryFn: () => getTeacherHomeworkApi(selectedBatch?.id),
    enabled: true,
  });

  const filteredHomework = useMemo(() => {
    let list = homeworkList;
    const now = new Date();

    if (activeTab === 'ACTIVE') {
      list = list.filter((item) => new Date(item.dueDate) >= now);
    } else if (activeTab === 'PAST_DUE') {
      list = list.filter((item) => new Date(item.dueDate) < now);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subject?.name?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [homeworkList, activeTab, searchQuery]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title="Homework & Tasks"
        subtitle={selectedBatch ? selectedBatch.name : 'All Assigned Classes'}
        rightElement={
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateHomework')}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Assign</Text>
          </TouchableOpacity>
        }
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
        <BatchSelectorCard />

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assignments or subjects..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tab Filters */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ALL' && styles.tabActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
              All ({homeworkList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ACTIVE' && styles.tabActive]}
            onPress={() => setActiveTab('ACTIVE')}
          >
            <Text style={[styles.tabText, activeTab === 'ACTIVE' && styles.tabTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'PAST_DUE' && styles.tabActive]}
            onPress={() => setActiveTab('PAST_DUE')}
          >
            <Text style={[styles.tabText, activeTab === 'PAST_DUE' && styles.tabTextActive]}>
              Past Due
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading assignments...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Homework</Text>
            <Text style={styles.errorSubtitle}>Could not retrieve assignments for this class.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : filteredHomework.length === 0 ? (
          <Card style={styles.emptyCard}>
            <BookOpen size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Assignments Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No matching assignments found for this filter.'
                : 'No homework assignments created for this class yet.'}
            </Text>
            <Button
              title="Create First Assignment"
              onPress={() => navigation.navigate('CreateHomework')}
              style={styles.emptyBtn}
            />
          </Card>
        ) : (
          filteredHomework.map((item) => {
            const isPastDue = new Date(item.dueDate) < new Date();
            const dueDateFormatted = new Date(item.dueDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <Card key={item.id} style={styles.hwCard}>
                <View style={styles.hwHeader}>
                  <View style={styles.batchTagRow}>
                    <Badge
                      label={item.subject?.name || 'General Subject'}
                      variant="info"
                      size="sm"
                    />
                    {item.maxMarks != null && (
                      <Badge
                        label={`${item.maxMarks} Marks`}
                        variant="warning"
                        size="sm"
                        style={styles.marksBadge}
                      />
                    )}
                  </View>
                  <Badge
                    label={isPastDue ? 'Past Due' : 'Active'}
                    variant={isPastDue ? 'error' : 'success'}
                    size="sm"
                  />
                </View>

                <Text style={styles.hwTitle}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.hwDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={14} color="#64748B" />
                    <Text style={styles.metaText}>Due: {dueDateFormatted}</Text>
                  </View>
                  {item.batch?.name ? (
                    <View style={styles.metaItem}>
                      <Users size={14} color="#64748B" />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.batch.name}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Submissions Action Bar */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    navigation.navigate('HomeworkSubmissions', {
                      homeworkId: item.id,
                      title: item.title,
                      maxMarks: item.maxMarks,
                      dueDate: item.dueDate,
                    })
                  }
                >
                  <View style={styles.actionBtnLeft}>
                    <CheckCircle2 size={16} color="#0A2540" />
                    <Text style={styles.actionBtnText}>Review Submissions</Text>
                  </View>
                  <ChevronRight size={18} color="#0A2540" />
                </TouchableOpacity>
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
    paddingBottom: 80,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE4D01',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#0A2540',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
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
  errorSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
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
    marginBottom: 12,
  },
  emptyBtn: {
    marginTop: 4,
  },
  hwCard: {
    marginBottom: 12,
    padding: 14,
  },
  hwHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  batchTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  marksBadge: {
    backgroundColor: '#FFFBEB',
  },
  hwTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  hwDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
  },
});
