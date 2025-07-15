import { CommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command.js';
import { riotApiService } from '../services/riotApiService.js';
import { PlayerProfile, parseRiotId } from '../types/riot.js';
import { dataService } from '../services/dataService.js';

export class PlayerDataService {
  private players = new Map<string, PlayerProfile>();
  private guildPlayers = new Map<string, Map<string, PlayerProfile>>();

  async initialize(): Promise<void> {
    console.log('🔄 プレイヤーサービスを初期化中...');
    const allData = await dataService.loadAllPlayerData();

    // 各Guildのプレイヤーをメモリに読み込み
    for (const [guildId, playerList] of allData) {
      const guildPlayerMap = new Map<string, PlayerProfile>();
      for (const player of playerList) {
        this.players.set(player.discordId, player);
        guildPlayerMap.set(player.discordId, player);
      }
      this.guildPlayers.set(guildId, guildPlayerMap);
    }

    console.log(`✅ ${this.players.size}件のプレイヤーを読み込みました`);
  }

  private async saveGuildData(guildId: string): Promise<void> {
    const guildPlayerMap = this.guildPlayers.get(guildId);
    if (guildPlayerMap) {
      const players = Array.from(guildPlayerMap.values());
      await dataService.savePlayers(guildId, players);
    }
  }

  async savePlayer(player: PlayerProfile, guildId: string): Promise<void> {
    this.players.set(player.discordId, player);

    // Guild別のマップも更新
    if (!this.guildPlayers.has(guildId)) {
      this.guildPlayers.set(guildId, new Map());
    }
    this.guildPlayers.get(guildId)!.set(player.discordId, player);

    // データを保存
    await this.saveGuildData(guildId);
    console.log(`💾 プレイヤー ${player.riotId} を保存しました`);
  }

  getPlayer(discordId: string): PlayerProfile | undefined {
    return this.players.get(discordId);
  }

  getAllPlayers(): PlayerProfile[] {
    return Array.from(this.players.values());
  }

  getGuildPlayers(guildId: string): PlayerProfile[] {
    const guildPlayerMap = this.guildPlayers.get(guildId);
    return guildPlayerMap ? Array.from(guildPlayerMap.values()) : [];
  }

  async deletePlayer(discordId: string, guildId: string): Promise<boolean> {
    const existed = this.players.delete(discordId);

    // Guild別のマップからも削除
    const guildPlayerMap = this.guildPlayers.get(guildId);
    if (guildPlayerMap) {
      guildPlayerMap.delete(discordId);
      await this.saveGuildData(guildId);
    }

    if (existed) {
      console.log(`🗑️ プレイヤー ${discordId} を削除しました`);
    }
    return existed;
  }

  findPlayerByRiotId(riotId: string, guildId?: string): PlayerProfile | undefined {
    if (guildId) {
      const guildPlayerMap = this.guildPlayers.get(guildId);
      if (guildPlayerMap) {
        return Array.from(guildPlayerMap.values()).find(p => p.riotId === riotId);
      }
    }
    return Array.from(this.players.values()).find(p => p.riotId === riotId);
  }
}

const playerDataService = new PlayerDataService();

export const player: Command = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('プレイヤー管理コマンド')
    .addSubcommand(subcommand =>
      subcommand
        .setName('register')
        .setDescription('Riot IDを登録してアカウントを認証します')
        .addStringOption(option =>
          option
            .setName('riot-id')
            .setDescription('あなたのRiot ID（例: PlayerName#1234）')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('verify')
        .setDescription('登録済みのRiot IDを再認証します'),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('profile')
        .setDescription('プレイヤープロフィールを表示します')
        .addUserOption(option =>
          option
            .setName('player')
            .setDescription('プロフィールを表示するプレイヤー（省略時は自分）')
            .setRequired(false),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlink')
        .setDescription('Riot IDの紐付けを解除します'),
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
    case 'register':
      await handleRegisterCommand(interaction);
      break;
    case 'verify':
      await handleVerifyCommand(interaction);
      break;
    case 'profile':
      await handleProfileCommand(interaction);
      break;
    case 'unlink':
      await handleUnlinkCommand(interaction);
      break;
    }
  },
};

async function handleRegisterCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const riotId = interaction.options.getString('riot-id', true);
  const discordId = interaction.user.id;

  try {
    // Check if user is already registered
    const existingPlayer = playerDataService.getPlayer(discordId);
    if (existingPlayer) {
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle('⚠️ 既に登録済みです')
        .setDescription(`あなたは既に **${existingPlayer.riotId}** として登録されています。`)
        .addFields(
          { name: '変更する場合', value: '`/player unlink` で解除後、再度登録してください。', inline: false },
          { name: '再認証する場合', value: '`/player verify` をお使いください。', inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Check if Riot ID is already registered by someone else
    const existingRiotPlayer = playerDataService.findPlayerByRiotId(riotId, interaction.guildId!);
    if (existingRiotPlayer) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Riot ID は既に使用されています')
        .setDescription('この Riot ID は既に他のユーザーによって登録されています。')
        .addFields(
          { name: '確認事項', value: '• 正しい Riot ID を入力していますか？\n• 他のアカウントで既に登録していませんか？', inline: false },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // Verify Riot ID with API
    const verificationResult = await riotApiService.verifyRiotId(riotId);

    if (!verificationResult.success || !verificationResult.data) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ 認証失敗')
        .setDescription(verificationResult.error?.message || '不明なエラーが発生しました')
        .addFields(
          { name: '確認事項', value: '• Riot ID の形式: `PlayerName#1234`\n• 大文字小文字を正確に入力\n• スペルミスがないか確認', inline: false },
          { name: 'サポート', value: 'Riot Games のアカウントが有効であることを確認してください。', inline: false },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const account = verificationResult.data;
    const parsed = parseRiotId(riotId);

    if (!parsed) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Riot ID 解析エラー')
        .setDescription('Riot ID の解析に失敗しました。形式を確認してください。')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Create player profile
    const playerProfile: PlayerProfile = {
      discordId,
      riotId,
      puuid: account.puuid,
      region: account.region || 'unknown', // Use the detected region
      gameName: parsed.gameName,
      tagLine: parsed.tagLine,
      verifiedAt: new Date(),
      lastVerified: new Date(),
    };

    // Save player profile
    await playerDataService.savePlayer(playerProfile, interaction.guildId!);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Riot ID 登録完了')
      .setDescription(`**${riotId}** の認証が完了しました！`)
      .addFields(
        { name: '🎮 プレイヤー名', value: `${parsed.gameName}#${parsed.tagLine}`, inline: true },
        { name: '🔗 Discord連携', value: `<@${discordId}>`, inline: true },
        { name: '📅 登録日時', value: playerProfile.verifiedAt.toLocaleString('ja-JP'), inline: false },
      )
      .addFields(
        { name: '🚀 次のステップ', value: '• `/player profile` でプロフィール確認\n• トーナメント参加時に自動認証されます', inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
    console.error('Player registration error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ 登録エラー')
      .setDescription(`登録処理中にエラーが発生しました: ${errorMessage}`)
      .setTimestamp();

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

async function handleVerifyCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const discordId = interaction.user.id;
  const existingPlayer = playerDataService.getPlayer(discordId);

  if (!existingPlayer) {
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ 未登録です')
      .setDescription('まずは `/player register` でRiot IDを登録してください。')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    // Re-verify the Riot ID
    const verificationResult = await riotApiService.verifyRiotId(existingPlayer.riotId);

    if (!verificationResult.success) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ 再認証失敗')
        .setDescription(verificationResult.error?.message || '認証に失敗しました')
        .addFields(
          { name: '対処方法', value: '• Riot Games のアカウントが有効か確認\n• `/player unlink` で解除後、再登録を検討', inline: false },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Update last verified time
    existingPlayer.lastVerified = new Date();
    await playerDataService.savePlayer(existingPlayer, interaction.guildId!);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ 再認証完了')
      .setDescription(`**${existingPlayer.riotId}** の再認証が完了しました！`)
      .addFields(
        { name: '📅 最終認証', value: existingPlayer.lastVerified.toLocaleString('ja-JP'), inline: true },
        { name: '🎮 アカウント', value: `${existingPlayer.gameName}#${existingPlayer.tagLine}`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
    console.error('Player verification error:', error);

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ 再認証エラー')
      .setDescription(`再認証処理中にエラーが発生しました: ${errorMessage}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleProfileCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const targetUser = interaction.options.getUser('player') || interaction.user;
  const targetPlayer = playerDataService.getPlayer(targetUser.id);

  if (!targetPlayer) {
    const isOwn = targetUser.id === interaction.user.id;
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ プロフィール未登録')
      .setDescription(
        isOwn
          ? 'あなたのプロフィールが見つかりません。'
          : `${targetUser.username} のプロフィールが見つかりません。`,
      )
      .addFields(
        { name: '登録方法', value: '`/player register riot-id:YourName#1234` でRiot IDを登録してください。', inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`🎮 ${targetPlayer.gameName}#${targetPlayer.tagLine}`)
    .setDescription(`<@${targetUser.id}> のプレイヤープロフィール`)
    .addFields(
      { name: '🎯 Riot ID', value: targetPlayer.riotId, inline: true },
      { name: '📅 登録日', value: targetPlayer.verifiedAt.toLocaleDateString('ja-JP'), inline: true },
      { name: '🔄 最終認証', value: targetPlayer.lastVerified.toLocaleDateString('ja-JP'), inline: true },
    );

  // Try to get current rank (likely to fail with development key)
  try {
    if (targetPlayer.currentRank) {
      embed.addFields(
        { name: '🏆 現在のランク', value: targetPlayer.currentRank.currentTierPatched, inline: true },
        { name: '📊 Rating', value: targetPlayer.currentRank.ranking_in_tier.toString(), inline: true },
      );
    } else {
      embed.addFields(
        { name: '🏆 ランク情報', value: 'Production APIキーが必要です', inline: false },
      );
    }
  } catch {
    embed.addFields(
      { name: '🏆 ランク情報', value: '現在取得できません', inline: false },
    );
  }

  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleUnlinkCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const discordId = interaction.user.id;
  const existingPlayer = playerDataService.getPlayer(discordId);

  if (!existingPlayer) {
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ 登録されていません')
      .setDescription('削除する Riot ID の登録が見つかりません。')
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await playerDataService.deletePlayer(discordId, interaction.guildId!);

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('✅ 紐付け解除完了')
    .setDescription(`**${existingPlayer.riotId}** の紐付けを解除しました。`)
    .addFields(
      { name: '再登録', value: '`/player register` で再度登録できます。', inline: false },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Export the player data service for use in other commands
export { playerDataService };