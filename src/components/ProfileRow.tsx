/**
 * One row in the Profiles list. Shows name, protocol pill, host:port, an active
 * teal left border, and an amber expiry warning when expiry is within 3 days.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {ProxyProfile} from '../types';
import {colors, radius, spacing, typography} from '../theme/tokens';
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

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        active && styles.rowActive,
        pressed && {opacity: 0.85},
      ]}>
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{profile.protocol}</Text>
          </View>
        </View>
        <Text style={styles.host} numberOfLines={1}>
          {profile.host}:{profile.port}
        </Text>
        {expiringSoon && (
          <Text style={styles.expiry}>
            {days !== null && days < 0
              ? 'Expired'
              : `Expires in ${days} day${days === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>

      <Pressable onPress={onEdit} hitSlop={12} style={styles.editBtn}>
        <Icon name="edit-2" size={18} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  rowActive: {
    borderLeftColor: colors.primary,
    backgroundColor: '#F0FDFA',
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
    backgroundColor: colors.border,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  host: {
    marginTop: 2,
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  expiry: {
    marginTop: 4,
    fontSize: typography.sizes.xs,
    color: colors.connecting,
    fontWeight: '600',
  },
  editBtn: {padding: spacing.xs},
});

export default ProfileRow;
