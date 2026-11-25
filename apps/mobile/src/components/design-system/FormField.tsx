import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import { brandColors, theme } from '../../theme';

export interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  userRole?: 'STUDENT' | 'PARENT' | 'STAFF';
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  userRole = 'STUDENT',
  onFocus,
  onBlur,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getFocusBorderColor = () => {
    if (error) return brandColors.error;
    switch (userRole) {
      case 'STAFF':
        return brandColors.orange;
      case 'PARENT':
        return brandColors.navy;
      case 'STUDENT':
      default:
        return brandColors.blue;
    }
  };

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: isFocused
              ? getFocusBorderColor()
              : error
              ? brandColors.errorBorder
              : brandColors.border,
            borderWidth: isFocused ? 1.5 : 1,
            backgroundColor: isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)',
          },
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={brandColors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIcon}
          >
            {rightIcon}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: brandColors.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    minHeight: 46,
    ...theme.shadows.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: brandColors.textPrimary,
    paddingVertical: 10,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
    padding: 4,
  },
  errorText: {
    fontSize: 11,
    color: brandColors.error,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 11,
    color: brandColors.textMuted,
    marginTop: 4,
  },
});
