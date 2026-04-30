const { sql, ensureSchema } = require('./db');

const DEFAULT_RACES = [
  { id:1, name:'LiveRun 21km', type:'meia_maratona', date:'2026-04-19',
    distance:21.4, status:'concluida', timeMin:130, paceNum:6.07, pace:'6:04',
    feeling:'cansado', goal:'Concluir 21k abaixo de 2h10', result:'2h10 - concluida',
    notes:'Primeira meia maratona. Concluida com sucesso.' },
  { id:2, name:'Ironman 70.3 Brasilia', type:'ironman_70_3', date:'2027-04-18',
    distance:113, swimKm:1.9, bikeKm:90, runKm:21.1,
    status:'planejada', goal:'Concluir bem, com seguranca e consistencia',
    notes:'Prova principal - 12 meses de preparacao.' }
];

const DEFAULT_ATHLETE = {
  name:'Mota', height:1.82, weight:78, bf:18.8, tmb:1687,
  phone:'+5561982550045', plan:'ironman_70_3'
};

async function getAthlete() {
  await ensureSchema();
  const rows = await sql`SELECT data FROM athlete WHERE id = 1`;
  if (rows.length === 0) {
    await sql`INSERT INTO athlete (id, data) VALUES (1, ${JSON.stringify(DEFAULT_ATHLETE)}::jsonb)`;
    return DEFAULT_ATHLETE;
  }
  return rows[0].data;
}

async function setAthlete(data) {
  await ensureSchema();
  await sql`
    INSERT INTO athlete (id, data, updated_at) VALUES (1, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  return data;
}

async function listLogs() {
  await ensureSchema();
  const rows = await sql`SELECT data FROM logs ORDER BY date DESC, id DESC`;
  return rows.map(r => r.data);
}

async function listMeals() {
  await ensureSchema();
  const rows = await sql`SELECT data FROM meals ORDER BY date DESC, id DESC`;
  return rows.map(r => r.data);
}

async function listRaces() {
  await ensureSchema();
  const rows = await sql`SELECT data FROM races ORDER BY date ASC, id ASC`;
  let races = rows.map(r => r.data);
  if (!races.find(r => r.name === 'LiveRun 21km')) {
    await insertRace(DEFAULT_RACES[0]);
    races.unshift(DEFAULT_RACES[0]);
  }
  if (!races.find(r => r.type === 'ironman_70_3')) {
    await insertRace(DEFAULT_RACES[1]);
    races.push(DEFAULT_RACES[1]);
  }
  return races;
}

async function getCounter(key) {
  await ensureSchema();
  const rows = await sql`SELECT value FROM counters WHERE key = ${key}`;
  return rows[0]?.value || 1;
}
async function bumpCounter(key) {
  await ensureSchema();
  const rows = await sql`
    INSERT INTO counters (key, value) VALUES (${key}, 2)
    ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
    RETURNING value
  `;
  return rows[0].value - 1;
}
async function setCounter(key, value) {
  await ensureSchema();
  await sql`
    INSERT INTO counters (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = GREATEST(counters.value, EXCLUDED.value)
  `;
}

async function insertLog(log) {
  await ensureSchema();
  if (!log.id) log.id = await bumpCounter('logs');
  await sql`
    INSERT INTO logs (id, date, type, data) VALUES (${log.id}, ${log.date}, ${log.type}, ${JSON.stringify(log)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, type = EXCLUDED.type, data = EXCLUDED.data, updated_at = NOW()
  `;
  return log;
}
async function updateLog(id, log) {
  await ensureSchema();
  log.id = Number(id);
  await sql`
    UPDATE logs SET date = ${log.date}, type = ${log.type}, data = ${JSON.stringify(log)}::jsonb, updated_at = NOW()
    WHERE id = ${id}
  `;
  return log;
}
async function deleteLog(id) {
  await ensureSchema();
  await sql`DELETE FROM logs WHERE id = ${id}`;
}

async function insertMeal(meal) {
  await ensureSchema();
  if (!meal.id) meal.id = await bumpCounter('meals');
  await sql`
    INSERT INTO meals (id, date, type, data) VALUES (${meal.id}, ${meal.date}, ${meal.type}, ${JSON.stringify(meal)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, type = EXCLUDED.type, data = EXCLUDED.data, updated_at = NOW()
  `;
  return meal;
}
async function updateMeal(id, meal) {
  await ensureSchema();
  meal.id = Number(id);
  await sql`
    UPDATE meals SET date = ${meal.date}, type = ${meal.type}, data = ${JSON.stringify(meal)}::jsonb, updated_at = NOW()
    WHERE id = ${id}
  `;
  return meal;
}
async function deleteMeal(id) {
  await ensureSchema();
  await sql`DELETE FROM meals WHERE id = ${id}`;
}

async function insertRace(race) {
  await ensureSchema();
  if (!race.id) race.id = await bumpCounter('races');
  await sql`
    INSERT INTO races (id, name, date, type, status, data)
    VALUES (${race.id}, ${race.name}, ${race.date}, ${race.type}, ${race.status||'planejada'}, ${JSON.stringify(race)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, date = EXCLUDED.date, type = EXCLUDED.type, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()
  `;
  return race;
}
async function updateRace(id, race) {
  await ensureSchema();
  race.id = Number(id);
  await sql`
    UPDATE races SET name = ${race.name}, date = ${race.date}, type = ${race.type}, status = ${race.status||'planejada'}, data = ${JSON.stringify(race)}::jsonb, updated_at = NOW()
    WHERE id = ${id}
  `;
  return race;
}
async function deleteRace(id) {
  await ensureSchema();
  await sql`DELETE FROM races WHERE id = ${id}`;
}

async function getFullState() {
  await ensureSchema();
  const [athlete, logs, meals, races, nextLogId, nextMealId, nextRaceId] = await Promise.all([
    getAthlete(),
    listLogs(),
    listMeals(),
    listRaces(),
    getCounter('logs'),
    getCounter('meals'),
    getCounter('races')
  ]);
  return { athlete, logs, meals, races, nextId: nextLogId, nextMealId, nextRaceId };
}

async function setFullState(state) {
  await ensureSchema();
  if (state.athlete) await setAthlete(state.athlete);
  if (Array.isArray(state.logs))  for (const l of state.logs)  await insertLog(l);
  if (Array.isArray(state.meals)) for (const m of state.meals) await insertMeal(m);
  if (Array.isArray(state.races)) for (const r of state.races) await insertRace(r);
  if (state.nextId)     await setCounter('logs', state.nextId);
  if (state.nextMealId) await setCounter('meals', state.nextMealId);
  if (state.nextRaceId) await setCounter('races', state.nextRaceId);
}

async function isMigrated() {
  await ensureSchema();
  const rows = await sql`SELECT value FROM migration_marker WHERE key = 'railway_import'`;
  return rows.length > 0;
}
async function markMigrated(meta) {
  await ensureSchema();
  await sql`
    INSERT INTO migration_marker (key, value, ran_at) VALUES ('railway_import', ${JSON.stringify(meta)}, NOW())
    ON CONFLICT (key) DO NOTHING
  `;
}

module.exports = {
  getAthlete, setAthlete,
  listLogs, listMeals, listRaces,
  insertLog, updateLog, deleteLog,
  insertMeal, updateMeal, deleteMeal,
  insertRace, updateRace, deleteRace,
  getCounter, bumpCounter, setCounter,
  getFullState, setFullState,
  isMigrated, markMigrated,
  DEFAULT_RACES, DEFAULT_ATHLETE
};
