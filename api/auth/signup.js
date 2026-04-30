// POST /api/auth/signup  { email, password, name? }
// Creates a user, opens a session, and (if email matches OWNER_EMAIL and there
// are no other 'owner' users yet) auto-claims all orphan historical rows.
const { ok, bad, boom, readBody, methodNotAllowed } = require('../../lib/http');
const auth = require('../../lib/auth');
const repo = require('../../lib/repo');
const { sql } = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { email, password, name } = await readBody(req);
    if (!email || !password) return bad(res, 'email e senha obrigatorios');

    const existing = await auth.findUserByEmail(email);
    if (existing) return bad(res, 'email ja cadastrado');

    const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const normalized = auth.normalizeEmail(email);

    let role = 'user';
    if (ownerEmail && normalized === ownerEmail) {
      const existingOwners = await sql`SELECT COUNT(*)::int AS c FROM users WHERE role = 'owner'`;
      if ((existingOwners[0]?.c || 0) === 0) role = 'owner';
    }

    const user = await auth.createUser({ email: normalized, password, name, role });
    const { token, expiresAt } = await auth.createSession(user.id);
    auth.setSessionCookie(res, token, expiresAt);

    let claimed = null;
    if (role === 'owner') {
      claimed = await repo.claimOrphansFor(user.id);
    }

    return ok(res, { success: true, user, claimed });
  } catch (e) {
    return boom(res, e);
  }
};
