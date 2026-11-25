import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import Svg, {
  G,
  Path,
  Circle,
  Rect,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

export interface StudentAvatarProps {
  gender?: 'MALE' | 'FEMALE' | 'boy' | 'girl' | string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  animated?: boolean;
  style?: any;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  gender,
  name,
  size = 'md',
  animated = true,
  style,
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animated]);

  // Determine avatar size numeric value
  const getNumericSize = (): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'sm':
        return 36;
      case 'lg':
        return 64;
      case 'xl':
        return 88;
      case 'md':
      default:
        return 48;
    }
  };

  const dimension = getNumericSize();

  // Detect gender (Male vs Female)
  const isFemale = (): boolean => {
    if (gender) {
      const g = gender.toUpperCase();
      if (g === 'FEMALE' || g === 'GIRL' || g === 'F') return true;
      if (g === 'MALE' || g === 'BOY' || g === 'M') return false;
    }
    if (name) {
      const femaleNames = [
        'anita',
        'priya',
        'pOOja',
        'neha',
        'riya',
        'diya',
        'sneha',
        'kavya',
        'ananya',
        'aanya',
        'shreya',
        'aarti',
        'meera',
        'tanvi',
        'divya',
        'aditi',
        'swati',
        'isha',
      ];
      const lower = name.toLowerCase();
      if (femaleNames.some((fn) => lower.includes(fn))) return true;
    }
    return false;
  };

  const female = isFemale();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          transform: [{ translateY: animated ? floatAnim : 0 }],
        },
        style,
      ]}
    >
      <Svg
        width={dimension}
        height={dimension}
        viewBox="0 0 100 100"
        fill="none"
      >
        <Defs>
          {/* Background Gradient */}
          <LinearGradient id="boyBg" x1="0" y1="0" x2="100" y2="100">
            <Stop offset="0%" stopColor="#3B82F6" />
            <Stop offset="100%" stopColor="#1D4ED8" />
          </LinearGradient>
          <LinearGradient id="girlBg" x1="0" y1="0" x2="100" y2="100">
            <Stop offset="0%" stopColor="#EC4899" />
            <Stop offset="100%" stopColor="#BE185D" />
          </LinearGradient>
          <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="100">
            <Stop offset="0%" stopColor="#FFDFC4" />
            <Stop offset="100%" stopColor="#F0C3A0" />
          </LinearGradient>
        </Defs>

        {/* Outer Circle Container */}
        <Circle
          cx="50"
          cy="50"
          r="48"
          fill={female ? 'url(#girlBg)' : 'url(#boyBg)'}
          stroke="#FFFFFF"
          strokeWidth="3"
        />

        {female ? (
          /* ================= GIRL CARICATURE ================= */
          <G id="GirlCharacter">
            {/* Back Hair */}
            <Path
              d="M24 40 C 20 20, 80 20, 76 40 C 82 58, 80 75, 74 85 L 26 85 C 20 75, 18 58, 24 40 Z"
              fill="#2A1B12"
            />

            {/* Shoulders / School Blazer */}
            <Path
              d="M26 95 C 26 78, 74 78, 74 95 Z"
              fill="#BE185D"
            />
            <Path
              d="M42 80 L 50 92 L 58 80 Z"
              fill="#FFFFFF"
            />

            {/* Neck */}
            <Rect x="44" y="65" width="12" height="18" rx="4" fill="url(#skin)" />

            {/* Face */}
            <Ellipse cx="50" cy="52" rx="20" ry="22" fill="url(#skin)" />

            {/* Cute Cheeks */}
            <Circle cx="38" cy="58" r="4" fill="#F472B6" opacity="0.5" />
            <Circle cx="62" cy="58" r="4" fill="#F472B6" opacity="0.5" />

            {/* Eyes */}
            <Circle cx="42" cy="48" r="3.5" fill="#1E293B" />
            <Circle cx="58" cy="48" r="3.5" fill="#1E293B" />
            {/* Eye Highlights */}
            <Circle cx="43" cy="47" r="1.2" fill="#FFFFFF" />
            <Circle cx="59" cy="47" r="1.2" fill="#FFFFFF" />

            {/* Eyebrows */}
            <Path
              d="M37 42 Q 42 40 46 42"
              stroke="#2A1B12"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <Path
              d="M54 42 Q 58 40 63 42"
              stroke="#2A1B12"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Smile */}
            <Path
              d="M44 60 Q 50 66 56 60"
              stroke="#BE185D"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Front Bangs & Ponytail Bow */}
            <Path
              d="M30 38 C 35 25, 65 25, 70 38 C 62 32, 52 32, 50 38 C 48 32, 38 32, 30 38 Z"
              fill="#3B2314"
            />

            {/* Pink Ribbon Bow Accent */}
            <Circle cx="30" cy="30" r="5" fill="#F472B6" />
            <Circle cx="70" cy="30" r="5" fill="#F472B6" />
            <Path
              d="M26 28 L 34 32 L 26 32 Z"
              fill="#FB7185"
            />
            <Path
              d="M74 28 L 66 32 L 74 32 Z"
              fill="#FB7185"
            />
          </G>
        ) : (
          /* ================= BOY CARICATURE ================= */
          <G id="BoyCharacter">
            {/* Shoulders / Hoodie Collar */}
            <Path
              d="M24 95 C 24 76, 76 76, 76 95 Z"
              fill="#1E3A8A"
            />
            <Path
              d="M40 78 L 50 92 L 60 78 Z"
              fill="#FEDC32"
            />

            {/* Neck */}
            <Rect x="44" y="65" width="12" height="18" rx="4" fill="url(#skin)" />

            {/* Face */}
            <Ellipse cx="50" cy="52" rx="20" ry="22" fill="url(#skin)" />

            {/* Cool Ears */}
            <Circle cx="29" cy="54" r="4.5" fill="url(#skin)" />
            <Circle cx="71" cy="54" r="4.5" fill="url(#skin)" />

            {/* Eyes */}
            <Circle cx="41" cy="48" r="3.5" fill="#0F172A" />
            <Circle cx="59" cy="48" r="3.5" fill="#0F172A" />
            {/* Eye Highlights */}
            <Circle cx="42" cy="47" r="1.2" fill="#FFFFFF" />
            <Circle cx="60" cy="47" r="1.2" fill="#FFFFFF" />

            {/* Eyebrows */}
            <Path
              d="M36 41 Q 41 38 46 41"
              stroke="#1E293B"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <Path
              d="M54 41 Q 59 38 64 41"
              stroke="#1E293B"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Confident Smile */}
            <Path
              d="M43 60 Q 50 67 57 60"
              stroke="#1E3A8A"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Spiky Cool Hair */}
            <Path
              d="M28 42 C 26 28, 38 22, 50 20 C 62 22, 74 28, 72 42 C 68 32, 60 32, 58 36 C 54 28, 44 28, 42 36 C 38 32, 32 32, 28 42 Z"
              fill="#1E293B"
            />
            {/* Extra Spikes */}
            <Path
              d="M46 18 L 52 25 L 42 24 Z"
              fill="#1E293B"
            />
            <Path
              d="M36 22 L 42 27 L 34 27 Z"
              fill="#1E293B"
            />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
