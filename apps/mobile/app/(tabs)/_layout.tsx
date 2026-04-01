import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4f46e5",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#f0f0f0",
          height: 64 + (insets.bottom > 0 ? insets.bottom : 8),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
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
        },
        headerStyle: {
          backgroundColor: "#fff",
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: "700",
          color: "#1a1a2e",
        },
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan QR',
          headerTitle: 'Mark Attendance',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerTitle: 'Attendance History',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/tickets')}
              style={{ marginRight: 14, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#eef2ff', borderRadius: 999 }}
            >
              <Text style={{ color: '#4f46e5', fontSize: 12, fontWeight: '700' }}>Your Tickets</Text>
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Your Tickets',
          headerTitle: 'Your Tickets',
          href: null,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace('/history')}
              style={{ marginLeft: 12, padding: 6 }}
            >
              <Ionicons name="arrow-back" size={22} color="#1a1a2e" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
