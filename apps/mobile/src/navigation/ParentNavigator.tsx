import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ParentDashboardScreen } from '../features/parent/ParentDashboardScreen';
import { ParentAttendanceScreen } from '../features/parent/ParentAttendanceScreen';
import { ParentAcademicsScreen } from '../features/parent/ParentAcademicsScreen';
import { ParentHomeworkScreen } from '../features/parent/ParentHomeworkScreen';
import { ParentTimetableScreen } from '../features/parent/ParentTimetableScreen';
import { ParentMaterialsScreen } from '../features/parent/ParentMaterialsScreen';
import { ParentFeesScreen } from '../features/parent/ParentFeesScreen';
import { ParentFeedbackScreen } from '../features/parent/ParentFeedbackScreen';
import { ParentNotificationsScreen } from '../features/parent/ParentNotificationsScreen';
import { ParentProfileScreen } from '../features/parent/ParentProfileScreen';
import { brandColors } from '../theme';
import { AnimatedTabBar } from '../components/design-system';
import {
  LayoutDashboard,
  CalendarCheck,
  Award,
  CreditCard,
  User,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ParentTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} role="PARENT" />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ParentDashboard"
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentAttendance"
        component={ParentAttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentAcademics"
        component={ParentAcademicsScreen}
        options={{
          tabBarLabel: 'Academics',
          tabBarIcon: ({ color, size }) => (
            <Award size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentFees"
        component={ParentFeesScreen}
        options={{
          tabBarLabel: 'Fees',
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentProfile"
        component={ParentProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      {/* Sub-screens launched from Quick Services that retain the Floating Navigation Bar */}
      <Tab.Screen
        name="ParentHomework"
        component={ParentHomeworkScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="ParentMaterials"
        component={ParentMaterialsScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="ParentFeedback"
        component={ParentFeedbackScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="ParentTimetable"
        component={ParentTimetableScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

export const ParentNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
      <Stack.Screen name="ParentNotifications" component={ParentNotificationsScreen} />
    </Stack.Navigator>
  );
};
