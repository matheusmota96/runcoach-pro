// POST /api/auth/logout — destroys the current session, clears the cookie.
const { ok, boom, methodNotAllowed } = require('../../lib/http');
const auth = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const token = auth.parseCookies(req)['mota_sess'];
    if (token) await auth.destroySession(token);
    auth.clearSessionCookie(res);
    return ok(res, { success: true });
  } catch (e) {
    return boom(res, e);
  }
};
