const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

console.log("=========================================");
console.log("ВЕРСИЯ NODE.JS:", process.version);
console.log("ЗАПУСК GAME ZONE BOT...");
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
    'бугатти': { name: 'Bugatti Chiron', price: 0, sellPrice: 0 },
    'ф90 дпс': { name: 'BMW M5 F90 ДПС', price: 0, sellPrice: 0 },
    'ппс': { name: 'Toyota Camry ППС', price: 0, sellPrice: 0 },
    'дпс': { name: 'Ford Focus ДПС', price: 0, sellPrice: 0 },
    'ферари': { name: 'Ferrari 488', price: 0, sellPrice: 0 }
};

const PROPERTY_DATA = {
    'нижегородская': { name: 'Нижегородская', housePrice: 5000000, garagePrice: 1000000 },
    'рублевка': { name: 'Рублевка', housePrice: 25000000, garagePrice: 5000000 },
    'егоровка': { name: 'Егоровка', housePrice: 50000000, garagePrice: 10000000 },
    'гарель': { name: 'Гарель', housePrice: 100000000, garagePrice: 20000000 }
};

const ORGS = ['ФСБ', 'Правительство', 'УМВД', 'ГИБДД', 'Армия', 'ФСИН'];
const COUNTRIES = ['Россия', 'Чеченская Республика', 'Беларусь', 'Казахстан', 'Украина', 'Армения', 'Грузия'];

// ===== ИНИЦИАЛИЗАЦИЯ БД =====
async function initDB() {
    await dbRun("DROP TABLE IF EXISTS reports");
    await dbRun("DROP TABLE IF EXISTS winter_event");
    await dbRun("DROP TABLE IF EXISTS rep_limits");
    await dbRun("DROP TABLE IF EXISTS staff");

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
    
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT, target_id TEXT, last_given INTEGER, PRIMARY KEY (user_id, target_id))");
    
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS custom_cmds (user_id TEXT, alias TEXT, real_cmd TEXT, PRIMARY KEY (user_id, alias))");
    await dbRun("CREATE TABLE IF NOT EXISTS warnings (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, lender TEXT, borrower TEXT, amount INTEGER, days INTEGER, status TEXT DEFAULT 'pending')");
    await dbRun("CREATE TABLE IF NOT EXISTS sim_cards (number TEXT PRIMARY KEY, owner_id TEXT)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, text TEXT, status TEXT DEFAULT 'pending', chat_id TEXT, reply_text TEXT, rating INTEGER DEFAULT 0, rate_reason TEXT)");

    await dbRun("CREATE TABLE IF NOT EXISTS winter_event (user_id TEXT PRIMARY KEY, reps_given INTEGER DEFAULT 0, game_score INTEGER DEFAULT 0, msgs_sent INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, last_opened INTEGER DEFAULT 0)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS winter_limits (user_id TEXT PRIMARY KEY, snowballs INTEGER DEFAULT 0, tree INTEGER DEFAULT 0, sleds INTEGER DEFAULT 0, snowman INTEGER DEFAULT 0, gift INTEGER DEFAULT 0, last_reset INTEGER DEFAULT 0)");

    await dbRun("CREATE TABLE IF NOT EXISTS winter_case_prizes (user_id TEXT PRIMARY KEY, bugatti INTEGER DEFAULT 0, premium_forever INTEGER DEFAULT 0)");

    await dbRun("CREATE TABLE IF NOT EXISTS staff (user_id TEXT PRIMARY KEY, role TEXT, assigned_by TEXT, assigned_at INTEGER)");

    try { await dbRun("ALTER TABLE users ADD COLUMN sim_card TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN cars TEXT DEFAULT '[]'"); } catch(e) {}

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
        return `${user.first_name} ${user.last_name || ''}`.trim();
    } catch { return `Игрок ${userId}`; }
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
        .callbackButton({ label: '🎮 Игры', payload: { cmd: 'help_menu', section: 'games' }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '💼 Экономика', payload: { cmd: 'help_menu', section: 'eco' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🏠 Дома', payload: { cmd: 'help_menu', section: 'houses' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🏘️ Гаражи', payload: { cmd: 'help_menu', section: 'garages' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '👤 Профиль', payload: { cmd: 'help_menu', section: 'profile' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '📩 Жалобы', payload: { cmd: 'help_menu', section: 'reports' }, color: Keyboard.SECONDARY_COLOR })
        .row()
        .callbackButton({ label: '🏛️ Организации', payload: { cmd: 'help_menu', section: 'org' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '❄️ Зимние игры', payload: { cmd: 'help_menu', section: 'winter' }, color: Keyboard.PRIMARY_COLOR })
        .toString();
};

const getHelpBackKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '🔙 Назад', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR })
        .toString();
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

// ТОП С КНОПКАМИ ВНУТРИ РАЗДЕЛА (Общее / В беседе / Назад)
const getTopKb = (authorId, type = 'coins', scope = 'chat') => {
    const kb = Keyboard.builder().inline();
    
    // Категории топа
    kb.callbackButton({ label: '💰 Монеты', payload: { cmd: 'top_menu', type: 'coins', scope, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Уровень', payload: { cmd: 'top_menu', type: 'level', scope, author: authorId }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '⚔️ Дуэли', payload: { cmd: 'top_menu', type: 'duels', scope, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Репутация', payload: { cmd: 'top_menu', type: 'rep', scope, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '🎁 Бонус', payload: { cmd: 'top_menu', type: 'bonus', scope, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    
    // Переключатели режима ВНУТРИ раздела
    kb.row();
    kb.callbackButton({ label: '🌍 Общее', payload: { cmd: 'top_menu', type, scope: 'global', author: authorId }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 В беседе', payload: { cmd: 'top_menu', type, scope: 'chat', author: authorId }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    
    kb.row();
    kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });
    
    return kb.toString();
};

const getBizKb = (authorId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: 'Вывести $$$', payload: { cmd: 'biz_withdraw', author: authorId }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: 'Повысить уровень', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🔥 Слить бизнес', payload: { cmd: 'biz_sell', author: authorId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getAdminReportKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✍️ Ответить', payload: { cmd: 'report_reply', report_id: reportId }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '🚫 Спам', payload: { cmd: 'report_spam', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getReportRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⭐ Оценить работу', payload: { cmd: 'report_rate_start', report_id: reportId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Закрыть вопрос', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

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

const getGoodRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Быстро ответил', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Быстро ответил' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🤝 Помог решить проблему', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Помог решить проблему' }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: '😊 Вежливый админ', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Вежливый админ' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🌟 Всё супер!', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Всё супер!' }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: '❌ Закрыть репорт', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getDebtKb = (debtId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Принять', payload: { cmd: 'debt_accept', debt_id: debtId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Отказать', payload: { cmd: 'debt_decline', debt_id: debtId }, color: Keyboard.NEGATIVE_COLOR })
        .toString();
};

const getAdminCallKb = (reporterId, targetId, text) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Принять жалобу', payload: { cmd: 'admin_call_accept', reporter_id: reporterId, target_id: targetId, text: text }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🚫 Спам/Флуд', payload: { cmd: 'admin_call_spam', reporter_id: reporterId }, color: Keyboard.NEGATIVE_COLOR })
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
            if (isFrozen) return await message.reply("💀 Вы заморожены в боте. Ожидайте наказания!");
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
                        const banText = `😈 Вы в ЧС бота ${timeStr}. Причина: ${isBlacklisted.reason}`;
                        const banKb = Keyboard.builder().inline()
                            .urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` })
                            .row().urlButton({ label: 'Правила', url: `https://vk.ru/topic-243089386_69454146` });
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

        // --- ПРОВЕРКА ПРАВ АДМИНИСТРАТОРА/РАЗРАБОТЧИКА ---
        const staffData = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
        const isAdminOrDev = userId === ADMIN_ID || (staffData && (staffData.role === 'Разработчик' || staffData.role === 'Администратор'));

        // --- ОТВЕТЫ НА РЕПОРТЫ (АДМИН/РАЗРАБОТЧИК) ---
        if (isAdminOrDev && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            
            if (state.startsWith('reply_')) {
                const reportId = state.split('_')[1];
                const replyText = text;
                adminStates.delete(userId);
                
                const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
                if (report) {
                    await dbRun("UPDATE reports SET status = 'answered', reply_text = ? WHERE id = ?", [replyText, reportId]);
                    
                    const replyKb = getReportRateKb(reportId);
                    const replierName = await getFullName(userId);
                    const replyMsg = `📩 Ответ от ${replierName}:\n\n${replyText}\n\n👇 Оцените работу:`;
                    
                    try {
                        await vk.api.messages.send({ peer_id: report.reporter_id, message: replyMsg, keyboard: replyKb.toString(), random_id: 0 });
                        if (report.chat_id && report.chat_id > 0) {
                            await vk.api.messages.send({ 
                                peer_id: report.chat_id, 
                                message: `📩 ${replierName} ответил на репорт #${reportId} игроку ${await getFullName(report.reporter_id)}.`, 
                                random_id: 0, disable_mentions: 1
                            });
                        }
                    } catch(e) {}
                }
                return await message.reply("✅ Ответ отправлен.");
            }
        }

        // СПИСОК КОМАНД (УБРАНЫ ЗИМНИЕ ИГРЫ, ОСТАВЛЕНЫ ТОЛЬКО EVENT И ОТКРЫТЬ)
        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cc', 'ping', 'пинг', 'убрать', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'cmd', 'моикоманды', 'premium', 'рег', 'q', 'админ', 'ahelp', 'объявление', 'report', 'вступить', 'организации', 'страна', 'страны', 'датьдолг', 'мойдолг', 'cl', 'снятьпред', 'купитьсим', 'слитьсим', 'event', 'открыть', 'слитьбиз', 'logs', 'чсблист', 'banlist', 'setadmin', 'staff'];
        
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
            if (message.isChat) return await message.reply("✅ Бот активирован! Пиши help.", replyParams());
            return await message.reply("👋 Привет! Выбирай действие.", replyParams(mainKb));
        }

        if (cmdWord === 'help' || cmdWord === 'помощь') {
            return await message.reply("📖 Выберите раздел:", replyParams(getHelpKb()));
        }

        if (cmdWord === 'ahelp') {
            if (!isAdminOrDev) return;
            let txt = `👑 АДМИН КОМАНДЫ\n\n`;
            txt += `cc - Удалить промокоды\n`;
            txt += `объявление [текст] - Рассылка\n`;
            txt += `выдать [сумма] [@ник/all]\n`;
            txt += `обнулить [@ник/all]\n`;
            txt += `cl [@ник/all] - Полный сброс\n`;
            txt += `снятьпред [@ник]\n`;
            txt += `чсб [@ник] [дней] [причина]\n`;
            txt += `разчсб [@ник]\n`;
            txt += `mute [@ник] [мин]\n`;
            txt += `kick [@ник] [причина]\n`;
            txt += `logs @vk - Логи (файлом в ЛС)\n`;
            txt += `ban @vk [причина] - Бан в беседе\n`;
            txt += `unban @vk - Разбан\n`;
            txt += `banlist - Список банов беседы\n`;
            txt += `чсблист - Список ЧС бота\n`;
            txt += `setadmin [@ник] [роль] - Выдать роль\n`;
            txt += `staff - Список администрации\n`;
            return await message.reply(txt);
        }

        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now();
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            return await message.reply(`🏓 Понг: ${Date.now() - start} мс`, replyParams());
        }

        // --- СИМ-КАРТЫ (ВЫБОР НОМЕРА ИГРОКОМ) ---
        if (cmdWord === 'купитьсим') {
            if (userRow.sim_card) return await message.reply(`❌ У вас уже есть сим-карта (${userRow.sim_card}). Сначала слейте её: слитьсим`, replyParams());
            
            let desiredNumber = parts[1];
            if (!desiredNumber || desiredNumber.length !== 4 || isNaN(desiredNumber)) {
                return await message.reply("❌ Формат: /купитьсим [4 цифры]\nПример: /купитьсим 7777", replyParams());
            }

            const existing = await dbGet("SELECT owner_id FROM sim_cards WHERE number = ?", [desiredNumber]);
            if (existing) {
                return await message.reply(`❌ Номер ${desiredNumber} уже занят другим игроком! Выберите другой.`, replyParams());
            }

            await dbRun("INSERT INTO sim_cards (number, owner_id) VALUES (?, ?)", [desiredNumber, String(userId)]);
            await dbRun("UPDATE users SET sim_card = ? WHERE user_id = ?", [desiredNumber, String(userId)]);
            return await message.reply(`📱 Сим-карта куплена!\nВаш номер: ${desiredNumber}`, replyParams());
        }

        if (cmdWord === 'слитьсим') {
            if (!userRow.sim_card) return await message.reply("❌ Нет сим-карты.", replyParams());
            await dbRun("DELETE FROM sim_cards WHERE number = ?", [userRow.sim_card]);
            await dbRun("UPDATE users SET sim_card = NULL WHERE user_id = ?", [String(userId)]);
            await updateBalance(userId, 10000);
            return await message.reply(`📱 Сим-карта слита за 10,000$!`, replyParams());
        }

        // --- РЕПУТАЦИЯ (ПЕРСОНАЛЬНЫЙ ЛИМИТ + ШАБЛОН БЕЗ УПОМИНАНИЯ) ---
        if (cmdWord === 'rep' || cmdWord === 'реп') {
            if (parts.length < 2) return await message.reply("🔔 Для изменения репутации используйте /rep + или /rep -, указав пользователя. Пример: /rep + @Mokhma.volk\nЛибо ответьте на сообщение игрока.", replyParams());
            
            const isPlus = parts[1] === '+';
            const isMinus = parts[1] === '-';
            if (!isPlus && !isMinus) return await message.reply("🔔 Для изменения репутации используйте /rep + или /rep -, указав пользователя. Пример: /rep + @Mokhma.volk\nЛибо ответьте на сообщение игрока.", replyParams());

            let targetId = null;
            // Если ответили на сообщение - берем автора ответа
            if (message.hasReplyMessage) {
                targetId = message.replyMessage.senderId;
            } else {
                // Иначе ищем упоминание или ник после команды
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

            if (!targetId) return await message.reply("🔔 Для изменения репутации используйте /rep + или /rep -, указав пользователя. Пример: /rep + @Mokhma.volk\nЛибо ответьте на сообщение игрока.", replyParams());
            if (targetId === userId) return await message.reply("❌ Нельзя изменить репутацию самому себе.", replyParams());

            const now = Date.now();
            
            // Проверяем, давал ли ТЫ (userId) реп ЭТОМУ ЧЕЛОВЕКУ (targetId) за последние 24 часа
            const repLimit = await dbGet("SELECT last_given FROM rep_limits WHERE user_id = ? AND target_id = ?", [String(userId), String(targetId)]);
            
            if (repLimit && (now - repLimit.last_given) < 86400000) {
                const timeLeft = 86400000 - (now - repLimit.last_given);
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);
                return await message.reply(`⛔ Вы уже изменяли репутацию этого пользователя. Попробуйте снова через ${hours} ч. ${minutes} мин.`);
            }

            // Записываем в базу, что мы дали реп этому человеку СЕЙЧАС
            await dbRun("INSERT OR REPLACE INTO rep_limits (user_id, target_id, last_given) VALUES (?, ?, ?)", [String(userId), String(targetId), now]);

            const targetName = await getFullName(targetId);
            const senderName = await getFullName(userId);

            if (isPlus) {
                await updateReputation(targetId, 1);
                const newRep = await getReputation(targetId);
                // Обновляем прогресс зимнего ивента
                let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
                if (!ev) await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
                await dbRun("UPDATE winter_event SET reps_given = reps_given + 1 WHERE user_id = ?", [String(userId)]);
                
                return await message.reply(`${senderName} повысил репутацию пользователя ${targetName}, теперь у него +${newRep}`);
            } else {
                await updateReputation(targetId, -1);
                const newRep = await getReputation(targetId);
                return await message.reply(`${senderName} понизил репутацию пользователя ${targetName}, теперь у него ${newRep}`);
            }
        }

        // --- ПРОФИЛЬ (ЗИМНИЕ ЭМОДЗИ 🎄, БЕЗ ОДЕЖДЫ, МАШИНЫ ИЗ КЕЙСА) ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house' LIMIT 1", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage' LIMIT 1", [String(userId)]);
            const bizData = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            const carsArr = JSON.parse(userRow.cars || '[]');
            
            const premStr = isPremium ? `До ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}` : "Нет";
            const bizStr = bizData ? bizData.biz_name : "Нет";
            
            // Отображаем машины из кейса отдельно
            let specialCars = [];
            let normalCars = [];
            for (const car of carsArr) {
                if (['Bugatti Chiron', 'BMW M5 F90 ДПС', 'Toyota Camry ППС', 'Ford Focus ДПС', 'Ferrari 488'].includes(car)) {
                    specialCars.push(car);
                } else {
                    normalCars.push(car);
                }
            }
            
            let carsStr = "Нет";
            if (normalCars.length > 0 || specialCars.length > 0) {
                const allCars = [...specialCars, ...normalCars];
                carsStr = allCars.join(', ');
            }
            
            const simStr = userRow.sim_card || "Нет";
            const userName = await getFullName(userId);

            const profText = `🎄 Профиль ${userName} 🎄\n\n` +
                             `🎄 Баланс: ${formatMoney(balance)}$\n` +
                             `🎄 Тел: ${simStr}\n` +
                             `🎄 Премиум: ${premStr}\n` +
                             `🎄 Реп: ${rep}\n` +
                             `🎄 Уровень: ${userRow.level} (${userRow.xp}/${userRow.level*500} XP)\n\n` +
                             `🎄 Бизнес: ${bizStr}\n` +
                             `🎄 Дом: ${houseData ? houseData.location + ' Т' + houseData.tier : "Нет"}\n` +
                             `🎄 Гараж: ${garageData ? garageData.location + ' Т' + garageData.tier : "Нет"}\n` +
                             `🎄 Машины (${carsArr.length}/10): ${carsStr}\n` +
                             `🎄 Орг: ${userRow.org || "Нет"}\n` +
                             `🎄 Страна: ${userRow.country || "Нет"}\n\n` +
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
            let txt = "🚗 Автосалон:\n\n";
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.price > 0) txt += `${data.name} — ${formatMoney(data.price)}$\n`;
            }
            return await message.reply(txt + "\n🛒 Купить: купить машина [Название]", replyParams());
        }

        if (cmdWord === 'купить' && parts[1] === 'машина') {
            const query = parts.slice(2).join(' ').toLowerCase().trim();
            if (!query) return await message.reply("❌ Укажите название: купить машина м5 ф90");
            
            let selectedCar = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { selectedCar = data; break; }
            }
            if (!selectedCar || selectedCar.price === 0) return await message.reply("❌ Такой машины нет в автосалоне. Список: /машины");

            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length >= 10) return await message.reply("❌ У вас уже 10 машин!");
            if (balance < selectedCar.price) return await message.reply("❌ У вас недостаточно монеток");

            await updateBalance(userId, -selectedCar.price);
            carsArr.push(selectedCar.name);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🎉 Куплена ${selectedCar.name} за ${formatMoney(selectedCar.price)}$!`, replyParams());
        }

        if (cmdWord === 'sellcar' || cmdWord === 'слить') {
            let carsArr = JSON.parse(userRow.cars || '[]');
            if (carsArr.length === 0) return await message.reply("❌ Нет машины.", replyParams());

            const carName = carsArr.pop();
            let carData = null;
            for (const [key, data] of Object.entries(CARS_DATA)) {
                if (data.name === carName) { carData = data; break; }
            }
            if (!carData) {
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                return await message.reply("❌ Ошибка: машина не найдена.", replyParams());
            }

            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🚗 Машина ${carData.name} слита! +${formatMoney(sellPrice)}$`, replyParams());
        }

        // --- БИЗНЕС ---
        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Бизнесы (Макс 1):\n\n";
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
            if (!selectedBiz) return await message.reply("❌ Такого бизнеса нет. Посмотрите: /бизнес");
            if (balance < selectedBiz.price) return await message.reply("❌ У вас недостаточно монеток");

            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
            return await message.reply(`🎉 Куплен ${selectedBiz.name} за ${formatMoney(selectedBiz.price)}$!`, replyParams());
        }

        if (cmdWord === 'мойбизнес') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ Нет бизнеса. Купите: /бизнес");
            
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
                message: `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение: ${formatMoney(nextLevelCost)}$`,
                attachment: attachment || undefined,
                keyboard: getBizKb(userId)
            });
        }

        // --- ВЫВОД ДЕНЕГ С БИЗНЕСА (С ОТСЛЕЖИВАНИЕМ ИВЕНТА) ---
        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ Нет бизнеса.");

            const now = Date.now();
            const lastWithdraw = Number(biz.last_withdraw) || 0;
            const cd = 3600000;

            if (now - lastWithdraw < cd) {
                const remaining = cd - (now - lastWithdraw);
                const m = Math.floor(remaining / 60000);
                return await message.reply(`⏳ Вывод раз в час. Ждите ${m} мин.`);
            }

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;

            if (totalBalance <= 0) return await message.reply("❌ На балансе 0.");

            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            
            // Отслеживаем вывод денег для ивента (только 1 раз)
            let ev = await dbGet("SELECT msgs_sent FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (ev && ev.msgs_sent < 1) {
                await dbRun("UPDATE winter_event SET msgs_sent = msgs_sent + 1 WHERE user_id = ?", [String(userId)]);
            }
            
            return await message.reply(`💸 Выведено ${formatMoney(totalBalance)}$!`, replyParams());
        }

        // --- ДОМА И ГАРАЖИ ---
        if (cmdWord === 'дома') {
            let txt = "🏠 Доступные дома:\n\n";
            let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.housePrice)}$ (Свободно: ${20 - countRow.c}/20)\n`;
                i++;
            }
            return await message.reply(txt + "\n💡 Купить: купить дом топ [номер] [Локация]\n💡 Продать: продать дом [сумма] (ответом)", replyParams());
        }

        if (cmdWord === 'гаражи') {
            let txt = "🏘️ Доступные гаражи:\n\n";
            let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.garagePrice)}$ (Свободно: ${20 - countRow.c}/20)\n`;
                i++;
            }
            return await message.reply(txt + "\n💡 Купить: купить гараж топ [номер] [Локация]\n💡 Продать: продать гараж [сумма] (ответом)", replyParams());
        }

        if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1];
            const tierNum = parseInt(parts[2]);
            const locationName = parts.slice(3).join(' ').toLowerCase().trim();

            if (!tierNum || !locationName) return await message.reply(`❌ Формат: купить ${propType} топ [номер] [Локация]`);

            let selectedLoc = null;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                if (key.includes(locationName) || data.name.toLowerCase().includes(locationName)) {
                    selectedLoc = { key, ...data };
                    break;
                }
            }
            if (!selectedLoc) return await message.reply("❌ Такая локация не найдена. Посмотрите список: /дома или /гаражи");

            const existingProp = await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ? AND location = ?", [String(userId), propType, selectedLoc.name]);
            if (existingProp) return await message.reply(`❌ У вас уже есть ${propType} в локации ${selectedLoc.name}!`);

            const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [selectedLoc.name, propType]);
            if (countRow.c >= 20) return await message.reply(`❌ В локации ${selectedLoc.name} больше нет свободных ${propType === 'дом' ? 'домов' : 'гаражей'}!`);

            const price = propType === 'дом' ? selectedLoc.housePrice : selectedLoc.garagePrice;
            if (balance < price) return await message.reply("❌ У вас недостаточно монеток");

            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [propType, selectedLoc.name, tierNum, String(userId)]);
            
            const emoji = propType === 'дом' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Вы успешно купили ${propType} в локации ${selectedLoc.name} за ${formatMoney(price)}$!`, replyParams());
        }

        if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1];
            if (!message.hasReplyMessage) return await message.reply(`❌ Ответьте на сообщение покупателя и напишите: продать ${propType} [сумма]`);

            const buyerId = message.replyMessage.senderId;
            const price = parseAmount(parts[2]);
            
            if (!price || price < 1000) return await message.reply(`❌ Укажите корректную сумму продажи.`);
            if (buyerId === userId) return await message.reply("❌ Нельзя продать самому себе.");

            const myProp = await dbGet("SELECT id, location, type FROM properties WHERE owner_id = ? AND type = ? ORDER BY id DESC LIMIT 1", [String(userId), propType]);
            
            if (!myProp) return await message.reply(`❌ У вас нет ${propType} для продажи!`);

            const buyerBal = await getBalance(buyerId);
            if (buyerBal < price) return await message.reply("❌ У покупателя недостаточно средств!");

            await dbRun("UPDATE properties SET owner_id = ? WHERE id = ?", [String(buyerId), myProp.id]);
            
            await updateBalance(userId, price);
            await updateBalance(buyerId, -price);

            const emoji = propType === 'дом' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Вы продали ${propType} в локации ${myProp.location} игроку ${await getFullName(buyerId)} за ${formatMoney(price)}$!`, replyParams());
        }

        // --- ДОНАТЫ НЕДВИЖИМОСТИ (ИСПРАВЛЕНО) ---
        if (cmdWord === 'дондом' || cmdWord === 'донгараж') {
            const propType = cmdWord === 'дондом' ? 'house' : 'garage';
            const emoji = cmdWord === 'дондом' ? '🏠' : '🏘️';
            const typeName = cmdWord === 'дондом' ? 'ДОМОВ' : 'ГАРАЖЕЙ';
            
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
                return await message.reply(`${emoji} Нет ${typeName.toLowerCase()} с тирами Т1-Т10 для доната.`, replyParams());
            }

            let txt = `${emoji} ТОП 10 ${typeName} (Т1-Т10) ДЛЯ ДОНАТА:\n\n`;
            let count = 0;
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            
            for (const r of rows) {
                const ownerName = r.owner_name || 'Неизвестно';
                txt += `${emojis[count]} [ID:${r.id}] ${r.location} Т${r.tier} — Владелец: ${ownerName}\n`;
                count++;
            }

            txt += `\n💡 Чтобы задонатить: /дон ${propType === 'house' ? 'дом' : 'гараж'} [ID] [сумма]`;
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'дон' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1] === 'дом' ? 'house' : 'garage';
            const propId = parseInt(parts[2]);
            const amount = parseAmount(parts[3]);

            if (!propId || !amount || amount < 100) {
                return await message.reply(`❌ Формат: /дон ${parts[1]} [ID недвижимости] [сумма]\nСписок: /дондом или /донгараж`, replyParams());
            }

            const prop = await dbGet("SELECT * FROM properties WHERE id = ? AND type = ?", [propId, propType]);
            if (!prop) return await message.reply(`❌ Недвижимость с ID ${propId} не найдена!`, replyParams());

            if (balance < amount) return await message.reply("❌ У вас недостаточно монеток");

            await updateBalance(userId, -amount);

            const emoji = propType === 'house' ? '🏠' : '🏘️';
            return await message.reply(`${emoji} Задонатил ${formatMoney(amount)}$ на ${propType === 'house' ? 'дом' : 'гараж'} #${propId} (${prop.location} Т${prop.tier})!`, replyParams());
        }

        // --- ТОП (НОВЫЙ ДИЗАЙН, БЕЗ УПОМИНАНИЙ, С КНОПКАМИ ВНУТРИ) ---
        if (cmdWord === 'топ' || cmdWord === 'top') {
            // По умолчанию показываем сообщения в беседе
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
                        // Просто синий текст имени и фамилии без упоминания
                        topText += `${emojis[count]} ${uInfo.first_name} ${uInfo.last_name || ''} - ${r.count} сообщ.\n`;
                        count++;
                    }
                }
            } else topText += "В этой беседе пока тихо...";

            // Отслеживаем использование /top для ивента (максимум 3 раза)
            let ev = await dbGet("SELECT game_score FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (ev && ev.game_score < 3) {
                await dbRun("UPDATE winter_event SET game_score = game_score + 1 WHERE user_id = ?", [String(userId)]);
            }

            return await message.reply(topText, replyParams(getTopKb(userId, 'coins', 'chat')));
        }

        // --- ЗИМНИЙ ИВЕНТ (НОВЫЙ ТЕКСТ И ЗАДАНИЯ) ---
        if (cmdWord === 'event') {
            let eventRow = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (!eventRow) {
                await dbRun("INSERT INTO winter_event (user_id, reps_given, game_score, msgs_sent, completed, last_opened) VALUES (?, 0, 0, 0, 0, 0)", [String(userId)]);
                eventRow = { reps_given: 0, game_score: 0, msgs_sent: 0, completed: 0, last_opened: 0 };
            }

            // Кулдаун 1 час после получения кейса
            if (eventRow.completed === 1 && eventRow.last_opened === 0) {
                 // Если выполнил, но еще не открыл - разрешаем открыть
            } else if (eventRow.last_opened > 0) {
                const hoursLeft = Math.ceil((86400000 - (Date.now() - eventRow.last_opened)) / 3600000);
                if (hoursLeft > 0) {
                    const nextTime = new Date(eventRow.last_opened + 86400000).toLocaleString('ru-RU');
                    return await message.reply(`❄️ Вы уже забрали зимний кейс! Подождите до ${nextTime}.`, replyParams());
                }
            }

            const msgRow = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(userId)]);
            const currentMsgs = msgRow ? msgRow.count : 0;

            const task1Done = eventRow.reps_given >= 5; // Изменено на 5 реп
            const task2Done = currentMsgs >= 100;
            const task3Done = eventRow.game_score >= 3;

            if (task1Done && task2Done && task3Done) {
                if (eventRow.completed !== 1) {
                    await dbRun("UPDATE winter_event SET completed = 1 WHERE user_id = ?", [String(userId)]);
                    return await message.reply(`🎉 ЗАДАНИЯ ВЫПОЛНЕНЫ!\n\n🎁 Получен: Кейс "Зимний"\nКогда выполните всё, напишите /открыть кейс зимний`, replyParams());
                } else {
                    return await message.reply(`🎁 У вас есть незатронутый Зимний кейс!\nКогда выполните всё, напишите /открыть кейс зимний`, replyParams());
                }
            } else {
                let progressText = `Поздравляем с зимой🌨️\n\nМы приготовили вам подарок до 10.01.2027 в виде зимние кейсы, выполняй задания внизу и возьми кейсу🔥\n\n`;
                progressText += `1) ☃️Выдать любому игроку репутацию ${eventRow.reps_given}/5 ❄️\n`;
                progressText += `2) ☃️Написать в беседе сообщение ${currentMsgs}/100❄️\n`;
                progressText += `3) ☃️Напиши /top ${eventRow.game_score}/3❄️\n\n`;
                progressText += `Когда все выполнишь напиши /открыть кейс зимний😍 Главная приз в виде Bugatti Veyron`;
                return await message.reply(progressText, replyParams());
            }
        }

        // --- ОТКРЫТИЕ КЕЙСА (ЗИМНИЙ И ОСОБЫЙ) ---
        if (cmdWord === 'открыть') {
            const caseName = parts.slice(1).join(' ').toLowerCase().trim();
            
            // ЗИМНИЙ КЕЙС
            if (caseName === 'кейс зимний' || caseName === 'зимний') {
                const eventRow = await dbGet("SELECT completed, last_opened FROM winter_event WHERE user_id = ?", [String(userId)]);
                
                if (!eventRow || eventRow.completed !== 1) {
                    return await message.reply("❌ Нет Зимнего кейса. Выполните /event.", replyParams());
                }

                if (eventRow.last_opened > 0 && (Date.now() - eventRow.last_opened) < 86400000) {
                    const nextTime = new Date(eventRow.last_opened + 86400000).toLocaleString('ru-RU');
                    return await message.reply(`❄️ Вы уже открывали кейс! Подождите до ${nextTime}.`, replyParams());
                }

                await message.reply("📦 Открываю кейс...", replyParams());
                
                // 10 наград, выпадает только 1
                const possiblePrizes = [
                    { type: 'bugatti', text: 'Bugatti Veyron', car: 'Bugatti Chiron' },
                    { type: 'rep', val: 50, text: '50 репутации' },
                    { type: 'level', val: 20, text: '20 уровень' },
                    { type: 'money', val: 50000000, text: '50кк' },
                    { type: 'money', val: 40000000, text: '40кк' },
                    { type: 'winter_case', text: 'повторно зимний кейс' },
                    { type: 'x10_winter_case', text: 'Х10 зимний кейс' },
                    { type: 'money', val: 100000000, text: '100кк' },
                    { type: 'camry', text: 'камри', car: 'Toyota Camry ППС' },
                    { type: 'mercedes', text: 'Мерседес', car: 'Mercedes-Benz E-Class' }
                ];

                const prize = possiblePrizes[Math.floor(Math.random() * possiblePrizes.length)];
                let resultText = `📦 Кейс открыт, выпало "${prize.text}"`;
                
                // Обработка наград
                if (prize.type === 'bugatti' || prize.type === 'camry' || prize.type === 'mercedes') {
                    resultText += `\n\n🎉 Поздравляем вас с машиной за вашу работу мы станем лучшими 💪`;
                    let carsArr = JSON.parse(userRow.cars || '[]');
                    if (!carsArr.includes(prize.car)) {
                        carsArr.push(prize.car);
                        await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                    }
                } else if (prize.type === 'rep') {
                    await updateReputation(userId, prize.val);
                } else if (prize.type === 'level') {
                    await dbRun("UPDATE users SET level = ? WHERE user_id = ?", [prize.val, String(userId)]);
                } else if (prize.type === 'money') {
                    await updateBalance(userId, prize.val);
                } else if (prize.type === 'winter_case') {
                    await dbRun("UPDATE winter_event SET completed = 1 WHERE user_id = ?", [String(userId)]);
                    resultText += `\n\n🎁 Вам выдан повторный зимний кейс!`;
                } else if (prize.type === 'x10_winter_case') {
                    // Можно реализовать логику x10, пока просто выдаем 1 кейс
                    await dbRun("UPDATE winter_event SET completed = 1 WHERE user_id = ?", [String(userId)]);
                    resultText += `\n\n🎁 Вам выдан зимний кейс (x10 пока не реализовано)`;
                }

                await dbRun("UPDATE winter_event SET last_opened = ?, completed = 0, reps_given = 0, game_score = 0 WHERE user_id = ?", [Date.now(), String(userId)]);
                return await message.reply(resultText, replyParams());
            }

            // ОСОБЫЙ КЕЙС (ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА/РАЗРАБОТЧИКА ЧЕРЕЗ /выдать кейс особый)
            if (caseName === 'кейс особый' || caseName === 'особый') {
                const hasSpecialCase = await dbGet("SELECT * FROM promos WHERE code = 'special_case_' || ?", [String(userId)]);
                if (!hasSpecialCase) {
                    return await message.reply("❌ У вас нет Особого кейса.", replyParams());
                }

                await message.reply("📦 Открываю особый кейс...", replyParams());
                
                // 5 наград, выпадает только 1
                const specialPrizes = [
                    { type: 'bugatti', text: 'Бугатти', car: 'Bugatti Chiron' },
                    { type: 'f90_dps', text: 'Ф90 ДПС', car: 'BMW M5 F90 ДПС' },
                    { type: 'pps', text: 'ППС', car: 'Toyota Camry ППС' },
                    { type: 'dps', text: 'ДПС', car: 'Ford Focus ДПС' },
                    { type: 'ferrari', text: 'Ферари', car: 'Ferrari 488' }
                ];

                const prize = specialPrizes[Math.floor(Math.random() * specialPrizes.length)];
                let resultText = `📦 Кейс открыт, выпало "${prize.text}"\n\n🎉 Поздравляем вас с машиной за вашу работу мы станем лучшими 💪`;
                
                let carsArr = JSON.parse(userRow.cars || '[]');
                if (!carsArr.includes(prize.car)) {
                    carsArr.push(prize.car);
                    await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                }

                // Удаляем кейс после открытия
                await dbRun("DELETE FROM promos WHERE code = 'special_case_' || ?", [String(userId)]);
                
                return await message.reply(resultText, replyParams());
            }
        }

        // --- СЛИТЬ БИЗНЕС (+10КК) ---
        if (cmdWord === 'слитьбиз') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ Нет бизнеса.", replyParams());
            
            await updateBalance(userId, 10000000);
            await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
            return await message.reply("🔥 Бизнес слит государству!\n💰 +10,000,000$", replyParams());
        }

        // --- /АДМИН (ЧЕРЕЗ ОТВЕТ) ---
        if (cmdWord === 'админ') {
            if (!message.hasReplyMessage) return await message.reply("❌ Ответьте на сообщение нарушителя и напишите /админ", replyParams());
            
            const targetId = message.replyMessage.senderId;
            const reportedText = message.replyMessage.text || "Сообщение без текста";
            
            const callKb = getAdminCallKb(userId, targetId, reportedText);
            const reporterName = await getFullName(userId);
            const targetName = await getFullName(targetId);
            const adminMsg = `🚨 ВЫЗОВ АДМИНА!\n👤 Жалоба от: ${reporterName}\n🎯 Нарушитель: ${targetName}\n💬 Текст: "${reportedText}"`;
            
            // Отправляем всем админам и разработчикам
            const admins = await dbAll("SELECT user_id FROM staff WHERE role IN ('Администратор', 'Разработчик')");
            let sent = false;
            
            try {
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: adminMsg, keyboard: callKb.toString(), random_id: 0 });
                sent = true;
            } catch(e) {}

            for (const admin of admins) {
                if (admin.user_id !== String(ADMIN_ID)) {
                    try {
                        await vk.api.messages.send({ peer_id: admin.user_id, message: adminMsg, keyboard: callKb.toString(), random_id: 0 });
                        sent = true;
                    } catch(e) {}
                }
            }
            
            if (sent) {
                return await message.reply("✅ Жалоба отправлена администрации.", replyParams());
            } else {
                return await message.reply("❌ Не удалось отправить жалобу.", replyParams());
            }
        }

        // --- REPORT (ИСПРАВЛЕНО) ---
        if (cmdWord === 'report' || cmdWord === 'репорт') {
            const reportText = parts.slice(1).join(' ');
            if (!reportText) return await message.reply("❌ Формат: report [текст жалобы]");

            const existingReport = await dbGet("SELECT id FROM reports WHERE reporter_id = ? AND status != 'closed'", [String(userId)]);
            if (existingReport) return await message.reply("⏳ У вас уже есть активный репорт! Дождитесь ответа администратора, прежде чем создавать новый.");

            const result = await dbRun("INSERT INTO reports (reporter_id, text, chat_id, status) VALUES (?, ?, ?, 'pending')", [String(userId), reportText, String(peerId)]);
            const reportId = result.lastID;

            const adminKb = getAdminReportKb(reportId);
            const reporterName = await getFullName(userId);
            const adminMsg = `📩 НОВЫЙ РЕПОРТ #${reportId}\n👤 От: ${reporterName}\n💬 Текст: "${reportText}"`;

            // Отправляем всем админам и разработчикам
            const admins = await dbAll("SELECT user_id FROM staff WHERE role IN ('Администратор', 'Разработчик')");
            let sent = false;

            try {
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: adminMsg, keyboard: adminKb.toString(), random_id: 0 });
                sent = true;
            } catch(e) {}

            for (const admin of admins) {
                if (admin.user_id !== String(ADMIN_ID)) {
                    try {
                        await vk.api.messages.send({ peer_id: admin.user_id, message: adminMsg, keyboard: adminKb.toString(), random_id: 0 });
                        sent = true;
                    } catch(e) {}
                }
            }

            if (sent) {
                return await message.reply("✅ Ваш репорт отправлен администрации. Ожидайте ответа.");
            } else {
                return await message.reply("❌ Не удалось отправить репорт (администрация оффлайн).");
            }
        }

        // --- LOGS, ЧСБЛИСТ, BANLIST ---
        if (cmdWord === 'logs') {
            if (!isAdminOrDev) return await message.reply("❌ Только для владельца/разработчика.", replyParams());
            const { targetId } = await getTargetAndReason(message, 'logs');
            if (!targetId) return await message.reply("⚠️ Укажите пользователя: /logs @vk", replyParams());
            
            const userInfo = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(targetId)]);
            const chatStats = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(targetId)]);
            
            let logText = `📋 Логи ${await getFullName(targetId)}:\n`;
            logText += `Баланс: ${userInfo ? userInfo.balance : 0}\n`;
            logText += `Реп: ${userInfo ? userInfo.reputation : 0}\n`;
            logText += `Сообщений тут: ${chatStats ? chatStats.count : 0}\n`;
            logText += `Рег: ${userInfo ? userInfo.reg_date : 'Н/Д'}\n`;
            
            const fileName = `logs_${targetId}_${Date.now()}.txt`;
            const filePath = path.join(DATA_DIR, fileName);
            fs.writeFileSync(filePath, logText);
            
            try {
                const doc = await vk.upload.messageDocument({ peer_id: ADMIN_ID, source: { value: fs.createReadStream(filePath) } });
                await vk.api.messages.send({ peer_id: ADMIN_ID, message: `Логи ${await getFullName(targetId)}:`, attachment: doc.toString(), random_id: 0 });
                fs.unlinkSync(filePath);
                return await message.reply("✅ Логи отправлены в ЛС.", replyParams());
            } catch(e) {
                return await message.reply("❌ Ошибка отправки логов.", replyParams());
            }
        }

        if (cmdWord === 'чсблист') {
            if (!isAdminOrDev) return await message.reply("❌ Только для владельца/разработчика.", replyParams());
            const bans = await dbAll("SELECT user_id, reason, until FROM blacklist");
            if (bans.length === 0) return await message.reply("✅ Глобальный ЧС пуст.", replyParams());
            let txt = `😈 Глобальный ЧС бота:\n`;
            for (const b of bans) {
                const t = b.until === 0 ? "Навсегда" : `До ${new Date(b.until).toLocaleDateString()}`;
                txt += `▪️ ${await getFullName(b.user_id)} - ${b.reason} (${t})\n`;
            }
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'banlist') {
            if (!isAdminOrDev) return await message.reply("❌ Только для владельца/разработчика.", replyParams());
            if (!message.isChat) return await message.reply("❌ Только в беседе.", replyParams());
            const bans = await dbAll("SELECT user_id, reason FROM chat_bans WHERE peer_id = ?", [String(peerId)]);
            if (bans.length === 0) return await message.reply("✅ Банов в этой беседе нет.", replyParams());
            let txt = `🚫 Список банов в этой беседе:\n`;
            for (const b of bans) txt += `▪️ ${await getFullName(b.user_id)} - ${b.reason}\n`;
            return await message.reply(txt, replyParams());
        }

        // --- ОРГАНИЗАЦИИ И СТРАНЫ (ИСПРАВЛЕНО) ---
        if (cmdWord === 'организации') {
            let txt = "🏛️ Доступные организации:\n\n";
            for (let i = 0; i < ORGS.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [ORGS[i]]);
                txt += `${i+1}. ${ORGS[i]} (${count.c}/10)\n`;
            }
            return await message.reply(txt + "\n👉 Вступить: вступить [Название]", replyParams());
        }

        if (cmdWord === 'вступить') {
            const orgName = parts.slice(1).join(' ');
            const foundOrg = ORGS.find(o => o.toLowerCase() === orgName.toLowerCase());
            if (!foundOrg) return await message.reply("❌ Такой организации нет. Посмотри: /организации", replyParams());
            if ((await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [foundOrg])).c >= 10) return await message.reply("❌ В этой организации нет свободных мест!", replyParams());
            await dbRun("UPDATE users SET org = ? WHERE user_id = ?", [foundOrg, String(userId)]);
            return await message.reply(`✅ Вы успешно вступили в организацию ${foundOrg}!`, replyParams());
        }

        if (cmdWord === 'страны') {
            let txt = "🌍 Доступные страны:\n\n";
            for (let i = 0; i < COUNTRIES.length; i++) {
                const count = await dbGet("SELECT COUNT(*) as c FROM users WHERE country = ?", [COUNTRIES[i]]);
                txt += `${i+1}. ${COUNTRIES[i]} (${count.c})\n`;
            }
            return await message.reply(txt + "\n👉 Вступить: страна [Название]", replyParams());
        }

        if (cmdWord === 'страна') {
            const countryName = parts.slice(1).join(' ');
            const found = COUNTRIES.find(c => c.toLowerCase() === countryName.toLowerCase());
            if (!found) return await message.reply("❌ Такой страны нет. Посмотри: /страны", replyParams());
            await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [found, String(userId)]);
            return await message.reply(`✅ Вы получили гражданство: ${found}!`, replyParams());
        }

        // --- ПРЕМИУМ (ИСПРАВЛЕНО) ---
        if (cmdWord === 'premium') {
            if (isPremium) return await message.reply(`💎 У вас уже есть Premium до ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}`, replyParams());
            if (balance < 50000) return await message.reply("❌ У вас недостаточно монеток. Premium стоит 50,000$", replyParams());
            await updateBalance(userId, -50000);
            await dbRun("UPDATE users SET premium_until = ? WHERE user_id = ?", [Date.now() + 30 * 86400000, String(userId)]);
            return await message.reply(`✅ Вы купили Premium на 30 дней! (х2 опыт, х2 монеты, лимиты до 3к)`, replyParams());
        }

        // --- STAFF (СПИСОК АДМИНИСТРАЦИИ) ---
        if (cmdWord === 'staff') {
            const staffList = await dbAll("SELECT user_id, role FROM staff ORDER BY CASE role WHEN 'Разработчик' THEN 1 WHEN 'Тестировщик' THEN 2 WHEN 'Администратор' THEN 3 WHEN 'Модератор' THEN 4 END");
            if (staffList.length === 0) return await message.reply("✅ В данный момент администрация отсутствует.", replyParams());
            
            let txt = "👥 Список администрации:\n\n";
            for (const s of staffList) {
                txt += `▪️ ${await getFullName(s.user_id)} — ${s.role}\n`;
            }
            return await message.reply(txt, replyParams());
        }

        // --- SETADMIN (ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА) ---
        if (cmdWord === 'setadmin') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Эта команда доступна только владельцу.", replyParams());
            
            if (parts.length < 3) {
                return await message.reply("❌ Укажите пользователя и роль.\nПример: /setadmin @nik Модератор\nДоступные роли: Модератор, Администратор, Тестировщик, Разработчик", replyParams());
            }
            
            const roleName = parts.slice(2).join(' ');
            const validRoles = ['Модератор', 'Администратор', 'Тестировщик', 'Разработчик'];
            if (!validRoles.includes(roleName)) {
                return await message.reply(`❌ Неверная роль. Доступные: ${validRoles.join(', ')}`, replyParams());
            }

            let targetId = null;
            const targetStr = parts[1];
            const idMatch = targetStr.match(/\[id(\d+)\|/i);
            const mentionMatch = targetStr.match(/@([a-zA-Z0-9._]+)/i);
            
            if (idMatch) targetId = parseInt(idMatch[1]);
            else if (mentionMatch) {
                try {
                    const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                    if (res.type === 'user') targetId = res.object_id;
                } catch (e) {}
            }

            if (!targetId) return await message.reply("❌ Пользователь не найден.", replyParams());

            await dbRun("REPLACE INTO staff (user_id, role, assigned_by, assigned_at) VALUES (?, ?, ?, ?)", [String(targetId), roleName, String(userId), Date.now()]);
            return await message.reply(`✅ ${await getFullName(targetId)} назначен на должность: ${roleName}`, replyParams());
        }

        // --- ВЫДАТЬ ОСОБЫЙ КЕЙС (ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА) ---
        if (cmdWord === 'выдать' && parts[1] === 'кейс' && parts[2] === 'особый') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Эта команда доступна только владельцу.", replyParams());
            
            let targetId = null;
            const targetStr = parts[3];
            const idMatch = targetStr.match(/\[id(\d+)\|/i);
            const mentionMatch = targetStr.match(/@([a-zA-Z0-9._]+)/i);
            
            if (idMatch) targetId = parseInt(idMatch[1]);
            else if (mentionMatch) {
                try {
                    const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] });
                    if (res.type === 'user') targetId = res.object_id;
                } catch (e) {}
            }

            if (!targetId) return await message.reply("❌ Укажите пользователя.\nПример: /выдать кейс особый @nik", replyParams());

            await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", ['special_case_' + targetId, 0, 1]);
            return await message.reply(`✅ ${await getFullName(targetId)} получил Особый кейс!`, replyParams());
        }

        // --- ИГРЫ (БЕЗ ЛИМИТА СТАВОК, С ПРОВЕРКОЙ БАЛАНСА) ---
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            if (Date.now() - lastPlayed < 10000) return await message.reply(`⏳ Подождите ${Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000)} сек.`);
            gameCooldowns.set(userId, Date.now());
        }

        // ШАБЛОНЫ ДЛЯ ИГР
        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры рулетка напишите команду затем цвет красное/черное чет/нечет ставка\nНапример: /рулетка красное 3000", replyParams());
            }

            let choice = parts[1];
            let betStr = parts[2];
            if (!isNaN(parseInt(parts[1]))) { choice = parts[2]; betStr = parts[1]; } 

            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());

            const validRed = ["красное", "красный", "кр"];
            const validBlack = ["черное", "черный", "чр"];
            const validEven = ["чет", "четное"];
            const validOdd = ["нечет", "нечетное"];

            const res = Math.floor(Math.random() * 36) + 1; 
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

        if (cmdWord === 'монетка') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры монетка напишите команду затем сторону орел/решка и ставку\nНапример: /монетка орел 1000", replyParams());
            }
            let side = ["орел", "решка"].find(s => parts.includes(s));
            if (!side) return await message.reply("❌ Выберите 'орел' или 'решка'", replyParams());
            let betStr = parts.find(p => p !== side && p !== 'монетка');
            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());

            await updateBalance(userId, -bet);
            const res = Math.random() < 0.5 ? 'орел' : 'решка';
            if (res === side) await updateBalance(userId, bet * 2);
            return await message.reply(`🪙 Выпал: ${res}\n` + (res === side ? `✅ Выигрыш: ${formatMoney(bet*2)}$!` : `❌ Проигрыш: ${formatMoney(bet)}$`) + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }

        if (cmdWord === 'краш') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры краш напишите команду затем коэффициент автостопа и ставку\nНапример: /краш 2.0 1000", replyParams());
            }
            const autoStop = parseFloat(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (isNaN(autoStop) || autoStop < 1.01) return await message.reply("❌ Коэффициент должен быть больше 1.01", replyParams());
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            
            await updateBalance(userId, -bet);
            const rand = Math.random();
            let crashPoint = rand > 0.03 ? Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100 : 1.00;
            
            if (crashPoint >= autoStop) {
                const win = Math.floor(bet * autoStop);
                await updateBalance(userId, win);
                return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams());
            } else {
                return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
            }
        }

        if (cmdWord === 'стакан') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры стакан напишите команду затем номер стакана (1-3) и ставку\nНапример: /стакан 2 1000", replyParams());
            }
            let cup = parseInt(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (cup < 1 || cup > 3) return await message.reply("❌ Выберите стакан от 1 до 3", replyParams());
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 3) + 1;
            if (res === cup) { await updateBalance(userId, bet * 3); return await message.reply(`🥤 Шарик под стаканом ${res}\n\n✅ Выигрыш: ${formatMoney(bet*3)}$!`, replyParams()); }
            else return await message.reply(`🥤 Шарик под стаканом ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'кубик') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры кубик напишите команду затем число (1-6) и ставку\nНапример: /кубик 4 1000", replyParams());
            }
            let guess = parseInt(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (guess < 1 || guess > 6) return await message.reply("❌ Выберите число от 1 до 6", replyParams());
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 6) + 1;
            if (res === guess) { await updateBalance(userId, bet * 6); return await message.reply(`🎲 Выпало: ${res}\n\n✅ Выигрыш: ${formatMoney(bet*6)}$!`, replyParams()); }
            else return await message.reply(`🎲 Выпало: ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'автомат') {
            if (parts.length < 2) {
                return await message.reply("Для создания игры автомат напишите команду и ставку\nНапример: /автомат 1000", replyParams());
            }
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            await updateBalance(userId, -bet);
            
            const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
            const r1 = emojis[Math.floor(Math.random() * 5)], r2 = emojis[Math.floor(Math.random() * 5)], r3 = emojis[Math.floor(Math.random() * 5)];
            let win = (r1 === r2 && r2 === r3) ? bet * 10 : (r1 === r2 || r2 === r3 || r1 === r3) ? bet * 2 : 0;
            if (win) { await updateBalance(userId, win); return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams()); }
            return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'блэкджек') {
            if (parts.length < 2) {
                return await message.reply("Для создания игры блэкджек напишите команду и ставку\nНапример: /блэкджек 1000", replyParams());
            }
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            await updateBalance(userId, -bet);
            
            const p = Math.floor(Math.random() * 10) + 12, d = Math.floor(Math.random() * 10) + 12;
            if (p > d && p <= 21) { await updateBalance(userId, bet * 2); return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n\n✅ Выигрыш: ${formatMoney(bet*2)}$!`, replyParams()); }
            return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'дрим') {
            if (parts.length < 3) {
                return await message.reply("Для создания игры дрим напишите команду затем число (1-5) и ставку\nНапример: /дрим 3 1000", replyParams());
            }
            const guess = parseInt(parts[1]);
            let actualBet = parseAmount(parts[2]);
            if (actualBet === 'ALL') actualBet = balance;
            if (!guess || guess < 1 || guess > 5) return await message.reply("❌ Числа: 1, 2, 3, 4, 5", replyParams());
            if (actualBet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (actualBet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());
            
            await updateBalance(userId, -actualBet);
            const res = Math.floor(Math.random() * 10) + 1;
            if (res === guess) { const win = actualBet * guess; await updateBalance(userId, win); return await message.reply(`💎 Число: ${res}\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams()); }
            return await message.reply(`💎 Число: ${res}\n\n❌ Проигрыш: ${formatMoney(actualBet)}$`, replyParams());
        }

        if (cmdWord === 'мины') {
            if (parts.length < 2) {
                return await message.reply("Для создания игры мины напишите команду и ставку\nНапример: /мины 1000", replyParams());
            }
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Минимальная ставка 100$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток", replyParams());

            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
            return await message.reply(`💣 Мины\nСтавка: ${bet}$\n\nВыберите кол-во мин:`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'фортуна') {
            const currentTime = Math.floor(Date.now() / 1000);
            const lastUse = (await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]))?.last_used || 0;
            if (currentTime - lastUse < 600) return await message.reply(`⏳ Фортуна через ${Math.floor((600 - (currentTime - lastUse)) / 60)} мин.`, replyParams());
            if (balance < 100) return await message.reply("❌ У вас недостаточно монеток. Фортуна стоит 100$", replyParams());

            await updateBalance(userId, -100);
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);
            const prize = [0, 50, 100, 200, 500, 1000, 5000][Math.floor(Math.random() * 7)];
            await updateBalance(userId, prize);
            return await message.reply(`🎰 Выпало: ${formatMoney(prize)}$!`, replyParams());
        }

        // --- БОНУС (НОВЫЙ ШАБЛОН, СЕРИЯ, ОПЫТ) ---
        if (cmdWord === 'бонус') {
            const todayStr = new Date().toISOString().split('T')[0];
            const userName = await getFullName(userId);
            
            if (userRow.last_bonus_date === todayStr) {
                const nextBonus = new Date(new Date(todayStr).getTime() + 86400000);
                const hoursLeft = Math.floor((nextBonus - Date.now()) / 3600000);
                const minsLeft = Math.floor(((nextBonus - Date.now()) % 3600000) / 60000);
                return await message.reply(`🕒 ${userName}, ежедневный бонус еще не готов, попробуйте еще раз через — ${hoursLeft} часов ${minsLeft} минут`);
            }

            let streak = userRow.bonus_streak || 0;
            if (userRow.last_bonus_date) {
                const diffDays = Math.ceil(Math.abs(new Date(todayStr) - new Date(userRow.last_bonus_date)) / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) streak++; else streak = 1; // Сброс серии если пропустил день
            } else streak = 1;

            // Опыт растет на 50 каждый день, макс 2500
            let xpReward = Math.min(50 + (streak - 1) * 50, 2500);
            
            await dbRun("UPDATE users SET xp = xp + ?, last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [xpReward, todayStr, streak, String(userId)]);
            
            return await message.reply(`🎁 ${userName} получил ежедневный бонус опыта — ${xpReward}.\n🔥 Серия: ${streak} дней подряд! Следующий бонус - ${Math.min(xpReward + 50, 2500)} из 2500 опыта`);
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (!message.hasReplyMessage) return await message.reply("❌ Формат: transfer [сумма] (ответом)", replyParams());
            const amount = parseAmount(parts[1]);
            if (!amount || amount === 'ALL' || amount < 50 || amount > balance) return await message.reply("❌ Сумма от 50$", replyParams());
            await updateBalance(userId, -amount);
            await updateBalance(message.replyMessage.senderId, amount);
            return await message.reply(`💸 Переведено ${formatMoney(amount)}$ игроку ${await getFullName(message.replyMessage.senderId)}.`, replyParams());
        }

        if (cmdWord === 'duel') {
            const bet = parseAmount(parts[1]);
            if (!bet || bet === 'ALL' || bet < 50 || bet > balance) return await message.reply("❌ Ставка от 50$", replyParams());
            const duelId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
            return await message.reply(`⚔️ Дуэль!\n👤 Создатель: ${await getFullName(userId)}\n💰 Ставка: ${bet}$\n\n⚡ Нажми кнопку!`, replyParams(getDuelKb(duelId)));
        }

    } catch (error) {
        console.error("ОШИБКА ПРИ ОБРАБОТКЕ:", error);
        try { 
            await message.reply(`⚠️ Произошла ошибка при выполнении команды: ${error.message}`, { disable_mentions: 1 }); 
        } catch (e) {}
    }
});
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
                    
                    return await message.reply("💥 ПОЛНЫЙ СБРОС ВСЕХ ИГРОКОВ И ТОПОВ ВЫПОЛНЕН!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'cl');
                    
                    if (!targetId) {
                        return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой) или напишите 'all'.");
                    }
                    
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, sim_card = NULL WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                    await dbRun("DELETE FROM chat_messages WHERE user_id = ?", [String(targetId)]);
                    
                    return await message.reply(`💥 Полный сброс игрока ${await getFullName(targetId)} выполнен!`);
                }
            }

            // --- КОМАНДА /снятьпред ---
            if (cmdWord === 'снятьпред') {
                const { targetId } = await getTargetAndReason(message, 'снятьпред');
                
                if (!targetId) {
                    return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).");
                }
                
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(targetId)]);
                
                return await message.reply(`✅ С игрока ${await getFullName(targetId)} сняты все предупреждения.`);
            }

            // --- КОМАНДА /объявление ---
            if (cmdWord === 'объявление') {
                const txt = text.replace(/объявление\s*/i, '');
                
                if (!txt) {
                    return await message.reply("❌ Введите текст объявления.");
                }
                
                const allUsers = await dbAll("SELECT user_id FROM users");
                const allChats = await dbAll("SELECT DISTINCT peer_id FROM chat_messages WHERE peer_id > 2000000000");
                
                let sentCount = 0;
                
                for (const u of allUsers) {
                    try { 
                        await vk.api.messages.send({ 
                            peer_id: u.user_id, 
                            message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, 
                            random_id: Math.floor(Math.random() * 1000000000) 
                        }); 
                        sentCount++; 
                    } catch(e) {}
                }
                
                for (const c of allChats) {
                    try { 
                        await vk.api.messages.send({ 
                            peer_id: c.peer_id, 
                            message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, 
                            random_id: Math.floor(Math.random() * 1000000000) 
                        }); 
                        sentCount++; 
                    } catch(e) {}
                }
                
                return await message.reply(`✅ Объявление разослано! Доставлено: ${sentCount} получателям.`);
            }

            // --- КОМАНДА /pr (ПРОВЕРКА БАЛАНСА) ---
            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) {
                    return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).");
                }
                const bal = await getBalance(targetId);
                const name = await getFullName(targetId);
                return await message.reply(`💳 У игрока ${name} на балансе: ${formatShortMoney(bal)}$`);
            }

            // --- КОМАНДА /заморозить ---
            if (cmdWord === 'заморозить') {
                const { targetId } = await getTargetAndReason(message, 'заморозить');
                if (!targetId) {
                    return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете заморозить себя.");
                }
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]);
                try { 
                    await vk.api.messages.send({ peer_id: targetId, message: "💀 Вы заморожены в боте. Ожидайте, когда вам выдадут наказание!", random_id: Math.floor(Math.random() * 1000000000) }); 
                } catch(e) {}
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} заморожен.`);
            }

            // --- КОМАНДА /разморозить ---
            if (cmdWord === 'разморозить' || cleanText.startsWith('снять заморозку') || cleanText.startsWith('снять заморозка') || cmdWord === 'unfreeze') {
                let cmdName = 'разморозить';
                if (cleanText.startsWith('снять заморозку')) cmdName = 'снять заморозку';
                if (cleanText.startsWith('снять заморозка')) cmdName = 'снять заморозка';
                if (cmdWord === 'unfreeze') cmdName = 'unfreeze';

                const { targetId } = await getTargetAndReason(message, cmdName);
                if (!targetId) {
                    return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой).");
                }
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} разморожен.`);
            }

            // --- КОМАНДА /unmute ---
            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы снять мут, используйте /unmute @VK (или ответом на сообщение)");
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unmute' ? 'unmute' : 'размут');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }

                const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (!activeMute || Date.now() >= activeMute.mute_until) {
                    if (activeMute) {
                        await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                    }
                    return await message.reply("❌ У этого игрока нет активного мута в данной беседе.");
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
                return await message.reply(`✅ С игрока ${targetName} успешно снят мут!`);
            }

            // --- КОМАНДА /unban ---
            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы разбанить пользователя, используйте /unban @VK (или ответом на сообщение)");
                }

                const { targetId } = await getTargetAndReason(message, cmdWord === 'unban' ? 'unban' : 'разбан');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
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
                    return await message.reply("❌ Этот игрок не находится в бан-листе (ни в ЧС, ни в бане беседы).");
                }

                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                return await message.reply(`✅ ${senderName} разбанил(-а) пользователя ${targetName}.`);
            }

            // --- КОМАНДА /kl ---
            if (cmdWord === 'kl') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы полностью сбросить игрока, используйте /kl @VK (или ответом на сообщение)");
                }

                const { targetId } = await getTargetAndReason(message, 'kl');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете сбросить себя.");
                }

                await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]);
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, car = NULL, last_bonus_date = NULL, bonus_streak = 0 WHERE user_id = ?", [String(targetId)]);
                
                const targetName = await getFullName(targetId);
                return await message.reply(`💥 Игрок ${targetName} был полностью сброшен! Дома, гаражи, машины, бонусы и уровни обнулены. Недвижимость освобождена для других.`);
            }

            // --- КОМАНДА /mute ---
            if (cmdWord === 'mute') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Формат: /mute @VK [время в мин] [причина]");
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
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете замутить себя.");
                }

                let muteMinutes = 10;
                let reason = "Причина не указана";

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
                    return await message.reply("❌ У этого игрока уже имеется активная блокировка в данной беседе!");
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
                return await message.reply(`🚫 ${targetName} получил мут на ${muteMinutes} минут.\n📌 Причина: ${reason}`);
            }

            // --- КОМАНДА /бан ---
            if (cmdWord === 'бан' || cmdWord === 'ban') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы забанить пользователя в беседе, используйте /ban @VK Причина");
                }
                if (!message.isChat) {
                    return await message.reply("❌ Эту команду можно использовать только в беседе.");
                }

                const { targetId, reason } = await getTargetAndReason(message, cmdWord === 'бан' ? 'бан' : 'ban');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете забанить себя.");
                }
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) {
                    return await message.reply("❌ Этот игрок уже забанен в данной беседе!");
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
                
                return await message.reply(`${senderName} забанил(-а) в этой беседе пользователя ${targetName} по причине: "${reason}"`);
            }

            // --- КОМАНДА /logs ---
            if (cmdWord === 'logs') {
                const { targetId } = await getTargetAndReason(message, 'logs');
                if (!targetId) {
                    return await message.reply("⚠️ Укажите пользователя: /logs @vk");
                }
                
                const userInfo = await dbGet("SELECT * FROM users WHERE user_id = ?", [String(targetId)]);
                const chatStats = await dbGet("SELECT count FROM chat_messages WHERE peer_id = ? AND user_id = ?", [String(peerId), String(targetId)]);
                
                let logText = `📋 Логи ${await getFullName(targetId)}:\n`;
                logText += `Баланс: ${userInfo ? userInfo.balance : 0}\n`;
                logText += `Репутация: ${userInfo ? userInfo.reputation : 0}\n`;
                logText += `Сообщений в беседе: ${chatStats ? chatStats.count : 0}\n`;
                logText += `Дата регистрации в боте: ${userInfo ? userInfo.reg_date : 'Неизвестно'}\n`;
                
                const fileName = `logs_${targetId}_${Date.now()}.txt`;
                const filePath = path.join(DATA_DIR, fileName);
                fs.writeFileSync(filePath, logText);
                
                try {
                    const doc = await vk.upload.messageDocument({ peer_id: ADMIN_ID, source: { value: fs.createReadStream(filePath) } });
                    await vk.api.messages.send({ peer_id: ADMIN_ID, message: `Логи ${await getFullName(targetId)}:`, attachment: doc.toString(), random_id: Math.floor(Math.random() * 1000000000) });
                    fs.unlinkSync(filePath);
                    return await message.reply("✅ Логи отправлены вам в ЛС.");
                } catch(e) {
                    return await message.reply("❌ Ошибка при отправке логов.");
                }
            }

            // --- КОМАНДА /banlist ---
            if (cmdWord === 'banlist') {
                if (!message.isChat) return await message.reply("❌ Только в беседе.");
                const bans = await dbAll("SELECT user_id, reason FROM chat_bans WHERE peer_id = ?", [String(peerId)]);
                if (bans.length === 0) return await message.reply("✅ В этой беседе нет забаненных игроков.");
                
                let txt = `🚫 Список банов в этой беседе:\n`;
                for (const b of bans) {
                    txt += `▪️ ${await getFullName(b.user_id)} - ${b.reason}\n`;
                }
                return await message.reply(txt);
            }

            // --- КОМАНДА /чсблист ---
            if (cmdWord === 'чсблист') {
                const bans = await dbAll("SELECT user_id, reason, until FROM blacklist");
                if (bans.length === 0) return await message.reply("✅ Глобальный ЧС пуст.");
                
                let txt = `😈 Глобальный ЧС бота:\n`;
                for (const b of bans) {
                    const timeStr = b.until === 0 ? "Навсегда" : `До ${new Date(b.until).toLocaleDateString()}`;
                    txt += `▪️ ${await getFullName(b.user_id)} - ${b.reason} (${timeStr})\n`;
                }
                return await message.reply(txt);
            }

            // --- КОМАНДА /убрать ---
            if (cmdWord === 'убрать') {
                const targetQuery = cleanText.replace('убрать', '').trim().toLowerCase();
                
                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0");
                    return await message.reply(`💥 Все статы ВСЕХ игроков (монеты, дуэли, бонусы и т.д.) успешно обнулены! (Машины и бизнесы остались)`);
                } else {
                    const { targetId } = await getTargetAndReason(message, 'убрать');
                    if (!targetId) {
                        return await message.reply("⚠️ Ответьте на сообщение игрока, укажите его @упоминание или напишите 'all', чтобы обнулить статы.");
                    }

                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 Все статы игрока ${targetName} (монеты, дуэли, бонусы и т.д.) успешно обнулены! (Машины и бизнесы остались)`);
                }
            }

            // --- КОМАНДА /kick ---
            if (cmdWord === 'kick') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы исключить пользователя из чата, используйте /kick @VK Причина (Пример: /kick @Mokhma.volk Тест)");
                }

                const { targetId, reason } = await getTargetAndReason(message, 'kick');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете исключить самого себя.");
                }
                if (!message.isChat) {
                    return await message.reply("❌ Эту команду можно использовать только в беседе.");
                }
                
                const existingBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                if (existingBan) {
                    return await message.reply("❌ Этот игрок уже забанен в данной беседе.");
                }

                const chatId = message.peerId - 2000000000;
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);

                try {
                    await vk.api.messages.removeChatUser({ chat_id: chatId, user_id: targetId, group_id: GROUP_ID });
                    return await message.reply(`${senderName} исключил(-а) из беседы пользователя ${targetName} по причине: "${reason}"`);
                } catch (e) {
                    return await message.reply(`⚠️ Указанный пользователь не является участником данной беседы, либо же имеет статус выше Вашего.`);
                }
            }

            // --- КОМАНДА /чсб ---
            if (cmdWord === 'чсб') {
                if (parts.length === 1 && !message.hasReplyMessage) {
                    return await message.reply("🔔 Чтобы занести в глобальный ЧС, используйте /чсб @VK [дней] Причина (Пример: /чсб @Mokhma.volk 3 Спам)");
                }

                const { targetId, reason } = await getTargetAndReason(message, 'чсб');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }
                if (targetId === ADMIN_ID) {
                    return await message.reply("❌ Вы не можете занести себя в ЧС.");
                }

                const existingBan = await dbGet("SELECT reason FROM blacklist WHERE user_id = ?", [String(targetId)]);
                if (existingBan) {
                    return await message.reply("❌ Этот игрок уже находится в глобальном ЧС!");
                }
                
                let days = 0;
                let finalReason = reason;
                const partsReason = reason.split(' ');
                if (partsReason.length > 1 && !isNaN(parseInt(partsReason[0]))) {
                    days = parseInt(partsReason[0]);
                    finalReason = partsReason.slice(1).join(' ');
                }
                if (!finalReason) {
                    finalReason = "Причина не указана";
                }

                let until = days > 0 ? Date.now() + days * 86400000 : 0;
                
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), finalReason, until]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} занес(-ла) в глобальный ЧС бота пользователя ${targetName} ${days > 0 ? `на ${days} дн.` : 'навсегда'} по причине: "${finalReason}"`);
            }

            // --- КОМАНДА /разчсб ---
            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) {
                    return await message.reply("⚠️ Пользователь не найден. Проверьте ссылку или упоминание.");
                }

                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                const targetName = await getFullName(targetId);
                const senderName = await getFullName(message.senderId);
                
                return await message.reply(`${senderName} разбанил(-а) пользователя ${targetName} в глобальном ЧС бота.`);
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
                    return await message.reply("❌ Укажите корректную сумму для выдачи.");
                }

                const targetQuery = remainingArgs.join(' ').trim().toLowerCase();

                if (targetQuery === 'all' || targetQuery === 'все' || targetQuery === 'всем') {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Владелец выдал всем игрокам по ${formatMoney(amount)}$!`);
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
                        return await message.reply("⚠️ Укажите пользователя (ответом, @упоминанием или ссылкой) или напишите 'all'.");
                    }
                    
                    await updateBalance(targetId, amount);
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💰 Владелец выдал ${formatMoney(amount)}$ игроку ${targetName}!`);
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
                    return await message.reply("💥 Балансы ВСЕХ игроков и их бизнесов успешно обнулены!");
                } else {
                    const { targetId } = await getTargetAndReason(message, 'обнулить');
                    if (!targetId) {
                        return await message.reply("⚠️ Укажите 'all', ссылку на пользователя или ответьте на его сообщение.");
                    }
                    
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                    
                    const targetName = await getFullName(targetId);
                    return await message.reply(`💥 Баланс игрока ${targetName} и его бизнеса успешно обнулен!`);
                }
            }

            // --- КОМАНДА /cc ---
            if (cmdWord === 'cc') {
                await dbRun("DELETE FROM promos");
                return await message.reply("✅ Все активные промокоды были успешно удалены.");
            }

            // --- КОМАНДА /создать ---
            if (cmdWord === 'создать') {
                if (parts.length === 4) {
                    const amt = parseAmount(parts[2]);
                    const lim = parseAmount(parts[3]);
                    if (amt > 0 && lim > 0) {
                        await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], amt, lim]);
                        return await message.reply(`✅ Промокод \`${parts[1]}\` создан!`);
                    }
                }
                return await message.reply("❌ Формат: /создать [код] [сумма] [лимит]");
            }
        }

        // ===== ПРОМОКОДЫ (ДЛЯ ВСЕХ) =====
        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (rows.length === 0) {
                return await message.reply("❌ Активных промокодов нет.");
            }
            
            let promoList = "🎁 Активные промокоды:\n\n";
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
                        const subKb = Keyboard.builder().inline().urlButton({ label: '📢 Подписаться', url: `https://vk.com/public${GROUP_ID}` });
                        return await message.reply("⚠️ Промокоды доступны только подписчикам нашего сообщества!\n\nПодпишитесь на группу и попробуйте снова.", replyParams(subKb.toString()));
                    }
                } catch (e) {}

                const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
                
                if (!row) {
                    return await message.reply("❌ Промокод не существует или исчерпан.");
                }
                
                const usedBy = row.used_by ? row.used_by.split(",") : [];
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply("❌ Промокод больше не действителен.");
                }
                
                if (usedBy.includes(String(userId))) {
                    return await message.reply("❌ Ты уже активировал этот промокод!");
                }
                
                usedBy.push(String(userId));
                await updateBalance(userId, row.amount);
                
                if (usedBy.length >= row.limit_count) {
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]);
                    return await message.reply(`✅ Активирован! +${row.amount}$\n⚠️ Промокод удален (лимит исчерпан).`);
                } else {
                    await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [usedBy.join(","), parts[1]]);
                    return await message.reply(`✅ Активирован! +${row.amount}$\nОсталось: ${row.limit_count - usedBy.length}`);
                }
            } else {
                return await message.reply("❌ Формат: /promo [код]");
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
            if (payload.action === 'work') return await vk.api.messages.send({ peer_id: peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), random_id: 0 });
            if (payload.action === 'roulette') return await vk.api.messages.send({ peer_id: peerId, message: "🎰 рулетка [цвет] [ставка]", random_id: 0 });
            if (payload.action === 'profile') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите профиль", random_id: 0 });
            if (payload.action === 'top') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите топ", random_id: 0 });
        }

        // ================= РЕПОРТЫ =================
        if (payload.cmd === 'report_reply') {
            const staffData = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
            const isAdminOrDev = userId === ADMIN_ID || (staffData && (staffData.role === 'Разработчик' || staffData.role === 'Администратор'));
            
            if (!isAdminOrDev) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец/админ.' });
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Репорт закрыт.' });
            
            await safeAnswer();
            adminStates.set(userId, `reply_${payload.report_id}`);
            return await vk.api.messages.send({ peer_id: peerId, message: `✍️ Напишите ответ для ${await getFullName(report.reporter_id)}:`, random_id: 0 });
        }

        if (payload.cmd === 'report_spam') {
            const staffData = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
            const isAdminOrDev = userId === ADMIN_ID || (staffData && (staffData.role === 'Разработчик' || staffData.role === 'Администратор'));
            
            if (!isAdminOrDev) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец/админ.' });
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Репорт закрыт.' });

            const reporterId = report.reporter_id;
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
            let warns = w ? w.count + 1 : 1;
            
            const spamMsg = `❌ ВАШ РЕПОРТ ОТКЛОНЕН!\nПричина: СПАМ/ФЛУД.\nСчет: ${warns}/3.\n⚠️ При 3 предупреждениях — ЧС бота!`;

            if (warns >= 3) {
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Спам по репорту (3/3)", Date.now() + 86400000]); 
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                try {
                    const banKb = Keyboard.builder().inline().urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` });
                    await vk.api.messages.send({ peer_id: reporterId, message: spamMsg + `\n\n😈 Вы в ЧС на 1 день.`, keyboard: banKb.toString(), random_id: 0 });
                } catch(e){}
            } else {
                await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                try { await vk.api.messages.send({ peer_id: reporterId, message: spamMsg, random_id: 0 }); } catch(e){}
            }
            
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Репорт отклонен (Спам)' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Репорт отклонен как Спам.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // --- ОЦЕНКА РЕПОРТА ---
        if (payload.cmd === 'report_rate_start') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Ошибка.' });
            if (String(userId) !== report.reporter_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не ваш репорт.' });
            if (report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Уже оценено.' });

            await safeAnswer();
            adminStates.set(userId, `rating_${report.id}`);
            return await vk.api.messages.send({ peer_id: peerId, message: `⭐ Оценка от 1 до 10:\n(1-4 = Плохо, 5-10 = Хорошо)`, random_id: 0 });
        }

        if (payload.cmd === 'report_bad_reason') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Уже оценено.' });
            await dbRun("UPDATE reports SET status = 'closed', rate_reason = ? WHERE id = ?", [payload.reason, payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Жалоба отправлена.' });
            try { await vk.api.messages.send({ peer_id: ADMIN_ID, message: `⚠️ Плохая оценка репорта #${report.id}!\nИгрок: ${await getFullName(report.reporter_id)}\nПричина: ${payload.reason}`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `🙏 Спасибо за отзыв!\nЗафиксировано: ${payload.reason}.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'report_good_reason') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report || report.rating > 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Уже оценено.' });
            await dbRun("UPDATE reports SET status = 'closed', rate_reason = ? WHERE id = ?", [payload.reason, payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Спасибо за хорошую оценку!' });
            try { await vk.api.messages.send({ peer_id: ADMIN_ID, message: `🌟 Хорошая оценка репорта #${report.id}!\nИгрок: ${await getFullName(report.reporter_id)}\nПлюс: ${payload.reason}`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Спасибо!\nМы рады, что помогли. Репорт закрыт.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'report_close') {
            const report = await dbGet("SELECT * FROM reports WHERE id = ?", [payload.report_id]);
            if (!report) return await safeAnswer({ type: 'show_snackbar', text: '❌ Ошибка.' });
            await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [payload.report_id]);
            await safeAnswer({ type: 'show_snackbar', text: 'Репорт закрыт.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Репорт закрыт. Спасибо!`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= ВЫЗОВ АДМИНА (/admin) =================
        if (payload.cmd === 'admin_call_accept') {
            const staffData = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
            const isAdminOrDev = userId === ADMIN_ID || (staffData && (staffData.role === 'Разработчик' || staffData.role === 'Администратор'));
            
            if (!isAdminOrDev) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец/админ.' });
            
            const reporterId = payload.reporter_id;
            const targetId = payload.target_id;
            const text = payload.text || "Нарушение правил";
            
            try {
                await vk.api.messages.send({ peer_id: Number(reporterId), message: `✅ Ваша жалоба на ${await getFullName(targetId)} принята администрацией.`, random_id: 0 });
                await vk.api.messages.send({ peer_id: Number(targetId), message: `🚨 НА ВАС ПОДАЛИ ЖАЛОБУ!\n\nАдминистратор принял жалобу.\nПожалуйста, соблюдайте правила беседы.`, random_id: 0 });
            } catch(e) {}
            
            await safeAnswer({ type: 'show_snackbar', text: '✅ Жалоба принята.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Жалоба принята. Уведомления отправлены.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'admin_call_spam') {
            const staffData = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
            const isAdminOrDev = userId === ADMIN_ID || (staffData && (staffData.role === 'Разработчик' || staffData.role === 'Администратор'));
            
            if (!isAdminOrDev) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец/админ.' });
            const reporterId = payload.reporter_id;
            
            const w = await dbGet("SELECT count FROM warnings WHERE user_id = ?", [String(reporterId)]);
            let warns = w ? w.count + 1 : 1;
            
            const spamMsg = `❌ ВАШ ВЫЗОВ АДМИНА ОТКЛОНЕН!\nПричина: СПАМ/ФЛУД.\nСчет: ${warns}/3.\n⚠️ При 3 предупреждениях — ЧС бота!`;

            if (warns >= 3) {
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(reporterId), "Спам вызовов админа (3/3)", Date.now() + 86400000]); 
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(reporterId)]);
                try {
                    const banKb = Keyboard.builder().inline().urlButton({ label: 'Обжалование', url: `https://vk.ru/topic-243089386_69303056` });
                    await vk.api.messages.send({ peer_id: Number(reporterId), message: spamMsg + `\n\n😈 Вы в ЧС на 1 день.`, keyboard: banKb.toString(), random_id: 0 });
                } catch(e){}
            } else {
                await dbRun("REPLACE INTO warnings (user_id, count) VALUES (?, ?)", [String(reporterId), warns]);
                try { await vk.api.messages.send({ peer_id: Number(reporterId), message: spamMsg, random_id: 0 }); } catch(e){}
            }
            
            await safeAnswer({ type: 'show_snackbar', text: 'Вызов отмечен как спам.' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🚫 Вызов отклонен (Спам).`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= ДОЛГИ =================
        if (payload.cmd === 'debt_accept') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Заявка устарела.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не ваша заявка.' });

            await dbRun("UPDATE debts SET status = 'accepted' WHERE id = ?", [debt.id]);
            await updateBalance(userId, debt.amount);
            await safeAnswer({ type: 'show_snackbar', text: '✅ Долг принят!' });
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `✅ ${await getFullName(userId)} принял долг ${formatMoney(debt.amount)}$.`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `🤝 Долг принят! +${formatMoney(debt.amount)}$. Верните через ${debt.days} дн.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'debt_decline') {
            const debt = await dbGet("SELECT * FROM debts WHERE id = ?", [payload.debt_id]);
            if (!debt || debt.status !== 'pending') return await safeAnswer({ type: 'show_snackbar', text: '❌ Заявка устарела.' });
            if (String(userId) !== debt.borrower) return await safeAnswer({ type: 'show_snackbar', text: '❌ Не ваша заявка.' });

            await dbRun("UPDATE debts SET status = 'declined' WHERE id = ?", [debt.id]);
            await updateBalance(debt.lender, debt.amount);
            await safeAnswer({ type: 'show_snackbar', text: '❌ Отказано.' });
            try { await vk.api.messages.send({ peer_id: debt.lender, message: `❌ ${await getFullName(userId)} отказался от долга.`, random_id: 0 }); } catch(e) {}
            return await vk.api.messages.edit({ peer_id: peerId, message: `❌ Вы отказались от долга.`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= БИЗНЕС =================
        if (payload.cmd === 'biz_withdraw') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню.' });
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет бизнеса.' });
            
            const now = Date.now();
            if (now - biz.last_withdraw < 3600000) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${Math.floor((3600000 - (now - biz.last_withdraw))/60000)} мин.` });

            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const total = Number(biz.balance) + earned;
            if (total <= 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Пусто.' });

            await updateBalance(userId, total);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            await safeAnswer({ type: 'show_snackbar', text: `✅ Выведено ${formatMoney(total)}$!` });
            return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Выведено: ${formatMoney(total)}$`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'biz_upgrade') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню.' });
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz || biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Макс уровень или нет бизнеса.' });

            const cost = biz.level * 5000000;
            if (await getBalance(userId) < cost) return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег.' });

            await updateBalance(userId, -cost);
            await dbRun("UPDATE businesses SET level = level + 1 WHERE user_id = ?", [String(userId)]);
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Уровень повышен! Теперь ${biz.level + 1}/5`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
        }
        
        if (payload.cmd === 'biz_sell') {
             if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню.' });
             const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
             if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет бизнеса.' });
             
             await updateBalance(userId, 10000000);
             await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
             await safeAnswer({ type: 'show_snackbar', text: '🔥 Бизнес слит! +10кк' });
             return await vk.api.messages.edit({ peer_id: peerId, message: `🔥 Вы слили бизнес за 10,000,000$!`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        // ================= РАБОТА =================
        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;

            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Лимит работ (3/ч). Ждите.` });

            if (payload.type === 'Такси') {
                const u = await dbGet("SELECT cars FROM users WHERE user_id = ?", [String(userId)]);
                if (JSON.parse(u?.cars || '[]').length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нужна машина для такси.' });
            }

            await safeAnswer();
            count++;
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);
            const earned = Math.floor(Math.random() * 6000) + 1000;
            await updateBalance(userId, earned);
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Работа (${payload.type}): +${formatMoney(earned)}$\nОсталось: ${3-count}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
        }

        // ================= HELP (ЗИМНИЙ РАЗДЕЛ - ТОЛЬКО EVENT) =================
        if (payload.cmd === 'help_start') {
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: "📖 Разделы:", keyboard: getHelpKb(), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            let msg = "";
            if (payload.section === 'games') {
                msg = "🎮 Игры (по столбикам):\n" +
                      "1. мины (ставка с 100 до вб)\n" +
                      "2. рулетка (ставка цвет красное/черное)\n" +
                      "3. краш (коэффициент ставка)\n" +
                      "4. монетка (орел/решка ставка)\n" +
                      "5. стакан (номер 1-3 ставка)\n" +
                      "6. кубик (число 1-6 ставка)\n" +
                      "7. автомат (ставка)\n" +
                      "8. блэкджек (ставка)\n" +
                      "9. дрим (число 1-5 ставка)\n" +
                      "10. фортуна (без ставки)";
            }
            if (payload.section === 'eco') msg = "💼 Экономика:\nбизнес, купитьбиз, мойбизнес, вывести, слитьбиз, бонус, transfer, duel, promo, машины, купить машина, sellcar, датьдолг, купитьсим";
            if (payload.section === 'profile') msg = "👤 Профиль:\nпрофиль, топ, rep +/-, пинг, premium";
            if (payload.section === 'reports') msg = "📩 Жалобы:\nreport [текст], админ (ответом)";
            if (payload.section === 'org') msg = "🏛️ Орг/Страны:\nорганизации, вступить, страны, страна";
            
            if (payload.section === 'winter') {
                msg = "❄️ ЗИМНИЕ ИГРЫ ❄️\n\n" +
                      "🎁 Ивент:\n" +
                      "▪️ event - Зимний ивент\n" +
                      "▪️ открыть кейс зимний - Открыть награду";
            }

            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) {
                    const c = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [d.name]);
                    txt += `📍 ${d.name} (${c.c}/20)\n`;
                }
                msg = txt + "\n💡 купить дом топ [№] [Локация]";
            }
            
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) {
                    const c = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [d.name]);
                    txt += `📍 ${d.name} (${c.c}/20)\n`;
                }
                msg = txt + "\n💡 купить гараж топ [№] [Локация]";
            }
            
            return await vk.api.messages.edit({ peer_id: peerId, message: msg, keyboard: getHelpBackKb(), conversation_message_id: context.conversationMessageId });
        }

        // ================= ТОП (ФИКС ФИЛЬТРАЦИИ И КНОПОК) =================
        if (payload.cmd === 'top_menu' || payload.cmd === 'top_back') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню!' });
            
            const type = payload.type || 'coins';
            const scope = payload.scope || 'chat';

            let orderBy = "balance DESC", filter = "balance > 0";
            if (type === 'level') orderBy = "level DESC, xp DESC";
            if (type === 'duels') orderBy = "duel_wins DESC";
            if (type === 'bonus') orderBy = "bonus_count DESC";
            if (type === 'rep') { 
                orderBy = "reputation DESC"; 
                filter = "reputation != 0"; 
            }

            let rows = [];
            if (scope === 'global') {
                rows = await dbAll(`SELECT user_id, balance, level, reputation, duel_wins, bonus_count FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
            } else {
                rows = await dbAll(`SELECT u.user_id, u.balance, u.level, u.reputation, u.duel_wins, u.bonus_count FROM users u INNER JOIN chat_messages c ON u.user_id = c.user_id WHERE c.peer_id = ? AND ${filter} ORDER BY ${orderBy} LIMIT 10`, [String(context.peerId)]);
            }

            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n\n`;
            let count = 0;
            const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            
            for (const r of rows) {
                const name = await getFullName(r.user_id);
                let val = "0";
                if (type === 'coins') val = formatShortMoney(r.balance) + '$';
                else if (type === 'level') val = `Ур.${r.level}`;
                else if (type === 'duels') val = r.duel_wins || 0;
                else if (type === 'bonus') val = r.bonus_count || 0;
                else if (type === 'rep') val = r.reputation || 0;
                
                title += `${emojis[count]} ${name} — ${val}\n`;
                count++;
            }
            if (rows.length === 0) title += "Пусто...";

            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: title, keyboard: getTopKb(payload.author, type, scope), conversation_message_id: context.conversationMessageId });
        }

        // ================= ДУЭЛЬ =================
        if (payload.cmd === 'duel_accept') {
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            if (row) {
                if (String(userId) === row.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ С собой нельзя!' });
                if (await getBalance(userId) < row.bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас недостаточно монеток' });
                
                const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
                const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
                const prize = Math.floor(row.bet * 1.8);
                
                await updateBalance(winnerId, prize);
                await updateBalance(loserId, -row.bet);
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
                
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: `⚔️ Победа: ${await getFullName(winnerId)}\nПроигрыш: ${await getFullName(loserId)}\n💰 ${prize}$`, keyboard: "", disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            }
        }

        // ================= МИНЫ =================
        if (payload.cmd === 'mines_set') {
            const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            if (!row) return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра устарела.' });

            const minesArr = [];
            while(minesArr.length < Number(payload.count)) {
                const r = Math.floor(Math.random() * 9) + 1;
                if (!minesArr.includes(r)) minesArr.push(r);
            }
            
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
                let text = hitCell === -1 ? `🏆 ПОБЕДА!\n+${currentMoney}$` : ui.text;
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
            return await vk.api.messages.edit({ peer_id: peerId, message: `💰 Забрано: ${win}$ (x${row.multiplier})\nБаланс: ${formatMoney(await getBalance(userId))}$`, keyboard: buildMinesKb(String(payload.gameId), opened, JSON.parse(row.mines), true, null), conversation_message_id: context.conversationMessageId });
        }

        await safeAnswer();
    } catch (e) {
        console.error("Callback Error:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка.' });
    }
});

// ===== ОБРАБОТКА ОЦЕНОК И ЗАГАДОК =====
vk.updates.on('message_new', async (message, next) => {
    if (message.isOutbox || message.senderId < 0) return next();
    const text = message.text ? message.text.trim() : '';
    if (!text || message.peerId !== message.senderId) return next();

    const userId = message.senderId;
    const state = adminStates.get(userId);

    // Обработка ответов на загадки зимних игр (если они вдруг останутся в validCmds)
    if (state && state.startsWith('riddle_')) {
        const parts = state.split('_');
        const gameCmd = parts[1];
        const correctAnswer = parseInt(parts[2]);
        const userAnswer = parseInt(text);

        if (isNaN(userAnswer)) return await message.reply("❌ Введите число!");

        adminStates.delete(userId);

        if (userAnswer === correctAnswer) {
            const prize = Math.floor(Math.random() * 4000000) + 1000000; // 1кк - 5кк
            await updateBalance(userId, prize);
            
            let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (!ev) await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
            await dbRun("UPDATE winter_event SET game_score = game_score + ? WHERE user_id = ?", [prize, String(userId)]);

            const emojis = {
                'снежки': '❄️', 'елка': '🎄', 'санки': '🛷', 'снеговик': '⛄', 'подарок': '🎁'
            };
            return await message.reply(`${emojis[gameCmd] || '🎉'} Правильно! 🎉\n💰 Награда: +${formatMoney(prize)}$`);
        } else {
            return await message.reply(`❌ Неверно! Правильный ответ: ${correctAnswer}. Попробуйте еще раз (лимит не тратится при ошибке).`);
        }
    }

    // Обработка оценок репортов
    if (state && state.startsWith('rating_')) {
        const reportId = state.split('_')[1];
        const rating = parseInt(text);

        if (isNaN(rating) || rating < 1 || rating > 10) return await message.reply("❌ Введите число от 1 до 10.");

        adminStates.delete(userId);
        const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
        
        if (report) {
            await dbRun("UPDATE reports SET rating = ? WHERE id = ?", [rating, reportId]);

            if (rating <= 4) {
                return await message.reply(`😔 Оценка ${rating}/10 (Плохо).\nЧто не так?`, { keyboard: getBadRateKb(reportId) });
            } else {
                await dbRun("UPDATE reports SET status = 'closed' WHERE id = ?", [reportId]);
                return await message.reply(`🙏 Оценка ${rating}/10 (Хорошо)!\nСпасибо, что выбрали причину:`, { keyboard: getGoodRateKb(reportId) });
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
                await vk.api.messages.send({ peer_id: context.peerId, message: `🚫 ${await getFullName(context.memberId)} кикнут (Бан в беседе).\nПричина: ${chatBan.reason}`, random_id: 0, disable_mentions: 1 });
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
            ? "Привет! Я Game Zone Bot. Права есть. Пиши help." 
            : "Привет! Я Game Zone Bot. Дай админку для полной работы. Пиши help.";
        
        const actKb = Keyboard.builder().inline()
            .callbackButton({ label: 'Активировать', payload: { cmd: 'activate_bot' }, color: Keyboard.POSITIVE_COLOR })
            .callbackButton({ label: 'Отмена', payload: { cmd: 'decline_bot' }, color: Keyboard.NEGATIVE_COLOR });
        
        try {
            await vk.api.messages.send({ peer_id: context.peerId, message: greetText, keyboard: actKb.toString(), random_id: 0, group_id: GROUP_ID, disable_mentions: 1 });
        } catch (err) { console.error(err); }
    }
});

// ===== ЗАПУСК =====
console.log("=========================================");
console.log("ЗАПУСК GAME ZONE BOT...");
console.log("=========================================");

vk.updates.startPolling().then(() => {
    console.log("--- БОТ ЗАПУЩЕН ---");
}).catch(err => {
    console.error("ОШИБКА СТАРТА:", err);
});
