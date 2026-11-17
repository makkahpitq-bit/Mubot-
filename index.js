const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const https = require('https'); // Для скачивания шрифта

console.log("=========================================");
console.log("ВЕРСИЯ NODE.JS:", process.version);
console.log("=========================================");

// ===== НАСТРОЙКИ =====
const TOKEN = process.env.TOKEN || "vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0";
const GROUP_ID = 243089386;
const ADMIN_ID = 200005093141;
const BONUS_CD = 86400; // 24 часа
const FORTUNA_CD = 600; // 10 минут

// ВАЖНО: Сюда вставь ID твоего математического чата (для авто-отправки примеров)
const MATH_CHAT_ID = 2000000001; 

const DEFAULT_PROFILE_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95';
const ROULETTE_PHOTOS = ['https://vk.ru/photo-221392393_458171207'];

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

const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const spamCache = new Map(); 
const chsbNotifyCache = new Map(); 
const activeMathGames = new Map(); 

// ===== ИГРОВЫЕ ДАННЫЕ =====
const BIZ_DATA = {
    'шаурма': { name: '🌯 Шаурма', price: 500000, baseIncome: 2000 },
    'кафе': { name: '☕ Кафе', price: 1500000, baseIncome: 4000 },
    'game zone': { name: '🕹️ Отдел Game Zone', price: 5000000, baseIncome: 6000 },
    'казино': { name: '🎰 Казино', price: 15000000, baseIncome: 10000 },
    'пятерочка': { name: '🏪 24/7 Пятёрочка', price: 50000000, baseIncome: 15000 },
    'тк': { name: '🚚 Транспортная Компания', price: 250000000, baseIncome: 50000 },
    'ск': { name: '🏗️ Строительная Компания', price: 500000000, baseIncome: 100000 },
    'азс': { name: '⛽ АЗС', price: 1000000000, baseIncome: 250000 }
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

const SKINS_DATA = {
    'кевин': { name: '👕 Скин Кевин', price: 500000 },
    'емеля': { name: '👕 Скин Емеля', price: 750000 },
    'арни': { name: '👕 Скин Арни', price: 1000000 },
    'бушидо': { name: '👕 Скин Бушидо', price: 1500000 },
    'череп': { name: '👕 Скин Череп', price: 2000000 }
};

const COUNTRIES = ['Россия', 'Чеченская республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];
const ORGS = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];

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
    
    // Слоты для бизнесов и недвижимости (Пункт 15)
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT, slot INTEGER, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0, PRIMARY KEY (user_id, slot))");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, slot INTEGER, location TEXT, tier INTEGER, owner_id TEXT)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS phones (number TEXT PRIMARY KEY, user_id TEXT UNIQUE)");

    const alterQueries = [
        "ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN reg_date TEXT",
        "ALTER TABLE users ADD COLUMN duel_wins INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN bonus_count INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN car TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN last_bonus_date TEXT",
        "ALTER TABLE users ADD COLUMN bonus_streak INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT 'Нет'",
        "ALTER TABLE users ADD COLUMN skin TEXT DEFAULT 'Нет'",
        "ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'Нет'",
        "ALTER TABLE users ADD COLUMN organization TEXT DEFAULT 'Нет'",
        "ALTER TABLE users ADD COLUMN math_wins INTEGER DEFAULT 0",
        "ALTER TABLE businesses ADD COLUMN last_withdraw INTEGER DEFAULT 0",
        "ALTER TABLE games ADD COLUMN start_time INTEGER",
        "ALTER TABLE blacklist ADD COLUMN until INTEGER DEFAULT 0"
    ];
    for (const q of alterQueries) { try { await dbRun(q); } catch(e) {} }
    
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
// ===== ПАРСЕР ЦЕЛИ (ДЛЯ АДМИН-КОМАНД) =====
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

// ===== ГЕНЕРАЦИЯ ПРОФИЛЯ (ФИКС ШРИФТА) =====
let _fontCache = null;
async function getCyrillicFont() {
    if (_fontCache) return _fontCache;
    const fontDir = path.join(DATA_DIR, 'fonts');
    if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
    const fntPath = path.join(fontDir, 'font.fnt'), pngPath = path.join(fontDir, 'font.png');
    const base = 'https://cdn.jsdelivr.net/gh/Fluffffy/jimp-cyrillic-fonts@master/fonts/open-sans-32-white/open-sans-32-white';
    const download = (url, dest) => new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
            response.pipe(file); file.on('finish', () => file.close(resolve));
        }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
    try {
        if (!fs.existsSync(fntPath) || fs.statSync(fntPath).size < 100) await download(base + '.fnt', fntPath);
        if (!fs.existsSync(pngPath) || fs.statSync(pngPath).size < 100) await download(base + '.png', pngPath);
        _fontCache = await Jimp.loadFont(fntPath);
    } catch (e) {
        console.error("Ошибка шрифта, используется стандартный:", e);
        _fontCache = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    }
    return _fontCache;
}

async function generateProfileImage(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200,photo_max_orig' });
        const nameText = `${user.first_name} ${user.last_name || ''}`.trim() || 'Игрок';
        const avatarUrl = user.photo_200 || user.photo_max_orig || DEFAULT_PROFILE_PHOTO;
        
        const canvas = new Jimp(400, 450, 0x101010FF);
        try {
            const avatar = await Jimp.read(avatarUrl);
            avatar.cover(400, 400);
            canvas.composite(avatar, 0, 0);
        } catch (e) {}
        
        canvas.composite(new Jimp(400, 50, 0x000000B0), 0, 400);
        const font = await getCyrillicFont();
        
        canvas.print(font, 0, 400, { 
            text: nameText, 
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, 
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE 
        }, 400, 50);
        
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
        console.error("Ошибка генерации фото профиля:", e);
        return null;
    }
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
            text: `💥 БАБАХ! ПОРАЖЕНИЕ\n────────────────────\n👤 ${name} наступил(а) на мину!\n💣 Мин на поле: ${minesCount}\n✅ Успел(а) открыть: ${currentOpened}\n\n📉 Потеряно: -${formatMoney(bet)} 💰\n😢 Не забрал(а): ${formatMoney(lostMoney)} 💰 (x${currentMult})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Бывает. Следующая будет твоей 🍀`,
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
            text: `💣 МИНЫ\n────────────────────\n👤 ${name}\n💵 Ставка: ${formatMoney(bet)} | 💣 Мин: ${minesCount}\n\n${progressBar} ${currentOpened}/${totalSafe}\n📈 Сейчас: x${currentMult.toFixed(2)} → ${formatMoney(currentMoney)} 💰\n🎯 Следующая: x${nextMult.toFixed(2)} → ${formatMoney(nextMoney)} 💰\n🍀 Шанс безопасной клетки: ${chance}%\n⏱ Осталось: ${timeLeft} сек.\n\n💬 ${phrase}`,
            kb: buildMinesKb(gameId, opened, minesArr, false, null, currentMoney)
        };
    }
}

function buildMinesKb(gameId, opened, mines = [], isGameOver = false, hitCell = null, currentMoney = 0) {
    const kb = Keyboard.builder().inline();
    for (let i = 1; i <= 9; i++) {
        if (isGameOver) {
            if (i === hitCell) kb.callbackButton({ label: '💥', payload: { cmd: 'none' }, color: Keyboard.NEGATIVE_COLOR });
            else if (mines.includes(i)) kb.callbackButton({ label: '💣', payload: { cmd: 'none' }, color: Keyboard.NEGATIVE_COLOR });
            else if (opened.includes(i)) kb.callbackButton({ label: '✅', payload: { cmd: 'none' }, color: Keyboard.POSITIVE_COLOR });
            else kb.callbackButton({ label: '⬜', payload: { cmd: 'none' }, color: Keyboard.SECONDARY_COLOR });
        } else {
            if (opened.includes(i)) kb.callbackButton({ label: '✅', payload: { cmd: 'none' }, color: Keyboard.POSITIVE_COLOR });
            else kb.callbackButton({ label: '❓', payload: { cmd: 'mines_click', gameId: String(gameId), cell: String(i) }, color: Keyboard.SECONDARY_COLOR });
        }
        if (i % 3 === 0 && i !== 9) kb.row();
    }
    
    if (!isGameOver && currentMoney > 0 && opened.length > 0) {
        kb.row().callbackButton({ label: `💰 Забрать ${formatMoney(currentMoney)}`, payload: { cmd: 'mines_cashout', gameId: String(gameId) }, color: Keyboard.POSITIVE_COLOR });
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
    .callbackButton({ label: '🔫 Охота', payload: { cmd: 'work_do', type: 'Охота' }, color: Keyboard.POSITIVE_COLOR }).toString();

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
    .callbackButton({ label: 'Дрим', payload: { cmd: 'casino_info', game: 'dream' }, color: Keyboard.NEGATIVE_COLOR }).toString();

const getHelpKb = () => Keyboard.builder().inline()
    .callbackButton({ label: '🎰 Игры', payload: { cmd: 'help_menu', section: 'games' }, color: Keyboard.PRIMARY_COLOR })
    .callbackButton({ label: '💼 Экономика', payload: { cmd: 'help_menu', section: 'eco' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: '🏠 Дома', payload: { cmd: 'help_menu', section: 'houses' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: '🏘️ Гаражи', payload: { cmd: 'help_menu', section: 'garages' }, color: Keyboard.SECONDARY_COLOR })
    .row()
    .callbackButton({ label: '👤 Профиль', payload: { cmd: 'help_menu', section: 'profile' }, color: Keyboard.SECONDARY_COLOR })
    .callbackButton({ label: '🌍 Страны/Орг.', payload: { cmd: 'help_menu', section: 'global' }, color: Keyboard.SECONDARY_COLOR }).toString();

const getHelpBackKb = () => Keyboard.builder().inline()
    .callbackButton({ label: '🔙 Назад', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR }).toString();

const getSettingsKb = (enabled, limit, time, mute) => {
    const kb = Keyboard.builder().inline();
    kb.callbackButton({ label: '🟢 Включить', payload: { cmd: 'settings_toggle', state: '1' }, color: enabled === '1' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🔴 Выключить', payload: { cmd: 'settings_toggle', state: '0' }, color: enabled === '0' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: `Лимит: ${limit}`, payload: { cmd: 'settings_edit', field: 'limit' }, color: Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: `Время (сек): ${time}`, payload: { cmd: 'settings_edit', field: 'time' }, color: Keyboard.SECONDARY_COLOR });
    kb.row().callbackButton({ label: `Мут (мин): ${mute}`, payload: { cmd: 'settings_edit', field: 'mute' }, color: Keyboard.SECONDARY_COLOR });
    return kb.toString();
};

const getDuelKb = (duelId) => Keyboard.builder().inline().callbackButton({ label: '⚔️ Сразиться', payload: { cmd: 'duel_accept', duel_id: duelId }, color: Keyboard.POSITIVE_COLOR }).toString();

const getMinesCountKb = (gameId) => {
    const kb = Keyboard.builder().inline();
    for (let i = 2; i <= 8; i++) {
        kb.callbackButton({ label: `${i} 💣`, payload: { cmd: 'mines_set', gameId: String(gameId), count: String(i) }, color: Keyboard.SECONDARY_COLOR });
        if ((i - 1) % 4 === 0 && i !== 8) kb.row();
    }
    return kb.toString();
};

// НОВЫЙ ТОП (С кнопками как на скриншоте)
const getTopKb = (authorId, type = 'coins', scope = 'chat', repType = 'pos') => {
    const kb = Keyboard.builder().inline();
    kb.callbackButton({ label: '💰 Монеты', payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Уровень', payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Репутация', payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '⚔️ Дуэли', payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🎁 Бонус', payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '🧮 Примеры', payload: { cmd: 'top_menu', type: 'math', scope, repType, author: authorId }, color: type === 'math' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    if (type === 'rep') {
        kb.callbackButton({ label: '➕ Положит.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.callbackButton({ label: '➖ Отрицат.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.row();
    }

    kb.callbackButton({ label: '🌍 Общее', payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 В беседе', payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.NEGATIVE_COLOR });
    return kb.toString();
};

const getBizKb = (authorId) => Keyboard.builder().inline().callbackButton({ label: 'Повысить уровень', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR }).toString();

async function getRouletteAttachment() {
    if (ROULETTE_PHOTOS.length === 0) return null;
    const url = ROULETTE_PHOTOS[Math.floor(Math.random() * ROULETTE_PHOTOS.length)];
    try {
        const uploaded = await vk.upload.messagePhoto({ source: { value: url } });
        return uploaded.toString();
    } catch (e) {
        console.error("Ошибка загрузки фото для рулетки:", e);
        return null;
    }
            }
// ===== ВХОД В БЕСЕДУ (ПРОВЕРКА БАНОВ) =====
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
                    message: `🚫 [id${context.memberId}|Игрок] исключен, так как имеет бан в этой беседе.\n📌 Причина: ${chatBan.reason}`,
                    random_id: Math.floor(Math.random() * 1000000000),
                    disable_mentions: 1
                });
            } catch(e) {} 
        }
    }
    // Кнопку активации убрали, бот просто работает молча
});

// ===== ТАЙМЕР МАТЕМАТИКИ (КАЖДЫЕ 15 МИНУТ) =====
setInterval(async () => {
    try {
        if (!MATH_CHAT_ID || MATH_CHAT_ID === 2000000001) return; // Проверка, что ID заменен
        
        const a = Math.floor(Math.random() * 50) + 10;
        const b = Math.floor(Math.random() * 50) + 10;
        const typeRand = Math.random();
        let answer, exampleText, reward, diffText;
        
        if (typeRand < 0.33) { // Легкий (+/-)
            const isPlus = Math.random() > 0.5;
            answer = isPlus ? a + b : Math.abs(a - b);
            exampleText = `${a} ${isPlus ? '+' : '-'} ${b} = ?`;
            reward = 30000; 
            diffText = '📗 Легкий';
        } else if (typeRand < 0.66) { // Средний (/)
            const divisibleA = a * b;
            answer = divisibleA / b;
            exampleText = `${divisibleA} / ${b} = ?`;
            reward = 35000; 
            diffText = '📙 Средний';
        } else { // Сложный (*)
            answer = a * b;
            exampleText = `${a} * ${b} = ?`;
            reward = 50000; 
            diffText = '📕 Сложный';
        }

        activeMathGames.set(String(MATH_CHAT_ID), { answer, reward });
        
        await vk.api.messages.send({
            peer_id: MATH_CHAT_ID,
            message: `${diffText} пример!\n⏳ ${exampleText}\n🎁 Награда: ${formatMoney(reward)} монет\n\n➡️ Первый, кто правильно ответит, получает приз!`,
            random_id: Math.floor(Math.random() * 1000000000),
            disable_mentions: 1
        });
    } catch (e) { 
        console.error('Ошибка в таймере математики:', e); 
    }
}, 15 * 60 * 1000);

// ===== ОБРАБОТКА СООБЩЕНИЙ =====
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox || message.senderId < 0) return;

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
                    // Бот игнорирует сообщения и раз в минуту пишет о блокировке
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
                        await vk.api.messages.delete({ peer_id: peerId, cmids: [message.conversationMessageId], delete_for_all: 1 });
                    } catch (e) {
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e2) {}
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
                let spamData = spamCache.get(cacheKey) || { count: 0, lastReset: now, isMuted: false, muteEndTime: 0 };

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
                        await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: userId, action: 'ro', for: muteMin * 60 });
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

        // --- ВВОД ЗНАЧЕНИЙ ОТ АДМИНА (НАСТРОЙКИ И РЕПОРТЫ) ---
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            
            // Если админ отвечает на репорт
            if (state.action === 'reply_report') {
                adminStates.delete(userId);
                if (cleanText === 'отмена') return await message.reply("❌ Ответ отменен.");
                
                try {
                    await vk.api.messages.send({
                        peer_id: state.peer,
                        message: `👨‍💼 Ответ от администратора:\n${message.text}`,
                        random_id: Math.floor(Math.random() * 1000000000)
                    });
                    return await message.reply("✅ Ответ отправлен игроку.");
                } catch(e) { 
                    return await message.reply("❌ Не удалось отправить ответ (возможно, игрок закрыл ЛС)."); 
                }
            }

            // Если админ вводит число для настроек
            const val = parseFloat(cleanText);
            if (!isNaN(val) && val > 0) {
                await dbRun("UPDATE settings SET value = ? WHERE key = ?", [String(val), state]);
                adminStates.delete(userId);
                
                const enabled = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value;
                const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
                const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
                const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
                let statusText = enabled === '1' ? "🟢 Включен" : "🔴 Выключен";

                return await message.reply(`✅ Настройки сохранены!\n\n⚙️ Настройки антиспама:\nСтатус: ${statusText}`, { keyboard: await getSettingsKb(enabled, limit, time, mute) });
            } else {
                return await message.reply("❌ Введите корректное число больше 0 (или 'отмена').");
            }
        }

        // --- ПРОВЕРКА ОТВЕТА НА МАТЕМАТИКУ ---
        if (activeMathGames.has(String(peerId)) && !text.startsWith('/')) {
            const game = activeMathGames.get(String(peerId));
            const userAnswer = parseInt(text);
            
            if (!isNaN(userAnswer) && userAnswer === game.answer) {
                activeMathGames.delete(String(peerId)); 
                await updateBalance(userId, game.reward);
                await dbRun("UPDATE users SET math_wins = math_wins + 1 WHERE user_id = ?", [String(userId)]);
                return await message.reply({ 
                    message: `🎁 [id${userId}|Игрок] ответил правильно и получает ${formatMoney(game.reward)} монет!`, 
                    disable_mentions: 1 
                });
            }
        }

        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cp', 'ping', 'пинг', 'убрать', 'настройки', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'sellhome', 'restart', 'рестарт', 'chatid', 'report', 'gban', 'магазин', 'список', 'вступить', 'страны', 'страна'];
        
        if (!text.startsWith('/') && !validCmds.includes(cmdWord)) {
            return; 
        }

        // --- УРОВНИ И РЕГИСТРАЦИЯ ---
        let userRow = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(userId)]);
        if (!userRow) {
            const today = new Date().toLocaleDateString('ru-RU');
            await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), today]);
            userRow = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(userId)]);
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
            userRow.xp = newXp;
            userRow.level = newLvl;
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

        // ===== КОМАНДЫ =====
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

        if (cmdWord === 'help' || cmdWord === 'помощь' || cmdWord === 'команды') {
            return await message.reply("📖 Выберите раздел с командами:", replyParams(getHelpKb()));
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

        // --- ПРОФИЛЬ ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houses = await dbAll("SELECT slot, location, tier FROM properties WHERE owner_id = ? AND type = 'house'", [String(userId)]);
            const garages = await dbAll("SELECT slot, location, tier FROM properties WHERE owner_id = ? AND type = 'garage'", [String(userId)]);
            const bizList = await dbAll("SELECT slot, biz_name, level FROM businesses WHERE user_id = ?", [String(userId)]);
            
            const houseStr = houses.length > 0 ? houses.map(h => `[${h.slot}] ${h.location} (Т${h.tier})`).join('\n') : "Нет";
            const garageStr = garages.length > 0 ? garages.map(g => `[${g.slot}] ${g.location} (Т${g.tier})`).join('\n') : "Нет";
            const bizStr = bizList.length > 0 ? bizList.map(b => `[${b.slot}] ${b.biz_name} (Ур.${b.level})`).join('\n') : "Нет";

            const profText = `🏠 Профиль ${await getFullName(userId)}\n\n` +
                             `💵 Баланс: ${formatMoney(balance)}$\n` +
                             `⭐ Репутация: ${rep}\n` +
                             `📊 Уровень: ${userRow.level || 1} (${userRow.xp || 0}/${(userRow.level || 1) * 500} XP)\n` +
                             `📱 Телефон: ${userRow.phone || 'Нет'}\n` +
                             `👕 Одежда: ${userRow.skin || 'Нет'}\n` +
                             `🌍 Страна: ${userRow.country || 'Нет'}\n` +
                             `👮 Организация: ${userRow.organization || 'Нет'}\n\n` +
                             `🏢 Бизнесы:\n${bizStr}\n\n` +
                             `🏠 Дома:\n${houseStr}\n\n` +
                             `🏘️ Гаражи:\n${garageStr}\n\n` +
                             `🚗 Машина: ${userRow.car || 'Нет'}\n` +
                             `📅 Регистрация: ${userRow.reg_date || 'Неизвестно'}\n` +
                             `🆔 ID: ${userId}`;

            let attachment = null;
            try {
                const photoBuffer = await generateProfileImage(userId);
                if (photoBuffer) { 
                    const uploaded = await vk.upload.messagePhoto({ source: { value: photoBuffer } }); 
                    attachment = uploaded.toString(); 
                }
            } catch(e) {}

            return await message.reply({ message: profText, attachment: attachment || undefined, disable_mentions: 1 });
        }

        // --- НОВЫЕ КОМАНДЫ: ЧАТИД И РЕПОРТ ---
        if (cmdWord === 'chatid') {
            return await message.reply(`🆔 ID этого чата: ${peerId}`, replyParams());
        }

        if (cmdWord === 'report') {
            if (parts.length < 2) return await message.reply("❌ Формат: /report текст", replyParams());
            const reportText = cleanText.replace('report', '').trim();
            try {
                const reportKb = Keyboard.builder().inline()
                    .callbackButton({ label: '🚫 Спам', payload: { cmd: 'report_spam', uid: String(userId), pid: String(peerId) }, color: Keyboard.NEGATIVE_COLOR })
                    .callbackButton({ label: '✉️ Ответить', payload: { cmd: 'report_reply', uid: String(userId), pid: String(peerId) }, color: Keyboard.PRIMARY_COLOR });
                await vk.api.messages.send({
                    peer_id: ADMIN_ID,
                    message: `🚨 РЕПОРТ от ${await getFullName(userId)} (Чат: ${peerId}):\n\n${reportText}`,
                    keyboard: reportKb.toString(),
                    random_id: Math.floor(Math.random() * 1000000000)
                });
                return await message.reply("✅ Жалоба отправлена администратору.", replyParams());
            } catch(e) { return await message.reply("❌ Ошибка отправки.", replyParams()); }
                                           }
     // ===== СИМ-КАРТА =====
if (cmdWord === 'купить' && parts[1] === 'сим' && parts[2] === 'карту') {
    const phoneNumber = parts[3];
    if (!phoneNumber || !/^\d{4}$/.test(phoneNumber)) {
        return await message.reply('❌ Введите ровно 4 цифры. Пример: /купить сим карту 7766', replyParams());
    }
    const user = await dbGet("SELECT phone FROM users WHERE user_id = ?", [String(userId)]);
    if (user && user.phone && user.phone !== 'Нет') {
        return await message.reply('❌ Вы уже купили сим-карту. Можно купить только один слот.', replyParams());
    }
    const existing = await dbGet("SELECT user_id FROM phones WHERE number = ?", [phoneNumber]);
    if (existing) {
        return await message.reply('❌ Этот номер уже занят другим пользователем.', replyParams());
    }
    await dbRun("INSERT INTO phones (number, user_id) VALUES (?, ?)", [phoneNumber, String(userId)]);
    await dbRun("UPDATE users SET phone = ? WHERE user_id = ?", [phoneNumber, String(userId)]);
    return await message.reply(`✅ Вы успешно купили сим-карту с номером ${phoneNumber}! Теперь он отображается в вашем профиле.`, replyParams());
}

// ===== МАШИНЫ =====
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
    args.shift(); args.shift(); 
    const query = args.join(' ').toLowerCase().trim();
    if (!query) return await message.reply("❌ Укажите название машины. Пример: /купить машина м5 ф90");

    let selectedCar = null;
    for (const [key, data] of Object.entries(CARS_DATA)) {
        if (key.includes(query) || data.name.toLowerCase().includes(query)) { selectedCar = data; break; }
    }
    if (!selectedCar) return await message.reply("❌ Такой машины нет в автосалоне. Список: /машины");

    const userCarRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
    if (userCarRow && userCarRow.car) return await message.reply(`❌ У вас уже есть машина (${userCarRow.car}).`);
    if (balance < selectedCar.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedCar.price)}$, у вас ${formatMoney(balance)}.`);

    await updateBalance(userId, -selectedCar.price);
    await dbRun("UPDATE users SET car = ? WHERE user_id = ?", [selectedCar.name, String(userId)]);
    return await message.reply(`🎉 Поздравляем! Вы успешно купили ${selectedCar.name} за ${formatMoney(selectedCar.price)}$.`, replyParams());
}

if (cmdWord === 'sellcar' || cmdWord === 'слить') {
    const userCarRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
    if (!userCarRow || !userCarRow.car) return await message.reply("❌ У вас нет машины, чтобы её слить.", replyParams());

    let carData = null;
    for (const [key, data] of Object.entries(CARS_DATA)) {
        if (data.name === userCarRow.car) { carData = data; break; }
    }
    if (!carData) {
        await dbRun("UPDATE users SET car = NULL WHERE user_id = ?", [String(userId)]);
        return await message.reply("❌ Ошибка: машина не найдена в базе. Удалена из гаража.", replyParams());
    }
    const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
    await updateBalance(userId, sellPrice);
    await dbRun("UPDATE users SET car = NULL WHERE user_id = ?", [String(userId)]);
    return await message.reply(`🚗 Вы слили ${carData.name} государству!\n💰 Получено: +${formatMoney(sellPrice)}$\n💳 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
}

// ===== НЕДВИЖИМОСТЬ (СЛОТЫ) =====
if (cmdWord === 'дома' || cmdWord === 'гаражи') {
    const type = cmdWord === 'дома' ? 'house' : 'garage';
    const typeName = type === 'house' ? '🏠 ДОМА' : '🏘️ ГАРАЖИ';
    let txt = `${typeName}\n────────────────────\n`;

    for (const [key, data] of Object.entries(PROPERTY_DATA)) {
        const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [data.name, type]);
        const count = countRow ? countRow.c : 0;
        txt += `📍 ${data.name} (${count}/20)\n`;
        if (count < 20) txt += `└ Свободных мест: ${20 - count}\n`;
        else txt += `└ ❌ Мест нет (Все раскуплено)\n`;
    }
    txt += `\n💡 Купить: /купить ${type === 'house' ? 'дом' : 'гараж'} топ [номер] [Локация]`;
    return await message.reply(txt, replyParams());
}

if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
    const isHouse = parts[1] === 'дом';
    const type = isHouse ? 'house' : 'garage';
    const typeName = isHouse ? 'дом' : 'гараж';

    // Проверка слотов (максимум 2)
    const userProps = await dbAll("SELECT slot FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
    if (userProps.length >= 2) {
        return await message.reply(`❌ У вас уже есть 2 ${typeName}(а)! Больше нельзя.`);
    }
    let targetSlot = userProps.length === 0 ? 1 : (userProps[0].slot === 1 ? 2 : 1);

    let rest = cleanText.replace('купить дом', '').replace('купить гараж', '').trim();
    const tierMatch = rest.match(/топ\s*(\d+)/i);
    if (!tierMatch) return await message.reply(`❌ Укажите топ (1-20). Пример: /купить ${typeName} топ 1 нижегородская`);
    
    const tier = parseInt(tierMatch[1]);
    if (tier < 1 || tier > 20) return await message.reply("❌ Топ должен быть от 1 до 20.");

    const locQuery = rest.replace(tierMatch[0], '').trim();
    let locData = null, locName = null;
    for (const [key, data] of Object.entries(PROPERTY_DATA)) {
        if (key.includes(locQuery) || data.name.toLowerCase().includes(locQuery)) {
            locData = data; locName = data.name; break;
        }
    }
    if (!locData) return await message.reply(`❌ Укажите локацию. Пример: /купить ${typeName} топ ${tier} нижегородская`);

    const isOccupied = await dbGet("SELECT id FROM properties WHERE location = ? AND type = ? AND tier = ?", [locName, type, tier]);
    if (isOccupied) return await message.reply(`❌ ${isHouse ? 'Дом' : 'Гараж'} Т${tier} в ${locName} уже занят!`);

    const basePrice = isHouse ? locData.housePrice : locData.garagePrice;
    const price = basePrice * tier;
    if (balance < price) return await message.reply(`❌ Не хватает! Нужно ${formatMoney(price)}$, у вас ${formatMoney(balance)}.`);

    await updateBalance(userId, -price);
    await dbRun("INSERT INTO properties (type, slot, location, tier, owner_id) VALUES (?, ?, ?, ?, ?)", [type, targetSlot, locName, tier, String(userId)]);
    return await message.reply(`🎉 Вы купили ${typeName} в ${locName} (Тир Т${tier}) за ${formatMoney(price)}$!\n📦 Он сохранен в слот ${targetSlot}.`, replyParams());
}

if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
    const isHouse = parts[1] === 'дом';
    const type = isHouse ? 'house' : 'garage';
    const typeName = isHouse ? 'дом' : 'гараж';

    if (!message.hasReplyMessage) return await message.reply(`❌ Чтобы продать ${typeName}, ответьте на сообщение покупателя. Формат: /продать ${typeName} [сумма]`);
    
    const amountStr = cleanText.replace('продать дом', '').replace('продать гараж', '').trim();
    const price = parseAmount(amountStr);
    const targetId = message.replyMessage.senderId;

    if (isNaN(price) || price < 1) return await message.reply("❌ Укажите корректную сумму.");
    if (targetId === userId) return await message.reply("❌ Нельзя продать самому себе.");

    // Продаем первый слот
    const myProp = await dbGet("SELECT id, slot, location, tier FROM properties WHERE owner_id = ? AND type = ? LIMIT 1", [String(userId), type]);
    if (!myProp) return await message.reply(`❌ У вас нет ${typeName}.`);

    const buyerProps = await dbAll("SELECT slot FROM properties WHERE owner_id = ? AND type = ?", [String(targetId), type]);
    if (buyerProps.length >= 2) return await message.reply(`❌ У покупателя уже 2 ${typeName}(а), он не может купить еще.`);

    const dealId = Math.floor(Math.random() * 90000) + 10000;
    await dbRun("INSERT INTO prop_deals (id, seller_id, buyer_id, type, prop_id, price, peer_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [dealId, String(userId), String(targetId), type, myProp.id, price, String(peerId)]);

    const dealKb = Keyboard.builder().inline().callbackButton({
        label: `✅ Принять (${formatShortMoney(price)}$)`,
        payload: { cmd: 'prop_deal_accept', deal_id: String(dealId) },
        color: Keyboard.POSITIVE_COLOR
    }).toString();

    return await message.reply(`🤝 Заявка на покупку!\n👤 Продавец: ${await getFullName(userId)}\n📦 ${typeName} в ${myProp.location} (Т${myProp.tier})\n💰 ${formatMoney(price)}$\n\n👉 ${await getFullName(targetId)}, нажмите кнопку.`, replyParams(dealKb));
}

// ===== БИЗНЕСЫ (СЛОТЫ) =====
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

    // Проверка слотов (макс 2)
    const userBiz = await dbAll("SELECT slot FROM businesses WHERE user_id = ?", [String(userId)]);
    if (userBiz.length >= 2) return await message.reply("❌ У вас уже 2 бизнеса! Больше нельзя. Закройте один (/закрыть бизнес [слот]).");
    let targetSlot = userBiz.length === 0 ? 1 : (userBiz[0].slot === 1 ? 2 : 1);

    let selectedBiz = null;
    for (const [key, data] of Object.entries(BIZ_DATA)) {
        if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { selectedBiz = data; break; }
    }
    if (!selectedBiz) return await message.reply("❌ Такого бизнеса нет. Список: /бизнес");
    if (balance < selectedBiz.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedBiz.price)}$`);

    await updateBalance(userId, -selectedBiz.price);
    await dbRun("INSERT INTO businesses (user_id, slot, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, ?, 1, 0, ?, 0)", [String(userId), targetSlot, selectedBiz.name, Date.now()]);
    return await message.reply(`🎉 Вы купили ${selectedBiz.name} за ${formatMoney(selectedBiz.price)}$.\n📦 Сохранено в слот ${targetSlot}. Пишите /мойбизнес ${targetSlot} для управления.`, replyParams());
}

if (cmdWord === 'мойбизнес') {
    const slot = parseInt(parts[1]) || 1; // По умолчанию 1 слот
    const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
    if (!biz) return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);

    const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
    const timePassed = Date.now() - biz.last_income;
    const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
    const totalBalance = Number(biz.balance) + earned;
    const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

    const msgText = `🏢 Бизнес ${await getFullName(userId)} [Слот ${slot}]\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение: ${formatMoney(nextLevelCost)}$\n\n👉 Чтобы вывести: /вывести ${slot}`;
    return await message.reply(msgText, replyParams(getBizKb(userId)));
}

if (cmdWord === 'вывести') {
    const slot = parseInt(parts[1]) || 1;
    const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
    if (!biz) return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);

    const now = Date.now();
    const lastWithdraw = Number(biz.last_withdraw) || 0;
    const cd = 2 * 60 * 60 * 1000; 

    if (now - lastWithdraw < cd) {
        const remaining = cd - (now - lastWithdraw);
        return await message.reply(`⏳ Выводить можно раз в 2 часа. Ждите ${Math.floor(remaining / 3600000)} ч. ${Math.floor((remaining % 3600000) / 60000)} мин.`, replyParams());
    }

    const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
    const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
    const totalBalance = Number(biz.balance) + earned;

    if (totalBalance <= 0) return await message.reply("❌ На балансе бизнеса нет денег.", replyParams());

    await updateBalance(userId, totalBalance);
    await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ? AND slot = ?", [now, now, String(userId), slot]);
    return await message.reply(`💸 Вы вывели ${formatMoney(totalBalance)}$ с бизнеса (Слот ${slot})!`, replyParams());
}

if (cmdWord === 'закрыть' && parts[1] === 'бизнес') {
    const slot = parseInt(parts[2]) || 1;
    const biz = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
    if (!biz) return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);
    
    await dbRun("DELETE FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
    await updateBalance(userId, 10000000);
    return await message.reply(`💀 Вы закрыли бизнес (Слот ${slot}) и получили компенсацию 10,000,000$.`, replyParams());
}

// ===== СКИНЫ / СТРАНЫ / ОРГАНИЗАЦИИ =====
if (cmdWord === 'магазин' && parts[1] === 'скины') {
    let txt = "👕 Доступные скины:\n\n";
    for (const [key, data] of Object.entries(SKINS_DATA)) txt += `${data.name} — ${formatMoney(data.price)}$\n`;
    return await message.reply(txt + "\n🛒 Купить: /купить скин [название]", replyParams());
}

if (cmdWord === 'купить' && parts[1] === 'скин') {
    const skinQuery = parts.slice(2).join(' ').toLowerCase().trim();
    if (!skinQuery) return await message.reply("❌ Укажите название скина. /магазин скины");
    let selectedSkin = null;
    for (const [key, data] of Object.entries(SKINS_DATA)) {
        if (key.includes(skinQuery) || data.name.toLowerCase().includes(skinQuery)) { selectedSkin = data; break; }
    }
    if (!selectedSkin) return await message.reply("❌ Такого скина нет.");
    if (balance < selectedSkin.price) return await message.reply(`❌ Не хватает! Нужно ${formatMoney(selectedSkin.price)}$.`);
    
    await updateBalance(userId, -selectedSkin.price);
    await dbRun("UPDATE users SET skin = ? WHERE user_id = ?", [selectedSkin.name, String(userId)]);
    return await message.reply(`🎉 Вы купили ${selectedSkin.name}!`, replyParams());
}

if (cmdWord === 'список' && parts[1] === 'организаций') {
    let txt = "👮 Организации:\n\n";
    for (const org of ORGS) {
        const countRow = await dbGet("SELECT COUNT(*) as c FROM users WHERE organization = ?", [org]);
        txt += `${org} — ${countRow.c}/1 место\n`;
    }
    return await message.reply(txt + "\n💡 Вступить: /вступить в организацию [Название]", replyParams());
}

if (cmdWord === 'вступить' && parts[1] === 'в' && parts[2] === 'организацию') {
    const orgQuery = parts.slice(3).join(' ').trim();
    const orgName = ORGS.find(o => o.toLowerCase() === orgQuery.toLowerCase());
    if (!orgName) return await message.reply("❌ Такой организации нет. /список организаций");
    
    const uInfo = await dbGet("SELECT organization FROM users WHERE user_id = ?", [String(userId)]);
    if (uInfo && uInfo.organization !== 'Нет') return await message.reply("❌ Вы уже состоите в организации!");
    
    const countRow = await dbGet("SELECT COUNT(*) as c FROM users WHERE organization = ?", [orgName]);
    if (countRow.c >= 1) return await message.reply("❌ В этой организации нет свободных мест!");
    
    await dbRun("UPDATE users SET organization = ? WHERE user_id = ?", [orgName, String(userId)]);
    return await message.reply(`🎉 Вы вступили в ${orgName}!`, replyParams());
}

if (cmdWord === 'страны') {
    let txt = "🌍 Доступные страны:\n\n" + COUNTRIES.join(', ');
    return await message.reply(txt + "\n\n💡 Вступить: /страна [Название]", replyParams());
}

if (cmdWord === 'страна') {
    const countryQuery = parts.slice(1).join(' ').trim();
    const countryName = COUNTRIES.find(c => c.toLowerCase() === countryQuery.toLowerCase());
    if (!countryName) return await message.reply("❌ Такой страны нет. /страны");
    
    const uInfo = await dbGet("SELECT country FROM users WHERE user_id = ?", [String(userId)]);
    if (uInfo && uInfo.country !== 'Нет') return await message.reply("❌ Вы уже выбрали страну!");
    
    await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [countryName, String(userId)]);
    return await message.reply(`🎉 Вы вступили в ${countryName}!`, replyParams());
}

// ===== РЕПУТАЦИЯ =====
if (cmdWord === 'rep' || cmdWord === 'реп') {
    if (parts[1] !== '+' && parts[1] !== '-') return await message.reply("🔔 /rep + или /rep - (ответом или @). 3 раза в сутки.", replyParams());
    const isPlus = parts[1] === '+';
    let targetId = null;
    
    if (message.hasReplyMessage) targetId = message.replyMessage.senderId;
    else {
        const ts = text.replace('/rep +','').replace('/rep -','').replace('rep +','').replace('rep -','').trim();
        const m = ts.match(/@([a-zA-Z0-9._]+)/) || ts.match(/\[id(\d+)\|/);
        if (m) {
            if (m[1].match(/^\d+$/)) targetId = parseInt(m[1]);
            else { try { const r = await vk.api.utils.resolveScreenName({ screen_name: m[1] }); if (r.type === 'user') targetId = r.object_id; } catch(e) {} }
        }
    }
    if (!targetId) return await message.reply("⚠️ Укажите пользователя.", replyParams());
    if (targetId === userId) return await message.reply("❌ Себе нельзя!", replyParams());
    
    const now = Date.now();
    const rr = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id = ?", [String(userId)]);
    let rc = rr ? Number(rr.count) : 0, rst = rr ? Number(rr.last_reset) : 0;
    if (now - rst >= 86400000) { rc = 0; rst = now; }
    if (rc >= 3) return await message.reply(`⏳ Лимит 3/сутки. Ждите ${Math.floor((86400000-(now-rst))/3600000)}ч.`, replyParams());
    
    await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), rc+1, rst]);
    await updateReputation(targetId, isPlus ? 1 : -1);
    return await message.reply(`⭐ ${await getFullName(userId)} ${isPlus ? 'повысил' : 'понизил'} репутацию ${await getFullName(targetId)} (Теперь: ${await getReputation(targetId)}). Осталось: ${3-(rc+1)}/3`, replyParams());
}

if (cmdWord === 'работа') {
    return await message.reply("💼 Выберите работу:", replyParams(getWorkKb()));
}
     // --- КУЛДАУН НА ИГРЫ ---
const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
if (gameCmds.some(cmd => cmdWord === cmd)) {
    const lastPlayed = gameCooldowns.get(userId) || 0;
    if (Date.now() - lastPlayed < 10000) {
        const left = Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000);
        return await message.reply(`⏳ Подождите ${left} сек. перед началом новой игры.`, replyParams());
    }
    gameCooldowns.set(userId, Date.now());
}

// --- КРАШ ---
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

// --- МОНЕТКА (Лимит 4ккк) ---
if (cmdWord === 'монетка') {
    if (parts.length >= 3) {
        let side = "", betStr = "";
        if (['орел', 'решка'].includes(parts[1])) { side = parts[1]; betStr = parts[2]; }
        else if (['орел', 'решка'].includes(parts[2])) { side = parts[2]; betStr = parts[1]; }
        else return await message.reply("❌ Выберите 'орел' или 'решка'", replyParams());

        let bet = parseAmount(betStr);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > 4000000000) return await message.reply("❌ Максимальная ставка 4ккк!", replyParams());
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
    return await message.reply("❌ монетка [орел/решка] [ставка]", replyParams());
}

// --- СТАКАН ---
if (cmdWord === 'стакан') {
    if (parts.length >= 3) {
        let cup = 0, betStr = "";
        const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
        if (p1 >= 1 && p1 <= 3) { cup = p1; betStr = parts[2]; }
        else if (p2 >= 1 && p2 <= 3) { cup = p2; betStr = parts[1]; }
        else return await message.reply("❌ Выберите стакан от 1 до 3", replyParams());
        
        let bet = parseAmount(betStr);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
        
        await updateBalance(userId, -bet);
        const res = Math.floor(Math.random() * 3) + 1;
        if (res === cup) {
            await updateBalance(userId, bet * 3);
            return await message.reply(`🥤 Шарик под стаканом ${res}\n\n✅ Выигрыш: ${formatMoney(bet * 3)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        } else {
            return await message.reply(`🥤 Шарик под стаканом ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }
    }
    return await message.reply("❌ стакан [1-3] [ставка]", replyParams());
}

// --- КУБИК ---
if (cmdWord === 'кубик') {
    if (parts.length >= 3) {
        let guess = 0, betStr = "";
        const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
        if (p1 >= 1 && p1 <= 6) { guess = p1; betStr = parts[2]; }
        else if (p2 >= 1 && p2 <= 6) { guess = p2; betStr = parts[1]; }
        else return await message.reply("❌ Выберите число от 1 до 6", replyParams());
        
        let bet = parseAmount(betStr);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
        
        await updateBalance(userId, -bet);
        const res = Math.floor(Math.random() * 6) + 1;
        if (res === guess) {
            await updateBalance(userId, bet * 6);
            return await message.reply(`🎲 Выпало: ${res}\n\n✅ Выигрыш: ${formatMoney(bet * 6)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        } else {
            return await message.reply(`🎲 Выпало: ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }
    }
    return await message.reply("❌ кубик [1-6] [ставка]", replyParams());
}

// --- АВТОМАТ (Лимит 15ккк) ---
if (cmdWord === 'автомат') {
    if (parts.length >= 2) {
        let bet = parseAmount(parts[1]);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > 15000000000) return await message.reply("❌ Максимальная ставка 15ккк!", replyParams());
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
            return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n\n✅ Выигрыш: ${formatMoney(win)}$!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        } else {
            return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n\n❌ Проигрыш: ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }
    }
    return await message.reply("❌ автомат [ставка]", replyParams());
}

// --- БЛЭКДЖЕК ---
if (cmdWord === 'блэкджек') {
    if (parts.length >= 2) {
        let bet = parseAmount(parts[1]);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
        
        await updateBalance(userId, -bet);
        const playerScore = Math.floor(Math.random() * 10) + 12; 
        const dealerScore = Math.floor(Math.random() * 10) + 12; 
        
        let msgText = `🃏 Блэкджек\n\n👤 Твои очки: ${playerScore}\n🤵 Очки дилера: ${dealerScore}\n\n`;
        if (playerScore > 21) msgText += `❌ Перебор! Проигрыш ${formatMoney(bet)}$`;
        else if (dealerScore > 21) { await updateBalance(userId, bet * 2); msgText += `✅ Дилер перебрал! Выигрыш ${formatMoney(bet * 2)}$`; }
        else if (playerScore > dealerScore) { await updateBalance(userId, bet * 2); msgText += `✅ Вы выиграли ${formatMoney(bet * 2)}$!`; }
        else if (playerScore === dealerScore) { await updateBalance(userId, bet); msgText += `🤝 Ничья. Возврат.`; }
        else msgText += `❌ Дилер выиграл! Проигрыш ${formatMoney(bet)}$`;
        
        return await message.reply(msgText + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
    }
    return await message.reply("❌ блэкджек [ставка]", replyParams());
}

// --- ДРИМ ---
if (cmdWord === 'дрим') {
    if (parts.length >= 3) {
        let guess = 0, betStr = "";
        const validDream = [1, 2, 3, 4, 5];
        const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
        if (validDream.includes(p1)) { guess = p1; betStr = parts[2]; }
        else if (validDream.includes(p2)) { guess = p2; betStr = parts[1]; }
        else return await message.reply("❌ Доступные числа: 1, 2, 3, 4, 5", replyParams());

        let bet = parseAmount(betStr);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());
        
        await updateBalance(userId, -bet);
        const res = Math.floor(Math.random() * 10) + 1;
        const validMultipliers = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5};
        
        if (res === guess) {
            const win = bet * validMultipliers[guess];
            await updateBalance(userId, win);
            return await message.reply(`💎 Выпало: ${res}\n\n✅ Выигрыш: ${formatMoney(win)}$ (x${validMultipliers[guess]})!\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        } else {
            return await message.reply(`💎 Выпало: ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }
    }
    return await message.reply("❌ дрим [1-5] [ставка]", replyParams());
}

// --- РУЛЕТКА (Лимит 10ккк, фикс бага) ---
if (cmdWord === 'рулетка' || cmdWord === 'рул') {
    if (parts.length >= 3) {
        let choice = "", betStr = "";
        if (parseAmount(parts[1]) > 0 || parts[1] === 'все' || parts[1] === 'вб') { betStr = parts[1]; choice = parts.slice(2).join(' '); }
        else { betStr = parts[parts.length - 1]; choice = parts.slice(1, -1).join(' '); }

        let bet = parseAmount(betStr);
        if (bet === 'ALL') bet = balance;
        if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
        if (bet > 10000000000) return await message.reply("❌ Максимальная ставка 10ккк!", replyParams());
        if (bet > balance) return await message.reply(`❌ Недостаточно средств!`, replyParams());

        const res = Math.floor(Math.random() * 37);
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        
        let cName = redNumbers.includes(res) ? "Красное" : (res === 0 ? "Зеро" : "Черное");
        let cEmoji = redNumbers.includes(res) ? "🔴" : (res === 0 ? "🟢" : "⚫");
        let eName = res === 0 ? "Ноль" : (res % 2 === 0 ? "Четное" : "Нечетное");

        let win = false;
        if (parseInt(choice) === res) win = true;
        else if (["красное", "красный", "кр"].includes(choice) && redNumbers.includes(res)) win = true;
        else if (["черное", "черный", "чр", "ср"].includes(choice) && !redNumbers.includes(res) && res !== 0) win = true;
        else if (["чет", "четное"].includes(choice) && res % 2 === 0 && res !== 0) win = true;
        else if (["нечет", "нечетное"].includes(choice) && res % 2 !== 0) win = true;

        await updateBalance(userId, -bet);
        let msgText = `🎰 Выпало: ${res} ${cEmoji} (${cName}, ${eName})\n\n`;
        
        if (win) {
            let winAmount = bet * 2; 
            if (parseInt(choice) === res) winAmount = bet * 36; 
            await updateBalance(userId, winAmount);
            msgText += `✅ Выигрыш: +${formatMoney(winAmount - bet)}$`;
        } else {
            msgText += `😔 Проигрыш: -${formatMoney(bet)}$`;
        }
        msgText += `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;
        
        const attachment = await getRouletteAttachment();
        return await message.reply({ message: msgText, attachment: attachment || undefined, disable_mentions: 1 });
    } else {
        return await message.reply("❌ Формат: рулетка [красное/черное/чет/нечет] [ставка]", replyParams());
    }
}

// --- ФОРТУНА (Новые призы) ---
if (cmdWord === 'фортуна') {
    const currentTime = Math.floor(Date.now() / 1000);
    const row = await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]);
    if (currentTime - (row ? row.last_used : 0) < FORTUNA_CD) return await message.reply("⏳ Фортуна пока недоступна.", replyParams());
    if (balance < 100) return await message.reply("❌ Стоит 100$.", replyParams());
    
    await updateBalance(userId, -100);
    await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);

    const r = Math.random();
    let resultText = "";
    if (r < 0.4) {
        const prize = Math.floor(Math.random() * 150000) + 50000; // От 50к до 200к
        await updateBalance(userId, prize);
        resultText = `🎰 Выпало: ${formatMoney(prize)} монет!`;
    } else if (r < 0.7) {
        await updateReputation(userId, 10);
        resultText = `🎰 Выпало: +10 репутации!`;
    } else {
        resultText = `🎰 Увы, ничего не выпало.`;
    }
    return await message.reply(`${resultText}\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
}

// --- МИНЫ (Лимит 5ккк) ---
if (cmdWord === 'мины') {
    let bet = 100;
    if (parts.length >= 2) {
        let parsed = parseAmount(parts[1]);
        if (parsed === 'ALL') bet = balance; else if (parsed > 0) bet = parsed;
    }
    if (bet < 100) return await message.reply("❌ Мин. 100$.", replyParams());
    if (bet > 5000000000) return await message.reply("❌ Максимальная ставка в минах — 5ккк!", replyParams());
    if (bet > balance) return await message.reply("❌ Недостаточно средств.", replyParams());
    
    await updateBalance(userId, -bet); 
    const gameId = String(Math.floor(Math.random() * 90000) + 10000);
    await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
    return await message.reply(`💣 Мины\nСтавка: ${formatMoney(bet)}$\n\nВыберите количество мин (2-8):`, replyParams(getMinesCountKb(gameId)));
}

// --- ПЕРЕВОД ---
if (cmdWord === 'transfer' || cmdWord === 'перевод') {
    if (parts.length >= 2 && message.hasReplyMessage) {
        const amount = parseAmount(parts[1]);
        const targetId = message.replyMessage.senderId;
        if (!amount || amount === 'ALL') return await message.reply("❌ Укажите корректную сумму.");
        if (targetId === userId) return await message.reply("❌ Нельзя перевести самому себе.");
        if (targetId < 0) return await message.reply("❌ Сообществам нельзя.");
        if (amount < 50 || amount > 5000000000000) return await message.reply("❌ Сумма от 50 до 5кккк.");
        if (balance < amount) return await message.reply("❌ Недостаточно средств.");

        await updateBalance(userId, -amount);
        await updateBalance(targetId, amount);
        return await message.reply(`💸 Вы перевели ${formatMoney(amount)}$ игроку ${await getFullName(targetId)}.\n💰 Ваш баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
    } else {
        return await message.reply("❌ Формат: transfer [сумма] (ответом на сообщение)");
    }
}

// --- ДУЭЛИ ---
if (cmdWord === 'duel') {
    if (parts.length === 2) {
        const bet = parseAmount(parts[1]);
        if (!bet || bet === 'ALL') return await message.reply("❌ Укажите корректную сумму.");
        if (bet < 50 || bet > 2000) return await message.reply("❌ Ставка от 50 до 2000.");
        if (balance < bet) return await message.reply("❌ Не хватает монет.");
        const duelId = String(Math.floor(Math.random() * 90000) + 10000);
        await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
        return await message.reply(`⚔️ Дуэль!\n👤 Создатель: ${await getFullName(userId)}\n💰 Ставка: ${bet}$\n\n⚡ Нажми кнопку ниже!`, replyParams(getDuelKb(duelId)));
    }
    return await message.reply("❌ Формат: duel [сумма]");
}

// --- БОНУС ---
if (cmdWord === 'бонус') {
    const today = new Date().toLocaleDateString('ru-RU');
    const userBonus = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id = ?", [String(userId)]);
    
    let streak = userBonus?.bonus_streak || 0;
    let lastDate = userBonus?.last_bonus_date;

    if (lastDate === today) return await message.reply(`⏳ Вы уже брали бонус сегодня!\n🔥 Ваш стрик: ${streak} дн.`);

    if (lastDate) {
        const lastD = new Date(lastDate.split('.').reverse().join('-'));
        const todayD = new Date(today.split('.').reverse().join('-'));
        const diffTime = Math.abs(todayD - lastD);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) streak++; else streak = 1;
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
    return await message.reply(`🎁 ЕЖЕДНЕВНЫЙ БОНУС\n🔥 Стрик: ${streak} дн.\n💰 Награда: +${formatMoney(bonusAmount)}$\n\n💳 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
}
             // ===== АДМИНСКИЕ КОМАНДЫ =====
        if (userId === ADMIN_ID) {
            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).", replyParams());
                return await message.reply(`💳 У игрока ${await getFullName(targetId)} на балансе: ${formatShortMoney(await getBalance(targetId))}$`, replyParams());
            }

            if (cmdWord === 'заморозить') {
                const { targetId } = await getTargetAndReason(message, 'заморозить');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете заморозить себя.", replyParams());
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]);
                try { await vk.api.messages.send({ peer_id: targetId, message: "💀 Вы заморожены в боте. Ожидайте, когда вам выдадут наказание!", random_id: Math.floor(Math.random() * 1000000000) }); } catch(e) {}
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} заморожен.`, replyParams());
            }

            if (cmdWord === 'разморозить' || cleanText.startsWith('снять заморозку') || cmdWord === 'unfreeze') {
                let cmdName = 'разморозить';
                if (cleanText.startsWith('снять заморозку')) cmdName = 'снять заморозку';
                if (cmdWord === 'unfreeze') cmdName = 'unfreeze';

                const { targetId } = await getTargetAndReason(message, cmdName);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.", replyParams());
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} разморожен.`, replyParams());
            }

            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Чтобы снять мут, используйте /unmute @Mokhma.volk (или ответом на сообщение)", replyParams());
                const { targetId } = await getTargetAndReason(message, cmdWord === 'unmute' ? 'unmute' : 'размут');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.", replyParams());
                
                await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (message.isChat) {
                    try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'none', for: 0 }); } catch(e) {}
                }
                return await message.reply(`✅ С игрока ${await getFullName(targetId)} успешно снят мут!`, replyParams());
            }

            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Чтобы разбанить, используйте /unban @Mokhma.volk (или ответом на сообщение)", replyParams());
                const { targetId } = await getTargetAndReason(message, cmdWord === 'unban' ? 'unban' : 'разбан');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                
                let removed = false;
                if (await dbGet("SELECT user_id FROM blacklist WHERE user_id = ?", [String(targetId)])) { await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]); removed = true; }
                if (message.isChat && await dbGet("SELECT user_id FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)])) { await dbRun("DELETE FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]); removed = true; }
                
                if (!removed) return await message.reply("❌ Этот игрок не находится в бан-листе (ни в ЧС, ни в бане беседы).", replyParams());
                return await message.reply(`✅ ${await getFullName(message.senderId)} разбанил(-а) пользователя ${await getFullName(targetId)}.`, replyParams());
            }

            if (cmdWord === 'kl') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Чтобы полностью сбросить игрока, используйте /kl @Mokhma.volk", replyParams());
                const { targetId } = await getTargetAndReason(message, 'kl');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете сбросить себя.", replyParams());

                await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, car = NULL, last_bonus_date = NULL, bonus_streak = 0, math_wins = 0 WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`💥 Игрок ${await getFullName(targetId)} полностью сброшен!`, replyParams());
            }

            if (cmdWord === 'mute') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Формат: /mute @Mokhma.volk [время в мин] [причина]", replyParams());
                let targetId = null, args = message.text.split(' ').slice(1); 
                
                if (message.hasReplyMessage) { targetId = message.replyMessage.senderId; } 
                else { const { targetId: tId } = await getTargetAndReason(message, 'mute'); targetId = tId; args.shift(); }
                
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете замутить себя.", replyParams());

                let muteMinutes = 10, reason = "Причина не указана";
                if (args.length > 0) {
                    const parsedTime = parseInt(args[0]);
                    if (!isNaN(parsedTime) && parsedTime > 0) { muteMinutes = parsedTime; if (args.length > 1) reason = args.slice(1).join(' '); }
                    else reason = args.join(' ');
                }
                const existingMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingMute && Date.now() < existingMute.mute_until) return await message.reply("❌ У этого игрока уже есть мут!", replyParams());
                
                await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(targetId), String(peerId), Date.now() + (muteMinutes * 60000), reason]);
                if (message.isChat) {
                    try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'ro', for: muteMinutes * 60 }); } catch(e) {}
                }
                return await message.reply(`🔇 ${await getFullName(targetId)} получил мут на ${muteMinutes} минут.\n📌 Причина: ${reason}`, replyParams());
            }

            if (cmdWord === 'бан' || cmdWord === 'ban') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Формат: /ban @Mokhma.volk Причина", replyParams());
                if (!message.isChat) return await message.reply("❌ Только в беседе.", replyParams());
                
                const { targetId, reason } = await getTargetAndReason(message, cmdWord === 'бан' ? 'бан' : 'ban');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете забанить себя.", replyParams());
                if (await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)])) return await message.reply("❌ Этот игрок уже забанен в беседе!", replyParams());

                await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(targetId), String(peerId), reason]);
                try { await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID }); } catch(e) {}
                return await message.reply(`${await getFullName(message.senderId)} забанил(-а) в беседе ${await getFullName(targetId)} по причине: "${reason}"`, replyParams());
            }

            if (cmdWord === 'настройки') {
                const enabled = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value;
                const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
                const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
                const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
                let statusText = enabled === '1' ? "🟢 Включен" : "🔴 Выключен";
                return await message.reply(`⚙️ Настройки антиспама:\n\nСтатус: ${statusText}`, { keyboard: await getSettingsKb(enabled, limit, time, mute) });
            }

            if (cmdWord === 'убрать') {
                const targetQuery = cleanText.replace('убрать', '').trim().toLowerCase();
                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0");
                    return await message.reply(`💥 Все статы ВСЕХ игроков обнулены!`, replyParams());
                } else {
                    const { targetId } = await getTargetAndReason(message, 'убрать');
                    if (!targetId) return await message.reply("⚠️ Укажите игрока или 'all'.", replyParams());
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`💥 Все статы игрока ${await getFullName(targetId)} обнулены!`, replyParams());
                }
            }

            if (cmdWord === 'kick') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Формат: /kick @Mokhma.volk Причина", replyParams());
                const { targetId, reason } = await getTargetAndReason(message, 'kick');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете кикнуть себя.", replyParams());
                if (!message.isChat) return await message.reply("❌ Только в беседе.", replyParams());

                try {
                    await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply(`${await getFullName(message.senderId)} исключил(-а) ${await getFullName(targetId)} по причине: "${reason}"`, replyParams());
                } catch (e) {
                    return await message.reply(`⚠️ Пользователь не в беседе или имеет статус выше Вашего.`, replyParams());
                }
            }

            if (cmdWord === 'чсб') {
                if (parts.length === 1 && !message.hasReplyMessage) return await message.reply("🔔 Формат: /чсб @Mokhma.volk [дней] Причина", replyParams());
                const { targetId, reason } = await getTargetAndReason(message, 'чсб');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                if (targetId === ADMIN_ID) return await message.reply("❌ Вы не можете занести себя в ЧС.", replyParams());
                if (await dbGet("SELECT reason FROM blacklist WHERE user_id = ?", [String(targetId)])) return await message.reply("❌ Этот игрок уже в глобальном ЧС!", replyParams());
                
                let days = 0, finalReason = reason;
                const partsReason = reason.split(' ');
                if (partsReason.length > 1 && !isNaN(parseInt(partsReason[0]))) { days = parseInt(partsReason[0]); finalReason = partsReason.slice(1).join(' '); }
                if (!finalReason) finalReason = "Не указано";

                let until = days > 0 ? Date.now() + days * 86400000 : 0;
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), finalReason, until]);
                return await message.reply(`${await getFullName(message.senderId)} занес(-ла) в ЧС пользователя ${await getFullName(targetId)} ${days > 0 ? `на ${days} дн.` : 'навсегда'} по причине: "${finalReason}"`, replyParams());
            }

            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) return await message.reply("⚠️ Пользователь не найден.", replyParams());
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`${await getFullName(message.senderId)} разбанил(-а) пользователя ${await getFullName(targetId)} в ЧС бота.`, replyParams());
            }

            if (cmdWord === 'выдать') {
                const args = message.text.split(' ');
                args.shift(); 
                let amount = 0, remainingArgs = [];
                for (const arg of args) {
                    const parsed = parseAmount(arg);
                    if (parsed > 0 && parsed !== 'ALL') amount = parsed;
                    else remainingArgs.push(arg);
                }
                if (amount <= 0) return await message.reply("❌ Укажите корректную сумму для выдачи.", replyParams());
                
                const targetQuery = remainingArgs.join(' ').trim().toLowerCase();
                // Пункт 20: Выдача с причиной
                let reasonText = "";
                if (targetQuery.includes('причина')) {
                    const partsReason = targetQuery.split('причина');
                    reasonText = partsReason[1].trim();
                    remainingArgs = partsReason[0].trim().split(' ');
                }

                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Владелец выдал всем игрокам по ${formatMoney(amount)}$!${reasonText ? `\n📌 Причина: ${reasonText}` : ''}`, replyParams());
                } else {
                    let targetId = null;
                    if (message.hasReplyMessage) targetId = message.replyMessage.senderId;
                    else if (targetQuery) {
                        const mentionMatch = targetQuery.match(/@([a-zA-Z0-9._]+)/i) || targetQuery.match(/\[id(\d+)\|/);
                        if (mentionMatch) {
                            if (mentionMatch[1].match(/^\d+$/)) targetId = parseInt(mentionMatch[1]);
                            else { try { const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] }); if (res.type === 'user') targetId = res.object_id; } catch (e) {} }
                        }
                    }
                    if (!targetId) return await message.reply("⚠️ Укажите пользователя или 'all'.", replyParams());
                    await updateBalance(targetId, amount);
                    return await message.reply(`💰 Владелец выдал ${formatMoney(amount)}$ игроку ${await getFullName(targetId)}!${reasonText ? `\n📌 Причина: ${reasonText}` : ''}`, replyParams());
                }
            }

            if (cmdWord === 'обнулить') {
                const args = message.text.split(' ');
                args.shift(); 
                const targetQuery = args.join(' ').trim().toLowerCase();
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0");
                    await dbRun("UPDATE businesses SET balance = 0");
                    return await message.reply("💥 Балансы ВСЕХ игроков и их бизнесов обнулены!", replyParams());
                } else {
                    const { targetId } = await getTargetAndReason(message, 'обнулить');
                    if (!targetId) return await message.reply("⚠️ Укажите 'all' или игрока.", replyParams());
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`💥 Баланс игрока ${await getFullName(targetId)} и его бизнесов обнулен!`, replyParams());
                }
            }

            if (cmdWord === 'cp') {
                await dbRun("DELETE FROM promos");
                return await message.reply("✅ Все активные промокоды удалены.", replyParams());
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
                        return await message.reply("⚠️ Промокоды доступны только подписчикам!\n\nПодпишитесь и попробуйте снова.", replyParams(subKb.toString()));
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
        if (!answered) { answered = true; await context.answer(params).catch(() => {}); }
    };

    try {
        const payload = context.eventPayload;
        const userId = context.userId;

        // Репорты в ЛС админа
        if (payload.cmd === 'report_spam') {
            if (userId !== ADMIN_ID) return;
            await updateBalance(payload.uid, -100000);
            await vk.api.messages.edit({ peer_id: context.peerId, message: "✅ Выдано предупреждение (штраф 100к) за спам.", keyboard: "", conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'report_reply') {
            if (userId !== ADMIN_ID) return;
            adminStates.set(ADMIN_ID, { action: 'reply_report', target: payload.uid, peer: payload.pid });
            await vk.api.messages.send({ peer_id: context.peerId, message: "✏️ Напишите текст ответа игроку (следующим сообщением). Для отмены напишите 'отмена'.", random_id: Math.floor(Math.random() * 1000000000) });
            return;
        }

        if (payload.cmd === 'prop_deal_accept') {
            const deal = await dbGet("SELECT * FROM prop_deals WHERE id = ?", [payload.deal_id]);
            if (!deal) return await safeAnswer({ type: 'show_snackbar', text: '❌ Сделка устарела.' });
            if (String(userId) !== deal.buyer_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы не покупатель.' });
            if (await getBalance(userId) < deal.price) return await safeAnswer({ type: 'show_snackbar', text: '❌ Недостаточно средств.' });
            
            const buyerProps = await dbAll("SELECT slot FROM properties WHERE owner_id = ? AND type = ?", [String(userId), deal.type]);
            if (buyerProps.length >= 2) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас уже 2 таких объекта!' });
            
            let targetSlot = buyerProps.length === 0 ? 1 : (buyerProps[0].slot === 1 ? 2 : 1);

            await updateBalance(userId, -deal.price);
            await updateBalance(deal.seller_id, deal.price);
            await dbRun("UPDATE properties SET owner_id = ?, slot = ? WHERE id = ?", [String(userId), targetSlot, deal.prop_id]);
            await dbRun("DELETE FROM prop_deals WHERE id = ?", [payload.deal_id]);

            await safeAnswer({ type: 'show_snackbar', text: '✅ Успешно куплено!' });
            await vk.api.messages.edit({ peer_id: context.peerId, message: `🤝 Сделка состоялась!\nИгрок ${await getFullName(userId)} купил ${deal.type === 'house' ? 'дом' : 'гараж'} за ${formatMoney(deal.price)}$.`, keyboard: "", conversation_message_id: context.conversationMessageId });
            return;
        }

        if ((payload.cmd === 'top_menu' || payload.cmd === 'top_back' || payload.cmd === 'biz_upgrade') && payload.author) {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это меню вызвано другим пользователем.' });
        }

        if (payload.cmd === 'settings_toggle') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await dbRun("UPDATE settings SET value = ? WHERE key = 'antispam_enabled'", [payload.state]);
            await safeAnswer();
            const limit = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
            const time = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
            const mute = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
            await vk.api.messages.edit({ peer_id: context.peerId, message: `⚙️ Настройки антиспама:\nСтатус: ${payload.state === '1' ? "🟢 Включен" : "🔴 Выключен"}`, keyboard: await getSettingsKb(payload.state, limit, time, mute), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'settings_edit') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await safeAnswer();
            adminStates.set(userId, payload.field); 
            let fieldName = payload.field === 'limit' ? "лимит сообщений" : payload.field === 'time' ? "время в секундах" : "время мута в минутах";
            await vk.api.messages.send({ peer_id: context.peerId, message: `✏️ Введите новое значение: ${fieldName}`, random_id: Math.floor(Math.random() * 1000000000) });
            return;
        }

        if (payload.cmd === 'help_start') {
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: "📖 Выберите раздел с командами:", keyboard: getHelpKb(), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            let msg = "";
            if (payload.section === 'games') msg = "🎰 Игровые команды:\n/рулетка [цвет/чет] [ставка]\n/краш [автостоп] [ставка]\n/монетка [орел/решка] [ставка]\n/стакан [1-3] [ставка]\n/кубик [1-6] [ставка]\n/автомат [ставка]\n/блэкджек [ставка]\n/дрим [1-5] [ставка]\n/мины [ставка]\n/фортуна\n\n⚠️ Мин. ставка: 100$.";
            if (payload.section === 'eco') msg = "💼 Экономика:\n/бизнес\n/купитьбиз [название]\n/мойбизнес [слот]\n/вывести [слот]\n/закрыть бизнес [слот]\n/бонус\n/transfer [сумма]\n/duel [сумма]\n/promo [код]\n/промолист\n/машины\n/купить машина [название]\n/sellcar\n/магазин скины\n/купить скин [название]";
            if (payload.section === 'profile') msg = "👤 Профиль и прочее:\n/профиль\n/топ\n/rep +/- (ответом)\n/пинг\n/chatid\n/report [текст]\n\n💡 Слэш (/) в начале обязателен!";
            if (payload.section === 'global') msg = "🌍 Страны и Организации:\n/страны\n/страна [Название]\n/список организаций\n/вступить в организацию [Название]";
            
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                    txt += `📍 ${data.name} (${countRow?.c || 0}/20)\n`;
                }
                msg = txt + `\n💡 /купить дом топ [номер] [Локация]`;
            }
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                    txt += `📍 ${data.name} (${countRow?.c || 0}/20)\n`;
                }
                msg = txt + `\n💡 /купить гараж топ [номер] [Локация]`;
            }
            await vk.api.messages.edit({ peer_id: context.peerId, message: msg, keyboard: getHelpBackKb(), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'casino_info') {
            let msg = "";
            if (payload.game === 'roulette') msg = "Рулетка ❓\n\"Рулетка [на что ставишь] [ставка]\"\n▪ Число (x36)\n▪ Чет/Нечет (x2)\n▪ Красное/Черное (x2)";
            if (payload.game === 'crash') msg = "❌ краш (автостоп) (ставка)\n\nПример: краш 3 5кк";
            if (payload.game === 'coin') msg = "❌ монетка [орел/решка] [ставка]";
            if (payload.game === 'glass') msg = "❌ стакан [1-3] [ставка]";
            if (payload.game === 'dice') msg = "❌ кубик [1-6] [ставка]";
            if (payload.game === 'slot') msg = "автомат (сумма)\nПример: автомат 5кк";
            if (payload.game === 'blackjack') msg = "❌ Блэкджек (ставка)";
            if (payload.game === 'dream') msg = "Дрим [число] [ставка]\nЧисла: 1(x2), 2(x2), 3(x3), 4(x4), 5(x5)";
            await safeAnswer(); 
            await vk.api.messages.send({ peer_id: context.peerId, message: msg, random_id: Math.floor(Math.random() * 1000000000), disable_mentions: 1 });
            return;
        }

        if (payload.cmd === 'biz_upgrade') {
            const slot = 1; // Упрощенно для кнопки (если нужно, можно сделать выбор слота)
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас нет бизнеса.' });
            if (biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Максимальный уровень!' });

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

            if (await getBalance(userId) < nextLevelCost) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег!' });

            await safeAnswer();
            await updateBalance(userId, -nextLevelCost);
            await dbRun("UPDATE businesses SET level = level + 1, balance = ?, last_income = ? WHERE user_id = ? AND slot = ?", [totalBalance, Date.now(), String(userId), slot]);
            
            const newMsgText = `🏢 Бизнес ${await getFullName(userId)} [Слот ${slot}]\n${biz.biz_name}\n\n💪 Уровень: ${biz.level + 1}/5\n🐱 ${formatMoney(bizData.baseIncome * (biz.level + 1) * 20)}$/час\n💸 Баланс: ${formatMoney(totalBalance)}$\n\n👉 /вывести ${slot}`;
            await vk.api.messages.edit({ peer_id: context.peerId, message: newMsgText, keyboard: getBizKb(userId), disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0, lastReset = workRow ? Number(workRow.last_reset) : 0;
            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${Math.floor((3600000 - (now - lastReset)) / 60000)} мин.` });

            if (payload.type === 'Такси') {
                const userRow = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
                if (!userRow || !userRow.car) return await safeAnswer({ type: 'show_snackbar', text: '❌ Для такси нужна машина! /машины' });
            }

            await safeAnswer();
            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);

            const isLucky = Math.random() > 0.3;
            let msgText = "";
            if (isLucky) {
                const earned = 2000000;
                await updateBalance(userId, earned);
                msgText = `✅ Вы заработали ${formatMoney(earned)}$! (${payload.type})`;
            } else {
                msgText = `😢 Не повезло! Вы заработали 0$. (${payload.type})`;
            }

            await vk.api.messages.edit({ peer_id: context.peerId, message: `${msgText}\n\n💰 Баланс: ${formatMoney(await getBalance(userId))}$\n📊 Осталось: ${3 - count}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'work_menu') {
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'top_menu') {
            const type = payload.type, scope = payload.scope, repType = payload.repType || 'pos', author = payload.author;
            let orderBy = "balance DESC", filter = "balance > 0";
            
            if (type === 'rep') { orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; }
            else if (type === 'level') { orderBy = "level DESC, xp DESC"; filter = "level > 1"; }
            else if (type === 'duels') { orderBy = "duel_wins DESC"; filter = "duel_wins > 0"; }
            else if (type === 'bonus') { orderBy = "bonus_count DESC"; filter = "bonus_count > 0"; }
            else if (type === 'math') { orderBy = "math_wins DESC"; filter = "math_wins > 0"; }

            let rows = [];
            if (scope === 'global') {
                rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count, math_wins FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
            } else {
                const chatUsers = await dbAll("SELECT user_id FROM chat_messages WHERE peer_id = ?", [String(context.peerId)]);
                if (chatUsers.length > 0) {
                    const ids = chatUsers.map(u => `'${u.user_id}'`).join(',');
                    rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count, math_wins FROM users WHERE user_id IN (${ids}) AND ${filter} ORDER BY ${orderBy} LIMIT 10`);
                }
            }

            if (rows.length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Топ пуст.' });

            const userIds = rows.map(r => r.user_id);
            let usersInfo = [];
            try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}

            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n`;
            if (type === 'coins') title += "💰 По монетам\n\n";
            if (type === 'level') title += "📊 По уровню\n\n";
            if (type === 'duels') title += "⚔️ По победам\n\n";
            if (type === 'bonus') title += "🎁 По бонусам\n\n";
            if (type === 'math') title += "🧮 По примерам\n\n";
            if (type === 'rep') title += `⭐ По репутации (${repType === 'pos' ? '+' : '-'})\n\n`;

            let topText = title;
            let count = 0;
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            
            for (const r of rows) {
                const uInfo = usersInfo.find(u => u.id == r.user_id);
                if (uInfo && !uInfo.deactivated) {
                    let value = "";
                    if (type === 'coins') value = `${formatMoney(r.balance)}$`;
                    if (type === 'level') value = `Ур. ${r.level}`;
                    if (type === 'rep') value = `${r.reputation > 0 ? '+' : ''}${r.reputation}`;
                    if (type === 'duels') value = `${r.duel_wins} побед`;
                    if (type === 'bonus') value = `${r.bonus_count} бонусов`;
                    if (type === 'math') value = `${r.math_wins} решено`;
                    
                    topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] — ${value}\n`;
                    count++;
                }
            }

            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: topText, keyboard: getTopKb(author, type, scope, repType), disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'top_back') {
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: "🏆 Выберите категорию топа:", keyboard: getTopKb(payload.author), conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'duel_accept') {
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            if (!row) return;
            if (String(userId) === row.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нельзя драться с собой!' });
            if (await getBalance(userId) < row.bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег!' });
            
            const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
            const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
            const prize = Math.floor(row.bet * 1.8);
            
            await updateBalance(winnerId, prize);
            await updateBalance(loserId, -row.bet);
            await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
            await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            
            const msgText = `⚔️ Дуэль завершена!\n\n🏆 Победитель: ${await getFullName(winnerId)}\n❌ Проигравший: ${await getFullName(loserId)}\n\n💰 Выигрыш: ${formatMoney(prize)}$`;
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: msgText, keyboard: "", disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'mines_set') {
            const gameId = String(payload.gameId);
            const count = Number(payload.count);
            
            const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра устарела.' });

            const minesArr = [];
            while(minesArr.length < count) { const r = Math.floor(Math.random() * 9) + 1; if (!minesArr.includes(r)) minesArr.push(r); }
            
            await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0, start_time = ? WHERE game_id = ?", [JSON.stringify(minesArr), Date.now(), gameId]);
            const ui = getMinesGameUI(gameId, row.bet, count, minesArr, [], false, null, await getFullName(userId), await getBalance(userId), 60);
            
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            return;
        }

        if (payload.cmd === 'mines_click') {
            const gameId = String(payload.gameId);
            const cell = Number(payload.cell);
            
            const row = await dbGet("SELECT bet, mines, opened, multiplier, start_time FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return;

            const bet = row.bet, mines = JSON.parse(row.mines), opened = JSON.parse(row.opened), startTime = row.start_time;
            const balance = await getBalance(userId);

            if (Date.now() - startTime > 60000) {
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, null, await getFullName(userId), balance);
                await safeAnswer({ type: 'show_snackbar', text: '⏳ Время вышло!' });
                await vk.api.messages.edit({ peer_id: context.peerId, message: ui.text.replace('наступил(а) на мину!', 'не успел(а) открыть клетку!'), keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
                return;
            }
            
            if (opened.includes(cell)) return;

            opened.push(cell);
            let isLoss = false, hitCell = null, currentMoney = 0;

            if (mines.includes(cell)) {
                isLoss = true; hitCell = cell;
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
            } else {
                let currentMult = 1.0;
                for (let i = 0; i < opened.length; i++) currentMult *= (9 - i) / (9 - mines.length - i);
                currentMult = Math.round(currentMult * 0.95 * 100) / 100;
                currentMoney = Math.floor(bet * currentMult);

                if (opened.length === (9 - mines.length)) {
                    await updateBalance(userId, currentMoney);
                    await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                    isLoss = true; hitCell = -1;
                } else {
                    await dbRun("UPDATE games SET opened = ?, multiplier = ? WHERE game_id = ?", [JSON.stringify(opened), currentMult, gameId]);
                }
            }

            const newBal = await getBalance(userId);
            const name = await getFullName(userId);

            if (isLoss) {
                const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, hitCell, name, newBal);
                let text = ui.text;
                if (hitCell === -1) text = `🏆 ПОБЕДА!\n────────────────────\n👤 ${name}\n💣 Мин: ${mines.length}\n✅ Открыто: ${opened.length}\n\n📈 Выигрыш: +${formatMoney(currentMoney)} 💰 (x${(currentMoney/bet).toFixed(2)})\n💳 Баланс: ${formatMoney(newBal)} 💰\n\n💬 Поздравляем! Ты забрал всё! 🎉`;
                await safeAnswer();
                await vk.api.messages.edit({ peer_id: context.peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            } else {
                const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, false, null, name, newBal);
                const timeLeft = Math.max(0, Math.floor((60000 - (Date.now() - startTime)) / 1000));
                await safeAnswer();
                await vk.api.messages.edit({ peer_id: context.peerId, message: ui.text.replace('{TIME}', timeLeft.toString()), keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
            return;
        }

        if (payload.cmd === 'mines_cashout') {
            const gameId = String(payload.gameId);
            const row = await dbGet("SELECT bet, multiplier, mines, opened FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return;

            const opened = JSON.parse(row.opened);
            if (opened.length === 0) return; 

            const winAmount = Math.floor(row.bet * row.multiplier);
            await updateBalance(userId, winAmount);
            await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
            
            const msgText = `💰 ВЫВОД\n────────────────────\n👤 ${await getFullName(userId)}\n💵 Забрал: ${formatMoney(winAmount)} 💰 (x${row.multiplier})\n💳 Баланс: ${formatMoney(await getBalance(userId))} 💰\n\n💬 Отличная игра! Заходи ещё 🍀`;
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: context.peerId, message: msgText, keyboard: buildMinesKb(gameId, opened, JSON.parse(row.mines), true, null), conversation_message_id: context.conversationMessageId });
            return;
        }

        await safeAnswer();
    } catch (e) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА В КНОПКАХ:", e);
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
