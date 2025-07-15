import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../types/command.js';
import { tournamentService } from '../services/tournamentService.js';
import { playerDataService } from './player.js';

export const team: Command = {
  data: new SlashCommandBuilder()
    .setName('team')
    .setDescription('チーム管理コマンド')
    .addSubcommand(subcommand =>
      subcommand
        .setName('register')
        .setDescription('トーナメントにチームを登録します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('チーム名（2-30文字）')
            .setRequired(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('トーナメントの参加チーム一覧を表示します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'register') {
      await handleRegisterCommand(interaction);
    } else if (subcommand === 'list') {
      await handleListCommand(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (focusedOption.name === 'tournament-id') {
      let tournaments;

      if (subcommand === 'register') {
        // 登録用では登録受付中のトーナメントのみ表示
        tournaments = tournamentService.list(interaction.guildId!)
          .filter(tournament => tournament.status === 'registration');
      } else {
        // 一覧表示では全てのアクティブトーナメント表示
        tournaments = tournamentService.getActiveTournaments(interaction.guildId!);
      }

      const choices = tournaments
        .filter(tournament =>
          tournament.id.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
          tournament.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25)
        .map(tournament => ({
          name: tournamentService.getTournamentDisplayName(tournament),
          value: tournament.id,
        }));

      await interaction.respond(choices);
    } else {
      await interaction.respond([]);
    }
  },
};

async function handleRegisterCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);
  const teamName = interaction.options.getString('name', true);
  const discordId = interaction.user.id;

  // プレイヤー認証チェック
  const playerProfile = playerDataService.getPlayer(discordId);
  if (!playerProfile) {
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('⚠️ Riot ID 認証が必要です')
      .setDescription('チーム登録には事前にRiot IDの認証が必要です。')
      .addFields(
        { name: '📝 認証方法', value: '`/player register riot-id:YourName#1234` でRiot IDを登録してください。', inline: false },
        { name: '🔍 認証の利点', value: '• プレイヤー身元の確認\n• ランク情報の表示\n• 不正参加の防止', inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // 入力値検証
  if (teamName.length < 2) {
    await interaction.reply({
      content: '❌ チーム名は2文字以上で入力してください。',
      ephemeral: true,
    });
    return;
  }

  if (teamName.length > 30) {
    await interaction.reply({
      content: '❌ チーム名は30文字以下で入力してください。',
      ephemeral: true,
    });
    return;
  }

  try {
    const team = await tournamentService.registerTeam({
      tournamentId,
      name: teamName,
      captainId: interaction.user.id,
      captainName: interaction.user.username,
    });

    const tournament = tournamentService.get(tournamentId)!;
    const registrationOrder = tournament.teams.length;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ チーム登録完了')
      .addFields(
        { name: '🏆 チーム名', value: team.name, inline: true },
        { name: '👑 キャプテン', value: `<@${team.captainId}>`, inline: true },
        { name: '🎮 Riot ID', value: playerProfile.riotId, inline: true },
        { name: '🏟️ トーナメント', value: tournament.name, inline: true },
        { name: '📊 登録順', value: `${registrationOrder}/${tournament.teamCount}`, inline: true },
        { name: '✅ 認証状況', value: '認証済み', inline: true },
      )
      .addFields(
        { name: '🚀 次のステップ', value: tournament.teams.length === tournament.teamCount
          ? 'チーム登録が完了しました！トーナメント開始をお待ちください。'
          : `あと${tournament.teamCount - tournament.teams.length}チームの登録待ちです。`, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました。';

    await interaction.reply({
      content: `❌ ${errorMessage}`,
      ephemeral: true,
    });
  }
}

async function handleListCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);

  try {
    const tournament = tournamentService.get(tournamentId);
    if (!tournament) {
      await interaction.reply({
        content: '❌ トーナメントが見つかりません。IDを確認してください。',
        ephemeral: true,
      });
      return;
    }

    const teams = tournament.teams;

    if (teams.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`📋 ${tournament.name} - 参加チーム一覧`)
        .setDescription('まだ登録されているチームはありません。')
        .addFields(
          { name: '登録済み', value: `0/${tournament.teamCount}チーム`, inline: true },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const teamListText = teams
      .map((team, index) => {
        const playerProfile = playerDataService.getPlayer(team.captainId);
        const riotInfo = playerProfile ? ` (${playerProfile.riotId})` : ' (未認証)';
        return `${index + 1}. **${team.name}** - <@${team.captainId}>${riotInfo}`;
      })
      .join('\n');

    // 認証統計を計算
    const verifiedCaptains = teams.filter(team =>
      playerDataService.getPlayer(team.captainId),
    ).length;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📋 ${tournament.name} - 参加チーム一覧`)
      .setDescription(teamListText)
      .addFields(
        { name: '📊 登録済み', value: `${teams.length}/${tournament.teamCount}チーム`, inline: true },
        { name: '✅ 認証済み', value: `${verifiedCaptains}/${teams.length}キャプテン`, inline: true },
        { name: '🎮 認証率', value: `${teams.length > 0 ? Math.round((verifiedCaptains / teams.length) * 100) : 0}%`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期しないエラーが発生しました。';

    await interaction.reply({
      content: `❌ ${errorMessage}`,
      ephemeral: true,
    });
  }
}