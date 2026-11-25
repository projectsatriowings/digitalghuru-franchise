import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { brandColors, theme } from '../../theme';
import { AnimatedPressable } from './AnimatedPressable';

export interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'glass' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  role?: 'STUDENT' | 'PARENT' | 'STAFF';
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  labelStyle,
  role = 'STUDENT',
}) => {
  const getRolePrimaryColor = () => {
    switch (role) {
      case 'STAFF':
        return brandColors.orange;
      case 'PARENT':
        return brandColors.navy;
      case 'STUDENT':
      default:
        return brandColors.blue;
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return brandColors.borderLight;
    switch (variant) {
      case 'secondary':
        return brandColors.gold;
      case 'accent':
        return getRolePrimaryColor();
      case 'danger':
        return brandColors.error;
      case 'glass':
        return 'rgba(255, 255, 255, 0.85)';
      case 'outline':
        return 'transparent';
      case 'primary':
      default:
        return getRolePrimaryColor();
    }
  };

  const getTextColor = () => {
    if (disabled) return brandColors.textMuted;
    switch (variant) {
      case 'secondary':
        return brandColors.navy;
      case 'glass':
      case 'outline':
        return getRolePrimaryColor();
      case 'danger':
      case 'accent':
      case 'primary':
      default:
        return brandColors.textWhite;
    }
  };

  const getBorderColor = () => {
    if (disabled) return brandColors.border;
    switch (variant) {
      case 'outline':
        return getRolePrimaryColor();
      case 'glass':
        return 'rgba(255, 255, 255, 0.9)';
      default:
        return 'transparent';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12, borderRadius: theme.radii.sm };
      case 'lg':
        return { paddingVertical: 14, paddingHorizontal: 20, borderRadius: theme.radii.lg };
      case 'md':
      default:
        return { paddingVertical: 11, paddingHorizontal: 16, borderRadius: theme.radii.md };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 12;
      case 'lg':
        return 16;
      case 'md':
      default:
        return 14;
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.97}
      style={[
        styles.button,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' || variant === 'glass' ? 1.5 : 0,
        },
        variant !== 'outline' && theme.shadows.sm,
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={getTextColor()}
            style={styles.spinner}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' ? (
              <View style={styles.iconLeft}>{icon}</View>
            ) : null}
            <Text
              style={[
                styles.label,
                {
                  color: getTextColor(),
                  fontSize: getFontSize(),
                },
                labelStyle,
              ]}
            >
              {label}
            </Text>
            {icon && iconPosition === 'right' ? (
              <View style={styles.iconRight}>{icon}</View>
            ) : null}
          </>
        )}
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  spinner: {
    paddingVertical: 2,
  },
});
