const repo = require('../../lib/repo');
const { ok, boom, readBody, methodNotAllowed } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const user = await requireAuth(req, res); if (!user) return;
  try {
    const body = await readBody(req);
    const saved = await repo.insertRace(user.id, body);
    const state = await repo.getFullState(user.id);
    return ok(res, { success: true, id: saved.id, data: state });
  } catch (e) {
    return boom(res, e);
  }
};
