const repo = require('../lib/repo');
const { ok, boom, methodNotAllowed } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const state = await repo.getFullState();
    return ok(res, state);
  } catch (e) {
    return boom(res, e);
  }
};
