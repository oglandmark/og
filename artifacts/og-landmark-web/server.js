/**
 * OG Landmark — Express Backend (Neon PostgreSQL Storage)
 * --------------------------------------------------
 * Data stored in Neon PostgreSQL (persists across restarts)
 * Run: node server.js
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { neon } = require('@neondatabase/serverless');
const multer = require('multer');

// ─── File Upload (Multer) ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/images/uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_VIDEO_EXT = ['.mp4', '.mov'];
const MAX_LISTING_IMAGES = 30;
const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB (covers large video)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // React Native/Android may report a selected local file as
    // application/octet-stream even when the client supplies a valid image
    // extension. The extension remains allowlisted, so accept that transport
    // MIME as well as the normal browser MIME values.
    const transportMime = file.mimetype === 'application/octet-stream'
      || file.mimetype === 'binary/octet-stream';
    const image = ALLOWED_IMAGE_EXT.includes(ext)
      && (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype) || transportMime);
    const video = ALLOWED_VIDEO_EXT.includes(ext)
      && (/^video\/(mp4|quicktime)$/.test(file.mimetype) || transportMime);
    const ok = image || video;
    cb(ok ? null : new Error('Allowed: JPG, PNG, WebP, MP4, MOV'), ok);
  }
});

// Neon is the production database. The local/Replit preview keeps its
// JSON fallback so the website can run without exposing database credentials.
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
const databaseConfigured = Boolean(databaseUrl);
const localPreview = Boolean(process.env.REPLIT_ENVIRONMENT) || (!databaseConfigured && process.env.NODE_ENV === 'development');
if (!databaseConfigured && !localPreview) {
  console.error('Neon settings are missing. Set DATABASE_URL to your Neon PostgreSQL connection string in production.');
}
const neonDb = databaseConfigured && !localPreview ? neon(databaseUrl) : null;
const fallbackFile = path.join(__dirname, 'runtime-data.json');
let dbReady = false;
let dbInitError = null;
// Legacy maps remain only as a local cache; authoritative sessions/challenges are persisted.
const otpStore = new Map();
const resetStore = new Map();
const tokenStore = new Map();

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}
const codeDigest = code => crypto.createHash('sha256').update(String(code)).digest('hex');
async function saveChallenge(email, purpose, code, minutes) {
  if (neonDb) {
    await neonDb`
      INSERT INTO auth_challenges (email, purpose, code_hash, attempts, expires_at)
      VALUES (${email}, ${purpose}, ${codeDigest(code)}, 0, NOW() + ${minutes} * INTERVAL '1 minute')
      ON CONFLICT (email, purpose)
      DO UPDATE SET code_hash = EXCLUDED.code_hash, attempts = 0, expires_at = EXCLUDED.expires_at
    `;
    return;
  }
  if (localPreview) {
    otpStore.set(`${purpose}:${email}`, { otp: code, expiry: Date.now() + minutes * 60000, attempts: 0 });
    return;
  }
  throw new Error('Neon is not configured for production.');
}
async function consumeChallenge(email, purpose, code) {
  if (neonDb) {
    const rows = await neonDb`
      SELECT email, purpose, code_hash, attempts, expires_at
      FROM auth_challenges
      WHERE email = ${email} AND purpose = ${purpose}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' };
    if (row.attempts >= 3) return { ok: false, reason: 'attempts' };
    if (codeDigest(code) !== row.code_hash) {
      await neonDb`
        UPDATE auth_challenges
        SET attempts = ${row.attempts + 1}
        WHERE email = ${email} AND purpose = ${purpose}
      `;
      return { ok: false, reason: 'invalid', left: 2 - row.attempts };
    }
    await neonDb`
      DELETE FROM auth_challenges
      WHERE email = ${email} AND purpose = ${purpose}
    `;
    return { ok: true };
  }
  if (localPreview) {
    const r = otpStore.get(`${purpose}:${email}`);
    if (!r || r.expiry < Date.now()) return { ok: false, reason: 'expired' };
    if (r.attempts >= 3) return { ok: false, reason: 'attempts' };
    if (r.otp !== String(code)) { r.attempts++; return { ok: false, reason: 'invalid', left: 3 - r.attempts }; }
    otpStore.delete(`${purpose}:${email}`); return { ok: true };
  }
  throw new Error('Neon is not configured for production.');
}

// Create nodemailer transporter from environment variables.
// Hostinger normally uses the full mailbox address as SMTP_USER and the
// mailbox password as SMTP_PASS. MAIL_* aliases are accepted for hPanel
// configurations that use those names.
const smtpSettings = {
  host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 465),
  user: process.env.SMTP_USER || process.env.MAIL_USERNAME || process.env.MAIL_USER || '',
  pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD || '',
  from: process.env.FROM_EMAIL || process.env.MAIL_FROM_ADDRESS || '',
  fromName: process.env.FROM_NAME || 'OG Landmark',
};
const smtpConfigured = Boolean(smtpSettings.user && smtpSettings.pass);

function createTransporter() {
  if (!smtpConfigured) {
    console.warn('SMTP is not configured — set SMTP_USER and SMTP_PASS in Hostinger.');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpSettings.host,
    port: smtpSettings.port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : smtpSettings.port === 465,
    auth: { user: smtpSettings.user, pass: smtpSettings.pass },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
    },
  });
}

// The visible FROM address shown to email recipients
function fromAddress() {
  const name = smtpSettings.fromName;
  const email = smtpSettings.from || smtpSettings.user;
  return `"${name}" <${email}>`;
}

async function verifySmtpConnection() {
  if (!smtpConfigured) {
    console.warn('SMTP status: not_configured');
    return;
  }
  try {
    await createTransporter().verify();
    console.log(`SMTP status: connected (${smtpSettings.host}:${smtpSettings.port})`);
  } catch (err) {
    console.error(`SMTP status: connection_failed (${err.message})`);
  }
}

// Branded email wrapper
function emailWrapper(bodyHtml) {
  return `
  <!DOCTYPE html>
  <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 0">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

          <!-- HEADER -->
          <tr><td style="background:#0B1F3A;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center">
            <img src="${(process.env.APP_URL||'https://oglandmark.com').replace(/\/$/,'')}/images/og-logo.png?v=10" alt="OG Landmark" width="72" height="72" style="display:block;margin:0 auto 12px;border-radius:14px;object-fit:contain;background:#fff;padding:4px"/>
            <h1 style="color:#C8A45A;font-size:24px;margin:4px 0 2px;letter-spacing:1px">OG Landmark</h1>
            <p style="color:#8a9ab5;font-size:11px;margin:0;letter-spacing:3px;text-transform:uppercase">Premium Real Estate</p>
          </td></tr>

          <!-- BODY -->
          <tr><td style="background:#ffffff;padding:32px">
            ${bodyHtml}
          </td></tr>

          <!-- FOOTER -->
          <tr><td style="background:#0B1F3A;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center">
            <p style="color:#8a9ab5;font-size:12px;margin:0 0 6px">OG Landmark — Premium Real Estate</p>
            <p style="color:#8a9ab5;font-size:11px;margin:0 0 4px">Okara, Depalpur, Renala Khurd &amp; Surrounding Areas</p>
            <p style="margin:8px 0 0">
              <a href="mailto:support@oglandmark.com" style="color:#C8A45A;font-size:11px;text-decoration:none">support@oglandmark.com</a>
            </p>
            <p style="color:#4a5a6a;font-size:10px;margin:10px 0 0">© ${new Date().getFullYear()} OG Landmark. All rights reserved.</p>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body></html>`;
}

async function sendPasswordResetEmail(toEmail, otp, role) {
  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, fallback: true };
  }
  const body = `
    <h2 style="color:#0B1F3A;font-size:20px;margin:0 0 8px;text-align:center">Password Reset Request</h2>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 24px">We received a request to reset your <strong>${role || 'Account'}</strong> password.</p>

    <div style="background:#0B1F3A;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
      <p style="color:#8a9ab5;font-size:13px;margin:0 0 12px;letter-spacing:1px;text-transform:uppercase">Your Reset Code</p>
      <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#C8A45A;padding:8px 0;font-family:'Courier New',monospace">${otp}</div>
      <div style="background:#C8A45A;height:2px;width:60px;margin:16px auto 12px;border-radius:2px"></div>
      <p style="color:#8a9ab5;font-size:12px;margin:0">Valid for <strong style="color:#ffffff">15 minutes</strong> only</p>
    </div>

    <div style="background:#fff8ec;border:1px solid #f0d89a;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="color:#856404;font-size:13px;margin:0">⚠️ <strong>Do not share this code</strong> with anyone. OG Landmark will never ask for your code.</p>
    </div>

    <p style="color:#888;font-size:12px;text-align:center;margin:0">If you did not request a password reset, please ignore this email. Your account remains secure.</p>
  `;
  await transporter.sendMail({
    from: fromAddress(),
    replyTo: smtpSettings.from || smtpSettings.user,
    to: toEmail,
    subject: '🔐 OG Landmark — Password Reset Code',
    html: emailWrapper(body),
  });
  return { sent: true, fallback: false };
}

async function sendOtpEmail(toEmail, otp) {
  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, fallback: true };
  }
  const body = `
    <h2 style="color:#0B1F3A;font-size:20px;margin:0 0 8px;text-align:center">Admin Login Verification</h2>
    <p style="color:#555;font-size:14px;text-align:center;margin:0 0 24px">A login attempt was made to the <strong>OG Landmark Admin Panel</strong>. Use the code below to verify.</p>

    <div style="background:#0B1F3A;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
      <p style="color:#8a9ab5;font-size:13px;margin:0 0 12px;letter-spacing:1px;text-transform:uppercase">One-Time Password (OTP)</p>
      <div style="font-size:44px;font-weight:900;letter-spacing:14px;color:#C8A45A;padding:8px 0;font-family:'Courier New',monospace">${otp}</div>
      <div style="background:#C8A45A;height:2px;width:60px;margin:16px auto 12px;border-radius:2px"></div>
      <p style="color:#8a9ab5;font-size:12px;margin:0">Valid for <strong style="color:#ffffff">5 minutes</strong> only</p>
    </div>

    <div style="background:#fff8ec;border:1px solid #f0d89a;border-radius:8px;padding:14px 18px;margin-bottom:20px">
      <p style="color:#856404;font-size:13px;margin:0">⚠️ <strong>Do not share this OTP</strong> with anyone. This code grants admin access.</p>
    </div>

    <p style="color:#888;font-size:12px;text-align:center;margin:0">If you did not attempt to login, please secure your account immediately by changing your password.</p>
  `;
  await transporter.sendMail({
    from: fromAddress(),
    replyTo: smtpSettings.from || smtpSettings.user,
    to: toEmail,
    subject: '🔑 OG Landmark Admin — Login Verification Code',
    html: emailWrapper(body),
  });
  return { sent: true, fallback: false };
}

const app = express();
const PORT = process.env.PORT || 3000;
const authRateBuckets = new Map();

// ─── DB-guard middleware — returns 503 with clear message if DB not yet ready ──
app.use('/api/auth', (req, res, next) => {
  if (!dbReady) {
    return res.status(503).json({
      error: 'Database is not ready. Check the Neon settings and application log.',
      code: 'DB_NOT_READY',
    });
  }
  next();
});

// Keep credential, OTP, and social endpoints resistant to repeated abuse
// without adding a new dependency. Successful sessions are still persisted
// in Neon; this is only a short-lived request throttle at the API edge.
app.use('/api/auth', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
  const windowMs = 15 * 60 * 1000;
  const maxRequests = req.path === '/forgot-password' ? 5 : 15;
  const bucket = authRateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    authRateBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
    return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
  }
  next();
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/config' || dbReady) return next();
  return res.status(503).json({
    error: 'Database is not ready. Check the Neon settings and application log.',
    code: 'DB_NOT_READY',
  });
});

// ─── Password Hashing (PBKDF2 — built-in Node.js, no npm needed) ────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('pbkdf2:')) return false;
  try {
    const [, salt, hash] = stored.split(':');
    const verify = crypto.pbkdf2Sync(plain, salt, 100000, 64, 'sha512').toString('hex');
    const storedBuffer = Buffer.from(hash, 'hex');
    const verifyBuffer = Buffer.from(verify, 'hex');
    return storedBuffer.length === verifyBuffer.length
      && crypto.timingSafeEqual(storedBuffer, verifyBuffer);
  } catch {
    return false;
  }
}

function generateToken(userId) {
  return crypto.randomBytes(48).toString('base64url');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0092')) return `92${digits.slice(4)}`;
  if (digits.startsWith('0') && digits.length >= 10) return `92${digits.slice(1)}`;
  return digits;
}

function isValidUsername(value) {
  return /^[a-z][a-z0-9._-]{2,29}$/.test(normalizeUsername(value));
}

function isValidPhone(value) {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

function uniqueUsername(users, preferred, fallbackEmail) {
  const preferredBase = normalizeUsername(preferred).replace(/[^a-z0-9._-]/g, '');
  const emailBase = normalizeEmail(fallbackEmail).split('@')[0].replace(/[^a-z0-9._-]/g, '');
  let base = preferredBase || emailBase || 'user';
  if (!/^[a-z]/.test(base)) base = `user${base}`;
  base = base.slice(0, 24);
  let candidate = base;
  let suffix = 1;
  while (users.some(user => normalizeUsername(user.username) === candidate)) {
    candidate = `${base.slice(0, 24 - String(suffix).length)}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function findUserByLoginIdentifier(users, identifier) {
  const value = String(identifier || '').trim();
  const email = normalizeEmail(value);
  const username = normalizeUsername(value);
  const phone = normalizePhone(value);
  return users.find(user => (
    (email && normalizeEmail(user.email) === email)
    || (username && normalizeUsername(user.username) === username)
    || (phone && normalizePhone(user.phone) === phone)
  ));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function passwordValidationError(value) {
  const password = String(value || '');
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number';
  }
  return null;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
const tokenDigest = token => crypto.createHash('sha256').update(token).digest('hex');
function getBearerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
}
async function createSession(user) {
  const token = generateToken(user.id);
  const expiry = new Date(Date.now() + Number(process.env.SESSION_TTL_HOURS || 168) * 3600000);
  if (neonDb) {
    await neonDb`
      INSERT INTO auth_sessions (token_hash, user_id, expires_at)
      VALUES (${tokenDigest(token)}, ${user.id}, ${expiry.toISOString()})
    `;
  } else if (localPreview) {
    tokenStore.set(token, { userId: user.id, expiresAt: expiry.getTime() });
  } else {
    throw new Error('Neon is not configured for production.');
  }
  return token;
}
async function invalidateUserSessions(userId) {
  if (neonDb) {
    await neonDb`DELETE FROM auth_sessions WHERE user_id = ${userId}`;
  } else if (localPreview) {
    for (const [token, session] of tokenStore.entries()) {
      if (session.userId === userId) tokenStore.delete(token);
    }
  }
}
async function getRequestUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  let userId;
  try {
    if (neonDb) {
      const sessions = await neonDb`
        SELECT user_id
        FROM auth_sessions
        WHERE token_hash = ${tokenDigest(token)}
          AND expires_at > ${new Date().toISOString()}
        LIMIT 1
      `;
      const session = sessions[0];
      if (!session) return null;
      userId = Number(session.user_id);
    } else if (localPreview) {
      const stored = tokenStore.get(token);
      if (!stored || stored.expiresAt < Date.now()) return null;
      userId = stored.userId;
    } else {
      return null;
    }
    const data = await readData();
    return data.users.find(u => u.id === userId) || null;
  } catch { return null; }
}

// Requires a valid token from ANY logged-in user
function requireAuth(req, res, next) {
  getRequestUser(req).then(user => {
    if (!user) return res.status(401).json({ error: 'Authentication required. Please log in.' });
    req.currentUser = user;
    req.auth = { userId: user.id, role: user.role };
    next();
  }).catch(() => res.status(500).json({ error: 'Auth check failed' }));
}

// Requires Admin role
function requireAdmin(req, res, next) {
  getRequestUser(req).then(user => {
    if (!user) return res.status(401).json({ error: 'Authentication required. Please log in.' });
    if (user.role !== 'Admin') return res.status(403).json({ error: 'Admin access required.' });
    req.currentUser = user;
    req.auth = { userId: user.id, role: user.role };
    next();
  }).catch(() => res.status(500).json({ error: 'Auth check failed' }));
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
const authAttempts = new Map();
app.use('/api/auth', (req, res, next) => {
  const key = `${req.ip}:${req.path}`; const now = Date.now();
  const state = authAttempts.get(key) || { count: 0, started: now };
  if (now - state.started > 15 * 60 * 1000) { state.count = 0; state.started = now; }
  if (++state.count > 30) return res.status(429).json({ error: 'Too many authentication requests. Please try again later.' });
  authAttempts.set(key, state); next();
});

// ─── Mobile agent directory ────────────────────────────────────────────────────
// These records are the former mobile-only demo profiles. Keeping them in the
// shared data document lets the admin dashboard become the single source of
// truth without breaking existing installs that already have app_data.
function getDefaultMobileAgents() {
  return [
    {
      id: 2001, name: 'Ahmed Property Consultants', displayName: 'Ahmed Property Consultants',
      initials: 'AC', agency: 'Ahmed Real Estate', verified: true, approvalStatus: 'Approved',
      status: 'Active', visible: true, rating: 4.9, reviewCount: 126, years: 12, listings: 48,
      areas: ['Okara City', 'Depalpur'], color: '#1a6b3a', phone: '03012345678',
      specialties: ['Residential', 'Agricultural Land', 'Plots'], photo: '/images/agents/ahmed.jpg',
      about: 'With over 12 years of experience in Okara District real estate, Ahmed Property Consultants specialises in residential plots, houses, and agricultural land across Okara and Depalpur. Trusted by hundreds of satisfied buyers and sellers with transparent, professional service.',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 2002, name: 'Malik Properties', displayName: 'Malik Properties',
      initials: 'MP', agency: 'Malik & Sons Real Estate', verified: true, approvalStatus: 'Approved',
      status: 'Active', visible: true, rating: 4.8, reviewCount: 94, years: 8, listings: 32,
      areas: ['Renala Khurd', 'Okara City'], color: '#102a43', phone: '03042569000',
      specialties: ['Commercial', 'Residential', 'Rentals'], photo: '/images/agents/malik.jpg',
      about: 'Malik Properties has been serving clients in Renala Khurd and Okara since 2016. Specialising in residential and commercial properties with a strong focus on client satisfaction and straightforward dealings.',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 2003, name: 'Ch. Property Services', displayName: 'Ch. Property Services',
      initials: 'CS', agency: 'Chaudhry Property Group', verified: true, approvalStatus: 'Approved',
      status: 'Active', visible: true, rating: 4.9, reviewCount: 173, years: 15, listings: 61,
      areas: ['Depalpur', 'Hujra Shah Muqeem'], color: '#8b6c2a', phone: '03331234567',
      specialties: ['Agricultural Land', 'Plots', 'Commercial', 'Investment'], photo: '/images/agents/chaudhry.jpg',
      about: 'Chaudhry Property Group is one of the most experienced real estate firms in the Depalpur area. With 15+ years of serving buyers, sellers, and investors, the group is expert in agricultural land deals, residential plots, and large-scale commercial transactions.',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 2004, name: 'Baig Property Advisors', displayName: 'Baig Property Advisors',
      initials: 'BA', agency: 'Baig & Associates', verified: true, approvalStatus: 'Approved',
      status: 'Active', visible: true, rating: 4.7, reviewCount: 68, years: 5, listings: 21,
      areas: ['Okara City', 'Renala Khurd'], color: '#4a2d6b', phone: '03156789012',
      specialties: ['Residential', 'Rentals', 'Plots'], photo: null,
      about: 'Baig Property Advisors is a young and energetic firm based in Okara City, known for fast, honest dealing in residential rentals and plot sales. With 5 years in the market, the team has built a reputation for clear communication and follow-through.',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 2005, name: 'Raza Industrial & Commercial', displayName: 'Raza Industrial & Commercial',
      initials: 'RI', agency: 'Raza Enterprises Real Estate', verified: true, approvalStatus: 'Approved',
      status: 'Active', visible: true, rating: 4.8, reviewCount: 82, years: 9, listings: 27,
      areas: ['Okara City', 'Depalpur', 'Renala Khurd'], color: '#374151', phone: '03219876543',
      specialties: ['Commercial', 'Industrial', 'Investment'], photo: null,
      about: 'Raza Enterprises specialises in commercial shops, offices, warehouses, and industrial plots across Okara District. With 9 years of experience in the commercial sector, the firm is the go-to for investors and business owners seeking premium commercial space.',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];
}

function ensureMobileAgents(data) {
  if (!Array.isArray(data.mobileAgents)) {
    data.mobileAgents = getDefaultMobileAgents();
    return true;
  }
  return false;
}

function safeMobileAgent(agent, includePrivate = false) {
  const { password: _password, email: _email, authUserId: _authUserId, ...safe } = agent;
  return {
    ...safe,
    displayName: safe.displayName || safe.name || '',
    profilePhoto: safe.photo || safe.profilePhoto || null,
    ...(agent.role === 'Agent' && agent.email ? { email: agent.email } : {}),
    ...(includePrivate ? {
      loginEmail: agent.email || '',
      authUserId: agent.authUserId || null,
    } : {}),
  };
}

// ─── Seed Data ─────────────────────────────────────────────────────────────────
function getSeedData() {
  return {
    properties: [
      { id: 1, title: 'Luxurious Modern Villa in DHA Phase 8', type: 'Villa', status: 'For Sale', approvalStatus: 'Active', price: 125000000, area: 5500, bedrooms: 6, bathrooms: 7, city: 'Lahore', address: 'Street 12, DHA Phase 8, Lahore', society: 'DHA Phase 8', block: 'Block H', landmark: 'Near DHA Phase 8 Gate', nearbyPlaces: { schools: ['The City School DHA', 'Beaconhouse DHA Campus'], hospitals: ['Shaukat Khanum Memorial Hospital'], mosques: ['DHA Jamia Masjid'], markets: ['DHA Phase 8 Commercial Area'], metroStations: [], motorwayDist: '15 km' }, description: 'Exceptional modern villa featuring contemporary architecture, premium finishes, and expansive living spaces. Private pool, landscaped garden, and state-of-the-art amenities.', amenities: ['Private Pool','Home Theater','Gym','Garden','Servant Quarters','Security System','3 Car Parking','Central AC','Solar System','CCTV','EV Charging'], images: ['/images/property-1.jpg','/images/property-5.jpg','/images/property-3.jpg','/images/property-2.jpg'], agentId: 1, sellerId: 10, sellerName: 'Salman Khan', featured: true, views: 820, inquiryCount: 12, videoUrl: null, tour360Url: null, yearBuilt: 2023, constructionAge: 'New', furnishing: 'Unfurnished', availability: 'Ready to Move', areaUnit: 'Kanal', areaInSqft: 5500, purpose: 'For Sale', tags: ['featured','verified','luxury','smartHome'], propertyScore: { location: 4.9, construction: 5.0, investment: 4.8, amenities: 5.0, futureGrowth: 4.7, overall: 4.9 }, createdAt: '2024-01-15' },
      { id: 2, title: 'Premium 3-Bed Apartment in Bahria Town', type: 'Apartment', status: 'For Rent', approvalStatus: 'Active', price: 85000, area: 1850, bedrooms: 3, bathrooms: 3, city: 'Islamabad', address: 'Civic Centre, Bahria Town Phase 4, Islamabad', society: 'Bahria Town Phase 4', block: 'Civic Centre', landmark: 'Near Bahria Grand Mosque', nearbyPlaces: { schools: ['The Scholar School Bahria', 'Roots School Bahria'], hospitals: ['Bahria International Hospital'], mosques: ['Bahria Grand Mosque'], markets: ['Bahria Town Phase 4 Market'], metroStations: [], motorwayDist: '3 km' }, description: 'Stunning apartment with panoramic city views and modern amenities. Open-concept design, high-end finishes, and access to world-class facilities.', amenities: ['Clubhouse','Swimming Pool','Gym','Balcony','Central Heating','Underground Parking','24/7 Security','Elevators','Backup Generator'], images: ['/images/property-2.jpg','/images/property-5.jpg','/images/property-1.jpg'], agentId: 3, sellerId: 10, sellerName: 'Salman Khan', featured: true, views: 560, inquiryCount: 8, videoUrl: null, tour360Url: null, yearBuilt: 2022, constructionAge: '1 Year', furnishing: 'Semi Furnished', availability: 'Ready to Move', areaUnit: 'Square Feet', areaInSqft: 1850, purpose: 'For Rent', tags: ['featured','verified','newListing'], propertyScore: { location: 4.7, construction: 4.5, investment: 4.2, amenities: 4.8, futureGrowth: 4.5, overall: 4.5 }, createdAt: '2024-01-20' },
      { id: 3, title: 'Elegant 5 Bedroom House in Gulberg', type: 'House', status: 'For Sale', approvalStatus: 'Active', price: 68000000, area: 4200, bedrooms: 5, bathrooms: 5, city: 'Lahore', address: 'Main Boulevard, Gulberg III, Lahore', society: 'Gulberg III', block: 'Main Boulevard', landmark: 'Near Gulberg Main Market', nearbyPlaces: { schools: ['LGS Gulberg', 'Aitchison College'], hospitals: ['Doctors Hospital', 'Hameed Latif Hospital'], mosques: ['Jamia Masjid Gulberg'], markets: ['Liberty Market', 'MM Alam Road'], metroStations: ['Gulberg Orange Line Station'], motorwayDist: '12 km' }, description: 'Spacious and elegant house in the heart of Gulberg with premium finishes throughout. Perfect for families seeking upscale urban living.', amenities: ['Garden','Servant Quarters','4 Car Parking','Security System','Solar System','Generator','Fiber Internet','CCTV'], images: ['/images/property-3.jpg','/images/property-1.jpg','/images/property-4.jpg'], agentId: 1, sellerId: 10, sellerName: 'Salman Khan', featured: false, views: 430, inquiryCount: 10, videoUrl: null, tour360Url: null, yearBuilt: 2020, constructionAge: '5 Years', furnishing: 'Unfurnished', availability: 'Ready to Move', areaUnit: 'Marla', areaInSqft: 4200, purpose: 'For Sale', tags: ['verified','hotArea','corner'], propertyScore: { location: 4.8, construction: 4.0, investment: 4.5, amenities: 4.2, futureGrowth: 4.6, overall: 4.4 }, createdAt: '2024-01-10' },
      { id: 4, title: 'Spacious Penthouse with City View', type: 'Apartment', status: 'For Sale', approvalStatus: 'Active', price: 45000000, area: 3200, bedrooms: 4, bathrooms: 4, city: 'Karachi', address: 'Clifton Block 5, Karachi', society: 'Clifton Block 5', block: 'Block 5', landmark: 'Near Clifton Beach', nearbyPlaces: { schools: ['Karachi Grammar School'], hospitals: ['Aga Khan University Hospital'], mosques: ['Clifton Mosque'], markets: ['Clifton Block 9 Market'], metroStations: [], motorwayDist: '25 km' }, description: 'Exclusive penthouse offering breathtaking city views with top-notch finishes and premium amenities in the heart of Clifton.', amenities: ['Private Terrace','Jacuzzi','Smart Home','Gym','Concierge Service','Swimming Pool','Elevator'], images: ['/images/property-4.jpg','/images/property-6.jpg','/images/property-2.jpg'], agentId: 2, sellerId: 11, sellerName: 'Hassan Raza', featured: true, views: 680, inquiryCount: 6, videoUrl: null, tour360Url: null, yearBuilt: 2021, constructionAge: '5 Years', furnishing: 'Furnished', availability: 'Ready to Move', areaUnit: 'Square Feet', areaInSqft: 3200, purpose: 'For Sale', tags: ['featured','verified','luxury','highROI','parkFacing'], propertyScore: { location: 4.9, construction: 4.2, investment: 4.7, amenities: 4.9, futureGrowth: 4.4, overall: 4.6 }, createdAt: '2024-01-25' },
      { id: 5, title: 'Modern Commercial Plaza in Clifton', type: 'Commercial', status: 'For Sale', approvalStatus: 'Active', price: 180000000, area: 8500, bedrooms: 0, bathrooms: 4, city: 'Karachi', address: 'Main Clifton Road, Karachi', society: 'Clifton', block: 'Main Clifton Road', landmark: 'Near Clifton Bridge', nearbyPlaces: { schools: [], hospitals: ['Dr. Ziauddin Hospital'], mosques: ['Clifton Mosque'], markets: ['Clifton Commercial Market'], metroStations: [], motorwayDist: '22 km' }, description: 'Prime commercial space in the most sought-after commercial area of Karachi. Ideal for offices, retail, or mixed-use development.', amenities: ['Elevator','Backup Generator','Central AC','Security','Parking','Fiber Internet'], images: ['/images/property-5.jpg','/images/property-3.jpg'], agentId: 2, sellerId: 11, sellerName: 'Hassan Raza', featured: false, views: 290, inquiryCount: 4, videoUrl: null, tour360Url: null, yearBuilt: 2019, constructionAge: '10 Years', furnishing: 'Unfurnished', availability: 'Ready to Move', areaUnit: 'Square Feet', areaInSqft: 8500, purpose: 'For Sale', tags: ['verified','highROI','rentalIncome','mainRoad','corner'], propertyScore: { location: 4.6, construction: 3.5, investment: 4.8, amenities: 3.8, futureGrowth: 4.3, overall: 4.2 }, createdAt: '2024-02-01' },
      { id: 6, title: 'Affordable 2-Bed Apartment in E-11', type: 'Apartment', status: 'For Rent', approvalStatus: 'Active', price: 55000, area: 1200, bedrooms: 2, bathrooms: 2, city: 'Islamabad', address: 'E-11/2, Islamabad', society: 'E-11', block: 'Sector E-11/2', landmark: 'Near Islamabad Zoo', nearbyPlaces: { schools: ['The Educators E-11', 'NUST'], hospitals: ['PIMS Hospital'], mosques: ['E-11 Masjid'], markets: ['E-11 Market'], metroStations: ['E-11 Metro Station'], motorwayDist: '8 km' }, description: 'Well-maintained apartment in a peaceful neighborhood perfect for small families or couples.', amenities: ['Elevator','Backup Generator','Security','Parking'], images: ['/images/property-6.jpg','/images/property-4.jpg'], agentId: 3, sellerId: 12, sellerName: 'Maria Ali', featured: false, views: 340, inquiryCount: 5, videoUrl: null, tour360Url: null, yearBuilt: 2018, constructionAge: '10 Years', furnishing: 'Semi Furnished', availability: 'Ready to Move', areaUnit: 'Square Feet', areaInSqft: 1200, purpose: 'For Rent', tags: ['newListing'], propertyScore: { location: 4.0, construction: 3.5, investment: 3.8, amenities: 3.5, futureGrowth: 4.2, overall: 3.8 }, createdAt: '2024-02-05' },
      { id: 7, title: '10-Acre Mango Orchard in Rahim Yar Khan', type: 'Orchard', status: 'For Sale', approvalStatus: 'Active', price: 8500000, area: 435600, bedrooms: 0, bathrooms: 0, city: 'Rahim Yar Khan', address: 'Liaquatpur Road, Rahim Yar Khan', society: null, block: null, landmark: 'Near Rahim Yar Khan City', nearbyPlaces: { schools: [], hospitals: ['DHQ Hospital RYK'], mosques: ['Local Mosque'], markets: ['Liaquatpur Market'], metroStations: [], motorwayDist: '15 km' }, description: 'Highly productive mango orchard with established trees and bore well irrigation. Excellent investment opportunity.', amenities: ['Bore Well','Solar Pumping','Caretaker House','Boundary Wall'], images: ['/images/property-5.jpg','/images/property-6.jpg'], agentId: 5, sellerId: 14, sellerName: 'Muhammad Tariq', featured: false, views: 180, inquiryCount: 3, videoUrl: null, tour360Url: null, yearBuilt: null, constructionAge: null, furnishing: null, availability: 'Ready to Move', areaUnit: 'Acre', areaInSqft: 435600, purpose: 'For Sale', tags: ['verified','highROI','orchard','tubeWell'], propertyScore: { location: 3.5, construction: 3.0, investment: 4.5, amenities: 3.2, futureGrowth: 4.0, overall: 3.6 }, createdAt: '2024-02-10' },
      { id: 8, title: '25-Acre Fertile Farmland in Okara', type: 'Agriculture Land', status: 'For Sale', approvalStatus: 'Active', price: 30000000, area: 1089000, bedrooms: 0, bathrooms: 0, city: 'Okara', address: 'Renala Khurd Road, Okara', society: null, block: null, landmark: 'Near Renala Khurd Town', nearbyPlaces: { schools: [], hospitals: ['THQ Hospital Renala'], mosques: ['Village Mosque'], markets: ['Renala Market'], metroStations: [], motorwayDist: '5 km' }, description: 'Premium agricultural land in Okara district with canal irrigation available. Ideal for wheat, rice, and sugarcane cultivation.', amenities: ['Canal Irrigation','Electricity','Road Access','Flat Land'], images: ['/images/property-6.jpg','/images/property-5.jpg'], agentId: 5, sellerId: 14, sellerName: 'Muhammad Tariq', featured: false, views: 220, inquiryCount: 4, videoUrl: null, tour360Url: null, yearBuilt: null, constructionAge: null, furnishing: null, availability: 'Ready to Move', areaUnit: 'Acre', areaInSqft: 1089000, purpose: 'For Sale', tags: ['verified','highROI','riceLand','canalWater','roadFront'], propertyScore: { location: 3.2, construction: 2.5, investment: 4.8, amenities: 2.8, futureGrowth: 4.2, overall: 3.5 }, createdAt: '2024-02-12' },
    ],
    users: [
      { id: 1, name: 'Admin', email: 'oggroup834@gmail.com', phone: '+92 304 2569000', role: 'Admin', status: 'Active', password: 'Ogexp@0087', joinedDate: '2023-01-01' },
      { id: 4, name: 'Usman Ahmed', email: 'usman@example.com', phone: '+92 300 1234567', role: 'Buyer', status: 'Active', password: 'password123', joinedDate: '2023-06-15' },
      { id: 10, name: 'Salman Khan', email: 'salman@example.com', phone: '+92 321 9876543', role: 'Seller', status: 'Active', password: 'password123', joinedDate: '2023-03-10' },
      { id: 11, name: 'Hassan Raza', email: 'hassan@example.com', phone: '+92 333 4567890', role: 'Seller', status: 'Active', password: 'password123', joinedDate: '2023-04-20' },
      { id: 12, name: 'Zainab Khan', email: 'zainab@example.com', phone: '+92 345 2468135', role: 'Buyer', status: 'Active', password: 'password123', joinedDate: '2023-07-01' },
      { id: 13, name: 'Shahid Malik', email: 'shahid@example.com', phone: '+92 300 8765432', role: 'Buyer', status: 'Active', password: 'password123', joinedDate: '2023-05-12' },
      { id: 14, name: 'Maria Ali', email: 'maria@example.com', phone: '+92 321 1357924', role: 'Seller', status: 'Active', password: 'password123', joinedDate: '2023-08-05' },
      { id: 15, name: 'Kamran Ahmed', email: 'kamran@example.com', phone: '+92 300 2468135', role: 'Buyer', status: 'Active', password: 'password123', joinedDate: '2023-09-18' },
    ],
    inquiries: [
      { id: 1, propertyId: 1, propertyTitle: 'Luxurious Modern Villa in DHA Phase 8', clientName: 'Usman Ahmed', email: 'usman@example.com', phone: '+92 300 1234567', message: 'I am very interested in this villa. Can we arrange a viewing this weekend?', sellerId: 10, buyerId: 4, status: 'Pending', reply: null, replyDate: null, date: '2024-01-25' },
      { id: 2, propertyId: 2, propertyTitle: 'Premium 3-Bed Apartment in Bahria Town', clientName: 'Zainab Khan', email: 'zainab@example.com', phone: '+92 345 2468135', message: 'What is the minimum lease period for this apartment?', sellerId: 10, buyerId: 12, status: 'Contacted', reply: 'Minimum lease is 12 months. Happy to arrange a viewing.', replyDate: '2024-01-24', date: '2024-01-24' },
      { id: 3, propertyId: 5, propertyTitle: 'Modern Commercial Plaza in Clifton', clientName: 'Shahid Malik', email: 'shahid@example.com', phone: '+92 300 8765432', message: 'We are looking for office space. Is this property available for lease?', sellerId: 11, buyerId: 13, status: 'Contacted', reply: null, replyDate: null, date: '2024-01-23' },
      { id: 4, propertyId: 4, propertyTitle: 'Spacious Penthouse with City View', clientName: 'Maria Ali', email: 'maria@example.com', phone: '+92 321 1357924', message: 'Interested in the penthouse. What are the maintenance charges?', sellerId: 11, buyerId: null, status: 'Pending', reply: null, replyDate: null, date: '2024-01-25' },
      { id: 5, propertyId: 3, propertyTitle: 'Elegant 5 Bedroom House in Gulberg', clientName: 'Hassan Raza', email: 'hassan@example.com', phone: '+92 333 4567890', message: 'Price seems high. Is the seller open to negotiation?', sellerId: 10, buyerId: null, status: 'Closed', reply: null, replyDate: null, date: '2024-01-20' },
    ],
    offers: [
      { id: 1, propertyId: 1, propertyTitle: 'Luxurious Modern Villa in DHA Phase 8', propertyImage: '/images/property-1.jpg', buyerId: 4, buyerName: 'Usman Ahmed', buyerPhone: '+92 300 1234567', sellerId: 10, amount: 120000000, message: 'I am very interested in this property. Please consider my offer.', status: 'Pending', counterAmount: null, counterMessage: null, date: '2024-02-12' },
      { id: 2, propertyId: 3, propertyTitle: 'Elegant 5 Bedroom House in Gulberg', propertyImage: '/images/property-3.jpg', buyerId: 4, buyerName: 'Usman Ahmed', buyerPhone: '+92 300 1234567', sellerId: 10, amount: 65000000, message: 'Great property. Offering a fair market price.', status: 'Accepted', counterAmount: null, counterMessage: null, date: '2024-01-28' },
      { id: 3, propertyId: 4, propertyTitle: 'Spacious Penthouse with City View', propertyImage: '/images/property-4.jpg', buyerId: 12, buyerName: 'Zainab Khan', buyerPhone: '+92 345 2468135', sellerId: 11, amount: 43000000, message: 'Keen buyer. Can close quickly.', status: 'Rejected', counterAmount: null, counterMessage: null, date: '2024-02-05' },
    ],
    appointments: [
      { id: 1, propertyId: 1, propertyTitle: 'Luxurious Modern Villa in DHA Phase 8', propertyAddress: 'Street 12, DHA Phase 8, Lahore', buyerId: 4, buyerName: 'Usman Ahmed', sellerId: 10, date: '2024-02-15', time: '10:00 AM', type: 'Site Visit', status: 'Upcoming', notes: '', agentId: 1 },
      { id: 2, propertyId: 2, propertyTitle: 'Premium 3-Bed Apartment in Bahria Town', propertyAddress: 'Civic Centre, Bahria Town Phase 4', buyerId: 4, buyerName: 'Usman Ahmed', sellerId: 10, date: '2024-02-16', time: '02:00 PM', type: 'Site Visit', status: 'Upcoming', notes: '', agentId: 3 },
      { id: 3, propertyId: 3, propertyTitle: 'Elegant 5 Bedroom House in Gulberg', propertyAddress: 'Main Boulevard, Gulberg III', buyerId: 4, buyerName: 'Usman Ahmed', sellerId: 10, date: '2024-01-20', time: '11:00 AM', type: 'Video Call', status: 'Completed', notes: '', agentId: 1 },
    ],
    conversations: [
      { id: 1, propertyId: 1, propertyTitle: 'Luxurious Modern Villa in DHA Phase 8', participants: [4, 1], participantNames: ['Usman Ahmed', 'Ahmed Hassan'], agentImage: '/images/agent-1.jpg', lastUpdated: new Date().toISOString(),
        messages: [
          { id: 1, senderId: 1, senderName: 'Ahmed Hassan', text: "Hello Usman, I've confirmed with the seller. The viewing for the DHA Phase 8 Villa is scheduled for tomorrow at 10:00 AM.", timestamp: new Date(Date.now() - 2*3600000).toISOString() },
          { id: 2, senderId: 4, senderName: 'Usman Ahmed', text: "That sounds great. I'll be there on time.", timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: 3, senderId: 1, senderName: 'Ahmed Hassan', text: 'Perfect. Please bring your CNIC just in case security asks at the gate. See you tomorrow!', timestamp: new Date(Date.now() - 30*60000).toISOString() },
        ]
      },
      { id: 2, propertyId: 2, propertyTitle: 'Premium 3-Bed Apartment in Bahria Town', participants: [4, 2], participantNames: ['Usman Ahmed', 'Fatima Khan'], agentImage: '/images/agent-2.jpg', lastUpdated: new Date(Date.now()-86400000).toISOString(),
        messages: [
          { id: 4, senderId: 2, senderName: 'Fatima Khan', text: 'Here are the documents you requested. Please review and let me know.', timestamp: new Date(Date.now()-86400000).toISOString() },
        ]
      },
      { id: 3, propertyId: 3, propertyTitle: 'Elegant 5 Bedroom House in Gulberg', participants: [4, 3], participantNames: ['Usman Ahmed', 'Bilal Rashid'], agentImage: '/images/agent-3.jpg', lastUpdated: new Date(Date.now()-3*86400000).toISOString(),
        messages: [
          { id: 5, senderId: 3, senderName: 'Bilal Rashid', text: 'Yes, the price is negotiable. The seller is open to offers above 62 Cr.', timestamp: new Date(Date.now()-3*86400000).toISOString() },
        ]
      },
    ],
    notifications: [
      { id: 1, type: 'appointment', title: 'Appointment Reminder', message: 'Your site visit for DHA Phase 8 Villa is tomorrow at 10:00 AM.', forPortal: 'buyer', read: false, timestamp: new Date(Date.now()-2*3600000).toISOString(), link: '/user/appointments' },
      { id: 2, type: 'message', title: 'New Message', message: 'Ahmed Hassan replied to your inquiry about the commercial plaza.', forPortal: 'buyer', read: false, timestamp: new Date(Date.now()-5*3600000).toISOString(), link: '/user/messages' },
      { id: 3, type: 'system', title: 'Price Drop Alert', message: '"Elegant 5 Bedroom House in Gulberg" price dropped by 2%.', forPortal: 'buyer', read: true, timestamp: new Date(Date.now()-86400000).toISOString(), link: null },
      { id: 4, type: 'inquiry', title: 'New Lead', message: 'Usman Ahmed enquired about DHA Phase 8 Villa.', forPortal: 'seller', read: false, timestamp: new Date(Date.now()-3600000).toISOString(), link: '/seller/leads' },
      { id: 5, type: 'offer', title: 'New Offer Received', message: 'Usman Ahmed made an offer of PKR 1.20 Cr on Villa.', forPortal: 'seller', read: false, timestamp: new Date(Date.now()-2*3600000).toISOString(), link: '/seller/offers' },
      { id: 6, type: 'inquiry', title: 'New Inquiry', message: 'New inquiry from Shahid Malik for Clifton Plaza.', forPortal: 'admin', read: false, timestamp: new Date(Date.now()-3600000).toISOString(), link: '/admin/inquiries' },
      { id: 7, type: 'approval', title: 'New Listing Submission', message: 'A new property has been submitted for admin approval.', forPortal: 'admin', read: false, timestamp: new Date(Date.now()-7200000).toISOString(), link: '/admin/properties' },
    ],
    blogPosts: [
      { id: 1, title: 'Top 5 Emerging Real Estate Markets in Pakistan 2024', excerpt: "Discover where savvy investors are putting their money in Pakistan's fastest-growing property markets.", content: "<p>Pakistan's real estate sector is witnessing unprecedented growth. Lahore's DHA, Karachi's Clifton, and Islamabad's New Blue Area continue to dominate, but emerging markets in Multan, Faisalabad, and Gwadar are gaining traction.</p>", author: 'OG Landmark', category: 'Market Trends', image: '/images/blog-1.jpg', published: true, views: 1240, createdAt: '2024-01-15' },
      { id: 2, title: 'Complete Guide to Buying Property in Pakistan', excerpt: 'Everything first-time buyers need to know about the property purchase process in Pakistan.', content: "<p>Buying property in Pakistan can be complex. Understanding Fard, Registry, and Mutation is essential. Always verify the seller's ownership documents before making any payment.</p>", author: 'OG Landmark', category: 'Buyer Guide', image: '/images/blog-1.jpg', published: true, views: 890, createdAt: '2024-01-20' },
      { id: 3, title: 'Agricultural Land Investment in Punjab: A Growing Opportunity', excerpt: 'Why agricultural land in Punjab districts like Okara, Sahiwal, and Faisalabad is attracting urban investors.', content: "<p>Agricultural land in Okara district, known for its fertile soil and canal irrigation, has appreciated 25% in three years. OG Landmark specializes in agricultural land in the Depalpur-Okara region.</p>", author: 'OG Landmark', category: 'Investment', image: '/images/blog-1.jpg', published: true, views: 560, createdAt: '2024-02-01' },
    ],
    savedProperties: {},  // { userId: [propertyId, ...] }
    mobileAgents: getDefaultMobileAgents(),
    cityAgents: [
      { id: 1, city: 'Okara',               name: 'Muhammad Asif',   phone: '03001234567', whatsapp: '923001234567', active: true },
      { id: 2, city: 'Depalpur',            name: 'Zahid Hussain',   phone: '03011234567', whatsapp: '923011234567', active: true },
      { id: 3, city: 'Renala Khurd',        name: 'Tariq Mahmood',   phone: '03021234567', whatsapp: '923021234567', active: true },
      { id: 4, city: 'Hujrah Shah Muqeem', name: 'Sajid Ali',       phone: '03031234567', whatsapp: '923031234567', active: true },
      { id: 5, city: 'Basirpur',            name: 'Khalid Iqbal',    phone: '03041234567', whatsapp: '923041234567', active: true },
      { id: 6, city: 'Haveli Lakha',        name: 'Nasir Mehmood',   phone: '03051234567', whatsapp: '923051234567', active: true },
    ],
    nextId: 1000,
  };
}

// ─── Database initialization ───────────────────────────────────────────────────
async function initDb() {
  if (!neonDb) {
    if (!localPreview) throw new Error('Neon is not configured for production.');
    if (!fs.existsSync(fallbackFile)) {
      const seed = getSeedData();
      seed.users.forEach(u => { if (!u.password.startsWith('pbkdf2:')) u.password = hashPassword(u.password); });
      fs.writeFileSync(fallbackFile, JSON.stringify(seed), { mode: 0o600 });
    }
    return;
  }
  // Keep production self-healing when only the original app_data table was
  // created manually. Auth persistence is required by login, registration,
  // and password reset, so ensure all three tables exist before dbReady flips.
  await neonDb`
    CREATE TABLE IF NOT EXISTS public.app_data (
      id bigint primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  await neonDb`
    CREATE TABLE IF NOT EXISTS public.auth_sessions (
      token_hash text primary key,
      user_id bigint not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await neonDb`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
    ON public.auth_sessions (user_id)
  `;
  await neonDb`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
    ON public.auth_sessions (expires_at)
  `;
  await neonDb`
    CREATE TABLE IF NOT EXISTS public.auth_challenges (
      email text not null,
      purpose text not null,
      code_hash text not null,
      attempts smallint not null default 0,
      expires_at timestamptz not null,
      primary key (email, purpose)
    )
  `;
  const existingRows = await neonDb`SELECT id, data FROM app_data WHERE id = 1 LIMIT 1`;
  const existing = existingRows[0];
  if (!existing) {
    // First run — seed the database
    const seed = getSeedData();
    // Apply env-var admin credentials if set
    const adminUser = seed.users.find(u => u.role === 'Admin');
    if (adminUser) {
      if (process.env.ADMIN_EMAIL)    adminUser.email    = process.env.ADMIN_EMAIL;
        if (process.env.ADMIN_PASSWORD) adminUser.password = process.env.ADMIN_PASSWORD;
    }
    // Hash all seed passwords before saving
    seed.users.forEach(u => { u.password = hashPassword(u.password); });
    await neonDb`INSERT INTO app_data (id, data) VALUES (1, ${JSON.stringify(seed)}::jsonb)`;
    console.log('✅ Database seeded with initial data');
  } else {
    // Update admin email/password from env vars if set (runtime override)
    const data = typeof existing.data === 'string' ? JSON.parse(existing.data) : existing.data;
    let dataChanged = ensureMobileAgents(data) || ensurePropertyRecords(data);
    if (process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD) {
      const adminUser = data.users.find(u => u.role === 'Admin');
      if (adminUser) {
        let changed = dataChanged;
        if (process.env.ADMIN_EMAIL && adminUser.email !== process.env.ADMIN_EMAIL) {
          adminUser.email = process.env.ADMIN_EMAIL;
          changed = true;
        }
        if (process.env.ADMIN_PASSWORD) {
          const newHash = hashPassword(process.env.ADMIN_PASSWORD);
          if (adminUser.password !== newHash) {
            adminUser.password = newHash;
            changed = true;
          }
        }
        if (changed) {
          await neonDb`UPDATE app_data SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW() WHERE id = 1`;
          console.log('✅ Admin credentials updated from environment variables');
        }
      }
    }
    if (dataChanged && !(process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD)) {
      await neonDb`UPDATE app_data SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW() WHERE id = 1`;
      console.log('✅ Mobile agent directory migrated into existing database data');
    }
    console.log('✅ Database already has data — skipping seed');
  }
}

// ─── Data persistence ──────────────────────────────────────────────────────────
async function readData() {
  if (!neonDb) {
    if (!localPreview) throw new Error('Neon is not configured for production.');
    const data = JSON.parse(fs.readFileSync(fallbackFile, 'utf8'));
    const changed = ensureMobileAgents(data) || ensurePropertyRecords(data);
    if (changed) {
      // The JSON fallback and Neon app_data both use the same canonical
      // property shape after the first read.
      await writeData(data);
    }
    return data;
  }
  const rows = await neonDb`SELECT data FROM app_data WHERE id = 1 LIMIT 1`;
  const row = rows[0];
  if (!row) {
    // Table exists but empty — seed it
    const seed = getSeedData();
    seed.users.forEach(u => { u.password = hashPassword(u.password); });
    await neonDb`INSERT INTO app_data (id, data) VALUES (1, ${JSON.stringify(seed)}::jsonb)`;
    console.log('✅ Database seeded from readData fallback');
    return seed;
  }
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  const notificationCollectionsChanged = ensureNotificationCollections(data);
  const mobileAgentsAdded = ensureMobileAgents(data);
  const propertyRecordsChanged = ensurePropertyRecords(data);
  // Migrate plain-text passwords to hashed on first read (backwards compat)
  let migrated = false;
  data.users.forEach(u => {
    if (u.password && !u.password.startsWith('pbkdf2:')) {
      u.password = hashPassword(u.password);
      migrated = true;
    }
  });
  if (migrated || notificationCollectionsChanged || mobileAgentsAdded || propertyRecordsChanged) await writeData(data);
  return data;
}

async function writeData(data) {
  if (!neonDb) {
    if (!localPreview) throw new Error('Neon is not configured for production.');
    const temp = `${fallbackFile}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temp, fallbackFile);
    return;
  }
  await neonDb`UPDATE app_data SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW() WHERE id = 1`;
}

function nextId(data) {
  data.nextId = (data.nextId || 1000) + 1;
  return data.nextId;
}

const NOTIFICATION_CATEGORIES = new Set(['properties', 'projects', 'announcements', 'promotional', 'account', 'system']);
const NOTIFICATION_TYPES = new Set([
  'NEW_PROPERTY', 'PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'PROPERTY_CHANGES_REQUESTED',
  'PROPERTY_PUBLISHED', 'PROPERTY_UPDATED', 'NEW_PROJECT', 'PROJECT_APPROVED',
  'PROJECT_REJECTED', 'PROJECT_CHANGES_REQUESTED', 'PROJECT_PUBLISHED', 'PROJECT_UPDATED',
  'GENERAL_ANNOUNCEMENT', 'IMPORTANT_ANNOUNCEMENT', 'SYSTEM_ANNOUNCEMENT',
  'PROMOTIONAL_ANNOUNCEMENT', 'ACCOUNT_VERIFICATION', 'PROFILE_UPDATE', 'SECURITY_ALERT',
  'SYSTEM_UPDATE', 'MAINTENANCE', 'FEATURE_UPDATE',
]);

function ensureNotificationCollections(data) {
  let changed = false;
  if (!Array.isArray(data.notifications)) { data.notifications = []; changed = true; }
  if (!Array.isArray(data.pushDevices)) { data.pushDevices = []; changed = true; }
  if (!data.notificationPreferences || typeof data.notificationPreferences !== 'object') {
    data.notificationPreferences = {};
    changed = true;
  }
  if (!Array.isArray(data.notificationEvents)) { data.notificationEvents = []; changed = true; }
  if (!Array.isArray(data.announcements)) { data.announcements = []; changed = true; }
  data.notifications = data.notifications.map(item => {
    const normalized = {
      ...item,
      notificationId: String(item.notificationId || item.id),
      recipientUserId: item.recipientUserId ?? item.userId ?? null,
      type: String(item.type || 'SYSTEM_UPDATE').toUpperCase(),
      category: item.category || (String(item.type || '').toLowerCase().includes('project') ? 'projects' : 'system'),
      body: item.body || item.message || '',
      message: item.message || item.body || '',
      isRead: item.isRead === true || item.read === true,
      read: item.read === true || item.isRead === true,
      createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      userDeletedAt: item.userDeletedAt || null,
    };
    if (JSON.stringify(normalized) !== JSON.stringify(item)) changed = true;
    return normalized;
  });
  return changed;
}

function notificationCategory(type, explicitCategory) {
  if (NOTIFICATION_CATEGORIES.has(explicitCategory)) return explicitCategory;
  const value = String(type || '').toUpperCase();
  if (value.includes('PROJECT')) return 'projects';
  if (value.includes('PROPERTY')) return 'properties';
  if (value.includes('ANNOUNCEMENT') || value === 'PROMOTIONAL_ANNOUNCEMENT') return value === 'PROMOTIONAL_ANNOUNCEMENT' ? 'promotional' : 'announcements';
  if (value.includes('ACCOUNT') || value.includes('PROFILE') || value.includes('SECURITY')) return 'account';
  return 'system';
}

function notificationPreferenceEnabled(data, userId, category, mandatory = false) {
  if (mandatory) return true;
  const prefs = data.notificationPreferences?.[String(userId)];
  return prefs?.[category] !== false;
}

function createNotificationRecord(data, recipientUserId, payload) {
  ensureNotificationCollections(data);
  const eventKey = `${recipientUserId}:${String(payload.eventKey || `${payload.type}:${payload.entityType || ''}:${payload.entityId || ''}`)}`;
  if (data.notificationEvents.includes(eventKey)) return null;
  const now = new Date().toISOString();
  const id = nextId(data);
  const type = NOTIFICATION_TYPES.has(String(payload.type || '').toUpperCase())
    ? String(payload.type).toUpperCase()
    : 'SYSTEM_UPDATE';
  const category = notificationCategory(type, payload.category);
  const item = {
    id,
    notificationId: String(id),
    recipientUserId: Number(recipientUserId),
    userId: Number(recipientUserId),
    type,
    category,
    title: String(payload.title || 'OG Landmark Update'),
    message: String(payload.message || payload.body || ''),
    body: String(payload.body || payload.message || ''),
    imageUrl: payload.imageUrl || null,
    entityType: payload.entityType || null,
    entityId: payload.entityId ?? null,
    propertyId: payload.propertyId ?? (payload.entityType === 'property' ? payload.entityId : null),
    projectId: payload.projectId ?? (payload.entityType === 'project' ? payload.entityId : null),
    announcementId: payload.announcementId ?? (payload.entityType === 'announcement' ? payload.entityId : null),
    deepLink: payload.deepLink || payload.actionUrl || null,
    actionUrl: payload.actionUrl || payload.deepLink || null,
    priority: payload.priority || 'NORMAL',
    isRead: false,
    read: false,
    readAt: null,
    userDeletedAt: null,
    createdAt: now,
    timestamp: now,
    expiresAt: payload.expiresAt || null,
    metadata: payload.metadata || {},
    eventKey,
    forPortal: payload.forPortal || null,
  };
  data.notifications.unshift(item);
  data.notificationEvents.push(eventKey);
  // Keep deduplication state bounded; notification history remains available.
  if (data.notificationEvents.length > 10000) data.notificationEvents.splice(0, data.notificationEvents.length - 10000);
  return item;
}

function usersForAnnouncement(data, audience = {}) {
  const role = String(audience.role || '').toLowerCase();
  const city = String(audience.city || '').trim().toLowerCase();
  return (data.users || [])
    .filter(user => user.status !== 'Inactive' && user.status !== 'Suspended')
    .filter(user => !role || String(user.role || '').toLowerCase() === role)
    .filter(user => !city || String(user.city || '').toLowerCase() === city)
    .map(user => user.id);
}

function usersForPropertyAlert(data, property) {
  const city = String(property.city || property.location?.city || '').trim().toLowerCase();
  const propertyType = String(property.type || '').trim().toLowerCase();
  return (data.users || [])
    .filter(user => user.status !== 'Inactive' && user.status !== 'Suspended')
    .filter(user => ['buyer', 'agent', 'admin'].includes(String(user.role || '').toLowerCase()))
    .filter(user => {
      const prefs = data.notificationPreferences?.[String(user.id)] || {};
      if (prefs.propertyAlerts === false || prefs.properties === false) return false;
      if (Array.isArray(prefs.cities) && prefs.cities.length && !prefs.cities.some(item => String(item).toLowerCase() === city)) return false;
      if (Array.isArray(prefs.propertyTypes) && prefs.propertyTypes.length && !prefs.propertyTypes.some(item => String(item).toLowerCase() === propertyType)) return false;
      return true;
    })
    .map(user => user.id);
}

function usersForProjectAlert(data, project) {
  const city = String(project.city || project.location?.city || '').trim().toLowerCase();
  const projectType = String(project.type || project.projectType || '').trim().toLowerCase();
  return (data.users || [])
    .filter(user => user.status !== 'Inactive' && user.status !== 'Suspended')
    .filter(user => ['buyer', 'agent', 'developer', 'admin'].includes(String(user.role || '').toLowerCase()))
    .filter(user => {
      const prefs = data.notificationPreferences?.[String(user.id)] || {};
      if (prefs.projects === false || prefs.newProjects === false) return false;
      if (Array.isArray(prefs.cities) && prefs.cities.length && !prefs.cities.some(item => String(item).toLowerCase() === city)) return false;
      if (Array.isArray(prefs.projectTypes) && prefs.projectTypes.length && !prefs.projectTypes.some(item => String(item).toLowerCase() === projectType)) return false;
      return true;
    })
    .map(user => user.id);
}

async function sendExpoPushToUser(data, userId, item) {
  const devices = (data.pushDevices || [])
    .filter(device => Number(device.userId) === Number(userId) && device.isActive !== false)
    .map(device => device.pushToken);
  const legacy = data.users?.find(user => Number(user.id) === Number(userId))?.pushToken;
  const tokens = [...new Set([...devices, legacy].filter(Boolean))];
  for (const token of tokens) {
    await sendExpoPush(token, item.title, item.body, {
      type: item.type,
      category: item.category,
      notificationId: item.notificationId,
      entityType: item.entityType,
      entityId: item.entityId,
      propertyId: item.propertyId,
      projectId: item.projectId,
      announcementId: item.announcementId,
      deepLink: item.deepLink,
    });
  }
}

async function createAndDeliverNotifications(data, recipientIds, payload) {
  const created = [];
  for (const userId of [...new Set(recipientIds.map(Number).filter(Number.isInteger))]) {
    const category = notificationCategory(payload.type, payload.category);
    if (!notificationPreferenceEnabled(data, userId, category, payload.mandatory)) continue;
    const prefs = data.notificationPreferences?.[String(userId)] || {};
    const item = createNotificationRecord(data, userId, { ...payload, category });
    if (!item) continue;
    created.push(item);
    // Immediate is the default. Daily/weekly choices keep the durable in-app
    // history but defer push delivery so high-volume alerts do not spam users.
    if (payload.mandatory || !prefs.frequency || prefs.frequency === 'immediate') {
      await sendExpoPushToUser(data, userId, item);
    }
  }
  return created;
}

// Property records are deliberately kept as one document in app_data.  The
// public listing, seller preview and admin review all read this same shape.
// Keep lat/lng and address at the top level for older clients, while the
// location object is the canonical source for new clients.
function normalisePropertyPayload(raw = {}, existing = null, propertyId = null) {
  const body = { ...(existing || {}), ...(raw || {}) };
  const locationInput = body.location && typeof body.location === 'object' ? body.location : {};
  const numberOrNull = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const latitude = numberOrNull(
    locationInput.latitude ?? locationInput.lat ?? body.latitude ?? body.lat ?? existing?.location?.latitude ?? existing?.lat,
  );
  const longitude = numberOrNull(
    locationInput.longitude ?? locationInput.lng ?? body.longitude ?? body.lng ?? existing?.location?.longitude ?? existing?.lng,
  );
  const location = {
    latitude,
    longitude,
    city: String(locationInput.city ?? body.city ?? '').trim(),
    district: String(locationInput.district ?? body.district ?? (String(body.city || '').toLowerCase() === 'depalpur' ? 'Okara' : '')).trim(),
    tehsil: String(locationInput.tehsil ?? body.tehsil ?? '').trim(),
    locality: String(locationInput.locality ?? body.locality ?? body.neighborhood ?? '').trim(),
    address: String(locationInput.address ?? body.address ?? body.fullAddress ?? '').trim(),
    province: String(locationInput.province ?? body.province ?? 'Punjab').trim(),
    country: String(locationInput.country ?? body.country ?? 'Pakistan').trim(),
    postalCode: String(locationInput.postalCode ?? body.postalCode ?? '').trim(),
    source: String(locationInput.source ?? body.locationSource ?? 'manual').trim() || 'manual',
    accuracy: numberOrNull(locationInput.accuracy ?? body.locationAccuracy),
    placeId: String(locationInput.placeId ?? body.placeId ?? '').trim() || null,
  };
  const images = Array.isArray(body.images) ? body.images.filter(Boolean).map(String) : [];
  const mediaInput = body.media && typeof body.media === 'object' ? body.media : {};
  const imageMedia = Array.isArray(mediaInput.images)
    ? mediaInput.images.map(item => typeof item === 'string' ? { url: item } : item).filter(item => item?.url)
    : images.map(url => ({ url }));
  const documents = Array.isArray(body.documents) ? body.documents.filter(Boolean).map(String) : [];
  const documentMedia = Array.isArray(mediaInput.documents)
    ? mediaInput.documents.map(item => typeof item === 'string' ? { name: item } : item).filter(Boolean)
    : documents.map(name => ({ name }));
  const videoUrl = body.videoUrl ? String(body.videoUrl) : null;
  const safeId = propertyId ?? body.id ?? null;
  const media = {
    images: imageMedia.map(item => ({
      ...item,
      propertyId: safeId,
      type: item.type || 'image',
    })),
    videos: [
      ...(videoUrl ? [{ url: videoUrl, propertyId: safeId, type: 'video' }] : []),
      ...(Array.isArray(mediaInput.videos) ? mediaInput.videos : []),
    ],
    documents: documentMedia.map(item => ({ ...item, propertyId: safeId, type: item.type || 'document' })),
  };
  return {
    ...body,
    id: safeId,
    city: location.city,
    address: location.address,
    neighborhood: location.locality,
    locality: location.locality,
    district: location.district,
    tehsil: location.tehsil,
    province: location.province,
    country: location.country,
    postalCode: location.postalCode,
    lat: latitude,
    lng: longitude,
    location,
    images,
    videoUrl,
    documents,
    media,
    features: Array.isArray(body.features) ? body.features.filter(Boolean).map(String) : (Array.isArray(body.amenities) ? body.amenities : []),
    amenities: Array.isArray(body.amenities) ? body.amenities.filter(Boolean).map(String) : (Array.isArray(body.features) ? body.features : []),
    propertyDetails: body.propertyDetails && typeof body.propertyDetails === 'object' ? body.propertyDetails : {},
    reviewHistory: Array.isArray(body.reviewHistory) ? body.reviewHistory : [],
  };
}

function validatePropertyForSubmission(property) {
  const errors = [];
  if (!String(property.title || '').trim()) errors.push('title is required');
  if (!String(property.type || '').trim()) errors.push('type is required');
  if (!Number.isFinite(Number(property.price)) || Number(property.price) < 0) errors.push('price must be a valid number');
  if (!Number.isFinite(Number(property.area)) || Number(property.area) <= 0) errors.push('area must be greater than zero');
  const { latitude, longitude } = property.location || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
      (latitude === 0 && longitude === 0)) {
    errors.push('an exact latitude and longitude are required');
  }
  for (const field of ['city', 'district', 'tehsil', 'locality', 'address']) {
    if (!String(property.location?.[field] || '').trim()) errors.push(`${field} is required`);
  }
  if (!Array.isArray(property.images) || property.images.length === 0) errors.push('at least one image is required');
  return errors;
}

function ensurePropertyRecords(data) {
  let changed = false;
  data.properties = (data.properties || []).map(property => {
    const canonical = normalisePropertyPayload(property, null, property.id);
    if (JSON.stringify(canonical) !== JSON.stringify(property)) changed = true;
    return canonical;
  });
  return changed;
}

// ─── Area unit conversion ──────────────────────────────────────────────────────
const UNIT_SQFT = { Marla: 272.25, Kanal: 5445, Acre: 43560, 'Square Feet': 1, 'Square Yards': 9 };
function toSqft(val, unit) { return val * (UNIT_SQFT[unit] || 1); }

// ─── Natural Language Parser ───────────────────────────────────────────────────
function parseNaturalLanguage(query) {
  const q = (query || '').toLowerCase();
  const f = {};
  const marla = q.match(/(\d+\.?\d*)\s*marla/);
  const kanal = q.match(/(\d+\.?\d*)\s*kanal/);
  const acre  = q.match(/(\d+\.?\d*)\s*acre/);
  if (marla) { const n = +marla[1]; f.minAreaSqft = (n-1)*272.25; f.maxAreaSqft = (n+2)*272.25; }
  if (kanal)  { const n = +kanal[1]; f.minAreaSqft = (n-0.5)*5445; f.maxAreaSqft = (n+1)*5445; }
  if (acre)   { const n = +acre[1]; f.minAreaSqft = (n-1)*43560; f.maxAreaSqft = (n+2)*43560; }
  const croreU = q.match(/under\s+([\d.]+)\s*crore/);
  const lakhU  = q.match(/under\s+([\d.]+)\s*lakh/);
  const croreA = q.match(/(?:above|over)\s+([\d.]+)\s*crore/);
  if (croreU) f.maxPrice = +croreU[1] * 10000000;
  if (lakhU)  f.maxPrice = +lakhU[1] * 100000;
  if (croreA) f.minPrice = +croreA[1] * 10000000;
  const typeMap = { villa:'Villa', apartment:'Apartment', flat:'Apartment', house:'House', shop:'Shop', office:'Office', warehouse:'Warehouse', hotel:'Hotel', factory:'Factory', plot:'Plot', farm:'Agriculture Land', potato:'Agriculture Land', rice:'Agriculture Land', orchard:'Orchard', mango:'Orchard', commercial:'Commercial' };
  for (const [kw, type] of Object.entries(typeMap)) { if (q.includes(kw)) { f.type = type; break; } }
  const cities = ['lahore','karachi','islamabad','okara','depalpur','renala khurd','haveli lakha','basirpur','gogera','phool nagar','rawalpindi','faisalabad','multan','sahiwal','gujranwala','sialkot','bahawalpur','sargodha','sheikhupura','peshawar','quetta'];
  for (const city of cities) { if (q.includes(city)) { f.city = city[0].toUpperCase()+city.slice(1); break; } }
  const societies = { dha:'DHA', bahria:'Bahria', gulberg:'Gulberg', clifton:'Clifton', f11:'F-11', e11:'E-11' };
  for (const [kw, soc] of Object.entries(societies)) { if (q.includes(kw)) { f.keyword = soc; break; } }
  const nearby = ['school','hospital','mosque','market','metro','motorway','airport','university'];
  for (const kw of nearby) { if (q.includes(kw)) { f.nearbyKeyword = kw; break; } }
  const beds = q.match(/(\d+)\s*(?:bed|bedroom)/); if (beds) f.minBeds = +beds[1];
  if (q.includes('furnished')) f.furnishing = 'Furnished';
  if (q.includes('urgent') || q.includes('jaldi')) f.tags = ['urgentSale'];
  if (q.includes('investment') || q.includes('roi')) f.tags = ['highROI'];
  if (q.includes('rent') || q.includes('kiraya')) f.purpose = 'For Rent';
  else if (q.includes('lease')) f.purpose = 'For Lease';
  else if (q.includes('buy') || q.includes('sale')) f.purpose = 'For Sale';
  return f;
}

// ─── PROPERTIES ────────────────────────────────────────────────────────────────
app.get('/api/properties', async (req, res) => {
  try {
    const data = await readData();
    let props = data.properties;
    const {
      type, status, city, approvalStatus, approval_status, sellerId, seller_id,
      keyword, minPrice, maxPrice, minArea, maxArea, areaUnit,
      minBeds, minBaths, constructionAge, furnishing, availability,
      purpose, tags, featured, priority, society, sortBy,
    } = req.query;
    const search = req.query.search;

    // Multi-field keyword search (city, society, block, landmark, seller, nearby places, title, ID)
    if (keyword || search) {
      const kw = String(keyword || search).toLowerCase();
      props = props.filter(p =>
        p.title.toLowerCase().includes(kw) ||
        p.city.toLowerCase().includes(kw) ||
        p.address.toLowerCase().includes(kw) ||
        String(p.id) === kw ||
        (p.society || '').toLowerCase().includes(kw) ||
        (p.block || '').toLowerCase().includes(kw) ||
        (p.landmark || '').toLowerCase().includes(kw) ||
        (p.sellerName || '').toLowerCase().includes(kw) ||
        p.description.toLowerCase().includes(kw) ||
        (p.nearbyPlaces?.schools || []).some(s => s.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.hospitals || []).some(h => h.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.mosques || []).some(m => m.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.markets || []).some(m => m.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.metroStations || []).some(m => m.toLowerCase().includes(kw))
      );
    }

    // Legacy + new filters
    // A listing lifecycle status is separate from the sale/rent purpose in
    // `status`. Keep paused/sold/rented listings out of the public catalogue
    // while preserving them in the owner's dashboard.
    props = props.filter(p => !p.listingStatus || p.listingStatus === 'Active');
    if (type) {
      const types = type.split(',').map(t => t.trim());
      props = props.filter(p => types.includes(p.type));
    }
    if (status) props = props.filter(p => p.status === status);
    if (city) {
      const cities = city.split(',').map(c => c.trim().toLowerCase());
      props = props.filter(p => cities.some(c => p.city.toLowerCase().includes(c)));
    }
    if (society) props = props.filter(p => (p.society || '').toLowerCase().includes(society.toLowerCase()));
    if (purpose) props = props.filter(p => p.purpose === purpose || p.status === purpose);

    // Price range
    if (minPrice) props = props.filter(p => p.price >= Number(minPrice));
    if (maxPrice) props = props.filter(p => p.price <= Number(maxPrice));

    // Area range (with unit conversion)
    if (minArea) { const sqft = toSqft(Number(minArea), areaUnit || 'Square Feet'); props = props.filter(p => (p.areaInSqft || p.area) >= sqft); }
    if (maxArea) { const sqft = toSqft(Number(maxArea), areaUnit || 'Square Feet'); props = props.filter(p => (p.areaInSqft || p.area) <= sqft); }

    // Rooms
    if (minBeds) props = props.filter(p => p.bedrooms >= Number(minBeds));
    if (minBaths) props = props.filter(p => p.bathrooms >= Number(minBaths));

    // Construction / furnishing / availability
    if (constructionAge) { const ages = constructionAge.split(','); props = props.filter(p => ages.includes(p.constructionAge)); }
    if (furnishing) props = props.filter(p => p.furnishing === furnishing);
    if (availability) props = props.filter(p => p.availability === availability);

    // Tags (any match)
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      props = props.filter(p => tagList.some(t => (p.tags || []).includes(t)));
    }

    // Featured
    if (featured === 'true') props = props.filter(p => p.featured === true);

    // Priority — show only priority-flagged properties
    if (priority === 'true') props = props.filter(p => p.priority === true);

    // Mobile explore supplies map bounds or a radius around the device.  Keep
    // the normal array response and add distanceKm only for radius results.
    const minLat = Number(req.query.minLat), maxLat = Number(req.query.maxLat);
    const minLng = Number(req.query.minLng), maxLng = Number(req.query.maxLng);
    if ([minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
      props = props.filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
        Number(p.lat) >= minLat && Number(p.lat) <= maxLat && Number(p.lng) >= minLng && Number(p.lng) <= maxLng);
    }
    const queryLat = Number(req.query.lat), queryLng = Number(req.query.lng), radiusKm = Number(req.query.radiusKm);
    if ([queryLat, queryLng, radiusKm].every(Number.isFinite) && radiusKm >= 0) {
      const radians = value => value * Math.PI / 180;
      props = props.map(p => {
        if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) return { ...p, distanceKm: Infinity };
        const dLat = radians(Number(p.lat) - queryLat), dLng = radians(Number(p.lng) - queryLng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(queryLat)) * Math.cos(radians(Number(p.lat))) * Math.sin(dLng / 2) ** 2;
        return { ...p, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
      }).filter(p => p.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // Approval status filter
    // - If explicit filter passed → use it
    // - If no filter AND caller is admin → return all
    // - If no filter AND public/non-admin → default to Active only
    const as = approvalStatus || approval_status;
    const caller = await getRequestUser(req).catch(() => null);
    const isAdminCaller = caller?.role === 'Admin';
    const callerId = caller?.id;
    if (!isAdminCaller) {
      // Never let a public query parameter expose Pending/Rejected records.
      // Owners may still inspect their own records from the seller portal.
      props = props.filter(p => p.approvalStatus === 'Active' || (callerId && p.sellerId === callerId) || (callerId && p.agentId === callerId));
      if (as && as !== 'all') props = props.filter(p => p.approvalStatus === as);
    } else if (as && as !== 'all') {
      props = props.filter(p => p.approvalStatus === as);
    }
    const sid = sellerId || seller_id;
    if (sid) props = props.filter(p => p.sellerId === Number(sid));

    // Agent filter
    const aid = req.query.agentId || req.query.agent_id;
    if (aid) props = props.filter(p => p.agentId === Number(aid));

    // Sort
    if (sortBy === 'price-low') props.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-high') props.sort((a, b) => b.price - a.price);
    else if (sortBy === 'score') props.sort((a, b) => (b.propertyScore?.overall || 0) - (a.propertyScore?.overall || 0));
    else props.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination (optional — keeps backward compat: returns array always)
    const total = props.length;
    const page  = req.query.offset !== undefined ? 1 : parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '0', 10); // 0 = return all
    if (limit > 0) {
      const start = req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10) || 0) : (page - 1) * limit;
      props = props.slice(start, start + limit);
    }
    res.set('X-Total-Count', String(total));
    const resolvedProps = props.map(p => ({
      ...p,
      images: (p.images||[]).map(img => img ? (img.startsWith('http') ? img : resolveImg(img)) : null).filter(Boolean),
      videoUrl: p.videoUrl ? (p.videoUrl.startsWith('http') ? p.videoUrl : resolveImg(p.videoUrl)) : null,
    }));
    res.json(resolvedProps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── AI NATURAL LANGUAGE SEARCH ────────────────────────────────────────────────
app.post('/api/search/ai', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const filters = parseNaturalLanguage(query);
    const data = await readData();
    let props = data.properties.filter(p => p.approvalStatus === 'Active');

    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      props = props.filter(p =>
        (p.society || '').toLowerCase().includes(kw) ||
        p.address.toLowerCase().includes(kw) ||
        p.city.toLowerCase().includes(kw) ||
        p.title.toLowerCase().includes(kw)
      );
    }
    if (filters.nearbyKeyword) {
      const kw = filters.nearbyKeyword;
      props = props.filter(p =>
        (p.nearbyPlaces?.schools || []).some(s => s.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.hospitals || []).some(h => h.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.mosques || []).some(m => m.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.markets || []).some(m => m.toLowerCase().includes(kw)) ||
        (p.nearbyPlaces?.motorwayDist && kw === 'motorway')
      );
    }
    if (filters.type) props = props.filter(p => p.type === filters.type);
    if (filters.city) props = props.filter(p => p.city.toLowerCase().includes(filters.city.toLowerCase()));
    if (filters.minPrice) props = props.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) props = props.filter(p => p.price <= filters.maxPrice);
    if (filters.minAreaSqft) props = props.filter(p => (p.areaInSqft || p.area) >= filters.minAreaSqft);
    if (filters.maxAreaSqft) props = props.filter(p => (p.areaInSqft || p.area) <= filters.maxAreaSqft);
    if (filters.minBeds) props = props.filter(p => p.bedrooms >= filters.minBeds);
    if (filters.furnishing) props = props.filter(p => p.furnishing === filters.furnishing);
    if (filters.purpose) props = props.filter(p => p.purpose === filters.purpose || p.status === filters.purpose);
    if (filters.tags) props = props.filter(p => (filters.tags || []).some(t => (p.tags || []).includes(t)));

    res.json({ filters, results: props, count: props.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Not found' });
    const caller = await getRequestUser(req).catch(() => null);
    const canSeeUnpublished = caller?.role === 'Admin' ||
      (caller && (caller.id === prop.sellerId || caller.id === prop.agentId));
    if (prop.approvalStatus !== 'Active' && !canSeeUnpublished) {
      return res.status(404).json({ error: 'Not found' });
    }
    const canonical = normalisePropertyPayload(prop, null, prop.id);
    const rp = { ...canonical,
      images: (prop.images||[]).map(img => img ? (img.startsWith('http') ? img : resolveImg(img)) : null).filter(Boolean),
      videoUrl: prop.videoUrl ? (prop.videoUrl.startsWith('http') ? prop.videoUrl : resolveImg(prop.videoUrl)) : null,
    };
    rp.media = normalisePropertyPayload({ ...canonical, images: rp.images, videoUrl: rp.videoUrl }, null, prop.id).media;
    res.json(rp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Listing management is account-scoped and deliberately includes Pending and
// Rejected records so a seller/agent can track its submissions.
app.get('/api/my-properties', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const props = (data.properties || []).filter(p => req.currentUser.role === 'Admin' ||
      p.sellerId === req.currentUser.id || p.agentId === req.currentUser.id);
    res.json(props);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/properties', requireAuth, async (req, res) => {
  try {
    // A newly registered account starts as Buyer, but buyers may also submit
    // a property they own. The listing remains Pending until admin review.
    if (!['Buyer', 'Seller', 'Agent', 'Admin'].includes(req.currentUser.role)) {
      return res.status(403).json({ error: 'Your account is not allowed to submit a property listing.' });
    }
    const data = await readData();
    const id = nextId(data);
    const requestedState = String(req.body.submissionState || req.body.approvalStatus || '').toLowerCase();
    const isDraft = requestedState === 'draft';
    let newProp = normalisePropertyPayload({
      ...req.body,
      id,
      createdAt: new Date().toISOString(),
      views: 0,
      inquiryCount: 0,
      // Ownership is always established from the authenticated account; callers
      // must never be able to create a listing under somebody else's account.
      ...(req.currentUser.role === 'Agent' ? { agentId: req.currentUser.id } : { sellerId: req.currentUser.id }),
      approvalStatus: isDraft ? 'Draft' : 'Pending',
      listingStatus: isDraft ? 'Draft' : 'Pending',
      submissionState: isDraft ? 'draft' : 'submitted',
      featured: false,
      reviewHistory: [],
    }, null, id);
    if (!isDraft) {
      const validationErrors = validatePropertyForSubmission(newProp);
      if (validationErrors.length) return res.status(422).json({ error: 'Listing needs correction before submission.', code: 'LISTING_VALIDATION_FAILED', fields: validationErrors });
    }
    newProp.reviewHistory.push({
      action: isDraft ? 'draft_saved' : 'submitted',
      by: req.currentUser.id,
      byName: req.currentUser.name,
      fromStatus: null,
      toStatus: newProp.approvalStatus,
      createdAt: new Date().toISOString(),
    });
    data.properties.push(newProp);
    adminAudit(data, req.currentUser, isDraft ? 'draft_saved' : 'submit', 'properties', id, { status: newProp.approvalStatus });
    if (!isDraft) {
      await createAndDeliverNotifications(
        data,
        data.users.filter(user => String(user.role || '').toLowerCase() === 'admin').map(user => user.id),
        {
          type: 'SYSTEM_UPDATE', category: 'system', mandatory: true,
          title: 'New Listing Submitted',
          body: `${req.currentUser.name || 'A user'} submitted "${newProp.title}" for review.`,
          entityType: 'property', entityId: id, propertyId: id,
          deepLink: '/admin/properties', eventKey: `property:${id}:submitted`,
        },
      );
    }
    await writeData(data);
    res.status(201).json(newProp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/properties/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.properties.findIndex(p => p.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    // Only the owning seller/agent or an admin may edit
    const prop = data.properties[idx];
    if (req.currentUser.role !== 'Admin' && prop.sellerId !== req.currentUser.id && prop.agentId !== req.currentUser.id) {
      return res.status(403).json({ error: 'You are not authorised to edit this property.' });
    }
    const previousStatus = prop.approvalStatus || 'Pending';
    const merged = normalisePropertyPayload(req.body, prop, prop.id);
    const requestedState = String(req.body.submissionState || '').toLowerCase();
    const isDraft = requestedState === 'draft';
    if (!isDraft) {
      const validationErrors = validatePropertyForSubmission(merged);
      if (validationErrors.length) return res.status(422).json({ error: 'Listing needs correction before submission.', code: 'LISTING_VALIDATION_FAILED', fields: validationErrors });
    }
    const nextStatus = isDraft ? 'Draft' : (req.currentUser.role === 'Admin' ? previousStatus : 'Pending');
    merged.approvalStatus = nextStatus;
    merged.listingStatus = isDraft
      ? 'Draft'
      : (req.currentUser.role === 'Admin' ? (prop.listingStatus || (previousStatus === 'Active' ? 'Active' : previousStatus)) : 'Pending');
    merged.submissionState = isDraft ? 'draft' : 'submitted';
    merged.updatedAt = new Date().toISOString();
    merged.reviewHistory = Array.isArray(prop.reviewHistory) ? prop.reviewHistory : [];
    merged.reviewHistory.push({
      action: isDraft ? 'draft_saved' : (req.currentUser.role === 'Admin' ? 'admin_edit' : 'resubmitted'),
      by: req.currentUser.id,
      byName: req.currentUser.name,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      createdAt: merged.updatedAt,
    });
    data.properties[idx] = merged;
    if (req.currentUser.role === 'Admin') adminAudit(data, req.currentUser, 'edit', 'properties', prop.id, { fromStatus: previousStatus, toStatus: nextStatus });
    else adminAudit(data, req.currentUser, isDraft ? 'draft_saved' : 'resubmit', 'properties', prop.id, { fromStatus: previousStatus, toStatus: nextStatus });
    if (!isDraft && req.currentUser.role !== 'Admin') {
      await createAndDeliverNotifications(
        data,
        data.users.filter(user => String(user.role || '').toLowerCase() === 'admin').map(user => user.id),
        {
          type: 'SYSTEM_UPDATE', category: 'system', mandatory: true,
          title: 'Property Resubmitted',
          body: `"${merged.title}" has been resubmitted for review.`,
          entityType: 'property', entityId: prop.id, propertyId: prop.id,
          deepLink: '/admin/properties', eventKey: `property:${prop.id}:resubmitted:${merged.updatedAt}`,
        },
      );
    }
    await writeData(data);
    res.json(data.properties[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/properties/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Not found' });
    // Only the owning seller/agent or an admin may delete
    if (req.currentUser.role !== 'Admin' && prop.sellerId !== req.currentUser.id && prop.agentId !== req.currentUser.id) {
      return res.status(403).json({ error: 'You are not authorised to delete this property.' });
    }
    data.properties = data.properties.filter(p => p.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Agent/seller lifecycle actions must not go through the property purpose
// field (`For Sale` / `For Rent`). Keep these states independently persisted.
app.patch('/api/properties/:id/listing-status', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const nextStatus = String(req.body.listingStatus || '').trim();
    const allowed = ['Active', 'Paused', 'Sold', 'Rented'];
    if (!allowed.includes(nextStatus)) return res.status(400).json({ error: 'Invalid listing status.' });
    const isOwner = prop.sellerId === req.currentUser.id || prop.agentId === req.currentUser.id;
    if (req.currentUser.role !== 'Admin' && !isOwner) {
      return res.status(403).json({ error: 'You are not authorised to update this property.' });
    }
    if (nextStatus === 'Active' && prop.approvalStatus !== 'Active') {
      return res.status(409).json({ error: 'Only an approved listing can be activated.' });
    }
    const previousStatus = prop.listingStatus || (prop.approvalStatus === 'Active' ? 'Active' : prop.approvalStatus || 'Pending');
    prop.listingStatus = nextStatus;
    prop.updatedAt = new Date().toISOString();
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({
      action: 'listing_status_changed',
      by: req.currentUser.id,
      byName: req.currentUser.name,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      createdAt: prop.updatedAt,
    });
    await writeData(data);
    res.json(prop);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CITY AGENTS ─────────────────────────────────────────────────────────────
// Public — list all (optionally filter by city)
app.get('/api/city-agents', async (req, res) => {
  try {
    const data = await readData();
    let agents = (data.cityAgents || []);
    if (req.query.city) agents = agents.filter(a => a.city.toLowerCase() === req.query.city.toLowerCase());
    res.json(agents);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — create city agent
app.post('/api/city-agents', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    if (!data.cityAgents) data.cityAgents = [];
    const { city, name, phone, whatsapp } = req.body;
    if (!city || !name || !phone) return res.status(400).json({ error: 'city, name and phone are required' });
    const agent = { id: nextId(data), city, name, phone: phone.trim(), whatsapp: (whatsapp||'').trim() || phone.trim().replace(/^0/, '92'), active: true };
    data.cityAgents.push(agent);
    await writeData(data);
    res.status(201).json(agent);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — update city agent
app.put('/api/city-agents/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    if (!data.cityAgents) data.cityAgents = [];
    const idx = data.cityAgents.findIndex(a => a.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
    data.cityAgents[idx] = { ...data.cityAgents[idx], ...req.body, id: data.cityAgents[idx].id };
    await writeData(data);
    res.json(data.cityAgents[idx]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — delete city agent
app.delete('/api/city-agents/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    data.cityAgents = (data.cityAgents || []).filter(a => a.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — assign city agent to a property (stores agent snapshot on the property)
app.patch('/api/properties/:id/assign-agent', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const { name, phone, whatsapp, cityAgentId } = req.body;
    // If cityAgentId supplied, load from city agents list
    if (cityAgentId) {
      const ca = (data.cityAgents || []).find(a => a.id === Number(cityAgentId));
      if (!ca) return res.status(404).json({ error: 'City agent not found' });
      prop.assignedAgent = { cityAgentId: ca.id, name: ca.name, phone: ca.phone, whatsapp: ca.whatsapp, city: ca.city };
    } else {
      // Manual entry
      if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
      prop.assignedAgent = { name, phone: phone.trim(), whatsapp: (whatsapp||'').trim() || phone.trim().replace(/^0/, '92'), city: prop.city || '' };
    }
    await writeData(data);
    res.json({ success: true, assignedAgent: prop.assignedAgent });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Admin — remove agent assignment from a property
app.delete('/api/properties/:id/assign-agent', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    delete prop.assignedAgent;
    await writeData(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/properties/:id/approve', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const validationErrors = validatePropertyForSubmission(normalisePropertyPayload(prop, null, prop.id));
    if (validationErrors.length) return res.status(422).json({ error: 'Property cannot go live until required data is complete.', code: 'LISTING_VALIDATION_FAILED', fields: validationErrors });
    const previousStatus = prop.approvalStatus || 'Pending';
    prop.approvalStatus = 'Active';
    prop.listingStatus = 'Active';
    prop.submissionState = 'published';
    prop.rejectionReason = null;
    prop.reviewedAt = new Date().toISOString();
    prop.reviewedBy = req.currentUser.id;
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({ action: 'approved', by: req.currentUser.id, byName: req.currentUser.name, fromStatus: previousStatus, toStatus: 'Active', createdAt: prop.reviewedAt });
    adminAudit(data, req.currentUser, 'approve', 'properties', prop.id, { fromStatus: previousStatus, toStatus: 'Active' });
    const ownerIds = [prop.sellerId, prop.agentId].filter(Boolean);
    await createAndDeliverNotifications(data, ownerIds, {
      type: 'PROPERTY_APPROVED', category: 'account', mandatory: true,
      title: 'Property Approved',
      body: `Your property "${prop.title}" has been approved and is now live.`,
      entityType: 'property', entityId: prop.id, propertyId: prop.id,
      imageUrl: prop.images?.[0] || null, deepLink: `/property/${prop.id}`,
      eventKey: `property:${prop.id}:approved`,
    });
    await createAndDeliverNotifications(data, usersForPropertyAlert(data, prop), {
      type: 'NEW_PROPERTY',
      title: `New Property in ${prop.city || 'your area'}`,
      body: `${prop.title} is now available in ${prop.city || 'Okara District'}.`,
      entityType: 'property', entityId: prop.id, propertyId: prop.id,
      imageUrl: prop.images?.[0] || null, deepLink: `/property/${prop.id}`,
      metadata: { price: prop.price, propertyType: prop.type, city: prop.city },
      eventKey: `property:${prop.id}:published`,
    });
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/properties/:id/reject', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' });
    const previousStatus = prop.approvalStatus || 'Pending';
    prop.approvalStatus = 'Rejected';
    prop.listingStatus = 'Paused';
    prop.submissionState = 'rejected';
    prop.rejectionReason = reason;
    prop.reviewedAt = new Date().toISOString();
    prop.reviewedBy = req.currentUser.id;
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({ action: 'rejected', reason, by: req.currentUser.id, byName: req.currentUser.name, fromStatus: previousStatus, toStatus: 'Rejected', createdAt: prop.reviewedAt });
    adminAudit(data, req.currentUser, 'reject', 'properties', prop.id, { reason, fromStatus: previousStatus, toStatus: 'Rejected' });
    await createAndDeliverNotifications(data, [prop.sellerId, prop.agentId].filter(Boolean), {
      type: 'PROPERTY_REJECTED', category: 'account', mandatory: true,
      title: 'Property Listing Rejected',
      body: `Your property "${prop.title}" was rejected. Reason: ${reason}`,
      entityType: 'property', entityId: prop.id, propertyId: prop.id,
      imageUrl: prop.images?.[0] || null, deepLink: `/property/${prop.id}`,
      metadata: { reason }, eventKey: `property:${prop.id}:rejected:${prop.reviewedAt}`,
    });
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/properties/:id/request-changes', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Please describe the changes required.' });
    const previousStatus = prop.approvalStatus || 'Pending';
    prop.approvalStatus = 'Changes Requested';
    prop.listingStatus = 'Paused';
    prop.submissionState = 'changes_requested';
    prop.changeRequest = reason;
    prop.reviewedAt = new Date().toISOString();
    prop.reviewedBy = req.currentUser.id;
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({ action: 'changes_requested', reason, by: req.currentUser.id, byName: req.currentUser.name, fromStatus: previousStatus, toStatus: prop.approvalStatus, createdAt: prop.reviewedAt });
    adminAudit(data, req.currentUser, 'request_changes', 'properties', prop.id, { reason, fromStatus: previousStatus, toStatus: prop.approvalStatus });
    await createAndDeliverNotifications(data, [prop.sellerId, prop.agentId].filter(Boolean), {
      type: 'PROPERTY_CHANGES_REQUESTED', category: 'account', mandatory: true,
      title: 'Changes Required',
      body: `Please update "${prop.title}" before it can be published. ${reason}`,
      entityType: 'property', entityId: prop.id, propertyId: prop.id,
      imageUrl: prop.images?.[0] || null, deepLink: `/post/listing?edit=${prop.id}`,
      metadata: { reason }, eventKey: `property:${prop.id}:changes:${prop.reviewedAt}`,
    });
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/properties/:id/resubmit', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const index = data.properties.findIndex(p => p.id === Number(req.params.id));
    if (index < 0) return res.status(404).json({ error: 'Property not found' });
    const prop = data.properties[index];
    if (req.currentUser.role !== 'Admin' && prop.sellerId !== req.currentUser.id && prop.agentId !== req.currentUser.id) {
      return res.status(403).json({ error: 'You are not authorised to resubmit this property.' });
    }
    const canonical = normalisePropertyPayload(prop, null, prop.id);
    const validationErrors = validatePropertyForSubmission(canonical);
    if (validationErrors.length) return res.status(422).json({ error: 'Listing needs correction before resubmission.', code: 'LISTING_VALIDATION_FAILED', fields: validationErrors });
    const previousStatus = prop.approvalStatus || 'Rejected';
    prop.approvalStatus = 'Pending';
    prop.listingStatus = 'Pending';
    prop.submissionState = 'submitted';
    prop.changeRequest = null;
    prop.rejectionReason = null;
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({ action: 'resubmitted', by: req.currentUser.id, byName: req.currentUser.name, fromStatus: previousStatus, toStatus: 'Pending', createdAt: new Date().toISOString() });
    adminAudit(data, req.currentUser, 'resubmit', 'properties', prop.id, { fromStatus: previousStatus, toStatus: 'Pending' });
    await createAndDeliverNotifications(data, data.users.filter(user => String(user.role || '').toLowerCase() === 'admin').map(user => user.id), {
      type: 'SYSTEM_UPDATE', category: 'system', mandatory: true,
      title: 'Property Resubmitted',
      body: `"${prop.title}" has been resubmitted for review.`,
      entityType: 'property', entityId: prop.id, propertyId: prop.id,
      deepLink: `/admin/properties`, eventKey: `property:${prop.id}:resubmitted:${prop.reviewHistory.length}`,
    });
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/properties/:id/feature', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (prop) prop.featured = req.body.featured !== undefined ? Boolean(req.body.featured) : !prop.featured;
    await writeData(data);
    res.json({ success: true, featured: prop?.featured });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle priority listing — admin only
// Priority = property appears in the Home page featured section + search page
app.patch('/api/properties/:id/priority', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    prop.priority = req.body.priority !== undefined ? Boolean(req.body.priority) : !prop.priority;
    await writeData(data);
    res.json({ success: true, priority: prop.priority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/properties/:id/views', async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (prop) prop.views = (prop.views || 0) + 1;
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── USERS ─────────────────────────────────────────────────────────────────────
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    // Return without passwords
    res.json(data.users.map(({ password, ...u }) => u));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const { email, role, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const exists = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'A user with this email already exists' });
    // Agents created by admin: approvalStatus = 'Approved' (admin-created = pre-approved)
    const approvalStatus = role === 'Agent' ? 'Approved' : undefined;
    const newUser = {
      id: nextId(data),
      joinedDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      ...(approvalStatus && { approvalStatus }),
      ...req.body,
      password: password ? hashPassword(password) : hashPassword('OGAgent@' + Math.random().toString(36).slice(2,8)),
    };
    data.users.push(newUser);
    await writeData(data);
    const { password: _p, ...safe } = newUser;
    res.status(201).json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const data = await readData();
    const user = data.users.find(u => u.id === Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.users.findIndex(u => u.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    // Only the user themselves or an admin may update a profile
    if (req.auth.role !== 'Admin' && req.auth.userId !== Number(req.params.id)) {
      return res.status(403).json({ error: 'You are not authorised to update this profile.' });
    }
    // Never allow overwriting id or password via this route
    const { id: _id, password: _pw, ...updates } = req.body;
    // Non-admins cannot change privileged fields
    if (req.auth.role !== 'Admin') {
      delete updates.role;
      delete updates.status;
      delete updates.approvalStatus;
    }
    data.users[idx] = { ...data.users[idx], ...updates };
    await writeData(data);
    const { password, ...safe } = data.users[idx];
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.users.findIndex(u => u.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data.users.splice(idx, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Push Token ───────────────────────────────────────────────────────────────
app.patch('/api/users/:id/push-token', requireAuth, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    // Only the user themselves (or an admin) may update their own push token
    if (req.auth.userId !== targetId && req.currentUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = await readData();
    const user = data.users.find(u => u.id === targetId);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { pushToken, deviceId, platform, appVersion } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'pushToken required' });
    user.pushToken = pushToken;
    ensureNotificationCollections(data);
    const stableDeviceId = String(deviceId || `${platform || 'unknown'}:${pushToken}`);
    const existing = data.pushDevices.find(device => device.deviceId === stableDeviceId && Number(device.userId) === targetId);
    const device = {
      ...(existing || {}),
      id: existing?.id || nextId(data),
      userId: targetId,
      deviceId: stableDeviceId,
      pushToken: String(pushToken),
      platform: String(platform || 'unknown'),
      appVersion: String(appVersion || ''),
      isActive: true,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    if (existing) Object.assign(existing, device);
    else data.pushDevices.push(device);
    await writeData(data);
    res.json({ success: true, device: { ...device, pushToken: undefined } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Expo Push Notification Helper ───────────────────────────────────────────
async function sendExpoPush(token, title, body, data = {}) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, channelId: data.category || 'system', sound: 'default' }),
    });
  } catch (err) {
    console.warn('⚠️  Push notification failed:', err.message);
  }
}

// Send appointment-confirmed push to buyer (shared between PATCH and PUT handlers)
async function notifyAppointmentConfirmed(apptItem, users) {
  const buyer = apptItem.buyerId ? users.find(u => u.id === apptItem.buyerId) : null;
  if (!buyer?.pushToken) return;
  const visitDate = apptItem.visitDate || apptItem.date || '';
  const visitTime = apptItem.visitTime || apptItem.time || '';
  const when = [visitDate, visitTime].filter(Boolean).join(' at ');
  const body = `Your visit to "${apptItem.propertyTitle}" has been confirmed${when ? ` for ${when}` : ''}.`;
  await sendExpoPush(buyer.pushToken, '📅 Appointment Confirmed', body, { screen: 'my-appointments', appointmentId: apptItem.id });
}

app.patch('/api/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const user = data.users.find(u => u.id === Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Allow explicit status or toggle
    user.status = req.body.status || (user.status === 'Active' ? 'Inactive' : 'Active');
    await writeData(data);
    res.json({ success: true, status: user.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── AGENT MANAGEMENT (Admin only) ───────────────────────────────────────────

// Public mobile directory. Suspended, rejected, or hidden records never leave
// the server, while the admin endpoint below still returns them for management.
app.get('/api/mobile-agents', async (req, res) => {
  try {
    const data = await readData();
    let agents = (data.mobileAgents || []).filter(a =>
      a.visible !== false && a.status !== 'Suspended' && a.approvalStatus !== 'Rejected'
    );
    if (req.query.city) {
      const city = String(req.query.city).toLowerCase();
      agents = agents.filter(a => (a.areas || []).some(area => String(area).toLowerCase() === city));
    }
    if (req.query.limit) agents = agents.slice(0, Math.max(0, Number(req.query.limit) || 0));
    res.json(agents.map(safeMobileAgent));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/mobile-agents', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    res.json((data.mobileAgents || []).map(agent => safeMobileAgent(agent, true)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/mobile-agents', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const body = req.body || {};
    const name = String(body.name || body.displayName || '').trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Agent name, email and password are required' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid login email.' });
    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const existingEmail = data.users.find(user => normalizeEmail(user.email) === email)
      || (data.mobileAgents || []).find(agent => normalizeEmail(agent.email) === email);
    if (existingEmail) return res.status(409).json({ error: 'This login email is already in use.' });
    const now = new Date().toISOString();
    const agentId = nextId(data);
    const authUserId = nextId(data);
    const agent = {
      id: agentId,
      name,
      displayName: name,
      initials: String(body.initials || name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)).toUpperCase(),
      agency: String(body.agency || '').trim(),
      verified: body.verified !== false,
      approvalStatus: body.approvalStatus || 'Approved',
      status: body.status || 'Active',
      visible: body.visible !== false,
      rating: Number(body.rating) || 0,
      reviewCount: Number(body.reviewCount) || 0,
      years: Number(body.years) || 0,
      listings: Number(body.listings) || 0,
      areas: Array.isArray(body.areas) ? body.areas.filter(Boolean) : String(body.areas || '').split(',').map(v => v.trim()).filter(Boolean),
      color: body.color || '#102a43',
      phone: String(body.phone || '').trim(),
      specialties: Array.isArray(body.specialties) ? body.specialties.filter(Boolean) : String(body.specialties || '').split(',').map(v => v.trim()).filter(Boolean),
      photo: body.photo || null,
      about: String(body.about || '').trim(),
      email,
      authUserId,
      createdAt: now,
      updatedAt: now,
    };
    const agentStatus = agent.status === 'Suspended' ? 'Suspended' : 'Active';
    const agentApproval = agent.approvalStatus || 'Approved';
    data.users.push({
      id: authUserId,
      name,
      username: uniqueUsername(data.users, null, email),
      email,
      phone: agent.phone,
      role: 'Agent',
      status: agentStatus,
      approvalStatus: agentApproval,
      password: hashPassword(password),
      joinedDate: now.slice(0, 10),
      createdByAdmin: true,
      agencyName: agent.agency,
      specialization: agent.specialties.join(', '),
      experience: agent.years,
      city: agent.areas.join(', '),
      title: 'Property Agent',
      photo: agent.photo,
    });
    data.mobileAgents = data.mobileAgents || [];
    data.mobileAgents.push(agent);
    await writeData(data);
    res.status(201).json(safeMobileAgent(agent, true));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/admin/mobile-agents/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = (data.mobileAgents || []).find(item => String(item.id) === String(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Mobile agent not found' });
    const body = req.body || {};
    const email = body.email === undefined ? undefined : normalizeEmail(body.email);
    const password = body.password === undefined ? undefined : String(body.password || '');
    if (email !== undefined && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid login email.' });
    }
    if (password !== undefined && password !== '') {
      const passwordError = passwordValidationError(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
    }
    let linkedUser = data.users.find(user =>
      (agent.authUserId && Number(user.id) === Number(agent.authUserId))
      || (agent.email && normalizeEmail(user.email) === normalizeEmail(agent.email) && user.role === 'Agent')
    );
    if (email && email !== normalizeEmail(agent.email)) {
      const conflict = data.users.find(user => normalizeEmail(user.email) === email && user.id !== linkedUser?.id)
        || (data.mobileAgents || []).find(item => item.id !== agent.id && normalizeEmail(item.email) === email);
      if (conflict) return res.status(409).json({ error: 'This login email is already in use.' });
    }
    if ((email !== undefined || (password !== undefined && password !== '')) && !linkedUser && (!email || !password)) {
      return res.status(400).json({ error: 'Email and password are both required to create this agent login.' });
    }
    const textFields = ['name', 'displayName', 'agency', 'phone', 'about', 'photo', 'color'];
    for (const key of textFields) if (body[key] !== undefined) agent[key] = body[key];
    if (body.name !== undefined && body.displayName === undefined) agent.displayName = body.name;
    if (body.initials !== undefined) agent.initials = String(body.initials).toUpperCase();
    for (const key of ['verified', 'visible']) if (body[key] !== undefined) agent[key] = Boolean(body[key]);
    for (const key of ['rating', 'reviewCount', 'years', 'listings']) if (body[key] !== undefined) agent[key] = Number(body[key]) || 0;
    for (const key of ['areas', 'specialties']) {
      if (body[key] !== undefined) agent[key] = Array.isArray(body[key])
        ? body[key].filter(Boolean)
        : String(body[key] || '').split(',').map(v => v.trim()).filter(Boolean);
    }
    if (body.status !== undefined) agent.status = body.status;
    if (body.approvalStatus !== undefined) agent.approvalStatus = body.approvalStatus;
    if (email !== undefined) agent.email = email;
    if (!linkedUser && (email || (password !== undefined && password !== ''))) {
      const authUserId = nextId(data);
      linkedUser = {
        id: authUserId,
        name: agent.name,
        username: uniqueUsername(data.users, null, email),
        email,
        phone: agent.phone,
        role: 'Agent',
        status: agent.status === 'Suspended' ? 'Suspended' : 'Active',
        approvalStatus: agent.approvalStatus,
        password: hashPassword(password),
        joinedDate: new Date().toISOString().split('T')[0],
        createdByAdmin: true,
      };
      data.users.push(linkedUser);
      agent.authUserId = authUserId;
    }
    if (linkedUser) {
      linkedUser.name = agent.name;
      linkedUser.phone = agent.phone;
      linkedUser.agencyName = agent.agency;
      linkedUser.specialization = agent.specialties.join(', ');
      linkedUser.experience = agent.years;
      linkedUser.city = agent.areas.join(', ');
      linkedUser.photo = agent.photo;
      if (email !== undefined) linkedUser.email = email;
      if (password) linkedUser.password = hashPassword(password);
      linkedUser.status = agent.status === 'Suspended' ? 'Suspended' : 'Active';
      linkedUser.approvalStatus = agent.approvalStatus;
    }
    agent.updatedAt = new Date().toISOString();
    await writeData(data);
    res.json(safeMobileAgent(agent, true));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/admin/mobile-agents/:id/status', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = (data.mobileAgents || []).find(item => String(item.id) === String(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Mobile agent not found' });
    agent.status = req.body.status || (agent.status === 'Active' ? 'Suspended' : 'Active');
    agent.updatedAt = new Date().toISOString();
    const linkedUser = data.users.find(user => Number(user.id) === Number(agent.authUserId));
    if (linkedUser) linkedUser.status = agent.status === 'Suspended' ? 'Suspended' : 'Active';
    await writeData(data);
    res.json({ success: true, agent: safeMobileAgent(agent, true) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/admin/mobile-agents/:id/approval', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = (data.mobileAgents || []).find(item => String(item.id) === String(req.params.id));
    if (!agent) return res.status(404).json({ error: 'Mobile agent not found' });
    agent.approvalStatus = req.body.approvalStatus || 'Approved';
    agent.status = agent.approvalStatus === 'Rejected' ? 'Suspended' : 'Active';
    agent.updatedAt = new Date().toISOString();
    const linkedUser = data.users.find(user => Number(user.id) === Number(agent.authUserId));
    if (linkedUser) {
      linkedUser.approvalStatus = agent.approvalStatus;
      linkedUser.status = agent.approvalStatus === 'Rejected' ? 'Suspended' : 'Active';
    }
    await writeData(data);
    res.json({ success: true, agent: safeMobileAgent(agent, true) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/mobile-agents/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const removed = (data.mobileAgents || []).find(item => String(item.id) === String(req.params.id));
    const before = (data.mobileAgents || []).length;
    data.mobileAgents = (data.mobileAgents || []).filter(item => String(item.id) !== String(req.params.id));
    if (data.mobileAgents.length === before) return res.status(404).json({ error: 'Mobile agent not found' });
    if (removed?.authUserId) {
      data.users = data.users.filter(user => Number(user.id) !== Number(removed.authUserId));
    }
    await writeData(data);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET all agents (with filter by approvalStatus)
app.get('/api/agents', async (req, res) => {
  try {
    const data = await readData();
    let agents = data.users.filter(u => u.role === 'Agent');
    if (req.query.approvalStatus) agents = agents.filter(a => a.approvalStatus === req.query.approvalStatus);
    if (req.query.city) agents = agents.filter(a => String(a.city || '').toLowerCase() === String(req.query.city).toLowerCase());
    if (req.query.limit) agents = agents.slice(0, Math.max(0, Number(req.query.limit) || 0));
    // The supplied public website already consumes this approved-agent route.
    // Include the admin-managed mobile directory there as well, without
    // changing the admin account list returned when no approval filter exists.
    if (req.query.approvalStatus === 'Approved') {
      agents = agents.concat((data.mobileAgents || []).filter(a =>
        a.approvalStatus === 'Approved' && a.status === 'Active' && a.visible !== false
      ));
    }
    res.json(agents.map(safeMobileAgent));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Admin creates a new agent account
app.post('/api/agents', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const { name, email, phone, password, photo, specialization, bio, experience, title, license, city, languages, rating } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const exists = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (exists) return res.status(409).json({ error: 'A user with this email already exists' });
    const newAgent = {
      id: nextId(data),
      name, email, phone: phone || '',
      role: 'Agent',
      status: 'Active',
      approvalStatus: 'Approved',
      password: hashPassword(password),
      joinedDate: new Date().toISOString().split('T')[0],
      createdByAdmin: true,
      photo: photo || null,
      specialization: specialization || '',
      title: title || '',
      bio: bio || '',
      experience: experience || '',
      license: license || '',
      city: city || '',
      languages: languages || '',
      rating: rating || null,
    };
    data.users.push(newAgent);
    await writeData(data);
    const { password: _p, ...safe } = newAgent;
    res.status(201).json(safe);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Approve a pending agent
app.patch('/api/agents/:id/approve', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = data.users.find(u => u.id === Number(req.params.id) && u.role === 'Agent');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.approvalStatus = 'Approved';
    agent.status = 'Active';
    agent.approvedAt = new Date().toISOString();
    await writeData(data);
    const { password: _, ...safe } = agent;
    res.json({ success: true, agent: safe });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Reject a pending agent
app.patch('/api/agents/:id/reject', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = data.users.find(u => u.id === Number(req.params.id) && u.role === 'Agent');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.approvalStatus = 'Rejected';
    agent.status = 'Suspended';
    agent.rejectedAt = new Date().toISOString();
    agent.rejectReason = req.body.reason || '';
    await writeData(data);
    const { password: _, ...safe } = agent;
    res.json({ success: true, agent: safe });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Admin updates agent email + password (credentials)
app.patch('/api/agents/:id/credentials', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = data.users.find(u => u.id === Number(req.params.id) && u.role === 'Agent');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const { email, password } = req.body;
    if (!email && !password) return res.status(400).json({ error: 'Provide email or password to update' });
    if (email) {
      const conflict = data.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== agent.id);
      if (conflict) return res.status(409).json({ error: 'Email already in use by another account' });
      agent.email = email;
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      agent.password = hashPassword(password);
    }
    agent.credentialsUpdatedAt = new Date().toISOString();
    await writeData(data);
    const { password: _p, ...safe } = agent;
    res.json({ success: true, agent: safe });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Suspend / Activate agent
app.patch('/api/agents/:id/status', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const agent = data.users.find(u => u.id === Number(req.params.id) && u.role === 'Agent');
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.status = req.body.status || (agent.status === 'Active' ? 'Suspended' : 'Active');
    await writeData(data);
    const { password: _, ...safe } = agent;
    res.json({ success: true, agent: safe });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Delete agent
app.delete('/api/agents/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.users.findIndex(u => u.id === Number(req.params.id) && u.role === 'Agent');
    if (idx === -1) return res.status(404).json({ error: 'Agent not found' });
    data.users.splice(idx, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/users/:id/password', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const user = data.users.find(u => u.id === Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && req.currentUser.id !== Number(req.params.id)) {
      return res.status(403).json({ error: 'You can only change your own password.' });
    }
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    if (currentPassword && !verifyPassword(currentPassword, user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = hashPassword(newPassword);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Change-password alias — buyer-dashboard calls /api/auth/change-password ──
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const data = await readData();
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ error: 'userId and newPassword required' });
    const user = data.users.find(u => u.id === Number(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    if (currentPassword && !verifyPassword(currentPassword, user.password)) return res.status(400).json({ error: 'Current password is incorrect' });
    user.password = hashPassword(newPassword);
    await writeData(data);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT alias for appointments (agent-dashboard uses PUT, server uses PATCH) ──
app.put('/api/appointments/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const appt = data.appointments?.find(a => a.id === Number(req.params.id));
    if (!appt) return res.status(404).json({ error: 'Not found' });
    const { userId, role } = req.auth;
    const allowedRoles = ['Admin', 'Agent'];
    if (!allowedRoles.includes(role) && appt.sellerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const prevStatus = appt.status;
    Object.assign(appt, req.body);
    await writeData(data);
    // Send push notification to buyer when appointment is confirmed
    if (appt.status !== prevStatus && appt.status === 'Confirmed') {
      notifyAppointmentConfirmed(appt, data.users);
    }
    res.json(appt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const identifier = String(req.body.identifier ?? req.body.email ?? '').trim();
    const { password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Email, username or mobile number and password are required' });
    const data = await readData();
    const user = findUserByLoginIdentifier(data.users, identifier);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email, username, mobile number or password' });
    }
    if (user.status === 'Inactive' || user.status === 'Suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact admin.' });
    }
    // ── Agent approval gate ──────────────────────────────────────────────────
    if (user.role === 'Agent') {
      if (user.approvalStatus === 'Pending') {
        return res.status(403).json({
          error: 'Your agent account is pending admin approval. You will be notified once approved.',
          code: 'AGENT_PENDING'
        });
      }
      if (user.approvalStatus === 'Rejected') {
        return res.status(403).json({
          error: 'Your agent account application was not approved. Please contact admin.',
          code: 'AGENT_REJECTED'
        });
      }
    }
    const { password: _, ...safe } = user;
    const token = await createSession(user);
    res.json({ user: safe, token });
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      if (neonDb) {
        await neonDb`DELETE FROM auth_sessions WHERE token_hash = ${tokenDigest(token)}`;
      } else if (localPreview) {
        tokenStore.delete(token);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('LOGOUT ERROR:', err.message);
    res.status(500).json({ error: 'Unable to log out right now.' });
  }
});

// ─── ADMIN OTP: Step 1 — verify credentials, send OTP ───────────────────────
app.post('/api/auth/admin-verify', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const data = await readData();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.role !== 'Admin') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate OTP
    const otp = generateOTP();
    await saveChallenge(email.toLowerCase(), 'admin-login', otp, 5);

    // Send email
    try {
      const result = await sendOtpEmail(email, otp);
      if (result.fallback) return res.status(503).json({ error: 'Email service is not configured.' });
    } catch (err) {
      console.error('[OTP email error]', err.message);
      return res.status(503).json({ error: 'Unable to send verification email.' });
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN OTP: Step 2 — verify OTP, complete login ─────────────────────────
app.post('/api/auth/admin-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const key = email.toLowerCase();
    const result = await consumeChallenge(key, 'admin-login', otp);
    if (!result.ok) return res.status(result.reason === 'attempts' ? 429 : 401).json({
      error: result.reason === 'attempts' ? 'Too many attempts. Please request a new OTP.' :
        result.reason === 'expired' ? 'OTP has expired. Please request a new one.' :
          `Incorrect code. ${result.left} attempt(s) remaining.`
    });

    // OTP verified ✓
    const data = await readData();
    const user = data.users.find(u => u.email.toLowerCase() === key);
    const { password: _, ...safe } = user;
    const token = await createSession(user);
    res.json({ success: true, user: safe, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DB Debug endpoint ────────────────────────────────────────────────────────
app.get('/api/debug/db', async (req, res) => {
  try {
    if (!neonDb) return res.json({ dbConnected: false, previewFallback: localPreview, provider: localPreview ? 'local' : 'neon' });
    const data = await neonDb`SELECT id FROM app_data WHERE id = 1 LIMIT 1`;
    res.json({ dbConnected: true, tableExists: true, rowCount: data.length, provider: 'neon' });
  } catch (err) {
    res.json({ dbConnected: false, error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, phone, password, role } = req.body;
    const email = normalizeEmail(req.body.email);
    const requestedUsername = normalizeUsername(req.body.username);
    if (!firstName || !password || (!email && !requestedUsername && !phone)) {
      return res.status(400).json({ error: 'Name, password and an email, username or mobile number are required' });
    }
    if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (requestedUsername && !isValidUsername(requestedUsername)) {
      return res.status(400).json({ error: 'Username must start with a letter and use 3-30 letters, numbers, dots, underscores or hyphens.' });
    }
    if (phone && !isValidPhone(phone)) return res.status(400).json({ error: 'Please enter a valid mobile number.' });
    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const confirmPassword = req.body.confirmPassword ?? req.body.passwordConfirmation ?? password;
    if (confirmPassword !== password) return res.status(400).json({ error: 'Passwords do not match.' });
    // ── Developers cannot self-register ─────────────────────────────────────
    const requestedRole = (role || '').toLowerCase();
    if (requestedRole === 'developer') {
      return res.status(403).json({
        error: 'This role is not available for registration.',
        code: 'ROLE_NOT_ALLOWED'
      });
    }
    const data = await readData();
    const phoneKey = normalizePhone(phone);
    const username = uniqueUsername(data.users, requestedUsername, email || firstName || phone);
    const duplicateEmail = Boolean(email) && data.users.some(u => normalizeEmail(u.email) === email);
    const duplicateUsername = requestedUsername && data.users.some(u => normalizeUsername(u.username) === requestedUsername);
    const duplicatePhone = Boolean(phoneKey) && data.users.some(u => normalizePhone(u.phone) === phoneKey);
    if (duplicateEmail) return res.status(409).json({ error: 'An account with this email already exists' });
    if (duplicateUsername) return res.status(409).json({ error: 'This username is already in use. Please choose another.' });
    if (duplicatePhone) return res.status(409).json({ error: 'This mobile number is already registered.' });

    const { city, specialization, experience } = req.body;
    const roleMap = { buyer: 'Buyer', seller: 'Seller', farmer: 'Buyer', agent: 'Agent' };
    const isAgent = requestedRole === 'agent';
    const newUser = {
      id: nextId(data),
      name: `${firstName} ${lastName || ''}`.trim(),
      username,
      email: email || '',
      phone: phone ? String(phone).trim() : '',
      role: roleMap[requestedRole] || 'Buyer',
      status: isAgent ? 'Pending' : 'Active',
      ...(isAgent && { approvalStatus: 'Pending', city: city || '', specialization: specialization || '', experience: experience || '', createdByAdmin: false }),
      password: hashPassword(password),
      joinedDate: new Date().toISOString().split('T')[0],
    };
    data.users.push(newUser);
    await writeData(data);
    const { password: _, ...safe } = newUser;
    if (isAgent) {
      // Agents must wait for admin approval — do not issue a token
      return res.status(201).json({ pending: true, message: 'Your agent registration is submitted. Please wait for admin approval.' });
    }
    const token = await createSession(newUser);
    res.status(201).json({ user: safe, token });
  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ error: 'Unable to create your account right now. Please try again.' });
  }
});

// ─── FORGOT / RESET PASSWORD ───────────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const data = await readData();
    const user = data.users.find(u => normalizeEmail(u.email) === email);
    // Always return success to prevent email enumeration
    if (!user) return res.json({ success: true, message: 'If an account exists with this email, a reset code has been sent.' });

    const code = generateOTP();
    await saveChallenge(email.toLowerCase(), 'password-reset', code, 15);

    // Send reset code via email
    let smtpOff = false;
    try {
      const result = await sendPasswordResetEmail(email, code, user.role);
      if (result && result.fallback) smtpOff = true;
    } catch (emailErr) {
      smtpOff = true;
      console.error('[forgot-password email error]', emailErr.message);
    }

    res.json({
      success: true,
      smtpOff,
      message: smtpOff
        ? 'Email service is not configured. Please contact admin to get your reset code.'
        : 'Reset code sent. Check your email.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    const { newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and new password are required' });
    const passwordError = passwordValidationError(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const data = await readData();
    const user = data.users.find(u => normalizeEmail(u.email) === email);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset code' });
    const challenge = await consumeChallenge(email.toLowerCase(), 'password-reset', code);
    if (!challenge.ok) return res.status(400).json({ error: challenge.reason === 'expired' ? 'Reset code has expired. Please request a new one.' : 'Incorrect reset code. Please try again.' });

    user.password = hashPassword(newPassword);
    await writeData(data);
    await invalidateUserSessions(user.id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GOOGLE AUTH ───────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await r.json();
    if (!r.ok || payload.error) return res.status(401).json({ error: 'Invalid Google token. Please try again.' });

    const { email, name } = payload;
    if (!email) return res.status(401).json({ error: 'Could not retrieve email from Google account.' });

    const data = await readData();
    let user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Auto-register new Google users as Buyer
      user = {
        id: nextId(data),
        name: name || email.split('@')[0],
        email,
        phone: '',
        role: 'Buyer',
        status: 'Active',
        password: hashPassword(crypto.randomBytes(32).toString('hex')),
        joinedDate: new Date().toISOString().split('T')[0],
      };
      data.users.push(user);
      await writeData(data);
    }

    if (user.status === 'Inactive') return res.status(403).json({ error: 'Account is deactivated. Contact support.' });

    const { password: _p, resetCode: _rc, resetCodeExpiry: _re, ...safe } = user;
    const token = await createSession(user);
    res.json({ user: safe, token });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed. Please try again.' });
  }
});

// Mobile sends OAuth access tokens to this contract.  Keep the existing
// /auth/google ID-token endpoint for the web dashboard, while accepting the
// mobile Google/Facebook provider shape as well.
async function socialAuthHandler(req, res) {
  try {
    const { provider, accessToken } = req.body;
    if (!['google', 'facebook'].includes(provider) || !accessToken) {
      return res.status(400).json({ error: 'provider (google or facebook) and accessToken are required' });
    }
    let profile;
    if (provider === 'google') {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return res.status(401).json({ error: 'Invalid Google access token' });
      profile = await response.json();
    } else {
      const facebookAppId = String(process.env.FACEBOOK_APP_ID || '').trim();
      const facebookAppSecret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
      if (!facebookAppId || !facebookAppSecret) {
        return res.status(503).json({
          error: 'Facebook login is not configured on the server yet.',
          code: 'FACEBOOK_NOT_CONFIGURED',
        });
      }
      const debugUrl = new URL('https://graph.facebook.com/debug_token');
      debugUrl.searchParams.set('input_token', accessToken);
      debugUrl.searchParams.set('access_token', `${facebookAppId}|${facebookAppSecret}`);
      const debugResponse = await fetch(debugUrl);
      const debugPayload = await debugResponse.json().catch(() => ({}));
      const tokenData = debugPayload?.data;
      if (
        !debugResponse.ok ||
        !tokenData?.is_valid ||
        String(tokenData.app_id) !== facebookAppId ||
        !tokenData.user_id
      ) {
        return res.status(401).json({ error: 'Invalid Facebook access token. Please try again.' });
      }
      const profileUrl = new URL('https://graph.facebook.com/me');
      profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
      profileUrl.searchParams.set('access_token', accessToken);
      const response = await fetch(profileUrl);
      if (!response.ok) return res.status(401).json({ error: 'Unable to verify Facebook profile.' });
      profile = await response.json();
      if (String(profile.id) !== String(tokenData.user_id)) {
        return res.status(401).json({ error: 'Facebook identity verification failed.' });
      }
      profile.providerId = String(tokenData.user_id);
      profile.avatarUrl = profile.picture?.data?.url || '';
    }

    const data = await readData();
    const providerId = String(profile.providerId || profile.sub || profile.id || '');
    const normalizedEmail = normalizeEmail(profile.email);
    const providerField = provider === 'facebook' ? 'facebookId' : 'googleId';
    let user = providerId
      ? data.users.find(u => String(u[providerField] || '') === providerId)
      : null;
    if (!user && normalizedEmail) {
      user = data.users.find(u => normalizeEmail(u.email) === normalizedEmail);
    }
    if (user && user[providerField] && String(user[providerField]) !== providerId) {
      return res.status(409).json({ error: 'This email is already linked to another social account.' });
    }
    if (!user) {
      const socialEmail = normalizedEmail || `${provider}-${providerId}@accounts.oglandmark.invalid`;
      user = {
        id: nextId(data), name: profile.name || String(profile.email).split('@')[0],
        email: socialEmail, phone: '', role: 'Buyer', status: 'Active',
        password: hashPassword(crypto.randomBytes(32).toString('hex')),
        authProvider: provider, [providerField]: providerId,
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
        joinedDate: new Date().toISOString().split('T')[0],
      };
      data.users.push(user);
      await writeData(data);
    } else {
      let changed = false;
      if (providerId && user[providerField] !== providerId) {
        user[providerField] = providerId;
        changed = true;
      }
      if (user.authProvider !== provider && user.authProvider !== `${provider}+email`) {
        user.authProvider = user.authProvider ? `${user.authProvider}+${provider}` : provider;
        changed = true;
      }
      if (profile.avatarUrl && user.avatarUrl !== profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
        changed = true;
      }
      if (changed) await writeData(data);
    }
    if (['Inactive', 'Suspended', 'Deleted'].includes(user.status)) {
      return res.status(403).json({ error: 'Account is unavailable. Please contact support.' });
    }
    const { password: _, ...safe } = user;
    res.json({ user: safe, token: await createSession(user) });
  } catch (err) {
    console.error('Social auth error:', err.message);
    res.status(500).json({ error: 'Social authentication failed. Please try again.' });
  }
}
app.post('/api/auth/social', socialAuthHandler);
// The current Expo client uses this path when EXPO_PUBLIC_API_URL is supplied
// without an `/api` suffix; retain it as a compatibility alias.
app.post('/auth/social', socialAuthHandler);

// ─── INQUIRIES ─────────────────────────────────────────────────────────────────
app.get('/api/inquiries', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    let items = data.inquiries;
    if (req.currentUser.role !== 'Admin') {
      items = items.filter(i => [i.buyerId, i.sellerId, i.agentId].includes(req.currentUser.id));
    }
    if (req.query.seller_id)  items = items.filter(i => i.sellerId  === Number(req.query.seller_id));
    if (req.query.buyer_id)   items = items.filter(i => i.buyerId   === Number(req.query.buyer_id));
    if (req.query.agent_id)   items = items.filter(i => i.agentId   === Number(req.query.agent_id));
    if (req.query.property_id) items = items.filter(i => i.propertyId === Number(req.query.property_id));
    if (req.query.status)     items = items.filter(i => i.status === req.query.status);
    // Sort newest first
    items = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/inquiries', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const property = data.properties.find(p => p.id === Number(req.body.propertyId));
    if (!property) return res.status(404).json({ error: 'Property not found' });
    const newItem = {
      id: nextId(data), date: new Date().toISOString().split('T')[0], status: 'Pending', reply: null, replyDate: null,
      ...req.body, buyerId: req.currentUser.id, sellerId: property.sellerId || req.body.sellerId,
      agentId: property.agentId || req.body.agentId,
    };
    data.inquiries.push(newItem);
    property.inquiryCount = (property.inquiryCount || 0) + 1;
    await writeData(data);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/inquiries/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const item = data.inquiries.find(i => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    // Only the seller the inquiry is addressed to, or an admin/agent, may update it
    const { userId, role } = req.auth;
    const allowedRoles = ['Admin', 'Agent'];
    if (!allowedRoles.includes(role) && item.sellerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const prevStatus = item.status;
    if (req.body.status) item.status = req.body.status;
    if (req.body.reply !== undefined) {
      item.reply = req.body.reply;
      item.replyDate = new Date().toISOString().split('T')[0];
      item.status = 'Contacted';
    }
    await writeData(data);

    // Send push notification to buyer when status changes to Replied or Contacted
    const newStatus = item.status;
    if (newStatus !== prevStatus && (newStatus === 'Replied' || newStatus === 'Contacted')) {
      const buyer = item.buyerId ? data.users.find(u => u.id === item.buyerId) : null;
      if (buyer?.pushToken) {
        const title = newStatus === 'Replied' ? '💬 Inquiry Replied' : '📞 Seller Contacted You';
        const body = `Your inquiry for "${item.propertyTitle}" has been ${newStatus.toLowerCase()}.`;
        sendExpoPush(buyer.pushToken, title, body, { screen: 'my-inquiries', inquiryId: item.id });
      }
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/inquiries/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const exists = data.inquiries.find(i => i.id === Number(req.params.id));
    if (!exists) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && ![exists.buyerId, exists.sellerId, exists.agentId].includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    data.inquiries = data.inquiries.filter(i => i.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── OFFERS ────────────────────────────────────────────────────────────────────
app.get('/api/offers', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    let items = data.offers;
    if (req.currentUser.role !== 'Admin') items = items.filter(o => [o.buyerId, o.sellerId, o.agentId].includes(req.currentUser.id));
    if (req.query.buyer_id) items = items.filter(o => o.buyerId === Number(req.query.buyer_id));
    if (req.query.seller_id) items = items.filter(o => o.sellerId === Number(req.query.seller_id));
    if (req.query.propertyId) items = items.filter(o => o.propertyId === Number(req.query.propertyId));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/offers', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const property = data.properties.find(p => p.id === Number(req.body.propertyId));
    if (!property) return res.status(404).json({ error: 'Property not found' });
    const newItem = { id: nextId(data), date: new Date().toISOString().split('T')[0], status: 'Pending', counterAmount: null, counterMessage: null, ...req.body, buyerId: req.currentUser.id, sellerId: property.sellerId || req.body.sellerId, agentId: property.agentId || req.body.agentId };
    data.offers.push(newItem);
    await writeData(data);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/offers/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const item = data.offers.find(o => o.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && ![item.buyerId, item.sellerId, item.agentId].includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    const { action, counterAmount, counterMessage } = req.body;
    const statusMap = { accept: 'Accepted', reject: 'Rejected', counter: 'Counter', withdraw: 'Withdrawn' };
    item.status = statusMap[action] || action || item.status;
    if (counterAmount  !== undefined) item.counterAmount  = counterAmount;
    if (counterMessage !== undefined) item.counterMessage = counterMessage;
    item.updatedAt = new Date().toISOString();
    await writeData(data);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/offers/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const exists = data.offers.find(o => o.id === Number(req.params.id));
    if (!exists) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && ![exists.buyerId, exists.sellerId, exists.agentId].includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    data.offers = data.offers.filter(o => o.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── APPOINTMENTS ──────────────────────────────────────────────────────────────
app.get('/api/appointments', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    let items = data.appointments;
    if (req.currentUser.role !== 'Admin') items = items.filter(a => [a.buyerId, a.sellerId, a.agentId].includes(req.currentUser.id));
    if (req.query.buyer_id)  items = items.filter(a => a.buyerId  === Number(req.query.buyer_id));
    if (req.query.seller_id) items = items.filter(a => a.sellerId === Number(req.query.seller_id));
    if (req.query.agent_id)  items = items.filter(a => a.agentId  === Number(req.query.agent_id));
    if (req.query.status)    items = items.filter(a => a.status === req.query.status);
    // Sort: upcoming first, then by date
    items = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/appointments', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    // agentId comes from body; no hardcoded default
    const property = data.properties.find(p => p.id === Number(req.body.propertyId));
    const newItem = { id: nextId(data), status: 'Upcoming', notes: '', createdAt: new Date().toISOString(), ...req.body, buyerId: req.currentUser.id, sellerId: property?.sellerId || req.body.sellerId, agentId: property?.agentId || req.body.agentId };
    data.appointments.push(newItem);
    await writeData(data);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/appointments/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const item = data.appointments.find(a => a.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    // Only the seller the appointment belongs to, or an admin/agent, may update it
    const { userId, role } = req.auth;
    const allowedRoles = ['Admin', 'Agent'];
    if (!allowedRoles.includes(role) && item.sellerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const prevStatus = item.status;
    const allowed = ['status', 'notes', 'date', 'time', 'type', 'agentId'];
    allowed.forEach(k => { if (req.body[k] !== undefined) item[k] = req.body[k]; });
    await writeData(data);

    // Send push notification to buyer when appointment is confirmed
    if (item.status !== prevStatus && item.status === 'Confirmed') {
      notifyAppointmentConfirmed(item, data.users);
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/appointments/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const exists = data.appointments.find(a => a.id === Number(req.params.id));
    if (!exists) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && ![exists.buyerId, exists.sellerId, exists.agentId].includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    data.appointments = data.appointments.filter(a => a.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    let items = data.conversations;
    // Support both ?user_id= and ?participant= (agent dashboard uses participant)
    const uid = req.query.user_id || req.query.participant;
    if (uid && req.currentUser.role === 'Admin') {
      const id = Number(uid);
      items = items.filter(c => Array.isArray(c.participants) && c.participants.includes(id));
    }
    if (req.currentUser.role !== 'Admin') {
      items = items.filter(c => Array.isArray(c.participants) && c.participants.includes(req.currentUser.id));
    }
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/conversations', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const participants = [...new Set([...(Array.isArray(req.body.participants) ? req.body.participants.map(Number) : []), req.currentUser.id])];
    if (participants.length < 2) return res.status(400).json({ error: 'At least one other participant is required' });
    const newItem = { id: nextId(data), messages: [], lastUpdated: new Date().toISOString(), createdAt: new Date().toISOString(), ...req.body, participants };
    data.conversations.push(newItem);
    await writeData(data);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const conv = data.conversations.find(c => c.id === Number(req.params.id));
    if (!conv) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && !conv.participants?.includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    res.json((conv.messages || []).map(message => ({
      ...message, conversationId: conv.id, createdAt: message.createdAt || message.timestamp,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const conv = data.conversations.find(c => c.id === Number(req.params.id));
    if (!conv) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && !conv.participants?.includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    if (!req.body.text || typeof req.body.text !== 'string') return res.status(400).json({ error: 'text is required' });
    const msg = { id: nextId(data), conversationId: conv.id, senderId: req.currentUser.id, senderName: req.currentUser.name, text: req.body.text, createdAt: new Date().toISOString() };
    conv.messages.push(msg);
    conv.lastUpdated = new Date().toISOString();
    await writeData(data);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/conversations/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const exists = data.conversations.find(c => c.id === Number(req.params.id));
    if (!exists) return res.status(404).json({ error: 'Not found' });
    if (req.currentUser.role !== 'Admin' && !exists.participants?.includes(req.currentUser.id)) return res.status(403).json({ error: 'Forbidden' });
    data.conversations = data.conversations.filter(c => c.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
    const category = String(req.query.category || 'all');
    let items = data.notifications.filter(n => !n.userDeletedAt && (!n.expiresAt || new Date(n.expiresAt) > new Date()));
    // Admin may inspect a selected user for support, but ordinary users are
    // always scoped from the bearer identity rather than a client id.
    const recipientId = req.currentUser.role === 'Admin' && req.query.userId
      ? Number(req.query.userId)
      : req.currentUser.id;
    items = items.filter(n => Number(n.recipientUserId ?? n.userId) === recipientId);
    if (category !== 'all') items = items.filter(n => n.category === category);
    items.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    const total = items.length;
    const unreadCount = items.filter(n => !n.isRead && !n.read).length;
    const start = (page - 1) * limit;
    res.json({ items: items.slice(start, start + limit), page, limit, total, hasMore: start + limit < total, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const unreadCount = data.notifications.filter(n =>
      !n.userDeletedAt &&
      Number(n.recipientUserId ?? n.userId) === req.currentUser.id &&
      !n.isRead && !n.read &&
      (!n.expiresAt || new Date(n.expiresAt) > new Date())
    ).length;
    res.json({ unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const item = data.notifications.find(n => String(n.notificationId || n.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (Number(item.recipientUserId ?? item.userId) !== req.currentUser.id) return res.status(403).json({ error: 'Forbidden' });
    item.read = true;
    item.isRead = true;
    item.readAt = new Date().toISOString();
    await writeData(data);
    res.json({ success: true, notification: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const category = String(req.body.category || 'all');
    const now = new Date().toISOString();
    data.notifications
      .filter(n => Number(n.recipientUserId ?? n.userId) === req.currentUser.id)
      .filter(n => category === 'all' || n.category === category)
      .forEach(n => { n.read = true; n.isRead = true; n.readAt = now; });
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const item = data.notifications.find(n => String(n.notificationId || n.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (Number(item.recipientUserId ?? item.userId) !== req.currentUser.id) return res.status(403).json({ error: 'Forbidden' });
    item.userDeletedAt = new Date().toISOString();
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/notification-preferences', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const allowed = ['properties', 'projects', 'announcements', 'promotional', 'account', 'system', 'propertyAlerts', 'newProjects', 'frequency'];
    const current = data.notificationPreferences[String(req.currentUser.id)] || {};
    const next = { ...current };
    for (const key of allowed) {
      if (req.body[key] !== undefined) next[key] = key === 'frequency' ? String(req.body[key]) : Boolean(req.body[key]);
    }
    if (Array.isArray(req.body.cities)) next.cities = req.body.cities.map(String).slice(0, 30);
    if (Array.isArray(req.body.propertyTypes)) next.propertyTypes = req.body.propertyTypes.map(String).slice(0, 20);
    data.notificationPreferences[String(req.currentUser.id)] = next;
    await writeData(data);
    res.json(next);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/notification-preferences', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    res.json(data.notificationPreferences[String(req.currentUser.id)] || {
      properties: true, projects: true, announcements: true, promotional: true,
      account: true, system: true, frequency: 'immediate',
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── Admin announcements ───────────────────────────────────────────────────────
async function deliverAnnouncement(data, announcement) {
  if (announcement.sentAt) return [];
  const recipients = usersForAnnouncement(data, announcement.audience || {});
  const type = announcement.type === 'promotional'
    ? 'PROMOTIONAL_ANNOUNCEMENT'
    : announcement.type === 'important'
      ? 'IMPORTANT_ANNOUNCEMENT'
      : announcement.type === 'system' ? 'SYSTEM_ANNOUNCEMENT' : 'GENERAL_ANNOUNCEMENT';
  const created = await createAndDeliverNotifications(data, recipients, {
    type,
    category: announcement.type === 'promotional' ? 'promotional' : 'announcements',
    title: announcement.title,
    body: announcement.message,
    imageUrl: announcement.imageUrl,
    entityType: 'announcement',
    entityId: announcement.id,
    announcementId: announcement.id,
    deepLink: `/announcements/${announcement.id}`,
    priority: announcement.priority,
    expiresAt: announcement.expiresAt,
    eventKey: `announcement:${announcement.id}`,
    metadata: { audience: announcement.audience || {} },
  });
  announcement.status = 'sent';
  announcement.sentAt = new Date().toISOString();
  announcement.recipientCount = created.length;
  return created;
}

async function processScheduledAnnouncements() {
  try {
    const data = await readData();
    const now = Date.now();
    let changed = false;
    for (const announcement of data.announcements || []) {
      if (announcement.status === 'scheduled' && announcement.scheduleAt && new Date(announcement.scheduleAt).getTime() <= now) {
        await deliverAnnouncement(data, announcement);
        changed = true;
      }
    }
    if (changed) await writeData(data);
  } catch (error) {
    console.warn('[notifications] Scheduled announcement processing failed:', error.message);
  }
}

app.get('/api/admin/announcements', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    res.json((data.announcements || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/announcements', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || req.body.body || '').trim();
    if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
    const scheduleAt = req.body.scheduleAt ? new Date(req.body.scheduleAt).toISOString() : null;
    if (req.body.scheduleAt && Number.isNaN(new Date(req.body.scheduleAt).getTime())) {
      return res.status(400).json({ error: 'scheduleAt must be a valid date' });
    }
    const announcement = {
      id: nextId(data),
      title,
      message,
      imageUrl: req.body.imageUrl || null,
      type: ['general', 'important', 'system', 'promotional'].includes(req.body.type) ? req.body.type : 'general',
      priority: ['NORMAL', 'HIGH', 'URGENT'].includes(req.body.priority) ? req.body.priority : 'NORMAL',
      audience: {
        role: req.body.audience?.role || '',
        city: req.body.audience?.city || '',
      },
      scheduleAt,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt).toISOString() : null,
      status: scheduleAt ? 'scheduled' : (req.body.sendNow ? 'sent' : 'draft'),
      createdAt: new Date().toISOString(),
      createdBy: req.currentUser.id,
      sentAt: null,
      recipientCount: 0,
    };
    data.announcements.unshift(announcement);
    if (req.body.sendNow && !scheduleAt) await deliverAnnouncement(data, announcement);
    await writeData(data);
    res.status(201).json(announcement);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/announcements/:id/send', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const announcement = (data.announcements || []).find(item => Number(item.id) === Number(req.params.id));
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    await deliverAnnouncement(data, announcement);
    await writeData(data);
    res.json(announcement);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/announcements/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const announcement = (data.announcements || []).find(item =>
      Number(item.id) === Number(req.params.id) &&
      item.status === 'sent' &&
      (!item.expiresAt || new Date(item.expiresAt) > new Date())
    );
    if (!announcement) return res.status(404).json({ error: 'Announcement is no longer available.' });
    const audience = announcement.audience || {};
    const allowed = usersForAnnouncement({ ...data, users: [req.currentUser] }, audience).includes(req.currentUser.id);
    if (!allowed) return res.status(403).json({ error: 'This announcement is not available for your account.' });
    res.json(announcement);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── BLOG ──────────────────────────────────────────────────────────────────────
app.get('/api/blog', async (req, res) => {
  try {
    const data = await readData();
    let posts = data.blogPosts || [];
    if (req.query.category) posts = posts.filter(post => post.category === req.query.category);
    if (req.query.limit) posts = posts.slice(0, Math.max(0, Number(req.query.limit) || 0));
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/blog/:id', async (req, res) => {
  try {
    const data = await readData();
    const post = (data.blogPosts || []).find(item => String(item.id) === req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/blog', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const newItem = { id: nextId(data), createdAt: new Date().toISOString().split('T')[0], views: 0, published: true, ...req.body };
    data.blogPosts.unshift(newItem);
    await writeData(data);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/blog/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.blogPosts.findIndex(p => p.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data.blogPosts[idx] = { ...data.blogPosts[idx], ...req.body };
    await writeData(data);
    res.json(data.blogPosts[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/blog/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    data.blogPosts = data.blogPosts.filter(p => p.id !== Number(req.params.id));
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SAVED PROPERTIES ─────────────────────────────────────────────────────────
app.get('/api/saved/:userId', requireAuth, async (req, res) => {
  try {
    if (req.currentUser.role !== 'Admin' && req.currentUser.id !== Number(req.params.userId)) return res.status(403).json({ error: 'Forbidden' });
    const data = await readData();
    res.json(data.savedProperties[req.params.userId] || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/saved/:userId/:propertyId', requireAuth, async (req, res) => {
  try {
    if (req.currentUser.role !== 'Admin' && req.currentUser.id !== Number(req.params.userId)) return res.status(403).json({ error: 'Forbidden' });
    const data = await readData();
    const uid = req.params.userId;
    const pid = Number(req.params.propertyId);
    if (!data.savedProperties[uid]) data.savedProperties[uid] = [];
    const idx = data.savedProperties[uid].indexOf(pid);
    if (idx === -1) { data.savedProperties[uid].push(pid); await writeData(data); return res.json({ saved: true }); }
    data.savedProperties[uid].splice(idx, 1);
    await writeData(data);
    res.json({ saved: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── IMAGE UPLOAD ──────────────────────────────────────────────────────────────
app.post('/api/upload', requireAuth, upload.array('images', MAX_LISTING_IMAGES), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }
    const _mbase=(process.env.APP_URL||'https://oglandmark.com').replace(/\/$/,'');
    const urls = req.files.map(f => `${_mbase}/images/uploads/${f.filename}`);
    res.json({ success: true, urls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Single image upload
app.post('/api/upload/single', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const _sbase=(process.env.APP_URL||'https://oglandmark.com').replace(/\/$/,'');
    res.json({ success: true, url: `${_sbase}/images/uploads/${req.file.filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Video upload (from mobile app property listing)
app.post('/api/upload/video', requireAuth, upload.single('video'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video provided' });
    const base = (process.env.APP_URL || 'https://oglandmark.com').replace(/\/$/, '');
    res.json({ success: true, url: `${base}/images/uploads/${req.file.filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

// Upload error handler
app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ─── BACKUP ────────────────────────────────────────────────────────────────────
app.get('/api/backup', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const filename = `og-landmark-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── HEALTH ────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// ─── MOBILE APP API ENDPOINTS ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET CURRENT USER (mobile auth) ──────────────────────────────────────────
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ─── PROPERTY ANALYTICS (mobile seller dashboard) ────────────────────────────
app.get('/api/properties/:id/analytics', async (req, res) => {
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const caller = await getRequestUser(req);
    if (!caller || (caller.role !== 'Admin' && prop.sellerId !== caller.id && prop.agentId !== caller.id)) {
      return res.status(caller ? 403 : 401).json({ error: caller ? 'Forbidden' : 'Authentication required. Please log in.' });
    }
    res.json({
      propertyId: prop.id,
      viewCount:    prop.viewCount    || 0,
      savedCount:   prop.savedCount   || 0,
      inquiryCount: prop.inquiryCount || 0,
      approvalStatus: prop.approvalStatus || 'Pending',
      featured: !!prop.featured,
      priority:  !!prop.priority,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── REPORT A PROPERTY (mobile) ───────────────────────────────────────────────
app.post('/api/properties/:id/report', async (req, res) => {
  try {
    const { reason, description } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason required' });
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    if (!data.reports) data.reports = [];
    const report = {
      id: Date.now(),
      propertyId: Number(req.params.id),
      propertyTitle: prop.title || '',
      reason,
      description: description || '',
      reportedAt: new Date().toISOString(),
      status: 'Pending',
    };
    data.reports.push(report);
    await writeData(data);
    res.json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN STATS (mobile admin dashboard) ─────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const props = data.properties || [];
    const users = data.users || [];
    const inqs  = data.inquiries || [];
    const reports = data.reports || [];
    res.json({
      totalProperties: props.length,
      pendingApprovals: props.filter(p => p.approvalStatus === 'Pending').length,
      activeListings:   props.filter(p => p.approvalStatus === 'Active').length,
      featuredListings: props.filter(p => p.featured).length,
      totalUsers:    users.length,
      totalInquiries: inqs.length,
      pendingReports: reports.filter(r => r.status === 'Pending').length,
      totalReports:   reports.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: ALL PROPERTIES (mobile admin) ────────────────────────────────────
app.get('/api/admin/properties', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const { approvalStatus, status, page = '1', limit = '20' } = req.query;
    let props = data.properties || [];
    const requestedStatus = approvalStatus || status;
    if (requestedStatus && requestedStatus !== 'all') {
      props = props.filter(p => p.approvalStatus === requestedStatus);
    }
    const total = props.length;
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    const start = (p - 1) * l;
    res.set('X-Total-Count', String(total));
    res.json(props.slice(start, start + l).map(property => normalisePropertyPayload(property, null, property.id)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete review payload for the CMS and mobile admin.  This intentionally
// returns the exact property record plus seller contact and only the audit
// entries for this property, so review and public views never drift apart.
app.get('/api/admin/properties/:id/review', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const property = data.properties.find(p => p.id === Number(req.params.id));
    if (!property) return res.status(404).json({ error: 'Property not found' });
    const canonical = normalisePropertyPayload(property, null, property.id);
    const seller = (data.users || []).find(user =>
      Number(user.id) === Number(property.sellerId || property.agentId),
    );
    const audit = (data.auditLog || [])
      .filter(entry => entry.resource === 'properties' && String(entry.recordId) === String(property.id))
      .slice(0, 100);
    res.json({
      property: canonical,
      seller: seller ? {
        id: seller.id,
        name: seller.name,
        role: seller.role,
        email: seller.email,
        phone: seller.phone,
        agencyName: seller.agencyName || seller.agency,
      } : null,
      audit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: VERIFY / REJECT PROPERTY (mobile) ────────────────────────────────
app.patch('/api/admin/properties/:id/verify', requireAdmin, async (req, res) => {
  try {
    const { action = 'approve', reason } = req.body; // mobile's verify action defaults to approve
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action must be approve or reject' });
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const previousStatus = prop.approvalStatus || 'Pending';
    if (action === 'approve') {
      const validationErrors = validatePropertyForSubmission(normalisePropertyPayload(prop, null, prop.id));
      if (validationErrors.length) return res.status(422).json({ error: 'Property cannot go live until required data is complete.', code: 'LISTING_VALIDATION_FAILED', fields: validationErrors });
    }
    prop.approvalStatus = action === 'approve' ? 'Active' : 'Rejected';
    prop.submissionState = action === 'approve' ? 'published' : 'rejected';
    if (action === 'reject') {
      if (!String(reason || '').trim()) return res.status(400).json({ error: 'A rejection reason is required.' });
      prop.rejectionReason = String(reason).trim();
    } else prop.rejectionReason = null;
    prop.reviewedAt = new Date().toISOString();
    prop.reviewedBy = req.currentUser.id;
    prop.reviewHistory ||= [];
    prop.reviewHistory.push({
      action: action === 'approve' ? 'approved' : 'rejected',
      reason: action === 'reject' ? prop.rejectionReason : undefined,
      by: req.currentUser.id,
      byName: req.currentUser.name,
      fromStatus: previousStatus,
      toStatus: prop.approvalStatus,
      createdAt: prop.reviewedAt,
    });
    adminAudit(data, req.currentUser, action, 'properties', prop.id, { reason: prop.rejectionReason || null, fromStatus: previousStatus, toStatus: prop.approvalStatus });
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: FEATURE / UNFATURE VIA ADMIN NAMESPACE ───────────────────────────
app.patch('/api/admin/properties/:id/feature', requireAdmin, async (req, res) => {
  try {
    const { featured } = req.body;
    const data = await readData();
    const prop = data.properties.find(p => p.id === Number(req.params.id));
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    prop.featured = featured !== false;
    await writeData(data);
    res.json({ success: true, property: prop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: DELETE PROPERTY VIA ADMIN NAMESPACE ──────────────────────────────
app.delete('/api/admin/properties/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.properties.findIndex(p => p.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Property not found' });
    data.properties.splice(idx, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: USERS (mobile admin) ─────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    let users = data.users || [];
    if (req.query.role) {
      const requestedRole = String(req.query.role).trim().toLowerCase();
      users = users.filter(user => String(user.role || '').trim().toLowerCase() === requestedRole);
    }
    users = [...users].sort((a, b) => {
      const bTime = new Date(b.joinedDate || 0).getTime();
      const aTime = new Date(a.joinedDate || 0).getTime();
      return bTime - aTime;
    });
    if (req.query.limit) users = users.slice(0, Math.max(0, Number(req.query.limit) || 0));
    users = users.map(({ password: _, ...u }) => u);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: UPDATE USER ROLE (mobile admin) ───────────────────────────────────
app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role required' });
    const data = await readData();
    const user = data.users.find(u => u.id === Number(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.role = role;
    await writeData(data);
    const { password: _, ...safe } = user;
    res.json({ success: true, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: DELETE USER VIA ADMIN NAMESPACE ───────────────────────────────────
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const idx = data.users.findIndex(u => u.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    data.users.splice(idx, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: REPORTS (property flags) ─────────────────────────────────────────
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const { status } = req.query;
    let reports = data.reports || [];
    if (status && status !== 'all') reports = reports.filter(r => r.status === status);
    reports = [...reports].sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: UPDATE REPORT STATUS ─────────────────────────────────────────────
app.patch('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const data = await readData();
    if (!data.reports) data.reports = [];
    const report = data.reports.find(r => r.id === Number(req.params.id));
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (status) report.status = status;
    if (adminNote !== undefined) report.adminNote = adminNote;
    report.resolvedAt = new Date().toISOString();
    await writeData(data);
    res.json({ success: true, report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ADMIN: MOBILE/DASHBOARD RESOURCE MANAGEMENT ──────────────────────────────
// These collections use the same app_data documents as the mobile resource
// contracts. List responses deliberately remain arrays (with X-Total-Count) so
// both the existing dashboard and paginated admin clients can consume them.
function adminAudit(data, admin, action, resource, recordId, detail = {}) {
  data.auditLog ||= [];
  data.auditLog.unshift({
    id: nextId(data), userId: admin.id, adminId: admin.id, adminName: admin.name,
    action, resource, recordId: String(recordId), detail, createdAt: new Date().toISOString(),
  });
}
function adminCollection(path, key, options = {}) {
  const statusField = options.statusField || 'status';
  app.get(path, requireAdmin, async (req, res) => {
    try {
      const data = await readData();
      let records = [...(data[key] || [])];
      const requestedStatus = req.query.status || req.query[statusField];
      if (requestedStatus && requestedStatus !== 'all') {
        records = records.filter(record => String(record[statusField] || '').toLowerCase() === String(requestedStatus).toLowerCase());
      }
      for (const field of ['projectId', 'agentId', 'userId', 'developerId']) {
        if (req.query[field] !== undefined && req.query[field] !== '') {
          records = records.filter(record => String(record[field] ?? '') === String(req.query[field]));
        }
      }
      const total = records.length;
      const limit = Math.max(0, Number(req.query.limit) || 0);
      const page = Math.max(1, Number(req.query.page) || 1);
      if (limit) records = records.slice((page - 1) * limit, (page - 1) * limit + limit);
      res.set('X-Total-Count', String(total));
      res.json(records);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  if (options.allowCreate) {
    app.post(path, requireAdmin, async (req, res) => {
      try {
        const data = await readData();
        data[key] ||= [];
        const item = {
          ...req.body,
          id: req.body.id || `${key}_${crypto.randomBytes(10).toString('hex')}`,
          createdAt: new Date().toISOString(),
          createdBy: req.currentUser.id,
        };
        data[key].unshift(item);
        adminAudit(data, req.currentUser, 'create', key, item.id, { status: item[statusField] || null });
        await writeData(data);
        res.status(201).json(item);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });
  }
  app.patch(`${path}/:id`, requireAdmin, async (req, res) => {
    try {
      const data = await readData();
      const item = findRecord(data[key], req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      const { id: _id, userId: _userId, developerId: _developerId, ownerId: _ownerId, action: requestedAction, ...updates } = req.body;
      if (requestedAction && options.actions) {
        const action = String(requestedAction).toLowerCase();
        const nextStatus = options.actions[action];
        if (!nextStatus) return res.status(400).json({ error: `Unsupported action: ${requestedAction}` });
        item[statusField] = nextStatus;
        item.moderatedAt = new Date().toISOString();
        item.moderatedBy = req.currentUser.id;
      }
      Object.assign(item, updates, { updatedAt: new Date().toISOString() });
      adminAudit(data, req.currentUser, 'update', key, item.id, { updates, action: requestedAction || null });
      await writeData(data);
      res.json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
  app.delete(`${path}/:id`, requireAdmin, async (req, res) => {
    try {
      const data = await readData();
      const records = data[key] || [];
      const index = records.findIndex(record => String(record.id) === String(req.params.id));
      if (index < 0) return res.status(404).json({ error: 'Not found' });
      const [deleted] = records.splice(index, 1);
      adminAudit(data, req.currentUser, 'delete', key, deleted.id, { status: deleted[statusField] || null });
      await writeData(data);
      res.json({ success: true, id: deleted.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
}
const moderationActions = {
  approve: 'Approved', reject: 'Rejected', suspend: 'Suspended',
  activate: 'Active', archive: 'Archived', publish: 'Live',
};
adminCollection('/api/admin/buyer-requests', 'buyerRequests');
adminCollection('/api/admin/agent-leads', 'agentLeads');
adminCollection('/api/admin/agent-visits', 'agentVisits');
adminCollection('/api/admin/developer-projects', 'developerProjects', { actions: moderationActions });
adminCollection('/api/admin/developer-blocks', 'developerBlocks');
adminCollection('/api/admin/developer-units', 'developerUnits');
adminCollection('/api/admin/developer-leads', 'developerLeads');
adminCollection('/api/admin/developer-team', 'developerTeam');
adminCollection('/api/admin/developer-documents', 'developerDocuments');
adminCollection('/api/admin/developer-payment-plans', 'developerPaymentPlans');
adminCollection('/api/admin/developer-promotions', 'promotions', { actions: moderationActions });
adminCollection('/api/admin/verification-requests', 'verificationRequests', { actions: moderationActions });
adminCollection('/api/admin/conversations', 'conversations');
adminCollection('/api/admin/notifications', 'notifications', { allowCreate: true });

app.get('/api/admin/users/:id/activity', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const user = (data.users || []).find(item => String(item.id) === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userId = Number(user.id);
    const sources = [
      ['buyerRequests', data.buyerRequests], ['agentLeads', data.agentLeads],
      ['agentVisits', data.agentVisits], ['developerProjects', data.developerProjects],
      ['developerLeads', data.developerLeads], ['verificationRequests', data.verificationRequests],
      ['promotions', data.promotions], ['conversations', data.conversations],
      ['notifications', data.notifications], ['auditLog', data.auditLog],
    ];
    let activity = sources.flatMap(([resource, records]) => (records || [])
      .filter(record => Number(record.userId || record.ownerId || record.developerId || record.agentId || record.adminId) === userId ||
        (resource === 'conversations' && (record.participants || []).map(Number).includes(userId)))
      .map(record => ({ ...record, resource, activityAt: record.updatedAt || record.createdAt || record.timestamp || record.date || null })));
    activity.sort((a, b) => new Date(b.activityAt || 0) - new Date(a.activityAt || 0));
    const total = activity.length;
    const limit = Math.max(0, Number(req.query.limit) || 0);
    const page = Math.max(1, Number(req.query.page) || 1);
    if (limit) activity = activity.slice((page - 1) * limit, (page - 1) * limit + limit);
    res.set('X-Total-Count', String(total));
    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── MOBILE SETTINGS + CONTENT MANAGEMENT ───────────────────────────────────
const DEFAULT_MOBILE_CONTENT = {
  global: {
    theme: {
      background: '#f7f9fc',
      card: '#ffffff',
      foreground: '#102a43',
      mutedForeground: '#6b7c93',
      border: '#d9e2ec',
      secondary: '#eef2f7',
      primary: '#c8a45a',
      action: '#102a43',
      actionForeground: '#ffffff',
      accent: '#f3ead5',
    },
    screenVisibility: {
      home: true,
      explore: true,
      postAd: true,
      saved: true,
      calculator: true,
      profile: true,
      help: true,
      tools: true,
      account: true,
      agentPortal: true,
      developerPortal: true,
    },
    pushTemplates: [
      { key: 'newListings', label: 'New listings available', title: 'New Properties Available!', body: 'Explore the latest listings on OG Landmark.' },
      { key: 'verification', label: 'Verification update', title: 'Verification Update', body: 'Your OG Landmark verification status has been updated.' },
      { key: 'maintenance', label: 'Maintenance notice', title: 'Scheduled Maintenance', body: 'We will be back shortly. Thank you for your patience.' },
    ],
  },
  homepage: {
    sections: {
      browseEyebrow: 'EXPLORE THE MARKET',
      browseTitle: 'Find Your Property',
      featuredEyebrow: 'HANDPICKED FOR YOU',
      featuredTitle: 'Featured properties',
      recommendedEyebrow: 'FOR BUYERS',
      recommendedTitle: 'Recommended for you',
      latestEyebrow: 'JUST LISTED',
      latestTitle: 'Latest properties',
      projectsEyebrow: 'PREMIUM PROJECTS',
      projectsTitle: 'Exceptional developments',
      agentsEyebrow: 'VERIFIED PROFESSIONALS',
      agentsTitle: 'Verified Agents',
      toolsEyebrow: 'OG LANDMARK',
      toolsTitle: 'Explore Tools',
    },
    browse: {
      enabled: true,
      showCategories: true,
      showTransactionSwitch: true,
    },
    carousel: {
      intervalMs: 4200,
      videoMaxDurationMs: 60000,
      showDots: true,
      animationsEnabled: true,
    },
    theme: {
      primary: '#c8a45a',
      action: '#102a43',
      overlayStart: '#00000000',
      overlayMiddle: '#0d1d2bcc',
      overlayEnd: '#102a43f0',
    },
    fallback: {
      imageUrl: '',
      videoUrl: '',
      eyebrow: 'OKARA DISTRICT • PAKISTAN',
      title: 'Find Your Dream Property',
      subtitle: 'Premium homes, plots & commercial spaces across Okara & surroundings',
      cta: 'Explore Now',
      route: '/explore',
    },
  },
  screens: {
    calculator: {
      title: 'Land Calculator',
      subtitle: 'Convert land units and calculate plot areas',
      showUnitConverter: true,
      showPlotArea: true,
      showMoreTools: true,
    },
    help: {
      heroTitle: "We're here to help",
      heroSubtitle: 'OG Landmark support team is available 6 days a week',
      faqs: [
        { q: 'How long does agent verification take?', a: 'Verification typically takes 24–48 hours after you submit your CNIC and contact details.' },
        { q: 'How do I post a property listing?', a: 'Tap the Post an Ad tab, fill in the property details, add photos, and submit.' },
        { q: 'Can I edit or delete my listing after posting?', a: 'Yes. Open the Listings tab, find your listing, then tap Edit or Delete.' },
        { q: 'How do I contact a lead?', a: 'Open the Leads tab and use the Call or WhatsApp buttons to contact the lead.' },
      ],
    },
    onboarding: {
      buyerSlides: [
        { icon: 'home', title: 'Find Your Dream Property', desc: 'Browse verified listings across Okara District tailored to your interest.' },
        { icon: 'trending-up', title: 'Smart Investment Guide', desc: 'Get market insights for better investment decisions.' },
        { icon: 'shield', title: 'Sell or Rent Your Property', desc: 'List your property and reach qualified buyers and renters.' },
      ],
    },
    categories: {
      houses: 'Houses',
      apartments: 'Apartments',
      plots: 'Plots & Land',
      residential: 'Homes & Apartments',
      agriculture: 'Farm & Land',
      commercial: 'Shops & Offices',
      farmhouses: 'Farmhouses',
      industrial: 'Industrial',
      projects: 'Projects',
    },
    navigation: {
      home: 'Home',
      explore: 'Explore',
      postAd: 'Post Ad',
      saved: 'Saved',
      calculator: 'Calculator',
      profile: 'Profile',
      dashboard: 'Dashboard',
      listings: 'Listings',
      projects: 'Projects',
      leads: 'Leads',
      messages: 'Messages',
    },
    profile: {
      title: 'Profile',
      subtitle: 'Manage your account and preferences',
      showRecentlyViewed: true,
      showSavedSearches: true,
    },
    account: {
      eyebrow: 'PROFILE',
      title: 'Account Settings',
      saveLabel: 'Save Changes',
      securityLabel: 'Security & Privacy',
    },
    tools: {
      eyebrow: 'PROPERTY TOOLS',
      title: 'Property Tools',
      subtitle: 'Make better property decisions with practical calculators.',
    },
    portals: {
      agent: {
        title: 'Agent Portal',
        overviewTitle: 'Overview',
        quickActionsTitle: 'Quick Actions',
        recentLeadsTitle: 'Recent Leads',
        viewAllLeads: 'View all leads',
        totalLeadsLabel: 'Total Leads',
        todayVisitsLabel: "Today's Visits",
        upcomingVisitsLabel: 'Upcoming Visits',
        pendingTitle: 'Verification pending',
        pendingSubtitle: 'Your profile is being reviewed by our team.',
        noLeadsTitle: 'No leads yet',
        noLeadsSubtitle: 'Your new inquiries will appear here',
        showOverview: true,
        showQuickActions: true,
        showRecentLeads: true,
        statLabels: {
          activeListings: 'Active Listings',
          totalViews: 'Total Views',
          newLeads: 'New Leads',
          totalLeads: 'Total Leads',
          todayVisits: "Today's Visits",
          upcomingVisits: 'Upcoming Visits',
        },
        statVisibility: {
          activeListings: true,
          totalViews: true,
          newLeads: true,
          totalLeads: true,
          todayVisits: true,
          upcomingVisits: true,
        },
        actionLabels: {
          postProperty: 'Post Property',
          myListings: 'My Listings',
          leads: 'CRM / Leads',
          addLead: 'Add Lead',
          visits: 'Schedule Visit',
          messages: 'Messages',
        },
        actionVisibility: {
          postProperty: true,
          myListings: true,
          leads: true,
          addLead: true,
          visits: true,
          messages: true,
        },
      },
      developer: {
        title: 'Developer Portal',
        companyFallback: 'My Company',
        overviewTitle: 'Overview',
        inventoryTitle: 'Inventory Snapshot',
        financialTitle: 'Financial Overview',
        quickActionsTitle: 'Quick Actions',
        recentProjectsTitle: 'Recent Projects',
        viewAllProjects: 'View all projects',
        promotionLabel: 'Promote your project',
        promotionDescription: 'Reach more buyers with a featured project.',
        noProjectsTitle: 'No projects yet',
        noProjectsDescription: 'Create your first project to start managing inventory.',
        createFirstProject: 'Create your first project',
        showOverview: true,
        showInventory: true,
        showFinancial: true,
        showPromotion: true,
        showQuickActions: true,
        showRecentProjects: true,
        kpiLabels: {
          totalProjects: 'Total Projects',
          activeProjects: 'Active Projects',
          availableUnits: 'Available Units',
          reservedUnits: 'Reserved Units',
          newLeads: 'New Leads',
          siteVisits: 'Site Visits',
        },
        inventoryLabels: {
          total: 'Total',
          available: 'Available',
          reserved: 'Reserved',
          sold: 'Sold',
        },
        financialLabels: {
          totalListed: 'Total Listed Value',
          reserved: 'Reserved Value',
          sold: 'Sold Value',
        },
        actionLabels: {
          createProject: 'Create Project',
          myProjects: 'My Projects',
          projectLeads: 'Project Leads',
          paymentPlans: 'Payment Plans',
          siteVisits: 'Site Visits',
          analytics: 'Analytics',
          team: 'Team',
          documents: 'Documents',
        },
        actionVisibility: {
          createProject: true,
          myProjects: true,
          projectLeads: true,
          paymentPlans: true,
          siteVisits: true,
          analytics: true,
          team: true,
          documents: true,
        },
      },
    },
  },
};

const DEFAULT_MOBILE_SETTINGS = {
  verificationBadgeEnabled: true,
  pushNotificationsEnabled: true,
  darkModeEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: '',
  appVersion: '1.0.0',
  minAppVersion: '1.0.0',
  content: DEFAULT_MOBILE_CONTENT,
};

function mobileSettingsPayload(stored = {}) {
  const storedContent = stored.content || {};
  const storedHomepage = storedContent.homepage || {};
  const storedScreens = storedContent.screens || {};
  const storedPortals = storedScreens.portals || {};
  const mergePortal = (key) => ({
    ...DEFAULT_MOBILE_CONTENT.screens.portals[key],
    ...(storedPortals[key] || {}),
    statLabels: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].statLabels || {}),
      ...(storedPortals[key]?.statLabels || {}),
    },
    statVisibility: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].statVisibility || {}),
      ...(storedPortals[key]?.statVisibility || {}),
    },
    actionLabels: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].actionLabels || {}),
      ...(storedPortals[key]?.actionLabels || {}),
    },
    actionVisibility: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].actionVisibility || {}),
      ...(storedPortals[key]?.actionVisibility || {}),
    },
    kpiLabels: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].kpiLabels || {}),
      ...(storedPortals[key]?.kpiLabels || {}),
    },
    inventoryLabels: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].inventoryLabels || {}),
      ...(storedPortals[key]?.inventoryLabels || {}),
    },
    financialLabels: {
      ...(DEFAULT_MOBILE_CONTENT.screens.portals[key].financialLabels || {}),
      ...(storedPortals[key]?.financialLabels || {}),
    },
  });
  return {
    ...DEFAULT_MOBILE_SETTINGS,
    ...stored,
    content: {
      ...DEFAULT_MOBILE_CONTENT,
      ...storedContent,
      global: {
        ...DEFAULT_MOBILE_CONTENT.global,
        ...(storedContent.global || {}),
        theme: { ...DEFAULT_MOBILE_CONTENT.global.theme, ...(storedContent.global?.theme || {}) },
        screenVisibility: { ...DEFAULT_MOBILE_CONTENT.global.screenVisibility, ...(storedContent.global?.screenVisibility || {}) },
        pushTemplates: Array.isArray(storedContent.global?.pushTemplates)
          ? storedContent.global.pushTemplates
          : DEFAULT_MOBILE_CONTENT.global.pushTemplates,
      },
      homepage: {
        ...DEFAULT_MOBILE_CONTENT.homepage,
        ...storedHomepage,
        sections: { ...DEFAULT_MOBILE_CONTENT.homepage.sections, ...(storedHomepage.sections || {}) },
        browse: { ...DEFAULT_MOBILE_CONTENT.homepage.browse, ...(storedHomepage.browse || {}) },
        carousel: { ...DEFAULT_MOBILE_CONTENT.homepage.carousel, ...(storedHomepage.carousel || {}) },
        theme: { ...DEFAULT_MOBILE_CONTENT.homepage.theme, ...(storedHomepage.theme || {}) },
        fallback: { ...DEFAULT_MOBILE_CONTENT.homepage.fallback, ...(storedHomepage.fallback || {}) },
      },
      screens: {
        ...DEFAULT_MOBILE_CONTENT.screens,
        ...storedScreens,
        calculator: { ...DEFAULT_MOBILE_CONTENT.screens.calculator, ...(storedScreens.calculator || {}) },
        help: { ...DEFAULT_MOBILE_CONTENT.screens.help, ...(storedScreens.help || {}) },
        onboarding: { ...DEFAULT_MOBILE_CONTENT.screens.onboarding, ...(storedScreens.onboarding || {}) },
        categories: { ...DEFAULT_MOBILE_CONTENT.screens.categories, ...(storedScreens.categories || {}) },
        navigation: { ...DEFAULT_MOBILE_CONTENT.screens.navigation, ...(storedScreens.navigation || {}) },
        profile: { ...DEFAULT_MOBILE_CONTENT.screens.profile, ...(storedScreens.profile || {}) },
        account: { ...DEFAULT_MOBILE_CONTENT.screens.account, ...(storedScreens.account || {}) },
        tools: { ...DEFAULT_MOBILE_CONTENT.screens.tools, ...(storedScreens.tools || {}) },
        portals: {
          ...DEFAULT_MOBILE_CONTENT.screens.portals,
          ...storedPortals,
          agent: mergePortal('agent'),
          developer: mergePortal('developer'),
        },
      },
    },
  };
}

app.get('/api/mobile/settings', async (req, res) => {
  try {
    const data = await readData();
    res.json(mobileSettingsPayload(data.mobileSettings));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/mobile/settings', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const current = mobileSettingsPayload(data.mobileSettings);
    const incoming = req.body || {};
    data.mobileSettings = mobileSettingsPayload({
      ...current,
      ...incoming,
      content: {
        ...current.content,
        ...(incoming.content || {}),
        homepage: {
          ...current.content.homepage,
          ...(incoming.content?.homepage || {}),
          sections: { ...current.content.homepage.sections, ...(incoming.content?.homepage?.sections || {}) },
          browse: { ...current.content.homepage.browse, ...(incoming.content?.homepage?.browse || {}) },
          carousel: { ...current.content.homepage.carousel, ...(incoming.content?.homepage?.carousel || {}) },
          theme: { ...current.content.homepage.theme, ...(incoming.content?.homepage?.theme || {}) },
          fallback: { ...current.content.homepage.fallback, ...(incoming.content?.homepage?.fallback || {}) },
        },
        global: {
          ...current.content.global,
          ...(incoming.content?.global || {}),
          theme: { ...current.content.global.theme, ...(incoming.content?.global?.theme || {}) },
          screenVisibility: { ...current.content.global.screenVisibility, ...(incoming.content?.global?.screenVisibility || {}) },
          pushTemplates: Array.isArray(incoming.content?.global?.pushTemplates)
            ? incoming.content.global.pushTemplates
            : current.content.global.pushTemplates,
        },
        screens: {
          ...current.content.screens,
          ...(incoming.content?.screens || {}),
          calculator: { ...current.content.screens.calculator, ...(incoming.content?.screens?.calculator || {}) },
          help: { ...current.content.screens.help, ...(incoming.content?.screens?.help || {}) },
          onboarding: { ...current.content.screens.onboarding, ...(incoming.content?.screens?.onboarding || {}) },
          categories: { ...current.content.screens.categories, ...(incoming.content?.screens?.categories || {}) },
          navigation: { ...current.content.screens.navigation, ...(incoming.content?.screens?.navigation || {}) },
          profile: { ...current.content.screens.profile, ...(incoming.content?.screens?.profile || {}) },
           account: { ...current.content.screens.account, ...(incoming.content?.screens?.account || {}) },
           tools: { ...current.content.screens.tools, ...(incoming.content?.screens?.tools || {}) },
           portals: {
             ...current.content.screens.portals,
             ...(incoming.content?.screens?.portals || {}),
             agent: {
               ...current.content.screens.portals.agent,
               ...(incoming.content?.screens?.portals?.agent || {}),
               statLabels: { ...current.content.screens.portals.agent.statLabels, ...(incoming.content?.screens?.portals?.agent?.statLabels || {}) },
               statVisibility: { ...current.content.screens.portals.agent.statVisibility, ...(incoming.content?.screens?.portals?.agent?.statVisibility || {}) },
               actionLabels: { ...current.content.screens.portals.agent.actionLabels, ...(incoming.content?.screens?.portals?.agent?.actionLabels || {}) },
               actionVisibility: { ...current.content.screens.portals.agent.actionVisibility, ...(incoming.content?.screens?.portals?.agent?.actionVisibility || {}) },
             },
             developer: {
               ...current.content.screens.portals.developer,
               ...(incoming.content?.screens?.portals?.developer || {}),
               kpiLabels: { ...current.content.screens.portals.developer.kpiLabels, ...(incoming.content?.screens?.portals?.developer?.kpiLabels || {}) },
               inventoryLabels: { ...current.content.screens.portals.developer.inventoryLabels, ...(incoming.content?.screens?.portals?.developer?.inventoryLabels || {}) },
               financialLabels: { ...current.content.screens.portals.developer.financialLabels, ...(incoming.content?.screens?.portals?.developer?.financialLabels || {}) },
               actionLabels: { ...current.content.screens.portals.developer.actionLabels, ...(incoming.content?.screens?.portals?.developer?.actionLabels || {}) },
               actionVisibility: { ...current.content.screens.portals.developer.actionVisibility, ...(incoming.content?.screens?.portals?.developer?.actionVisibility || {}) },
             },
           },
        },
      },
    });
    await writeData(data);
    res.json({ success: true, settings: mobileSettingsPayload(data.mobileSettings) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── MOBILE PUSH NOTIFICATIONS (broadcast) ───────────────────────────────────
app.post('/api/mobile/push', requireAdmin, async (req, res) => {
  try {
    const { title, body, data: payload = {} } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    const appData = await readData();
    const created = await createAndDeliverNotifications(
      appData,
      (appData.users || []).map(user => user.id),
      {
        type: payload.type || 'GENERAL_ANNOUNCEMENT',
        category: payload.category || 'announcements',
        title,
        body,
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
        propertyId: payload.propertyId || null,
        deepLink: payload.deepLink || '/notifications',
        priority: payload.priority || 'NORMAL',
        eventKey: `broadcast:${crypto.createHash('sha256').update(`${title}:${body}:${Date.now()}`).digest('hex').slice(0, 20)}`,
      },
    );
    await writeData(appData);
    res.json({ success: true, sent: created.length, totalRecipients: created.length, title, body, sentAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── MOBILE STATS (admin view) ────────────────────────────────────────────────
app.get('/api/mobile/stats', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    const props = data.properties || [];
    const users = data.users || [];
    const reports = data.reports || [];
    const inqs = data.inquiries || [];
    const totalViews = props.reduce((s, p) => s + (p.viewCount || 0), 0);
    const totalSaved = props.reduce((s, p) => s + (p.savedCount || 0), 0);
    res.json({
      totalMobileViews:    totalViews,
      totalSavedCount:     totalSaved,
      totalUsers:          users.length,
      buyerCount:          users.filter(u => u.role === 'Buyer').length,
      sellerCount:         users.filter(u => u.role === 'Seller').length,
      agentCount:          users.filter(u => u.role === 'Agent').length,
      activeListings:      props.filter(p => p.approvalStatus === 'Active').length,
      pendingApprovals:    props.filter(p => p.approvalStatus === 'Pending').length,
      pendingReports:      reports.filter(r => r.status === 'Pending').length,
      totalInquiries:      inqs.length,
      lastUpdated:         new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



function siteUrl(p) {
  const base = (process.env.APP_URL || 'https://oglandmark.com').replace(/\/$/, '');
  return p.startsWith('http') ? p : `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

function resolveImg(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return siteUrl(url.startsWith('/') ? url : '/' + url);
}

// ─── MOBILE BANNER SLIDES ────────────────────────────────────────────────────
app.get('/api/mobile/banners', async (req, res) => {
  try {
    const data = await readData();
    const banners = (data.mobileBanners || [])
      .filter(b => b.active !== false)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    res.json(banners.map(b => ({
      ...b,
      imageUrl: b.imageUrl ? siteUrl(b.imageUrl) : null,
      videoUrl: b.videoUrl ? siteUrl(b.videoUrl) : null,
    })));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/mobile/banners/all', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    res.json((data.mobileBanners || [])
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map(b => ({
      ...b,
      imageUrl: b.imageUrl ? siteUrl(b.imageUrl) : null,
      videoUrl: b.videoUrl ? siteUrl(b.videoUrl) : null,
    })));
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/mobile/banners', requireAdmin, upload.single('media'), async (req, res) => {
  try {
    const data = await readData();
    if (!data.mobileBanners) data.mobileBanners = [];
    const type = req.body.type || 'image';
    const isVideo = type === 'video';
    const filePath = req.file ? `/images/uploads/${req.file.filename}` : null;
    const banner = {
      id: Date.now(), type,
      imageUrl: (!isVideo && filePath) ? filePath : (req.body.imageUrl || null),
      videoUrl: (isVideo && filePath) ? filePath : (req.body.videoUrl || null),
      eyebrow: req.body.eyebrow || '',
      title: req.body.title || '',
      subtitle: req.body.subtitle || '',
      cta: req.body.cta || 'Explore Now',
      route: req.body.route || '/explore',
      ctaParams: req.body.ctaParams ? JSON.parse(req.body.ctaParams) : {},
      active: req.body.active !== 'false',
      order: req.body.order !== undefined ? Number(req.body.order) : data.mobileBanners.length,
      createdAt: new Date().toISOString(),
    };
    data.mobileBanners.push(banner);
    await writeData(data);
    res.json({ success: true, banner: { ...banner, imageUrl: banner.imageUrl ? siteUrl(banner.imageUrl) : null, videoUrl: banner.videoUrl ? siteUrl(banner.videoUrl) : null } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/mobile/banners/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    if (!data.mobileBanners) data.mobileBanners = [];
    const b = data.mobileBanners.find(x => x.id === Number(req.params.id));
    if (!b) return res.status(404).json({ error: 'Banner not found' });
    const incoming = { ...req.body };
    if (incoming.order !== undefined) incoming.order = Number(incoming.order);
    if (typeof incoming.ctaParams === 'string') {
      try { incoming.ctaParams = JSON.parse(incoming.ctaParams); } catch { delete incoming.ctaParams; }
    }
    Object.assign(b, incoming);
    await writeData(data);
    res.json({ success: true, banner: b });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/mobile/banners/:id', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    if (!data.mobileBanners) data.mobileBanners = [];
    const idx = data.mobileBanners.findIndex(x => x.id === Number(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Banner not found' });
    data.mobileBanners.splice(idx, 1);
    await writeData(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/mobile/banners/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const data = await readData();
    if (!data.mobileBanners) data.mobileBanners = [];
    const b = data.mobileBanners.find(x => x.id === Number(req.params.id));
    if (!b) return res.status(404).json({ error: 'Banner not found' });
    b.active = !b.active;
    await writeData(data);
    res.json({ success: true, active: b.active });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: dbReady ? 'ok' : 'degraded',
    database: dbReady ? 'connected' : 'not_connected',
    databaseProvider: neonDb ? 'neon' : (localPreview ? 'local_preview' : 'neon'),
    databaseError: dbReady ? null : (dbInitError ? dbInitError.message : (databaseConfigured ? 'Database initialization is still in progress' : 'DATABASE_URL is missing')),
    smtp: smtpConfigured ? 'configured' : 'not_configured',
    message: dbReady ? 'OG Landmark API running' : 'OG Landmark server is running but the database is not ready',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── CONFIG (public env for frontend) ────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || null });
});

// ─── CAPTCHA VERIFY ────────────────────────────────────────────────────────────
app.post('/api/auth/captcha', async (req, res) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return res.json({ success: true, skipped: true });
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'CAPTCHA token missing' });
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data = await r.json();
    res.json({ success: !!data.success });
  } catch (e) {
    res.status(500).json({ success: false, error: 'CAPTCHA check failed' });
  }
});

// ─── PASSWORD RESET — request code ───────────────────────────────────────────
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const data = await readData();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    // Always respond success to prevent email enumeration
    if (!user || (role && user.role !== role)) {
      return res.json({ success: true });
    }
    const otp = generateOTP();
    await saveChallenge(email.toLowerCase(), 'password-reset', otp, 15);
    let smtpOff = false;
    try {
      const result = await sendPasswordResetEmail(email, otp, user.role);
      smtpOff = Boolean(result && result.fallback);
    } catch (e) {
      smtpOff = true;
      console.error('[Reset email error]', e.message);
    }
    res.json({
      success: !smtpOff,
      smtpOff,
      message: smtpOff
        ? 'Email service is not configured or the SMTP connection failed. Check the Hostinger SMTP settings.'
        : 'Reset code sent. Check your email.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PASSWORD RESET — confirm code + set new password ────────────────────────
app.post('/api/auth/confirm-reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Email, code and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const key = email.toLowerCase();
    const verification = await consumeChallenge(key, 'password-reset', otp);
    if (!verification.ok) return res.status(401).json({ error: verification.reason === 'expired' ? 'Code expired. Please request a new one.' : 'Incorrect code. Please try again.' });
    const data = await readData();
    const user = data.users.find(u => u.email.toLowerCase() === key);
    if (!user) return res.status(404).json({ error: 'Account not found' });
    user.password = hashPassword(newPassword);
    await writeData(data);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Exact mobile account and developer-store contracts ───────────────────────
// These routes deliberately use the field names and array response shapes used
// by the React Native stores. IDs remain strings because mobile-created records
// use stable client IDs such as "proj_…" and "member_…".
const ownDeveloperRecord = (req, item) => req.currentUser.role === 'Admin' ||
  String(item.developerId || item.userId) === String(req.currentUser.id);
const developerAccess = (req, res, next) =>
  ['Developer', 'Admin'].includes(req.currentUser.role) ? next() : res.status(403).json({ error: 'Developer access required.' });
function findRecord(list, id) { return (list || []).find(x => String(x.id) === String(id)); }
function stampedRecord(body, user, idPrefix) {
  const now = new Date().toISOString();
  return { ...body, id: body.id || `${idPrefix}_${crypto.randomBytes(10).toString('hex')}`,
    developerId: body.developerId || String(user.id), userId: body.userId || user.id,
    createdAt: body.createdAt || now, updatedAt: now };
}

app.get('/api/account', requireAuth, async (req, res) => {
  const { password, ...user } = req.currentUser; res.json(user);
});
app.put('/api/account', requireAuth, async (req, res) => {
  const data = await readData(); const user = data.users.find(u => u.id === req.currentUser.id);
  for (const key of ['name', 'phone', 'city', 'agencyName', 'companyName', 'profilePhoto']) if (req.body[key] !== undefined) user[key] = req.body[key];
  await writeData(data); const { password, ...safe } = user; res.json(safe);
});
app.delete('/api/account', requireAuth, async (req, res) => {
  const data = await readData(); const user = data.users.find(u => u.id === req.currentUser.id);
  if (user) { user.status = 'Deleted'; user.email = `deleted-${user.id}-${Date.now()}@invalid.local`; await writeData(data); }
  if (neonDb) {
    try {
      await neonDb`DELETE FROM auth_sessions WHERE user_id = ${req.currentUser.id}`;
    } catch {
      return res.status(500).json({ error: 'Could not clear sessions' });
    }
  }
  res.status(204).end();
});
app.put('/api/account/profile-photo', requireAuth, async (req, res) => {
  if (!req.body.url || typeof req.body.url !== 'string') return res.status(400).json({ error: 'url is required' });
  const data = await readData(); const user = data.users.find(u => u.id === req.currentUser.id);
  user.profilePhoto = req.body.url; user.photo = req.body.url; await writeData(data); res.json({ url: req.body.url });
});
app.get('/api/account/profile-photo', requireAuth, async (req, res) => {
  res.json({ url: req.currentUser.profilePhoto || req.currentUser.photo || null });
});
app.delete('/api/account/profile-photo', requireAuth, async (req, res) => {
  const data = await readData(); const user = data.users.find(u => u.id === req.currentUser.id);
  user.profilePhoto = null; user.photo = null; await writeData(data); res.status(204).end();
});

app.get('/api/saved-searches', requireAuth, async (req, res) => {
  const data = await readData(); res.json((data.savedSearches || []).filter(x => String(x.userId) === String(req.currentUser.id)));
});
app.post('/api/saved-searches', requireAuth, async (req, res) => {
  if (!req.body.label || !req.body.query) return res.status(400).json({ error: 'label and query are required' });
  const data = await readData(); data.savedSearches ||= [];
  const item = { ...req.body, id: `search_${crypto.randomBytes(10).toString('hex')}`, userId: req.currentUser.id, savedAt: new Date().toISOString() };
  data.savedSearches.push(item); await writeData(data); res.status(201).json(item);
});
app.delete('/api/saved-searches', requireAuth, async (req, res) => {
  const data = await readData(); data.savedSearches = (data.savedSearches || []).filter(x => String(x.userId) !== String(req.currentUser.id));
  await writeData(data); res.status(204).end();
});
app.delete('/api/saved-searches/:id', requireAuth, async (req, res) => {
  const data = await readData(); const i = (data.savedSearches || []).findIndex(x => String(x.id) === req.params.id && String(x.userId) === String(req.currentUser.id));
  if (i < 0) return res.status(404).json({ error: 'Not found' }); data.savedSearches.splice(i, 1); await writeData(data); res.status(204).end();
});

function developerCrud(path, key, prefix, extra = {}) {
  app.get(path, requireAuth, developerAccess, async (req, res) => {
    const data = await readData(); res.json((data[key] || []).filter(x => ownDeveloperRecord(req, x)));
  });
  app.post(path, requireAuth, developerAccess, async (req, res) => {
    const data = await readData(); data[key] ||= []; const item = { ...stampedRecord(req.body, req.currentUser, prefix), ...extra(req) };
    data[key].push(item); await writeData(data); res.status(201).json(item);
  });
  app.put(`${path}/:id`, requireAuth, developerAccess, async (req, res) => {
    const data = await readData(); const item = findRecord(data[key], req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' }); if (!ownDeveloperRecord(req, item)) return res.status(403).json({ error: 'Forbidden' });
    const previousStatus = item.status;
    Object.assign(item, req.body, { id: item.id, developerId: item.developerId, updatedAt: new Date().toISOString() });
    if (key === 'developerProjects' && ['Live', 'Approved', 'Coming Soon', 'Under Development'].includes(item.status) && previousStatus !== item.status) {
      await createAndDeliverNotifications(data, usersForProjectAlert(data, item), {
        type: 'NEW_PROJECT', category: 'projects',
        title: `New Project in ${item.city || 'your area'}`,
        body: `${item.name || item.title || 'A new project'} is now available on OG Landmark.`,
        entityType: 'project', entityId: item.id, projectId: item.id,
        imageUrl: item.imageUrl || item.coverImage || item.image || null,
        deepLink: `/project/${item.id}`,
        metadata: { city: item.city, projectType: item.type || item.projectType, startingPrice: item.startingPrice },
        eventKey: `project:${item.id}:published:${item.updatedAt}`,
      });
    }
    await writeData(data); res.json(item);
  });
  app.patch(`${path}/:id`, requireAuth, developerAccess, async (req, res) => {
    const data = await readData(); const item = findRecord(data[key], req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' }); if (!ownDeveloperRecord(req, item)) return res.status(403).json({ error: 'Forbidden' });
    const previousStatus = item.status;
    Object.assign(item, req.body, { id: item.id, developerId: item.developerId, updatedAt: new Date().toISOString() });
    if (key === 'developerProjects' && ['Live', 'Approved', 'Coming Soon', 'Under Development'].includes(item.status) && previousStatus !== item.status) {
      await createAndDeliverNotifications(data, usersForProjectAlert(data, item), {
        type: 'NEW_PROJECT', category: 'projects',
        title: `New Project in ${item.city || 'your area'}`,
        body: `${item.name || item.title || 'A new project'} is now available on OG Landmark.`,
        entityType: 'project', entityId: item.id, projectId: item.id,
        imageUrl: item.imageUrl || item.coverImage || item.image || null,
        deepLink: `/project/${item.id}`,
        metadata: { city: item.city, projectType: item.type || item.projectType, startingPrice: item.startingPrice },
        eventKey: `project:${item.id}:published:${item.updatedAt}`,
      });
    }
    await writeData(data); res.json(item);
  });
  app.delete(`${path}/:id`, requireAuth, developerAccess, async (req, res) => {
    const data = await readData(); const list = data[key] || []; const i = list.findIndex(x => String(x.id) === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' }); if (!ownDeveloperRecord(req, list[i])) return res.status(403).json({ error: 'Forbidden' });
    list.splice(i, 1); await writeData(data); res.status(204).end();
  });
}
developerCrud('/api/developer/projects', 'developerProjects', 'proj');
developerCrud('/api/developer/blocks', 'developerBlocks', 'block');
developerCrud('/api/developer/units', 'developerUnits', 'unit');
developerCrud('/api/developer/leads', 'developerLeads', 'lead');
developerCrud('/api/developer/documents', 'developerDocuments', 'doc');
developerCrud('/api/developer/payment-plans', 'developerPaymentPlans', 'plan');
developerCrud('/api/developer/team', 'developerTeam', 'member');
app.patch('/api/developer/team/:id/active', requireAuth, developerAccess, async (req, res) => {
  const data = await readData(); const item = findRecord(data.developerTeam, req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' }); if (!ownDeveloperRecord(req, item)) return res.status(403).json({ error: 'Forbidden' });
  item.active = !item.active; item.updatedAt = new Date().toISOString(); await writeData(data); res.json(item);
});
app.get('/api/developer/projects/:projectId/blocks', requireAuth, developerAccess, async (req, res) => {
  const data = await readData(); res.json((data.developerBlocks || []).filter(x => String(x.projectId) === req.params.projectId && ownDeveloperRecord(req, x)));
});
app.get('/api/developer/projects/:projectId/units', requireAuth, developerAccess, async (req, res) => {
  const data = await readData(); res.json((data.developerUnits || []).filter(x => String(x.projectId) === req.params.projectId && ownDeveloperRecord(req, x)));
});
app.get('/api/projects', async (req, res) => {
  const data = await readData(); res.json((data.developerProjects || []).filter(p => ['Live', 'Approved', 'Coming Soon', 'Under Development'].includes(p.status)));
});
app.get('/api/projects/:id', async (req, res) => {
  const data = await readData(); const item = findRecord(data.developerProjects, req.params.id);
  if (!item || !['Live', 'Approved', 'Coming Soon', 'Under Development'].includes(item.status)) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});
app.get('/api/developer/projects/:id', requireAuth, async (req, res) => {
  const data = await readData(); const item = findRecord(data.developerProjects, req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (!ownDeveloperRecord(req, item) && !['Live', 'Approved', 'Coming Soon', 'Under Development'].includes(item.status)) return res.status(403).json({ error: 'Forbidden' });
  res.json(item);
});
// Non-developer mobile workflows use these explicit aliases; they keep the
// same document payloads as the equivalent /api/mobile resources.
function personalCrud(path, key, prefix) {
  app.get(path, requireAuth, async (req, res) => { const d = await readData(); res.json((d[key] || []).filter(x => String(x.userId) === String(req.currentUser.id) || req.currentUser.role === 'Admin')); });
  app.post(path, requireAuth, async (req, res) => { const d = await readData(); d[key] ||= []; const item = { ...req.body, id: req.body.id || `${prefix}_${crypto.randomBytes(10).toString('hex')}`, userId: req.currentUser.id, createdAt: new Date().toISOString() }; d[key].push(item); await writeData(d); res.status(201).json(item); });
  app.patch(`${path}/:id`, requireAuth, async (req, res) => { const d = await readData(); const item = findRecord(d[key], req.params.id); if (!item) return res.status(404).json({ error: 'Not found' }); if (String(item.userId) !== String(req.currentUser.id) && req.currentUser.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' }); Object.assign(item, req.body); await writeData(d); res.json(item); });
  app.delete(`${path}/:id`, requireAuth, async (req, res) => { const d = await readData(); const i = (d[key] || []).findIndex(x => String(x.id) === req.params.id); if (i < 0) return res.status(404).json({ error: 'Not found' }); if (String(d[key][i].userId) !== String(req.currentUser.id) && req.currentUser.role !== 'Admin') return res.status(403).json({ error: 'Forbidden' }); d[key].splice(i, 1); await writeData(d); res.status(204).end(); });
}
personalCrud('/api/buyer-requests', 'buyerRequests', 'request');
personalCrud('/api/agent-leads', 'agentLeads', 'agentlead');
personalCrud('/api/agent-visits', 'agentVisits', 'visit');
// Account resources used by the mobile experience.  These are server-side
// counterparts to formerly device-only history and comparison stores.
personalCrud('/api/recent-searches', 'recentSearches', 'recent');
personalCrud('/api/comparisons', 'comparisons', 'comparison');
personalCrud('/api/visit-history', 'visitHistory', 'history');
personalCrud('/api/promotions', 'promotions', 'promotion');
personalCrud('/api/verification-requests', 'verificationRequests', 'verification');
personalCrud('/api/measurements', 'measurements', 'measurement');

// ─── Mobile domain resources ─────────────────────────────────────────────────
// JSON documents retain the mobile clients' flexible payload contracts while
// ownership and admin access are enforced consistently.
const mobileResources = ['saved-searches', 'buyer-requests', 'agent-leads', 'visits',
  'developer-projects', 'inventory-blocks', 'inventory-units', 'developer-leads',
  'developer-team', 'developer-documents', 'payment-plans', 'promotions',
  'verification-requests', 'device-tokens', 'audit-log', 'recent-searches',
  'comparisons', 'visit-history'];
const resourceKey = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function ownsDocument(user, doc) {
  return user.role === 'Admin' || Number(doc.userId || doc.ownerId || doc.agentId || doc.developerId) === Number(user.id);
}
mobileResources.forEach(name => {
  const key = resourceKey(name);
  app.get(`/api/mobile/${name}`, requireAuth, async (req, res) => {
    const data = await readData(); const items = data[key] || [];
    res.json(req.currentUser.role === 'Admin' ? items : items.filter(x => ownsDocument(req.currentUser, x)));
  });
  app.post(`/api/mobile/${name}`, requireAuth, async (req, res) => {
    const data = await readData(); data[key] ||= [];
    const document = { ...req.body, id: nextId(data), userId: req.currentUser.id, createdAt: new Date().toISOString() };
    data[key].push(document); await writeData(data); res.status(201).json(document);
  });
  app.put(`/api/mobile/${name}/:id`, requireAuth, async (req, res) => {
    const data = await readData(); const item = (data[key] || []).find(x => x.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (!ownsDocument(req.currentUser, item)) return res.status(403).json({ error: 'Forbidden' });
    Object.assign(item, req.body, { id: item.id, userId: item.userId }); await writeData(data); res.json(item);
  });
  app.delete(`/api/mobile/${name}/:id`, requireAuth, async (req, res) => {
    const data = await readData(); const list = data[key] || []; const i = list.findIndex(x => x.id === Number(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    if (!ownsDocument(req.currentUser, list[i])) return res.status(403).json({ error: 'Forbidden' });
    list.splice(i, 1); await writeData(data); res.json({ success: true });
  });
});
app.get('/api/mobile/developer-analytics', requireAuth, async (req, res) => {
  const data = await readData();
  if (!['Developer', 'Admin'].includes(req.currentUser.role)) return res.status(403).json({ error: 'Developer access required.' });
  const mine = items => req.currentUser.role === 'Admin' ? (items || []) :
    (items || []).filter(item => ownDeveloperRecord(req, item));
  res.json({ projects: mine(data.developerProjects).length, leads: mine(data.developerLeads).length,
    units: mine(data.developerUnits).length, generatedAt: new Date().toISOString() });
});

// ─── STATIC PAGES (About / Terms / Privacy) ──────────────────────────────────
app.get('/about',          (req, res) => res.sendFile(path.join(__dirname, 'public/pages/about.html')));
app.get('/terms',          (req, res) => res.sendFile(path.join(__dirname, 'public/pages/terms.html')));
app.get('/privacy-policy', (req, res) => res.sendFile(path.join(__dirname, 'public/pages/privacy.html')));
app.get('/privacy',        (req, res) => res.sendFile(path.join(__dirname, 'public/pages/privacy.html')));

// ─── PORTAL LOGIN PAGES (before SPA catch-all) ───────────────────────────────
const publicDir = path.join(__dirname, 'public');
// Helper: force browsers to always fetch the latest HTML, never use cache
const noCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};
app.get('/portal/admin',  (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/admin.html')); });
app.get('/portal/seller', (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/seller.html')); });
app.get('/portal/buyer',  (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/buyer.html')); });
app.get('/portal/agent',  (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/agent.html')); });

// ─── CUSTOM DASHBOARDS (override SPA routes) ─────────────────────────────────
app.get('/seller',   (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/seller-dashboard.html')); });
app.get('/seller/*', (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/seller-dashboard.html')); });

// ─── PREVIEW SHORTCUT (auto-login as test seller → Add Property) ─────────────
app.get('/preview', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  try {
    const data = await readData();
    const user = data.users.find(u => u.email === 'salman@example.com');
    if (!user) return res.redirect('/portal/seller');
    const { password: _, ...safe } = user;
    const token = await createSession(user);
    const userJson = JSON.stringify(safe).replace(/\\/g,'\\\\').replace(/`/g,'\\`');
    noCache(res);
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><script>
localStorage.setItem('og_token','${token}');
localStorage.setItem('og_user',\`${userJson}\`);
window.location.replace('/seller/add-property');
</script></head><body></body></html>`);
  } catch(e) { res.redirect('/portal/seller'); }
});
app.get('/agent',    (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/agent-dashboard.html')); });
app.get('/agent/*',  (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/agent-dashboard.html')); });
app.get('/admin',    (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/admin-dashboard.html')); });
app.get('/admin/*',  (req, res) => { noCache(res); res.sendFile(path.join(publicDir, 'portal/admin-dashboard.html')); });
const buyerDashboard = (req, res) => {
  noCache(res);
  res.sendFile(path.join(publicDir, 'portal/buyer-dashboard.html'));
};
// Keep every buyer dashboard entry point on the same professional dashboard.
// /user remains supported for existing login links and saved bookmarks.
app.get('/user',                    buyerDashboard);
app.get('/user/*',                  buyerDashboard);
app.get('/buyer',                   buyerDashboard);
app.get('/buyer/*',                 buyerDashboard);
app.get('/portal/buyer-dashboard',  buyerDashboard);
app.get('/portal/buyer-dashboard/*', buyerDashboard);

// ─── STATIC FILES (React build) ────────────────────────────────────────────────
if (fs.existsSync(publicDir)) {
  // HTML files — always no-cache so updates are instant
  app.use(express.static(publicDir, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Surrogate-Control', 'no-store');
      } else {
        // JS/CSS assets have hashed filenames — safe to cache long-term
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

// ── Hidden React Bundle Agents API ──────────────────────────────────────────
// Admin can hide the 5 hardcoded React agents from the public website
app.get('/api/settings/hidden-react-agents', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.hiddenReactAgents || []);
  } catch (err) { res.json([]); }
});

app.post('/api/settings/hidden-react-agents', requireAdmin, async (req, res) => {
  try {
    const { name, hidden } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const data = await readData();
    if (!data.hiddenReactAgents) data.hiddenReactAgents = [];
    if (hidden) {
      if (!data.hiddenReactAgents.includes(name)) data.hiddenReactAgents.push(name);
    } else {
      data.hiddenReactAgents = data.hiddenReactAgents.filter(n => n !== name);
    }
    await writeData(data);
    res.json({ success: true, hiddenReactAgents: data.hiddenReactAgents });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ── Dynamic agent profile page for DB agents ─────────────────────────────────
app.get('/agents/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { noCache(res); return res.sendFile(path.join(publicDir, 'index.html')); }
  try {
    const data = await readData();
    const agent = data.users.find(u => u.id === id && u.role === 'Agent' && u.approvalStatus === 'Approved' && u.status === 'Active');
    if (!agent) { noCache(res); return res.sendFile(path.join(publicDir, 'index.html')); }
    const { password: _, ...a } = agent;
    const rating = parseFloat(a.rating) || 4.5;
    const stars = Array.from({length:5},(_,i) =>
      `<span style="color:${i < Math.round(rating) ? '#f59e0b' : '#d1d5db'};font-size:22px">★</span>`
    ).join('');
    const waPhone = (a.phone||'').replace(/\D/g,'');
    const wa = waPhone ? `92${waPhone.startsWith('0') ? waPhone.slice(1) : waPhone}` : '';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${a.name} — OG Landmark Agent</title>
  <link rel="icon" href="/og-logo.png"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b}
    .nav{background:#0B1F3A;padding:14px 24px;display:flex;align-items:center;gap:16px}
    .nav-brand{color:#C8A45A;font-size:18px;font-weight:800}
    .nav-sub{color:#64748b;font-size:10px;letter-spacing:3px;text-transform:uppercase}
    .back{display:inline-flex;align-items:center;gap:6px;color:#64748b;font-size:14px;text-decoration:none;margin:20px 24px;font-weight:500}
    .back:hover{color:#C8A45A}
    .container{max-width:900px;margin:0 auto;padding:0 24px 48px}
    .hero{background:#0B1F3A;border-radius:16px;padding:36px;display:flex;gap:28px;align-items:center;margin-bottom:24px;flex-wrap:wrap}
    .avatar{width:120px;height:120px;border-radius:50%;border:4px solid #C8A45A;overflow:hidden;flex-shrink:0;background:#1e3a5f}
    .avatar img{width:100%;height:100%;object-fit:cover}
    .avatar-init{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:800;color:#C8A45A}
    .hero-info h1{color:#fff;font-size:26px;font-weight:800;margin-bottom:4px}
    .hero-info .role{color:#C8A45A;font-size:14px;margin-bottom:8px}
    .hero-info .meta{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:#94a3b8;margin-top:10px}
    .hero-info .meta span{display:flex;align-items:center;gap:5px}
    .grid2{display:grid;grid-template-columns:2fr 1fr;gap:20px}
    .card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px}
    .card h3{font-size:14px;font-weight:700;margin-bottom:14px;color:#0B1F3A;padding-bottom:10px;border-bottom:1px solid #f1f5f9}
    .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .di{font-size:13px}.dl{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}.dv{font-weight:600;color:#1e293b}
    .bio{font-size:14px;color:#475569;line-height:1.8}
    .cta{background:#0B1F3A;border-radius:12px;padding:24px;text-align:center}
    .cta h3{color:#C8A45A;font-size:16px;margin-bottom:8px}
    .cta p{font-size:13px;color:#94a3b8;margin-bottom:16px}
    .btn{display:block;width:100%;padding:13px;background:#C8A45A;color:#0B1F3A;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;text-align:center;transition:.2s;margin-bottom:8px}
    .btn:hover{background:#b8943a}
    .btn-out{background:transparent;border:2px solid #C8A45A;color:#C8A45A}
    .btn-out:hover{background:#C8A45A;color:#0B1F3A}
    @media(max-width:700px){.hero{flex-direction:column;text-align:center}.grid2{grid-template-columns:1fr}.detail-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
<nav class="nav">
  <a href="/"><img src="/og-logo.png" width="36" height="36" style="object-fit:contain;border-radius:6px" onerror="this.style.display='none'" alt=""/></a>
  <div><div class="nav-brand">OG Landmark</div><div class="nav-sub">Premium Real Estate</div></div>
  <a href="/agents" style="margin-left:auto;color:#C8A45A;font-size:13px;font-weight:600;text-decoration:none">← All Agents</a>
</nav>
<a href="/agents" class="back">← Back to Agents</a>
<div class="container">
  <div class="hero">
    <div class="avatar">
      ${a.photo
        ? `<img src="${a.photo}" alt="${a.name}" onerror="this.style.display='none';this.nextSibling.style.display='flex'"/><div class="avatar-init" style="display:none">${(a.name||'A').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>`
        : `<div class="avatar-init">${(a.name||'A').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>`}
    </div>
    <div class="hero-info">
      <h1>${a.name}</h1>
      <div class="role">${a.title || a.specialization || 'Property Consultant'}</div>
      <div style="margin:6px 0">${stars}<span style="color:#94a3b8;font-size:13px;margin-left:8px">${rating}/5</span></div>
      <div class="meta">
        ${a.city ? `<span>📍 ${a.city}</span>` : ''}
        ${a.experience ? `<span>⏱ ${a.experience}</span>` : ''}
        ${a.languages ? `<span>🌐 ${a.languages}</span>` : ''}
      </div>
    </div>
  </div>

  <div class="grid2">
    <div>
      ${a.bio ? `<div class="card"><h3>About ${a.name}</h3><p class="bio">${a.bio}</p></div>` : ''}
      <div class="card">
        <h3>Agent Details</h3>
        <div class="detail-grid">
          ${a.specialization ? `<div class="di"><div class="dl">Specialization</div><div class="dv">${a.specialization}</div></div>` : ''}
          ${a.experience ? `<div class="di"><div class="dl">Experience</div><div class="dv">${a.experience}</div></div>` : ''}
          ${a.city ? `<div class="di"><div class="dl">City</div><div class="dv">${a.city}</div></div>` : ''}
          ${a.license ? `<div class="di"><div class="dl">License</div><div class="dv">${a.license}</div></div>` : ''}
          ${a.languages ? `<div class="di"><div class="dl">Languages</div><div class="dv">${a.languages}</div></div>` : ''}
          ${a.joinedDate ? `<div class="di"><div class="dl">Member Since</div><div class="dv">${new Date(a.joinedDate).toLocaleDateString('en-US',{year:'numeric',month:'long'})}</div></div>` : ''}
        </div>
      </div>
    </div>
    <div>
      <div class="cta">
        <h3>Contact ${a.name}</h3>
        <p>Get in touch for property inquiries and consultations.</p>
        ${a.phone ? `<a href="tel:${a.phone}" class="btn">📞 ${a.phone}</a>` : ''}
        ${wa ? `<a href="https://wa.me/${wa}?text=${encodeURIComponent('Hi '+a.name+', I found your profile on OG Landmark and would like to discuss a property.')}" class="btn btn-out" target="_blank">💬 WhatsApp</a>` : ''}
        ${a.email ? `<a href="mailto:${a.email}" class="btn btn-out" style="margin-bottom:0">✉ Email</a>` : ''}
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Quick Info</h3>
        <div style="font-size:13px;display:flex;flex-direction:column;gap:8px">
          ${a.phone ? `<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">Phone</span><span style="font-weight:600">${a.phone}</span></div>` : ''}
          ${a.email ? `<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">Email</span><a href="mailto:${a.email}" style="font-weight:600;color:#1e293b;text-decoration:none">${a.email}</a></div>` : ''}
          <div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">Rating</span><span style="font-weight:600;color:#f59e0b">★ ${rating}/5</span></div>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
    noCache(res);
    res.send(html);
  } catch (err) {
    console.error('Agent detail error:', err.message);
    noCache(res);
    res.sendFile(path.join(publicDir, 'index.html'));
  }
});

// Redirect React SPA's built-in /sell wizard → our full-featured seller portal
app.get('/sell', (req, res) => res.redirect('/seller'));

// ── Dynamic property detail page for DB-added properties (ID ≥ 1000) ──────────
// React bundle only knows hardcoded IDs 1-999; IDs 1000+ come from the DB.
app.get('/properties/:id', async (req, res) => {
  const id = Number(req.params.id);
  // Let React handle its own hardcoded IDs (< 1000)
  if (isNaN(id) || id < 1000) {
    noCache(res);
    return res.sendFile(path.join(publicDir, 'index.html'));
  }
  try {
    const data = await readData();
    const prop = data.properties.find(p => p.id === id && p.approvalStatus === 'Active');
    if (!prop) {
      noCache(res);
      return res.sendFile(path.join(publicDir, 'index.html'));
    }
    const fmtPrice = p => {
      if (!p) return 'PKR —';
      if (p >= 10000000) return 'PKR ' + (p / 10000000).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
      if (p >= 100000)   return 'PKR ' + (p / 100000).toFixed(0) + ' Lac';
      return 'PKR ' + p.toLocaleString();
    };
    const images = prop.images && prop.images.length ? prop.images : ['/images/property-1.jpg'];
    const amenities = Array.isArray(prop.amenities)
      ? prop.amenities
      : (prop.amenities ? String(prop.amenities).split(',').map(a=>a.trim()).filter(Boolean) : []);
    const di = (label, val) => val ? `<div class="detail-item"><div class="detail-label">${label}</div><div class="detail-val">${val}</div></div>` : '';
    let ytEmbed = '';
    if (prop.videoUrl) {
      const m = prop.videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
      if (m) ytEmbed = m[1];
    }
    // Agent lookup. Admin assignments are stored as a snapshot on the
    // property so a manually entered or city-agent contact remains stable
    // even when the agent directory changes. Fall back to the legacy
    // agentId directory for older listings.
    const assignedAgent = prop.assignedAgent && prop.assignedAgent.name
      ? {
          ...prop.assignedAgent,
          title: prop.assignedAgent.title || 'Property Consultant',
          id: prop.assignedAgent.id || null,
        }
      : null;
    const agent = assignedAgent || (prop.agentId
      ? (data.agents || []).find(a => a.id === prop.agentId && a.approvalStatus === 'Approved')
      : null);
    // Similar properties (same type or city, max 3, exclude self)
    const similar = data.properties
      .filter(p => p.id !== prop.id && p.approvalStatus === 'Active' && (p.type === prop.type || p.city === prop.city))
      .slice(0, 3);
    const listedDate = prop.createdAt ? new Date(prop.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : '';
    const isRent = (prop.purpose||'').toLowerCase().includes('rent');
    const waMsg = encodeURIComponent("I'm interested in: " + prop.title + " (ID #" + prop.id + ")");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${prop.title} — OG Landmark</title>
  <link rel="icon" href="/og-logo.png"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b}
    a{text-decoration:none}
    /* NAV */
    .nav{background:#0B1F3A;padding:14px 28px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:100}
    .nav-brand{color:#C8A45A;font-size:17px;font-weight:800;letter-spacing:.4px}
    .nav-sub{color:#94a3b8;font-size:9px;letter-spacing:3px;text-transform:uppercase}
    /* BREADCRUMB */
    .breadcrumb{font-size:12px;color:#64748b;padding:14px 28px 0;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .breadcrumb a{color:#64748b}.breadcrumb a:hover{color:#C8A45A}
    .breadcrumb span{color:#94a3b8}
    /* TABS */
    .tabs{display:flex;gap:0;border-bottom:2px solid #e2e8f0;margin:12px 28px 0;max-width:1100px;margin-left:auto;margin-right:auto}
    .tab{padding:10px 20px;font-size:13px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:.2s}
    .tab.active{color:#0B1F3A;border-bottom-color:#C8A45A}
    /* CONTAINER */
    .container{max-width:1100px;margin:0 auto;padding:16px 28px 60px}
    /* GALLERY */
    .gallery-wrap{border-radius:14px;overflow:hidden;margin-bottom:12px}
    .gallery-main-img{width:100%;height:460px;object-fit:cover;display:block;cursor:pointer;transition:.3s}
    .thumbs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
    .thumb{width:90px;height:66px;border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid transparent;transition:.2s;opacity:.75}
    .thumb.active,.thumb:hover{border-color:#C8A45A;opacity:1}
    /* BADGES */
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700}
    .badge-sale{background:#dbeafe;color:#2563eb}
    .badge-rent{background:#dcfce7;color:#16a34a}
    .badge-priority{background:#ede9fe;color:#7c3aed}
    .badge-featured{background:#fef9c3;color:#ca8a04}
    .badge-type{background:#f1f5f9;color:#475569}
    /* HERO */
    .hero-title{font-size:26px;font-weight:800;color:#0B1F3A;line-height:1.3;margin-bottom:4px}
    .hero-loc{font-size:13px;color:#64748b;display:flex;align-items:center;gap:5px;margin-bottom:8px}
    .price{font-size:34px;font-weight:900;color:#C8A45A;margin:6px 0 14px}
    /* STATS BOXES */
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
    .stat-box{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 10px;text-align:center}
    .stat-icon{font-size:20px;margin-bottom:6px}
    .stat-val{font-size:18px;font-weight:800;color:#0B1F3A}
    .stat-lbl{font-size:11px;color:#94a3b8;margin-top:2px}
    /* GRID */
    .grid2{display:grid;grid-template-columns:2fr 1fr;gap:20px}
    /* CARD */
    .card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:16px}
    .card-title{font-size:15px;font-weight:700;color:#0B1F3A;padding-bottom:12px;border-bottom:1px solid #f1f5f9;margin-bottom:14px}
    /* DETAIL GRID */
    .det-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .det-item .det-lbl{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
    .det-item .det-val{font-size:13px;font-weight:600;color:#1e293b}
    /* DESCRIPTION */
    .desc-text{font-size:14px;color:#475569;line-height:1.8;white-space:pre-wrap}
    /* AMENITIES */
    .amen-list{display:flex;flex-wrap:wrap;gap:8px}
    .amen-tag{background:#f1f5f9;color:#334155;font-size:12px;padding:5px 14px;border-radius:999px;font-weight:500}
    /* MAP */
    .map-wrap{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0}
    .map-addr{font-size:12px;color:#64748b;margin-top:8px;display:flex;align-items:center;gap:5px}
    /* VIDEO */
    .yt-wrap{position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;margin-bottom:16px}
    .yt-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
    /* INQUIRY FORM */
    .form-group{margin-bottom:12px}
    .form-group label{display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px}
    .form-group input,.form-group textarea{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;color:#1e293b;outline:none;transition:.2s}
    .form-group input:focus,.form-group textarea:focus{border-color:#C8A45A;box-shadow:0 0 0 3px rgba(200,164,90,.12)}
    .form-group textarea{resize:vertical;min-height:80px}
    .btn-inq{width:100%;padding:13px;background:#0B1F3A;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:.2s}
    .btn-inq:hover{background:#1a3356}
    .btn-inq:disabled{opacity:.6;cursor:not-allowed}
    /* FEATURE CARDS */
    .feat-card{background:linear-gradient(135deg,#0B1F3A,#1a3356);color:#fff;border-radius:12px;padding:16px;margin-bottom:12px}
    .feat-badge{font-size:9px;font-weight:800;letter-spacing:1px;color:#C8A45A;text-transform:uppercase;margin-bottom:6px}
    .feat-title{font-size:14px;font-weight:700;margin-bottom:4px}
    .feat-desc{font-size:12px;color:#94a3b8;margin-bottom:12px;line-height:1.5}
    .feat-btn{display:block;width:100%;padding:10px;background:#C8A45A;color:#0B1F3A;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;transition:.2s}
    .feat-btn:hover{background:#b8943a}
    /* AGENT CARD */
    .agent-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center}
    .agent-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;margin:0 auto 10px;display:block;border:3px solid #C8A45A}
    .agent-initials{width:72px;height:72px;border-radius:50%;background:#0B1F3A;color:#C8A45A;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;border:3px solid #C8A45A}
    .agent-name{font-size:15px;font-weight:700;color:#0B1F3A}
    .agent-role{font-size:12px;color:#94a3b8;margin-bottom:8px}
    .agent-stars{color:#C8A45A;font-size:14px;margin-bottom:10px}
    .agent-contact{font-size:12px;color:#475569;margin-bottom:4px;display:flex;align-items:center;justify-content:center;gap:5px}
    .agent-btns{display:flex;gap:8px;margin-top:12px}
    .btn-agent{flex:1;padding:9px 4px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit;transition:.2s}
    .btn-agent-prim{background:#0B1F3A;color:#fff}.btn-agent-prim:hover{background:#1a3356}
    .btn-agent-sec{background:#fff;color:#0B1F3A;border:1.5px solid #e2e8f0}.btn-agent-sec:hover{border-color:#C8A45A;color:#C8A45A}
    /* REVIEWS */
    .reviews-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px}
    .review-score{font-size:48px;font-weight:900;color:#1e293b;line-height:1}
    .review-stars{color:#C8A45A;font-size:20px}
    .review-count{font-size:13px;color:#94a3b8;margin-top:4px}
    .rating-row{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;color:#64748b}
    .rating-bar-bg{flex:1;height:6px;background:#f1f5f9;border-radius:3px}
    .rating-bar-fill{height:6px;background:#C8A45A;border-radius:3px;width:0%}
    .write-review-btn{padding:8px 18px;background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
    .write-review-btn:hover{border-color:#C8A45A}
    /* SIMILAR */
    .similar-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px}
    .sim-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;cursor:pointer;transition:.25s}
    .sim-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-3px)}
    .sim-img{width:100%;height:160px;object-fit:cover}
    .sim-body{padding:12px}
    .sim-type{font-size:11px;color:#64748b;font-weight:600;margin-bottom:3px}
    .sim-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .sim-price{font-size:16px;font-weight:800;color:#C8A45A}
    /* OFFER/VISIT CARDS */
    .action-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}
    .action-card h4{font-size:14px;font-weight:700;color:#0B1F3A;margin-bottom:4px}
    .action-card p{font-size:12px;color:#64748b;margin-bottom:12px;line-height:1.5}
    .btn-action{display:block;width:100%;padding:11px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;border:none;transition:.2s}
    .btn-action-gold{background:#C8A45A;color:#0B1F3A}.btn-action-gold:hover{background:#b8943a}
    .btn-action-dark{background:#0B1F3A;color:#fff}.btn-action-dark:hover{background:#1a3356}
    /* LIGHTBOX */
    #lb{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;align-items:center;justify-content:center}
    #lb.open{display:flex}
    #lb img{max-width:92vw;max-height:90vh;border-radius:8px;object-fit:contain}
    #lb-close{position:fixed;top:16px;right:20px;color:#fff;font-size:32px;cursor:pointer;line-height:1;z-index:10000}
    /* RESPONSIVE */
    @media(max-width:900px){.grid2{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.similar-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:600px){.gallery-main-img{height:260px}.price{font-size:26px}.stats{grid-template-columns:repeat(2,1fr)}.similar-grid{grid-template-columns:1fr}.hero-title{font-size:20px}.tabs,.breadcrumb{margin-left:16px;margin-right:16px}.container{padding:12px 16px 40px}}
  </style>
</head>
<body>

<!-- NAV -->
<nav class="nav">
  <a href="/"><img src="/og-logo.png" onerror="this.style.display='none'" alt="" style="width:36px;height:36px;object-fit:contain"/></a>
  <div>
    <div class="nav-brand">OG Landmark</div>
    <div class="nav-sub">Premium Real Estate</div>
  </div>
  <a href="/properties" style="margin-left:auto;color:#C8A45A;font-size:13px;font-weight:600">← All Properties</a>
</nav>

<!-- BREADCRUMB -->
<div class="breadcrumb">
  <a href="/">Home</a><span>/</span>
  <a href="/properties">Properties</a><span>/</span>
  <span style="color:#1e293b;font-weight:500">${prop.title}</span>
</div>

<!-- TABS -->
<div style="max-width:1100px;margin:12px auto 0;padding:0 28px">
  <div style="display:flex;gap:0;border-bottom:2px solid #e2e8f0">
    <div class="tab active">🖼 Images</div>
    ${prop.tour360Url ? `<a href="${prop.tour360Url}" target="_blank" class="tab">🔄 360° Tour</a>` : `<div class="tab" style="opacity:.5;cursor:default">🔄 360° Tour</div>`}
  </div>
</div>

<!-- LIGHTBOX -->
<div id="lb"><span id="lb-close" onclick="document.getElementById('lb').classList.remove('open')">✕</span><img id="lb-img" src="" alt=""/></div>

<div class="container">
  <!-- GALLERY -->
  <div class="gallery-wrap">
    <img id="mainImg" class="gallery-main-img" src="${images[0]}" onerror="this.src='/images/property-1.jpg'" alt="${prop.title}" onclick="openLb(this.src)"/>
  </div>
  <div class="thumbs">
    ${images.map((img,i) => `<img class="thumb${i===0?' active':''}" src="${img}" onerror="this.src='/images/property-1.jpg'" alt="" onclick="switchImg(this,'${img}')"/>`).join('')}
  </div>

  <!-- BADGES + HERO -->
  <div class="badges">
    ${prop.priority ? '<span class="badge badge-priority">🔝 Priority</span>' : ''}
    ${prop.featured ? '<span class="badge badge-featured">⭐ Featured</span>' : ''}
    <span class="badge ${isRent ? 'badge-rent' : 'badge-sale'}">${prop.purpose || 'For Sale'}</span>
    ${prop.type ? `<span class="badge badge-type">${prop.type}</span>` : ''}
  </div>
  <h1 class="hero-title">${prop.title}</h1>
  ${prop.address || prop.city ? `<p class="hero-loc">📍 ${[prop.address, prop.city].filter(Boolean).join(', ')}</p>` : ''}
  <div class="price">${fmtPrice(prop.price)}</div>

  <!-- STATS -->
  <div class="stats">
    ${prop.bedrooms ? `<div class="stat-box"><div class="stat-icon">🛏</div><div class="stat-val">${prop.bedrooms}</div><div class="stat-lbl">Bedrooms</div></div>` : ''}
    ${prop.bathrooms ? `<div class="stat-box"><div class="stat-icon">🚿</div><div class="stat-val">${prop.bathrooms}</div><div class="stat-lbl">Bathrooms</div></div>` : ''}
    ${prop.area ? `<div class="stat-box"><div class="stat-icon">📐</div><div class="stat-val">${Number(prop.area).toLocaleString()}</div><div class="stat-lbl">${prop.areaUnit || 'sqft'} Area</div></div>` : ''}
    ${prop.type ? `<div class="stat-box"><div class="stat-icon">🏠</div><div class="stat-val" style="font-size:14px">${prop.type}</div><div class="stat-lbl">Type</div></div>` : ''}
  </div>

  <!-- 2-COLUMN GRID -->
  <div class="grid2">
    <!-- LEFT COLUMN -->
    <div>
      ${ytEmbed ? `<div class="yt-wrap"><iframe src="https://www.youtube.com/embed/${ytEmbed}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>` : ''}

      <!-- Description -->
      ${prop.description ? `<div class="card"><div class="card-title">📝 Description</div><p class="desc-text">${prop.description}</p></div>` : ''}

      <!-- Property Details -->
      <div class="card">
        <div class="card-title">🏠 Property Details</div>
        <div class="det-grid">
          ${di('Property Type', prop.type)}
          ${di('Status', prop.purpose || prop.status)}
          ${di('Price', fmtPrice(prop.price))}
          ${di('Area', prop.area ? Number(prop.area).toLocaleString() + ' ' + (prop.areaUnit || 'sqft') : '')}
          ${di('Year Built', prop.yearBuilt)}
          ${di('Listed', listedDate)}
          ${di('Furnishing', prop.furnishing)}
          ${di('Availability', prop.availability)}
          ${di('Society / Area', prop.society)}
          ${di('Block', prop.block)}
          ${di('Full Address', prop.address)}
          ${di('City', prop.city)}
        </div>
      </div>

      <!-- Amenities -->
      ${amenities.length ? `<div class="card"><div class="card-title">✅ Amenities & Features</div><div class="amen-list">${amenities.map(a => `<span class="amen-tag">✓ ${a.trim()}</span>`).join('')}</div></div>` : ''}

      <!-- Agriculture Details -->
      ${(prop.soilType || prop.waterSource || prop.mainCrop || prop.landUse || prop.irrigation) ? `<div class="card"><div class="card-title">🌾 Agriculture Details</div><div class="det-grid">${di('Soil Type',prop.soilType)}${di('Water Source',prop.waterSource)}${di('Main Crop',prop.mainCrop)}${di('Land Use',prop.landUse)}${di('Irrigation',prop.irrigation)}</div></div>` : ''}

      <!-- Location & Map -->
      <div class="card">
        <div class="card-title">📍 Location</div>
        <div class="map-wrap">
          <iframe
            src="https://maps.google.com/maps?q=${encodeURIComponent((prop.address||'') + ' ' + (prop.city||'') + ' Pakistan')}&output=embed&z=14"
            width="100%" height="280" style="border:0" allowfullscreen loading="lazy"></iframe>
        </div>
        ${prop.address || prop.city ? `<p class="map-addr">📍 ${[prop.address, prop.city, 'Pakistan'].filter(Boolean).join(', ')}<a href="https://maps.google.com/?q=${encodeURIComponent((prop.address||'')+' '+(prop.city||'')+' Pakistan')}" target="_blank" style="margin-left:8px;color:#C8A45A;font-size:11px;font-weight:600">Open in Maps ↗</a></p>` : ''}
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div>
      <!-- Send Inquiry Form -->
      <div class="card">
        <div class="card-title">✉ Send Inquiry</div>
        <div id="inq-success" style="display:none;background:#dcfce7;color:#16a34a;padding:12px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;margin-bottom:12px">✅ Inquiry sent! We'll contact you soon.</div>
        <form id="inqForm" onsubmit="sendInquiry(event)">
          <div class="form-group"><label>Name</label><input type="text" id="inq-name" placeholder="Your full name" required/></div>
          <div class="form-group"><label>Email</label><input type="email" id="inq-email" placeholder="your@email.com" required/></div>
          <div class="form-group"><label>Phone</label><input type="tel" id="inq-phone" placeholder="+92 300 0000000"/></div>
          <div class="form-group"><label>Message</label><textarea id="inq-msg" placeholder="I'm interested in this property...">I'm interested in this property. Please contact me with more details.</textarea></div>
          <button type="submit" class="btn-inq" id="inqBtn">Send Inquiry</button>
        </form>
      </div>

      <!-- 3D Digital Twin -->
      <div class="feat-card">
        <div class="feat-badge">🏗 3D Feature</div>
        <div class="feat-title">OG Landmark Digital Twin™</div>
        <div class="feat-desc">Walk through a fully interactive 3D model — change lighting, seasons, weather, furniture, and renovation previews in real time.</div>
        <button class="feat-btn" onclick="alert('Coming Soon!')">⚡ Explore Digital Twin</button>
      </div>

      <!-- AI Simulator -->
      <div class="feat-card">
        <div class="feat-badge">🤖 AI Feature</div>
        <div class="feat-title">OG Landmark Future Life Simulator™</div>
        <div class="feat-desc">Get an AI-powered preview — lifestyle scores, daily life narrative, commute insights, monthly costs, and investment outlook.</div>
        <button class="feat-btn" onclick="alert('Coming Soon!')">🌟 Experience Your Future Here</button>
      </div>

      <!-- Make an Offer -->
      <div class="action-card">
        <h4>💰 Make an Offer</h4>
        <p>Submit a direct offer to the seller. Your offer will be tracked in your buyer dashboard.</p>
        <a href="https://wa.me/923042569000?text=${waMsg}" target="_blank" class="btn-action btn-action-dark">🤝 Make an Offer</a>
      </div>

      <!-- Schedule Visit -->
      <div class="action-card">
        <h4>📅 Schedule a Visit</h4>
        <p>Want to see it in person or via video call? Book a tour with our agent.</p>
        <a href="https://wa.me/923042569000?text=${encodeURIComponent('I want to schedule a visit for: ' + prop.title)}" target="_blank" class="btn-action btn-action-gold">📅 Book a Tour</a>
      </div>

      <!-- Agent Card -->
      ${agent ? `
      <div class="agent-card">
        ${agent.photo ? `<img class="agent-avatar" src="${agent.photo}" onerror="this.style.display='none'" alt="${agent.name}"/>` : `<div class="agent-initials">${agent.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>`}
        <div class="agent-name">${agent.name}</div>
        <div class="agent-role">${agent.title || agent.specialization || 'Property Agent'}</div>
        <div class="agent-stars">${'★'.repeat(Math.round(agent.rating||5))}</div>
        ${agent.phone ? `<div class="agent-contact">📞 ${agent.phone}</div>` : ''}
        ${agent.email ? `<div class="agent-contact">✉ ${agent.email}</div>` : ''}
        <div class="agent-btns">
          ${agent.id ? `<button class="btn-agent btn-agent-prim" onclick="window.location.href='/agents/${agent.id}'">View Profile</button>` : ''}
          <a href="tel:${(agent.phone||'').replace(/\s/g,'')}" class="btn-agent btn-agent-sec" style="display:flex;align-items:center;justify-content:center">📞 Contact</a>
        </div>
      </div>` : ''}
    </div>
  </div>

  <!-- REVIEWS & RATINGS -->
  <div class="reviews-wrap">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <h3 style="font-size:17px;font-weight:700;color:#0B1F3A">Reviews &amp; Ratings</h3>
      <button class="write-review-btn" onclick="alert('Login to write a review')">✏ Write a Review</button>
    </div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:start">
      <div style="text-align:center">
        <div class="review-score">5.0</div>
        <div class="review-stars">★★★★★</div>
        <div class="review-count">0 reviews</div>
      </div>
      <div>
        ${[5,4,3,2,1].map(s=>`<div class="rating-row"><span style="min-width:14px">${s}★</span><div class="rating-bar-bg"><div class="rating-bar-fill"></div></div><span>0</span></div>`).join('')}
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:13px;margin-top:20px;padding:20px;border-top:1px solid #f1f5f9">No reviews yet for this property. Be the first to write one!</p>
  </div>

  <!-- SIMILAR PROPERTIES -->
  ${similar.length ? `
  <div>
    <h3 style="font-size:17px;font-weight:700;color:#0B1F3A;margin-bottom:4px">Similar Properties</h3>
    <p style="font-size:13px;color:#94a3b8;margin-bottom:0">You may also like these properties</p>
    <div class="similar-grid">
      ${similar.map(s => {
        const sImg = s.images && s.images[0] ? s.images[0] : '/images/property-1.jpg';
        return `<div class="sim-card" onclick="window.location.href='/properties/${s.id}'">
          <img class="sim-img" src="${sImg}" onerror="this.src='/images/property-1.jpg'" alt="${s.title}"/>
          <div class="sim-body">
            <div class="sim-type">${s.type||'Property'} · ${s.city||'Pakistan'}</div>
            <div class="sim-title">${s.title}</div>
            <div class="sim-price">${fmtPrice(s.price)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}
</div>

<script>
  // Gallery switch
  function switchImg(thumb, src){
    document.getElementById('mainImg').src=src;
    document.querySelectorAll('.thumb').forEach(t=>t.classList.remove('active'));
    thumb.classList.add('active');
  }
  // Lightbox
  function openLb(src){
    document.getElementById('lb-img').src=src;
    document.getElementById('lb').classList.add('open');
  }
  document.getElementById('lb').addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});
  // Inquiry form
  async function sendInquiry(e){
    e.preventDefault();
    var btn=document.getElementById('inqBtn');
    btn.disabled=true; btn.textContent='Sending...';
    try{
      const r=await fetch('/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        name:document.getElementById('inq-name').value,
        email:document.getElementById('inq-email').value,
        phone:document.getElementById('inq-phone').value,
        message:document.getElementById('inq-msg').value,
        propertyId:${prop.id},
        propertyTitle:'${prop.title.replace(/'/g,"\\'")}',
      })});
      if(r.ok){
        document.getElementById('inq-success').style.display='block';
        document.getElementById('inqForm').style.display='none';
      } else { btn.disabled=false; btn.textContent='Send Inquiry'; alert('Failed to send. Please try again.'); }
    }catch(err){ btn.disabled=false; btn.textContent='Send Inquiry'; alert('Network error. Please try again.'); }
  }
</script>
</body>
</html>`;
    noCache(res);
    res.send(html);
  } catch (err) {
    console.error('Property detail error:', err.message);
    noCache(res);
    res.sendFile(path.join(publicDir, 'index.html'));
  }
});

// All non-API routes → React app (SPA routing)
app.get('*', (req, res) => {
  const indexFile = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    noCache(res);
    res.sendFile(indexFile);
  } else {
    res.json({
      message: 'OG Landmark API Server is running.',
      hint: 'Place the React build files in the /public folder.',
      api: `${(process.env.APP_URL||'https://oglandmark.com').replace(/\/$/,'')}/api/health`,
    });
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
// Listen before database initialization so Hostinger's health check never
// times out while Neon is unreachable. Database-backed routes remain guarded
// until initDb succeeds, and the exact failure is visible in the app log.
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`OG Landmark listening on ${PORT}`);
  setInterval(processScheduledAnnouncements, 30_000);
  verifySmtpConnection();
  initDb()
    .then(() => {
      dbReady = true;
      dbInitError = null;
      console.log('OG Landmark database ready');
    })
    .catch(err => {
      dbInitError = err;
      console.error(`Database initialization failed: ${err.message}`);
    });
});
const close = () => server.close(() => process.exit(0));
process.once('SIGTERM', close);
process.once('SIGINT', close);
