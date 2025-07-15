import { Tournament, CreateTournamentOptions } from '../types/tournament.js';
import { Team, RegisterTeamOptions } from '../types/team.js';
import { Match } from '../types/match.js';
import { dataService } from './dataService.js';

export class TournamentService {
  private tournaments = new Map<string, Tournament>();

  async initialize(): Promise<void> {
    console.log('🔄 トーナメントサービスを初期化中...');
    const allData = await dataService.loadAllData();

    // 各Guildのトーナメントをメモリに読み込み
    for (const [_guildId, tournamentList] of allData) {
      for (const tournament of tournamentList) {
        this.tournaments.set(tournament.id, tournament);
      }
    }

    console.log(`✅ ${this.tournaments.size}件のトーナメントを読み込みました`);
  }

  private async saveGuildData(guildId: string): Promise<void> {
    const guildTournaments = this.list(guildId);
    await dataService.saveTournaments(guildId, guildTournaments);
  }

  getStageDisplayName(stage: number, totalStages: number): string {
    const remaining = totalStages - stage + 1;

    switch (remaining) {
    case 1: return '決勝';
    case 2: return '準決勝';
    case 3: return '準々決勝';
    default: return `第${stage}ステージ`;
    }
  }

  getTeamName(tournament: Tournament, teamId: string): string {
    const team = tournament.teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown';
  }

  generateId(): string {
    return `t_${Date.now()}`;
  }

  generateTeamId(): string {
    return `team_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  generateMatchId(): string {
    return `match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  async create(options: CreateTournamentOptions): Promise<Tournament> {
    // 重複チェック
    const existingTournament = this.findByNameAndGuild(options.name, options.guildId);
    if (existingTournament) {
      throw new Error('同名のトーナメントが既に存在します。');
    }

    const totalStages = Math.log2(options.teamCount);

    const tournament: Tournament = {
      id: this.generateId(),
      name: options.name,
      teamCount: options.teamCount,
      format: 'single-elimination',
      status: 'draft',
      guildId: options.guildId,
      currentStage: 1,
      totalStages,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      teams: [],
      matches: [],
    };

    this.tournaments.set(tournament.id, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);

    return tournament;
  }

  get(id: string): Tournament | undefined {
    return this.tournaments.get(id);
  }

  list(guildId: string): Tournament[] {
    return Array.from(this.tournaments.values())
      .filter(tournament => tournament.guildId === guildId);
  }

  delete(id: string): boolean {
    return this.tournaments.delete(id);
  }

  async startRegistration(tournamentId: string): Promise<Tournament> {
    const tournament = this.get(tournamentId);
    if (!tournament) {
      throw new Error('トーナメントが見つかりません。IDを確認してください。');
    }

    if (tournament.status !== 'draft') {
      throw new Error('この操作は下書き状態のトーナメントでのみ実行できます。');
    }

    tournament.status = 'registration';
    tournament.updatedAt = new Date();
    this.tournaments.set(tournamentId, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);

    return tournament;
  }

  async registerTeam(options: RegisterTeamOptions): Promise<Team> {
    const tournament = this.get(options.tournamentId);
    if (!tournament) {
      throw new Error('トーナメントが見つかりません。IDを確認してください。');
    }

    if (tournament.status !== 'registration') {
      throw new Error('このトーナメントはまだ登録受付を開始していません。');
    }

    if (!this.canRegisterTeam(options.tournamentId)) {
      throw new Error('このトーナメントは定員に達しています。');
    }

    if (this.isTeamNameTaken(options.tournamentId, options.name)) {
      throw new Error('そのチーム名は既に使用されています。');
    }

    const team: Team = {
      id: this.generateTeamId(),
      name: options.name,
      tournamentId: options.tournamentId,
      captainId: options.captainId,
      captainName: options.captainName,
      members: [],
      registeredAt: new Date(),
    };

    tournament.teams.push(team);
    tournament.updatedAt = new Date();
    this.tournaments.set(options.tournamentId, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);

    return team;
  }

  getTeams(tournamentId: string): Team[] {
    const tournament = this.get(tournamentId);
    return tournament ? tournament.teams : [];
  }

  isTeamNameTaken(tournamentId: string, teamName: string): boolean {
    const teams = this.getTeams(tournamentId);
    return teams.some(team => team.name === teamName);
  }

  canRegisterTeam(tournamentId: string): boolean {
    const tournament = this.get(tournamentId);
    if (!tournament) return false;
    return tournament.teams.length < tournament.teamCount;
  }

  async startTournament(tournamentId: string): Promise<Tournament> {
    const tournament = this.get(tournamentId);
    if (!tournament) {
      throw new Error('トーナメントが見つかりません。');
    }

    if (tournament.status !== 'registration') {
      throw new Error('トーナメントを開始するには登録受付中である必要があります。');
    }

    if (tournament.teams.length !== tournament.teamCount) {
      const remaining = tournament.teamCount - tournament.teams.length;
      throw new Error(`チーム数が不足しています。あと${remaining}チーム必要です。`);
    }


    // ブラケット生成
    const matches = this.generateBracket(tournament.teams);
    tournament.matches = matches;
    tournament.status = 'active';
    tournament.updatedAt = new Date();

    this.tournaments.set(tournamentId, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);

    return tournament;
  }

  generateBracket(teams: Team[]): Match[] {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const matches: Match[] = [];
    const teamCount = teams.length;
    const totalRounds = Math.log2(teamCount);

    // 各ラウンドの試合数を計算
    const matchesPerRound = [];
    for (let round = 1; round <= totalRounds; round++) {
      matchesPerRound.push(Math.pow(2, totalRounds - round));
    }

    const matchIdMap = new Map<string, string>();

    // 全ラウンドの試合を生成
    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = matchesPerRound[round - 1];

      for (let matchNumber = 1; matchNumber <= matchesInRound; matchNumber++) {
        const matchId = this.generateMatchId();
        const match: Match = {
          id: matchId,
          tournamentId: teams[0].tournamentId,
          stage: round,
          stagePosition: matchNumber,
          homeTeamId: null,
          awayTeamId: null,
          winnerId: null,
          homeRounds: null,
          awayRounds: null,
          status: 'pending',
          nextMatchId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          completedAt: null,
        };

        // 第1ステージの場合、実際のチームを割り当て（シード順）
        if (round === 1) {
          const homeIndex = (matchNumber - 1) * 2; // 上位シード
          const awayIndex = homeIndex + 1; // 下位シード
          match.homeTeamId = shuffledTeams[homeIndex].id;
          match.awayTeamId = shuffledTeams[awayIndex].id;
          match.status = 'ready'; // 対戦相手が決まっているので'ready'
        }

        // 次の試合への紐付けを設定
        if (round < totalRounds) {
          const nextRoundMatchNumber = Math.ceil(matchNumber / 2);
          const nextMatchKey = `${round + 1}-${nextRoundMatchNumber}`;
          match.nextMatchId = nextMatchKey; // 一時的にキーを保存
        }

        matchIdMap.set(`${round}-${matchNumber}`, matchId);
        matches.push(match);
      }
    }

    // 次の試合IDを実際のIDに変換
    matches.forEach(match => {
      if (match.nextMatchId && matchIdMap.has(match.nextMatchId)) {
        match.nextMatchId = matchIdMap.get(match.nextMatchId)!;
      } else if (match.nextMatchId) {
        match.nextMatchId = null; // 決勝戦の場合
      }
    });

    return matches;
  }

  getMatches(tournamentId: string): Match[] {
    const tournament = this.get(tournamentId);
    return tournament ? tournament.matches : [];
  }

  getCurrentStageMatches(tournamentId: string): Match[] {
    const matches = this.getMatches(tournamentId);
    if (matches.length === 0) return [];

    // 完了していない最初のステージを見つける
    const stages = [...new Set(matches.map(m => m.stage))].sort((a, b) => a - b);

    for (const stage of stages) {
      const stageMatches = matches.filter(m => m.stage === stage);
      const hasIncompleteMatch = stageMatches.some(m => m.status !== 'completed');

      if (hasIncompleteMatch) {
        return stageMatches;
      }
    }

    return [];
  }

  getMatch(matchId: string): Match | null {
    for (const tournament of this.tournaments.values()) {
      const match = tournament.matches.find(m => m.id === matchId);
      if (match) return match;
    }
    return null;
  }

  async updateMatch(match: Match): Promise<void> {
    const tournament = this.get(match.tournamentId);
    if (!tournament) {
      throw new Error('トーナメントが見つかりません');
    }

    const matchIndex = tournament.matches.findIndex(m => m.id === match.id);
    if (matchIndex === -1) {
      throw new Error('試合が見つかりません');
    }

    tournament.matches[matchIndex] = match;
    tournament.updatedAt = new Date();
    this.tournaments.set(tournament.id, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);
  }

  async updateTournament(tournament: Tournament): Promise<void> {
    tournament.updatedAt = new Date();
    this.tournaments.set(tournament.id, tournament);

    // データを保存
    await this.saveGuildData(tournament.guildId);
  }

  getActiveTournaments(guildId: string): Tournament[] {
    return Array.from(this.tournaments.values())
      .filter(tournament =>
        tournament.guildId === guildId &&
        (tournament.status === 'registration' || tournament.status === 'active'),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getCompletedTournaments(guildId: string): Tournament[] {
    return Array.from(this.tournaments.values())
      .filter(tournament =>
        tournament.guildId === guildId &&
        tournament.status === 'completed',
      )
      .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  }

  getReadyMatches(tournamentId: string): Match[] {
    const tournament = this.get(tournamentId);
    if (!tournament) return [];

    return tournament.matches.filter(m => m.status === 'ready');
  }

  getInProgressMatches(tournamentId: string): Match[] {
    const tournament = this.get(tournamentId);
    if (!tournament) return [];

    return tournament.matches.filter(m => m.status === 'in_progress');
  }

  getTournamentDisplayName(tournament: Tournament): string {
    const statusMap = {
      'draft': 'ドラフト',
      'registration': '登録受付中',
      'active': '進行中',
      'completed': '完了',
    };

    const currentStage = tournament.status === 'active'
      ? this.getStageDisplayName(tournament.currentStage, tournament.totalStages)
      : '';

    const teamInfo = tournament.status === 'registration'
      ? `${tournament.teams.length}/${tournament.teamCount}チーム`
      : `${tournament.teamCount}チーム`;

    return `${tournament.name} (${teamInfo}, ${statusMap[tournament.status]}${currentStage ? ` - ${currentStage}` : ''})`;
  }

  getMatchDisplayName(tournament: Tournament, match: Match): string {
    const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
    const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
    const stageName = this.getStageDisplayName(match.stage, tournament.totalStages);

    if (homeTeam && awayTeam) {
      return `${stageName} - 🏠 ${homeTeam.name} vs ${awayTeam.name} 🚀`;
    } else {
      return `${stageName} - 対戦相手決定待ち`;
    }
  }

  private findByNameAndGuild(name: string, guildId: string): Tournament | undefined {
    return Array.from(this.tournaments.values())
      .find(tournament =>
        tournament.name === name &&
        tournament.guildId === guildId,
      );
  }
}

export const tournamentService = new TournamentService();