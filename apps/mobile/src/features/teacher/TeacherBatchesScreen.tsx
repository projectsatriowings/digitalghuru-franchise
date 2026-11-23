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
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useTeacherStore } from '../../store/teacherStore';
import { getTeacherBatchesApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  Layers,
  Users,
  BookOpen,
  Calendar,
  AlertCircle,
  ChevronRight,
  Clock,
} from 'lucide-react-native';

export const TeacherBatchesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { setSelectedBatch } = useTeacherStore();

  const {
    data: batches = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-batches-list'],
    queryFn: getTeacherBatchesApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title="Assigned Batches"
        subtitle="Class Curriculum & Subject Allocations"
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
        <View style={styles.headerInfoRow}>
          <Text style={styles.sectionTitle}>YOUR AUTHORIZED ROSTERS</Text>
          <Text style={styles.countBadge}>{batches.length} Classes</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Fetching assigned batches...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Batches</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve assigned classes. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : batches.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Layers size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Batches Assigned</Text>
            <Text style={styles.emptyDesc}>
              You are currently not assigned to any batches. Please contact your academic administrator.
            </Text>
          </Card>
        ) : (
          batches.map((batch) => {
            const subjects = batch.batchSubjects || [];

            return (
              <Card key={batch.id} style={styles.batchCard}>
                <View style={styles.batchHeader}>
                  <View style={styles.iconContainer}>
                    <Layers size={22} color="#FE4D01" />
                  </View>

                  <View style={styles.batchInfoCol}>
                    <Text style={styles.batchName}>{batch.name}</Text>
                    <Text style={styles.batchCode}>
                      Code: {batch.code} {batch.academicYear ? `• Year: ${batch.academicYear}` : ''}
                    </Text>
                  </View>

                  <Badge text="Active" variant="success" />
                </View>

                {batch.schedule && (
                  <View style={styles.scheduleRow}>
                    <Clock size={13} color="#64748B" />
                    <Text style={styles.scheduleText} numberOfLines={1}>
                      {batch.schedule}
                    </Text>
                  </View>
                )}

                {/* Subjects Assigned in this Batch */}
                {subjects.length > 0 && (
                  <View style={styles.subjectsContainer}>
                    <Text style={styles.subjectsLabel}>Assigned Subjects:</Text>
                    <View style={styles.subjectPillsRow}>
                      {subjects.map((bs) => (
                        <View key={bs.id} style={styles.subjectPill}>
                          <Text style={styles.subjectPillText}>{bs.subject.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnOutline}
                    onPress={() => {
                      setSelectedBatch(batch);
                      navigation.navigate('TeacherStudents', { batchId: batch.id });
                    }}
                  >
                    <Users size={14} color="#0F172A" />
                    <Text style={styles.actionBtnOutlineText}>View Students</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSolid}
                    onPress={() => {
                      setSelectedBatch(batch);
                      navigation.navigate('TeacherAttendance', { batchId: batch.id });
                    }}
                  >
                    <Text style={styles.actionBtnSolidText}>Take Attendance</Text>
                  </TouchableOpacity>
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
    lineHeight: 18,
  },
  batchCard: {
    marginBottom: 12,
    padding: 16,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  batchInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  batchName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  batchCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  scheduleText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  subjectsContainer: {
    marginBottom: 12,
  },
  subjectsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  subjectPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#006FFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionBtnSolid: {
    flex: 1,
    backgroundColor: '#FE4D01',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  actionBtnSolidText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
