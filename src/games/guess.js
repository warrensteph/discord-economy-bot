import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, randomInt, successEmbed } from '../utils/helpers.js';

const activeGames = new Map();

export const data = new SlashCommandBuilder()
  .setName('guess')
  .setDescription('Guess a number between 1 and 10')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(500)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'guess', 10000);
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

  const secretNumber = randomInt(1, 10);
  const gameId = `${interaction.user.id}_${Date.now()}`;
  
  activeGames.set(gameId, {
    number: secretNumber,
    bet,
    attempts: 3,
    userId: interaction.user.id
  });

  const rows = [];
  for (let i = 0; i < 2; i++) {
    const row = new ActionRowBuilder();
    for (let j = 1; j <= 5; j++) {
      const num = i * 5 + j;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`guess_${gameId}_${num}`)
          .setLabel(num.toString())
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  const embed = new EmbedBuilder()
    .setTitle('Number Guessing Game')
    .setDescription(`Guess a number between **1** and **10**!\n\nBet: **${formatCoins(bet)}**\nAttempts remaining: **3**\n\nCorrect guess wins **5x** your bet!`)
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: rows });

  setTimeout(() => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
    }
  }, 60000);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('guess_')) return false;

  const [, gameId, guessStr] = interaction.customId.split('_');
  const fullGameId = `${gameId}_${interaction.customId.split('_')[2]}`;
  
  const realGameId = Array.from(activeGames.keys()).find(k => interaction.customId.includes(k.split('_')[1]));
  
  if (!realGameId) {
    await interaction.reply({ embeds: [errorEmbed('Game Expired', 'This game has expired.')], ephemeral: true });
    return true;
  }

  const game = activeGames.get(realGameId);
  const guess = parseInt(interaction.customId.split('_').pop());

  if (interaction.user.id !== game.userId) {
    await interaction.reply({ embeds: [errorEmbed('Not Your Game', 'This is not your game!')], ephemeral: true });
    return true;
  }

  game.attempts--;

  if (guess === game.number) {
    activeGames.delete(realGameId);
    setCooldown(interaction.user.id, 'guess');
    
    const winnings = game.bet * 5;
    addBalance(interaction.user.id, winnings - game.bet);
    updateGameStats(interaction.user.id, true);

    const embed = new EmbedBuilder()
      .setTitle('Correct! You Win!')
      .setDescription(`The number was **${game.number}**!\n\nYou won **${formatCoins(winnings)}**!`)
      .setColor(0x4CAF50)
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  if (game.attempts <= 0) {
    activeGames.delete(realGameId);
    setCooldown(interaction.user.id, 'guess');
    
    removeBalance(interaction.user.id, game.bet);
    updateGameStats(interaction.user.id, false);

    const embed = new EmbedBuilder()
      .setTitle('Game Over!')
      .setDescription(`The number was **${game.number}**!\n\nYou lost **${formatCoins(game.bet)}**.`)
      .setColor(0xF44336)
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  const hint = guess < game.number ? 'higher' : 'lower';
  
  const embed = new EmbedBuilder()
    .setTitle('Wrong Guess!')
    .setDescription(`The number is **${hint}** than ${guess}!\n\nAttempts remaining: **${game.attempts}**`)
    .setColor(0xFF9800)
    .setTimestamp();

  await interaction.update({ embeds: [embed] });
  return true;
}
