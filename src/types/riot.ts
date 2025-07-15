// Riot Account API Types
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
  region?: string; // Added to track which region the account was found in
}

// Valorant Rank API Types
export interface ValorantRank {
  currentTier: number;
  currentTierPatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game?: number;
  elo: number;
  games_needed_for_rating: number;
  old: boolean;
}

export interface ValorantPlayerStats {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: {
    small: string;
    large: string;
    wide: string;
    id: string;
  };
  last_update: string;
  last_update_raw: number;
}

// Player Profile for our database
export interface PlayerProfile {
  discordId: string;
  riotId: string; // "PlayerName#1234"
  puuid: string; // Riot内部ID
  region: string; // "americas"
  gameName: string; // "PlayerName"
  tagLine: string; // "1234"

  // ランク情報（キャッシュ）
  currentRank?: ValorantRank;
  lastRankUpdate?: Date;

  // 認証情報
  verifiedAt: Date;
  lastVerified: Date;

  // 統計情報
  gamesPlayed?: number;
  winRate?: number;
}

// API Response Types
export interface RiotApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
}

// API Error Types
export interface RiotApiError {
  status: {
    message: string;
    status_code: number;
  };
}

// Rate limiting types
export interface RateLimitInfo {
  appRateLimit?: string;
  appRateLimitCount?: string;
  methodRateLimit?: string;
  methodRateLimitCount?: string;
  retryAfter?: string;
}

// Search result type
export interface PlayerSearchResult {
  account: RiotAccount;
  region: string;
  stats?: ValorantPlayerStats;
  rank?: ValorantRank;
}

// Region mapping
export type RiotRegion = 'americas' | 'europe' | 'asia';

// Valorant tiers mapping
export const VALORANT_TIERS: Record<number, string> = {
  0: 'Unrated',
  3: 'Iron 1',
  4: 'Iron 2',
  5: 'Iron 3',
  6: 'Bronze 1',
  7: 'Bronze 2',
  8: 'Bronze 3',
  9: 'Silver 1',
  10: 'Silver 2',
  11: 'Silver 3',
  12: 'Gold 1',
  13: 'Gold 2',
  14: 'Gold 3',
  15: 'Platinum 1',
  16: 'Platinum 2',
  17: 'Platinum 3',
  18: 'Diamond 1',
  19: 'Diamond 2',
  20: 'Diamond 3',
  21: 'Ascendant 1',
  22: 'Ascendant 2',
  23: 'Ascendant 3',
  24: 'Immortal 1',
  25: 'Immortal 2',
  26: 'Immortal 3',
  27: 'Radiant',
};

// Helper functions for types
export function parseRiotId(riotId: string): { gameName: string; tagLine: string } | null {
  const match = riotId.match(/^(.+)#(.+)$/);
  if (!match) return null;

  return {
    gameName: match[1],
    tagLine: match[2],
  };
}

export function formatRiotId(gameName: string, tagLine: string): string {
  return `${gameName}#${tagLine}`;
}

export function getTierName(tier: number): string {
  return VALORANT_TIERS[tier] || 'Unknown';
}

export function isValidRiotId(riotId: string): boolean {
  const parsed = parseRiotId(riotId);
  if (!parsed) return false;

  // Basic validation
  return parsed.gameName.length >= 3 &&
         parsed.gameName.length <= 16 &&
         parsed.tagLine.length >= 3 &&
         parsed.tagLine.length <= 5 &&
         /^[a-zA-Z0-9\s]+$/.test(parsed.gameName) &&
         /^[a-zA-Z0-9]+$/.test(parsed.tagLine);
}