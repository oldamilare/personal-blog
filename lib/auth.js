const crypto = require('crypto');

const USER = process.env.ADMIN_USER || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = 8;

const usingDefaults = !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD;

const hmac = (text) => crypto.createHmac('sha256', SECRET).update(text).digest('hex');
const digest = (text) => crypto.createHash('sha256').update(text).digest();

// Hashing first means both sides are the same length, so timingSafeEqual works
function sameText(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function checkLogin(username, password) {
  const userOk = sameText(username, USER);
  const passOk = sameText(password, PASSWORD);
  return userOk && passOk;
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// The session cookie is "<expiry time>.<signature>", so it can't be forged or extended
function sessionValue(req) {
  const cookie = readCookie(req, 'session');
  if (!cookie) return null;
  const [expires, signature] = cookie.split('.');
  if (!expires || !signature || !sameText(signature, hmac(expires))) return null;
  return Number(expires) > Date.now() ? cookie : null;
}

function startSession(res) {
  const expires = String(Date.now() + SESSION_HOURS * 3600 * 1000);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `session=${expires}.${hmac(expires)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_HOURS * 3600}${secure}`);
}

function endSession(res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

// Makes `admin` and `csrf` available to every template
function attach(req, res, next) {
  const session = sessionValue(req);
  req.session = session;
  res.locals.admin = Boolean(session);
  res.locals.csrf = session ? hmac('csrf:' + session) : '';
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session) return res.redirect('/login');
  next();
}

function verifyCsrf(req, res, next) {
  const sent = String((req.body && req.body._csrf) || '');
  if (!req.session || !sameText(sent, res.locals.csrf)) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'That form has expired. Go back, reload the page and try again.' });
  }
  next();
}

module.exports = { checkLogin, startSession, endSession, attach, requireAdmin, verifyCsrf, usingDefaults };
