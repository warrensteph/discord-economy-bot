import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, randomInt } from '../utils/helpers.js';

const activeGames = new Map();

export const data = new SlashCommandBuilder()
  .setName('highlow')
  .setDescription('Guess if the next number is higher or lower')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(500)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'highlow', 10000);
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

  const currentNumber = randomInt(2, 99);
  const gameId = `${interaction.user.id}_${Date.now()}`;
  
  activeGames.set(gameId, {
    currentNumber,
    bet,
    streak: 0,
    multiplier: 1,
    userId: interaction.user.id
  });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`hl_higher_${gameId}`)
        .setLabel('Higher')
        .setEmoji('')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hl_lower_${gameId}`)
        .setLabel('Lower')
        .setEmoji('')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hl_cashout_${gameId}`)
        .setLabel('Cash Out')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

  const embed = new EmbedBuilder()
    .setTitle('Higher or Lower')
    .setDescription(`Current Number: **${currentNumber}**\n\nWill the next number (1-100) be **higher** or **lower**?\n\nBet: **${formatCoins(bet)}**\nStreak: **0**\nMultiplier: **1x**`)
    .setColor(0x5865F2)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });

  setTimeout(() => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
    }
  }, 120000);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('hl_')) return false;

  const parts = interaction.customId.split('_');
  const action = parts[1];
  const gameId = `${parts[2]}_${parts[3]}`;

  const game = activeGames.get(gameId);
  
  if (!game) {
    await interaction.reply({ embeds: [errorEmbed('Game Expired', 'This game has expired.')], ephemeral: true });
    return true;
  }

  if (interaction.user.id !== game.userId) {
    await interaction.reply({ embeds: [errorEmbed('Not Your Game', 'This is not your game!')], ephemeral: true });
    return true;
  }

  if (action === 'cashout') {
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'highlow');
    
    const winnings = Math.floor(game.bet * game.multiplier);
    addBalance(interaction.user.id, winnings - game.bet);
    updateGameStats(interaction.user.id, true);
    
    const embed = new EmbedBuilder()
      .setTitle('Cashed Out!')
      .setDescription(`You cashed out with a **${game.streak}** streak!\n\nWinnings: **${formatCoins(winnings)}** (${game.multiplier}x)`)
      .setColor(0x4CAF50)
      .setTimestamp();
    
    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  const newNumber = randomInt(1, 100);
  const isHigher = newNumber > game.currentNumber;
  const guessedHigher = action === 'higher';
  const correct = (guessedHigher && isHigher) || (!guessedHigher && !isHigher);
  
  if (newNumber === game.currentNumber) {
    const embed = new EmbedBuilder()
      .setTitle('Same Number!')
      .setDescription(`The number was **${newNumber}** - same as before!\n\nYour bet was returned.`)
      .setColor(0xFF9800)
      .setTimestamp();
    
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'highlow');
    updateGameStats(interaction.user.id, false);
    
    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  if (!correct) {
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'highlow');
    removeBalance(interaction.user.id, game.bet);
    updateGameStats(interaction.user.id, false);
    
    const embed = new EmbedBuilder()
      .setTitle('Wrong!')
      .setDescription(`The number was **${newNumber}** (${isHigher ? 'higher' : 'lower'} than ${game.currentNumber}).\n\nYou lost **${formatCoins(game.bet)}** with a ${game.streak} streak.`)
      .setColor(0xF44336)
      .setTimestamp();
    
    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  game.streak++;
  game.multiplier = Math.min(1 + (game.streak * 0.5), 10);
  game.currentNumber = newNumber;

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`hl_higher_${gameId}`)
        .setLabel('Higher')
        .setEmoji('')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hl_lower_${gameId}`)
        .setLabel('Lower')
        .setEmoji('')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hl_cashout_${gameId}`)
        .setLabel(`Cash Out (${formatCoins(Math.floor(game.bet * game.multiplier))})`)
        .setStyle(ButtonStyle.Primary)
    );

  const embed = new EmbedBuilder()
    .setTitle('Correct!')
    .setDescription(`The number was **${newNumber}** (${isHigher ? 'higher' : 'lower'})!\n\nCurrent Number: **${game.currentNumber}**\nWill the next be **higher** or **lower**?\n\nBet: **${formatCoins(game.bet)}**\nStreak: **${game.streak}**\nMultiplier: **${game.multiplier}x**\nPotential Win: **${formatCoins(Math.floor(game.bet * game.multiplier))}**`)
    .setColor(0x4CAF50)
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [row] });
  return true;
}
