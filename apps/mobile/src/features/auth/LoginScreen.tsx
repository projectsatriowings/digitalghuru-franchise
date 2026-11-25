import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  TextInput,
  ActivityIndicator,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors, theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/auth';
import { ShieldAlert, Eye, EyeOff, ArrowRight } from 'lucide-react-native';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const topSafePadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0) + 12;
  const bottomSafePadding = Math.max(insets.bottom, 20);

  const { login, loginDemo, isLoading, error, clearError } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('STUDENT');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleFillDemo = (role: UserRole) => {
    setSelectedRole(role);
    setIdentifierError(null);
    setPasswordError(null);
    clearError();

    if (role === 'STUDENT') {
      setIdentifier('student@apexacademy.com');
      setPassword('Password#123');
    } else if (role === 'PARENT') {
      setIdentifier('parent@apexacademy.com');
      setPassword('Password#123');
    } else if (role === 'STAFF') {
      setIdentifier('teacher@apexacademy.com');
      setPassword('Password#123');
    }
  };

  const validate = (): boolean => {
    let isValid = true;
    setIdentifierError(null);
    setPasswordError(null);
    clearError();

    if (!identifier.trim()) {
      setIdentifierError('Please enter your email or identifier.');
      isValid = false;
    }
    if (!password) {
      setPasswordError('Please enter your password.');
      isValid = false;
    }
    return isValid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      const id = identifier.trim().toLowerCase();
      if (id.includes('student@apex') || id.includes('student')) {
        await loginDemo('STUDENT');
      } else if (id.includes('parent@apex') || id.includes('parent')) {
        await loginDemo('PARENT');
      } else if (id.includes('teacher@apex') || id.includes('teacher')) {
        await loginDemo('STAFF');
      } else {
        await login({
          identifier: identifier.trim(),
          password,
          role: selectedRole,
        });
      }
    } catch {
      // Managed in authStore.error
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <RNStatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand Hero Banner with Background Image */}
        <ImageBackground
          source={require('../../../assets/splash.png')}
          style={[styles.heroBanner, { paddingTop: topSafePadding }]}
          imageStyle={styles.heroBackgroundImage}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>DIGITAL GHURU</Text>
          <View style={styles.taglineBadge}>
            <Text style={styles.brandSubtitle}>Learning Enterprise</Text>
          </View>
        </ImageBackground>

        {/* Bottom Login Sheet Card */}
        <View style={[styles.loginSheet, { paddingBottom: bottomSafePadding + 16 }]}>
          {/* Top Sheet Drag Handle Indicator */}
          <View style={styles.handleBar} />

          <Text style={styles.sheetTitle}>Sign In</Text>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <ShieldAlert size={18} color={brandColors.error} style={styles.errorIcon} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Email / Identifier Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL OR IDENTIFIER</Text>
            <TextInput
              style={[
                styles.textInput,
                identifierError ? styles.textInputError : null,
              ]}
              placeholder="e.g. student@apex.com or A210001"
              placeholderTextColor="#94A3B8"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                if (identifierError) setIdentifierError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {identifierError && (
              <Text style={styles.fieldErrorText}>{identifierError}</Text>
            )}
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View
              style={[
                styles.passwordInputContainer,
                passwordError ? styles.textInputError : null,
              ]}
            >
              <TextInput
                style={styles.passwordTextInput}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError(null);
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#64748B" />
                ) : (
                  <Eye size={20} color="#64748B" />
                )}
              </TouchableOpacity>
            </View>
            {passwordError && (
              <Text style={styles.fieldErrorText}>{passwordError}</Text>
            )}
          </View>

          {/* Submit Sign In Button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.signInBtnContent}>
                <Text style={styles.signInButtonText}>Sign In</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Quick Demo Autofill Buttons */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>1-TAP DEMO AUTOFILL</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  selectedRole === 'STUDENT' && identifier.includes('student')
                    ? { borderColor: '#006FFF', backgroundColor: '#EFF6FF' }
                    : { borderColor: '#CBD5E1' },
                ]}
                onPress={() => handleFillDemo('STUDENT')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.demoBtnText,
                    { color: selectedRole === 'STUDENT' && identifier.includes('student') ? '#006FFF' : '#475569' },
                  ]}
                >
                  Student Demo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  selectedRole === 'PARENT' && identifier.includes('parent')
                    ? { borderColor: '#0F172A', backgroundColor: '#F1F5F9' }
                    : { borderColor: '#CBD5E1' },
                ]}
                onPress={() => handleFillDemo('PARENT')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.demoBtnText,
                    { color: selectedRole === 'PARENT' && identifier.includes('parent') ? '#0F172A' : '#475569' },
                  ]}
                >
                  Parent Demo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  selectedRole === 'STAFF' && identifier.includes('teacher')
                    ? { borderColor: '#FE4D01', backgroundColor: '#FFF7ED' }
                    : { borderColor: '#CBD5E1' },
                ]}
                onPress={() => handleFillDemo('STAFF')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.demoBtnText,
                    { color: selectedRole === 'STAFF' && identifier.includes('teacher') ? '#FE4D01' : '#475569' },
                  ]}
                >
                  Teacher Demo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
  },
  heroBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 32,
    flex: 1,
    minHeight: 210,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBackgroundImage: {
    opacity: 0.25,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  logoImage: {
    width: 68,
    height: 68,
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  taglineBadge: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(254, 220, 50, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 220, 50, 0.25)',
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FEDC32',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  loginSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: theme.spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: brandColors.errorBg,
    borderColor: brandColors.errorBorder,
    borderWidth: 1,
    borderRadius: 12,
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
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  textInputError: {
    borderColor: brandColors.error,
  },
  fieldErrorText: {
    fontSize: 12,
    color: brandColors.error,
    marginTop: 4,
  },
  signInButton: {
    backgroundColor: '#006FFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
    shadowColor: '#006FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  signInBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  demoLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
