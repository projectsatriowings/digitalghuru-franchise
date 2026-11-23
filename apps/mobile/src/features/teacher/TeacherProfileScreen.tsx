import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { getTeacherProfileApi } from '../../api/teacher.api';
import { useAuthStore } from '../../store/authStore';
import { brandColors, theme } from '../../theme';
import {
  User,
  Building,
  Mail,
  Phone,
  BookOpen,
  Award,
  LogOut,
  AlertCircle,
  GraduationCap,
  Briefcase,
  ShieldCheck,
} from 'lucide-react-native';

export const TeacherProfileScreen: React.FC = () => {
  const { logout } = useAuthStore();

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['teacher-profile'],
    queryFn: () => getTeacherProfileApi(),
  });

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Digital Guru Franchise Teacher portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Teacher Profile" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FE4D01" />
          <Text style={styles.loadingText}>Loading faculty profile...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !profile) {
    return (
      <ScreenContainer>
        <Header title="Teacher Profile" />
        <Card style={styles.errorCard}>
          <AlertCircle size={36} color={brandColors.error} />
          <Text style={styles.errorTitle}>Failed to Load Profile</Text>
          <Button title="Retry" onPress={() => refetch()} variant="outline" size="sm" />
        </Card>
      </ScreenContainer>
    );
  }

  const assignedBatches = profile.assignedBatches || [];
  const assignedSubjects = profile.assignedSubjects || [];

  return (
    <ScreenContainer>
      <Header title="Faculty Profile" subtitle="Account & Academic Credentials" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Identity Card */}
        <Card style={styles.identityCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.user.fullName ? profile.user.fullName[0] : 'T'}
              </Text>
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.fullName}>{profile.user.fullName}</Text>
              <Text style={styles.designation}>
                {profile.designation || 'Faculty Member / Instructor'}
              </Text>
              <View style={styles.codeRow}>
                <Badge
                  label={profile.employeeCode || 'FACULTY'}
                  variant="warning"
                  size="sm"
                />
                <Badge label="Active Teacher" variant="success" size="sm" />
              </View>
            </View>
          </View>
        </Card>

        {/* Institute Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Institute & Center</Text>
          <View style={styles.infoRow}>
            <Building size={16} color="#FE4D01" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Tuition Center</Text>
              <Text style={styles.infoValue}>{profile.institute.name}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <ShieldCheck size={16} color="#0A2540" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Center Code</Text>
              <Text style={styles.infoValue}>{profile.institute.code}</Text>
            </View>
          </View>
        </Card>

        {/* Contact Details */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact & Account</Text>
          {profile.user.email ? (
            <View style={styles.infoRow}>
              <Mail size={16} color="#64748B" />
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{profile.user.email}</Text>
              </View>
            </View>
          ) : null}

          {profile.user.phone ? (
            <View style={styles.infoRow}>
              <Phone size={16} color="#64748B" />
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{profile.user.phone}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Assigned Batches Summary */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Assigned Classes ({assignedBatches.length})</Text>
          {assignedBatches.length === 0 ? (
            <Text style={styles.emptyText}>No classes currently assigned.</Text>
          ) : (
            assignedBatches.map((b) => (
              <View key={b.id} style={styles.batchItemRow}>
                <View style={styles.batchLeft}>
                  <BookOpen size={16} color="#0A2540" />
                  <View>
                    <Text style={styles.batchName}>{b.name}</Text>
                    <Text style={styles.batchCode}>Code: {b.code}</Text>
                  </View>
                </View>
                <Badge label="Assigned" variant="neutral" size="sm" />
              </View>
            ))
          )}
        </Card>

        {/* Assigned Subjects Summary */}
        {assignedSubjects.length > 0 && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Subject Allocations ({assignedSubjects.length})</Text>
            {assignedSubjects.map((s, idx) => (
              <View key={idx} style={styles.batchItemRow}>
                <View style={styles.batchLeft}>
                  <GraduationCap size={16} color="#FE4D01" />
                  <View>
                    <Text style={styles.batchName}>{s.subjectName}</Text>
                    <Text style={styles.batchCode}>{s.batchName}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Sign Out Action */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Sign Out of Teacher Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  errorCard: {
    margin: 16,
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  identityCard: {
    padding: 16,
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0A2540',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FEDC32',
    fontSize: 22,
    fontWeight: '800',
  },
  identityInfo: {
    flex: 1,
  },
  fullName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  designation: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A2540',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 1,
  },
  batchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  batchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  batchCode: {
    fontSize: 12,
    color: '#64748B',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
});
