export const statusLabels: Record<string, string> = {
  setup: 'Setup',
  registration: 'Registration Open',
  'pool-play': 'Pool Play',
  bracket: 'Bracket Play',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paused: 'Paused',
};

export const statusColors: Record<string, string> = {
  setup: 'bg-yellow-500/20 text-yellow-400',
  registration: 'bg-blue-500/20 text-blue-400',
  'pool-play': 'bg-green-500/20 text-green-400',
  bracket: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-on-surface-muted/20 text-on-surface-muted',
  cancelled: 'bg-red-500/20 text-red-400',
  paused: 'bg-orange-500/20 text-orange-400',
};

export const formatLabels: Record<string, string> = {
  'round-robin': 'Round Robin',
  'single-elimination': 'Single Elimination',
  'pool-bracket': 'Pool Play + Bracket',
};
