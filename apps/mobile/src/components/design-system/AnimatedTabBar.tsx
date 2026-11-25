import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandColors } from '../../theme';

interface AnimatedTabBarCustomProps extends BottomTabBarProps {
  role?: 'STUDENT' | 'PARENT' | 'STAFF' | 'TEACHER';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const AnimatedTabBar: React.FC<AnimatedTabBarCustomProps> = ({
  state,
  descriptors,
  navigation,
  role = 'STUDENT',
}) => {
  const insets = useSafeAreaInsets();
  const normalizedRole = role === 'TEACHER' ? 'STAFF' : role;

  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH * 0.92);

  // Filter visible tabs (excluding hidden sub-screen tab routes)
  const visibleRoutes = state.routes.filter((route) => {
    const btn = descriptors[route.key].options.tabBarButton;
    if (btn === null) return false;
    if (typeof btn === 'function' && (btn as any)({}) === null) return false;
    return true;
  });

  const numTabs = visibleRoutes.length || 5;

  // Find index of current active route inside visibleRoutes
  const currentRouteKey = state.routes[state.index]?.key;
  let activeVisibleIndex = visibleRoutes.findIndex((r) => r.key === currentRouteKey);
  if (activeVisibleIndex === -1) {
    activeVisibleIndex = 0; // Fallback for hidden sub-screens
  }

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

  const tabWidth = containerWidth / numTabs;
  const targetX = (activeVisibleIndex + 0.5) * tabWidth;

  const notchXAnim = useRef(new Animated.Value(targetX)).current;

  useEffect(() => {
    Animated.spring(notchXAnim, {
      toValue: targetX,
      speed: 18,
      bounciness: 6,
      useNativeDriver: false,
    }).start();
  }, [activeVisibleIndex, targetX]);

  // Generate SVG path for the wave navbar with cutout notch at cx
  const createCurvedPath = (cx: number, w: number, h: number) => {
    const r = 24; // corner radius
    const notchWidth = 36;
    const notchDepth = 22;

    return `
      M 0,${r}
      Q 0,0 ${r},0
      L ${Math.max(r, cx - notchWidth)},0
      C ${cx - 20},0 ${cx - 16},${notchDepth} ${cx},${notchDepth}
      C ${cx + 16},${notchDepth} ${cx + 20},0 ${Math.min(w - r, cx + notchWidth)},0
      L ${w - r},0
      Q ${w},0 ${w},${r}
      L ${w},${h}
      L 0,${h}
      Z
    `;
  };

  const [pathString, setPathString] = useState(() =>
    createCurvedPath(targetX, containerWidth, 75)
  );

  useEffect(() => {
    const listener = notchXAnim.addListener(({ value }) => {
      setPathString(createCurvedPath(value, containerWidth, 75));
    });
    return () => notchXAnim.removeListener(listener);
  }, [containerWidth]);

  return (
    <View style={styles.outerContainer}>
      <View
        style={styles.floatingBarContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setContainerWidth(w);
        }}
      >
        {/* SVG Curved Wave Background */}
        <Svg
          width={containerWidth}
          height={75 + Math.max(insets.bottom, 10)}
          style={StyleSheet.absoluteFill}
        >
          <Path
            d={pathString}
            fill="#FFFFFF"
            stroke="#E2E8F0"
            strokeWidth="1"
          />
        </Svg>

        <View
          style={[
            styles.tabsRow,
            {
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          {visibleRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const isFocused = route.key === currentRouteKey;

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
  const translateYAnim = useRef(new Animated.Value(isFocused ? -16 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1.05 : 1,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: isFocused ? -16 : 0,
        speed: 20,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused]);

  const IconComponent = options.tabBarIcon;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      hitSlop={{ top: 10, bottom: 8, left: 4, right: 4 }}
    >
      <View style={styles.itemWrapper}>
        <Animated.View
          style={[
            isFocused ? styles.activeIconCircle : styles.inactiveIconWrap,
            isFocused && { backgroundColor: activeColor, shadowColor: activeColor },
            {
              transform: [
                { translateY: translateYAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {IconComponent ? (
            <IconComponent
              focused={isFocused}
              color={isFocused ? '#FFFFFF' : '#64748B'}
              size={isFocused ? 22 : 20}
            />
          ) : null}
        </Animated.View>

        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : '#64748B',
              fontWeight: isFocused ? '800' : '600',
              marginTop: isFocused ? -8 : 4,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
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
  floatingBarContainer: {
    width: '92%',
    maxWidth: 440,
    height: 75,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  inactiveIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
  },
});
