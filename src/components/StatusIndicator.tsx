/**
 * Large circular status orb shown on the Home screen. Color + label follow the
 * connection state; a spinner overlays during connecting/reconnecting.
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {ConnectionStatus} from '../types';
import {colors, radius, statusColor, typography} from '../theme/tokens';

interface Props {
  status: ConnectionStatus;
}

const LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
};

function StatusIndicator({status}: Props): React.JSX.Element {
  const color = statusColor(status);
  const busy = status === 'connecting' || status === 'reconnecting';

  return (
    <View style={styles.wrap}>
      <View style={[styles.outer, {borderColor: color}]}>
        <View style={[styles.inner, {backgroundColor: `${color}1A`}]}>
          {busy ? (
            <ActivityIndicator size="large" color={color} />
          ) : (
            <Icon
              name={status === 'connected' ? 'shield' : 'shield-off'}
              size={56}
              color={color}
            />
          )}
        </View>
      </View>
      <Text style={[styles.label, {color}]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center'},
  outer: {
    width: 200,
    height: 200,
    borderRadius: radius.full,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 168,
    height: 168,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 20,
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default StatusIndicator;
