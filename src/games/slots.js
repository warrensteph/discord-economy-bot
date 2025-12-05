import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, randomInt } from '../utils/helpers.js';

const SYMBOLS = ['', '', '', '', '', '', ''];
const WEIGHTS = [30, 25, 20, 12, 8, 4, 1];

function getRandomSymbol() {
  const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
  let random = randomInt(1, totalWeight);
  
  for (let i = 0; i < SYMBOLS.length; i++) {
    random -= WEIGHTS[i];
    if (random <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function calculateWinnings(symbols, bet) {
  const [s1, s2, s3] = symbols;
  
  if (s1 === s2 && s2 === s3) {
    const multipliers = {
      '': 50,
      '': 25,
      '': 15,
      '': 10,
      '': 8,
      '': 5,
      '': 3
    };
    return bet * (multipliers[s1] || 3);
  }
  
  if (s1 === s2 || s2 === s3 || s1 === s3) {
    return Math.floor(bet * 1.5);
  }
  
  return 0;
}

export const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Play the slot machine')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(500)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'slots', 15000);
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

  setCooldown(interaction.user.id, 'slots');

  const symbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
  const winnings = calculateWinnings(symbols, bet);

  const slotDisplay = `
**[ ${symbols[0]} | ${symbols[1]} | ${symbols[2]} ]**
`;

  let embed;
  if (winnings > 0) {
    const profit = winnings - bet;
    addBalance(interaction.user.id, profit);
    updateGameStats(interaction.user.id, true);
    
    const isJackpot = symbols[0] === symbols[1] && symbols[1] === symbols[2] && symbols[0] === '';
    
    embed = new EmbedBuilder()
      .setTitle(isJackpot ? 'JACKPOT!' : 'Slots - You Win!')
      .setDescription(`${slotDisplay}\nYou won **${formatCoins(winnings)}**!`)
      .setColor(isJackpot ? 0xFFD700 : 0x4CAF50)
      .setTimestamp();
  } else {
    removeBalance(interaction.user.id, bet);
    updateGameStats(interaction.user.id, false);
    
    embed = new EmbedBuilder()
      .setTitle('Slots - No Match')
      .setDescription(`${slotDisplay}\nYou lost **${formatCoins(bet)}**.`)
      .setColor(0xF44336)
      .setTimestamp();
  }

  embed.addFields(
    { name: 'Bet', value: formatCoins(bet), inline: true },
    { name: 'New Balance', value: formatCoins(getUser(interaction.user.id).balance), inline: true }
  );

  await interaction.reply({ embeds: [embed] });
}
