import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { gradeSubmissionApi } from '../../api/teacher.api';
import { brandColors, theme } from '../../theme';
import {
  Award,
  User,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react-native';

export const EvaluateHomeworkScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const {
    submissionId,
    studentName,
    admissionNumber,
    maxMarks,
    studentNotes,
    fileUrl,
    fileName,
    currentGrade,
    currentFeedback,
    homeworkId,
  } = route.params || {};

  const [grade, setGrade] = useState(currentGrade || '');
  const [feedback, setFeedback] = useState(currentFeedback || '');

  const gradeMutation = useMutation({
    mutationFn: () => gradeSubmissionApi(submissionId, grade.trim(), feedback.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-submissions', homeworkId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-homework'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      Alert.alert('Grade Recorded', 'Student submission evaluation saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to record grade.');
    },
  });

  const handleSave = () => {
    if (!grade.trim()) {
      Alert.alert('Missing Grade', 'Please enter a numerical score or letter grade.');
      return;
    }
    gradeMutation.mutate();
  };

  return (
    <ScreenContainer>
      <Header
        title="Evaluate Submission"
        subtitle={studentName || 'Student Review'}
        showBack={true}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Student Card */}
        <Card style={styles.studentCard}>
          <View style={styles.studentRow}>
            <View style={styles.avatar}>
              <User size={22} color="#FFFFFF" />
            </View>
            <View style={styles.studentMeta}>
              <Text style={styles.studentName}>{studentName}</Text>
              <Text style={styles.admissionNumber}>Admission: {admissionNumber}</Text>
            </View>
          </View>
        </Card>

        {/* Student Submission Material */}
        <Card style={styles.submissionCard}>
          <Text style={styles.cardHeader}>Student Submission</Text>

          {studentNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Student Remarks / Answers:</Text>
              <Text style={styles.notesText}>{studentNotes}</Text>
            </View>
          ) : null}

          {fileUrl ? (
            <TouchableOpacity
              style={styles.fileButton}
              onPress={() => Linking.openURL(fileUrl)}
            >
              <Paperclip size={18} color="#0284C7" />
              <View style={styles.fileButtonInfo}>
                <Text style={styles.fileButtonTitle} numberOfLines={1}>
                  {fileName || 'Download Submission Attachment'}
                </Text>
                <Text style={styles.fileButtonSub}>Tap to open in browser / viewer</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {!studentNotes && !fileUrl ? (
            <Text style={styles.emptyNotice}>Student marked assignment complete without notes.</Text>
          ) : null}
        </Card>

        {/* Evaluation Grading Form */}
        <Card style={styles.evalCard}>
          <View style={styles.gradeHeaderRow}>
            <Award size={20} color="#FE4D01" />
            <Text style={styles.evalTitle}>Grading & Teacher Feedback</Text>
          </View>

          <Text style={styles.inputLabel}>
            Score / Grade * {maxMarks ? `(Out of ${maxMarks})` : ''}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={maxMarks ? `e.g. 85 or A` : 'e.g. 90, A+, Pass'}
            placeholderTextColor="#94A3B8"
            value={grade}
            onChangeText={setGrade}
          />

          {/* Quick grade suggestions */}
          <View style={styles.quickGradeRow}>
            {['A+', 'A', 'B', 'C', '100', '90', '80', 'Pass'].map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.quickGradePill}
                onPress={() => setGrade(g)}
              >
                <Text style={styles.quickGradeText}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Remarks & Recommendations (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Constructive feedback to help the student improve..."
            placeholderTextColor="#94A3B8"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Button
            title={gradeMutation.isPending ? 'Saving Grade...' : 'Save Evaluation'}
            onPress={handleSave}
            disabled={gradeMutation.isPending}
            style={styles.saveBtn}
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
  studentCard: {
    padding: 14,
    marginBottom: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentMeta: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  admissionNumber: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  submissionCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0A2540',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  fileButtonInfo: {
    flex: 1,
  },
  fileButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  fileButtonSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
  },
  emptyNotice: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  evalCard: {
    padding: 16,
  },
  gradeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  evalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2540',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    marginTop: 8,
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
  quickGradeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  quickGradePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quickGradeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: '#FE4D01',
  },
});
