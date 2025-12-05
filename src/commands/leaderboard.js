import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../utils/database.js';
import { formatCoins } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the server leaderboard')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Leaderboard type')
      .setRequired(false)
      .addChoices(
        { name: 'Balance', value: 'balance' },
        { name: 'Wins', value: 'wins' },
        { name: 'Games Played', value: 'games' }
      ));

export async function execute(interaction) {
  const type = interaction.options.getString('type') || 'balance';
  const leaderboard = getLeaderboard(type, 10);

  if (leaderboard.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('Leaderboard')
      .setDescription('No data yet! Start playing games to appear on the leaderboard.')
      .setColor(0x5865F2)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  const medals = ['', '', ''];
  const titles = {
    balance: 'Richest Players',
    wins: 'Top Winners',
    games: 'Most Active Players'
  };

  const valueGetters = {
    balance: (user) => formatCoins(user.balance),
    wins: (user) => `${user.stats.gamesWon} wins`,
    games: (user) => `${user.stats.gamesPlayed} games`
  };

  const entries = await Promise.all(
    leaderboard.map(async (entry, index) => {
      let username = 'Unknown User';
      try {
        const user = await interaction.client.users.fetch(entry.id);
        username = user.username;
      } catch {}
      
      const medal = medals[index] || `**${index + 1}.**`;
      const value = valueGetters[type](entry);
      
      return `${medal} ${username} - ${value}`;
    })
  );

  const userRank = leaderboard.findIndex(e => e.id === interaction.user.id);
  let footerText = 'Keep playing to climb the ranks!';
  if (userRank !== -1) {
    footerText = `Your rank: #${userRank + 1}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${titles[type]}`)
    .setDescription(entries.join('\n'))
    .setColor(0xFFD700)
    .setFooter({ text: footerText })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
