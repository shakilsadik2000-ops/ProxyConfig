/**
 * Subscribes to native vpn_stats events (emitted every ~2s) and exposes a
 * ConnectionStats snapshot. Resets to zeros when not connected.
 */
import {useEffect, useState} from 'react';
import {VpnBridge} from '../native/VpnBridge';
import {ConnectionStats, ConnectionStatus} from '../types';

const EMPTY: ConnectionStats = {
  connectedSince: null,
  bytesSent: 0,
  bytesReceived: 0,
  currentIp: '—',
  pingMs: 0,
  dnsLeakSafe: true,
};

export function useConnectionStats(
  status: ConnectionStatus,
  connectedSince: number | null,
): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>(EMPTY);

  useEffect(() => {
    if (status === 'disconnected') {
      setStats(EMPTY);
      return;
    }

    const off = VpnBridge.onStatsUpdate(s => {
      setStats({
        connectedSince,
        bytesSent: s.bytesSent,
        bytesReceived: s.bytesReceived,
        currentIp: s.currentIp || '—',
        pingMs: Math.max(0, Math.round(s.pingMs)),
        dnsLeakSafe: s.dnsLeakSafe,
      });
    });

    return off;
  }, [status, connectedSince]);

  return {...stats, connectedSince};
}
