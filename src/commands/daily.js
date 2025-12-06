import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { canClaimDaily, claimDaily, getUser } from '../utils/database.js';
import { formatCoins, errorEmbed } from '../utils/helpers.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily reward');

export async function execute(interaction) {
  if (!canClaimDaily(interaction.user.id)) {
    const user = getUser(interaction.user.id);
    const lastDaily = new Date(user.lastDaily);
    const nextDaily = new Date(lastDaily);
    nextDaily.setDate(nextDaily.getDate() + 1);
    nextDaily.setHours(0, 0, 0, 0);
    
    const now = new Date();
    const diff = nextDaily - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return interaction.reply({
      embeds: [errorEmbed(
        'Already Claimed',
        `You've already claimed your daily reward!\n\nCome back in **${hours}h ${minutes}m**`
      )],
      ephemeral: true
    });
  }

  const { reward, streak } = claimDaily(interaction.user.id);
  const user = getUser(interaction.user.id);

  const streakBonus = Math.min(streak * 5, 50);
  
  const embed = new EmbedBuilder()
    .setTitle('Daily Reward Claimed!')
    .setColor(0x4CAF50)
    .setDescription(`You received **${formatCoins(reward)}**!`)
    .addFields(
      { name: 'Base Reward', value: formatCoins(25), inline: true },
      { name: 'Streak Bonus', value: `+${formatCoins(streakBonus)}`, inline: true },
      { name: 'Current Streak', value: `${streak} days`, inline: true },
      { name: 'New Balance', value: formatCoins(user.balance), inline: false }
    )
    .setFooter({ text: streak >= 10 ? 'Maximum streak bonus reached!' : `Keep your streak going for bigger bonuses!` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
