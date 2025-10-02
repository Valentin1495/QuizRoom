export const Colors = {
  primary: '#6C4CF5',
  accent: '#64FBD2',
  background: '#0B0B14',
  card: 'rgba(255, 255, 255, 0.08)',
  text: '#F5F7FF',
  subtext: '#A4A8BA',
  gradients: {
    primary: ['#9C7FFF', '#5CC8FF'],
    secondary: ['#FF9AE8', '#FFD1A3'],
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  md: 16,
  lg: 24,
  xl: 28,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 16,
  },
  button: {
    fontSize: 18,
    fontWeight: '600',
  },
} as const;
