import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { brandColors, roleThemes, theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { UserRole } from '../../types/auth';
import {
  GraduationCap,
  Users,
  Briefcase,
  Phone,
  Mail,
  ShieldAlert,
  Lock,
  User,
  Sparkles,
  Zap,
} from 'lucide-react-native';

const ROLE_OPTIONS: Array<{ role: UserRole; label: string; icon: any; color: string }> = [
  { role: 'STUDENT', label: 'Student', icon: GraduationCap, color: brandColors.blue },
  { role: 'PARENT', label: 'Parent', icon: Users, color: brandColors.navy },
  { role: 'STAFF', label: 'Teacher', icon: Briefcase, color: brandColors.orange },
];

const DEMO_PERSONAS = [
  {
    role: 'STUDENT' as UserRole,
    roleLabel: 'Student Demo',
    name: 'Aarav Mehta',
    identifier: 'student@apexacademy.com',
    password: 'Password#123',
    badge: 'Grade 10',
    color: brandColors.blue,
  },
  {
    role: 'PARENT' as UserRole,
    roleLabel: 'Parent Demo',
    name: 'Vikram Mehta',
    identifier: 'parent@apexacademy.com',
    password: 'Password#123',
    badge: 'Linked Parent',
    color: brandColors.navy,
  },
  {
    role: 'STAFF' as UserRole,
    roleLabel: 'Teacher Demo',
    name: 'Prof. Anita Verma',
    identifier: 'teacher@apexacademy.com',
    password: 'Password#123',
    badge: 'Physics Lecturer',
    color: brandColors.orange,
  },
];

export const LoginScreen: React.FC = () => {
  const { login, loginDemo, isLoading, error, clearError } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('STUDENT');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleFillDemo = (persona: (typeof DEMO_PERSONAS)[0]) => {
    setSelectedRole(persona.role);
    setIdentifier(persona.identifier);
    setPassword(persona.password);
    setIdentifierError(null);
    setPasswordError(null);
    clearError();
  };

  const validate = (): boolean => {
    let isValid = true;
    setIdentifierError(null);
    setPasswordError(null);
    clearError();

    if (!identifier.trim()) {
      setIdentifierError('Please enter your Email, Phone, or Admission No.');
      isValid = false;
    }
    if (!password) {
      setPasswordError('Please enter your account password.');
      isValid = false;
    }
    return isValid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      await login({
        identifier: identifier.trim(),
        password,
        role: selectedRole,
      });
    } catch {
      // Error state is caught and exposed in Zustand authStore.error
    }
  };

  const handleSupportCall = () => {
    Linking.openURL('tel:+918825948859').catch(() => { });
  };

  const handleSupportEmail = () => {
    Linking.openURL('mailto:contact@digitalghuru.com').catch(() => { });
  };

  const activeTheme = roleThemes[selectedRole as 'STUDENT' | 'PARENT' | 'STAFF'] || roleThemes.STUDENT;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Banner */}
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>DIGITAL GURU</Text>
          <Text style={styles.brandSubtitle}>Franchise & Learning Enterprise</Text>
        </View>

        {/* Role Selector Pills */}
        <View style={styles.roleSelectorContainer}>
          <Text style={styles.roleSelectorLabel}>I AM LOGGING IN AS:</Text>
          <View style={styles.rolePillsRow}>
            {ROLE_OPTIONS.map((opt) => {
              const isSelected = selectedRole === opt.role;
              const IconComp = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.role}
                  activeOpacity={0.8}
                  style={[
                    styles.rolePill,
                    isSelected ? { backgroundColor: opt.color, borderColor: opt.color } : null,
                  ]}
                  onPress={() => {
                    setSelectedRole(opt.role);
                    clearError();
                  }}
                >
                  <IconComp
                    size={16}
                    color={isSelected ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.rolePillText,
                      isSelected ? styles.rolePillTextSelected : null,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Login Form Card */}
        <Card style={styles.loginCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>{activeTheme.roleName} Login</Text>
              <Text style={styles.cardHeaderTagline}>{activeTheme.tagline}</Text>
            </View>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <ShieldAlert size={18} color={brandColors.error} style={styles.errorIcon} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Form Fields */}
          <Input
            label="Email, Phone, or Admission No."
            placeholder={
              selectedRole === 'STUDENT'
                ? 'e.g. student@apex.com or A210001'
                : selectedRole === 'PARENT'
                  ? 'e.g. parent@apex.com or 9876543210'
                  : 'e.g. teacher@apex.com'
            }
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (identifierError) setIdentifierError(null);
            }}
            error={identifierError}
            leftIcon={<User size={18} color="#94A3B8" />}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Account Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(null);
            }}
            error={passwordError}
            secureTextEntry
            leftIcon={<Lock size={18} color="#94A3B8" />}
          />

          {/* Submit Button */}
          <Button
            title={`Log in as ${activeTheme.roleName}`}
            onPress={handleLogin}
            roleTheme={selectedRole as 'STUDENT' | 'PARENT' | 'STAFF'}
            isLoading={isLoading}
            style={styles.submitButton}
          />
        </Card>

        {/* Demo Credentials Card */}
        <Card style={styles.demoCard}>
          <View style={styles.demoHeaderRow}>
            <View style={styles.demoHeaderTitleRow}>
              <Sparkles size={16} color={brandColors.gold} />
              <Text style={styles.demoHeaderTitle}>DEMO & REVIEW CREDENTIALS</Text>
            </View>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>1-TAP AUTOFILL</Text>
            </View>
          </View>
          <Text style={styles.demoSubtitle}>
            Tap any persona below to auto-fill verified test credentials:
          </Text>

          <View style={styles.demoGrid}>
            {DEMO_PERSONAS.map((item) => {
              const isSelected = selectedRole === item.role && identifier === item.identifier;
              return (
                <TouchableOpacity
                  key={item.role}
                  activeOpacity={0.7}
                  style={[
                    styles.demoItem,
                    isSelected ? { borderColor: item.color, backgroundColor: `${item.color}0D` } : null,
                  ]}
                  onPress={() => handleFillDemo(item)}
                >
                  <View style={styles.demoItemTop}>
                    <Text style={[styles.demoItemRole, { color: item.color }]}>{item.roleLabel}</Text>
                    <View style={[styles.demoItemBadge, { backgroundColor: `${item.color}18` }]}>
                      <Text style={[styles.demoItemBadgeText, { color: item.color }]}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.demoItemName}>{item.name}</Text>
                  <Text style={styles.demoItemEmail}>{item.identifier}</Text>
                  <Text style={styles.demoItemPass}>Password: {item.password}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.instantDemoBtn, { backgroundColor: activeTheme.primary }]}
            onPress={() => loginDemo(selectedRole)}
          >
            <Zap size={15} color="#FFFFFF" />
            <Text style={styles.instantDemoBtnText}>
              Instant 1-Tap Demo ({activeTheme.roleName})
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Campus Support & Credential Policy Notice */}
        <View style={styles.supportContainer}>
          <Text style={styles.supportTitle}>Need Help Signing In?</Text>
          <Text style={styles.supportNotice}>
            Student and Parent credentials are managed directly by your authorized campus center. For password resets or account issues, please contact your center office.
          </Text>

          <View style={styles.supportActionsRow}>
            <TouchableOpacity
              style={styles.supportActionPill}
              onPress={handleSupportCall}
              activeOpacity={0.7}
            >
              <Phone size={14} color={brandColors.blue} />
              <Text style={styles.supportActionText}>+91 8825948859</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.supportActionPill}
              onPress={handleSupportEmail}
              activeOpacity={0.7}
            >
              <Mail size={14} color={brandColors.blue} />
              <Text style={styles.supportActionText}>Contact Center</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoImage: {
    width: 220,
    height: 64,
    marginBottom: theme.spacing.sm,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.lg,
    backgroundColor: brandColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  logoBadgeText: {
    color: brandColors.gold,
    fontWeight: '800',
    fontSize: 26,
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: brandColors.navy,
  },
  brandSubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  roleSelectorContainer: {
    marginBottom: theme.spacing.lg,
  },
  roleSelectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#64748B',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  rolePillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: theme.radii.md,
    gap: 6,
    ...theme.shadows.sm,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  rolePillTextSelected: {
    color: '#FFFFFF',
  },
  loginCard: {
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  cardHeaderRow: {
    marginBottom: theme.spacing.lg,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  cardHeaderTagline: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brandColors.errorBg,
    borderColor: brandColors.errorBorder,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: brandColors.error,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: theme.spacing.sm,
  },
  demoCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  demoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  demoHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: brandColors.navy,
    letterSpacing: 0.8,
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  demoSubtitle: {
    fontSize: 12,
    color: brandColors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  demoGrid: {
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  demoItem: {
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  demoItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  demoItemRole: {
    fontSize: 13,
    fontWeight: '700',
  },
  demoItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
  },
  demoItemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  demoItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
  },
  demoItemEmail: {
    fontSize: 12,
    color: brandColors.textSecondary,
    marginTop: 1,
  },
  demoItemPass: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 3,
  },
  instantDemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    marginTop: 4,
  },
  instantDemoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  supportContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: brandColors.textPrimary,
    marginBottom: 4,
  },
  supportNotice: {
    fontSize: 12,
    color: brandColors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  supportActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  supportActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  supportActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textPrimary,
  },
});
