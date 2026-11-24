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
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ChildSelectorCard } from '../../components/parent/ChildSelectorCard';
import { useParentStore } from '../../store/parentStore';
import {
  getParentFeedbackApi,
  submitParentFeedbackApi,
  getParentStudentTeachersApi,
} from '../../api/parent.api';
import { brandColors, theme } from '../../theme';
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Send,
  X,
} from 'lucide-react-native';

export const ParentFeedbackScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { selectedChild } = useParentStore();
  const studentId = selectedChild?.studentId || '';

  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const {
    data: inquiries = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['parent-feedback', studentId],
    queryFn: () => getParentFeedbackApi(studentId),
    enabled: !!studentId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['parent-student-teachers', studentId],
    queryFn: () => getParentStudentTeachersApi(studentId),
    enabled: !!studentId,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const submitMutation = useMutation({
    mutationFn: submitParentFeedbackApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-feedback'] });
      setModalVisible(false);
      setSubject('');
      setMessage('');
      setSelectedTeacherId('');
      Alert.alert('Inquiry Sent', 'Your inquiry has been delivered to the teacher/center.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to submit inquiry.');
    },
  });

  const handleSendInquiry = () => {
    if (!subject.trim()) {
      Alert.alert('Missing Subject', 'Please enter a subject for your inquiry.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Missing Message', 'Please enter your message.');
      return;
    }

    submitMutation.mutate({
      studentId,
      category: 'GENERAL',
      subject: subject.trim(),
      message: message.trim(),
      teacherId: selectedTeacherId || undefined,
    });
  };

  return (
    <ScreenContainer>
      <Header
        title="Teacher Inquiries"
        subtitle="Direct Communication & Center Feedback"
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

        {/* Action Header */}
        <View style={styles.actionHeaderRow}>
          <Text style={styles.actionSectionTitle}>PREVIOUS INQUIRIES & REPLIES</Text>
          <TouchableOpacity
            style={styles.newInquiryBtn}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={14} color="#FFFFFF" />
            <Text style={styles.newInquiryBtnText}>New Inquiry</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={brandColors.navy} />
            <Text style={styles.loadingText}>Fetching inquiries...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Unable to Load Inquiries</Text>
            <Text style={styles.errorDesc}>
              Could not retrieve feedback messages. Please try refreshing.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        ) : inquiries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MessageSquare size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Inquiries Sent Yet</Text>
            <Text style={styles.emptyText}>
              You haven't initiated any inquiries regarding {selectedChild?.fullName || 'your child'}.
              Tap "New Inquiry" above to send a note to their faculty.
            </Text>
          </Card>
        ) : (
          inquiries.map((inquiry) => {
            const isResolved = inquiry.status === 'RESOLVED';
            const isAcknowledged = inquiry.status === 'ACKNOWLEDGED';

            return (
              <Card key={inquiry.id} style={styles.inquiryCard}>
                <View style={styles.inquiryHeader}>
                  <View style={styles.inquiryTitleCol}>
                    <Text style={styles.inquirySubject}>{inquiry.subject}</Text>
                    <Text style={styles.inquiryDate}>
                      Sent on {new Date(inquiry.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <Badge
                    text={
                      isResolved
                        ? 'Resolved'
                        : isAcknowledged
                        ? 'Acknowledged'
                        : 'Pending Response'
                    }
                    variant={isResolved ? 'success' : isAcknowledged ? 'info' : 'warning'}
                  />
                </View>

                {/* Parent Question / Note */}
                <View style={styles.parentMessageBox}>
                  <Text style={styles.parentMessageLabel}>Your Note:</Text>
                  <Text style={styles.parentMessageText}>{inquiry.message}</Text>
                </View>

                {/* Teacher / Center Response */}
                {inquiry.response ? (
                  <View style={styles.responseBox}>
                    <View style={styles.responseHeaderRow}>
                      <View style={styles.responseIcon}>
                        <User size={12} color="#006FFF" />
                      </View>
                      <Text style={styles.responseHeaderTitle}>
                        Center / Teacher Response
                      </Text>
                      {inquiry.respondedAt && (
                        <Text style={styles.responseDate}>
                          {new Date(inquiry.respondedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.responseText}>{inquiry.response}</Text>
                  </View>
                ) : (
                  <View style={styles.awaitingBox}>
                    <Clock size={12} color="#D97706" />
                    <Text style={styles.awaitingText}>
                      Awaiting response from faculty / center staff.
                    </Text>
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* New Inquiry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New Inquiry</Text>
                <Text style={styles.modalSubtitle}>
                  For {selectedChild?.fullName || 'Child'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Optional Teacher Selection */}
              {teachers.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Select Teacher (Optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {teachers.map((t) => {
                      const isSelected = selectedTeacherId === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.teacherPill,
                            isSelected && styles.teacherPillActive,
                          ]}
                          onPress={() =>
                            setSelectedTeacherId(isSelected ? '' : t.id)
                          }
                        >
                          <Text
                            style={[
                              styles.teacherPillText,
                              isSelected && styles.teacherPillTextActive,
                            ]}
                          >
                            {t.user?.fullName || t.fullName} ({(typeof t.subjects?.[0] === 'object' ? (t.subjects[0] as any)?.name : t.subjects?.[0]) || 'Faculty'})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Subject / Topic *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Doubts regarding Science syllabus"
                  placeholderTextColor="#94A3B8"
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Message / Question *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Type your inquiry or message here..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={message}
                  onChangeText={setMessage}
                />
              </View>

              <Button
                title={submitMutation.isPending ? 'Sending...' : 'Send Inquiry'}
                onPress={handleSendInquiry}
                disabled={submitMutation.isPending}
                style={styles.submitBtn}
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
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  newInquiryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#006FFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newInquiryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inquiryCard: {
    marginBottom: 12,
    padding: 14,
  },
  inquiryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  inquiryTitleCol: {
    flex: 1,
    paddingRight: 8,
  },
  inquirySubject: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  inquiryDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  parentMessageBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  parentMessageLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  parentMessageText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  responseBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#006FFF',
  },
  responseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  responseIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006FFF',
    flex: 1,
  },
  responseDate: {
    fontSize: 10,
    color: '#64748B',
  },
  responseText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 17,
  },
  awaitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  awaitingText: {
    fontSize: 11,
    color: '#D97706',
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
    lineHeight: 16,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
  teacherPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teacherPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  teacherPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  teacherPillTextActive: {
    color: '#FEDC32',
    fontWeight: '700',
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
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: '#0F172A',
    marginTop: 8,
  },
});
