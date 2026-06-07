/**
 * One row in the Profiles list. White card; active profile gets a teal left
 * accent + check + "ACTIVE" label. Protocol shown as a colored pill, host:port
 * with a small server glyph, and a gear to edit. Amber expiry warning ≤3 days.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {ProxyProfile} from '../types';
import {colors, protocolPill, radius, spacing, typography} from '../theme/tokens';
import {daysUntil} from '../utils/format';

interface Props {
  profile: ProxyProfile;
  active: boolean;
  onPress: () => void;
  onEdit: () => void;
}

function ProfileRow({profile, active, onPress, onEdit}: Props): React.JSX.Element {
  const days = daysUntil(profile.expiryDate);
  const expiringSoon = days !== null && days <= 3;
  const pill = protocolPill(profile.protocol);

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        active && styles.rowActive,
        pressed && {opacity: 0.9},
      ]}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          <View style={[styles.pill, {backgroundColor: pill.bg}]}>
            <Text style={[styles.pillText, {color: pill.fg}]}>
              {profile.protocol}
            </Text>
          </View>
        </View>
        <View style={styles.hostRow}>
          <Icon name="server" size={13} color={colors.textMuted} />
          <Text style={styles.host} numberOfLines={1}>
            {profile.host}:{profile.port}
          </Text>
        </View>
        {expiringSoon && (
          <Text style={styles.expiry}>
            {days !== null && days < 0
              ? 'Expired'
              : `Expires in ${days} day${days === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {active ? (
          <View style={styles.activeWrap}>
            <Icon name="check-circle" size={20} color={colors.connected} />
            <Text style={styles.activeText}>ACTIVE</Text>
          </View>
        ) : (
          <Pressable onPress={onEdit} hitSlop={12} style={styles.editBtn}>
            <Icon name="settings" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 1,
  },
  rowActive: {
    borderLeftWidth: 4,
    borderLeftColor: colors.connected,
    backgroundColor: '#F2FBFA',
  },
  left: {flex: 1, marginRight: spacing.sm},
  titleRow: {flexDirection: 'row', alignItems: 'center'},
  name: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  pill: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pillText: {fontSize: typography.sizes.xs - 1, fontWeight: '700'},
  hostRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6},
  host: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginLeft: 6,
  },
  expiry: {
    marginTop: 4,
    fontSize: typography.sizes.xs,
    color: colors.connecting,
    fontWeight: '600',
  },
  right: {marginLeft: spacing.xs},
  activeWrap: {alignItems: 'center'},
  activeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.connected,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  editBtn: {padding: spacing.xs},
});

export default ProfileRow;
