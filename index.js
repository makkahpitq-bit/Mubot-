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
const BONUS_CD = 86400; // 24 часа
const FORTUNA_CD = 600;

// Картинки
const DEFAULT_PROFILE_PHOTO = 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0';
const ROULETTE_TABLE = 'https://sun9-63.userapi.com/s/v1/ig2/to7LopyEWd8Z1KvH7SUG3N1JPeHQpK4NRx_h7wJHnKvpiFbzpGm7k6274tKqxtJkLpU035GKCJTtL9CnOtB5OcM9.jpg?quality=95&as=32x18,48x27,72x40,108x61,160x90,240x135,360x202,480x270,540x304,640x360,720x405,1080x607,1280x720,1440x810,2208x1242&from=bu&cs=2208x0';

// ===== ИНИЦИАЛИЗАЦИЯ БОТА =====
const vk = new VK({ token: TOKEN, apiVersion: '5.199', pollingGroupId: GROUP_ID });

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'game.db');

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database(DB_FILE);
const dbRun = (query, params = []) => new Promise((res, rej) => db.run(query, params, function(e) { e ? rej(e) : res(this); }));
const dbGet = (query, params = []) => new Promise((res, rej) => db.get(query, params, (e, r) => e ? rej(e) : res(r)));
const dbAll = (query, params = []) => new Promise((res, rej) => db.all(query, params, (e, r) => e ? rej(e) : res(r)));

// ===== ПЕРЕМЕННЫЕ =====
const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const spamCache = new Map(); 
const chsbNotifyCache = new Map(); 
const pendingDebts = new Map();

// ===== ДАННЫЕ =====
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

// ===== ИНИЦИАЛИЗАЦИЯ БАЗЫ =====
async function initDB() {
    await dbRun("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, reputation INTEGER DEFAULT 0, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, reg_date TEXT, duel_wins INTEGER DEFAULT 0, bonus_count INTEGER DEFAULT 0, premium_until INTEGER DEFAULT 0, org TEXT, country TEXT, clothes TEXT, cars TEXT DEFAULT '[]', last_bonus_date TEXT, bonus_streak INTEGER DEFAULT 0, sim_card TEXT)");
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
    
    // Бизнес
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT PRIMARY KEY, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS custom_cmds (user_id TEXT, alias TEXT, real_cmd TEXT, PRIMARY KEY (user_id, alias))");
    await dbRun("CREATE TABLE IF NOT EXISTS warnings (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, lender TEXT, borrower TEXT, amount INTEGER, days INTEGER, status TEXT DEFAULT 'pending')");
    
    // СИМ-КАРТЫ
    await dbRun("CREATE TABLE IF NOT EXISTS sim_cards (number TEXT PRIMARY KEY, owner_id TEXT)");
    
    // РЕПОРТЫ (ОГРОМНАЯ СИСТЕМА)
    await dbRun("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, text TEXT, status TEXT DEFAULT 'pending', chat_id TEXT, reply_text TEXT, rating INTEGER DEFAULT 0, rate_reason TEXT)");

    // Миграции (чтобы старые базы не крашились)
    try { await dbRun("ALTER TABLE users ADD COLUMN sim_card TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN cars TEXT DEFAULT '[]'"); } catch(e) {}
    try { await dbRun("ALTER TABLE reports ADD COLUMN rating INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE reports ADD COLUMN rate_reason TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE reports ADD COLUMN reply_text TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE reports ADD COLUMN chat_id TEXT"); } catch(e) {}

    try { await dbRun("DELETE FROM businesses WHERE rowid NOT IN (SELECT MIN(rowid) FROM businesses GROUP BY user_id)"); } catch(e) {}

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
    if (!row) { await dbRun("INSERT INTO users (user_id, balance) VALUES (?, 1000)", [String(userId)]); return 1000; }
    return Number(row.balance) || 0;
}

async function updateBalance(userId, amount) {
    const bal = await getBalance(userId);
    let newBal = Math.floor(Number(bal) + Number(amount));
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

function formatMoney(num) { return Number(num || 0).toLocaleString('ru-RU'); }

async function getTargetAndReason(message, cmdName) {
    let targetId = null;
    let text = message.text || '';
    let reason = text.replace(new RegExp(`^\\/?${cmdName}\\s*`, 'i'), '');
    if (message.hasReplyMessage) {
        targetId = message.replyMessage.senderId;
    } else {
        const idMatch = reason.match(/\[id(\d+)\|[^\]]+\]/i);
        if (idMatch) { targetId = parseInt(idMatch[1]); reason = reason.replace(idMatch[0], ''); }
        else {
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
    reason = reason.replace(/[\[\]]/g, '').replace(/"/g, '').trim();
    return { targetId, reason: reason || "Не указана" };
}

// ===== ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ =====
async function generateProfileImage(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200' });
        const nameText = `${user.first_name} ${user.last_name || ''}`.trim();
        const avatarUrl = user.photo_200 || DEFAULT_PROFILE_PHOTO; // Берем аватарку игрока, а если нет - дефолт

        const avatar = await Jimp.read(avatarUrl);
        avatar.cover(400, 400); // Квадратная аватарка

        const canvas = new Jimp(400, 480, 0x101010FF); // Темный фон
        canvas.composite(avatar, 0, 0);

        const banner = new Jimp(400, 80, 0x000000B0); // Черная плашка снизу
        canvas.composite(banner, 0, 400);

        // Шрифт с поддержкой русского языка
        const font = await Jimp.loadFont("https://cdn.jsdelivr.net/gh/Fluffffy/jimp-cyrillic-fonts@master/fonts/open-sans-32-white/open-sans-32-white.fnt");
        
        canvas.print(font, 0, 420, { text: nameText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 400, 40);

        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
        console.error("Ошибка генерации фото профиля:", e);
        return null;
    }
}

async function generateRouletteImage(number, color) {
    try {
        // Загружаем оригинальную таблицу рулетки
        const img = await Jimp.read(ROULETTE_TABLE);
        
        // Подгоняем размер под красивый вид (например, ширина 800)
        img.resize(800, Jimp.AUTO);
        
        // Создаем холст: высота таблицы + 120 пикселей для новой цифры
        const canvas = new Jimp(800, img.bitmap.height + 120, 0x000000FF);
        
        // Накладываем саму таблицу
        canvas.composite(img, 0, 0);
        
        // Рисуем нижнюю плашку
        let barColor = 0xFF0000FF; // Красный по умолчанию
        if (color === 'black') barColor = 0x000000FF;
        
        const bar = new Jimp(800, 120, barColor);
        canvas.composite(bar, 0, img.bitmap.height);
        
        // Пишем цифру
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        canvas.print(font, 0, img.bitmap.height + 20, { text: String(number), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, 800, 80);
        
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch(e) { 
        console.error("Ошибка генерации рулетки:", e);
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
        return {
            text: `💥 БАБАХ! ПОРАЖЕНИЕ\n────────────────────\n👤 ${name} наступил(а) на мину!\n💣 Мин на поле: ${minesCount}\n✅ Успел(а) открыть: ${currentOpened}\n\n📉 Потеряно: -${bet} 💰\n😢 Не забрал(а): ${currentMoney} 💰 (x${currentMult})\n💳 Баланс: ${formatMoney(balance)} 💰\n\n💬 Бывает. Следующая будет твоей 🍀`,
            kb: buildMinesKb(gameId, opened, minesArr, true, hitCell)
        };
    } else {
        const randomPhrases = ["Выбирай клетку! 😈", "Чисто! 👏", "Ещё немного 💸", "Осторожно... 💣", "Фортуна улыбается 😉"];
        const phrase = currentOpened === 0 ? randomPhrases[0] : randomPhrases[Math.floor(Math.random() * (randomPhrases.length - 1)) + 1];

        return {
            text: `💣 МИНЫ\n────────────────────\n👤 ${name}\n💵 Ставка: ${bet} | 💣 Мин: ${minesCount}\n\n${progressBar} ${currentOpened}/${totalSafe}\n📈 Сейчас: x${currentMult.toFixed(2)} → ${currentMoney} 💰\n🎯 Следующая: x${nextMult.toFixed(2)} → ${nextMoney} 💰\n🍀 Шанс: ${chance}%\n⏱ Осталось: ${timeLeft} сек.\n\n💬 ${phrase}`,
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
        if (i % 3 === 0) kb.row();
    }
    if (!isGameOver && currentMoney > 0 && opened.length > 0) {
        kb.callbackButton({ label: `💰 Забрать ${currentMoney}`, payload: { cmd: 'mines_cashout', gameId: String(gameId) }, color: Keyboard.SECONDARY_COLOR });
    }
    return kb.toString();
}

// ===== КЛАВИАТУРЫ =====
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
        .callbackButton({ label: '📩 Жалобы', payload: { cmd: 'help_menu', section: 'reports' }, color: Keyboard.SECONDARY_COLOR })
        .row()
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
    return Keyboard.builder().inline().callbackButton({ label: '⚔️ Сразиться', payload: { cmd: 'duel_accept', duel_id: duelId }, color: Keyboard.POSITIVE_COLOR }).toString();
};

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

// Магазин (добавлено много вещей)
const getShopKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🧢 Шапки', payload: { cmd: 'shop_cat', cat: 'hat' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '👕 Футболки', payload: { cmd: 'shop_cat', cat: 'shirt' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '👖 Джинсы', payload: { cmd: 'shop_cat', cat: 'jeans' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '👟 Обувь', payload: { cmd: 'shop_cat', cat: 'shoes' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🕶️ Очки', payload: { cmd: 'shop_cat', cat: 'glasses' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '👗 Юбки', payload: { cmd: 'shop_cat', cat: 'skirt' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};

// Кнопки для жалоб (Админ)
const getAdminReportKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✍️ Ответить', payload: { cmd: 'report_reply', report_id: reportId }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '🚫 Спам', payload: { cmd: 'report_spam', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

// Кнопки оценки репорта (Игроку после ответа)
const getReportRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⭐ Оценить работу', payload: { cmd: 'report_rate_start', report_id: reportId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Закрыть вопрос', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

// Кнопки плохой оценки
const getBadRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⏳ Давно без ответа', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Давно без ответа' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🚫 Не помог', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Не помог' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '❓ Не понял ответ', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Не понял ответ' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '😡 Грубость', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Грубость' }, color: Keyboard.NEGATIVE_COLOR })
        .row()
        .callbackButton({ label: '❌ Закрыть репорт', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

// Кнопки для долга
const getDebtKb = (debtId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Принять', payload: { cmd: 'debt_accept', debt_id: debtId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Отказать', payload: { cmd: 'debt_decline', debt_id: debtId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};
// ===== ОБРАБОТКА СООБЩЕНИЙ =====
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox) return;
    if (message.senderId < 0) return;

    try {
        // РАБОТА БЕЗ СЛЭША (заменяем слэш в начале, если есть)
        let text = message.text ? message.text.trim() : '';
        if (!text) return;

        let cleanText = text.replace(/^\//, '').trim().toLowerCase(); 
        let parts = cleanText.split(/\s+/);
        let cmdWord = parts[0];

        const userId = message.senderId;
        const peerId = message.peerId;
        const isLs = peerId === userId;

        // --- КАСТОМНЫЕ КОМАНДЫ ---
        const customCmd = await dbGet("SELECT real_cmd FROM custom_cmds WHERE user_id = ? AND alias = ?", [String(userId), cmdWord]);
        if (customCmd) {
            cleanText = customCmd.real_cmd; // Меняем на реальную команду
            parts = cleanText.split(/\s+/);
            cmdWord = parts[0];
        }

        // --- ЗАМОРОЗКА ---
        if (userId !== ADMIN_ID) {
            const isFrozen = await dbGet("SELECT user_id FROM frozen WHERE user_id = ?", [String(userId)]);
            if (isFrozen) return await message.reply("💀 Вы заморожены в боте.");
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
                            .row().urlButton({ label: 'Правила бота', url: `https://vk.ru/topic-243089386_69454146` });
                        
                        try {
                            await vk.api.messages.send({ peer_id: peerId, message: banText, keyboard: banKb.toString(), random_id: Math.floor(Math.random() * 1000000000), disable_mentions: 1 });
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
                    try { await vk.api.messages.delete({ peer_id: peerId, cmids: [message.conversationMessageId], delete_for_all: 1 }); } 
                    catch (e) { try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e2) {} }
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
                const limit = Number((await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value || 5);
                const timeSec = Number((await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value || 60);
                const muteMin = Number((await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value || 10);

                const now = Date.now();
                const cacheKey = `${peerId}_${userId}`;
                let spamData = spamCache.get(cacheKey) || { count: 0, lastReset: now, isMuted: false, muteEndTime: 0 };

                if (spamData.isMuted) {
                    if (now < spamData.muteEndTime) {
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch (e) {}
                        return; 
                    } else spamData.isMuted = false;
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
                    } catch(e) { spamData.isMuted = false; spamCache.set(cacheKey, spamData); }
                }
            }
        }

        // --- НАСТРОЙКИ / ОТВЕТЫ НА РЕПОРТЫ (АДМИН) ---
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            
            if (state.startsWith('reply_')) {
                const reportId = state.split('_')[1];
                const replyText = text;
                adminStates.delete(userId);
                
                const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
                if (report) {
                    await dbRun("UPDATE reports SET status = 'answered', reply_text = ? WHERE id = ?", [replyText, reportId]);
                    
                    const replyKb = getReportRateKb(reportId);
                    const replyMsg = `📩 Вам ответил администратор [id${ADMIN_ID}|Владелец]:\n\n${replyText}\n\n👇 Пожалуйста, оцените работу или закройте вопрос:`;
                    
                    try {
                        await vk.api.messages.send({ peer_id: report.reporter_id, message: replyMsg, keyboard: replyKb.toString(), random_id: Math.floor(Math.random() * 1000000000) });
                        if (report.chat_id && report.chat_id > 0) {
                            await vk.api.messages.send({ peer_id: report.chat_id, message: `📩 Ответ на ваш репорт отправлен в ЛС [id${report.reporter_id}|Игроку].`, random_id: Math.floor(Math.random() * 1000000000) });
                        }
                    } catch(e) {}
                }
                return await message.reply("✅ Ответ отправлен игроку. Ожидайте оценки.");
            }

            const val = parseFloat(cleanText);
            if (!isNaN(val) && val > 0) {
                await dbRun("UPDATE settings SET value = ? WHERE key = ?", [String(val), state]);
                adminStates.delete(userId);
                return await message.reply(`✅ Настройки антиспама сохранены!`, { keyboard: await getSettingsKb((await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value) });
            }
        }

        // СПИСОК ВАЛИДНЫХ КОМАНД (без слэша)
        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cc', 'ping', 'пинг', 'убрать', 'настройки', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'cmd', 'моикоманды', 'premium', 'магаз', 'reg', 'q', 'админ', 'ahelp', 'объявление', 'report', 'вступить', 'организации', 'страна', 'страны', 'датьдолг', 'мойдолг', 'cl', 'снятьпред', 'купитьсим', 'слитьсим'];
        
        if (!validCmds.includes(cmdWord)) return; 

        // --- УРОВНИ ---
        let userRow = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(userId)]);
        if (!userRow) {
            const today = new Date().toLocaleDateString('ru-RU');
            await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), today]);
            userRow = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(userId)]);
        } else {
            let newXp = (Number(userRow.xp) || 0) + 40;
            let newLvl = Number(userRow.level) || 1;
            while (newXp >= newLvl * 500) { newXp -= newLvl * 500; newLvl++; }
            await dbRun("UPDATE users SET xp = ?, level = ? WHERE user_id = ?", [newXp, newLvl, String(userId)]);
        }

        if (message.isChat) {
            const existing = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            if (existing) await dbRun("UPDATE chat_messages SET count = count + 1 WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            else await dbRun("INSERT INTO chat_messages (peer_id, user_id, count) VALUES (?, ?, 1)", [String(peerId), String(userId)]);
        }

        const balance = await getBalance(userId);
        const rep = await getReputation(userId);
        const isPremium = userRow.premium_until > Date.now();

        const replyParams = (kb = undefined) => {
            const p = { disable_mentions: 1 };
            if (kb) p.keyboard = kb;
            return p;
        };

        // ================= НАЧАЛО КОМАНД =================

        if (cmdWord === 'cmd') {
            if (parts.length < 3) return await message.reply("❌ Формат: cmd [название] [команда]\nПример: cmd игра рулетка", replyParams());
            const alias = parts[1];
            const realCmd = parts.slice(2).join(' ');
            const countRow = await dbGet("SELECT COUNT(*) as c FROM custom_cmds WHERE user_id = ?", [String(userId)]);
            if (countRow.c >= 10) return await message.reply("❌ Лимит 10 кастомных команд!", replyParams());
            await dbRun("REPLACE INTO custom_cmds (user_id, alias, real_cmd) VALUES (?, ?, ?)", [String(userId), alias, realCmd]);
            return await message.reply(`✅ Команда сохранена! Теперь пиши "${alias}" вместо "${realCmd}"`, replyParams());
        }

        if (cmdWord === 'моикоманды') {
            const cmds = await dbAll("SELECT alias, real_cmd FROM custom_cmds WHERE user_id = ?", [String(userId)]);
            if (cmds.length === 0) return await message.reply("У вас нет кастомных команд.", replyParams());
            let txt = "📜 Ваши кастомные команды:\n";
            for (const c of cmds) txt += `▪️ ${c.alias} -> ${c.real_cmd}\n`;
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'start' || cmdWord === 'начать') {
            if (message.isChat) return await message.reply("✅ Бот активирован! Пиши help для списка команд.", replyParams());
            return await message.reply("👋 Привет! Выбирай действие.", replyParams(mainKb));
        }

        if (cmdWord === 'help' || cmdWord === 'помощь') {
            return await message.reply("📖 Выберите раздел с командами:", replyParams(getHelpKb()));
        }

        if (cmdWord === 'ahelp') {
            if (userId !== ADMIN_ID) return;
            let txt = `👑 АДМИН КОМАНДЫ (все работают без /)\n\n`;
            txt += `cc - Удалить промокоды\n`;
            txt += `объявление [текст] - Рассылка всем\n`;
            txt += `выдать [сумма] [@ник/all] - Выдать деньги\n`;
            txt += `обнулить [@ник/all] - Обнулить баланс\n`;
            txt += `cl [@ник/all] - Полный сброс (топы, статы)\n`;
            txt += `снятьпред [@ник] - Снять предупреждение\n`;
            txt += `чсб [@ник] [дней] [причина] - ЧС\n`;
            txt += `разчсб [@ник] - Снять ЧС\n`;
            txt += `mute [@ник] [мин] - Мут\n`;
            txt += `kick [@ник] [причина] - Кик\n`;
            return await message.reply(txt);
        }

        if (cmdWord === 'reg') {
            return await message.reply(`📅 Вы зарегистрированы ВКонтакте примерно в ${new Date().getFullYear() - 5} году.`, replyParams());
        }

        if (cmdWord === 'q') {
            if (!message.isChat) return;
            try { await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: userId, group_id: GROUP_ID }); } 
            catch(e) { return await message.reply("Ошибка. Скорее всего, вы админ."); }
            return;
        }

        if (cmdWord === 'premium') {
            if (isPremium) return await message.reply(`💎 У вас уже есть Premium до ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}`, replyParams());
            if (balance < 50000) return await message.reply(`❌ Premium стоит 50,000$`, replyParams());
            await updateBalance(userId, -50000);
            await dbRun("UPDATE users SET premium_until = ? WHERE user_id = ?", [Date.now() + 30 * 86400000, String(userId)]);
            return await message.reply(`✅ Вы купили Premium на 30 дней! (х2 опыт, х2 монеты, лимиты до 3к)`, replyParams());
        }

        if (cmdWord === 'магаз' && parts[1] === 'вещей') {
            return await message.reply("🛒 Магазин одежды! Выберите категорию:", replyParams(getShopKb()));
        }

        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now();
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            return await message.reply(`🏓 Понг! Задержка: ${Date.now() - start} мс`, replyParams());
        }

        // --- СИМ-КАРТЫ ---
        if (cmdWord === 'купитьсим') {
            if (userRow.sim_card) return await message.reply(`❌ У вас уже есть сим-карта (Тел: ${userRow.sim_card}). Сначала слейте её: слитьсим`, replyParams());
            
            let newNumber = "";
            let isFree = false;
            while (!isFree) {
                newNumber = `+7 (${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 90) + 10}`;
                const existing = await dbGet("SELECT owner_id FROM sim_cards WHERE number = ?", [newNumber]);
                if (!existing) isFree = true;
            }

            await dbRun("INSERT INTO sim_cards (number, owner_id) VALUES (?, ?)", [newNumber, String(userId)]);
            await dbRun("UPDATE users SET sim_card = ? WHERE user_id = ?", [newNumber, String(userId)]);
            return await message.reply(`📱 Вы успешно купили сим-карту!\nВаш номер: ${newNumber}`, replyParams());
        }

        if (cmdWord === 'слитьсим') {
            if (!userRow.sim_card) return await message.reply("❌ У вас нет сим-карты.", replyParams());
            await dbRun("DELETE FROM sim_cards WHERE number = ?", [userRow.sim_card]);
            await dbRun("UPDATE users SET sim_card = NULL WHERE user_id = ?", [String(userId)]);
            await updateBalance(userId, 10000);
            return await message.reply(`📱 Вы успешно слили сим-карту за 10,000$!`, replyParams());
        }

        // --- РЕПУТАЦИЯ (ИСПРАВЛЕНО) ---
        if (cmdWord === 'rep' || cmdWord === 'реп') {
            const isPlus = parts[1] === '+';
            const isMinus = parts[1] === '-';
            
            if (!isPlus && !isMinus) return await message.reply("🔔 Формат: rep + (ответом на сообщение) или rep + @ник");

            let targetId = null;
            if (message.hasReplyMessage) {
                targetId = message.replyMessage.senderId;
            } else {
                const targetStr = parts.slice(2).join(' ');
                const idMatch = targetStr.match(/\[id(\d+)\|/i);
                const mentionMatch = targetStr.match(/@([a-zA-Z0-9._]+)/i);

                if (idMatch) targetId = parseInt(idMatch[1]);
                else if (mentionMatch) {
                    try {
                        const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                        if (res.type === 'user') targetId = res.object_id;
                    } catch (e) {}
                }
            }

            if (!targetId) return await message.reply("⚠️ Укажите пользователя (ответом или @упоминанием).");
            if (targetId === userId) return await message.reply("❌ Себе нельзя!");

            const now = Date.now();
            const repRow = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id = ?", [String(userId)]);
            let repCount = repRow ? Number(repRow.count) : 0;
            let repReset = repRow ? Number(repRow.last_reset) : 0;

            if (now - repReset >= 86400000) { repCount = 0; repReset = now; }
            if (repCount >= 3) return await message.reply(`⏳ Лимит 3 раза в сутки. Ждите.`, replyParams());

            repCount++;
            await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), repCount, repReset]);

            if (isPlus) await updateReputation(targetId, 1);
            else await updateReputation(targetId, -1);

            return await message.reply(`✅ Вы ${isPlus ? 'повысили' : 'понизили'} репутацию ${await getFullName(targetId)}. Осталось: ${3 - repCount}/3`, replyParams());
        }

        // --- ОРГАНИЗАЦИИ И СТРАНЫ ---
        if (cmdWord === 'организации') {
            const orgs = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];
            let txt = "🏛️ Доступные организации:\n";
            for (let i = 0; i < orgs.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [orgs[i]]);
                txt += `${i+1}. ${orgs[i]} (${count.c}/10)\n`;
            }
            return await message.reply(txt + "\n👉 Вступить: вступить [Название]", replyParams());
        }

        if (cmdWord === 'вступить') {
            const orgName = parts.slice(1).join(' ');
            const validOrgs = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];
            const foundOrg = validOrgs.find(o => o.toLowerCase() === orgName.toLowerCase());
            if (!foundOrg) return await message.reply("❌ Нет такой организации. Список: организации");
            if ((await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [foundOrg])).c >= 10) return await message.reply("❌ Мест нет!");
            await dbRun("UPDATE users SET org = ? WHERE user_id = ?", [foundOrg, String(userId)]);
            return await message.reply(`✅ Вы вступили в ${foundOrg}!`, replyParams());
        }

        if (cmdWord === 'страны') {
            const countries = ['Россия', 'Чеченская Республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];
            let txt = "🌍 Доступные страны:\n";
            for (let i = 0; i < countries.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE country = ?", [countries[i]]);
                txt += `${i+1}. ${countries[i]} (${count.c})\n`;
            }
            return await message.reply(txt + "\n👉 Вступить: страна [Название]", replyParams());
        }

        if (cmdWord === 'страна') {
            const countryName = parts.slice(1).join(' ');
            const validCountries = ['Россия', 'Чеченская Республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];
            const found = validCountries.find(c => c.toLowerCase() === countryName.toLowerCase());
            if (!found) return await message.reply("❌ Нет такой страны. Список: страны");
            await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [found, String(userId)]);
            return await message.reply(`✅ Вы получили гражданство: ${found}!`, replyParams());
        }

        // --- ДОЛГИ (С КНОПКАМИ) ---
        if (cmdWord === 'датьдолг') {
            if (!message.hasReplyMessage) return await message.reply("❌ Ответьте на сообщение того, кому даете долг: датьдолг [сумма] [дней]");
            const targetId = message.replyMessage.senderId;
            if (targetId === userId) return await message.reply("❌ Себе нельзя.");
            
            const amount = parseAmount(parts[1]);
            const days = parseInt(parts[2]);
            
            if (!amount || amount < 100) return await message.reply("❌ Мин. сумма 100$.");
            if (!days || days < 1 || days > 7) return await message.reply("❌ Срок от 1 до 7 дней.");
            if (balance < amount) return await message.reply("❌ Недостаточно средств.");
            
            await updateBalance(userId, -amount);
            const result = await dbRun("INSERT INTO debts (lender, borrower, amount, days, status) VALUES (?, ?, ?, ?, 'pending')", [String(userId), String(targetId), amount, days]);
            const debtId = result.lastID;
            
            return await message.reply(`🤝 Заявка на долг! Сумма: ${formatMoney(amount)}$, Срок: ${days} дн.\n👉 ${await getFullName(targetId)}, нажмите кнопку:`, replyParams(getDebtKb(debtId)));
        }

        // --- РЕПОРТЫ (МОЩНАЯ СИСТЕМА) ---
        if (cmdWord === 'report') {
            const reportText = parts.slice(1).join(' ');
            if (!reportText) return await message.reply("❌ Формат: report [текст жалобы]");

            const existingReport = await dbGet("SELECT id FROM reports WHERE reporter_id = ? AND status != 'closed'", [String(userId)]);
            if (existingReport) return await message.reply("⏳ У вас уже есть активный репорт! Дождитесь ответа администратора, прежде чем создавать новый.");

            const result = await dbRun("INSERT INTO reports (reporter_id, text, chat_id, status) VALUES (?, ?, ?, 'pending')", [String(userId), reportText, String(peerId)]);
            const reportId = result.lastID;

            const adminKb = getAdminReportKb(reportId);
            const adminMsg = `📩 НОВЫЙ РЕПОРТ #${reportId}\n👤 От: [id${userId}|Игрок]\n💬 Текст: "${reportText}"`;

            try {
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: adminMsg, keyboard: adminKb.toString(), random_id: Math.floor(Math.random() * 1000000000) });
            } catch(e) {}

            return await message.reply("✅ Ваш репорт отправлен администрации. Ожидайте ответа.");
        }

        // --- ПРОФИЛЬ (С сим-картой и аватаркой) ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house' LIMIT 1", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage' LIMIT 1", [String(userId)]);
            const bizData = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            const carsArr = JSON.parse(userRow.cars || '[]');
            
            const premStr = isPremium ? `До ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}` : "Нет";
            const bizStr = bizData ? bizData.biz_name : "Нет";
            const carsStr = carsArr.length > 0 ? carsArr.join(', ') : "Нет";
            const simStr = userRow.sim_card || "Нет";

            const profText = `🏠 Профиль ${await getFullName(userId)}\n\n💵 Баланс: ${formatMoney(balance)}$\n📱 Тел: ${simStr}\n💎 Премиум: ${premStr}\n⭐ Реп: ${rep}\n📊 Уровень: ${userRow.level} (${userRow.xp}/${userRow.level*500} XP)\n\n🏢 Бизнес: ${bizStr}\n🏠 Дом: ${houseData ? houseData.location + ' Т' + houseData.tier : "Нет"}\n🏘️ Гараж: ${garageData ? garageData.location + ' Т' + garageData.tier : "Нет"}\n🚗 Машины (${carsArr.length}/10): ${carsStr}\n🏛️ Организация: ${userRow.org || "Нет"}\n🌍 Страна: ${userRow.country || "Нет"}\n👕 Одежда: ${userRow.clothes ? "Надета" : "Базовая"}\n\n🆔 ID: ${userId}`;

            let attachment = null;
            try {
                const photoBuffer = await generateProfileImage(userId);
                if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
            } catch(e) {}

            return await message.reply({ message: profText, attachment: attachment || undefined, disable_mentions: 1 });
        }

        // --- МАШИНЫ ---
        if (cmdWord === 'машины') {
            let txt = "🚗 Автосалон:\n\n";
            for (const [key, data] of Object.entries(CARS_DATA)) txt += `${data.name} — ${formatMoney(data.price)}$\n`;
            return await message.reply(txt + "\n🛒 Купить: купить машина [Название]", replyParams());
        }

        if (cmdWord === 'купить' && parts[1] === 'машина') {
            const query = parts.slice(2).join(' ').toLowerCase().trim();
            if (!query) return await message.reply("❌ Укажите название: купить машина м5 ф90");
            
            let selectedCar = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { selectedCar = data; break; }
            }
            if (!selectedCar) return await message.reply("❌ Нет такой машины. Список: машины");

            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length >= 10) return await message.reply("❌ У вас уже 10 машин.");
            if (balance < selectedCar.price) return await message.reply(`❌ Не хватает! Нужно ${formatMoney(selectedCar.price)}$`);

            await updateBalance(userId, -selectedCar.price);
            carsArr.push(selectedCar.name);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🎉 Куплено: ${selectedCar.name}!`, replyParams());
        }

        if (cmdWord === 'sellcar' || cmdWord === 'слить') {
            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length === 0) return await message.reply("❌ Нет машин для продажи.");

            const carName = carsArr.pop();
            let carData = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.name === carName) { carData = data; break; }
            }
            if (!carData) {
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                return await message.reply("❌ Ошибка базы.", replyParams());
            }

            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🚗 Вы слили ${carData.name} за +${formatMoney(sellPrice)}$!`, replyParams());
        }

        // --- БИЗНЕС (ПОФИКШЕН) ---
        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Бизнесы (Макс 1 на игрока):\n\n";
            for (const [key, data] of Object.entries(BIZ_DATA)) bizText += `${data.name} — ${formatMoney(data.price)}$\n`;
            return await message.reply(bizText + "\n🛒 Купить: купитьбиз [Название]", replyParams());
        }

        if (cmdWord === 'купитьбиз') {
            const bizQuery = parts.slice(1).join(' ').toLowerCase().trim();
            if (!bizQuery) return await message.reply("❌ Укажите бизнес: купитьбиз Шаурма");
            
            if (await dbGet("SELECT user_id FROM businesses WHERE user_id = ?", [String(userId)])) return await message.reply("❌ У вас уже есть бизнес.");

            let selectedBiz = null;
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { selectedBiz = data; break; }
            }
            if (!selectedBiz) return await message.reply("❌ Нет такого бизнеса. Список: бизнес");
            if (balance < selectedBiz.price) return await message.reply(`❌ Не хватает! Нужно ${formatMoney(selectedBiz.price)}$`);

            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
            return await message.reply(`🎉 Куплено: ${selectedBiz.name}!`, replyParams());
        }

        if (cmdWord === 'мойбизнес') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ У вас нет бизнеса. Купить: бизнес");
            
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
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
                message: `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовысить: ${formatMoney(nextLevelCost)}$`,
                attachment: attachment || undefined,
                keyboard: getBizKb(userId)
            });
        }

        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ У вас нет бизнеса.");

            const now = Date.now();
            const lastWithdraw = Number(biz.last_withdraw) || 0;
            const cd = 3600000; // 1 час (3600000 мс)

            if (now - lastWithdraw < cd) {
                const remaining = cd - (now - lastWithdraw);
                const m = Math.floor(remaining / 60000);
                return await message.reply(`⏳ Выводить можно раз в час. Ждите ${m} мин.`);
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;

            if (totalBalance <= 0) return await message.reply("❌ Ошибка, у вас на балансе 0 т.к вы вывели деньги недавно.");

            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            return await message.reply(`💸 Вы вывели ${formatMoney(totalBalance)}$! Следующий вывод через час.`, replyParams());
        }

        // --- ТОП ---
        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(peerId)]);
            let topText = "⭐ ТОП 10 ПО СООБЩЕНИЯМ\n\n";
            
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
            } else topText += "Пусто.";

            return await message.reply(topText, replyParams(getTopKb(userId, 'coins', 'chat')));
        }

        // --- ИГРЫ (БЕЗ ЛИМИТОВ) ---
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            if (Date.now() - lastPlayed < 10000) return await message.reply(`⏳ Подождите ${Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000)} сек.`);
            gameCooldowns.set(userId, Date.now());
        }

        if (cmdWord === 'монетка') {
            let side = ["орел", "решка"].find(s => parts.includes(s));
            if (!side) return await message.reply("❌ Выберите 'орел' или 'решка'");
            let betStr = parts.find(p => p !== side);
            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Ошибка ставки (мин. 100$).");

            await updateBalance(userId, -bet);
            const res = Math.random() < 0.5 ? 'орел' : 'решка';
            if (res === side) await updateBalance(userId, bet * 2);
            return await message.reply(`🪙 Выпал: ${res}\n` + (res === side ? `✅ Выиграли ${formatMoney(bet*2)}$` : `❌ Проиграли ${formatMoney(bet)}$`) + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`);
        }

        if (cmdWord === 'краш') {
            const autoStop = parseFloat(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (isNaN(autoStop) || autoStop < 1.01 || isNaN(bet) || bet < 100 || bet > balance) return await message.reply("❌ Ошибка параметров.");
            
            await updateBalance(userId, -bet);
            const rand = Math.random();
            let crashPoint = rand > 0.03 ? Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100 : 1.00;
            
            if (crashPoint >= autoStop) {
                const win = Math.floor(bet * autoStop);
                await updateBalance(userId, win);
                return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n✅ Выиграли ${formatMoney(win)}$!`);
            } else return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n❌ Проиграли ${formatMoney(bet)}$`);
        }

        if (cmdWord === 'стакан') {
            let cup = parseInt(parts[1]) || parseInt(parts[2]);
            let bet = parseAmount(parts.find(p => !isNaN(parseInt(p)) && parseInt(p) > 3));
            if (bet === 'ALL') bet = balance;
            if (cup < 1 || cup > 3 || bet < 100 || bet > balance) return await message.reply("❌ Ошибка.");
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 3) + 1;
            if (res === cup) { await updateBalance(userId, bet * 3); return await message.reply(`🥤 Шарик под ${res}\n✅ Выиграли ${formatMoney(bet*3)}$!`); }
            else return await message.reply(`🥤 Шарик под ${res}\n❌ Проиграли ${formatMoney(bet)}$`);
        }

        if (cmdWord === 'кубик') {
            let guess = parseInt(parts[1]) || parseInt(parts[2]);
            let bet = parseAmount(parts.find(p => !isNaN(parseInt(p)) && parseInt(p) > 6));
            if (bet === 'ALL') bet = balance;
            if (guess < 1 || guess > 6 || bet < 100 || bet > balance) return await message.reply("❌ Ошибка.");
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 6) + 1;
            if (res === guess) { await updateBalance(userId, bet * 6); return await message.reply(`🎲 Выпало ${res}\n✅ Выиграли ${formatMoney(bet*6)}$!`); }
            else return await message.reply(`🎲 Выпало ${res}\n❌ Проиграли ${formatMoney(bet)}$`);
        }

        if (cmdWord === 'автомат' || cmdWord === 'блэкджек' || cmdWord === 'дрим') {
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Ошибка ставки.");
            await updateBalance(userId, -bet);
            
            if (cmdWord === 'автомат') {
                const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
                const r1 = emojis[Math.floor(Math.random() * 5)], r2 = emojis[Math.floor(Math.random() * 5)], r3 = emojis[Math.floor(Math.random() * 5)];
                let win = (r1 === r2 && r2 === r3) ? bet * 10 : (r1 === r2 || r2 === r3 || r1 === r3) ? bet * 2 : 0;
                if (win) { await updateBalance(userId, win); return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n✅ Выиграли ${formatMoney(win)}$!`); }
                return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n❌ Проиграли ${formatMoney(bet)}$`);
            }
            if (cmdWord === 'блэкджек') {
                const p = Math.floor(Math.random() * 10) + 12, d = Math.floor(Math.random() * 10) + 12;
                if (p > d && p <= 21) { await updateBalance(userId, bet * 2); return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n✅ Выиграли ${formatMoney(bet*2)}$!`); }
                return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n❌ Проиграли ${formatMoney(bet)}$`);
            }
            if (cmdWord === 'дрим') {
                const guess = parseInt(parts[1]);
                const betStr = parts[2];
                let actualBet = parseAmount(betStr);
                if (actualBet === 'ALL') actualBet = balance;
                if (!guess || guess < 1 || guess > 5) return await message.reply("❌ Числа 1-5.");
                await updateBalance(userId, -actualBet);
                const res = Math.floor(Math.random() * 10) + 1;
                if (res === guess) { const win = actualBet * guess; await updateBalance(userId, win); return await message.reply(`💎 Выпало ${res}\n✅ Выиграли ${formatMoney(win)}$!`); }
                return await message.reply(`💎 Выпало ${res}\n❌ Проиграли ${formatMoney(actualBet)}$`);
            }
        }

        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            let choice = parts[1];
            let betStr = parts[2];
            if (!isNaN(parseInt(parts[1]))) { choice = parts[2]; betStr = parts[1]; } // поддержка "рулетка 5000 красное"

            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Ошибка ставки.");

            const validRed = ["красное", "красный", "кр"];
            const validBlack = ["черное", "черный", "чр"];
            const validEven = ["чет", "четное"];
            const validOdd = ["нечет", "нечетное"];

            const res = Math.floor(Math.random() * 36) + 1; // Только 1-36 (без 0)
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            let isWin = false;
            let cName = redNumbers.includes(res) ? "Красное" : "Черное";
            let cColor = redNumbers.includes(res) ? 'red' : 'black';

            if (parseInt(choice) === res) isWin = true;
            else if (validRed.includes(choice) && redNumbers.includes(res)) isWin = true;
            else if (validBlack.includes(choice) && !redNumbers.includes(res)) isWin = true;
            else if (validEven.includes(choice) && res % 2 === 0) isWin = true;
            else if (validOdd.includes(choice) && res % 2 !== 0) isWin = true;

            if (isWin) await updateBalance(userId, bet);
            else await updateBalance(userId, -bet);

            let attachment = null;
            try {
                const photoBuffer = await generateRouletteImage(res, cColor);
                if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
            } catch(e) {}

            const msgText = `🎰 Выпало: ${res} (${cName})\n\n` + (isWin ? `✅ Выигрыш: +${formatMoney(bet)}$` : `😔 Проигрыш: -${formatMoney(bet)}$`) + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;
            return await message.reply({ message: msgText, attachment: attachment || undefined, disable_mentions: 1 });
        }

        if (cmdWord === 'фортуна') {
            const currentTime = Math.floor(Date.now() / 1000);
            const lastUse = (await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]))?.last_used || 0;
            if (currentTime - lastUse < 600) return await message.reply(`⏳ Ждите ${Math.floor((600 - (currentTime - lastUse)) / 60)} мин.`);
            if (balance < 100) return await message.reply("❌ Стоит 100$.");

            await updateBalance(userId, -100);
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);
            const prize = [0, 50, 100, 200, 500, 1000, 5000][Math.floor(Math.random() * 7)];
            await updateBalance(userId, prize);
            return await message.reply(`🎰 Выпало: ${formatMoney(prize)}$!`);
        }

        if (cmdWord === 'мины') {
            let bet = parseAmount(parts[1]) || 100;
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Ошибка.");

            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
            return await message.reply(`💣 Мины\nСтавка: ${bet}$\n\nВыберите количество мин:`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (!message.hasReplyMessage) return await message.reply("❌ Ответьте на сообщение того, кому переводите.");
            const amount = parseAmount(parts[1]);
            if (!amount || amount === 'ALL' || amount < 50 || amount > balance) return await message.reply("❌ Ошибка суммы.");
            await updateBalance(userId, -amount);
            await updateBalance(message.replyMessage.senderId, amount);
            return await message.reply(`💸 Переведено ${formatMoney(amount)}$!`);
        }

        if (cmdWord === 'duel') {
            const bet = parseAmount(parts[1]);
            if (!bet || bet === 'ALL' || bet < 50 || bet > balance) return await message.reply("❌ Ошибка ставки.");
            const duelId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
            return await message.reply(`⚔️ Дуэль!\nСоздатель: ${await getFullName(userId)}\nСтавка: ${bet}$`, replyParams(getDuelKb(duelId)));
        }

        if (cmdWord === 'бонус') {
            const todayStr = new Date().toISOString().split('T')[0];
            if (userRow.last_bonus_date === todayStr) return await message.reply(`⏳ Бонус уже получен сегодня! Стрик: ${userRow.bonus_streak} дн.`);

            let streak = userRow.bonus_streak || 0;
            if (userRow.last_bonus_date) {
                const diffDays = Math.ceil(Math.abs(new Date(todayStr) - new Date(userRow.last_bonus_date)) / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) streak++; else streak = 1;
            } else streak = 1;

            let amount = isPremium ? 3000 : 1000;
            await updateBalance(userId, amount);
            await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [todayStr, streak, String(userId)]);
            return await message.reply(`🎁 Бонус!\n🔥 Стрик: ${streak} дн.\n💰 +${formatMoney(amount)}$`);
        }

        // ================= АДМИНСКИЕ КОМАНДЫ =================
        if (userId === ADMIN_ID) {
            if (cmdWord === 'cl') {
                const targetQuery = parts.slice(1).join(' ').trim().toLowerCase();
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, sim_card = NULL");
                    await dbRun("DELETE FROM chat_messages");
                    await dbRun("DELETE FROM businesses");
                    await dbRun("DELETE FROM properties");
                    return await message.reply("💥 ПОЛНЫЙ СБРОС ВСЕХ ИГРОКОВ И ТОПОВ ВЫПОЛНЕН!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'cl');
                    if (!targetId) return await message.reply("⚠️ Укажите пользователя или напишите 'all'.");
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, sim_card = NULL WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM chat_messages WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`💥 Полный сброс игрока ${await getFullName(targetId)} выполнен!`);
                }
            }

            if (cmdWord === 'снятьпред') {
                const { targetId } = await getTargetAndReason(message, 'снятьпред');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ С игрока ${await getFullName(targetId)} сняты все предупреждения.`);
            }

            if (cmdWord === 'объявление') {
                const txt = text.replace(/объявление\s*/i, '');
                if (!txt) return await message.reply("❌ Введите текст.");
                
                const allUsers = await dbAll("SELECT user_id FROM users");
                const allChats = await dbAll("SELECT DISTINCT peer_id FROM chat_messages WHERE peer_id > 2000000000");
                
                let sent = 0;
                for (const u of allUsers) {
                    try { await vk.api.messages.send({ peer_id: u.user_id, message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, random_id: Math.floor(Math.random() * 1000000000) }); sent++; } catch(e) {}
                }
                for (const c of allChats) {
                    try { await vk.api.messages.send({ peer_id: c.peer_id, message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, random_id: Math.floor(Math.random() * 1000000000) }); sent++; } catch(e) {}
                }
                return await message.reply(`✅ Разослано: ${sent} получателям.`);
            }

            if (cmdWord === 'обнулить') {
                const targetQuery = parts.slice(1).join(' ').trim().toLowerCase();
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0");
                    await dbRun("UPDATE businesses SET balance = 0");
                    return await message.reply("💥 Балансы ВСЕХ обнулены!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'обнулить');
                    if (!targetId) return await message.reply("⚠️ Укажите пользователя или 'all'.");
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`💥 Баланс ${await getFullName(targetId)} обнулен!`);
                }
            }

            if (cmdWord === 'выдать') {
                let amount = 0, targetId = null;
                for (const arg of parts.slice(1)) {
                    const parsed = parseAmount(arg);
                    if (parsed > 0 && parsed !== 'ALL') amount = parsed;
                }
                if (amount <= 0) return await message.reply("❌ Укажите сумму.");
                
                if (cleanText.includes('all') || cleanText.includes('все')) {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Выдано всем по ${formatMoney(amount)}$!`);
                }
                const { targetId: tId } = await getTargetAndReason(message, 'выдать');
                if (!tId) return await message.reply("⚠️ Укажите пользователя или 'all'.");
                await updateBalance(tId, amount);
                return await message.reply(`💰 Выдано ${formatMoney(amount)}$ игроку ${await getFullName(tId)}!`);
            }

            if (cmdWord === 'cc') {
                await dbRun("DELETE FROM promos");
                return await message.reply("✅ Промокоды удалены.");
            }

            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                return await message.reply(`💳 Баланс: ${formatShortMoney(await getBalance(targetId))}$`);
            }

            if (cmdWord === 'настройки') {
                return await message.reply(`⚙️ Настройки антиспама:`, { keyboard: await getSettingsKb((await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value) });
            }

            if (cmdWord === 'создать') {
                if (parts.length === 4) {
                    await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], parseAmount(parts[2]), parseAmount(parts[3])]);
                    return await message.reply(`✅ Промокод ${parts[1]} создан.`);
                }
                return await message.reply("❌ Формат: создать [код] [сумма] [лимит]");
            }

            if (cmdWord === 'чсб' || cmdWord === 'разчсб' || cmdWord === 'mute' || cmdWord === 'unmute' || cmdWord === 'kick' || cmdWord === 'ban' || cmdWord === 'unban' || cmdWord === 'заморозить' || cmdWord === 'разморозить') {
                // Используем логику из предыдущих частей (вставить сюда, они стандартные)
                const { targetId, reason } = await getTargetAndReason(message, cmdWord);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                if (cmdWord === 'чсб') {
                    await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), reason, 0]);
                    return await message.reply("✅ Занесен в ЧС.");
                }
                if (cmdWord === 'разчсб') {
                    await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                    return await message.reply("✅ Снят с ЧС.");
                }
                if (cmdWord === 'mute') {
                    await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(targetId), String(peerId), Date.now() + 600000, reason]);
                    await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'ro', for: 600 });
                    return await message.reply("✅ Замучен.");
                }
                if (cmdWord === 'unmute') {
                    await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'none', for: 0 });
                    return await message.reply("✅ Размучен.");
                }
                if (cmdWord === 'kick') {
                    await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply("✅ Кикнут.");
                }
                if (cmdWord === 'ban') {
                    await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(targetId), String(peerId), reason]);
                    await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply("✅ Забанен в беседе.");
                }
                if (cmdWord === 'unban') {
                    await dbRun("DELETE FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    return await message.reply("✅ Разбанен в беседе.");
                }
            }
        }
        
        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (rows.length === 0) return await message.reply("❌ Нет промокодов.");
            let txt = "🎁 Промокоды:\n";
            for (const r of rows) txt += `▪️ ${r.code} — ${r.amount}$\n`;
            return await message.reply(txt);
        }

        if (cmdWord === 'promo') {
            if (parts.length !== 2) return await message.reply("❌ Формат: promo [код]");
            const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
            if (!row) return await message.reply("❌ Не существует.");
            const usedBy = row.used_by ? row.used_by.split(",") : [];
            if (usedBy.length >= row.limit_count) { await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]); return await message.reply("❌ Исчерпан."); }
            if (usedBy.includes(String(userId))) return await message.reply("❌ Вы уже активировали.");
            
            usedBy.push(String(userId));
            await updateBalance(userId, row.amount);
            await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [usedBy.join(","), parts[1]]);
            return await message.reply(`✅ Активирован! +${row.amount}$`);
        }

        return;

    } catch (error) {
        console.error("ОШИБКА:", error);
        try { await message.reply(`⚠️ Ошибка: ${error.message}`, { disable_mentions: 1 }); } catch (e) {}
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
            if (payload.action === 'work') return await vk.api.messages.send({ peer_id: peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), random_id: Math.floor(Math.random() * 1000000000) });
            if (payload.action === 'roulette') return await vk.api.messages.send({ peer_id: peerId, message: "🎰 Напишите: рулетка [цвет] [ставка]\nПример: рулетка красное все", random_id: Math.floor(Math.random() * 1000000000) });
            if (payload.action === 'profile') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите профиль", random_id: Math.floor(Math.random() * 1000000000) });
            if (payload.action === 'top') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите топ", random_id: Math.floor(Math.random() * 1000000000) });
        }

        // --- СИСТЕМА РЕПОРТОВ (АДМИН) ---
        if (payload.cmd === 'report_reply') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Репорт уже закрыт или не существует.' });

            await safeAnswer();
            adminStates.set(ADMIN_ID, `reply_${payload.report_id}`);
            return await vk.api.messages.send({
                peer_id: peerId,
                message: `✍️ Напишите текст ответа для игрока [id${report.reporter_id}|Игрок] в ЛС прямо сейчас:`,
                random_id: Math.floor(Math.random() * 1000000000)
            });
        }

        if (payload.cmd === 'report_spam') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });

            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Репорт уже закрыт.' });

            // Наказываем того, кто отправил спам-жалобу (reporter_id)
            const reporterId = report.reporter_id;
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
            let warns = w ? w.count + 1 : 1;
            
            const spamMsg = `❌ ВАШ РЕПОРТ ОТКЛОНЕН!\n\nПричина: СПАМ.\nВаш счет: ${warns}/3.\n⚠️ При 3-х предупреждениях вы будете автоматически отправлены в ЧС!\n\nКто выдал: [id${ADMIN_ID}|Администратор].`;

            if (warns >= 3) {
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Спам (3/3)", Date.now() + 86400000]); // 1 день ЧС
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                try {
                    const banKb = Keyboard.builder().inline()
                        .urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` })
                        .row().urlButton({ label: 'Правила бота', url: `https://vk.ru/topic-243089386_69454146` });
                    await vk.api.messages.send({ peer_id: reporterId, message: spamMsg + `\n\n😈 Вы отправлены в ЧС на 1 день.`, keyboard: banKb.toString(), random_id: Math.floor(Math.random()*1000000000) });
                } catch(e){}
            } else {
                await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                try {
                    await vk.api.messages.send({ peer_id: reporterId, message: spamMsg, random_id: Math.floor(Math.random()*1000000000) });
                } catch(e){}
            }
            
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Репорт отклонен (Спам)' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Репорт отклонен как Спам.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // --- ОЦЕНКА РЕПОРТА (ИГРОК) ---
        if (payload.cmd === 'report_rate_start') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Ошибка.' });
            if (String(userId) !== report.reporter_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это не ваш репорт.' });
            if (report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы уже оценили.' });

            await safeAnswer();
            adminStates.set(userId, `rating_${report.id}`);
            return await vk.api.messages.send({
                peer_id: peerId,
                message: `⭐ Оцените работу администратора!\nНапишите оценку от 1 до 10 одним числом:`,
                random_id: Math.floor(Math.random() * 1000000000)
            });
        }

        if (payload.cmd === 'report_bad_reason') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Уже оценено.' });

            await dbRun("UPDATE reports SET status = 'closed', rate_reason = ? WHERE id = ?", [payload.reason, payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Жалоба отправлена.' });
            
            try {
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: `⚠️ Отзыв по репорту #${report.id}!\n👤 Игрок: [id${report.reporter_id}|Игрок]\n📊 Оценка: Недоволен\n💬 Причина: ${payload.reason}`, random_id: Math.floor(Math.random() * 1000000000) });
            } catch(e) {}

            return await vk.api.messages.edit({
                peer_id: peerId, message: `🙏 Спасибо за ваш ответ!\nМы зафиксировали: ${payload.reason}.\nРепорт закрыт.`, keyboard: "", conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'report_close') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Ошибка.' });
            
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Репорт закрыт.' });
            return await vk.api.messages.edit({
                peer_id: peerId, message: `✅ Вы закрыли репорт. Спасибо за обращение!`, keyboard: "", conversation_message_id: context.conversationMessageId
            });
        }

        // --- ДОЛГИ ---
        if (payload.cmd === 'debt_accept') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Заявка устарела.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это не ваша заявка.' });

            await dbRun("UPDATE debts SET status = 'accepted' WHERE id = ?", [debt.id]);
            await updateBalance(userId, debt.amount);
            await safeAnswer({ type: 'show_snackbar', text: '✅ Долг принят!' });
            
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `✅ Игрок [id${userId}|Игрок] принял ваш долг на ${formatMoney(debt.amount)}$.`, random_id: Math.floor(Math.random()*1000000000) }); } catch(e) {}
            
            return await vk.api.messages.edit({
                peer_id: peerId, message: `🤝 Долг принят! Вы получили ${formatMoney(debt.amount)}$. Не забудьте вернуть через ${debt.days} дн.`, keyboard: "", conversation_message_id: context.conversationMessageId
            });
        }

        if (payload.cmd === 'debt_decline') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Заявка устарела.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это не ваша заявка.' });

            await dbRun("UPDATE debts SET status = 'declined' WHERE id = ?", [debt.id]);
            await updateBalance(debt.lender, debt.amount); // Возврат денег
            await safeAnswer({ type: 'show_snackbar', text: '❌ Отказано. Деньги вернулись отправителю.' });
            
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `❌ Игрок [id${userId}|Игрок] отказался от долга. Деньги возвращены.`, random_id: Math.floor(Math.random()*1000000000) }); } catch(e) {}

            return await vk.api.messages.edit({
                peer_id: peerId, message: `❌ Вы отказались от долга.`, keyboard: "", conversation_message_id: context.conversationMessageId
            });
        }

        // --- МАГАЗИН ОДЕЖДЫ ---
        if (payload.cmd === 'shop_cat') {
            const cat = payload.cat;
            const items = {
                'hat': [ {n: 'Зеленая кепка', p: 5000, img: 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0'} ],
                'shirt': [ {n: 'Белая футболка', p: 3000, img: 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0'} ],
                'jeans': [ {n: 'Синие джинсы', p: 4000, img: 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0'} ],
                'shoes': [ {n: 'Кроссовки', p: 6000, img: 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0'} ]
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
            
            const now = Date.now();
            const lastWithdraw = Number(biz.last_withdraw) || 0;
            const cd = 3600000;

            if (now - lastWithdraw < cd) {
                const remaining = cd - (now - lastWithdraw);
                const m = Math.floor(remaining / 60000);
                return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${m} мин.` });
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const total = Number(biz.balance) + earned;
            
            if (total <= 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Недостаточно средств в бизнесе.' });
            
            await updateBalance(userId, total);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
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
            
            const newMsgText = `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level + 1}/5\n🐱 ${formatMoney(bizData.baseIncome * (biz.level + 1) * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение уровня стоит: ${formatMoney((biz.level + 1) * 5000000)}$\n\n👉 Чтобы вывести деньги, напишите в чат вывести`;
            
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
                if (carsArr.length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Для работы в такси нужна машина! Купите её в разделе машины' });
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
                    return await vk.api.messages.edit({ peer_id: peerId, message: "🎉 Вы подключили бота к беседе!\nЧтобы узнать подробности напишите help", disable_mentions: 1, keyboard: "", conversation_message_id: context.conversationMessageId });
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
            if (payload.section === 'games') msg = "🎰 Игровые команды (без слэша):\nрулетка [цвет/чет] [ставка]\nкраш [автостоп] [ставка]\nмонетка [орел/решка] [ставка]\nстакан [1-3] [ставка]\nкубик [1-6] [ставка]\nавтомат [ставка]\nблэкджек [ставка]\nдрим [1-5] [ставка]\nмины [ставка]\nфортуна\n\n⚠️ Мин. ставка: 100$. Ставка 'все' разрешена.";
            if (payload.section === 'eco') msg = "💼 Экономика:\nбизнес\nкупитьбиз [название]\nмойбизнес\nвывести\nбонус\ntransfer [сумма] (ответом)\nduel [сумма]\npromo [код]\nпромолист\nмашины\nкупить машина [название]\nsellcar (слить машину)\nдон дом\nдон гараж\nдатьдолг [сумма] [дней] (ответом)\nкупитьсим\nслитьсим";
            if (payload.section === 'profile') msg = "👤 Профиль и прочее:\nпрофиль\nтоп\nrep +/- (ответом или @ник)\nпинг\npremium\nмагаз вещей\n\n💡 Слэш (/) писать необязательно!";
            if (payload.section === 'reports') msg = "📩 Система жалоб:\nreport [текст] - Пожаловаться админу (в ЛС или беседе)\nадмин - Вызвать админа (ответом на сообщение)";
            if (payload.section === 'org') msg = "🏛️ Организации и Страны:\nорганизации (Список)\nвступить [Название]\nстраны (Список)\nстрана [Название]";
            
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                    txt += `📍 ${data.name} (${countRow.c}/20)\n└ Свободно мест: ${20 - countRow.c}\n`;
                }
                txt += `\n💡 Купить: купить дом топ [номер] [Локация]\n💡 Продать: продать дом [сумма] (ответом)\n🏆 Доны: дон дом`;
                msg = txt;
            }
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                    const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                    txt += `📍 ${data.name} (${countRow.c}/20)\n└ Свободно мест: ${20 - countRow.c}\n`;
                }
                txt += `\n💡 Купить: купить гараж топ [номер] [Локация]\n💡 Продать: продать гараж [сумма] (ответом)\n🏆 Доны: дон гараж`;
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
            let statusText = newVal === '1' ? "🟢 Включен" : "🔴 Выключен";
            return await vk.api.messages.edit({ peer_id: peerId, message: `⚙️ Настройки антиспама:\n\nСтатус: ${statusText}\n\nНажмите на кнопку, чтобы изменить параметр.`, keyboard: await getSettingsKb(newVal, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value, (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value), conversation_message_id: context.conversationMessageId });
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
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Меню вызвано другим пользователем!' });
            
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
                // Только те, кто есть в беседе (писал сообщения)
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

        // --- ДУЭЛЬ ---
        if (payload.cmd === 'duel_accept') {
            const duelId = payload.duel_id;
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [duelId]);
            
            if (row) {
                if (String(userId) === row.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нельзя драться с собой!' });
                if (await getBalance(userId) < row.bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не хватает денег!' });
                
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
                    keyboard: "", disable_mentions: 1, conversation_message_id: context.conversationMessageId
                });
            }
        }

        // --- МИНЫ ---
        if (payload.cmd === 'mines_set') {
            const gameId = String(payload.gameId);
            const count = Number(payload.count);
            
            const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра устарела.' });

            const minesArr = [];
            while(minesArr.length < count) {
                const r = Math.floor(Math.random() * 9) + 1;
                if (!minesArr.includes(r)) minesArr.push(r);
            }
            await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0, start_time = ? WHERE game_id = ?", [JSON.stringify(minesArr), Date.now(), gameId]);
            
            const name = await getFullName(userId);
            const ui = getMinesGameUI(gameId, row.bet, count, minesArr, [], false, null, name, await getBalance(userId), 60);
            
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'mines_click') {
            const gameId = String(payload.gameId);
            const cell = Number(payload.cell);
            
            const row = await dbGet("SELECT bet, mines, opened, multiplier, start_time FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return;

            const bet = row.bet;
            const mines = JSON.parse(row.mines);
            const opened = JSON.parse(row.opened);
            const startTime = row.start_time;

            if (Date.now() - startTime > 60000) {
                await updateBalance(userId, -bet);
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, true, null, await getFullName(userId), await getBalance(userId));
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: ui.text.replace('наступил(а) на мину!', 'не успел(а) открыть!'), keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
            
            if (opened.includes(cell)) return;

            opened.push(cell);
            let isLoss = false, hitCell = null, currentMoney = 0;

            if (mines.includes(cell)) {
                isLoss = true;
                hitCell = cell;
                await updateBalance(userId, -bet);
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
            } else {
                let currentMult = 1.0;
                for (let i = 0; i < opened.length; i++) currentMult *= (9 - i) / (9 - mines.length - i);
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
                if (hitCell === -1) text = `🏆 ПОБЕДА!\n👤 ${name}\n📈 Выигрыш: +${currentMoney}$\n💳 Баланс: ${formatMoney(balance)}$`;
                return await vk.api.messages.edit({ peer_id: peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            } else {
                const ui = getMinesGameUI(gameId, bet, mines.length, mines, opened, false, null, name, balance);
                const timeLeft = Math.max(0, Math.floor((60000 - (Date.now() - startTime)) / 1000));
                return await vk.api.messages.edit({ peer_id: peerId, message: ui.text.replace('{TIME}', timeLeft), keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
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
            
            await safeAnswer();
            return await vk.api.messages.edit({
                peer_id: peerId,
                message: `💰 ВЫВОД\n👤 ${await getFullName(userId)}\n💵 Забрал: ${winAmount} 💰 (x${row.multiplier})\n💳 Баланс: ${formatMoney(await getBalance(userId))} 💰`,
                keyboard: buildMinesKb(gameId, opened, JSON.parse(row.mines), true, null),
                conversation_message_id: context.conversationMessageId
            });
        }

        await safeAnswer();
    } catch (e) {
        console.error("КРИТИЧЕСКАЯ Ошибка в кнопках:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка. Попробуйте позже.' });
    }
});

// ===== ОБРАБОТКА ОЦЕНОК В ЛС (ЧИСЛА ОТ 1 ДО 10) =====
vk.updates.on('message_new', async (message, next) => {
    if (message.isOutbox || message.senderId < 0) return next();
    
    // Проверка на ввод оценки (только цифры)
    const text = message.text ? message.text.trim() : '';
    if (!text || message.peerId !== message.senderId) return next(); // Только ЛС

    const userId = message.senderId;
    const state = adminStates.get(userId);

    if (state && state.startsWith('rating_')) {
        const reportId = state.split('_')[1];
        const rating = parseInt(text);

        if (isNaN(rating) || rating < 1 || rating > 10) {
            return await message.reply("❌ Пожалуйста, введите число от 1 до 10.");
        }

        adminStates.delete(userId);
        const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
        
        if (report) {
            await dbRun("UPDATE reports SET rating = ? WHERE id = ?", [rating, reportId]);

            if (rating <= 4) {
                const badKb = getBadRateKb(reportId);
                return await message.reply(`😔 Спасибо за ваш отзыв (Оценка: ${rating}/10).\nПодскажите, что именно вам не понравилось?`, { keyboard: badKb });
            } else {
                await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [reportId]);
                
                const goodPhrases = ["Быстрый ответ", "Помог с вопросом", "Вежливый администратор", "Отличная работа", "Всё супер"];
                const phrase = goodPhrases[Math.floor(Math.random() * goodPhrases.length)];
                
                try {
                    await vk.api.messages.send({
                        peer_id: ADMIN_ID,
                        message: `🌟 Отзыв по репорту #${report.id}!\n👤 Игрок: [id${report.reporter_id}|Игрок]\n📊 Оценка: ${rating}/10\n💬 Плюс: ${phrase}`,
                        random_id: Math.floor(Math.random() * 1000000000)
                    });
                } catch(e) {}

                return await message.reply(`🙏 Спасибо за ваш отзыв (Оценка: ${rating}/10).\nМы рады, что смогли помочь! Репорт закрыт.`);
            }
        }
        return;
    }

    return next();
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
            greetText = "Привет! Я Официальный бот Game Zone. Я добавлен в беседу с правами администратора, поэтому все функции доступны. Напишите старт для активации и хелп для списка команд.";
        } else {
            greetText = "Привет! Я Официальный бот Game Zone. Внимание: у меня нет прав администратора в этой беседе, поэтому некоторые функции (мут, кик, антиспам) не будут работать. Чтобы я работал в полную силу, выдайте мне админку. Напишите старт для активации.";
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