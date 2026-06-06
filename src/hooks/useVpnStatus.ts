/**
 * Subscribes to native VPN status events and tracks the connectedSince
 * timestamp used by uptime timers across screens.
 */
import {useEffect, useState} from 'react';
import {VpnBridge} from '../native/VpnBridge';
import {ConnectionStatus} from '../types';

export interface VpnStatusState {
  status: ConnectionStatus;
  connectedSince: number | null;
  lastError: string | null;
}

export function useVpnStatus(): VpnStatusState {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    // Reconcile on mount in case the service is already running (e.g. app was
    // reopened while connected).
    VpnBridge.isConnected()
      .then(connected => {
        if (connected) {
          setStatus('connected');
          VpnBridge.getCurrentStats()
            .then(s => setConnectedSince(s.connectedSince || Date.now()))
            .catch(() => setConnectedSince(Date.now()));
        }
      })
      .catch(() => {});

    const offStatus = VpnBridge.onStatusChange(next => {
      setStatus(next);
      if (next === 'connected') {
        setConnectedSince(prev => prev ?? Date.now());
        setLastError(null);
      } else if (next === 'disconnected') {
        setConnectedSince(null);
      }
    });

    const offError = VpnBridge.onError(msg => setLastError(msg));

    return () => {
      offStatus();
      offError();
    };
  }, []);

  return {status, connectedSince, lastError};
}
