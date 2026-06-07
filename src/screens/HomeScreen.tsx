/**
 * Home — the connect/disconnect hub (Stitch redesign).
 *
 * Reads the active profile, reflects live VPN status, shows uptime + egress IP
 * in bento cards, and drives the Connect / Disconnect action. Empty state when
 * no profile is configured.
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
import {clockString} from '../utils/format';
import {colors, protocolPill, radius, spacing, typography} from '../theme/tokens';

function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const {status, connectedSince, lastError} = useVpnStatus();
  const stats = useConnectionStats(status, connectedSince);

  const [profile, setProfile] = useState<ProxyProfile | null>(null);
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    if (status !== 'connected') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [status]);

  useEffect(() => {
    if (lastError) ToastAndroid.show(lastError, ToastAndroid.LONG);
  }, [lastError]);

  const settings = getSettings();
  const connected = status === 'connected';
  const uptime =
    connected && connectedSince ? clockString(now - connectedSince) : '00:00:00';

  const onToggle = async () => {
    if (connected) {
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

  const pill = profile ? protocolPill(profile.protocol) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <Icon name="shield" size={22} color={colors.primary} />
          <Text style={styles.appName}>Proxy Config</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          hitSlop={12}>
          <Icon name="user" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!profile ? (
          <View style={styles.empty}>
            <Icon name="inbox" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No profile selected</Text>
            <Text style={styles.emptyText}>Add a proxy profile to get started.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Profiles')}>
              <Text style={styles.emptyBtnText}>Go to Profiles</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statusSection}>
              <StatusIndicator status={status} />
              <Text style={[styles.timer, !connected && {opacity: 0}]}>
                {uptime}
              </Text>
            </View>

            {/* Active profile card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ACTIVE PROFILE</Text>
              <View style={styles.cardRow}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Icon name="server" size={20} color={colors.primary} />
              </View>
            </View>

            {/* Proxy interface card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>PROXY INTERFACE</Text>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Current IP</Text>
                <Text style={styles.ipPill}>
                  {connected ? stats.currentIp : '—'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Protocol</Text>
                <Text style={[styles.protocol, {color: pill!.fg}]}>
                  {profile.protocol}
                </Text>
              </View>
            </View>

            {settings.killSwitch && (
              <View style={styles.killBadge}>
                <Icon name="shield" size={14} color={colors.danger} />
                <Text style={styles.killText}>Kill Switch ON</Text>
              </View>
            )}

            <View style={styles.btnWrap}>
              <ConnectionButton status={status} onPress={onToggle} />
              <Text style={styles.btnHint}>
                Securing connection via encrypted tunnel
              </Text>
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
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  appName: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  body: {paddingHorizontal: spacing.md, paddingBottom: spacing.xl},
  statusSection: {alignItems: 'center', paddingVertical: spacing.xl},
  timer: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kvKey: {fontSize: typography.sizes.md, color: colors.textPrimary},
  ipPill: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  protocol: {fontSize: typography.sizes.sm, fontWeight: '600'},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  killBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: '#FFDAD6',
  },
  killText: {
    marginLeft: spacing.xs,
    color: colors.danger,
    fontWeight: '700',
    fontSize: typography.sizes.sm,
  },
  btnWrap: {marginTop: spacing.lg},
  btnHint: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  empty: {alignItems: 'center', justifyContent: 'center', paddingTop: 100},
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
    borderRadius: radius.md,
  },
  emptyBtnText: {color: colors.white, fontWeight: '700'},
});

export default HomeScreen;
