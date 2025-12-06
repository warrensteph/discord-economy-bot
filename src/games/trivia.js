import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, shuffle } from '../utils/helpers.js';

const TRIVIA_QUESTIONS = [
  { question: "What is the capital of France?", correct: "Paris", wrong: ["London", "Berlin", "Madrid"] },
  { question: "How many continents are there?", correct: "7", wrong: ["5", "6", "8"] },
  { question: "What is the largest planet in our solar system?", correct: "Jupiter", wrong: ["Saturn", "Neptune", "Earth"] },
  { question: "Who painted the Mona Lisa?", correct: "Leonardo da Vinci", wrong: ["Pablo Picasso", "Vincent van Gogh", "Michelangelo"] },
  { question: "What is the chemical symbol for gold?", correct: "Au", wrong: ["Ag", "Fe", "Cu"] },
  { question: "In what year did World War II end?", correct: "1945", wrong: ["1944", "1946", "1943"] },
  { question: "What is the hardest natural substance on Earth?", correct: "Diamond", wrong: ["Iron", "Titanium", "Quartz"] },
  { question: "How many bones are in the adult human body?", correct: "206", wrong: ["186", "226", "196"] },
  { question: "What is the speed of light (approx)?", correct: "300,000 km/s", wrong: ["150,000 km/s", "500,000 km/s", "1,000,000 km/s"] },
  { question: "Which element has the atomic number 1?", correct: "Hydrogen", wrong: ["Helium", "Oxygen", "Carbon"] },
  { question: "What is the largest ocean on Earth?", correct: "Pacific Ocean", wrong: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"] },
  { question: "Who wrote Romeo and Juliet?", correct: "William Shakespeare", wrong: ["Charles Dickens", "Jane Austen", "Mark Twain"] },
  { question: "What is the square root of 144?", correct: "12", wrong: ["11", "13", "14"] },
  { question: "Which planet is known as the Red Planet?", correct: "Mars", wrong: ["Venus", "Mercury", "Jupiter"] },
  { question: "What is the main language spoken in Brazil?", correct: "Portuguese", wrong: ["Spanish", "English", "French"] },
  { question: "How many sides does a hexagon have?", correct: "6", wrong: ["5", "7", "8"] },
  { question: "What year was the first iPhone released?", correct: "2007", wrong: ["2005", "2008", "2010"] },
  { question: "What is the largest mammal in the world?", correct: "Blue Whale", wrong: ["Elephant", "Giraffe", "Hippopotamus"] },
  { question: "Which country has the most people?", correct: "India", wrong: ["China", "USA", "Indonesia"] },
  { question: "What does DNA stand for?", correct: "Deoxyribonucleic Acid", wrong: ["Dioxyribo Nucleic Acid", "Dynamic Nuclear Acid", "Digital Nucleic Array"] }
];

const activeGames = new Map();

export const data = new SlashCommandBuilder()
  .setName('trivia')
  .setDescription('Answer a trivia question to win coins')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(5)
      .setMaxValue(100)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'trivia', 45000);
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

  const questionData = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
  const answers = shuffle([questionData.correct, ...questionData.wrong]);
  const gameId = `${interaction.user.id}_${Date.now()}`;
  
  activeGames.set(gameId, {
    correct: questionData.correct,
    bet,
    userId: interaction.user.id
  });

  const row = new ActionRowBuilder();
  answers.forEach((answer, index) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_${gameId}_${index}_${answer === questionData.correct}`)
        .setLabel(answer)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  const embed = new EmbedBuilder()
    .setTitle('Trivia Time!')
    .setDescription(`**${questionData.question}**\n\nBet: **${formatCoins(bet)}**\nCorrect answer wins **1.5x** your bet!`)
    .setColor(0x5865F2)
    .setFooter({ text: 'You have 15 seconds to answer!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });

  setTimeout(async () => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
      try {
        const message = await interaction.fetchReply();
        const expiredEmbed = new EmbedBuilder()
          .setTitle('Time\'s Up!')
          .setDescription(`The correct answer was: **${questionData.correct}**\n\nYou lost **${formatCoins(bet)}**.`)
          .setColor(0xF44336)
          .setTimestamp();
        
        removeBalance(interaction.user.id, bet);
        updateGameStats(interaction.user.id, false);
        setCooldown(interaction.user.id, 'trivia');
        
        await message.edit({ embeds: [expiredEmbed], components: [] });
      } catch {}
    }
  }, 15000);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('trivia_')) return false;

  const parts = interaction.customId.split('_');
  const isCorrect = parts[parts.length - 1] === 'true';
  const gameId = `${parts[1]}_${parts[2]}`;

  const game = activeGames.get(gameId);
  
  if (!game) {
    await interaction.reply({ embeds: [errorEmbed('Game Expired', 'This game has expired.')], ephemeral: true });
    return true;
  }

  if (interaction.user.id !== game.userId) {
    await interaction.reply({ embeds: [errorEmbed('Not Your Game', 'This is not your game!')], ephemeral: true });
    return true;
  }

  activeGames.delete(gameId);
  setCooldown(interaction.user.id, 'trivia');

  let embed;
  if (isCorrect) {
    const winnings = Math.floor(game.bet * 1.5);
    addBalance(interaction.user.id, Math.floor(game.bet * 0.5));
    updateGameStats(interaction.user.id, true);

    embed = new EmbedBuilder()
      .setTitle('Correct!')
      .setDescription(`The answer was **${game.correct}**!\n\nYou won **${formatCoins(winnings)}**!`)
      .setColor(0x4CAF50)
      .setTimestamp();
  } else {
    removeBalance(interaction.user.id, game.bet);
    updateGameStats(interaction.user.id, false);

    embed = new EmbedBuilder()
      .setTitle('Wrong!')
      .setDescription(`The correct answer was **${game.correct}**.\n\nYou lost **${formatCoins(game.bet)}**.`)
      .setColor(0xF44336)
      .setTimestamp();
  }

  await interaction.update({ embeds: [embed], components: [] });
  return true;
}
