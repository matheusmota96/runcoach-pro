// GET /api/auth/me — returns current user (or 401 if not logged in).
const { ok, unauth, boom, methodNotAllowed } = require('../../lib/http');
const auth = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const user = await auth.getCurrentUser(req);
    if (!user) return unauth(res);
    return ok(res, { success: true, user });
  } catch (e) {
    return boom(res, e);
  }
};
