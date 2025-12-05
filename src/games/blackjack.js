import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUser, addBalance, removeBalance, updateGameStats, checkCooldown, setCooldown } from '../utils/database.js';
import { formatCoins, errorEmbed, shuffle } from '../utils/helpers.js';

const SUITS = ['', '', '', ''];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, display: `${value}${suit}` });
    }
  }
  return shuffle(deck);
}

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}

function calculateHand(cards) {
  let total = 0;
  let aces = 0;
  
  for (const card of cards) {
    const value = getCardValue(card);
    if (card.value === 'A') aces++;
    total += value;
  }
  
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  
  return total;
}

function formatHand(cards, hideSecond = false) {
  if (hideSecond && cards.length >= 2) {
    return `${cards[0].display} ??`;
  }
  return cards.map(c => c.display).join(' ');
}

const activeGames = new Map();

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Play Blackjack against the dealer')
  .addIntegerOption(option =>
    option.setName('bet')
      .setDescription('Amount to bet')
      .setMinValue(10)
      .setMaxValue(1000)
      .setRequired(true));

export async function execute(interaction) {
  const bet = interaction.options.getInteger('bet');
  const user = getUser(interaction.user.id);

  const cooldown = checkCooldown(interaction.user.id, 'blackjack', 20000);
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

  const deck = createDeck();
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];
  
  const gameId = `${interaction.user.id}_${Date.now()}`;
  activeGames.set(gameId, {
    deck,
    playerHand,
    dealerHand,
    bet,
    userId: interaction.user.id
  });

  const playerTotal = calculateHand(playerHand);
  
  if (playerTotal === 21) {
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'blackjack');
    const winnings = Math.floor(bet * 2.5);
    addBalance(interaction.user.id, winnings - bet);
    updateGameStats(interaction.user.id, true);
    
    const embed = new EmbedBuilder()
      .setTitle('BLACKJACK!')
      .setDescription(`Your hand: ${formatHand(playerHand)} (21)\nDealer: ${formatHand(dealerHand)}\n\nYou got a Blackjack! You won **${formatCoins(winnings)}**!`)
      .setColor(0xFFD700)
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
  }

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_hit_${gameId}`)
        .setLabel('Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bj_stand_${gameId}`)
        .setLabel('Stand')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`bj_double_${gameId}`)
        .setLabel('Double Down')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(user.balance < bet * 2)
    );

  const embed = new EmbedBuilder()
    .setTitle('Blackjack')
    .setDescription(`**Your Hand:** ${formatHand(playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(dealerHand, true)}\n\nBet: **${formatCoins(bet)}**`)
    .setColor(0x2E7D32)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row] });

  setTimeout(() => {
    if (activeGames.has(gameId)) {
      activeGames.delete(gameId);
    }
  }, 120000);
}

async function dealerPlay(game) {
  while (calculateHand(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop());
  }
  return calculateHand(game.dealerHand);
}

export async function handleButton(interaction) {
  if (!interaction.customId.startsWith('bj_')) return false;

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

  const user = getUser(interaction.user.id);

  if (action === 'double') {
    if (user.balance < game.bet * 2) {
      await interaction.reply({ embeds: [errorEmbed('Insufficient Funds', 'You cannot afford to double down.')], ephemeral: true });
      return true;
    }
    game.bet *= 2;
    game.playerHand.push(game.deck.pop());
    
    const playerTotal = calculateHand(game.playerHand);
    if (playerTotal > 21) {
      activeGames.delete(gameId);
      setCooldown(interaction.user.id, 'blackjack');
      removeBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, false);
      
      const embed = new EmbedBuilder()
        .setTitle('Bust! You Lose!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)}\n\nYou busted and lost **${formatCoins(game.bet)}**.`)
        .setColor(0xF44336)
        .setTimestamp();
      
      await interaction.update({ embeds: [embed], components: [] });
      return true;
    }
  }

  if (action === 'hit') {
    game.playerHand.push(game.deck.pop());
    const playerTotal = calculateHand(game.playerHand);
    
    if (playerTotal > 21) {
      activeGames.delete(gameId);
      setCooldown(interaction.user.id, 'blackjack');
      removeBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, false);
      
      const embed = new EmbedBuilder()
        .setTitle('Bust! You Lose!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)}\n\nYou busted and lost **${formatCoins(game.bet)}**.`)
        .setColor(0xF44336)
        .setTimestamp();
      
      await interaction.update({ embeds: [embed], components: [] });
      return true;
    }

    if (playerTotal === 21) {
      action === 'stand';
    } else {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`bj_hit_${gameId}`)
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`bj_stand_${gameId}`)
            .setLabel('Stand')
            .setStyle(ButtonStyle.Secondary)
        );

      const embed = new EmbedBuilder()
        .setTitle('Blackjack')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand, true)}\n\nBet: **${formatCoins(game.bet)}**`)
        .setColor(0x2E7D32)
        .setTimestamp();

      await interaction.update({ embeds: [embed], components: [row] });
      return true;
    }
  }

  if (action === 'stand' || action === 'double') {
    activeGames.delete(gameId);
    setCooldown(interaction.user.id, 'blackjack');
    
    const playerTotal = calculateHand(game.playerHand);
    const dealerTotal = await dealerPlay(game);

    let embed;
    if (dealerTotal > 21) {
      addBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, true);
      embed = new EmbedBuilder()
        .setTitle('Dealer Busts! You Win!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)} (${dealerTotal})\n\nYou won **${formatCoins(game.bet * 2)}**!`)
        .setColor(0x4CAF50)
        .setTimestamp();
    } else if (playerTotal > dealerTotal) {
      addBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, true);
      embed = new EmbedBuilder()
        .setTitle('You Win!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)} (${dealerTotal})\n\nYou won **${formatCoins(game.bet * 2)}**!`)
        .setColor(0x4CAF50)
        .setTimestamp();
    } else if (playerTotal < dealerTotal) {
      removeBalance(interaction.user.id, game.bet);
      updateGameStats(interaction.user.id, false);
      embed = new EmbedBuilder()
        .setTitle('Dealer Wins!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)} (${dealerTotal})\n\nYou lost **${formatCoins(game.bet)}**.`)
        .setColor(0xF44336)
        .setTimestamp();
    } else {
      updateGameStats(interaction.user.id, false);
      embed = new EmbedBuilder()
        .setTitle('Push!')
        .setDescription(`**Your Hand:** ${formatHand(game.playerHand)} (${playerTotal})\n**Dealer:** ${formatHand(game.dealerHand)} (${dealerTotal})\n\nIt's a tie! Your bet was returned.`)
        .setColor(0xFF9800)
        .setTimestamp();
    }

    await interaction.update({ embeds: [embed], components: [] });
    return true;
  }

  return true;
}
