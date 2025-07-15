import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';
import { loadCommands } from './utils/commandLoader.js';
import { tournamentService } from './services/tournamentService.js';
import { playerDataService } from './commands/player.js';

dotenv.config();

// Initialize RiotConfig after dotenv is loaded (will be done when RiotApiService is accessed)
// RiotConfig.getInstance() will be called lazily when needed

const client = new Client({ intents: [ GatewayIntentBits.Guilds ] });
const commands = loadCommands();

client.once(Events.ClientReady, async readyClient => {
  console.log(`✅ ${readyClient.user.tag} として起動しました！`);

  // データ永続化システムを初期化
  await tournamentService.initialize();
  console.log('🎯 トーナメントサービスが準備完了しました');

  // プレイヤーサービスを初期化
  await playerDataService.initialize();
  console.log('🎮 プレイヤーサービスが準備完了しました');
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`コマンド ${interaction.commandName} が見つかりません`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('コマンド実行中にエラーが発生しました:', error);

      const errorMessage = {
        content: 'エラーが発生しました',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);

    if (!command || !command.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error('オートコンプリート実行中にエラーが発生しました:', error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);