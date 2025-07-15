export interface Team {
  id: string;
  name: string;
  tournamentId: string;
  captainId: string;
  captainName: string;
  members: string[];
  registeredAt: Date;
}

export interface RegisterTeamOptions {
  tournamentId: string;
  name: string;
  captainId: string;
  captainName: string;
}