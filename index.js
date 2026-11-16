const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log("=========================================");
console.log("ВЕРСИЯ NODE.JS:", process.version);
console.log("=========================================");

// ===== НАСТРОЙКИ =====
const TOKEN = "vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0";
const GROUP_ID = 243089386;
const ADMIN_ID = 200005093141;
const BONUS_CD = 86400; // 24 часа (в секундах)
const FORTUNA_CD = 600;

// Ссылка на стандартную аватарку (если у игрока закрыт профиль)
const DEFAULT_PROFILE_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&u=lu3E3ggWqF0yEAFf92En4aIiZtuv0TIPXL9GxEDIiJ4&cs=277x0';

// Массив ссылок для динамических картинок в рулетке
const ROULETTE_PHOTOS = [
    'https://vk.ru/photo-221392393_458171207', // ВНИМАНИЕ: Замени на ПРЯМУЮ ссылку (https://sun9-...), иначе ВК не загрузит!
];

const vk = new VK({ 
    token: TOKEN, 
    apiVersion: '5.199',
    pollingGroupId: GROUP_ID 
});

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'game.db');

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database(DB_FILE);
const dbRun = (query, params = []) => new Promise((res, rej) => db.run(query, params, function(e) { e ? rej(e) : res(this); }));
const dbGet = (query, params = []) => new Promise((res, rej) => db.get(query, params, (e, r) => e ? rej(e) : res(r)));
const dbAll = (query, params = []) => new Promise((res, rej) => db.all(query, params, (e, r) => e ? rej(e) : res(r)));

// Временные хранилища (в памяти)
const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const spamCache = new Map(); 
const chsbNotifyCache = new Map(); 

// Данные бизнесов
const BIZ_DATA = {
    'шаурма': { name: '🌯 Шаурма', price: 500000, baseIncome: 2000 },
    'кафе': { name: '☕ Кафе', price: 1500000, baseIncome: 4000 },
    'game zone': { name: '🕹️ Отдел Game Zone', price: 5000000, baseIncome: 6000 },
    'казино': { name: '🎰 Казино', price: 15000000, baseIncome: 10000 },
    'пятерочка': { name: '🏪 24/7 Пятёрочка', price: 50000000, baseIncome: 15000 }
};

// ===== АВТОСАЛОН =====
const CARS_DATA = {
    'м5 ф90': { name: 'BMW M5 F90', price: 15000000, sellPrice: 10000000 },
    'м5 ф10': { name: 'BMW M5 F10', price: 8000000, sellPrice: 5000000 },
    'м3': { name: 'BMW M3 G80', price: 12000000, sellPrice: 8000000 },
    'мерседес': { name: 'Mercedes-Benz E-Class', price: 10000000, sellPrice: 6000000 },
    'ауди': { name: 'Audi RS7', price: 18000000, sellPrice: 12000000 },
    'ламборгини': { name: 'Lamborghini Huracan', price: 35000000, sellPrice: 25000000 },
    'порше': { name: 'Porsche 911 Turbo', price: 28000000, sellPrice: 20000000 }
};

// ===== НЕДВИЖИМОСТЬ =====
const PROPERTY_DATA = {
    'нижегородская': { name: 'Нижегородская', housePrice: 5000000, garagePrice: 1000000 },
    'рублевка': { name: 'Рублевка', housePrice: 25000000, garagePrice: 5000000 },
    'егоровка': { name: 'Егоровка', housePrice: 50000000, garagePrice: 10000000 },
    'гарель': { name: 'Гарель', housePrice: 100000000, garagePrice: 20000000 }
};

async function initDB() {
    await dbRun("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, reputation INTEGER DEFAULT 0, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, reg_date TEXT, duel_wins INTEGER DEFAULT 0, bonus_count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS active_duels (msg_id TEXT PRIMARY KEY, challenger TEXT, bet INTEGER, peer_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS bonus_cd (user_id TEXT PRIMARY KEY, last_used INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS fortune_cd (user_id TEXT PRIMARY KEY, last_used INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS promos (code TEXT PRIMARY KEY, amount INTEGER, limit_count INTEGER, used_by TEXT DEFAULT '')");
    await dbRun("CREATE TABLE IF NOT EXISTS games (game_id TEXT PRIMARY KEY, user_id TEXT, bet INTEGER, mines TEXT, opened TEXT, multiplier REAL, msg_id TEXT, start_time INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS blacklist (user_id TEXT PRIMARY KEY, reason TEXT, until INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS chat_bans (user_id TEXT, peer_id TEXT, reason TEXT, PRIMARY KEY (user_id, peer_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS mutes (user_id TEXT, peer_id TEXT, mute_until INTEGER, reason TEXT, PRIMARY KEY (user_id, peer_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS frozen (user_id TEXT PRIMARY KEY)");
    await dbRun("CREATE TABLE IF NOT EXISTS prop_deals (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id TEXT, buyer_id TEXT, type TEXT, prop_id INTEGER, price INTEGER, peer_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS chat_messages (peer_id TEXT, user_id TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (peer_id, user_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT PRIMARY KEY, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

    try { await dbRun("ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN reg_date TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN duel_wins INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN bonus_count INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN car TEXT DEFAULT NULL"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN last_bonus_date TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN bonus_streak INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE businesses ADD COLUMN last_withdraw INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE games ADD COLUMN start_time INTEGER"); } catch(e) {}
    try { await dbRun("ALTER TABLE blacklist ADD COLUMN until INTEGER DEFAULT 0"); } catch(e) {}
    
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_enabled', '0')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_limit', '5')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_time', '60')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_mute', '10')");
    
    console.log("--- БАЗА ДАННЫХ ГОТОВА ---");
}
initDB();

// ===== ХЕЛПЕРЫ =====
function parseAmount(str) {
    if (!str) return 0;
    str = String(str).toLowerCase().replace(/\s/g, '');
    
    if (str.endsWith('всё') || str.endsWith('все') || str.endsWith('вб')) return 'ALL'; 
    
    let mult = 1;
    if (str.endsWith('кккк') || str.endsWith('kkkk')) { mult = 1000000000000; str = str.slice(0, -4); }
    else if (str.endsWith('ккк') || str.endsWith('kkk')) { mult = 1000000000; str = str.slice(0, -3); }
    else if (str.endsWith('кк') || str.endsWith('kk')) { mult = 1000000; str = str.slice(0, -2); }
    else if (str.endsWith('к') || str.endsWith('k')) { mult = 1000; str = str.slice(0, -1); }
    else if (str.endsWith('м') || str.endsWith('m')) { mult = 1000000; str = str.slice(0, -1); }
    
    let num = parseFloat(str.replace(',', '.'));
    if (isNaN(num)) return 0;
    return Math.floor(num * mult);
}

function formatShortMoney(num) {
    if (num >= 1000000000000) return (num / 1000000000000).toFixed(2).replace(/\.00$/, '') + 'кккк';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2).replace(/\.00$/, '') + 'ккк';
    if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'кк';
    if (num >= 1000) return (num / 1000).toFixed(2).replace(/\.00$/, '') + 'к';
    return num.toString();
}

async function getBalance(userId) {
    const row = await dbGet("SELECT balance FROM users WHERE user_id = ?", [String(userId)]);
    if (!row) {
        await dbRun("INSERT INTO users (user_id, balance) VALUES (?, 1000)", [String(userId)]);
        return 1000;
    }
    let bal = Number(row.balance);
    if (isNaN(bal) || !isFinite(bal)) {
        await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(userId)]);
        return 0;
    }
    return bal;
}

async function updateBalance(userId, amount) {
    const bal = await getBalance(userId);
    let amt = Number(amount);
    if (isNaN(amt) || !isFinite(amt)) amt = 0;
    const newBal = Math.floor(Number(bal) + amt);
    await dbRun("UPDATE users SET balance = ? WHERE user_id = ?", [newBal, String(userId)]);
}

async function getReputation(userId) {
    const row = await dbGet("SELECT reputation FROM users WHERE user_id = ?", [String(userId)]);
    return row ? (Number(row.reputation) || 0) : 0;
}

async function updateReputation(userId, amount) {
    const rep = await getReputation(userId);
    await dbRun("UPDATE users SET reputation = ? WHERE user_id = ?", [rep + amount, String(userId)]);
}

async function getFullName(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId });
        return `[id${userId}|${user.first_name} ${user.last_name || ''}]`;
    } catch { return `[id${userId}|Игрок]`; }
}

function formatMoney(num) { 
    let n = Number(num);
    if (isNaN(n) || !isFinite(n)) n = 0;
    return n.toLocaleString('ru-RU'); 
}

async function getTargetAndReason(message, cmdName) {
    let targetId = null;
    let text = message.text || '';
    let reason = text.replace(new RegExp(`^\\/?${cmdName}\\s*`, 'i'), '');

    if (message.hasReplyMessage) {
        targetId = message.replyMessage.senderId;
    } else {
        const idMatch = reason.match(/\[id(\d+)\|[^\]]+\]/i);
        if (idMatch) {
            targetId = parseInt(idMatch[1]);
            reason = reason.replace(idMatch[0], ''); 
        } else {
            const atIdMatch = reason.match(/@id(\d+)/i);
            if (atIdMatch) {
                targetId = parseInt(atIdMatch[1]);
                reason = reason.replace(atIdMatch[0], ''); 
            } else {
                const urlMatch = reason.match(/(?:https?:\/\/)?(?:vk\.com|vk\.ru)\/([a-zA-Z0-9._]+)/i);
                if (urlMatch) {
                    try {
                        const res = await vk.api.utils.resolveScreenName({ screen_name: urlMatch[1] });
                        if (res.type === 'user' || res.type === 'group') targetId = res.object_id;
                    } catch (e) {}
                    reason = reason.replace(urlMatch[0], ''); 
                } else {
                    const mentionMatch = reason.match(/@([a-zA-Z0-9._]+)/i);
                    if (mentionMatch) {
                        try {
                            const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                            if (res.type === 'user') targetId = res.object_id;
                        } catch (e) {}
                        reason = reason.replace(mentionMatch[0], ''); 
                    }
                }
            }
        }
    }

    reason = reason.replace(/[\[\]]/g, '').replace(/"/g, '').trim();
    if (!reason) reason = "Причина не указана";

    return { targetId, reason };
}

// ===== ГЕНЕРАТОР ТЕКСТА И КЛАВИАТУРЫ ДЛЯ МИН =====
function getMinesGameUI(gameId, bet, minesCount, minesArr, opened, isLoss = false, hitCell = null, name = "", balance = 0, timeLeft = 60) {
    const totalSafe = 9 - minesCount;
    const currentOpened = opened.length;

    let currentMult = 1.0;
    for (let i = 0; i < currentOpened; i++) {
        currentMult *= (9 - i) / (9 - minesCount - i);
    }
    currentMult = Math.round(currentMult * 0.95 * 100) / 100;
    const currentMoney = Math.floor(bet * currentMult);

    let nextMult = 1.0;
    if (currentOpened < totalSafe) {
        for (let i = 0; i <= currentOpened; i++) {
            nextMult *= (9 - i) / (9 - minesCount - i);
        }
        nextMult = Math.round(nextMult * 0.95 * 100) / 100;
    }
    const nextMoney = Math.floor(bet * nextMult);
    const chance = Math.floor(((9 - minesCount - currentOpened) / (9 - currentOpened)) * 100);

    let progressBar = "🟩".repeat(currentOpened) + "⬜".repeat(totalSafe - currentOpened);

    if (isLoss) {
        const lostMoney = currentMoney;
        return {
            text: `💥 БАБАХ! ПОРАЖЕНИЕ\n────────────────────\n👤 ${name} наступил(а) на мину!\n💣 Мин на поле: ${minesCount}\n✅ Успел(а) открыть: ${currentOpened}\n\n📉 Потеряно: -${bet} 💰\n😢 Не забрал(а): ${lostMoney} 💰 (x${currentMult})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Бывает. Следующая будет твоей 🍀`,
            kb: buildMinesKb(gameId, opened, minesArr, true, hitCell)
        };
    } else {
        const randomPhrases = [
            "Выбирай клетку! Первый ход — самый волнующий 😈",
            "Чисто! Сапёр бы гордился 👏",
            "Ещё немного, и можно забирать 💸",
            "Осторожно, мины рядом... 💣",
            "Фортуна улыбается тебе 😉"
        ];
        const phrase = currentOpened === 0 ? randomPhrases[0] : randomPhrases[Math.floor(Math.random() * (randomPhrases.length - 1)) + 1];

        return {
            text: `💣 МИНЫ\n────────────────────\n👤 ${name}\n💵 Ставка: ${bet} | 💣 Мин: ${minesCount}\n\n${progressBar} ${currentOpened}/${totalSafe}\n📈 Сейчас: x${currentMult.toFixed(2)} → ${currentMoney} 💰\n🎯 Следующая: x${nextMult.toFixed(2)} → ${nextMoney} 💰\n🍀 Шанс безопасной клетки: ${chance}%\n⏱ Осталось: ${timeLeft} сек.\n\n💬 ${phrase}`,
            kb: buildMinesKb(gameId, opened, minesArr, false, null, currentMoney)
        };
    }
}

function buildMinesKb(gameId, opened, mines = [], isGameOver = false, hitCell = null, currentMoney = 0) {
    const kb = Keyboard.builder().inline();
    for (let i = 1; i <= 9; i++) {
        if (isGameOver) {
            if (i === hitCell) {
                kb.callbackButton({ label: '💥', payload: { cmd: 'none' }, color: Keyboard.NEGATIVE_COLOR });
            } else if (mines.includes(i)) {
                kb.callbackButton({ label: '💣', payload: { cmd: 'none' }, color: Keyboard.NEGATIVE_COLOR });
            } else if (opened.includes(i)) {
                kb.callbackButton({ label: '✅', payload: { cmd: 'none' }, color: Keyboard.POSITIVE_COLOR });
            } else {
                kb.callbackButton({ label: '⬜', payload: { cmd: 'none' }, color: Keyboard.SECONDARY_COLOR });
            }
        } else {
            if (opened.includes(i)) {
                kb.callbackButton({ label: '✅', payload: { cmd: 'none' }, color: Keyboard.POSITIVE_COLOR });
            } else {
                kb.callbackButton({ label: '❓', payload: { cmd: 'mines_click', gameId: String(gameId), cell: String(i) }, color: Keyboard.SECONDARY_COLOR });
            }
        }
        if (i % 3 === 0) kb.row();
    }
    
    if (!isGameOver && currentMoney > 0 && opened.length > 0) {
        kb.callbackButton({ label: `💰 Забрать ${currentMoney}`, payload: { cmd: 'mines_cashout', gameId: String(gameId) }, color: Keyboard.SECONDARY_COLOR });
    }
    return kb.toString();
}

// ===== КЛАВИАТУРЫ =====
const mainKb = Keyboard.builder()
    .textButton({ label: '💼 Работа', payload: 'work', color: Keyboard.POSITIVE_COLOR })
    .textButton({ label: '🎰 Рулетка', payload: 'roulette', color: Keyboard.PRIMARY_COLOR })
    .row()
    .textButton({ label: '👤 Профиль', payload: 'profile', color: Keyboard.SECONDARY_COLOR })
    .textButton({ label: '🏆 Топ', payload: 'top', color: Keyboard.SECONDARY_COLOR });

const getWorkKb = () => Keyboard.builder().inline()
    .callbackButton({ label: '🎣 Рыбалка', payload: { cmd: 'work_do', type: 'Рыбалка' }, color: Keyboard.POSITIVE_COLOR })
    .callbackButton({ label: '🚕 Такси', payload: { cmd: 'work_do', type: 'Такси' }, color: Keyboard.POSITIVE_COLOR })
    .callbackButton({ label: '🔫 Охота', payload: { cmd: 'work_do', type: 'Охота' }, color: Keyboard.POSITIVE_COLOR })
    .toString();

const getCasinoKb = () => Keyboard.builder().inline()
    .callbackButton({ label: 'Рулетка', payload: { cmd: 'casino_info', game: 'roulette' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: 'Краш', payload: { cmd: 'casino_info', game: 'crash' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: 'Монетка', payload: { cmd: 'casino_info', game: 'coin' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: 'Стакан', payload: { cmd: 'casino_info', game: 'glass' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: 'Кубик', payload: { cmd: 'casino_info', game: 'dice' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: 'Автомат', payload: { cmd: 'casino_info', game: 'slot' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: 'Блэкджек', payload: { cmd: 'casino_info', game: 'blackjack' }, color: Keyboard.NEGATIVE_COLOR })
    .callbackButton({ label: 'Дрим', payload: { cmd: 'casino_info', game: 'dream' }, color: Keyboard.NEGATIVE_COLOR })
    .toString();

const getHelpKb = () => Keyboard.builder().inline()
    .callbackButton({ label: '🎰 Игры', payload: { cmd: 'help_menu', section: 'games' }, color: Keyboard.PRIMARY_COLOR })
    .callbackButton({ label: '💼 Экономика', payload: { cmd: 'help_menu', section: 'eco' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: '🏠 Дома', payload: { cmd: 'help_menu', section: 'houses' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: '🏘️ Гаражи', payload: { cmd: 'help_menu', section: 'garages' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: '👤 Профиль', payload: { cmd: 'help_menu', section: 'profile' }, color: Keyboard.SECONDARY_COLOR })
    .toString();

const getHelpBackKb = () => Keyboard.builder().inline()
    .callbackButton({ label: '🔙 Назад', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR })
    .toString();

const getSettingsKb = async (enabled, limit, time, mute) => {
    const kb = Keyboard.builder().inline();
    kb.callbackButton({ label: '🟢 Включить', payload: { cmd: 'settings_toggle', state: '1' }, color: enabled === '1' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🔴 Выключить', payload: { cmd: 'settings_toggle', state: '0' }, color: enabled === '0' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: `Лимит: ${limit}`, payload: { cmd: 'settings_edit', field: 'limit' }, color: Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: `Время (сек): ${time}`, payload: { cmd: 'settings_edit', field: 'time' }, color: Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: `Мут (мин): ${mute}`, payload: { cmd: 'settings_edit', field: 'mute' }, color: Keyboard.SECONDARY_COLOR });
    return kb.toString();
};

const getDuelKb = (duelId) => Keyboard.builder().inline().callbackButton({
    label: '⚔️ Сразиться',
    payload: { cmd: 'duel_accept', duel_id: duelId },
    color: Keyboard.POSITIVE_COLOR
}).toString();

const getMinesCountKb = (gameId) => {
    const kb = Keyboard.builder().inline();
    let count = 0;
    for (let i = 2; i <= 8; i++) {
        kb.callbackButton({ label: `${i} 💣`, payload: { cmd: 'mines_set', gameId: String(gameId), count: String(i) }, color: Keyboard.SECONDARY_COLOR });
        count++;
        if (count % 4 === 0 && i !== 8) kb.row();
    }
    return kb.toString();
};

const getTopKb = (authorId, type = 'coins', scope = 'chat', repType = 'pos') => {
    const kb = Keyboard.builder().inline();
    
    kb.callbackButton({ label: '💰 Моне...', payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Уров...', payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Репу...', payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();

    kb.callbackButton({ label: '⚔️ Дуэли', payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🎁 Бонус', payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    if (type === 'rep') {
        kb.callbackButton({ label: '➕ Положит.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.callbackButton({ label: '➖ Отрицат.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.row();
    }

    kb.callbackButton({ label: '🌍 Общее', payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 В беседе', payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });

    return kb.toString();
};

const getBizKb = (authorId) => Keyboard.builder().inline()
    .callbackButton({ label: 'Повысить уровень', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR })
    .toString();

// ===== ФУНКЦИЯ ДЛЯ ДИНАМИЧЕСКОГО ФОТО В РУЛЕТКЕ =====
async function getRouletteAttachment() {
    if (ROULETTE_PHOTOS.length === 0) return null;
    
    const url = ROULETTE_PHOTOS[Math.floor(Math.random() * ROULETTE_PHOTOS.length)];
    
    try {
        const uploaded = await vk.upload.messagePhoto({
            source: { value: url }
        });
        return uploaded.toString();
    } catch (e) {
        console.error("Ошибка загрузки динамического фото для рулетки:", e);
        return null;
    }
}

// ===== ФУНКЦИЯ ЗАГРУЗКИ АВАТАРКИ ПОЛЬЗОВАТЕЛЯ (ДЛЯ ПРОФИЛЯ) =====
async function getUserAvatar(userId) {
    try {
        // Запрашиваем фото профиля 200x200
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200' });
        const avatarUrl = user.photo_200 || DEFAULT_PROFILE_PHOTO;
        
        const uploaded = await vk.upload.messagePhoto({
            source: { value: avatarUrl }
        });
        return uploaded.toString();
    } catch (e) {
        console.error("Ошибка загрузки аватара:", e);
        return null;
    }
}

// ===== ПРИВЕТСТВИЕ И АВТО-КИК ЗАБАНЕННЫХ =====
vk.updates.on('chat_invite_user', async (context) => {
    if (context.memberId > 0) {
        const globalBan = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
        if (globalBan) {
            if (globalBan.until !== 0 && Date.now() > globalBan.until) {
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
            } else {
                try {
                    await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID });
                } catch(e) {}
                return;
            }
        }

        const chatBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(context.memberId), String(context.peerId)]);
        if (chatBan) {
            try {
                await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID });
                await vk.api.messages.send({
                    peer_id: context.peerId,
                    message: `🚫 [id${context.memberId}|Игрок] был автоматически исключен из беседы, так как имеет бан в этой беседе.\n📌 Причина: ${chatBan.reason}`,
                    random_id: Math.floor(Math.random() * 1000000000),
                    disable_mentions: 1
                });
            } catch(e) {} 
        }
    }

    if (String(context.memberId) === String(-GROUP_ID)) {
        const actKb = Keyboard.builder().inline()
            .callbackButton({ label: 'Активировать', payload: { cmd: 'activate_bot' }, color: Keyboard.POSITIVE_COLOR })
            .callbackButton({ label: 'Не активировать', payload: { cmd: 'decline_bot' }, color: Keyboard.NEGATIVE_COLOR });
        
        try {
            await vk.api.messages.send({
                peer_id: context.peerId,
                message: "Привет! Я Официальный бот Game Zone. Для того чтобы я начал работать, выдайте мне права администратора и напишите /start. После этого напишите /help для ознакомления с командами.",
                keyboard: actKb.toString(),
                random_id: Math.floor(Math.random() * 1000000000),
                group_id: GROUP_ID,
                disable_mentions: 1
            });
        } catch (err) {}
    }
});

// ===== ОБРАБОТКА СООБЩЕНИЙ =====
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox) return;
    if (message.senderId < 0) return;

    try {
        const text = message.text ? message.text.trim().toLowerCase() : '';
        if (!text) return;

        const userId = message.senderId;
        const peerId = message.peerId;
        const isLs = peerId === userId;

        const cleanText = text.replace(/\//g, '').trim();
        const parts = cleanText.split(/\s+/);
        const cmdWord = parts[0];

        // --- ЗАМОРОЗКА ---
        if (userId !== ADMIN_ID) {
            const isFrozen = await dbGet("SELECT user_id FROM frozen WHERE user_id = ?", [String(userId)]);
            if (isFrozen) {
                return await message.reply("💀 Вы заморожены в боте. Ожидайте, когда вам выдадут наказание!");
            }
        }

        // --- ГЛОБАЛЬНЫЙ ЧС ---
        if (userId !== ADMIN_ID) {
            const isBlacklisted = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(userId)]);
            if (isBlacklisted) {
                if (isBlacklisted.until !== 0 && Date.now() > isBlacklisted.until) {
                    await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(userId)]);
                } else {
                    const cacheKey = `chsb_${userId}`;
                    if (!chsbNotifyCache.has(cacheKey) || Date.now() - chsbNotifyCache.get(cacheKey) > 60000) {
                        chsbNotifyCache.set(cacheKey, Date.now());
                        
                        let timeStr = isBlacklisted.until === 0 ? "НАВСЕГДА" : `до ${new Date(isBlacklisted.until).toLocaleString('ru-RU')}`;
                        const banText = `😈 Вы были занесены в ЧС бота ${timeStr} по причине: ${isBlacklisted.reason}`;
                        
                        const banKb = Keyboard.builder().inline()
                            .urlButton({ label: 'Получить разбан', url: `https://vk.ru/topic-243089386_69303056` })
                            .row()
                            .urlButton({ label: 'Правила бота', url: `https://vk.com/public${GROUP_ID}` });
                        
                        try {
                            await vk.api.messages.send({
                                peer_id: peerId,
                                message: banText,
                                keyboard: banKb.toString(),
                                random_id: Math.floor(Math.random() * 1000000000),
                                disable_mentions: 1
                            });
                        } catch(e) {}
                    }
                    return; 
                }
            }
        }

        // --- МУТ ---
        if (message.isChat && userId !== ADMIN_ID) {
            const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
            if (activeMute) {
                if (Date.now() < activeMute.mute_until) {
                    try {
                        await vk.api.messages.delete({ 
                            peer_id: peerId, 
                            cmids: [message.conversationMessageId], 
                            delete_for_all: 1 
                        });
                    } catch (e) {
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e2) {}
                    }
                    return; 
                } else {
                    await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
                }
            }
        }

        // --- ЛОГИКА АНТИСПАМА ---
        if (message.isChat && userId !== ADMIN_ID) {
            const spamEnabled = await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'");
            if (spamEnabled && spamEnabled.value === '1') {
                const limitDb = await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'");
                const timeDb = await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'");
                const muteDb = await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'");
                
                const limit = Number(limitDb?.value || 5);
                const timeSec = Number(timeDb?.value || 60);
                const muteMin = Number(muteDb?.value || 10);

                const now = Date.now();
                const cacheKey = `${peerId}_${userId}`;
                let spamData = spamCache.get(cacheKey);

                if (!spamData) {
                    spamData = { count: 0, lastReset: now, isMuted: false, muteEndTime: 0 };
                }

                if (spamData.isMuted) {
                    if (now < spamData.muteEndTime) {
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch (e) {}
                        return; 
                    } else {
                        spamData.isMuted = false;
                    }
                }

                if (now - spamData.lastReset >= timeSec * 1000) {
                    spamData.count = 0;
                    spamData.lastReset = now;
                }

                spamData.count++;
                spamCache.set(cacheKey, spamData);

                if (spamData.count >= limit && !spamData.isMuted) {
                    spamData.isMuted = true; 
                    spamData.muteEndTime = now + (muteMin * 60 * 1000);
                    spamCache.set(cacheKey, spamData);
                    
                    try {
                        await vk.api.messages.changeConversationMemberRestrictions({
                            group_id: GROUP_ID,
                            peer_id: peerId,
                            member_id: userId,
                            action: 'ro',
                            for: muteMin * 60
                        });
                        
                        await message.reply(`🚫 [id${userId}|Игрок] получил блокировку чата на ${muteMin} минут за нарушение антиспама.`);
                        spamData.count = 0; 
                        spamCache.set(cacheKey, spamData);

                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e) {}
                    } catch(e) {
                        spamData.isMuted = false;
                        spamCache.set(cacheKey, spamData);
                    }
                }
            }
        }

        // --- ОБРАБОТКА ВВОДА НАСТРОЕК ---
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            const val = parseFloat(cleanText);
            if (!isNaN(val) && val > 0) {
                await dbRun("UPDATE settings SET value = ? WHERE key = ?", [String(val), state]);
                adminStates.delete(userId);
                
                const enabled = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value;
                const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
                const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
                const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;

                let statusText = enabled === '1' ? "🟢 Включен" : "🔴 Выключен";

                return await message.reply(`✅ Настройки сохранены!\n\n⚙️ Настройки антиспама:\nСтатус: ${statusText}`, {
                    keyboard: await getSettingsKb(enabled, limit, time, mute)
                });
            } else {
                return await message.reply("❌ Введите корректное число больше 0.");
            }
        }

        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cp', 'ping', 'пинг', 'убрать', 'настройки', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж'];
        
        // Если сообщение не начинается со слеша и первое слово не является командой - игнорируем
        if (!text.startsWith('/') && !validCmds.includes(cmdWord)) {
            return; 
        }

        // --- СИСТЕМА УРОВНЕЙ ---
        let userRow = await dbGet("SELECT xp, level, reg_date FROM users WHERE user_id = ?", [String(userId)]);
        if (!userRow) {
            const today = new Date().toLocaleDateString('ru-RU');
            await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), today]);
        } else {
            if (!userRow.reg_date) {
                const today = new Date().toLocaleDateString('ru-RU');
                await dbRun("UPDATE users SET reg_date = ? WHERE user_id = ?", [today, String(userId)]);
            }
            let newXp = (Number(userRow.xp) || 0) + 40;
            let newLvl = Number(userRow.level) || 1;
            while (newXp >= newLvl * 500) {
                newXp -= newLvl * 500;
                newLvl++;
            }
            await dbRun("UPDATE users SET xp = ?, level = ? WHERE user_id = ?", [newXp, newLvl, String(userId)]);
        }

        if (message.isChat) {
            const existing = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            if (existing) {
                await dbRun("UPDATE chat_messages SET count = count + 1 WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            } else {
                await dbRun("INSERT INTO chat_messages (peer_id, user_id, count) VALUES (?, ?, 1)", [String(peerId), String(userId)]);
            }
        }

        const balance = await getBalance(userId);
        const rep = await getReputation(userId);

        const replyParams = (kb = undefined) => {
            const p = { disable_mentions: 1 };
            if (kb) p.keyboard = kb;
            return p;
        };

        if (cmdWord === 'начать' || cmdWord === 'start') {
            if (message.isChat) {
                try {
                    const members = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                    const admin = members.items.find(m => m.member_id === userId && (m.is_admin || m.is_owner));
                    
                    if (!admin && userId !== ADMIN_ID) {
                        return await message.reply("⚠️ Ошибка! Вы не являетесь администратором беседы. Чтобы активировать бота, попросите администратора написать /start.", replyParams());
                    }
                    return await message.reply("✅ Бот успешно активирован в этой беседе! Напишите /help для списка команд.", replyParams());
                } catch(e) {
                    return await message.reply("⚠️ Ошибка! Убедитесь, что я являюсь администратором беседы.", replyParams());
                }
            } else {
                return await message.reply("👋 Привет! Я Официальный бот Game Zone. Выбирай действие на клавиатуре или напиши /help.", replyParams(mainKb));
            }
        }

        // --- HELP ---
        if (cmdWord === 'help' || cmdWord === 'помощь' || cmdWord === 'команды') {
            return await message.reply("📖 Выберите раздел с командами:", replyParams(getHelpKb()));
        }

        // --- PING ---
        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now();
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            const ping = Date.now() - start;
            
            let status = "🟢 Отлично";
            if (ping > 150) status = "🟡 Нормально";
            if (ping > 300) status = "🔴 Плохо";

            return await message.reply(`🏓 Понг!\n\n⚡ Скорость соединения: ${ping} мс\n📊 Статус сети: ${status}`, replyParams());
        }

        // --- ПРОФИЛЬ С ДИНАМИЧЕСКИМ АВАТАРОМ ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const uInfo = await dbGet("SELECT xp, level, reg_date, car FROM users WHERE user_id = ?", [String(userId)]);
            const lvl = uInfo.level || 1;
            const xp = uInfo.xp || 0;
            const needXp = lvl * 500;
            const date = uInfo.reg_date || new Date().toLocaleDateString('ru-RU');
            const car = uInfo.car || "Нет";
            
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house'", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage'", [String(userId)]);
            
            const houseStr = houseData ? `${houseData.location} (Т${houseData.tier})` : "Нет";
            const garageStr = garageData ? `${garageData.location} (Т${garageData.tier})` : "Нет";

            const profText = `🏠 Профиль ${await getFullName(userId)}\n\n💵 Баланс: ${formatMoney(balance)}$\n⭐ Репутация: ${rep}\n📊 Уровень: ${lvl} (${xp}/${needXp} XP)\n\n🏠 Дом: ${houseStr}\n🏘️ Гараж: ${garageStr}\n🚗 Машина: ${car}\n\n📅 Регистрация: ${date}\n🆔 ID: ${userId}`;

            // Получаем аватарку самого пользователя
            const attachment = await getUserAvatar(userId);

            return await message.reply({
                message: profText,
                attachment: attachment || undefined,
                disable_mentions: 1
            });
        }

        // --- АВТОСАЛОН ---
        if (cmdWord === 'машины') {
            let txt = "🚗 Доступные машины в автосалоне:\n\n";
            for (const [key, data] of Object.entries(CARS_DATA)) {
                txt += `${data.name} — ${formatMoney(data.price)}$\n`;
            }
            txt += "\n🛒 Чтобы купить, напишите: /купить машина [Название]\nПример: /купить машина м5 ф90";
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'купить' && parts[1] === 'машина') {
            const args = message.text.split(' ');
            args.shift(); 
            args.shift(); 
            const query = args.join(' ').toLowerCase().trim();

            if (!query) return await message.reply("❌ Укажите название машины. Пример: /купить машина м5 ф90");

            let selectedCar = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) {
                    selectedCar = data;
                    break;
                }
            }

            if (!selectedCar) return await message.reply("❌ Такой машины нет в автосалоне. Список: /машины");

            const userCarRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
            if (userCarRow && userCarRow.car) {
                return await message.reply(`❌ У вас уже есть машина (${userCarRow.car}). Вы не можете купить вторую.`);
            }

            if (balance < selectedCar.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedCar.price)}$, у вас ${formatMoney(balance)}.`);

            await updateBalance(userId, -selectedCar.price);
            await dbRun("UPDATE users SET car = ? WHERE user_id = ?", [selectedCar.name, String(userId)]);

            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${selectedCar.name} за ${formatMoney(selectedCar.price)}$.`, replyParams());
        }

        // --- ПРОДАЖА МАШИНЫ ГОСУДАРСТВУ ---
        if (cmdWord === 'sellcar' || cmdWord === 'слить') {
            const userCarRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
            if (!userCarRow || !userCarRow.car) {
                return await message.reply("❌ У вас нет машины, чтобы её слить государству.", replyParams());
            }

            let carData = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.name === userCarRow.car) {
                    carData = data;
                    break;
                }
            }

            if (!carData) {
                await dbRun("UPDATE users SET car = NULL WHERE user_id = ?", [String(userId)]);
                return await message.reply("❌ Произошла ошибка: машина не найдена в базе автосалона. Она была удалена из вашего гаража.", replyParams());
            }

            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET car = NULL WHERE user_id = ?", [String(userId)]);

            return await message.reply(`🚗 Вы успешно слили свою машину ${carData.name} государству!\n💰 Вы получили: +${formatMoney(sellPrice)}$\n💳 Ваш баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }

        // --- НЕДВИЖИМОСТЬ ---
        if (cmdWord === 'дома' || cmdWord === 'гаражи') {
            const type = cmdWord === 'дома' ? 'house' : 'garage';
            const typeName = type === 'house' ? '🏠 ДОМА' : '🏘️ ГАРАЖИ';
            let txt = `${typeName}\n────────────────────\n`;

            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [data.name, type]);
                const count = countRow ? countRow.c : 0;
                
                txt += `📍 ${data.name} (${count}/20)\n`;
                if (count < 20) {
                    txt += `└ Свободных мест: ${20 - count}\n`;
                } else {
                    txt += `└ ❌ Мест нет (Все раскуплено)\n`;
                }
            }

            txt += `\n💡 Чтобы купить: /купить ${type === 'house' ? 'дом' : 'гараж'} топ [номер] [Локация]\nПример: /купить ${type === 'house' ? 'дом' : 'гараж'} топ 1 нижегородская`;
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const isHouse = parts[1] === 'дом';
            const type = isHouse ? 'house' : 'garage';
            const typeName = isHouse ? 'дом' : 'гараж';

            let rest = cleanText.replace('купить дом', '').replace('купить гараж', '').trim();
            
            const tierMatch = rest.match(/топ\s*(\d+)/i);
            if (!tierMatch) return await message.reply(`❌ Обязательно указывайте топ (от 1 до 20). Пример: /купить ${typeName} топ 1 нижегородская`);
            
            const tier = parseInt(tierMatch[1]);
            if (tier < 1 || tier > 20) return await message.reply("❌ Топ должен быть от 1 до 20.");

            const locQuery = rest.replace(tierMatch[0], '').trim();
            
            let locData = null;
            let locName = null;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                if (key.includes(locQuery) || data.name.toLowerCase().includes(locQuery)) {
                    locData = data;
                    locName = data.name;
                    break;
                }
            }

            if (!locData) return await message.reply(`❌ Укажите локацию. Пример: /купить ${typeName} топ ${tier} нижегородская`);

            const existing = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
            if (existing) return await message.reply(`❌ У вас уже есть ${isHouse ? 'дом' : 'гараж'}! Вы не можете купить второй.`);

            const isOccupied = await dbGet("SELECT id FROM properties WHERE location = ? AND type = ? AND tier = ?", [locName, type, tier]);
            if (isOccupied) return await message.reply(`❌ ${isHouse ? 'Дом' : 'Гараж'} Т${tier} в локации ${locName} уже занят другим игроком!`);

            const basePrice = isHouse ? locData.housePrice : locData.garagePrice;
            const price = basePrice * tier;

            if (balance < price) return await message.reply(`❌ Не хватает денег! ${isHouse ? 'Дом' : 'Гараж'} Т${tier} в ${locName} стоит ${formatMoney(price)}$, у вас ${formatMoney(balance)}$.`);

            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [type, locName, tier, String(userId)]);

            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${isHouse ? 'дом' : 'гараж'} в локации ${locName} (Тир Т${tier}) за ${formatMoney(price)}$!`, replyParams());
        }

        if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const isHouse = parts[1] === 'дом';
            const type = isHouse ? 'house' : 'garage';
            const typeName = isHouse ? 'дом' : 'гараж';

            if (!message.hasReplyMessage) return await message.reply(`❌ Чтобы продать ${typeName}, ответьте на сообщение покупателя. Формат: /продать ${typeName} [сумма]`);
            
            const amountStr = cleanText.replace('продать дом', '').replace('продать гараж', '').trim();
            const price = parseAmount(amountStr);
            const targetId = message.replyMessage.senderId;

            if (isNaN(price) || price < 1) return await message.reply("❌ Укажите корректную сумму для продажи.");
            if (targetId === userId) return await message.reply("❌ Нельзя продать недвижимость самому себе.");

            const myProp = await dbGet("SELECT id, location, tier FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
            if (!myProp) return await message.reply(`❌ У вас нет ${typeName}, чтобы его продать.`);

            const buyerProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(targetId), type]);
            if (buyerProp) return await message.reply(`❌ У покупателя уже есть ${typeName}, он не может купить второй.`);

            const dealId = Math.floor(Math.random() * 90000) + 10000;
            await dbRun("INSERT INTO prop_deals (id, seller_id, buyer_id, type, prop_id, price, peer_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [dealId, String(userId), String(targetId), type, myProp.id, price, String(peerId)]);

            const dealKb = Keyboard.builder().inline().callbackButton({
                label: `✅ Принять (${formatShortMoney(price)}$)`,
                payload: { cmd: 'prop_deal_accept', deal_id: String(dealId) },
                color: Keyboard.POSITIVE_COLOR
            }).toString();

            const buyerName = await getFullName(targetId);
            return await message.reply(`🤝 Заявка на покупку!\n\n👤 Продавец: ${await getFullName(userId)}\n📦 Товар: ${typeName} в ${myProp.location} (Т${myProp.tier})\n💰 Цена: ${formatMoney(price)}$\n\n👉 ${buyerName}, нажмите кнопку ниже, чтобы купить.`, replyParams(dealKb));
        }

        // --- ДОН ДОМ / ДОН ГАРАЖ ---
        if (cmdWord === 'дон' || cmdWord === 'дондом' || cmdWord === 'донгараж') {
            let isHouse = false;
            if (cmdWord === 'дондом' || (cmdWord === 'дон' && parts[1] === 'дом')) isHouse = true;
            else if (cmdWord === 'донгараж' || (cmdWord === 'дон' && parts[1] === 'гараж')) isHouse = false;
            else return;
            
            const type = isHouse ? 'house' : 'garage';
            const typeName = isHouse ? '🏠 ДОНЫ ДОМОВ' : '🏘️ ДОНЫ ГАРАЖЕЙ';

            const rows = await dbAll("SELECT p.owner_id, p.location, p.tier, u.balance FROM properties p JOIN users u ON p.owner_id = u.user_id WHERE p.type = ? AND p.tier <= 10 ORDER BY p.tier DESC, u.balance DESC LIMIT 10", [type]);
            if (rows.length === 0) return await message.reply(`❌ Пока никто не купил ${isHouse ? 'дома' : 'гаражи'} с Т1 по Т10.`);
            
            let txt = `${typeName} (Т1 - Т10)\n────────────────────\n`;
            const userIds = [...new Set(rows.map(r => r.owner_id))];
            let usersInfo = [];
            try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch(e) {}
            
            for (const r of rows) {
                const uInfo = usersInfo.find(u => u.id == r.owner_id);
                const name = uInfo && !uInfo.deactivated ? `[id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}]` : `[id${r.owner_id}|Игрок]`;
                txt += `Т${r.tier} | ${r.location} — ${name}\n`;
            }
            return await message.reply(txt, replyParams());
        }

        // --- КАЗИНО ---
        if (cmdWord === 'казино') {
            return await message.reply("🎰 Игры:", replyParams(getCasinoKb()));
        }

        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(peerId)]);
            let topText = "⭐ ТОП 10 ПОЛЬЗОВАТЕЛЕЙ ПО СООБЩЕНИЯМ\n\n";
            
            if (rows.length > 0) {
                const userIds = rows.map(r => r.user_id);
                let usersInfo = [];
                try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}
                let count = 0;
                const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
                for (const r of rows) {
                    const uInfo = usersInfo.find(u => u.id == r.user_id);
                    if (uInfo && !uInfo.deactivated) {
                        topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] - ${r.count} сообщений\n`;
                        count++;
                    }
                }
            } else {
                topText += "В этой беседе еще никто не писал.";
            }

            return await message.reply(topText, replyParams(getTopKb(userId, 'coins', 'chat')));
        }

        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Доступные бизнесы для покупки:\n\n";
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                bizText += `${data.name} — ${formatMoney(data.price)}$ (Доход: ~${formatMoney(data.baseIncome)}$/3мин)\n`;
            }
            bizText += "\nЧтобы купить, напишите /купитьбиз [Название]\nПример: /купитьбиз Шаурма";
            return await message.reply(bizText, replyParams());
        }

        if (cmdWord === 'купитьбиз') {
            const args = message.text.split(' ');
            args.shift();
            const bizQuery = args.join(' ').toLowerCase().trim();
            
            if (!bizQuery) return await message.reply("❌ Укажите, какой бизнес хотите купить. Пример: /купитьбиз Шаурма");

            const existing = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            if (existing) return await message.reply("❌ У вас уже есть бизнес. Сначала закройте текущий (/закрыть бизнес).");

            let selectedBiz = null;
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) {
                    selectedBiz = data;
                    break;
                }
            }

            if (!selectedBiz) return await message.reply("❌ Такого бизнеса нет. Посмотрите список: /бизнес");
            if (balance < selectedBiz.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedBiz.price)}$`);

            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
            
            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${selectedBiz.name} за ${formatMoney(selectedBiz.price)}$.\nУдачи в заработке! Пишите /мойбизнес для управления.`, replyParams());
        }

        if (cmdWord === 'мойбизнес') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ У вас нет бизнеса. Купите его: /бизнес");

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const timePassed = Date.now() - biz.last_income;
            const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

            const msgText = `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе бизнеса: ${formatMoney(totalBalance)}$\n\nПовышение уровня стоит: ${formatMoney(nextLevelCost)}$\n\n👉 Чтобы вывести деньги, напишите в чат /вывести`;

            return await message.reply(msgText, replyParams(getBizKb(userId)));
        }

        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ У вас нет бизнеса.");

            const now = Date.now();
            const lastWithdraw = Number(biz.last_withdraw) || 0;
            const cd = 2 * 60 * 60 * 1000; 

            if (now - lastWithdraw < cd) {
                const remaining = cd - (now - lastWithdraw);
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                return await message.reply(`⏳ Выводить деньги с бизнеса можно раз в 2 часа.\nПодождите еще: ${h} ч. ${m} мин.`, replyParams());
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const timePassed = now - biz.last_income;
            const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;

            if (totalBalance <= 0) {
                return await message.reply("❌ У вас нет денег на балансе бизнеса.", replyParams());
            }

            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);

            return await message.reply(`💸 Вы успешно вывели ${formatMoney(totalBalance)}$ с бизнеса на свой баланс!\nСледующий вывод будет доступен через 2 часа.`, replyParams());
        }

        if (cmdWord === 'закрыть' && (parts[1] === 'бизнес' || parts[1] === 'бизнес' || cmdWord === 'закрытьбизнес')) {
            const biz = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ У вас нет бизнеса для закрытия.");
            
            await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
            await updateBalance(userId, 10000000);
            return await message.reply("💀 Вы успешно закрыли свой бизнес и получили компенсацию в размере 10,000,000$ на баланс.", replyParams());
        }

        if (cmdWord === 'rep' || cmdWord === 'реп') {
            return await message.reply("🔔 Для изменения репутации используйте /rep + или /rep -, указав пользователя. Пример: /rep + @Mokhma.volk\n(Доступно 3 изменения в сутки)", replyParams());
        }

        if (cmdWord === 'rep' && (parts[1] === '+' || parts[1] === '-')) {
            const isPlus = parts[1] === '+';
            let targetId = null;
            
            if (message.hasReplyMessage) {
                targetId = message.replyMessage.senderId;
            } else {
                const targetStr = text.replace('/rep +', '').replace('/rep -', '').replace('rep +', '').replace('rep -', '').trim();
                const mentionMatch = targetStr.match(/@([a-zA-Z0-9._]+)/) || targetStr.match(/\[id(\d+)\|/);
                if (mentionMatch) {
                    if(mentionMatch[1].match(/^\d+$/)) targetId = parseInt(mentionMatch[1]);
                    else {
                        try {
                            const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                            if (res.type === 'user') targetId = res.object_id;
                        } catch (e) {}
                    }
                }
            }

            if (!targetId) return await message.reply("⚠️ Укажите пользователя через @упоминание или ответом на сообщение.", replyParams());
            if (targetId === userId) return await message.reply("❌ Вы не можете изменить репутацию самому себе!", replyParams());

            const now = Date.now();
            const repRow = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id = ?", [String(userId)]);
            let repCount = 0;
            let repReset = 0;

            if (repRow) {
                repCount = Number(repRow.count);
                repReset = Number(repRow.last_reset);
            }

            if (now - repReset >= 86400000) {
                repCount = 0;
                repReset = now;
            }

            if (repCount >= 3) {
                const remainingMs = 86400000 - (now - repReset);
                const hours = Math.floor(remainingMs / 3600000);
                const minutes = Math.floor((remainingMs % 3600000) / 60000);
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                return await message.reply(`⏳ Вы исчерпали лимит на изменение репутации (3 раза в сутки).\nПопробуйте снова через ${hours} ч. ${minutes} мин. ${seconds} сек.`, replyParams());
            }

            repCount++;
            await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), repCount, repReset]);

            if (isPlus) {
                await updateReputation(targetId, 1);
                return await message.reply(`🟢 ${await getFullName(userId)} повысил репутацию пользователя ${await getFullName(targetId)} (Теперь у него ${await getReputation(targetId)}).\n📅 Осталось изменений: ${3 - repCount}/3`, replyParams());
            } else {
                await updateReputation(targetId, -1);
                return await message.reply(`🔴 ${await getFullName(userId)} понизил репутацию пользователя ${await getFullName(targetId)} (Теперь у него ${await getReputation(targetId)}).\n📅 Осталось изменений: ${3 - repCount}/3`, replyParams());
            }
        }

        if (cmdWord === 'работа') {
            return await message.reply("💼 Выберите работу:", replyParams(getWorkKb()));
        }

        // --- 10-СЕКУНДНЫЙ КУЛДАУН ДЛЯ ВСЕХ ИГР ---
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            if (Date.now() - lastPlayed < 10000) {
                const left = Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000);
                return await message.reply(`⏳ Подождите ${left} сек. перед началом новой игры.`, replyParams());
            }
            gameCooldowns.set(userId, Date.now());
        }

        // --- ИГРЫ КАЗИНО ---
        if (cmdWord === 'краш') {
            if (parts.length >= 3) {
                const autoStop = parseFloat(parts[1]);
                let betStr = parts[2];
                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                
                if (isNaN(autoStop) || autoStop < 1.01) return await message.reply("❌ Автостоп должен быть больше 1.00", replyParams());
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                
                const rand = Math.random();
                let crashPoint = 1.00;
                if (rand > 0.03) {
                    crashPoint = Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100;
                }
                
                if (crashPoint >= autoStop) {
                    const win = Math.floor(bet * autoStop);
                    await updateBalance(userId, win);
                    return await message.reply(`📈 Краш на отметке: x${crashPoint.toFixed(2)}\n\n✅ Вы выиграли ${formatMoney(win)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`📈 Краш на отметке: x${crashPoint.toFixed(2)}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ краш [автостоп] [ставка]\n\nПример: краш 3 5кк", replyParams());
        }

        if (cmdWord === 'монетка') {
            if (parts.length >= 3) {
                let side = "";
                let betStr = "";
                if (['орел', 'решка'].includes(parts[1])) { side = parts[1]; betStr = parts[2]; }
                else if (['орел', 'решка'].includes(parts[2])) { side = parts[2]; betStr = parts[1]; }
                else return await message.reply("❌ Выберите 'орел' или 'решка'", replyParams());

                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.random() < 0.5 ? 'орел' : 'решка';
                if (res === side) {
                    await updateBalance(userId, bet * 2);
                    return await message.reply(`🪙 Выпал: ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 2)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🪙 Выпал: ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ монетка [орел/решка] [ставка] или монетка [ставка] [орел/решка]\n\nПример: монетка орел 100к", replyParams());
        }

        if (cmdWord === 'стакан') {
            if (parts.length >= 3) {
                let cup = 0;
                let betStr = "";
                const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
                if (p1 >= 1 && p1 <= 3) { cup = p1; betStr = parts[2]; }
                else if (p2 >= 1 && p2 <= 3) { cup = p2; betStr = parts[1]; }
                else return await message.reply("❌ Выберите стакан от 1 до 3", replyParams());
                
                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.floor(Math.random() * 3) + 1;
                if (res === cup) {
                    await updateBalance(userId, bet * 3);
                    return await message.reply(`🥤 Шарик был под стаканом ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 3)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🥤 Шарик был под стаканом ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ стакан [1-3] [ставка] или стакан [ставка] [1-3]\n\nПример: стакан 2 100к", replyParams());
        }

        if (cmdWord === 'кубик') {
            if (parts.length >= 3) {
                let guess = 0;
                let betStr = "";
                const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
                if (p1 >= 1 && p1 <= 6) { guess = p1; betStr = parts[2]; }
                else if (p2 >= 1 && p2 <= 6) { guess = p2; betStr = parts[1]; }
                else return await message.reply("❌ Выберите число от 1 до 6", replyParams());
                
                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.floor(Math.random() * 6) + 1;
                if (res === guess) {
                    await updateBalance(userId, bet * 6);
                    return await message.reply(`🎲 Выпало: ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 6)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🎲 Выпало: ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ кубик [1-6] [ставка] или кубик [ставка] [1-6]\n\nПример: кубик 4 100к", replyParams());
        }

        if (cmdWord === 'автомат') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
                const r1 = emojis[Math.floor(Math.random() * emojis.length)];
                const r2 = emojis[Math.floor(Math.random() * emojis.length)];
                const r3 = emojis[Math.floor(Math.random() * emojis.length)];
                
                let win = 0;
                if (r1 === r2 && r2 === r3) win = bet * 10;
                else if (r1 === r2 || r2 === r3 || r1 === r3) win = bet * 2;
                
                if (win > 0) {
                    await updateBalance(userId, win);
                    return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n\n✅ Вы выиграли ${formatMoney(win)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ автомат [ставка]\n\nПример: автомат 5кк", replyParams());
        }

        if (cmdWord === 'блэкджек') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const playerScore = Math.floor(Math.random() * 10) + 12; 
                const dealerScore = Math.floor(Math.random() * 10) + 12; 
                
                let msgText = `🃏 Блэкджек\n\n👤 Твои очки: ${playerScore}\n🤵 Очки дилера: ${dealerScore}\n\n`;
                
                if (playerScore > 21) {
                    msgText += `❌ Перебор! Вы проиграли ${formatMoney(bet)}$`;
                } else if (dealerScore > 21) {
                    await updateBalance(userId, bet * 2);
                    msgText += `✅ У дилера перебор! Вы выиграли ${formatMoney(bet * 2)}$`;
                } else if (playerScore > dealerScore) {
                    await updateBalance(userId, bet * 2);
                    msgText += `✅ Вы выиграли ${formatMoney(bet * 2)}$!`;
                } else if (playerScore === dealerScore) {
                    await updateBalance(userId, bet);
                    msgText += `🤝 Ничья! Ставка возвращена.`;
                } else {
                    msgText += `❌ Дилер выиграл! Вы проиграли ${formatMoney(bet)}$`;
                }
                
                msgText += `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;
                return await message.reply(msgText, replyParams());
            }
            return await message.reply("❌ блэкджек [ставка]\n\nПример: блэкджек 100к", replyParams());
        }

        if (cmdWord === 'дрим') {
            if (parts.length >= 3) {
                let guess = 0;
                let betStr = "";
                const validDream = [1, 2, 3, 4, 5];
                const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
                if (validDream.includes(p1)) { guess = p1; betStr = parts[2]; }
                else if (validDream.includes(p2)) { guess = p2; betStr = parts[1]; }
                else return await message.reply("❌ Доступные числа: 1, 2, 3, 4, 5", replyParams());

                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.floor(Math.random() * 10) + 1;
                
                const validMultipliers = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5};
                
                if (res === guess) {
                    const win = bet * validMultipliers[guess];
                    await updateBalance(userId, win);
                    return await message.reply(`💎 Выпало число: ${res}\n\n✅ Вы выиграли ${formatMoney(win)}$ (x${validMultipliers[guess]})!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`💎 Выпало число: ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ дрим [1/2/3/4/5] [ставка]\n\nПример: дрим 5 100к", replyParams());
        }

        // --- РУЛЕТКА С ДИНАМИЧЕСКИМ ФОТО ---
        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length >= 3) {
                let choice = "";
                let betStr = "";
                if (parseAmount(parts[1]) > 0 || parseAmount(parts[1]) === 'ALL') { betStr = parts[1]; choice = parts[2]; }
                else { betStr = parts[parts.length - 1]; choice = parts[1]; }

                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());

                const res = Math.floor(Math.random() * 37);
                const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                
                let cName = redNumbers.includes(res) ? "Красное" : (res === 0 ? "Зеро" : "Черное");
                let cEmoji = redNumbers.includes(res) ? "🔴" : (res === 0 ? "🟢" : "⚫");
                let eName = res === 0 ? "Ноль" : (res % 2 === 0 ? "Четное" : "Нечетное");

                let win = (parseInt(choice) === res) || 
                          (["красное", "красный", "кр"].includes(choice) && redNumbers.includes(res)) ||
                          (["черное", "черный", "чр"].includes(choice) && !redNumbers.includes(res) && res !== 0) ||
                          (["чет", "четное"].includes(choice) && res % 2 === 0 && res !== 0) ||
                          (["нечет", "нечетное"].includes(choice) && res % 2 !== 0);

                // Получаем динамическое фото
                const attachment = await getRouletteAttachment();
                
                const msgText = `🎰 Выпало: ${res} ${cEmoji} (${cName}, ${eName})\n\n` +
                                (win ? `✅ Выигрыш: +${bet}$` : `😔 Проигрыш: -${bet}$`) +
                                `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;

                if (win) {
                    await updateBalance(userId, bet);
                } else {
                    await updateBalance(userId, -bet);
                }

                return await message.reply({
                    message: msgText,
                    attachment: attachment || undefined, 
                    keyboard: isLs ? mainKb.toString() : undefined,
                    disable_mentions: 1
                });
            } else {
                return await message.reply("❌ Формат: рулетка [красное/черное/чет/нечет] [ставка]", replyParams());
            }
        }

        if (cmdWord === 'фортуна') {
            const currentTime = Math.floor(Date.now() / 1000);
            const row = await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]);
            const lastUse = row ? row.last_used : 0;

            if (currentTime - lastUse < FORTUNA_CD) {
                const remaining = FORTUNA_CD - (currentTime - lastUse);
                return await message.reply(`⏳ Фортуна доступна через ${Math.floor(remaining / 60)} мин. ${remaining % 60} сек.`, replyParams());
            }
            if (balance < 100) return await message.reply("❌ Фортуна стоит 100$.", replyParams());

            await updateBalance(userId, -100);
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);

            const prize = [0, 50, 100, 200, 500, 1000, 5000][Math.floor(Math.random() * 7)];
            await updateBalance(userId, prize);
            
            return await message.reply(`🎰 Выпало: ${formatMoney(prize)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams(isLs ? mainKb : undefined));
        }

        if (cmdWord === 'мины') {
            let bet = 100;
            if (parts.length >= 2) {
                let parsed = parseAmount(parts[1]);
                if (parsed === 'ALL') bet = balance;
                else if (parsed > 0) bet = parsed;
            }

            if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
            if (bet > 5000000000) return await message.reply("❌ Максимальная ставка в минах — 5ккк (5,000,000,000)$", replyParams());
            if (bet > balance) return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());

            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);

            return await message.reply(`💣 Мины\nСтавка: ${bet}$\n\nВыберите количество мин (2-8):`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (parts.length >= 2 && message.hasReplyMessage) {
                const amount = parseAmount(parts[1]);
                const targetId = message.replyMessage.senderId;

                if (!amount || amount === 'ALL') return await message.reply("❌ Укажите корректную сумму.", replyParams());
                if (targetId === userId) return await message.reply("❌ Нельзя перевести деньги самому себе.", replyParams());
                if (targetId < 0) return await message.reply("❌ Нельзя переводить сообществам.", replyParams());
                if (amount < 50 || amount > 5000000000000) return await message.reply("❌ Сумма перевода должна быть от 50 до 5кккк (5,000,000,000,000)$", replyParams());
                if (balance < amount) return await message.reply("❌ У тебя недостаточно средств.", replyParams());

                await updateBalance(userId, -amount);
                await updateBalance(targetId, amount);

                const targetName = await getFullName(targetId);
                return await message.reply(`💸 Ты успешно перевел ${formatMoney(amount)}$ игроку ${targetName}.\n💰 Твой баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
            } else {
                return await message.reply("❌ Формат: transfer [сумма] (ответом на сообщение)", replyParams());
            }
        }

        if (cmdWord === 'duel') {
            if (parts.length === 2) {
                const bet = parseAmount(parts[1]);
                if (!bet || bet === 'ALL') return await message.reply("❌ Укажите корректную сумму.", replyParams());
                if (bet < 50 || bet > 2000) return await message.reply("❌ Ставка от 50 до 2000.", replyParams());
                if (balance < bet) return await message.reply("❌ Не хватает монет.", replyParams());

                const duelId = String(Math.floor(Math.random() * 90000) + 10000);
                await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);

                return await message.reply(`⚔️ Дуэль!\n👤 Создатель: ${await getFullName(userId)}\n💰 Ставка: ${bet}$\n\n⚡ Нажми кнопку ниже!`, replyParams(getDuelKb(duelId)));
            } else {
                return await message.reply("❌ Формат: duel [сумма]", replyParams());
            }
        }

        // --- БОНУС (ОБНОВЛЕННЫЙ ДНЕВНОЙ) ---
        if (cmdWord === 'бонус') {
            const today = new Date().toLocaleDateString('ru-RU');
            const userBonus = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id = ?", [String(userId)]);
            
            let streak = userBonus?.bonus_streak || 0;
            let lastDate = userBonus?.last_bonus_date;

            if (lastDate === today) {
                return await message.reply(`⏳ Вы уже забирали ежедневный бонус сегодня!\n🔥 Ваш стрик: ${streak} дн.\nПриходите завтра!`, replyParams());
            }

            if (lastDate) {
                const lastD = new Date(lastDate.split('.').reverse().join('-'));
                const todayD = new Date(today.split('.').reverse().join('-'));
                const diffTime = Math.abs(todayD - lastD);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays === 1) {
                    streak++;
                } else {
                    streak = 1;
                }
            } else {
                streak = 1;
            }

            let bonusAmount = 100000;
            if (streak === 2) bonusAmount = 200000;
            if (streak === 3) bonusAmount = 300000;
            if (streak === 4) bonusAmount = 400000;
            if (streak === 5) bonusAmount = 500000;
            if (streak === 6) bonusAmount = 700000;
            if (streak >= 7) bonusAmount = 1000000;

            await updateBalance(userId, bonusAmount);
            await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [today, streak, String(userId)]);
            
            return await message.reply(`🎁 ЕЖЕДНЕВНЫЙ БОНУС\n────────────────────\n🔥 Ваш стрик: ${streak} дн. подряд!\n💰 Награда: +${formatMoney(bonusAmount)}$\n\n💳 Ваш баланс: ${formatMoney(await getBalance(userId))}$`, replyParams(isLs ? mainKb : undefined));
        }

        // ===== АДМИНСКИЕ КОМАНДЫ =====
        if (userId === ADMIN_ID) {
            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).", replyParams());
                const bal = await getBalance(targetId);
                const name = await getFullName(targetId);
                return await message.reply(`💳 У игрока ${name} на балансе: ${formatShortMoney(bal)}$`, replyParams());
            }

            if (cmdWord === 'заморозить') {
                const { targetId } = await getTargetAndReason(message, 'заморозить');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете заморозить себя.", replyParams());
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]);
                try { await vk.api.messages.send({ peer_id: targetId, message: "💀 Вы заморожены в боте. Ожидайте, когда вам выдадут наказание!", random_id: Math.floor(Math.random() * 1000000000) }); } catch(e) {}
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} заморожен.`, replyParams());
            }

            if (cmdWord === 'разморозить' || cleanText.startsWith('снять заморозку') || cleanText.startsWith('снять заморозка') || cmdWord === 'unfreeze') {
                let cmdName = 'разморозить';
                if (cleanText.startsWith('снять заморозку')) cmdName = 'снять заморозку';
                if (cleanText.startsWith('снять заморозка')) cmdName = 'снять заморозка';
                if (cmdWord === 'unfreeze') cmdName = 'unfreeze';

                const { targetId } = await getTargetAndReason(message, cmdName);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.", replyParams());
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} разморожен.`, replyParams());
            }

            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы снять мут, используйте /unmute @VK (или ответом на сообщение)", replyParams());
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unmute' ? 'unmute' : 'размут');

                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());

                const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (!activeMute || Date.now() >= activeMute.mute_until) {
                    if (activeMute) {
                        await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    }
                    return await message.reply("❌ У этого игрока нет активного мута в данной беседе.", replyParams());
                }

                await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);

                if (message.isChat) {
                    try {
                        await vk.api.messages.changeConversationMemberRestrictions({
                            group_id: GROUP_ID,
                            peer_id: peerId,
                            member_id: targetId,
                            action: 'none', 
                            for: 0
                        });
                    } catch(e) {
                        console.error("Ошибка при снятии мута ВК:", e.message);
                    }
                }

                const targetName = await getFullName(targetId);
                return await message.reply(`✅ С игрока ${targetName} успешно снят мут!`, replyParams());
            }

            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы разбанить пользователя, используйте /unban @VK (или ответом на сообщение)", replyParams());
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unban' ? 'unban' : 'разбан');

                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());

                let removed = false;
                
                const existingGlobal = await dbGet("SELECT user_id FROM blacklist WHERE user_id = ?", [String(targetId)]);
                if (existingGlobal) {
                    await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                    removed = true;
                }

                if (message.isChat) {
                    const existingChat = await dbGet("SELECT user_id FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    if (existingChat) {
                        await dbRun("DELETE FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                        removed = true;
                    }
                }

                if (!removed) return await message.reply("❌ Этот игрок не находится в бан-листе (ни в ЧС, ни в бане беседы).", replyParams());

                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                return await message.reply(`✅ ${senderName} разбанил(-а) пользователя ${targetName}.`, replyParams());
            }

            if (cmdWord === 'kl') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы полностью сбросить игрока, используйте /kl @VK (или ответом на сообщение)", replyParams());
                }

                const { targetId } = await getTargetAndReason(message, 'kl');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете сбросить себя.", replyParams());

                await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, car = NULL, last_bonus_date = NULL, bonus_streak = 0 WHERE user_id = ?", [String(targetId)]);
                
                const targetName = await getFullName(targetId);
                return await message.reply(`💥 Игрок ${targetName} был полностью сброшен! Дома, гаражи, машины, бонусы и уровни обнулены. Недвижимость освобождена для других.`, replyParams());
            }

            if (cmdWord === 'mute') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Формат: /mute @VK [время в мин] [причина]", replyParams());
                }

                let targetId = null;
                let args = message.text.split(' ').slice(1); 
                
                if (message.hasReplyMessage) {
                    targetId = message.replyMessage.senderId;
                } else {
                    const { targetId: tId } = await getTargetAndReason(message, 'mute');
                    targetId = tId;
                    args.shift(); 
                }

                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете замутить себя.", replyParams());

                let muteMinutes = 10;
                let reason = "Причина не указана";

                if (args.length > 0) {
                    const parsedTime = parseInt(args[0]);
                    if (!isNaN(parsedTime) && parsedTime > 0) {
                        muteMinutes = parsedTime;
                        if (args.length > 1) reason = args.slice(1).join(' ');
                    } else {
                        reason = args.join(' ');
                    }
                }

                const existingMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingMute && Date.now() < existingMute.mute_until) {
                    return await message.reply("❌ У этого игрока уже имеется активная блокировка в данной беседе!", replyParams());
                }

                const muteUntil = Date.now() + (muteMinutes * 60 * 1000);
                await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(targetId), String(peerId), muteUntil, reason]);

                if (message.isChat) {
                    try {
                        await vk.api.messages.changeConversationMemberRestrictions({
                            group_id: GROUP_ID,
                            peer_id: peerId,
                            member_id: targetId,
                            action: 'ro',
                            for: muteMinutes * 60
                        });
                    } catch(e) {}
                }

                const targetName = await getFullName(targetId);
                return await message.reply(`🚫 ${targetName} получил мут на ${muteMinutes} минут.\n📌 Причина: ${reason}`, replyParams());
            }

            if (cmdWord === 'бан' || cmdWord === 'ban') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы забанить пользователя в беседе, используйте /ban @VK Причина", replyParams());
                }
                if (!message.isChat) return await message.reply("❌ Эту команду можно использовать только в беседе.", replyParams());

                const { targetId, reason } = await getTargetAndReason(message, cmdWord === 'бан' ? 'бан' : 'ban');

                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете забанить себя.", replyParams());
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) return await message.reply("❌ Этот игрок уже забанен в данной беседе!", replyParams());

                await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(targetId), String(peerId), reason]);
                
                try {
                    await vk.api.messages.removeChatUser({
                        chat_id: peerId - 2000000000,
                        user_id: targetId,
                        group_id: GROUP_ID
                    });
                } catch(e) {}

                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} забанил(-а) в этой беседе пользователя ${targetName} по причине: "${reason}"`, replyParams());
            }

            if (cmdWord === 'настройки') {
                const enabled = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value;
                const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
                const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
                const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;

                let statusText = enabled === '1' ? "🟢 Включен" : "🔴 Выключен";

                return await message.reply(`⚙️ Настройки антиспама:\n\nСтатус: ${statusText}\n\nНажмите на кнопку, чтобы изменить параметр.`, {
                    keyboard: await getSettingsKb(enabled, limit, time, mute)
                });
            }

            if (cmdWord === 'убрать') {
                const targetQuery = cleanText.replace('убрать', '').trim().toLowerCase();
                
                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0");
                    return await message.reply(`💥 Все статы ВСЕХ игроков (монеты, дуэли, бонусы и т.д.) успешно обнулены! (Машины и бизнесы остались)`, replyParams());
                } else {
                    const { targetId } = await getTargetAndReason(message, 'убрать');
                    if (!targetId) return await message.reply("⚠️ Ответьте на сообщение игрока, укажите его @упоминание или напишите 'all', чтобы обнулить статы.", replyParams());

                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 Все статы игрока ${targetName} (монеты, дуэли, бонусы и т.д.) успешно обнулены! (Машины и бизнесы остались)`, replyParams());
                }
            }

            if (cmdWord === 'kick') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы исключить пользователя из чата, используйте /kick @VK Причина (Пример: /kick @andrey_mala Тест)", replyParams());
                }

                const { targetId, reason } = await getTargetAndReason(message, 'kick');

                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете исключить самого себя.", replyParams());
                if (!message.isChat) return await message.reply("❌ Эту команду можно использовать только в беседе.", replyParams());
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) return await message.reply("❌ Этот игрок уже забанен в данной беседе.", replyParams());

                const chatId = message.peerId - 2000000000;
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                try {
                    await vk.api.messages.removeChatUser({ chat_id: chatId, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply(`${senderName} исключил(-а) из беседы пользователя ${targetName} по причине: "${reason}"`, replyParams());
                } catch (e) {
                    return await message.reply(`⚠️ Указанный пользователь не является участником данной беседы, либо же имеет статус выше Вашего.`, replyParams());
                }
            }

            if (cmdWord === 'чсб') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы занести в глобальный ЧС, используйте /чсб @VK [дней] Причина (Пример: /чсб @andrey_mala 3 Спам)", replyParams());
                }

                const { targetId, reason } = await getTargetAndReason(message, 'чсб');

                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете занести себя в ЧС.", replyParams());

                const existingBan = await dbGet("SELECT reason FROM blacklist WHERE user_id = ?", [String(targetId)]);
                if (existingBan) return await message.reply("❌ Этот игрок уже находится в глобальном ЧС!", replyParams());
                
                let days = 0;
                let finalReason = reason;
                const partsReason = reason.split(' ');
                if (partsReason.length > 1 && !isNaN(parseInt(partsReason[0]))) {
                    days = parseInt(partsReason[0]);
                    finalReason = partsReason.slice(1).join(' ');
                }
                if (!finalReason) finalReason = "Причина не указана";

                let until = days > 0 ? Date.now() + days * 86400000 : 0;
                
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), finalReason, until]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} занес(-ла) в глобальный ЧС бота пользователя ${targetName} ${days > 0 ? `на ${days} дн.` : 'навсегда'} по причине: "${finalReason}"`, replyParams());
            }

            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());

                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} разбанил(-а) пользователя ${targetName} в глобальном ЧС бота.`, replyParams());
            }

            if (cmdWord === 'выдать') {
                const args = message.text.split(' ');
                args.shift(); 

                let amount = 0;
                let remainingArgs = [];
                
                for (const arg of args) {
                    const parsed = parseAmount(arg);
                    if (parsed > 0 && parsed !== 'ALL') {
                        amount = parsed;
                    } else {
                        remainingArgs.push(arg);
                    }
                }

                if (amount <= 0) return await message.reply("❌ Укажите корректную сумму для выдачи.", replyParams());

                const targetQuery = remainingArgs.join(' ').trim().toLowerCase();

                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Владелец выдал всем игрокам по ${formatMoney(amount)}$!`, replyParams());
                } else {
                    let targetId = null;
                    if (message.hasReplyMessage) {
                        targetId = message.replyMessage.senderId;
                    } else if (targetQuery) {
                        const mentionMatch = targetQuery.match(/@([a-zA-Z0-9._]+)/i) || targetQuery.match(/\[id(\d+)\|/);
                        const urlMatch = targetQuery.match(/(?:https?:\/\/)?(?:vk\.com|vk\.ru)\/([a-zA-Z0-9._]+)/i);
                        
                        if (mentionMatch) {
                            if (mentionMatch[1].match(/^\d+$/)) targetId = parseInt(mentionMatch[1]);
                            else {
                                try {
                                    const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                                    if (res.type === 'user') targetId = res.object_id;
                                } catch (e) {}
                            }
                        } else if (urlMatch) {
                            try {
                                const res = await vk.api.utils.resolveScreenName({ screen_name: urlMatch[1] });
                                if (res.type === 'user') targetId = res.object_id;
                            } catch (e) {}
                        }
                    }

                    if (!targetId) return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой) или напишите 'all'.", replyParams());
                    
                    await updateBalance(targetId, amount);
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💰 Владелец выдал ${formatMoney(amount)}$ игроку ${targetName}!`, replyParams());
                }
            }

            if (cmdWord === 'обнулить') {
                const args = message.text.split(' ');
                args.shift(); 
                const targetQuery = args.join(' ').trim().toLowerCase();

                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0");
                    await dbRun("UPDATE businesses SET balance = 0");
                    return await message.reply("💥 Балансы ВСЕХ игроков и их бизнесов успешно обнулены!", replyParams());
                } else {
                    const { targetId } = await getTargetAndReason(message, 'обнулить');
                    if (!targetId) return await message.reply("⚠️ Укажите 'all', ссылку на пользователя или ответьте на его сообщение.", replyParams());
                    
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 Баланс игрока ${targetName} и его бизнеса успешно обнулен!`, replyParams());
                }
            }

            if (cmdWord === 'cp') {
                await dbRun("DELETE FROM promos");
                return await message.reply("✅ Все активные промокоды были успешно удалены.", replyParams());
            }

            if (cmdWord === 'создать') {
                if (parts.length === 4) {
                    const amt = parseAmount(parts[2]);
                    const lim = parseAmount(parts[3]);
                    if (amt > 0 && lim > 0) {
                        await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], amt, lim]);
                        return await message.reply(`✅ Промокод \`${parts[1]}\` создан!`, replyParams());
                    }
                }
                return await message.reply("❌ Формат: /создать [код] [сумма] [лимит]", replyParams());
            }
        }

        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (rows.length === 0) return await message.reply("❌ Активных промокодов нет.", replyParams());
            
            let promoList = "🎁 Активные промокоды:\n\n";
            for (const r of rows) {
                const usedCount = r.used_by ? r.used_by.split(",").length : 0;
                promoList += `▪️ \`${r.code}\` — ${formatMoney(r.amount)}$ (${usedCount}/${r.limit_count})\n`;
            }
            return await message.reply(promoList, replyParams());
        }

        if (cmdWord === 'promo') {
            if (parts.length === 2) {
                try {
                    const isMember = await vk.api.groups.isMember({ group_id: GROUP_ID, user_id: userId });
                    if (isMember !== 1) {
                        const subKb = Keyboard.builder().inline().urlButton({ label: '📢 Подписаться', url: `https://vk.com/public${GROUP_ID}` });
                        return await message.reply("⚠️ Промокоды доступны только подписчикам нашего сообщества!\n\nПодпишитесь на группу и попробуйте снова.", replyParams(subKb.toString()));
                    }
                } catch (e) {}

                const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
                
                if (!row) return await message.reply("❌ Промокод не существует или исчерпан.", replyParams());
                
                const usedBy = row.used_by ? row.used_by.split(",") : [];
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply("❌ Промокод больше не действителен.", replyParams());
                }
                
                if (usedBy.includes(String(userId))) return await message.reply("❌ Ты уже активировал этот промокод!", replyParams());
                
                usedBy.push(String(userId));
                await updateBalance(userId, row.amount);
                
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply(`✅ Активирован! +${row.amount}$\n⚠️ Промокод удален (лимит исчерпан).`, replyParams());
                } else {
                    await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [usedBy.join(","), parts[1]]);
                    return await message.reply(`✅ Активирован! +${row.amount}$\nОсталось: ${row.limit_count - usedBy.length}`, replyParams());
                }
            } else {
                return await message.reply("❌ Формат: /promo [код]", replyParams());
            }
        }

        return;

    } catch (error) {
        console.error("ОШИБКА ПРИ ОБРАБОТКЕ:", error);
        try { await message.reply(`⚠️ Произошла ошибка при выполнении команды: ${error.message}`, { disable_mentions: 1 }); } catch (e) {}
    }
});

// ===== ОБРАБОТКА КНОПОК =====
vk.updates.on('message_event', async (context) => {
    let answered = false;
    
    const safeAnswer = async (params) => {
        if (!answered) {
            answered = true;
            await context.answer(params).catch(() => {});
        }
    };

    try {
        const payload = context.eventPayload;
        const userId = context.userId;

        // Обработка кнопки "Принять" для недвижимости
        if (payload.cmd === 'prop_deal_accept') {
            const dealId = payload.deal_id;
            const deal = await dbGet("SELECT * FROM prop_deals WHERE id = ?", [dealId]);
            
            if (!deal) return await safeAnswer({ type: 'show_snackbar', text: '❌ Сделка отменена или устарела.' });
            if (String(userId) !== deal.buyer_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы не являетесь покупателем в этой сделке.'});
            
            const buyerBal = await getBalance(userId);
            if (buyerBal < deal.price) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас недостаточно средств.'});
            
            const buyerProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(userId), deal.type]);
            if (buyerProp) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас уже есть эта недвижимость!'});

            await updateBalance(userId, -deal.price);
            await updateBalance(deal.seller_id, deal.price);
            await dbRun("UPDATE properties SET owner_id = ? WHERE id = ?", [String(userId), deal.prop_id]);
            await dbRun("DELETE FROM prop_deals WHERE id = ?", [dealId]);

            await safeAnswer({ type: 'show_snackbar', text: '✅ Успешно куплено!' });
            
            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: `🤝 Сделка состоялась!\nИгрок ${await getFullName(userId)} купил ${deal.type === 'house' ? 'дом' : 'гараж'} за ${formatMoney(deal.price)}$.`,
                keyboard: "",
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if ((payload.cmd === 'top_menu' || payload.cmd === 'top_back' || payload.cmd === 'biz_upgrade') && payload.author) {
            if (String(userId) !== String(payload.author)) {
                return await safeAnswer({
                    type: 'show_snackbar',
                    text: '❌ Это меню вызвано другим пользователем.'
                });
            }
        }

        // --- НАСТРОЙКИ АНТИСПАМА ---
        if (payload.cmd === 'settings_toggle') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            
            const newVal = payload.state; 
            await dbRun("UPDATE settings SET value = ? WHERE key = 'antispam_enabled'", [newVal]);
            
            await safeAnswer();
            const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
            const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
            const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;

            let statusText = newVal === '1' ? "🟢 Включен" : "🔴 Выключен";

            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: `⚙️ Настройки антиспама:\n\nСтатус: ${statusText}\n\nНажмите на кнопку, чтобы изменить параметр.`,
                keyboard: await getSettingsKb(newVal, limit, time, mute),
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'settings_edit') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            
            await safeAnswer();
            adminStates.set(userId, payload.field); 
            
            let fieldName = "";
            if (payload.field === 'limit') fieldName = "лимит сообщений (например, 5)";
            if (payload.field === 'time') fieldName = "время в секундах (например, 60)";
            if (payload.field === 'mute') fieldName = "время мута в минутах (например, 10)";

            await vk.api.messages.send({
                peer_id: context.peerId,
                message: `✏️ Введите новое значение: ${fieldName}`,
                random_id: Math.floor(Math.random() * 1000000000)
            });
            return;
        }

        // --- МЕНЮ HELP ---
        if (payload.cmd === 'help_start') {
            await safeAnswer();
            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: "📖 Выберите раздел с командами:",
                keyboard: getHelpKb(),
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            let msg = "";
            if (payload.section === 'games') msg = "🎰 Игровые команды:\n/рулетка [цвет/чет] [ставка]\n/краш [автостоп] [ставка]\n/монетка [орел/решка] [ставка]\n/стакан [1-3] [ставка]\n/кубик [1-6] [ставка]\n/автомат [ставка]\n/блэкджек [ставка]\n/дрим [1-5] [ставка]\n/мины [ставка]\n/фортуна\n\n⚠️ Мин. ставка: 100$. Ставка 'вб' разрешена.";
            if (payload.section === 'eco') msg = "💼 Экономика:\n/бизнес\n/купитьбиз [название]\n/мойбизнес\n/вывести\n/закрыть бизнес\n/бонус\n/transfer [сумма] (ответом)\n/duel [сумма]\n/promo [код]\n/промолист\n/машины\n/купить машина [название]\n/sellcar (слить машину)\n/дон дом (топ домов Т1-Т10)\n/дон гараж (топ гаражей Т1-Т10)";
            if (payload.section === 'profile') msg = "👤 Профиль и прочее:\n/профиль\n/топ\n/rep +/- (ответом)\n/пинг\n\n💡 Слэш (/) в начале писать необязательно!";
            
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                    const count = countRow ? countRow.c : 0;
                    txt += `📍 ${data.name} (${count}/20)\n└ Свободно мест: ${20 - count}\n`;
                }
                txt += `\n💡 Купить: /купить дом топ [номер] [Локация]\n💡 Продать: /продать дом [сумма] (ответом на сообщение)\n🏆 Доны: /дон дом`;
                msg = txt;
            }
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                    const count = countRow ? countRow.c : 0;
                    txt += `📍 ${data.name} (${count}/20)\n└ Свободно мест: ${20 - count}\n`;
                }
                txt += `\n💡 Купить: /купить гараж топ [номер] [Локация]\n💡 Продать: /продать гараж [сумма] (ответом на сообщение)\n🏆 Доны: /дон гараж`;
                msg = txt;
            }
            
            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: msg,
                keyboard: getHelpBackKb(),
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'casino_info') {
            let msg = "";
            if (payload.game === 'roulette') msg = "Как играть в рулетку ❓\n\"Рулетка [на что ставишь] [ставка]\"\n▪ Число от 0 до 36 (x36)\n▪ Чет (x2)\n▪ Нечет (x2)\n▪ Красное (x2)\n▪ Черное (x2)\n▪ 1-12 (x3)\n▪ 13-24 (x3)\n▪ 25-36 (x3)\n▪ 1-18 (x2)\n▪ 19-36 (x2)\n▪ Ряд1\n▪ Ряд2\n▪ Ряд3\n\n⚠️ Мин. ставка: 100$. Ставка 'вб' разрешена.\n\nПример — \"Рулетка чет 5кк\"";
            if (payload.game === 'crash') msg = "❌ краш (автостоп) (ставка)\n\nПример: краш 3 5кк";
            if (payload.game === 'coin') msg = "❌ монетка [орел/решка] [ставка]\n\nПример: монетка орел 100к";
            if (payload.game === 'glass') msg = "❌ стакан [1-3] [ставка]\n\nПример: стакан 2 100к";
            if (payload.game === 'dice') msg = "❌ кубик [1-6] [ставка]\n\nПример: кубик 4 100к";
            if (payload.game === 'slot') msg = "автомат (сумма)\n\nПример: автомат 5кк";
            if (payload.game === 'blackjack') msg = "❌ Блэкджек (ставка)\n\nПример: блэкджек 100к";
            if (payload.game === 'dream') msg = "Дрим [число] [ставка]\n-Доступны числа:\n🔹 1 (x2)\n🔹 2 (x2)\n🔹 3 (x3)\n🔹 4 (x4)\n🔹 5 (x5)\n\n🤔 Пример: дрим 5 100к";
            
            await safeAnswer(); 
            await vk.api.messages.send({
                peer_id: context.peerId,
                message: msg,
                random_id: Math.floor(Math.random() * 1000000000),
                disable_mentions: 1
            });
            return;
        }

        if (payload.cmd === 'biz_upgrade') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас нет бизнеса.' });
            }
            if (biz.level >= 5) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Максимальный уровень!' });
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const timePassed = Date.now() - biz.last_income;
            const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

            const userBal = await getBalance(userId);
            if (userBal < nextLevelCost) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег на балансе!' });
            }

            await safeAnswer();
            await updateBalance(userId, -nextLevelCost);
            await dbRun("UPDATE businesses SET level = level + 1, balance = ?, last_income = ? WHERE user_id = ?", [totalBalance, Date.now(), String(userId)]);
            
            const newMsgText = `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level + 1}/5\n🐱 ${formatMoney(bizData.baseIncome * (biz.level + 1) * 20)}$/час\n💸 На балансе бизнеса: ${formatMoney(totalBalance)}$\n\nПовышение уровня стоит: ${formatMoney((biz.level + 1) * 5000000)}$\n\n👉 Чтобы вывести деньги, напишите в чат /вывести`;
            
            await vk.api.messages.edit({ 
                peer_id: context.peerId,
                message: newMsgText, 
                keyboard: getBizKb(userId), 
                disable_mentions: 1,
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;

            if (now - lastReset >= 3600000) {
                count = 0;
                lastReset = now;
            }

            if (count >= 3) {
                const remaining = 3600000 - (now - lastReset);
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${m} мин. ${s} сек.` });
            }

            if (payload.type === 'Такси') {
                const userRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
                if (!userRow || !userRow.car) {
                    return await safeAnswer({ type: 'show_snackbar', text: '❌ Для работы в такси нужна машина! Купите её в /машины' });
                }
            }

            await safeAnswer();
            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);

            const isLucky = Math.random() > 0.3;
            let earned = 0;
            let msgText = "";

            if (isLucky) {
                earned = 2000000;
                await updateBalance(userId, earned);
                msgText = `✅ Вы успешно поработали (${payload.type}) и заработали ${formatMoney(earned)}$!`;
            } else {
                msgText = `😢 Не повезло! Вы работали (${payload.type}), но заработали 0$.`;
            }

            const newBal = await getBalance(userId);
            
            await vk.api.messages.edit({ 
                peer_id: context.peerId,
                message: `${msgText}\n\n💰 Ваш баланс: ${formatMoney(newBal)}$\n📊 Осталось попыток: ${3 - count}/3`, 
                keyboard: getWorkKb(),
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        await safeAnswer();

        if (payload.cmd === 'work_menu') {
            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: "💼 Выберите работу:",
                keyboard: getWorkKb(),
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'activate_bot' || payload.cmd === 'decline_bot') {
            try {
                const members = await vk.api.messages.getConversationMembers({ peer_id: context.peerId });
                const clicker = members.items.find(m => m.member_id === userId);
                const isClickerAdmin = clicker && (clicker.is_admin || clicker.is_owner);
                
                if (!isClickerAdmin && userId !== ADMIN_ID) {
                    return await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: "❌ Только администраторы беседы могут это сделать!",
                        keyboard: "",
                        conversation_message_id: context.conversationMessageId
                    });
                }

                const bot = members.items.find(m => m.member_id == -GROUP_ID || m.member_id == GROUP_ID);
                const isBotAdmin = bot && bot.is_admin;

                if (payload.cmd === 'activate_bot') {
                    if (!isBotAdmin) return await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: "❌ Ошибка. Убедитесь, что бот владеет статусом администратора.",
                        keyboard: "",
                        conversation_message_id: context.conversationMessageId
                    });
                    await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: "🎉 Вы подключили бота к беседе!\nЧтобы узнать подробности напишите /help",
                        disable_mentions: 1,
                        keyboard: "",
                        conversation_message_id: context.conversationMessageId
                    });
                } else {
                    await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: "❌ Активация отменена. Чтобы начать работу, добавьте бота заново.",
                        disable_mentions: 1,
                        keyboard: "",
                        conversation_message_id: context.conversationMessageId
                    });
                }
                return;
            } catch (e) {
                return await vk.api.messages.edit({
                    peer_id: context.peerId,
                    message: "❌ Ошибка при проверке прав.",
                    keyboard: "",
                    conversation_message_id: context.conversationMessageId
                });
            }
        }

        if (payload.cmd === 'top_menu') {
            const type = payload.type;
            const scope = payload.scope;
            const repType = payload.repType || 'pos';

            let orderBy = "balance DESC";
            let filter = "balance > 2";
            
            if (type === 'rep') {
                if (repType === 'pos') {
                    orderBy = "reputation DESC";
                    filter = "reputation > 0";
                } else {
                    orderBy = "reputation ASC";
                    filter = "reputation < 0";
                }
            } else if (type === 'level') {
                orderBy = "level DESC, xp DESC";
                filter = "level > 1"; 
            } else if (type === 'duels') {
                orderBy = "duel_wins DESC";
                filter = "duel_wins > 0";
            } else if (type === 'bonus') {
                orderBy = "bonus_count DESC";
                filter = "bonus_count > 0";
            }

            let rows = [];
            if (scope === 'global') {
                rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
            } else {
                const chatUsers = await dbAll("SELECT user_id FROM chat_messages WHERE peer_id = ?", [String(context.peerId)]);
                if (chatUsers.length > 0) {
                    const ids = chatUsers.map(u => `'${u.user_id}'`).join(',');
                    rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count FROM users WHERE user_id IN (${ids}) AND ${filter} ORDER BY ${orderBy} LIMIT 10`);
                }
            }

            if (rows.length === 0) {
                await vk.api.messages.edit({
                    peer_id: context.peerId,
                    message: "❌ Топ пуст.",
                    keyboard: getTopKb(payload.author, type, scope, repType),
                    conversation_message_id: context.conversationMessageId
                });
                return;
            }

            const userIds = rows.map(r => r.user_id);
            let usersInfo = [];
            try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}

            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n`;
            if (type === 'coins') title += "💰 По монетам\n\n";
            if (type === 'level') title += "📊 По уровню\n\n";
            if (type === 'duels') title += "⚔️ По победам в дуэлях\n\n";
            if (type === 'bonus') title += "🎁 По бонусам\n\n";
            if (type === 'rep') title += `⭐ По репутации (${repType === 'pos' ? 'Положительная' : 'Отрицательная'})\n\n`;

            let topText = title;
            let count = 0;
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            
            for (const r of rows) {
                const uInfo = usersInfo.find(u => u.id == r.user_id);
                if (uInfo && !uInfo.deactivated) {
                    let value = "";
                    if (type === 'coins') value = `${formatMoney(r.balance)}$`;
                    if (type === 'level') value = `Ур. ${r.level} (${r.xp} XP)`;
                    if (type === 'rep') value = `${r.reputation > 0 ? '+' : ''}${r.reputation}`;
                    if (type === 'duels') value = `${r.duel_wins} побед`;
                    if (type === 'bonus') value = `${r.bonus_count} бонусов`;
                    
                    topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] — ${value}\n`;
                    count++;
                }
            }

            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: topText,
                keyboard: getTopKb(payload.author, type, scope, repType),
                disable_mentions: 1,
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'top_back') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(context.peerId)]);
            let topText = "⭐ ТОП 10 ПОЛЬЗОВАТЕЛЕЙ ПО СООБЩЕНИЯМ\n\n";
            
            if (rows.length > 0) {
                const userIds = rows.map(r => r.user_id);
                let usersInfo = [];
                try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}
                let count = 0;
                const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
                for (const r of rows) {
                    const uInfo = usersInfo.find(u => u.id == r.user_id);
                    if (uInfo && !uInfo.deactivated) {
                        topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] - ${r.count} сообщений\n`;
                        count++;
                    }
                }
            } else {
                topText += "В этой беседе еще никто не писал.";
            }

            await vk.api.messages.edit({
                peer_id: context.peerId,
                message: topText,
                keyboard: getTopKb(payload.author, 'coins', 'chat'),
                disable_mentions: 1,
                conversation_message_id: context.conversationMessageId
            });
            return;
        }

        if (payload.cmd === 'duel_accept') {
            const duelId = payload.duel_id;
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [duelId]);
            
            if (row) {
                if (String(userId) === row.challenger) return await vk.api.messages.edit({
                    peer_id: context.peerId,
                    message: "❌ Нельзя драться с собой!",
                    keyboard: "",
                    conversation_message_id: context.conversationMessageId
                });
                if (await getBalance(userId) < row.bet) return await vk.api.messages.edit({
                    peer_id: context.peerId,
                    message: "❌ Не хватает денег!",
                    keyboard: "",
                    conversation_message_id: context.conversationMessageId
                });
                
                const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
                const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
                const prize = Math.floor(row.bet * 1.8);
                
                await updateBalance(winnerId, prize);
                await updateBalance(loserId, -row.bet);
                
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [duelId]);
                
                const winnerName = await getFullName(winnerId);
                const loserName = await getFullName(loserId);
                const msgText = `⚔️ Дуэль завершена!\n\n🏆 Победитель: ${winnerName}\n❌ Проигравший: ${loserName}\n\n💰 Выигрыш: ${prize}$`;
                
                await vk.api.messages.edit({
                    peer_id: context.peerId,
                    message: msgText,
                    keyboard: "",
                    disable_mentions: 1,
                    conversation_message_id: context.conversationMessageId
                });
                return;
            }
        }

        if (payload.cmd === 'mines_set') {
            const gameId = String(payload.gameId);
            const count = Number(payload.count);
            
            try {
                const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
                if (!row) {
                    try {
                        await vk.api.messages.edit({
                            peer_id: context.peerId,
                            message: "❌ Игра устарела. Введите /мины заново.",
                            keyboard: "",
                            conversation_message_id: context.conversationMessageId
                        });
                    } catch(e) {}
                    return;
                }

                const minesArr = [];
                while(minesArr.length < count) {
                    const r = Math.floor(Math.random() * 9) + 1;
                    if (!minesArr.includes(r)) minesArr.push(r);
                }
                const minesStr = JSON.stringify(minesArr);
                
                const now = Date.now();
                await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0, start_time = ? WHERE game_id = ?", [minesStr, now, gameId]);
                
                const name = await getFullName(userId);
                const ui = getMinesGameUI(gameId, row.bet, count, minesArr, [], false, null, name, await getBalance(userId), 60);
                
                try {
                    await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: ui.text,
                        keyboard: ui.kb,
                        conversation_message_id: context.conversationMessageId
                    });
                } catch(e) {}
                return;
            } catch(e) {
                console.error("Ошибка при старте мин:", e);
                return;
            }
        }

        if (payload.cmd === 'mines_click') {
            const gameId = String(payload.gameId);
            const cell = Number(payload.cell);
            
            try {
                const row = await dbGet("SELECT bet, mines, opened, multiplier, start_time FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
                if (!row) return;

                const bet = row.bet;
                const mines = JSON.parse(row.mines);
                const opened = JSON.parse(row.opened);
                const startTime = row.start_time;

                if (Date.now() - startTime > 60000) {
                    await updateBalance(userId, -bet);
                    await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                    const balance = await getBalance(userId);
                    
                    const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, null, await getFullName(userId), balance);
                    let text = ui.text.replace('наступил(а) на мину!', 'не успел(а) открыть клетку!');
                    
                    try {
                        await vk.api.messages.edit({
                            peer_id: context.peerId,
                            message: text,
                            keyboard: ui.kb,
                            conversation_message_id: context.conversationMessageId
                        });
                    } catch(e) {}
                    return;
                }
                
                if (opened.includes(cell)) return;

                opened.push(cell);
                let isLoss = false;
                let hitCell = null;
                let currentMoney = 0;

                if (mines.includes(cell)) {
                    isLoss = true;
                    hitCell = cell;
                    await updateBalance(userId, -bet);
                    await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                } else {
                    let currentMult = 1.0;
                    for (let i = 0; i < opened.length; i++) {
                        currentMult *= (9 - i) / (9 - mines.length - i);
                    }
                    currentMult = Math.round(currentMult * 0.95 * 100) / 100;
                    currentMoney = Math.floor(bet * currentMult);

                    if (opened.length === (9 - mines.length)) {
                        await updateBalance(userId, currentMoney);
                        await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                        isLoss = true;
                        hitCell = -1;
                    } else {
                        await dbRun("UPDATE games SET opened = ?, multiplier = ? WHERE game_id = ?", [JSON.stringify(opened), currentMult, gameId]);
                    }
                }

                const balance = await getBalance(userId);
                const name = await getFullName(userId);

                if (isLoss) {
                    const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, hitCell, name, balance);
                    let text = ui.text;
                    if (hitCell === -1) {
                        text = `🏆 ПОБЕДА!\n────────────────────\n👤 ${name}\n💣 Мин на поле: ${mines.length}\n✅ Успел(а) открыть: ${opened.length}\n\n📈 Выигрыш: +${currentMoney} 💰 (x${(currentMoney/bet).toFixed(2)})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Поздравляем! Ты забрал всё! 🎉`;
                    }
                    
                    try {
                        await vk.api.messages.edit({
                            peer_id: context.peerId,
                            message: text,
                            keyboard: ui.kb,
                            conversation_message_id: context.conversationMessageId
                        });
                    } catch(e) {}
                } else {
                    const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, false, null, name, balance);
                    const timeLeft = Math.max(0, Math.floor((60000 - (Date.now() - startTime)) / 1000));
                    let text = ui.text.replace('{TIME}', timeLeft.toString());
                    
                    try {
                        await vk.api.messages.edit({
                            peer_id: context.peerId,
                            message: text,
                            keyboard: ui.kb,
                            conversation_message_id: context.conversationMessageId
                        });
                    } catch(e) {}
                }
                return;
            } catch (e) {
                console.error("Ошибка при клике в минах:", e);
                return;
            }
        }

        if (payload.cmd === 'mines_cashout') {
            const gameId = String(payload.gameId);
            
            try {
                const row = await dbGet("SELECT bet, multiplier, mines, opened FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
                if (!row) return;

                const opened = JSON.parse(row.opened);
                if (opened.length === 0) return; 

                const winAmount = Math.floor(row.bet * row.multiplier);
                await updateBalance(userId, winAmount);
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                
                const balance = await getBalance(userId);
                const mines = JSON.parse(row.mines);
                
                const msgText = `💰 ВЫВОД\n────────────────────\n👤 ${await getFullName(userId)}\n💵 Забрал: ${winAmount} 💰 (x${row.multiplier})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Отличная игра! Заходи ещё 🍀`;
                
                try {
                    await vk.api.messages.edit({
                        peer_id: context.peerId,
                        message: msgText,
                        keyboard: buildMinesKb(gameId, opened, mines, true, null),
                        conversation_message_id: context.conversationMessageId
                    });
                } catch(e) {}
                return;
            } catch(e) {
                console.error("Ошибка при выводе в минах:", e);
                return;
            }
        }

    } catch (e) {
        console.error("КРИТИЧЕСКАЯ Ошибка в кнопках:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка. Попробуйте позже.' });
    }
});

// ===== ЗАПУСК =====
console.log("ПОПЫТКА ЗАПУСКА БОТА...");
vk.updates.startPolling().then(() => {
    console.log("--- БОТ УСПЕШНО ЗАПУЩЕН (LONGPOLL) ---");
}).catch(err => {
    console.error("ОШИБКА ПРИ СТАРТЕ:", err);
});
