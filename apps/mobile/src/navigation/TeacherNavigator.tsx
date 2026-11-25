import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TeacherDashboardScreen } from '../features/teacher/TeacherDashboardScreen';
import { TeacherBatchesScreen } from '../features/teacher/TeacherBatchesScreen';
import { TeacherStudentsScreen } from '../features/teacher/TeacherStudentsScreen';
import { TeacherStudentDetailsScreen } from '../features/teacher/TeacherStudentDetailsScreen';
import { TeacherAttendanceScreen } from '../features/teacher/TeacherAttendanceScreen';
import { VoiceAttendanceScreen } from '../features/teacher/VoiceAttendanceScreen';
import { TeacherHomeworkScreen } from '../features/teacher/TeacherHomeworkScreen';
import { CreateHomeworkScreen } from '../features/teacher/CreateHomeworkScreen';
import { HomeworkSubmissionsScreen } from '../features/teacher/HomeworkSubmissionsScreen';
import { EvaluateHomeworkScreen } from '../features/teacher/EvaluateHomeworkScreen';
import { TeacherMaterialsScreen } from '../features/teacher/TeacherMaterialsScreen';
import { UploadMaterialScreen } from '../features/teacher/UploadMaterialScreen';
import { TeacherProgressScreen } from '../features/teacher/TeacherProgressScreen';
import { TeacherTimetableScreen } from '../features/teacher/TeacherTimetableScreen';
import { TeacherNotificationsScreen } from '../features/teacher/TeacherNotificationsScreen';
import { TeacherProfileScreen } from '../features/teacher/TeacherProfileScreen';
import { brandColors } from '../theme';
import { AnimatedTabBar } from '../components/design-system';
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  Users,
  User,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TeacherTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} role="STAFF" />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="TeacherDashboard"
        component={TeacherDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeacherAttendance"
        component={TeacherAttendanceScreen}
        options={{
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeacherHomework"
        component={TeacherHomeworkScreen}
        options={{
          tabBarLabel: 'Homework',
          tabBarIcon: ({ color, size }) => (
            <FileText size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeacherStudents"
        component={TeacherStudentsScreen}
        options={{
          tabBarLabel: 'Students',
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeacherProfile"
        component={TeacherProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      {/* Sub-screens launched from Quick Services that retain the Floating Navigation Bar */}
      <Tab.Screen
        name="TeacherMaterials"
        component={TeacherMaterialsScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="TeacherProgress"
        component={TeacherProgressScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="TeacherBatches"
        component={TeacherBatchesScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="TeacherTimetable"
        component={TeacherTimetableScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
};

export const TeacherNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeacherTabs" component={TeacherTabNavigator} />
      <Stack.Screen name="TeacherStudentDetails" component={TeacherStudentDetailsScreen} />
      <Stack.Screen name="VoiceAttendance" component={VoiceAttendanceScreen} />
      <Stack.Screen name="CreateHomework" component={CreateHomeworkScreen} />
      <Stack.Screen name="HomeworkSubmissions" component={HomeworkSubmissionsScreen} />
      <Stack.Screen name="EvaluateHomework" component={EvaluateHomeworkScreen} />
      <Stack.Screen name="UploadMaterial" component={UploadMaterialScreen} />
      <Stack.Screen name="TeacherNotifications" component={TeacherNotificationsScreen} />
    </Stack.Navigator>
  );
};
