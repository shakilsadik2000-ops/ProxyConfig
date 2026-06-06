/**
 * Settings — connection, network and general preferences.
 *
 * Everything writes to MMKV immediately. Toggling the Kill Switch while
 * connected prompts for confirmation and restarts the tunnel so the change
 * takes effect (the flag is baked into the service at connect time).
 */
import React, {useState} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';

import ToggleRow from '../components/ToggleRow';
import {useVpnStatus} from '../hooks/useVpnStatus';
import {VpnBridge} from '../native/VpnBridge';
import {getSettings, updateSettings, getActiveProfileId} from '../store/settingsStore';
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

  const apply = (partial: Partial<AppSettings>) => {
    setSettings(updateSettings(partial));
  };

  // Restart the active tunnel so a settings change is applied immediately.
  const restartConnection = async () => {
    const id = getActiveProfileId();
    const profile = id ? await profileStore.getById(id) : null;
    if (!profile) return;
    try {
      await VpnBridge.disconnect();
      // Brief gap so the service tears down before re-establishing.
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Settings</Text>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Connection */}
        <Section title="Connection">
          <ToggleRow
            title="Kill Switch"
            description="Block all traffic if the proxy disconnects"
            value={settings.killSwitch}
            onValueChange={onKillSwitch}
          />
          <Divider />
          <ToggleRow
            title="Auto-Reconnect"
            description="Automatically retry when the proxy drops"
            value={settings.autoReconnect}
            onValueChange={v => apply({autoReconnect: v})}
          />
          {settings.autoReconnect && (
            <>
              <Divider />
              <Text style={styles.subLabel}>Reconnect Interval</Text>
              <OptionGroup
                options={[
                  {label: '5s', value: 5},
                  {label: '10s', value: 10},
                  {label: '30s', value: 30},
                ]}
                value={settings.reconnectIntervalSec}
                onChange={v => apply({reconnectIntervalSec: v as number})}
              />
            </>
          )}
        </Section>

        {/* Network */}
        <Section title="Network">
          <Text style={styles.subLabel}>DNS Server</Text>
          <OptionGroup
            options={[
              {label: 'Auto', value: 'auto'},
              {label: '8.8.8.8', value: '8.8.8.8'},
              {label: '1.1.1.1', value: '1.1.1.1'},
            ]}
            value={settings.dnsServer}
            onChange={v => apply({dnsServer: v as string})}
          />
          <Divider />
          <NavRow
            label="Split Tunneling"
            value={`${settings.splitTunneling.length} app${
              settings.splitTunneling.length === 1 ? '' : 's'
            } excluded`}
            onPress={() => navigation.navigate('SplitTunneling')}
          />
        </Section>

        {/* General */}
        <Section title="General">
          <Text style={styles.subLabel}>Language</Text>
          <OptionGroup
            options={[
              {label: 'English', value: 'en'},
              {label: 'বাংলা', value: 'bn'},
            ]}
            value={settings.language}
            onChange={v => {
              apply({language: v as 'en' | 'bn'});
              ToastAndroid.show('Language preference saved', ToastAndroid.SHORT);
            }}
          />
          <Divider />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>About</Text>
            <Text style={styles.aboutValue}>Proxy Config v{APP_VERSION}</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

interface Option {
  label: string;
  value: string | number;
}

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | number;
  onChange: (v: string | number) => void;
}): React.JSX.Element {
  return (
    <View style={styles.optionGroup}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[styles.option, active && styles.optionActive]}>
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress}>
      <Text style={styles.navLabel}>{label}</Text>
      <View style={styles.navRight}>
        <Text style={styles.navValue}>{value}</Text>
        <Icon name="chevron-right" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  body: {padding: spacing.md, paddingTop: 0},
  section: {marginBottom: spacing.lg},
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  divider: {height: 1, backgroundColor: colors.border},
  subLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  optionText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  optionTextActive: {color: colors.white},
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  navLabel: {fontSize: typography.sizes.md, color: colors.textPrimary},
  navRight: {flexDirection: 'row', alignItems: 'center'},
  navValue: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  aboutLabel: {fontSize: typography.sizes.md, color: colors.textPrimary},
  aboutValue: {fontSize: typography.sizes.sm, color: colors.textMuted},
});

export default SettingsScreen;
