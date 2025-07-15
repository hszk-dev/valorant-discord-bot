import { CommandInteraction, SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { Command } from '../types/command.js';
import { Tournament } from '../types/tournament.js';
import { tournamentService } from '../services/tournamentService.js';

export const tournament: Command = {
  data: new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('トーナメント管理コマンド')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('新しいトーナメントを作成します')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('トーナメント名（3-50文字）')
            .setRequired(true),
        )
        .addIntegerOption(option =>
          option
            .setName('teams')
            .setDescription('参加チーム数')
            .setRequired(true)
            .addChoices(
              { name: '4チーム', value: 4 },
              { name: '8チーム', value: 8 },
              { name: '16チーム', value: 16 },
            ),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start-registration')
        .setDescription('トーナメントの登録受付を開始します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('トーナメントを開始してブラケットを生成します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bracket')
        .setDescription('トーナメントのブラケット（対戦表）を表示します')
        .addStringOption(option =>
          option
            .setName('tournament-id')
            .setDescription('トーナメントID')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('トーナメント一覧を表示します')
        .addStringOption(option =>
          option
            .setName('filter')
            .setDescription('表示するトーナメントの種類')
            .setRequired(false)
            .addChoices(
              { name: 'アクティブ（登録受付中・進行中）', value: 'active' },
              { name: '完了済み', value: 'completed' },
              { name: '全て', value: 'all' },
            ),
        ),
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await handleCreateCommand(interaction);
    } else if (subcommand === 'start-registration') {
      await handleStartRegistrationCommand(interaction);
    } else if (subcommand === 'start') {
      await handleStartCommand(interaction);
    } else if (subcommand === 'bracket') {
      await handleBracketCommand(interaction);
    } else if (subcommand === 'list') {
      await handleListCommand(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (focusedOption.name === 'tournament-id') {
      let tournaments;

      if (subcommand === 'start-registration') {
        // 登録受付開始はドラフト状態のトーナメント
        tournaments = tournamentService.list(interaction.guildId!)
          .filter(tournament => tournament.status === 'draft');
      } else if (subcommand === 'start') {
        // トーナメント開始は登録受付中のトーナメント
        tournaments = tournamentService.list(interaction.guildId!)
          .filter(tournament => tournament.status === 'registration');
      } else {
        // bracketコマンドなどは全てのアクティブトーナメント
        tournaments = tournamentService.list(interaction.guildId!);
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

async function handleCreateCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.options.getString('name', true);
  const teams = interaction.options.getInteger('teams', true);

  // 入力値検証
  if (name.length < 3) {
    await interaction.reply({
      content: '❌ トーナメント名は3文字以上で入力してください。',
      ephemeral: true,
    });
    return;
  }

  if (name.length > 50) {
    await interaction.reply({
      content: '❌ トーナメント名は50文字以下で入力してください。',
      ephemeral: true,
    });
    return;
  }

  try {
    const tournament = await tournamentService.create({
      name,
      teamCount: teams,
      guildId: interaction.guildId!,
    });

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ トーナメント作成完了')
      .addFields(
        { name: '名前', value: tournament.name, inline: true },
        { name: 'チーム数', value: tournament.teamCount.toString(), inline: true },
        { name: '形式', value: 'シングルエリミネーション', inline: true },
        { name: '状態', value: 'ドラフト', inline: true },
        { name: 'ID', value: tournament.id, inline: true },
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

async function handleStartRegistrationCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);

  try {
    const tournament = await tournamentService.startRegistration(tournamentId);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎯 登録受付開始')
      .addFields(
        { name: 'トーナメント名', value: tournament.name, inline: true },
        { name: 'チーム数', value: `${tournament.teams.length}/${tournament.teamCount}`, inline: true },
        { name: '状態', value: '登録受付中', inline: true },
      )
      .setDescription('チームの登録受付を開始しました。\n`/team register` コマンドでチームを登録できます。')
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

async function handleStartCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);

  try {
    const tournament = await tournamentService.startTournament(tournamentId);
    const totalStages = tournament.totalStages;

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 トーナメント開始！')
      .addFields(
        { name: 'トーナメント', value: tournament.name, inline: true },
        { name: '参加チーム', value: `${tournament.teams.length}チーム`, inline: true },
        { name: '総ステージ数', value: `${totalStages}ステージ`, inline: true },
      )
      .setDescription('ブラケットが生成されました。\n`/tournament bracket` で確認してください。')
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

async function handleBracketCommand(interaction: CommandInteraction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const tournamentId = interaction.options.getString('tournament-id', true);

  try {
    const tournament = tournamentService.get(tournamentId);
    if (!tournament) {
      await interaction.reply({
        content: '❌ トーナメントが見つかりません。',
        ephemeral: true,
      });
      return;
    }

    if (tournament.matches.length === 0) {
      await interaction.reply({
        content: '❌ このトーナメントはまだ開始されていません。',
        ephemeral: true,
      });
      return;
    }

    const matches = tournament.matches;
    const stages = [...new Set(matches.map(m => m.stage))].sort((a, b) => a - b);

    let bracketText = '';

    for (const stage of stages) {
      const stageMatches = matches.filter(m => m.stage === stage).sort((a, b) => a.stagePosition - b.stagePosition);

      // ステージ名を設定
      const stageName = tournamentService.getStageDisplayName(stage, tournament.totalStages);

      bracketText += `**【${stageName}】**\n`;

      for (const match of stageMatches) {
        const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
        const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);

        let homeTeamName: string;
        let awayTeamName: string;

        if (homeTeam && awayTeam) {
          // 第1ステージの場合、実際のチーム名を表示
          homeTeamName = homeTeam.name;
          awayTeamName = awayTeam.name;
        } else if (stage === 1) {
          homeTeamName = homeTeam?.name || 'TBD';
          awayTeamName = awayTeam?.name || 'TBD';
        } else {
          // 前のステージから勝ち上がってくる試合を計算
          const prevStageMatch1 = (match.stagePosition - 1) * 2 + 1;
          const prevStageMatch2 = (match.stagePosition - 1) * 2 + 2;
          const prevStageName = tournamentService.getStageDisplayName(stage - 1, tournament.totalStages);

          homeTeamName = `(${prevStageName} Match ${prevStageMatch1} 勝者)`;
          awayTeamName = `(${prevStageName} Match ${prevStageMatch2} 勝者)`;
        }

        // スコア表示（完了している場合）
        let scoreDisplay = '';
        if (match.status === 'completed' && match.homeRounds !== null && match.awayRounds !== null) {
          scoreDisplay = ` (${match.homeRounds}-${match.awayRounds})`;
        }

        bracketText += `🏠 ${homeTeamName} vs ${awayTeamName} 🚀${scoreDisplay}\n`;
      }
      bracketText += '\n';
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📊 ${tournament.name} - ブラケット`)
      .setDescription(bracketText)
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

  const filter = interaction.options.getString('filter') || 'active';

  try {
    const guildId = interaction.guildId!;
    let tournaments: Tournament[] = [];
    let title = '';

    switch (filter) {
    case 'active':
      tournaments = tournamentService.getActiveTournaments(guildId);
      title = '📊 アクティブなトーナメント';
      break;
    case 'completed':
      tournaments = tournamentService.getCompletedTournaments(guildId);
      title = '🏆 完了済みトーナメント';
      break;
    case 'all':
      tournaments = tournamentService.list(guildId);
      title = '📋 全てのトーナメント';
      break;
    }

    if (tournaments.length === 0) {
      await interaction.reply({
        content: `${title}はありません。`,
        ephemeral: false,
      });
      return;
    }

    // 最大10件に制限
    const displayTournaments = tournaments.slice(0, 10);
    let tournamentListText = '';

    for (const tournament of displayTournaments) {
      const displayName = tournamentService.getTournamentDisplayName(tournament);
      const createdDate = tournament.createdAt.toLocaleDateString('ja-JP');

      tournamentListText += `**${displayName}**\n`;
      tournamentListText += `ID: \`${tournament.id}\` | 作成日: ${createdDate}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(filter === 'completed' ? 0xffd700 : 0x0099ff)
      .setTitle(title)
      .setDescription(tournamentListText)
      .addFields(
        { name: '📊 表示数', value: `${displayTournaments.length}件${tournaments.length > 10 ? ` (全${tournaments.length}件中)` : ''}`, inline: true },
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