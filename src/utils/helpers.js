import { EmbedBuilder } from 'discord.js';
import { RARITY_COLORS, RARITY_EMOJIS } from './database.js';

export function formatCoins(amount) {
  return `${amount.toLocaleString()} coins`;
}

export function createEmbed(title, description, color = 0x5865F2) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

export function createGameEmbed(title, description, result, color) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  
  if (result) {
    embed.addFields({ name: 'Result', value: result, inline: true });
  }
  
  return embed;
}

export function successEmbed(title, description) {
  return createEmbed(title, description, 0x4CAF50);
}

export function errorEmbed(title, description) {
  return createEmbed(title, description, 0xF44336);
}

export function warningEmbed(title, description) {
  return createEmbed(title, description, 0xFF9800);
}

export function gameWinEmbed(title, description, winnings) {
  return createEmbed(title, `${description}\n\nYou won **${formatCoins(winnings)}**!`, 0x4CAF50);
}

export function gameLoseEmbed(title, description, loss) {
  return createEmbed(title, `${description}\n\nYou lost **${formatCoins(loss)}**.`, 0xF44336);
}

export function gameTieEmbed(title, description) {
  return createEmbed(title, `${description}\n\nIt's a tie! Your bet was returned.`, 0xFF9800);
}

export function rarityColor(rarity) {
  return RARITY_COLORS[rarity] || 0x9E9E9E;
}

export function rarityEmoji(rarity) {
  return RARITY_EMOJIS[rarity] || '';
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
