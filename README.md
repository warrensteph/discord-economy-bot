# Discord Economy Bot

A feature-rich Discord bot with a complete economy system, 11 mini-games for earning coins, a shop with purchasable roles and items, trading between users, daily rewards, and leaderboards.

## Features

### Economy System
- **Balance & Stats** - Track your coins, games played, win rate, and inventory value
- **Daily Rewards** - Claim daily coins with streak bonuses (up to +100 coins!)
- **Shop** - Buy exclusive roles and collectible items
- **Trading** - Trade items and coins with other users
- **Leaderboards** - Compete for top spots in balance, wins, or games played

### 11 Mini-Games
| Game | Command | Description |
|------|---------|-------------|
| Rock Paper Scissors | `/rps` | Classic RPS against the bot |
| Coin Flip | `/coinflip` | Heads or tails betting |
| Dice Roll | `/dice` | Roll dice against the bot |
| Slots | `/slots` | Slot machine with up to 50x jackpot |
| Blackjack | `/blackjack` | Play 21 against the dealer |
| Tic Tac Toe | `/tictactoe` | Beat the bot at TTT |
| Number Guess | `/guess` | Guess 1-10 for 5x payout |
| Trivia | `/trivia` | Answer questions for 2x payout |
| Memory Match | `/memory` | Find matching pairs |
| Word Scramble | `/scramble` | Unscramble words |
| Higher/Lower | `/highlow` | Streak-based multiplier game (up to 10x) |

### Shop Items
**Roles** (automatically assigned when purchased):
- Noobini Pizzanini (250 coins)
- Strawberry Elephant (500 coins)
- Dragon Cannelloli (1,000 coins)
- Los Mobilis (1,500 coins)
- Tortugini Dragonfrutini (2,500 coins)
- Cocofanto Elefanto (4,000 coins)

**Collectibles**:
- Lucky Coin, Double Coins, Mystic Gem, Golden Trophy, Royal Crown, Diamond Sword, Dragon Shield, Baby Dragon

## Setup Instructions

### 1. Create a Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. Enable these Privileged Gateway Intents:
   - **Message Content Intent** (required for word scramble game)
   - **Server Members Intent** (for user lookups)

### 2. Get Your Credentials
1. **Bot Token**: In the Bot section, click "Reset Token" and copy it
2. **Client ID**: In the General Information section, copy the "Application ID"

### 3. Invite the Bot to Your Server
1. Go to OAuth2 > URL Generator
2. Select scopes: `bot` and `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Roles
   - Embed Links
   - Read Message History
4. Copy the generated URL and open it to invite the bot

### 4. Set Environment Variables
Create a `.env` file or set these environment variables:
```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
ADMIN_KEY=your_secret_admin_key_here
```

### 5. Configure Roles (Optional)
Edit `src/utils/database.js` to set your server's role IDs in the `defaultShop.roles` array:
```javascript
{ id: 'role_name', name: 'Display Name', price: 500, type: 'role', rarity: 'rare', roleId: 'YOUR_ROLE_ID_HERE' }
```

### 6. Install Dependencies
```bash
npm install
```

### 7. Run the Bot
```bash
npm start
```

## Commands Reference

### Economy Commands
| Command | Description |
|---------|-------------|
| `/balance [user]` | Check coin balance and stats |
| `/daily` | Claim daily reward (streak bonuses!) |
| `/shop [category]` | Browse the shop |
| `/shop buy:<item_id>` | Purchase an item |
| `/inventory [user]` | View owned items |
| `/trade @user` | Trade with another user |
| `/leaderboard [type]` | View top players |
| `/help` | List all commands |

### Game Commands
All games require a bet amount (10-1000 coins depending on game).

| Command | Min Bet | Max Bet | Win Multiplier |
|---------|---------|---------|----------------|
| `/rps` | 10 | 1000 | 2x |
| `/coinflip` | 10 | 1000 | 2x |
| `/dice` | 10 | 1000 | 2x |
| `/slots` | 10 | 500 | 1.5x - 50x |
| `/blackjack` | 10 | 1000 | 2x (2.5x blackjack) |
| `/tictactoe` | 10 | 500 | 2x |
| `/guess` | 10 | 500 | 5x |
| `/trivia` | 10 | 500 | 2x |
| `/memory` | 10 | 300 | 2x + speed bonus |
| `/scramble` | 10 | 300 | 2x |
| `/highlow` | 10 | 500 | 1.5x - 10x |

## Admin Commands (Owner Only)

Admin commands are hidden and only work for the configured owner ID.

1. Login: `/admin login key:<admin_key>`
2. Available commands after login:
   - `/admin panel` - View control panel
   - `/admin give @user <amount>` - Give coins
   - `/admin take @user <amount>` - Take coins
   - `/admin setbalance @user <amount>` - Set balance
   - `/admin giveitem @user <item_id>` - Give any item
   - `/admin godmode [@user]` - Max out stats
   - `/admin reset @user` - Reset user data
   - `/admin broadcast <message>` - Server announcement

## Data Storage

User data is stored in JSON files in the `data/` directory:
- `users.json` - User balances, inventory, and stats
- `shop.json` - Shop configuration (auto-generated with defaults)

## Customization

### Adding New Shop Items
Edit the `defaultShop` object in `src/utils/database.js`:
```javascript
{ id: 'item_unique_id', name: 'Item Name', description: 'Description', price: 100, type: 'collectible', rarity: 'rare' }
```

Rarity options: `common`, `uncommon`, `rare`, `epic`, `legendary`

### Changing Cooldowns
Game cooldowns can be adjusted in each game file by changing the `checkCooldown` call:
```javascript
checkCooldown(userId, 'gamename', 10000) // 10 seconds
```

## License

MIT License - Feel free to use and modify!
