import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { Colors, Fonts, resolveThemeMode } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home',
  'members/index': 'people',
  'stories/index': 'chatbubbles',
  'gallery/index': 'images',
  'account/index': 'person-circle',
  'account/profile': 'person-circle',
};

export default function MemberTabsLayout() {
  const colors = Colors[resolveThemeMode(useColorScheme())];

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          backgroundColor: colors.surface,
          borderTopColor: 'transparent',
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 28,
          height: 78,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: colors.text,
          shadowOpacity: 0.08,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.rounded,
          fontSize: 11,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            name={tabIcons[route.name] ?? 'ellipse'}
            color={color}
            size={focused ? size + 2 : size}
          />
        ),
      })}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="members/index" options={{ title: 'Members' }} />
      <Tabs.Screen name="stories/index" options={{ title: 'Stories' }} />
      <Tabs.Screen name="gallery/index" options={{ title: 'Gallery' }} />
      <Tabs.Screen name="account/index" options={{ title: 'My Profile' }} />
      <Tabs.Screen name="account/profile" options={{ href: null }} />
    </Tabs>
  );
}
