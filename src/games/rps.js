import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, gameWinEmbed, gameLoseEmbed, gameTieEmbed, errorEmbed } from '../utils/helpers.js';

const CHOICES = {
  rock: { emoji: '', beats: 'scissors', name: 'Rock' },
  paper: { emoji: '', beats: 'rock', name: 'Paper' },
  scissors: { emoji: '', beats: 'paper', name: 'Scissors' }
};

export const data = new SlashCommandBuilder()
  .setName('rps')
  .setDescription('Play Rock Paper Scissors')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(5)
      .setMaxValue(75)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'rps', 30000);
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
        .setCustomId(`rps_rock_${bet}_${interaction.user.id}`)
        .setLabel('Rock')
        .setEmoji('')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rps_paper_${bet}_${interaction.user.id}`)
        .setLabel('Paper')
        .setEmoji('')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rps_scissors_${bet}_${interaction.user.id}`)
        .setLabel('Scissors')
        .setEmoji('')
        .setStyle(ButtonStyle.Primary)
    );

  const embed = new EmbedBuilder()
    .setTitle('Rock Paper Scissors')
    .setDescription(`Bet: **${formatCoins(bet)}**\n\nChoose your move!`)
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('rps_')) return false;

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

  const botChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
  const playerChoice = CHOICES[choice];
  const botChoiceData = CHOICES[botChoice];

  setCooldown(interaction.user.id, 'rps');

  let embed;
  if (choice === botChoice) {
    embed = gameTieEmbed(
      'Rock Paper Scissors - Tie!',
      `You chose ${playerChoice.emoji} **${playerChoice.name}**\nBot chose ${botChoiceData.emoji} **${botChoiceData.name}**`
    );
    updateGameStats(interaction.user.id, false);
  } else if (playerChoice.beats === botChoice) {
    addBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, true);
    embed = gameWinEmbed(
      'Rock Paper Scissors - You Win!',
      `You chose ${playerChoice.emoji} **${playerChoice.name}**\nBot chose ${botChoiceData.emoji} **${botChoiceData.name}**`,
      bet
    );
  } else {
    removeBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, false);
    embed = gameLoseEmbed(
      'Rock Paper Scissors - You Lose!',
      `You chose ${playerChoice.emoji} **${playerChoice.name}**\nBot chose ${botChoiceData.emoji} **${botChoiceData.name}**`,
      bet
    );
  }

  await interaction.update({ embeds: [embed], components: [] });
  return true;
}
