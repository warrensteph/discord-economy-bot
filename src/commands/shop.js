import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getShopItems, getShopItem, getUser, removeBalance, addItem, hasItem, RARITY_COLORS } from '../utils/database.js';
import { formatCoins, rarityEmoji, successEmbed, errorEmbed } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse and buy items from the shop')
  .addStringOption(option =>
    option.setName('category')
      .setDescription('Shop category')
      .setRequired(false)
      .addChoices(
        { name: 'Roles', value: 'roles' },
        { name: 'Items', value: 'items' },
        { name: 'All', value: 'all' }
      ))
  .addStringOption(option =>
    option.setName('buy')
      .setDescription('Item ID to purchase')
      .setRequired(false));

export async function execute(interaction) {
  const category = interaction.options.getString('category') || 'all';
  const buyItemId = interaction.options.getString('buy');
  const shop = getShopItems();
  const user = getUser(interaction.user.id);

  if (buyItemId) {
    const item = getShopItem(buyItemId);
    
    if (!item) {
      return interaction.reply({ embeds: [errorEmbed('Item Not Found', 'That item does not exist in the shop.')], ephemeral: true });
    }

    if (hasItem(interaction.user.id, item.id)) {
      return interaction.reply({ embeds: [errorEmbed('Already Owned', 'You already own this item!')], ephemeral: true });
    }

    if (user.balance < item.price) {
      return interaction.reply({ 
        embeds: [errorEmbed('Insufficient Funds', `You need **${formatCoins(item.price - user.balance)}** more to buy this item.`)], 
        ephemeral: true 
      });
    }

    removeBalance(interaction.user.id, item.price);
    addItem(interaction.user.id, item);

    if (item.type === 'role' && item.roleId) {
      try {
        const role = interaction.guild.roles.cache.get(item.roleId);
        
        if (role) {
          await interaction.member.roles.add(role);
        }
      } catch (error) {
        console.error('Failed to assign role:', error);
      }
    }

    const embed = successEmbed(
      'Purchase Successful!',
      `You bought **${rarityEmoji(item.rarity)} ${item.name}** for **${formatCoins(item.price)}**!\n\nNew balance: **${formatCoins(user.balance - item.price)}**`
    );

    return interaction.reply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setTitle('Shop')
    .setDescription(`Your balance: **${formatCoins(user.balance)}**\n\nUse \`/shop buy:<item_id>\` to purchase an item.`)
    .setColor(0x5865F2)
    .setTimestamp();

  const roleFields = shop.roles.map(item => ({
    name: `${rarityEmoji(item.rarity)} ${item.name}`,
    value: `${item.description}\nPrice: **${formatCoins(item.price)}**\nID: \`${item.id}\``,
    inline: true
  }));

  const itemFields = shop.items.map(item => ({
    name: `${rarityEmoji(item.rarity)} ${item.name}`,
    value: `${item.description}\nPrice: **${formatCoins(item.price)}**\nID: \`${item.id}\``,
    inline: true
  }));

  if (category === 'all' || category === 'roles') {
    embed.addFields({ name: 'Roles', value: '━━━━━━━━━━━━━━━', inline: false });
    embed.addFields(roleFields);
  }

  if (category === 'all' || category === 'items') {
    embed.addFields({ name: 'Items', value: '━━━━━━━━━━━━━━━', inline: false });
    embed.addFields(itemFields);
  }

  await interaction.reply({ embeds: [embed] });
}
