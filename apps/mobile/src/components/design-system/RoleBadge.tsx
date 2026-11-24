import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { brandColors, theme } from '../../theme';

export interface RoleBadgeProps {
  role: 'STUDENT' | 'PARENT' | 'STAFF' | 'TEACHER' | 'ADMIN';
  label?: string;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  label,
  size = 'md',
  style,
}) => {
  const normalizedRole = role === 'TEACHER' ? 'STAFF' : role;

  const getBadgeConfig = () => {
    switch (normalizedRole) {
      case 'STUDENT':
        return {
          bg: '#EFF6FF',
          text: '#006FFF',
          border: '#BFDBFE',
          defaultLabel: 'Student',
        };
      case 'PARENT':
        return {
          bg: '#F1F5F9',
          text: '#0F172A',
          border: '#CBD5E1',
          defaultLabel: 'Parent',
        };
      case 'STAFF':
        return {
          bg: '#FFF7ED',
          text: '#FE4D01',
          border: '#FED7AA',
          defaultLabel: 'Teacher',
        };
      case 'ADMIN':
      default:
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          border: '#FDE68A',
          defaultLabel: 'Admin',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          paddingVertical: size === 'sm' ? 2 : 4,
          paddingHorizontal: size === 'sm' ? 6 : 10,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: config.text,
            fontSize: size === 'sm' ? 10 : 12,
          },
        ]}
      >
        {label || config.defaultLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
