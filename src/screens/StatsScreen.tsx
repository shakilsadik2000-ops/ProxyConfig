/**
 * Statistics — live connection metrics in a 2-column card grid.
 *
 * Stats stream from the native service (vpn_stats every ~2s). When
 * disconnected, every value renders as "—". Includes a basic DNS-leak test
 * that re-fetches the egress IP and compares it to the proxy host heuristic.
 */
import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';

import {useVpnStatus} from '../hooks/useVpnStatus';
import {useConnectionStats} from '../hooks/useConnectionStats';
import {VpnBridge} from '../native/VpnBridge';
import {getSettings} from '../store/settingsStore';
import {colors, radius, spacing, typography} from '../theme/tokens';
import {fmtBytes, fmtDuration} from '../utils/format';

function StatsScreen(): React.JSX.Element {
  const {status, connectedSince} = useVpnStatus();
  const stats = useConnectionStats(status, connectedSince);
  const [now, setNow] = useState(Date.now());
  const settings = getSettings();
  const connected = status === 'connected';

  useEffect(() => {
    if (!connected) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [connected]);

  const dash = (v: string) => (connected ? v : '—');

  const sent = fmtBytes(stats.bytesSent);
  const recv = fmtBytes(stats.bytesReceived);
  const uptime =
    connected && connectedSince
      ? fmtDuration(now - connectedSince).label
      : '—';

  const runDnsLeakTest = async () => {
    if (!connected) {
      ToastAndroid.show('Connect first to run the test', ToastAndroid.SHORT);
      return;
    }
    try {
      const res = await VpnBridge.getCurrentStats();
      const safe = res.dnsLeakSafe;
      ToastAndroid.show(
        safe ? 'No DNS leak detected ✓' : 'Possible DNS leak ✗',
        ToastAndroid.LONG,
      );
    } catch {
      ToastAndroid.show('Test failed', ToastAndroid.SHORT);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.header}>Statistics</Text>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.grid}>
          <StatCard icon="clock" label="Connected Since" value={uptime} />
          <StatCard
            icon="globe"
            label="Current IP"
            value={dash(stats.currentIp)}
          />
          <StatCard
            icon="upload"
            label="Data Sent"
            value={connected ? `${sent.value} ${sent.unit}` : '—'}
          />
          <StatCard
            icon="download"
            label="Data Received"
            value={connected ? `${recv.value} ${recv.unit}` : '—'}
          />
          <StatCard
            icon="activity"
            label="Ping"
            value={connected ? `${stats.pingMs} ms` : '—'}
          />
          <StatCard
            icon="shield"
            label="DNS Status"
            value={
              connected ? (stats.dnsLeakSafe ? 'Safe ✓' : 'Warning ✗') : '—'
            }
            valueColor={
              connected
                ? stats.dnsLeakSafe
                  ? colors.connected
                  : colors.danger
                : colors.textMuted
            }
          />
        </View>

        {/* Toggle status rows */}
        <View style={styles.statusList}>
          <StatusRow
            label="Kill Switch"
            on={settings.killSwitch}
          />
          <StatusRow label="Auto-Reconnect" on={settings.autoReconnect} />
        </View>

        <TouchableOpacity style={styles.dnsBtn} onPress={runDnsLeakTest}>
          <Icon name="search" size={18} color={colors.primary} />
          <Text style={styles.dnsText}>Run DNS Leak Test</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={styles.cardLabel}>{label}</Text>
      <Text
        style={[styles.cardValue, valueColor ? {color: valueColor} : null]}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatusRow({label, on}: {label: string; on: boolean}): React.JSX.Element {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={styles.statusValueWrap}>
        <View
          style={[
            styles.dot,
            {backgroundColor: on ? colors.connected : colors.textMuted},
          ]}
        />
        <Text
          style={[
            styles.statusValue,
            {color: on ? colors.connected : colors.textMuted},
          ]}>
          {on ? 'On' : 'Off'}
        </Text>
      </View>
    </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  cardValue: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusList: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  statusLabel: {fontSize: typography.sizes.md, color: colors.textPrimary},
  statusValueWrap: {flexDirection: 'row', alignItems: 'center'},
  dot: {width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs},
  statusValue: {fontSize: typography.sizes.md, fontWeight: '600'},
  dnsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  dnsText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: typography.sizes.md,
    marginLeft: spacing.xs,
  },
});

export default StatsScreen;
