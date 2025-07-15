import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../types/command.js';
import { matchService } from '../services/matchService.js';
import { tournamentService } from '../services/tournamentService.js';

export const match: Command = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('試合管理コマンド')
    .addSubcommand(subcommand =>
      subcommand
        .setName('report')
        .setDescription('試合結果を報告します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption(option =>
          option
            .setName('match-id')
            .setDescription('試合ID')
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addIntegerOption(option =>
          option
            .setName('home-rounds')
            .setDescription('🏠ホームチームのラウンド数（0-50）')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50),
        )
        .addIntegerOption(option =>
          option
            .setName('away-rounds')
            .setDescription('🚀アウェイチームのラウンド数（0-50）')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('進行中の試合一覧を表示します')
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

    if (subcommand === 'report') {
      await handleReportCommand(interaction);
    } else if (subcommand === 'list') {
      await handleListCommand(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'tournament-id') {
      // アクティブ + 完了済みトーナメントを取得
      const allTournaments = tournamentService.list(interaction.guildId!)
        .filter(tournament =>
          tournament.status === 'active' ||
          tournament.status === 'completed',
        );

      const choices = allTournaments
        .filter(tournament =>
          tournament.id.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
          tournament.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25) // Discord limits to 25 choices
        .map(tournament => ({
          name: tournamentService.getTournamentDisplayName(tournament),
          value: tournament.id,
        }));

      await interaction.respond(choices);
    } else if (focusedOption.name === 'match-id' && subcommand === 'report') {
      // tournament-idが先に入力されている場合のみマッチ候補を表示
      const tournamentId = interaction.options.getString('tournament-id');

      if (!tournamentId) {
        await interaction.respond([]);
        return;
      }

      const tournament = tournamentService.get(tournamentId);
      if (!tournament) {
        await interaction.respond([]);
        return;
      }

      // 実行可能なマッチのみを候補に表示
      const readyMatches = tournamentService.getReadyMatches(tournamentId);

      const choices = readyMatches
        .filter(match =>
          match.id.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25)
        .map(match => ({
          name: tournamentService.getMatchDisplayName(tournament, match),
          value: match.id,
        }));

      await interaction.respond(choices);
    } else {
      await interaction.respond([]);
    }
  },
};

async function handleReportCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);
  const matchId = interaction.options.getString('match-id', true);
  const homeRounds = interaction.options.getInteger('home-rounds', true);
  const awayRounds = interaction.options.getInteger('away-rounds', true);

  try {
    const result = await matchService.reportMatchResult(
      tournamentId,
      matchId,
      homeRounds,
      awayRounds,
    );

    const tournament = tournamentService.get(tournamentId)!;
    const homeTeam = tournament.teams.find(t => t.id === result.match.homeTeamId);
    const awayTeam = tournament.teams.find(t => t.id === result.match.awayTeamId);
    const stageName = tournamentService.getStageDisplayName(result.match.stage, tournament.totalStages);

    // 基本的な結果Embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('⚔️ マップ結果入力完了！')
      .addFields(
        { name: '🎮 マップ', value: `🏠 ${homeTeam?.name} vs ${awayTeam?.name} 🚀`, inline: false },
        { name: '📊 ラウンドスコア', value: `${homeRounds}-${awayRounds}`, inline: true },
        { name: '👑 勝者', value: result.winner, inline: true },
        { name: '🏆 ステージ', value: stageName, inline: true },
      )
      .setTimestamp();

    // トーナメント完了時の特別処理
    if (result.tournamentCompleted) {
      const finalMatch = result.match;
      const champion = result.winner;
      const runnerUpTeam = tournament.teams.find(t =>
        t.id === (finalMatch.homeTeamId === finalMatch.winnerId ? finalMatch.awayTeamId : finalMatch.homeTeamId),
      );

      const completionEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🎊 トーナメント完了！')
        .addFields(
          { name: '🏆 優勝', value: champion, inline: true },
          { name: '🥈 準優勝', value: runnerUpTeam?.name || 'Unknown', inline: true },
          { name: '📊 全試合完了', value: `${tournament.matches.filter(m => m.status === 'completed').length}試合`, inline: true },
        )
        .setDescription('━━━━━━━━━━━━━━━\nおめでとうございます！\n━━━━━━━━━━━━━━━')
        .setTimestamp();

      await interaction.reply({ embeds: [embed, completionEmbed] });
    } else {
      // 次の試合情報を追加
      if (result.nextMatches.length > 0) {
        const nextMatch = result.nextMatches[0];
        const nextHomeTeam = tournament.teams.find(t => t.id === nextMatch.homeTeamId);
        const nextAwayTeam = tournament.teams.find(t => t.id === nextMatch.awayTeamId);
        const nextStageName = tournamentService.getStageDisplayName(nextMatch.stage, tournament.totalStages);

        let nextMatchInfo = '次のマップが準備されました';
        if (nextHomeTeam && nextAwayTeam) {
          nextMatchInfo = `${nextStageName}: 🏠 ${nextHomeTeam.name} vs ${nextAwayTeam.name} 🚀`;
        } else {
          nextMatchInfo = `${nextStageName}: 相手の決定待ち`;
        }

        embed.addFields({
          name: '📅 次の対戦',
          value: nextMatchInfo,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    }

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

    if (tournament.status === 'draft' || tournament.status === 'registration') {
      await interaction.reply({
        content: '❌ このトーナメントはまだ開始されていません。',
        ephemeral: true,
      });
      return;
    }

    const readyMatches = tournamentService.getReadyMatches(tournamentId);
    const inProgressMatches = tournament.matches.filter(m => m.status === 'in_progress');
    const completedMatches = tournament.matches.filter(m => m.status === 'completed');

    if (readyMatches.length === 0 && inProgressMatches.length === 0) {
      if (tournament.status === 'completed') {
        // 完了済みトーナメントの場合は全試合結果を表示
        let completedMatchesText = '**🏆 完了済みマップ一覧:**\n';
        for (const match of completedMatches) {
          const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
          const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
          const stageName = tournamentService.getStageDisplayName(match.stage, tournament.totalStages);
          const scoreDisplay = `${match.homeRounds}-${match.awayRounds}`;
          completedMatchesText += `• ${stageName}: 🏠 ${homeTeam?.name} vs ${awayTeam?.name} 🚀 (${scoreDisplay})\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle(`🎮 ${tournament.name} - 全マップ結果`)
          .setDescription(completedMatchesText)
          .addFields(
            { name: '📊 トーナメント状況', value: '🏆 完了', inline: true },
            { name: '🎯 総マップ数', value: `${completedMatches.length}マップ`, inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({
          content: '✅ 現在進行中のマップはありません。',
          ephemeral: false,
        });
      }
      return;
    }

    let matchListText = '';

    // 実行可能なマップ
    if (readyMatches.length > 0) {
      matchListText += '**🎯 実行可能なマップ:**\n';
      for (const match of readyMatches) {
        const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
        const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
        const stageName = tournamentService.getStageDisplayName(match.stage, tournament.totalStages);
        matchListText += `• ID: \`${match.id}\` - 🏠 ${homeTeam?.name} vs ${awayTeam?.name} 🚀 (${stageName})\n`;
      }
      matchListText += '\n';
    }

    // 進行中のマップ
    if (inProgressMatches.length > 0) {
      matchListText += '**⚡ 進行中のマップ:**\n';
      for (const match of inProgressMatches) {
        const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
        const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
        const stageName = tournamentService.getStageDisplayName(match.stage, tournament.totalStages);
        matchListText += `• 🏠 ${homeTeam?.name} vs ${awayTeam?.name} 🚀 (${stageName})\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🎮 ${tournament.name} - マップ状況`)
      .setDescription(matchListText)
      .addFields(
        { name: '📊 進行状況', value: `${completedMatches.length}/${tournament.matches.length} マップ完了`, inline: true },
        { name: '🏆 現在ステージ', value: tournamentService.getStageDisplayName(tournament.currentStage, tournament.totalStages), inline: true },
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