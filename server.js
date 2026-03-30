/**
 * RunCoach Pro - WhatsApp Bot Server
 * Sistema completo: Treino + Nutricao
 *
 * Funcionalidades:
 * - Plano do dia (7h) + Lembrete noturno (21h)
 * - Receber treinos por mensagem
 * - Receber refeicoes por mensagem
 * - Alertas de proteina
 * - Feedback do coach
 */

const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// No cache for HTML so PWA always gets fresh version
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ===== CONFIG =====
const CONFIG = {
  port: process.env.PORT || 3000,
  athlete: {
    name: 'Mota', phone: '5561982550045',
    targetPace: '5:30', raceDate: '2026-04-19',
    raceName: 'Meia Maratona 21K',
    proteinGoal: 140, calGoal: 2400, weight: 78
  },
  whatsappProvider: process.env.WA_PROVIDER || 'evolution',
  evolution: {
    baseUrl: process.env.EVOLUTION_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || 'SUA_API_KEY_AQUI',
    instance: process.env.EVOLUTION_INSTANCE || 'runcoach'
  },
  twilio: {
    accountSid: process.env.TWILIO_SID || 'SUA_ACCOUNT_SID',
    authToken: process.env.TWILIO_TOKEN || 'SEU_AUTH_TOKEN',
    fromNumber: process.env.TWILIO_FROM || 'whatsapp:+14155238886'
  }
};

// ===== DATA =====
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'coach_data.json');

function loadData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e){ console.error('Error loading data:', e.message); }
  return {
    athlete: { name:'Mota', height:1.82, weight:78, bf:18.8, tmb:1687, phone:'+5561982550045' },
    logs: [{ id:1, date:'2026-03-26', type:'corrida', distance:6.23, time:37.38, pace:'6:00', paceNum:6.0, feeling:'moderado', recovery:['gelo'], notes:'Primeiro treino focado para meia maratona. Banheira de gelo apos treino.' }],
    meals: [],
    nextId:2, nextMealId:1
  };
}
function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch(e){ console.error('Error saving data:', e.message); }
}
let coachData = loadData();

// ===== COMMON FOOD DATABASE (protein per serving) =====
// Dados reais - Dymatize ISO100 = 25g prot/scoop
const FOOD_DB = {
  'whey': { protein:25, carb:2, cal:120 },
  'iso100': { protein:25, carb:2, cal:120 },
  'iso 100': { protein:25, carb:2, cal:120 },
  'scoop': { protein:25, carb:2, cal:120 },
  'ovo': { protein:7, carb:0.5, cal:78 },
  'ovos': { protein:7, carb:0.5, cal:78 },
  'omelete': { protein:21, carb:2, cal:234 },
  'frango': { protein:30, carb:0, cal:165 },
  'carne': { protein:20, carb:0, cal:150 },
  'bife': { protein:20, carb:0, cal:150 },
  'carne de sol': { protein:35, carb:0, cal:250 },
  'peixe': { protein:25, carb:0, cal:150 },
  'sashimi': { protein:20, carb:0, cal:100 },
  'sushi': { protein:8, carb:20, cal:140 },
  'arroz': { protein:4, carb:40, cal:200 },
  'feijao': { protein:8, carb:25, cal:150 },
  'cuscuz': { protein:3, carb:30, cal:140 },
  'tapioca': { protein:1, carb:25, cal:110 },
  'banana': { protein:1, carb:27, cal:105 },
  'banana frita': { protein:1, carb:30, cal:180 },
  'mandioca': { protein:1, carb:30, cal:150 },
  'farofa': { protein:5, carb:20, cal:150 },
  'pasta de amendoim': { protein:8, carb:6, cal:190 },
  'dr peanut': { protein:8, carb:6, cal:190 },
  'dr.peanut': { protein:8, carb:6, cal:190 },
  'salada': { protein:2, carb:5, cal:30 },
  'verdura': { protein:2, carb:5, cal:30 },
  'cafe com leite': { protein:4, carb:6, cal:60 },
  'cafe': { protein:0, carb:0, cal:5 },
  'iogurte': { protein:10, carb:15, cal:120 },
  'queijo': { protein:7, carb:1, cal:100 },
  'leite': { protein:4, carb:6, cal:60 }
};

// ===== WEEK PLAN =====
function generateWeekPlan() {
  const now = new Date();
  const raceDate = new Date(CONFIG.athlete.raceDate);
  const dl = Math.ceil((raceDate - now) / 864e5);
  const tp = dl <= 14, lw = dl <= 7;
  return [
    { day:'Domingo', title:lw?'Shakeout':'Longao', km:lw?4:tp?14:dl>21?16:18, intensity:lw?'easy':'hard' },
    { day:'Segunda', title:'Academia + Corrida Leve', km:tp?4:5, intensity:'easy' },
    { day:'Terca', title:tp?'Corrida Leve':'Treino de Ritmo', km:tp?5:7, intensity:tp?'easy':'moderate' },
    { day:'Quarta', title:'Academia + Tenis', km:0, intensity:'moderate' },
    { day:'Quinta', title:tp?'Recuperacao':'Corrida + Strides', km:tp?4:6, intensity:'easy' },
    { day:'Sexta', title:'Perna com Personal', km:0, intensity:tp?'moderate':'hard' },
    { day:'Sabado', title:'Corrida Leve', km:tp?3:5, intensity:'easy' }
  ];
}

function calcPace(km,min) { if(!km||!min) return '--:--'; const p=min/km; return Math.floor(p)+':'+String(Math.round((p-Math.floor(p))*60)).padStart(2,'0'); }

// ===== WHATSAPP SENDER =====
async function sendWhatsApp(phone, message) {
  console.log(`[WA] -> ${phone}: ${message.substring(0,80)}...`);
  if (CONFIG.whatsappProvider === 'evolution') {
    try {
      const r = await fetch(`${CONFIG.evolution.baseUrl}/message/sendText/${CONFIG.evolution.instance}`, {
        method:'POST', headers:{'Content-Type':'application/json','apikey':CONFIG.evolution.apiKey},
        body:JSON.stringify({ number:phone, text:message })
      });
      return await r.json();
    } catch(e) { console.error('[Evolution]', e.message); }
  } else {
    try {
      const twilio = require('twilio')(CONFIG.twilio.accountSid, CONFIG.twilio.authToken);
      return await twilio.messages.create({ body:message, from:CONFIG.twilio.fromNumber, to:`whatsapp:+${phone}` });
    } catch(e) { console.error('[Twilio]', e.message); }
  }
}

// ===== MESSAGES =====
function buildMorningMessage() {
  const dl = Math.ceil((new Date(CONFIG.athlete.raceDate) - new Date()) / 864e5);
  const plan = generateWeekPlan();
  const today = plan[new Date().getDay()];
  const todayMeals = coachData.meals.filter(m => m.date === new Date().toISOString().slice(0,10));
  const todayProt = todayMeals.reduce((s,m) => s + m.protein, 0);

  return `☀️ *RunCoach Pro - Bom dia, ${CONFIG.athlete.name}!*

📅 *${dl} dias* para a ${CONFIG.athlete.raceName}

━━━━━━━━━━━━━━━
🏃 *Treino: ${today.title}*
${today.km > 0 ? '📏 ' + today.km + 'km' : '🏋️ Sem corrida'} | ⚡ ${today.intensity}

━━━━━━━━━━━━━━━
🥩 *Meta Proteina: ${CONFIG.athlete.proteinGoal}g*
Registrado: ${todayProt}g | Faltam: ${Math.max(0, CONFIG.athlete.proteinGoal - todayProt)}g

💡 Lembre: distribua proteina em 5 refeicoes (~28g cada)

━━━━━━━━━━━━━━━
📲 _Comandos:_
*"treino 6km 35min bem"* - registrar corrida
*"comi whey + banana + frango"* - registrar refeicao
*"proteina"* - ver quanto falta hoje
*"plano"* - ver treino do dia`;
}

function buildEveningMessage() {
  const dl = Math.ceil((new Date(CONFIG.athlete.raceDate) - new Date()) / 864e5);
  const plan = generateWeekPlan();
  const tomorrow = plan[(new Date().getDay() + 1) % 7];
  const todayMeals = coachData.meals.filter(m => m.date === new Date().toISOString().slice(0,10));
  const todayProt = todayMeals.reduce((s,m) => s + m.protein, 0);
  const protLeft = CONFIG.athlete.proteinGoal - todayProt;

  let nutriAlert = '';
  if (protLeft > 30) {
    nutriAlert = `\n⚠️ *ALERTA PROTEINA:* Faltam ${protLeft}g hoje!\nAdicione: 1 whey (30g) + jantar reforçado`;
  } else if (protLeft <= 0) {
    nutriAlert = `\n✅ *Meta proteina batida!* ${todayProt}g hoje`;
  }

  return `🌙 *RunCoach Pro - Boa noite!*
${nutriAlert}

📊 *Resumo Hoje:*
🥩 Proteina: ${todayProt}g / ${CONFIG.athlete.proteinGoal}g
🍽️ Refeicoes: ${todayMeals.length}

━━━━━━━━━━━━━━━
📋 *Amanha: ${tomorrow.title}*
${tomorrow.km > 0 ? tomorrow.km + 'km' : 'Sem corrida'}

🛏️ Durma 7-8h | Hidrate | ${protLeft > 0 ? 'Whey antes de dormir!' : 'Descanse bem!'}

_${dl - 1} dias para a prova! 💪_`;
}

// ===== MESSAGE PARSER =====
function parseMessage(text) {
  const t = text.toLowerCase().trim();

  // Workout detection
  if (t.includes('treino') || t.includes('corri') || /^\d+[.,]?\d*\s*km/.test(t)) {
    return { type: 'workout', data: parseWorkout(t) };
  }

  // Meal detection
  if (t.includes('comi') || t.includes('almoc') || t.includes('jant') || t.includes('cafe') || t.includes('lanche') || t.includes('whey')) {
    return { type: 'meal', data: parseMeal(t) };
  }

  // Commands
  if (t.includes('proteina') || t.includes('protein')) return { type: 'command', cmd: 'protein' };
  if (t.includes('plano') || t.includes('hoje')) return { type: 'command', cmd: 'plan' };
  if (t.includes('semana') || t.includes('resumo')) return { type: 'command', cmd: 'weekly' };

  return null;
}

function parseWorkout(text) {
  let distance = null, time = null, feeling = 'moderado';
  const kmMatch = text.match(/(\d+[.,]?\d*)\s*km/);
  if (kmMatch) distance = parseFloat(kmMatch[1].replace(',', '.'));
  const timeMatch = text.match(/(\d+)[:\s]?(\d{2})?\s*min/);
  if (timeMatch) { time = parseInt(timeMatch[1]); if (timeMatch[2]) time += parseInt(timeMatch[2])/60; }
  if (/otimo|top|voando/.test(text)) feeling = 'otimo';
  else if (/bem|bom|tranquilo/.test(text)) feeling = 'bem';
  else if (/pesado|cansado|morto/.test(text)) feeling = 'cansado';
  const recovery = [];
  if (/gelo|banheir/.test(text)) recovery.push('gelo');
  if (/along/.test(text)) recovery.push('alongamento');
  return distance ? { distance, time, pace: time ? calcPace(distance, time) : null, paceNum: time ? time/distance : 0, feeling, recovery, raw: text } : null;
}

function parseMeal(text) {
  let totalProt = 0, totalCarb = 0, totalCal = 0;
  const items = [];

  for (const [food, macros] of Object.entries(FOOD_DB)) {
    if (text.includes(food)) {
      let qty = 1;
      const qtyMatch = text.match(new RegExp(`(\\d+)\\s*${food}`));
      if (qtyMatch) qty = parseInt(qtyMatch[1]);
      totalProt += macros.protein * qty;
      totalCarb += macros.carb * qty;
      totalCal += macros.cal * qty;
      items.push(food + (qty > 1 ? ' x' + qty : ''));
    }
  }

  // Detect meal type
  let mealType = 'extra';
  const hour = new Date().getHours();
  if (text.includes('cafe') || text.includes('manha') || hour < 9) mealType = 'cafe';
  else if (text.includes('pos') || text.includes('pós')) mealType = 'pos_treino';
  else if (text.includes('almoc') || (hour >= 11 && hour <= 14)) mealType = 'almoco';
  else if (text.includes('lanche') || text.includes('tarde') || (hour >= 15 && hour <= 17)) mealType = 'lanche';
  else if (text.includes('jant') || text.includes('noite') || hour >= 18) mealType = 'jantar';

  return items.length > 0 ? { items, protein: totalProt, carb: totalCarb, cal: totalCal, mealType, raw: text } : null;
}

// ===== HANDLE MESSAGES =====
async function handleIncomingMessage(phone, text) {
  console.log(`[IN] ${phone}: ${text}`);
  const parsed = parseMessage(text);

  if (!parsed) {
    await sendWhatsApp(phone, `👋 Oi ${CONFIG.athlete.name}!\n\n*Comandos:*\n🏃 *treino* 6km 35min bem\n🍽️ *comi* frango + arroz + salada\n🥩 *proteina* - ver meta de hoje\n📋 *plano* - treino do dia\n📊 *semana* - resumo semanal`);
    return;
  }

  if (parsed.type === 'workout' && parsed.data) {
    const w = parsed.data;
    coachData.logs.push({
      id: coachData.nextId++, date: new Date().toISOString().slice(0,10),
      type: 'corrida', distance: w.distance, time: w.time || 0,
      pace: w.pace || '--', paceNum: w.paceNum, feeling: w.feeling,
      recovery: w.recovery, notes: w.raw
    });
    saveData(coachData);
    const pd = w.paceNum - 5.5;
    let fb = `📊 *Treino Registrado!*\n\n📏 ${w.distance}km | ⏱️ ${w.pace || '--'}/km | ${w.feeling}\n\n`;
    fb += pd <= 0 ? '🔥 Pace abaixo do alvo! Excelente!' : pd < 0.3 ? '✅ Proximo do alvo!' : pd < 0.6 ? '👍 Bom treino de base.' : '⚠️ Pace alto - monitore fadiga.';
    if (w.feeling === 'cansado') fb += '\n\n⚠️ Cansaco relatado. Reduza amanha.';
    await sendWhatsApp(phone, fb);
  }

  else if (parsed.type === 'meal' && parsed.data) {
    const m = parsed.data;
    coachData.meals.push({
      id: coachData.nextMealId++, date: new Date().toISOString().slice(0,10),
      type: m.mealType, desc: m.items.join(' + '),
      protein: m.protein, carb: m.carb, cal: m.cal
    });
    saveData(coachData);
    const todayProt = coachData.meals.filter(x => x.date === new Date().toISOString().slice(0,10)).reduce((s,x) => s + x.protein, 0);
    const protLeft = CONFIG.athlete.proteinGoal - todayProt;
    let fb = `🍽️ *Refeicao Registrada!*\n\n${m.items.join(' + ')}\n🥩 ${m.protein}g prot | 🍞 ${m.carb}g carb | 🔥 ${m.cal} kcal\n\n`;
    fb += `📊 *Proteina Hoje:* ${todayProt}g / ${CONFIG.athlete.proteinGoal}g\n`;
    if (protLeft > 60) fb += `\n⚠️ Faltam ${protLeft}g - reforce nas proximas refeicoes!`;
    else if (protLeft > 0) fb += `\n👍 Faltam ${protLeft}g - ${protLeft <= 30 ? '1 whey resolve!' : 'quase la!'}`;
    else fb += `\n✅ Meta batida! Excelente para preservar massa!`;
    await sendWhatsApp(phone, fb);
  }

  else if (parsed.type === 'command') {
    if (parsed.cmd === 'protein') {
      const todayProt = coachData.meals.filter(x => x.date === new Date().toISOString().slice(0,10)).reduce((s,x) => s + x.protein, 0);
      const left = CONFIG.athlete.proteinGoal - todayProt;
      await sendWhatsApp(phone, `🥩 *Proteina Hoje*\n\n${todayProt}g / ${CONFIG.athlete.proteinGoal}g\n${left > 0 ? `Faltam ${left}g` : '✅ Meta batida!'}\n\n${left > 60 ? '⚠️ Risco de perder massa! Reforce agora.' : left > 30 ? '👉 Adicione 1 whey + refeicao reforçada' : left > 0 ? '👉 1 whey (30g) resolve!' : '💪 Mantenha o ritmo!'}`);
    }
    else if (parsed.cmd === 'plan') { await sendWhatsApp(phone, buildMorningMessage()); }
    else if (parsed.cmd === 'weekly') {
      const weekMeals = coachData.meals.filter(m => { const d = (new Date() - new Date(m.date))/864e5; return d < 7; });
      const weekProt = weekMeals.reduce((s,m) => s + m.protein, 0);
      const weekRuns = coachData.logs.filter(l => { const d = (new Date() - new Date(l.date))/864e5; return d < 7 && l.type === 'corrida'; });
      const weekKm = weekRuns.reduce((s,l) => s + l.distance, 0);
      await sendWhatsApp(phone, `📊 *Resumo Semanal*\n\n🏃 ${weekRuns.length} corridas | ${weekKm.toFixed(1)}km\n🥩 Proteina media: ${weekMeals.length ? Math.round(weekProt / Math.min(7, [...new Set(weekMeals.map(m=>m.date))].length)) : 0}g/dia\n🍽️ ${weekMeals.length} refeicoes registradas\n\n${weekProt/7 < CONFIG.athlete.proteinGoal ? '⚠️ Media de proteina abaixo da meta! Reforce!' : '✅ Proteina em dia!'}`);
    }
  }
}

// ===== WEBHOOKS =====
app.post('/webhook/evolution', (req, res) => {
  try {
    const { data } = req.body;
    if (!data || !data.message) return res.sendStatus(200);
    const from = data.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    if (from === CONFIG.athlete.phone && text) handleIncomingMessage(from, text);
  } catch(e) { console.error('Webhook:', e.message); }
  res.sendStatus(200);
});

app.post('/webhook/twilio', (req, res) => {
  try {
    const from = req.body.From?.replace('whatsapp:+', '');
    const text = req.body.Body || '';
    if (from === CONFIG.athlete.phone && text) handleIncomingMessage(from, text);
  } catch(e) { console.error('Webhook:', e.message); }
  res.sendStatus(200);
});

// ===== API =====
// Get all data
app.get('/api/data', (req, res) => res.json(coachData));

// Save entire data state (sync from frontend)
app.post('/api/sync', (req, res) => {
  try {
    const newData = req.body;
    if (newData && newData.logs && newData.meals) {
      coachData = newData;
      saveData(coachData);
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Invalid data format' });
    }
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

// Logs CRUD
app.post('/api/log', (req, res) => {
  req.body.id = coachData.nextId++;
  req.body.date = req.body.date || new Date().toISOString().slice(0,10);
  coachData.logs.push(req.body);
  saveData(coachData);
  res.json({ success: true, id: req.body.id, data: coachData });
});
app.put('/api/log/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = coachData.logs.findIndex(l => l.id === id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'Log not found' });
  coachData.logs[idx] = { ...req.body, id };
  saveData(coachData);
  res.json({ success: true, data: coachData });
});
app.delete('/api/log/:id', (req, res) => {
  const id = parseInt(req.params.id);
  coachData.logs = coachData.logs.filter(l => l.id !== id);
  saveData(coachData);
  res.json({ success: true, data: coachData });
});

// Meals CRUD
app.post('/api/meal', (req, res) => {
  req.body.id = coachData.nextMealId++;
  req.body.date = req.body.date || new Date().toISOString().slice(0,10);
  coachData.meals.push(req.body);
  saveData(coachData);
  res.json({ success: true, id: req.body.id, data: coachData });
});
app.put('/api/meal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = coachData.meals.findIndex(m => m.id === id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'Meal not found' });
  coachData.meals[idx] = { ...req.body, id };
  saveData(coachData);
  res.json({ success: true, data: coachData });
});
app.delete('/api/meal/:id', (req, res) => {
  const id = parseInt(req.params.id);
  coachData.meals = coachData.meals.filter(m => m.id !== id);
  saveData(coachData);
  res.json({ success: true, data: coachData });
});

// Plan & test
app.get('/api/plan', (req, res) => res.json(generateWeekPlan()));
app.get('/api/send-test', async (req, res) => { try { await sendWhatsApp(CONFIG.athlete.phone, buildMorningMessage()); res.json({success:true}); } catch(e) { res.json({success:false, error:e.message}); } });

// Catch-all: serve index.html for any non-API route (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/webhook')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ===== CRON =====
cron.schedule('0 7 * * *', () => { sendWhatsApp(CONFIG.athlete.phone, buildMorningMessage()); }, { timezone:'America/Sao_Paulo' });
cron.schedule('0 21 * * *', () => { sendWhatsApp(CONFIG.athlete.phone, buildEveningMessage()); }, { timezone:'America/Sao_Paulo' });
cron.schedule('0 20 * * 0', () => { // Weekly summary domingo 20h
  const weekMeals = coachData.meals.filter(m => (new Date()-new Date(m.date))/864e5 < 7);
  const avgProt = weekMeals.length ? Math.round(weekMeals.reduce((s,m)=>s+m.protein,0) / [...new Set(weekMeals.map(m=>m.date))].length) : 0;
  const weekRuns = coachData.logs.filter(l => (new Date()-new Date(l.date))/864e5 < 7 && l.type==='corrida');
  sendWhatsApp(CONFIG.athlete.phone, `📊 *Resumo Semanal*\n\n🏃 ${weekRuns.length} corridas | ${weekRuns.reduce((s,l)=>s+l.distance,0).toFixed(1)}km\n🥩 Prot media: ${avgProt}g/dia ${avgProt < CONFIG.athlete.proteinGoal ? '⚠️' : '✅'}\n🍽️ ${weekMeals.length} refeicoes\n\n_Bora pra proxima semana! 💪_`);
}, { timezone:'America/Sao_Paulo' });

// Protein check at 15h
cron.schedule('0 15 * * *', () => {
  const todayProt = coachData.meals.filter(m => m.date === new Date().toISOString().slice(0,10)).reduce((s,m) => s + m.protein, 0);
  const left = CONFIG.athlete.proteinGoal - todayProt;
  if (left > 70) {
    sendWhatsApp(CONFIG.athlete.phone, `🚨 *Alerta Proteina!*\n\nSao 15h e voce consumiu so ${todayProt}g de proteina (meta: ${CONFIG.athlete.proteinGoal}g).\n\n⚠️ *Faltam ${left}g!* Risco de perder massa muscular.\n\n👉 Sugestao: whey (30g) + lanche com frango (30g) + jantar reforçado (40g)`);
  }
}, { timezone:'America/Sao_Paulo' });

// ===== START =====
app.listen(CONFIG.port, () => {
  console.log(`\n🏃 RunCoach Pro Server: http://localhost:${CONFIG.port}`);
  console.log(`📱 Dashboard: http://localhost:${CONFIG.port}`);
  console.log(`📲 WhatsApp: ${CONFIG.whatsappProvider}`);
  console.log(`⏰ Notificacoes: 7h + 15h (prot check) + 21h + Dom 20h`);
  console.log(`Webhook: http://IP:${CONFIG.port}/webhook/${CONFIG.whatsappProvider}\n`);
});
