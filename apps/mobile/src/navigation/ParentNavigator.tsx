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
        name="ParentDashboardTab"
        component={ParentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentAttendanceTab"
        component={ParentAttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentAcademicsTab"
        component={ParentAcademicsScreen}
        options={{
          tabBarLabel: 'Academics',
          tabBarIcon: ({ color, size }) => (
            <Award size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentFeesTab"
        component={ParentFeesScreen}
        options={{
          tabBarLabel: 'Fees',
          tabBarIcon: ({ color, size }) => (
            <CreditCard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ParentProfileTab"
        component={ParentProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const ParentNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
      <Stack.Screen name="ParentAttendance" component={ParentAttendanceScreen} />
      <Stack.Screen name="ParentAcademics" component={ParentAcademicsScreen} />
      <Stack.Screen name="ParentHomework" component={ParentHomeworkScreen} />
      <Stack.Screen name="ParentTimetable" component={ParentTimetableScreen} />
      <Stack.Screen name="ParentMaterials" component={ParentMaterialsScreen} />
      <Stack.Screen name="ParentFees" component={ParentFeesScreen} />
      <Stack.Screen name="ParentFeedback" component={ParentFeedbackScreen} />
      <Stack.Screen name="ParentNotifications" component={ParentNotificationsScreen} />
      <Stack.Screen name="ParentProfile" component={ParentProfileScreen} />
    </Stack.Navigator>
  );
};
