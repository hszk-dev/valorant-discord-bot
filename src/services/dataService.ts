import { promises as fs } from 'fs';
import { join } from 'path';
import { Tournament } from '../types/tournament.js';
import { PlayerProfile } from '../types/riot.js';

export class DataService {
  private readonly dataDir = 'data';

  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataDir);
    } catch {
      try {
        await fs.mkdir(this.dataDir, { recursive: true });
        console.log('📁 データディレクトリを作成しました:', this.dataDir);
      } catch (error) {
        console.warn('⚠️ データディレクトリの作成に失敗:', error);
      }
    }
  }

  private getFilePath(guildId: string): string {
    return join(this.dataDir, `${guildId}_tournaments.json`);
  }

  private getPlayersFilePath(guildId: string): string {
    return join(this.dataDir, `${guildId}_players.json`);
  }

  async saveTournaments(guildId: string, tournaments: Tournament[]): Promise<void> {
    try {
      await this.ensureDataDirectory();
      const filePath = this.getFilePath(guildId);
      const data = JSON.stringify(tournaments, null, 2);
      await fs.writeFile(filePath, data, 'utf8');
      console.log(`💾 トーナメントデータを保存しました: ${filePath}`);
    } catch (error) {
      console.warn('⚠️ データ保存に失敗しました:', error);
    }
  }

  async loadTournaments(guildId: string): Promise<Tournament[]> {
    try {
      const filePath = this.getFilePath(guildId);
      const data = await fs.readFile(filePath, 'utf8');
      const tournaments = JSON.parse(data) as Tournament[];

      // Date objectsを復元
      tournaments.forEach(tournament => {
        tournament.createdAt = new Date(tournament.createdAt);
        tournament.updatedAt = new Date(tournament.updatedAt);
        tournament.teams.forEach(team => {
          team.registeredAt = new Date(team.registeredAt);
        });
        tournament.matches.forEach(match => {
          match.createdAt = new Date(match.createdAt);
          match.updatedAt = new Date(match.updatedAt);
        });
      });

      console.log(`📖 トーナメントデータを読み込みました: ${tournaments.length}件 (${guildId})`);
      return tournaments;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`📄 新規サーバーです: ${guildId}`);
      } else {
        console.warn('⚠️ データ読み込みに失敗しました:', error);
      }
      return [];
    }
  }

  async loadAllData(): Promise<Map<string, Tournament[]>> {
    const allData = new Map<string, Tournament[]>();

    try {
      await this.ensureDataDirectory();
      const files = await fs.readdir(this.dataDir);
      const tournamentFiles = files.filter(file => file.endsWith('_tournaments.json'));

      console.log(`📚 ${tournamentFiles.length}個のデータファイルを発見しました`);

      for (const file of tournamentFiles) {
        const guildId = file.replace('_tournaments.json', '');
        const tournaments = await this.loadTournaments(guildId);
        if (tournaments.length > 0) {
          allData.set(guildId, tournaments);
        }
      }

      const totalTournaments = Array.from(allData.values()).reduce((sum, tournaments) => sum + tournaments.length, 0);
      console.log(`✅ 合計 ${totalTournaments}件のトーナメントを読み込みました`);

    } catch (error) {
      console.warn('⚠️ 全データ読み込みに失敗しました:', error);
    }

    return allData;
  }

  async savePlayers(guildId: string, players: PlayerProfile[]): Promise<void> {
    try {
      await this.ensureDataDirectory();
      const filePath = this.getPlayersFilePath(guildId);
      const data = JSON.stringify(players, null, 2);
      await fs.writeFile(filePath, data, 'utf8');
      console.log(`💾 プレイヤーデータを保存しました: ${filePath}`);
    } catch (error) {
      console.warn('⚠️ プレイヤーデータ保存に失敗しました:', error);
    }
  }

  async loadPlayers(guildId: string): Promise<PlayerProfile[]> {
    try {
      const filePath = this.getPlayersFilePath(guildId);
      const data = await fs.readFile(filePath, 'utf8');
      const players = JSON.parse(data) as PlayerProfile[];

      // Date objectsを復元
      players.forEach(player => {
        player.verifiedAt = new Date(player.verifiedAt);
        player.lastVerified = new Date(player.lastVerified);
        if (player.lastRankUpdate) {
          player.lastRankUpdate = new Date(player.lastRankUpdate);
        }
      });

      console.log(`📖 プレイヤーデータを読み込みました: ${players.length}件 (${guildId})`);
      return players;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`📄 新規サーバーのプレイヤーデータです: ${guildId}`);
      } else {
        console.warn('⚠️ プレイヤーデータ読み込みに失敗しました:', error);
      }
      return [];
    }
  }

  async loadAllPlayerData(): Promise<Map<string, PlayerProfile[]>> {
    const allData = new Map<string, PlayerProfile[]>();

    try {
      await this.ensureDataDirectory();
      const files = await fs.readdir(this.dataDir);
      const playerFiles = files.filter(file => file.endsWith('_players.json'));

      console.log(`📚 ${playerFiles.length}個のプレイヤーデータファイルを発見しました`);

      for (const file of playerFiles) {
        const guildId = file.replace('_players.json', '');
        const players = await this.loadPlayers(guildId);
        if (players.length > 0) {
          allData.set(guildId, players);
        }
      }

      const totalPlayers = Array.from(allData.values()).reduce((sum, players) => sum + players.length, 0);
      console.log(`✅ 合計 ${totalPlayers}件のプレイヤーを読み込みました`);

    } catch (error) {
      console.warn('⚠️ 全プレイヤーデータ読み込みに失敗しました:', error);
    }

    return allData;
  }
}

export const dataService = new DataService();