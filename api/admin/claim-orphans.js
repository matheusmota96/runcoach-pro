// One-shot endpoint to assign all rows with owner_id IS NULL to the OWNER_EMAIL user.
// Auth: requires query string ?key=$MIGRATE_SECRET.
// Idempotent: running twice just returns counts={0,0,0,0} on the second run.
//
// Usage: POST /api/admin/claim-orphans?key=YOUR_SECRET
//        Optional: &email=alguem@dominio.com (override OWNER_EMAIL)

const { ok, bad, unauth, boom, methodNotAllowed } = require('../../lib/http');
const auth = require('../../lib/auth');
const repo = require('../../lib/repo');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }
  try {
    const secret = process.env.MIGRATE_SECRET;
    if (!secret) return bad(res, 'MIGRATE_SECRET nao configurado');
    if ((req.query?.key || '') !== secret) return unauth(res);

    const email = (req.query?.email || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    if (!email) return bad(res, 'OWNER_EMAIL nao definido (passe ?email=...)');

    const user = await auth.findUserByEmail(email);
    if (!user) return bad(res, `usuario ${email} nao existe — cadastre-se primeiro`);

    const counts = await repo.claimOrphansFor(user.id);
    return ok(res, { success: true, ownerId: user.id, email: user.email, claimed: counts });
  } catch (e) {
    return boom(res, e);
  }
};
