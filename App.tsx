/**
 * Proxy Config — root component.
 *
 * Wires up the safe-area provider and the bottom-tab/stack navigator.
 * All connection state lives in the native VPN service; React reads it
 * through the VpnBridge event emitter (see src/native/VpnBridge.ts).
 */
import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {colors} from './src/theme/tokens';

function App(): React.JSX.Element {
  const isDark = useColorScheme() === 'dark';
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
