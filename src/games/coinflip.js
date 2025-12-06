import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, gameWinEmbed, gameLoseEmbed, errorEmbed } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin and bet on heads or tails')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(5)
      .setMaxValue(50)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'coinflip', 20000);
  if (!cooldown.canPlay) {
    return interaction.reply({
      embeds: [errorEmbed('Cooldown', `Wait **${cooldown.remaining}s** before playing again.`)],
      ephemeral: true
    });
  }

  if (user.balance < bet) {
    return interaction.reply({
      embeds: [errorEmbed('Insufficient Funds', `You don't have enough coins! You have ${formatCoins(user.balance)}.`)],
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`coinflip_heads_${bet}_${interaction.user.id}`)
        .setLabel('Heads')
        .setEmoji('')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`coinflip_tails_${bet}_${interaction.user.id}`)
        .setLabel('Tails')
        .setEmoji('')
        .setStyle(ButtonStyle.Primary)
    );

  const embed = new EmbedBuilder()
    .setTitle('Coin Flip')
    .setDescription(`Bet: **${formatCoins(bet)}**\n\nChoose heads or tails!`)
    .setColor(0xFFD700)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('coinflip_')) return false;

  const [, choice, betStr, odIUser] = interaction.customId.split('_');
  const bet = parseInt(betStr);

  if (interaction.user.id !== odIUser) {
    await interaction.reply({ embeds: [errorEmbed('Not Your Game', 'This is not your game!')], ephemeral: true });
    return true;
  }

  const user = getUser(interaction.user.id);
  if (user.balance < bet) {
    await interaction.update({
      embeds: [errorEmbed('Insufficient Funds', 'You no longer have enough coins for this bet.')],
      components: []
    });
    return true;
  }

  setCooldown(interaction.user.id, 'coinflip');
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const resultEmoji = result === 'heads' ? '' : '';

  let embed;
  if (choice === result) {
    addBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, true);
    embed = gameWinEmbed(
      'Coin Flip - You Win!',
      `The coin landed on ${resultEmoji} **${result.charAt(0).toUpperCase() + result.slice(1)}**!`,
      bet
    );
  } else {
    removeBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, false);
    embed = gameLoseEmbed(
      'Coin Flip - You Lose!',
      `The coin landed on ${resultEmoji} **${result.charAt(0).toUpperCase() + result.slice(1)}**!`,
      bet
    );
  }

  await interaction.update({ embeds: [embed], components: [] });
  return true;
}
