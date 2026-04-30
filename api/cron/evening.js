// Triggered by Vercel Cron (21:00 America/Sao_Paulo). See vercel.json.

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
    const athlete = await repo.getAthlete();
    const phone = (athlete?.phone || '').replace(/\D/g, '');
    if (!phone) return ok(res, { success: false, reason: 'no phone configured' });
    await sendWhatsApp(phone, buildEveningMessage());
    return ok(res, { success: true, sent: 'evening' });
  } catch (e) {
    return boom(res, e);
  }
};
