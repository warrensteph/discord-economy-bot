import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJSON(filePath, defaultData = {}) {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultData;
  }
}

function saveJSON(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getUser(userId) {
  const users = loadJSON(USERS_FILE, {});
  if (!users[userId]) {
    users[userId] = {
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
      lastGame: {},
      createdAt: Date.now()
    };
    saveJSON(USERS_FILE, users);
  }
  return users[userId];
}

export function updateUser(userId, data) {
  const users = loadJSON(USERS_FILE, {});
  users[userId] = { ...getUser(userId), ...data };
  saveJSON(USERS_FILE, users);
  return users[userId];
}

export function addBalance(userId, amount) {
  const user = getUser(userId);
  user.balance += amount;
  if (amount > 0) user.stats.totalEarned += amount;
  return updateUser(userId, user);
}

export function removeBalance(userId, amount) {
  const user = getUser(userId);
  if (user.balance < amount) return null;
  user.balance -= amount;
  user.stats.totalSpent += amount;
  return updateUser(userId, user);
}

export function addItem(userId, item) {
  const user = getUser(userId);
  user.inventory.push({ ...item, acquiredAt: Date.now() });
  return updateUser(userId, user);
}

export function removeItem(userId, itemId) {
  const user = getUser(userId);
  const index = user.inventory.findIndex(i => i.id === itemId);
  if (index === -1) return null;
  const removed = user.inventory.splice(index, 1)[0];
  updateUser(userId, user);
  return removed;
}

export function hasItem(userId, itemId) {
  const user = getUser(userId);
  return user.inventory.some(i => i.id === itemId);
}

export function updateGameStats(userId, won) {
  const user = getUser(userId);
  user.stats.gamesPlayed++;
  if (won) user.stats.gamesWon++;
  return updateUser(userId, user);
}

export function getLeaderboard(type = 'balance', limit = 10) {
  const users = loadJSON(USERS_FILE, {});
  const entries = Object.entries(users).map(([id, data]) => ({ id, ...data }));
  
  if (type === 'balance') {
    entries.sort((a, b) => b.balance - a.balance);
  } else if (type === 'wins') {
    entries.sort((a, b) => b.stats.gamesWon - a.stats.gamesWon);
  } else if (type === 'games') {
    entries.sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed);
  }
  
  return entries.slice(0, limit);
}

export function canClaimDaily(userId) {
  const user = getUser(userId);
  if (!user.lastDaily) return true;
  const now = Date.now();
  const last = new Date(user.lastDaily);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  return today.getTime() > last.getTime();
}

export function claimDaily(userId) {
  const user = getUser(userId);
  const now = Date.now();
  
  if (user.lastDaily) {
    const last = new Date(user.lastDaily);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    last.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    if (last.getTime() === yesterday.getTime()) {
      user.dailyStreak++;
    } else {
      user.dailyStreak = 1;
    }
  } else {
    user.dailyStreak = 1;
  }
  
  const baseReward = 25;
  const streakBonus = Math.min(user.dailyStreak * 5, 50);
  const reward = baseReward + streakBonus;
  
  user.lastDaily = now;
  user.balance += reward;
  user.stats.totalEarned += reward;
  
  updateUser(userId, user);
  return { reward, streak: user.dailyStreak };
}

export function checkCooldown(userId, game, cooldownMs = 30000) {
  const user = getUser(userId);
  const lastPlayed = user.lastGame[game];
  if (!lastPlayed) return { canPlay: true };
  
  const elapsed = Date.now() - lastPlayed;
  if (elapsed < cooldownMs) {
    return { canPlay: false, remaining: Math.ceil((cooldownMs - elapsed) / 1000) };
  }
  return { canPlay: true };
}

export function setCooldown(userId, game) {
  const user = getUser(userId);
  user.lastGame[game] = Date.now();
  updateUser(userId, user);
}

const defaultShop = {
  roles: [
    { 
      id: 'role_strawberry_elephant', 
      name: 'Strawberry Elephant', 
      description: 'A sweet elephant role - Top Tier Reward!', 
      price: 10000, 
      type: 'role', 
      rarity: 'legendary', 
      roleId: '1446495830965096591', 
      permissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS', 'USE_EXTERNAL_STICKERS', 'CREATE_PUBLIC_THREADS', 'CREATE_PRIVATE_THREADS', 'MENTION_EVERYONE', 'CHANGE_NICKNAME'] 
    },
    { 
      id: 'role_dragon_cannelloli', 
      name: 'Dragon Cannelloli', 
      description: 'A delicious dragon role - Elite Reward!', 
      price: 5000, 
      type: 'role', 
      rarity: 'epic', 
      roleId: '1446495803056197833', 
      permissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS', 'USE_EXTERNAL_STICKERS', 'CREATE_PUBLIC_THREADS', 'CHANGE_NICKNAME'] 
    },
    { 
      id: 'role_los_mobilis', 
      name: 'Los Mobilis', 
      description: 'The mobile legends - Premium Reward!', 
      price: 3500, 
      type: 'role', 
      rarity: 'epic', 
      roleId: '1446495771913617498', 
      permissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS', 'USE_EXTERNAL_STICKERS', 'CHANGE_NICKNAME'] 
    },
    { 
      id: 'role_tortugini_dragonfrutini', 
      name: 'Tortuggini', 
      description: 'Turtle dragon fruit fusion - Advanced Reward!', 
      price: 3000, 
      type: 'role', 
      rarity: 'rare', 
      roleId: '1446495739147452597', 
      permissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS'] 
    },
    { 
      id: 'role_cocofanto_elefanto', 
      name: 'Cocofanto', 
      description: 'Coconut elephant vibes - Intermediate Reward!', 
      price: 2500, 
      type: 'role', 
      rarity: 'rare', 
      roleId: '1446495693848969392', 
      permissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS'] 
    },
    { 
      id: 'role_noobini_pizzanini', 
      name: 'Noobini', 
      description: 'Pizza noob supreme - Starter Reward!', 
      price: 2000, 
      type: 'role', 
      rarity: 'uncommon', 
      roleId: '1446495657639809207', 
      permissions: ['SEND_MESSAGES', 'ADD_REACTIONS', 'CHANGE_NICKNAME'] 
    }
  ],
  items: [
    { id: 'item_lucky_coin', name: 'Lucky Coin', description: '+10% win chance for 1 hour', price: 200, type: 'consumable', rarity: 'uncommon' },
    { id: 'item_double_xp', name: 'Double Coins', description: '2x coins for next game', price: 150, type: 'consumable', rarity: 'uncommon' },
    { id: 'item_trophy', name: 'Golden Trophy', description: 'A symbol of excellence', price: 3000, type: 'collectible', rarity: 'epic' },
    { id: 'item_crown', name: 'Royal Crown', description: 'Fit for royalty', price: 7500, type: 'collectible', rarity: 'legendary' },
    { id: 'item_gem', name: 'Mystic Gem', description: 'A rare gemstone', price: 500, type: 'collectible', rarity: 'rare' },
    { id: 'item_sword', name: 'Diamond Sword', description: 'A legendary weapon', price: 4000, type: 'collectible', rarity: 'epic' },
    { id: 'item_shield', name: 'Dragon Shield', description: 'Forged in dragon fire', price: 4500, type: 'collectible', rarity: 'epic' },
    { id: 'item_pet_dragon', name: 'Baby Dragon', description: 'A cute dragon pet', price: 10000, type: 'collectible', rarity: 'legendary' }
  ]
};

export function getShopItems() {
  return loadJSON(SHOP_FILE, defaultShop);
}

export function getShopItem(itemId) {
  const shop = getShopItems();
  return [...shop.roles, ...shop.items].find(i => i.id === itemId);
}

export function addShopRole(roleData) {
  const shop = loadJSON(SHOP_FILE, defaultShop);
  const existingIndex = shop.roles.findIndex(r => r.id === roleData.id || r.roleId === roleData.roleId);
  if (existingIndex !== -1) {
    shop.roles[existingIndex] = roleData;
  } else {
    shop.roles.push(roleData);
  }
  saveJSON(SHOP_FILE, shop);
  return roleData;
}

export function removeShopRole(roleId) {
  const shop = loadJSON(SHOP_FILE, defaultShop);
  const index = shop.roles.findIndex(r => r.id === roleId || r.roleId === roleId);
  if (index === -1) return null;
  const removed = shop.roles.splice(index, 1)[0];
  saveJSON(SHOP_FILE, shop);
  return removed;
}

export function updateShopRole(roleId, updates) {
  const shop = loadJSON(SHOP_FILE, defaultShop);
  const index = shop.roles.findIndex(r => r.id === roleId || r.roleId === roleId);
  if (index === -1) return null;
  shop.roles[index] = { ...shop.roles[index], ...updates };
  saveJSON(SHOP_FILE, shop);
  return shop.roles[index];
}

export const RARITY_COLORS = {
  common: 0x9E9E9E,
  uncommon: 0x4CAF50,
  rare: 0x2196F3,
  epic: 0x9C27B0,
  legendary: 0xFFC107
};

export const RARITY_EMOJIS = {
  common: '',
  uncommon: '',
  rare: '',
  epic: '',
  legendary: ''
};
