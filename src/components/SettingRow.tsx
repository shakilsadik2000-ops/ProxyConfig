/**
 * A Material-style list row: an icon chip, a title + optional subtitle, and a
 * trailing control (toggle, value, chevron…). Used inside grouped cards on the
 * Settings and Stats screens. Matches the Stitch design.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, radius, spacing, typography} from '../theme/tokens';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

function SettingRow({icon, title, subtitle, right, onPress}: Props): React.JSX.Element {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={({pressed}: {pressed?: boolean}) => [
        styles.row,
        pressed && {backgroundColor: colors.background},
      ]}>
      <View style={styles.chip}>
        <Icon name={icon} size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceChip,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  text: {flex: 1},
  title: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  right: {marginLeft: spacing.sm},
});

export default SettingRow;
