// POST /api/auth/login  { email, password }
const { ok, bad, unauth, boom, readBody, methodNotAllowed } = require('../../lib/http');
const auth = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const { email, password } = await readBody(req);
    if (!email || !password) return bad(res, 'email e senha obrigatorios');

    const user = await auth.findUserByEmail(email);
    if (!user) return unauth(res);
    if (!auth.verifyPassword(password, user.password_hash)) return unauth(res);

    const { token, expiresAt } = await auth.createSession(user.id);
    auth.setSessionCookie(res, token, expiresAt);

    return ok(res, {
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (e) {
    return boom(res, e);
  }
};
