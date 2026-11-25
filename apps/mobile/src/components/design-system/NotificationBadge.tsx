import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { brandColors, theme } from '../../theme';

export interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: 'sm' | 'md';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  style,
  color = brandColors.error,
  size = 'md',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.3,
          speed: 40,
          bounciness: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          speed: 30,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [count]);

  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : `${count}`;

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: color,
          height: size === 'sm' ? 16 : 20,
          minWidth: size === 'sm' ? 16 : 20,
          borderRadius: theme.radii.full,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            fontSize: size === 'sm' ? 9 : 11,
          },
        ]}
      >
        {displayCount}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
});
