import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('View all available commands');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Economy Bot Commands')
    .setColor(0x5865F2)
    .setDescription('Here are all available commands:')
    .addFields(
      { 
        name: 'Economy', 
        value: [
          '`/balance` - Check your coin balance and stats',
          '`/daily` - Claim your daily reward',
          '`/shop` - Browse and buy items',
          '`/inventory` - View your inventory',
          '`/trade` - Trade with other users',
          '`/leaderboard` - View top players'
        ].join('\n'),
        inline: false 
      },
      { 
        name: 'Games (Bet to Play)', 
        value: [
          '`/rps` - Rock Paper Scissors',
          '`/coinflip` - Heads or Tails',
          '`/dice` - Roll dice against the bot',
          '`/slots` - Spin the slot machine',
          '`/blackjack` - Play 21 against dealer',
          '`/tictactoe` - Classic Tic Tac Toe',
          '`/guess` - Guess a number 1-10',
          '`/trivia` - Answer trivia questions',
          '`/memory` - Memory matching game',
          '`/scramble` - Unscramble words',
          '`/highlow` - Higher or lower streak'
        ].join('\n'),
        inline: false 
      },
      {
        name: 'Tips',
        value: [
          '- Claim `/daily` every day for streak bonuses',
          '- Higher bets = higher rewards (and risks!)',
          '- Buy items from the shop to show off',
          '- Trade items with friends'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Start with /daily to get coins!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
