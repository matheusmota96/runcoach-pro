const repo = require('../../lib/repo');
const { ok, boom, readBody, methodNotAllowed } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const user = await requireAuth(req, res); if (!user) return;
  try {
    const body = await readBody(req);
    body.date = body.date || new Date().toISOString().slice(0, 10);
    const saved = await repo.insertMeal(user.id, body);
    const state = await repo.getFullState(user.id);
    return ok(res, { success: true, id: saved.id, data: state });
  } catch (e) {
    return boom(res, e);
  }
};
