import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, shuffle } from '../utils/helpers.js';

const EMOJIS = ['', '', '', '', '', '', '', ''];
const activeGames = new Map();

function createCards() {
  const pairs = EMOJIS.slice(0, 6);
  const cards = [...pairs, ...pairs];
  return shuffle(cards);
}

function createBoard(cards, revealed, matched, gameId) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < 4; j++) {
      const index = i * 4 + j;
      const isRevealed = revealed.includes(index);
      const isMatched = matched.includes(index);
      
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mem_${gameId}_${index}`)
          .setLabel(isRevealed || isMatched ? cards[index] : '?')
          .setStyle(isMatched ? ButtonStyle.Success : isRevealed ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(isMatched)
      );
    }
    rows.push(row);
  }
  return rows;
}

export const data = new SlashCommandBuilder()
  .setName('memory')
  .setDescription('Play a memory matching game')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(300)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'memory', 30000);
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

  const gameId = `${interaction.user.id}_${Date.now()}`;
  const cards = createCards();
  
  activeGames.set(gameId, {
    cards,
    revealed: [],
    matched: [],
    moves: 0,
    bet,
    userId: interaction.user.id
  });

  const embed = new EmbedBuilder()
    .setTitle('Memory Match')
    .setDescription(`Find all pairs in **15 moves or less** to win!\n\nBet: **${formatCoins(bet)}**\nMoves: **0/15**`)
    .setColor(0x5865F2)
    .setTimestamp();

  const components = createBoard(cards, [], [], gameId);
  await interaction.reply({ embeds: [embed], components });

  setTimeout(() => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
    }
  }, 180000);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('mem_')) return false;

  const parts = interaction.customId.split('_');
  const gameId = `${parts[1]}_${parts[2]}`;
  const position = parseInt(parts[3]);

  const game = activeGames.get(gameId);
  
  if (!game) {
    await interaction.reply({ embeds: [errorEmbed('Game Expired', 'This game has expired.')], ephemeral: true });
    return true;
  }

  if (interaction.user.id !== game.userId) {
    await interaction.reply({ embeds: [errorEmbed('Not Your Game', 'This is not your game!')], ephemeral: true });
    return true;
  }

  if (game.matched.includes(position) || game.revealed.includes(position)) {
    await interaction.deferUpdate();
    return true;
  }

  game.revealed.push(position);

  if (game.revealed.length === 2) {
    game.moves++;
    const [first, second] = game.revealed;
    
    if (game.cards[first] === game.cards[second]) {
      game.matched.push(first, second);
      game.revealed = [];
      
      if (game.matched.length === 12) {
        activeGames.delete(gameId);
        setCooldown(interaction.user.id, 'memory');
        
        const bonus = Math.max(0, (15 - game.moves) * 10);
        const winnings = game.bet * 2 + bonus;
        addBalance(interaction.user.id, winnings - game.bet);
        updateGameStats(interaction.user.id, true);
        
        const embed = new EmbedBuilder()
          .setTitle('You Win!')
          .setDescription(`You found all pairs in **${game.moves}** moves!\n\nWinnings: **${formatCoins(game.bet * 2)}**\nSpeed Bonus: **${formatCoins(bonus)}**\nTotal: **${formatCoins(winnings)}**`)
          .setColor(0x4CAF50)
          .setTimestamp();
        
        const components = createBoard(game.cards, [], game.matched, gameId);
        await interaction.update({ embeds: [embed], components });
        return true;
      }
    } else {
      const embed = new EmbedBuilder()
        .setTitle('Memory Match')
        .setDescription(`No match! Cards will hide in 1 second.\n\nBet: **${formatCoins(game.bet)}**\nMoves: **${game.moves}/15**`)
        .setColor(0xFF9800)
        .setTimestamp();
      
      const components = createBoard(game.cards, game.revealed, game.matched, gameId);
      await interaction.update({ embeds: [embed], components });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (game.moves >= 15) {
        activeGames.delete(gameId);
        setCooldown(interaction.user.id, 'memory');
        removeBalance(interaction.user.id, game.bet);
        updateGameStats(interaction.user.id, false);
        
        const loseEmbed = new EmbedBuilder()
          .setTitle('Out of Moves!')
          .setDescription(`You ran out of moves!\n\nYou lost **${formatCoins(game.bet)}**.`)
          .setColor(0xF44336)
          .setTimestamp();
        
        try {
          await interaction.editReply({ embeds: [loseEmbed], components: [] });
        } catch {}
        return true;
      }
      
      game.revealed = [];
      
      const newEmbed = new EmbedBuilder()
        .setTitle('Memory Match')
        .setDescription(`Find all pairs in **15 moves or less** to win!\n\nBet: **${formatCoins(game.bet)}**\nMoves: **${game.moves}/15**`)
        .setColor(0x5865F2)
        .setTimestamp();
      
      const newComponents = createBoard(game.cards, [], game.matched, gameId);
      try {
        await interaction.editReply({ embeds: [newEmbed], components: newComponents });
      } catch {}
      return true;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('Memory Match')
    .setDescription(`Find all pairs in **15 moves or less** to win!\n\nBet: **${formatCoins(game.bet)}**\nMoves: **${game.moves}/15**`)
    .setColor(0x5865F2)
    .setTimestamp();

  const components = createBoard(game.cards, game.revealed, game.matched, gameId);
  await interaction.update({ embeds: [embed], components });
  return true;
}
