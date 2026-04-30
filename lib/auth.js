// Email/password auth backed by Postgres.
// - Hashing: scrypt (Node built-in, no extra deps, no native build).
// - Sessions: random token in HttpOnly cookie, server-side row in `sessions`.
// - Middleware: requireAuth(req, res) → returns { user } or sends 401.

const crypto = require('crypto');
const { sql, ensureSchema } = require('./db');

const SESSION_TTL_DAYS = 30;
const SCRYPT_N = 16384, SCRYPT_R = 8, SCRYPT_P = 1, SCRYPT_KEYLEN = 64;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(plain) {
  if (!plain || plain.length < 8) throw new Error('senha precisa ter pelo menos 8 caracteres');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N},${SCRYPT_R},${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, params, saltB64, hashB64] = stored.split('$');
  const [N, r, p] = params.split(',').map(Number);
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const got = crypto.scryptSync(plain, salt, expected.length, { N, r, p });
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function createSession(userId) {
  await ensureSchema();
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;
  return { token, expiresAt };
}

async function destroySession(token) {
  if (!token) return;
  await ensureSchema();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

async function findSession(token) {
  if (!token) return null;
  await ensureSchema();
  const rows = await sql`
    SELECT s.token, s.user_id, s.expires_at,
           u.id, u.email, u.name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return { token: r.token, user: { id: r.id, email: r.email, name: r.name, role: r.role } };
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const [k, ...rest] = part.trim().split('=');
    if (!k) return;
    out[k] = decodeURIComponent(rest.join('=') || '');
  });
  return out;
}

function setSessionCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const parts = [
    `mota_sess=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    `Expires=${expiresAt.toUTCString()}`
  ];
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') parts.push('Secure');
  appendSetCookie(res, parts.join('; '));
}

function clearSessionCookie(res) {
  appendSetCookie(res, 'mota_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
}

function appendSetCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) res.setHeader('Set-Cookie', value);
  else if (Array.isArray(existing)) res.setHeader('Set-Cookie', [...existing, value]);
  else res.setHeader('Set-Cookie', [existing, value]);
}

async function getCurrentUser(req) {
  const token = parseCookies(req)['mota_sess'];
  if (!token) return null;
  const sess = await findSession(token);
  return sess ? sess.user : null;
}

// Middleware-style: returns user on success; on failure writes 401 and returns null.
async function requireAuth(req, res) {
  const user = await getCurrentUser(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ success: false, error: 'unauthorized' }));
    return null;
  }
  return user;
}

async function findUserByEmail(email) {
  await ensureSchema();
  const rows = await sql`SELECT id, email, password_hash, name, role FROM users WHERE email = ${normalizeEmail(email)} LIMIT 1`;
  return rows[0] || null;
}

async function createUser({ email, password, name, role = 'user' }) {
  await ensureSchema();
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('email invalido');
  const hash = hashPassword(password);
  const rows = await sql`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (${normalized}, ${hash}, ${name || null}, ${role})
    RETURNING id, email, name, role
  `;
  return rows[0];
}

async function countUsers() {
  await ensureSchema();
  const rows = await sql`SELECT COUNT(*)::int AS c FROM users`;
  return rows[0]?.c || 0;
}

module.exports = {
  hashPassword, verifyPassword,
  createSession, destroySession, findSession,
  parseCookies, setSessionCookie, clearSessionCookie,
  getCurrentUser, requireAuth,
  findUserByEmail, createUser, countUsers,
  normalizeEmail
};
