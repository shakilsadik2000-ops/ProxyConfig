/**
 * Profile persistence on top of AsyncStorage.
 *
 * Profiles are stored as a single JSON array under PROFILES_KEY. Passwords are
 * kept here for app-side editing; the native side additionally encrypts them at
 * rest via Android Keystore when a connection is established (see README →
 * Security). CRUD is intentionally simple and fully async.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ProxyProfile} from '../types';

const PROFILES_KEY = 'proxy_profiles';

/** RFC4122-ish v4 UUID; good enough for local profile identity. */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readAll(): Promise<ProxyProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(profiles: ProxyProfile[]): Promise<void> {
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export const profileStore = {
  getAll: readAll,

  getById: async (id: string): Promise<ProxyProfile | null> => {
    const all = await readAll();
    return all.find(p => p.id === id) ?? null;
  },

  /** Insert a new profile (assumes id already assigned). */
  save: async (profile: ProxyProfile): Promise<void> => {
    const all = await readAll();
    all.push(profile);
    await writeAll(all);
  },

  /** Replace an existing profile matched by id. */
  update: async (profile: ProxyProfile): Promise<void> => {
    const all = await readAll();
    const next = all.map(p => (p.id === profile.id ? profile : p));
    await writeAll(next);
  },

  /** Upsert: update if id exists, otherwise insert. */
  upsert: async (profile: ProxyProfile): Promise<void> => {
    const all = await readAll();
    const exists = all.some(p => p.id === profile.id);
    const next = exists
      ? all.map(p => (p.id === profile.id ? profile : p))
      : [...all, profile];
    await writeAll(next);
  },

  delete: async (id: string): Promise<void> => {
    const all = await readAll();
    await writeAll(all.filter(p => p.id !== id));
  },
};
