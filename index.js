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

const DEFAULT_PROFILE_PHOTO = 'https://sun9-40.userapi.com/s/v1/ig2/NjVI-oWypORWXWSX6D7p537O9zXty6K8h4nYerGEy0bZTHcpbvFY_V1nCbVaWBtfVcte4MHBhJWG5Cbb-b5KaM3o.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&cs=277x0';

const ROULETTE_PHOTOS = [
    'https://sun9-63.userapi.com/s/v1/ig2/to7LopyEWd8Z1KvH7SUG3N1JPeHQpK4NRx_h7wJHnKvpiFbzpGm7k6274tKqxtJkLpU035GKCJTtL9CnOtB5OcM9.jpg?quality=95&as=32x18,48x27,72x40,108x61,160x90,240x135,360x202,480x270,540x304,640x360,720x405,1080x607,1280x720,1440x810,2208x1242&from=bu&cs=2208x0',
];

// ===== ИНИЦИАЛИЗАЦИЯ БОТА =====
const vk = new VK({ 
    token: TOKEN, 
    apiVersion: '5.199',
    pollingGroupId: GROUP_ID 
});

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

const DB_FILE = path.join(DATA_DIR, 'game.db');

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database(DB_FILE);

const dbRun = (query, params = []) => new Promise((res, rej) => db.run(query, params, function(e) { e ? rej(e) : res(this); }));
const dbGet = (query, params = []) => new Promise((res, rej) => db.get(query, params, (e, r) => e ? rej(e) : res(r)));
const dbAll = (query, params = []) => new Promise((res, rej) => db.all(query, params, (e, r) => e ? rej(e) : res(r)));

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const chsbNotifyCache = new Map(); 

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
    'порше': { name: 'Porsche 911 Turbo', price: 28000000, sellPrice: 20000000 },
    'бугатти': { name: 'Bugatti Chiron', price: 0, sellPrice: 0 }
};

const PROPERTY_DATA = {
    'нижегородская': { name: 'Нижегородская', housePrice: 5000000, garagePrice: 1000000 },
    'рублевка': { name: 'Рублевка', housePrice: 25000000, garagePrice: 5000000 },
    'егоровка': { name: 'Егоровка', housePrice: 50000000, garagePrice: 10000000 },
    'гарель': { name: 'Гарель', housePrice: 100000000, garagePrice: 20000000 }
};

// ===== ИНИЦИАЛИЗАЦИЯ БД (С ФИКСОМ ОШИБКИ LAST_RESET) =====
async function initDB() {
    await dbRun("DROP TABLE IF EXISTS reports");

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
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT PRIMARY KEY, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS custom_cmds (user_id TEXT, alias TEXT, real_cmd TEXT, PRIMARY KEY (user_id, alias))");
    await dbRun("CREATE TABLE IF NOT EXISTS warnings (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, lender TEXT, borrower TEXT, amount INTEGER, days INTEGER, status TEXT DEFAULT 'pending')");
    await dbRun("CREATE TABLE IF NOT EXISTS sim_cards (number TEXT PRIMARY KEY, owner_id TEXT)");
    
    // Таблица репортов
    await dbRun("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, text TEXT, status TEXT DEFAULT 'pending', chat_id TEXT, reply_text TEXT, rating INTEGER DEFAULT 0, rate_reason TEXT)");

    // Таблица зимнего ивента
    await dbRun("CREATE TABLE IF NOT EXISTS winter_event (user_id TEXT PRIMARY KEY, reps_given INTEGER DEFAULT 0, game_score INTEGER DEFAULT 0, msgs_sent INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, last_opened INTEGER DEFAULT 0)");
    
    // Таблица лимитов зимних игр (0/10) - СОЗДАЕМ ЗАНОВО ЧТОБЫ ГАРАНТИРОВАТЬ last_reset
    await dbRun("DROP TABLE IF EXISTS winter_limits");
    await dbRun("CREATE TABLE IF NOT EXISTS winter_limits (user_id TEXT PRIMARY KEY, snowballs INTEGER DEFAULT 0, tree INTEGER DEFAULT 0, sleds INTEGER DEFAULT 0, snowman INTEGER DEFAULT 0, gift INTEGER DEFAULT 0, last_reset INTEGER DEFAULT 0)");

    // Таблица призов кейса
    await dbRun("CREATE TABLE IF NOT EXISTS winter_case_prizes (user_id TEXT PRIMARY KEY, bugatti INTEGER DEFAULT 0, premium_forever INTEGER DEFAULT 0)");

    try { await dbRun("ALTER TABLE users ADD COLUMN sim_card TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN cars TEXT DEFAULT '[]'"); } catch(e) {}

    console.log("--- БАЗА ДАННЫХ ГОТОВА (ФИКС WINTER_LIMITS) ---");
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
        
        try {
            const font = await Jimp.loadFont("https://raw.githubusercontent.com/Fluffffy/jimp-cyrillic-fonts/master/fonts/open-sans-32-white/open-sans-32-white.fnt");
            if (font) {
                canvas.print(font, 0, 405, { text: nameText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 400, 40);
            }
        } catch(e) {
            try {
                const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
                canvas.print(font, 0, 405, { text: nameText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 400, 40);
            } catch(e2) {
                console.log("Шрифты недоступны, профиль без текста.");
            }
        }

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
        const avatar = await Jimp.read(avatarUrl); avatar.cover(200, 200);
        const canvas = new Jimp(800, 400, 0x101010FF); 
        canvas.composite(avatar, 50, 100);
        
        try {
            const font = await Jimp.loadFont("https://raw.githubusercontent.com/Fluffffy/jimp-cyrillic-fonts/master/fonts/open-sans-32-white/open-sans-32-white.fnt");
            if (font) {
                canvas.print(font, 300, 150, `Бизнес: ${nameText}`); 
                canvas.print(font, 300, 200, `${bizName}`); 
            }
        } catch(e) {}
        
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) { return null; }
}

async function generateRouletteImage(number, color) {
    try {
        const img = await Jimp.read(ROULETTE_PHOTOS[0]);
        const width = img.bitmap.width;
        const height = img.bitmap.height;
        
        const canvas = new Jimp(width, height + 150, 0x101010FF);
        canvas.composite(img, 0, 0);
        
        let barColor = 0xD32F2FFF; 
        if (color === 'black') barColor = 0x212121FF;
        if (color === 'green') barColor = 0x388E3CFF;
        
        const bar = new Jimp(width, 150, barColor);
        canvas.composite(bar, 0, height);
        
        try {
            const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
            if (font) {
                canvas.print(font, 0, height + 10, { text: String(number), alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, width, 140);
            }
        } catch(e) {}
        
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch(e) { 
        console.error("Ошибка генерации рулетки:", e);
        return null; 
    }
}

function getMinesGameUI(gameId, bet, minesCount, minesArr, opened, isLoss = false, hitCell = null, name = "", balance = 0, timeLeft = 60) {
    const totalSafe = 9 - minesCount;
    const currentOpened = opened.length;
    let currentMult = 1.0;
    for (let i = 0; i < currentOpened; i++) currentMult *= (9 - i) / (9 - minesCount - i);
    currentMult = Math.round(currentMult * 0.95 * 100) / 100;
    const currentMoney = Math.floor(bet * currentMult);
    let nextMult = 1.0;
    if (currentOpened < totalSafe) {
        for (let i = 0; i <= currentOpened; i++) nextMult *= (9 - i) / (9 - minesCount - i);
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
        const randomPhrases = ["Выбирай клетку! Первый ход — самый волнующий 😈", "Чисто! Сапёр бы гордился 👏", "Ещё немного, и можно забирать 💸", "Осторожно, мины рядом... 💣", "Фортуна улыбается тебе 😉"];
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

const getHelpKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🎮 Games', payload: { cmd: 'help_menu', section: 'games' }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '💼 Economy', payload: { cmd: 'help_menu', section: 'eco' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🏠 Houses', payload: { cmd: 'help_menu', section: 'houses' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🏘️ Garages', payload: { cmd: 'help_menu', section: 'garages' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '👤 Profile', payload: { cmd: 'help_menu', section: 'profile' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '📩 Reports', payload: { cmd: 'help_menu', section: 'reports' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🏛️ Orgs', payload: { cmd: 'help_menu', section: 'org' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '❄️ Winter', payload: { cmd: 'help_menu', section: 'winter' }, color: Keyboard.PRIMARY_COLOR })
        .toString();
};

const getHelpBackKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🔙 Back', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
};

// ИСПРАВЛЕННЫЙ ТОП: КНОПКИ "ОБЩЕЕ/В БЕСЕДЕ" ТЕПЕРЬ ВНУТРИ РАЗДЕЛА
const getTopKb = (authorId, type = 'coins', scope = 'chat', repType = 'pos') => {
    const kb = Keyboard.builder().inline();
    
    // 1. Выбор категории (всегда сверху)
    kb.callbackButton({ label: '💰 Coins', payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Leagues', payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '⚔️ Duels', payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Rep', payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    if (type === 'rep') {
        kb.callbackButton({ label: '➕ Positive', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.callbackButton({ label: '➖ Negative', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.row();
    }
    
    kb.callbackButton({ label: '🎁 Bonus', payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    
    // 2. Разделитель и переключатели режима (теперь ВНУТРИ раздела)
    kb.row();
    kb.callbackButton({ label: '🌍 Global', payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 Chat', payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    
    // 3. Кнопка назад в самом низу
    kb.row();
    kb.callbackButton({ label: '🔙 Back', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });
    
    return kb.toString();
};

const getBizKb = (authorId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: 'Withdraw $$$', payload: { cmd: 'biz_withdraw', author: authorId }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: 'Upgrade Level', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🔥 Sell Business', payload: { cmd: 'biz_sell', author: authorId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getAdminReportKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✍️ Reply', payload: { cmd: 'report_reply', report_id: reportId }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '🚫 Spam', payload: { cmd: 'report_spam', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getReportRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⭐ Rate Work', payload: { cmd: 'report_rate_start', report_id: reportId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Close', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getBadRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⏳ No answer', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'No answer' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🚫 Not helpful', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Not helpful' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '❓ Did not understand', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Did not understand' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '😡 Rude', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Rude' }, color: Keyboard.NEGATIVE_COLOR })
        .row()
        .callbackButton({ label: '❌ Close Report', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getGoodRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Fast reply', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Fast reply' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🤝 Solved problem', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Solved problem' }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: '😊 Polite admin', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Polite admin' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🌟 All good!', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'All good!' }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: '❌ Close Report', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getDebtKb = (debtId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Accept', payload: { cmd: 'debt_accept', debt_id: debtId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Decline', payload: { cmd: 'debt_decline', debt_id: debtId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getAdminCallKb = (reporterId, targetId, text) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Accept Complaint', payload: { cmd: 'admin_call_accept', reporter_id: reporterId, target_id: targetId, text: text }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🚫 Spam/Abuse', payload: { cmd: 'admin_call_spam', reporter_id: reporterId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

// ===== ОБРАБОТКА СООБЩЕНИЙ =====
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox || message.senderId < 0) return;

    try {
        let text = message.text ? message.text.trim() : '';
        if (!text) return;

        const userId = message.senderId;
        const peerId = message.peerId;
        const isLs = peerId === userId;

        let cleanText = text.replace(/^\//, '').trim().toLowerCase(); 
        let parts = cleanText.split(/\s+/);
        let cmdWord = parts[0];

        // --- КАСТОМНЫЕ КОМАНДЫ ---
        const customCmd = await dbGet("SELECT real_cmd FROM custom_cmds WHERE user_id = ? AND alias = ?", [String(userId), cmdWord]);
        if (customCmd) {
            cleanText = customCmd.real_cmd; 
            parts = cleanText.split(/\s+/);
            cmdWord = parts[0];
        }

        // --- ЗАМОРОЗКА ---
        if (userId !== ADMIN_ID) {
            const isFrozen = await dbGet("SELECT user_id FROM frozen WHERE user_id = ?", [String(userId)]);
            if (isFrozen) return await message.reply("💀 You are frozen in the bot. Wait for punishment!");
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
                        let timeStr = isBlacklisted.until === 0 ? "FOREVER" : `until ${new Date(isBlacklisted.until).toLocaleString('ru-RU')}`;
                        const banText = `😈 You are in bot blacklist ${timeStr}. Reason: ${isBlacklisted.reason}`;
                        const banKb = Keyboard.builder().inline()
                            .urlButton({ label: 'Appeal', url: `https://vk.ru/topic-243089386_69303056` })
                            .row().urlButton({ label: 'Rules', url: `https://vk.ru/topic-243089386_69454146` });
                        try { await vk.api.messages.send({ peer_id: peerId, message: banText, keyboard: banKb.toString(), random_id: 0, disable_mentions: 1 }); } catch(e) {}
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

        // АНТИСПАМ УДАЛЕН ПОЛНОСТЬЮ

        // --- ОТВЕТЫ НА РЕПОРТЫ (АДМИН) ---
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
                    const replyMsg = `📩 Reply from [id${ADMIN_ID}|Owner]:\n\n${replyText}\n\n👇 Rate the work:`;
                    
                    try {
                        await vk.api.messages.send({ peer_id: report.reporter_id, message: replyMsg, keyboard: replyKb.toString(), random_id: 0 });
                        if (report.chat_id && report.chat_id > 0) {
                            await vk.api.messages.send({ 
                                peer_id: report.chat_id, 
                                message: `📩 Admin replied to report #${reportId} for player [id${report.reporter_id}|Player].`, 
                                random_id: 0, disable_mentions: 1
                            });
                        }
                    } catch(e) {}
                }
                return await message.reply("✅ Reply sent.");
            }
        }

        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cc', 'ping', 'пинг', 'убрать', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'cmd', 'моикоманды', 'premium', 'рег', 'q', 'админ', 'ahelp', 'объявление', 'report', 'вступить', 'организации', 'страна', 'страны', 'датьдолг', 'мойдолг', 'cl', 'снятьпред', 'купитьсим', 'слитьсим', 'event', 'открыть', 'снежки', 'елка', 'санки', 'снеговик', 'подарок', 'слитьбиз', 'logs', 'чсблист', 'banlist'];
        
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

        if (cmdWord === 'start' || cmdWord === 'начать') {
            if (message.isChat) return await message.reply("✅ Bot activated! Type help.", replyParams());
            return await message.reply("👋 Hello! Choose an action.", replyParams(mainKb));
        }

        if (cmdWord === 'help' || cmdWord === 'помощь') {
            return await message.reply("📖 Choose a section:", replyParams(getHelpKb()));
        }

        if (cmdWord === 'ahelp') {
            if (userId !== ADMIN_ID) return;
            let txt = `👑 ADMIN COMMANDS\n\n`;
            txt += `cc - Delete promo codes\n`;
            txt += `announce [text] - Broadcast\n`;
            txt += `give [amount] [@nick/all]\n`;
            txt += `reset [@nick/all]\n`;
            txt += `cl [@nick/all] - Full reset\n`;
            txt += `removewarn [@nick]\n`;
            txt += `blacklist [@nick] [days] [reason]\n`;
            txt += `unblacklist [@nick]\n`;
            txt += `mute [@nick] [min]\n`;
            txt += `kick [@nick] [reason]\n`;
            txt += `logs @vk - Logs (file in DM)\n`;
            txt += `ban @vk [reason] - Ban in chat\n`;
            txt += `unban @vk - Unban\n`;
            txt += `banlist - Chat ban list\n`;
            txt += `blacklistall - Global blacklist\n`;
            return await message.reply(txt);
        }

        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now();
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            return await message.reply(`🏓 Pong: ${Date.now() - start} ms`, replyParams());
        }

        // --- СИМ-КАРТЫ (ВЫБОР НОМЕРА ИГРОКОМ) ---
        if (cmdWord === 'купитьсим') {
            if (userRow.sim_card) return await message.reply(`❌ You already have a sim card (${userRow.sim_card}). First sell it: sellsim`, replyParams());
            
            // Получаем желаемый номер из аргументов
            let desiredNumber = parts[1];
            if (!desiredNumber || desiredNumber.length !== 4 || isNaN(desiredNumber)) {
                return await message.reply("❌ Format: /buysim [4 digits]\nExample: /buysim 7777", replyParams());
            }

            // Проверяем, занят ли номер
            const existing = await dbGet("SELECT owner_id FROM sim_cards WHERE number = ?", [desiredNumber]);
            if (existing) {
                return await message.reply(`❌ Number ${desiredNumber} is already taken by another player! Choose another one.`, replyParams());
            }

            await dbRun("INSERT INTO sim_cards (number, owner_id) VALUES (?, ?)", [desiredNumber, String(userId)]);
            await dbRun("UPDATE users SET sim_card = ? WHERE user_id = ?", [desiredNumber, String(userId)]);
            return await message.reply(`📱 Sim card purchased!\nYour number: ${desiredNumber}`, replyParams());
        }

        if (cmdWord === 'слитьсим') {
            if (!userRow.sim_card) return await message.reply("❌ No sim card.", replyParams());
            await dbRun("DELETE FROM sim_cards WHERE number = ?", [userRow.sim_card]);
            await dbRun("UPDATE users SET sim_card = NULL WHERE user_id = ?", [String(userId)]);
            await updateBalance(userId, 10000);
            return await message.reply(`📱 Sim card sold for 10,000$!`, replyParams());
        }

        // --- РЕПУТАЦИЯ (ФИКС: МОЖНО ДАВАТЬ РАЗНЫМ ЛЮДЯМ) ---
        if (cmdWord === 'rep' || cmdWord === 'реп') {
            if (parts.length < 2) return await message.reply("🔔 Format: /rep + or /rep - @nick", replyParams());
            
            const isPlus = parts[1] === '+';
            const isMinus = parts[1] === '-';
            if (!isPlus && !isMinus) return await message.reply("🔔 Use + or -", replyParams());

            let targetId = null;
            if (message.hasReplyMessage) targetId = message.replyMessage.senderId;
            else {
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

            if (!targetId) return await message.reply("⚠️ Specify a user.", replyParams());
            if (targetId === userId) return await message.reply("❌ Cannot give rep to yourself.", replyParams());

            // Проверяем лимит действий (3 раза в сутки), но не блокируем разных людей
            const now = Date.now();
            const repRow = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id = ?", [String(userId)]);
            let repCount = repRow ? Number(repRow.count) : 0;
            let repReset = repRow ? Number(repRow.last_reset) : 0;

            if (now - repReset >= 86400000) { repCount = 0; repReset = now; }
            if (repCount >= 3) return await message.reply(`⏳ Limit exhausted (3/3). Wait for reset.`, replyParams());

            repCount++;
            await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), repCount, repReset]);

            if (isPlus) {
                await updateReputation(targetId, 1);
                // Обновляем прогресс ивента
                let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
                if (!ev) await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
                await dbRun("UPDATE winter_event SET reps_given = reps_given + 1 WHERE user_id = ?", [String(userId)]);
            } else {
                await updateReputation(targetId, -1);
            }

            return await message.reply(`✅ Reputation of ${await getFullName(targetId)} changed. Remaining: ${3 - repCount}/3`, replyParams());
        }

        // --- ПРОФИЛЬ (ЗИМНИЕ ЭМОДЗИ, БЕЗ ОДЕЖДЫ) ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house' LIMIT 1", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage' LIMIT 1", [String(userId)]);
            const bizData = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            const carsArr = JSON.parse(userRow.cars || '[]');
            
            const premStr = isPremium ? `Until ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}` : "No";
            const bizStr = bizData ? bizData.biz_name : "No";
            const carsStr = carsArr.length > 0 ? carsArr.join(', ') : "No";
            const simStr = userRow.sim_card || "No";

            const profText = `❄️🌲 Profile ${await getFullName(userId)} 🌲❄️\n\n` +
                             `❄️ Balance: ${formatMoney(balance)}$\n` +
                             `❄️ Phone: ${simStr}\n` +
                             `❄️ Premium: ${premStr}\n` +
                             `❄️ Rep: ${rep}\n` +
                             `❄️ Level: ${userRow.level} (${userRow.xp}/${userRow.level*500} XP)\n\n` +
                             `🌲 Business: ${bizStr}\n` +
                             `🌲 House: ${houseData ? houseData.location + ' T' + houseData.tier : "No"}\n` +
                             `🌲 Garage: ${garageData ? garageData.location + ' T' + garageData.tier : "No"}\n` +
                             `🌲 Cars (${carsArr.length}/10): ${carsStr}\n` +
                             `🌲 Org: ${userRow.org || "No"}\n` +
                             `🌲 Country: ${userRow.country || "No"}\n\n` +
                             `🆔 ID: ${userId}`;

            let attachment = null;
            try {
                const photoBuffer = await generateProfileImage(userId);
                if (photoBuffer) attachment = (await vk.upload.messagePhoto({ source: { value: photoBuffer } })).toString();
            } catch(e) {}

            return await message.reply({ message: profText, attachment: attachment || undefined, disable_mentions: 1 });
        }

        // --- МАШИНЫ ---
        if (cmdWord === 'машины') {
            let txt = "🚗 Car Dealership:\n\n";
            for (const [key, data] of Object.entries(CARS_DATA)) txt += `${data.name} — ${formatMoney(data.price)}$\n`;
            return await message.reply(txt + "\n🛒 Buy: buy car [Name]", replyParams());
        }

        if (cmdWord === 'купить' && parts[1] === 'машина') {
            const query = parts.slice(2).join(' ').toLowerCase().trim();
            if (!query) return await message.reply("❌ Specify name: buy car m5 f90");
            
            let selectedCar = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { selectedCar = data; break; }
            }
            if (!selectedCar) return await message.reply("❌ Car not found. List: /cars");

            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length >= 10) return await message.reply("❌ You already have 10 cars!");
            if (balance < selectedCar.price) return await message.reply(`❌ Not enough money! Need ${formatMoney(selectedCar.price)}$`);

            await updateBalance(userId, -selectedCar.price);
            carsArr.push(selectedCar.name);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🎉 Bought ${selectedCar.name} for ${formatMoney(selectedCar.price)}$!`, replyParams());
        }

        if (cmdWord === 'sellcar' || cmdWord === 'слить') {
            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length === 0) return await message.reply("❌ No car to sell.", replyParams());

            const carName = carsArr.pop();
            let carData = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.name === carName) { carData = data; break; }
            }
            if (!carData) {
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                return await message.reply("❌ Error: car not found.", replyParams());
            }

            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🚗 Car ${carData.name} sold! +${formatMoney(sellPrice)}$`, replyParams());
        }

        // --- БИЗНЕС ---
        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Businesses (Max 1):\n\n";
            for (const [key, data] of Object.entries(BIZ_DATA)) bizText += `${data.name} — ${formatMoney(data.price)}$\n`;
            return await message.reply(bizText + "\n🛒 Buy: buybiz [Name]", replyParams());
        }

        if (cmdWord === 'купитьбиз') {
            const bizQuery = parts.slice(1).join(' ').toLowerCase().trim();
            if (!bizQuery) return await message.reply("❌ Specify business: buybiz Shawarma");
            
            if (await dbGet("SELECT user_id FROM businesses WHERE user_id = ?", [String(userId)])) return await message.reply("❌ You already have a business.");

            let selectedBiz = null;
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { selectedBiz = data; break; }
            }
            if (!selectedBiz) return await message.reply("❌ Business not found. See: /business");
            if (balance < selectedBiz.price) return await message.reply(`❌ Not enough money! Need ${formatMoney(selectedBiz.price)}$`);

            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
            return await message.reply(`🎉 Bought ${selectedBiz.name} for ${formatMoney(selectedBiz.price)}$!`, replyParams());
        }

        if (cmdWord === 'мойбизнес') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ No business. Buy: /business");
            
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
                message: `🏢 Business ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Level: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/hour\n💸 Balance: ${formatMoney(totalBalance)}$\n\nUpgrade: ${formatMoney(nextLevelCost)}$`,
                attachment: attachment || undefined,
                keyboard: getBizKb(userId)
            });
        }

        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ No business.");

            const now = Date.now();
            const lastWithdraw = Number(biz.last_withdraw) || 0;
            const cd = 3600000;

            if (now - lastWithdraw < cd) {
                const remaining = cd - (now - lastWithdraw);
                const m = Math.floor(remaining / 60000);
                return await message.reply(`⏳ Withdraw once per hour. Wait ${m} min.`);
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;

            if (totalBalance <= 0) return await message.reply("❌ Balance is 0.");

            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            return await message.reply(`💸 Withdrawn ${formatMoney(totalBalance)}$!`, replyParams());
        }

        // --- ДОМА И ГАРАЖИ (ИСПРАВЛЕНО + ДОНАТЫ) ---
        if (cmdWord === 'дома') {
            let txt = "🏠 Available Houses:\n\n";
            let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.housePrice)}$ (Free: ${20 - countRow.c}/20)\n`;
                i++;
            }
            return await message.reply(txt + "\n💡 Buy: buy house top [number] [Location]\n💡 Sell: sell house [amount] (reply)\n🏆 Donate: donhouse", replyParams());
        }

        if (cmdWord === 'гаражи') {
            let txt = "🏘️ Available Garages:\n\n";
            let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.garagePrice)}$ (Free: ${20 - countRow.c}/20)\n`;
                i++;
            }
            return await message.reply(txt + "\n💡 Buy: buy garage top [number] [Location]\n💡 Sell: sell garage [amount] (reply)\n🏆 Donate: dongarage", replyParams());
        }

        if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1]; // 'дом' или 'гараж'
            const tierNum = parseInt(parts[2]); // номер топа (1, 2, 3...)
            const locationName = parts.slice(3).join(' ').toLowerCase().trim();

            if (!tierNum || !locationName) return await message.reply(`❌ Format: buy ${propType} top [number] [Location]`);

            // Находим локацию по названию
            let selectedLoc = null;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                if (key.includes(locationName) || data.name.toLowerCase().includes(locationName)) {
                    selectedLoc = { key, ...data };
                    break;
                }
            }
            if (!selectedLoc) return await message.reply("❌ Location not found. See list: /houses or /garages");

            // Проверяем, есть ли у игрока уже такая недвижимость
            const existingProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ? AND location = ?", [String(userId), propType, selectedLoc.name]);
            if (existingProp) return await message.reply(`❌ You already have a ${propType} in ${selectedLoc.name}!`);

            // Проверяем свободные места
            const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [selectedLoc.name, propType]);
            if (countRow.c >= 20) return await message.reply(`❌ No free ${propType === 'дом' ? 'houses' : 'garages'} in ${selectedLoc.name}!`);

            const price = propType === 'дом' ? selectedLoc.housePrice : selectedLoc.garagePrice;
            if (balance < price) return await message.reply(`❌ Not enough money! Need ${formatMoney(price)}$`);

            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [propType, selectedLoc.name, tierNum, String(userId)]);
            
            const emoji = propType === 'дом' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Successfully bought ${propType} in ${selectedLoc.name} for ${formatMoney(price)}$!`, replyParams());
        }

        if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1];
            if (!message.hasReplyMessage) return await message.reply(`❌ Reply to buyer's message and write: sell ${propType} [amount]`);

            const buyerId = message.replyMessage.senderId;
            const price = parseAmount(parts[2]);
            
            if (!price || price < 1000) return await message.reply(`❌ Specify correct sale amount.`);
            if (buyerId === userId) return await message.reply("❌ Cannot sell to yourself.");

            // Ищем недвижимость продавца
            const myProp = await dbGet("SELECT id, location, type FROM properties WHERE owner_id = ? AND type = ? ORDER BY id DESC LIMIT 1", [String(userId), propType]);
            
            if (!myProp) return await message.reply(`❌ You don't have a ${propType} to sell!`);

            // Проверка баланса покупателя
            const buyerBal = await getBalance(buyerId);
            if (buyerBal < price) return await message.reply("❌ Buyer doesn't have enough funds!");

            // Передача прав собственности
            await dbRun("UPDATE properties SET owner_id = ? WHERE id = ?", [String(buyerId), myProp.id]);
            
            // Деньги
            await updateBalance(userId, price);
            await updateBalance(buyerId, -price);

            const emoji = propType === 'дом' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Sold ${propType} in ${myProp.location} to ${await getFullName(buyerId)} for ${formatMoney(price)}$!`, replyParams());
        }

        // --- ДОНАТЫ НЕДВИЖИМОСТИ (ТОП 10 ПО ТИРАМ) ---
        if (cmdWord === 'дондом' || cmdWord === 'донгараж') {
            const propType = cmdWord === 'дондом' ? 'house' : 'garage';
            const emoji = cmdWord === 'дондом' ? '🏠' : '🏘️';
            const typeName = cmdWord === 'дондом' ? 'Houses' : 'Garages';
            
            // Получаем топ-10 недвижимости по тирам (от Т1 до Т10)
            const rows = await dbAll(`
                SELECT p.id, p.location, p.tier, u.user_id, 
                       (SELECT first_name || ' ' || last_name FROM users WHERE user_id = p.owner_id) as owner_name
                FROM properties p
                JOIN users u ON p.owner_id = u.user_id
                WHERE p.type = ? AND p.tier BETWEEN 1 AND 10
                ORDER BY p.tier ASC, p.id ASC
                LIMIT 10
            `, [propType]);

            if (rows.length === 0) {
                return await message.reply(`${emoji} No ${typeName.toLowerCase()} with tiers T1-T10 found for donation.`, replyParams());
            }

            let txt = `${emoji} TOP 10 ${typeName.toUpperCase()} (T1-T10) FOR DONATION:\n\n`;
            let count = 0;
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            
            for (const r of rows) {
                const ownerName = r.owner_name || 'Unknown';
                txt += `${emojis[count]} [ID:${r.id}] ${r.location} T${r.tier} — Owner: ${ownerName}\n`;
                count++;
            }

            txt += `\n💡 To donate: /donate ${propType} [ID] [amount]`;
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'дон' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1] === 'дом' ? 'house' : 'garage';
            const propId = parseInt(parts[2]);
            const amount = parseAmount(parts[3]);

            if (!propId || !amount || amount < 100) {
                return await message.reply(`❌ Format: /don ${parts[1]} [Property ID] [Amount]\nSee list: /donhouse or /dongarage`, replyParams());
            }

            // Находим недвижимость по ID
            const prop = await dbGet("SELECT * FROM properties WHERE id = ? AND type = ?", [propId, propType]);
            if (!prop) return await message.reply(`❌ Property with ID ${propId} not found!`, replyParams());

            // Проверка баланса
            if (balance < amount) return await message.reply(`❌ Not enough money! Need ${formatMoney(amount)}$`, replyParams());

            // Списываем деньги у донатера
            await updateBalance(userId, -amount);
            
            // Можно добавить логику начисления очков владельцу недвижимости, если нужно
            // Например: await dbRun("UPDATE users SET xp = xp + ? WHERE user_id = ?", [Math.floor(amount / 100), prop.owner_id]);

            const emoji = propType === 'house' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Donated ${formatMoney(amount)}$ to ${propType} #${propId} (${prop.location} T${prop.tier})!`, replyParams());
        }

        // --- ТОП ---
        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(peerId)]);
            let topText = "⭐ TOP 10 BY MESSAGES\n\n";
            
            if (rows.length > 0) {
                const userIds = rows.map(r => r.user_id);
                let usersInfo = [];
                try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}
                
                let count = 0;
                const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
                for (const r of rows) {
                    const uInfo = usersInfo.find(u => u.id == r.user_id);
                    if (uInfo && !uInfo.deactivated) {
                        topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] - ${r.count} msgs\n`;
                        count++;
                    }
                }
            } else topText += "Quiet in this chat...";

            return await message.reply(topText, replyParams(getTopKb(userId, 'coins', 'chat')));
        }

        // --- ЗИМНИЕ ИГРЫ С ЗАГАДКАМИ И ЛИМИТОМ 0/10 ---
        async function checkWinterLimit(gameField) {
            let lim = await dbGet(`SELECT ${gameField}, last_reset FROM winter_limits WHERE user_id = ?`, [String(userId)]);
            const now = Date.now();
            
            if (!lim) {
                await dbRun(`INSERT INTO winter_limits (user_id, last_reset) VALUES (?, ?)`, [String(userId), now]);
                lim = { [gameField]: 0, last_reset: now };
            }

            // Сброс лимита каждые 24 часа
            if (now - lim.last_reset >= 86400000) {
                await dbRun(`UPDATE winter_limits SET ${gameField} = 0, last_reset = ? WHERE user_id = ?`, [now, String(userId)]);
                lim[gameField] = 0;
                lim.last_reset = now;
            }

            if (lim[gameField] >= 10) return false;
            await dbRun(`UPDATE winter_limits SET ${gameField} = ${gameField} + 1 WHERE user_id = ?`, [String(userId)]);
            return true;
        }

        function generateRiddle() {
            const a = Math.floor(Math.random() * 20) + 1;
            const b = Math.floor(Math.random() * 20) + 1;
            const ops = ['+', '-', '*'];
            const op = ops[Math.floor(Math.random() * ops.length)];
            let answer;
            if (op === '+') answer = a + b;
            else if (op === '-') answer = a - b;
            else answer = a * b;
            return { question: `What is ${a} ${op} ${b}?`, answer: answer };
        }

        if (cmdWord === 'снежки' || cmdWord === 'елка' || cmdWord === 'санки' || cmdWord === 'снеговик' || cmdWord === 'подарок') {
            const gameMap = {
                'снежки': 'snowballs',
                'елка': 'tree',
                'санки': 'sleds',
                'снеговик': 'snowman',
                'подарок': 'gift'
            };
            const gameField = gameMap[cmdWord];
            
            if (!(await checkWinterLimit(gameField))) {
                return await message.reply("❄️ Limit exhausted (10/10)! Come back in 24 hours.", replyParams());
            }

            const riddle = generateRiddle();
            adminStates.set(userId, `riddle_${cmdWord}_${riddle.answer}`);
            
            const emojis = {
                'снежки': '❄️',
                'елка': '🎄',
                'санки': '🛷',
                'снеговик': '⛄',
                'подарок': '🎁'
            };
            
            return await message.reply(`${emojis[cmdWord]} Solve the puzzle to get prize (1kk-5kk):\n\n${riddle.question}`, replyParams());
        }

        // --- ЗИМНИЙ ИВЕНТ ---
        if (cmdWord === 'event') {
            let eventRow = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (!eventRow) {
                await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
                eventRow = { reps_given: 0, game_score: 0, msgs_sent: 0, completed: 0, last_opened: 0 };
            }

            if (eventRow.last_opened > 0) {
                const hoursLeft = Math.ceil((86400000 - (Date.now() - eventRow.last_opened)) / 3600000);
                if (hoursLeft > 0) {
                    return await message.reply(`❄️ You already opened the case!\n⏳ Next tasks in ${hoursLeft} h.`, replyParams());
                }
            }

            const msgRow = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            const currentMsgs = msgRow ? msgRow.count : 0;

            const task1Done = eventRow.reps_given >= 10;
            const task2Done = eventRow.game_score >= 10000;
            const task3Done = currentMsgs >= 100;

            if (task1Done && task2Done && task3Done) {
                if (eventRow.completed !== 1) {
                    await dbRun("UPDATE winter_event SET completed = 1 WHERE user_id = ?", [String(userId)]);
                    return await message.reply(`🎉 TASKS COMPLETED!\n\n🎁 Received: "Winter" Case\nType: /open winter case`, replyParams());
                } else {
                    return await message.reply(`🎁 You have an unopened Winter Case!\nType: /open winter case`, replyParams());
                }
            } else {
                let progressText = `❄️ WINTER EVENT ❄️\n\n`;
                progressText += `1️⃣ Give 10 reps\nStatus: ${eventRow.reps_given}/10 ${task1Done ? '✅' : '⏳'}\n\n`;
                progressText += `2️⃣ Earn 10,000 points in games\nStatus: ${eventRow.game_score}/10000 ${task2Done ? '✅' : '⏳'}\n\n`;
                progressText += `3️⃣ Write 100 messages here\nStatus: ${currentMsgs}/100 ${task3Done ? '✅' : '⏳'}\n\n`;
                return await message.reply(progressText, replyParams());
            }
        }

        // --- ОТКРЫТИЕ КЕЙСА ---
        if (cmdWord === 'открыть') {
            const caseName = parts.slice(1).join(' ').toLowerCase().trim();
            if (caseName === 'кейс зимний' || caseName === 'зимний') {
                const eventRow = await dbGet("SELECT completed, last_opened FROM winter_event WHERE user_id = ?", [String(userId)]);
                
                if (!eventRow || eventRow.completed !== 1) {
                    return await message.reply("❌ No Winter Case. Complete /event.", replyParams());
                }

                if (eventRow.last_opened > 0 && (Date.now() - eventRow.last_opened) < 86400000) {
                    const h = Math.ceil((86400000 - (Date.now() - eventRow.last_opened)) / 3600000);
                    return await message.reply(`⏳ Already opened! Wait ${h} h.`, replyParams());
                }

                let prizesRow = await dbGet("SELECT * FROM winter_case_prizes WHERE user_id = ?", [String(userId)]);
                if (!prizesRow) {
                    await dbRun("INSERT INTO winter_case_prizes (user_id) VALUES (?)", [String(userId)]);
                    prizesRow = { bugatti: 0, premium_forever: 0 };
                }

                const possiblePrizes = [
                    { type: 'money', val: 4000000, text: '4,000,000$' },
                    { type: 'money', val: 5000000, text: '5,000,000$' },
                    { type: 'premium_year', text: 'Premium for 1 year' },
                    { type: 'money', val: 10000000, text: '10,000,000$' },
                    { type: 'bugatti', text: '🏎️ Bugatti Chiron' },
                    { type: 'money', val: 15000000, text: '15,000,000$' },
                    { type: 'money', val: 20000000, text: '20,000,000$' },
                    { type: 'rep', val: 10, text: '+10 Reputation' },
                    { type: 'money', val: 100000000, text: '100,000,000$' },
                    { type: 'premium_forever', text: '💎 Premium FOREVER' }
                ];

                let availablePrizes = possiblePrizes.filter(p => {
                    if (p.type === 'bugatti' && prizesRow.bugatti) return false;
                    if (p.type === 'premium_forever' && prizesRow.premium_forever) return false;
                    return true;
                });

                if (availablePrizes.length === 0) availablePrizes = possiblePrizes.filter(p => p.type === 'money' || p.type === 'rep' || p.type === 'premium_year');

                const prize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
                let resultText = `📦 Winter Case opened!\n🎉 You got: ${prize.text}`;

                if (prize.type === 'money') {
                    await updateBalance(userId, prize.val);
                } else if (prize.type === 'premium_year') {
                    await dbRun("UPDATE users SET premium_until = ? WHERE user_id = ?", [Date.now() + 365 * 86400000, String(userId)]);
                } else if (prize.type === 'premium_forever') {
                    await dbRun("UPDATE users SET premium_until = ? WHERE user_id = ?", [9999999999999, String(userId)]);
                    await dbRun("UPDATE winter_case_prizes SET premium_forever = 1 WHERE user_id = ?", [String(userId)]);
                } else if (prize.type === 'rep') {
                    await updateReputation(userId, prize.val);
                } else if (prize.type === 'bugatti') {
                    let carsArr = JSON.parse(userRow.cars || '[]');
                    if (!carsArr.includes('Bugatti Chiron')) {
                        carsArr.push('Bugatti Chiron');
                        await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                    }
                    await dbRun("UPDATE winter_case_prizes SET bugatti = 1 WHERE user_id = ?", [String(userId)]);
                }

                await dbRun("UPDATE winter_event SET last_opened = ?, completed = 0, reps_given = 0, game_score = 0 WHERE user_id = ?", [Date.now(), String(userId)]);
                return await message.reply(resultText, replyParams());
            }
        }

        // --- СЛИТЬ БИЗНЕС (+10КК) ---
        if (cmdWord === 'слитьбиз') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ No business.", replyParams());
            
            await updateBalance(userId, 10000000);
            await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
            return await message.reply("🔥 Business sold to state!\n💰 +10,000,000$", replyParams());
        }

        // --- /АДМИН (ЧЕРЕЗ ОТВЕТ) ---
        if (cmdWord === 'админ') {
            if (!message.hasReplyMessage) return await message.reply("❌ Reply to violator's message and type /admin", replyParams());
            
            const targetId = message.replyMessage.senderId;
            const reportedText = message.replyMessage.text || "Message without text";
            
            const callKb = getAdminCallKb(userId, targetId, reportedText);
            const adminMsg = `🚨 ADMIN CALL!\n👤 From: [id${userId}|Player]\n🎯 Violator: [id${targetId}|Player]\n💬 Text: "${reportedText}"`;
            
            try {
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: adminMsg, keyboard: callKb.toString(), random_id: 0 });
                return await message.reply("✅ Complaint sent to owner.", replyParams());
            } catch(e) {
                return await message.reply("❌ Failed to send.", replyParams());
            }
        }

        // --- LOGS, ЧСБЛИСТ, BANLIST (РАБОЧИЕ И НА РУССКОМ) ---
        if (cmdWord === 'logs') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Owner only.", replyParams());
            const { targetId } = await getTargetAndReason(message, 'logs');
            if (!targetId) return await message.reply("⚠️ Specify user: /logs @vk", replyParams());
            
            const userInfo = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(targetId)]);
            const chatStats = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(targetId)]);
            
            let logText = `📋 Logs [id${targetId}|Player]:\n`;
            logText += `Balance: ${userInfo ? userInfo.balance : 0}\n`;
            logText += `Rep: ${userInfo ? userInfo.reputation : 0}\n`;
            logText += `Messages here: ${chatStats ? chatStats.count : 0}\n`;
            logText += `Reg: ${userInfo ? userInfo.reg_date : 'N/A'}\n`;
            
            const fileName = `logs_${targetId}_${Date.now()}.txt`;
            const filePath = path.join(DATA_DIR, fileName);
            fs.writeFileSync(filePath, logText);
            
            try {
                const doc = await vk.upload.messageDocument({ peer_id: ADMIN_ID, source: { value: fs.createReadStream(filePath) } });
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: `Logs [id${targetId}|Player]:`, attachment: doc.toString(), random_id: 0 });
                fs.unlinkSync(filePath);
                return await message.reply("✅ Logs sent to DM.", replyParams());
            } catch(e) {
                return await message.reply("❌ Error sending logs.", replyParams());
            }
        }

        if (cmdWord === 'чсблист') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Owner only.", replyParams());
            const bans = await dbAll("SELECT user_id, reason, until FROM blacklist");
            if (bans.length === 0) return await message.reply("✅ Global blacklist is empty.", replyParams());
            let txt = `😈 Global Bot Blacklist:\n`;
            for (const b of bans) {
                const t = b.until === 0 ? "Forever" : `Until ${new Date(b.until).toLocaleDateString()}`;
                txt += `▪️ [id${b.user_id}|Player] - ${b.reason} (${t})\n`;
            }
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'banlist') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Owner only.", replyParams());
            if (!message.isChat) return await message.reply("❌ Chat only.", replyParams());
            const bans = await dbAll("SELECT user_id, reason FROM chat_bans WHERE peer_id = ?", [String(peerId)]);
            if (bans.length === 0) return await message.reply("✅ No bans in this chat.", replyParams());
            let txt = `🚫 Ban list in this chat:\n`;
            for (const b of bans) txt += `▪️ [id${b.user_id}|Player] - ${b.reason}\n`;
            return await message.reply(txt, replyParams());
        }

        // --- ИГРЫ ---
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            if (Date.now() - lastPlayed < 10000) return await message.reply(`⏳ Wait ${Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000)} sec.`);
            gameCooldowns.set(userId, Date.now());
        }

        if (cmdWord === 'монетка') {
            let side = ["орел", "решка"].find(s => parts.includes(s));
            if (!side) return await message.reply("❌ Choose 'heads' or 'tails'", replyParams());
            let betStr = parts.find(p => p !== side);
            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Min bet 100$.", replyParams());

            await updateBalance(userId, -bet);
            const res = Math.random() < 0.5 ? 'орел' : 'решка';
            if (res === side) await updateBalance(userId, bet * 2);
            return await message.reply(`🪙 Result: ${res}\n` + (res === side ? `✅ Win: ${formatMoney(bet*2)}$!` : `❌ Loss: ${formatMoney(bet)}$`) + `\n💰 Balance: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }

        if (cmdWord === 'краш') {
            const autoStop = parseFloat(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (isNaN(autoStop) || autoStop < 1.01 || isNaN(bet) || bet < 100 || bet > balance) return await message.reply("❌ Format: crash 3 5kk", replyParams());
            
            await updateBalance(userId, -bet);
            const rand = Math.random();
            let crashPoint = rand > 0.03 ? Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100 : 1.00;
            
            if (crashPoint >= autoStop) {
                const win = Math.floor(bet * autoStop);
                await updateBalance(userId, win);
                return await message.reply(`📈 Crash: x${crashPoint.toFixed(2)}\n\n✅ Win: ${formatMoney(win)}$!`, replyParams());
            } else {
                return await message.reply(`📈 Crash: x${crashPoint.toFixed(2)}\n\n❌ Loss: ${formatMoney(bet)}$`, replyParams());
            }
        }

        if (cmdWord === 'стакан') {
            let cup = parseInt(parts[1]) || parseInt(parts[2]);
            let bet = parseAmount(parts.find(p => !isNaN(parseInt(p)) && parseInt(p) > 3));
            if (bet === 'ALL') bet = balance;
            if (cup < 1 || cup > 3 || bet < 100 || bet > balance) return await message.reply("❌ Format: cup 2 100k", replyParams());
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 3) + 1;
            if (res === cup) { await updateBalance(userId, bet * 3); return await message.reply(`🥤 Ball under cup ${res}\n\n✅ Win: ${formatMoney(bet*3)}$!`, replyParams()); }
            else return await message.reply(`🥤 Ball under cup ${res}\n\n❌ Loss: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'кубик') {
            let guess = parseInt(parts[1]) || parseInt(parts[2]);
            let bet = parseAmount(parts.find(p => !isNaN(parseInt(p)) && parseInt(p) > 6));
            if (bet === 'ALL') bet = balance;
            if (guess < 1 || guess > 6 || bet < 100 || bet > balance) return await message.reply("❌ Format: dice 4 100k", replyParams());
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 6) + 1;
            if (res === guess) { await updateBalance(userId, bet * 6); return await message.reply(`🎲 Rolled: ${res}\n\n✅ Win: ${formatMoney(bet*6)}$!`, replyParams()); }
            else return await message.reply(`🎲 Rolled: ${res}\n\n❌ Loss: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'автомат' || cmdWord === 'блэкджек') {
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Min bet 100$.", replyParams());
            await updateBalance(userId, -bet);
            
            if (cmdWord === 'автомат') {
                const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
                const r1 = emojis[Math.floor(Math.random() * 5)], r2 = emojis[Math.floor(Math.random() * 5)], r3 = emojis[Math.floor(Math.random() * 5)];
                let win = (r1 === r2 && r2 === r3) ? bet * 10 : (r1 === r2 || r2 === r3 || r1 === r3) ? bet * 2 : 0;
                if (win) { await updateBalance(userId, win); return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n✅ Win: ${formatMoney(win)}$!`, replyParams()); }
                return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n❌ Loss: ${formatMoney(bet)}$`, replyParams());
            }
            if (cmdWord === 'блэкджек') {
                const p = Math.floor(Math.random() * 10) + 12, d = Math.floor(Math.random() * 10) + 12;
                if (p > d && p <= 21) { await updateBalance(userId, bet * 2); return await message.reply(`🃏 You: ${p}, Dealer: ${d}\n\n✅ Win: ${formatMoney(bet*2)}$!`, replyParams()); }
                return await message.reply(`🃏 You: ${p}, Dealer: ${d}\n\n❌ Loss: ${formatMoney(bet)}$`, replyParams());
            }
        }

        if (cmdWord === 'дрим') {
            const guess = parseInt(parts[1]);
            const betStr = parts[2];
            let actualBet = parseAmount(betStr);
            if (actualBet === 'ALL') actualBet = balance;
            if (!guess || guess < 1 || guess > 5) return await message.reply("❌ Numbers: 1, 2, 3, 4, 5", replyParams());
            if (actualBet < 100 || actualBet > balance) return await message.reply("❌ Min bet 100$.", replyParams());
            
            await updateBalance(userId, -actualBet);
            const res = Math.floor(Math.random() * 10) + 1;
            if (res === guess) { const win = actualBet * guess; await updateBalance(userId, win); return await message.reply(`💎 Number: ${res}\n\n✅ Win: ${formatMoney(win)}$!`, replyParams()); }
            return await message.reply(`💎 Number: ${res}\n\n❌ Loss: ${formatMoney(actualBet)}$`, replyParams());
        }

        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length < 3) return await message.reply("❌ Format: roulette [red/black/even/odd] [bet]", replyParams());

            let choice = parts[1];
            let betStr = parts[2];
            if (!isNaN(parseInt(parts[1]))) { choice = parts[2]; betStr = parts[1]; } 

            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Min bet 100$.", replyParams());

            const validRed = ["красное", "красный", "кр"];
            const validBlack = ["черное", "черный", "чр"];
            const validEven = ["чет", "четное"];
            const validOdd = ["нечет", "нечетное"];

            const res = Math.floor(Math.random() * 36) + 1; 
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            let isWin = false;
            let cName = redNumbers.includes(res) ? "Red" : "Black";
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

            const msgText = `🎰 Result: ${res} (${cName})\n\n` + (isWin ? `✅ Win: +${formatMoney(bet)}$` : `😔 Loss: -${formatMoney(bet)}$`) + `\n💰 Balance: ${formatMoney(await getBalance(userId))}$`;
            return await message.reply({ message: msgText, attachment: attachment || undefined, disable_mentions: 1 });
        }

        if (cmdWord === 'фортуна') {
            const currentTime = Math.floor(Date.now() / 1000);
            const lastUse = (await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]))?.last_used || 0;
            if (currentTime - lastUse < 600) return await message.reply(`⏳ Fortune in ${Math.floor((600 - (currentTime - lastUse)) / 60)} min.`, replyParams());
            if (balance < 100) return await message.reply("❌ Fortune costs 100$.", replyParams());

            await updateBalance(userId, -100);
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);
            const prize = [0, 50, 100, 200, 500, 1000, 5000][Math.floor(Math.random() * 7)];
            await updateBalance(userId, prize);
            return await message.reply(`🎰 Result: ${formatMoney(prize)}$!`, replyParams());
        }

        if (cmdWord === 'мины') {
            let bet = parseAmount(parts[1]) || 100;
            if (bet === 'ALL') bet = balance;
            if (bet < 100 || bet > balance) return await message.reply("❌ Min bet 100$.", replyParams());

            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
            return await message.reply(`💣 Mines\nBet: ${bet}$\n\nChoose number of mines:`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (!message.hasReplyMessage) return await message.reply("❌ Format: transfer [amount] (reply)", replyParams());
            const amount = parseAmount(parts[1]);
            if (!amount || amount === 'ALL' || amount < 50 || amount > balance) return await message.reply("❌ Amount from 50$", replyParams());
            await updateBalance(userId, -amount);
            await updateBalance(message.replyMessage.senderId, amount);
            return await message.reply(`💸 Transferred ${formatMoney(amount)}$ to ${await getFullName(message.replyMessage.senderId)}.`, replyParams());
        }

        if (cmdWord === 'duel') {
            const bet = parseAmount(parts[1]);
            if (!bet || bet === 'ALL' || bet < 50 || bet > balance) return await message.reply("❌ Bet from 50$", replyParams());
            const duelId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
            return await message.reply(`⚔️ Duel!\n👤 Creator: ${await getFullName(userId)}\n💰 Bet: ${bet}$\n\n⚡ Press button!`, replyParams(getDuelKb(duelId)));
        }

        if (cmdWord === 'бонус') {
            const todayStr = new Date().toISOString().split('T')[0];
            if (userRow.last_bonus_date === todayStr) return await message.reply(`⏳ Bonus already claimed today!\n🔥 Streak: ${userRow.bonus_streak} days.`, replyParams());

            let streak = userRow.bonus_streak || 0;
            if (userRow.last_bonus_date) {
                const diffDays = Math.ceil(Math.abs(new Date(todayStr) - new Date(userRow.last_bonus_date)) / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) streak++; else streak = 1;
            } else streak = 1;

            let amount = isPremium ? 3000 : 1000;
            await updateBalance(userId, amount);
            await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [todayStr, streak, String(userId)]);
            return await message.reply(`🎁 DAILY BONUS\n────────────────────\n🔥 Streak: ${streak} days!\n💰 Reward: +${formatMoney(amount)}$\n\n💳 Balance: ${formatMoney(await getBalance(userId))}$`, replyParams(isLs ? mainKb : undefined));
                                                      }
        // ===== АДМИНСКИЕ КОМАНДЫ =====
        if (userId === ADMIN_ID) {
            
            // --- КОМАНДА /cl (ПОЛНЫЙ СБРОС) ---
            if (cmdWord === 'cl') {
                const targetQuery = parts.slice(1).join(' ').trim().toLowerCase();
                
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, sim_card = NULL");
                    await dbRun("DELETE FROM chat_messages");
                    await dbRun("DELETE FROM businesses");
                    await dbRun("DELETE FROM properties");
                    
                    return await message.reply("💥 FULL RESET OF ALL PLAYERS AND TOPS DONE!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'cl');
                    
                    if (!targetId) {
                        return await message.reply("⚠️ Specify user (reply, @mention or link) or type 'all'.");
                    }
                    
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, sim_card = NULL WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM chat_messages WHERE user_id = ?", [String(targetId)]);
                    
                    return await message.reply(`💥 Full reset of player ${await getFullName(targetId)} done!`);
                }
            }

            // --- КОМАНДА /снятьпред ---
            if (cmdWord === 'снятьпред') {
                const { targetId } = await getTargetAndReason(message, 'снятьпред');
                
                if (!targetId) {
                    return await message.reply("⚠️ Specify user (reply, @mention or link).");
                }
                
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(targetId)]);
                
                return await message.reply(`✅ All warnings removed from ${await getFullName(targetId)}.`);
            }

            // --- КОМАНДА /объявление ---
            if (cmdWord === 'объявление') {
                const txt = text.replace(/объявление\s*/i, '');
                
                if (!txt) {
                    return await message.reply("❌ Enter announcement text.");
                }
                
                const allUsers = await dbAll("SELECT user_id FROM users");
                const allChats = await dbAll("SELECT DISTINCT peer_id FROM chat_messages WHERE peer_id > 2000000000");
                
                let sentCount = 0;
                
                for (const u of allUsers) {
                    try { 
                        await vk.api.messages.send({ 
                            peer_id: u.user_id, 
                            message: `📢 ANNOUNCEMENT:\n${txt}`, 
                            random_id: Math.floor(Math.random() * 1000000000) 
                        }); 
                        sentCount++; 
                    } catch(e) {}
                }
                
                for (const c of allChats) {
                    try { 
                        await vk.api.messages.send({ 
                            peer_id: c.peer_id, 
                            message: `📢 ANNOUNCEMENT:\n${txt}`, 
                            random_id: Math.floor(Math.random() * 1000000000) 
                        }); 
                        sentCount++; 
                    } catch(e) {}
                }
                
                return await message.reply(`✅ Announcement sent! Delivered to: ${sentCount} recipients.`);
            }

            // --- КОМАНДА /pr (ПРОВЕРКА БАЛАНСА) ---
            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) {
                    return await message.reply("⚠️ Specify user (reply, @mention or link).");
                }
                const bal = await getBalance(targetId);
                const name = await getFullName(targetId);
                return await message.reply(`💳 Player ${name} has: ${formatShortMoney(bal)}$`);
            }

            // --- КОМАНДА /заморозить ---
            if (cmdWord === 'заморозить') {
                const { targetId } = await getTargetAndReason(message, 'заморозить');
                if (!targetId) {
                    return await message.reply("⚠️ Specify user (reply, @mention or link).");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot freeze yourself.");
                }
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]);
                try { 
                    await vk.api.messages.send({ peer_id: targetId, message: "💀 You are frozen in the bot. Wait for punishment!", random_id: Math.floor(Math.random() * 1000000000) }); 
                } catch(e) {}
                return await message.reply(`✅ Player ${await getFullName(targetId)} frozen.`);
            }

            // --- КОМАНДА /разморозить ---
            if (cmdWord === 'разморозить' || cleanText.startsWith('снять заморозку') || cleanText.startsWith('снять заморозка') || cmdWord === 'unfreeze') {
                let cmdName = 'разморозить';
                if (cleanText.startsWith('снять заморозку')) cmdName = 'снять заморозку';
                if (cleanText.startsWith('снять заморозка')) cmdName = 'снять заморозка';
                if (cmdWord === 'unfreeze') cmdName = 'unfreeze';

                const { targetId } = await getTargetAndReason(message, cmdName);
                if (!targetId) {
                    return await message.reply("⚠️ Specify user (reply, @mention or link).");
                }
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ Player ${await getFullName(targetId)} unfrozen.`);
            }

            // --- КОМАНДА /unmute ---
            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To unmute, use /unmute @VK (or reply to message)");
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unmute' ? 'unmute' : 'размут');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }

                const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (!activeMute || Date.now() >= activeMute.mute_until) {
                    if (activeMute) {
                        await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    }
                    return await message.reply("❌ This player has no active mute in this chat.");
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
                        console.error("Error unmuting VK:", e.message);
                    }
                }

                const targetName = await getFullName(targetId);
                return await message.reply(`✅ Mute removed from ${targetName}!`);
            }

            // --- КОМАНДА /unban ---
            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To unban, use /unban @VK (or reply to message)");
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unban' ? 'unban' : 'разбан');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }

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
                    return await message.reply("❌ This player is not in any ban list (neither global nor chat).");
                }

                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                return await message.reply(`✅ ${senderName} unbanned ${targetName}.`);
            }

            // --- КОМАНДА /kl ---
            if (cmdWord === 'kl') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To full reset player, use /kl @VK (or reply to message)");
                }

                const { targetId } = await getTargetAndReason(message, 'kl');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot reset yourself.");
                }

                await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, car = NULL, last_bonus_date = NULL, bonus_streak = 0 WHERE user_id = ?", [String(targetId)]);
                
                const targetName = await getFullName(targetId);
                return await message.reply(`💥 Player ${targetName} fully reset! Houses, garages, cars, bonuses and levels cleared.`);
            }

            // --- КОМАНДА /mute ---
            if (cmdWord === 'mute') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Format: /mute @VK [minutes] [reason]");
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

                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot mute yourself.");
                }

                let muteMinutes = 10;
                let reason = "Reason not specified";

                if (args.length > 0) {
                    const parsedTime = parseInt(args[0]);
                    if (!isNaN(parsedTime) && parsedTime > 0) {
                        muteMinutes = parsedTime;
                        if (args.length > 1) {
                            reason = args.slice(1).join(' ');
                        }
                    } else {
                        reason = args.join(' ');
                    }
                }

                const existingMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingMute && Date.now() < existingMute.mute_until) {
                    return await message.reply("❌ This player already has an active block in this chat!");
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
                return await message.reply(`🚫 ${targetName} muted for ${muteMinutes} minutes.\n📌 Reason: ${reason}`);
            }

            // --- КОМАНДА /бан ---
            if (cmdWord === 'бан' || cmdWord === 'ban') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To ban user in chat, use /ban @VK Reason");
                }
                if (!message.isChat) {
                    return await message.reply("❌ This command works only in chat.");
                }

                const { targetId, reason } = await getTargetAndReason(message, cmdWord === 'бан' ? 'бан' : 'ban');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot ban yourself.");
                }
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) {
                    return await message.reply("❌ This player is already banned in this chat!");
                }

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
                
                return await message.reply(`${senderName} banned ${targetName} in this chat. Reason: "${reason}"`);
            }

            // --- КОМАНДА /logs ---
            if (cmdWord === 'logs') {
                const { targetId } = await getTargetAndReason(message, 'logs');
                if (!targetId) {
                    return await message.reply("⚠️ Specify user: /logs @vk");
                }
                
                const userInfo = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(targetId)]);
                const chatStats = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(targetId)]);
                
                let logText = `📋 Logs [id${targetId}|Player]:\n`;
                logText += `Balance: ${userInfo ? userInfo.balance : 0}\n`;
                logText += `Reputation: ${userInfo ? userInfo.reputation : 0}\n`;
                logText += `Messages in chat: ${chatStats ? chatStats.count : 0}\n`;
                logText += `Registration date: ${userInfo ? userInfo.reg_date : 'Unknown'}\n`;
                
                const fileName = `logs_${targetId}_${Date.now()}.txt`;
                const filePath = path.join(DATA_DIR, fileName);
                fs.writeFileSync(filePath, logText);
                
                try {
                    const doc = await vk.upload.messageDocument({ peer_id: ADMIN_ID, source: { value: fs.createReadStream(filePath) } });
                    await vk.api.messages.send({ peer_id: ADMIN_ID, message: `Logs [id${targetId}|Player]:`, attachment: doc.toString(), random_id: Math.floor(Math.random() * 1000000000) });
                    fs.unlinkSync(filePath);
                    return await message.reply("✅ Logs sent to your DM.");
                } catch(e) {
                    return await message.reply("❌ Error sending logs.");
                }
            }

            // --- КОМАНДА /banlist ---
            if (cmdWord === 'banlist') {
                if (!message.isChat) return await message.reply("❌ Chat only.");
                const bans = await dbAll("SELECT user_id, reason FROM chat_bans WHERE peer_id = ?", [String(peerId)]);
                if (bans.length === 0) return await message.reply("✅ No banned players in this chat.");
                
                let txt = `🚫 Ban list in this chat:\n`;
                for (const b of bans) {
                    txt += `▪️ [id${b.user_id}|Player] - ${b.reason}\n`;
                }
                return await message.reply(txt);
            }

            // --- КОМАНДА /чсблист ---
            if (cmdWord === 'чсблист') {
                const bans = await dbAll("SELECT user_id, reason, until FROM blacklist");
                if (bans.length === 0) return await message.reply("✅ Global blacklist is empty.");
                
                let txt = `😈 Global Bot Blacklist:\n`;
                for (const b of bans) {
                    const timeStr = b.until === 0 ? "Forever" : `Until ${new Date(b.until).toLocaleDateString()}`;
                    txt += `▪️ [id${b.user_id}|Player] - ${b.reason} (${timeStr})\n`;
                }
                return await message.reply(txt);
            }

            // --- КОМАНДА /убрать ---
            if (cmdWord === 'убрать') {
                const targetQuery = cleanText.replace('убрать', '').trim().toLowerCase();
                
                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0");
                    return await message.reply(`💥 All stats of ALL players (coins, duels, bonuses etc.) reset! (Cars and businesses kept)`);
                } else {
                    const { targetId } = await getTargetAndReason(message, 'убрать');
                    if (!targetId) {
                        return await message.reply("⚠️ Reply to player's message, specify @mention or type 'all' to reset stats.");
                    }

                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 All stats of player ${targetName} (coins, duels, bonuses etc.) reset! (Cars and businesses kept)`);
                }
            }

            // --- КОМАНДА /kick ---
            if (cmdWord === 'kick') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To kick user from chat, use /kick @VK Reason (Example: /kick @Mokhma.volk Test)");
                }

                const { targetId, reason } = await getTargetAndReason(message, 'kick');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot kick yourself.");
                }
                if (!message.isChat) {
                    return await message.reply("❌ This command works only in chat.");
                }
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) {
                    return await message.reply("❌ This player is already banned in this chat.");
                }

                const chatId = message.peerId - 2000000000;
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                try {
                    await vk.api.messages.removeChatUser({ chat_id: chatId, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply(`${senderName} kicked ${targetName} from chat. Reason: "${reason}"`);
                } catch (e) {
                    return await message.reply(`⚠️ Specified user is not a participant of this chat, or has higher status than yours.`);
                }
            }

            // --- КОМАНДА /чсб ---
            if (cmdWord === 'чсб') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 To add to global blacklist, use /blacklist @VK [days] Reason (Example: /blacklist @Mokhma.volk 3 Spam)");
                }

                const { targetId, reason } = await getTargetAndReason(message, 'чсб');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ You cannot blacklist yourself.");
                }

                const existingBan = await dbGet("SELECT reason FROM blacklist WHERE user_id = ?", [String(targetId)]);
                if (existingBan) {
                    return await message.reply("❌ This player is already in global blacklist!");
                }
                
                let days = 0;
                let finalReason = reason;
                const partsReason = reason.split(' ');
                if (partsReason.length > 1 && !isNaN(parseInt(partsReason[0]))) {
                    days = parseInt(partsReason[0]);
                    finalReason = partsReason.slice(1).join(' ');
                }
                if (!finalReason) {
                    finalReason = "Reason not specified";
                }

                let until = days > 0 ? Date.now() + days * 86400000 : 0;
                
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), finalReason, until]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} added ${targetName} to global bot blacklist ${days > 0 ? `for ${days} days` : 'forever'}. Reason: "${finalReason}"`);
            }

            // --- КОМАНДА /разчсб ---
            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) {
                    return await message.reply("⚠️ User not found. Check link or mention.");
                }

                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} removed ${targetName} from global bot blacklist.`);
            }

            // --- КОМАНДА /выдать ---
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

                if (amount <= 0) {
                    return await message.reply("❌ Specify correct amount to give.");
                }

                const targetQuery = remainingArgs.join(' ').trim().toLowerCase();

                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Owner gave all players ${formatMoney(amount)}$ each!`);
                } else {
                    let targetId = null;
                    if (message.hasReplyMessage) {
                        targetId = message.replyMessage.senderId;
                    } else if (targetQuery) {
                        const mentionMatch = targetQuery.match(/@([a-zA-Z0-9._]+)/i) || targetQuery.match(/\[id(\d+)\|/);
                        const urlMatch = targetQuery.match(/(?:https?:\/\/)?(?:vk\.com|vk\.ru)\/([a-zA-Z0-9._]+)/i);
                        
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
                        } else if (urlMatch) {
                            try {
                                const res = await vk.api.utils.resolveScreenName({ screen_name: urlMatch[1] });
                                if (res.type === 'user') {
                                    targetId = res.object_id;
                                }
                            } catch (e) {}
                        }
                    }

                    if (!targetId) {
                        return await message.reply("⚠️ Specify user (reply, @mention or link) or type 'all'.");
                    }
                    
                    await updateBalance(targetId, amount);
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💰 Owner gave ${formatMoney(amount)}$ to ${targetName}!`);
                }
            }

            // --- КОМАНДА /обнулить ---
            if (cmdWord === 'обнулить') {
                const args = message.text.split(' ');
                args.shift(); 
                const targetQuery = args.join(' ').trim().toLowerCase();

                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0");
                    await dbRun("UPDATE businesses SET balance = 0");
                    return await message.reply("💥 Balances of ALL players and their businesses reset!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'обнулить');
                    if (!targetId) {
                        return await message.reply("⚠️ Specify 'all', user link or reply to their message.");
                    }
                    
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 Balance of player ${targetName} and their business reset!`);
                }
            }

            // --- КОМАНДА /cc ---
            if (cmdWord === 'cc') {
                await dbRun("DELETE FROM promos");
                return await message.reply("✅ All active promo codes deleted.");
            }

            // --- КОМАНДА /создать ---
            if (cmdWord === 'создать') {
                if (parts.length === 4) {
                    const amt = parseAmount(parts[2]);
                    const lim = parseAmount(parts[3]);
                    if (amt > 0 && lim > 0) {
                        await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], amt, lim]);
                        return await message.reply(`✅ Promo code \`${parts[1]}\` created!`);
                    }
                }
                return await message.reply("❌ Format: /create [code] [amount] [limit]");
            }
        }

        // ===== ПРОМОКОДЫ (ДЛЯ ВСЕХ) =====
        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (rows.length === 0) {
                return await message.reply("❌ No active promo codes.");
            }
            
            let promoList = "🎁 Active Promo Codes:\n\n";
            for (const r of rows) {
                const usedCount = r.used_by ? r.used_by.split(",").length : 0;
                promoList += `▪️ \`${r.code}\` — ${formatMoney(r.amount)}$ (${usedCount}/${r.limit_count})\n`;
            }
            return await message.reply(promoList);
        }

        if (cmdWord === 'promo') {
            if (parts.length === 2) {
                try {
                    const isMember = await vk.api.groups.isMember({ group_id: GROUP_ID, user_id: userId });
                    if (isMember !== 1) {
                        const subKb = Keyboard.builder().inline().urlButton({ label: '📢 Subscribe', url: `https://vk.com/public${GROUP_ID}` });
                        return await message.reply("⚠️ Promo codes available only for community subscribers!\n\nSubscribe and try again.", replyParams(subKb.toString()));
                    }
                } catch (e) {}

                const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
                
                if (!row) {
                    return await message.reply("❌ Promo code doesn't exist or expired.");
                }
                
                const usedBy = row.used_by ? row.used_by.split(",") : [];
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply("❌ Promo code no longer valid.");
                }
                
                if (usedBy.includes(String(userId))) {
                    return await message.reply("❌ You already activated this promo code!");
                }
                
                usedBy.push(String(userId));
                await updateBalance(userId, row.amount);
                
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply(`✅ Activated! +${row.amount}$\n⚠️ Promo code deleted (limit reached).`);
                } else {
                    await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [usedBy.join(","), parts[1]]);
                    return await message.reply(`✅ Activated! +${row.amount}$\nRemaining: ${row.limit_count - usedBy.length}`);
                }
            } else {
                return await message.reply("❌ Format: /promo [code]");
            }
        }

        return;

    } catch (error) {
        console.error("ERROR IN PROCESSING:", error);
        try { 
            await message.reply(`⚠️ Error executing command: ${error.message}`, { disable_mentions: 1 }); 
        } catch (e) {}
    }
});

// ===== ОБРАБОТКА НАЖАТИЙ НА КНОПКИ (CALLBACK) =====
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

        // ================= ГЛАВНОЕ МЕНЮ =================
        if (payload.cmd === 'main_menu') {
            await safeAnswer();
            if (payload.action === 'work') return await vk.api.messages.send({ peer_id: peerId, message: "💼 Choose work:", keyboard: getWorkKb(), random_id: 0 });
            if (payload.action === 'roulette') return await vk.api.messages.send({ peer_id: peerId, message: "🎰 roulette [color] [bet]", random_id: 0 });
            if (payload.action === 'profile') return await vk.api.messages.send({ peer_id: peerId, message: "Type profile", random_id: 0 });
            if (payload.action === 'top') return await vk.api.messages.send({ peer_id: peerId, message: "Type top", random_id: 0 });
        }

        // ================= РЕПОРТЫ =================
        if (payload.cmd === 'report_reply') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Owner only.' });
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Report closed.' });
            
            await safeAnswer();
            adminStates.set(ADMIN_ID, `reply_${payload.report_id}`);
            return await vk.api.messages.send({ peer_id: peerId, message: `✍️ Write reply for [id${report.reporter_id}|Player]:`, random_id: 0 });
        }

        if (payload.cmd === 'report_spam') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Owner only.' });
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Report closed.' });

            const reporterId = report.reporter_id;
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
            let warns = w ? w.count + 1 : 1;
            
            const spamMsg = `❌ YOUR REPORT REJECTED!\nReason: SPAM/ABUSE.\nCount: ${warns}/3.\n⚠️ At 3 warnings — bot blacklist!`;

            if (warns >= 3) {
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Spam by report (3/3)", Date.now() + 86400000]); 
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                try {
                    const banKb = Keyboard.builder().inline().urlButton({ label: 'Appeal', url: `https://vk.ru/topic-243089386_69303056` });
                    await vk.api.messages.send({ peer_id: reporterId, message: spamMsg + `\n\n😈 You are blacklisted for 1 day.`, keyboard: banKb.toString(), random_id: 0 });
                } catch(e){}
            } else {
                await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                try { await vk.api.messages.send({ peer_id: reporterId, message: spamMsg, random_id: 0 }); } catch(e){}
            }
            
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Report rejected (Spam)' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Report rejected as Spam.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // --- ОЦЕНКА РЕПОРТА (ФИКС 5-10 ХОРОШО) ---
        if (payload.cmd === 'report_rate_start') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Error.' });
            if (String(userId) !== report.reporter_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your report.' });
            if (report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Already rated.' });

            await safeAnswer();
            adminStates.set(userId, `rating_${report.id}`);
            return await vk.api.messages.send({ peer_id: peerId, message: `⭐ Rate from 1 to 10:\n(1-4 = Bad, 5-10 = Good)`, random_id: 0 });
        }

        if (payload.cmd === 'report_bad_reason') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Already rated.' });
            await dbRun("UPDATE reports SET status = 'closed', rate_reason = ? WHERE id = ?", [payload.reason, payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Complaint sent.' });
            try { await vk.api.messages.send({ peer_id: ADMIN_ID, message: `⚠️ Bad rating for report #${report.id}!\nPlayer: [id${report.reporter_id}|Player]\nReason: ${payload.reason}`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `🙏 Thanks for feedback!\nRecorded: ${payload.reason}.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // НОВЫЕ КНОПКИ ДЛЯ ХОРОШЕЙ ОЦЕНКИ
        if (payload.cmd === 'report_good_reason') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Already rated.' });
            await dbRun("UPDATE reports SET status = 'closed', rate_reason = ? WHERE id = ?", [payload.reason, payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Thanks for good rating!' });
            try { await vk.api.messages.send({ peer_id: ADMIN_ID, message: `🌟 Good rating for report #${report.id}!\nPlayer: [id${report.reporter_id}|Player]\nPlus: ${payload.reason}`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Thanks!\nGlad we could help. Report closed.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'report_close') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Error.' });
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Report closed.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Report closed. Thanks!`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= ВЫЗОВ АДМИНА (/admin) =================
        if (payload.cmd === 'admin_call_accept') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Owner only.' });
            
            const reporterId = payload.reporter_id;
            const targetId = payload.target_id;
            const text = payload.text || "Rule violation";
            
            try {
                // Send notification to reporter
                await vk.api.messages.send({ peer_id: Number(reporterId), message: `✅ Your complaint against [id${targetId}|Player] accepted by administration.`, random_id: 0 });
                
                // Send warning to violator
                await vk.api.messages.send({ peer_id: Number(targetId), message: `🚨 COMPLAINT FILED AGAINST YOU!\n\nAdministrator accepted the complaint.\nPlease follow chat rules.`, random_id: 0 });
            } catch(e) {}
            
            await safeAnswer({ type: 'show_snackbar', text: '✅ Complaint accepted.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Complaint accepted. Notifications sent.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'admin_call_spam') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Owner only.' });
            const reporterId = payload.reporter_id;
            
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
            let warns = w ? w.count + 1 : 1;
            
            const spamMsg = `❌ YOUR ADMIN CALL REJECTED!\nReason: SPAM/ABUSE.\nCount: ${warns}/3.\n⚠️ At 3 warnings — bot blacklist!`;

            if (warns >= 3) {
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Admin call spam (3/3)", Date.now() + 86400000]); 
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                try {
                    const banKb = Keyboard.builder().inline().urlButton({ label: 'Appeal', url: `https://vk.ru/topic-243089386_69303056` });
                    await vk.api.messages.send({ peer_id: Number(reporterId), message: spamMsg + `\n\n😈 You are blacklisted for 1 day.`, keyboard: banKb.toString(), random_id: 0 });
                } catch(e){}
            } else {
                await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                try { await vk.api.messages.send({ peer_id: Number(reporterId), message: spamMsg, random_id: 0 }); } catch(e){}
            }
            
            await safeAnswer({ type: 'show_snackbar', text: 'Call marked as spam.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Call rejected (Spam).`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= ДОЛГИ =================
        if (payload.cmd === 'debt_accept') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Request expired.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your request.' });

            await dbRun("UPDATE debts SET status = 'accepted' WHERE id = ?", [debt.id]);
            await updateBalance(userId, debt.amount);
            await safeAnswer({ type: 'show_snackbar', text: '✅ Debt accepted!' });
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `✅ [id${userId}|Player] accepted debt ${formatMoney(debt.amount)}$.`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `🤝 Debt accepted! +${formatMoney(debt.amount)}$. Return in ${debt.days} days.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'debt_decline') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Request expired.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your request.' });

            await dbRun("UPDATE debts SET status = 'declined' WHERE id = ?", [debt.id]);
            await updateBalance(debt.lender, debt.amount);
            await safeAnswer({ type: 'show_snackbar', text: '❌ Declined.' });
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `❌ [id${userId}|Player] declined debt.`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `❌ You declined the debt.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= БИЗНЕС =================
        if (payload.cmd === 'biz_withdraw') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your menu.' });
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ No business.' });
            
            const now = Date.now();
            if (now - biz.last_withdraw < 3600000) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Wait ${Math.floor((3600000 - (now - biz.last_withdraw))/60000)} min.` });

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const total = Number(biz.balance) + earned;
            if (total <= 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Empty.' });

            await updateBalance(userId, total);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            await safeAnswer({ type: 'show_snackbar', text: `✅ Withdrawn ${formatMoney(total)}$!` });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Withdrawn: ${formatMoney(total)}$`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'biz_upgrade') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your menu.' });
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz || biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Max level or no business.' });

            const cost = biz.level * 5000000;
            if (await getBalance(userId) < cost) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not enough money.' });

            await updateBalance(userId, -cost);
            await dbRun("UPDATE businesses SET level = level + 1 WHERE user_id = ?", [String(userId)]);
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Level upgraded! Now ${biz.level + 1}/5`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
        }
        
        // Кнопка слива бизнеса
        if (payload.cmd === 'biz_sell') {
             if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your menu.' });
             const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
             if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ No business.' });
             
             await updateBalance(userId, 10000000);
             await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
             await safeAnswer({ type: 'show_snackbar', text: '🔥 Business sold! +10kk' });
             return await vk.api.messages.edit({ peer_id: peerId, message: `🔥 You sold business for 10,000,000$!`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= РАБОТА =================
        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;

            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Work limit (3/h). Wait.` });

            if (payload.type === 'Такси') {
                const u = await dbGet("SELECT cars FROM users WHERE user_id = ?", [String(userId)]);
                if (JSON.parse(u?.cars || '[]').length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Need car for taxi.' });
            }

            await safeAnswer();
            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);
            const earned = Math.floor(Math.random() * 6000) + 1000;
            await updateBalance(userId, earned);
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Work (${payload.type}): +${formatMoney(earned)}$\nRemaining: ${3-count}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
        }

        // ================= HELP (ЗИМНИЙ РАЗДЕЛ) =================
        if (payload.cmd === 'help_start') {
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: "📖 Sections:", keyboard: getHelpKb(), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            let msg = "";
            if (payload.section === 'games') msg = "🎮 Games:\nroulette, crash, coinflip, cup, dice, slots, blackjack, dream, mines, fortune";
            if (payload.section === 'eco') msg = "💼 Economy:\nbusiness, buybiz, mybusiness, withdraw, sellbiz, bonus, transfer, duel, promo, cars, buy car, sellcar, givedebt, buysim";
            if (payload.section === 'profile') msg = "👤 Profile:\nprofile, top, rep +/-, ping, premium";
            if (payload.section === 'reports') msg = "📩 Reports:\nreport [text], admin (reply)";
            if (payload.section === 'org') msg = "🏛️ Orgs/Countries:\norganizations, join, countries, country";
            
            if (payload.section === 'winter') {
                msg = "❄️ WINTER GAMES ❄️\n\n" +
                      "🎮 Puzzle games (limit 10/day):\n" +
                      "▪️ snowballs - Throw snowball\n" +
                      "▪️ tree - Shake tree\n" +
                      "▪️ sleds - Sled ride\n" +
                      "▪️ snowman - Build snowman\n" +
                      "▪️ gift - Find gift\n\n" +
                      "🎁 Event:\n" +
                      "▪️ event - Winter event\n" +
                      "▪️ open winter case - Open reward";
            }

            if (payload.section === 'houses') {
                let txt = "🏠 HOUSES\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) {
                    const c = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [d.name]);
                    txt += `📍 ${d.name} (${c.c}/20)\n`;
                }
                msg = txt + "\n💡 buy house top [№] [Location]";
            }
            
            if (payload.section === 'garages') {
                let txt = "🏘️ GARAGES\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) {
                    const c = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [d.name]);
                    txt += `📍 ${d.name} (${c.c}/20)\n`;
                }
                msg = txt + "\n💡 buy garage top [№] [Location]";
            }
            
            return await vk.api.messages.edit({ peer_id: peerId, message: msg, keyboard: getHelpBackKb(), conversation_message_id: context.conversationMessageId });
        }

        // ================= ТОП (ФИКС ФИЛЬТРАЦИИ И КНОПОК) =================
        if (payload.cmd === 'top_menu' || payload.cmd === 'top_back') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not your menu!' });
            
            const type = payload.type || 'coins';
            const scope = payload.scope || 'chat';
            const repType = payload.repType || 'pos';

            let orderBy = "balance DESC", filter = "balance > 0";
            if (type === 'level') orderBy = "level DESC, xp DESC";
            if (type === 'duels') orderBy = "duel_wins DESC";
            if (type === 'bonus') orderBy = "bonus_count DESC";
            if (type === 'rep') { 
                orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; 
                filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; 
            }

            let rows = [];
            if (scope === 'global') {
                rows = await dbAll(`SELECT user_id, balance, level, reputation, duel_wins, bonus_count FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
            } else {
                // ТОЛЬКО ТЕ, КТО ЕСТЬ В БЕСЕДЕ
                rows = await dbAll(`SELECT u.user_id, u.balance, u.level, u.reputation, u.duel_wins, u.bonus_count FROM users u INNER JOIN chat_messages c ON u.user_id = c.user_id WHERE c.peer_id = ? AND ${filter} ORDER BY ${orderBy} LIMIT 10`, [String(context.peerId)]);
            }

            let title = `🏆 TOP 10 (${scope === 'global' ? 'Global' : 'In Chat'})\n\n`;
            let count = 0;
            const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            
            for (const r of rows) {
                const name = await getFullName(r.user_id);
                let val = "0";
                if (type === 'coins') val = formatShortMoney(r.balance) + '$';
                else if (type === 'level') val = `Lvl.${r.level}`;
                else if (type === 'duels') val = r.duel_wins || 0;
                else if (type === 'bonus') val = r.bonus_count || 0;
                else if (type === 'rep') val = r.reputation || 0;
                
                title += `${emojis[count]} ${name} — ${val}\n`;
                count++;
            }
            if (rows.length === 0) title += "Empty...";

            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: title, keyboard: getTopKb(payload.author, type, scope, repType), conversation_message_id: context.conversationMessageId });
        }

        // ================= ДУЭЛЬ =================
        if (payload.cmd === 'duel_accept') {
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            if (row) {
                if (String(userId) === row.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ Cannot duel yourself!' });
                if (await getBalance(userId) < row.bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ Not enough money!' });
                
                const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
                const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
                const prize = Math.floor(row.bet * 1.8);
                
                await updateBalance(winnerId, prize);
                await updateBalance(loserId, -row.bet);
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
                
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: `⚔️ Winner: ${await getFullName(winnerId)}\nLoser: ${await getFullName(loserId)}\n💰 ${prize}$`, keyboard: "", disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            }
        }

        // ================= МИНЫ (БЕЗ КД 60СЕК) =================
        if (payload.cmd === 'mines_set') {
            const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            if (!row) return await safeAnswer({ type: 'show_snackbar', text: '❌ Game expired.' });

            const minesArr = [];
            while(minesArr.length < Number(payload.count)) {
                const r = Math.floor(Math.random() * 9) + 1;
                if (!minesArr.includes(r)) minesArr.push(r);
            }
            
            // Убираем start_time или ставим 0, чтобы не было таймера
            await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0, start_time = 0 WHERE game_id = ?", [JSON.stringify(minesArr), String(payload.gameId)]);
            
            const ui = getMinesGameUI(String(payload.gameId), row.bet, Number(payload.count), minesArr, [], false, null, await getFullName(userId), await getBalance(userId), 0);
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'mines_click') {
            const row = await dbGet("SELECT bet, mines, opened, multiplier FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            if (!row) return;

            const bet = row.bet;
            const mines = JSON.parse(row.mines);
            const opened = JSON.parse(row.opened);
            const cell = Number(payload.cell);

            if (opened.includes(cell)) return;

            opened.push(cell);
            let isLoss = false, hitCell = null, currentMoney = 0;

            if (mines.includes(cell)) {
                isLoss = true; hitCell = cell;
                await updateBalance(userId, -bet);
                await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]);
            } else {
                let mult = 1.0;
                for (let i = 0; i < opened.length; i++) mult *= (9 - i) / (9 - mines.length - i);
                mult = Math.round(mult * 0.95 * 100) / 100;
                currentMoney = Math.floor(bet * mult);

                if (opened.length === (9 - mines.length)) {
                    await updateBalance(userId, currentMoney);
                    await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]);
                    isLoss = true; hitCell = -1;
                } else {
                    await dbRun("UPDATE games SET opened = ?, multiplier = ? WHERE game_id = ?", [JSON.stringify(opened), mult, String(payload.gameId)]);
                }
            }

            const balance = await getBalance(userId);
            const name = await getFullName(userId);
            await safeAnswer();
            
            if (isLoss) {
                const ui = getMinesGameUI(String(payload.gameId), bet, mines.length, mines, opened, true, hitCell, name, balance);
                let text = hitCell === -1 ? `🏆 WIN!\n+${currentMoney}$` : ui.text;
                return await vk.api.messages.edit({ peer_id: peerId, message: text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            } else {
                const ui = getMinesGameUI(String(payload.gameId), bet, mines.length, mines, opened, false, null, name, balance, 0);
                return await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
        }

        if (payload.cmd === 'mines_cashout') {
            const row = await dbGet("SELECT bet, multiplier, mines, opened FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            if (!row) return;
            const opened = JSON.parse(row.opened);
            if (opened.length === 0) return; 

            const win = Math.floor(row.bet * row.multiplier);
            await updateBalance(userId, win);
            await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]);
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: `💰 Cashed out: ${win}$ (x${row.multiplier})\nBalance: ${formatMoney(await getBalance(userId))}$`, keyboard: buildMinesKb(String(payload.gameId), opened, JSON.parse(row.mines), true, null), conversation_message_id: context.conversationMessageId });
        }

        await safeAnswer();
    } catch (e) {
        console.error("Callback Error:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Error.' });
    }
});

// ===== ОБРАБОТКА ОЦЕНОК И ЗАГАДОК =====
vk.updates.on('message_new', async (message, next) => {
    if (message.isOutbox || message.senderId < 0) return next();
    const text = message.text ? message.text.trim() : '';
    if (!text || message.peerId !== message.senderId) return next();

    const userId = message.senderId;
    const state = adminStates.get(userId);

    // Обработка ответов на загадки зимних игр
    if (state && state.startsWith('riddle_')) {
        const parts = state.split('_');
        const gameCmd = parts[1];
        const correctAnswer = parseInt(parts[2]);
        const userAnswer = parseInt(text);

        if (isNaN(userAnswer)) return await message.reply("❌ Enter a number!");

        adminStates.delete(userId);

        if (userAnswer === correctAnswer) {
            const prize = Math.floor(Math.random() * 4000000) + 1000000; // 1кк - 5кк
            await updateBalance(userId, prize);
            
            // Обновляем очки для ивента
            let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (!ev) await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
            await dbRun("UPDATE winter_event SET game_score = game_score + ? WHERE user_id = ?", [prize, String(userId)]);

            const emojis = {
                'снежки': '❄️', 'елка': '🎄', 'санки': '🛷', 'снеговик': '⛄', 'подарок': '🎁'
            };
            return await message.reply(`${emojis[gameCmd]} Correct! 🎉\n💰 Reward: +${formatMoney(prize)}$`);
        } else {
            return await message.reply(`❌ Wrong! Correct answer: ${correctAnswer}. Try again (limit not spent on wrong answer).`);
        }
    }

    // Обработка оценок репортов
    if (state && state.startsWith('rating_')) {
        const reportId = state.split('_')[1];
        const rating = parseInt(text);

        if (isNaN(rating) || rating < 1 || rating > 10) return await message.reply("❌ Enter number from 1 to 10.");

        adminStates.delete(userId);
        const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
        
        if (report) {
            await dbRun("UPDATE reports SET rating = ? WHERE id = ?", [rating, reportId]);

            // 1-4 ПЛОХО
            if (rating <= 4) {
                return await message.reply(`😔 Rating ${rating}/10 (Bad).\nWhat's wrong?`, { keyboard: getBadRateKb(reportId) });
            } 
            // 5-10 ХОРОШО
            else {
                await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [reportId]);
                return await message.reply(`🙏 Rating ${rating}/10 (Good)!\nThanks for choosing reason:`, { keyboard: getGoodRateKb(reportId) });
            }
        }
        return;
    }
    return next();
});

// ===== ПРИВЕТСТВИЕ И БАН ПРИ ВХОДЕ =====
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
                await vk.api.messages.send({ peer_id: context.peerId, message: `🚫 [id${context.memberId}|Player] kicked (Chat Ban).\nReason: ${chatBan.reason}`, random_id: 0, disable_mentions: 1 });
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

        const greetText = isAdmin 
            ? "Hello! I'm Game Zone Bot. Have admin rights. Type help." 
            : "Hello! I'm Game Zone Bot. Give admin rights for full features. Type help.";
        
        const actKb = Keyboard.builder().inline()
            .callbackButton({ label: 'Activate', payload: { cmd: 'activate_bot' }, color: Keyboard.POSITIVE_COLOR })
            .callbackButton({ label: 'Cancel', payload: { cmd: 'decline_bot' }, color: Keyboard.NEGATIVE_COLOR });
        
        try {
            await vk.api.messages.send({ peer_id: context.peerId, message: greetText, keyboard: actKb.toString(), random_id: 0, group_id: GROUP_ID, disable_mentions: 1 });
        } catch (err) { console.error(err); }
    }
});

// ===== ЗАПУСК =====
console.log("=========================================");
console.log("STARTING GAME ZONE BOT...");
console.log("=========================================");

vk.updates.startPolling().then(() => {
    console.log("--- BOT STARTED ---");
}).catch(err => {
    console.error("START ERROR:", err);
});
