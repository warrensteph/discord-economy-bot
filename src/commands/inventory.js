import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../utils/database.js';
import { formatCoins, rarityEmoji, rarityColor } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your inventory')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to view inventory of')
      .setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userData = getUser(targetUser.id);

  if (userData.inventory.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Inventory`)
      .setDescription('Inventory is empty! Visit the `/shop` to buy items.')
      .setColor(0x5865F2)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }

  const groupedItems = {};
  userData.inventory.forEach(item => {
    if (!groupedItems[item.type]) {
      groupedItems[item.type] = [];
    }
    groupedItems[item.type].push(item);
  });

  const typeNames = {
    role: 'Roles',
    consumable: 'Consumables',
    collectible: 'Collectibles'
  };

  const embed = new EmbedBuilder()
    .setTitle(`${targetUser.username}'s Inventory`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
    .setColor(0x5865F2)
    .setFooter({ text: `Total items: ${userData.inventory.length}` })
    .setTimestamp();

  for (const [type, items] of Object.entries(groupedItems)) {
    const itemList = items
      .map(item => `${rarityEmoji(item.rarity)} **${item.name}**`)
      .join('\n');
    
    embed.addFields({
      name: typeNames[type] || type,
      value: itemList || 'None',
      inline: false
    });
  }

  const totalValue = userData.inventory.reduce((sum, item) => sum + (item.price || 0), 0);
  embed.addFields({
    name: 'Total Value',
    value: formatCoins(totalValue),
    inline: false
  });

  await interaction.reply({ embeds: [embed] });
}
