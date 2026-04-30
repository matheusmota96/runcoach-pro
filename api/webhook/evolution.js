// Evolution API webhook receiver. Single-user app — replies are no-op for now;
// later this can dispatch incoming WhatsApp messages into the log/meal flow.
const { ok, methodNotAllowed, readBody } = require('../../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { await readBody(req); } catch (e) { /* ignore parse errors */ }
  return ok(res, { received: true });
};
