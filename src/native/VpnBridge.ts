/**
 * Typed wrapper around the native VpnModule + its event emitter.
 *
 * All connection lifecycle goes through here so screens never touch
 * NativeModules directly. Events ("vpn_status", "vpn_stats", "vpn_error") are
 * surfaced as subscribe helpers that return an unsubscribe function.
 */
import {
  NativeEventEmitter,
  NativeModules,
  EmitterSubscription,
} from 'react-native';
import {
  AppSettings,
  ConnectionStatus,
  ConnectResult,
  ProxyProfile,
  TestConnectionResult,
} from '../types';

const {VpnModule} = NativeModules;

if (!VpnModule) {
  // Helps catch a missing native build early (e.g. running on an unsupported
  // platform or before a rebuild after adding the module).
  // eslint-disable-next-line no-console
  console.warn('VpnModule native module not found — did you rebuild Android?');
}

const emitter = new NativeEventEmitter(VpnModule);

/** An installed app entry returned by getInstalledApps(). */
export interface InstalledApp {
  packageName: string;
  appName: string;
}

/** Raw stats payload as emitted by the native side. */
export interface NativeStats {
  bytesSent: number;
  bytesReceived: number;
  pingMs: number;
  currentIp: string;
  dnsLeakSafe: boolean;
}

export const VpnBridge = {
  /**
   * Establish the tunnel for a profile using the current settings. Resolves
   * once the service is starting; rejects if VPN permission is denied.
   */
  connect: (
    profile: ProxyProfile,
    settings: AppSettings,
  ): Promise<ConnectResult> =>
    VpnModule.connect(
      profile.host,
      profile.port,
      profile.username,
      profile.password,
      profile.protocol,
      settings.killSwitch,
      settings.autoReconnect,
      settings.reconnectIntervalSec,
      settings.dnsServer,
      settings.splitTunneling,
    ),

  disconnect: (): Promise<void> => VpnModule.disconnect(),

  /** Probe a proxy without bringing up the tunnel. */
  testConnection: (profile: ProxyProfile): Promise<TestConnectionResult> =>
    VpnModule.testConnection(
      profile.host,
      profile.port,
      profile.username,
      profile.password,
      profile.protocol,
    ),

  getCurrentStats: (): Promise<NativeStats & {connectedSince: number}> =>
    VpnModule.getCurrentStats(),

  isConnected: (): Promise<boolean> => VpnModule.isConnected(),

  /** Launchable, non-system apps for the Split Tunneling picker. */
  getInstalledApps: (): Promise<InstalledApp[]> => VpnModule.getInstalledApps(),

  // ── Event subscriptions (each returns an unsubscribe fn) ─────────────────
  onStatusChange: (
    cb: (status: ConnectionStatus) => void,
  ): (() => void) => {
    const sub: EmitterSubscription = emitter.addListener(
      'vpn_status',
      (e: {status: ConnectionStatus}) => cb(e.status),
    );
    return () => sub.remove();
  },

  onStatsUpdate: (cb: (stats: NativeStats) => void): (() => void) => {
    const sub = emitter.addListener('vpn_stats', cb);
    return () => sub.remove();
  },

  onError: (cb: (message: string) => void): (() => void) => {
    const sub = emitter.addListener('vpn_error', (e: {message: string}) =>
      cb(e.message),
    );
    return () => sub.remove();
  },
};
