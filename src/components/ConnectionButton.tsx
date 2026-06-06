/**
 * Full-width Connect / Disconnect button. Disabled + shows a spinner while a
 * transition is in flight (connecting / reconnecting).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
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

  const label = connected ? 'Disconnect' : busy ? 'Please wait' : 'Connect';
  const bg = connected ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({pressed}) => [
        styles.btn,
        {backgroundColor: bg, opacity: disabled || busy ? 0.6 : pressed ? 0.85 : 1},
      ]}>
      {busy ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
});

export default ConnectionButton;
