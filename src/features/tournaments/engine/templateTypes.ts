import type {
  TournamentFormat, TournamentConfig, TeamFormation,
  TournamentAccessMode, TournamentRules,
} from '../../../data/types';

export interface TournamentTemplate {
  id: string;
  name: string;
  description?: string;
  format: TournamentFormat;
  gameType: TournamentConfig['gameType'];
  config: TournamentConfig;
  teamFormation: TeamFormation | null;
  maxPlayers: number | null;
  accessMode: TournamentAccessMode;
  // rules field is stored but not yet restored when creating from template
  // (no rules editing UI exists yet). Will be wired when rules UI is built.
  rules: TournamentRules;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export const MAX_TEMPLATES_PER_USER = 20;
export const MAX_TEMPLATE_NAME_LENGTH = 50;
