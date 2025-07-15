import { Collection } from 'discord.js';
import { Command } from '../types/command.js';
import { ping } from '../commands/ping.js';
import { tournament } from '../commands/tournament.js';
import { team } from '../commands/team.js';
import { match } from '../commands/match.js';
import { player } from '../commands/player.js';

export const loadCommands = (): Collection<string, Command> => {
  const commands = new Collection<string, Command>();

  commands.set(ping.data.name, ping);
  commands.set(tournament.data.name, tournament);
  commands.set(team.data.name, team);
  commands.set(match.data.name, match);
  commands.set(player.data.name, player);

  return commands;
};

export const getCommandsData = () => {
  const commands = loadCommands();
  return commands.map(command => command.data.toJSON());
};