import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { brandColors, theme } from '../../theme';

export interface BadgeProps {
  text?: string;
  label?: string;
  variant?: 'student' | 'parent' | 'teacher' | 'success' | 'warning' | 'info' | 'error' | 'neutral';
  size?: 'sm' | 'md' | 'lg' | string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  label,
  variant = 'info',
  size = 'md',
  style,
  textStyle,
}) => {
  const getBadgeColors = () => {
    switch (variant) {
      case 'student':
        return { bg: '#DBEAFE', text: '#1D4ED8' };
      case 'parent':
        return { bg: '#E2E8F0', text: '#0F172A' };
      case 'teacher':
        return { bg: '#FFEDD5', text: '#C2410C' };
      case 'success':
        return { bg: brandColors.successBg, text: brandColors.success };
      case 'warning':
        return { bg: brandColors.warningBg, text: brandColors.warning };
      case 'error':
        return { bg: brandColors.errorBg, text: brandColors.error };
      case 'neutral':
        return { bg: brandColors.surfaceMuted, text: brandColors.textSecondary };
      case 'info':
      default:
        return { bg: brandColors.infoBg, text: brandColors.info };
    }
  };

  const colors = getBadgeColors();
  const isSm = size === 'sm';
  const displayText = label || text || '';

  return (
    <View
      style={[
        styles.badge,
        isSm && styles.badgeSm,
        { backgroundColor: colors.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          isSm && styles.badgeTextSm,
          { color: colors.text },
          textStyle,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badgeTextSm: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
