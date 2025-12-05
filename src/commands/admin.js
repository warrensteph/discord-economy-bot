import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, updateUser, addBalance, addItem, getShopItems } from '../utils/database.js';
import { formatCoins, successEmbed, errorEmbed, rarityEmoji } from '../utils/helpers.js';

const OWNER_ID = '1225731448833839184';
const authenticatedAdmins = new Set();

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin panel')
  .setDefaultMemberPermissions(0)
  .addSubcommand(subcommand =>
    subcommand
      .setName('login')
      .setDescription('Login to admin panel')
      .addStringOption(option =>
        option.setName('key')
          .setDescription('Admin key')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('panel')
      .setDescription('Open admin control panel'))
  .addSubcommand(subcommand =>
    subcommand
      .setName('give')
      .setDescription('Give coins to a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to give coins to')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Amount of coins')
          .setMinValue(1)
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('take')
      .setDescription('Take coins from a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to take coins from')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Amount of coins')
          .setMinValue(1)
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('setbalance')
      .setDescription('Set a user\'s balance')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to modify')
          .setRequired(true))
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('New balance')
          .setMinValue(0)
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('giveitem')
      .setDescription('Give an item to a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to give item to')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('item')
          .setDescription('Item ID to give')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('reset')
      .setDescription('Reset a user\'s data completely')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to reset')
          .setRequired(true)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('godmode')
      .setDescription('Give yourself max stats')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('User to give godmode')
          .setRequired(false)))
  .addSubcommand(subcommand =>
    subcommand
      .setName('broadcast')
      .setDescription('Send announcement to current channel')
      .addStringOption(option =>
        option.setName('message')
          .setDescription('Message to broadcast')
          .setRequired(true)));

function isOwner(userId) {
  return userId === OWNER_ID;
}

function isAdmin(userId) {
  return isOwner(userId) && authenticatedAdmins.has(userId);
}

export async function execute(interaction) {
  if (!isOwner(interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed('Access Denied', 'This command is not available.')],
      ephemeral: true
    });
  }

  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'login') {
    const key = interaction.options.getString('key');
    const adminKey = process.env.ADMIN_KEY;
    
    if (!adminKey) {
      return interaction.reply({
        embeds: [errorEmbed('Error', 'Admin system is not configured.')],
        ephemeral: true
      });
    }
    
    if (key === adminKey) {
      authenticatedAdmins.add(interaction.user.id);
      
      const embed = new EmbedBuilder()
        .setTitle('Admin Access Granted')
        .setDescription('Welcome, Administrator! You now have access to all admin commands.')
        .setColor(0xFF0000)
        .addFields(
          { name: 'Available Commands', value: [
            '`/admin panel` - View admin control panel',
            '`/admin give` - Give coins to users',
            '`/admin take` - Take coins from users',
            '`/admin setbalance` - Set user balance',
            '`/admin giveitem` - Give items to users',
            '`/admin reset` - Reset user data',
            '`/admin godmode` - Max out stats',
            '`/admin broadcast` - Send announcements'
          ].join('\n')}
        )
        .setFooter({ text: 'With great power comes great responsibility... or not!' })
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      return interaction.reply({
        embeds: [errorEmbed('Access Denied', 'Invalid admin key.')],
        ephemeral: true
      });
    }
  }
  
  if (!isAdmin(interaction.user.id)) {
    return interaction.reply({
      embeds: [errorEmbed('Access Denied', 'You must login first with `/admin login`')],
      ephemeral: true
    });
  }
  
  switch (subcommand) {
    case 'panel': {
      const embed = new EmbedBuilder()
        .setTitle('Admin Control Panel')
        .setDescription('Welcome to the admin abuse panel!')
        .setColor(0xFF0000)
        .addFields(
          { name: 'Economy Controls', value: '`/admin give` - Give coins\n`/admin take` - Take coins\n`/admin setbalance` - Set balance', inline: true },
          { name: 'Item Controls', value: '`/admin giveitem` - Give any item\n`/admin godmode` - Max everything', inline: true },
          { name: 'User Controls', value: '`/admin reset` - Reset user\n`/admin broadcast` - Announce', inline: true }
        )
        .setFooter({ text: 'Admin Panel - Use responsibly (or not)' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'give': {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      
      addBalance(targetUser.id, amount);
      const user = getUser(targetUser.id);
      
      const embed = successEmbed(
        'Coins Given!',
        `Gave **${formatCoins(amount)}** to ${targetUser}.\n\nTheir new balance: **${formatCoins(user.balance)}**`
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'take': {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      
      const user = getUser(targetUser.id);
      const newBalance = Math.max(0, user.balance - amount);
      updateUser(targetUser.id, { balance: newBalance });
      
      const embed = new EmbedBuilder()
        .setTitle('Coins Taken!')
        .setDescription(`Took **${formatCoins(amount)}** from ${targetUser}.\n\nTheir new balance: **${formatCoins(newBalance)}**`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'setbalance': {
      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      
      updateUser(targetUser.id, { balance: amount });
      
      const embed = successEmbed(
        'Balance Set!',
        `Set ${targetUser}'s balance to **${formatCoins(amount)}**`
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'giveitem': {
      const targetUser = interaction.options.getUser('user');
      const itemId = interaction.options.getString('item');
      
      const shop = getShopItems();
      const allItems = [...shop.roles, ...shop.items];
      const item = allItems.find(i => i.id === itemId);
      
      if (!item) {
        const itemList = allItems.map(i => `\`${i.id}\``).join(', ');
        return interaction.reply({
          embeds: [errorEmbed('Item Not Found', `Available items: ${itemList}`)],
          ephemeral: true
        });
      }
      
      addItem(targetUser.id, item);
      
      const embed = successEmbed(
        'Item Given!',
        `Gave **${rarityEmoji(item.rarity)} ${item.name}** to ${targetUser}`
      );
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'reset': {
      const targetUser = interaction.options.getUser('user');
      
      updateUser(targetUser.id, {
        balance: 100,
        inventory: [],
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalEarned: 0,
          totalSpent: 0
        },
        dailyStreak: 0,
        lastDaily: null,
        lastGame: {}
      });
      
      const embed = new EmbedBuilder()
        .setTitle('User Reset!')
        .setDescription(`${targetUser}'s data has been completely reset.`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'godmode': {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      const shop = getShopItems();
      const allItems = [...shop.roles, ...shop.items];
      
      updateUser(targetUser.id, {
        balance: 999999999,
        inventory: allItems.map(item => ({ ...item, acquiredAt: Date.now() })),
        stats: {
          gamesPlayed: 9999,
          gamesWon: 9999,
          totalEarned: 999999999,
          totalSpent: 0
        },
        dailyStreak: 365
      });
      
      const embed = new EmbedBuilder()
        .setTitle('GODMODE ACTIVATED!')
        .setDescription(`${targetUser} now has:\n\n- **999,999,999 coins**\n- **All items in the shop**\n- **9999 games played/won**\n- **365 day streak**`)
        .setColor(0xFFD700)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    
    case 'broadcast': {
      const message = interaction.options.getString('message');
      
      const embed = new EmbedBuilder()
        .setTitle('Server Announcement')
        .setDescription(message)
        .setColor(0xFF0000)
        .setFooter({ text: `Announced by ${interaction.user.username}` })
        .setTimestamp();
      
      await interaction.channel.send({ embeds: [embed] });
      await interaction.reply({ content: 'Broadcast sent!', ephemeral: true });
      break;
    }
  }
}
