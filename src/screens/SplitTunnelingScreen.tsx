/**
 * Split Tunneling — choose which installed apps bypass the VPN.
 *
 * Selected package names are persisted to settings.splitTunneling and consumed
 * by ProxyVpnService via builder.addDisallowedApplication() on next connect.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import {VpnBridge, InstalledApp} from '../native/VpnBridge';
import {getSettings, updateSettings} from '../store/settingsStore';
import {colors, radius, spacing, typography} from '../theme/tokens';

function SplitTunnelingScreen(): React.JSX.Element {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [excluded, setExcluded] = useState<string[]>(
    () => getSettings().splitTunneling,
  );

  useEffect(() => {
    let alive = true;
    VpnBridge.getInstalledApps()
      .then(list => {
        if (alive) setApps(list);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (pkg: string) => {
    setExcluded(prev => {
      const next = prev.includes(pkg)
        ? prev.filter(p => p !== pkg)
        : [...prev, pkg];
      updateSettings({splitTunneling: next}); // persist immediately
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      a =>
        a.appName.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }, [apps, query]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading installed apps…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Apps you enable here will bypass the proxy and use your normal
        connection.
      </Text>

      <View style={styles.searchBox}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search apps"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.packageName}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.appName} numberOfLines={1}>
                {item.appName}
              </Text>
              <Text style={styles.pkg} numberOfLines={1}>
                {item.packageName}
              </Text>
            </View>
            <Switch
              value={excluded.includes(item.packageName)}
              onValueChange={() => toggle(item.packageName)}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={colors.white}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No apps match your search.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {marginTop: spacing.md, color: colors.textSecondary},
  hint: {
    padding: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
  },
  list: {padding: spacing.md},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowText: {flex: 1, marginRight: spacing.md},
  appName: {fontSize: typography.sizes.md, color: colors.textPrimary},
  pkg: {fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2},
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});

export default SplitTunnelingScreen;
