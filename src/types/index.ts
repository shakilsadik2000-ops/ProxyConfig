/**
 * Shared domain types for Proxy Config.
 * These mirror the contracts used by the native VPN module (VpnModule.kt).
 */

export type Protocol = 'HTTP' | 'SOCKS5';

export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting';

export interface ProxyProfile {
  id: string; // uuid
  name: string; // e.g. "US Proxy - Instagram"
  protocol: Protocol;
  host: string; // IP address or hostname
  port: number;
  username: string;
  password: string;
  expiryDate?: string; // optional ISO date string
  createdAt: string;
}

export interface ConnectionStats {
  connectedSince: number | null; // timestamp ms
  bytesSent: number;
  bytesReceived: number;
  currentIp: string;
  pingMs: number;
  dnsLeakSafe: boolean;
}

export type DnsServer = 'auto' | '8.8.8.8' | '1.1.1.1' | string;

export interface AppSettings {
  killSwitch: boolean;
  autoReconnect: boolean;
  reconnectIntervalSec: number; // 5, 10, or 30
  dnsServer: DnsServer; // 'auto' | '8.8.8.8' | '1.1.1.1' | custom
  splitTunneling: string[]; // list of package names to exclude
  language: 'en' | 'bn';
}

/** Result of VpnModule.testConnection(). */
export interface TestConnectionResult {
  success: boolean;
  ip: string;
}

/** Result of VpnModule.connect() — whether the native side started the tunnel. */
export interface ConnectResult {
  started: boolean;
}
