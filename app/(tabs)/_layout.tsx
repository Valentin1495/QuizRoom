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
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='home' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='analysis'
        options={{
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='stats-chart' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='challenges'
        options={{
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='trophy' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='stats'
        options={{
          tabBarIcon: ({ size, color }) => (
            <Ionicons name='person' size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
