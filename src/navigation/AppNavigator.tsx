/**
 * App navigation: a bottom tab bar with two tabs (Profiles, Settings) wrapping
 * their own native stacks so they can push detail screens.
 *
 *   Home Tab      → HomeScreen
 *   Profiles Tab  → ProfileListScreen → AddEditProfileScreen
 *   Stats Tab     → StatsScreen
 *   Settings Tab  → SettingsScreen → SplitTunnelingScreen
 */
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';

import HomeScreen from '../screens/HomeScreen';
import ProfileListScreen from '../screens/ProfileListScreen';
import AddEditProfileScreen from '../screens/AddEditProfileScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplitTunnelingScreen from '../screens/SplitTunnelingScreen';
import {colors, typography} from '../theme/tokens';

export type ProfilesStackParamList = {
  ProfileList: undefined;
  AddEditProfile: {profileId?: string} | undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  SplitTunneling: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Profiles: undefined;
  Stats: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const ProfilesStack = createNativeStackNavigator<ProfilesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

const screenHeader = {
  headerStyle: {backgroundColor: colors.background},
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
  },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
};

function ProfilesNavigator(): React.JSX.Element {
  return (
    <ProfilesStack.Navigator screenOptions={screenHeader}>
      <ProfilesStack.Screen
        name="ProfileList"
        component={ProfileListScreen}
        options={{title: 'Profiles'}}
      />
      <ProfilesStack.Screen
        name="AddEditProfile"
        component={AddEditProfileScreen}
        options={({route}) => ({
          title: route.params?.profileId ? 'Edit Profile' : 'Add Profile',
        })}
      />
    </ProfilesStack.Navigator>
  );
}

function SettingsNavigator(): React.JSX.Element {
  return (
    <SettingsStack.Navigator screenOptions={screenHeader}>
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{headerShown: false}}
      />
      <SettingsStack.Screen
        name="SplitTunneling"
        component={SplitTunnelingScreen}
        options={{title: 'Split Tunneling'}}
      />
    </SettingsStack.Navigator>
  );
}

const ICONS: Record<keyof RootTabParamList, string> = {
  Home: 'home',
  Profiles: 'list',
  Stats: 'bar-chart-2',
  Settings: 'settings',
};

function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarIcon: ({color, size}) => (
            <Icon name={ICONS[route.name]} size={size} color={color} />
          ),
        })}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen
          name="Profiles"
          component={ProfilesNavigator}
          options={{title: 'Profiles'}}
        />
        <Tab.Screen name="Stats" component={StatsScreen} />
        <Tab.Screen
          name="Settings"
          component={SettingsNavigator}
          options={{title: 'Settings'}}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
