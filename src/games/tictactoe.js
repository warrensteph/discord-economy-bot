import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, randomInt } from '../utils/helpers.js';

const activeGames = new Map();

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every(cell => cell) ? 'tie' : null;
}

function botMove(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'O').length === 2 && cells.includes(null)) {
      return combo[cells.indexOf(null)];
    }
  }
  
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'X').length === 2 && cells.includes(null)) {
      return combo[cells.indexOf(null)];
    }
  }
  
  if (!board[4]) return 4;
  
  const corners = [0, 2, 6, 8].filter(i => !board[i]);
  if (corners.length) return corners[randomInt(0, corners.length - 1)];
  
  const available = board.map((cell, i) => cell ? -1 : i).filter(i => i !== -1);
  return available[randomInt(0, available.length - 1)];
}

function createBoard(board, gameId, disabled = false) {
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder();
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const cell = board[index];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${gameId}_${index}`)
          .setLabel(cell || '\u200b')
          .setStyle(cell === 'X' ? ButtonStyle.Primary : cell === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
          .setDisabled(disabled || !!cell)
      );
    }
    rows.push(row);
  }
  return rows;
}

export const data = new SlashCommandBuilder()
  .setName('tictactoe')
  .setDescription('Play Tic Tac Toe against the bot')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(5)
      .setMaxValue(75)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'tictactoe', 45000);
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
  const board = Array(9).fill(null);
  
  activeGames.set(gameId, {
    board,
    bet,
    userId: interaction.user.id
  });

  const embed = new EmbedBuilder()
    .setTitle('Tic Tac Toe')
    .setDescription(`You are **X**. Bot is **O**.\n\nBet: **${formatCoins(bet)}**\nWin to double your bet!`)
    .setColor(0x5865F2)
    .setTimestamp();

  const components = createBoard(board, gameId);
  await interaction.reply({ embeds: [embed], components });

  setTimeout(() => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
    }
  }, 120000);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('ttt_')) return false;

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

  game.board[position] = 'X';
  
  let winner = checkWinner(game.board);
  
  if (!winner) {
    const botPos = botMove(game.board);
    if (botPos !== undefined) {
      game.board[botPos] = 'O';
      winner = checkWinner(game.board);
    }
  }

  if (winner) {
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'tictactoe');
    
    let embed;
    if (winner === 'X') {
      addBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, true);
      embed = new EmbedBuilder()
        .setTitle('You Win!')
        .setDescription(`Congratulations! You beat the bot!\n\nYou won **${formatCoins(game.bet * 2)}**!`)
        .setColor(0x4CAF50)
        .setTimestamp();
    } else if (winner === 'O') {
      removeBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, false);
      embed = new EmbedBuilder()
        .setTitle('Bot Wins!')
        .setDescription(`The bot outsmarted you!\n\nYou lost **${formatCoins(game.bet)}**.`)
        .setColor(0xF44336)
        .setTimestamp();
    } else {
      updateGameStats(interaction.user.id, false);
      embed = new EmbedBuilder()
        .setTitle('It\'s a Tie!')
        .setDescription('Nobody wins! Your bet was returned.')
        .setColor(0xFF9800)
        .setTimestamp();
    }

    const components = createBoard(game.board, gameId, true);
    await interaction.update({ embeds: [embed], components });
    return true;
  }

  const embed = new EmbedBuilder()
    .setTitle('Tic Tac Toe')
    .setDescription(`You are **X**. Bot is **O**.\n\nBet: **${formatCoins(game.bet)}**`)
    .setColor(0x5865F2)
    .setTimestamp();

  const components = createBoard(game.board, gameId);
  await interaction.update({ embeds: [embed], components });
  return true;
}
