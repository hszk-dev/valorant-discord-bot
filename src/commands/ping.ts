import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types/command.js';

export const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Pongを返します'),

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Pong! 🏓');
  },
};