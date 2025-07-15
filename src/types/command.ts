import { CommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, AutocompleteInteraction } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: CommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}