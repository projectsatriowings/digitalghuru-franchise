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
import { getParentAttendanceApi } from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  CalendarCheck,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react-native';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ParentAttendanceScreen: React.FC = () => {
  const { selectedChild } = useParentStore();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const studentId = selectedChild?.studentId || '';

  const {
    data: attendanceData,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-child-attendance', studentId, selectedMonth, selectedYear],
    queryFn: () => getParentAttendanceApi(studentId, selectedMonth, selectedYear),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const metrics = attendanceData?.metrics;
  const calendarDays = attendanceData?.calendar || [];

  return (
    <ScreenContainer>
      <Header
        title="Attendance & Arrival"
        subtitle="Daily Campus Logs & Check-In Timeline"
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

        {/* Month Selector Carousel */}
        <Card style={styles.monthSelectorCard}>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={handlePrevMonth}
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.monthLabelCol}>
            <Text style={styles.monthText}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Text>
            <Text style={styles.monthSubText}>Monthly Attendance Report</Text>
          </View>

          <TouchableOpacity
            style={styles.monthArrow}
            onPress={handleNextMonth}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={20} color="#0F172A" />
          </TouchableOpacity>
        </Card>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching attendance records...</Text>
          </View>
        ) : isError || !attendanceData ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Attendance</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve records for this month. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <>
            {/* Monthly Key Metrics Cards */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Text style={styles.metricVal}>{metrics?.attendancePercentage ?? 0}%</Text>
                <Text style={styles.metricLabel}>Rate</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                <Text style={[styles.metricVal, { color: '#16A34A' }]}>
                  {metrics?.presentDays ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Present</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Text style={[styles.metricVal, { color: '#DC2626' }]}>
                  {metrics?.absentDays ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Absent</Text>
              </View>

              <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[styles.metricVal, { color: '#D97706' }]}>
                  {metrics?.lateDays ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Late</Text>
              </View>
            </View>

            {/* Daily Detailed Attendance Log */}
            <View style={styles.logSectionHeader}>
              <Text style={styles.logSectionTitle}>DAILY CAMPUS CHECK-IN LOG</Text>
              <Text style={styles.logCountText}>
                {calendarDays.length} Working Days
              </Text>
            </View>

            {calendarDays.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No session logs recorded for this period yet.
                </Text>
              </Card>
            ) : (
              calendarDays.map((day) => {
                const isPresent = day.status === 'PRESENT';
                const isLate = day.isLate || day.status === 'LATE';
                const isAbsent = day.status === 'ABSENT';

                return (
                  <Card key={day.date} style={styles.dayLogCard}>
                    <View style={styles.dayLogRow}>
                      {/* Date Badge */}
                      <View style={styles.dateCol}>
                        <Text style={styles.dayNumber}>
                          {String(day.day).padStart(2, '0')}
                        </Text>
                        <Text style={styles.dayMonth}>
                          {MONTH_NAMES[selectedMonth - 1]?.slice(0, 3)}
                        </Text>
                      </View>

                      {/* Timeline Details */}
                      <View style={styles.timelineCol}>
                        <View style={styles.timelineHeaderRow}>
                          <Badge
                            text={
                              isLate
                                ? 'Late Arrival'
                                : isPresent
                                ? 'Present'
                                : isAbsent
                                ? 'Absent'
                                : 'Holiday / Off'
                            }
                            variant={
                              isLate
                                ? 'warning'
                                : isPresent
                                ? 'success'
                                : isAbsent
                                ? 'error'
                                : 'neutral'
                            }
                          />
                        </View>

                        <View style={styles.punchTimesRow}>
                          <View style={styles.punchTimeItem}>
                            <Clock size={12} color="#64748B" />
                            <Text style={styles.punchTimeLabel}>In: </Text>
                            <Text style={styles.punchTimeValue}>
                              {day.checkIn
                                ? new Date(day.checkIn).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </Text>
                          </View>

                          <View style={styles.punchTimeItem}>
                            <Clock size={12} color="#64748B" />
                            <Text style={styles.punchTimeLabel}>Out: </Text>
                            <Text style={styles.punchTimeValue}>
                              {day.checkOut
                                ? new Date(day.checkOut).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </Text>
                          </View>
                        </View>

                        {day.remarks ? (
                          <Text style={styles.remarksText}>{day.remarks}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                );
              })
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
    paddingBottom: 100,
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
  monthSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthLabelCol: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006FFF',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  logSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  logCountText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dayLogCard: {
    marginBottom: 10,
    padding: 12,
  },
  dayLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingRight: 12,
    marginRight: 12,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  dayMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  timelineCol: {
    flex: 1,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  punchTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  punchTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  punchTimeLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  punchTimeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  remarksText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 4,
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
