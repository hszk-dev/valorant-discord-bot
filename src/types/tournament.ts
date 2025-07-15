import { Team } from './team.js';
import { Match } from './match.js';

export interface Tournament {
  id: string;
  name: string;
  teamCount: number;
  format: 'single-elimination';
  status: 'draft' | 'registration' | 'active' | 'completed';
  guildId: string;
  currentStage: number;
  totalStages: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  teams: Team[];
  matches: Match[];
}

export interface CreateTournamentOptions {
  name: string;
  teamCount: number;
  guildId: string;
}