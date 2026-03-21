import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createMaterialTopTabNavigator, MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Create a custom layout using Material Top Tabs for swipeability
const { Navigator } = createMaterialTopTabNavigator();
export const MaterialTopTabs = withLayoutContext<MaterialTopTabNavigationOptions, typeof Navigator>(Navigator);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarIndicatorStyle: {
          backgroundColor: "#4f46e5",
          height: 3,
          top: 0,
        },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#f0f0f0",
          height: 64 + (insets.bottom > 0 ? insets.bottom : 8),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          // Support for shadow on Android/iOS
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
            android: {
              elevation: 4,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          textTransform: "none",
        },
        swipeEnabled: true,
        // Ensure headers are shown as in the previous layout
        headerShown: true,
        headerStyle: {
          backgroundColor: "#fff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "700",
          color: "#1a1a2e",
        },
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Scan QR',
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color }) => (
            <Ionicons name="qr-code" size={20} color={color} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={20} color={color} />
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={20} color={color} />
          ),
        }}
      />
    </MaterialTopTabs>
  );
}
