// Tiny helpers for Vercel serverless function handlers
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function ok(res, body)   { return json(res, 200, body); }
function bad(res, msg)   { return json(res, 400, { success:false, error: msg }); }
function nope(res, msg)  { return json(res, 404, { success:false, error: msg }); }
function boom(res, e)    { return json(res, 500, { success:false, error: e?.message || String(e) }); }
function unauth(res)     { return json(res, 401, { success:false, error: 'unauthorized' }); }

async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return json(res, 405, { success:false, error: 'method_not_allowed' });
}

module.exports = { json, ok, bad, nope, boom, unauth, readBody, methodNotAllowed };
