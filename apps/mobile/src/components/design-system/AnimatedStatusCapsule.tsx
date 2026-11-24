import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors, theme } from '../../theme';

export interface AnimatedStatusCapsuleProps {
  visible: boolean;
  message: string;
  type?: 'loading' | 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  duration?: number;
  onDismiss?: () => void;
}

export const AnimatedStatusCapsule: React.FC<AnimatedStatusCapsuleProps> = ({
  visible,
  message,
  type = 'info',
  icon,
  duration = 3000,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top + (Platform.OS === 'android' ? 10 : 6),
          speed: 18,
          bounciness: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (type !== 'loading' && duration > 0) {
        const timer = setTimeout(() => {
          hide();
        }, duration);
        return () => clearTimeout(timer);
      }
    } else {
      hide();
    }
  }, [visible, insets.top]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return brandColors.deepNavy;
      case 'warning':
        return '#78350F';
      case 'error':
        return '#7F1D1D';
      case 'loading':
      case 'info':
      default:
        return brandColors.navy;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return brandColors.success;
      case 'warning':
        return brandColors.warning;
      case 'error':
        return brandColors.error;
      case 'loading':
      case 'info':
      default:
        return 'rgba(255, 255, 255, 0.2)';
    }
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
      ]}
    >
      <View style={styles.content}>
        {type === 'loading' ? (
          <ActivityIndicator size="small" color="#FFFFFF" style={styles.icon} />
        ) : icon ? (
          <View style={styles.icon}>{icon}</View>
        ) : null}
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    ...theme.shadows.lg,
    maxWidth: '90%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
