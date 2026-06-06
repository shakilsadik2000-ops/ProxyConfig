/**
 * Design tokens — single source of truth for colors, spacing, radius and type.
 * Ported from the approved web prototype.
 */

export const colors = {
  primary: '#0F766E', // teal — buttons, active states
  background: '#FFFFFF',
  surface: '#F8F9FA',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  connected: '#16A34A', // green
  disconnected: '#DC2626', // red
  connecting: '#D97706', // amber
  danger: '#DC2626',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

export const typography = {
  fontFamily: 'Roboto',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
};

/** Maps a connection status to its accent color. */
export function statusColor(status: string): string {
  switch (status) {
    case 'connected':
      return colors.connected;
    case 'connecting':
    case 'reconnecting':
      return colors.connecting;
    default:
      return colors.disconnected;
  }
}
