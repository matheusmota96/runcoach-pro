const repo = require('../lib/repo');
const { ok, bad, boom, readBody, methodNotAllowed } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const user = await requireAuth(req, res); if (!user) return;
  try {
    const body = await readBody(req);
    if (!body || !Array.isArray(body.logs) || !Array.isArray(body.meals)) {
      return bad(res, 'invalid data shape (logs/meals required)');
    }
    await repo.setFullState(user.id, body);
    return ok(res, { success: true });
  } catch (e) {
    return boom(res, e);
  }
};
