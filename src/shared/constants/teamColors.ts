export interface TeamColor {
  name: string;
  hex: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { name: 'Teal', hex: '#4ECDC4' },
  { name: 'Terracotta', hex: '#E8725A' },
  { name: 'Gold', hex: '#D4A853' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Red', hex: '#ef4444' },
];

export const DEFAULT_TEAM1_COLOR = '#4ECDC4';
export const DEFAULT_TEAM2_COLOR = '#E8725A';
