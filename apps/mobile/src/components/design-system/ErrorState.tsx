import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { brandColors, theme } from '../../theme';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  style,
}) => {
  return (
    <GlassCard style={[styles.card, style]} padding="lg" variant="outline">
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.exclamation}>!</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {onRetry ? (
          <GlassButton
            label="Try Again"
            onPress={onRetry}
            size="sm"
            variant="outline"
            style={styles.retryBtn}
          />
        ) : null}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderColor: brandColors.errorBorder,
    backgroundColor: brandColors.errorBg,
    marginVertical: theme.spacing.sm,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  exclamation: {
    fontSize: 18,
    fontWeight: '800',
    color: brandColors.error,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: brandColors.textPrimary,
  },
  message: {
    fontSize: 12,
    color: brandColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 12,
  },
});
