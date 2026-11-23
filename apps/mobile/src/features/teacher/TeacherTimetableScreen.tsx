import React, { useState, useMemo, useCallback } from 'react';
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
import { Button } from '../../components/common/Button';
import { getTeacherTimetableApi } from '../../api/teacher.api';
import { TeacherClassSlot } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  Calendar,
  Clock,
  BookOpen,
  MapPin,
  AlertCircle,
  Users,
  CheckCircle2,
} from 'lucide-react-native';

const DAYS = [
  { key: 'MONDAY', label: 'Mon' },
  { key: 'TUESDAY', label: 'Tue' },
  { key: 'WEDNESDAY', label: 'Wed' },
  { key: 'THURSDAY', label: 'Thu' },
  { key: 'FRIDAY', label: 'Fri' },
  { key: 'SATURDAY', label: 'Sat' },
  { key: 'SUNDAY', label: 'Sun' },
];

export const TeacherTimetableScreen: React.FC = () => {
  // Determine current day of week
  const currentDayIndex = new Date().getDay();
  // Sunday is 0, Monday is 1, etc.
  const defaultDayKey = currentDayIndex === 0 ? 'SUNDAY' : DAYS[currentDayIndex - 1]?.key || 'MONDAY';

  const [selectedDay, setSelectedDay] = useState<string>(defaultDayKey);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: () => getTeacherTimetableApi(),
  });

  const timetableMap = data?.timetable || {};
  const daySlots: TeacherClassSlot[] = timetableMap[selectedDay] || [];

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title="Weekly Timetable"
        subtitle="Teaching Schedule & Class Routine"
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
        {/* Day Selector Tabs */}
        <View style={styles.daysRow}>
          {DAYS.map((d) => {
            const isSelected = d.key === selectedDay;
            const hasSlots = (timetableMap[d.key]?.length || 0) > 0;

            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                onPress={() => setSelectedDay(d.key)}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                  {d.label}
                </Text>
                {hasSlots && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Header */}
        <View style={styles.dayHeader}>
          <Calendar size={18} color="#0A2540" />
          <Text style={styles.dayTitle}>
            {DAYS.find((d) => d.key === selectedDay)?.label}day Schedule
          </Text>
          <Badge
            label={`${daySlots.length} Classes`}
            variant={daySlots.length > 0 ? 'info' : 'neutral'}
            size="sm"
          />
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading timetable...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Timetable</Text>
            <Text style={styles.errorSubtitle}>Unable to fetch assigned class schedules.</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : daySlots.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Classes Scheduled</Text>
            <Text style={styles.emptySubtitle}>
              You have no teaching periods assigned for this day. Enjoy your free time!
            </Text>
          </Card>
        ) : (
          daySlots.map((slot, index) => {
            return (
              <Card key={index} style={styles.slotCard}>
                <View style={styles.slotLeft}>
                  <View style={styles.timePill}>
                    <Clock size={13} color="#FE4D01" />
                    <Text style={styles.timeText}>{slot.startTime}</Text>
                  </View>
                  <Text style={styles.timeToText}>to {slot.endTime}</Text>
                </View>

                <View style={styles.slotDivider} />

                <View style={styles.slotRight}>
                  <Text style={styles.subjectText}>{slot.subject}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Users size={13} color="#64748B" />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {slot.batchName}
                      </Text>
                    </View>

                    {slot.room ? (
                      <View style={styles.metaItem}>
                        <MapPin size={13} color="#64748B" />
                        <Text style={styles.metaText}>{slot.room}</Text>
                      </View>
                    ) : null}
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
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  dayButtonSelected: {
    backgroundColor: '#0A2540',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FE4D01',
    marginTop: 4,
  },
  dotSelected: {
    backgroundColor: '#FEDC32',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    flex: 1,
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
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  slotLeft: {
    width: 90,
    alignItems: 'flex-start',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeToText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  slotDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  slotRight: {
    flex: 1,
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
});
