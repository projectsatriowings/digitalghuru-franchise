import React from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { brandColors, theme } from '../../theme';
import { AnimatedPressable } from './AnimatedPressable';

export interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'flat' | 'outline' | 'accent' | 'dark';
  accentColor?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  intensity?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  onPress,
  variant = 'elevated',
  accentColor,
  padding = 'lg',
  intensity = 25,
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
      case 'xl':
        return theme.spacing.xxl;
      case 'lg':
      default:
        return theme.spacing.lg;
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'dark':
        return 'rgba(15, 23, 42, 0.92)';
      case 'outline':
        return 'rgba(255, 255, 255, 0.6)';
      case 'flat':
        return 'rgba(248, 250, 252, 0.9)';
      case 'accent':
        return accentColor ? `${accentColor}0D` : 'rgba(0, 111, 255, 0.05)';
      case 'elevated':
      default:
        return 'rgba(255, 255, 255, 0.92)';
    }
  };

  const getBorderColor = () => {
    switch (variant) {
      case 'dark':
        return 'rgba(255, 255, 255, 0.15)';
      case 'accent':
        return accentColor ? `${accentColor}30` : 'rgba(0, 111, 255, 0.2)';
      case 'outline':
        return brandColors.border;
      case 'flat':
      case 'elevated':
      default:
        return 'rgba(255, 255, 255, 0.9)';
    }
  };

  const content = (
    <View
      style={[
        styles.card,
        {
          padding: getPadding(),
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
        variant === 'elevated' && theme.shadows.sm,
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={variant === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} scaleTo={0.98}>
        {content}
      </AnimatedPressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
