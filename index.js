const { VK, Keyboard } = require('vk-io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const https = require('https');

const TOKEN = process.env.TOKEN || "vk1.a.AP1n2HYshIvxjIs4zgHk-8D9YhA5TfocGLGiegFtOPtiBsDsxtU2RY_4muinefxI4qPxKyUB-WaLyKE1BrqAYzPWmxWEBPCvmEoF4AESV9yVn1QOr_OglVaHUxk9ndwasEkxw7lZhl2POVPxMwY20-YsY1OKffhMa62Wn-lv-BoGsG9YmZE6CisTD2_AdJ4FniwDIIQsLajcxjzxW2U3S8YdITWeuQ2GKNmb1657HM0";
const GROUP_ID = 243089386;
const ADMIN_ID = 200005093141;
const BONUS_CD = 86400, FORTUNA_CD = 600;
const DEFAULT_PROFILE_PHOTO = 'https://sun9-72.vkuserphoto.ru/s/v1/ig2/YNkLzyOfJjTTcjgSSuMgbqiNkNAf5lsXNkJ6PBZnpvPh3t6M2OX2KugvgTnTniTxhlNgbc2daekc1IqxA0LPwUMb.jpg?quality=95';
const ROULETTE_PHOTOS = ['https://vk.ru/photo-221392393_458171207'];

const vk = new VK({ token: TOKEN, apiVersion: '5.199', pollingGroupId: GROUP_ID });
const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const DB_FILE = path.join(DATA_DIR, 'game.db');
const db = new sqlite3.Database(DB_FILE);
const dbRun = (q,p=[]) => new Promise((r,j)=>db.run(q,p,function(e){e?j(e):r(this);}));
const dbGet = (q,p=[]) => new Promise((r,j)=>db.get(q,p,(e,x)=>e?j(e):r(x)));
const dbAll = (q,p=[]) => new Promise((r,j)=>db.all(q,p,(e,x)=>e?j(e):r(x)));

const gameCooldowns = new Map(), adminStates = new Map(), spamCache = new Map(), chsbNotifyCache = new Map(), activeMathGames = new Map();

const BIZ_DATA = {
 'шаурма':{name:'🌯 Шаурма',price:500000,baseIncome:2000},'кафе':{name:'☕ Кафе',price:1500000,baseIncome:4000},
 'game zone':{name:'🕹️ Отдел Game Zone',price:5000000,baseIncome:6000},'казино':{name:'🎰 Казино',price:15000000,baseIncome:10000},
 'пятерочка':{name:'🏪 24/7 Пятёрочка',price:50000000,baseIncome:15000}
};
const CARS_DATA = {
 'м5 ф90':{name:'BMW M5 F90',price:15000000,sellPrice:10000000},'м5 ф10':{name:'BMW M5 F10',price:8000000,sellPrice:5000000},
 'м3':{name:'BMW M3 G80',price:12000000,sellPrice:8000000},'мерседес':{name:'Mercedes-Benz E-Class',price:10000000,sellPrice:6000000},
 'ауди':{name:'Audi RS7',price:18000000,sellPrice:12000000},'ламборгини':{name:'Lamborghini Huracan',price:35000000,sellPrice:25000000},
 'порше':{name:'Porsche 911 Turbo',price:28000000,sellPrice:20000000}
};
const PROPERTY_DATA = {
 'нижегородская':{name:'Нижегородская',housePrice:5000000,garagePrice:1000000},'рублевка':{name:'Рублевка',housePrice:25000000,garagePrice:5000000},
 'егоровка':{name:'Егоровка',housePrice:50000000,garagePrice:10000000},'гарель':{name:'Гарель',housePrice:100000000,garagePrice:20000000}
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
 await dbRun("CREATE TABLE IF NOT EXISTS phones (number TEXT PRIMARY KEY, user_id TEXT UNIQUE)");
 for (const q of [
  "ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0","ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1","ALTER TABLE users ADD COLUMN reg_date TEXT",
  "ALTER TABLE users ADD COLUMN duel_wins INTEGER DEFAULT 0","ALTER TABLE users ADD COLUMN bonus_count INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN car TEXT DEFAULT NULL","ALTER TABLE users ADD COLUMN last_bonus_date TEXT",
  "ALTER TABLE users ADD COLUMN bonus_streak INTEGER DEFAULT 0","ALTER TABLE businesses ADD COLUMN last_withdraw INTEGER DEFAULT 0",
  "ALTER TABLE games ADD COLUMN start_time INTEGER","ALTER TABLE blacklist ADD COLUMN until INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT 'Нет'"
 ]) { try{await dbRun(q);}catch(e){} }
 await dbRun("INSERT OR IGNORE INTO settings (key,value) VALUES ('antispam_enabled','0')");
 await dbRun("INSERT OR IGNORE INTO settings (key,value) VALUES ('antispam_limit','5')");
 await dbRun("INSERT OR IGNORE INTO settings (key,value) VALUES ('antispam_time','60')");
 await dbRun("INSERT OR IGNORE INTO settings (key,value) VALUES ('antispam_mute','10')");
}
initDB();

function parseAmount(s){
 if(!s)return 0; s=String(s).toLowerCase().replace(/\s/g,'');
 if(s.endsWith('всё')||s.endsWith('все')||s.endsWith('вб'))return 'ALL';
 let m=1;
 if(s.endsWith('кккк')||s.endsWith('kkkk')){m=1e12;s=s.slice(0,-4);}
 else if(s.endsWith('ккк')||s.endsWith('kkk')){m=1e9;s=s.slice(0,-3);}
 else if(s.endsWith('кк')||s.endsWith('kk')){m=1e6;s=s.slice(0,-2);}
 else if(s.endsWith('к')||s.endsWith('k')){m=1000;s=s.slice(0,-1);}
 else if(s.endsWith('м')||s.endsWith('m')){m=1e6;s=s.slice(0,-1);}
 const n=parseFloat(s.replace(',','.')); return isNaN(n)?0:Math.floor(n*m);
}
function formatMoney(n){n=Number(n);if(isNaN(n)||!isFinite(n))n=0;return n.toLocaleString('ru-RU');}
function formatShortMoney(n){
 if(n>=1e12)return (n/1e12).toFixed(2).replace(/\.00$/,'')+'кккк';
 if(n>=1e9)return (n/1e9).toFixed(2).replace(/\.00$/,'')+'ккк';
 if(n>=1e6)return (n/1e6).toFixed(2).replace(/\.00$/,'')+'кк';
 if(n>=1000)return (n/1000).toFixed(2).replace(/\.00$/,'')+'к';
 return n.toString();
}
async function getBalance(id){
 const r=await dbGet("SELECT balance FROM users WHERE user_id=?",[String(id)]);
 if(!r){await dbRun("INSERT INTO users (user_id,balance) VALUES (?,1000)",[String(id)]);return 1000;}
 const b=Number(r.balance); if(isNaN(b)||!isFinite(b)){await dbRun("UPDATE users SET balance=0 WHERE user_id=?",[String(id)]);return 0;} return b;
}
async function updateBalance(id,amt){
 const b=await getBalance(id); let a=Number(amt); if(isNaN(a)||!isFinite(a))a=0;
 await dbRun("UPDATE users SET balance=? WHERE user_id=?",[Math.floor(b+a),String(id)]);
}
async function getReputation(id){
 const r=await dbGet("SELECT reputation FROM users WHERE user_id=?",[String(id)]); return r?(Number(r.reputation)||0):0;
}
async function updateReputation(id,amt){const r=await getReputation(id);await dbRun("UPDATE users SET reputation=? WHERE user_id=?",[r+amt,String(id)]);}
async function getFullName(id){try{const[u]=await vk.api.users.get({user_ids:id});return `[id${id}|${u.first_name} ${u.last_name||''}]`;}catch{return `[id${id}|Игрок]`;}}

async function getTargetAndReason(message,cmd){
 let tid=null, text=message.text||'', reason=text.replace(new RegExp(`^\\/?${cmd}\\s*`,'i'),'');
 if(message.hasReplyMessage){tid=message.replyMessage.senderId;}
 else{
  const m1=reason.match(/\[id(\d+)\|[^\]]+\]/i);
  if(m1){tid=parseInt(m1[1]);reason=reason.replace(m1[0],'');}
  else{
   const m2=reason.match(/@id(\d+)/i);
   if(m2){tid=parseInt(m2[1]);reason=reason.replace(m2[0],'');}
   else{
    const m3=reason.match(/(?:https?:\/\/)?(?:vk\.com|vk\.ru)\/([a-zA-Z0-9._]+)/i);
    if(m3){try{const r=await vk.api.utils.resolveScreenName({screen_name:m3[1]});if(r.type==='user'||r.type==='group')tid=r.object_id;}catch(e){}reason=reason.replace(m3[0],'');}
    else{
     const m4=reason.match(/@([a-zA-Z0-9._]+)/i);
     if(m4){try{const r=await vk.api.utils.resolveScreenName({screen_name:m4[1]});if(r.type==='user')tid=r.object_id;}catch(e){}reason=reason.replace(m4[0],'');}
    }
   }
  }
 }
 reason=reason.replace(/[\[\]]/g,'').replace(/"/g,'').trim();
 if(!reason)reason="Причина не указана";
 return{tid,reason};
}

let _fontCache=null;
async function getCyrillicFont(){
 if(_fontCache)return _fontCache;
 const dir=path.join(DATA_DIR,'fonts'); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
 const fnt=path.join(dir,'open-sans-32-white.fnt'), png=path.join(dir,'open-sans-32-white.png');
 const base='https://cdn.jsdelivr.net/gh/Fluffffy/jimp-cyrillic-fonts@master/fonts/open-sans-32-white/open-sans-32-white';
 const dl=(url,dest)=>new Promise((res,rej)=>{const f=fs.createWriteStream(dest);https.get(url,r=>{if(r.statusCode!==200)return rej(new Error('HTTP '+r.statusCode));r.pipe(f);f.on('finish',()=>f.close(res));}).on('error',e=>{fs.unlink(dest,()=>{});rej(e);});});
 try{
  if(!fs.existsSync(fnt)||fs.statSync(fnt).size<100)await dl(base+'.fnt',fnt);
  if(!fs.existsSync(png)||fs.statSync(png).size<100)await dl(base+'.png',png);
  _fontCache=await Jimp.loadFont(fnt); console.log('✅ Шрифт загружен');
 }catch(e){console.error('⚠️ Шрифт fallback:',e.message);_fontCache=await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);}
 return _fontCache;
}

async function generateProfileImage(id){
 try{
  const[u]=await vk.api.users.get({user_ids:id,fields:'photo_200,photo_max_orig'});
  const name=(`${u.first_name||''} ${u.last_name||''}`).trim()||'Игрок';
  const url=u.photo_200||u.photo_max_orig||DEFAULT_PROFILE_PHOTO;
  const cv=new Jimp(400,450,0x101010FF);
  try{const a=await Jimp.read(url);a.cover(400,400);cv.composite(a,0,0);}catch(e){console.error('Аватар fallback:',e.message);}
  cv.composite(new Jimp(400,50,0x000000B0),0,400);
  const f=await getCyrillicFont();
  cv.print(f,0,400,{text:name,alignmentX:Jimp.HORIZONTAL_ALIGN_CENTER,alignmentY:Jimp.VERTICAL_ALIGN_MIDDLE},400,50);
  return await cv.getBufferAsync(Jimp.MIME_PNG);
 }catch(e){console.error('Ошибка фото:',e);return null;}
}

function buildMinesKb(gid,opened,mines=[],over=false,hit=null,cm=0){
 const kb=Keyboard.builder().inline();
 for(let i=1;i<=9;i++){
  if(over){
   if(i===hit)kb.callbackButton({label:'💥',payload:{cmd:'none'},color:Keyboard.NEGATIVE_COLOR});
   else if(mines.includes(i))kb.callbackButton({label:'💣',payload:{cmd:'none'},color:Keyboard.NEGATIVE_COLOR});
   else if(opened.includes(i))kb.callbackButton({label:'✅',payload:{cmd:'none'},color:Keyboard.POSITIVE_COLOR});
   else kb.callbackButton({label:'⬜',payload:{cmd:'none'},color:Keyboard.SECONDARY_COLOR});
  }else{
   if(opened.includes(i))kb.callbackButton({label:'✅',payload:{cmd:'none'},color:Keyboard.POSITIVE_COLOR});
   else kb.callbackButton({label:'❓',payload:{cmd:'mines_click',gameId:String(gid),cell:String(i)},color:Keyboard.SECONDARY_COLOR});
  }
  if(i%3===0&&i!==9)kb.row();
 }
 if(!over&&cm>0&&opened.length>0)kb.row().callbackButton({label:`💰 Забрать ${formatMoney(cm)}`,payload:{cmd:'mines_cashout',gameId:String(gid)},color:Keyboard.POSITIVE_COLOR});
 return kb.toString();
}

function getMinesGameUI(gid,bet,minesCnt,minesArr,opened,loss=false,hit=null,name='',bal=0,tl=60){
 const totalSafe=9-minesCnt,cnt=opened.length;
 let cm=1; for(let i=0;i<cnt;i++)cm*=(9-i)/(9-minesCnt-i);
 cm=Math.round(cm*0.95*100)/100; const cmoney=Math.floor(bet*cm);
 let nm=1; if(cnt<totalSafe){for(let i=0;i<=cnt;i++)nm*=(9-i)/(9-minesCnt-i);nm=Math.round(nm*0.95*100)/100;}
 const nmoney=Math.floor(bet*nm);
 const chance=Math.floor(((9-minesCnt-cnt)/(9-cnt))*100);
 const bar="🟩".repeat(cnt)+"⬜".repeat(totalSafe-cnt);
 if(loss)return{text:`💥 БАБАХ! ПОРАЖЕНИЕ\n────────────────────\n👤 ${name}\n💣 Мин: ${minesCnt}\n✅ Открыто: ${cnt}\n\n📉 Потеряно: -${formatMoney(bet)} 💰\n😢 Не забрал: ${formatMoney(cmoney)} 💰 (x${cm})\n💳 Баланс: ${formatMoney(bal)} 💰\n\n💬 Бывает. Следующая будет твоей 🍀`,kb:buildMinesKb(gid,opened,minesArr,true,hit)};
 const ph=['Выбирай клетку! Первый ход — самый волнующий 😈','Чисто! Сапёр бы гордился 👏','Ещё немного, и можно забирать 💸','Осторожно, мины рядом... 💣','Фортуна улыбается тебе 😉'];
 const p=cnt===0?ph[0]:ph[Math.floor(Math.random()*(ph.length-1))+1];
 return{text:`💣 МИНЫ\n────────────────────\n👤 ${name}\n💵 Ставка: ${formatMoney(bet)} | 💣 Мин: ${minesCnt}\n\n${bar} ${cnt}/${totalSafe}\n📈 Сейчас: x${cm.toFixed(2)} → ${formatMoney(cmoney)} 💰\n🎯 Далее: x${nm.toFixed(2)} → ${formatMoney(nmoney)} 💰\n🍀 Шанс: ${chance}%\n⏱ ${tl} сек.\n\n💬 ${p}`,kb:buildMinesKb(gid,opened,minesArr,false,null,cmoney)};
}

const mainKb = Keyboard.builder().textButton({label:'💼 Работа',payload:'work',color:Keyboard.POSITIVE_COLOR}).textButton({label:'🎰 Рулетка',payload:'roulette',color:Keyboard.PRIMARY_COLOR}).row().textButton({label:'👤 Профиль',payload:'profile',color:Keyboard.SECONDARY_COLOR}).textButton({label:'🏆 Топ',payload:'top',color:Keyboard.SECONDARY_COLOR});
const getWorkKb=()=>Keyboard.builder().inline().callbackButton({label:'🎣 Рыбалка',payload:{cmd:'work_do',type:'Рыбалка'},color:Keyboard.POSITIVE_COLOR}).callbackButton({label:'🚕 Такси',payload:{cmd:'work_do',type:'Такси'},color:Keyboard.POSITIVE_COLOR}).callbackButton({label:'🔫 Охота',payload:{cmd:'work_do',type:'Охота'},color:Keyboard.POSITIVE_COLOR}).toString();
const getCasinoKb=()=>Keyboard.builder().inline().callbackButton({label:'Рулетка',payload:{cmd:'casino_info',game:'roulette'},color:Keyboard.SECONDARY_COLOR}).callbackButton({label:'Краш',payload:{cmd:'casino_info',game:'crash'},color:Keyboard.SECONDARY_COLOR}).row().callbackButton({label:'Монетка',payload:{cmd:'casino_info',game:'coin'},color:Keyboard.SECONDARY_COLOR}).callbackButton({label:'Стакан',payload:{cmd:'casino_info',game:'glass'},color:Keyboard.SECONDARY_COLOR}).row().callbackButton({label:'Кубик',payload:{cmd:'casino_info',game:'dice'},color:Keyboard.SECONDARY_COLOR}).callbackButton({label:'Автомат',payload:{cmd:'casino_info',game:'slot'},color:Keyboard.SECONDARY_COLOR}).row().callbackButton({label:'Блэкджек',payload:{cmd:'casino_info',game:'blackjack'},color:Keyboard.NEGATIVE_COLOR}).callbackButton({label:'Дрим',payload:{cmd:'casino_info',game:'dream'},color:Keyboard.NEGATIVE_COLOR}).toString();
const getHelpKb=()=>Keyboard.builder().inline().callbackButton({label:'🎰 Игры',payload:{cmd:'help_menu',section:'games'},color:Keyboard.PRIMARY_COLOR}).callbackButton({label:'💼 Экономика',payload:{cmd:'help_menu',section:'eco'},color:Keyboard.SECONDARY_COLOR}).row().callbackButton({label:'🏠 Дома',payload:{cmd:'help_menu',section:'houses'},color:Keyboard.SECONDARY_COLOR}).callbackButton({label:'🏘️ Гаражи',payload:{cmd:'help_menu',section:'garages'},color:Keyboard.SECONDARY_COLOR}).row().callbackButton({label:'👤 Профиль',payload:{cmd:'help_menu',section:'profile'},color:Keyboard.SECONDARY_COLOR}).toString();
const getHelpBackKb=()=>Keyboard.builder().inline().callbackButton({label:'🔙 Назад',payload:{cmd:'help_start'},color:Keyboard.SECONDARY_COLOR}).toString();
const getSettingsKb=(en,lim,t,m)=>{const kb=Keyboard.builder().inline();kb.callbackButton({label:'🟢 Включить',payload:{cmd:'settings_toggle',state:'1'},color:en==='1'?Keyboard.POSITIVE_COLOR:Keyboard.SECONDARY_COLOR});kb.callbackButton({label:'🔴 Выключить',payload:{cmd:'settings_toggle',state:'0'},color:en==='0'?Keyboard.NEGATIVE_COLOR:Keyboard.SECONDARY_COLOR});kb.row().callbackButton({label:`Лимит: ${lim}`,payload:{cmd:'settings_edit',field:'limit'},color:Keyboard.SECONDARY_COLOR}).callbackButton({label:`Время: ${t}с`,payload:{cmd:'settings_edit',field:'time'},color:Keyboard.SECONDARY_COLOR});kb.row().callbackButton({label:`Мут: ${m}м`,payload:{cmd:'settings_edit',field:'mute'},color:Keyboard.SECONDARY_COLOR});return kb.toString();};
const getDuelKb=(did)=>Keyboard.builder().inline().callbackButton({label:'⚔️ Сразиться',payload:{cmd:'duel_accept',duel_id:did},color:Keyboard.POSITIVE_COLOR}).toString();
const getMinesCountKb=(gid)=>{const kb=Keyboard.builder().inline();for(let i=2;i<=8;i++){kb.callbackButton({label:`${i} 💣`,payload:{cmd:'mines_set',gameId:String(gid),count:String(i)},color:Keyboard.SECONDARY_COLOR});if((i-1)%4===0&&i!==8)kb.row();}return kb.toString();};
const getBizKb=(aid)=>Keyboard.builder().inline().callbackButton({label:'Повысить уровень',payload:{cmd:'biz_upgrade',author:aid},color:Keyboard.SECONDARY_COLOR}).toString();
const getTopKb=(aid,type='coins',scope='chat',rt='pos')=>{const kb=Keyboard.builder().inline();kb.callbackButton({label:'💰 Баланс',payload:{cmd:'top_menu',type:'coins',scope,repType:rt,author:aid},color:type==='coins'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR});kb.callbackButton({label:'📊 Уровень',payload:{cmd:'top_menu',type:'level',scope,repType:rt,author:aid},color:type==='level'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR});kb.callbackButton({label:'⭐ Репутация',payload:{cmd:'top_menu',type:'rep',scope,repType:rt,author:aid},color:type==='rep'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR});kb.row().callbackButton({label:'⚔️ Дуэли',payload:{cmd:'top_menu',type:'duels',scope,repType:rt,author:aid},color:type==='duels'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR}).callbackButton({label:'🎁 Бонус',payload:{cmd:'top_menu',type:'bonus',scope,repType:rt,author:aid},color:type==='bonus'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR});kb.row();if(type==='rep'){kb.callbackButton({label:'➕ Положит.',payload:{cmd:'top_menu',type:'rep',scope,repType:'pos',author:aid},color:rt==='pos'?Keyboard.POSITIVE_COLOR:Keyboard.SECONDARY_COLOR}).callbackButton({label:'➖ Отрицат.',payload:{cmd:'top_menu',type:'rep',scope,repType:'neg',author:aid},color:rt==='neg'?Keyboard.NEGATIVE_COLOR:Keyboard.SECONDARY_COLOR}).row();}kb.callbackButton({label:'🌍 Общее',payload:{cmd:'top_menu',type,scope:'global',repType:rt,author:aid},color:scope==='global'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR}).callbackButton({label:'💬 В беседе',payload:{cmd:'top_menu',type,scope:'chat',repType:rt,author:aid},color:scope==='chat'?Keyboard.PRIMARY_COLOR:Keyboard.SECONDARY_COLOR});kb.row().callbackButton({label:'🔙 Назад',payload:{cmd:'top_back',author:aid},color:Keyboard.SECONDARY_COLOR});return kb.toString();};
async function getRouletteAttachment(){if(!ROULETTE_PHOTOS.length)return null;const url=ROULETTE_PHOTOS[Math.floor(Math.random()*ROULETTE_PHOTOS.length)];try{const u=await vk.upload.messagePhoto({source:{value:url}});return u.toString();}catch(e){console.error('Фото рулетки:',e);return null;}}
vk.updates.on('chat_invite_user', async (context) => {
    if (context.memberId > 0) {
        const gb = await dbGet("SELECT reason, until FROM blacklist WHERE user_id=?", [String(context.memberId)]);
        if (gb) {
            if (gb.until !== 0 && Date.now() > gb.until) { await dbRun("DELETE FROM blacklist WHERE user_id=?", [String(context.memberId)]); }
            else { try { await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID }); } catch(e) {} return; }
        }
        const cb = await dbGet("SELECT reason FROM chat_bans WHERE user_id=? AND peer_id=?", [String(context.memberId), String(context.peerId)]);
        if (cb) {
            try {
                await vk.api.messages.removeChatUser({ chat_id: context.peerId - 2000000000, user_id: context.memberId, group_id: GROUP_ID });
                await vk.api.messages.send({ peer_id: context.peerId, message: `🚫 [id${context.memberId}|Игрок] исключён (бан в беседе).\n📌 ${cb.reason}`, random_id: Math.floor(Math.random()*1e9), disable_mentions: 1 });
            } catch(e) {}
        }
    }
    if (String(context.memberId) === String(-GROUP_ID)) {
        const kb = Keyboard.builder().inline()
            .callbackButton({ label: 'Активировать', payload: { cmd: 'activate_bot' }, color: Keyboard.POSITIVE_COLOR })
            .callbackButton({ label: 'Не активировать', payload: { cmd: 'decline_bot' }, color: Keyboard.NEGATIVE_COLOR });
        try { await vk.api.messages.send({ peer_id: context.peerId, message: "Привет! Я бот Game Zone. Выдайте права администратора и напишите /start.", keyboard: kb.toString(), random_id: Math.floor(Math.random()*1e9), group_id: GROUP_ID, disable_mentions: 1 }); } catch(e) {}
    }
});

setInterval(async () => {
    try {
        const chats = await dbAll("SELECT DISTINCT peer_id FROM chat_messages");
        for (const row of chats) {
            const pid = row.peer_id;
            if (Number(pid) < 2000000000) continue;
            const a = Math.floor(Math.random()*100), b = Math.floor(Math.random()*100);
            const plus = Math.random() > 0.5, ans = plus ? a + b : a - b;
            let rw = 10000, df = '📗 Легкий';
            if (a > 50 || b > 50) { rw = 50000; df = '📙 Средний'; }
            if (a > 80 && b > 80) { rw = 100000; df = '📕 Сложный'; }
            activeMathGames.set(String(pid), { answer: ans, reward: rw });
            try { await vk.api.messages.send({ peer_id: pid, message: `${df} пример!\n⏳ ${a} ${plus?'+':'-'} ${b} = ?\n🎁 ${formatMoney(rw)} монет\n\n➡️ Первый правильный ответ получает приз!`, random_id: Math.floor(Math.random()*1e9), disable_mentions: 1 }); } catch(e) {}
        }
    } catch(e) { console.error('math:', e); }
}, 10 * 60 * 1000);

vk.updates.on('message_new', async (message) => {
    if (message.isOutbox || message.senderId < 0) return;
    try {
        const text = message.text ? message.text.trim().toLowerCase() : '';
        if (!text) return;
        const userId = message.senderId, peerId = message.peerId, isLs = peerId === userId;
        const cleanText = text.replace(/\//g, '').trim();
        const parts = cleanText.split(/\s+/);
        const cmdWord = parts[0];

        if (userId !== ADMIN_ID) {
            const fz = await dbGet("SELECT user_id FROM frozen WHERE user_id=?", [String(userId)]);
            if (fz) return await message.reply("💀 Вы заморожены.");
        }
        if (userId !== ADMIN_ID) {
            const bl = await dbGet("SELECT reason, until FROM blacklist WHERE user_id=?", [String(userId)]);
            if (bl) {
                if (bl.until !== 0 && Date.now() > bl.until) { await dbRun("DELETE FROM blacklist WHERE user_id=?", [String(userId)]); }
                else {
                    const ck = `chsb_${userId}`;
                    if (!chsbNotifyCache.has(ck) || Date.now() - chsbNotifyCache.get(ck) > 60000) {
                        chsbNotifyCache.set(ck, Date.now());
                        const ts = bl.until === 0 ? "НАВСЕГДА" : `до ${new Date(bl.until).toLocaleString('ru-RU')}`;
                        const bk = Keyboard.builder().inline().urlButton({ label: 'Разбан', url: `https://vk.ru/topic-243089386_69303056` }).row().urlButton({ label: 'Правила', url: `https://vk.com/public${GROUP_ID}` });
                        try { await vk.api.messages.send({ peer_id: peerId, message: `😈 ЧС ${ts}.\n${bl.reason}`, keyboard: bk.toString(), random_id: Math.floor(Math.random()*1e9), disable_mentions: 1 }); } catch(e) {}
                    }
                    return;
                }
            }
        }
        if (message.isChat && userId !== ADMIN_ID) {
            const am = await dbGet("SELECT mute_until FROM mutes WHERE user_id=? AND peer_id=?", [String(userId), String(peerId)]);
            if (am) {
                if (Date.now() < am.mute_until) {
                    try { await vk.api.messages.delete({ peer_id: peerId, cmids: [message.conversationMessageId], delete_for_all: 1 }); }
                    catch(e) { try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e2) {} }
                    return;
                } else { await dbRun("DELETE FROM mutes WHERE user_id=? AND peer_id=?", [String(userId), String(peerId)]); }
            }
        }
        if (message.isChat && userId !== ADMIN_ID) {
            const se = await dbGet("SELECT value FROM settings WHERE key='antispam_enabled'");
            if (se && se.value === '1') {
                const lim = Number((await dbGet("SELECT value FROM settings WHERE key='antispam_limit'"))?.value || 5);
                const ts = Number((await dbGet("SELECT value FROM settings WHERE key='antispam_time'"))?.value || 60);
                const mm = Number((await dbGet("SELECT value FROM settings WHERE key='antispam_mute'"))?.value || 10);
                const now = Date.now(), ck = `${peerId}_${userId}`;
                let sd = spamCache.get(ck) || { count: 0, lastReset: now, isMuted: false, muteEndTime: 0 };
                if (sd.isMuted) {
                    if (now < sd.muteEndTime) { try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e) {} return; }
                    else sd.isMuted = false;
                }
                if (now - sd.lastReset >= ts * 1000) { sd.count = 0; sd.lastReset = now; }
                sd.count++; spamCache.set(ck, sd);
                if (sd.count >= lim && !sd.isMuted) {
                    sd.isMuted = true; sd.muteEndTime = now + mm * 60000; spamCache.set(ck, sd);
                    try {
                        await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: userId, action: 'ro', for: mm * 60 });
                        await message.reply(`🚫 [id${userId}|Игрок] мут ${mm} мин (антиспам).`);
                        sd.count = 0; spamCache.set(ck, sd);
                        try { await vk.api.messages.delete({ message_ids: [message.id], delete_for_all: 1 }); } catch(e) {}
                    } catch(e) { sd.isMuted = false; spamCache.set(ck, sd); }
                }
            }
        }
        if (userId === ADMIN_ID && adminStates.has(userId)) {
            if (cleanText === 'отмена') { adminStates.delete(userId); return await message.reply("✅ Отменено."); }
            const st = adminStates.get(userId);
            const v = parseFloat(cleanText);
            if (!isNaN(v) && v > 0) {
                await dbRun("UPDATE settings SET value=? WHERE key=?", [String(v), st]);
                adminStates.delete(userId);
                const en = (await dbGet("SELECT value FROM settings WHERE key='antispam_enabled'")).value;
                const li = (await dbGet("SELECT value FROM settings WHERE key='antispam_limit'")).value;
                const ti = (await dbGet("SELECT value FROM settings WHERE key='antispam_time'")).value;
                const mu = (await dbGet("SELECT value FROM settings WHERE key='antispam_mute'")).value;
                return await message.reply(`✅ Сохранено.\nАнтиспам: ${en==='1'?'🟢':'🔴'}`, { keyboard: getSettingsKb(en, li, ti, mu) });
            } else return await message.reply("❌ Число > 0 или «отмена».");
        }
        if (activeMathGames.has(String(peerId)) && !text.startsWith('/')) {
            const g = activeMathGames.get(String(peerId));
            const ua = parseInt(text);
            if (!isNaN(ua) && ua === g.answer) {
                activeMathGames.delete(String(peerId));
                await updateBalance(userId, g.reward);
                const [u] = await vk.api.users.get({ user_ids: userId });
                return await message.reply({ message: `🎁 [id${userId}|${u.first_name} ${u.last_name || ''}] ответил правильно: +${formatMoney(g.reward)} монет!`, disable_mentions: 1 });
            }
        }
        const valid = ['стакан','кубик','монетка','дрим','краш','рулетка','рул','автомат','блэкджек','мины','топ','профиль','баланс','бизнес','машины','работа','бонус','фортуна','казино','help','помощь','команды','start','начать','transfer','перевод','duel','вывести','мойбизнес','закрыть','rep','реп','промолист','promo','купить','купитьбиз','чсб','разчсб','kick','выдать','обнулить','создать','cp','ping','пинг','убрать','настройки','дом','дома','гараж','гаражи','продать','бан','ban','kl','mute','unmute','размут','unban','разбан','заморозить','разморозить','снять','unfreeze','pr','sellcar','слить','дон','дондом','донгараж','sellhome','restart','рестарт'];
        if (!text.startsWith('/') && !valid.includes(cmdWord)) return;

        const ur = await dbGet("SELECT xp, level, reg_date FROM users WHERE user_id=?", [String(userId)]);
        if (!ur) { await dbRun("INSERT INTO users (user_id, balance, reg_date) VALUES (?, 1000, ?)", [String(userId), new Date().toLocaleDateString('ru-RU')]); }
        else {
            if (!ur.reg_date) await dbRun("UPDATE users SET reg_date=? WHERE user_id=?", [new Date().toLocaleDateString('ru-RU'), String(userId)]);
            let nx = (Number(ur.xp) || 0) + 40, nl = Number(ur.level) || 1;
            while (nx >= nl * 500) { nx -= nl * 500; nl++; }
            await dbRun("UPDATE users SET xp=?, level=? WHERE user_id=?", [nx, nl, String(userId)]);
        }
        if (message.isChat) {
            const ex = await dbGet("SELECT count FROM chat_messages WHERE peer_id=? AND user_id=?", [String(peerId), String(userId)]);
            if (ex) await dbRun("UPDATE chat_messages SET count=count+1 WHERE peer_id=? AND user_id=?", [String(peerId), String(userId)]);
            else await dbRun("INSERT INTO chat_messages (peer_id, user_id, count) VALUES (?, ?, 1)", [String(peerId), String(userId)]);
        }
        const balance = await getBalance(userId);
        const rep = await getReputation(userId);
        const rp = (kb) => { const p = { disable_mentions: 1 }; if (kb) p.keyboard = typeof kb === 'string' ? kb : kb.toString(); return p; };

        if (cmdWord === 'начать' || cmdWord === 'start') {
            if (message.isChat) {
                try {
                    const m = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                    const adm = m.items.find(x => x.member_id === userId && (x.is_admin || x.is_owner));
                    if (!adm && userId !== ADMIN_ID) return await message.reply("⚠️ Вы не админ беседы.", rp());
                    return await message.reply("✅ Бот активирован! /help", rp());
                } catch(e) { return await message.reply("⚠️ Убедитесь, что я админ.", rp()); }
            }
            return await message.reply("👋 Привет! Выбирай действие или /help.", rp(mainKb));
        }
        if (cmdWord === 'help' || cmdWord === 'помощь' || cmdWord === 'команды') return await message.reply("📖 Раздел:", rp(getHelpKb()));
        if (cmdWord === 'ping' || cmdWord === 'пинг') {
            const s = Date.now(); try { await vk.api.users.get({ user_ids: userId }); } catch(e) {}
            const p = Date.now() - s;
            return await message.reply(`🏓 ${p} мс ${p<150?'🟢':p<300?'🟡':'🔴'}`, rp());
        }
        if (cmdWord === 'профиль' || cmdWord === 'баланс') {
            const ui = await dbGet("SELECT xp, level, reg_date, car, phone FROM users WHERE user_id=?", [String(userId)]);
            const lvl = ui.level || 1, xp = ui.xp || 0;
            const dt = ui.reg_date || new Date().toLocaleDateString('ru-RU');
            const hd = await dbGet("SELECT location, tier FROM properties WHERE owner_id=? AND type='house'", [String(userId)]);
            const gd = await dbGet("SELECT location, tier FROM properties WHERE owner_id=? AND type='garage'", [String(userId)]);
            const txt = `🏠 Профиль ${await getFullName(userId)}\n\n💵 Баланс: ${formatMoney(balance)}$\n⭐ Репутация: ${rep}\n📊 Уровень: ${lvl} (${xp}/${lvl*500} XP)\n📱 Телефон: ${ui.phone || 'Нет'}\n\n🏠 Дом: ${hd ? `${hd.location} (Т${hd.tier})` : 'Нет'}\n🏘️ Гараж: ${gd ? `${gd.location} (Т${gd.tier})` : 'Нет'}\n🚗 Машина: ${ui.car || 'Нет'}\n\n📅 Регистрация: ${dt}\n🆔 ID: ${userId}`;
            let att = null;
            try { const pb = await generateProfileImage(userId); if (pb) { const up = await vk.upload.messagePhoto({ source: { value: pb } }); att = up.toString(); } } catch(e) { console.error('prof:', e); }
            return await message.reply({ message: txt, attachment: att || undefined, disable_mentions: 1 });
        }
        if (cmdWord === 'купить' && parts[1] === 'сим' && parts[2] === 'карту') {
            const num = parts[3];
            if (!num || !/^\d{4}$/.test(num)) return await message.reply('❌ 4 цифры. Пример: /купить сим карту 7766', rp());
            const u = await dbGet("SELECT phone FROM users WHERE user_id=?", [String(userId)]);
            if (u && u.phone && u.phone !== 'Нет') return await message.reply('❌ Уже есть сим-карта.', rp());
            const ex = await dbGet("SELECT user_id FROM phones WHERE number=?", [num]);
            if (ex) return await message.reply('❌ Номер занят.', rp());
            await dbRun("INSERT INTO phones (number, user_id) VALUES (?, ?)", [num, String(userId)]);
            await dbRun("UPDATE users SET phone=? WHERE user_id=?", [num, String(userId)]);
            return await message.reply(`✅ Сим-карта ${num}!`, rp());
        }
        if (cmdWord === 'sellhome' || (cmdWord === 'продать' && parts[1] === 'дом')) {
            const pr = await dbGet("SELECT id, location FROM properties WHERE owner_id=? AND type='house' LIMIT 1", [String(userId)]);
            if (!pr) return await message.reply('❌ Нет дома.', rp());
            const ld = PROPERTY_DATA[pr.location.toLowerCase()];
            if (!ld) return await message.reply('❌ Ошибка данных.', rp());
            const sp = Math.floor(ld.housePrice * 0.70);
            await updateBalance(userId, sp);
            await dbRun("DELETE FROM properties WHERE id=?", [pr.id]);
            return await message.reply(`🏠 Дом продан! +${formatMoney(sp)}$`, rp());
        }
        if (cmdWord === 'restart' || cmdWord === 'рестарт') {
            if (userId !== ADMIN_ID) return await message.reply('⛔ Нет прав.', rp());
            await message.reply('🔄 Перезапуск...'); setTimeout(() => process.exit(1), 1500); return;
        }
        if (cmdWord === 'машины') {
            let t = "🚗 Автосалон:\n\n";
            for (const [k, d] of Object.entries(CARS_DATA)) t += `${d.name} — ${formatMoney(d.price)}$\n`;
            return await message.reply(t + "\n🛒 /купить машина [название]", rp());
        }
        if (cmdWord === 'купить' && parts[1] === 'машина') {
            const a = message.text.split(' '); a.shift(); a.shift();
            const q = a.join(' ').toLowerCase().trim();
            if (!q) return await message.reply("❌ Укажите название.");
            let sc = null;
            for (const [k, d] of Object.entries(CARS_DATA)) if (k.includes(q) || d.name.toLowerCase().includes(q)) { sc = d; break; }
            if (!sc) return await message.reply("❌ Нет такой. /машины");
            const uc = await dbGet("SELECT car FROM users WHERE user_id=?", [String(userId)]);
            if (uc && uc.car) return await message.reply(`❌ Уже есть машина (${uc.car}).`);
            if (balance < sc.price) return await message.reply(`❌ Нужно ${formatMoney(sc.price)}$.`);
            await updateBalance(userId, -sc.price);
            await dbRun("UPDATE users SET car=? WHERE user_id=?", [sc.name, String(userId)]);
            return await message.reply(`🎉 ${sc.name} куплена за ${formatMoney(sc.price)}$!`, rp());
                        }
                if (cmdWord === 'продать' && (parts[1] === 'дом' || parts[1] === 'гараж')) {
            const isH = parts[1] === 'дом', type = isH ? 'house' : 'garage', tName = isH ? 'дом' : 'гараж';
            if (!message.hasReplyMessage) return await message.reply(`❌ Ответьте на сообщение покупателя. /продать ${tName} [сумма]`);
            const pr = parseAmount(cleanText.replace('продать дом', '').replace('продать гараж', '').trim());
            const tid = message.replyMessage.senderId;
            if (isNaN(pr) || pr < 1) return await message.reply("❌ Укажите сумму.");
            if (tid === userId) return await message.reply("❌ Себе продать нельзя.");
            const mp = await dbGet("SELECT id, location, tier FROM properties WHERE owner_id=? AND type=?", [String(userId), type]);
            if (!mp) return await message.reply(`❌ У вас нет ${tName}.`);
            const bp = await dbGet("SELECT id FROM properties WHERE owner_id=? AND type=?", [String(tid), type]);
            if (bp) return await message.reply(`❌ У покупателя уже есть ${tName}.`);
            const did = Math.floor(Math.random() * 90000) + 10000;
            await dbRun("INSERT INTO prop_deals (id, seller_id, buyer_id, type, prop_id, price, peer_id) VALUES (?, ?, ?, ?, ?, ?, ?)", [did, String(userId), String(tid), type, mp.id, pr, String(peerId)]);
            const kb = Keyboard.builder().inline().callbackButton({ label: `✅ Принять (${formatShortMoney(pr)}$)`, payload: { cmd: 'prop_deal_accept', deal_id: String(did) }, color: Keyboard.POSITIVE_COLOR }).toString();
            return await message.reply(`🤝 Заявка!\n👤 Продавец: ${await getFullName(userId)}\n📦 ${tName} ${mp.location} (Т${mp.tier})\n💰 ${formatMoney(pr)}$\n\n👉 ${await getFullName(tid)}, нажмите кнопку.`, rp(kb));
        }
        if (cmdWord === 'дон' || cmdWord === 'дондом' || cmdWord === 'донгараж') {
            let isH = false;
            if (cmdWord === 'дондом' || (cmdWord === 'дон' && parts[1] === 'дом')) isH = true;
            else if (cmdWord === 'донгараж' || (cmdWord === 'дон' && parts[1] === 'гараж')) isH = false;
            else return;
            const type = isH ? 'house' : 'garage';
            const rows = await dbAll("SELECT p.owner_id, p.location, p.tier, u.balance FROM properties p JOIN users u ON p.owner_id = u.user_id WHERE p.type=? AND p.tier <= 10 ORDER BY p.tier DESC, u.balance DESC LIMIT 10", [type]);
            if (!rows.length) return await message.reply(`❌ Нет купленных ${isH?'домов':'гаражей'} Т1-Т10.`);
            let txt = `${isH?'🏠 ДОНЫ ДОМОВ':'🏘️ ДОНЫ ГАРАЖЕЙ'}\n────────────────────\n`;
            const uids = [...new Set(rows.map(r => r.owner_id))];
            let uinfo = []; try { uinfo = await vk.api.users.get({ user_ids: uids.join(','), fields: 'deactivated' }); } catch(e) {}
            for (const r of rows) {
                const u = uinfo.find(x => x.id == r.owner_id);
                txt += `Т${r.tier} | ${r.location} — [id${r.owner_id}|${u&&!u.deactivated?u.first_name:'Игрок'}]\n`;
            }
            return await message.reply(txt, rp());
        }
        if (cmdWord === 'казино') return await message.reply("🎰 Игры:", rp(getCasinoKb()));
        if (cmdWord === 'топ' || cmdWord === 'top') {
            const rows = await dbAll("SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10");
            let txt = "⭐ ТОП 10 ПО БАЛАНСУ\n\n";
            if (rows.length) {
                const uids = rows.map(r => r.user_id);
                let uinfo = []; try { uinfo = await vk.api.users.get({ user_ids: uids.join(','), fields: 'deactivated' }); } catch(e) {}
                const em = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
                for (let i=0; i<rows.length; i++) {
                    const r = rows[i], u = uinfo.find(x => x.id == r.user_id);
                    if (u && !u.deactivated) txt += `${em[i]} [id${u.id}|${u.first_name}] — ${formatMoney(r.balance)}$\n`;
                }
            } else txt += "Пусто.";
            return await message.reply(txt, rp(getTopKb(userId, 'coins', 'global')));
        }
        if (cmdWord === 'бизнес') {
            let txt = "🏢 Бизнесы:\n\n";
            for (const [k, d] of Object.entries(BIZ_DATA)) txt += `${d.name} — ${formatMoney(d.price)}$ (${formatMoney(d.baseIncome)}$/3мин)\n`;
            return await message.reply(txt + "\n🛒 /купитьбиз [Название]", rp());
        }
        if (cmdWord === 'купитьбиз') {
            const a = message.text.split(' '); a.shift();
            const q = a.join(' ').toLowerCase().trim();
            if (!q) return await message.reply("❌ Укажите бизнес. /купитьбиз Шаурма");
            const ex = await dbGet("SELECT biz_name FROM businesses WHERE user_id=?", [String(userId)]);
            if (ex) return await message.reply("❌ Уже есть бизнес. /закрыть бизнес");
            let sb = null;
            for (const [k, d] of Object.entries(BIZ_DATA)) if (k.includes(q) || d.name.toLowerCase().includes(q)) { sb = d; break; }
            if (!sb) return await message.reply("❌ Нет такого. /бизнес");
            if (balance < sb.price) return await message.reply(`❌ Нужно ${formatMoney(sb.price)}$.`);
            await updateBalance(userId, -sb.price);
            await dbRun("INSERT INTO businesses (user_id, biz_name, level, balance, last_income, last_withdraw) VALUES (?, ?, 1, 0, ?, 0)", [String(userId), sb.name, Date.now()]);
            return await message.reply(`🎉 Куплен ${sb.name} за ${formatMoney(sb.price)}$. /мойбизнес`, rp());
        }
        if (cmdWord === 'мойбизнес') {
            const b = await dbGet("SELECT * FROM businesses WHERE user_id=?", [String(userId)]);
            if (!b) return await message.reply("❌ Нет бизнеса. /бизнес");
            const bd = Object.values(BIZ_DATA).find(x => x.name === b.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((Date.now() - b.last_income) * ((bd.baseIncome * b.level) / 180000));
            const tb = Number(b.balance) + earned, nc = (b.level === 1 ? 2000000 : b.level === 2 ? 5000000 : b.level * 5000000);
            return await message.reply(`🏢 Бизнес ${await getFullName(userId)}\n${b.biz_name}\n\n💪 Уровень: ${b.level}/5\n🐱 ${formatMoney(bd.baseIncome * b.level * 20)}$/час\n💸 Баланс: ${formatMoney(tb)}$\n\nПовышение: ${formatMoney(nc)}$\n\n👉 /вывести`, rp(getBizKb(userId)));
        }
        if (cmdWord === 'вывести') {
            const b = await dbGet("SELECT * FROM businesses WHERE user_id=?", [String(userId)]);
            if (!b) return await message.reply("❌ Нет бизнеса.");
            const now = Date.now(), lw = Number(b.last_withdraw) || 0;
            if (now - lw < 7200000) return await message.reply(`⏳ Ждите ${Math.floor((7200000-(now-lw))/3600000)}ч. ${Math.floor(((7200000-(now-lw))%3600000)/60000)}м.`, rp());
            const bd = Object.values(BIZ_DATA).find(x => x.name === b.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((now - b.last_income) * ((bd.baseIncome * b.level) / 180000));
            const tb = Number(b.balance) + earned;
            if (tb <= 0) return await message.reply("❌ Нет денег на бизнесе.", rp());
            await updateBalance(userId, tb);
            await dbRun("UPDATE businesses SET balance=0, last_income=?, last_withdraw=? WHERE user_id=?", [now, now, String(userId)]);
            return await message.reply(`💸 Выведено ${formatMoney(tb)}$!`, rp());
        }
        if (cmdWord === 'закрыть' && parts[1] === 'бизнес') {
            const b = await dbGet("SELECT biz_name FROM businesses WHERE user_id=?", [String(userId)]);
            if (!b) return await message.reply("❌ Нет бизнеса.");
            await dbRun("DELETE FROM businesses WHERE user_id=?", [String(userId)]);
            await updateBalance(userId, 10000000);
            return await message.reply("💀 Бизнес закрыт. Компенсация: 10,000,000$.", rp());
        }
        if (cmdWord === 'rep' || cmdWord === 'реп') {
            if (parts[1] !== '+' && parts[1] !== '-') return await message.reply("🔔 /rep + или /rep - (ответом или @). 3 раза в сутки.", rp());
            const isPlus = parts[1] === '+';
            let tid = null;
            if (message.hasReplyMessage) tid = message.replyMessage.senderId;
            else {
                const ts = text.replace('/rep +','').replace('/rep -','').replace('rep +','').replace('rep -','').trim();
                const m = ts.match(/@([a-zA-Z0-9._]+)/) || ts.match(/\[id(\d+)\|/);
                if (m) {
                    if (m[1].match(/^\d+$/)) tid = parseInt(m[1]);
                    else { try { const r = await vk.api.utils.resolveScreenName({ screen_name: m[1] }); if (r.type === 'user') tid = r.object_id; } catch(e) {} }
                }
            }
            if (!tid) return await message.reply("⚠️ Укажите пользователя.", rp());
            if (tid === userId) return await message.reply("❌ Себе нельзя!", rp());
            const now = Date.now();
            const rr = await dbGet("SELECT count, last_reset FROM rep_limits WHERE user_id=?", [String(userId)]);
            let rc = rr ? Number(rr.count) : 0, rst = rr ? Number(rr.last_reset) : 0;
            if (now - rst >= 86400000) { rc = 0; rst = now; }
            if (rc >= 3) return await message.reply(`⏳ Лимит 3/сутки. Ждите ${Math.floor((86400000-(now-rst))/3600000)}ч.`, rp());
            await dbRun("REPLACE INTO rep_limits (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), rc+1, rst]);
            await updateReputation(tid, isPlus ? 1 : -1);
            return await message.reply(`⭐ ${await getFullName(userId)} ${isPlus?'повысил':'понизил'} репутацию ${await getFullName(tid)} (Теперь: ${await getReputation(tid)}). Осталось: ${3-(rc+1)}/3`, rp());
        }
        if (cmdWord === 'работа') return await message.reply("💼 Выберите работу:", rp(getWorkKb()));

        const gcs = ['рулетка','рул','краш','монетка','стакан','кубик','автомат','блэкджек','дрим','мины','фортуна'];
        if (gcs.includes(cmdWord)) {
            const lp = gameCooldowns.get(userId) || 0;
            if (Date.now() - lp < 10000) return await message.reply(`⏳ Ждите ${Math.ceil((10000-(Date.now()-lp))/1000)} сек.`, rp());
            gameCooldowns.set(userId, Date.now());
        }

        if (cmdWord === 'краш' && parts.length >= 3) {
            const ast = parseFloat(parts[1]); let bet = parseAmount(parts[2]); if (bet === 'ALL') bet = balance;
            if (isNaN(ast) || ast < 1.01) return await message.reply("❌ Автостоп > 1.00", rp());
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp());
            if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet);
            const r = Math.random(); let cp = 1.00; if (r > 0.03) cp = Math.floor((1/(1-r))*0.97*100)/100;
            if (cp >= ast) { const w = Math.floor(bet*ast); await updateBalance(userId, w); return await message.reply(`📈 Краш: x${cp.toFixed(2)}\n✅ Выигрыш: ${formatMoney(w)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`📈 Краш: x${cp.toFixed(2)}\n❌ Проигрыш: ${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'монетка' && parts.length >= 3) {
            let side = '', bs = '';
            if (['орел','решка'].includes(parts[1])) { side=parts[1]; bs=parts[2]; } else if (['орел','решка'].includes(parts[2])) { side=parts[2]; bs=parts[1]; } else return await message.reply("❌ орел/решка", rp());
            let bet = parseAmount(bs); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet);
            const res = Math.random() < 0.5 ? 'орел' : 'решка';
            if (res === side) { await updateBalance(userId, bet*2); return await message.reply(`🪙 ${res}\n✅ +${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`🪙 ${res}\n❌ -${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'стакан' && parts.length >= 3) {
            let cup = 0, bs = '';
            const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
            if (p1>=1&&p1<=3) {cup=p1;bs=parts[2];} else if (p2>=1&&p2<=3) {cup=p2;bs=parts[1];} else return await message.reply("❌ 1-3", rp());
            let bet = parseAmount(bs); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet); const res = Math.floor(Math.random()*3)+1;
            if (res === cup) { await updateBalance(userId, bet*3); return await message.reply(`🥤 Шарик в ${res}\n✅ +${formatMoney(bet*2)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`🥤 Шарик в ${res}\n❌ -${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'кубик' && parts.length >= 3) {
            let g = 0, bs = '';
            const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
            if (p1>=1&&p1<=6) {g=p1;bs=parts[2];} else if (p2>=1&&p2<=6) {g=p2;bs=parts[1];} else return await message.reply("❌ 1-6", rp());
            let bet = parseAmount(bs); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet); const res = Math.floor(Math.random()*6)+1;
            if (res === g) { await updateBalance(userId, bet*6); return await message.reply(`🎲 ${res}\n✅ +${formatMoney(bet*5)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`🎲 ${res}\n❌ -${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'автомат' && parts.length >= 2) {
            let bet = parseAmount(parts[1]); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet); const em = ['🍒','🍋','🍇','💎','7️⃣'];
            const r1 = em[Math.floor(Math.random()*em.length)], r2 = em[Math.floor(Math.random()*em.length)], r3 = em[Math.floor(Math.random()*em.length)];
            let w = (r1===r2&&r2===r3)?bet*10:(r1===r2||r2===r3||r1===r3)?bet*2:0;
            if (w>0) { await updateBalance(userId, w); return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n✅ +${formatMoney(w)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`🎰 [${r1}|${r2}|${r3}]\n❌ -${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'блэкджек' && parts.length >= 2) {
            let bet = parseAmount(parts[1]); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet); const ps = Math.floor(Math.random()*10)+12, ds = Math.floor(Math.random()*10)+12;
            let txt = `🃏 Блэкджек\n👤 ${ps} | 🤵 ${ds}\n\n`;
            if (ps > 21) txt += `❌ Перебор! -${formatMoney(bet)}$`;
            else if (ds > 21) { await updateBalance(userId, bet*2); txt += `✅ Дилер перебрал! +${formatMoney(bet)}$`; }
            else if (ps > ds) { await updateBalance(userId, bet*2); txt += `✅ Вы выиграли! +${formatMoney(bet)}$`; }
            else if (ps === ds) { await updateBalance(userId, bet); txt += `🤝 Ничья. Возврат.`; }
            else txt += `❌ Дилер выиграл! -${formatMoney(bet)}$`;
            return await message.reply(txt + `\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'дрим' && parts.length >= 3) {
            let g = 0, bs = ''; const vd = [1,2,3,4,5]; const p1 = parseInt(parts[1]), p2 = parseInt(parts[2]);
            if (vd.includes(p1)) {g=p1;bs=parts[2];} else if (vd.includes(p2)) {g=p2;bs=parts[1];} else return await message.reply("❌ 1-5", rp());
            let bet = parseAmount(bs); if (bet === 'ALL') bet = balance;
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet); const res = Math.floor(Math.random()*10)+1; const mul = {1:2, 2:2, 3:3, 4:4, 5:5};
            if (res === g) { const w = bet*mul[g]; await updateBalance(userId, w); return await message.reply(`💎 ${res}\n✅ x${mul[g]}! +${formatMoney(w)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp()); }
            return await message.reply(`💎 ${res}\n❌ -${formatMoney(bet)}$\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
        }
        if (cmdWord === 'рулетка' || cmdWord === 'рул') {
            if (parts.length >= 3) {
                let ch = '', bs = '';
                if (parseAmount(parts[1]) > 0 || parseAmount(parts[1]) === 'ALL') { bs = parts[1]; ch = parts[2]; } else { bs = parts[parts.length-1]; ch = parts[1]; }
                let bet = parseAmount(bs); if (bet === 'ALL') bet = balance;
                if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp()); if (bet > balance) return await message.reply("❌ Мало денег.", rp());
                const res = Math.floor(Math.random()*37); const rn = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                const cn = rn.includes(res)?'Красное':(res===0?'Зеро':'Черное'), ce = rn.includes(res)?'🔴':(res===0?'🟢':'⚫'), en = res===0?'Ноль':(res%2===0?'Четное':'Нечетное');
                const win = (parseInt(ch)===res) || (['красное','красный','кр'].includes(ch)&&rn.includes(res)) || (['черное','черный','чр','ср'].includes(ch)&&!rn.includes(res)&&res!==0) || (['чет','четное'].includes(ch)&&res%2===0&&res!==0) || (['нечет','нечетное'].includes(ch)&&res%2!==0);
                let mult = 1; if (parseInt(ch)===res) mult = 35; else if (['чет','нечет','четное','нечетное','красное','черное','кр','чр','ср','красный','черный'].includes(ch)) mult = 1; // Default 1:1 for colors/even
                // Simple win logic: if number -> x36. if color/even -> x2 (return bet + win bet). 
                // The original code was doing await updateBalance(userId, bet) on win (which is just returning the bet, no profit? Wait, if bet=100, bet deducted, then +100 returned = 0 profit. That was a bug in the original. Let's fix it to return bet*2 for 1:1, bet*36 for straight up.)
                let profit = 0;
                if (win) {
                    if (parseInt(ch) === res) profit = bet * 36;
                    else profit = bet * 2;
                    await updateBalance(userId, profit);
                }
                const att = await getRouletteAttachment();
                const msg = `🎰 Выпало: ${res} ${ce} (${cn}, ${en})\n\n${win ? `✅ Выигрыш: +${formatMoney(profit)}$` : `😔 Проигрыш: -${formatMoney(bet)}$`}\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`;
                return await message.reply({ message: msg, attachment: att || undefined, keyboard: isLs ? mainKb.toString() : undefined, disable_mentions: 1 });
            } else return await message.reply("❌ Формат: рулетка [цвет/чет/число] [ставка]", rp());
        }
        if (cmdWord === 'фортуна') {
            const ct = Math.floor(Date.now()/1000), r = await dbGet("SELECT last_used FROM fortune_cd WHERE user_id=?", [String(userId)]), lu = r ? r.last_used : 0;
            if (ct - lu < FORTUNA_CD) return await message.reply(`⏳ Фортуна через ${Math.floor((FORTUNA_CD-(ct-lu))/60)}м. ${(FORTUNA_CD-(ct-lu))%60}с.`, rp());
            if (balance < 100) return await message.reply("❌ Стоит 100$.", rp());
            await updateBalance(userId, -100); await dbRun("REPLACE INTO fortune_cd (user_id, last_used) VALUES (?, ?)", [String(userId), ct]);
            const pz = [0,50,100,200,500,1000,5000][Math.floor(Math.random()*7)];
            await updateBalance(userId, pz);
            return await message.reply(`🎰 Фортуна: ${formatMoney(pz)}$!\n💰 ${formatMoney(await getBalance(userId))}$`, rp(isLs ? mainKb : undefined));
        }
        if (cmdWord === 'мины') {
            let bet = 100;
            if (parts.length >= 2) { const p = parseAmount(parts[1]); if (p === 'ALL') bet = balance; else if (p > 0) bet = p; }
            if (isNaN(bet) || bet < 100) return await message.reply("❌ Мин. 100$.", rp());
            if (bet > 5000000000) return await message.reply("❌ Макс. 5ккк.", rp());
            if (bet > balance) return await message.reply("❌ Мало денег.", rp());
            await updateBalance(userId, -bet);
            const gid = String(Math.floor(Math.random()*90000)+10000);
            await dbRun("INSERT INTO games (game_id, user_id, bet, mines, opened, multiplier, msg_id, start_time) VALUES (?, ?, ?, '[]', '[]', 1.0, ?, 0)", [gid, String(userId), bet, String(message.id)]);
            return await message.reply(`💣 Мины\nСтавка: ${formatMoney(bet)}$\n\nВыберите кол-во мин (2-8):`, rp(getMinesCountKb(gid)));
        }
        if (cmdWord === 'transfer' || cmdWord === 'перевод') {
            if (parts.length >= 2 && message.hasReplyMessage) {
                const am = parseAmount(parts[1]), tid = message.replyMessage.senderId;
                if (!am || am === 'ALL') return await message.reply("❌ Сумма.", rp());
                if (tid === userId) return await message.reply("❌ Себе нельзя.", rp()); if (tid < 0) return await message.reply("❌ Сообществам нельзя.", rp());
                if (am < 50 || am > 5000000000000) return await message.reply("❌ 50 - 5кккк.", rp());
                if (balance < am) return await message.reply("❌ Мало денег.", rp());
                await updateBalance(userId, -am); await updateBalance(tid, am);
                return await message.reply(`💸 Переведено ${formatMoney(am)}$ игроку ${await getFullName(tid)}.\n💰 ${formatMoney(await getBalance(userId))}$`, rp());
            } else return await message.reply("❌ Ответом: transfer [сумма]", rp());
        }
        if (cmdWord === 'duel') {
            if (parts.length === 2) {
                const bet = parseAmount(parts[1]);
                if (!bet || bet === 'ALL') return await message.reply("❌ Сумма.", rp());
                if (bet < 50 || bet > 2000) return await message.reply("❌ 50 - 2000.", rp());
                if (balance < bet) return await message.reply("❌ Мало денег.", rp());
                const did = String(Math.floor(Math.random()*90000)+10000);
                await dbRun("REPLACE INTO active_duels (msg_id, challenger, bet, peer_id) VALUES (?, ?, ?, ?)", [did, String(userId), bet, String(peerId)]);
                return await message.reply(`⚔️ Дуэль!\n👤 ${await getFullName(userId)}\n💰 ${bet}$\n\n⚡ Нажми кнопку!`, rp(getDuelKb(did)));
            } else return await message.reply("❌ Формат: duel [сумма]", rp());
        }
        if (cmdWord === 'бонус') {
            const td = new Date().toLocaleDateString('ru-RU'), ub = await dbGet("SELECT last_bonus_date, bonus_streak FROM users WHERE user_id=?", [String(userId)]);
            let st = ub?.bonus_streak || 0, ld = ub?.last_bonus_date;
            if (ld === td) return await message.reply(`⏳ Уже брали сегодня! Стрик: ${st} дн.`, rp());
            if (ld) { const d1 = new Date(ld.split('.').reverse().join('-')), d2 = new Date(td.split('.').reverse().join('-')); if (Math.ceil(Math.abs(d2-d1)/86400000) === 1) st++; else st = 1; } else st = 1;
            let ba = 100000; if (st===2) ba=200000; if (st===3) ba=300000; if (st===4) ba=400000; if (st===5) ba=500000; if (st===6) ba=700000; if (st>=7) ba=1000000;
            await updateBalance(userId, ba); await dbRun("UPDATE users SET last_bonus_date=?, bonus_streak=?, bonus_count=bonus_count+1 WHERE user_id=?", [td, st, String(userId)]);
            return await message.reply(`🎁 БОНУС\n🔥 Стрик: ${st} дн.\n💰 +${formatMoney(ba)}$\n\n💰 ${formatMoney(await getBalance(userId))}$`, rp(isLs ? mainKb : undefined));
        }

        if (userId === ADMIN_ID) {
            if (cmdWord === 'pr') { const {tid} = await getTargetAndReason(message, 'pr'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); return await message.reply(`💰 ${await getFullName(tid)}: ${formatShortMoney(await getBalance(tid))}$`, rp()); }
            if (cmdWord === 'заморозить') { const {tid} = await getTargetAndReason(message, 'заморозить'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp()); await dbRun("REPLACE INTO frozen (user_id) VALUES (?)", [String(tid)]); try { await vk.api.messages.send({ peer_id: tid, message: "💀 Вы заморожены.", random_id: Math.floor(Math.random()*1e9) }); } catch(e) {} return await message.reply(`✅ ${await getFullName(tid)} заморожен.`, rp()); }
            if (cmdWord === 'разморозить' || cleanText.startsWith('снять заморозку') || cmdWord === 'unfreeze') {
                let cn = 'разморозить'; if (cleanText.startsWith('снять заморозку')) cn='снять заморозку'; if (cmdWord==='unfreeze') cn='unfreeze';
                const {tid} = await getTargetAndReason(message, cn); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); await dbRun("DELETE FROM frozen WHERE user_id=?", [String(tid)]); return await message.reply(`✅ ${await getFullName(tid)} разморожен.`, rp());
            }
            if (cmdWord === 'unmute' || cmdWord === 'размут') {
                const {tid} = await getTargetAndReason(message, cmdWord); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp());
                await dbRun("DELETE FROM mutes WHERE user_id=? AND peer_id=?", [String(tid), String(peerId)]);
                if (message.isChat) { try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: tid, action: 'none', for: 0 }); } catch(e) {} }
                return await message.reply(`✅ С ${await getFullName(tid)} снят мут.`, rp());
            }
            if (cmdWord === 'unban' || cmdWord === 'разбан') {
                const {tid} = await getTargetAndReason(message, cmdWord); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp());
                let rem = false;
                if (await dbGet("SELECT user_id FROM blacklist WHERE user_id=?", [String(tid)])) { await dbRun("DELETE FROM blacklist WHERE user_id=?", [String(tid)]); rem = true; }
                if (message.isChat && await dbGet("SELECT user_id FROM chat_bans WHERE user_id=? AND peer_id=?", [String(tid), String(peerId)])) { await dbRun("DELETE FROM chat_bans WHERE user_id=? AND peer_id=?", [String(tid), String(peerId)]); rem = true; }
                if (!rem) return await message.reply("❌ Не в бане.", rp()); return await message.reply(`✅ ${await getFullName(tid)} разбанен.`, rp());
            }
            if (cmdWord === 'kl') {
                const {tid} = await getTargetAndReason(message, 'kl'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp());
                await dbRun("DELETE FROM properties WHERE owner_id=?", [String(tid)]); await dbRun("UPDATE users SET balance=0, reputation=0, xp=0, level=1, duel_wins=0, bonus_count=0, car=NULL, last_bonus_date=NULL, bonus_streak=0 WHERE user_id=?", [String(tid)]);
                return await message.reply(`💥 ${await getFullName(tid)} сброшен.`, rp());
            }
            if (cmdWord === 'mute') {
                let tid = null, args = message.text.split(' ').slice(1);
                if (message.hasReplyMessage) tid = message.replyMessage.senderId; else { const {tid: t} = await getTargetAndReason(message, 'mute'); tid = t; args.shift(); }
                if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp());
                let mm = 10, rs = "Причина не указана";
                if (args.length > 0) { const p = parseInt(args[0]); if (!isNaN(p) && p>0) { mm=p; if (args.length>1) rs=args.slice(1).join(' '); } else rs=args.join(' '); }
                if (await dbGet("SELECT mute_until FROM mutes WHERE user_id=? AND peer_id=?", [String(tid), String(peerId)])) return await message.reply("❌ Уже в муте.", rp());
                await dbRun("REPLACE INTO mutes (user_id, peer_id, mute_until, reason) VALUES (?, ?, ?, ?)", [String(tid), String(peerId), Date.now()+mm*60000, rs]);
                if (message.isChat) { try { await vk.api.messages.changeConversationMemberRestrictions({ group_id: GROUP_ID, peer_id: peerId, member_id: tid, action: 'ro', for: mm*60 }); } catch(e) {} }
                return await message.reply(`🔇 ${await getFullName(tid)} мут ${mm} мин.\n📌 ${rs}`, rp());
            }
            if (cmdWord === 'бан' || cmdWord === 'ban') {
                if (!message.isChat) return await message.reply("❌ Только в беседе.", rp());
                const {tid, reason} = await getTargetAndReason(message, cmdWord); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp());
                if (await dbGet("SELECT reason FROM chat_bans WHERE user_id=? AND peer_id=?", [String(tid), String(peerId)])) return await message.reply("❌ Уже забанен.", rp());
                await dbRun("REPLACE INTO chat_bans (user_id, peer_id, reason) VALUES (?, ?, ?)", [String(tid), String(peerId), reason]);
                try { await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: tid, group_id: GROUP_ID }); } catch(e) {}
                return await message.reply(`🔨 ${await getFullName(tid)} забанен в беседе.\n📌 ${reason}`, rp());
            }
            if (cmdWord === 'настройки') {
                const en = (await dbGet("SELECT value FROM settings WHERE key='antispam_enabled'")).value, li = (await dbGet("SELECT value FROM settings WHERE key='antispam_limit'")).value, ti = (await dbGet("SELECT value FROM settings WHERE key='antispam_time'")).value, mu = (await dbGet("SELECT value FROM settings WHERE key='antispam_mute'")).value;
                return await message.reply(`⚙️ Антиспам: ${en==='1'?'🟢':'🔴'}`, { keyboard: getSettingsKb(en, li, ti, mu) });
            }
            if (cmdWord === 'убрать') {
                const q = cleanText.replace('убрать','').trim().toLowerCase();
                if (q === 'all' || q === 'все') { await dbRun("UPDATE users SET balance=0, reputation=0, xp=0, level=1, duel_wins=0, bonus_count=0"); return await message.reply("💥 Всем обнулены статы!", rp()); }
                const {tid} = await getTargetAndReason(message, 'убрать'); if (!tid) return await message.reply("❌ Укажите игрока или 'all'.", rp());
                await dbRun("UPDATE users SET balance=0, reputation=0, xp=0, level=1, duel_wins=0, bonus_count=0 WHERE user_id=?", [String(tid)]);
                return await message.reply(`💥 ${await getFullName(tid)} обнулен.`, rp());
            }
            if (cmdWord === 'kick') {
                if (!message.isChat) return await message.reply("❌ Только в беседе.", rp());
                const {tid, reason} = await getTargetAndReason(message, 'kick'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp());
                try { await vk.api.messages.removeChatUser({ chat_id: peerId - 2000000000, user_id: tid, group_id: GROUP_ID }); return await message.reply(`👢 ${await getFullName(tid)} кикнут.\n📌 ${reason}`, rp()); } catch(e) { return await message.reply("❌ Не удалось кикнуть.", rp()); }
            }
            if (cmdWord === 'чсб') {
                const {tid, reason} = await getTargetAndReason(message, 'чсб'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); if (tid === ADMIN_ID) return await message.reply("❌ Себя нельзя.", rp());
                if (await dbGet("SELECT reason FROM blacklist WHERE user_id=?", [String(tid)])) return await message.reply("❌ Уже в ЧС.", rp());
                let d = 0, fr = reason; const pr = reason.split(' ');
                if (pr.length > 1 && !isNaN(parseInt(pr[0]))) { d = parseInt(pr[0]); fr = pr.slice(1).join(' '); }
                if (!fr) fr = "Причина не указана";
                await dbRun("REPLACE INTO blacklist (user_id, reason, until) VALUES (?, ?, ?)", [String(tid), fr, d > 0 ? Date.now() + d*86400000 : 0]);
                return await message.reply(`🚫 ${await getFullName(tid)} в ЧС ${d>0?d+' дн.':'навсегда'}.\n📌 ${fr}`, rp());
            }
            if (cmdWord === 'разчсб') { const {tid} = await getTargetAndReason(message, 'разчсб'); if (!tid) return await message.reply("⚠️ Укажите игрока.", rp()); await dbRun("DELETE FROM blacklist WHERE user_id=?", [String(tid)]); return await message.reply(`✅ ${await getFullName(tid)} разбанен в ЧС.`, rp()); }
            if (cmdWord === 'выдать') {
                let am = 0, ra = []; for (const a of message.text.split(' ').slice(1)) { const p = parseAmount(a); if (p > 0 && p !== 'ALL') am = p; else ra.push(a); }
                if (am <= 0) return await message.reply("❌ Сумма.", rp());
                const q = ra.join(' ').trim().toLowerCase();
                if (q === 'all' || q === 'все') { await dbRun("UPDATE users SET balance=balance+?", [am]); return await message.reply(`💰 Выдано всем по ${formatMoney(am)}$!`, rp()); }
                let tid = null; if (message.hasReplyMessage) tid = message.replyMessage.senderId; else if (q) { const m = q.match(/@([a-zA-Z0-9._]+)/i) || q.match(/\[id(\d+)\|/); if (m) { if (m[1].match(/^\d+$/)) tid = parseInt(m[1]); else try { const r = await vk.api.utils.resolveScreenName({ screen_name: m[1] }); if (r.type === 'user') tid = r.object_id; } catch(e) {} } }
                if (!tid) return await message.reply("❌ Укажите игрока или 'all'.", rp());
                await updateBalance(tid, am); return await message.reply(`💰 Выдано ${formatMoney(am)}$ игроку ${await getFullName(tid)}!`, rp());
            }
            if (cmdWord === 'обнулить') {
                const q = message.text.split(' ').slice(1).join(' ').trim().toLowerCase();
                if (q === 'all') { await dbRun("UPDATE users SET balance=0"); await dbRun("UPDATE businesses SET balance=0"); return await message.reply("💥 Балансы всех обнулены.", rp()); }
                const {tid} = await getTargetAndReason(message, 'обнулить'); if (!tid) return await message.reply("❌ Укажите игрока или 'all'.", rp());
                await dbRun("UPDATE users SET balance=0 WHERE user_id=?", [String(tid)]); await dbRun("UPDATE businesses SET balance=0 WHERE user_id=?", [String(tid)]);
                return await message.reply(`💥 Баланс ${await getFullName(tid)} обнулен.`, rp());
            }
            if (cmdWord === 'cp') { await dbRun("DELETE FROM promos"); return await message.reply("💥 Все промокоды удалены.", rp()); }
            if (cmdWord === 'создать') {
                if (parts.length === 4) { const am = parseAmount(parts[2]), li = parseAmount(parts[3]); if (am>0&&li>0) { await dbRun("REPLACE INTO promos (code, amount, limit_count, used_by) VALUES (?, ?, ?, '')", [parts[1], am, li]); return await message.reply(`✅ Промокод ${parts[1]} создан.`, rp()); } }
                return await message.reply("❌ /создать [код] [сумма] [лимит]", rp());
            }
        }
        if (cmdWord === 'промолист') {
            const rows = await dbAll("SELECT code, amount, limit_count, used_by FROM promos");
            if (!rows.length) return await message.reply("❌ Нет промокодов.", rp());
            let txt = "🎁 Активные промокоды:\n\n";
            for (const r of rows) { const uc = r.used_by ? r.used_by.split(',').length : 0; txt += `${r.code} — ${formatMoney(r.amount)}$ (${uc}/${r.limit_count})\n`; }
            return await message.reply(txt, rp());
        }
        if (cmdWord === 'promo') {
            if (parts.length === 2) {
                try { const m = await vk.api.groups.isMember({ group_id: GROUP_ID, user_id: userId }); if (m !== 1) return await message.reply("❌ Только подписчикам!", rp(Keyboard.builder().inline().urlButton({ label: 'Подписаться', url: `https://vk.com/public${GROUP_ID}` }).toString())); } catch(e) {}
                const r = await dbGet("SELECT amount, limit_count, used_by FROM promos WHERE code=?", [parts[1]]);
                if (!r) return await message.reply("❌ Не существует.", rp());
                const ub = r.used_by ? r.used_by.split(',') : [];
                if (ub.length >= r.limit_count) { await dbRun("DELETE FROM promos WHERE code=?", [parts[1]]); return await message.reply("❌ Исчерпан.", rp()); }
                if (ub.includes(String(userId))) return await message.reply("❌ Вы уже активировали.", rp());
                ub.push(String(userId)); await updateBalance(userId, r.amount);
                if (ub.length >= r.limit_count) { await dbRun("DELETE FROM promos WHERE code=?", [parts[1]]); return await message.reply(`✅ +${r.amount}$! (Лимит исчерпан)`, rp()); }
                await dbRun("UPDATE promos SET used_by=? WHERE code=?", [ub.join(','), parts[1]]);
                return await message.reply(`✅ +${r.amount}$!\nОсталось: ${r.limit_count - ub.length}`, rp());
            } else return await message.reply("❌ /promo [код]", rp());
        }

        return;
    } catch (error) {
        console.error("ОШИБКА В КОМАНДАХ:", error);
        try { await message.reply(`❌ Ошибка: ${error.message}`, { disable_mentions: 1 }); } catch(e) {}
    }
});
vk.updates.on('message_event', async (context) => {
    let answered = false;
    const safeAnswer = async (params) => { if (!answered) { answered = true; await context.answer(params).catch(() => {}); } };
    try {
        const payload = context.eventPayload;
        const userId = context.userId;
        const peerId = context.peerId;

        if (payload.cmd === 'prop_deal_accept') {
            const deal = await dbGet("SELECT * FROM prop_deals WHERE id=?", [payload.deal_id]);
            if (!deal) return await safeAnswer({ type: 'show_snackbar', text: '❌ Сделка устарела.' });
            if (String(userId) !== deal.buyer_id) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы не покупатель.' });
            if (await getBalance(userId) < deal.price) return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег.' });
            if (await dbGet("SELECT id FROM properties WHERE owner_id=? AND type=?", [String(userId), deal.type])) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас уже есть эта недвижимость!' });
            await updateBalance(userId, -deal.price); await updateBalance(deal.seller_id, deal.price);
            await dbRun("UPDATE properties SET owner_id=? WHERE id=?", [String(userId), deal.prop_id]);
            await dbRun("DELETE FROM prop_deals WHERE id=?", [payload.deal_id]);
            await safeAnswer({ type: 'show_snackbar', text: '✅ Куплено!' });
            await vk.api.messages.edit({ peer_id: peerId, message: `🤝 Сделка!\n${await getFullName(userId)} купил ${deal.type==='house'?'дом':'гараж'} за ${formatMoney(deal.price)}$.`, keyboard: "", conversation_message_id: context.conversationMessageId });
            return;
        }
        if ((payload.cmd === 'top_menu' || payload.cmd === 'top_back' || payload.cmd === 'biz_upgrade') && payload.author) {
            if (String(userId) !== String(payload.author)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Это меню другого игрока.' });
        }
        if (payload.cmd === 'settings_toggle') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await dbRun("UPDATE settings SET value=? WHERE key='antispam_enabled'", [payload.state]);
            await safeAnswer();
            const li = (await dbGet("SELECT value FROM settings WHERE key='antispam_limit'")).value, ti = (await dbGet("SELECT value FROM settings WHERE key='antispam_time'")).value, mu = (await dbGet("SELECT value FROM settings WHERE key='antispam_mute'")).value;
            await vk.api.messages.edit({ peer_id: peerId, message: `⚙️ Антиспам: ${payload.state==='1'?'🟢 Включен':'🔴 Выключен'}`, keyboard: getSettingsKb(payload.state, li, ti, mu), conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'settings_edit') {
            if (userId !== ADMIN_ID) return await safeAnswer({ type: 'show_snackbar', text: '❌ Только владелец.' });
            await safeAnswer(); adminStates.set(userId, payload.field);
            await vk.api.messages.send({ peer_id: peerId, message: `✏️ Введите новое значение (или "отмена"):`, random_id: Math.floor(Math.random()*1e9) });
            return;
        }
        if (payload.cmd === 'help_start') {
            await safeAnswer(); await vk.api.messages.edit({ peer_id: peerId, message: "📖 Раздел:", keyboard: getHelpKb(), conversation_message_id: context.conversationMessageId }); return;
        }
        if (payload.cmd === 'help_menu') {
            await safeAnswer(); let msg = "";
            if (payload.section === 'games') msg = "🎰 Игровые команды:\n/рулетка [цвет/чет] [ставка]\n/краш [автостоп] [ставка]\n/монетка [орел/решка] [ставка]\n/стакан [1-3] [ставка]\n/кубик [1-6] [ставка]\n/автомат [ставка]\n/блэкджек [ставка]\n/дрим [1-5] [ставка]\n/мины [ставка]\n/фортуна\n\n⚠️ Мин. ставка: 100$. Ставка 'вб' разрешена.";
            if (payload.section === 'eco') msg = "💼 Экономика:\n/бизнес\n/купитьбиз [название]\n/мойбизнес\n/вывести\n/закрыть бизнес\n/бонус\n/transfer [сумма] (ответом)\n/duel [сумма]\n/promo [код]\n/промолист\n/машины\n/купить машина [название]\n/sellcar (слить машину)\n/дон дом (топ домов Т1-Т10)\n/дон гараж (топ гаражей Т1-Т10)";
            if (payload.section === 'profile') msg = "👤 Профиль и прочее:\n/профиль\n/топ\n/rep +/- (ответом)\n/пинг\n\n💡 Слэш (/) в начале писать необязательно!";
            if (payload.section === 'houses') {
                let txt = "🏠 ДОМА\n────────────────────\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) { const cr = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location=? AND type='house'", [d.name]); txt += `📍 ${d.name}: ${20-(cr?cr.c:0)} свободно\n`; }
                msg = txt + `\n💡 /купить дом топ [номер] [Локация]\n💡 /продать дом [сумма] (ответом)\n🏆 Доны: /дон дом`;
            }
            if (payload.section === 'garages') {
                let txt = "🏘️ ГАРАЖИ\n────────────────────\n";
                for (const [k, d] of Object.entries(PROPERTY_DATA)) { const cr = await dbGet("SELECT COUNT(*) as c FROM properties WHERE location=? AND type='garage'", [d.name]); txt += `📍 ${d.name}: ${20-(cr?cr.c:0)} свободно\n`; }
                msg = txt + `\n💡 /купить гараж топ [номер] [Локация]\n💡 /продать гараж [сумма] (ответом)\n🏆 Доны: /дон гараж`;
            }
            await vk.api.messages.edit({ peer_id: peerId, message: msg, keyboard: getHelpBackKb(), conversation_message_id: context.conversationMessageId }); return;
        }
        if (payload.cmd === 'casino_info') {
            let msg = "";
            if (payload.game === 'roulette') msg = "Рулетка ❓\n\"Рулетка [на что ставишь] [ставка]\"\n▪ Число от 0 до 36 (x36)\n▪ Чет (x2)\n▪ Нечет (x2)\n▪ Красное (x2)\n▪ Черное (x2)\n\n⚠️ Мин. ставка: 100$.\nПример — \"Рулетка чет 5кк\"";
            if (payload.game === 'crash') msg = "❌ краш (автостоп) (ставка)\n\nПример: краш 3 5кк";
            if (payload.game === 'coin') msg = "❌ монетка [орел/решка] [ставка]\n\nПример: монетка орел 100к";
            if (payload.game === 'glass') msg = "❌ стакан [1-3] [ставка]\n\nПример: стакан 2 100к";
            if (payload.game === 'dice') msg = "❌ кубик [1-6] [ставка]\n\nПример: кубик 4 100к";
            if (payload.game === 'slot') msg = "автомат (сумма)\n\nПример: автомат 5кк";
            if (payload.game === 'blackjack') msg = "❌ Блэкджек (ставка)\n\nПример: блэкджек 100к";
            if (payload.game === 'dream') msg = "Дрим [число] [ставка]\n-Доступны числа:\n🔹 1 (x2)\n🔹 2 (x2)\n🔹 3 (x3)\n🔹 4 (x4)\n🔹 5 (x5)\n\n🤔 Пример: дрим 5 100к";
            await safeAnswer(); await vk.api.messages.send({ peer_id: peerId, message: msg, random_id: Math.floor(Math.random()*1e9), disable_mentions: 1 }); return;
        }
        if (payload.cmd === 'biz_upgrade') {
            const biz = await dbGet("SELECT * FROM businesses WHERE user_id=?", [String(userId)]);
            if (!biz) return await safeAnswer({ type: 'show_snackbar', text: '❌ У вас нет бизнеса.' });
            if (biz.level >= 5) return await safeAnswer({ type: 'show_snackbar', text: '❌ Максимальный уровень!' });
            const bd = Object.values(BIZ_DATA).find(x => x.name === biz.biz_name) || { baseIncome: 1000 };
            const earned = Math.floor((Date.now() - biz.last_income) * ((bd.baseIncome * biz.level) / 180000));
            const tb = Number(biz.balance) + earned, nc = (biz.level === 1 ? 2000000 : biz.level === 2 ? 5000000 : biz.level * 5000000);
            if (await getBalance(userId) < nc) return await safeAnswer({ type: 'show_snackbar', text: '❌ Мало денег!' });
            await safeAnswer(); await updateBalance(userId, -nc);
            await dbRun("UPDATE businesses SET level=level+1, balance=?, last_income=? WHERE user_id=?", [tb, Date.now(), String(userId)]);
            await vk.api.messages.edit({ peer_id: peerId, message: `🏢 Бизнес ${await getFullName(userId)}\n${biz.biz_name}\n\n💪 Уровень: ${biz.level+1}/5\n🐱 ${formatMoney(bd.baseIncome*(biz.level+1)*20)}$/час\n💸 Баланс: ${formatMoney(tb)}$\n\nПовышение: ${formatMoney((biz.level+1)*5000000)}$\n\n👉 /вывести`, keyboard: getBizKb(userId), conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'work_do') {
            const now = Date.now(), wr = await dbGet("SELECT count, last_reset FROM work_cd WHERE user_id=?", [String(userId)]);
            let c = wr ? Number(wr.count) : 0, lr = wr ? Number(wr.last_reset) : 0;
            if (now - lr >= 3600000) { c = 0; lr = now; }
            if (c >= 3) return await safeAnswer({ type: 'show_snackbar', text: `⏳ Ждите ${Math.floor((3600000-(now-lr))/60000)} мин.` });
            if (payload.type === 'Такси') { const u = await dbGet("SELECT car FROM users WHERE user_id=?", [String(userId)]); if (!u || !u.car) return await safeAnswer({ type: 'show_snackbar', text: '❌ Для такси нужна машина! /машины' }); }
            await safeAnswer(); c++; await dbRun("REPLACE INTO work_cd (user_id, count, last_reset) VALUES (?, ?, ?)", [String(userId), c, lr]);
            const lucky = Math.random() > 0.3; let earned = 0, mt = "";
            if (lucky) { earned = 2000000; await updateBalance(userId, earned); mt = `✅ Вы заработали ${formatMoney(earned)}$! (${payload.type})`; }
            else mt = `😢 Не повезло! Вы заработали 0$. (${payload.type})`;
            await vk.api.messages.edit({ peer_id: peerId, message: `${mt}\n\n💰 Баланс: ${formatMoney(await getBalance(userId))}$\n📊 Осталось: ${3-c}/3`, keyboard: getWorkKb(), conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'activate_bot' || payload.cmd === 'decline_bot') {
            try {
                const m = await vk.api.messages.getConversationMembers({ peer_id: peerId });
                const cl = m.items.find(x => x.member_id === userId);
                if (!(cl && (cl.is_admin || cl.is_owner)) && userId !== ADMIN_ID) return await vk.api.messages.edit({ peer_id: peerId, message: "❌ Только админы беседы!", keyboard: "", conversation_message_id: context.conversationMessageId });
                if (payload.cmd === 'activate_bot') {
                    const b = m.items.find(x => x.member_id == -GROUP_ID || x.member_id == GROUP_ID);
                    if (!(b && b.is_admin)) return await vk.api.messages.edit({ peer_id: peerId, message: "❌ Ошибка. Выдайте боту админку.", keyboard: "", conversation_message_id: context.conversationMessageId });
                    await vk.api.messages.edit({ peer_id: peerId, message: "🎉 Бот подключен!\nДля помощи /help", disable_mentions: 1, keyboard: "", conversation_message_id: context.conversationMessageId });
                } else await vk.api.messages.edit({ peer_id: peerId, message: "❌ Активация отменена.", disable_mentions: 1, keyboard: "", conversation_message_id: context.conversationMessageId });
            } catch (e) { await vk.api.messages.edit({ peer_id: peerId, message: "❌ Ошибка проверки прав.", keyboard: "", conversation_message_id: context.conversationMessageId }); }
            return;
        }
        if (payload.cmd === 'top_menu') {
            const { type, scope, repType, author } = payload;
            const isChat = scope === 'chat', tPeer = isChat ? peerId : null;
            let q = "", p = [];
            if (type === 'coins') { q = isChat ? "SELECT user_id, count FROM chat_messages WHERE peer_id=? ORDER BY count DESC LIMIT 10" : "SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10"; p = isChat ? [String(tPeer)] : []; }
            else if (type === 'level') { q = isChat ? "SELECT user_id, level FROM users WHERE reg_date IS NOT NULL ORDER BY level DESC LIMIT 10" : "SELECT user_id, level FROM users ORDER BY level DESC LIMIT 10"; p = []; }
            else if (type === 'rep') { q = "SELECT user_id, reputation FROM users ORDER BY reputation DESC LIMIT 10"; p = []; }
            else if (type === 'duels') { q = "SELECT user_id, duel_wins FROM users ORDER BY duel_wins DESC LIMIT 10"; p = []; }
            else if (type === 'bonus') { q = "SELECT user_id, bonus_count FROM users ORDER BY bonus_count DESC LIMIT 10"; p = []; }
            const rows = await dbAll(q, p);
            let txt = `🏆 ТОП ${type.toUpperCase()} ${isChat ? 'в беседе' : 'общий'}\n────────────────────\n`;
            if (rows.length > 0) {
                const uids = rows.map(r => r.user_id); let uinfo = []; try { uinfo = await vk.api.users.get({ user_ids: uids.join(','), fields: 'deactivated' }); } catch(e) {}
                const em = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
                for (let i = 0; i < rows.length; i++) {
                    const r = rows[i], u = uinfo.find(x => x.id == r.user_id);
                    const name = u && !u.deactivated ? `[id${u.id}|${u.first_name} ${u.last_name||''}]` : `[id${r.user_id}|Игрок]`;
                    let val = type === 'coins' ? (isChat ? `${r.count} сообщ.` : `${formatMoney(r.balance)}$`) : type === 'level' ? `Lvl ${r.level}` : type === 'rep' ? `${r.reputation} реп.` : type === 'duels' ? `${r.duel_wins} побед` : `${r.bonus_count} раз`;
                    txt += `${em[i]} ${name} — ${val}\n`;
                }
            } else txt += "Данных пока нет.";
            await safeAnswer(); await vk.api.messages.edit({ peer_id: peerId, message: txt, keyboard: getTopKb(author, type, scope, repType), conversation_message_id: context.conversationMessageId }); return;
        }
        if (payload.cmd === 'top_back') {
            await safeAnswer(); await vk.api.messages.edit({ peer_id: peerId, message: "🏆 Выберите категорию топа:", keyboard: getTopKb(payload.author), conversation_message_id: context.conversationMessageId }); return;
        }
        if (payload.cmd === 'duel_accept') {
            const duel = await dbGet("SELECT * FROM active_duels WHERE msg_id=?", [payload.duel_id]);
            if (!duel) return await safeAnswer({ type: 'show_snackbar', text: '❌ Дуэль завершена.' });
            if (String(userId) === duel.challenger) return await safeAnswer({ type: 'show_snackbar', text: '❌ Нельзя принять свою дуэль!' });
            const bet = Number(duel.bet);
            if (await getBalance(duel.challenger) < bet || await getBalance(userId) < bet) return await safeAnswer({ type: 'show_snackbar', text: '❌ У кого-то не хватает денег!' });
            const winnerId = Math.random() > 0.5 ? duel.challenger : userId;
            const loserId = String(winnerId) === String(duel.challenger) ? userId : duel.challenger;
            await updateBalance(winnerId, bet); await updateBalance(loserId, -bet);
            await dbRun("DELETE FROM active_duels WHERE msg_id=?", [payload.duel_id]);
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: peerId, message: `⚔️ ДУЭЛЬ ЗАВЕРШЕНА!\n\n🏆 Победитель: ${await getFullName(winnerId)}\n💰 Выиграно: ${formatMoney(bet)}$\n\n📉 Проиграл: ${await getFullName(loserId)}`, keyboard: "", conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'mines_set') {
            const g = await dbGet("SELECT * FROM games WHERE game_id=?", [payload.gameId]);
            if (!g || g.user_id !== String(userId)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Игра не найдена.' });
            const ma = []; while (ma.length < parseInt(payload.count)) { const r = Math.floor(Math.random()*9)+1; if (!ma.includes(r)) ma.push(r); }
            await dbRun("UPDATE games SET mines=?, start_time=? WHERE game_id=?", [JSON.stringify(ma), Date.now(), payload.gameId]);
            await safeAnswer();
            await vk.api.messages.edit({ peer_id: peerId, message: `💣 МИНЫ (Мин: ${payload.count})\nСтавка: ${formatMoney(g.bet)}$\n\nВыберите клетку:`, keyboard: buildMinesKb(payload.gameId, [], ma, false), conversation_message_id: context.conversationMessageId });
            return;
        }
        if (payload.cmd === 'mines_click') {
            const g = await dbGet("SELECT * FROM games WHERE game_id=?", [payload.gameId]);
            if (!g || g.user_id !== String(userId)) return;
            const ma = JSON.parse(g.mines), op = JSON.parse(g.opened), cell = parseInt(payload.cell);
            if (op.includes(cell)) return await safeAnswer({ type: 'show_snackbar', text: '❌ Уже открыто!' });
            if (ma.includes(cell)) {
                await dbRun("DELETE FROM games WHERE game_id=?", [payload.gameId]);
                const ui = getMinesGameUI(payload.gameId, g.bet, ma.length, ma, op, true, cell, await getFullName(userId), await getBalance(userId));
                await safeAnswer(); await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            } else {
                op.push(cell); await dbRun("UPDATE games SET opened=? WHERE game_id=?", [JSON.stringify(op), payload.gameId]);
                const ui = getMinesGameUI(payload.gameId, g.bet, ma.length, ma, op, false, null, await getFullName(userId), await getBalance(userId));
                await safeAnswer(); await vk.api.messages.edit({ peer_id: peerId, message: ui.text, keyboard: ui.kb, conversation_message_id: context.conversationMessageId });
            }
            return;
        }
        if (payload.cmd === 'mines_cashout') {
            const g = await dbGet("SELECT * FROM games WHERE game_id=?", [payload.gameId]);
            if (!g || g.user_id !== String(userId)) return;
            const ma = JSON.parse(g.mines), op = JSON.parse(g.opened);
            if (op.length === 0) return await safeAnswer({ type: 'show_snackbar', text: '❌ Вы еще не открыли клетки!' });
            let cm = 1.0; for (let i = 0; i < op.length; i++) cm *= (9-i)/(9-ma.length-i);
            const w = Math.floor(g.bet * cm * 0.95);
            await updateBalance(userId, w); await dbRun("DELETE FROM games WHERE game_id=?", [payload.gameId]);
            await safeAnswer({ type: 'show_snackbar', text: `💰 Забрано ${formatMoney(w)}$!` });
            await vk.api.messages.edit({ peer_id: peerId, message: `💰 ВЫИГРЫШ В МИНАХ!\nВы забрали: ${formatMoney(w)}$\n💰 Баланс: ${formatMoney(await getBalance(userId))}$`, keyboard: "", conversation_message_id: context.conversationMessageId });
            return;
        }
        await safeAnswer();
    } catch (error) {
        console.error("ОШИБКА В КНОПКАХ:", error);
    }
});

vk.updates.startPolling()
    .then(() => console.log("🚀 Бот Game Zone успешно запущен!"))
    .catch(err => console.error("❌ Ошибка запуска:", err));
