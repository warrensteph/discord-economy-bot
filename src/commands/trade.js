import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, removeItem, addItem, addBalance, removeBalance } from '../utils/database.js';
import { formatCoins, successEmbed, errorEmbed, rarityEmoji } from '../utils/helpers.js';

const pendingTrades = new Map();

export const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade items or coins with another user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to trade with')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('offer_item')
      .setDescription('Item ID you want to offer')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('offer_coins')
      .setDescription('Coins you want to offer')
      .setMinValue(0)
      .setRequired(false))
  .addStringOption(option =>
    option.setName('request_item')
      .setDescription('Item ID you want in return')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('request_coins')
      .setDescription('Coins you want in return')
      .setMinValue(0)
      .setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user');
  const offerItemId = interaction.options.getString('offer_item');
  const offerCoins = interaction.options.getInteger('offer_coins') || 0;
  const requestItemId = interaction.options.getString('request_item');
  const requestCoins = interaction.options.getInteger('request_coins') || 0;

  if (targetUser.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed('Invalid Trade', 'You cannot trade with yourself!')], ephemeral: true });
  }

  if (targetUser.bot) {
    return interaction.reply({ embeds: [errorEmbed('Invalid Trade', 'You cannot trade with bots!')], ephemeral: true });
  }

  if (!offerItemId && !offerCoins && !requestItemId && !requestCoins) {
    return interaction.reply({ 
      embeds: [errorEmbed('Invalid Trade', 'You must offer or request at least something!')], 
      ephemeral: true 
    });
  }

  const senderData = getUser(interaction.user.id);
  const receiverData = getUser(targetUser.id);

  let offerItem = null;
  if (offerItemId) {
    offerItem = senderData.inventory.find(i => i.id === offerItemId);
    if (!offerItem) {
      return interaction.reply({ 
        embeds: [errorEmbed('Invalid Item', 'You do not own that item!')], 
        ephemeral: true 
      });
    }
  }

  if (offerCoins > senderData.balance) {
    return interaction.reply({ 
      embeds: [errorEmbed('Insufficient Funds', 'You do not have enough coins!')], 
      ephemeral: true 
    });
  }

  let requestItem = null;
  if (requestItemId) {
    requestItem = receiverData.inventory.find(i => i.id === requestItemId);
    if (!requestItem) {
      return interaction.reply({ 
        embeds: [errorEmbed('Invalid Item', `${targetUser.username} does not own that item!`)], 
        ephemeral: true 
      });
    }
  }

  if (requestCoins > receiverData.balance) {
    return interaction.reply({ 
      embeds: [errorEmbed('Invalid Trade', `${targetUser.username} does not have enough coins!`)], 
      ephemeral: true 
    });
  }

  const tradeId = `${interaction.user.id}-${targetUser.id}-${Date.now()}`;
  
  const embed = new EmbedBuilder()
    .setTitle('Trade Request')
    .setColor(0x5865F2)
    .setDescription(`${interaction.user} wants to trade with ${targetUser}`)
    .addFields(
      { 
        name: `${interaction.user.username} Offers:`, 
        value: [
          offerItem ? `${rarityEmoji(offerItem.rarity)} ${offerItem.name}` : null,
          offerCoins ? formatCoins(offerCoins) : null
        ].filter(Boolean).join('\n') || 'Nothing',
        inline: true 
      },
      { 
        name: `${interaction.user.username} Requests:`, 
        value: [
          requestItem ? `${rarityEmoji(requestItem.rarity)} ${requestItem.name}` : null,
          requestCoins ? formatCoins(requestCoins) : null
        ].filter(Boolean).join('\n') || 'Nothing',
        inline: true 
      }
    )
    .setFooter({ text: 'This trade will expire in 60 seconds' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`trade_accept_${tradeId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade_decline_${tradeId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

  pendingTrades.set(tradeId, {
    sender: interaction.user.id,
    receiver: targetUser.id,
    offerItemId,
    offerCoins,
    requestItemId,
    requestCoins,
    timestamp: Date.now()
  });

  const message = await interaction.reply({ 
    content: `${targetUser}`,
    embeds: [embed], 
    components: [row],
    fetchReply: true 
  });

  setTimeout(() => {
    if (pendingTrades.has(tradeId)) {
      pendingTrades.delete(tradeId);
      message.edit({ 
        embeds: [errorEmbed('Trade Expired', 'This trade request has expired.')],
        components: [] 
      }).catch(() => {});
    }
  }, 60000);
}

export async function handleButton(interaction) {
  const [action, , tradeId] = interaction.customId.split('_');
  
  if (!interaction.customId.startsWith('trade_')) return false;

  const trade = pendingTrades.get(tradeId);
  
  if (!trade) {
    await interaction.reply({ 
      embeds: [errorEmbed('Trade Expired', 'This trade has expired or was already completed.')],
      ephemeral: true 
    });
    return true;
  }

  if (interaction.user.id !== trade.receiver) {
    await interaction.reply({ 
      embeds: [errorEmbed('Not Your Trade', 'This trade is not for you!')],
      ephemeral: true 
    });
    return true;
  }

  pendingTrades.delete(tradeId);

  if (interaction.customId.includes('decline')) {
    await interaction.update({
      embeds: [errorEmbed('Trade Declined', `${interaction.user.username} declined the trade.`)],
      components: []
    });
    return true;
  }

  const senderData = getUser(trade.sender);
  const receiverData = getUser(trade.receiver);

  if (trade.offerItemId && !senderData.inventory.find(i => i.id === trade.offerItemId)) {
    await interaction.update({
      embeds: [errorEmbed('Trade Failed', 'The sender no longer has the offered item.')],
      components: []
    });
    return true;
  }

  if (trade.requestItemId && !receiverData.inventory.find(i => i.id === trade.requestItemId)) {
    await interaction.update({
      embeds: [errorEmbed('Trade Failed', 'You no longer have the requested item.')],
      components: []
    });
    return true;
  }

  if (trade.offerCoins > senderData.balance) {
    await interaction.update({
      embeds: [errorEmbed('Trade Failed', 'The sender no longer has enough coins.')],
      components: []
    });
    return true;
  }

  if (trade.requestCoins > receiverData.balance) {
    await interaction.update({
      embeds: [errorEmbed('Trade Failed', 'You no longer have enough coins.')],
      components: []
    });
    return true;
  }

  if (trade.offerItemId) {
    const item = removeItem(trade.sender, trade.offerItemId);
    if (item) addItem(trade.receiver, item);
  }
  if (trade.requestItemId) {
    const item = removeItem(trade.receiver, trade.requestItemId);
    if (item) addItem(trade.sender, item);
  }
  if (trade.offerCoins) {
    removeBalance(trade.sender, trade.offerCoins);
    addBalance(trade.receiver, trade.offerCoins);
  }
  if (trade.requestCoins) {
    removeBalance(trade.receiver, trade.requestCoins);
    addBalance(trade.sender, trade.requestCoins);
  }

  await interaction.update({
    embeds: [successEmbed('Trade Complete!', 'The trade was successfully completed.')],
    components: []
  });

  return true;
}
