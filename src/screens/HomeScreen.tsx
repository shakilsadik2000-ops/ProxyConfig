/**
 * Home — the connect/disconnect hub.
 *
 * Reads the active profile (AsyncStorage + MMKV), reflects live VPN status from
 * the native service, shows uptime + current egress IP, and drives the
 * Connect / Disconnect action. Falls back to an empty state when no profile is
 * configured.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';

import StatusIndicator from '../components/StatusIndicator';
import ConnectionButton from '../components/ConnectionButton';
import {useVpnStatus} from '../hooks/useVpnStatus';
import {useConnectionStats} from '../hooks/useConnectionStats';
import {VpnBridge} from '../native/VpnBridge';
import {profileStore} from '../store/profileStore';
import {getActiveProfileId, getSettings} from '../store/settingsStore';
import {ProxyProfile} from '../types';
import {colors, radius, spacing, typography} from '../theme/tokens';
import {fmtUptime} from '../utils/format';

function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {status, connectedSince, lastError} = useVpnStatus();
  const stats = useConnectionStats(status, connectedSince);

  const [profile, setProfile] = useState<ProxyProfile | null>(null);
  const [now, setNow] = useState(Date.now());

  // Reload the active profile whenever Home regains focus.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const id = getActiveProfileId();
        const p = id ? await profileStore.getById(id) : null;
        if (alive) setProfile(p);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  // 1s ticker for the uptime counter (only meaningful while connected).
  useEffect(() => {
    if (status !== 'connected') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [status]);

  // Surface native errors (e.g. kill switch blocking) as a toast.
  useEffect(() => {
    if (lastError) ToastAndroid.show(lastError, ToastAndroid.LONG);
  }, [lastError]);

  const settings = getSettings();
  const uptime =
    status === 'connected' && connectedSince
      ? fmtUptime(now - connectedSince)
      : '—';

  const onToggle = async () => {
    if (status === 'connected') {
      try {
        await VpnBridge.disconnect();
      } catch (e: any) {
        ToastAndroid.show(e?.message ?? 'Disconnect failed', ToastAndroid.SHORT);
      }
      return;
    }
    if (!profile) {
      ToastAndroid.show('Add a profile to get started', ToastAndroid.SHORT);
      navigation.navigate('Profiles');
      return;
    }
    try {
      await VpnBridge.connect(profile, settings);
    } catch (e: any) {
      ToastAndroid.show(e?.message ?? 'Connection failed', ToastAndroid.LONG);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <Text style={styles.appName}>Proxy Config</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          hitSlop={12}>
          <Icon name="settings" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!profile ? (
          <View style={styles.empty}>
            <Icon name="inbox" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No profile selected</Text>
            <Text style={styles.emptyText}>
              Add a proxy profile to get started.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Profiles')}>
              <Text style={styles.emptyBtnText}>Go to Profiles</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.indicatorWrap}>
              <StatusIndicator status={status} />
            </View>

            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.ip}>
              IP:{' '}
              {status === 'connected' ? stats.currentIp : '—'}
            </Text>

            <View style={styles.uptimeWrap}>
              <Text style={styles.uptimeLabel}>Uptime</Text>
              <Text style={styles.uptime}>{uptime}</Text>
            </View>

            {settings.killSwitch && (
              <View style={styles.killBadge}>
                <Icon name="shield" size={14} color={colors.danger} />
                <Text style={styles.killText}>Kill Switch ON</Text>
              </View>
            )}

            <View style={styles.btnWrap}>
              <ConnectionButton status={status} onPress={onToggle} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  appName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  indicatorWrap: {marginTop: spacing.xl},
  profileName: {
    marginTop: spacing.xl,
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ip: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  uptimeWrap: {alignItems: 'center', marginTop: spacing.lg},
  uptimeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  uptime: {
    marginTop: 2,
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  killBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: '#FEE2E2',
  },
  killText: {
    marginLeft: spacing.xs,
    color: colors.danger,
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  btnWrap: {width: '100%', marginTop: spacing.xl},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80},
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  emptyBtnText: {color: colors.white, fontWeight: '700'},
});

export default HomeScreen;
