import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { brandColors, theme } from '../../theme';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  variant?: 'light' | 'dark' | 'card' | 'subtle';
  border?: boolean;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  intensity = 20,
  tint = 'default',
  variant = 'card',
  border = true,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'dark':
        return 'rgba(15, 23, 42, 0.85)';
      case 'subtle':
        return 'rgba(255, 255, 255, 0.65)';
      case 'light':
        return 'rgba(255, 255, 255, 0.95)';
      case 'card':
      default:
        return 'rgba(255, 255, 255, 0.88)';
    }
  };

  const getBorderColor = () => {
    if (!border) return 'transparent';
    switch (variant) {
      case 'dark':
        return 'rgba(255, 255, 255, 0.12)';
      case 'subtle':
        return 'rgba(226, 232, 240, 0.6)';
      case 'light':
      case 'card':
      default:
        return 'rgba(255, 255, 255, 0.8)';
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: border ? 1 : 0,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
});
