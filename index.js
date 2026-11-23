const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

console.log("=========================================");
console.log("ВЕРСИЯ NODE.JS:", process.version);
console.log("=========================================");

// ===== НАСТРОЙКИ =====
const TOKEN = "vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0";
const GROUP_ID = 243089386;
const ADMIN_ID = 200005093141;
const BONUS_CD = 86400; // 24 часа (в секундах)
const FORTUNA_CD = 600;

const DEFAULT_PROFILE_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&u=lu3E3ggWqF0yEAFf92En4aIiZtuv0TIPXL9GxEDIiJ4&cs=277x0';

const ROULETTE_PHOTOS = [
    'https://sun9-63.userapi.com/s/v1/ig2/to7LopyEWd8Z1KvH7SUG3N1JPeHQpK4NRx_h7wJHnKvpiFbzpGm7k6274tKqxtJkLpU035GKCJTtL9CnOtB5OcM9.jpg?quality=95&as=32x18,48x27,72x40,108x61,160x90,240x135,360x202,480x270,540x304,640x360,720x405,1080x607,1280x720,1440x810,2208x1242&from=bu&cs=2208x0',
];

const BIZ_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&u=lu3E3ggWqF0yEAFf92En4aIiZtuv0TIPXL9GxEDIiJ4&cs=277x0';

// ===== ИНИЦИАЛИЗАЦИЯ БОТА =====
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

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const spamCache = new Map(); 
const chsbNotifyCache = new Map(); 

// ===== ДАННЫЕ ДЛЯ ИГР =====
const BIZ_DATA = {
    'шаурма': { name: '🌯 Шаурма', price: 500000, baseIncome: 2000 },
    'кафе': { name: '☕ Кафе', price: 1500000, baseIncome: 4000 },
    'game zone': { name: '🕹️ Отдел Game Zone', price: 5000000, baseIncome: 6000 },
    'казино': { name: '🎰 Казино', price: 15000000, baseIncome: 10000 },
    'пятерочка': { name: '🏪 24/7 Пятёрочка', price: 50000000, baseIncome: 15000 },
    'транспортная': { name: '🚚 Транспортная компания', price: 75000000, baseIncome: 25000 },
    'строительная': { name: '🏗️ Строительная компания', price: 100000000, baseIncome: 35000 },
    'азс': { name: '⛽ АЗС', price: 150000000, baseIncome: 50000 }
};

const CARS_DATA = {
    'м5 ф90': { name: 'BMW M5 F90', price: 15000000, sellPrice: 10000000 },
    'м5 ф10': { name: 'BMW M5 F10', price: 8000000, sellPrice: 5000000 },
    'м3': { name: 'BMW M3 G80', price: 12000000, sellPrice: 8000000 },
    'мерседес': { name: 'Mercedes-Benz E-Class', price: 10000000, sellPrice: 6000000 },
    'ауди': { name: 'Audi RS7', price: 18000000, sellPrice: 12000000 },
    'ламборгини': { name: 'Lamborghini Huracan', price: 35000000, sellPrice: 25000000 },
    'порше': { name: 'Porsche 911 Turbo', price: 28000000, sellPrice: 20000000 }
};

const PROPERTY_DATA = {
    'нижегородская': { name: 'Нижегородская', housePrice: 5000000, garagePrice: 1000000 },
    'рублевка': { name: 'Рублевка', housePrice: 25000000, garagePrice: 5000000 },
    'егоровка': { name: 'Егоровка', housePrice: 50000000, garagePrice: 10000000 },
    'гарель': { name: 'Гарель', housePrice: 100000000, garagePrice: 20000000 }
};

// ===== ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ =====
async function initDB() {
    await dbRun("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, reputation INTEGER DEFAULT 0, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, reg_date TEXT, duel_wins INTEGER DEFAULT 0, bonus_count INTEGER DEFAULT 0, premium_until INTEGER DEFAULT 0, org TEXT, country TEXT, clothes TEXT, cars TEXT DEFAULT '[]', last_bonus_date TEXT, bonus_streak INTEGER DEFAULT 0, car TEXT)");
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
    
    // Таблица бизнесов (Фикс бага: один бизнес на игрока)
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT PRIMARY KEY, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS custom_cmds (user_id TEXT, alias TEXT, real_cmd TEXT, PRIMARY KEY (user_id, alias))");
    await dbRun("CREATE TABLE IF NOT EXISTS warnings (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, lender TEXT, borrower TEXT, amount INTEGER, days INTEGER, status TEXT DEFAULT 'pending')");

    // Миграции для старых баз
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
    try { await dbRun("ALTER TABLE users ADD COLUMN premium_until INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN org TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN country TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN clothes TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN cars TEXT DEFAULT '[]'"); } catch(e) {}

    // Удаление дубликатов бизнесов
    try { await dbRun("DELETE FROM businesses WHERE rowid NOT IN (SELECT MIN(rowid) FROM businesses GROUP BY user_id)"); } catch(e) {}

    // Настройки по умолчанию
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_enabled', '0')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_limit', '5')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_time', '60')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_mute', '10')");
    
    console.log("--- БАЗА ДАННЫХ ГОТОВА ---");
}
initDB();

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
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
    let newBal = Math.floor(Number(bal) + amt);
    if (newBal < 0) newBal = 0;
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

// ===== ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ =====
async function generateProfileImage(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200' });
        const nameText = `${user.first_name} ${user.last_name || ''}`.trim();
        const avatarUrl = user.photo_200 || DEFAULT_PROFILE_PHOTO;

        const avatar = await Jimp.read(avatarUrl);
        avatar.cover(400, 400);

        const canvas = new Jimp(400, 450, 0x101010FF);
        canvas.composite(avatar, 0, 0);

        const banner = new Jimp(400, 50, 0x000000B0);
        canvas.composite(banner, 0, 400);

        const font = await Jimp.loadFont("https://cdn.jsdelivr.net/gh/Fluffffy/jimp-cyrillic-fonts@master/fonts/open-sans-32-white/open-sans-32-white.fnt");
        
        canvas.print(
            font,
            0,
            400,
            {
                text: nameText,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
            },
            400,
            50
        );

        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
        console.error("Ошибка генерации фото профиля:", e);
        return null;
    }
}

async function generateBizImage(userId, bizName) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200' });
        const nameText = `${user.first_name} ${user.last_name || ''}`.trim();
        const avatarUrl = user.photo_200 || DEFAULT_PROFILE_PHOTO;
        const avatar = await Jimp.read(avatarUrl); 
        avatar.cover(200, 200);
        const canvas = new Jimp(800, 400, 0x101010FF); 
        canvas.composite(avatar, 50, 100);
        const font = await Jimp.loadFont("https://cdn.jsdelivr.net/gh/Fluffffy/jimp-cyrillic-fonts@master/fonts/open-sans-32-white/open-sans-32-white.fnt");
        canvas.print(font, 300, 150, `Бизнес: ${nameText}`); 
        canvas.print(font, 300, 200, `${bizName}`); 
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) { return null; }
}

// ИСПРАВЛЕННАЯ РУЛЕТКА (БЕЗ ЗЕЛЕНОГО ЦВЕТА)
async function generateRouletteImage(number, color) {
    try {
        const img = await Jimp.read(ROULETTE_PHOTOS[0]);
        const canvas = new Jimp(1080, 700, 0x101010FF);
        canvas.composite(img, 0, 0);
        
        let barColor = 0xFF0000FF; // Красный по умолчанию
        if (color === 'black') barColor = 0x000000FF;
        
        const bar = new Jimp(1080, 100, barColor);
        canvas.composite(bar, 0, 600);
        
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        canvas.print(font, 0, 610, { text: String(number), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 1080, 100);
        
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch(e) { return null; }
}

// ===== ГЕНЕРАТОР ДЛЯ МИН =====
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
        if (i % 3 === 0) {
            kb.row();
        }
    }
    
    if (!isGameOver && currentMoney > 0 && opened.length > 0) {
        kb.callbackButton({ label: `💰 Забрать ${currentMoney}`, payload: { cmd: 'mines_cashout', gameId: String(gameId) }, color: Keyboard.SECONDARY_COLOR });
    }
    return kb.toString();
}

// ===== КЛАВИАТУРЫ =====
// ИСПРАВЛЕНА КЛАВИАТУРА (ТЕПЕРЬ РАБОТАЮТ КНОПКИ)
const mainKb = Keyboard.builder()
    .callbackButton({ label: '💼 Работа', payload: { cmd: 'main_menu', action: 'work' }, color: Keyboard.POSITIVE_COLOR })
    .callbackButton({ label: '🎰 Рулетка', payload: { cmd: 'main_menu', action: 'roulette' }, color: Keyboard.PRIMARY_COLOR })
    .row()
    .callbackButton({ label: '👤 Профиль', payload: { cmd: 'main_menu', action: 'profile' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: '🏆 Топ', payload: { cmd: 'main_menu', action: 'top' }, color: Keyboard.SECONDARY_COLOR });

const getWorkKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🎣 Рыбалка', payload: { cmd: 'work_do', type: 'Рыбалка' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🚕 Такси', payload: { cmd: 'work_do', type: 'Такси' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🔫 Охота', payload: { cmd: 'work_do', type: 'Охота' }, color: Keyboard.POSITIVE_COLOR })
        .toString();
};

const getCasinoKb = () => {
    return Keyboard.builder().inline()
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
};

const getHelpKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🎰 Игры', payload: { cmd: 'help_menu', section: 'games' }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '💼 Экономика', payload: { cmd: 'help_menu', section: 'eco' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🏠 Дома', payload: { cmd: 'help_menu', section: 'houses' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🏘️ Гаражи', payload: { cmd: 'help_menu', section: 'garages' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '👤 Профиль', payload: { cmd: 'help_menu', section: 'profile' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🏛️ Организации', payload: { cmd: 'help_menu', section: 'org' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};

const getHelpBackKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🔙 Назад', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};

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

const getDuelKb = (duelId) => {
    return Keyboard.builder().inline().callbackButton({
        label: '⚔️ Сразиться',
        payload: { cmd: 'duel_accept', duel_id: duelId },
        color: Keyboard.POSITIVE_COLOR
    }).toString();
};

const getMinesCountKb = (gameId) => {
    const kb = Keyboard.builder().inline();
    let count = 0;
    for (let i = 2; i <= 8; i++) {
        kb.callbackButton({ label: `${i} 💣`, payload: { cmd: 'mines_set', gameId: String(gameId), count: String(i) }, color: Keyboard.SECONDARY_COLOR });
        count++;
        if (count % 4 === 0 && i !== 8) {
            kb.row();
        }
    }
    return kb.toString();
};

const getTopKb = (authorId, type = 'coins', scope = 'chat', repType = 'pos') => {
    const kb = Keyboard.builder().inline();
    
    kb.callbackButton({ label: '💰 Монеты', payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Лиги', payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();

    kb.callbackButton({ label: '⚔️ Дуэли', payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Репутация', payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    if (type === 'rep') {
        kb.callbackButton({ label: '➕ Положит.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.callbackButton({ label: '➖ Отрицат.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.row();
    }

    kb.callbackButton({ label: '🎁 Бонус', payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🏆 Топ 10', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });
    kb.row();

    kb.callbackButton({ label: '🌍 Общее', payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 В беседе', payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });

    return kb.toString();
};

const getBizKb = (authorId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: 'Вывести $$$', payload: { cmd: 'biz_withdraw', author: authorId }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: 'Повысить уровень', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};

const getShopKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🧢 Шапки', payload: { cmd: 'shop_cat', cat: 'hat' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '👕 Футболки', payload: { cmd: 'shop_cat', cat: 'shirt' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '👖 Джинсы', payload: { cmd: 'shop_cat', cat: 'jeans' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '👟 Обувь', payload: { cmd: 'shop_cat', cat: 'shoes' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};
// ===== ОБРАБОТКА СООБЩЕНИЙ =====
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox) {
        return;
    }
    if (message.senderId < 0) {
        return;
    }

    try {
        let text = message.text ? message.text.trim().toLowerCase() : '';
        if (!text) {
            return;
        }

        const userId = message.senderId;
        const peerId = message.peerId;
        const isLs = peerId === userId;

        let cleanText = text.replace(/\//g, '').trim();
        let parts = cleanText.split(/\s+/);
        let cmdWord = parts[0];

        // --- КАСТОМНЫЕ КОМАНДЫ ---
        const customCmd = await dbGet("SELECT real_cmd FROM custom_cmds WHERE user_id = ? AND alias = ?", [String(userId), cmdWord]);
        if (customCmd) {
            text = text.replace(cmdWord, customCmd.real_cmd);
            cleanText = text.replace(/\//g, '').trim();
            parts = cleanText.split(/\s+/);
            cmdWord = parts[0];
        }

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
                            .urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` })
                            .row()
                            .urlButton({ label: 'Правила бота', url: `https://vk.ru/topic-243089386_69454146` });
                        
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
                        try {
                            await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); 
                        } catch(e2) {}
                    }
                    return; 
                } else {
                    await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
                }
            }
        }

        // --- АНТИСПАМ ---
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
                        try { 
                            await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); 
                        } catch (e) {}
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

                        try { 
                            await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); 
                        } catch(e) {}
                    } catch(e) {
                        spamData.isMuted = false;
                        spamCache.set(cacheKey, spamData);
                    }
                }
            }
        }

        // --- НАСТРОЙКИ И ОТВЕТЫ НА РЕПОРТЫ ---
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            
            // ЕСЛИ АДМИН ОТВЕЧАЕТ НА РЕПОРТ
            if (state.startsWith('reply_')) {
                const targetId = state.split('_')[1];
                const replyText = message.text;
                adminStates.delete(userId);
                try {
                    await vk.api.messages.send({
                        peer_id: targetId,
                        message: `✍️ Ответ администрации:\n${replyText}`,
                        random_id: Math.floor(Math.random() * 1000000000)
                    });
                    return await message.reply("✅ Ответ отправлен игроку в ЛС.");
                } catch(e) {
                    return await message.reply("❌ Ошибка отправки (возможно, у игрока закрыты ЛС).");
                }
            }

            // ЕСЛИ ЭТО НАСТРОЙКИ АНТИСПАМА (ЦИФРЫ)
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

        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cc', 'ping', 'пинг', 'убрать', 'настройки', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'cmd', 'моикоманды', 'premium', 'магаз', 'reg', 'q', 'админ', 'ahelp', 'объявление', 'report', 'вступить', 'организации', 'страна', 'страны', 'датьдолг', 'мойдолг'];
        
        if (!text.startsWith('/') && !validCmds.includes(cmdWord)) {
            return; 
        }

        // --- УРОВНИ ---
        let userRow = await dbGet("SELECT xp, level, reg_date, premium_until, org, country, clothes, cars FROM users WHERE user_id = ?", [String(userId)]);
        if (!userRow) {
            const today = new Date().toLocaleDateString('ru-RU');
            await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), today]);
            userRow = { xp: 0, level: 1, premium_until: 0, org: null, country: null, clothes: null, cars: '[]' };
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
        const isPremium = userRow.premium_until > Date.now();

        const replyParams = (kb = undefined) => {
            const p = { disable_mentions: 1 };
            if (kb) p.keyboard = kb;
            return p;
        };

        // ===== КОМАНДЫ =====
        
        if (cmdWord === 'cmd') {
            if (parts.length < 3) return await message.reply("❌ Формат: /cmd [название] [команда]\nПример: /cmd игра рулетка", replyParams());
            const alias = parts[1];
            const realCmd = parts.slice(2).join(' ');
            
            const countRow = await dbGet("SELECT COUNT(*) as c FROM custom_cmds WHERE user_id = ?", [String(userId)]);
            if (countRow.c >= 10) return await message.reply("❌ Вы достигли лимита в 10 кастомных команд!", replyParams());
            
            await dbRun("REPLACE INTO custom_cmds (user_id, alias, real_cmd) VALUES (?, ?, ?)", [String(userId), alias, realCmd]);
            return await message.reply(`✅ Команда сохранена!\nТеперь при вводе /${alias} будет выполняться /${realCmd}`, replyParams());
        }

        if (cmdWord === 'моикоманды' || cleanText === 'мои команды') {
            const cmds = await dbAll("SELECT alias, real_cmd FROM custom_cmds WHERE user_id = ?", [String(userId)]);
            if (cmds.length === 0) return await message.reply("У вас нет кастомных команд.", replyParams());
            let txt = "📜 Ваши кастомные команды:\n";
            for (const c of cmds) txt += `▪️ /${c.alias} -> /${c.real_cmd}\n`;
            return await message.reply(txt, replyParams());
        }

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

        // ВОЗВРАЩАЕМ ТВОЙ СТАРЫЙ HELP С КНОПКАМИ
        if (cmdWord === 'help' || cmdWord === 'помощь' || cmdWord === 'команды') {
            return await message.reply("📖 Выберите раздел с командами:", replyParams(getHelpKb()));
        }

        if (cmdWord === 'ahelp') {
            if (userId !== ADMIN_ID) return;
            let txt = `👑 АДМИН КОМАНДЫ\n\n`;
            txt += `/cc - Удалить все промокоды\n`;
            txt += `/объявление [текст] - Рассылка всем\n`;
            txt += `/выдать [сумма] [@ник/all] - Выдать деньги\n`;
            txt += `/обнулить [@ник/all] - Обнулить баланс\n`;
            txt += `/чсб [@ник] [дней] [причина] - Глобальный ЧС\n`;
            txt += `/разчсб [@ник] - Снять ЧС\n`;
            txt += `/mute [@ник] [мин] - Мут (удаляет сообщения)\n`;
            txt += `/kick [@ник] [причина] - Кик из беседы\n`;
            txt += `/создать [код] [сумма] [лимит] - Промокод\n`;
            return await message.reply(txt);
        }

        if (cmdWord === 'reg') {
            return await message.reply(`📅 Вы зарегистрированы ВКонтакте примерно в ${new Date().getFullYear() - 5} году.`, replyParams());
        }

        if (cmdWord === 'q') {
            if (!message.isChat) return;
            try {
                await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: userId, group_id: GROUP_ID });
            } catch(e) { return await message.reply("Ошибка. Скорее всего, вы админ, я не могу вас кикнуть."); }
            return;
        }

        if (cmdWord === 'premium') {
            if (isPremium) return await message.reply(`💎 У вас уже есть Premium до ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}`, replyParams());
            const cost = 50000;
            if (balance < cost) return await message.reply(`❌ Не хватает денег! Premium стоит ${formatMoney(cost)}$`, replyParams());
            await updateBalance(userId, -cost);
            const until = Date.now() + 30 * 86400000;
            await dbRun("UPDATE users SET premium_until = ? WHERE user_id = ?", [until, String(userId)]);
            return await message.reply(`✅ Вы купили Premium на 30 дней!\nТеперь вам доступны х2 опыт, х2 монеты и лимиты ставок до 3к.`, replyParams());
        }

        if (cmdWord === 'магаз' && parts[1] === 'вещей') {
            return await message.reply("🛒 Добро пожаловать в магазин одежды! Выберите категорию:", replyParams(getShopKb()));
        }

        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now();
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            const ping = Date.now() - start;
            
            let status = "🟢 Отлично";
            if (ping > 150) status = "🟡 Нормально";
            if (ping > 300) status = "🔴 Плохо";

            return await message.reply(`🏓 Понг!\n\n⚡ Скорость соединения: ${ping} мс\n📊 Статус сети: ${status}`, replyParams());
        }

        // --- ОРГАНИЗАЦИИ И СТРАНЫ ---
        if (cmdWord === 'организации') {
            const orgs = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];
            let txt = "🏛️ Доступные организации:\n";
            for (let i = 0; i < orgs.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [orgs[i]]);
                txt += `${i+1}. ${orgs[i]} (Мест занято: ${count.c}/10)\n`;
            }
            txt += "\n👉 Вступить: /вступить [Название]";
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'вступить') {
            const orgName = parts.slice(1).join(' ');
            const validOrgs = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];
            const foundOrg = validOrgs.find(o => o.toLowerCase() === orgName.toLowerCase());
            if (!foundOrg) return await message.reply("❌ Такой организации нет. Посмотри: /организации");
            
            const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [foundOrg]);
            if (count.c >= 10) return await message.reply("❌ В этой организации нет свободных мест!");
            
            await dbRun("UPDATE users SET org = ? WHERE user_id = ?", [foundOrg, String(userId)]);
            return await message.reply(`✅ Вы успешно вступили в организацию ${foundOrg}!`, replyParams());
        }

        if (cmdWord === 'страны') {
            const countries = ['Россия', 'Чеченская Республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];
            let txt = "🌍 Доступные страны:\n";
            for (let i = 0; i < countries.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE country = ?", [countries[i]]);
                txt += `${i+1}. ${countries[i]} (Граждан: ${count.c})\n`;
            }
            txt += "\n👉 Вступить: /страна [Название]";
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'страна') {
            const countryName = parts.slice(1).join(' ');
            const validCountries = ['Россия', 'Чеченская Республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];
            const found = validCountries.find(c => c.toLowerCase() === countryName.toLowerCase());
            if (!found) return await message.reply("❌ Такой страны нет. Посмотри: /страны");
            
            await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [found, String(userId)]);
            return await message.reply(`✅ Вы получили гражданство: ${found}!`, replyParams());
        }

        // --- ДОЛГИ ---
        if (cmdWord === 'датьдолг') {
            if (!message.hasReplyMessage) return await message.reply("❌ Ответьте на сообщение игрока, которому даете долг. Формат: /датьдолг [сумма] [дней]");
            const targetId = message.replyMessage.senderId;
            if (targetId === userId) return await message.reply("❌ Нельзя дать долг самому себе.");
            
            const amount = parseAmount(parts[1]);
            const days = parseInt(parts[2]);
            
            if (!amount || amount < 100) return await message.reply("❌ Минимальный долг 100$.");
            if (!days || days < 1 || days > 7) return await message.reply("❌ Срок долга от 1 до 7 дней.");
            if (balance < amount) return await message.reply("❌ У вас недостаточно средств.");
            
            await updateBalance(userId, -amount);
            await dbRun("INSERT INTO debts (lender, borrower, amount, days, status) VALUES (?, ?, ?, ?, 'pending')", [String(userId), String(targetId), amount, days]);
            
            return await message.reply(`🤝 Заявка на долг отправлена!\n💰 Сумма: ${formatMoney(amount)}$\n📅 Срок: ${days} дн.\n\n⚠️ Игрок должен подтвердить заявку в ЛС бота.`, replyParams());
        }

        // --- РЕПОРТ ДЛЯ ИГРОКОВ (/report) ---
        if (cmdWord === 'report') {
            const reportText = parts.slice(1).join(' ');
            if (!reportText) return await message.reply("❌ Формат: /report [текст жалобы]", replyParams());
            
            const reportKb = Keyboard.builder().inline()
                .callbackButton({ label: '✍️ Ответить', payload: { cmd: 'report_reply', target: userId }, color: Keyboard.PRIMARY_COLOR })
                .callbackButton({ label: '🚫 Спам', payload: { cmd: 'report_spam', target: userId }, color: Keyboard.NEGATIVE_COLOR });

            try {
                await vk.api.messages.send({
                    peer_id: ADMIN_ID,
                    message: `📩 НОВЫЙ РЕПОРТ!\n👤 От: [id${userId}|Игрок]\n💬 Текст: "${reportText}"`,
                    keyboard: reportKb.toString(),
                    random_id: Math.floor(Math.random() * 1000000000)
                });
                return await message.reply("✅ Ваш репорт отправлен администрации.", replyParams());
            } catch(e) { return await message.reply("❌ Ошибка отправки."); }
        }

        // --- АДМИН ЖАЛОБА (/админ) ---
        if (cmdWord === 'админ') {
            if (!message.hasReplyMessage) return await message.reply("❌ Ответьте на сообщение нарушителя.", replyParams());
            const targetId = message.replyMessage.senderId;
            let originalText = message.replyMessage.text || "Вложение (фото/видео/стикер)"; 
            
            // ПЕРЕДАЕМ reporter: userId, ЧТОБЫ ЗНАТЬ, КОГО ТЕГАТЬ И КОГО НАКАЗЫВАТЬ ЗА СПАМ
            const reportKb = Keyboard.builder().inline()
                .callbackButton({ label: '✅ Принять', payload: { cmd: 'admin_report', action: 'accept', target: targetId, msg: originalText, chat: peerId, reporter: userId }, color: Keyboard.POSITIVE_COLOR })
                .callbackButton({ label: '🚫 Спам', payload: { cmd: 'admin_report', action: 'spam', target: targetId, chat: peerId, reporter: userId }, color: Keyboard.NEGATIVE_COLOR });

            try {
                await vk.api.messages.send({
                    peer_id: ADMIN_ID,
                    message: `🚨 Жалоба!\nОт: [id${userId}|Игрок]\nНа: [id${targetId}|Нарушителя]\nТекст: "${originalText}"`,
                    keyboard: reportKb.toString(),
                    random_id: Math.floor(Math.random() * 1000000000)
                });
                return await message.reply("✅ Жалоба отправлена владельцу.", replyParams());
            } catch(e) { return await message.reply("❌ Не удалось отправить жалобу."); }
        }

        // --- ПРОФИЛЬ ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house' LIMIT 1", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage' LIMIT 1", [String(userId)]);
            const bizData = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            const carsArr = JSON.parse(userRow.cars || '[]');
            
            const premStr = isPremium ? `До ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}` : "Нет";
            const bizStr = bizData ? bizData.biz_name : "Нет";
            const carsStr = carsArr.length > 0 ? carsArr.join(', ') : "Нет";

            const profText = `🏠 Профиль ${await getFullName(userId)}\n\n💵 Баланс: ${formatMoney(balance)}$\n💎 Премиум: ${premStr}\n⭐ Реп: ${rep}\n📊 Уровень: ${userRow.level} (${userRow.xp}/${userRow.level*500} XP)\n\n🏢 Бизнес: ${bizStr}\n🏠 Дом: ${houseData ? houseData.location + ' Т' + houseData.tier : "Нет"}\n🏘️ Гараж: ${garageData ? garageData.location + ' Т' + garageData.tier : "Нет"}\n🚗 Машины (${carsArr.length}/10): ${carsStr}\n🏛️ Организация: ${userRow.org || "Нет"}\n🌍 Страна: ${userRow.country || "Нет"}\n👕 Одежда: ${userRow.clothes ? "Надета" : "Базовая"}\n\n🆔 ID: ${userId}`;

            let attachment = null;
            try {
                const photoBuffer = await generateProfileImage(userId);
                if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
            } catch(e) {}

            return await message.reply({ message: profText, attachment: attachment || undefined, disable_mentions: 1 });
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

            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length >= 10) return await message.reply("❌ У вас уже 10 машин! Больше нельзя купить.");
            
            if (balance < selectedCar.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedCar.price)}$, у вас ${formatMoney(balance)}.`);

            await updateBalance(userId, -selectedCar.price);
            carsArr.push(selectedCar.name);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);

            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${selectedCar.name} за ${formatMoney(selectedCar.price)}$.`, replyParams());
        }

        if (cmdWord === 'sellcar' || cmdWord === 'слить') {
            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length === 0) return await message.reply("❌ У вас нет машины, чтобы её слить государству.", replyParams());

            const carName = carsArr.pop(); 
            let carData = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.name === carName) { carData = data; break; }
            }

            if (!carData) {
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                return await message.reply("❌ Произошла ошибка: машина не найдена в базе.", replyParams());
            }

            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);

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
            if (!tierMatch) {
                return await message.reply(`❌ Обязательно указывайте топ (от 1 до 20). Пример: /купить ${typeName} топ 1 нижегородская`);
            }
            
            const tier = parseInt(tierMatch[1]);
            if (tier < 1 || tier > 20) {
                return await message.reply("❌ Топ должен быть от 1 до 20.");
            }

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

            if (!locData) {
                return await message.reply(`❌ Укажите локацию. Пример: /купить ${typeName} топ ${tier} нижегородская`);
            }

            const existing = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
            if (existing) {
                return await message.reply(`❌ У вас уже есть ${isHouse ? 'дом' : 'гараж'}! Вы не можете купить второй.`);
            }

            const isOccupied = await dbGet("SELECT id FROM properties WHERE location = ? AND type = ? AND tier = ?", [locName, type, tier]);
            if (isOccupied) {
                return await message.reply(`❌ ${isHouse ? 'Дом' : 'Гараж'} Т${tier} в локации ${locName} уже занят другим игроком!`);
            }

            const basePrice = isHouse ? locData.housePrice : locData.garagePrice;
            const price = basePrice * tier;

            if (balance < price) {
                return await message.reply(`❌ Не хватает денег! ${isHouse ? 'Дом' : 'Гараж'} Т${tier} в ${locName} стоит ${formatMoney(price)}$, у вас ${formatMoney(balance)}$.`);
            }

            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [type, locName, tier, String(userId)]);

            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${isHouse ? 'дом' : 'гараж'} в локации ${locName} (Тир Т${tier}) за ${formatMoney(price)}$!`, replyParams());
        }

        if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const isHouse = parts[1] === 'дом';
            const type = isHouse ? 'house' : 'garage';
            const typeName = isHouse ? 'дом' : 'гараж';

            if (!message.hasReplyMessage) {
                return await message.reply(`❌ Чтобы продать ${typeName}, ответьте на сообщение покупателя. Формат: /продать ${typeName} [сумма]`);
            }
            
            const amountStr = cleanText.replace('продать дом', '').replace('продать гараж', '').trim();
            const price = parseAmount(amountStr);
            const targetId = message.replyMessage.senderId;

            if (isNaN(price) || price < 1) {
                return await message.reply("❌ Укажите корректную сумму для продажи.");
            }
            if (targetId === userId) {
                return await message.reply("❌ Нельзя продать недвижимость самому себе.");
            }

            const myProp = await dbGet("SELECT id, location, tier FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
            if (!myProp) {
                return await message.reply(`❌ У вас нет ${typeName}, чтобы его продать.`);
            }

            const buyerProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(targetId), type]);
            if (buyerProp) {
                return await message.reply(`❌ У покупателя уже есть ${typeName}, он не может купить второй.`);
            }

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

        if (cmdWord === 'дон' || cmdWord === 'дондом' || cmdWord === 'донгараж') {
            let isHouse = false;
            if (cmdWord === 'дондом' || (cmdWord === 'дон' && parts[1] === 'дом')) {
                isHouse = true;
            } else if (cmdWord === 'донгараж' || (cmdWord === 'дон' && parts[1] === 'гараж')) {
                isHouse = false;
            } else {
                return;
            }
            
            const type = isHouse ? 'house' : 'garage';
            const typeName = isHouse ? '🏠 ДОНЫ ДОМОВ' : '🏘️ ДОНЫ ГАРАЖЕЙ';

            const rows = await dbAll("SELECT p.owner_id, p.location, p.tier, u.balance FROM properties p JOIN users u ON p.owner_id = u.user_id WHERE p.type = ? AND p.tier <= 10 ORDER BY p.tier DESC, u.balance DESC LIMIT 10", [type]);
            if (rows.length === 0) {
                return await message.reply(`❌ Пока никто не купил ${isHouse ? 'дома' : 'гаражи'} с Т1 по Т10.`);
            }
            
            let txt = `${typeName} (Т1 - Т10)\n────────────────────\n`;
            const userIds = [...new Set(rows.map(r => r.owner_id))];
            let usersInfo = [];
            try { 
                usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); 
            } catch(e) {}
            
            for (const r of rows) {
                const uInfo = usersInfo.find(u => u.id == r.owner_id);
                const name = uInfo && !uInfo.deactivated ? `[id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}]` : `[id${r.owner_id}|Игрок]`;
                txt += `Т${r.tier} | ${r.location} — ${name}\n`;
            }
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'казино') {
            return await message.reply("🎰 Игры:", replyParams(getCasinoKb()));
        }

        // --- ТОП ---
        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(peerId)]);
            let topText = "⭐ ТОП 10 ПОЛЬЗОВАТЕЛЕЙ ПО СООБЩЕНИЯМ\n\n";
            
            if (rows.length > 0) {
                const userIds = rows.map(r => r.user_id);
                let usersInfo = [];
                try { 
                    usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); 
                } catch (e) {}
                
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

        // --- БИЗНЕС ---
        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Доступные бизнесы для покупки (Максимум 1 бизнес на игрока):\n\n";
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
            
            if (!bizQuery) {
                return await message.reply("❌ Укажите, какой бизнес хотите купить. Пример: /купитьбиз Шаурма");
            }

            const existing = await dbGet("SELECT user_id FROM businesses WHERE user_id = ?", [String(userId)]);
            if (existing) {
                return await message.reply("❌ У вас уже есть бизнес. Вы не можете купить второй.");
            }

            let selectedBiz = null;
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) {
                    selectedBiz = data;
                    break;
                }
            }

            if (!selectedBiz) {
                return await message.reply("❌ Такого бизнеса нет. Посмотрите список: /бизнес");
            }
            if (balance < selectedBiz.price) {
                return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedBiz.price)}$`);
            }

            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
            
            return await message.reply(`🎉 Поздравляем! Вы успешно купили ${selectedBiz.name} за ${formatMoney(selectedBiz.price)}$.`, replyParams());
        }

        if (cmdWord === 'мойбизнес') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) {
                return await message.reply("❌ У вас нет бизнеса. Купите его: /бизнес");
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const timePassed = Date.now() - biz.last_income;
            const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

            let attachment = null;
            try {
                const photoBuffer = await generateBizImage(userId, biz.biz_name);
                if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
            } catch(e) {}

            return await message.reply({
                message: `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение уровня стоит: ${formatMoney(nextLevelCost)}$`,
                attachment: attachment || undefined,
                keyboard: getBizKb(userId)
            });
        }

        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) {
                return await message.reply("❌ У вас нет бизнеса.");
            }

            const now = Date.now();
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const timePassed = now - biz.last_income;
            const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;

            if (totalBalance <= 0) {
                return await message.reply("❌ Недостаточно средств в вашем бизнесе.", replyParams());
            }

            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ? WHERE user_id = ?", [now, String(userId)]);

            return await message.reply(`💸 Вы успешно вывели ${formatMoney(totalBalance)}$ с бизнеса на свой баланс!`, replyParams());
        }

        if (cmdWord === 'закрыть' && (parts[1] === 'бизнес' || parts[1] === 'бизнес' || cmdWord === 'закрытьбизнес')) {
            const biz = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) {
                return await message.reply("❌ У вас нет бизнеса для закрытия.");
            }
            
            await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
            await updateBalance(userId, 10000000);
            return await message.reply("💀 Вы успешно закрыли свой бизнес и получили компенсацию в размере 10,000,000$ на баланс.", replyParams());
        }

        // --- РЕПУТАЦИЯ ---
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
                    if (mentionMatch[1].match(/^\d+$/)) {
                        targetId = parseInt(mentionMatch[1]);
                    } else {
                        try {
                            const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                            if (res.type === 'user') {
                                targetId = res.object_id;
                            }
                        } catch (e) {}
                    }
                }
            }

            if (!targetId) {
                return await message.reply("⚠️ Укажите пользователя через @упоминание или ответом на сообщение.", replyParams());
            }
            if (targetId === userId) {
                return await message.reply("❌ Вы не можете изменить репутацию самому себе!", replyParams());
            }

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

        // --- РАБОТА ---
        if (cmdWord === 'работа') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;
            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) return await message.reply(`⏳ Ждите час.`);

            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);
            const earned = Math.floor(Math.random() * 6000) + 1000;
            await updateBalance(userId, earned);
            return await message.reply(`💼 Вы поработали и заработали ${formatMoney(earned)}$!\n📊 Осталось попыток: ${3 - count}/3`);
        }

        // --- КУЛДАУН ---
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            if (Date.now() - lastPlayed < 10000) {
                const left = Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000);
                return await message.reply(`⏳ Подождите ${left} сек. перед началом новой игры.`, replyParams());
            }
            gameCooldowns.set(userId, Date.now());
        }

        // --- ИГРЫ ---
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
                if (rand > 0.03) crashPoint = Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100;
                
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
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.random() < 0.5 ? 'орел' : 'решка';
                if (res === side) {
                    await updateBalance(userId, bet * 2);
                    return await message.reply(`🪙 Выпал: ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 2)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🪙 Выпал: ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ монетка [орел/решка] [ставка] или монетка [ставка] [орел/решка]", replyParams());
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
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.floor(Math.random() * 3) + 1;
                if (res === cup) {
                    await updateBalance(userId, bet * 3);
                    return await message.reply(`🥤 Шарик был под стаканом ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 3)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🥤 Шарик был под стаканом ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ стакан [1-3] [ставка] или стакан [ставка] [1-3]", replyParams());
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
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
                await updateBalance(userId, -bet);
                const res = Math.floor(Math.random() * 6) + 1;
                if (res === guess) {
                    await updateBalance(userId, bet * 6);
                    return await message.reply(`🎲 Выпало: ${res}\n\n✅ Вы выиграли ${formatMoney(bet * 6)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                } else {
                    return await message.reply(`🎲 Выпало: ${res}\n\n❌ Вы проиграли ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
                }
            }
            return await message.reply("❌ кубик [1-6] [ставка]", replyParams());
        }

        if (cmdWord === 'автомат') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
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
            return await message.reply("❌ автомат [ставка]", replyParams());
        }

        if (cmdWord === 'блэкджек') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
                await updateBalance(userId, -bet);
                const playerScore = Math.floor(Math.random() * 10) + 12; 
                const dealerScore = Math.floor(Math.random() * 10) + 12; 
                
                let msgText = `🃏 Блэкджек\n\n👤 Твои очки: ${playerScore}\n🤵 Очки дилера: ${dealerScore}\n\n`;
                
                if (playerScore > 21) msgText += `❌ Перебор! Вы проиграли ${formatMoney(bet)}$`;
                else if (dealerScore > 21) { await updateBalance(userId, bet * 2); msgText += `✅ У дилера перебор! Вы выиграли ${formatMoney(bet * 2)}$`; }
                else if (playerScore > dealerScore) { await updateBalance(userId, bet * 2); msgText += `✅ Вы выиграли ${formatMoney(bet * 2)}$!`; }
                else if (playerScore === dealerScore) { await updateBalance(userId, bet); msgText += `🤝 Ничья! Ставка возвращена.`; }
                else msgText += `❌ Дилер выиграл! Вы проиграли ${formatMoney(bet)}$`;
                
                msgText += `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;
                return await message.reply(msgText, replyParams());
            }
            return await message.reply("❌ блэкджек [ставка]", replyParams());
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
                if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
                
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
            return await message.reply("❌ дрим [1/2/3/4/5] [ставка]", replyParams());
        }

        // --- РУЛЕТКА (БЕЗ ЗЕЛЕНОГО ЦВЕТА, ТОЛЬКО КРАСНОЕ/ЧЕРНОЕ) ---
        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length >= 3) {
                let choice = "";
                let betStr = "";
                if (parseAmount(parts[1]) > 0 || parseAmount(parts[1]) === 'ALL') { betStr = parts[1]; choice = parts[2]; }
                else { betStr = parts[parts.length - 1]; choice = parts[1]; }

                let bet = parseAmount(betStr);
                if (bet === 'ALL') bet = balance;
                
                if (isNaN(bet) || bet < 100) {
                    return await message.reply("❌ Минимальная ставка 100$.", replyParams());
                }
                const maxBet = isPremium ? 3000 : 3000; 
                if (bet > maxBet) {
                    return await message.reply(`❌ Максимальная ставка в рулетке — ${maxBet}$ (если хотите больше, пишите 'все', чтобы поставить максимум).`, replyParams());
                }
                if (bet > balance) {
                    return await message.reply(`❌ Недостаточно средств! Ваш баланс: ${formatMoney(balance)}$.`, replyParams());
                }

                const validRed = ["красное", "красный", "кр"];
                const validBlack = ["черное", "черный", "чр"];
                const validEven = ["чет", "четное"];
                const validOdd = ["нечет", "нечетное"];

                // Исключаем 0 (от 1 до 36), только красное/черное
                const res = Math.floor(Math.random() * 36) + 1;
                const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                
                let cName = redNumbers.includes(res) ? "Красное" : "Черное";
                let cEmoji = redNumbers.includes(res) ? "🔴" : "⚫";
                let eName = res % 2 === 0 ? "Четное" : "Нечетное";
                let cColor = redNumbers.includes(res) ? 'red' : 'black';

                let win = false;
                if (parseInt(choice) === res) win = true;
                else if (validRed.includes(choice) && redNumbers.includes(res)) win = true;
                else if (validBlack.includes(choice) && !redNumbers.includes(res)) win = true;
                else if (validEven.includes(choice) && res % 2 === 0) win = true;
                else if (validOdd.includes(choice) && res % 2 !== 0) win = true;

                if (win) await updateBalance(userId, bet);
                else await updateBalance(userId, -bet);

                let attachment = null;
                try {
                    const photoBuffer = await generateRouletteImage(res, cColor);
                    if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
                } catch(e) {}

                const msgText = `🎰 Выпало: ${res} ${cEmoji} (${cName}, ${eName})\n\n` +
                                (win ? `✅ Выигрыш: +${formatMoney(bet)}$` : `😔 Проигрыш: -${formatMoney(bet)}$`) +
                                `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;

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
            if (balance < 100) {
                return await message.reply("❌ Фортуна стоит 100$.", replyParams());
            }

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
            if (bet > 5000000000) return await message.reply("❌ Максимальная ставка в минах — 5ккк", replyParams());
            if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());

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
                if (amount < 50 || amount > 5000000000000) return await message.reply("❌ Сумма перевода от 50 до 5кккк", replyParams());
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

        // --- БОНУС ---
        if (cmdWord === 'бонус') {
            const todayStr = new Date().toISOString().split('T')[0];
            const userBonus = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id = ?", [String(userId)]);
            
            let streak = userBonus?.bonus_streak || 0;
            let lastDate = userBonus?.last_bonus_date;

            if (lastDate === todayStr) {
                return await message.reply(`⏳ Вы уже забирали ежедневный бонус сегодня!\n🔥 Ваш стрик: ${streak} дн.\nПриходите завтра!`, replyParams());
            }

            if (lastDate) {
                const lastD = new Date(lastDate);
                const todayD = new Date(todayStr);
                const diffDays = Math.ceil(Math.abs(todayD - lastD) / (1000 * 60 * 60 * 24)); 
                
                if (diffDays === 1) streak++;
                else streak = 1; 
            } else {
                streak = 1;
            }

            let bonusAmount = isPremium ? 3000 : 1000; 
            if (streak > 1) bonusAmount += (streak - 1) * 100;
            if (bonusAmount > (isPremium ? 3000 : 1000)) bonusAmount = isPremium ? 3000 : 1000;

            await updateBalance(userId, bonusAmount);
            await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [todayStr, streak, String(userId)]);
            
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
                try { 
                    await vk.api.messages.send({ peer_id: targetId, message: "💀 Вы заморожены в боте. Ожидайте, когда вам выдадут наказание!", random_id: Math.floor(Math.random() * 1000000000) }); 
                } catch(e) {}
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
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());

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
                    } catch(e) {}
                }

                return await message.reply(`✅ С игрока ${await getFullName(targetId)} успешно снят мут!`, replyParams());
            }

            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы разбанить пользователя, используйте /unban @VK (или ответом на сообщение)", replyParams());
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unban' ? 'unban' : 'разбан');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());

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

                if (!removed) {
                    return await message.reply("❌ Этот игрок не находится в бан-листе (ни в ЧС, ни в бане беседы).", replyParams());
                }

                return await message.reply(`✅ ${await getFullName(message.senderId)} разбанил(-а) пользователя ${await getFullName(targetId)}.`, replyParams());
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
                
                return await message.reply(`💥 Игрок ${await getFullName(targetId)} был полностью сброшен! Дома, гаражи, машины, бонусы и уровни обнулены. Недвижимость освобождена для других.`, replyParams());
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

                return await message.reply(`🚫 ${await getFullName(targetId)} получил мут на ${muteMinutes} минут.\n📌 Причина: ${reason}`, replyParams());
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
                    await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID });
                } catch(e) {}

                return await message.reply(`${await getFullName(message.senderId)} забанил(-а) в этой беседе пользователя ${await getFullName(targetId)} по причине: "${reason}"`, replyParams());
            }

            if (cmdWord === 'настройки') {
                const enabled = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value;
                const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
                const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
                const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
                let statusText = enabled === '1' ? "🟢 Включен" : "🔴 Выключен";
                return await message.reply(`⚙️ Настройки антиспама:\n\nСтатус: ${statusText}\n\nНажмите на кнопку, чтобы изменить параметр.`, { keyboard: await getSettingsKb(enabled, limit, time, mute) });
            }

            if (cmdWord === 'убрать') {
                const targetQuery = cleanText.replace('убрать', '').trim().toLowerCase();
                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0");
                    return await message.reply(`💥 Все статы ВСЕХ игроков (монеты, дуэли, бонусы и т.д.) успешно обнулены! (Машины и бизнесы остались)`, replyParams());
                } else {
                    const { targetId } = await getTargetAndReason(message, 'убрать');
                    if (!targetId) return await message.reply("⚠️ Ответьте на сообщение игрока, укажите его @упоминание или напишите 'all'.", replyParams());

                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`💥 Все статы игрока ${await getFullName(targetId)} успешно обнулены!`, replyParams());
                }
            }

            if (cmdWord === 'kick') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы исключить пользователя из чата, используйте /kick @VK Причина (Пример: /kick @Mokhma.volk Тест)", replyParams());
                }

                const { targetId, reason } = await getTargetAndReason(message, 'kick');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете исключить самого себя.", replyParams());
                if (!message.isChat) return await message.reply("❌ Эту команду можно использовать только в беседе.", replyParams());
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) return await message.reply("❌ Этот игрок уже забанен в данной беседе.", replyParams());

                try {
                    await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply(`${await getFullName(message.senderId)} исключил(-а) из беседы пользователя ${await getFullName(targetId)} по причине: "${reason}"`, replyParams());
                } catch (e) {
                    return await message.reply(`⚠️ Указанный пользователь не является участником данной беседы, либо же имеет статус выше Вашего.`, replyParams());
                }
            }

            if (cmdWord === 'чсб') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы занести в глобальный ЧС, используйте /чсб @VK [дней] Причина (Пример: /чсб @Mokhma.volk 3 Спам)", replyParams());
                }

                const { targetId, reason } = await getTargetAndReason(message, 'чсб');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
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
                return await message.reply(`${await getFullName(message.senderId)} занес(-ла) в глобальный ЧС бота пользователя ${await getFullName(targetId)} ${days > 0 ? `на ${days} дн.` : 'навсегда'} по причине: "${finalReason}"`, replyParams());
            }

            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());

                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`${await getFullName(message.senderId)} разбанил(-а) пользователя ${await getFullName(targetId)} в глобальном ЧС бота.`, replyParams());
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

                    if (!targetId) return await message.reply("⚠️ Укажите пользователя или напишите 'all'.", replyParams());
                    
                    await updateBalance(targetId, amount);
                    return await message.reply(`💰 Владелец выдал ${formatMoney(amount)}$ игроку ${await getFullName(targetId)}!`, replyParams());
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
                    return await message.reply(`💥 Баланс игрока ${await getFullName(targetId)} и его бизнеса успешно обнулен!`, replyParams());
                }
            }

            if (cmdWord === 'cc') {
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

            if (cmdWord === 'объявление') {
                const txt = message.text.replace(/\/объявление\s*/i, '');
                if (!txt) return await message.reply("❌ Введите текст объявления.");
                try {
                    const members = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                    const users = members.profiles.map(p => p.id).filter(id => id > 0);
                    for (const uid of users) {
                        try { 
                            await vk.api.messages.send({ peer_id: uid, message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, random_id: Math.floor(Math.random() * 1000000000) }); 
                        } catch(e) {}
                    }
                    return await message.reply("✅ Объявление отправлено всем участникам в ЛС.");
                } catch (e) {
                    return await message.reply("❌ Ошибка рассылки.");
                }
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
        try { 
            await message.reply(`⚠️ Произошла ошибка при выполнении команды: ${error.message}`, { disable_mentions: 1 }); 
        } catch (e) {}
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
        const peerId = context.peerId;

        // --- ГЛАВНОЕ МЕНЮ (РАБОТА, РУЛЕТКА, ПРОФИЛЬ, ТОП) ---
        if (payload.cmd === 'main_menu') {
            await safeAnswer();
            if (payload.action === 'work') {
                return await vk.api.messages.send({ peer_id: peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), random_id: Math.floor(Math.random() * 1000000000) });
            }
            if (payload.action === 'roulette') {
                return await vk.api.messages.send({ peer_id: peerId, message: "🎰 Напишите: /рулетка [цвет] [ставка]\nПример: /рулетка красное 1000", random_id: Math.floor(Math.random() * 1000000000) });
            }
            if (payload.action === 'profile') {
                return await vk.api.messages.send({ peer_id: peerId, message: "Напишите /профиль", random_id: Math.floor(Math.random() * 1000000000) });
            }
            if (payload.action === 'top') {
                return await vk.api.messages.send({ peer_id: peerId, message: "Напишите /топ", random_id: Math.floor(Math.random() * 1000000000) });
            }
        }

        // --- ЖАЛОБЫ И РЕПОРТЫ АДМИНУ ---
        if (payload.cmd === 'admin_report') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            
            const targetId = payload.target; // Нарушитель (на кого жаловались)
            const reporterId = payload.reporter; // Автор жалобы
            const chatId = payload.chat;

            if (payload.action === 'accept') {
                // Отправляем в беседу с тегом того, кто жаловался
                const chatText = `✅ [id${reporterId}|Игрок] ваша жалоба была принята [id${ADMIN_ID}|Администратором], приятного пользования бота ✅`;
                
                try {
                    // Отправка в беседу
                    if (chatId) await vk.api.messages.send({ peer_id: chatId, message: chatText, random_id: Math.floor(Math.random() * 1000000000) });
                    
                    // Уведомление нарушителю в ЛС
                    await vk.api.messages.send({ peer_id: targetId, message: `⚠️ На вас поступила жалоба и она была принята Администратором. Просьба не нарушать правила!`, random_id: Math.floor(Math.random() * 1000000000) });
                    
                    // Уведомление автору жалобы в ЛС
                    await vk.api.messages.send({ peer_id: reporterId, message: `✅ Ваша жалоба была принята [id${ADMIN_ID}|Администратором], приятного пользования бота ✅`, random_id: Math.floor(Math.random() * 1000000000) });
                } catch(e) {}

                await vk.api.messages.edit({
                    peer_id: peerId, 
                    message: `✅ Жалоба принята. Игроку и автору жалобы отправлены уведомления.`, 
                    keyboard: "", 
                    conversation_message_id: context.conversationMessageId
                });
                return await safeAnswer({ type: 'show_snackbar', text: 'Принято' });

            } else if (payload.action === 'spam') {
                // Наказываем ТОГО, КТО ОТПРАВИЛ СПАМ-ЖАЛОБУ (reporterId)
                const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
                let warns = w ? w.count + 1 : 1;
                
                if (warns >= 3) {
                    await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Спам/Ложная жалоба (3/3)", Date.now() + 3 * 86400000]);
                    await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                    try {
                        const banKb = Keyboard.builder().inline()
                            .urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` })
                            .row().urlButton({ label: 'Правила бота', url: `https://vk.ru/topic-243089386_69454146` });
                        await vk.api.messages.send({ peer_id: reporterId, message: `😈 Вы были автоматически занесены в ЧС бота на 3 дня за спам (ложные жалобы).`, keyboard: banKb.toString(), random_id: Math.floor(Math.random()*1000000000) });
                    } catch(e){}
                } else {
                    await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                    try {
                        await vk.api.messages.send({ peer_id: reporterId, message: `⚠️ Ваша жалоба отклонена как спам. Предупреждение ${warns}/3. Просьба не дублировать сообщения!`, random_id: Math.floor(Math.random()*1000000000) });
                    } catch(e){}
                }
                
                // Отправляем в беседу, что жалоба отклонена
                if (chatId) {
                    try {
                        await vk.api.messages.send({ peer_id: chatId, message: `🚫 Жалоба от [id${reporterId}|Игрока] отклонена (Спам).`, random_id: Math.floor(Math.random() * 1000000000) });
                    } catch(e) {}
                }

                await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Жалоба отклонена как Спам. Автору выдано предупреждение.`, keyboard: "", conversation_message_id: context.conversationMessageId });
                return await safeAnswer({ type: 'show_snackbar', text: 'Спам отклонен' });
            }
        }

        // --- ОТВЕТ НА РЕПОРТ (/report) ---
        if (payload.cmd === 'report_reply') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await safeAnswer();
            adminStates.set(ADMIN_ID, `reply_${payload.target}`);
            return await vk.api.messages.send({
                peer_id: context.peerId,
                message: `✍️ Напишите текст ответа для игрока [id${payload.target}|Игрок] в ЛС прямо сейчас:`,
                random_id: Math.floor(Math.random() * 1000000000)
            });
        }

        if (payload.cmd === 'report_spam') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(payload.target)]);
            let warns = w ? w.count + 1 : 1;
            await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(payload.target), warns]);
            try {
                await vk.api.messages.send({ peer_id: payload.target, message: `⚠️ Ваш репорт был отклонен как спам. Предупреждение ${warns}/3.`, random_id: Math.floor(Math.random()*1000000000) });
            } catch(e) {}
            await safeAnswer({ type: 'show_snackbar', text: 'Отправлено предупреждение за спам' });
            return await vk.api.messages.edit({ peer_id: context.peerId, message: `🚫 Репорт отклонен. Игроку выдано предупреждение.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // --- МАГАЗИН ОДЕЖДЫ ---
        if (payload.cmd === 'shop_cat') {
            const cat = payload.cat;
            const items = {
                'hat': [ {n: 'Зеленая кепка', p: 5000, img: 'https://sun9-4.userapi.com/s/v1/ig2/17QGTX46Ix46p4FxY1Ctuvyafl1jlUQHHuDXY5NQTaiOskvVyDlW2iGEH2Dx7JO0fgWXkEqujlYz7qmUbICZlmPE.jpg?quality=95&as=32x21,48x32,72x48,108x72,160x107,240x160,360x240,480x320,510x340&from=bu&cs=510x0'} ],
                'shirt': [ {n: 'Белая футболка', p: 3000, img: 'https://sun9-4.userapi.com/s/v1/ig2/17QGTX46Ix46p4FxY1Ctuvyafl1jlUQHHuDXY5NQTaiOskvVyDlW2iGEH2Dx7JO0fgWXkEqujlYz7qmUbICZlmPE.jpg?quality=95&as=32x21,48x32,72x48,108x72,160x107,240x160,360x240,480x320,510x340&from=bu&cs=510x0'} ],
                'jeans': [ {n: 'Синие джинсы', p: 4000, img: 'https://sun9-4.userapi.com/s/v1/ig2/17QGTX46Ix46p4FxY1Ctuvyafl1jlUQHHuDXY5NQTaiOskvVyDlW2iGEH2Dx7JO0fgWXkEqujlYz7qmUbICZlmPE.jpg?quality=95&as=32x21,48x32,72x48,108x72,160x107,240x160,360x240,480x320,510x340&from=bu&cs=510x0'} ],
                'shoes': [ {n: 'Кроссовки', p: 6000, img: 'https://sun9-4.userapi.com/s/v1/ig2/17QGTX46Ix46p4FxY1Ctuvyafl1jlUQHHuDXY5NQTaiOskvVyDlW2iGEH2Dx7JO0fgWXkEqujlYz7qmUbICZlmPE.jpg?quality=95&as=32x21,48x32,72x48,108x72,160x107,240x160,360x240,480x320,510x340&from=bu&cs=510x0'} ]
            };
            const list = items[cat] || [];
            const kb = Keyboard.builder().inline();
            for (const item of list) {
                kb.callbackButton({ label: `${item.n} (${formatShortMoney(item.p)}$)`, payload: { cmd: 'shop_buy', item: item.n, price: item.p, img: item.img }, color: Keyboard.POSITIVE_COLOR });
                kb.row();
            }
            kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'shop_back' }, color: Keyboard.SECONDARY_COLOR });
            
            await safeAnswer();
            return await vk.api.messages.edit({
                peer_id: peerId, message: `🛒 Категория: ${cat}\nВыберите вещь для покупки:`, keyboard: kb.toString(), conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'shop_back') {
            await safeAnswer();
            return await vk.api.messages.edit({
                peer_id: peerId, message: "🛒 Магазин одежды. Выберите категорию:", keyboard: getShopKb(), conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'shop_buy') {
            const price = payload.price;
            const bal = await getBalance(userId);
            if (bal < price) return await safeAnswer({ type: 'show_snackbar', text: '❌ Недостаточно средств!' });
            await updateBalance(userId, -price);
            await dbRun("UPDATE users SET clothes = ? WHERE user_id = ?", [payload.img, String(userId)]);
            return await safeAnswer({ type: 'show_snackbar', text: '✅ Куплено! Фото в профиле обновлено.' });
        }

        // --- БИЗНЕС КНОПКИ ---
        if (payload.cmd === 'biz_withdraw') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это меню вызвано другим пользователем.' });
            
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас нет бизнеса' });
            
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const total = Number(biz.balance) + earned;
            
            if (total <= 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Недостаточно средств в вашем бизнесе' });
            
            await updateBalance(userId, total);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ? WHERE user_id = ?", [Date.now(), String(userId)]);
            await safeAnswer({ type: 'show_snackbar', text: `✅ Выведено ${formatMoney(total)}$!` });
            
            return await vk.api.messages.edit({
                peer_id: peerId,
                message: `🏢 Бизнес\n\n💸 На балансе: 0$\n\nВы вывели: ${formatMoney(total)}$`,
                keyboard: getBizKb(userId),
                conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'biz_upgrade') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это меню вызвано другим пользователем.' });
            
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас нет бизнеса.' });
            if (biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Максимальный уровень!' });

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

            const userBal = await getBalance(userId);
            if (userBal < nextLevelCost) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег на балансе!' });

            await safeAnswer();
            await updateBalance(userId, -nextLevelCost);
            await dbRun("UPDATE businesses SET level = level + 1, balance = ?, last_income = ? WHERE user_id = ?", [totalBalance, Date.now(), String(userId)]);
            
            const newMsgText = `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level + 1}/5\n🐱 ${formatMoney(bizData.baseIncome * (biz.level + 1) * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение уровня стоит: ${formatMoney((biz.level + 1) * 5000000)}$\n\n👉 Чтобы вывести деньги, напишите в чат /вывести`;
            
            return await vk.api.messages.edit({ 
                peer_id: peerId, message: newMsgText, keyboard: getBizKb(userId), disable_mentions: 1, conversation_message_id: context.conversationMessageId
            });
        }

        // --- РАБОТА КНОПКИ ---
        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;

            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) {
                const remaining = 3600000 - (now - lastReset);
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${m} мин. ${s} сек.` });
            }

            if (payload.type === 'Такси') {
                const userRow = await dbGet("SELECT cars FROM users WHERE user_id = ?", [String(userId)]);
                const carsArr = JSON.parse(userRow?.cars || '[]');
                if (carsArr.length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Для работы в такси нужна машина! Купите её в /машины' });
            }

            await safeAnswer();
            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);

            const earned = Math.floor(Math.random() * 6000) + 1000;
            await updateBalance(userId, earned);
            const newBal = await getBalance(userId);
            
            return await vk.api.messages.edit({ 
                peer_id: peerId, message: `✅ Вы успешно поработали (${payload.type}) и заработали ${formatMoney(earned)}$!\n\n💰 Ваш баланс: ${formatMoney(newBal)}$\n📊 Осталось попыток: ${3 - count}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'work_menu') {
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
        }

        // --- АКТИВАЦИЯ БОТА ---
        if (payload.cmd === 'activate_bot' || payload.cmd === 'decline_bot') {
            await safeAnswer();
            try {
                const members = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                const clicker = members.items.find(m => m.member_id === userId);
                const isClickerAdmin = clicker && (clicker.is_admin || clicker.is_owner);
                
                if (!isClickerAdmin && userId !== ADMIN_ID) {
                    return await vk.api.messages.edit({ peer_id: peerId, message: "❌ Только администраторы беседы могут это сделать!", keyboard: "", conversation_message_id: context.conversationMessageId });
                }

                if (payload.cmd === 'activate_bot') {
                    return await vk.api.messages.edit({ peer_id: peerId, message: "🎉 Вы подключили бота к беседе!\nЧтобы узнать подробности напишите /help", disable_mentions: 1, keyboard: "", conversation_message_id: context.conversationMessageId });
                } else {
                    return await vk.api.messages.edit({ peer_id: peerId, message: "❌ Активация отменена.", disable_mentions: 1, keyboard: "", conversation_message_id: context.conversationMessageId });
                }
            } catch (e) {
                return await vk.api.messages.edit({ peer_id: peerId, message: "❌ Ошибка при проверке прав.", keyboard: "", conversation_message_id: context.conversationMessageId });
            }
        }

        // --- ХЕЛП МЕНЮ ---
        if (payload.cmd === 'help_start') {
            await safeAnswer();
            return await vk.api.messages.edit({
                peer_id: peerId, message: "📖 Выберите раздел с командами:", keyboard: getHelpKb(), conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            let msg = "";
            if (payload.section === 'games') msg = "🎰 Игровые команды:\n/рулетка [цвет/чет] [ставка]\n/краш [автостоп] [ставка]\n/монетка [орел/решка] [ставка]\n/стакан [1-3] [ставка]\n/кубик [1-6] [ставка]\n/автомат [ставка]\n/блэкджек [ставка]\n/дрим [1-5] [ставка]\n/мины [ставка]\n/фортуна\n\n⚠️ Мин. ставка: 100$. Ставка 'вб' разрешена.";
            if (payload.section === 'eco') msg = "💼 Экономика:\n/бизнес\n/купитьбиз [название]\n/мойбизнес\n/вывести\n/бонус\n/transfer [сумма] (ответом)\n/duel [сумма]\n/promo [код]\n/промолист\n/машины\n/купить машина [название]\n/sellcar (слить машину)\n/дон дом (топ домов Т1-Т10)\n/дон гараж (топ гаражей Т1-Т10)\n/датьдолг [сумма] [дней] (ответом)";
            if (payload.section === 'profile') msg = "👤 Профиль и прочее:\n/профиль\n/топ\n/rep +/- (ответом)\n/пинг\n/premium\n/магаз вещей\n\n💡 Слэш (/) в начале писать необязательно!";
            if (payload.section === 'org') msg = "🏛️ Организации и Страны:\n/организации (Список)\n/вступить [Название]\n/страны (Список)\n/страна [Название]\n\n📩 Жалобы:\n/report [текст] (В ЛС)\n/админ (Ответом на сообщение)";
            
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                    txt += `📍 ${data.name} (${countRow.c}/20)\n└ Свободно мест: ${20 - countRow.c}\n`;
                }
                txt += `\n💡 Купить: /купить дом топ [номер] [Локация]\n💡 Продать: /продать дом [сумма] (ответом на сообщение)\n🏆 Доны: /дон дом`;
                msg = txt;
            }
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                    txt += `📍 ${data.name} (${countRow.c}/20)\n└ Свободно мест: ${20 - countRow.c}\n`;
                }
                txt += `\n💡 Купить: /купить гараж топ [номер] [Локация]\n💡 Продать: /продать гараж [сумма] (ответом на сообщение)\n🏆 Доны: /дон гараж`;
                msg = txt;
            }
            
            return await vk.api.messages.edit({ peer_id: peerId, message: msg, keyboard: getHelpBackKb(), conversation_message_id: context.conversationMessageId });
        }

        // --- НАСТРОЙКИ ---
        if (payload.cmd === 'settings_toggle') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            const newVal = payload.state; 
            await dbRun("UPDATE settings SET value = ? WHERE key = 'antispam_enabled'", [newVal]);
            await safeAnswer();
            const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
            const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
            const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
            let statusText = newVal === '1' ? "🟢 Включен" : "🔴 Выключен";
            return await vk.api.messages.edit({ peer_id: peerId, message: `⚙️ Настройки антиспама:\n\nСтатус: ${statusText}\n\nНажмите на кнопку, чтобы изменить параметр.`, keyboard: await getSettingsKb(newVal, limit, time, mute), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'settings_edit') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await safeAnswer();
            adminStates.set(userId, payload.field); 
            let fieldName = payload.field === 'limit' ? "лимит сообщений (например, 5)" : payload.field === 'time' ? "время в секундах (например, 60)" : "время мута в минутах (например, 10)";
            return await vk.api.messages.send({ peer_id: peerId, message: `✏️ Введите новое значение: ${fieldName}`, random_id: Math.floor(Math.random() * 1000000000) });
        }

        // --- ТОП ---
        if (payload.cmd === 'top_menu' || payload.cmd === 'top_back') {
            if (userId !== payload.author) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нажимайте свои кнопки!' });
            
            const type = payload.type || 'coins';
            const scope = payload.scope || 'chat';
            const repType = payload.repType || 'pos';

            let orderBy = "balance DESC", filter = "balance > 0";
            if (type === 'level') { orderBy = "level DESC, xp DESC"; }
            if (type === 'duels') { orderBy = "duel_wins DESC"; }
            if (type === 'bonus') { orderBy = "bonus_count DESC"; }
            if (type === 'rep') { orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; }

            let rows = [];
            if (scope === 'global') {
                rows = await dbAll(`SELECT user_id, balance, level, reputation FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
            } else {
                rows = await dbAll(`SELECT u.user_id, u.balance, u.level, u.reputation FROM users u JOIN chat_messages c ON u.user_id = c.user_id WHERE c.peer_id = ? AND ${filter} ORDER BY ${orderBy} LIMIT 10`, [String(context.peerId)]);
            }

            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n\n`;
            let count = 0;
            const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            for (const r of rows) {
                const name = await getFullName(r.user_id);
                let val = type === 'coins' ? `${formatShortMoney(r.balance)}$` : (type === 'level' ? `Ур.${r.level}` : r.reputation);
                title += `${emojis[count]} ${name} — ${val}\n`;
                count++;
            }
            if (rows.length === 0) title += "Пусто...";

            await safeAnswer();
            return await vk.api.messages.edit({
                peer_id: peerId, message: title, keyboard: getTopKb(payload.author, type, scope, repType), conversation_message_id: context.conversationMessageId
            });
        }

        // --- ДУЭЛЬ И СДЕЛКИ ---
        if (payload.cmd === 'duel_accept') {
            const duelId = payload.duel_id;
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [duelId]);
            
            if (row) {
                if (String(userId) === row.challenger) {
                    return await safeAnswer({ type: 'show_snackbar', text: '❌ Нельзя драться с собой!' });
                }
                if (await getBalance(userId) < row.bet) {
                    return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег!' });
                }
                
                const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
                const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
                const prize = Math.floor(row.bet * 1.8);
                
                await updateBalance(winnerId, prize);
                await updateBalance(loserId, -row.bet);
                
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [duelId]);
                
                await safeAnswer();
                return await vk.api.messages.edit({
                    peer_id: peerId,
                    message: `⚔️ Дуэль завершена!\n\n🏆 Победитель: ${await getFullName(winnerId)}\n❌ Проигравший: ${await getFullName(loserId)}\n\n💰 Выигрыш: ${prize}$`,
                    keyboard: "",
                    disable_mentions: 1,
                    conversation_message_id: context.conversationMessageId
                });
            }
        }

        if (payload.cmd === 'prop_deal_accept') {
            const dealId = payload.deal_id;
            const deal = await dbGet("SELECT * FROM prop_deals WHERE id = ?", [dealId]);
            
            if (!deal) return await safeAnswer({ type: 'show_snackbar', text: '❌ Сделка отменена или устарела.' });
            if (String(userId) !== deal.buyer_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы не являетесь покупателем.' });
            
            const buyerBal = await getBalance(userId);
            if (buyerBal < deal.price) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас недостаточно средств.' });
            
            const buyerProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(userId), deal.type]);
            if (buyerProp) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас уже есть эта недвижимость!' });

            await updateBalance(userId, -deal.price);
            await updateBalance(deal.seller_id, deal.price);
            await dbRun("UPDATE properties SET owner_id = ? WHERE id = ?", [String(userId), deal.prop_id]);
            await dbRun("DELETE FROM prop_deals WHERE id = ?", [dealId]);

            await safeAnswer({ type: 'show_snackbar', text: '✅ Успешно куплено!' });
            
            return await vk.api.messages.edit({
                peer_id: peerId,
                message: `🤝 Сделка состоялась!\nИгрок ${await getFullName(userId)} купил ${deal.type === 'house' ? 'дом' : 'гараж'} за ${formatMoney(deal.price)}$.`,
                keyboard: "",
                conversation_message_id: context.conversationMessageId
            });
        }

        // --- МИНЫ ---
        if (payload.cmd === 'mines_set') {
            const gameId = String(payload.gameId);
            const count = Number(payload.count);
            
            try {
                const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
                if (!row) {
                    return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра устарела.' });
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
                
                await safeAnswer();
                return await vk.api.messages.edit({
                    peer_id: peerId,
                    message: ui.text,
                    keyboard: ui.kb,
                    conversation_message_id: context.conversationMessageId
                });
            } catch(e) { return; }
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
                    
                    await safeAnswer();
                    return await vk.api.messages.edit({
                        peer_id: peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId
                    });
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

                await safeAnswer();
                if (isLoss) {
                    const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, hitCell, name, balance);
                    let text = ui.text;
                    if (hitCell === -1) {
                        text = `🏆 ПОБЕДА!\n────────────────────\n👤 ${name}\n💣 Мин на поле: ${mines.length}\n✅ Успел(а) открыть: ${opened.length}\n\n📈 Выигрыш: +${currentMoney} 💰 (x${(currentMoney/bet).toFixed(2)})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Поздравляем! Ты забрал всё! 🎉`;
                    }
                    return await vk.api.messages.edit({
                        peer_id: peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId
                    });
                } else {
                    const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, false, null, name, balance);
                    const timeLeft = Math.max(0, Math.floor((60000 - (Date.now() - startTime)) / 1000));
                    let text = ui.text.replace('{TIME}', timeLeft.toString());
                    
                    return await vk.api.messages.edit({
                        peer_id: peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId
                    });
                }
            } catch (e) { return; }
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
                
                await safeAnswer();
                return await vk.api.messages.edit({
                    peer_id: peerId,
                    message: `💰 ВЫВОД\n────────────────────\n👤 ${await getFullName(userId)}\n💵 Забрал: ${winAmount} 💰 (x${row.multiplier})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Отличная игра! Заходи ещё 🍀`,
                    keyboard: buildMinesKb(gameId, opened, mines, true, null),
                    conversation_message_id: context.conversationMessageId
                });
            } catch(e) { return; }
        }

        await safeAnswer();
    } catch (e) {
        console.error("КРИТИЧЕСКАЯ Ошибка в кнопках:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка. Попробуйте позже.' });
    }
});

// ===== ПРИВЕТСТВИЕ ПРИ ДОБАВЛЕНИИ =====
vk.updates.on('chat_invite_user', async (context) => {
    if (context.memberId > 0) {
        const globalBan = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
        if (globalBan) {
            if (globalBan.until !== 0 && Date.now() > globalBan.until) {
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
            } else {
                try { await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID }); } catch(e) {}
                return;
            }
        }
        const chatBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(context.memberId), String(context.peerId)]);
        if (chatBan) {
            try {
                await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID });
                await vk.api.messages.send({ peer_id: context.peerId, message: `🚫 [id${context.memberId}|Игрок] был исключен, так как имеет бан в этой беседе.\n📌 Причина: ${chatBan.reason}`, random_id: Math.floor(Math.random() * 1000000000), disable_mentions: 1 });
            } catch(e) {} 
        }
    }

    if (String(context.memberId) === String(-GROUP_ID)) {
        let isAdmin = false;
        try {
            const members = await vk.api.messages.getConversationMembers({ peer_id: context.peerId });
            const bot = members.items.find(m => m.member_id == -GROUP_ID || m.member_id == GROUP_ID);
            isAdmin = bot && bot.is_admin;
        } catch(e) {}

        let greetText = "";
        if (isAdmin) {
            greetText = "Привет! Я Официальный бот Game Zone. Я добавлен в беседу с правами администратора, поэтому все функции доступны. Напишите /start для активации и /help для списка команд.";
        } else {
            greetText = "Привет! Я Официальный бот Game Zone. Внимание: у меня нет прав администратора в этой беседе, поэтому некоторые функции (мут, кик, антиспам) не будут работать. Чтобы я работал в полную силу, выдайте мне админку. Напишите /start для активации.";
        }
        
        const actKb = Keyboard.builder().inline()
            .callbackButton({ label: 'Активировать', payload: { cmd: 'activate_bot' }, color: Keyboard.POSITIVE_COLOR })
            .callbackButton({ label: 'Не активировать', payload: { cmd: 'decline_bot' }, color: Keyboard.NEGATIVE_COLOR });
        
        try {
            await vk.api.messages.send({
                peer_id: context.peerId,
                message: greetText,
                keyboard: actKb.toString(),
                random_id: Math.floor(Math.random() * 1000000000),
                group_id: GROUP_ID,
                disable_mentions: 1
            });
        } catch (err) {}
    }
});

// ===== ЗАПУСК =====
console.log("ПОПЫТКА ЗАПУСКА БОТА...");
vk.updates.startPolling().then(() => {
    console.log("--- БОТ УСПЕШНО ЗАПУЩЕН (LONGPOLL) ---");
}).catch(err => {
    console.error("ОШИБКА ПРИ СТАРТЕ:", err);
});