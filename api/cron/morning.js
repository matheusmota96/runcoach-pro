// Triggered by Vercel Cron (07:00 America/Sao_Paulo). See vercel.json.
// Vercel forwards cron requests with header `x-vercel-cron`.

const { sendWhatsApp } = require('../../lib/whatsapp');
const { buildMorningMessage } = require('../../lib/messages');
const repo = require('../../lib/repo');
const { ok, boom, unauth } = require('../../lib/http');

function isVercelCron(req) {
  // Vercel sets these on cron-triggered requests
  return !!req.headers['x-vercel-cron'] || !!req.headers['x-vercel-signature'];
}
function isAuthorized(req) {
  if (isVercelCron(req)) return true;
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
    await sendWhatsApp(phone, buildMorningMessage());
    return ok(res, { success: true, sent: 'morning' });
  } catch (e) {
    return boom(res, e);
  }
};
