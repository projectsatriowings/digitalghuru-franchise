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
import { StudentAvatar } from '../../components/student/StudentAvatar';
import { ConfirmDialog } from '../../components/design-system/ConfirmDialog';
import { useAuthStore } from '../../store/authStore';
import { brandColors, theme } from '../../theme';
import { getStudentProfileApi } from '../../api/student.api';
import {
  GraduationCap,
  Building,
  Users,
  LogOut,
  AlertCircle,
  BookOpen,
} from 'lucide-react-native';

export const StudentProfileScreen: React.FC = () => {
  const { logout } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['student-profile'],
    queryFn: getStudentProfileApi,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <Header title="Student Profile" subtitle="Loading profile details..." />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={brandColors.blue} />
          <Text style={styles.loadingText}>Loading profile details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !profile) {
    return (
      <ScreenContainer>
        <Header title="Student Profile" subtitle="Student account" />
        <View style={styles.centerContainer}>
          <AlertCircle size={48} color={brandColors.error} />
          <Text style={styles.errorTitle}>Unable to Load Profile</Text>
          <Text style={styles.errorSubtitle}>
            Failed to retrieve your student information. Tap retry to reload.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const primaryEnrollment = profile.enrollments?.[0];
  const activeBatch = primaryEnrollment?.batch;
  const parentRel = profile.parentRelations?.[0];

  return (
    <ScreenContainer>
      <Header
        title="Student Profile"
        subtitle={profile.admissionNumber || 'Account Information'}
      />

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
        {/* Animated Character Profile Hero Card */}
        <Card style={styles.profileHeroCard}>
          <StudentAvatar
            gender={profile.gender}
            name={profile.fullName || profile.firstName}
            size="xl"
            style={styles.avatarWrapper}
          />
          <Text style={styles.studentName}>
            {profile.fullName || `${profile.firstName} ${profile.lastName}`}
          </Text>
          <Text style={styles.admissionNum}>
            Admission No: {profile.admissionNumber}
          </Text>
          <View style={styles.badgeRow}>
            <Badge text={profile.status || 'ACTIVE'} variant="success" />
            <Badge text="Student Account" variant="student" />
          </View>
        </Card>

        {/* Academic Allocation */}
        <View style={styles.sectionHeader}>
          <GraduationCap size={18} color={brandColors.blue} />
          <Text style={styles.sectionTitle}>Academic Allocation</Text>
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assigned Batch</Text>
            <Text style={styles.infoValue}>{activeBatch?.name || 'Class Allocation Pending'}</Text>
          </View>
          {activeBatch?.code && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Batch Code</Text>
              <Text style={styles.infoValue}>{activeBatch.code}</Text>
            </View>
          )}
          {profile.admissionDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Admission Date</Text>
              <Text style={styles.infoValue}>
                {new Date(profile.admissionDate).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* Enrolled Subjects */}
          {activeBatch?.batchSubjects && activeBatch.batchSubjects.length > 0 && (
            <View style={styles.subjectsBlock}>
              <Text style={styles.subHeading}>Enrolled Subjects</Text>
              <View style={styles.subjectPillsRow}>
                {activeBatch.batchSubjects.map((bs, idx) => (
                  <View key={idx} style={styles.subjectPill}>
                    <BookOpen size={12} color={brandColors.blue} />
                    <Text style={styles.subjectPillText}>
                      {bs.subject.name}
                      {bs.staffProfile?.user?.fullName ? ` (${bs.staffProfile.user.fullName})` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Institute Campus Details */}
        <View style={styles.sectionHeader}>
          <Building size={18} color={brandColors.blue} />
          <Text style={styles.sectionTitle}>Campus Branch</Text>
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Center Name</Text>
            <Text style={styles.infoValue}>{profile.institute?.name || 'Digital Guru Learning Center'}</Text>
          </View>
          {profile.institute?.code && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Branch Code</Text>
              <Text style={styles.infoValue}>{profile.institute.code}</Text>
            </View>
          )}
          {profile.institute?.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Campus Helpdesk</Text>
              <Text style={styles.infoValue}>{profile.institute.phone}</Text>
            </View>
          )}
          {profile.institute?.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{profile.institute.address}</Text>
            </View>
          )}
        </Card>

        {/* Linked Parent Information */}
        {parentRel && (
          <>
            <View style={styles.sectionHeader}>
              <Users size={18} color={brandColors.blue} />
              <Text style={styles.sectionTitle}>Parent / Guardian</Text>
            </View>

            <Card style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Parent Name</Text>
                <Text style={styles.infoValue}>{parentRel.parent.user.fullName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Relationship</Text>
                <Text style={styles.infoValue}>{parentRel.relationshipType || 'Parent'}</Text>
              </View>
              {parentRel.parent.user.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Contact Phone</Text>
                  <Text style={styles.infoValue}>{parentRel.parent.user.phone}</Text>
                </View>
              )}
            </Card>
          </>
        )}

        {/* Logout Action */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setShowLogoutConfirm(true)}
            activeOpacity={0.8}
          >
            <LogOut size={18} color={brandColors.error} />
            <Text style={styles.logoutBtnText}>Log Out of Student Account</Text>
          </TouchableOpacity>
        </View>

        {/* Modern Red Badge Logout Dialog */}
        <ConfirmDialog
          visible={showLogoutConfirm}
          title="Sign Out"
          message="Are you sure you want to sign out of your Digital Ghuru student account?"
          confirmLabel="Log Out"
          cancelLabel="Cancel"
          destructive={true}
          onConfirm={handleConfirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      </ScrollView>
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
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  profileHeroCard: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    marginBottom: theme.spacing.md,
  },
  avatarWrapper: {
    marginBottom: theme.spacing.sm,
  },
  studentName: {
    fontSize: 20,
    fontWeight: '800',
    color: brandColors.textPrimary,
    marginBottom: 2,
  },
  admissionNum: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  infoCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: brandColors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  subjectsBlock: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  subHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textMuted,
    marginBottom: 6,
  },
  subjectPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectPillText: {
    fontSize: 11,
    color: brandColors.blue,
    fontWeight: '600',
  },
  logoutContainer: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
  },
  logoutBtnText: {
    color: brandColors.error,
    fontSize: 14,
    fontWeight: '700',
  },
});
