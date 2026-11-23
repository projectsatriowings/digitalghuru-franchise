import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useTeacherStore } from '../../store/teacherStore';
import { createTeacherHomeworkApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  FileText,
  Calendar,
  CheckCircle2,
  Paperclip,
  X,
  AlertCircle,
  Award,
  ChevronDown,
} from 'lucide-react-native';

export const CreateHomeworkScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch, batches } = useTeacherStore();

  const [batchId, setBatchId] = useState<string>(selectedBatch?.id || (batches[0]?.id || ''));
  const [subjectId, setSubjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Default due date to 7 days in the future
  const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [maxMarks, setMaxMarks] = useState('100');

  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

  // Available subjects for the active batch
  const currentBatch = batches.find((b) => b.id === batchId) || selectedBatch;
  const availableSubjects = currentBatch?.batchSubjects || [];

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
      Alert.alert('Error', 'Failed to pick attachment.');
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('batchId', batchId);
      if (subjectId) {
        formData.append('subjectId', subjectId);
      }
      formData.append('title', title.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      formData.append('dueDate', new Date(dueDate).toISOString());
      if (maxMarks.trim()) {
        formData.append('maxMarks', maxMarks.trim());
      }
      formData.append('isPublished', 'true');

      if (selectedFile) {
        const filePayload: any = {
          uri: Platform.OS === 'android' ? selectedFile.uri : selectedFile.uri.replace('file://', ''),
          name: selectedFile.name,
          type: selectedFile.type,
        };
        formData.append('file', filePayload);
      }

      return createTeacherHomeworkApi(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-homework'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      Alert.alert('Assignment Created', 'Homework has been successfully assigned to students.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to create assignment.');
    },
  });

  const handleSubmit = () => {
    if (!batchId) {
      Alert.alert('Missing Batch', 'Please select a batch.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter an assignment title.');
      return;
    }
    if (!dueDate.trim()) {
      Alert.alert('Missing Due Date', 'Please specify a due date (YYYY-MM-DD).');
      return;
    }
    createMutation.mutate();
  };

  return (
    <ScreenContainer>
      <Header title="Assign Homework" showBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Class Selection */}
        <Text style={styles.sectionLabel}>Select Class / Batch</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchScroll}>
          {batches.map((b) => {
            const isSelected = b.id === batchId;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.batchPill, isSelected && styles.batchPillSelected]}
                onPress={() => {
                  setBatchId(b.id);
                  setSubjectId('');
                }}
              >
                <Text style={[styles.batchPillText, isSelected && styles.batchPillTextSelected]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Subject Selection */}
        {availableSubjects.length > 0 && (
          <View style={styles.subjectContainer}>
            <Text style={styles.sectionLabel}>Subject (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchScroll}>
              <TouchableOpacity
                style={[styles.subjectPill, !subjectId && styles.subjectPillSelected]}
                onPress={() => setSubjectId('')}
              >
                <Text style={[styles.subjectPillText, !subjectId && styles.subjectPillTextSelected]}>
                  General / All
                </Text>
              </TouchableOpacity>
              {availableSubjects.map((s) => {
                const isSelected = s.subject.id === subjectId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.subjectPill, isSelected && styles.subjectPillSelected]}
                    onPress={() => setSubjectId(s.subject.id)}
                  >
                    <Text style={[styles.subjectPillText, isSelected && styles.subjectPillTextSelected]}>
                      {s.subject.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Card style={styles.formCard}>
          {/* Assignment Title */}
          <Text style={styles.inputLabel}>Assignment Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Chapter 4 Thermodynamics Exercises"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.inputLabel}>Instructions / Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Detailed instructions or reference page numbers..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Due Date & Marks Row */}
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.inputLabel}>Max Marks</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 50 or 100"
                placeholderTextColor="#94A3B8"
                value={maxMarks}
                onChangeText={setMaxMarks}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Attachment */}
          <Text style={styles.inputLabel}>Attachment (Optional)</Text>
          {selectedFile ? (
            <View style={styles.attachmentBox}>
              <Paperclip size={18} color="#FE4D01" />
              <Text style={styles.attachmentName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedFile(null)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
              <Paperclip size={18} color="#64748B" />
              <Text style={styles.uploadBtnText}>Attach PDF, Document, or Worksheet</Text>
            </TouchableOpacity>
          )}

          <Button
            title={createMutation.isPending ? 'Publishing...' : 'Assign Homework'}
            onPress={handleSubmit}
            disabled={createMutation.isPending}
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  batchScroll: {
    marginBottom: 16,
  },
  batchPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  batchPillSelected: {
    backgroundColor: '#FE4D01',
    borderColor: '#FE4D01',
  },
  batchPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  batchPillTextSelected: {
    color: '#FFFFFF',
  },
  subjectContainer: {
    marginBottom: 12,
  },
  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  subjectPillSelected: {
    backgroundColor: '#0A2540',
    borderColor: '#0A2540',
  },
  subjectPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  subjectPillTextSelected: {
    color: '#FFFFFF',
  },
  formCard: {
    padding: 16,
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
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
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  uploadBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: 8,
    marginTop: 4,
    marginBottom: 14,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
    color: '#C2410C',
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 14,
    backgroundColor: '#FE4D01',
  },
});
