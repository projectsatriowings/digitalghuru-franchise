import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  getStudentDetailsApi,
  checkInStudentApi,
  checkOutStudentApi,
  createTeacherProgressFeedbackApi,
} from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  User,
  GraduationCap,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Phone,
  AlertCircle,
  FileText,
  Star,
  Plus,
  X,
} from 'lucide-react-native';

export const TeacherStudentDetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { studentId, batchId } = route.params || {};

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [category, setCategory] = useState('Academic Progress');
  const [rating, setRating] = useState('5');
  const [remarks, setRemarks] = useState('');

  const {
    data: student,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-student-detail', studentId],
    queryFn: () => getStudentDetailsApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const checkInMutation = useMutation({
    mutationFn: () => checkInStudentApi({ studentId, batchId, method: 'MANUAL' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-student-detail'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      Alert.alert('Success', `${student?.firstName || 'Student'} checked in successfully.`);
    },
    onError: (err: any) => {
      Alert.alert('Attendance Notice', err.message || 'Could not record check-in.');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => checkOutStudentApi({ studentId, batchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-student-detail'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      Alert.alert('Success', `${student?.firstName || 'Student'} checked out successfully.`);
    },
    onError: (err: any) => {
      Alert.alert('Attendance Notice', err.message || 'Could not record check-out.');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: createTeacherProgressFeedbackApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-student-detail'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-progress'] });
      setFeedbackModalVisible(false);
      setRemarks('');
      Alert.alert('Feedback Added', 'Progress review recorded for this student.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to submit feedback.');
    },
  });

  const handleSendFeedback = () => {
    if (!remarks.trim()) {
      Alert.alert('Missing Remarks', 'Please enter your academic observations.');
      return;
    }
    feedbackMutation.mutate({
      studentId,
      batchId,
      category,
      rating: parseInt(rating, 10) || 5,
      remarks: remarks.trim(),
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Student Profile" showBack={true} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FE4D01" />
          <Text style={styles.loadingText}>Loading student profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !student) {
    return (
      <ScreenContainer>
        <Header title="Student Profile" showBack={true} />
        <Card style={styles.errorCard}>
          <AlertCircle size={36} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Student</Text>
          <Text style={styles.errorDesc}>
            Could not retrieve student record or you are not authorized to view it.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </Card>
      </ScreenContainer>
    );
  }

  const attendanceEvents = student.attendanceEvents || [];
  const enrollments = student.enrollments || [];
  const primaryEnrollment = enrollments[0];

  return (
    <ScreenContainer>
      <Header
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`Adm #${student.admissionNumber} • Student Profile`}
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
        {/* Profile Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>
                {(student.firstName?.[0] || 'S') + (student.lastName?.[0] || '')}
              </Text>
            </View>

            <View style={styles.heroInfoCol}>
              <Text style={styles.heroName}>
                {student.firstName} {student.lastName}
              </Text>
              <Text style={styles.heroBatch}>
                {primaryEnrollment?.batch?.name || 'Class Batch'}
              </Text>
              <Text style={styles.heroAdm}>
                Adm: {student.admissionNumber} • Status: {student.status}
              </Text>
            </View>

            <Badge text={student.status} variant="success" />
          </View>

          {student.phone ? (
            <View style={styles.phoneRow}>
              <Phone size={13} color="#94A3B8" />
              <Text style={styles.phoneText}>Student Contact: {student.phone}</Text>
            </View>
          ) : null}
        </Card>

        {/* Quick Attendance Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>TODAY'S ATTENDANCE ACTION</Text>
        </View>

        <Card style={styles.attendanceActionCard}>
          <Text style={styles.actionPromptText}>
            Quickly mark arrival or departure for this student in session.
          </Text>
          <View style={styles.attendanceBtnsRow}>
            <TouchableOpacity
              style={[styles.attBtn, styles.checkInBtn]}
              onPress={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              <CheckCircle2 size={16} color="#FFFFFF" />
              <Text style={styles.attBtnText}>
                {checkInMutation.isPending ? 'Marking...' : 'Mark Check-In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.attBtn, styles.checkOutBtn]}
              onPress={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending}
            >
              <Clock size={16} color="#0F172A" />
              <Text style={[styles.attBtnText, { color: '#0F172A' }]}>
                {checkOutMutation.isPending ? 'Marking...' : 'Mark Departure'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Recent Attendance Session Logs */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>RECENT ATTENDANCE SESSIONS</Text>
          <Text style={styles.sectionCountText}>{attendanceEvents.length} Logs</Text>
        </View>

        {attendanceEvents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent attendance events logged.</Text>
          </Card>
        ) : (
          attendanceEvents.slice(0, 5).map((ev: any) => (
            <Card key={ev.id} style={styles.eventCard}>
              <View style={styles.eventRow}>
                <View style={styles.eventIcon}>
                  <CalendarCheck size={16} color="#006FFF" />
                </View>
                <View style={styles.eventInfoCol}>
                  <Text style={styles.eventType}>{ev.eventType}</Text>
                  <Text style={styles.eventDate}>
                    {new Date(ev.eventTime).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                </View>
                <Badge
                  text={ev.isLate ? 'Late' : 'Recorded'}
                  variant={ev.isLate ? 'warning' : 'success'}
                />
              </View>
            </Card>
          ))
        )}

        {/* Observation & Feedback Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>TEACHER OBSERVATION</Text>
          <TouchableOpacity
            style={styles.addReviewBtn}
            onPress={() => setFeedbackModalVisible(true)}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.addReviewBtnText}>Add Review</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.feedbackPromptCard}>
          <Text style={styles.feedbackPromptTitle}>Record Academic Observations</Text>
          <Text style={styles.feedbackPromptDesc}>
            Log progress reviews, behavior notes, or academic milestones visible to this student and their parents.
          </Text>
        </Card>
      </ScrollView>

      {/* Add Progress Review Modal */}
      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Progress Review</Text>
                <Text style={styles.modalSubtitle}>
                  For {student.firstName} {student.lastName}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setFeedbackModalVisible(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.categoryPillsRow}>
                  {['Academic Progress', 'Classroom Conduct', 'Assignment Effort'].map(
                    (cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryPill,
                          category === cat && styles.categoryPillActive,
                        ]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            category === cat && styles.categoryPillTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Rating (1 to 5 Stars)</Text>
                <View style={styles.ratingRow}>
                  {['1', '2', '3', '4', '5'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.ratingPill, rating === r && styles.ratingPillActive]}
                      onPress={() => setRating(r)}
                    >
                      <Star
                        size={14}
                        color={rating === r ? '#FE4D01' : '#64748B'}
                        fill={rating === r ? '#FE4D01' : 'transparent'}
                      />
                      <Text
                        style={[
                          styles.ratingPillText,
                          rating === r && styles.ratingPillTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Teacher Remarks & Feedback *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter constructive feedback, comprehension notes..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>

              <Button
                title={feedbackMutation.isPending ? 'Saving...' : 'Save Progress Review'}
                onPress={handleSendFeedback}
                disabled={feedbackMutation.isPending}
                style={styles.saveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    margin: 16,
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
  heroCard: {
    backgroundColor: '#0A2540',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(254, 77, 1, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FE4D01',
  },
  heroAvatarText: {
    color: '#FEDC32',
    fontSize: 16,
    fontWeight: '800',
  },
  heroInfoCol: {
    flex: 1,
  },
  heroName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroBatch: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  heroAdm: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  phoneText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  sectionHeaderRow: {
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
  sectionCountText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  attendanceActionCard: {
    marginBottom: 16,
    padding: 14,
  },
  actionPromptText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  attendanceBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkInBtn: {
    backgroundColor: '#16A34A',
  },
  checkOutBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventCard: {
    marginBottom: 8,
    padding: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  eventInfoCol: {
    flex: 1,
  },
  eventType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FE4D01',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addReviewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackPromptCard: {
    marginBottom: 16,
    padding: 14,
  },
  feedbackPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  feedbackPromptDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#FEDC32',
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratingPillActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ratingPillTextActive: {
    color: '#FE4D01',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 90,
  },
  saveBtn: {
    backgroundColor: '#FE4D01',
    marginTop: 8,
  },
});
