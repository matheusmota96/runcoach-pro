const repo = require('../../lib/repo');
const { ok, boom, readBody, methodNotAllowed } = require('../../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = await readBody(req);
    body.date = body.date || new Date().toISOString().slice(0, 10);
    const saved = await repo.insertMeal(body);
    const state = await repo.getFullState();
    return ok(res, { success: true, id: saved.id, data: state });
  } catch (e) {
    return boom(res, e);
  }
};
