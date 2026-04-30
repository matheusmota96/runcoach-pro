// Build morning / evening / weekly messages. Mirrors logic from server.js.

const RACE_DATE = new Date('2027-04-18T00:00:00');
const PLAN_START = new Date('2026-04-25T00:00:00');

function daysLeft() {
  return Math.ceil((RACE_DATE - new Date()) / 864e5);
}

function weekNumber() {
  const s = new Date(PLAN_START); s.setHours(0,0,0,0);
  const d = new Date(); d.setHours(0,0,0,0);
  return Math.max(1, Math.floor((d - s) / 604800000) + 1);
}

const PHASES = [
  { idx:1, name:'Base e Adaptacao', startWeek:1,  endWeek:12 },
  { idx:2, name:'Consistencia',     startWeek:13, endWeek:24 },
  { idx:3, name:'Construcao',       startWeek:25, endWeek:36 },
  { idx:4, name:'Pico',             startWeek:37, endWeek:46 },
  { idx:5, name:'Taper',            startWeek:47, endWeek:51 },
  { idx:6, name:'Semana da Prova',  startWeek:52, endWeek:53 }
];
function getPhase(wn) {
  return PHASES.find(p => wn >= p.startWeek && wn <= p.endWeek) || PHASES[PHASES.length-1];
}

function buildMorningMessage() {
  const dl = daysLeft();
  const wn = weekNumber();
  const phase = getPhase(wn);
  const dayName = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'][new Date().getDay()];
  return [
    `Bom dia, Mota! 🔥`,
    `Hoje e ${dayName}.`,
    `Faltam ${dl} dias para o Ironman 70.3 Brasilia.`,
    `Semana ${wn} - Fase ${phase.idx}/6 (${phase.name}).`,
    ``,
    `Lembrete: hidrate-se, registre o treino no app, mantenha proteina alta.`,
    `https://runcoach-pro.vercel.app`
  ].join('\n');
}

function buildEveningMessage() {
  return [
    `Boa noite, Mota! 🌙`,
    `Lembrete final do dia:`,
    `- Voce registrou o treino de hoje?`,
    `- Bateu a meta de 140g de proteina?`,
    `- Hidratacao em dia?`,
    ``,
    `https://runcoach-pro.vercel.app`
  ].join('\n');
}

function buildWeeklySummary(stats) {
  return [
    `📊 Resumo da semana`,
    `Run: ${stats.runKm.toFixed(1)} km`,
    `Bike: ${stats.bikeKm.toFixed(0)} km`,
    `Swim: ${stats.swimMeters} m`,
    `Forca: ${stats.strengthSessions} sessoes`,
    `Treinos: ${stats.totalSessions}`,
    ``,
    `Vamos pra proxima semana!`
  ].join('\n');
}

module.exports = {
  buildMorningMessage, buildEveningMessage, buildWeeklySummary,
  daysLeft, weekNumber, getPhase, PHASES, RACE_DATE, PLAN_START
};
