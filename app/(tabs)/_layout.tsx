import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tabIconSelected,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors.light.background,
          height: 90,
          borderTopWidth: 0,
          paddingTop: 5,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='home' size={size} color={color} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name='quiz'
        options={{
          title: 'Quiz',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='extension-puzzle' size={size} color={color} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name='progress'
        options={{
          title: 'Progress',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='stats-chart' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='settings'
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='settings' size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
