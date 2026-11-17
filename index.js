const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

// ============================================================================
// БЛОК ИНИЦИАЛИЗАЦИИ И НАСТРОЕК БОТА
// ============================================================================

console.log("=========================================");
console.log("ЗАПУСК СИСТЕМЫ БОТА");
console.log("ВЕРСИЯ NODE.JS:", process.version);
console.log("=========================================");

// Основные настройки доступа
const TOKEN = "vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0";

// ID группы бота (для загрузки фото и т.д.)
const GROUP_ID = 243089386;

// ID главного владельца бота (имеет доступ к админ-командам)
const ADMIN_ID = 200005093141;

// Кулдауны
const BONUS_CD = 86400; // 24 часа в секундах
const FORTUNA_CD = 600; // 10 минут в секундах

// Изображение профиля по умолчанию
const DEFAULT_PROFILE_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95&as=32x22,48x34,72x50,108x76,160x112,240x168,277x194&from=bu&u=lu3E3ggWqF0yEAFf92En4aIiZtuv0TIPXL9GxEDIiJ4&cs=277x0';

// Изображения для рулетки
const ROULETTE_PHOTOS = [
    'https://vk.ru/photo-221392393_458171207'
];

// Создание экземпляра ВК
const vk = new VK({ 
    token: TOKEN, 
    apiVersion: '5.199',
    pollingGroupId: GROUP_ID 
});

// Папка для базы данных
const DATA_DIR = './data';

// Проверка существует ли папка, если нет - создаем
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Путь к файлу базы данных
const DB_FILE = path.join(DATA_DIR, 'game.db');

// ============================================================================
// БЛОК ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ SQLITE
// ============================================================================

const db = new sqlite3.Database(DB_FILE);

// Обертка для db.run (выполнение запросов без возврата данных)
const dbRun = (query, params = []) => {
    return new Promise((res, rej) => {
        db.run(query, params, function(e) {
            if (e) {
                rej(e);
            } else {
                res(this);
            }
        });
    });
};

// Обертка для db.get (получение одной строки)
const dbGet = (query, params = []) => {
    return new Promise((res, rej) => {
        db.get(query, params, (e, r) => {
            if (e) {
                rej(e);
            } else {
                res(r);
            }
        });
    });
};

// Обертка для db.all (получение всех строк)
const dbAll = (query, params = []) => {
    return new Promise((res, rej) => {
        db.all(query, params, (e, r) => {
            if (e) {
                rej(e);
            } else {
                res(r);
            }
        });
    });
};

// ============================================================================
// БЛОК КЕШЕЙ И ГЛОБАЛЬНЫХ ПЕРЕМЕННЫХ
// ============================================================================

const gameCooldowns = new Map(); 
const adminStates = new Map(); 
const spamCache = new Map(); 
const chsbNotifyCache = new Map(); 

// ============================================================================
// БЛОК КОНСТАНТ (ДАННЫЕ БИЗНЕСОВ, МАШИН, ДОМОВ, СКИНОВ, ОРГАНИЗАЦИЙ, СТРАН)
// ============================================================================

// Данные о бизнесах
const BIZ_DATA = {
    'шаурма': { 
        name: '🌯 Шаурма', 
        price: 500000, 
        baseIncome: 2000 
    },
    'кафе': { 
        name: '☕ Кафе', 
        price: 1500000, 
        baseIncome: 4000 
    },
    'game zone': { 
        name: '🕹️ Отдел Game Zone', 
        price: 5000000, 
        baseIncome: 6000 
    },
    'казино': { 
        name: '🎰 Казино', 
        price: 15000000, 
        baseIncome: 10000 
    },
    'пятерочка': { 
        name: '🏪 24/7 Пятёрочка', 
        price: 50000000, 
        baseIncome: 15000 
    },
    'транспортная': { 
        name: '🚚 Транспортная компания', 
        price: 100000000, 
        baseIncome: 30000 
    },
    'строительная': { 
        name: '🏗️ Строительная компания', 
        price: 250000000, 
        baseIncome: 60000 
    },
    'азс': { 
        name: '⛽ АЗС', 
        price: 500000000, 
        baseIncome: 120000 
    }
};

// Данные о машинах
const CARS_DATA = {
    'м5 ф90': { 
        name: 'BMW M5 F90', 
        price: 15000000, 
        sellPrice: 10000000 
    },
    'м5 ф10': { 
        name: 'BMW M5 F10', 
        price: 8000000, 
        sellPrice: 5000000 
    },
    'м3': { 
        name: 'BMW M3 G80', 
        price: 12000000, 
        sellPrice: 8000000 
    },
    'мерседес': { 
        name: 'Mercedes-Benz E-Class', 
        price: 10000000, 
        sellPrice: 6000000 
    },
    'ауди': { 
        name: 'Audi RS7', 
        price: 18000000, 
        sellPrice: 12000000 
    },
    'ламборгини': { 
        name: 'Lamborghini Huracan', 
        price: 35000000, 
        sellPrice: 25000000 
    },
    'порше': { 
        name: 'Porsche 911 Turbo', 
        price: 28000000, 
        sellPrice: 20000000 
    }
};

// Данные о недвижимости
const PROPERTY_DATA = {
    'нижегородская': { 
        name: 'Нижегородская', 
        housePrice: 5000000, 
        garagePrice: 1000000 
    },
    'рублевка': { 
        name: 'Рублевка', 
        housePrice: 25000000, 
        garagePrice: 5000000 
    },
    'егоровка': { 
        name: 'Егоровка', 
        housePrice: 50000000, 
        garagePrice: 10000000 
    },
    'гарель': { 
        name: 'Гарель', 
        housePrice: 100000000, 
        garagePrice: 20000000 
    }
};

// Данные о скинах (одежда)
const SKINS_DATA = {
    'кевин': { 
        name: '👕 Кевин', 
        price: 1000000 
    },
    'емеля': { 
        name: '🧥 Емеля', 
        price: 2500000 
    },
    'арни': { 
        name: '🕶️ Арни', 
        price: 5000000 
    },
    'бушидо': { 
        name: '🥋 Бушидо', 
        price: 10000000 
    },
    'аниме': { 
        name: '🌸 Аниме', 
        price: 15000000 
    }
};

// Данные об организациях
const ORGS_DATA = {
    'фсб': { 
        name: 'ФСБ', 
        limit: 5 
    },
    'правительство': { 
        name: 'Правительство', 
        limit: 3 
    },
    'умвд': { 
        name: 'УМВД', 
        limit: 10 
    },
    'гибдд': { 
        name: 'ГИБДД', 
        limit: 10 
    },
    'армия': { 
        name: 'Армия', 
        limit: 20 
    },
    'фсин': { 
        name: 'ФСИН', 
        limit: 10 
    }
};

// Список стран
const COUNTRIES_DATA = [
    'Россия', 
    'Чеченская Республика', 
    'Казахстан', 
    'Беларусь', 
    'Украина', 
    'США', 
    'Германия', 
    'Франция', 
    'Китай', 
    'Япония'
];

// ============================================================================
// БЛОК ИНИЦИАЛИЗАЦИИ БАЗЫ ДАННЫХ
// ============================================================================

async function initDB() {
    // Создание таблицы пользователей
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, 
            balance INTEGER DEFAULT 1000, 
            reputation INTEGER DEFAULT 0, 
            xp INTEGER DEFAULT 0, 
            level INTEGER DEFAULT 1, 
            reg_date TEXT, 
            duel_wins INTEGER DEFAULT 0, 
            bonus_count INTEGER DEFAULT 0
        )
    `);

    // Создание таблицы дуэлей
    await dbRun(`
        CREATE TABLE IF NOT EXISTS active_duels (
            msg_id TEXT PRIMARY KEY, 
            challenger TEXT, 
            bet INTEGER, 
            peer_id TEXT
        )
    `);

    // Создание таблицы кулдаунов бонуса
    await dbRun(`
        CREATE TABLE IF NOT EXISTS bonus_cd (
            user_id TEXT PRIMARY KEY, 
            last_used INTEGER
        )
    `);

    // Создание таблицы кулдаунов фортуны
    await dbRun(`
        CREATE TABLE IF NOT EXISTS fortune_cd (
            user_id TEXT PRIMARY KEY, 
            last_used INTEGER
        )
    `);

    // Создание таблицы промокодов
    await dbRun(`
        CREATE TABLE IF NOT EXISTS promos (
            code TEXT PRIMARY KEY, 
            amount INTEGER, 
            limit_count INTEGER, 
            used_by TEXT DEFAULT ''
        )
    `);

    // Создание таблицы игр (Мины)
    await dbRun(`
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY, 
            user_id TEXT, 
            bet INTEGER, 
            mines TEXT, 
            opened TEXT, 
            multiplier REAL, 
            msg_id TEXT, 
            start_time INTEGER
        )
    `);

    // Создание таблицы глобального ЧС
    await dbRun(`
        CREATE TABLE IF NOT EXISTS blacklist (
            user_id TEXT PRIMARY KEY, 
            reason TEXT, 
            until INTEGER DEFAULT 0
        )
    `);

    // Создание таблицы банов в беседах
    await dbRun(`
        CREATE TABLE IF NOT EXISTS chat_bans (
            user_id TEXT, 
            peer_id TEXT, 
            reason TEXT, 
            PRIMARY KEY (user_id, peer_id)
        )
    `);

    // Создание таблицы мутов
    await dbRun(`
        CREATE TABLE IF NOT EXISTS mutes (
            user_id TEXT, 
            peer_id TEXT, 
            mute_until INTEGER, 
            reason TEXT, 
            PRIMARY KEY (user_id, peer_id)
        )
    `);

    // Создание таблицы заморозки
    await dbRun(`
        CREATE TABLE IF NOT EXISTS frozen (
            user_id TEXT PRIMARY KEY
        )
    `);

    // Создание таблицы сделок с недвижимостью
    await dbRun(`
        CREATE TABLE IF NOT EXISTS prop_deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            seller_id TEXT, 
            buyer_id TEXT, 
            type TEXT, 
            prop_id INTEGER, 
            price INTEGER, 
            peer_id TEXT
        )
    `);

    // Создание таблицы статистики сообщений в беседах
    await dbRun(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            peer_id TEXT, 
            user_id TEXT, 
            count INTEGER DEFAULT 0, 
            PRIMARY KEY (peer_id, user_id)
        )
    `);

    // Создание таблицы бизнесов
    await dbRun(`
        CREATE TABLE IF NOT EXISTS businesses (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            user_id TEXT, 
            biz_name TEXT, 
            level INTEGER DEFAULT 1, 
            balance INTEGER DEFAULT 0, 
            last_income INTEGER, 
            last_withdraw INTEGER DEFAULT 0, 
            slot INTEGER
        )
    `);

    // Создание таблицы лимитов репутации
    await dbRun(`
        CREATE TABLE IF NOT EXISTS rep_limits (
            user_id TEXT PRIMARY KEY, 
            count INTEGER DEFAULT 0, 
            last_reset INTEGER
        )
    `);

    // Создание таблицы кулдаунов работы
    await dbRun(`
        CREATE TABLE IF NOT EXISTS work_cd (
            user_id TEXT PRIMARY KEY, 
            count INTEGER DEFAULT 0, 
            last_reset INTEGER
        )
    `);

    // Создание таблицы недвижимости
    await dbRun(`
        CREATE TABLE IF NOT EXISTS properties (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            type TEXT, 
            location TEXT, 
            tier INTEGER, 
            owner_id TEXT, 
            slot INTEGER
        )
    `);

    // Создание таблицы настроек
    await dbRun(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY, 
            value TEXT
        )
    `);

    // Создание таблицы телефонов
    await dbRun(`
        CREATE TABLE IF NOT EXISTS phones (
            number TEXT PRIMARY KEY, 
            user_id TEXT UNIQUE
        )
    `);

    // Создание таблицы репортов
    await dbRun(`
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            from_id TEXT, 
            chat_id TEXT, 
            text TEXT, 
            status TEXT DEFAULT 'new'
        )
    `);

    // Добавление недостающих колонок в таблицу users (для старых баз)
    try { await dbRun("ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN reg_date TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN duel_wins INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN bonus_count INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN car TEXT DEFAULT NULL"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN last_bonus_date TEXT"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN bonus_streak INTEGER DEFAULT 0"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT 'Нет'"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN skin TEXT DEFAULT 'Нет'"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN org TEXT DEFAULT 'Нет'"); } catch(e) {}
    try { await dbRun("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'Нет'"); } catch(e) {}
    
    // Добавление недостающих колонок в другие таблицы
    try { await dbRun("ALTER TABLE businesses ADD COLUMN slot INTEGER DEFAULT 1"); } catch(e) {}
    try { await dbRun("ALTER TABLE properties ADD COLUMN slot INTEGER DEFAULT 1"); } catch(e) {}
    
    // Настройки антиспама по умолчанию
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_enabled', '0')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_limit', '5')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_time', '60')");
    await dbRun("INSERT OR IGNORE INTO settings (key, value) VALUES ('antispam_mute', '10')");
    
    console.log("--- БАЗА ДАННЫХ ГОТОВА ---");
}

// Запускаем инициализацию
initDB();

// ============================================================================
// БЛОК ВСПОМОГАТЕЛЬНЫХ ФУНКЦИЙ (ПАРСЕРЫ, ФОРМАТТЕРЫ)
// ============================================================================

// Функция парсинга суммы (100к, 5кк, вб и т.д.)
function parseAmount(str) {
    if (!str) {
        return 0;
    }
    
    str = String(str).toLowerCase().replace(/\s/g, '');
    
    if (str.endsWith('всё') || str.endsWith('все') || str.endsWith('вб')) {
        return 'ALL'; 
    }
    
    let mult = 1;
    
    if (str.endsWith('кккк') || str.endsWith('kkkk')) { 
        mult = 1000000000000; 
        str = str.slice(0, -4); 
    } else if (str.endsWith('ккк') || str.endsWith('kkk')) { 
        mult = 1000000000; 
        str = str.slice(0, -3); 
    } else if (str.endsWith('кк') || str.endsWith('kk')) { 
        mult = 1000000; 
        str = str.slice(0, -2); 
    } else if (str.endsWith('к') || str.endsWith('k')) { 
        mult = 1000; 
        str = str.slice(0, -1); 
    } else if (str.endsWith('м') || str.endsWith('m')) { 
        mult = 1000000; 
        str = str.slice(0, -1); 
    }
    
    let num = parseFloat(str.replace(',', '.'));
    
    if (isNaN(num)) {
        return 0;
    }
    
    return Math.floor(num * mult);
}

// Функция форматирования денег (сокращенная)
function formatShortMoney(num) {
    if (num >= 1000000000000) {
        return (num / 1000000000000).toFixed(2).replace(/\.00$/, '') + 'кккк';
    }
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2).replace(/\.00$/, '') + 'ккк';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2).replace(/\.00$/, '') + 'кк';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(2).replace(/\.00$/, '') + 'к';
    }
    return num.toString();
}

// Функция получения баланса
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

// Функция обновления баланса
async function updateBalance(userId, amount) {
    const bal = await getBalance(userId);
    let amt = Number(amount);
    
    if (isNaN(amt) || !isFinite(amt)) {
        amt = 0;
    }
    
    let newBal = Math.floor(bal + amt);
    
    // Защита от отрицательного баланса
    if (newBal < 0) {
        newBal = 0;
    }
    
    await dbRun("UPDATE users SET balance = ? WHERE user_id = ?", [newBal, String(userId)]);
}

// Функция получения репутации
async function getReputation(userId) {
    const row = await dbGet("SELECT reputation FROM users WHERE user_id = ?", [String(userId)]);
    
    if (row) {
        return Number(row.reputation) || 0;
    }
    
    return 0;
}

// Функция обновления репутации
async function updateReputation(userId, amount) {
    const rep = await getReputation(userId);
    await dbRun("UPDATE users SET reputation = ? WHERE user_id = ?", [rep + amount, String(userId)]);
}

// Функция получения имени пользователя
async function getFullName(userId) {
    try {
        const [user] = await vk.api.users.get({ user_ids: userId });
        return `[id${userId}|${user.first_name} ${user.last_name || ''}]`;
    } catch (error) {
        return `[id${userId}|Игрок]`;
    }
}

// Функция форматирования денег (полная)
function formatMoney(num) { 
    let n = Number(num);
    
    if (isNaN(n) || !isFinite(n)) {
        n = 0;
    }
    
    return n.toLocaleString('ru-RU'); 
}

// Функция получения цели и причины (для админ-команд)
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
                        if (res.type === 'user' || res.type === 'group') {
                            targetId = res.object_id; 
                        }
                    } catch (e) {}
                    reason = reason.replace(urlMatch[0], ''); 
                } else {
                    const mentionMatch = reason.match(/@([a-zA-Z0-9._]+)/i);
                    
                    if (mentionMatch) {
                        try { 
                            const res = await vk.api.utils.resolveScreenName({ screen_name: mentionMatch[1] }); 
                            if (res.type === 'user') {
                                targetId = res.object_id; 
                            }
                        } catch (e) {}
                        reason = reason.replace(mentionMatch[0], ''); 
                    }
                }
            }
        }
    }
    
    reason = reason.replace(/[\[\]]/g, '').replace(/"/g, '').trim();
    
    if (!reason) {
        reason = "Не указано";
    }
    
    return { targetId, reason };
}

// ============================================================================
// БЛОК ГЕНЕРАЦИИ ИЗОБРАЖЕНИЙ
// ============================================================================

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
        
        // Используем встроенный шрифт, чтобы не было кракозябр
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        
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

// ============================================================================
// БЛОК ЛОГИКИ ИГРЫ "МИНЫ"
// ============================================================================

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
        const phrase = currentOpened === 0 ? "Выбирай клетку! Первый ход — самый волнующий 😈" : ["Чисто! Сапёр бы гордился 👏", "Ещё немного, и можно забирать 💸", "Осторожно, мины рядом... 💣", "Фортуна улыбается тебе 😉"][Math.floor(Math.random() * 4)];
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
                kb.callbackButton({ 
                    label: '💥', 
                    payload: { cmd: 'none' }, 
                    color: Keyboard.NEGATIVE_COLOR 
                });
            } else if (mines.includes(i)) {
                kb.callbackButton({ 
                    label: '💣', 
                    payload: { cmd: 'none' }, 
                    color: Keyboard.NEGATIVE_COLOR 
                });
            } else if (opened.includes(i)) {
                kb.callbackButton({ 
                    label: '✅', 
                    payload: { cmd: 'none' }, 
                    color: Keyboard.POSITIVE_COLOR 
                });
            } else {
                kb.callbackButton({ 
                    label: '⬜', 
                    payload: { cmd: 'none' }, 
                    color: Keyboard.SECONDARY_COLOR 
                });
            }
        } else {
            if (opened.includes(i)) {
                kb.callbackButton({ 
                    label: '✅', 
                    payload: { cmd: 'none' }, 
                    color: Keyboard.POSITIVE_COLOR 
                });
            } else {
                kb.callbackButton({ 
                    label: '❓', 
                    payload: { cmd: 'mines_click', gameId: String(gameId), cell: String(i) }, 
                    color: Keyboard.SECONDARY_COLOR 
                });
            }
        }
        
        if (i % 3 === 0) {
            kb.row();
        }
    }
    
    if (!isGameOver && currentMoney > 0 && opened.length > 0) {
        kb.callbackButton({ 
            label: `💰 Забрать ${currentMoney}`, 
            payload: { cmd: 'mines_cashout', gameId: String(gameId) }, 
            color: Keyboard.SECONDARY_COLOR 
        });
    }
    
    return kb.toString();
}

// ============================================================================
// БЛОК КЛАВИАТУР (ГЛАВНОЕ МЕНЮ, ИГРЫ, ТОПЫ И Т.Д.)
// ============================================================================

const mainKb = Keyboard.builder()
    .textButton({ 
        label: '💼 Работа', 
        payload: 'work', 
        color: Keyboard.POSITIVE_COLOR 
    })
    .textButton({ 
        label: '🎰 Рулетка', 
        payload: 'roulette', 
        color: Keyboard.PRIMARY_COLOR 
    })
    .row()
    .textButton({ 
        label: '👤 Профиль', 
        payload: 'profile', 
        color: Keyboard.SECONDARY_COLOR 
    })
    .textButton({ 
        label: '🏆 Топ', 
        payload: 'top', 
        color: Keyboard.SECONDARY_COLOR 
    });

const getWorkKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: '🎣 Рыбалка', 
            payload: { cmd: 'work_do', type: 'Рыбалка' }, 
            color: Keyboard.POSITIVE_COLOR 
        })
        .callbackButton({ 
            label: '🚕 Такси', 
            payload: { cmd: 'work_do', type: 'Такси' }, 
            color: Keyboard.POSITIVE_COLOR 
        })
        .callbackButton({ 
            label: '🔫 Охота', 
            payload: { cmd: 'work_do', type: 'Охота' }, 
            color: Keyboard.POSITIVE_COLOR 
        })
        .toString();
};

const getCasinoKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: 'Рулетка', 
            payload: { cmd: 'casino_info', game: 'roulette' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: 'Краш', 
            payload: { cmd: 'casino_info', game: 'crash' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: 'Монетка', 
            payload: { cmd: 'casino_info', game: 'coin' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: 'Стакан', 
            payload: { cmd: 'casino_info', game: 'glass' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: 'Кубик', 
            payload: { cmd: 'casino_info', game: 'dice' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: 'Автомат', 
            payload: { cmd: 'casino_info', game: 'slot' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: 'Блэкджек', 
            payload: { cmd: 'casino_info', game: 'blackjack' }, 
            color: Keyboard.NEGATIVE_COLOR 
        })
        .callbackButton({ 
            label: 'Дрим', 
            payload: { cmd: 'casino_info', game: 'dream' }, 
            color: Keyboard.NEGATIVE_COLOR 
        })
        .toString();
};

const getHelpKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: '🎰 Игры', 
            payload: { cmd: 'help_menu', section: 'games' }, 
            color: Keyboard.PRIMARY_COLOR 
        })
        .callbackButton({ 
            label: '💼 Экономика', 
            payload: { cmd: 'help_menu', section: 'eco' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: '🏠 Дома', 
            payload: { cmd: 'help_menu', section: 'houses' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: '🏘️ Гаражи', 
            payload: { cmd: 'help_menu', section: 'garages' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: '👤 Профиль', 
            payload: { cmd: 'help_menu', section: 'profile' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: '🏢 Организации', 
            payload: { cmd: 'help_menu', section: 'orgs' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .toString();
};

const getHelpBackKb = () => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: '🔙 Назад', 
            payload: { cmd: 'help_start' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .toString();
};

const getSettingsKb = async (enabled, limit, time, mute) => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: '🟢 Включить', 
            payload: { cmd: 'settings_toggle', state: '1' }, 
            color: enabled === '1' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: '🔴 Выключить', 
            payload: { cmd: 'settings_toggle', state: '0' }, 
            color: enabled === '0' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: `Лимит: ${limit}`, 
            payload: { cmd: 'settings_edit', field: 'limit' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .callbackButton({ 
            label: `Время (сек): ${time}`, 
            payload: { cmd: 'settings_edit', field: 'time' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .row()
        .callbackButton({ 
            label: `Мут (мин): ${mute}`, 
            payload: { cmd: 'settings_edit', field: 'mute' }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .toString();
};

const getDuelKb = (duelId) => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: '⚔️ Сразиться', 
            payload: { cmd: 'duel_accept', duel_id: duelId }, 
            color: Keyboard.POSITIVE_COLOR 
        })
        .toString();
};

const getMinesCountKb = (gameId) => {
    const kb = Keyboard.builder().inline();
    
    for (let i = 2; i <= 8; i++) {
        kb.callbackButton({ 
            label: `${i} 💣`, 
            payload: { cmd: 'mines_set', gameId: String(gameId), count: String(i) }, 
            color: Keyboard.SECONDARY_COLOR 
        });
        
        if (i === 4) {
            kb.row();
        }
    }
    
    return kb.toString();
};

// Обновленная клавиатура топа (как на скриншоте)
const getTopKb = (authorId, type = 'coins', scope = 'chat', repType = 'pos') => {
    const kb = Keyboard.builder().inline();
    
    kb.callbackButton({ 
        label: '✨ Лиги', 
        payload: { cmd: 'top_menu', type: 'level', scope, repType, author: authorId }, 
        color: type === 'level' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.callbackButton({ 
        label: '⚔️ Дуэли', 
        payload: { cmd: 'top_menu', type: 'duels', scope, repType, author: authorId }, 
        color: type === 'duels' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.row();

    kb.callbackButton({ 
        label: '🇮🇹 Репутация', 
        payload: { cmd: 'top_menu', type: 'rep', scope, repType, author: authorId }, 
        color: type === 'rep' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.callbackButton({ 
        label: '🎁 Бонус', 
        payload: { cmd: 'top_menu', type: 'bonus', scope, repType, author: authorId }, 
        color: type === 'bonus' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.row();

    kb.callbackButton({ 
        label: '🪙 Монетки', 
        payload: { cmd: 'top_menu', type: 'coins', scope, repType, author: authorId }, 
        color: type === 'coins' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.row();

    if (type === 'rep') {
        kb.callbackButton({ 
            label: '➕ Положит.', 
            payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'pos', author: authorId }, 
            color: repType === 'pos' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR 
        });
        
        kb.callbackButton({ 
            label: '➖ Отрицат.', 
            payload: { cmd: 'top_menu', type: 'rep', scope, repType: 'neg', author: authorId }, 
            color: repType === 'neg' ? Keyboard.NEGATIVE_COLOR : Keyboard.SECONDARY_COLOR 
        });
        
        kb.row();
    }

    kb.callbackButton({ 
        label: '🌍 Общее', 
        payload: { cmd: 'top_menu', type, scope: 'global', repType, author: authorId }, 
        color: scope === 'global' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.callbackButton({ 
        label: '💬 В беседе', 
        payload: { cmd: 'top_menu', type, scope: 'chat', repType, author: authorId }, 
        color: scope === 'chat' ? Keyboard.PRIMARY_COLOR : Keyboard.SECONDARY_COLOR 
    });
    
    kb.row();

    kb.callbackButton({ 
        label: '🔙 Назад', 
        payload: { cmd: 'top_back', author: authorId }, 
        color: Keyboard.SECONDARY_COLOR 
    });

    return kb.toString();
};

const getBizKb = (authorId, slot) => {
    return Keyboard.builder().inline()
        .callbackButton({ 
            label: 'Повысить уровень', 
            payload: { cmd: 'biz_upgrade', author: authorId, slot: slot }, 
            color: Keyboard.SECONDARY_COLOR 
        })
        .toString();
};

async function getRouletteAttachment() {
    if (ROULETTE_PHOTOS.length === 0) {
        return null;
    }
    
    const url = ROULETTE_PHOTOS[Math.floor(Math.random() * ROULETTE_PHOTOS.length)];
    
    try { 
        const uploaded = await vk.upload.messagePhoto({ source: { value: url } }); 
        return uploaded.toString(); 
    } catch (e) { 
        return null; 
    }
}

// ============================================================================
// БЛОК ОБРАБОТКИ СОБЫТИЙ (ПРИВЕТСТВИЕ, СООБЩЕНИЯ, КНОПКИ)
// ============================================================================

// Событие добавления пользователя в беседу
vk.updates.on('chat_invite_user', async (context) => {
    if (context.memberId > 0) {
        const globalBan = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
        
        if (globalBan) {
            if (globalBan.until !== 0 && Date.now() > globalBan.until) {
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(context.memberId)]);
            } else { 
                try { 
                    await vk.api.messages.removeChatUser({ 
                        chat_id: context.peerId - 2000000000, 
                        user_id: context.memberId, 
                        group_id: GROUP_ID 
                    }); 
                } catch(e) {} 
                return; 
            }
        }
        
        const chatBan = await dbGet("SELECT reason FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(context.memberId), String(context.peerId)]);
        
        if (chatBan) {
            try {
                await vk.api.messages.removeChatUser({ 
                    chat_id: context.peerId - 2000000000, 
                    user_id: context.memberId, 
                    group_id: GROUP_ID 
                });
                await vk.api.messages.send({ 
                    peer_id: context.peerId, 
                    message: `🚫 [id${context.memberId}|Игрок] исключен (бан в беседе).\n📌 Причина: ${chatBan.reason}`, 
                    random_id: Math.floor(Math.random() * 1000000000), 
                    disable_mentions: 1 
                });
            } catch(e) {} 
        }
    }
    
    if (String(context.memberId) === String(-GROUP_ID)) {
        const actKb = Keyboard.builder().inline()
            .callbackButton({ 
                label: 'Активировать', 
                payload: { cmd: 'activate_bot' }, 
                color: Keyboard.POSITIVE_COLOR 
            })
            .callbackButton({ 
                label: 'Не активировать', 
                payload: { cmd: 'decline_bot' }, 
                color: Keyboard.NEGATIVE_COLOR 
            });
            
        try { 
            await vk.api.messages.send({ 
                peer_id: context.peerId, 
                message: "Привет! Я бот. Владелец беседы или админ должен нажать кнопку ниже, чтобы включить меня.", 
                keyboard: actKb.toString(), 
                random_id: Math.floor(Math.random() * 1000000000), 
                group_id: GROUP_ID, 
                disable_mentions: 1 
            }); 
        } catch (err) {}
    }
}); 

// Событие нового сообщения
vk.updates.on('message_new', async (message) => {
    if (message.isOutbox || message.senderId < 0) {
        return;
    }

    try {
        const text = message.text ? message.text.trim().toLowerCase() : '';
        
        if (!text) {
            return;
        }

        const userId = message.senderId;
        const peerId = message.peerId;
        const isLs = peerId === userId;

        const cleanText = text.replace(/\//g, '').trim();
        const parts = cleanText.split(/\s+/);
        const cmdWord = parts[0];

        // Проверка на заморозку
        if (userId !== ADMIN_ID) {
            if (await dbGet("SELECT user_id FROM frozen WHERE user_id = ?", [String(userId)])) {
                return await message.reply("💀 Вы заморожены в боте.");
            }
        }

        // Проверка на глобальный ЧС
        if (userId !== ADMIN_ID) {
            const isBlacklisted = await dbGet("SELECT reason, until FROM blacklist WHERE user_id = ?", [String(userId)]);
            
            if (isBlacklisted) {
                if (isBlacklisted.until !== 0 && Date.now() > isBlacklisted.until) {
                    await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(userId)]);
                } else {
                    const cacheKey = `chsb_${userId}`;
                    
                    if (!chsbNotifyCache.has(cacheKey) || Date.now() - chsbNotifyCache.get(cacheKey) > 60000) {
                        chsbNotifyCache.set(cacheKey, Date.now());
                        const banKb = Keyboard.builder().inline().urlButton({ 
                            label: 'Разбан', 
                            url: `https://vk.ru/topic-243089386_69303056` 
                        });
                        
                        try { 
                            await vk.api.messages.send({ 
                                peer_id: peerId, 
                                message: `😈 Вы в глобальном ЧС. Причина: ${isBlacklisted.reason}`, 
                                keyboard: banKb.toString(), 
                                random_id: Math.floor(Math.random() * 1000000000) 
                            }); 
                        } catch(e) {}
                    }
                    return; 
                }
            }
        }

        // Проверка на мут и удаление сообщений
        if (message.isChat && userId !== ADMIN_ID) {
            const activeMute = await dbGet("SELECT mute_until FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
            
            if (activeMute) {
                if (Date.now() < activeMute.mute_until) { 
                    try { 
                        await vk.api.messages.delete({ 
                            message_ids: [message.id], 
                            delete_for_all: 1 
                        }); 
                    } catch(e) {} 
                    return; 
                } else {
                    await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(userId), String(peerId)]);
                }
            }
        }

        // Антиспам
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
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e) {} 
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
                    
                    try {
                        await vk.api.messages.changeConversationMemberRestrictions({ 
                            group_id: GROUP_ID, 
                            peer_id: peerId, 
                            member_id: userId, 
                            action: 'ro', 
                            for: muteMin * 60 
                        });
                        await message.reply(`🚫 [id${userId}|Игрок] заблокирован на ${muteMin} мин (антиспам).`);
                        spamData.count = 0;
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e) {}
                    } catch(e) { 
                        spamData.isMuted = false; 
                    }
                    spamCache.set(cacheKey, spamData);
                }
            }
        }

        // Обработка ввода настроек админом
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            const state = adminStates.get(userId);
            const val = parseFloat(cleanText);
            
            if (!isNaN(val) && val > 0) {
                await dbRun("UPDATE settings SET value = ? WHERE key = ?", [String(val), state]);
                adminStates.delete(userId);
                return await message.reply(`✅ Настройки сохранены!`);
            } else {
                return await message.reply("❌ Введите число > 0.");
            }
        }

        const validCmds = [
            'стакан', 'кубик', 'монетка', 'дрим', 'краш', 'рулетка', 'рул', 'автомат', 'блэкджек', 'мины', 
            'топ', 'профиль', 'баланс', 'бизнес', 'машины', 'работа', 'бонус', 'фортуна', 'казино', 'help', 
            'помощь', 'start', 'начать', 'transfer', 'перевод', 'duel', 'вывести', 'мойбизнес', 'закрыть', 
            'rep', 'реп', 'промолист', 'promo', 'купить', 'купитьбиз', 'чсб', 'разчсб', 'kick', 'выдать', 
            'обнулить', 'создать', 'cp', 'ping', 'пинг', 'убрать', 'настройки', 'дом', 'дома', 'гараж', 
            'гаражи', 'продать', 'бан', 'kl', 'mute', 'unmute', 'размут', 'unban', 'разбан', 'заморозить', 
            'разморозить', 'снять', 'unfreeze', 'pr', 'sellcar', 'слить', 'дон', 'дондом', 'донгараж', 
            'sellhome', 'restart', 'рестарт', 'gban', 'report', 'chatid', 'скины', 'магазин', 'надеть', 
            'организации', 'вступить', 'страны', 'страна'
        ];
        
        if (!text.startsWith('/') && !validCmds.includes(cmdWord)) {
            return; 
        }

        // Обновление уровней и XP
        let userRow = await dbGet("SELECT xp, level, reg_date, skin, org, country FROM users WHERE user_id = ?", [String(userId)]);
        
        if (!userRow) {
            await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), new Date().toLocaleDateString('ru-RU')]);
        } else {
            if (!userRow.reg_date) {
                await dbRun("UPDATE users SET reg_date = ? WHERE user_id = ?", [new Date().toLocaleDateString('ru-RU'), String(userId)]);
            }
            
            let newXp = (Number(userRow.xp) || 0) + 40;
            let newLvl = Number(userRow.level) || 1;
            
            while (newXp >= newLvl * 500) { 
                newXp -= newLvl * 500; 
                newLvl++; 
            }
            
            await dbRun("UPDATE users SET xp = ?, level = ? WHERE user_id = ?", [newXp, newLvl, String(userId)]);
        }

        // Статистика сообщений
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

        // ====================================================================
        // КОМАНДЫ СТАРТА И ПОМОЩИ
        // ====================================================================

        if (cmdWord === 'start' || cmdWord === 'начать') {
            if (message.isChat) {
                try {
                    const members = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                    
                    if (!members.items.find(m => m.member_id === userId && (m.is_admin || m.is_owner)) && userId !== ADMIN_ID) {
                        return await message.reply("⚠️ Вы не админ беседы.", replyParams());
                    }
                    
                    return await message.reply("✅ Бот активирован! Напишите /help.", replyParams());
                } catch(e) { 
                    return await message.reply("⚠️ Сделайте меня админом!", replyParams()); 
                }
            } else {
                return await message.reply("👋 Привет! Напиши /help.", replyParams(mainKb));
            }
        }

        if (cmdWord === 'help' || cmdWord === 'помощь' || cmdWord === 'команды') {
            return await message.reply("📖 Разделы:", replyParams(getHelpKb()));
        }

        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const start = Date.now(); 
            try { await vk.api.users.get({ user_ids: userId }); } catch (e) {}
            return await message.reply(`🏓 Понг! ${Date.now() - start} мс`, replyParams());
        }

        if (cmdWord === 'chatid') {
            return await message.reply(`🆔 ID этой беседы: ${peerId}`);
        }

        // ====================================================================
        // КОМАНДЫ ПРОФИЛЯ
        // ====================================================================

        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const uInfo = await dbGet("SELECT xp, level, reg_date, car, phone, skin, org, country FROM users WHERE user_id = ?", [String(userId)]);
            const houseData = await dbAll("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'house'", [String(userId)]);
            const garageData = await dbAll("SELECT location, tier FROM properties WHERE owner_id = ? AND type = 'garage'", [String(userId)]);
            const bizData = await dbAll("SELECT biz_name, level FROM businesses WHERE user_id = ?", [String(userId)]);
            
            let houseStr = houseData.length > 0 ? houseData.map(h => `${h.location} (Т${h.tier})`).join(', ') : "Нет";
            let garageStr = garageData.length > 0 ? garageData.map(g => `${g.location} (Т${g.tier})`).join(', ') : "Нет";
            let bizStr = bizData.length > 0 ? bizData.map(b => `${b.biz_name} (Ур.${b.level})`).join(', ') : "Нет";
            
            const profText = `🏠 Профиль ${await getFullName(userId)}\n\n💵 Баланс: ${formatMoney(balance)}$\n⭐ Репутация: ${rep}\n📊 Уровень: ${uInfo.level || 1} (${uInfo.xp || 0}/${(uInfo.level || 1) * 500} XP)\n📱 Телефон: ${uInfo.phone || 'Нет'}\n👕 Одежда: ${uInfo.skin || 'Нет'}\n🏛️ Организация: ${uInfo.org || 'Нет'}\n🌍 Страна: ${uInfo.country || 'Нет'}\n\n🏢 Бизнесы: ${bizStr}\n🏠 Дом: ${houseStr}\n🏘️ Гараж: ${garageStr}\n🚗 Машина: ${uInfo.car || "Нет"}\n\n📅 Регистрация: ${uInfo.reg_date || new Date().toLocaleDateString('ru-RU')}\n🆔 ID: ${userId}`;
            
            let attachment = null;
            
            try { 
                const photoBuffer = await generateProfileImage(userId); 
                if (photoBuffer) { 
                    const uploaded = await vk.upload.messagePhoto({ source: { value: photoBuffer } }); 
                    attachment = uploaded.toString(); 
                } 
            } catch(e) {}
            
            return await message.reply({ 
                message: profText, 
                attachment: attachment || undefined, 
                disable_mentions: 1 
            });
        }

        // ====================================================================
        // КОМАНДЫ СИМ-КАРТЫ
        // ====================================================================

        if (cmdWord === 'купить' && parts[1] === 'сим' && parts[2] === 'карту') {
            const phoneNumber = parts[3];
            
            if (!phoneNumber || !/^\d{4}$/.test(phoneNumber)) {
                return await message.reply('❌ Введите 4 цифры. Пример: /купить сим карту 7766');
            }
            
            const user = await dbGet("SELECT phone FROM users WHERE user_id = ?", [String(userId)]);
            
            if (user && user.phone && user.phone !== 'Нет') {
                return await message.reply('❌ У вас уже есть сим-карта.');
            }
            
            if (await dbGet("SELECT user_id FROM phones WHERE number = ?", [phoneNumber])) {
                return await message.reply('❌ Номер занят.');
            }
            
            await dbRun("INSERT INTO phones (number, user_id) VALUES (?, ?)", [phoneNumber, String(userId)]);
            await dbRun("UPDATE users SET phone = ? WHERE user_id = ?", [phoneNumber, String(userId)]);
            
            return await message.reply(`✅ Вы купили сим-карту ${phoneNumber}!`);
        }

        // ====================================================================
        // КОМАНДЫ РЕПОРТОВ
        // ====================================================================

        if (cmdWord === 'report') {
            const reportText = cleanText.replace('report', '').trim();
            
            if (!reportText) {
                return await message.reply("❌ Формат: /report текст");
            }
            
            const rId = Math.floor(Math.random() * 90000) + 10000;
            
            await dbRun("INSERT INTO reports (id, from_id, chat_id, text) VALUES (?, ?, ?, ?)", [rId, String(userId), String(peerId), reportText]);
            
            const kb = Keyboard.builder().inline()
                .callbackButton({ 
                    label: '🚫 Спам', 
                    payload: { cmd: 'report_spam', target: userId }, 
                    color: Keyboard.NEGATIVE_COLOR 
                })
                .callbackButton({ 
                    label: '✉️ Ответить', 
                    payload: { cmd: 'report_reply', target: userId, rId: rId }, 
                    color: Keyboard.PRIMARY_COLOR 
                });
                
            try { 
                await vk.api.messages.send({ 
                    peer_id: ADMIN_ID, 
                    message: `📩 Жалоба!\nОт: ${await getFullName(userId)}\nБеседа: ${peerId}\nТекст: ${reportText}`, 
                    keyboard: kb.toString(), 
                    random_id: Math.floor(Math.random() * 1000000000) 
                }); 
            } catch(e) {}
            
            return await message.reply("✅ Жалоба отправлена администратору.");
        }

        // ====================================================================
        // КОМАНДЫ СКИНОВ (ОДЕЖДЫ)
        // ====================================================================

        if (cmdWord === 'магазин' || cmdWord === 'скины') {
            let txt = "👕 Магазин одежды:\n\n";
            
            for (const [key, data] of Object.entries(SKINS_DATA)) {
                txt += `${data.name} — ${formatMoney(data.price)}$\n`;
            }
            
            txt += "\n🛒 /купить скин [название]";
            return await message.reply(txt);
        }

        if (cmdWord === 'купить' && parts[1] === 'скин') {
            const query = message.text.split(' ').slice(2).join(' ').toLowerCase().trim();
            let selected = null;
            
            for (const [key, data] of Object.entries(SKINS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { 
                    selected = data; 
                    break; 
                }
            }
            
            if (!selected) {
                return await message.reply("❌ Нет такого скина.");
            }
            
            if (balance < selected.price) {
                return await message.reply("❌ Не хватает денег.");
            }
            
            await updateBalance(userId, -selected.price);
            await dbRun("UPDATE users SET skin = ? WHERE user_id = ?", [selected.name, String(userId)]);
            
            return await message.reply(`✅ Вы купили ${selected.name}!`);
        }

        if (cmdWord === 'надеть') {
            const query = message.text.split(' ').slice(1).join(' ').toLowerCase().trim();
            let selected = null;
            
            for (const [key, data] of Object.entries(SKINS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { 
                    selected = data; 
                    break; 
                }
            }
            
            if (!selected) {
                return await message.reply("❌ Нет такого скина.");
            }
            
            await dbRun("UPDATE users SET skin = ? WHERE user_id = ?", [selected.name, String(userId)]);
            return await message.reply(`✅ Вы надели ${selected.name}!`);
        }

        // ====================================================================
        // КОМАНДЫ ОРГАНИЗАЦИЙ
        // ====================================================================

        if (cmdWord === 'организации') {
            let txt = "🏛️ Организации:\n\n";
            
            for (const [key, data] of Object.entries(ORGS_DATA)) {
                txt += `${data.name} (Лимит: ${data.limit})\n`;
            }
            
            txt += "\n📝 /вступить [название]";
            return await message.reply(txt);
        }

        if (cmdWord === 'вступить') {
            const query = message.text.split(' ').slice(1).join(' ').toLowerCase().trim();
            let selected = null;
            
            for (const [key, data] of Object.entries(ORGS_DATA)) {
                if (key.includes(query) || data.name.toLowerCase().includes(query)) { 
                    selected = data; 
                    break; 
                }
            }
            
            if (!selected) {
                return await message.reply("❌ Нет такой организации.");
            }
            
            const count = (await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [selected.name])).c;
            
            if (count >= selected.limit) {
                return await message.reply("❌ Мест нет.");
            }
            
            await dbRun("UPDATE users SET org = ? WHERE user_id = ?", [selected.name, String(userId)]);
            return await message.reply(`✅ Вы вступили в ${selected.name}!`);
        }

        // ====================================================================
        // КОМАНДЫ СТРАН
        // ====================================================================

        if (cmdWord === 'страны') {
            return await message.reply(`🌍 Доступные страны:\n${COUNTRIES_DATA.join(', ')}\n\n/страна [название]`);
        }

        if (cmdWord === 'страна') {
            const query = message.text.split(' ').slice(1).join(' ').toLowerCase().trim();
            const found = COUNTRIES_DATA.find(c => c.toLowerCase() === query);
            
            if (!found) {
                return await message.reply("❌ Нет такой страны.");
            }
            
            await dbRun("UPDATE users SET country = ? WHERE user_id = ?", [found, String(userId)]);
            return await message.reply(`✅ Вы вступили в ${found}!`);
        }

        // ====================================================================
        // КОМАНДЫ НЕДВИЖИМОСТИ
        // ====================================================================

        if (cmdWord === 'sellhome' || (cmdWord === 'продать' && parts[1] === 'дом')) {
            const slot = parseInt(parts[2]) || 1;
            const prop = await dbGet("SELECT id, location FROM properties WHERE owner_id = ? AND type = 'house' AND slot = ?", [String(userId), slot]);
            
            if (!prop) {
                return await message.reply(`❌ У вас нет дома в слоте ${slot}.`);
            }
            
            const locData = PROPERTY_DATA[prop.location.toLowerCase()];
            const sellPrice = Math.floor(locData.housePrice * 0.70);
            
            await updateBalance(userId, sellPrice);
            await dbRun("DELETE FROM properties WHERE id = ?", [prop.id]);
            
            return await message.reply(`🏠 Вы продали дом (слот ${slot}) государству! Получено: ${formatMoney(sellPrice)}$`);
        }

        if (cmdWord === 'дома' || cmdWord === 'гаражи') {
            const type = cmdWord === 'дома' ? 'house' : 'garage';
            let txt = `${type === 'house' ? '🏠 ДОМА' : '🏘️ ГАРАЖИ'}\n────────────────────\n`;
            
            for (const data of Object.values(PROPERTY_DATA)) {
                const count = (await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = ?", [data.name, type])).c;
                txt += `📍 ${data.name} (${count}/40)\n└ Свободно: ${40 - count}\n`;
            }
            
            txt += `\n💡 /купить ${type === 'house' ? 'дом' : 'гараж'} [слот 1-2] топ [1-20] [Локация]`;
            return await message.reply(txt);
        }

        if (cmdWord === 'купить' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const isHouse = parts[1] === 'дом';
            const type = isHouse ? 'house' : 'garage';
            let rest = cleanText.replace('купить дом', '').replace('купить гараж', '').trim();
            
            let slot = 1;
            const slotMatch = rest.match(/слот\s*(\d+)/i) || rest.match(/^(\d+)\s/);
            
            if (slotMatch) { 
                slot = parseInt(slotMatch[1]); 
                rest = rest.replace(slotMatch[0], '').trim(); 
            }
            
            if (slot < 1 || slot > 2) {
                return await message.reply("❌ Слот может быть 1 или 2.");
            }

            const tierMatch = rest.match(/топ\s*(\d+)/i);
            
            if (!tierMatch) {
                return await message.reply(`❌ Укажите топ. Пример: /купить ${isHouse ? 'дом' : 'гараж'} 1 топ 1 нижегородская`);
            }
            
            const tier = parseInt(tierMatch[1]);
            
            if (tier < 1 || tier > 20) {
                return await message.reply("❌ Топ от 1 до 20.");
            }
            
            const locQuery = rest.replace(tierMatch[0], '').trim();
            let locData = null;
            
            for (const [key, data] of Object.entries(PROPERTY_DATA)) {
                if (key.includes(locQuery) || data.name.toLowerCase().includes(locQuery)) { 
                    locData = data; 
                    break; 
                }
            }
            
            if (!locData) {
                return await message.reply(`❌ Укажите локацию.`);
            }
            
            if (await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ? AND slot = ?", [String(userId), type, slot])) {
                return await message.reply(`❌ У вас уже есть ${isHouse ? 'дом' : 'гараж'} в слоте ${slot}.`);
            }
            
            if (await dbGet("SELECT id FROM properties WHERE location = ? AND type = ? AND tier = ?", [locData.name, type, tier])) {
                return await message.reply(`❌ Это место занято.`);
            }
            
            const price = (isHouse ? locData.housePrice : locData.garagePrice) * tier;
            
            if (balance < price) {
                return await message.reply(`❌ Нужно ${formatMoney(price)}$.`);
            }
            
            await updateBalance(userId, -price);
            await dbRun("INSERT INTO properties (type, location, tier, owner_id, slot) VALUES (?, ?, ?, ?, ?)", [type, locData.name, tier, String(userId), slot]);
            
            return await message.reply(`🎉 Вы купили ${isHouse ? 'дом' : 'гараж'} (Слот ${slot}) в ${locData.name} (Т${tier})!`);
        }

        // ====================================================================
        // КОМАНДЫ ТОПА
        // ====================================================================

        if (cmdWord === 'топ' || cmdWord === 'top') {
            return await message.reply("🏆 Выберите категорию топа:", replyParams(getTopKb(userId, 'coins', 'chat')));
        }

        // ====================================================================
        // КОМАНДЫ БИЗНЕСА
        // ====================================================================

        if (cmdWord === 'бизнес') {
            let bizText = "🏢 Бизнесы:\n\n";
            
            for (const data of Object.values(BIZ_DATA)) {
                bizText += `${data.name} — ${formatMoney(data.price)}$ (Доход: ~${formatMoney(data.baseIncome)}$/3мин)\n`;
            }
            
            bizText += "\n🛒 /купитьбиз [Название]";
            return await message.reply(bizText);
        }

        if (cmdWord === 'купитьбиз') {
            const bizQuery = message.text.split(' ').slice(1).join(' ').toLowerCase().trim();
            
            if (!bizQuery) {
                return await message.reply("❌ Укажите бизнес.");
            }
            
            let count = (await dbGet("SELECT COUNT(*) as c FROM businesses WHERE user_id = ?", [String(userId)])).c;
            
            if (count >= 2) {
                return await message.reply("❌ У вас уже 2 бизнеса (максимум).");
            }
            
            let selectedBiz = null;
            
            for (const [key, data] of Object.entries(BIZ_DATA)) {
                if (key.includes(bizQuery) || data.name.toLowerCase().includes(bizQuery)) { 
                    selectedBiz = data; 
                    break; 
                }
            }
            
            if (!selectedBiz) {
                return await message.reply("❌ Нет такого. /бизнес");
            }
            
            if (balance < selectedBiz.price) {
                return await message.reply(`❌ Нужно ${formatMoney(selectedBiz.price)}$.`);
            }
            
            await updateBalance(userId, -selectedBiz.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw, slot) VALUES (?, ?, 1, 0, ?, 0, ?)", [String(userId), selectedBiz.name, Date.now(), count + 1]);
            
            return await message.reply(`🎉 Вы купили ${selectedBiz.name} (Слот ${count + 1})!`);
        }

        if (cmdWord === 'мойбизнес') {
            const slot = parseInt(parts[1]) || 1;
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
            
            if (!biz) {
                return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);
            }
            
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const totalBalance = Number(biz.balance) + earned;
            const nextLevelCost = (Number(biz.level) === 1 ? 2000000 : Number(biz.level) === 2 ? 5000000 : Number(biz.level) * 5000000);
            
            return await message.reply(`🏢 ${biz.biz_name} (Слот ${slot})\n\n💪 Уровень: ${biz.level}/5\n🐱 ${formatMoney(bizData.baseIncome * biz.level * 20)}$/час\n💸 На балансе: ${formatMoney(totalBalance)}$\n\nПовышение: ${formatMoney(nextLevelCost)}$\n\n👉 /вывести ${slot}`, replyParams(getBizKb(userId, slot)));
        }

        if (cmdWord === 'вывести') {
            const slot = parseInt(parts[1]) || 1;
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
            
            if (!biz) {
                return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);
            }
            
            const now = Date.now(), lastWithdraw = Number(biz.last_withdraw) || 0;
            
            if (now - lastWithdraw < 7200000) {
                return await message.reply(`⏳ Ждите ${Math.floor((7200000 - (now - lastWithdraw)) / 3600000)} ч. ${Math.floor(((7200000 - (now - lastWithdraw)) % 3600000) / 60000)} мин.`);
            }
            
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { name: biz.biz_name, baseIncome: 1000 };
            const totalBalance = Number(biz.balance) + Math.floor((now - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            
            if (totalBalance <= 0) {
                return await message.reply("❌ Нет денег на балансе.");
            }
            
            await updateBalance(userId, totalBalance);
            await dbRun("UPDATE businesses SET balance = 0, last_income = ?, last_withdraw = ? WHERE user_id = ? AND slot = ?", [now, now, String(userId), slot]);
            
            return await message.reply(`💸 Вывели ${formatMoney(totalBalance)}$ на баланс! Следующий вывод через 2 часа.`);
        }

        if (cmdWord === 'закрыть' && parts[1] === 'бизнес') {
            const slot = parseInt(parts[2]) || 1;
            const biz = await dbGet("SELECT biz_name FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
            
            if (!biz) {
                return await message.reply(`❌ У вас нет бизнеса в слоте ${slot}.`);
            }
            
            await dbRun("DELETE FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), slot]);
            await updateBalance(userId, 10000000);
            
            return await message.reply(`💀 Вы закрыли бизнес (слот ${slot}) и получили 10,000,000$.`);
        }

        // ====================================================================
        // КОМАНДЫ РЕПУТАЦИИ
        // ====================================================================

        if (cmdWord === 'rep' || cmdWord === 'реп') {
            return await message.reply("🔔 /rep + или /rep - (ответом на сообщение). Лимит: 3/сутки.");
        }

        if (cmdWord === 'rep' && (parts[1] === '+' || parts[1] === '-')) {
            const isPlus = parts[1] === '+';
            let targetId = message.hasReplyMessage ? message.replyMessage.senderId : null;
            
            if (!targetId) {
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
            
            if (!targetId || targetId === userId) {
                return await message.reply("⚠️ Укажите пользователя (не себя).");
            }
            
            const now = Date.now(), repRow = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id = ?", [String(userId)]);
            let repCount = repRow ? Number(repRow.count) : 0, repReset = repRow ? Number(repRow.last_reset) : 0;
            
            if (now - repReset >= 86400000) { 
                repCount = 0; 
                repReset = now; 
            }
            
            if (repCount >= 3) {
                return await message.reply(`⏳ Лимит (3/сутки). Сброс через ${Math.floor((86400000 - (now - repReset)) / 3600000)} ч.`);
            }
            
            repCount++; 
            await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), repCount, repReset]);
            await updateReputation(targetId, isPlus ? 1 : -1);
            
            return await message.reply(`${isPlus ? '🟢 Повысил' : '🔴 Понизил'} репутацию ${await getFullName(targetId)} (Теперь: ${await getReputation(targetId)}). Осталось: ${3 - repCount}/3`);
        }

        if (cmdWord === 'работа') {
            return await message.reply("💼 Работа:", replyParams(getWorkKb()));
        }

        // ====================================================================
        // КОМАНДЫ ИГР
        // ====================================================================

        const gameCmds = ['рулетка', 'рул', 'краш', 'монетка', 'стакан', 'кубик', 'автомат', 'блэкджек', 'дрим', 'мины', 'фортуна'];
        
        if (gameCmds.some(cmd => cmdWord === cmd)) {
            const lastPlayed = gameCooldowns.get(userId) || 0;
            
            if (Date.now() - lastPlayed < 10000) {
                return await message.reply(`⏳ Подождите ${Math.ceil((10000 - (Date.now() - lastPlayed)) / 1000)} сек.`);
            }
            
            gameCooldowns.set(userId, Date.now());
        }

        if (cmdWord === 'краш') {
            if (parts.length >= 3) {
                const autoStop = parseFloat(parts[1]);
                let bet = parseAmount(parts[2]);
                
                if (bet === 'ALL') bet = balance;
                
                if (isNaN(autoStop) || autoStop < 1.01 || isNaN(bet) || bet < 100 || bet > balance) {
                    return await message.reply("❌ Ставка от 100$, автостоп > 1.01");
                }
                
                await updateBalance(userId, -bet);
                
                const rand = Math.random(); 
                let crashPoint = rand > 0.03 ? Math.floor((1 / (1 - rand)) * 0.97 * 100) / 100 : 1.00;
                
                if (crashPoint >= autoStop) { 
                    await updateBalance(userId, Math.floor(bet * autoStop)); 
                    return await message.reply(`📈 x${crashPoint.toFixed(2)}\n✅ Выиграли ${formatMoney(bet * autoStop)}$!`); 
                } else {
                    return await message.reply(`📈 x${crashPoint.toFixed(2)}\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ краш [автостоп] [ставка]");
        }

        if (cmdWord === 'монетка') {
            if (parts.length >= 3) {
                let side = ['орел', 'решка'].includes(parts[1]) ? parts[1] : ['орел', 'решка'].includes(parts[2]) ? parts[2] : null;
                let bet = parseAmount(parts[1] === side ? parts[2] : parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (!side || isNaN(bet) || bet < 100 || bet > balance || bet > 4000000) {
                    return await message.reply("❌ Ставка от 100$ до 4кк, 'орел' или 'решка'");
                }
                
                await updateBalance(userId, -bet);
                
                const res = Math.random() < 0.5 ? 'орел' : 'решка';
                
                if (res === side) { 
                    await updateBalance(userId, bet * 2); 
                    return await message.reply(`🪙 ${res}\n✅ Выиграли ${formatMoney(bet * 2)}$!`); 
                } else {
                    return await message.reply(`🪙 ${res}\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ монетка [орел/решка] [ставка]");
        }

        if (cmdWord === 'стакан') {
            if (parts.length >= 3) {
                let cup = parseInt(parts[1]) || parseInt(parts[2]);
                let bet = parseAmount(parts[1] === cup.toString() ? parts[2] : parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (!cup || cup < 1 || cup > 3 || isNaN(bet) || bet < 100 || bet > balance) {
                    return await message.reply("❌ Ставка от 100$, стакан 1-3");
                }
                
                await updateBalance(userId, -bet);
                
                const res = Math.floor(Math.random() * 3) + 1;
                
                if (res === cup) { 
                    await updateBalance(userId, bet * 3); 
                    return await message.reply(`🥤 Стакан ${res}\n✅ Выиграли ${formatMoney(bet * 3)}$!`); 
                } else {
                    return await message.reply(`🥤 Стакан ${res}\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ стакан [1-3] [ставка]");
        }

        if (cmdWord === 'кубик') {
            if (parts.length >= 3) {
                let guess = parseInt(parts[1]) || parseInt(parts[2]);
                let bet = parseAmount(parts[1] === guess.toString() ? parts[2] : parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (!guess || guess < 1 || guess > 6 || isNaN(bet) || bet < 100 || bet > balance) {
                    return await message.reply("❌ Ставка от 100$, число 1-6");
                }
                
                await updateBalance(userId, -bet);
                
                const res = Math.floor(Math.random() * 6) + 1;
                
                if (res === guess) { 
                    await updateBalance(userId, bet * 6); 
                    return await message.reply(`🎲 ${res}\n✅ Выиграли ${formatMoney(bet * 6)}$!`); 
                } else {
                    return await message.reply(`🎲 ${res}\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ кубик [1-6] [ставка]");
        }

        if (cmdWord === 'автомат') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (isNaN(bet) || bet < 100 || bet > balance || bet > 15000000) {
                    return await message.reply("❌ Ставка от 100$ до 15кк.");
                }
                
                await updateBalance(userId, -bet);
                
                const emojis = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
                const r1 = emojis[Math.floor(Math.random() * 5)], r2 = emojis[Math.floor(Math.random() * 5)], r3 = emojis[Math.floor(Math.random() * 5)];
                
                let win = (r1 === r2 && r2 === r3) ? bet * 10 : (r1 === r2 || r2 === r3 || r1 === r3) ? bet * 2 : 0;
                
                if (win > 0) { 
                    await updateBalance(userId, win); 
                    return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n✅ Выиграли ${formatMoney(win)}$!`); 
                } else {
                    return await message.reply(`🎰 [ ${r1} | ${r2} | ${r3} ]\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ автомат [ставка]");
        }

        if (cmdWord === 'блэкджек') {
            if (parts.length >= 2) {
                let bet = parseAmount(parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (isNaN(bet) || bet < 100 || bet > balance) {
                    return await message.reply("❌ Ставка от 100$.");
                }
                
                await updateBalance(userId, -bet);
                
                const p = Math.floor(Math.random() * 10) + 12, d = Math.floor(Math.random() * 10) + 12;
                let msgText = `🃏 Блэкджек\n👤 Твои: ${p}\n🤵 Дилер: ${d}\n\n`;
                
                if (p > 21) {
                    msgText += `❌ Перебор! Проиграли ${formatMoney(bet)}$.`;
                } else if (d > 21) { 
                    await updateBalance(userId, bet * 2); 
                    msgText += `✅ У дилера перебор! Выиграли ${formatMoney(bet * 2)}$.`; 
                } else if (p > d) { 
                    await updateBalance(userId, bet * 2); 
                    msgText += `✅ Выиграли ${formatMoney(bet * 2)}$!`; 
                } else if (p === d) { 
                    await updateBalance(userId, bet); 
                    msgText += `🤝 Ничья. Возврат.`; 
                } else {
                    msgText += `❌ Дилер выиграл. Проиграли ${formatMoney(bet)}$.`;
                }
                
                return await message.reply(msgText);
            }
            return await message.reply("❌ блэкджек [ставка]");
        }

        if (cmdWord === 'дрим') {
            if (parts.length >= 3) {
                let guess = parseInt(parts[1]) || parseInt(parts[2]);
                let bet = parseAmount(parts[1] === guess.toString() ? parts[2] : parts[1]);
                
                if (bet === 'ALL') bet = balance;
                
                if (![1,2,3,4,5].includes(guess) || isNaN(bet) || bet < 100 || bet > balance) {
                    return await message.reply("❌ Ставка от 100$, число 1-5.");
                }
                
                await updateBalance(userId, -bet);
                
                const res = Math.floor(Math.random() * 10) + 1;
                const mult = {1: 2, 2: 2, 3: 3, 4: 4, 5: 5}[guess];
                
                if (res === guess) { 
                    await updateBalance(userId, bet * mult); 
                    return await message.reply(`💎 ${res}\n✅ Выиграли ${formatMoney(bet * mult)}$ (x${mult})!`); 
                } else {
                    return await message.reply(`💎 ${res}\n❌ Проиграли ${formatMoney(bet)}$.`);
                }
            }
            return await message.reply("❌ дрим [1-5] [ставка]");
        }

        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length >= 3) {
                let betStr = parts[parts.length - 1];
                let bet = parseAmount(betStr);
                
                if (bet === 'ALL') bet = balance;
                
                let choices = parts.slice(1, -1);
                
                if (choices.length === 0) {
                    choices = [parts[1]];
                }
                
                if (isNaN(bet) || bet < 100 || bet > balance || bet > 10000000) {
                    return await message.reply("❌ Ставка от 100$ до 10кк.");
                }
                
                await updateBalance(userId, -bet);
                
                const res = Math.floor(Math.random() * 37), reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                let isWin = false;
                
                for (const c of choices) {
                    if (parseInt(c) === res) isWin = true;
                    if (["красное", "красный", "кр"].includes(c) && reds.includes(res)) isWin = true;
                    if (["черное", "черный", "чр"].includes(c) && !reds.includes(res) && res !== 0) isWin = true;
                    if (["чет", "четное"].includes(c) && res % 2 === 0 && res !== 0) isWin = true;
                    if (["нечет", "нечетное"].includes(c) && res % 2 !== 0) isWin = true;
                }
                
                const attach = await getRouletteAttachment();
                
                if (isWin) {
                    await updateBalance(userId, bet * 2);
                }
                
                return await message.reply({ 
                    message: `🎰 ${res} ${reds.includes(res) ? '🔴' : (res === 0 ? '🟢' : '⚫')} (${reds.includes(res) ? 'Красное' : (res === 0 ? 'Зеро' : 'Черное')})\n\n${isWin ? `✅ Выигрыш: +${bet}$` : `😔 Проигрыш: -${bet}$`}\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, 
                    attachment: attach || undefined, 
                    keyboard: isLs ? mainKb.toString() : undefined 
                });
            }
            return await message.reply("❌ рулетка [цвет/чет] [ставка]");
        }

        if (cmdWord === 'фортуна') {
            const now = Math.floor(Date.now() / 1000);
            const row = await dbGet("SELECT last_used FROM fortune_cd WHERE user_id = ?", [String(userId)]);
            
            if (now - (row ? row.last_used : 0) < FORTUNA_CD) {
                return await message.reply(`⏳ Ждите ${Math.floor((FORTUNA_CD - (now - (row ? row.last_used : 0))) / 60)} мин.`);
            }
            
            if (balance < 100) {
                return await message.reply("❌ Нужно 100$.");
            }
            
            await updateBalance(userId, -100); 
            await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), now]);
            
            const roll = Math.random();
            
            if (roll < 0.4) {
                const prize = Math.floor(Math.random() * (200000 - 50000 + 1)) + 50000;
                await updateBalance(userId, prize);
                return await message.reply(`🎰 Фортуна улыбнулась!\n💰 Вы выиграли ${formatMoney(prize)}$!\n💳 Баланс: ${formatMoney(await getBalance(userId))}$`);
            } else if (roll < 0.7) {
                await updateReputation(userId, 10);
                return await message.reply(`🎰 Фортуна улыбнулась!\n⭐ Вы получили +10 репутации!\n⭐ Теперь: ${await getReputation(userId)}`);
            } else {
                return await message.reply("🎰 Фортуна сегодня не на вашей стороне. Вы ничего не выиграли.");
            }
        }

        if (cmdWord === 'мины') {
            let bet = parts.length >= 2 ? parseAmount(parts[1]) : 100;
            
            if (bet === 'ALL') bet = balance;
            
            if (isNaN(bet) || bet < 100 || bet > balance || bet > 5000000) {
                return await message.reply("❌ Ставка от 100$ до 5кк.");
            }
            
            const gameId = String(Math.floor(Math.random() * 90000) + 10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gameId, String(userId), bet, String(message.id)]);
            
            return await message.reply(`💣 Мины\nСтавка: ${bet}$\n\nВыберите мин (2-8):`, replyParams(getMinesCountKb(gameId)));
        }

        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (parts.length >= 2 && message.hasReplyMessage) {
                const amount = parseAmount(parts[1]);
                const targetId = message.replyMessage.senderId;
                
                if (!amount || amount === 'ALL' || targetId === userId || targetId < 0 || amount < 50 || amount > 5000000000000 || balance < amount) {
                    return await message.reply("❌ Ошибка перевода (сумма от 50, не себе/сообществам).");
                }
                
                await updateBalance(userId, -amount); 
                await updateBalance(targetId, amount);
                
                return await message.reply(`💸 Перевели ${formatMoney(amount)}$ игроку ${await getFullName(targetId)}.`);
            }
            return await message.reply("❌ transfer [сумма] (ответом)");
        }

        if (cmdWord === 'duel') {
            if (parts.length === 2) {
                const bet = parseAmount(parts[1]);
                
                if (!bet || bet === 'ALL' || bet < 50 || bet > 2000 || balance < bet) {
                    return await message.reply("❌ Ставка 50-2000.");
                }
                
                const duelId = String(Math.floor(Math.random() * 90000) + 10000);
                await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [duelId, String(userId), bet, String(peerId)]);
                
                return await message.reply(`⚔️ Дуэль!\n👤 ${await getFullName(userId)}\n💰 ${bet}$\n\n⚡ Жмите!`, replyParams(getDuelKb(duelId)));
            }
            return await message.reply("❌ duel [сумма]");
        }

        if (cmdWord === 'бонус') {
            const today = new Date().toLocaleDateString('ru-RU');
            const uBonus = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id = ?", [String(userId)]);
            
            let streak = uBonus?.bonus_streak || 0, lastDate = uBonus?.last_bonus_date;
            
            if (lastDate === today) {
                return await message.reply(`⏳ Бонус уже взят! Стрик: ${streak}.`);
            }
            
            if (lastDate) { 
                const diff = Math.ceil(Math.abs(new Date(today.split('.').reverse().join('-')) - new Date(lastDate.split('.').reverse().join('-'))) / 86400000); 
                streak = diff === 1 ? streak + 1 : 1; 
            } else {
                streak = 1;
            }
            
            let amt = 100000; 
            if (streak === 2) amt = 200000; 
            if (streak === 3) amt = 300000; 
            if (streak === 4) amt = 400000; 
            if (streak === 5) amt = 500000; 
            if (streak === 6) amt = 700000; 
            if (streak >= 7) amt = 1000000;
            
            await updateBalance(userId, amt); 
            await dbRun("UPDATE users SET last_bonus_date = ?, bonus_streak = ?, bonus_count = bonus_count + 1 WHERE user_id = ?", [today, streak, String(userId)]);
            
            return await message.reply(`🎁 БОНУС!\n🔥 Стрик: ${streak} дн.\n💰 +${formatMoney(amt)}$\n💳 Баланс: ${formatMoney(await getBalance(userId))}$`);
        }

        // ====================================================================
        // БЛОК АДМИНСКИХ КОМАНД
        // ====================================================================

        if (userId === ADMIN_ID) {
            if (cmdWord === 'pr') { 
                const { targetId } = await getTargetAndReason(message, 'pr'); 
                if (!targetId) return await message.reply("⚠️ Укажите пользователя."); 
                return await message.reply(`💳 Баланс ${await getFullName(targetId)}: ${formatShortMoney(await getBalance(targetId))}$`); 
            }
            
            if (cmdWord === 'заморозить') { 
                const { targetId } = await getTargetAndReason(message, 'заморозить'); 
                if (!targetId || targetId === ADMIN_ID) return await message.reply("⚠️ Ошибка."); 
                await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(targetId)]); 
                return await message.reply(`✅ Игрок заморожен.`); 
            }
            
            if (cmdWord === 'разморозить' || cmdWord === 'unfreeze') { 
                const { targetId } = await getTargetAndReason(message, cmdWord); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                await dbRun("DELETE FROM frozen WHERE user_id = ?", [String(targetId)]); 
                return await message.reply(`✅ Игрок разморожен.`); 
            }
            
            if (cmdWord === 'unmute' || cmdWord === 'размут') { 
                const { targetId } = await getTargetAndReason(message, cmdWord); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                await dbRun("DELETE FROM mutes WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]); 
                try { 
                    await vk.api.messages.changeConversationMemberRestrictions({ 
                        group_id: GROUP_ID, 
                        peer_id: peerId, 
                        member_id: targetId, 
                        action: 'none', 
                        for: 0 
                    }); 
                } catch(e) {} 
                return await message.reply(`✅ Мут снят.`); 
            }
            
            if (cmdWord === 'unban' || cmdWord === 'разбан') { 
                const { targetId } = await getTargetAndReason(message, cmdWord); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]); 
                if (message.isChat) await dbRun("DELETE FROM chat_bans WHERE user_id = ? AND peer_id = ?", [String(targetId), String(peerId)]); 
                return await message.reply(`✅ Разбанен.`); 
            }
            
            if (cmdWord === 'kl') { 
                const { targetId } = await getTargetAndReason(message, 'kl'); 
                if (!targetId || targetId === ADMIN_ID) return await message.reply("⚠️ Ошибка."); 
                await dbRun("DELETE FROM properties WHERE owner_id = ?", [String(targetId)]); 
                await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0, car = NULL, last_bonus_date = NULL, bonus_streak = 0 WHERE user_id = ?", [String(targetId)]); 
                return await message.reply(`💥 Сброшен.`); 
            }
            
            if (cmdWord === 'mute') { 
                const { targetId } = await getTargetAndReason(message, 'mute'); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                let args = message.text.split(' ').slice(1); 
                if (!message.hasReplyMessage) args.shift(); 
                let mins = parseInt(args[0]) || 10; 
                let reason = args.slice(1).join(' ') || "Не указано"; 
                await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(targetId), String(peerId), Date.now() + mins * 60000, reason]); 
                if (message.isChat) try { 
                    await vk.api.messages.changeConversationMemberRestrictions({ 
                        group_id: GROUP_ID, 
                        peer_id: peerId, 
                        member_id: targetId, 
                        action: 'ro', 
                        for: mins * 60 
                    }); 
                } catch(e) {} 
                return await message.reply(`🚫 Мут ${mins} мин.`); 
            }
            
            if (cmdWord === 'бан' || cmdWord === 'ban') { 
                const { targetId, reason } = await getTargetAndReason(message, cmdWord); 
                if (!targetId || !message.isChat) return await message.reply("⚠️ Ошибка."); 
                await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(targetId), String(peerId), reason]); 
                try { 
                    await vk.api.messages.removeChatUser({ 
                        chat_id: peerId - 2000000000, 
                        user_id: targetId, 
                        group_id: GROUP_ID 
                    }); 
                } catch(e) {} 
                return await message.reply(`🚫 Забанен.`); 
            }
            
            if (cmdWord === 'gban') { 
                const { targetId, reason } = await getTargetAndReason(message, 'gban'); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, 0)", [String(targetId), reason]); 
                try { 
                    await vk.api.messages.send({ 
                        peer_id: targetId, 
                        message: `😈 Вы были глобально забанены. Причина: ${reason}`, 
                        random_id: Math.floor(Math.random() * 1000000000) 
                    }); 
                } catch(e) {} 
                if (message.isChat) try { 
                    await vk.api.messages.removeChatUser({ 
                        chat_id: peerId - 2000000000, 
                        user_id: targetId, 
                        group_id: GROUP_ID 
                    }); 
                } catch(e) {} 
                return await message.reply(`🚫 Глобально забанен.`); 
            }
            
            if (cmdWord === 'настройки') { 
                const en = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_enabled'")).value; 
                const l = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value; 
                const t = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value; 
                const m = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value; 
                return await message.reply(`⚙️ Настройки антиспама:`, { keyboard: await getSettingsKb(en, l, t, m) }); 
            }
            
            if (cmdWord === 'убрать') { 
                const q = cleanText.replace('убрать', '').trim().toLowerCase(); 
                if (q === 'all' || q === 'все') { 
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0"); 
                    return await message.reply(`💥 Обнулены ВСЕ.`); 
                } else { 
                    const { targetId } = await getTargetAndReason(message, 'убрать'); 
                    if (!targetId) return await message.reply("⚠️ Ошибка."); 
                    await dbRun("UPDATE users SET balance = 0, reputation = 0, xp = 0, level = 1, duel_wins = 0, bonus_count = 0 WHERE user_id = ?", [String(targetId)]); 
                    return await message.reply(`💥 Обнулен.`); 
                } 
            }
            
            if (cmdWord === 'kick') { 
                const { targetId, reason } = await getTargetAndReason(message, 'kick'); 
                if (!targetId || !message.isChat) return await message.reply("⚠️ Ошибка."); 
                try { 
                    await vk.api.messages.removeChatUser({ 
                        chat_id: peerId - 2000000000, 
                        user_id: targetId, 
                        group_id: GROUP_ID 
                    }); 
                    return await message.reply(`Исключен.`); 
                } catch(e) { 
                    return await message.reply(`⚠️ Ошибка (не участник/выше по статусу).`); 
                } 
            }
            
            if (cmdWord === 'чсб') { 
                const { targetId, reason } = await getTargetAndReason(message, 'чсб'); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                let d = 0; 
                let fr = reason; 
                const pr = reason.split(' '); 
                if (pr.length > 1 && !isNaN(parseInt(pr[0]))) { 
                    d = parseInt(pr[0]); 
                    fr = pr.slice(1).join(' '); 
                } 
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(targetId), fr || "Не указано", d > 0 ? Date.now() + d * 86400000 : 0]); 
                return await message.reply(`В ЧС.`); 
            }
            
            if (cmdWord === 'разчсб') { 
                const { targetId } = await getTargetAndReason(message, 'разчсб'); 
                if (!targetId) return await message.reply("⚠️ Ошибка."); 
                await dbRun("DELETE FROM blacklist WHERE user_id = ?", [String(targetId)]); 
                return await message.reply(`Из ЧС.`); 
            }
            
            if (cmdWord === 'выдать') { 
                const args = message.text.split(' ').slice(1); 
                let amt = 0, rem = []; 
                for (const a of args) { 
                    const p = parseAmount(a); 
                    if (p > 0 && p !== 'ALL') amt = p; 
                    else rem.push(a); 
                } 
                if (amt <= 0) return await message.reply("❌ Сумма."); 
                const q = rem.join(' ').trim().toLowerCase(); 
                const reason = q.replace(/(?:all|все|@\w+|\[id\d+\|.*?\]|https?:\/\/.*?\/\w+)/gi, '').trim(); 
                if (q === 'all' || q === 'все') { 
                    await dbRun("UPDATE users SET balance = balance + ?", [amt]); 
                    return await message.reply(`💰 Всем выдано +${formatMoney(amt)}$${reason ? ` (Причина: ${reason})` : ''}`); 
                } else { 
                    let tId = null; 
                    if (message.hasReplyMessage) tId = message.replyMessage.senderId; 
                    else if (q) { 
                        const mm = q.match(/@([a-zA-Z0-9._]+)/i) || q.match(/\[id(\d+)\|/); 
                        if (mm) { 
                            if (mm[1].match(/^\d+$/)) tId = parseInt(mm[1]); 
                            else try { 
                                const res = await vk.api.utils.resolveScreenName({ screen_name: mm[1] }); 
                                if (res.type === 'user') tId = res.object_id; 
                            } catch(e){} 
                        } 
                    } 
                    if (!tId) return await message.reply("⚠️ Укажите."); 
                    await updateBalance(tId, amt); 
                    return await message.reply(`💰 Выдано ${formatMoney(amt)}$ игроку ${await getFullName(tId)}${reason ? ` (Причина: ${reason})` : ''}`); 
                } 
            }
            
            if (cmdWord === 'обнулить') { 
                const q = message.text.split(' ').slice(1).join(' ').trim().toLowerCase(); 
                if (q === 'all') { 
                    await dbRun("UPDATE users SET balance = 0"); 
                    await dbRun("UPDATE businesses SET balance = 0"); 
                    return await message.reply("💥 Балансы обнулены."); 
                } else { 
                    const { targetId } = await getTargetAndReason(message, 'обнулить'); 
                    if (!targetId) return await message.reply("⚠️ Укажите."); 
                    await dbRun("UPDATE users SET balance = 0 WHERE user_id = ?", [String(targetId)]); 
                    await dbRun("UPDATE businesses SET balance = 0 WHERE user_id = ?", [String(targetId)]); 
                    return await message.reply(`💥 Обнулен.`); 
                } 
            }
            
            if (cmdWord === 'cp') { 
                await dbRun("DELETE FROM promos"); 
                return await message.reply("✅ Промокоды удалены."); 
            }
            
            if (cmdWord === 'создать') { 
                if (parts.length === 4) { 
                    const a = parseAmount(parts[2]), l = parseAmount(parts[3]); 
                    if (a > 0 && l > 0) { 
                        await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], a, l]); 
                        return await message.reply(`✅ Промокод \`${parts[1]}\` создан!`); 
                    } 
                } 
                return await message.reply("❌ /создать [код] [сумма] [лимит]"); 
            }
        }

        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            
            if (rows.length === 0) {
                return await message.reply("❌ Нет промокодов.");
            }
            
            let txt = "🎁 Промокоды:\n\n";
            
            for (const r of rows) {
                txt += `▪️ \`${r.code}\` — ${formatMoney(r.amount)}$ (${r.used_by ? r.used_by.split(",").length : 0}/${r.limit_count})\n`;
            }
            
            return await message.reply(txt);
        }

        if (cmdWord === 'promo') {
            if (parts.length === 2) {
                try { 
                    const isM = await vk.api.groups.isMember({ group_id: GROUP_ID, user_id: userId }); 
                    if (isM !== 1) { 
                        const sub = Keyboard.builder().inline().urlButton({ label: '📢 Подписаться', url: `https://vk.com/public${GROUP_ID}` }); 
                        return await message.reply("⚠️ Только для подписчиков!", { keyboard: sub.toString() }); 
                    } 
                } catch(e) {}
                
                const row = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code = ?", [parts[1]]);
                
                if (!row) {
                    return await message.reply("❌ Не существует/исчерпан.");
                }
                
                const used = row.used_by ? row.used_by.split(",") : [];
                
                if (used.length >= row.limit_count) { 
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]); 
                    return await message.reply("❌ Исчерпан."); 
                }
                
                if (used.includes(String(userId))) {
                    return await message.reply("❌ Вы уже активировали.");
                }
                
                used.push(String(userId)); 
                await updateBalance(userId, row.amount);
                
                if (used.length >= row.limit_count) { 
                    await dbRun("DELETE FROM promos WHERE code = ?", [parts[1]]); 
                    return await message.reply(`✅ +${row.amount}$\n⚠️ Промокод удален (лимит).`); 
                } else { 
                    await dbRun("UPDATE promos SET used_by = ? WHERE code = ?", [used.join(","), parts[1]]); 
                    return await message.reply(`✅ +${row.amount}$\nОсталось: ${row.limit_count - used.length}`); 
                }
            } else {
                return await message.reply("❌ /promo [код]");
            }
        }

        return;
    } catch (error) { 
        console.error("ОШИБКА:", error); 
        try { 
            await message.reply(`⚠️ Ошибка: ${error.message}`); 
        } catch (e) {} 
    }
});

// ============================================================================
// БЛОК ОБРАБОТКИ КНОПОК (CALLBACK)
// ============================================================================

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

        if (payload.cmd === 'report_spam') {
            if (userId !== ADMIN_ID) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет прав.' });
            }
            
            await safeAnswer({ type: 'show_snackbar', text: '✅ Предупреждение выдано.' });
            
            return await vk.api.messages.send({ 
                peer_id: payload.target, 
                message: "⚠️ Вам выдано предупреждение от администратора за нарушение правил (Спам).", 
                random_id: Math.floor(Math.random() * 1000000000) 
            });
        }

        if (payload.cmd === 'report_reply') {
            if (userId !== ADMIN_ID) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет прав.' });
            }
            
            await safeAnswer();
            
            adminStates.set(ADMIN_ID, `reply_${payload.target}`);
            
            return await vk.api.messages.send({ 
                peer_id: context.peerId, 
                message: `✏️ Введите текст ответа для игрока:`, 
                random_id: Math.floor(Math.random() * 1000000000) 
            });
        }

        if (payload.cmd === 'prop_deal_accept') {
            const deal = await dbGet("SELECT * FROM prop_deals WHERE id = ?", [payload.deal_id]);
            
            if (!deal) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Устарело.' });
            }
            
            if (String(userId) !== deal.buyer_id) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы не покупатель.'});
            }
            
            if (await getBalance(userId) < deal.price) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег.'});
            }
            
            const slot = parseInt(payload.slot) || 1;
            
            if (await dbGet("SELECT id FROM properties WHERE owner_id = ? AND type = ? AND slot = ?", [String(userId), deal.type, slot])) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас уже есть в этом слоте!'});
            }
            
            await updateBalance(userId, -deal.price); 
            await updateBalance(deal.seller_id, deal.price);
            await dbRun("UPDATE properties SET owner_id = ?, slot = ? WHERE id = ?", [String(userId), slot, deal.prop_id]);
            await dbRun("DELETE FROM prop_deals WHERE id = ?", [payload.deal_id]);
            
            await safeAnswer({ type: 'show_snackbar', text: '✅ Куплено!' });
            
            await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: `🤝 Сделка!\n${await getFullName(userId)} купил ${deal.type === 'house' ? 'дом' : 'гараж'} за ${formatMoney(deal.price)}$.`, 
                keyboard: "", 
                conversation_message_id: context.conversationMessageId 
            });
            return;
        }

        if ((payload.cmd === 'top_menu' || payload.cmd === 'top_back' || payload.cmd === 'biz_upgrade') && payload.author && String(userId) !== String(payload.author)) {
            return await safeAnswer({ type: 'show_snackbar', text: '❌ Это меню другого.' });
        }

        if (payload.cmd === 'settings_toggle') {
            if (userId !== ADMIN_ID) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет прав.' });
            }
            
            await dbRun("UPDATE settings SET value = ? WHERE key = 'antispam_enabled'", [payload.state]);
            
            await safeAnswer();
            
            const l = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_limit'")).value;
            const t = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_time'")).value;
            const m = (await dbGet("SELECT value FROM settings WHERE key = 'antispam_mute'")).value;
            
            await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: `⚙️ Настройки антиспама:`, 
                keyboard: await getSettingsKb(payload.state, l, t, m), 
                conversation_message_id: context.conversationMessageId 
            });
            return;
        }

        if (payload.cmd === 'settings_edit') {
            if (userId !== ADMIN_ID) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет прав.' });
            }
            
            await safeAnswer(); 
            adminStates.set(userId, payload.field); 
            
            let f = payload.field === 'limit' ? "лимит (5)" : payload.field === 'time' ? "время (60)" : "мут (10)";
            
            return await vk.api.messages.send({ 
                peer_id: context.peerId, 
                message: `✏️ Введите новое значение: ${f}`, 
                random_id: Math.floor(Math.random() * 1000000000) 
            });
        }

        if (payload.cmd === 'help_start') { 
            await safeAnswer(); 
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: "📖 Разделы:", 
                keyboard: getHelpKb(), 
                conversation_message_id: context.conversationMessageId 
            }); 
        }
        
        if (payload.cmd === 'help_menu') {
            await safeAnswer();
            
            let msg = payload.section === 'games' ? "🎰 Игровые команды:\n/рулетка [цвет/чет] [ставка]\n/краш [автостоп] [ставка]\n/монетка [орел/решка] [ставка]\n/стакан [1-3] [ставка]\n/кубик [1-6] [ставка]\n/автомат [ставка]\n/блэкджек [ставка]\n/дрим [1-5] [ставка]\n/мины [ставка]\n/фортуна\n\n⚠️ Мин. ставка: 100$. Ставка 'вб' разрешена." 
                : payload.section === 'eco' ? "💼 Экономика:\n/бизнес\n/купитьбиз [название]\n/мойбизнес [1-2]\n/вывести [1-2]\n/закрыть бизнес [1-2]\n/бонус\n/transfer [сумма] (ответом)\n/duel [сумма]\n/promo [код]\n/промолист\n/машины\n/купить машина [название]\n/sellcar\n/дон дом\n/дон гараж" 
                : payload.section === 'profile' ? "👤 Профиль и прочее:\n/профиль\n/топ\n/rep +/- (ответом)\n/пинг\n/chatid\n/report [текст]\n/магазин\n/купить скин [название]\n/надеть [название]\n/организации\n/вступить [название]\n/страны\n/страна [название]\n\n💡 Слэш (/) писать необязательно!" : "";
            
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                
                for (const data of Object.values(PROPERTY_DATA)) { 
                    const count = (await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'house'", [data.name])).c; 
                    txt += `📍 ${data.name} (${count}/40)\n└ Свободно: ${40 - count}\n`; 
                }
                
                txt += `\n💡 /купить дом [1-2] топ [1-20] [Локация]\n💡 /sellhome [1-2] (слить за 70%)\n🏆 /дон дом`; 
                msg = txt;
            }
            
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                
                for (const data of Object.values(PROPERTY_DATA)) { 
                    const count = (await dbGet("SELECT COUNT(*) as c FROM properties WHERE location = ? AND type = 'garage'", [data.name])).c; 
                    txt += `📍 ${data.name} (${count}/40)\n└ Свободно: ${40 - count}\n`; 
                }
                
                txt += `\n💡 /купить гараж [1-2] топ [1-20] [Локация]\n💡 /продать гараж [сумма] (ответом)\n🏆 /дон гараж`; 
                msg = txt;
            }
            
            if (payload.section === 'orgs') {
                let txt = "🏛️ ОРГАНИЗАЦИИ\n────────────────────\n";
                
                for (const [key, data] of Object.entries(ORGS_DATA)) { 
                    const count = (await dbGet("SELECT COUNT(*) as c FROM users WHERE org = ?", [data.name])).c; 
                    txt += `📍 ${data.name} (${count}/${data.limit})\n`; 
                }
                
                txt += `\n📝 /вступить [название]`; 
                msg = txt;
            }
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: msg, 
                keyboard: getHelpBackKb(), 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'casino_info') {
            const msgs = { 
                roulette: "Рулетка [ставка] [цвет/чет]", 
                crash: "краш [автостоп] [ставка]", 
                coin: "монетка [орел/решка] [ставка]", 
                glass: "стакан [1-3] [ставка]", 
                dice: "кубик [1-6] [ставка]", 
                slot: "автомат [ставка]", 
                blackjack: "блэкджек [ставка]", 
                dream: "дрим [1-5] [ставка]" 
            };
            
            await safeAnswer(); 
            return await vk.api.messages.send({ 
                peer_id: context.peerId, 
                message: `🎰 Инфо:\n${msgs[payload.game]}`, 
                random_id: Math.floor(Math.random() * 1000000000), 
                disable_mentions: 1 
            });
        }

        if (payload.cmd === 'biz_upgrade') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id = ? AND slot = ?", [String(userId), payload.slot]);
            
            if (!biz) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нет бизнеса.' });
            }
            
            if (biz.level >= 5) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Макс. уровень!' });
            }
            
            const bizData = Object.values(BIZ_DATA).find(b => b.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bizData.baseIncome * biz.level) / 180000));
            const nextCost = (biz.level === 1 ? 2000000 : biz.level === 2 ? 5000000 : biz.level * 5000000);
            
            if (await getBalance(userId) < nextCost) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег.' });
            }
            
            await safeAnswer(); 
            await updateBalance(userId, -nextCost);
            await dbRun("UPDATE businesses SET level = level + 1, balance = ?, last_income = ? WHERE user_id = ? AND slot = ?", [Number(biz.balance) + earned, Date.now(), String(userId), payload.slot]);
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: `🏢 ${biz.biz_name} (Слот ${payload.slot})\n\n💪 Уровень: ${biz.level + 1}/5\n💸 На балансе: ${formatMoney(Number(biz.balance) + earned)}$`, 
                keyboard: getBizKb(userId, payload.slot), 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'work_do') {
            const now = Date.now(), w = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id = ?", [String(userId)]);
            let c = w ? Number(w.count) : 0, r = w ? Number(w.last_reset) : 0;
            
            if (now - r >= 3600000) { 
                c = 0; 
                r = now; 
            }
            
            if (c >= 3) {
                return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${Math.floor((3600000 - (now - r)) / 60000)} мин.` });
            }
            
            if (payload.type === 'Такси' && !(await dbGet("SELECT car FROM users WHERE user_id = ?", [String(userId)])).car) {
                return await safeAnswer({ type: 'show_snackbar', text: '❌ Нужна машина (/машины)' });
            }
            
            await safeAnswer(); 
            c++; 
            await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), c, r]);
            
            let m = "", e = 0; 
            
            if (Math.random() > 0.3) { 
                e = 2000000; 
                await updateBalance(userId, e); 
                m = `✅ +${formatMoney(e)}$`; 
            } else {
                m = `😢 0$`;
            }
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: `${m}\n💰 Баланс: ${formatMoney(await getBalance(userId))}$\n📊 Попытки: ${3 - c}/3`, 
                keyboard: getWorkKb(), 
                conversation_message_id: context.conversationMessageId 
            });
        }

        await safeAnswer();
        
        if (payload.cmd === 'activate_bot' || payload.cmd === 'decline_bot') {
            try {
                const members = await vk.api.messages.getConversationMembers({ peer_id: context.peerId });
                
                if (!members.items.find(m => m.member_id === userId && (m.is_admin || m.is_owner)) && userId !== ADMIN_ID) {
                    return await vk.api.messages.edit({ 
                        peer_id: context.peerId, 
                        message: "❌ Только админ.", 
                        keyboard: "", 
                        conversation_message_id: context.conversationMessageId 
                    });
                }
                
                const bot = members.items.find(m => m.member_id == -GROUP_ID || m.member_id == GROUP_ID);
                
                if (payload.cmd === 'activate_bot' && !(bot && bot.is_admin)) {
                    return await vk.api.messages.edit({ 
                        peer_id: context.peerId, 
                        message: "❌ Сделайте меня админом.", 
                        keyboard: "", 
                        conversation_message_id: context.conversationMessageId 
                    });
                }
                
                return await vk.api.messages.edit({ 
                    peer_id: context.peerId, 
                    message: payload.cmd === 'activate_bot' ? "🎉 Подключено! /help" : "❌ Отменено.", 
                    keyboard: "", 
                    conversation_message_id: context.conversationMessageId 
                });
            } catch (e) { 
                return await vk.api.messages.edit({ 
                    peer_id: context.peerId, 
                    message: "❌ Ошибка.", 
                    keyboard: "", 
                    conversation_message_id: context.conversationMessageId 
                }); 
            }
        }

        if (payload.cmd === 'top_menu') {
            const type = payload.type, scope = payload.scope, repType = payload.repType || 'pos';
            let orderBy = "balance DESC", filter = "balance > 2";
            
            if (type === 'rep') { 
                orderBy = repType === 'pos' ? "reputation DESC" : "reputation ASC"; 
                filter = repType === 'pos' ? "reputation > 0" : "reputation < 0"; 
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
                const c = await dbAll("SELECT user_id FROM chat_messages WHERE peer_id = ?", [String(context.peerId)]);
                
                if (c.length > 0) {
                    rows = await dbAll(`SELECT user_id, balance, reputation, level, xp, duel_wins, bonus_count FROM users WHERE user_id IN (${c.map(u => `'${u.user_id}'`).join(',')}) AND ${filter} ORDER BY ${orderBy} LIMIT 10`);
                }
            }
            
            if (rows.length === 0) {
                return await vk.api.messages.edit({ 
                    peer_id: context.peerId, 
                    message: "❌ Топ пуст.", 
                    keyboard: getTopKb(payload.author, type, scope, repType), 
                    conversation_message_id: context.conversationMessageId 
                });
            }
            
            const uInfo = await vk.api.users.get({ user_ids: rows.map(r => r.user_id).join(','), fields: 'deactivated' });
            
            let title = `🏆 ТОП 10 (${scope === 'global' ? 'Общий' : 'В беседе'})\n` + (type === 'coins' ? "🪙 По монетам\n\n" : type === 'level' ? "✨ По лигам (уровням)\n\n" : type === 'duels' ? "⚔️ По дуэлям\n\n" : type === 'bonus' ? "🎁 По бонусам\n\n" : `🇮🇹 По репутации\n\n`);
            let txt = title, count = 0, em = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
            
            for (const r of rows) { 
                const u = uInfo.find(us => us.id == r.user_id); 
                
                if (u && !u.deactivated) { 
                    let val = type === 'coins' ? `${formatMoney(r.balance)}` : type === 'level' ? `${r.level}` : type === 'rep' ? `${r.reputation > 0 ? '+' : ''}${r.reputation}` : type === 'duels' ? `${r.duel_wins}` : `${r.bonus_count}`; 
                    txt += `${em[count++]} ${u.first_name} ${u.last_name || ''} - ${val}\n`; 
                } 
            }
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: txt, 
                keyboard: getTopKb(payload.author, type, scope, repType), 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'top_back') {
            const rows = await dbAll("SELECT user_id, count FROM chat_messages WHERE peer_id = ? ORDER BY count DESC LIMIT 10", [String(context.peerId)]);
            let txt = "⭐ ТОП 10 ПО СООБЩЕНИЯМ\n\n";
            
            if (rows.length > 0) { 
                const uInfo = await vk.api.users.get({ user_ids: rows.map(r => r.user_id).join(','), fields: 'deactivated' }); 
                let c = 0, em = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]; 
                
                for (const r of rows) { 
                    const u = uInfo.find(us => us.id == r.user_id); 
                    
                    if (u && !u.deactivated) {
                        txt += `${em[c++]} ${u.first_name} ${u.last_name || ''} - ${r.count}\n`; 
                    }
                } 
            } else {
                txt += "Пусто.";
            }
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: txt, 
                keyboard: getTopKb(payload.author, 'coins', 'chat'), 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'duel_accept') {
            const row = await dbGet("SELECT challenger, bet FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
            
            if (row) {
                if (String(userId) === row.challenger) {
                    return await vk.api.messages.edit({ 
                        peer_id: context.peerId, 
                        message: "❌ Нельзя с собой.", 
                        keyboard: "", 
                        conversation_message_id: context.conversationMessageId 
                    });
                }
                
                if (await getBalance(userId) < row.bet) {
                    return await vk.api.messages.edit({ 
                        peer_id: context.peerId, 
                        message: "❌ Мало денег.", 
                        keyboard: "", 
                        conversation_message_id: context.conversationMessageId 
                    });
                }
                
                const win = Math.random() < 0.5 ? parseInt(row.challenger) : userId, lose = win === userId ? parseInt(row.challenger) : userId, prize = Math.floor(row.bet * 1.8);
                
                await updateBalance(win, prize); 
                await updateBalance(lose, -row.bet); 
                await dbRun("UPDATE users SET duel_wins = duel_wins + 1 WHERE user_id = ?", [String(win)]); 
                await dbRun("DELETE FROM active_duels WHERE msg_id = ?", [payload.duel_id]);
                
                return await vk.api.messages.edit({ 
                    peer_id: context.peerId, 
                    message: `⚔️ Дуэль!\n🏆 Победитель: ${await getFullName(win)}\n💰 Выигрыш: ${prize}$`, 
                    keyboard: "", 
                    conversation_message_id: context.conversationMessageId 
                });
            }
        }

        if (payload.cmd === 'mines_set') {
            const row = await dbGet("SELECT bet FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            
            if (!row) {
                return;
            }
            
            const arr = []; 
            
            while(arr.length < payload.count) { 
                const r = Math.floor(Math.random() * 9) + 1; 
                if (!arr.includes(r)) {
                    arr.push(r); 
                }
            }
            
            const now = Date.now(); 
            await dbRun("UPDATE games SET mines = ?, opened = '[]', multiplier = 1.0, start_time = ? WHERE game_id = ?", [JSON.stringify(arr), now, String(payload.gameId)]);
            
            const ui = getMinesGameUI(String(payload.gameId), row.bet, payload.count, arr, [], false, null, await getFullName(userId), await getBalance(userId), 60);
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: ui.text, 
                keyboard: ui.kb, 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'mines_click') {
            const row = await dbGet("SELECT bet, mines, opened, multiplier, start_time FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            
            if (!row) {
                return;
            }
            
            const mines = JSON.parse(row.mines), opened = JSON.parse(row.opened);
            
            if (Date.now() - row.start_time > 60000) { 
                await updateBalance(userId, -row.bet); 
                await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]); 
                return await vk.api.messages.edit({ 
                    peer_id: context.peerId, 
                    message: "💥 Время вышло!", 
                    keyboard: "", 
                    conversation_message_id: context.conversationMessageId 
                }); 
            }
            
            if (opened.includes(Number(payload.cell))) {
                return;
            }
            
            opened.push(Number(payload.cell)); 
            let isL = false, hit = null;
            
            if (mines.includes(Number(payload.cell))) { 
                isL = true; 
                hit = Number(payload.cell); 
                await updateBalance(userId, -row.bet); 
                await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]); 
            } else { 
                let cm = 1.0; 
                
                for (let i = 0; i < opened.length; i++) {
                    cm *= (9 - i) / (9 - mines.length - i); 
                }
                
                cm = Math.round(cm * 0.95 * 100) / 100; 
                
                if (opened.length === (9 - mines.length)) { 
                    await updateBalance(userId, Math.floor(row.bet * cm)); 
                    await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]); 
                    isL = true; 
                    hit = -1; 
                } else {
                    await dbRun("UPDATE games SET opened = ?, multiplier = ? WHERE game_id = ?", [JSON.stringify(opened), cm, String(payload.gameId)]); 
                }
            }
            
            const ui = getMinesGameUI(String(payload.gameId), row.bet, mines.length, mines, opened, isL, hit, await getFullName(userId), await getBalance(userId), Math.max(0, Math.floor((60000 - (Date.now() - row.start_time)) / 1000)));
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: ui.text, 
                keyboard: ui.kb, 
                conversation_message_id: context.conversationMessageId 
            });
        }

        if (payload.cmd === 'mines_cashout') {
            const row = await dbGet("SELECT bet, multiplier, mines, opened FROM games WHERE game_id = ? AND user_id = ?", [String(payload.gameId), String(userId)]);
            
            if (!row) {
                return;
            }
            
            const opened = JSON.parse(row.opened);
            
            if (opened.length === 0) {
                return; 
            }
            
            const win = Math.floor(row.bet * row.multiplier); 
            await updateBalance(userId, win); 
            await dbRun("DELETE FROM games WHERE game_id = ?", [String(payload.gameId)]);
            
            return await vk.api.messages.edit({ 
                peer_id: context.peerId, 
                message: `💰 Забрал ${win}$\n💳 Баланс: ${formatMoney(await getBalance(userId))}$`, 
                keyboard: buildMinesKb(String(payload.gameId), opened, JSON.parse(row.mines), true, null), 
                conversation_message_id: context.conversationMessageId 
            });
        }

    } catch (e) { 
        console.error("КРИТИЧЕСКАЯ Ошибка в кнопках:", e); 
        await safeAnswer({ type: 'show_snackbar', text: '⚠️ Ошибка. Попробуйте позже.' }); 
    }
});

// ============================================================================
// БЛОК ЗАПУСКА БОТА
// ============================================================================

console.log("ПОПЫТКА ЗАПУСКА БОТА...");

vk.updates.startPolling().then(() => {
    console.log("--- БОТ УСПЕШНО ЗАПУЩЕН (LONGPOLL) ---");
}).catch(err => {
    console.error("ОШИБКА ПРИ СТАРТЕ:", err);
});
