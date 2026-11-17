const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const https = require('https');

// ===== НАСТРОЙКИ (ЗАПОЛНИ СВОИМИ ДАННЫМИ) =====
const VK_TOKEN = 'vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0'; 
const GROUP_ID = 243089386; 
const ADMIN_ID = 200005093141; 

const MATH_CHAT_ID = 2000000011;
const DEFAULT_PROFILE_PHOTO = 'https://via.placeholder.com/400x450.png?text=No+Photo';

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
const adminStates = new Map();
const spamCache = new Map();
const chsbNotifyCache = new Map();
const activeMathGames = new Map();
const organizerStates = new Map();

// ===== ИНИЦИАЛИЗАЦИЯ ВК =====
const vk = new VK.Ballot({
    token: VK_TOKEN
});

// ===== ИНИЦИАЛИЗАЦИЯ БД (БЕЗ СЛОТОВ) =====
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.db');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

const dbGet = (sql, params) => new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) => new Promise((res, rej) => db.run(sql, params, (err) => err ? rej(err) : res()));

const formatMoney = (num) => new Intl.NumberFormat('ru-RU').format(Math.floor(num));
const parseAmount = (str) => { const n = parseFloat(str); return isNaN(n) ? 0 : n; };

async function getFullName(userId) {
    try {
        const users = await vk.api.users.get({ user_ids: userId });
        if (users && users[0]) return `${users[0].first_name} ${users[0].last_name || ''}`;
    } catch (e) {}
    return userId;
}

async function initDB() {
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        balance REAL DEFAULT 1000,
        reputation INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        phone TEXT DEFAULT 'Нет',
        skin TEXT DEFAULT 'Нет',
        country TEXT DEFAULT 'Нет',
        organization TEXT DEFAULT 'Нет',
        car TEXT DEFAULT 'Нет',
        reg_date TEXT,
        duel_wins INTEGER DEFAULT 0,
        bonus_count INTEGER DEFAULT 0,
        math_wins INTEGER DEFAULT 0,
        last_bonus_date TEXT,
        bonus_streak INTEGER DEFAULT 0
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        location TEXT,
        tier INTEGER,
        owner_id INTEGER
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        biz_name TEXT,
        level INTEGER DEFAULT 1,
        balance REAL DEFAULT 0,
        last_income INTEGER,
        last_withdraw INTEGER
    )`);

    await dbRun(`CREATE TABLE IF NOT EXISTS chat_messages (peer_id INTEGER, user_id INTEGER, count INTEGER, PRIMARY KEY (peer_id, user_id))`);
    await dbRun(`CREATE TABLE IF NOT EXISTS blacklist (user_id INTEGER PRIMARY KEY, reason TEXT, until INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS chat_bans (user_id INTEGER, peer_id INTEGER, reason TEXT, PRIMARY KEY (user_id, peer_id))`);
    await dbRun(`CREATE TABLE IF NOT EXISTS mutes (user_id INTEGER, peer_id INTEGER, mute_until INTEGER, reason TEXT, PRIMARY KEY (user_id, peer_id))`);
    await dbRun(`CREATE TABLE IF NOT EXISTS frozen (user_id INTEGER PRIMARY KEY)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS phones (number TEXT PRIMARY KEY, user_id INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS prop_deals (id INTEGER PRIMARY KEY, seller_id INTEGER, buyer_id INTEGER, type TEXT, prop_id INTEGER, price REAL, peer_id INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS games (game_id TEXT PRIMARY KEY, user_id INTEGER, bet REAL, mines TEXT, opened TEXT, multiplier REAL, msg_id INTEGER, start_time INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS active_duels (msg_id INTEGER PRIMARY KEY, challenger INTEGER, bet REAL, peer_id INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS work_cd (user_id INTEGER PRIMARY KEY, count INTEGER, last_reset INTEGER)`);
    await dbRun(`CREATE TABLE IF NOT EXISTS promos (code TEXT PRIMARY KEY, amount REAL, limit_count INTEGER, used_by TEXT)`);

    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_enabled', '1')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_limit', '5')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_time', '60')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_mute', '10')");
}

async function getBalance(userId) {
    const row = await dbGet("SELECT balance FROM users WHERE user_id = ?", [String(userId)]);
    return row ? row.balance : 0;
}

async function updateBalance(userId, amount) {
    await dbRun("UPDATE users SET balance = balance + ? WHERE user_id = ?", [amount, String(userId)]);
}

initDB().then(() => console.log("✅ БД готова")).catch(e => console.error("❌ Ошибка БД:", e));
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
});

// ===== ТАЙМЕР МАТЕМАТИКИ (КАЖДЫЕ 15 МИНУТ) =====
setInterval(async () => {
    try {
        if (!MATH_CHAT_ID || MATH_CHAT_ID === 2000000001) return; 
        
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
                    try { await vk.api.messages.delete({ peer_id: peerId, cmids: [message.conversationMessageId], delete_for_all: 1 }); } catch (e) {}
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

        // --- ВВОД ЗНАЧЕНИЙ ОТ АДМИНА ---
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            
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

        // --- ПРОФИЛЬ (Виртуальные слоты) ---
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const houses = await dbAll("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house'", [String(userId)]);
            const garages = await dbAll("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage'", [String(userId)]);
            const bizList = await dbAll("SELECT biz_name, level FROM businesses WHERE user_id = ?", [String(userId)]);
            
            // Нумерация по порядку (виртуальные слоты)
            const houseStr = houses.length > 0 ? houses.map((h, i) => `[${i+1}] ${h.location} (Т${h.tier})`).join('\n') : "Нет";
            const garageStr = garages.length > 0 ? garages.map((g, i) => `[${i+1}] ${g.location} (Т${g.tier})`).join('\n') : "Нет";
            const bizStr = bizList.length > 0 ? bizList.map((b, i) => `[${i+1}] ${b.biz_name} (Ур.${b.level})`).join('\n') : "Нет";

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
        return await message.reply('❌ Вы уже купили сим-карту.', replyParams());
    }
    const existing = await dbGet("SELECT user_id FROM phones WHERE number = ?", [phoneNumber]);
    if (existing) {
        return await message.reply('❌ Этот номер уже занят.', replyParams());
    }
    await dbRun("INSERT INTO phones (number, user_id) VALUES (?, ?)", [phoneNumber, String(userId)]);
    await dbRun("UPDATE users SET phone = ? WHERE user_id = ?", [phoneNumber, String(userId)]);
    return await message.reply(`✅ Вы успешно купили сим-карту с номером ${phoneNumber}!`, replyParams());
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
    if (!query) return await message.reply("❌ Укажите название машины. Список: /машины");

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

// ===== НЕДВИЖИМОСТЬ (Виртуальные слоты) =====
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

    // Проверка лимита (максимум 2 объекта в базе для этого пользователя)
    const userProps = await dbAll("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(userId), type]);
    if (userProps.length >= 2) {
        return await message.reply(`❌ У вас уже есть 2 ${typeName}(а)! Больше нельзя.`);
    }

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
    // Мы НЕ записываем slot в базу
    await dbRun("INSERT INTO properties (type, location, tier, owner_id) VALUES (?, ?, ?, ?)", [type, locName, tier, String(userId)]);
    return await message.reply(`🎉 Вы купили ${typeName} в ${locName} (Тир Т${tier}) за ${formatMoney(price)}$!`, replyParams());
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

    // Берем первый попавшийся объект игрока
    const myProp = await dbGet("SELECT id, location, tier FROM properties WHERE owner_id = ? AND type = ? LIMIT 1", [String(userId), type]);
    if (!myProp) return await message.reply(`❌ У вас нет ${typeName}.`);

    const buyerProps = await dbAll("SELECT id FROM properties WHERE owner_id = ? AND type = ?", [String(targetId), type]);
    if (buyerProps.length >= 2) return await message.reply(`❌ У покупателя уже 2 ${typeName}(а), он не может купить еще.`);

    const dealId = Math.floor(Math.random() * 90000) + 10000;
    await dbRun("INSERT INTO prop_deals (id, seller_id, buyer_id, type, prop_id, price, peer_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [dealId, String(userId), String(targetId), type, myProp.id, price, String(peerId)]);

    const dealKb = Keyboard.builder().inline().callbackButton({
        label: `✅ Принять (${formatMoney(price)}$)`,
        payload: { cmd: 'prop_deal_accept', deal_id: String(dealId) },
        color: Keyboard.POSITIVE_COLOR
    }).toString();

    return await message.reply(`🤝 Заявка на покупку!\n👤 Продавец: ${await getFullName(userId)}\n📦 ${typeName} в ${myProp.location} (Т${myProp.tier})\n💰 ${formatMoney(price)}$\n\n👉 ${await getFullName(targetId)}, нажмите кнопку.`, replyParams(dealKb));
}

// ===== БИЗНЕСЫ (Виртуальные слоты) =====
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

    // Проверка лимита (макс. 2 бизнеса)
    const userBizCount = await dbGet("SELECT COUNT(*) as c FROM businesses WHERE user_id = ?", [String(userId)]);
    if (userBizCount.c >= 2) return await message.reply("❌ У вас уже 2 бизнеса! Больше нельзя.");

    let selectedBiz = null;
    for (const [key, data] of Object.entries(BIZ_DATA)) {
        if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { selectedBiz = data; break; }
    }
    if (!selectedBiz) return await message.reply("❌ Такого бизнеса нет. Список: /бизнес");
    if (balance < selectedBiz.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selected_biz.price)}$`);

    await updateBalance(userId, -selectedBiz.price);
    // Мы НЕ записываем slot
    await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), selectedBiz.name, Date.now()]);
    return await message.reply(`🎉 Вы купили ${selectedBiz.name} за ${formatMoney(selectedBiz.price)}$. Пишите /мойбизнес для управления.`, replyParams());
}

if (cmdWord === 'мойбизнес') {
    const slot = parseInt(parts[1]) || 1; 
    const bizs = await dbAll("SELECT * FROM businesses WHERE user_id = ? ", [String(userId)]);
    const biz = bizs[slot - 1]; // Виртуальный индекс: первый найденный = слот 1

    if (!biz) return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);

    const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
    const timePassed = Date.now() - biz.last_income;
    const earned = Math.floor(timePassed * ((bizData.baseIncome * biz.level) / 180000));
    const totalBalance = Number(biz.balance) + earned;
    const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);

    const msgText = `🏢 Бизнес ${await getFullName(userId)} [№${slot}]\n${biz.biz_name}\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение: ${formatMoney(nextLevelCost)}$\n\n👉 Чтобы вывести: /вывести ${slot}`;
    return await message.reply(msgText, replyParams(getBizKb(userId)));
}

if (cmdWord === 'вывести') {
    const slot = parseInt(parts[1]) || 1;
    const bizs = await dbAll("SELECT * FROM businesses WHERE user_id = ? ", [String(userId)]);
    const biz = bizs[slot - 1];

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
    await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ?
                    await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ? AND biz_name = ?", [now, now, String(userId), biz.biz_name]);
    return await message.reply(`💸 Вы вывели ${formatMoney(totalBalance)}$ с бизнеса (№${slot})!`, replyParams());
}

if (cmdWord === 'закрыть' && parts[1] === 'бизнес') {
    const slot = parseInt(parts[2]) || 1;
    const bizs = await dbAll("SELECT * FROM businesses WHERE user_id = ?", [String(userId)]);
    const biz = bizs[slot - 1];
    if (!biz) return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);
    
    await dbRun("DELETE FROM businesses WHERE user_id = ? AND biz_name = ?", [String(userId), biz.biz_name]);
    await updateBalance(userId, 10000000);
    return await message.reply(`💀 Вы закрыли бизнес (№${slot}) и получили компенсацию 10,000,000$.`, replyParams());
}
// ===== СКИНЫ (ОДЕЖДА) =====
if (cmdWord === 'магазин' && parts[1] === 'скины') {
    let txt = "👕 МАГАЗИН ОДЕЖДЫ\n────────────────────\n\n";
    for (const [key, data] of Object.entries(SKIN_DATA)) {
        txt += `🔹 ${data.name} — ${formatMoney(data.price)}$\n`;
    }
    txt += "\n💡 Чтобы купить, напишите: /купить скин [Название]\nПример: /купить скин костюм джентльмена";
    return await message.reply(txt, replyParams());
}

if (cmdWord === 'купить' && parts[1] === 'скин') {
    const skinQuery = message.text.split(' ').slice(2).join(' ').toLowerCase().trim();
    if (!skinQuery) return await message.reply("❌ Укажите название скина. Список: /магазин скины");

    let selectedSkin = null;
    for (const [key, data] of Object.entries(SKIN_DATA)) {
        if (key.includes(skinQuery) || data.name.toLowerCase().includes(skinQuery)) {
            selectedSkin = data;
            break;
        }
    }

    if (!selectedSkin) return await message.reply("❌ Такого скина нет в наличии.");
    if (balance < selectedSkin.price) return await message.reply(`❌ Не хватает денег! Нужно ${formatMoney(selectedSkin.price)}$`);

    await updateBalance(userId, -selectedSkin.price);
    await dbRun("UPDATE users SET skin = ? WHERE user_id = ?", [selectedSkin.name, String(userId)]);
    return await message.reply(`✨ Поздравляем! Вы купили скин: ${selectedSkin.name}`, replyParams());
}

// ===== ОРГАНИЗАЦИИ =====
if (cmdWord === 'список' && parts[1] === 'организаций') {
    let txt = "🏢 СПИСОК ОРГАНИЗАЦИЙ\n────────────────────\n\n";
    for (const [key, data] of Object.entries(ORGANIZATIONS)) {
        txt += `🔹 ${data.name} (Лидер: ${data.leader || 'Не назначен'})\n`;
    }
    txt += "\n💡 Чтобы вступить, напишите: /вступить в организацию [Название]";
    return await message.reply(txt, replyParams());
}

if (cmdWord === 'вступить' && parts[1] === 'в' && parts[2]
// (Продолжение Части 6: Организации)
    const orgName = message.text.split(' ').slice(3).join(' ').toLowerCase().trim();
    if (!orgName) return await message.reply("❌ Укажите название организации. Список: /список организаций");

    let targetOrg = null;
    for (const key in ORGANIZATIONS) {
        if (ORGANIZATIONS[key].name.toLowerCase() === orgName) {
            targetOrg = ORGANIZATIONS[key];
            break;
        }
    }

    if (!targetOrg) return await message.reply("❌ Такой организации не существует.");
    
    const user = await dbGet("SELECT organization FROM users WHERE user_id = ?", [String(userId)]);
    if (user.organization && user.organization !== 'Нет') {
        return await message.reply(`❌ Вы уже состоите в организации: ${user.organization}`);
    }

    await dbRun("UPDATE users SET organization = ? WHERE user_id = ?", [targetOrg.name, String(userId)]);
    return await message.reply(`✅ Вы успешно вступили в организацию: ${targetOrg.name}!`, replyParams());
}

// ===== РЕПУТАЦИЯ =====
if (cmdWord === 'реп' || cmdWord === 'rep') {
    if (!message.hasReplyMessage) return await message.reply("❌ Ответьте этой командой на сообщение игрока. Пример: /реп +1", replyParams());
    
    const targetId = message.replyMessage.senderId;
    const targetName = await getFullName(targetId);
    const val = parseInt(parts[1]);

    if (isNaN(val) || Math.abs(val) > 10) return await message.reply("❌ Неверный формат. Используйте +1 или -1 (макс. 10).", replyParams());
    if (targetId === userId) return await message.reply("❌ Нельзя давать репутацию самому себе.");

    await dbRun("UPDATE users SET reputation = reputation + ? WHERE user_id = ?", [val, String(targetId)]);
    return await message.reply(`✅ Вы ${val > 0 ? '+' : ''}${val} репутации игроку ${targetName}!`, replyParams());
}

// ===== РАБОТА =====
if (cmdWord === 'работа' || cmdWord === 'work' || cmdWord === 'work_menu') {
    return await message.reply("💼 Выберите доступную работу:", replyParams(getWorkKb()));
}

if (cmdWord === 'work_do') {
    const jobType = parts[1];
    const now = Date.now();
    const workRow = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
    
    let count = workRow ? Number(workRow.count) : 0;
    let lastReset = workRow ? Number(workRow.last_reset) : 0;

    if (now - lastReset >= 3600000) { count = 0; lastReset = now; }
    if (count >= 3) return await message.reply(`⏳ Вы уже отработали сегодня. Отдохните!`, replyParams());

    // Проверка на такси
    if (jobType === 'Такси') {
        const userCar = await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)]);
        if (!userCar || !userCar.car) return await message.reply("❌ Для работы такси нужна машина! Список: /машины");
    }

    await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), count + 1, lastReset]);

    const isLucky = Math.random() > 0.3;
    if (isLucky) {
        const earn = 2000000;
        await updateBalance(userId, earn);
        return await message.reply(`✅ Вы успешно поработали (${jobType}) и заработали ${formatMoney(earn)}$!`, replyParams());
    } else {
        return await message.reply(`😢 Смена прошла неудачно. Вы ничего не заработали.`, replyParams());
    }
}

// ===== ИГРОВЫЕ МЕХАНИКИ (Первые) =====
if (cmdWord === 'рулетка' || cmdWord === 'roulette') {
    const bet = parseFloat(parts[2]);
    if (isNaN(bet) || bet < 100) return await message.reply("❌ Минимальная ставка: 100$. Пример: /рулетка красное 500");
    if (balance < bet) return await message.reply("❌ Недостаточно денег!");

    const color = parts[1]; // 'красное', 'черное', 'чет', 'нечет'
    const isRed = color === 'красное' || color === 'red';
    const isBlack = color === 'черное' || color === 'black';
    const isEven = color === 'чет' || color === 'even';
    const isOdd = color === 'нечет' || color === 'odd';

    const resultColor = Math.random() > 0.5 ? 'red' : 'black';
    const resultNumber = Math.floor(Math.random() * 37);
    const isEvenNum = resultNumber % 2 === 0;

    let win = false;
    if (isRed && resultColor === 'red') win = true;
    if (isBlack && resultColor === 'black') win = true;
    if (isEven && isEvenNum) win = true;
    if (isOdd && !isEvenNum) win = true;

    if (win) {
        const prize = Math.floor(bet * 2);
        await updateBalance(userId, prize - bet);
        return await message.reply(`🎰 Рулетка: ${resultNumber} (${resultColor === 'red' ? '🔴' : '⚫'})\n\n🎉 ВЫ ВЫИГРАЛИ! +${formatMoney(prize - bet)}$`, replyParams());
    } else {
        await updateBalance(userId, -bet);
        return await message.reply(`🎰 Рулетка: ${resultNumber} (${resultColor === 'red' ? '🔴' : '⚫'})\n\n💀 Проигрыш.`, replyParams());
    }
}

if (cmdWord === 'краш' || cmdWord === 'crash') {
    const bet = parseFloat(parts[2]);
    if (isNaN(bet) || bet < 100) return await message.reply("❌ Ставка от 100$. Пример: /краш 500");
    if (balance < bet) return await message.reply("❌ Недостаточно денег!");

    await updateBalance(userId, -bet);
    let multiplier = 1.0;
    const crashPoint = (Math.random() * 5 + 1).toFixed(2);

    // Имитация процесса (упрощенно для примера)
    // В реальном боте здесь нужен интервал и кнопки
    const win = Math.random() > 0.5; 
    if (win) {
        const finalMult = parseFloat(crashPoint);
        const winAmount = Math.floor(bet * finalMult);
        await updateBalance(userId, winAmount);
        return await message.reply(`🚀 КРАШ! График дошел до x${finalMult}\n\n💰 Вы забрали ${formatMoney(winAmount - bet)}$!`, replyParams());
    } else {
        return await message.reply(`💥 КРАШ! График остановился на x1.00.\n\n💀 Вы потеряли ставку.`, replyParams());
    }
}
// ===== БЛЭКДЖЕК =====
if (cmdWord === 'блэкджек' || cmdWord === 'blackjack') {
    const bet = parseFloat(parts[1]);
    if (isNaN(bet) || bet < 100) return await message.reply("❌ Ставка от 100$. Пример: /блэкджек 500", replyParams());
    if (balance < bet) return await message.reply("❌ Недостаточно денег!");

    await updateBalance(userId, -bet);
    const playerHand = Math.floor(Math.random() * 10) + 12; // Имитация руки
    const dealerHand = Math.floor(Math.random() * 10) + 12;

    if (playerHand > 21) {
        return await message.reply(`🃏 Блэкджек: Ваша рука ${playerHand}. Перебор!\n💀 Вы проиграли.`, replyParams());
    } else if (dealerHand > 21 || playerHand > dealerHand) {
        const win = Math.floor(bet * 1.5);
        await updateBalance(userId, win);
        return await message.reply(`🃏 Блэкджек: Вы (${playerHand}) обыграли дилера (${dealerHand})!\n💰 Выигрыш: +${formatMoney(win - bet)}$`, replyParams());
    } else {
        return await message.reply(`🃏 Блэкджек: Вы (${playerHand}), дилер (${dealerHand}).\n💀 Вы проиграли.`, replyParams());
    }
}

// ===== ДРИМ (DREAM) =====
if (cmdWord === 'дрим' || cmdWord === 'dream') {
    const number = parseInt(parts[1]);
    const bet = parseFloat(parts[2]);
    if (isNaN(number) || number < 1 || number > 5 || isNaN(bet) || bet < 100) {
        return await message.reply("❌ Неверный формат. Пример: /дрим 3 500 (число 1-5, ставка от 100)", replyParams());
    }
    if (balance < bet) return await message.reply("❌ Недостаточно денег!");

    await updateBalance(userId, -bet);
    const winNumber = Math.floor(Math.random() * 5) + 1;
    const multipliers = { 1: 2, 2: 2, 3: 3, 4: 4, 5: 5 };

    if (number === winNumber) {
        const winAmount = Math.floor(bet * multipliers[number]);
        await updateBalance(userId, winAmount);
        return await message.reply(`✨ ДРИМ: Вы угадали число ${winNumber}!\n💰 Ваш выигрыш: ${formatMoney(winAmount - bet)}$`, replyParams());
    } else {
        return await message.reply(`✨ ДРИМ: Выпало число ${winNumber}. Вы проиграли.`, replyParams());
    }
}

// ===== ПЕРЕВОД ДЕНЕГ =====
if (cmdWord === 'transfer' || cmdWord === 'перевод') {
    const targetIdStr = parts[1];
    const amount = parseFloat(parts[2]);
    if (!targetIdStr || isNaN(amount) || amount < 1) {
        return await message.reply("❌ Формат: /transfer [id] [сумма]. Пример: /transfer 12345 500", replyParams());
    }
    const targetId = parseInt(targetIdStr);
    if (targetId === userId) return await message.reply("❌ Нельзя переводить самому себе.");
    if (balance < amount) return await message.reply("❌ Недостаточно средств.");

    const targetExists = await dbGet("SELECT user_id FROM users WHERE user_id = ?", [String(targetId)]);
    if (!targetExists) return await message.reply("❌ Игрок не найден.");

    await updateBalance(userId, -amount);
    await updateBalance(targetId, amount);
    return await message.reply(`💸 Вы успешно перевели ${formatMoney(amount)}$ игроку [id${targetId}|${targetId}]!`, replyParams());
}

// ===== ДУЭЛИ (БИТВА ЗА ДЕНЬГИ) =====
if (cmdWord === 'duel' || cmdWord === 'дуэль') {
    const targetId = parseInt(parts[1]);
    const bet = parseFloat(parts[2]);
    if (isNaN(targetId) || isNaN(bet) || bet < 500) {
        return await message.reply("❌ Формат: /duel [id] [ставка]. Мин. ставка 500$.", replyParams());
    }
    if (balance < bet) return await message.reply("❌ Недостаточно средств!");

    const targetExists = await dbGet("SELECT user_id FROM users WHERE user_id = ?", [String(targetId)]);
    if (!targetExists) return await message.reply("❌ Игрок не найден.");
    if (targetId === userId) return await message.reply("❌ Нельзя вызвать самого себя.");

    // Создаем заявку на дуэль
    const duelId = Math.floor(Math.random() * 1000000);
    await dbRun("INSERT INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);

    const duelKb = Keyboard.builder().inline()
        .callbackButton({ label: '⚔️ Принять вызов', payload: { cmd: 'duel_accept', duel_id: String(duelId) }, color: Keyboard.POSITIVE_COLOR })
        .toString();

    return await message.reply(`⚔️ ВЫЗОВ НА ДУЭЛЬ!\n\n👤 Вызов от: [id${userId}|${userId}]\n💰 Ставка: ${formatMoney(bet)}$\n👤 Цель: [id${targetId}|${targetId}]\n\n👉 ${await getFullName(targetId)}, прими бой!', replyParams(duelKb));
}

// ===== БОНУС (ЕЖЕДНЕВНЫЙ) =====
if (cmdWord === 'бонус' || cmdWord === 'bonus') {
    const now = Date.now();
    const userBonus = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id = ?", [String(userId)]);
    
    let streak = userBonus ? Number(userBonus.bonus_streak) : 0;
    let lastDate = userBonus ? new Date(userBonus.last_bonus_date) : new Date(0);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const diff = now - lastDate.getTime();

    if (diff < oneDay) {
        const remaining = Math.ceil((oneDay - diff) / (60 * 60 * 1000));
        return await message.reply(`⏳ Вы уже забирали бонус! Приходите через ${remaining} ч.`, replyParams());
    }

    streak++;
    if (streak > 7) streak = 1; // Сброс серии после недели

    const bonusAmount = 50000 * streak;
    await updateBalance(userId, bonusAmount);
    await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ? WHERE user_id = ?", [new Date().toISOString(), streak, String(userId)]);

    return await message.reply(`🎁 ЕЖЕДНЕВНЫЙ БОНУС!\n\n💰 Вы получили: ${formatMoney(bonusAmount)}$\n🔥 Текущая серия: ${streak} дн.\n\nПриходите завтра!`, replyParams());
}
// ===== АДМИН-КОМАНДЫ =====
if (cmdWord === 'admin' && userId === ADMIN_ID) {
    let adminMenu = "🛠 АДМИН-ПАНЕЛЬ\n────────────────────\n\n";
    adminMenu += "🔹 /ban [id] [причина] - Забанить игрока\n";
    adminMenu += "🔹 /unban [id] - Разбанить игрока\n";
    adminMenu += "🔹 /give [id] [сумма] - Выдать деньги\n";
    adminMenu += "🔹 /take [id] [сумма] - Забрать деньги\n";
    adminMenu += "🔹 /mute [id] [мин] - Замутить игрока\n";
    adminMenu += "🔹 /unmute [id] - Размутить игрока\n";
    adminMenu += "🔹 /freeze [id] - Заморозить (ЧС)\n";
    adminMenu += "🔹 /unfreeze [id] - Разморозить\n";
    adminMenu += "🔹 /set_spam [вкл/выкл] - Антиспам\n";
    
    return await message.reply(adminMenu, replyParams());
}

// Обработка админских действий (упрощенный пример логики)
if (userId === ADMIN_ID) {
    if (cmdWord === 'ban') {
        const targetId = parseInt(parts[1]);
        const reason = parts.slice(2).join(' ') || 'Без причины';
        if (!targetId) return await message.reply("❌ Формат: /ban [id] [причина]");
        await dbRun("INSERT INTO blacklist (user_id, reason, until) VALUES (?, ?, 0)", [String(targetId), reason]);
        return await message.reply(`✅ Игрок [id${targetId}] забанен. Причина: ${reason}`, replyParams());
    }

    if (cmdWord === 'give') {
        const targetId = parseInt(parts[1]);
        const amount = parseFloat(parts[2]);
        if (!targetId || isNaN(amount)) return await message.reply("❌ Формат: /give [id] [сумма]");
        await updateBalance(targetId, amount);
        return await message.reply(`✅ Вы выдали ${formatMoney(amount)}$ игроку [id${targetId}]`, replyParams());
    }

    if (cmdWord === 'take') {
        const targetId = parseInt(parts[1]);
        const amount = parseFloat(parts[2]);
        if (!targetId || isNaN(amount)) return await message.reply("❌ Формат: /take [id] [сумма]");
        await updateBalance(targetId, -amount);
        return await message.reply(`✅ Вы забрали ${formatMoney(amount)}$ у игрока [id${targetId}]`, replyParams());
    }
    
    if (cmdWord === 'unban') {
        const targetId = parseInt(parts[1]);
        await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]);
        return await message.reply(`✅ Игрок [id${targetId}] разбанен.`, replyParams());
    }
}

// ===== ПРОМОКОДЫ =====
if (cmdWord === 'promo' || cmdWord === 'промо') {
    const code = parts[1];
    if (!code) return await message.reply("❌ Введите код. Пример: /promo SUMMER2025", replyParams());

    const promo = await dbGet("SELECT * FROM promos WHERE code = ?", [code]);
    if (!promo) return await message.reply("❌ Неверный промокод.", replyParams());

    // Проверка, использовал ли уже пользователь этот код
    const usedBy = promo.used_by ? promo.used_by.split(',') : [];
    if (usedBy.includes(String(userId))) {
        return await message.reply("❌ Вы уже использовали этот промокод.", replyParams());
    }

    // Проверка лимита использований
    if (promo.limit_count <= 0) {
        return await message.reply("❌ Лимит использований этого промокода исчерпан.", replyParams());
    }

    // Выдача награды
    await updateBalance(userId, promo.amount);
    
    // Обновление промокода
    const newUsedBy = [...usedBy, String(userId)].join(',');
    await dbRun("UPDATE promos SET limit_count = limit_count - 1, used_by = ? WHERE code = ?", [newUsedBy, code]);

    return await message.reply(`🎁 ПРОМОКОД АКТИВИРОВАН!\n\n💰 Вы получили: ${formatMoney(promo.amount)}$`, replyParams());
}

// ===== ТОП (Исправленный текстовый вариант) =====
if (cmdWord === 'top') {
    const type = parts[1] || 'coins'; // coins, level, rep, duels, bonus, math
    const scope = parts[2] === 'global' ? 'global' : 'chat';
    const repType = parts[3] === 'neg' ? 'neg' : 'pos';
    const author = userId;

    let orderBy = "balance DESC", filter = "balance > 0";
    
    if (type === 'rep') { 
        orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; 
        filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; 
    }
    else if (type === 'level') { orderBy = "level DESC, xp DESC"; filter = "level > 1"; }
    else if (type === 'duels') { orderBy = "duel_wins DESC"; filter = "duel_wins > 0"; }
    else if (type === 'bonus') { orderBy = "bonus_count DESC"; filter = "bonus_count > 0"; }
    else if (type === 'math') { orderBy = "math_wins DESC"; filter = "math_wins > 0"; }

    let rows = [];
    if (scope === 'global') {
        rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count, math_wins FROM users WHERE ${filter} ORDER BY ${orderBy} LIMIT 10`);
    } else {
        // Получаем список активных пользователей в этом чате (из таблицы сообщений)
        const chatUsers = await dbAll("SELECT user_id FROM chat_messages WHERE peer_id = ?", [String(peerId)]);
        if (chatUsers.length > 0) {
            const ids = chatUsers.map(u => `'${u.user_id}'`).join(',');
            rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count, math_wins FROM users WHERE user_id IN (${ids}) AND ${filter} ORDER BY ${orderBy} LIMIT 10`);
        }
    }

    if (rows.length === 0) return await message.reply("❌ Топ пуст.", replyParams());

    let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n`;
    if (type === 'coins') title += "💰 По монетам\n\n";
    if (type === 'level') title += "📊 По уровню\n\n";
    if (type === 'rep') title += `⭐ По репутации (${repType === 'pos' ? '+' : '-'})\n\n`;
    if (type === 'duels') title += "⚔️ По победам\n\n";
    if (type === 'bonus') title += "🎁 По бонусам\n\n";
    if (type === 'math') title += "🧮 По примерам\n\n";

    let topText = title;
    const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        let value = "";
        if (type === 'coins') value = `${formatMoney(r.balance)}$`;
        if (type === 'level') value = `Ур. ${r.level}`;
        if (type === 'rep') value = `${r.reputation > 0 ? '+' : ''}${r.reputation}`;
        if (type === 'duels') value = `${r.duel_wins} побед`;
        if (type === 'bonus') value = `${r.bonus_count} бонусов`;
        if (type === 'math') value = `${r.math_wins} решено`;
        
        // Пытаемся получить имя, если не выходит — просто ID
        let name = `[id${r.user_id}|${r.user_id}]`;
        try {
            const u = await vk.api.users.get({ user_ids: r.user_id });
            if (u && u[0]) name = `[id${u[0].id}|${u[0].first_name} ${u[0].last_name || ''}]`;
        } catch(e) {}

        topText += `${emojis[i]} ${name} — ${value}\n`;
    }

    return await message.reply(topText, replyParams(getTopKb(author, type, scope, repType)));
}

