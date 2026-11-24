import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { brandColors, theme } from '../../theme';
import { GlassCard } from './GlassCard';

export interface DashboardStatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  trend?: 'up' | 'down' | 'neutral';
}

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  iconBgColor = '#EFF6FF',
  onPress,
  style,
}) => {
  return (
    <GlassCard
      onPress={onPress}
      style={[styles.card, style]}
      padding="md"
      variant="elevated"
    >
      <View style={styles.topRow}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
            {icon}
          </View>
        ) : null}
      </View>
      <Text style={styles.valueText} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.labelText} numberOfLines={1}>
        {label}
      </Text>
      {subtext ? (
        <Text style={styles.subtext} numberOfLines={1}>
          {subtext}
        </Text>
      ) : null}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
  },
  topRow: {
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 20,
    fontWeight: '800',
    color: brandColors.textPrimary,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: brandColors.textSecondary,
    marginTop: 2,
  },
  subtext: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 2,
  },
});
