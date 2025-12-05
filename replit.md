# Discord Economy Bot

## Overview
A feature-rich Discord bot with a complete economy system, 11 mini-games for earning coins, a shop with roles and items, trading, daily rewards, and leaderboards.

## Project Architecture
- **src/index.js** - Main bot entry point, command registration, and event handling
- **src/commands/** - Economy commands (balance, shop, trade, daily, leaderboard, inventory, help)
- **src/games/** - 11 mini-games (RPS, Coinflip, Dice, Slots, Guess, Trivia, Blackjack, Tic Tac Toe, Memory, Scramble, Higher/Lower)
- **src/utils/** - Database and helper utilities
- **data/** - JSON storage for user data

## Features

### Economy Commands
- `/balance` - Check coin balance and stats
- `/daily` - Claim daily rewards with streak bonuses
- `/shop` - Browse and purchase roles/items
- `/inventory` - View owned items
- `/trade` - Trade items/coins with other users
- `/leaderboard` - View top players
- `/help` - List all commands

### Admin Panel
- `/admin login` - Login with admin key
- `/admin panel` - View admin control panel
- `/admin give` - Give coins to any user
- `/admin take` - Take coins from any user
- `/admin setbalance` - Set exact balance
- `/admin giveitem` - Give any shop item
- `/admin godmode` - Max out stats (999M coins, all items, 365 streak)
- `/admin reset` - Reset a user's data
- `/admin broadcast` - Send server announcements

### Mini-Games (11 total)
1. `/rps` - Rock Paper Scissors
2. `/coinflip` - Heads or Tails
3. `/dice` - Roll dice against bot
4. `/slots` - Slot machine with multipliers
5. `/blackjack` - Play 21 against dealer
6. `/tictactoe` - Classic Tic Tac Toe
7. `/guess` - Guess number 1-10
8. `/trivia` - Answer trivia questions
9. `/memory` - Memory matching game
10. `/scramble` - Unscramble words
11. `/highlow` - Higher or lower streak game

## Environment Variables Required
- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID

## Setup Instructions
1. Create a Discord application at https://discord.com/developers/applications
2. Create a bot user and copy the token
3. Copy the Application ID (Client ID)
4. Add the bot to your server with these permissions: Send Messages, Use Slash Commands, Manage Roles
5. Set the environment variables and run the bot

## Recent Changes
- December 2024: Initial creation with full economy system and 11 games
