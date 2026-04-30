// Manual test endpoint for WhatsApp sending. Requires CRON_SECRET.
// Sends to every athlete-with-phone (same path as cron).
const { sendWhatsApp } = require('./../lib/whatsapp');
const { buildMorningMessage } = require('./../lib/messages');
const repo = require('./../lib/repo');
const { ok, boom, unauth, methodNotAllowed } = require('./../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET','POST']);
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.query?.key || req.headers['x-cron-secret'];
  if (!cronSecret || provided !== cronSecret) return unauth(res);
  try {
    const targets = await repo.listAthletesWithPhone();
    const results = [];
    for (const { ownerId, athlete } of targets) {
      const phone = (athlete?.phone || '').replace(/\D/g, '');
      if (!phone) continue;
      try {
        await sendWhatsApp(phone, buildMorningMessage());
        results.push({ ownerId, sent: true });
      } catch (e) {
        results.push({ ownerId, sent: false, error: e?.message || String(e) });
      }
    }
    return ok(res, { success: true, results });
  } catch (e) {
    return boom(res, e);
  }
};
