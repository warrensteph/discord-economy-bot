import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, RARITY_EMOJIS } from '../utils/database.js';
import { formatCoins, rarityEmoji } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your coin balance and stats')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to check balance of')
      .setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userData = getUser(targetUser.id);
  
  const inventoryValue = userData.inventory.reduce((sum, item) => sum + (item.price || 0), 0);
  const winRate = userData.stats.gamesPlayed > 0 
    ? ((userData.stats.gamesWon / userData.stats.gamesPlayed) * 100).toFixed(1)
    : 0;

  const rarityCount = {};
  userData.inventory.forEach(item => {
    rarityCount[item.rarity] = (rarityCount[item.rarity] || 0) + 1;
  });

  let inventorySummary = 'No items';
  if (userData.inventory.length > 0) {
    inventorySummary = Object.entries(rarityCount)
      .map(([rarity, count]) => `${rarityEmoji(rarity)} ${rarity}: ${count}`)
      .join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle(`${targetUser.username}'s Profile`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .addFields(
      { name: 'Balance', value: formatCoins(userData.balance), inline: true },
      { name: 'Daily Streak', value: `${userData.dailyStreak} days`, inline: true },
      { name: 'Inventory Value', value: formatCoins(inventoryValue), inline: true },
      { name: 'Games Played', value: userData.stats.gamesPlayed.toString(), inline: true },
      { name: 'Games Won', value: userData.stats.gamesWon.toString(), inline: true },
      { name: 'Win Rate', value: `${winRate}%`, inline: true },
      { name: 'Total Earned', value: formatCoins(userData.stats.totalEarned), inline: true },
      { name: 'Total Spent', value: formatCoins(userData.stats.totalSpent), inline: true },
      { name: 'Items Owned', value: userData.inventory.length.toString(), inline: true },
      { name: 'Inventory Summary', value: inventorySummary, inline: false }
    )
    .setTimestamp()
    .setFooter({ text: 'Economy Bot' });

  await interaction.reply({ embeds: [embed] });
}
