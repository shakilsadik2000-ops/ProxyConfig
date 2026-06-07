/**
 * Design tokens — single source of truth for colors, spacing, radius and type.
 * Aligned with the Google Stitch "Proxy Config UI Design" system
 * (Material 3 palette, Inter, blue primary).
 */

export const colors = {
  primary: '#1a56db', // brand blue — buttons, active states, links
  primaryDark: '#003fb1',
  background: '#F8F9FA',
  surface: '#FFFFFF', // cards (surface-container-lowest)
  surfaceAlt: '#EDEEEF', // pills / inset chips (surface-container)
  surfaceChip: '#E7E8E9', // setting-row icon chips (surface-container-high)
  border: '#C3C5D7', // outline-variant
  textPrimary: '#191C1D', // on-surface
  textSecondary: '#434654', // on-surface-variant
  textMuted: '#737686', // outline
  connected: '#006A63', // secondary teal — connected / SOCKS5 / safe
  connectedContainer: '#99EFE5',
  connectedOn: '#00504A',
  connecting: '#B45309', // amber
  disconnected: '#BA1A1A', // error
  danger: '#BA1A1A',
  dark: '#191C1D', // connected button background
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
  md: 12,
  lg: 16,
  chip: 10,
  full: 9999,
};

export const typography = {
  fontFamily: 'Inter',
  sizes: {
    xs: 12, // label-md
    sm: 14, // body-sm / label-lg
    md: 16, // body-md
    lg: 18, // body-lg
    xl: 24, // headline-md
    xxl: 32, // headline-lg
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

/** Pill colors for a protocol badge. */
export function protocolPill(protocol: string): {bg: string; fg: string} {
  return protocol === 'SOCKS5'
    ? {bg: colors.connectedContainer, fg: colors.connectedOn}
    : {bg: colors.surfaceAlt, fg: colors.textSecondary};
}
