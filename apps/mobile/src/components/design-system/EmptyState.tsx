import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { brandColors, theme } from '../../theme';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onActionPress,
  style,
}) => {
  return (
    <GlassCard style={[styles.container, style]} padding="xl" variant="flat">
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onActionPress ? (
        <GlassButton
          label={actionLabel}
          onPress={onActionPress}
          size="sm"
          variant="outline"
          style={styles.actionBtn}
        />
      ) : null}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    marginVertical: theme.spacing.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: brandColors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: brandColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  actionBtn: {
    marginTop: 16,
  },
});
