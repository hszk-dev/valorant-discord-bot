import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { getCommandsData } from './utils/commandLoader.js';

dotenv.config();

const commands = getCommandsData();

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log('スラッシュコマンドを登録中...');

    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.CLIENT_ID!,
          process.env.GUILD_ID,
        ),
        { body: commands },
      );
      console.log('ギルドコマンドとして登録完了！');
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID!),
        { body: commands },
      );
      console.log('グローバルコマンドとして登録完了！');
    }
  } catch (error) {
    console.error(error);
  }
})();