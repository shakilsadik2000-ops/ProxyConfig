/**
 * Fast, synchronous settings + active-profile state via MMKV.
 *
 * MMKV is used (instead of AsyncStorage) because settings are read on every
 * render of several screens and the synchronous API keeps that cheap.
 */
import {MMKV} from 'react-native-mmkv';
import {AppSettings} from '../types';

const storage = new MMKV({id: 'proxy-config-settings'});

const ACTIVE_PROFILE_KEY = 'active_profile_id';
const SETTINGS_KEY = 'app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  killSwitch: true,
  autoReconnect: true,
  reconnectIntervalSec: 10,
  dnsServer: '1.1.1.1',
  splitTunneling: [],
  language: 'en',
};

// ── Active profile ─────────────────────────────────────────────────────────
export function getActiveProfileId(): string | null {
  return storage.getString(ACTIVE_PROFILE_KEY) ?? null;
}

export function setActiveProfileId(id: string | null): void {
  if (id === null) {
    storage.delete(ACTIVE_PROFILE_KEY);
  } else {
    storage.set(ACTIVE_PROFILE_KEY, id);
  }
}

// ── App settings ─────────────────────────────────────────────────────────
export function getSettings(): AppSettings {
  const raw = storage.getString(SETTINGS_KEY);
  if (!raw) return {...DEFAULT_SETTINGS};
  try {
    // Merge over defaults so newly added keys are always present.
    return {...DEFAULT_SETTINGS, ...JSON.parse(raw)};
  } catch {
    return {...DEFAULT_SETTINGS};
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = {...getSettings(), ...partial};
  storage.set(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
