// One-shot data import from the Railway deployment into Vercel Postgres.
// Idempotent: if `migration_marker` already has the import, refuses to run again.
// Auth: requires query string ?key=$MIGRATE_SECRET
//
// Usage: POST /api/admin/migrate?key=YOUR_SECRET
//        Optional: &source=https://web-production-bc7c2.up.railway.app
//        Optional: &email=matheusmota96@gmail.com (otherwise reads OWNER_EMAIL)
//        Optional: &force=1   (only works when migration_marker absent)
//
// The destination user must already exist (sign up first via /api/auth/signup).

const repo = require('../../lib/repo');
const auth = require('../../lib/auth');
const { ok, bad, unauth, boom, methodNotAllowed } = require('../../lib/http');

const DEFAULT_SOURCE = 'https://web-production-bc7c2.up.railway.app';

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }
  try {
    const secret = process.env.MIGRATE_SECRET;
    if (!secret) return bad(res, 'MIGRATE_SECRET not configured on the server');
    if ((req.query?.key || '') !== secret) return unauth(res);

    if (await repo.isMigrated()) {
      return bad(res, 'migration already ran. truncate tables and remove migration_marker row to re-run.');
    }

    const email = (req.query?.email || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    if (!email) return bad(res, 'OWNER_EMAIL nao definido (passe ?email=...)');
    const user = await auth.findUserByEmail(email);
    if (!user) return bad(res, `usuario ${email} nao existe — cadastre-se primeiro em /api/auth/signup`);

    const source = req.query?.source || DEFAULT_SOURCE;
    const url = source.replace(/\/$/, '') + '/api/data';
    const r = await fetch(url, { headers: { 'Cache-Control': 'no-store' } });
    if (!r.ok) return bad(res, `source returned HTTP ${r.status}`);
    const payload = await r.json();
    if (!payload || !Array.isArray(payload.logs) || !Array.isArray(payload.meals)) {
      return bad(res, 'source payload is missing logs/meals arrays');
    }

    await repo.setFullState(user.id, payload);
    const summary = {
      ownerId: user.id, email: user.email,
      logs:  payload.logs.length,
      meals: payload.meals.length,
      races: Array.isArray(payload.races) ? payload.races.length : 0,
      source: url
    };
    await repo.markMigrated(summary);

    return ok(res, { success: true, imported: summary });
  } catch (e) {
    return boom(res, e);
  }
};
