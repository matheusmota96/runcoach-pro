// Triggered by Vercel Cron (Sunday 20:00 America/Sao_Paulo). See vercel.json.

const { sendWhatsApp } = require('../../lib/whatsapp');
const { buildWeeklySummary } = require('../../lib/messages');
const repo = require('../../lib/repo');
const { ok, boom, unauth } = require('../../lib/http');

function isAuthorized(req) {
  if (req.headers['x-vercel-cron'] || req.headers['x-vercel-signature']) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return (req.query?.key || req.headers['x-cron-secret']) === cronSecret;
}

function normalizeType(raw) {
  const v = String(raw||'').toLowerCase().trim();
  if (['corrida','run','running'].includes(v)) return 'corrida';
  if (['bike','ciclismo','cycling'].includes(v)) return 'bike';
  if (['natacao','swim','swimming'].includes(v)) return 'natacao';
  if (['musculacao','academia','strength','forca','gym'].includes(v)) return 'musculacao';
  if (['brick'].includes(v)) return 'brick';
  return v || 'outro';
}

function calcWeekStats(logs) {
  const now = new Date();
  const sun = new Date(now); sun.setDate(now.getDate() - now.getDay()); sun.setHours(0,0,0,0);
  const sat = new Date(sun); sat.setDate(sun.getDate()+6); sat.setHours(23,59,59,999);
  const stats = { runKm:0, bikeKm:0, swimMeters:0, strengthSessions:0, totalSessions:0 };
  for (const l of (logs||[])) {
    const ld = new Date((l.date||'')+'T12:00:00');
    if (isNaN(ld) || ld < sun || ld > sat) continue;
    const t = normalizeType(l.type);
    if (t === 'corrida') stats.runKm += Number(l.distance||0);
    else if (t === 'bike') stats.bikeKm += Number(l.distance||0);
    else if (t === 'natacao') stats.swimMeters += Number(l.swimMeters||0);
    else if (t === 'brick') {
      stats.runKm  += Number(l.brickRunKm||0);
      stats.bikeKm += Number(l.brickBikeKm||0);
    }
    if (t === 'musculacao') stats.strengthSessions++;
    if (t !== 'descanso' && t !== 'mobilidade') stats.totalSessions++;
  }
  return stats;
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) return unauth(res);
  try {
    const targets = await repo.listAthletesWithPhone();
    if (targets.length === 0) return ok(res, { success: false, reason: 'no athletes with phone' });
    const results = [];
    for (const { ownerId, athlete } of targets) {
      const phone = (athlete?.phone || '').replace(/\D/g, '');
      if (!phone) continue;
      try {
        const logs = await repo.listLogs(ownerId);
        const stats = calcWeekStats(logs);
        await sendWhatsApp(phone, buildWeeklySummary(stats));
        results.push({ ownerId, sent: true, stats });
      } catch (e) {
        results.push({ ownerId, sent: false, error: e?.message || String(e) });
      }
    }
    return ok(res, { success: true, kind: 'weekly', results });
  } catch (e) {
    return boom(res, e);
  }
};
