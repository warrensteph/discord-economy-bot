import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, gameWinEmbed, gameLoseEmbed, gameTieEmbed, errorEmbed, randomInt } from '../utils/helpers.js';

const DICE_EMOJI = ['', '', '', '', '', ''];

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll dice against the bot')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(1000)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'dice', 8000);
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

  setCooldown(interaction.user.id, 'dice');

  const playerRoll = randomInt(1, 6);
  const botRoll = randomInt(1, 6);

  const playerEmoji = DICE_EMOJI[playerRoll - 1];
  const botEmoji = DICE_EMOJI[botRoll - 1];

  let embed;
  if (playerRoll > botRoll) {
    addBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, true);
    embed = gameWinEmbed(
      'Dice Roll - You Win!',
      `You rolled ${playerEmoji} **${playerRoll}**\nBot rolled ${botEmoji} **${botRoll}**`,
      bet
    );
  } else if (playerRoll < botRoll) {
    removeBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, false);
    embed = gameLoseEmbed(
      'Dice Roll - You Lose!',
      `You rolled ${playerEmoji} **${playerRoll}**\nBot rolled ${botEmoji} **${botRoll}**`,
      bet
    );
  } else {
    updateGameStats(interaction.user.id, false);
    embed = gameTieEmbed(
      'Dice Roll - Tie!',
      `You rolled ${playerEmoji} **${playerRoll}**\nBot rolled ${botEmoji} **${botRoll}**`
    );
  }

  await interaction.reply({ embeds: [embed] });
}
