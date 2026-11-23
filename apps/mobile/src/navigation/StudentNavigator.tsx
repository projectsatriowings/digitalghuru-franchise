import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StudentDashboardScreen } from '../features/student/StudentDashboardScreen';
import { StudentTimetableScreen } from '../features/student/StudentTimetableScreen';
import { StudentHomeworkScreen } from '../features/student/StudentHomeworkScreen';
import { StudentMaterialsScreen } from '../features/student/StudentMaterialsScreen';
import { StudentAttendanceScreen } from '../features/student/StudentAttendanceScreen';
import { StudentProgressScreen } from '../features/student/StudentProgressScreen';
import { StudentNotificationsScreen } from '../features/student/StudentNotificationsScreen';
import { StudentProfileScreen } from '../features/student/StudentProfileScreen';
import { brandColors } from '../theme';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  BookOpen,
  User,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const StudentTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brandColors.blue,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="StudentDashboardTab"
        component={StudentDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="StudentTimetable"
        component={StudentTimetableScreen}
        options={{
          tabBarLabel: 'Timetable',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
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
        name="StudentProfileTab"
        component={StudentProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const StudentNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentTabs" component={StudentTabNavigator} />
      <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />
      <Stack.Screen name="StudentProgress" component={StudentProgressScreen} />
      <Stack.Screen name="StudentNotifications" component={StudentNotificationsScreen} />
    </Stack.Navigator>
  );
};
