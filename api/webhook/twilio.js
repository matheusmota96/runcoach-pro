// Twilio WhatsApp webhook receiver.
const { ok, methodNotAllowed, readBody } = require('../../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try { await readBody(req); } catch (e) { /* ignore */ }
  return ok(res, { received: true });
};
