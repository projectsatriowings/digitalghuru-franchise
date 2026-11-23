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
import { getParentTimetableApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  Calendar,
  Clock,
  AlertCircle,
  MapPin,
  User,
  Coffee,
} from 'lucide-react-native';

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Mon' },
  { key: 'TUESDAY', label: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wed' },
  { key: 'THURSDAY', label: 'Thu' },
  { key: 'FRIDAY', label: 'Fri' },
  { key: 'SATURDAY', label: 'Sat' },
];

export const ParentTimetableScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const currentDayIndex = new Date().getDay();
  // Map JS getDay (0 = Sun, 1 = Mon ... 6 = Sat) to DAYS_OF_WEEK
  const defaultDayKey =
    currentDayIndex >= 1 && currentDayIndex <= 6
      ? DAYS_OF_WEEK[currentDayIndex - 1].key
      : 'MONDAY';

  const [selectedDay, setSelectedDay] = useState<string>(defaultDayKey);
  const studentId = selectedChild?.studentId || '';

  const {
    data: timetable,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-child-timetable', studentId],
    queryFn: () => getParentTimetableApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Slots for the active day
  const activeDaySchedule = timetable?.schedule?.[selectedDay] || [];

  return (
    <ScreenContainer>
      <Header
        title="Class Schedule"
        subtitle="Weekly Batch Timetable & Subject Slots"
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

        {/* Day Selector Tabs */}
        <View style={styles.daySelectorContainer}>
          {DAYS_OF_WEEK.map((d) => {
            const isSelected = selectedDay === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected,
                ]}
                onPress={() => setSelectedDay(d.key)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    isSelected && styles.dayButtonTextSelected,
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching timetable...</Text>
          </View>
        ) : isError || !timetable ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Timetable</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve the batch timetable. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : activeDaySchedule.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Coffee size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Classes Scheduled</Text>
            <Text style={styles.emptyText}>
              There are no classroom sessions or periods scheduled on {selectedDay.toLowerCase()}.
            </Text>
          </Card>
        ) : (
          activeDaySchedule.map((slot: any, idx: number) => {
            return (
              <Card key={slot.id || idx} style={styles.slotCard}>
                <View style={styles.slotRow}>
                  {/* Time Column */}
                  <View style={styles.timeColumn}>
                    <Text style={styles.startTime}>{slot.startTime || '—'}</Text>
                    <Text style={styles.endTime}>{slot.endTime || '—'}</Text>
                  </View>

                  {/* Slot Details */}
                  <View style={styles.slotDetails}>
                    <Text style={styles.slotSubject}>
                      {slot.subject?.name || slot.subject || 'Scheduled Period'}
                    </Text>

                    <View style={styles.slotMetaRow}>
                      <View style={styles.metaItem}>
                        <User size={12} color="#64748B" />
                        <Text style={styles.metaText}>
                          {slot.faculty?.user?.fullName ||
                            slot.teacherName ||
                            'Assigned Faculty'}
                        </Text>
                      </View>

                      {slot.room ? (
                        <View style={styles.metaItem}>
                          <MapPin size={12} color="#64748B" />
                          <Text style={styles.metaText}>{slot.room}</Text>
                        </View>
                      ) : null}
                    </View>
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
  daySelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayButton: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayButtonSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dayButtonTextSelected: {
    color: '#FEDC32',
    fontWeight: '700',
  },
  slotCard: {
    marginBottom: 10,
    padding: 14,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeColumn: {
    width: 75,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingRight: 10,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  endTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  slotDetails: {
    flex: 1,
  },
  slotSubject: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
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
