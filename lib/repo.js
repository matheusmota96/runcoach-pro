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
  name:'', height:null, weight:null, bf:null, tmb:null,
  phone:'', plan:'ironman_70_3'
};

const OWNER_ATHLETE_TEMPLATE = {
  name:'Mota', height:1.82, weight:78, bf:18.8, tmb:1687,
  phone:'+5561982550045', plan:'ironman_70_3'
};

async function getAthlete(ownerId) {
  await ensureSchema();
  if (!ownerId) throw new Error('ownerId required');
  const rows = await sql`SELECT data FROM athlete WHERE owner_id = ${ownerId} LIMIT 1`;
  if (rows.length === 0) {
    const seed = { ...DEFAULT_ATHLETE };
    const id = await bumpCounter('athletes');
    await sql`
      INSERT INTO athlete (id, owner_id, data) VALUES (${id}, ${ownerId}, ${JSON.stringify(seed)}::jsonb)
      ON CONFLICT DO NOTHING
    `;
    return seed;
  }
  return rows[0].data;
}

async function setAthlete(ownerId, data) {
  await ensureSchema();
  if (!ownerId) throw new Error('ownerId required');
  const existing = await sql`SELECT id FROM athlete WHERE owner_id = ${ownerId} LIMIT 1`;
  if (existing.length === 0) {
    const id = await bumpCounter('athletes');
    await sql`
      INSERT INTO athlete (id, owner_id, data) VALUES (${id}, ${ownerId}, ${JSON.stringify(data)}::jsonb)
    `;
  } else {
    await sql`
      UPDATE athlete SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW()
      WHERE owner_id = ${ownerId}
    `;
  }
  return data;
}

async function listLogs(ownerId) {
  await ensureSchema();
  const rows = await sql`SELECT data FROM logs WHERE owner_id = ${ownerId} ORDER BY date DESC, id DESC`;
  return rows.map(r => r.data);
}

async function listMeals(ownerId) {
  await ensureSchema();
  const rows = await sql`SELECT data FROM meals WHERE owner_id = ${ownerId} ORDER BY date DESC, id DESC`;
  return rows.map(r => r.data);
}

async function listRaces(ownerId) {
  await ensureSchema();
  const rows = await sql`SELECT data FROM races WHERE owner_id = ${ownerId} ORDER BY date ASC, id ASC`;
  let races = rows.map(r => r.data);
  if (!races.find(r => r.name === 'LiveRun 21km')) {
    await insertRace(ownerId, DEFAULT_RACES[0]);
    races.unshift(DEFAULT_RACES[0]);
  }
  if (!races.find(r => r.type === 'ironman_70_3')) {
    await insertRace(ownerId, DEFAULT_RACES[1]);
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

async function insertLog(ownerId, log) {
  await ensureSchema();
  if (!log.id) log.id = await bumpCounter('logs');
  await sql`
    INSERT INTO logs (id, owner_id, date, type, data)
    VALUES (${log.id}, ${ownerId}, ${log.date}, ${log.type}, ${JSON.stringify(log)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id, date = EXCLUDED.date, type = EXCLUDED.type,
      data = EXCLUDED.data, updated_at = NOW()
  `;
  return log;
}
async function updateLog(ownerId, id, log) {
  await ensureSchema();
  log.id = Number(id);
  const r = await sql`
    UPDATE logs SET date = ${log.date}, type = ${log.type}, data = ${JSON.stringify(log)}::jsonb, updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `;
  if (r.length === 0) throw new Error('log not found');
  return log;
}
async function deleteLog(ownerId, id) {
  await ensureSchema();
  await sql`DELETE FROM logs WHERE id = ${id} AND owner_id = ${ownerId}`;
}

async function insertMeal(ownerId, meal) {
  await ensureSchema();
  if (!meal.id) meal.id = await bumpCounter('meals');
  await sql`
    INSERT INTO meals (id, owner_id, date, type, data)
    VALUES (${meal.id}, ${ownerId}, ${meal.date}, ${meal.type}, ${JSON.stringify(meal)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id, date = EXCLUDED.date, type = EXCLUDED.type,
      data = EXCLUDED.data, updated_at = NOW()
  `;
  return meal;
}
async function updateMeal(ownerId, id, meal) {
  await ensureSchema();
  meal.id = Number(id);
  const r = await sql`
    UPDATE meals SET date = ${meal.date}, type = ${meal.type}, data = ${JSON.stringify(meal)}::jsonb, updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `;
  if (r.length === 0) throw new Error('meal not found');
  return meal;
}
async function deleteMeal(ownerId, id) {
  await ensureSchema();
  await sql`DELETE FROM meals WHERE id = ${id} AND owner_id = ${ownerId}`;
}

async function insertRace(ownerId, race) {
  await ensureSchema();
  if (!race.id) race.id = await bumpCounter('races');
  await sql`
    INSERT INTO races (id, owner_id, name, date, type, status, data)
    VALUES (${race.id}, ${ownerId}, ${race.name}, ${race.date}, ${race.type}, ${race.status||'planejada'}, ${JSON.stringify(race)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      owner_id = EXCLUDED.owner_id, name = EXCLUDED.name, date = EXCLUDED.date,
      type = EXCLUDED.type, status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()
  `;
  return race;
}
async function updateRace(ownerId, id, race) {
  await ensureSchema();
  race.id = Number(id);
  const r = await sql`
    UPDATE races SET name = ${race.name}, date = ${race.date}, type = ${race.type},
                     status = ${race.status||'planejada'}, data = ${JSON.stringify(race)}::jsonb,
                     updated_at = NOW()
    WHERE id = ${id} AND owner_id = ${ownerId}
    RETURNING id
  `;
  if (r.length === 0) throw new Error('race not found');
  return race;
}
async function deleteRace(ownerId, id) {
  await ensureSchema();
  await sql`DELETE FROM races WHERE id = ${id} AND owner_id = ${ownerId}`;
}

async function getFullState(ownerId) {
  await ensureSchema();
  const [athlete, logs, meals, races, nextLogId, nextMealId, nextRaceId] = await Promise.all([
    getAthlete(ownerId),
    listLogs(ownerId),
    listMeals(ownerId),
    listRaces(ownerId),
    getCounter('logs'),
    getCounter('meals'),
    getCounter('races')
  ]);
  return { athlete, logs, meals, races, nextId: nextLogId, nextMealId, nextRaceId };
}

async function setFullState(ownerId, state) {
  await ensureSchema();
  if (state.athlete) await setAthlete(ownerId, state.athlete);
  if (Array.isArray(state.logs))  for (const l of state.logs)  await insertLog(ownerId, l);
  if (Array.isArray(state.meals)) for (const m of state.meals) await insertMeal(ownerId, m);
  if (Array.isArray(state.races)) for (const r of state.races) await insertRace(ownerId, r);
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

// Assigns every orphan row (owner_id IS NULL) to the given user. Idempotent.
// Returns counts. Also bootstraps an athlete row if the user has none and the
// pre-migration singleton athlete (id=1) was orphan: we just inherit it.
async function claimOrphansFor(ownerId) {
  await ensureSchema();
  const [logsR, mealsR, racesR, athleteR] = await Promise.all([
    sql`UPDATE logs   SET owner_id = ${ownerId} WHERE owner_id IS NULL RETURNING id`,
    sql`UPDATE meals  SET owner_id = ${ownerId} WHERE owner_id IS NULL RETURNING id`,
    sql`UPDATE races  SET owner_id = ${ownerId} WHERE owner_id IS NULL RETURNING id`,
    sql`UPDATE athlete SET owner_id = ${ownerId} WHERE owner_id IS NULL RETURNING id`
  ]);
  return {
    logs:  logsR.length,
    meals: mealsR.length,
    races: racesR.length,
    athlete: athleteR.length
  };
}

// Athletes that should receive proactive WhatsApp messages from cron jobs.
async function listAthletesWithPhone() {
  await ensureSchema();
  const rows = await sql`
    SELECT a.owner_id, a.data
    FROM athlete a
    WHERE a.owner_id IS NOT NULL
      AND COALESCE(a.data->>'phone', '') <> ''
  `;
  return rows.map(r => ({ ownerId: r.owner_id, athlete: r.data }));
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
  claimOrphansFor, listAthletesWithPhone,
  DEFAULT_RACES, DEFAULT_ATHLETE, OWNER_ATHLETE_TEMPLATE
};
