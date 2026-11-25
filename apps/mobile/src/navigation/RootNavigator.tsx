import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { StudentNavigator } from './StudentNavigator';
import { ParentNavigator } from './ParentNavigator';
import { TeacherNavigator } from './TeacherNavigator';
import { navigationRef } from './navigationRef';
import { initNotificationListeners } from '../services/pushNotificationService';
import { brandColors, theme } from '../theme';

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isRestoringSession, activeRole, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const unsubscribe = initNotificationListeners();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Branded Splash / Session Restoration Screen
  if (isRestoringSession) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTitle}>DIGITAL GURU</Text>
        <ActivityIndicator
          size="small"
          color={brandColors.gold}
          style={styles.splashSpinner}
        />
      </View>
    );
  }

  const renderRoleNavigator = () => {
    switch (activeRole) {
      case 'STUDENT':
        return <StudentNavigator />;
      case 'PARENT':
        return <ParentNavigator />;
      case 'STAFF':
      case 'ACADEMIC_ADMIN':
      case 'BRANCH_ADMIN':
      case 'FRANCHISE_OWNER':
      case 'SUPER_ADMIN':
        return <TeacherNavigator />;
      default:
        return <StudentNavigator />;
    }
  };

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? renderRoleNavigator() : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: brandColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 200,
    height: 70,
    marginBottom: theme.spacing.md,
  },
  splashBadge: {
    width: 68,
    height: 68,
    borderRadius: theme.radii.lg,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: brandColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  splashBadgeText: {
    color: brandColors.gold,
    fontWeight: '800',
    fontSize: 30,
    letterSpacing: 1,
  },
  splashTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  splashSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  splashSpinner: {
    marginTop: theme.spacing.xl,
  },
});
