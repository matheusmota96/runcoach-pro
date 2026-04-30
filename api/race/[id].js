const repo = require('../../lib/repo');
const { ok, nope, boom, readBody, methodNotAllowed } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (!id) return nope(res, 'invalid id');
  const user = await requireAuth(req, res); if (!user) return;
  try {
    if (req.method === 'PUT') {
      const body = await readBody(req);
      await repo.updateRace(user.id, id, { ...body, id });
      const state = await repo.getFullState(user.id);
      return ok(res, { success: true, data: state });
    }
    if (req.method === 'DELETE') {
      await repo.deleteRace(user.id, id);
      const state = await repo.getFullState(user.id);
      return ok(res, { success: true, data: state });
    }
    return methodNotAllowed(res, ['PUT', 'DELETE']);
  } catch (e) {
    return boom(res, e);
  }
};
