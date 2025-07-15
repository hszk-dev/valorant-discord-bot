import { Match } from '../types/match.js';
import { Tournament } from '../types/tournament.js';
import { tournamentService } from './tournamentService.js';

export interface MatchResult {
  match: Match;
  winner: string;
  nextMatches: Match[];
  tournamentCompleted: boolean;
}

export interface TournamentStatus {
  isCompleted: boolean;
  currentRound: number;
  totalRounds: number;
  champion?: string;
  runnerUp?: string;
}

export class MatchService {
  /**
   * Valorantの正確なスコア検証
   * - 通常勝利: いずれかが13ラウンド & 相手が12ラウンド以下
   * - オーバータイム勝利: 両者が12ラウンド以上 & 2ラウンド差
   */
  isValidValorantScore(rounds1: number, rounds2: number): boolean {
    // 基本検証: 0以上の整数
    if (rounds1 < 0 || rounds2 < 0 || !Number.isInteger(rounds1) || !Number.isInteger(rounds2)) {
      return false;
    }

    // 両者同スコアは無効
    if (rounds1 === rounds2) {
      return false;
    }

    const higher = Math.max(rounds1, rounds2);
    const lower = Math.min(rounds1, rounds2);

    // 通常勝利: 13ラウンド先取 (相手は11以下)
    if (higher === 13 && lower <= 11) {
      return true;
    }

    // オーバータイム勝利: 両者12以上 & 2ラウンド差
    if (lower >= 12 && (higher - lower) >= 2) {
      return true;
    }

    return false;
  }

  /**
   * 勝者判定 ('home': ホームチーム, 'away': アウェイチーム, null: 引き分け)
   */
  getWinner(homeRounds: number, awayRounds: number): 'home' | 'away' | null {
    if (!this.isValidValorantScore(homeRounds, awayRounds)) {
      return null;
    }

    return homeRounds > awayRounds ? 'home' : 'away';
  }

  /**
   * 試合結果を報告し、トーナメントを進行
   */
  async reportMatchResult(
    tournamentId: string,
    matchId: string,
    homeRounds: number,
    awayRounds: number,
  ): Promise<MatchResult> {
    // スコア検証
    if (!this.isValidValorantScore(homeRounds, awayRounds)) {
      const higher = Math.max(homeRounds, awayRounds);
      const lower = Math.min(homeRounds, awayRounds);

      if (homeRounds === awayRounds) {
        throw new Error(`❌ 引き分けは無効です (${homeRounds}-${awayRounds})`);
      } else if (higher === 13 && lower === 12) {
        throw new Error(`❌ 12-12の場合はオーバータイムが必要です (${homeRounds}-${awayRounds})\n有効例: 14-12, 15-13など`);
      } else if (higher < 13) {
        throw new Error(`❌ 試合がまだ終了していません (${homeRounds}-${awayRounds})\n13ラウンド先取で勝利となります`);
      } else if (lower >= 12 && (higher - lower) === 1) {
        throw new Error(`❌ オーバータイムでは2ラウンド差が必要です (${homeRounds}-${awayRounds})\n有効例: 14-12, 15-13など`);
      } else {
        throw new Error(`❌ 無効なスコアです (${homeRounds}-${awayRounds})\n有効例: 13-11, 14-12, 15-13など`);
      }
    }

    const tournament = tournamentService.get(tournamentId);
    if (!tournament) {
      throw new Error('トーナメントが見つかりません');
    }

    if (tournament.status !== 'active') {
      throw new Error('このトーナメントはまだ開始されていません');
    }

    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {
      throw new Error('指定された試合が見つかりません');
    }

    if (match.status === 'completed') {
      throw new Error('この試合は既に完了しています');
    }

    if (!match.homeTeamId || !match.awayTeamId) {
      throw new Error('この試合はまだ対戦相手が決まっていません');
    }

    // 勝者判定
    const winnerSide = this.getWinner(homeRounds, awayRounds);
    const winnerId = winnerSide === 'home' ? match.homeTeamId : match.awayTeamId;
    const winnerTeam = tournament.teams.find(t => t.id === winnerId)!;

    // 試合結果を更新
    match.homeRounds = homeRounds;
    match.awayRounds = awayRounds;
    match.winnerId = winnerId;
    match.status = 'completed';
    match.completedAt = new Date();
    match.updatedAt = new Date();

    // 次の試合に勝者をセット
    const nextMatches: Match[] = [];
    if (match.nextMatchId) {
      const nextMatch = tournament.matches.find(m => m.id === match.nextMatchId);
      if (nextMatch) {
        // 次の試合の空いている席に勝者をセット
        if (!nextMatch.homeTeamId) {
          nextMatch.homeTeamId = winnerId;
        } else if (!nextMatch.awayTeamId) {
          nextMatch.awayTeamId = winnerId;
        }

        // 両チームが揃ったら'ready'状態に
        if (nextMatch.homeTeamId && nextMatch.awayTeamId && nextMatch.status === 'pending') {
          nextMatch.status = 'ready';
        }

        nextMatch.updatedAt = new Date();
        nextMatches.push(nextMatch);
      }
    }

    // トーナメント進行をチェック
    const tournamentStatus = await this.checkTournamentProgress(tournament);

    // データ保存
    await tournamentService.updateTournament(tournament);

    return {
      match,
      winner: winnerTeam.name,
      nextMatches,
      tournamentCompleted: tournamentStatus.isCompleted,
    };
  }

  /**
   * トーナメントの進行状況をチェック
   */
  async checkTournamentProgress(tournament: Tournament): Promise<TournamentStatus> {
    const totalStages = tournament.totalStages;
    const stages = [...new Set(tournament.matches.map(m => m.stage))].sort((a, b) => a - b);

    let currentStage = 1;
    let isCompleted = false;
    let champion: string | undefined;
    let runnerUp: string | undefined;

    // 各ステージの完了状況をチェック
    for (const stage of stages) {
      const stageMatches = tournament.matches.filter(m => m.stage === stage);
      const completedMatches = stageMatches.filter(m => m.status === 'completed');

      if (completedMatches.length < stageMatches.length) {
        // このステージはまだ完了していない
        break;
      }

      currentStage = stage + 1;

      // 決勝戦が完了した場合
      if (stage === totalStages) {
        isCompleted = true;
        const finalMatch = stageMatches[0]; // 決勝戦
        if (finalMatch.winnerId) {
          const championTeam = tournament.teams.find(t => t.id === finalMatch.winnerId);
          const runnerUpTeam = tournament.teams.find(t =>
            t.id === (finalMatch.homeTeamId === finalMatch.winnerId ? finalMatch.awayTeamId : finalMatch.homeTeamId),
          );
          champion = championTeam?.name;
          runnerUp = runnerUpTeam?.name;
        }

        // トーナメント完了処理
        tournament.status = 'completed';
        tournament.completedAt = new Date();
        tournament.updatedAt = new Date();
        break;
      }
    }

    tournament.currentStage = Math.min(currentStage, totalStages);

    return {
      isCompleted,
      currentRound: tournament.currentStage,
      totalRounds: totalStages,
      champion,
      runnerUp,
    };
  }
}

export const matchService = new MatchService();