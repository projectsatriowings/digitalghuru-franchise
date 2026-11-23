import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { brandColors, theme } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  roleTheme?: 'STUDENT' | 'PARENT' | 'STAFF';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  roleTheme,
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#CBD5E1';
    if (roleTheme) {
      return theme.roles[roleTheme].primary;
    }
    switch (variant) {
      case 'primary':
        return brandColors.blue;
      case 'secondary':
        return brandColors.navy;
      case 'danger':
        return brandColors.error;
      case 'outline':
        return 'transparent';
      default:
        return brandColors.blue;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#64748B';
    if (variant === 'outline') {
      return roleTheme ? theme.roles[roleTheme].primary : brandColors.blue;
    }
    return '#FFFFFF';
  };

  const isOutline = variant === 'outline';
  const borderColor = roleTheme ? theme.roles[roleTheme].primary : brandColors.blue;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderWidth: isOutline ? 1.5 : 0,
          borderColor: isOutline ? borderColor : 'transparent',
        },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor() }, icon ? styles.textWithIcon : null, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textWithIcon: {
    marginLeft: theme.spacing.sm,
  },
});
