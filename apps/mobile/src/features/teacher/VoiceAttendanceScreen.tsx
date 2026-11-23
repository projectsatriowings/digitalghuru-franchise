import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BatchSelectorCard } from '../../components/teacher/BatchSelectorCard';
import { useTeacherStore } from '../../store/teacherStore';
import { voiceMatchStudentsApi, checkInStudentApi } from '../../api/teacher.api';
import { VoiceMatchCandidate } from '../../types/teacher';
import { brandColors, theme } from '../../theme';
import {
  Mic,
  MicOff,
  Search,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Volume2,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react-native';

export const VoiceAttendanceScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { selectedBatch } = useTeacherStore();
  const batchId = route.params?.batchId || selectedBatch?.id || '';

  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [candidates, setCandidates] = useState<VoiceMatchCandidate[]>([]);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [lastCheckedIn, setLastCheckedIn] = useState<any>(null);

  const voiceMatchMutation = useMutation({
    mutationFn: (spokenText: string) => voiceMatchStudentsApi(spokenText, batchId),
    onSuccess: (data) => {
      setMatchStatus(data.status);
      setFeedbackMessage(data.message || null);
      if (data.status === 'EXACT_SINGLE' && data.bestMatch) {
        setCandidates([data.bestMatch]);
      } else if (data.status === 'EXACT_MULTIPLE' && data.matches) {
        setCandidates(data.matches);
      } else {
        setCandidates([]);
      }
    },
    onError: (err: any) => {
      Alert.alert('Voice Search Error', err.message || 'Could not match student name.');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: (studentId: string) =>
      checkInStudentApi({ studentId, batchId, method: 'VOICE_CONFIRMED' }),
    onSuccess: (res, studentId) => {
      queryClient.invalidateQueries({ queryKey: ['teacher-students', batchId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      setLastCheckedIn(res?.data?.student || { id: studentId });
      setCandidates([]);
      setTranscript('');
      setMatchStatus(null);
      setFeedbackMessage(res?.message || 'Attendance confirmed successfully.');
    },
    onError: (err: any) => {
      Alert.alert('Check-In Notice', err.message || 'Failed to record check-in.');
    },
  });

  const handleSimulateVoiceInput = (nameSample: string) => {
    setTranscript(nameSample);
    setIsListening(false);
    voiceMatchMutation.mutate(nameSample);
  };

  const handleStartListening = () => {
    setIsListening(true);
    setFeedbackMessage('Listening for student name... Speak now or tap a sample below.');
  };

  const handleSearchSpokenText = () => {
    if (!transcript.trim()) {
      Alert.alert('Empty Input', 'Please speak or type a student name.');
      return;
    }
    voiceMatchMutation.mutate(transcript.trim());
  };

  return (
    <ScreenContainer>
      <Header
        title="Voice Attendance"
        subtitle="Hands-Free AI Phonetic Roll Call"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BatchSelectorCard />

        {/* Microphone Interactive Pulse Ring */}
        <Card style={styles.micCard}>
          <View style={styles.micCardContent}>
            <TouchableOpacity
              style={[
                styles.micPulseButton,
                isListening && styles.micPulseButtonActive,
              ]}
              onPress={() => {
                if (isListening) {
                  setIsListening(false);
                } else {
                  handleStartListening();
                }
              }}
              activeOpacity={0.8}
            >
              {isListening ? (
                <Mic size={36} color="#FFFFFF" />
              ) : (
                <Mic size={36} color="#FFFFFF" />
              )}
            </TouchableOpacity>

            <Text style={styles.micPromptTitle}>
              {isListening ? 'Listening to speech...' : 'Tap Mic to Capture Spoken Name'}
            </Text>
            <Text style={styles.micPromptSub}>
              {isListening
                ? 'Speak student name clearly (e.g. "Aarav" or "Pooja")'
                : 'Phonetic matching automatically resolves fuzzy pronunciation'}
            </Text>
          </View>

          {/* Transcript Bar */}
          <View style={styles.transcriptContainer}>
            <TextInput
              style={styles.transcriptInput}
              placeholder="Spoken or typed student name..."
              placeholderTextColor="#94A3B8"
              value={transcript}
              onChangeText={setTranscript}
            />
            <TouchableOpacity
              style={styles.searchSubmitBtn}
              onPress={handleSearchSpokenText}
              disabled={voiceMatchMutation.isPending}
            >
              {voiceMatchMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Search size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Speech Emulation Pills for Testing & Fallback */}
          <View style={styles.quickVoiceRow}>
            <Text style={styles.quickVoiceLabel}>Try sample speech:</Text>
            <TouchableOpacity
              style={styles.voiceSamplePill}
              onPress={() => handleSimulateVoiceInput('Aarav')}
            >
              <Volume2 size={12} color="#FE4D01" />
              <Text style={styles.voiceSampleText}>"Aarav"</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voiceSamplePill}
              onPress={() => handleSimulateVoiceInput('Pooja')}
            >
              <Volume2 size={12} color="#FE4D01" />
              <Text style={styles.voiceSampleText}>"Pooja"</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voiceSamplePill}
              onPress={() => handleSimulateVoiceInput('Kumar')}
            >
              <Volume2 size={12} color="#FE4D01" />
              <Text style={styles.voiceSampleText}>"Kumar"</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Feedback / Success Notice Banner */}
        {feedbackMessage && (
          <View style={styles.feedbackBanner}>
            <Sparkles size={16} color="#FE4D01" />
            <Text style={styles.feedbackBannerText}>{feedbackMessage}</Text>
          </View>
        )}

        {/* Last Confirmed Check-In Success Card */}
        {lastCheckedIn && (
          <Card style={styles.successCard}>
            <View style={styles.successRow}>
              <View style={styles.successIconBox}>
                <CheckCircle2 size={24} color="#16A34A" />
              </View>
              <View style={styles.successCol}>
                <Text style={styles.successTitle}>Attendance Recorded!</Text>
                <Text style={styles.successStudentName}>
                  {lastCheckedIn.firstName} {lastCheckedIn.lastName}
                </Text>
                <Text style={styles.successAdm}>
                  Adm #{lastCheckedIn.admissionNumber || 'ADM-2026-001'} • Voice Confirmed
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Matching Candidates Section */}
        {candidates.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                {matchStatus === 'EXACT_SINGLE'
                  ? 'UNAMBIGUOUS MATCH FOUND'
                  : 'MULTIPLE MATCHES — SELECT STUDENT'}
              </Text>
              <Text style={styles.resultsCount}>{candidates.length} Match</Text>
            </View>

            {candidates.map((cand) => (
              <Card key={cand.id} style={styles.candidateCard}>
                <View style={styles.candidateRow}>
                  <View style={styles.candidateAvatar}>
                    <Text style={styles.candAvatarText}>
                      {(cand.firstName?.[0] || 'S') + (cand.lastName?.[0] || '')}
                    </Text>
                  </View>

                  <View style={styles.candidateInfo}>
                    <Text style={styles.candName}>
                      {cand.firstName} {cand.lastName}
                    </Text>
                    <Text style={styles.candAdm}>
                      Adm #{cand.admissionNumber} • {cand.batchName}
                    </Text>
                    {cand.checkInTimeFormatted ? (
                      <Text style={styles.candTime}>
                        Already In: {cand.checkInTimeFormatted}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      cand.alreadyCheckedIn && styles.alreadyCheckedBtn,
                    ]}
                    onPress={() => checkInMutation.mutate(cand.id)}
                    disabled={checkInMutation.isPending}
                  >
                    <Text style={styles.confirmBtnText}>
                      {checkInMutation.isPending
                        ? '...'
                        : cand.alreadyCheckedIn
                        ? 'Re-Confirm'
                        : 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  micCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  micCardContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  micPulseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FE4D01',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#FE4D01',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  micPulseButtonActive: {
    backgroundColor: '#EA580C',
    transform: [{ scale: 1.08 }],
  },
  micPromptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  micPromptSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 16,
  },
  transcriptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 12,
  },
  transcriptInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  searchSubmitBtn: {
    backgroundColor: '#0F172A',
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickVoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickVoiceLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  voiceSamplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voiceSampleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FE4D01',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  feedbackBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    padding: 14,
    marginBottom: 14,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  successCol: {
    flex: 1,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  successStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  successAdm: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  resultsCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FE4D01',
  },
  candidateCard: {
    marginBottom: 10,
    padding: 14,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  candidateAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  candAvatarText: {
    color: '#FEDC32',
    fontSize: 14,
    fontWeight: '700',
  },
  candidateInfo: {
    flex: 1,
    paddingRight: 8,
  },
  candName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  candAdm: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  candTime: {
    fontSize: 11,
    color: '#EA580C',
    fontWeight: '600',
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  alreadyCheckedBtn: {
    backgroundColor: '#D97706',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
