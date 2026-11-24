import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors, theme } from '../../theme';

interface AnimatedTabBarCustomProps extends BottomTabBarProps {
  role?: 'STUDENT' | 'PARENT' | 'STAFF' | 'TEACHER';
}

export const AnimatedTabBar: React.FC<AnimatedTabBarCustomProps> = ({
  state,
  descriptors,
  navigation,
  role = 'STUDENT',
}) => {
  const insets = useSafeAreaInsets();
  const normalizedRole = role === 'TEACHER' ? 'STAFF' : role;

  const getRoleAccentColor = () => {
    switch (normalizedRole) {
      case 'STAFF':
        return brandColors.orange;
      case 'PARENT':
        return brandColors.navy;
      case 'STUDENT':
      default:
        return brandColors.blue;
    }
  };

  const activeColor = getRoleAccentColor();

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.floatingBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              options={options}
              label={typeof label === 'string' ? label : route.name}
              activeColor={activeColor}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
};

interface TabItemProps {
  isFocused: boolean;
  options: any;
  label: string;
  activeColor: string;
  onPress: () => void;
  onLongPress: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  isFocused,
  options,
  label,
  activeColor,
  onPress,
  onLongPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.08 : 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const IconComponent = options.tabBarIcon;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.tabContent,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {isFocused ? (
          <View
            style={[
              styles.activeIndicatorPill,
              { backgroundColor: `${activeColor}18` },
            ]}
          />
        ) : null}

        {IconComponent ? (
          <IconComponent
            focused={isFocused}
            color={isFocused ? activeColor : brandColors.textMuted}
            size={22}
          />
        ) : null}

        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : brandColors.textMuted,
              fontWeight: isFocused ? '700' : '500',
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '92%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: theme.radii.full,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    ...theme.shadows.lg,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeIndicatorPill: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: -4,
    right: -4,
    borderRadius: theme.radii.full,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
  },
});
