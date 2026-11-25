import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { brandColors, theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { ConfirmDialog } from '../design-system/ConfirmDialog';
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
  const { logout } = useAuthStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  return (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {showBack && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={22} color={brandColors.textPrimary} />
              </TouchableOpacity>
            )}
            {(title || subtitle) && (
              <View style={styles.titleColumn}>
                {title && <Text style={styles.pageTitle}>{title}</Text>}
                {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
              </View>
            )}
          </View>

          {rightElement ? (
            rightElement
          ) : showLogout ? (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setShowLogoutConfirm(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Logout"
            >
              <LogOut size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Modern Custom Logout Confirmation Dialog */}
      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of Digital Ghuru?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.md,
  },
  backButton: {
    marginRight: 12,
    padding: 2,
  },
  titleColumn: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 13,
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
    borderRadius: theme.radii.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
});
