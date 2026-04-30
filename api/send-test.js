// Manual test endpoint for WhatsApp sending. Requires CRON_SECRET (or VERCEL_OIDC).
const { sendWhatsApp } = require('../lib/whatsapp');
const { buildMorningMessage } = require('../lib/messages');
const repo = require('../lib/repo');
const { ok, boom, unauth, methodNotAllowed } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET','POST']);
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.query?.key || req.headers['x-cron-secret'];
  if (!cronSecret || provided !== cronSecret) return unauth(res);
  try {
    const athlete = await repo.getAthlete();
    const phone = (athlete?.phone || '').replace(/\D/g, '');
    await sendWhatsApp(phone, buildMorningMessage());
    return ok(res, { success: true });
  } catch (e) {
    return boom(res, e);
  }
};
