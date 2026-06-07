/**
 * Home status indicator — a soft colored glow circle with a pulsing dot and an
 * uppercase status label beneath, matching the Stitch design.
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {ConnectionStatus} from '../types';
import {colors, radius, statusColor, typography} from '../theme/tokens';

interface Props {
  status: ConnectionStatus;
}

const LABELS: Record<ConnectionStatus, string> = {
  connected: 'CONNECTED',
  disconnected: 'DISCONNECTED',
  connecting: 'CONNECTING',
  reconnecting: 'RECONNECTING',
};

function StatusIndicator({status}: Props): React.JSX.Element {
  const color = statusColor(status);
  const busy = status === 'connecting' || status === 'reconnecting';

  return (
    <View style={styles.wrap}>
      <View style={[styles.glow, {backgroundColor: `${color}1A`}]}>
        {busy ? (
          <ActivityIndicator color={color} />
        ) : (
          <View style={[styles.dot, {backgroundColor: color}]} />
        )}
      </View>
      <Text style={[styles.label, {color}]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center'},
  glow: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {width: 16, height: 16, borderRadius: radius.full},
  label: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textPrimary,
  },
});

export default StatusIndicator;
