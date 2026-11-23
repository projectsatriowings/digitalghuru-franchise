import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
        <View style={styles.splashBadge}>
          <Text style={styles.splashBadgeText}>DG</Text>
        </View>
        <Text style={styles.splashTitle}>DIGITAL GURU</Text>
        <Text style={styles.splashSubtitle}>Franchise & Learning Enterprise</Text>
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
