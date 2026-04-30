const repo = require('../lib/repo');
const { ok, boom, methodNotAllowed } = require('../lib/http');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const user = await requireAuth(req, res); if (!user) return;
  try {
    const state = await repo.getFullState(user.id);
    return ok(res, state);
  } catch (e) {
    return boom(res, e);
  }
};
