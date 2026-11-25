import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StudentDashboardScreen } from '../features/student/StudentDashboardScreen';
import { StudentHomeworkScreen } from '../features/student/StudentHomeworkScreen';
import { StudentMaterialsScreen } from '../features/student/StudentMaterialsScreen';
import { StudentAttendanceScreen } from '../features/student/StudentAttendanceScreen';
import { StudentProgressScreen } from '../features/student/StudentProgressScreen';
import { StudentTimetableScreen } from '../features/student/StudentTimetableScreen';
import { StudentNotificationsScreen } from '../features/student/StudentNotificationsScreen';
import { StudentProfileScreen } from '../features/student/StudentProfileScreen';
import { brandColors } from '../theme';
import { AnimatedTabBar } from '../components/design-system';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  BookOpen,
  User,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const StudentTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} role="STUDENT" />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="StudentDashboard"
        component={StudentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="StudentAttendance"
        component={StudentAttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="StudentHomework"
        component={StudentHomeworkScreen}
        options={{
          tabBarLabel: 'Homework',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="StudentMaterials"
        component={StudentMaterialsScreen}
        options={{
          tabBarLabel: 'Materials',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="StudentProfile"
        component={StudentProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />

      {/* Sub-screens launched from Dashboard that retain the Floating Navigation Bar */}
      <Tab.Screen
        name="StudentProgress"
        component={StudentProgressScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="StudentTimetable"
        component={StudentTimetableScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

export const StudentNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentTabs" component={StudentTabNavigator} />
      <Stack.Screen name="StudentNotifications" component={StudentNotificationsScreen} />
    </Stack.Navigator>
  );
};
