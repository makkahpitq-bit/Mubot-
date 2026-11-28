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
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'game.db');
const db = new sqlite3.Database(DB_FILE);

const dbRun = (query, params = []) => new Promise((res, rej) => db.run(query, params, function(e) { e ? rej(e) : res(this); }));
const dbGet = (query, params = []) => new Promise((res, rej) => db.get(query, params, (e, r) => e ? rej(e) : res(r)));
const dbAll = (query, params = []) => new Promise((res, rej) => db.all(query, params, (e, r) => e ? rej(e) : res(r)));

const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const chsbNotifyCache = new Map(); 

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

const ORGS = ['МВД', 'ФСБ', 'Армия', 'СМИ', 'Медики', 'Безработный'];
const COUNTRIES = ['Россия', 'Беларусь', 'Казахстан', 'Украина', 'США', 'Германия'];

async function initDB() {
    await dbRun("DROP TABLE IF EXISTS winter_event");
    await dbRun("DROP TABLE IF EXISTS reports");
    
    await dbRun("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 1000, reputation INTEGER DEFAULT 0, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, reg_date TEXT, duel_wins INTEGER DEFAULT 0, bonus_count INTEGER DEFAULT 0, premium_until INTEGER DEFAULT 0, org TEXT, country TEXT, cars TEXT DEFAULT '[]', last_bonus_date TEXT, bonus_streak INTEGER DEFAULT 0, sim_card TEXT, special_case INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS active_duels (msg_id TEXT PRIMARY KEY, challenger TEXT, bet INTEGER, peer_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS bonus_cd (user_id TEXT PRIMARY KEY, last_used INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS fortune_cd (user_id TEXT PRIMARY KEY, last_used INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS promos (code TEXT PRIMARY KEY, amount INTEGER, limit_count INTEGER, used_by TEXT DEFAULT '')");
    await dbRun("CREATE TABLE IF NOT EXISTS games (game_id TEXT PRIMARY KEY, user_id TEXT, bet INTEGER, mines TEXT, opened TEXT, multiplier REAL, msg_id TEXT, start_time INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS blacklist (user_id TEXT PRIMARY KEY, reason TEXT, until INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS chat_bans (user_id TEXT, peer_id TEXT, reason TEXT, PRIMARY KEY (user_id, peer_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS mutes (user_id TEXT, peer_id TEXT, mute_until INTEGER, reason TEXT, PRIMARY KEY (user_id, peer_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS frozen (user_id TEXT PRIMARY KEY)");
    await dbRun("CREATE TABLE IF NOT EXISTS chat_messages (peer_id TEXT, user_id TEXT, count INTEGER DEFAULT 0, PRIMARY KEY (peer_id, user_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS businesses (user_id TEXT PRIMARY KEY, biz_name TEXT, level INTEGER DEFAULT 1, balance INTEGER DEFAULT 0, last_income INTEGER, last_withdraw INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS rep_limits (user_id TEXT, target_id TEXT, last_given INTEGER, PRIMARY KEY (user_id, target_id))");
    await dbRun("CREATE TABLE IF NOT EXISTS work_cd (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0, last_reset INTEGER)");
    await dbRun("CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, location TEXT, tier INTEGER, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS custom_cmds (user_id TEXT, alias TEXT, real_cmd TEXT, PRIMARY KEY (user_id, alias))");
    await dbRun("CREATE TABLE IF NOT EXISTS warnings (user_id TEXT PRIMARY KEY, count INTEGER DEFAULT 0)");
    await dbRun("CREATE TABLE IF NOT EXISTS sim_cards (number TEXT PRIMARY KEY, owner_id TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS staff (user_id TEXT PRIMARY KEY, role TEXT)");
    
    await dbRun("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id TEXT, text TEXT, status TEXT DEFAULT 'pending', chat_id TEXT, reply_text TEXT, rating INTEGER DEFAULT 0, rate_reason TEXT)");
    await dbRun("CREATE TABLE IF NOT EXISTS winter_event (user_id TEXT PRIMARY KEY, reps_given INTEGER DEFAULT 0, msgs_sent INTEGER DEFAULT 0, top_used INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, last_opened INTEGER DEFAULT 0)");

    try { await dbRun("ALTER TABLE users ADD COLUMN special_case INTEGER DEFAULT 0"); } catch(e) {}
    console.log("--- БАЗА ДАННЫХ ГОТОВА ---");
}
initDB();

function parseAmount(str) {
    if (!str) return 0;
    str = String(str).toLowerCase().replace(/\s/g, '');
    if (str.endsWith('всё') || str.endsWith('все') || str.endsWith('вб') || str === 'all') return 'ALL'; 
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

async function generateProfileImage(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId, fields: 'photo_200' });
        const nameText = `${user.first_name} ${user.last_name || ''}`.trim();
        const avatarUrl = user.photo_200 || DEFAULT_PROFILE_PHOTO;
        const avatar = await Jimp.read(avatarUrl); avatar.cover(400, 400);
        const canvas = new Jimp(400, 450, 0x101010FF); canvas.composite(avatar, 0, 0);
        const banner = new Jimp(400, 50, 0x000000B0); canvas.composite(banner, 0, 400);
        try {
            const font = await Jimp.loadFont("https://raw.githubusercontent.com/Fluffffy/jimp-cyrillic-fonts/master/fonts/open-sans-32-white/open-sans-32-white.fnt");
            if (font) canvas.print(font, 0, 405, { text: nameText, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 400, 40);
        } catch(e) {}
        return await canvas.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) { return null; }
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
            text: `💥 БАБАХ! ПОРАЖЕНИЕ\n────────────────────\n👤 ${name} наступил(а) на мину!\n💣 Мин на поле: ${minesCount}\n✅ Успел(а) открыть: ${currentOpened}\n\n📉 Потеряно: -${bet} 💰\n😢 Не забрал(а): ${currentMoney} 💰 (x${currentMult})\n💳 Баланс: ${formatMoney(balance)} 💰`,
            kb: buildMinesKb(gameId, opened, minesArr, true, hitCell)
        };
    } else {
        return {
            text: `💣 МИНЫ\n────────────────────\n👤 ${name}\n💵 Ставка: ${bet} | 💣 Мин: ${minesCount}\n\n${progressBar} ${currentOpened}/${totalSafe}\n📈 Сейчас: x${currentMult.toFixed(2)} → ${currentMoney} 💰\n🎯 Следующая: x${nextMult.toFixed(2)} → ${nextMoney} 💰\n🍀 Шанс: ${chance}%`,
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
        .callbackButton({ label: '🔙 Назад', payload: { cmd: 'help_start' }, color: Keyboard.SECONDARY_COLOR }).toString();
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

const getTopKb = (authorId, type = 'msgs', scope = 'chat', repType = 'pos', levelFilter = 'all') => {
    const kb = Keyboard.builder().inline();
    
    kb.callbackButton({ label: '💰 Монеты', payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '⭐ Уровень', payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId, levelFilter }, color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '⚔️ Дуэли', payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '📊 Репутация', payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '🎁 Бонус', payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 Сообщения', payload: { cmd: 'top_menu', type: 'msgs', scope, repType, author: authorId }, color: type === 'msgs' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    
    if (type === 'rep') {
        kb.callbackButton({ label: '➕ Положит.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.callbackButton({ label: '➖ Отрицат.', payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR });
        kb.row();
    }
    
    if (type === 'level') {
        kb.callbackButton({ label: 'Бронза', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'bronze' }, color: levelFilter === 'bronze' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.callbackButton({ label: 'Серебро', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'silver' }, color: levelFilter === 'silver' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.row();
        kb.callbackButton({ label: 'Золото', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'gold' }, color: levelFilter === 'gold' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.callbackButton({ label: 'Платина', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'platinum' }, color: levelFilter === 'platinum' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.row();
        kb.callbackButton({ label: 'Алмаз', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'diamond' }, color: levelFilter === 'diamond' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.callbackButton({ label: 'Легенда', payload: { cmd: 'top_menu', type, scope, repType, author: authorId, levelFilter: 'legend' }, color: levelFilter === 'legend' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR });
        kb.row();
    }
    
    kb.callbackButton({ label: '🌍 Общее', payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId, levelFilter }, color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.callbackButton({ label: '💬 В беседе', payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId, levelFilter }, color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR });
    kb.row();
    kb.callbackButton({ label: '🔙 Назад', payload: { cmd: 'top_back', author: authorId }, color: Keyboard.SECONDARY_COLOR });
    return kb.toString();
};

const getBizKb = (authorId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: 'Вывести $$$', payload: { cmd: 'biz_withdraw', author: authorId }, color: Keyboard.POSITIVE_COLOR })
        .row()
        .callbackButton({ label: 'Повысить уровень', payload: { cmd: 'biz_upgrade', author: authorId }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🔥 Слить бизнес', payload: { cmd: 'biz_sell', author: authorId }, color: Keyboard.NEGATIVE_COLOR }).toString();
};

const getAdminReportKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✍️ Ответить', payload: { cmd: 'report_reply', report_id: reportId }, color: Keyboard.PRIMARY_COLOR })
        .callbackButton({ label: '🚫 Спам', payload: { cmd: 'report_spam', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR }).toString();
};

const getReportRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⭐ Оценить работу', payload: { cmd: 'report_rate_start', report_id: reportId }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '❌ Закрыть вопрос', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR }).toString();
};

const getBadRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '⏳ Долго', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Долго' }, color: Keyboard.SECONDARY_COLOR })
        .callbackButton({ label: '🚫 Не помог', payload: { cmd: 'report_bad_reason', report_id: reportId, reason: 'Не помог' }, color: Keyboard.SECONDARY_COLOR })
        .row().callbackButton({ label: '❌ Закрыть', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR }).toString();
};

const getGoodRateKb = (reportId) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Быстро', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Быстро' }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🤝 Помог', payload: { cmd: 'report_good_reason', report_id: reportId, reason: 'Помог' }, color: Keyboard.POSITIVE_COLOR })
        .row().callbackButton({ label: '❌ Закрыть', payload: { cmd: 'report_close', report_id: reportId }, color: Keyboard.NEGATIVE_COLOR }).toString();
};

const getAdminCallKb = (reporterId, targetId, text) => {
    return Keyboard.builder().inline()
        .callbackButton({ label: '✅ Принять', payload: { cmd: 'admin_call_accept', reporter_id: reporterId, target_id: targetId, text: text }, color: Keyboard.POSITIVE_COLOR })
        .callbackButton({ label: '🚫 Спам', payload: { cmd: 'admin_call_spam', reporter_id: reporterId }, color: Keyboard.NEGATIVE_COLOR }).toString();
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

        // Проверка на разработчика / владельца
        const staffRow = await dbGet("SELECT role FROM staff WHERE user_id = ?", [String(userId)]);
        const isDev = staffRow && (staffRow.role === 'Разработчик' || staffRow.role === 'Владелец');
        const hasAdminAccess = userId === ADMIN_ID || isDev;

        if (userId !== ADMIN_ID && !isDev) {
            const isFrozen = await dbGet("SELECT user_id FROM frozen WHERE user_id = ?", [String(userId)]);
            if (isFrozen) return await message.reply("💀 Вы заморожены в боте.");
            const isBlacklisted = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(userId)]);
            if (isBlacklisted && (isBlacklisted.until === 0 || Date.now() < isBlacklisted.until)) {
                return await message.reply(`😈 Вы в ЧС бота. Причина: ${isBlacklisted.reason}`);
            }
        }

        if (message.isChat && userId !== ADMIN_ID && !isDev) {
            const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
            if (activeMute && Date.now() < activeMute.mute_until) {
                try { await vk.api.messages.delete({ peer_id: peerId, cmids: [message.conversationMessageId], delete_for_all: 1 }); } catch(e) {}
                return; 
            }
        }

        // Ответы на репорты (Админ)
        if (hasAdminAccess && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            if (state.startsWith('reply_')) {
                const reportId = state.split('_')[1];
                const replyText = text;
                adminStates.delete(userId);
                
                const report = await dbGet("SELECT * FROM reports WHERE id = ?", [reportId]);
                if (report) {
                    await dbRun("UPDATE reports SET status = 'answered', reply_text = ? WHERE id = ?", [replyText, reportId]);
                    try {
                        await vk.api.messages.send({ peer_id: report.reporter_id, message: `📩 Ответ от Администрации:\n\n${replyText}\n\n👇 Оцените работу:`, keyboard: getReportRateKb(reportId).toString(), random_id: 0 });
                    } catch(e) {}
                }
                return await message.reply("✅ Ответ отправлен.");
            }
        }

        const validCmds = ['стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 'обнулить', 'создать', 'cc', 'ping', 'пинг', 'убрать', 'дом', 'дома', 'гараж', 'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 'разморозить', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 'premium', 'q', 'админ', 'ahelp', 'объявление', 'report', 'вступить', 'организации', 'страна', 'страны', 'cl', 'снятьпред', 'купитьсим', 'слитьсим', 'event', 'открыть', 'слитьбиз', 'logs', 'чсблист', 'banlist', 'setadmin', 'staff'];
        
        if (!validCmds.includes(cmdWord)) return; 

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
            
            // Обновляем прогресс ивента (100 сообщений)
            await dbRun("UPDATE winter_event SET msgs_sent = msgs_sent + 1 WHERE user_id = ? AND msgs_sent < 100", [String(userId)]);
        }

        const balance = await getBalance(userId);
        const rep = await getReputation(userId);

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
            let txt = `📖 ДОСТУПНЫЕ КОМАНДЫ\n\n`;
            txt += `🎮 ИГРЫ:\n`;
            txt += `1) мины (ставка с 100 до вб)\n`;
            txt += `2) рулетка (ставка цвет красное/черное)\n`;
            txt += `3) краш (ставка коэффициент)\n`;
            txt += `4) монетка (орел/решка ставка)\n`;
            txt += `5) стакан (1/2/3 ставка)\n`;
            txt += `6) кубик (1-6 ставка)\n`;
            txt += `7) автомат (ставка)\n`;
            txt += `8) блэкджек (ставка)\n`;
            txt += `9) дрим (1-5 ставка)\n`;
            txt += `10) фортуна (100$)\n\n`;
            txt += `💼 ЭКОНОМИКА:\n`;
            txt += `1) бизнес / купитьбиз / мойбизнес\n`;
            txt += `2) вывести (доход с бизнеса)\n`;
            txt += `3) бонус (ежедневный опыт)\n`;
            txt += `4) transfer [сумма] (ответом)\n`;
            txt += `5) duel [ставка]\n`;
            txt += `6) promo [код]\n`;
            txt += `7) машины / купить машина / sellcar\n`;
            txt += `8) дома / гаражи / купить дом / продать\n`;
            txt += `9) купитьсим / слитьсим\n\n`;
            txt += `👤 ПРОФИЛЬ:\n`;
            txt += `1) профиль / баланс / топ\n`;
            txt += `2) rep + / rep -\n`;
            txt += `3) premium\n`;
            txt += `4) staff (список персонала)\n\n`;
            txt += `📩 ЖАЛОБЫ:\n`;
            txt += `1) report [текст]\n`;
            txt += `2) админ (ответом)\n`;
            return await message.reply(txt, replyParams(getHelpKb()));
        }

        if (cmdWord === 'ahelp') {
            if (!hasAdminAccess) return;
            let txt = `👑 АДМИН КОМАНДЫ\n\n`;
            txt += `cc - Удалить промокоды\n`;
            txt += `объявление [текст] - Рассылка\n`;
            txt += `выдать [сумма] [@ник/all]\n`;
            txt += `обнулить [@ник/all]\n`;
            txt += `cl [@ник/all]\n`;
            txt += `снятьпред [@ник]\n`;
            txt += `чсб [@ник] [дней] [причина]\n`;
            txt += `mute [@ник] [мин]\n`;
            txt += `kick [@ник] [причина]\n`;
            txt += `ban @vk [причина]\n`;
            txt += `unban @vk\n`;
            txt += `setadmin @vk - Выдать роль\n`;
            txt += `выдать кейс особый @vk\n`;
            return await message.reply(txt);
        }

        // --- STAFF & SETADMIN ---
        if (cmdWord === 'setadmin') {
            if (userId !== ADMIN_ID) return await message.reply("❌ Только для владельца.");
            const { targetId } = await getTargetAndReason(message, 'setadmin');
            if (!targetId) return await message.reply("Укажите пользователя: /setadmin @user");
            
            const rolesKb = Keyboard.builder().inline()
                .callbackButton({ label: 'Модератор', payload: { cmd: 'set_role', target: targetId, role: 'Модератор' }, color: Keyboard.PRIMARY_COLOR })
                .callbackButton({ label: 'Администратор', payload: { cmd: 'set_role', target: targetId, role: 'Администратор' }, color: Keyboard.SECONDARY_COLOR })
                .row()
                .callbackButton({ label: 'Тестировщик', payload: { cmd: 'set_role', target: targetId, role: 'Тестировщик' }, color: Keyboard.SECONDARY_COLOR })
                .callbackButton({ label: 'Разработчик', payload: { cmd: 'set_role', target: targetId, role: 'Разработчик' }, color: Keyboard.NEGATIVE_COLOR })
                .toString();
                
            return await message.reply(`Выберите роль для [id${targetId}|Игрок]:`, replyParams(rolesKb));
        }

        if (cmdWord === 'staff') {
            const staffList = await dbAll("SELECT user_id, role FROM staff");
            let txt = "👑 ПЕРСОНАЛ БОТА:\n\n";
            txt += `Владелец: ${await getFullName(ADMIN_ID)}\n`;
            for (let s of staffList) {
                txt += `${s.role}: ${await getFullName(s.user_id)}\n`;
            }
            return await message.reply(txt);
        }

        // --- PREMIUM & ORGS ---
        if (cmdWord === 'premium') {
            const isPrem = userRow.premium_until > Date.now();
            let txt = `💎 ПРЕМИУМ СТАТУС\n\n`;
            txt += `Статус: ${isPrem ? 'Активен до ' + new Date(userRow.premium_until).toLocaleDateString() : 'Не активен'}\n\n`;
            txt += `Преимущества:\n- Бонус +50% к опыту\n- Уникальные возможности\n\n`;
            txt += `Купить: /купить премиум`;
            return await message.reply(txt);
        }

        if (cmdWord === 'организации') {
            return await message.reply(`🏛️ Доступные организации:\n\n${ORGS.join('\n')}\n\nВступить: /вступить [Название]`);
        }
        if (cmdWord === 'вступить') {
            const org = parts.slice(1).join(' ');
            if (!ORGS.includes(org)) return await message.reply("❌ Такой организации нет. Список: /организации");
            await dbRun("UPDATE users SET org = ? WHERE user_id = ?", [org, String(userId)]);
            return await message.reply(`✅ Вы вступили в ${org}!`);
        }
        if (cmdWord === 'страны') {
            return await message.reply(`🌍 Доступные страны:\n\n${COUNTRIES.join('\n')}\n\nВыбрать: /страна [Название]`);
        }
        if (cmdWord === 'страна') {
            const country = parts.slice(1).join(' ');
            if (!COUNTRIES.includes(country)) return await message.reply("❌ Такой страны нет. Список: /страны");
            await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [country, String(userId)]);
            return await message.reply(`✅ Вы выбрали страну: ${country}!`);
        }

        // --- EVENT ---
        if (cmdWord === 'event') {
            let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
            if (!ev) {
                await dbRun("INSERT INTO winter_event (user_id) VALUES (?)", [String(userId)]);
                ev = { reps_given: 0, msgs_sent: 0, top_used: 0, completed: 0, last_opened: 0 };
            }
            if (ev.last_opened > 0 && Date.now() - ev.last_opened < 3600000 && ev.completed === 0) {
                const mins = Math.ceil((3600000 - (Date.now() - ev.last_opened)) / 60000);
                return await message.reply(`⏳ Вы уже забрали зимний кейс. Ждите ${mins} мин.`);
            }
            let txt = `Поздравляем с зимой🌨️ Мы приготовили вам подарок до 10.01.2027 в виде зимных кейсов, выполняй задания внизу и возьми кейс🔥\n\n`;
            txt += `1) ☃️Выдать любому игроку репутацию ${Math.min(ev.reps_given, 5)}/5 ❄️\n`;
            txt += `2) ☃️Написать в беседе сообщение ${Math.min(ev.msgs_sent, 100)}/100 ❄️\n`;
            txt += `3) ☃️Напиши /top ${Math.min(ev.top_used, 3)}/3 ❄️\n\n`;
            txt += `Когда все выполнишь напиши /открыть кейс зимний😍 Главная приз в виде Bugatti Veyron`;
            if (ev.reps_given >= 5 && ev.msgs_sent >= 100 && ev.top_used >= 3) {
                txt = `🎉 Задания выполнены! Напишите /открыть кейс зимний чтобы получить награду!`;
            }
            return await message.reply(txt);
        }

        if (cmdWord === 'открыть') {
            const caseName = parts.slice(1).join(' ').toLowerCase().trim();
            if (caseName === 'кейс зимний' || caseName === 'зимний') {
                let ev = await dbGet("SELECT * FROM winter_event WHERE user_id = ?", [String(userId)]);
                if (!ev || ev.reps_given < 5 || ev.msgs_sent < 100 || ev.top_used < 3) {
                    return await message.reply("❌ Вы не выполнили все задания /event.");
                }
                if (ev.last_opened > 0 && Date.now() - ev.last_opened < 3600000) {
                    const mins = Math.ceil((3600000 - (Date.now() - ev.last_opened)) / 60000);
                    return await message.reply(`⏳ Вы уже забрали зимний кейс. Ждите ${mins} мин.`);
                }
                await dbRun("UPDATE winter_event SET reps_given = 0, msgs_sent = 0, top_used = 0, last_opened = ? WHERE user_id = ?", [Date.now(), String(userId)]);
                
                const prizes = [
                    { type: 'car', name: 'Bugatti Chiron' }, { type: 'rep', val: 50 }, { type: 'level', val: 20 },
                    { type: 'money', val: 50000000 }, { type: 'money', val: 40000000 }, { type: 'case', val: 1 },
                    { type: 'case', val: 10 }, { type: 'money', val: 100000000 }, { type: 'car', name: 'Toyota Camry' },
                    { type: 'car', name: 'Mercedes-Benz E-Class' }
                ];
                const prize = prizes[Math.floor(Math.random() * prizes.length)];
                let resText = "📦 Открываю кейс...\n\n🎉 Кейс открыт! Выпало: ";
                if (prize.type === 'car') {
                    let cars = JSON.parse(userRow.cars || '[]');
                    cars.push(prize.name);
                    await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(cars), String(userId)]);
                    resText += `🚗 ${prize.name}`;
                } else if (prize.type === 'money') {
                    await updateBalance(userId, prize.val); resText += `💰 ${formatMoney(prize.val)}$`;
                } else if (prize.type === 'rep') {
                    await updateReputation(userId, prize.val); resText += `⭐ ${prize.val} репутации`;
                } else if (prize.type === 'level') {
                    await dbRun("UPDATE users SET level = level + ? WHERE user_id = ?", [prize.val, String(userId)]); resText += `📈 ${prize.val} уровней`;
                } else if (prize.type === 'case') {
                    resText += `🎁 ${prize.val} зимних кейсов!`;
                }
                return await message.reply(resText);
            }
            
            if (caseName === 'кейс особый' || caseName === 'особый') {
                if (userRow.special_case !== 1) return await message.reply("❌ У вас нет особого кейса.");
                await dbRun("UPDATE users SET special_case = 0 WHERE user_id = ?", [String(userId)]);
                const prizes = ['Bugatti Chiron', 'BMW M5 F90 (ДПС)', 'Toyota Camry (ППС)', 'Mercedes-Benz E-Class (ДПС)', 'Ferrari'];
                const prize = prizes[Math.floor(Math.random() * prizes.length)];
                let cars = JSON.parse(userRow.cars || '[]'); cars.push(prize);
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(cars), String(userId)]);
                return await message.reply(`📦 Открываю кейс...\n\n🎉 Кейс открыт, выпало: ${prize}. Поздравляем!`);
            }
        }

        // --- BONUS ---
        if (cmdWord === 'бонус') {
            const today = new Date().toISOString().split('T')[0];
            if (userRow.last_bonus_date === today) {
                const now = new Date();
                const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                const diff = tomorrow - now;
                const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000);
                return await message.reply(`🕒 ${await getFullName(userId)}, ежедневный бонус еще не готов, попробуйте еще раз через — ${h} часов ${m} минут`, replyParams());
            }
            let streak = userRow.bonus_streak || 0;
            const now = new Date();
            if (userRow.last_bonus_date) {
                const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().split('T')[0];
                if (userRow.last_bonus_date === yesterday) streak++; else streak = 1;
            } else streak = 1;
            
            let amount = Math.min(50 + (streak * 50), 2500);
            let nextAmount = Math.min(50 + ((streak + 1) * 50), 2500);
            
            await dbRun("UPDATE users SET xp = xp + ?, last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [amount, today, streak, String(userId)]);
            return await message.reply(`🎁 ${await getFullName(userId)} получил ежедневный бонус опыта — ${amount}.\n🔥 Серия: ${streak} дней подряд! Следующий бонус - ${nextAmount} из 2500 опыта`, replyParams());
        }

        // --- REPORT ---
        if (cmdWord === 'report') {
            const reportText = parts.slice(1).join(' ');
            if (!reportText) return await message.reply("❌ Опишите проблему: /report [текст]");
            
            await dbRun("INSERT INTO reports (reporter_id, text, chat_id) VALUES (?, ?, ?)", [String(userId), reportText, String(peerId)]);
            
            const admins = await dbAll("SELECT user_id FROM staff WHERE role IN ('Владелец', 'Разработчик', 'Администратор')");
            let adminIds = [String(ADMIN_ID)];
            for (let a of admins) if(a.user_id !== String(ADMIN_ID)) adminIds.push(a.user_id);
            
            const msg = `📩 Новый репорт от [id${userId}|Игрок]:\n\n${reportText}\n\nБеседа: ${peerId > 2000000000 ? peerId - 2000000000 : 'ЛС'}`;
            
            for (let aid of adminIds) {
                try { await vk.api.messages.send({ peer_id: aid, message: msg, keyboard: getAdminReportKb('0'), random_id: 0 }); } catch(e){}
            }
            return await message.reply("✅ Репорт отправлен администрации.");
        }

        // --- REP ---
        if (cmdWord === 'rep' || cmdWord === 'реп') {
            if (parts.length < 2) return await message.reply("🔔 Для изменения репутации используйте /rep + или /rep -, указав пользователя. Пример: /rep + @Mokhma.volk");
            const isPlus = parts[1] === '+'; const isMinus = parts[1] === '-';
            if (!isPlus && !isMinus) return await message.reply("🔔 Используйте + или -");
            
            let targetId = null;
            if (message.hasReplyMessage) targetId = message.replyMessage.senderId;
            else {
                const targetStr = parts.slice(2).join(' ');
                const idMatch = targetStr.match(/\[id(\d+)\|/i);
                const mentionMatch = targetStr.match(/@([a-zA-Z0-9._]+)/i);
                if (idMatch) targetId = parseInt(idMatch[1]);
                else if (mentionMatch) {
                    try { const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] }); if (res.type === 'user') targetId = res.object_id; } catch (e) {}
                }
            }
            if (!targetId) return await message.reply("⚠️ Укажите пользователя (ответом или через @).");
            if (targetId === userId) return await message.reply("❌ Нельзя изменить репутацию самому себе.");

            const now = Date.now();
            const repLimit = await dbGet("SELECT last_given FROM rep_limits WHERE user_id = ? AND target_id = ?", [String(userId), String(targetId)]);
            if (repLimit && (now - repLimit.last_given) < 86400000) {
                const timeLeft = 86400000 - (now - repLimit.last_given);
                return await message.reply(`⛔ Вы уже изменяли репутацию этого пользователя. Попробуйте через ${Math.floor(timeLeft/3600000)} ч. ${Math.floor((timeLeft%3600000)/60000)} мин.`);
            }
            await dbRun("INSERT OR REPLACE INTO rep_limits (user_id, target_id, last_given) VALUES (?, ?, ?)", [String(userId), String(targetId), now]);
            
            if (isPlus) {
                await updateReputation(targetId, 1);
                await dbRun("UPDATE winter_event SET reps_given = reps_given + 1 WHERE user_id = ? AND reps_given < 5", [String(userId)]);
            } else {
                await updateReputation(targetId, -1);
            }
            const targetRep = await getReputation(targetId);
            const action = isPlus ? "повысил" : "понизил";
            const sign = isPlus ? "+" : "";
            return await message.reply(`${await getFullName(userId)} ${action} репутацию пользователя ${await getFullName(targetId)}, теперь у него ${sign}${targetRep}`, replyParams());
        }

        // --- PROFILE ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houseData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house' LIMIT 1", [String(userId)]);
            const garageData = await dbGet("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage' LIMIT 1", [String(userId)]);
            const bizData = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ?", [String(userId)]);
            const carsArr = JSON.parse(userRow.cars || '[]');
            const premStr = userRow.premium_until > Date.now() ? `До ${new Date(userRow.premium_until).toLocaleDateString('ru-RU')}` : "Нет";
            const bizStr = bizData ? bizData.biz_name : "Нет";
            let carsStr = carsArr.length > 0 ? carsArr.join(', ') : "Нет";
            
            const profText = `🎄 Профиль ${await getFullName(userId)} 🎄\n\n` +
                             `🎄 Баланс: ${formatMoney(balance)}$\n` +
                             `🎄 Тел: ${userRow.sim_card || "Нет"}\n` +
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
        // --- ОСТАЛЬНЫЕ КОМАНДЫ И ИГРЫ ---
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
            if (!selectedCar) return await message.reply("❌ Такой машины нет. Список: /машины");
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
            for (const [key, data] of Object.entries(CARS_DATA)) { if (data.name === carName) { carData = data; break; } }
            if (!carData) {
                await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
                return await message.reply("❌ Ошибка: машина не найдена.", replyParams());
            }
            const sellPrice = carData.sellPrice || Math.floor(carData.price * 0.5); 
            await updateBalance(userId, sellPrice);
            await dbRun("UPDATE users SET cars = ? WHERE user_id = ?", [JSON.stringify(carsArr), String(userId)]);
            return await message.reply(`🚗 Машина ${carData.name} слита! +${formatMoney(sellPrice)}$`, replyParams());
        }

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
            for (const [key, data] of Object.entries(BIZ_DATA)) { if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { selectedBiz = data; break; } }
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
            return await message.reply({
                message: `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение: ${formatMoney(nextLevelCost)}$`,
                keyboard: getBizKb(userId)
            });
        }

        if (cmdWord === 'вывести') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await message.reply("❌ Нет бизнеса.");
            const now = Date.now();
            if (now - biz.last_withdraw < 3600000) return await message.reply(`⏳ Вывод раз в час. Ждите ${Math.floor((3600000 - (now - biz.last_withdraw))/60000)} мин.`);
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            if (totalBalance <= 0) return await message.reply("❌ На балансе 0.");
            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
            return await message.reply(`💸 Выведено ${formatMoney(totalBalance)}$!`, replyParams());
        }

        if (cmdWord === 'дома') {
            let txt = "🏠 Доступные дома:\n\n"; let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.housePrice)}$ (Свободно: ${20 - countRow.c}/20)\n`; i++;
            }
            return await message.reply(txt + "\n💡 Купить: купить дом топ [номер] [Локация]", replyParams());
        }

        if (cmdWord === 'гаражи') {
            let txt = "🏘️ Доступные гаражи:\n\n"; let i = 1;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name]);
                txt += `${i}. ${data.name} — ${formatMoney(data.garagePrice)}$ (Свободно: ${20 - countRow.c}/20)\n`; i++;
            }
            return await message.reply(txt + "\n💡 Купить: купить гараж топ [номер] [Локация]", replyParams());
        }

        if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1]; const tierNum = parseInt(parts[2]); const locationName = parts.slice(3).join(' ').toLowerCase().trim();
            if (!tierNum || !locationName) return await message.reply(`❌ Формат: купить ${propType} топ [номер] [Локация]`);
            let selectedLoc = null;
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                if (key.includes(locationName) || data.name.toLowerCase().includes(locationName)) { selectedLoc = { key, ...data }; break; }
            }
            if (!selectedLoc) return await message.reply("❌ Такая локация не найдена.");
            if (await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ? AND location = ?", [String(userId), propType, selectedLoc.name])) return await message.reply(`❌ У вас уже есть ${propType} в локации ${selectedLoc.name}!`);
            const countRow = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [selectedLoc.name, propType]);
            if (countRow.c >= 20) return await message.reply(`❌ В локации ${selectedLoc.name} больше нет свободных мест!`);
            const price = propType === 'дом' ? selectedLoc.housePrice : selectedLoc.garagePrice;
            if (balance < price) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [propType, selectedLoc.name, tierNum, String(userId)]);
            return await message.reply(`🏠 Вы успешно купили ${propType} в локации ${selectedLoc.name} за ${formatMoney(price)}$!`, replyParams());
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
            if (await getBalance(buyerId) < price) return await message.reply("❌ У покупателя недостаточно монеток!");
            await dbRun("UPDATE properties SET owner_id = ? WHERE id = ?", [String(buyerId), myProp.id]);
            await updateBalance(userId, price); await updateBalance(buyerId, -price);
            return await message.reply(`🏠 Вы продали ${propType} в локации ${myProp.location} игроку ${await getFullName(buyerId)} за ${formatMoney(price)}$!`, replyParams());
        }

        // Исправление SQL ошибки first_name в дондом/донгараж
        if (cmdWord === 'дондом' || cmdWord === 'донгараж') {
            const propType = cmdWord === 'дондом' ? 'house' : 'garage';
            const emoji = cmdWord === 'дондом' ? '🏠' : '🏘️';
            const typeName = cmdWord === 'дондом' ? 'ДОМОВ' : 'ГАРАЖЕЙ';
            
            const rows = await dbAll(`
                SELECT p.id, p.location, p.tier, p.owner_id
                FROM properties p
                WHERE p.type = ? AND p.tier BETWEEN 1 AND 10
                ORDER BY p.tier ASC, p.id ASC
                LIMIT 10
            `, [propType]);

            if (rows.length === 0) return await message.reply(`${emoji} Нет ${typeName.toLowerCase()} с тирами Т1-Т10 для доната.`, replyParams());
            let txt = `${emoji} ТОП 10 ${typeName} (Т1-Т10) ДЛЯ ДОНАТА:\n\n`;
            let count = 0; const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            for (const r of rows) {
                const ownerName = await getFullName(r.owner_id);
                txt += `${emojis[count]} [ID:${r.id}] ${r.location} Т${r.tier} — Владелец: ${ownerName}\n`; count++;
            }
            txt += `\n💡 Чтобы задонатить: /дон ${propType === 'house' ? 'дом' : 'гараж'} [ID] [сумма]`;
            return await message.reply(txt, replyParams());
        }

        if (cmdWord === 'дон' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const propType = parts[1] === 'дом' ? 'house' : 'garage';
            const propId = parseInt(parts[2]);
            const amount = parseAmount(parts[3]);
            if (!propId || !amount || amount < 100) return await message.reply(`❌ Формат: /дон ${parts[1]} [ID недвижимости] [сумма]`);
            const prop = await dbGet("SELECT * FROM properties WHERE id = ? AND type = ?", [propId, propType]);
            if (!prop) return await message.reply(`❌ Недвижимость с ID ${propId} не найдена!`);
            if (balance < amount) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -amount);
            return await message.reply(`🏠 Задонатил ${formatMoney(amount)}$ на ${propType === 'house' ? 'дом' : 'гараж'} #${propId} (${prop.location} Т${prop.tier})!`);
        }

        // --- TOP DEFAULT (MSGS) ---
        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(peerId)]);
            let topText = "⭐ ТОП 10 ПО СООБЩЕНИЯМ\n\n";
            if (rows.length > 0) {
                const userIds = rows.map(r => r.user_id);
                let usersInfo = [];
                try { usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'deactivated' }); } catch (e) {}
                let count = 0; const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
                for (const r of rows) {
                    const uInfo = usersInfo.find(u => u.id == r.user_id);
                    if (uInfo && !uInfo.deactivated) {
                        topText += `${emojis[count]} [id${uInfo.id}|${uInfo.first_name} ${uInfo.last_name || ''}] - ${r.count} сообщ.\n`; count++;
                    }
                }
            } else topText += "В этой беседе пока тихо...";
            
            await dbRun("UPDATE winter_event SET top_used = top_used + 1 WHERE user_id = ? AND top_used < 3", [String(userId)]);
            return await message.reply(topText, replyParams(getTopKb(userId, 'msgs', 'chat')));
        }

        // ================= ИГРЫ (ПРОВЕРКА КД, СТАВКИ БЕЗ ЛИМИТА, ШАБЛОНЫ) =================
        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        
        if (cmdWord === 'монетка') {
            if (!parts[1]) return await message.reply("Для игры монетка напишите: /монетка [орел/решка] [ставка]. Пример: /монетка орел 1000");
            let side = ["орел", "решка"].find(s => parts.includes(s));
            if (!side) return await message.reply("❌ Выберите 'орел' или 'решка'");
            let betStr = parts.find(p => p !== side);
            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Мин. ставка 100$.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -bet);
            const res = Math.random() < 0.5 ? 'орел' : 'решка';
            if (res === side) await updateBalance(userId, bet * 2);
            return await message.reply(`🪙 Выпал: ${res}\n` + (res === side ? `✅ Выигрыш: ${formatMoney(bet*2)}$!` : `❌ Проигрыш: ${formatMoney(bet)}$`) + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }

        if (cmdWord === 'краш') {
            if (!parts[1]) return await message.reply("Для игры краш напишите: /краш [коэффициент] [ставка]. Пример: /краш 3 5000");
            const autoStop = parseFloat(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (isNaN(autoStop) || autoStop < 1.01 || isNaN(bet) || bet < 100) return await message.reply("❌ Неверный формат.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -bet);
            const rand = Math.random();
            let crashPoint = rand > 0.03 ? Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100 : 1.00;
            if (crashPoint >= autoStop) {
                const win = Math.floor(bet * autoStop);
                await updateBalance(userId, win);
                return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams());
            } else return await message.reply(`📈 Краш: x${crashPoint.toFixed(2)}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'стакан') {
            if (!parts[1]) return await message.reply("Для игры стакан напишите: /стакан [1/2/3] [ставка]. Пример: /стакан 2 5000");
            let cup = parseInt(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (cup < 1 || cup > 3 || isNaN(bet) || bet < 100) return await message.reply("❌ Неверный формат.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 3) + 1;
            if (res === cup) { await updateBalance(userId, bet * 3); return await message.reply(`🥤 Шарик под стаканом ${res}\n\n✅ Выигрыш: ${formatMoney(bet*3)}$!`, replyParams()); }
            else return await message.reply(`🥤 Шарик под стаканом ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'кубик') {
            if (!parts[1]) return await message.reply("Для игры кубик напишите: /кубик [1-6] [ставка]. Пример: /кубик 4 2000");
            let guess = parseInt(parts[1]);
            let bet = parseAmount(parts[2]);
            if (bet === 'ALL') bet = balance;
            if (guess < 1 || guess > 6 || isNaN(bet) || bet < 100) return await message.reply("❌ Неверный формат.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -bet);
            const res = Math.floor(Math.random() * 6) + 1;
            if (res === guess) { await updateBalance(userId, bet * 6); return await message.reply(`🎲 Выпало: ${res}\n\n✅ Выигрыш: ${formatMoney(bet*6)}$!`, replyParams()); }
            else return await message.reply(`🎲 Выпало: ${res}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
        }

        if (cmdWord === 'автомат' || cmdWord === 'блэкджек') {
            if (!parts[1]) return await message.reply(`Для игры ${cmdWord} напишите: /${cmdWord} [ставка]. Пример: /${cmdWord} 1000`);
            let bet = parseAmount(parts[1]);
            if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. ставка 100$.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -bet);
            if (cmdWord === 'автомат') {
                const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
                const r1 = emojis[Math.floor(Math.random() * 5)], r2 = emojis[Math.floor(Math.random() * 5)], r3 = emojis[Math.floor(Math.random() * 5)];
                let win = (r1 === r2 && r2 === r3) ? bet * 10 : (r1 === r2 || r2 === r3 || r1 === r3) ? bet * 2 : 0;
                if (win) { await updateBalance(userId, win); return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams()); }
                return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
            }
            if (cmdWord === 'блэкджек') {
                const p = Math.floor(Math.random() * 10) + 12, d = Math.floor(Math.random() * 10) + 12;
                if (p > d && p <= 21) { await updateBalance(userId, bet * 2); return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n\n✅ Выигрыш: ${formatMoney(bet*2)}$!`, replyParams()); }
                return await message.reply(`🃏 Вы: ${p}, Дилер: ${d}\n\n❌ Проигрыш: ${formatMoney(bet)}$`, replyParams());
            }
        }

        if (cmdWord === 'дрим') {
            if (!parts[1]) return await message.reply("Для игры дрим напишите: /дрим [1-5] [ставка]. Пример: /дрим 3 1000");
            const guess = parseInt(parts[1]);
            let actualBet = parseAmount(parts[2]);
            if (actualBet === 'ALL') actualBet = balance;
            if (!guess || guess < 1 || guess > 5 || isNaN(actualBet) || actualBet < 100) return await message.reply("❌ Неверный формат.");
            if (actualBet > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -actualBet);
            const res = Math.floor(Math.random() * 10) + 1;
            if (res === guess) { const win = actualBet * guess; await updateBalance(userId, win); return await message.reply(`💎 Число: ${res}\n\n✅ Выигрыш: ${formatMoney(win)}$!`, replyParams()); }
            return await message.reply(`💎 Число: ${res}\n\n❌ Проигрыш: ${formatMoney(actualBet)}$`, replyParams());
        }

        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (!parts[1]) return await message.reply("Для создания игры рулетка напишите команду затем цвет красное/черное чет/нечет ставка например /рулетка красное 3000");
            let choice = parts[1]; let betStr = parts[2];
            if (!betStr) return await message.reply("❌ Укажите ставку. Пример: /рулетка красное 3000");
            let bet = parseAmount(betStr);
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Мин. ставка 100$.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");

            const res = Math.floor(Math.random() * 36) + 1; 
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            let isWin = false;
            let cName = redNumbers.includes(res) ? "Красное" : "Черное";
            if (parseInt(choice) === res) isWin = true;
            else if (["красное", "красный", "кр"].includes(choice) && redNumbers.includes(res)) isWin = true;
            else if (["черное", "черный", "чр"].includes(choice) && !redNumbers.includes(res)) isWin = true;
            else if (["чет", "четное"].includes(choice) && res % 2 === 0) isWin = true;
            else if (["нечет", "нечетное"].includes(choice) && res % 2 !== 0) isWin = true;

            if (isWin) await updateBalance(userId, bet);
            else await updateBalance(userId, -bet);

            return await message.reply(`🎰 Выпало: ${res} (${cName})\n\n` + (isWin ? `✅ Выигрыш: +${formatMoney(bet)}$` : `😔 Проигрыш: -${formatMoney(bet)}$`) + `\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, replyParams());
        }

        if (cmdWord === 'фортуна') {
            const currentTime = Math.floor(Date.now() / 1000);
            const lastUse = (await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]))?.last_used || 0;
            if (currentTime - lastUse < 600) return await message.reply(`⏳ Фортуна через ${Math.floor((600 - (currentTime - lastUse)) / 60)} мин.`, replyParams());
            if (balance < 100) return await message.reply("❌ У вас недостаточно монеток (нужно 100$).");
            await updateBalance(userId, -100);
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), currentTime]);
            const prize = [0, 50, 100, 200, 500, 1000, 5000][Math.floor(Math.random() * 7)];
            await updateBalance(userId, prize);
            return await message.reply(`🎰 Выпало: ${formatMoney(prize)}$!`, replyParams());
        }

        if (cmdWord === 'мины') {
            let bet = parseAmount(parts[1]) || 100;
            if (bet === 'ALL') bet = balance;
            if (bet < 100) return await message.reply("❌ Мин. ставка 100$.");
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
            return await message.reply(`💣 Мины\nСтавка: ${bet}$\n\nВыберите кол-во мин:`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (!message.hasReplyMessage) return await message.reply("❌ Формат: transfer [сумма] (ответом)", replyParams());
            const amount = parseAmount(parts[1]);
            if (!amount || amount === 'ALL' || amount < 50) return await message.reply("❌ Сумма от 50$", replyParams());
            if (amount > balance) return await message.reply("❌ У вас недостаточно монеток");
            await updateBalance(userId, -amount); await updateBalance(message.replyMessage.senderId, amount);
            return await message.reply(`💸 Переведено ${formatMoney(amount)}$ игроку ${await getFullName(message.replyMessage.senderId)}.`, replyParams());
        }

        if (cmdWord === 'duel') {
            const bet = parseAmount(parts[1]);
            if (!bet || bet === 'ALL' || bet < 50) return await message.reply("❌ Ставка от 50$", replyParams());
            if (bet > balance) return await message.reply("❌ У вас недостаточно монеток");
            const duelId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
            return await message.reply(`⚔️ Дуэль!\n👤 Создатель: ${await getFullName(userId)}\n💰 Ставка: ${bet}$\n\n⚡ Нажми кнопку!`, replyParams(Keyboard.builder().inline().callbackButton({label:'Принять', payload:{cmd:'duel_accept', duel_id:duelId}, color:Keyboard.POSITIVE_COLOR}).toString()));
        }

        // ================= АДМИНСКИЕ КОМАНДЫ =================
        if (hasAdminAccess) {
            if (cmdWord === 'cl') {
                const targetQuery = parts.slice(1).join(' ').trim().toLowerCase();
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, special_case = 0");
                    return await message.reply("💥 ПОЛНЫЙ СБРОС ВСЕХ ИГРОКОВ ВЫПОЛНЕН!");
                }
                const { targetId } = await getTargetAndReason(message, 'cl');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя или 'all'.");
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, special_case = 0 WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`💥 Полный сброс игрока ${await getFullName(targetId)} выполнен!`);
            }
            if (cmdWord === 'снятьпред') {
                const { targetId } = await getTargetAndReason(message, 'снятьпред');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM warnings WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ С игрока ${await getFullName(targetId)} сняты предупреждения.`);
            }
            if (cmdWord === 'объявление') {
                const txt = text.replace(/объявление\s*/i, '');
                if (!txt) return await message.reply("❌ Введите текст.");
                const allUsers = await dbAll("SELECT user_id FROM users");
                const allChats = await dbAll("SELECT DISTINCT peer_id FROM chat_messages WHERE peer_id > 2000000000");
                for (const u of allUsers) { try { await vk.api.messages.send({ peer_id: u.user_id, message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, random_id: 0 }); } catch(e) {} }
                for (const c of allChats) { try { await vk.api.messages.send({ peer_id: c.peer_id, message: `📢 ОБЪЯВЛЕНИЕ:\n${txt}`, random_id: 0 }); } catch(e) {} }
                return await message.reply(`✅ Объявление разослано.`);
            }
            if (cmdWord === 'pr') {
                const { targetId } = await getTargetAndReason(message, 'pr');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                return await message.reply(`💳 У игрока ${await getFullName(targetId)} на балансе: ${formatShortMoney(await getBalance(targetId))}$`);
            }
            if (cmdWord === 'заморозить') {
                const { targetId } = await getTargetAndReason(message, 'заморозить');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]);
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} заморожен.`);
            }
            if (cmdWord === 'разморозить' || cmdWord === 'unfreeze') {
                const { targetId } = await getTargetAndReason(message, 'разморозить');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ Игрок ${await getFullName(targetId)} разморожен.`);
            }
            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                const { targetId } = await getTargetAndReason(message, cmdWord);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'none', for: 0 }); } catch(e) {}
                return await message.reply(`✅ С игрока ${await getFullName(targetId)} снят мут.`);
            }
            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                const { targetId } = await getTargetAndReason(message, cmdWord);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                await dbRun("DELETE FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]);
                return await message.reply(`✅ ${await getFullName(message.senderId)} разбанил(-а) пользователя ${await getFullName(targetId)}.`);
            }
            if (cmdWord === 'kl') {
                const { targetId } = await getTargetAndReason(message, 'kl');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, special_case = 0 WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`💥 Игрок ${await getFullName(targetId)} полностью сброшен!`);
            }
            if (cmdWord === 'mute') {
                let targetId = message.hasReplyMessage ? message.replyMessage.senderId : null;
                if (!targetId) { const { targetId: tId } = await getTargetAndReason(message, 'mute'); targetId = tId; }
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                const muteUntil = Date.now() + (10 * 60 * 1000);
                await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(targetId), String(peerId), muteUntil, 'Мут']);
                try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: targetId, action: 'ro', for: 600 }); } catch(e) {}
                return await message.reply(`🚫 ${await getFullName(targetId)} получил мут на 10 минут.`);
            }
            if (cmdWord === 'бан' || cmdWord === 'ban' || cmdWord === 'kick') {
                const { targetId, reason } = await getTargetAndReason(message, cmdWord);
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(targetId), String(peerId), reason]);
                try { await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: targetId, group_id: GROUP_ID }); } catch(e) {}
                return await message.reply(`🚫 ${await getFullName(message.senderId)} исключил(-а) ${await getFullName(targetId)}. Причина: ${reason}`);
            }
            if (cmdWord === 'чсб') {
                const { targetId, reason } = await getTargetAndReason(message, 'чсб');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                let days = 0; let finalReason = reason;
                const partsReason = reason.split(' ');
                if (partsReason.length > 1 && !isNaN(parseInt(partsReason[0]))) { days = parseInt(partsReason[0]); finalReason = partsReason.slice(1).join(' '); }
                let until = days > 0 ? Date.now() + days * 86400000 : 0;
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), finalReason, until]);
                return await message.reply(`😈 ${await getFullName(message.senderId)} занес(-ла) в ЧС ${await getFullName(targetId)} ${days > 0 ? `на ${days} дн.` : 'навсегда'}.`);
            }
            if (cmdWord === 'разчсб') {
                const { targetId } = await getTargetAndReason(message, 'разчсб');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`✅ ${await getFullName(message.senderId)} разбанил(-а) в ЧС ${await getFullName(targetId)}.`);
            }
            if (cmdWord === 'выдать') {
                if (parts[1] === 'кейс' && parts[2] === 'особый') {
                    const { targetId } = await getTargetAndReason(message, 'выдать кейс особый');
                    if (!targetId) return await message.reply("Укажите пользователя.");
                    await dbRun("UPDATE users SET special_case = 1 WHERE user_id = ?", [String(targetId)]);
                    return await message.reply(`✅ Особый кейс выдан ${await getFullName(targetId)}.`);
                }
                const args = message.text.split(' '); args.shift(); 
                let amount = 0; let remainingArgs = [];
                for (const arg of args) { const parsed = parseAmount(arg); if (parsed > 0 && parsed !== 'ALL') amount = parsed; else remainingArgs.push(arg); }
                if (amount <= 0) return await message.reply("❌ Укажите сумму.");
                const targetQuery = remainingArgs.join(' ').trim().toLowerCase();
                if (targetQuery === 'all' || targetQuery === 'все') {
                    await dbRun("UPDATE users SET balance = balance + ?", [amount]);
                    return await message.reply(`💰 Выдано всем по ${formatMoney(amount)}$!`);
                }
                const { targetId } = await getTargetAndReason(message, 'выдать');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя.");
                await updateBalance(targetId, amount);
                return await message.reply(`💰 Выдано ${formatMoney(amount)}$ игроку ${await getFullName(targetId)}!`);
            }
            if (cmdWord === 'обнулить') {
                const targetQuery = parts.slice(1).join(' ').trim().toLowerCase();
                if (targetQuery === 'all') {
                    await dbRun("UPDATE users SET balance = 0"); return await message.reply("💥 Балансы всех обнулены!");
                }
                const { targetId } = await getTargetAndReason(message, 'обнулить');
                if (!targetId) return await message.reply("⚠️ Укажите пользователя или all.");
                await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]);
                return await message.reply(`💥 Баланс ${await getFullName(targetId)} обнулен!`);
            }
            if (cmdWord === 'cc') { await dbRun("DELETE FROM promos"); return await message.reply("✅ Промокоды удалены."); }
            if (cmdWord === 'создать') {
                if (parts.length === 4) {
                    await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], parseAmount(parts[2]), parseAmount(parts[3])]);
                    return await message.reply(`✅ Промокод \`${parts[1]}\` создан!`);
                }
                return await message.reply("❌ Формат: /создать [код] [сумма] [лимит]");
            }
        }

        // Промокоды
        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (rows.length === 0) return await message.reply("❌ Промокодов нет.");
            let list = "🎁 Активные промокоды:\n\n";
            for (const r of rows) list += `▪️ \`${r.code}\` — ${formatMoney(r.amount)}$ (${r.used_by ? r.used_by.split(',').length : 0}/${r.limit_count})\n`;
            return await message.reply(list);
        }

        if (cmdWord === 'promo') {
            if (parts.length === 2) {
                const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
                if (!row) return await message.reply("❌ Промокод не существует.");
                const usedBy = row.used_by ? row.used_by.split(",") : [];
                if (usedBy.length >= row.limit_count) { await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]); return await message.reply("❌ Исчерпан."); }
                if (usedBy.includes(String(userId))) return await message.reply("❌ Вы уже активировали.");
                usedBy.push(String(userId)); await updateBalance(userId, row.amount);
                if (usedBy.length >= row.limit_count) { await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]); return await message.reply(`✅ +${row.amount}$\n⚠️ Промокод удален.`); }
                else { await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [usedBy.join(","), parts[1]]); return await message.reply(`✅ +${row.amount}$\nОсталось: ${row.limit_count - usedBy.length}`); }
            } else return await message.reply("❌ Формат: /promo [код]");
        }

    } catch (error) {
        console.error("ОШИБКА:", error);
        try { await message.reply(`⚠️ Ошибка: ${error.message}`); } catch (e) {}
    }
});

// ===== CALLBACK ОБРАБОТКА =====
vk.updates.on('message_event', async (context) => {
    let answered = false;
    const safeAnswer = async (params) => { if (!answered) { answered = true; await context.answer(params).catch(() => {}); } };
    try {
        const payload = context.eventPayload;
        const userId = context.userId;
        const peerId = context.peerId;

        if (payload.cmd === 'set_role') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет прав.' });
            await dbRun("REPLACE INTO staff (user_id, role) VALUES (?, ?)", [String(payload.target), payload.role]);
            await safeAnswer({ type: 'show_snackbar', text: 'Роль выдана!' });
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Пользователю [id${payload.target}|Игрок] выдана роль: ${payload.role}`, keyboard: "", conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'main_menu') {
            await safeAnswer();
            if (payload.action === 'work') return await vk.api.messages.send({ peer_id: peerId, message: "💼 Выберите работу:", keyboard: getWorkKb(), random_id: 0 });
            if (payload.action === 'roulette') return await vk.api.messages.send({ peer_id: peerId, message: "🎰 рулетка [цвет] [ставка]", random_id: 0 });
            if (payload.action === 'profile') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите профиль", random_id: 0 });
            if (payload.action === 'top') return await vk.api.messages.send({ peer_id: peerId, message: "Напишите топ", random_id: 0 });
        }

        if (payload.cmd === 'report_reply' || payload.cmd === 'report_rate_start') {
            await safeAnswer();
            if (payload.cmd === 'report_reply') adminStates.set(ADMIN_ID, `reply_${payload.report_id}`);
            else adminStates.set(userId, `rating_${payload.report_id}`);
            return await vk.api.messages.send({ peer_id: peerId, message: "✍️ Напишите ответ/оценку (1-10):", random_id: 0 });
        }

        if (payload.cmd === 'biz_withdraw' || payload.cmd === 'biz_upgrade' || payload.cmd === 'biz_sell') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню.' });
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет бизнеса.' });
            
            if (payload.cmd === 'biz_withdraw') {
                const now = Date.now();
                if (now - biz.last_withdraw < 3600000) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите.` });
                const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
                const total = Number(biz.balance) + Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
                await updateBalance(userId, total);
                await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ?", [now, now, String(userId)]);
                await safeAnswer({ type: 'show_snackbar', text: `✅ Выведено ${formatMoney(total)}$!` });
                return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Выведено: ${formatMoney(total)}$`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
            }
            if (payload.cmd === 'biz_upgrade') {
                if (biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Макс уровень.' });
                const cost = biz.level * 5000000;
                if (await getBalance(userId) < cost) return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег.' });
                await updateBalance(userId, -cost);
                await dbRun("UPDATE businesses SET level = level + 1 WHERE user_id = ?", [String(userId)]);
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Уровень повышен! Теперь ${biz.level + 1}/5`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
            }
            if (payload.cmd === 'biz_sell') {
                await updateBalance(userId, 10000000);
                await dbRun("DELETE FROM businesses WHERE user_id = ?", [String(userId)]);
                await safeAnswer({ type: 'show_snackbar', text: '🔥 Слито! +10кк' });
                return await vk.api.messages.edit({ peer_id: peerId, message: `🔥 Вы слили бизнес за 10,000,000$!`, keyboard: "", conversation_message_id: context.conversationMessageId });
            }
        }

        if (payload.cmd === 'work_do') {
            const now = Date.now();
            const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let count = workRow ? Number(workRow.count) : 0;
            let lastReset = workRow ? Number(workRow.last_reset) : 0;
            if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
            if (count >= 3) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Лимит работ (3/ч).` });
            if (payload.type === 'Такси') {
                const u = await dbGet("SELECT cars FROM users WHERE user_id = ?", [String(userId)]);
                if (JSON.parse(u?.cars || '[]').length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нужна машина.' });
            }
            await safeAnswer();
            count++; await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count, lastReset]);
            const earned = Math.floor(Math.random() * 6000) + 1000;
            await updateBalance(userId, earned);
            return await vk.api.messages.edit({ peer_id: peerId, message: `✅ Работа (${payload.type}): +${formatMoney(earned)}$\nОсталось: ${3-count}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'top_menu' || payload.cmd === 'top_back') {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Чужое меню!' });
            const type = payload.type || 'msgs';
            const scope = payload.scope || 'chat';
            const repType = payload.repType || 'pos';
            const levelFilter = payload.levelFilter || 'all';
            
            let orderBy = "balance DESC", filter = "balance > 0";
            if (type === 'level') {
                orderBy = "level DESC, xp DESC";
                if (levelFilter === 'bronze') filter = "level BETWEEN 1 AND 20";
                else if (levelFilter === 'silver') filter = "level BETWEEN 21 AND 40";
                else if (levelFilter === 'gold') filter = "level BETWEEN 41 AND 60";
                else if (levelFilter === 'platinum') filter = "level BETWEEN 61 AND 80";
                else if (levelFilter === 'diamond') filter = "level BETWEEN 81 AND 99";
                else if (levelFilter === 'legend') filter = "level >= 100";
                else filter = "level > 0";
            }
            if (type === 'duels') orderBy = "duel_wins DESC";
            if (type === 'bonus') orderBy = "bonus_count DESC";
            if (type === 'rep') { orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; }

            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общее' : 'В беседе'})\n\n`;
            let count = 0; const emojis = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
            
            if (type === 'msgs') {
                let rows = [];
                if (scope === 'global') rows = await dbAll(`SELECT user_id, SUM(count) as count FROM chat_messages GROUP BY user_id ORDER BY count DESC LIMIT 10`);
                else rows = await dbAll(`SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10`, [String(context.peerId)]);
                for (const r of rows) { title += `${emojis[count]} ${await getFullName(r.user_id)} — ${r.count} сообщ.\n`; count++; }
            } else {
                let rows = [];
                if (scope === 'global') rows = await dbAll(`SELECT user_id, balance, level, reputation, duel_wins, bonus_count FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
                else rows = await dbAll(`SELECT u.user_id, u.balance, u.level, u.reputation, u.duel_wins, u.bonus_count FROM users u INNER JOIN chat_messages c ON u.user_id = c.user_id WHERE c.peer_id = ? AND ${filter} ORDER BY ${orderBy} LIMIT 10`, [String(context.peerId)]);
                for (const r of rows) {
                    let val = "0";
                    if (type === 'coins') val = formatShortMoney(r.balance) + '$';
                    else if (type === 'level') val = `Ур.${r.level}`;
                    else if (type === 'duels') val = r.duel_wins || 0;
                    else if (type === 'bonus') val = r.bonus_count || 0;
                    else if (type === 'rep') val = r.reputation || 0;
                    title += `${emojis[count]} ${await getFullName(r.user_id)} — ${val}\n`; count++;
                }
            }
            if (count === 0) title += "Пусто...";
            await safeAnswer();
            return await vk.api.messages.edit({ peer_id: peerId, message: title, keyboard: getTopKb(payload.author, type, scope, repType, levelFilter), conversation_message_id: context.conversationMessageId });
        }

        if (payload.cmd === 'duel_accept') {
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            if (row) {
                if (String(userId) === row.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ С собой нельзя!' });
                if (await getBalance(userId) < row.bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег!' });
                const winnerId = Math.random() < 0.5 ? parseInt(row.challenger) : userId;
                const loserId = winnerId === userId ? parseInt(row.challenger) : userId;
                const prize = Math.floor(row.bet * 1.8);
                await updateBalance(winnerId, prize); await updateBalance(loserId, -row.bet);
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(winnerId)]);
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: `⚔️ Победа: ${await getFullName(winnerId)}\nПроигрыш: ${await getFullName(loserId)}\n💰 ${prize}$`, keyboard: "", disable_mentions: 1, conversation_message_id: context.conversationMessageId });
            }
        }

        if (payload.cmd === 'mines_set' || payload.cmd === 'mines_click' || payload.cmd === 'mines_cashout') {
            const gameId = String(payload.gameId);
            const row = await dbGet("SELECT * FROM games WHERE game_id = ? AND user_id = ?", [gameId, String(userId)]);
            if (!row) return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра устарела.' });
            
            if (payload.cmd === 'mines_set') {
                const minesArr = [];
                while(minesArr.length < Number(payload.count)) { const r = Math.floor(Math.random() * 9) + 1; if (!minesArr.includes(r)) minesArr.push(r); }
                await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0 WHERE game_id = ?", [JSON.stringify(minesArr), gameId]);
                const ui = getMinesGameUI(gameId, row.bet, Number(payload.count), minesArr, [], false, null, await getFullName(userId), await getBalance(userId), 0);
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
            if (payload.cmd === 'mines_click') {
                const mines = JSON.parse(row.mines); const opened = JSON.parse(row.opened); const cell = Number(payload.cell);
                if (opened.includes(cell)) return;
                opened.push(cell); let isLoss = false, hitCell = null, currentMoney = 0;
                if (mines.includes(cell)) {
                    isLoss = true; hitCell = cell;
                    await updateBalance(userId, -row.bet);
                    await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                } else {
                    let mult = 1.0;
                    for (let i = 0; i < opened.length; i++) mult *= (9 - i) / (9 - mines.length - i);
                    mult = Math.round(mult * 0.95 * 100) / 100;
                    currentMoney = Math.floor(row.bet * mult);
                    if (opened.length === (9 - mines.length)) {
                        await updateBalance(userId, currentMoney);
                        await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                        isLoss = true; hitCell = -1;
                    } else await dbRun("UPDATE games SET opened = ?, multiplier = ? WHERE game_id = ?", [JSON.stringify(opened), mult, gameId]);
                }
                const balance = await getBalance(userId); const name = await getFullName(userId);
                await safeAnswer();
                if (isLoss) {
                    const ui = getMinesGameUI(gameId, row.bet, mines.length, mines, opened, true, hitCell, name, balance);
                    return await vk.api.messages.edit({ peer_id: peerId, message: hitCell === -1 ? `🏆 ПОБЕДА!\n+${currentMoney}$` : ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
                } else {
                    const ui = getMinesGameUI(gameId, row.bet, mines.length, mines, opened, false, null, name, balance, 0);
                    return await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
                }
            }
            if (payload.cmd === 'mines_cashout') {
                const opened = JSON.parse(row.opened);
                if (opened.length === 0) return;
                const win = Math.floor(row.bet * row.multiplier);
                await updateBalance(userId, win);
                await dbRun("DELETE FROM games WHERE game_id = ?", [gameId]);
                await safeAnswer();
                return await vk.api.messages.edit({ peer_id: peerId, message: `💰 Забрано: ${win}$ (x${row.multiplier})\nБаланс: ${formatMoney(await getBalance(userId))}$`, keyboard: buildMinesKb(gameId, opened, JSON.parse(row.mines), true, null), conversation_message_id: context.conversationMessageId });
            }
        }
        await safeAnswer();
    } catch (e) {
        console.error("Callback Error:", e);
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка.' });
    }
});

// ===== ЗАПУСК =====
console.log("=========================================");
console.log("ЗАПУСК GAME ZONE BOT...");
console.log("=========================================");
vk.updates.startPolling().then(() => console.log("--- БОТ ЗАПУЩЕН ---")).catch(err => console.error("ОШИБКА СТАРТА:", err));