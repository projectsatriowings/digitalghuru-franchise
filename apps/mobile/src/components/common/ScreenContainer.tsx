import React from 'react';
import {
  StyleSheet,
  View,
  ViewStyle,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { brandColors } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  backgroundColor = brandColors.background,
}) => {
  const insets = useSafeAreaInsets();
  // On modern Android punch-hole devices (like Samsung Galaxy), status bar height is typically 36-48dp.
  // We use Math.max across insets.top, RNStatusBar.currentHeight, and a 38dp floor on Android to prevent overlay.
  const statusBarHeight = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 38) : 0;
  const topPadding = Math.max(insets.top, statusBarHeight);

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: topPadding }]}>
      <StatusBar style="dark" backgroundColor={backgroundColor} />
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
});
