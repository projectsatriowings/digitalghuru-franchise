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
  Modal,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import {
  getTeacherProgressFeedbackApi,
  getTeacherStudentsApi,
  createTeacherProgressFeedbackApi,
} from '../../api/teacher.api';
import { TeacherProgressItem } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  Award,
  Star,
  Search,
  Plus,
  AlertCircle,
  User,
  Calendar,
  X,
  MessageSquare,
} from 'lucide-react-native';

export const TeacherProgressScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch } = useTeacherStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // New Observation Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStudentId, setModalStudentId] = useState('');
  const [modalCategory, setModalCategory] = useState('Academic Progress');
  const [modalRating, setModalRating] = useState('5');
  const [modalRemarks, setModalRemarks] = useState('');

  const {
    data: progressList = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['teacher-progress', selectedBatch?.id],
    queryFn: () => getTeacherProgressFeedbackApi(selectedBatch?.id),
    enabled: true,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['teacher-students', selectedBatch?.id],
    queryFn: () => getTeacherStudentsApi(selectedBatch?.id),
    enabled: modalVisible,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTeacherProgressFeedbackApi({
        studentId: modalStudentId,
        batchId: selectedBatch?.id || '',
        category: modalCategory,
        rating: parseInt(modalRating, 10) || 5,
        remarks: modalRemarks.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-progress'] });
      setModalVisible(false);
      setModalRemarks('');
      setModalStudentId('');
      Alert.alert('Observation Saved', 'Student academic review successfully recorded.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to submit feedback.');
    },
  });

  const handleSaveObservation = () => {
    if (!modalStudentId) {
      Alert.alert('Missing Student', 'Please select a student from the batch.');
      return;
    }
    if (!modalRemarks.trim()) {
      Alert.alert('Missing Remarks', 'Please enter your academic observations.');
      return;
    }
    createMutation.mutate();
  };

  const categories = ['ALL', 'Academic Progress', 'Homework Quality', 'Discipline', 'Class Participation'];

  const filteredList = useMemo(() => {
    let list = progressList;
    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.student?.firstName?.toLowerCase().includes(q) ||
          item.student?.lastName?.toLowerCase().includes(q) ||
          item.student?.admissionNumber?.toLowerCase().includes(q) ||
          item.remarks?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [progressList, selectedCategory, searchQuery]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <ScreenContainer>
      <Header
        title="Student Reviews"
        subtitle={selectedBatch ? selectedBatch.name : 'Performance Observations'}
        rightElement={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Review</Text>
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
            placeholder="Search student name or remarks..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catPill, selectedCategory === cat && styles.catPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#FE4D01" />
            <Text style={styles.loadingText}>Loading performance reviews...</Text>
          </View>
        ) : isError ? (
          <Card style={styles.errorCard}>
            <AlertCircle size={36} color={brandColors.error} />
            <Text style={styles.errorTitle}>Failed to Load Reviews</Text>
            <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
          </Card>
        ) : filteredList.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Award size={44} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Reviews Recorded</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No reviews match your search query.'
                : 'No performance observations recorded for this class yet.'}
            </Text>
            <Button
              title="Add First Observation"
              onPress={() => setModalVisible(true)}
              style={styles.emptyBtn}
            />
          </Card>
        ) : (
          filteredList.map((item) => {
            const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const studentName = item.student
              ? `${item.student.firstName} ${item.student.lastName}`
              : 'Class Student';

            return (
              <Card key={item.id} style={styles.reviewCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{studentName}</Text>
                    {item.student?.admissionNumber && (
                      <Text style={styles.studentCode}>Adm: {item.student.admissionNumber}</Text>
                    )}
                  </View>
                  <Badge label={item.category} variant="info" size="sm" />
                </View>

                {/* Rating Stars */}
                {item.rating != null && (
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        color={star <= item.rating! ? '#F59E0B' : '#E2E8F0'}
                        fill={star <= item.rating! ? '#F59E0B' : 'transparent'}
                      />
                    ))}
                    <Text style={styles.ratingText}>{item.rating} / 5</Text>
                  </View>
                )}

                <Text style={styles.remarksText}>{item.remarks}</Text>

                <View style={styles.dateRow}>
                  <Calendar size={13} color="#94A3B8" />
                  <Text style={styles.dateText}>{formattedDate}</Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* New Observation Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Student Review</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Select Student */}
              <Text style={styles.inputLabel}>Select Student *</Text>
              <ScrollView style={styles.studentSelectBox}>
                {students.map((st) => {
                  const isSelected = st.id === modalStudentId;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.studentOption, isSelected && styles.studentOptionSelected]}
                      onPress={() => setModalStudentId(st.id)}
                    >
                      <Text
                        style={[
                          styles.studentOptionText,
                          isSelected && styles.studentOptionTextSelected,
                        ]}
                      >
                        {st.firstName} {st.lastName} ({st.admissionNumber})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Category */}
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.catPickerRow}>
                {['Academic Progress', 'Discipline', 'Homework Quality', 'Participation'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.modalCatPill, modalCategory === c && styles.modalCatPillActive]}
                    onPress={() => setModalCategory(c)}
                  >
                    <Text
                      style={[
                        styles.modalCatText,
                        modalCategory === c && styles.modalCatTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Rating */}
              <Text style={styles.inputLabel}>Rating (1 - 5)</Text>
              <View style={styles.ratingPickerRow}>
                {['1', '2', '3', '4', '5'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.ratingPill, modalRating === r && styles.ratingPillActive]}
                    onPress={() => setModalRating(r)}
                  >
                    <Star
                      size={16}
                      color={modalRating === r ? '#FFFFFF' : '#F59E0B'}
                      fill={modalRating === r ? '#FFFFFF' : '#F59E0B'}
                    />
                    <Text
                      style={[
                        styles.ratingPillText,
                        modalRating === r && styles.ratingPillTextActive,
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Remarks */}
              <Text style={styles.inputLabel}>Observations & Recommendations *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Specific guidance, notable performance, areas to improve..."
                placeholderTextColor="#94A3B8"
                value={modalRemarks}
                onChangeText={setModalRemarks}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Button
                title={createMutation.isPending ? 'Saving...' : 'Submit Review'}
                onPress={handleSaveObservation}
                disabled={createMutation.isPending}
                style={styles.modalSubmitBtn}
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
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE4D01',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
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
  catScroll: {
    marginBottom: 14,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  catPillActive: {
    backgroundColor: '#0A2540',
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catTextActive: {
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
  reviewCard: {
    marginBottom: 12,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    marginLeft: 6,
  },
  remarksText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
  },
  modalBody: {
    paddingVertical: 12,
    gap: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 6,
    marginBottom: 4,
  },
  studentSelectBox: {
    maxHeight: 130,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 4,
  },
  studentOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  studentOptionSelected: {
    backgroundColor: '#FEF3C7',
  },
  studentOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  studentOptionTextSelected: {
    fontWeight: '700',
    color: '#B45309',
  },
  catPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalCatPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalCatPillActive: {
    backgroundColor: '#0A2540',
  },
  modalCatText: {
    fontSize: 12,
    color: '#475569',
  },
  modalCatTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingPickerRow: {
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
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratingPillActive: {
    backgroundColor: '#FE4D01',
    borderColor: '#FE4D01',
  },
  ratingPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  ratingPillTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  modalSubmitBtn: {
    marginTop: 14,
    backgroundColor: '#FE4D01',
  },
});
