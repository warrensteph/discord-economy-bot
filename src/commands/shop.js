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

    let roleAssigned = false;
    let roleError = null;

    if (item.type === 'role' && item.roleId) {
      try {
        const role = interaction.guild.roles.cache.get(item.roleId);
        
        if (role) {
          const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
          
          if (botMember.roles.highest.position <= role.position) {
            roleError = 'Bot role is too low to assign this role. Please move the bot role higher in the server settings.';
          } else if (interaction.member.roles.cache.has(role.id)) {
            roleAssigned = true;
          } else {
            await interaction.member.roles.add(role);
            roleAssigned = true;
          }
        } else {
          roleError = 'Role no longer exists on this server.';
        }
      } catch (error) {
        console.error('Failed to assign role:', error);
        roleError = 'Failed to assign role. Make sure the bot has the "Manage Roles" permission.';
      }
    }

    let description = `You bought **${rarityEmoji(item.rarity)} ${item.name}** for **${formatCoins(item.price)}**!\n\nNew balance: **${formatCoins(user.balance - item.price)}**`;
    
    if (item.type === 'role') {
      if (roleAssigned) {
        description += `\n\n**Role granted!** You now have the **${item.name}** role!`;
      } else if (roleError) {
        description += `\n\n**Warning:** ${roleError}`;
      }
    }

    const embed = successEmbed('Purchase Successful!', description);

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
