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
        <Text style={styles.splashTitle}>DIGITAL GHURU</Text>
        <Text style={styles.splashSubtitle}>Learning Enterprise</Text>
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
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 84,
    height: 84,
    marginBottom: 16,
  },
  splashTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  splashSubtitle: {
    color: '#FEDC32',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  splashSpinner: {
    marginTop: 24,
  },
});
