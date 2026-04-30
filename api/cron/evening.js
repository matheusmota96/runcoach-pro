// Triggered by Vercel Cron (21:00 America/Sao_Paulo). See vercel.json.
// Iterates over every user that has an athlete row with a phone configured.

const { sendWhatsApp } = require('../../lib/whatsapp');
const { buildEveningMessage } = require('../../lib/messages');
const repo = require('../../lib/repo');
const { ok, boom, unauth } = require('../../lib/http');

function isAuthorized(req) {
  if (req.headers['x-vercel-cron'] || req.headers['x-vercel-signature']) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return (req.query?.key || req.headers['x-cron-secret']) === cronSecret;
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
        await sendWhatsApp(phone, buildEveningMessage());
        results.push({ ownerId, sent: true });
      } catch (e) {
        results.push({ ownerId, sent: false, error: e?.message || String(e) });
      }
    }
    return ok(res, { success: true, kind: 'evening', results });
  } catch (e) {
    return boom(res, e);
  }
};
