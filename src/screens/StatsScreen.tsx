/**
 * Statistics — live connection metrics (Stitch redesign).
 *
 * Session state header, a 2×2 metric card grid, a Network Identity card, and
 * two Security Switch cards. All values stream from the native service; "—"
 * when disconnected.
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
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';

import {useVpnStatus} from '../hooks/useVpnStatus';
import {useConnectionStats} from '../hooks/useConnectionStats';
import {VpnBridge} from '../native/VpnBridge';
import {profileStore} from '../store/profileStore';
import {getActiveProfileId, getSettings} from '../store/settingsStore';
import {ProxyProfile} from '../types';
import {colors, radius, spacing, typography} from '../theme/tokens';
import {clockString, fmtBytes} from '../utils/format';

function StatsScreen(): React.JSX.Element {
  const {status, connectedSince} = useVpnStatus();
  const stats = useConnectionStats(status, connectedSince);
  const [now, setNow] = useState(Date.now());
  const [profile, setProfile] = useState<ProxyProfile | null>(null);
  const settings = getSettings();
  const connected = status === 'connected';

  useFocusEffect(
    useCallback(() => {
      const id = getActiveProfileId();
      if (id) profileStore.getById(id).then(setProfile);
    }, []),
  );

  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [connected]);

  const sent = fmtBytes(stats.bytesSent);
  const recv = fmtBytes(stats.bytesReceived);
  const since = connectedSince
    ? new Date(connectedSince).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const runDnsLeakTest = async () => {
    if (!connected) {
      ToastAndroid.show('Connect first to run the test', ToastAndroid.SHORT);
      return;
    }
    try {
      const res = await VpnBridge.getCurrentStats();
      ToastAndroid.show(
        res.dnsLeakSafe ? 'No DNS leak detected ✓' : 'Possible DNS leak ✗',
        ToastAndroid.LONG,
      );
    } catch {
      ToastAndroid.show('Test failed', ToastAndroid.SHORT);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
        <TouchableOpacity onPress={runDnsLeakTest} hitSlop={12}>
          <Icon name="refresh-cw" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Session state */}
        <Text style={styles.section}>SESSION STATE</Text>
        <View style={styles.stateRow}>
          <View
            style={[
              styles.stateDot,
              {backgroundColor: connected ? colors.connected : colors.disconnected},
            ]}
          />
          <Text
            style={[
              styles.stateText,
              {color: connected ? colors.connected : colors.disconnected},
            ]}>
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </Text>
        </View>
        {connected && <Text style={styles.since}>Since {since}</Text>}

        {/* Metric grid */}
        <View style={styles.grid}>
          <Metric
            label="Connected Duration"
            value={
              connected && connectedSince
                ? clockString(now - connectedSince)
                : '—'
            }
            big
          />
          <Metric
            label="Ping Latency"
            value={connected ? `${stats.pingMs}` : '—'}
            unit={connected ? 'ms' : ''}
          />
          <Metric
            label="Data Sent"
            value={connected ? sent.value : '—'}
            unit={connected ? sent.unit : ''}
          />
          <Metric
            label="Data Received"
            value={connected ? recv.value : '—'}
            unit={connected ? recv.unit : ''}
          />
        </View>

        {/* Network identity */}
        <Text style={styles.section}>NETWORK IDENTITY</Text>
        <View style={styles.card}>
          <KV label="Current Virtual IP">
            <Text style={styles.ipPill}>{connected ? stats.currentIp : '—'}</Text>
          </KV>
          <View style={styles.divider} />
          <KV label="Server Host">
            <Text style={styles.kvVal} numberOfLines={1}>
              {profile ? profile.host : '—'}
            </Text>
          </KV>
          <View style={styles.divider} />
          <KV label="Tunnel">
            <Text style={[styles.kvVal, {color: colors.connected, fontWeight: '700'}]}>
              {profile ? profile.protocol : '—'}
            </Text>
          </KV>
        </View>

        {/* Security switches */}
        <Text style={styles.section}>SECURITY</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchCard}>
            <Icon name="shield" size={20} color={colors.textSecondary} />
            <Text style={styles.switchTitle}>Kill Switch</Text>
            <Text
              style={[
                styles.switchVal,
                {color: settings.killSwitch ? colors.connected : colors.textMuted},
              ]}>
              {settings.killSwitch ? 'ACTIVE' : 'OFF'}
            </Text>
          </View>
          <View style={styles.switchCard}>
            <Icon name="check-circle" size={20} color={colors.textSecondary} />
            <Text style={styles.switchTitle}>DNS Leak</Text>
            <Text
              style={[
                styles.switchVal,
                {
                  color:
                    connected && stats.dnsLeakSafe
                      ? colors.connected
                      : colors.textMuted,
                },
              ]}>
              {connected ? (stats.dnsLeakSafe ? 'SAFE' : 'WARNING') : '—'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  label,
  value,
  unit,
  big,
}: {
  label: string;
  value: string;
  unit?: string;
  big?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValRow}>
        <Text style={[styles.metricVal, big && styles.metricValBig]}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 56,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {padding: spacing.md, paddingTop: 0},
  section: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stateRow: {flexDirection: 'row', alignItems: 'center'},
  stateDot: {width: 12, height: 12, borderRadius: 6, marginRight: spacing.sm},
  stateText: {fontSize: typography.sizes.xxl, fontWeight: '700'},
  since: {fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: 2},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  metric: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  metricLabel: {fontSize: typography.sizes.xs, color: colors.textSecondary},
  metricValRow: {flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.xs},
  metricVal: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricValBig: {
    color: colors.primary,
    fontFamily: 'monospace',
    fontSize: 22,
  },
  metricUnit: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginLeft: 4,
    marginBottom: 3,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  kvKey: {fontSize: typography.sizes.md, color: colors.textSecondary, flex: 1},
  kvVal: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: '600',
    maxWidth: '55%',
  },
  ipPill: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  divider: {height: 1, backgroundColor: colors.border},
  switchRow: {flexDirection: 'row', justifyContent: 'space-between'},
  switchCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  switchTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  switchVal: {fontSize: typography.sizes.md, fontWeight: '700', marginTop: 2},
});

export default StatsScreen;
