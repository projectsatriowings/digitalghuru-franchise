import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { brandColors, theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { LogOut, ArrowLeft } from 'lucide-react-native';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showLogout?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showLogout = true,
  showBack = false,
  onBack,
  rightElement,
}) => {
  const navigation = useNavigation<any>();
  const { activeInstitute, logout, activeRole } = useAuthStore();

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const getRoleBadgeColor = () => {
    switch (activeRole) {
      case 'STUDENT':
        return '#006FFF';
      case 'PARENT':
        return '#0F172A';
      case 'STAFF':
        return '#FE4D01';
      default:
        return brandColors.blue;
    }
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.brandingRow}>
        <View style={styles.brandingLeft}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color={brandColors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>DG</Text>
          </View>
          <View style={styles.titleColumn}>
            <Text style={styles.appName}>DIGITAL GURU</Text>
            <Text style={styles.instituteText}>
              {activeInstitute?.name || 'Franchise Platform'}
            </Text>
          </View>
        </View>
        {rightElement ? (
          rightElement
        ) : showLogout ? (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <LogOut size={18} color="#64748B" />
          </TouchableOpacity>
        ) : null}
      </View>

      {(title || subtitle) && (
        <View style={styles.pageTitleRow}>
          {title && <Text style={styles.pageTitle}>{title}</Text>}
          {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 10,
    padding: 2,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    backgroundColor: brandColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: brandColors.gold,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  titleColumn: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  appName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: brandColors.navy,
  },
  instituteText: {
    fontSize: 13,
    fontWeight: '500',
    color: brandColors.textSecondary,
  },
  logoutButton: {
    padding: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: '#F8FAFC',
  },
  pageTitleRow: {
    marginTop: theme.spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 2,
  },
});
