/**
 * Settings row with a title, optional description, and a trailing Switch.
 */
import React from 'react';
import {StyleSheet, Switch, Text, View} from 'react-native';
import {colors, spacing, typography} from '../theme/tokens';

interface Props {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: Props): React.JSX.Element {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{false: colors.border, true: colors.primary}}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  text: {flex: 1, marginRight: spacing.md},
  title: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  description: {
    marginTop: 2,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});

export default ToggleRow;
