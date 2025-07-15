export interface RiotApiConfig {
  apiKey: string;
  baseUrls: {
    account: string;
    valorant: string;
  };
  regions: {
    americas: string;
    europe: string;
    asia: string;
  };
  rateLimit: {
    requestsPerSecond: number;
    requestsPer2Minutes: number;
    retryAfter: number;
    maxRetries: number;
  };
}

export class RiotConfig {
  private static instance: RiotConfig;
  private config: RiotApiConfig;

  private constructor() {
    const apiKey = process.env.RIOT_API_KEY || 'not-configured';

    this.config = {
      apiKey,
      baseUrls: {
        account: 'https://{region}.api.riotgames.com',
        valorant: 'https://{region}.api.riotgames.com',
      },
      regions: {
        americas: 'americas',
        europe: 'europe',
        asia: 'asia',
      },
      rateLimit: {
        requestsPerSecond: 20,
        requestsPer2Minutes: 100,
        retryAfter: 1000, // 1秒
        maxRetries: 3,
      },
    };
  }

  public static getInstance(): RiotConfig {
    if (!RiotConfig.instance) {
      RiotConfig.instance = new RiotConfig();
    }
    return RiotConfig.instance;
  }

  public getConfig(): RiotApiConfig {
    return this.config;
  }

  public getApiKey(): string {
    return this.config.apiKey;
  }

  public getAccountUrl(region: string): string {
    return this.config.baseUrls.account.replace('{region}', region);
  }

  public getValorantUrl(region: string): string {
    return this.config.baseUrls.valorant.replace('{region}', region);
  }

  public getAllRegions(): string[] {
    return Object.values(this.config.regions);
  }

  public getRateLimit() {
    return this.config.rateLimit;
  }

  public validateApiKey(): boolean {
    return this.config.apiKey.length > 0 &&
           this.config.apiKey !== 'your-riot-api-key-here' &&
           this.config.apiKey !== 'not-configured';
  }
}

// riotConfig instance will be created after dotenv is loaded
export let riotConfig: RiotConfig;