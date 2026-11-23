import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
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
import { createTeacherMaterialApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  FolderOpen,
  FileText,
  Paperclip,
  X,
  Upload,
} from 'lucide-react-native';

export const UploadMaterialScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch, batches } = useTeacherStore();

  const [batchId, setBatchId] = useState<string>(selectedBatch?.id || (batches[0]?.id || ''));
  const [subjectId, setSubjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileType, setFileType] = useState<'PDF' | 'DOCUMENT' | 'IMAGE' | 'TEXT'>('PDF');

  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

  const currentBatch = batches.find((b) => b.id === batchId) || selectedBatch;
  const availableSubjects = currentBatch?.batchSubjects || [];

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        });

        // Auto-detect type
        if (asset.mimeType?.includes('pdf')) {
          setFileType('PDF');
        } else if (asset.mimeType?.includes('image')) {
          setFileType('IMAGE');
        } else {
          setFileType('DOCUMENT');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick file.');
    }
  };

  const uploadMutation = useMutation({
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
      formData.append('type', fileType);
      formData.append('isPublished', 'true');

      if (selectedFile) {
        const filePayload: any = {
          uri: Platform.OS === 'android' ? selectedFile.uri : selectedFile.uri.replace('file://', ''),
          name: selectedFile.name,
          type: selectedFile.type,
        };
        formData.append('file', filePayload);
      }

      return createTeacherMaterialApi(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-materials'] });
      Alert.alert('Material Uploaded', 'Study resource published for students.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to upload material.');
    },
  });

  const handleSubmit = () => {
    if (!batchId) {
      Alert.alert('Missing Batch', 'Please select a batch.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for the material.');
      return;
    }
    if (!selectedFile && fileType !== 'TEXT') {
      Alert.alert('Missing File', 'Please attach a file or select Text Notes type.');
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <ScreenContainer>
      <Header title="Upload Study Material" showBack={true} />

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
          {/* Material Title */}
          <Text style={styles.inputLabel}>Material Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Organic Chemistry Lecture Notes"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.inputLabel}>Description / Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Brief overview of contents, chapters covered..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Type Selector */}
          <Text style={styles.inputLabel}>Resource Type</Text>
          <View style={styles.typeRow}>
            {(['PDF', 'DOCUMENT', 'IMAGE', 'TEXT'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, fileType === t && styles.typeButtonActive]}
                onPress={() => setFileType(t)}
              >
                <Text style={[styles.typeButtonText, fileType === t && styles.typeButtonTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Attachment Box */}
          <Text style={styles.inputLabel}>File Attachment *</Text>
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
              <Upload size={18} color="#64748B" />
              <Text style={styles.uploadBtnText}>Select PDF, Image, or Document</Text>
            </TouchableOpacity>
          )}

          <Button
            title={uploadMutation.isPending ? 'Uploading...' : 'Publish Material'}
            onPress={handleSubmit}
            disabled={uploadMutation.isPending}
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
    height: 80,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: '#0A2540',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
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
