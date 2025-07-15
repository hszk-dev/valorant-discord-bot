# Valorant Discord Bot

Valorantプレイヤー向けのDiscord Botです。トーナメント管理など、コミュニティ運営に必要な機能を提供します。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14-7289da.svg)
![TypeScript](https://img.shields.io/badge/typescript-%3E%3D5.8.3-blue.svg)

## 🎮 機能

### トーナメント管理
- **トーナメント作成**: 4/8/16チーム対応のシングルエリミネーション

### プレイヤー認証
- **Riot ID連携**: Riot Games APIによるプレイヤー認証
- **Discord統合**: Discord IDとRiot IDの紐付け


## 📋 必要要件

- Node.js v22.0.0以上
- pnpm（パッケージマネージャー）
- Discord Bot Token
- Riot Games API Key

## 🚀 セットアップ

### 1. リポジトリのクローン
```bash
git clone https://github.com/hszk-dev/valorant-discord-bot.git
cd valorant-discord-bot
```

### 2. 依存関係のインストール
```bash
pnpm install
```

### 3. 環境変数の設定
```bash
# .env.example を .env にコピー
cp .env.example .env

# .env ファイルを編集して必要な値を設定
# DISCORD_TOKEN=your-discord-bot-token
# CLIENT_ID=your-discord-client-id
# GUILD_ID=your-discord-guild-id
# RIOT_API_KEY=your-riot-api-key
```

### 4. コマンドの登録
```bash
# 開発用（特定のサーバーのみ）
pnpm run deploy
```

### 5. ボットの起動
```bash
# 開発モード
pnpm run dev
```

## 📝 コマンド一覧

### トーナメント管理
- `/tournament create` - 新規トーナメント作成
- `/tournament start-registration` - チーム登録受付開始
- `/tournament start` - トーナメント開始
- `/tournament bracket` - トーナメント表表示
- `/tournament list` - トーナメント一覧

### チーム管理
- `/team register` - チーム登録（認証済みプレイヤーのみ）
- `/team list` - 参加チーム一覧

### プレイヤー管理
- `/player register` - Riot ID登録・認証
- `/player profile` - プロフィール表示
- `/player verify` - 再認証
- `/player unlink` - 連携解除

### 試合管理
- `/match report` - 試合結果報告
- `/match list` - 試合一覧


### ディレクトリ構造
```
src/
├── commands/       # Discordスラッシュコマンド
├── services/       # ビジネスロジック
├── types/          # TypeScript型定義
├── config/         # 設定管理
└── utils/          # ユーティリティ関数
```

### スクリプト
```bash
pnpm run dev          # 開発サーバー起動
pnpm run build        # TypeScriptビルド
pnpm run lint         # ESLintチェック
pnpm run lint:fix     # ESLint自動修正
```

## 📜 ライセンス

MIT License

## 🔗 関連リンク

- [Discord.js Documentation](https://discord.js.org/)
- [Riot Developer Portal](https://developer.riotgames.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## ⚠️ 注意事項

- Riot API開発キーは24時間で期限切れになります
- ボットトークンは絶対に公開しないでください