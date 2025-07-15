import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { RiotConfig } from '../config/riotConfig.js';
import {
  RiotAccount,
  ValorantRank,
  PlayerSearchResult,
  RiotApiResponse,
  RateLimitInfo,
  RiotRegion,
  parseRiotId,
  isValidRiotId,
  getTierName,
} from '../types/riot.js';

export class RiotApiService {
  private static instance: RiotApiService;
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private riotConfig: RiotConfig | null = null;

  private constructor() {
    // Delay riotConfig initialization until first use
  }

  private getRiotConfig(): RiotConfig {
    if (!this.riotConfig) {
      this.riotConfig = RiotConfig.getInstance();
      if (!this.getRiotConfig().validateApiKey()) {
        console.warn('⚠️ Riot API Key not configured or invalid');
      }
    }
    return this.riotConfig;
  }

  public static getInstance(): RiotApiService {
    if (!RiotApiService.instance) {
      RiotApiService.instance = new RiotApiService();
    }
    return RiotApiService.instance;
  }

  private createAxiosInstance(region: string): AxiosInstance {
    const config = this.getRiotConfig();
    const baseURL = config.getAccountUrl(region);

    return axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'X-Riot-Token': config.getApiKey(),
        'Content-Type': 'application/json',
      },
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      // eslint-disable-next-line no-undef
      setTimeout(resolve, ms);
    });
  }

  private updateRateLimitInfo(region: string, headers: any): void {
    this.rateLimitInfo.set(region, {
      appRateLimit: headers['x-app-rate-limit'],
      appRateLimitCount: headers['x-app-rate-limit-count'],
      methodRateLimit: headers['x-method-rate-limit'],
      methodRateLimitCount: headers['x-method-rate-limit-count'],
      retryAfter: headers['retry-after'],
    });
  }

  private async handleRateLimit(error: AxiosError): Promise<boolean> {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : this.getRiotConfig().getRateLimit().retryAfter;

      console.log(`⏳ Rate limited. Waiting ${waitTime}ms...`);
      await this.delay(waitTime);
      return true;
    }
    return false;
  }

  private async makeRequest<T>(
    region: string,
    endpoint: string,
    retries = 0,
  ): Promise<RiotApiResponse<T>> {
    try {
      const client = this.createAxiosInstance(region);
      const response: AxiosResponse<T> = await client.get(endpoint);

      this.updateRateLimitInfo(region, response.headers);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle rate limiting
      if (await this.handleRateLimit(axiosError) && retries < this.getRiotConfig().getRateLimit().maxRetries) {
        return this.makeRequest<T>(region, endpoint, retries + 1);
      }

      // Handle other errors
      const status = axiosError.response?.status || 0;
      const message = this.getErrorMessage(status);

      return {
        success: false,
        error: {
          code: status,
          message,
          details: axiosError.response?.data,
        },
      };
    }
  }

  private getErrorMessage(status: number): string {
    switch (status) {
    case 400:
      return 'リクエストが無効です。Riot IDの形式を確認してください。';
    case 401:
      return 'API Keyが無効または期限切れです。管理者にお問い合わせください。';
    case 403:
      return 'API アクセス権限がありません。';
    case 404:
      return 'プレイヤーが見つかりません。Riot IDを確認してください。';
    case 429:
      return 'リクエスト制限に達しました。しばらくお待ちください。';
    case 500:
    case 502:
    case 503:
      return 'Riot APIサーバーに問題が発生しています。しばらくお待ちください。';
    default:
      return `予期しないエラーが発生しました（ステータス: ${status}）。`;
    }
  }

  public async verifyRiotId(riotId: string): Promise<RiotApiResponse<RiotAccount>> {
    if (!isValidRiotId(riotId)) {
      return {
        success: false,
        error: {
          code: 400,
          message: 'Riot IDの形式が正しくありません。例: PlayerName#1234',
        },
      };
    }

    if (!this.getRiotConfig().validateApiKey()) {
      return {
        success: false,
        error: {
          code: 401,
          message: 'Riot API Keyが設定されていません。',
        },
      };
    }

    const parsed = parseRiotId(riotId);
    if (!parsed) {
      return {
        success: false,
        error: {
          code: 400,
          message: 'Riot IDの解析に失敗しました。',
        },
      };
    }

    // Try all regions
    const regions: RiotRegion[] = ['americas', 'europe', 'asia'];

    for (const region of regions) {
      try {
        const endpoint = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`;
        const result = await this.makeRequest<RiotAccount>(region, endpoint);

        if (result.success && result.data) {
          // Debug log only in development
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🌍 Player ${parsed.gameName}#${parsed.tagLine} found in region: ${region}`);
          }
          return {
            success: true,
            data: {
              ...result.data,
              // Ensure the response includes the formatted names and region
              gameName: parsed.gameName,
              tagLine: parsed.tagLine,
              region: region, // Add the region where the player was found
            },
          };
        }
      } catch {
        console.log(`Failed to find player in ${region}, trying next region...`);
      }
    }

    return {
      success: false,
      error: {
        code: 404,
        message: 'プレイヤーが見つかりません。すべての地域で検索しましたが、該当するアカウントがありませんでした。',
      },
    };
  }

  public async getPlayerRank(puuid: string, region: RiotRegion): Promise<RiotApiResponse<ValorantRank>> {
    if (!this.getRiotConfig().validateApiKey()) {
      return {
        success: false,
        error: {
          code: 401,
          message: 'Riot API Keyが設定されていません。',
        },
      };
    }

    // Note: This endpoint might not be available in the public API
    // This is a placeholder for when Tournament API access is available
    const endpoint = `/val/ranked/v1/leaderboards/by-act/${puuid}`;

    try {
      const result = await this.makeRequest<any>(region, endpoint);

      if (result.success && result.data) {
        // Transform the response to our ValorantRank format
        const rankData: ValorantRank = {
          currentTier: result.data.currentTier || 0,
          currentTierPatched: getTierName(result.data.currentTier || 0),
          ranking_in_tier: result.data.ranking_in_tier || 0,
          mmr_change_to_last_game: result.data.mmr_change_to_last_game,
          elo: result.data.elo || 0,
          games_needed_for_rating: result.data.games_needed_for_rating || 0,
          old: false,
        };

        return {
          success: true,
          data: rankData,
        };
      }
    } catch {
      console.log('Rank data not available with current API access level');
    }

    // Return a placeholder response when rank data is not available
    return {
      success: false,
      error: {
        code: 503,
        message: 'ランク情報は現在利用できません。Production APIキーが必要です。',
      },
    };
  }

  public async searchPlayerByRiotId(riotId: string): Promise<RiotApiResponse<PlayerSearchResult>> {
    const accountResult = await this.verifyRiotId(riotId);

    if (!accountResult.success || !accountResult.data) {
      return {
        success: false,
        error: accountResult.error,
      };
    }

    const account = accountResult.data;

    // Use the region where the player was found
    const region: RiotRegion = (account.region as RiotRegion) || 'americas';

    const searchResult: PlayerSearchResult = {
      account,
      region,
    };

    // Try to get rank data (will likely fail with development key)
    try {
      const rankResult = await this.getPlayerRank(account.puuid, region);
      if (rankResult.success && rankResult.data) {
        searchResult.rank = rankResult.data;
      }
    } catch {
      // Rank data not available, continue without it
      console.log('Rank data not available for player');
    }

    return {
      success: true,
      data: searchResult,
    };
  }

  public async validateConnection(): Promise<RiotApiResponse<boolean>> {
    if (!this.getRiotConfig().validateApiKey()) {
      return {
        success: false,
        error: {
          code: 401,
          message: 'Riot API Keyが設定されていません。',
        },
      };
    }

    // Test connection with a simple endpoint
    try {
      const testRiotId = 'TestPlayer#1234'; // Use a known non-existent account for testing
      const result = await this.verifyRiotId(testRiotId);

      // If we get a 404, the API is working but the player doesn't exist - this is good
      if (!result.success && result.error?.code === 404) {
        return {
          success: true,
          data: true,
        };
      }

      // If we get the player (shouldn't happen with test name), that's also good
      if (result.success) {
        return {
          success: true,
          data: true,
        };
      }

      // Other errors indicate API issues
      return {
        success: false,
        error: result.error,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 500,
          message: 'Riot APIとの接続に失敗しました。',
        },
      };
    }
  }

  public getRateLimitStatus(region: string): RateLimitInfo | null {
    return this.rateLimitInfo.get(region) || null;
  }
}

export const riotApiService = RiotApiService.getInstance();