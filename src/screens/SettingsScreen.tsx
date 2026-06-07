/**
 * Settings — connection, network and general preferences (Stitch redesign).
 *
 * Grouped white cards with icon-chip rows, blue section headers, inline value
 * pickers, and an informational highlight card. All changes persist to MMKV.
 * Toggling Kill Switch while connected restarts the tunnel.
 */
import React, {useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';

import SettingRow from '../components/SettingRow';
import {useVpnStatus} from '../hooks/useVpnStatus';
import {VpnBridge} from '../native/VpnBridge';
import {
  getSettings,
  updateSettings,
  getActiveProfileId,
} from '../store/settingsStore';
import {profileStore} from '../store/profileStore';
import {AppSettings} from '../types';
import {SettingsStackParamList} from '../navigation/AppNavigator';
import {colors, radius, spacing, typography} from '../theme/tokens';

type Nav = NativeStackNavigationProp<SettingsStackParamList, 'SettingsHome'>;

const APP_VERSION = '1.0.0';

function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {status} = useVpnStatus();
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  const apply = (partial: Partial<AppSettings>) =>
    setSettings(updateSettings(partial));

  const restartConnection = async () => {
    const id = getActiveProfileId();
    const profile = id ? await profileStore.getById(id) : null;
    if (!profile) return;
    try {
      await VpnBridge.disconnect();
      setTimeout(() => {
        VpnBridge.connect(profile, getSettings()).catch(() => {});
      }, 800);
    } catch {
      /* no-op */
    }
  };

  const onKillSwitch = (next: boolean) => {
    if (status === 'connected') {
      Alert.alert(
        'Restart connection?',
        'Changing the Kill Switch will reconnect the active tunnel.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Restart',
            onPress: () => {
              apply({killSwitch: next});
              restartConnection();
            },
          },
        ],
      );
    } else {
      apply({killSwitch: next});
    }
  };

  const cycle = <T,>(value: T, options: T[]): T =>
    options[(options.indexOf(value) + 1) % options.length];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Network security */}
        <Text style={styles.section}>NETWORK SECURITY</Text>
        <View style={styles.card}>
          <SettingRow
            icon="shield"
            title="Kill Switch"
            subtitle="Block internet if proxy connection drops."
            right={
              <Switch
                value={settings.killSwitch}
                onValueChange={onKillSwitch}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={colors.white}
              />
            }
          />
          <Divider />
          <SettingRow
            icon="refresh-cw"
            title="Auto-Reconnect"
            subtitle="Attempt to restore connection automatically."
            right={
              <Switch
                value={settings.autoReconnect}
                onValueChange={v => apply({autoReconnect: v})}
                trackColor={{false: colors.border, true: colors.primary}}
                thumbColor={colors.white}
              />
            }
          />
          {settings.autoReconnect && (
            <>
              <Divider />
              <SettingRow
                icon="clock"
                title="Reconnect Interval"
                subtitle="Delay between retry attempts."
                onPress={() =>
                  apply({
                    reconnectIntervalSec: cycle(
                      settings.reconnectIntervalSec,
                      [5, 10, 30],
                    ),
                  })
                }
                right={<Value text={`${settings.reconnectIntervalSec}s`} />}
              />
            </>
          )}
        </View>

        {/* Advanced */}
        <Text style={styles.section}>ADVANCED CONFIGURATION</Text>
        <View style={styles.card}>
          <SettingRow
            icon="git-branch"
            title="Split Tunneling"
            subtitle="Choose which apps bypass the proxy."
            onPress={() => navigation.navigate('SplitTunneling')}
            right={
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
            }
          />
          <Divider />
          <SettingRow
            icon="server"
            title="DNS Server"
            subtitle="Configure DNS resolution provider."
            onPress={() =>
              apply({
                dnsServer: cycle(settings.dnsServer, [
                  'auto',
                  '8.8.8.8',
                  '1.1.1.1',
                ]),
              })
            }
            right={
              <Value
                text={settings.dnsServer === 'auto' ? 'Auto' : settings.dnsServer}
              />
            }
          />
        </View>

        {/* General */}
        <Text style={styles.section}>GENERAL</Text>
        <View style={styles.card}>
          <SettingRow
            icon="globe"
            title="App Language"
            subtitle="Default system language applied."
            onPress={() => {
              apply({language: settings.language === 'en' ? 'bn' : 'en'});
              ToastAndroid.show('Language preference saved', ToastAndroid.SHORT);
            }}
            right={<Value text={settings.language === 'en' ? 'English' : 'বাংলা'} />}
          />
          <Divider />
          <SettingRow
            icon="info"
            title="App Version"
            subtitle={`v${APP_VERSION} (Build 2026)`}
            right={
              <View style={styles.badge}>
                <Text style={styles.badgeText}>STABLE</Text>
              </View>
            }
          />
        </View>

        {/* Highlight card */}
        <View style={styles.highlight}>
          <Icon name="check-circle" size={22} color={colors.white} />
          <Text style={styles.highlightTitle}>Your connection is optimized</Text>
          <Text style={styles.highlightText}>
            Settings are saved instantly and applied to the active profile on the
            next connection.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function Value({text}: {text: string}): React.JSX.Element {
  return (
    <View style={styles.value}>
      <Text style={styles.valueText}>{text}</Text>
      <Icon name="chevron-down" size={16} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: spacing.md, height: 56, justifyContent: 'center'},
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {padding: spacing.md, paddingTop: 0},
  section: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: {height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md},
  value: {flexDirection: 'row', alignItems: 'center', gap: 4},
  valueText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.sizes.sm,
    marginRight: 4,
  },
  badge: {
    backgroundColor: colors.connectedContainer,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: colors.connectedOn,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  highlight: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  highlightTitle: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  highlightText: {
    color: '#D4DCFF',
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
});

export default SettingsScreen;
