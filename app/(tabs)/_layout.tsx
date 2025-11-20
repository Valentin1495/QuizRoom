import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: isIOS ? { marginTop: 4 } : undefined,
        tabBarStyle: isAndroid ? { height: 84, paddingBottom: 28 } : undefined,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: '홈',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'house.fill' : 'house'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title: '스와이프',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={28}
              name={focused ? 'square.stack.3d.up.fill' : 'square.stack.3d.up'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="live-match"
        options={{
          title: '라이브 매치',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={isIOS ? 36 : 28}
              name={focused ? 'person.3.fill' : 'person.3'}
              color={color}
              style={isIOS ? { marginBottom: -4 } : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={28}
              name={focused ? 'person.crop.circle.fill' : 'person.crop.circle'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
