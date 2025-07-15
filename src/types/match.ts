export interface Match {
  id: string;
  tournamentId: string;
  stage: number;
  stagePosition: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerId: string | null;
  homeRounds: number | null;
  awayRounds: number | null;
  status: 'pending' | 'ready' | 'in_progress' | 'completed';
  nextMatchId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}