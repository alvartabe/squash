export const colors = {
  primary: '#166534',
  primaryForeground: '#ffffff',
  secondary: '#dcfce7',
  background: '#f8fafc',
  surface: '#ffffff',
  foreground: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  destructive: '#b91c1c',
} as const;

export const darkColors = {
  ...colors,
  background: '#020617',
  surface: '#0f172a',
  foreground: '#f8fafc',
  muted: '#94a3b8',
  border: '#334155',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { sm: 6, md: 10, lg: 16, full: 9999 } as const;
