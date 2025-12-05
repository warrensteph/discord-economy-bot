import { Client, Collection, GatewayIntentBits, Events, REST, Routes } from 'discord.js';

import * as balance from './commands/balance.js';
import * as shop from './commands/shop.js';
import * as trade from './commands/trade.js';
import * as daily from './commands/daily.js';
import * as leaderboard from './commands/leaderboard.js';
import * as inventory from './commands/inventory.js';
import * as help from './commands/help.js';
import * as admin from './commands/admin.js';

import * as rps from './games/rps.js';
import * as coinflip from './games/coinflip.js';
import * as dice from './games/dice.js';
import * as slots from './games/slots.js';
import * as guess from './games/guess.js';
import * as trivia from './games/trivia.js';
import * as blackjack from './games/blackjack.js';
import * as tictactoe from './games/tictactoe.js';
import * as memory from './games/memory.js';
import * as scramble from './games/scramble.js';
import * as highlow from './games/highlow.js';

const commands = [
  balance, shop, trade, daily, leaderboard, inventory, help, admin,
  rps, coinflip, dice, slots, guess, trivia, blackjack, tictactoe, memory, scramble, highlow
];

const buttonHandlers = [
  rps, coinflip, guess, trivia, blackjack, tictactoe, memory, highlow, trade
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.commands = new Collection();
commands.forEach(cmd => {
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
});

async function registerCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  
  if (!token || !clientId) {
    console.log('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
    return;
  }

  const rest = new REST().setToken(token);
  
  try {
    console.log('Registering slash commands...');
    
    const commandData = commands.map(cmd => cmd.data.toJSON());
    
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData }
    );
    
    console.log(`Successfully registered ${commandData.length} commands!`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}!`);
  console.log(`Bot is in ${c.guilds.cache.size} servers`);
  
  await registerCommands();
  
  client.user.setActivity('/balance | /shop | Games!');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    
    if (!command) {
      console.error(`Command ${interaction.commandName} not found`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      
      const errorMessage = { 
        content: 'There was an error executing this command!', 
        ephemeral: true 
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  } else if (interaction.isButton()) {
    for (const handler of buttonHandlers) {
      if (handler.handleButton) {
        try {
          const handled = await handler.handleButton(interaction);
          if (handled) break;
        } catch (error) {
          console.error('Button handler error:', error);
        }
      }
    }
  }
});

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('DISCORD_BOT_TOKEN is not set!');
  console.log('Please set the DISCORD_BOT_TOKEN environment variable.');
  process.exit(1);
}

client.login(token);
