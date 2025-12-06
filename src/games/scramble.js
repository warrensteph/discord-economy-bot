import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, shuffle } from '../utils/helpers.js';

const WORDS = [
  'APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'MANGO',
  'COMPUTER', 'KEYBOARD', 'MONITOR', 'MOUSE', 'SPEAKER',
  'ELEPHANT', 'GIRAFFE', 'PENGUIN', 'DOLPHIN', 'TIGER',
  'MOUNTAIN', 'OCEAN', 'FOREST', 'DESERT', 'RIVER',
  'DIAMOND', 'EMERALD', 'RUBY', 'SAPPHIRE', 'CRYSTAL',
  'THUNDER', 'LIGHTNING', 'RAINBOW', 'SUNSHINE', 'MOONLIGHT',
  'ADVENTURE', 'MYSTERY', 'FANTASY', 'MAGIC', 'DRAGON',
  'CHAMPION', 'VICTORY', 'TRIUMPH', 'GLORY', 'LEGEND'
];

const activeGames = new Map();

function scrambleWord(word) {
  let scrambled = word;
  let attempts = 0;
  while (scrambled === word && attempts < 10) {
    scrambled = shuffle(word.split('')).join('');
    attempts++;
  }
  return scrambled;
}

export const data = new SlashCommandBuilder()
  .setName('scramble')
  .setDescription('Unscramble a word to win coins')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(5)
      .setMaxValue(100)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'scramble', 45000);
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

  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const scrambled = scrambleWord(word);
  const gameId = `${interaction.user.id}_${Date.now()}`;
  
  activeGames.set(gameId, {
    word,
    scrambled,
    bet,
    userId: interaction.user.id,
    attempts: 3
  });

  const embed = new EmbedBuilder()
    .setTitle('Word Scramble')
    .setDescription(`Unscramble this word:\n\n**${scrambled.split('').join(' ')}**\n\nBet: **${formatCoins(bet)}**\nAttempts: **3**\n\nType your answer in chat within 30 seconds!`)
    .setColor(0x5865F2)
    .setFooter({ text: `Game ID: ${gameId}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ filter, time: 30000 });

  collector.on('collect', async (message) => {
    const game = activeGames.get(gameId);
    if (!game) {
      collector.stop('expired');
      return;
    }

    const guess = message.content.toUpperCase().trim();
    
    if (guess === game.word) {
      activeGames.delete(gameId);
      collector.stop('won');
      setCooldown(interaction.user.id, 'scramble');
      
      const winnings = Math.floor(game.bet * 1.5);
      addBalance(interaction.user.id, Math.floor(game.bet * 0.5));
      updateGameStats(interaction.user.id, true);
      
      const winEmbed = new EmbedBuilder()
        .setTitle('Correct!')
        .setDescription(`The word was **${game.word}**!\n\nYou won **${formatCoins(winnings)}**!`)
        .setColor(0x4CAF50)
        .setTimestamp();
      
      await message.reply({ embeds: [winEmbed] });
    } else {
      game.attempts--;
      
      if (game.attempts <= 0) {
        activeGames.delete(gameId);
        collector.stop('lost');
        setCooldown(interaction.user.id, 'scramble');
        
        removeBalance(interaction.user.id, game.bet);
        updateGameStats(interaction.user.id, false);
        
        const loseEmbed = new EmbedBuilder()
          .setTitle('Out of Attempts!')
          .setDescription(`The word was **${game.word}**.\n\nYou lost **${formatCoins(game.bet)}**.`)
          .setColor(0xF44336)
          .setTimestamp();
        
        await message.reply({ embeds: [loseEmbed] });
      } else {
        const hintEmbed = new EmbedBuilder()
          .setTitle('Wrong!')
          .setDescription(`That's not it! Attempts remaining: **${game.attempts}**\n\nThe word is: **${game.scrambled.split('').join(' ')}**`)
          .setColor(0xFF9800)
          .setTimestamp();
        
        await message.reply({ embeds: [hintEmbed] });
      }
    }
  });

  collector.on('end', async (collected, reason) => {
    const game = activeGames.get(gameId);
    if (game && reason === 'time') {
      activeGames.delete(gameId);
      setCooldown(interaction.user.id, 'scramble');
      
      removeBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, false);
      
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Time\'s Up!')
        .setDescription(`The word was **${game.word}**.\n\nYou lost **${formatCoins(game.bet)}**.`)
        .setColor(0xF44336)
        .setTimestamp();
      
      await interaction.followUp({ embeds: [timeoutEmbed] });
    }
  });
}
