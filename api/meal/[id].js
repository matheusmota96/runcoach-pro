const repo = require('../../lib/repo');
const { ok, nope, boom, readBody, methodNotAllowed } = require('../../lib/http');

module.exports = async (req, res) => {
  const id = parseInt(req.query.id, 10);
  if (!id) return nope(res, 'invalid id');
  try {
    if (req.method === 'PUT') {
      const body = await readBody(req);
      await repo.updateMeal(id, { ...body, id });
      const state = await repo.getFullState();
      return ok(res, { success: true, data: state });
    }
    if (req.method === 'DELETE') {
      await repo.deleteMeal(id);
      const state = await repo.getFullState();
      return ok(res, { success: true, data: state });
    }
    return methodNotAllowed(res, ['PUT', 'DELETE']);
  } catch (e) {
    return boom(res, e);
  }
};
