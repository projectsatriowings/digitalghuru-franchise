import React, { useState, useMemo, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { brandColors, theme } from '../../theme';
import { getStudentHomeworkApi, submitHomeworkApi, HomeworkUploadPayload } from '../../api/student.api';
import { HomeworkItem } from '../../types/student';
import {
  CheckSquare,
  Clock,
  Calendar,
  Upload,
  FileText,
  X,
  Camera,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from 'lucide-react-native';

export const StudentHomeworkScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<'PENDING' | 'SUBMITTED' | 'ALL'>('PENDING');

  // Submission Modal state
  const [activeHomework, setActiveHomework] = useState<HomeworkItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<HomeworkUploadPayload | null>(null);
  const [studentNotes, setStudentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    data: homeworkList = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-homework'],
    queryFn: getStudentHomeworkApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const safeHomeworkList = useMemo(() => {
    return Array.isArray(homeworkList) ? homeworkList : [];
  }, [homeworkList]);

  const filteredHomework = useMemo(() => {
    if (filterTab === 'PENDING') {
      return safeHomeworkList.filter((hw) => !hw?.isSubmitted && hw?.submissionStatus !== 'SUBMITTED' && hw?.submissionStatus !== 'EVALUATED');
    }
    if (filterTab === 'SUBMITTED') {
      return safeHomeworkList.filter((hw) => hw?.isSubmitted || hw?.submissionStatus === 'SUBMITTED' || hw?.submissionStatus === 'EVALUATED');
    }
    return safeHomeworkList;
  }, [safeHomeworkList, filterTab]);

  // Pick document
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  // Pick camera/photo
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permission is required to upload homework photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `homework_${Date.now()}.jpg`;
        setSelectedFile({
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || 'image/jpeg',
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  // Submit homework
  const handleSubmit = async () => {
    if (!activeHomework || !selectedFile) {
      Alert.alert('File Required', 'Please select a document or image to submit your homework.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitHomeworkApi(activeHomework.id, selectedFile, studentNotes);
      Alert.alert('Success', 'Homework submitted successfully!');
      setActiveHomework(null);
      setSelectedFile(null);
      setStudentNotes('');
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['student-homework'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Failed to submit assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Homework & Assignments" subtitle="Loading assignments..." />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading homework list...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <Header title="Homework & Assignments" subtitle="Assignments" />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Failed to Load Homework</Text>
          <Text style={styles.errorSubtitle}>
            Unable to fetch homework assignments. Please retry.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const pendingCount = homeworkList.filter((h) => !h.isSubmitted).length;
  const submittedCount = homeworkList.filter((h) => h.isSubmitted).length;

  return (
    <ScreenContainer>
      <Header
        title="Homework & Tasks"
        subtitle={`${pendingCount} pending • ${submittedCount} submitted`}
      />

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, filterTab === 'PENDING' && styles.tabItemActive]}
          onPress={() => setFilterTab('PENDING')}
        >
          <Text style={[styles.tabText, filterTab === 'PENDING' && styles.tabTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, filterTab === 'SUBMITTED' && styles.tabItemActive]}
          onPress={() => setFilterTab('SUBMITTED')}
        >
          <Text style={[styles.tabText, filterTab === 'SUBMITTED' && styles.tabTextActive]}>
            Submitted ({submittedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, filterTab === 'ALL' && styles.tabItemActive]}
          onPress={() => setFilterTab('ALL')}
        >
          <Text style={[styles.tabText, filterTab === 'ALL' && styles.tabTextActive]}>
            All ({homeworkList.length})
          </Text>
        </TouchableOpacity>
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
        {filteredHomework.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle2 size={40} color={brandColors.success} />
            <Text style={styles.emptyTitle}>
              {filterTab === 'PENDING' ? 'No Pending Homework!' : 'No Assignments in this View'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filterTab === 'PENDING'
                ? 'You have completed all assigned homework tasks. Excellent dedication!'
                : 'Assignments will appear here once allocated by your subject teachers.'}
            </Text>
          </Card>
        ) : (
          filteredHomework.map((hw) => {
            const dueDateStr = new Date(hw.dueDate).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const isOverdue = !hw.isSubmitted && new Date(hw.dueDate).getTime() < Date.now();

            return (
              <Card key={hw.id} style={styles.hwCard}>
                <View style={styles.hwHeader}>
                  <Badge text={hw.subject || 'Subject'} variant="student" />
                  <View style={styles.dueDateWrap}>
                    <Calendar size={13} color={isOverdue ? brandColors.error : brandColors.textMuted} />
                    <Text style={[styles.dueDateText, isOverdue && styles.overdueText]}>
                      Due: {dueDateStr}
                    </Text>
                  </View>
                </View>

                <Text style={styles.hwTitle}>{hw.title}</Text>
                {hw.description ? (
                  <Text style={styles.hwDesc}>{hw.description}</Text>
                ) : null}

                {/* Grade & Feedback if evaluated */}
                {(hw.grade || hw.feedback) && (
                  <View style={styles.evaluationBox}>
                    <View style={styles.evalHeader}>
                      <FileCheck size={14} color="#059669" />
                      <Text style={styles.evalTitle}>Teacher Feedback</Text>
                      {hw.grade && (
                        <Badge text={`Grade: ${hw.grade}`} variant="success" />
                      )}
                    </View>
                    {hw.feedback && (
                      <Text style={styles.evalFeedback}>{hw.feedback}</Text>
                    )}
                  </View>
                )}

                <View style={styles.hwFooter}>
                  <View style={styles.statusWrap}>
                    {hw.isSubmitted ? (
                      <Badge text={hw.submissionStatus || 'Submitted'} variant="success" />
                    ) : (
                      <Badge text={isOverdue ? 'Overdue' : 'Pending'} variant={isOverdue ? 'error' : 'warning'} />
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, hw.isSubmitted && styles.submitButtonSecondary]}
                    onPress={() => {
                      setActiveHomework(hw);
                      setSelectedFile(null);
                      setStudentNotes('');
                    }}
                  >
                    <Upload size={14} color={hw.isSubmitted ? brandColors.textSecondary : brandColors.white} />
                    <Text style={[styles.submitButtonText, hw.isSubmitted && styles.submitButtonTextSecondary]}>
                      {hw.isSubmitted ? 'Resubmit' : 'Submit Work'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Submission Modal */}
      <Modal
        visible={!!activeHomework}
        animationType="slide"
        transparent
        onRequestClose={() => !isSubmitting && setActiveHomework(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Text style={styles.modalTitle}>Submit Homework</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {activeHomework?.title}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isSubmitting && setActiveHomework(null)}
                disabled={isSubmitting}
                style={styles.closeBtn}
              >
                <X size={20} color={brandColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* File Attachment Options */}
              <Text style={styles.label}>Upload Solution Document / Photo</Text>
              <View style={styles.attachButtonsRow}>
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={handlePickDocument}
                  disabled={isSubmitting}
                >
                  <Paperclip size={18} color={brandColors.blue} />
                  <Text style={styles.attachBtnText}>Browse Files</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={handlePickPhoto}
                  disabled={isSubmitting}
                >
                  <Camera size={18} color={brandColors.blue} />
                  <Text style={styles.attachBtnText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Selected File Card */}
              {selectedFile ? (
                <View style={styles.selectedFileCard}>
                  <View style={styles.selectedFileRow}>
                    <FileText size={20} color={brandColors.blue} />
                    <View style={styles.selectedFileInfo}>
                      <Text style={styles.selectedFileName} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.selectedFileType}>{selectedFile.type}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedFile(null)}
                      disabled={isSubmitting}
                    >
                      <X size={18} color={brandColors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.placeholderFileCard}>
                  <Upload size={24} color={brandColors.textMuted} />
                  <Text style={styles.placeholderText}>
                    Supports PDF, DOC, DOCX, JPG, PNG
                  </Text>
                </View>
              )}

              {/* Notes Input */}
              <Text style={styles.label}>Notes for Instructor (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any comments or questions for your teacher..."
                placeholderTextColor={brandColors.textMuted}
                multiline
                numberOfLines={3}
                value={studentNotes}
                onChangeText={setStudentNotes}
                editable={!isSubmitting}
              />

              {/* Submit Action */}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!selectedFile || isSubmitting) && styles.modalSubmitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!selectedFile || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={brandColors.white} />
                ) : (
                  <>
                    <Upload size={18} color={brandColors.white} />
                    <Text style={styles.modalSubmitBtnText}>Upload & Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: brandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
    paddingHorizontal: theme.spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: brandColors.blue,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textSecondary,
  },
  tabTextActive: {
    color: brandColors.blue,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    marginTop: theme.spacing.md,
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
  hwCard: {
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  hwHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dueDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  overdueText: {
    color: brandColors.error,
    fontWeight: '600',
  },
  hwTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 4,
  },
  hwDesc: {
    fontSize: 13,
    color: brandColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  evaluationBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: 8,
  },
  evalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  evalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  evalFeedback: {
    fontSize: 12,
    color: '#047857',
  },
  hwFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: brandColors.borderLight,
  },
  statusWrap: {},
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brandColors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  submitButtonSecondary: {
    backgroundColor: brandColors.surfaceMuted,
  },
  submitButtonText: {
    color: brandColors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  submitButtonTextSecondary: {
    color: brandColors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: brandColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
  },
  modalHeaderTitleWrap: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: theme.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  attachButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: theme.spacing.sm,
  },
  attachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: brandColors.blue,
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
  },
  attachBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.blue,
  },
  selectedFileCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  selectedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedFileInfo: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
  },
  selectedFileType: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  placeholderFileCard: {
    backgroundColor: brandColors.surfaceMuted,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  placeholderText: {
    fontSize: 11,
    color: brandColors.textMuted,
  },
  notesInput: {
    backgroundColor: brandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: brandColors.borderLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: 13,
    color: brandColors.textPrimary,
    textAlignVertical: 'top',
    minHeight: 70,
    marginBottom: theme.spacing.lg,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    backgroundColor: brandColors.blue,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSubmitBtnDisabled: {
    opacity: 0.5,
  },
  modalSubmitBtnText: {
    color: brandColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
