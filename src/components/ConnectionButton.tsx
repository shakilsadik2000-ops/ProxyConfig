/**
 * Full-width connect / disconnect button. Blue when disconnected ("Tap to
 * Connect"), dark when connected ("Disconnect"); shows a spinner mid-transition.
 */
import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {ConnectionStatus} from '../types';
import {colors, radius, typography} from '../theme/tokens';

interface Props {
  status: ConnectionStatus;
  onPress: () => void;
  disabled?: boolean;
}

function ConnectionButton({status, onPress, disabled}: Props): React.JSX.Element {
  const busy = status === 'connecting' || status === 'reconnecting';
  const connected = status === 'connected';

  const label = connected ? 'DISCONNECT' : busy ? 'PLEASE WAIT' : 'TAP TO CONNECT';
  const bg = connected ? colors.dark : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({pressed}) => [
        styles.btn,
        {
          backgroundColor: bg,
          opacity: disabled || busy ? 0.6 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
      ]}>
      {busy ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <View style={styles.row}>
          <Icon name="power" size={20} color={colors.white} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    elevation: 1,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  label: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
});

export default ConnectionButton;
