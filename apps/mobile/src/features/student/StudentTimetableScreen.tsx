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
import { brandColors, theme } from '../../theme';
import { getStudentTimetableApi } from '../../api/student.api';
import {
  Calendar,
  Clock,
  User,
  AlertCircle,
  BookOpen,
  Info,
} from 'lucide-react-native';

const DAY_ORDER: Array<'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'> = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

export const StudentTimetableScreen: React.FC = () => {
  const {
    data: timetable,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: getStudentTimetableApi,
  });

  // Determine current day of week (0 = Sunday, 1 = Monday, etc.)
  const todayDayName = useMemo(() => {
    const dayIdx = new Date().getDay();
    const map = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return map[dayIdx] as (typeof DAY_ORDER)[number];
  }, []);

  const [selectedDay, setSelectedDay] = useState<(typeof DAY_ORDER)[number]>(todayDayName);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const activeDaySchedule = useMemo(() => {
    if (!timetable || !timetable.days) return null;
    return timetable.days.find((d) => d.day === selectedDay) || null;
  }, [timetable, selectedDay]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Class Timetable" subtitle="Loading weekly schedule..." />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading timetable...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !timetable) {
    return (
      <ScreenContainer>
        <Header title="Class Timetable" subtitle="Weekly schedule" />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Timetable</Text>
          <Text style={styles.errorSubtitle}>
            Please check your network and tap retry to load class schedules.
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
        title="Class Timetable"
        subtitle={timetable.batchName ? `Batch: ${timetable.batchName}` : 'Weekly Class Schedule'}
      />

      {/* Weekday Switcher Tabs */}
      <View style={styles.dayTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabsScroll}
        >
          {DAY_ORDER.map((day) => {
            const isSelected = selectedDay === day;
            const isToday = day === todayDayName;
            const dayData = timetable.days?.find((d) => d.day === day);
            const slotCount = dayData?.slots?.length || 0;

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayTab,
                  isSelected && styles.dayTabSelected,
                  isToday && !isSelected && styles.dayTabToday,
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayTabLabel,
                    isSelected && styles.dayTabLabelSelected,
                    isToday && !isSelected && styles.dayTabLabelToday,
                  ]}
                >
                  {DAY_SHORT[day]}
                </Text>
                {slotCount > 0 ? (
                  <View
                    style={[
                      styles.slotDot,
                      isSelected && styles.slotDotSelected,
                    ]}
                  />
                ) : (
                  <View style={styles.slotDotEmpty} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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
        {/* Unparsed Warning / Raw Schedule Notice if batch schedule couldn't be fully resolved */}
        {timetable.unparsedWarning && (
          <View style={styles.warningBanner}>
            <Info size={18} color="#D97706" />
            <View style={styles.warningTextWrap}>
              <Text style={styles.warningTitle}>Schedule Notice</Text>
              <Text style={styles.warningText}>
                {timetable.unparsedWarning}
              </Text>
              {timetable.rawSchedule && (
                <Text style={styles.rawScheduleText}>
                  Configured: "{timetable.rawSchedule}"
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Selected Day Header */}
        <View style={styles.dayHeaderRow}>
          <Text style={styles.dayHeading}>
            {activeDaySchedule?.label || selectedDay}
          </Text>
          {selectedDay === todayDayName && (
            <Badge text="Today" variant="student" />
          )}
        </View>

        {/* Day Slots List */}
        {!activeDaySchedule || activeDaySchedule.slots.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={40} color={brandColors.textMuted} />
            <Text style={styles.emptyTitle}>No Classes Scheduled</Text>
            <Text style={styles.emptySubtitle}>
              There are no classes scheduled for {activeDaySchedule?.label || selectedDay}. Use this time for revision and homework.
            </Text>
          </Card>
        ) : (
          activeDaySchedule.slots.map((slot, index) => (
            <Card key={slot.id || index} style={styles.slotCard}>
              <View style={styles.slotHeader}>
                <View style={styles.subjectBadge}>
                  <BookOpen size={14} color={brandColors.blue} />
                  <Text style={styles.subjectName}>{slot.subjectName}</Text>
                </View>
                {slot.isUpcomingToday && (
                  <Badge text="Upcoming" variant="warning" />
                )}
              </View>

              <View style={styles.timeRow}>
                <Clock size={16} color={brandColors.textSecondary} />
                <Text style={styles.timeText}>{slot.timeDisplay}</Text>
              </View>

              {slot.teacherName && (
                <View style={styles.teacherRow}>
                  <User size={16} color={brandColors.textMuted} />
                  <Text style={styles.teacherText}>Instructor: {slot.teacherName}</Text>
                </View>
              )}

              {slot.rawSchedule && !slot.isParsed && (
                <Text style={styles.rawScheduleNotice}>
                  Note: {slot.rawSchedule}
                </Text>
              )}
            </Card>
          ))
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
  dayTabsContainer: {
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
    paddingVertical: theme.spacing.xs,
  },
  dayTabsScroll: {
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: brandColors.surfaceMuted,
    alignItems: 'center',
    minWidth: 54,
  },
  dayTabSelected: {
    backgroundColor: brandColors.blue,
  },
  dayTabToday: {
    borderColor: brandColors.blue,
    borderWidth: 1.5,
  },
  dayTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: brandColors.textSecondary,
  },
  dayTabLabelSelected: {
    color: brandColors.white,
  },
  dayTabLabelToday: {
    color: brandColors.blue,
  },
  slotDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: brandColors.blue,
    marginTop: 4,
  },
  slotDotSelected: {
    backgroundColor: brandColors.white,
  },
  slotDotEmpty: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    gap: 8,
    alignItems: 'flex-start',
  },
  warningTextWrap: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 11,
    color: '#B45309',
  },
  rawScheduleText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#78350F',
    marginTop: 2,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  dayHeading: {
    fontSize: 18,
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
  slotCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: brandColors.blue,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  teacherText: {
    fontSize: 12,
    color: brandColors.textMuted,
  },
  rawScheduleNotice: {
    fontSize: 11,
    fontStyle: 'italic',
    color: brandColors.textMuted,
    marginTop: 6,
  },
});
