require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 5;

// ── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Email Transporter (Ethereal auto-config) ───────────
let transporter = null;
let etherealAccount = null;

async function getTransporter() {
  if (transporter) return transporter;

  // If SMTP creds are provided in .env, use them
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false }, // dev only — allows self-signed / clock-skewed certs
    });
    console.log(`✉️  Using configured SMTP: ${process.env.SMTP_HOST}`);
    return transporter;
  }

  // Otherwise, try to auto-create an Ethereal test account
  try {
    etherealAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
    });

    console.log('──────────────────────────────────────────');
    console.log('✉️  ETHEREAL TEST EMAIL ACCOUNT');
    console.log(`   User: ${etherealAccount.user}`);
    console.log(`   Pass: ${etherealAccount.pass}`);
    console.log('   View sent emails at: https://ethereal.email/login');
    console.log('──────────────────────────────────────────');
  } catch (err) {
    console.log('──────────────────────────────────────────');
    console.log('⚠️  Could not create Ethereal account (no internet?)');
    console.log('   OTP codes will be printed to console only.');
    console.log('   To enable email, set SMTP_* vars in .env');
    console.log('──────────────────────────────────────────');
    // Create a null transporter — sendOTPEmail will handle it
    transporter = null;
  }

  return transporter;
}

// ── Helpers ────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

async function sendOTPEmail(email, otp) {
  const transport = await getTransporter();

  // Always log OTP to console for dev convenience
  console.log(`\n🔑 OTP for ${email}: ${otp}\n`);

  if (!transport) {
    // Offline mode — no email sent, OTP only visible in console
    return { messageId: null, previewUrl: null };
  }

  try {
    const info = await transport.sendMail({
      from: '"Capsule Auth" <auth@capsule.dev>',
      to: email,
      subject: `Your Capsule verification code: ${otp}`,
      text: `Your verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px; background: #0a0a0a; color: #f8fafc; border-radius: 12px;">
          <h2 style="margin: 0 0 8px; color: #00f0ff; font-size: 18px;">Capsule</h2>
          <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Verification Code</p>
          <div style="background: #1a1a1a; border: 1px solid rgba(0,240,255,0.3); border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #00f0ff; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 13px; margin: 0;">This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
      `,
    });

    // Log Ethereal preview URL (only works with Ethereal accounts)
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 OTP email preview: ${previewUrl}`);
    }

    return { messageId: info.messageId, previewUrl };
  } catch (err) {
    console.log(`⚠️  Could not send email (offline?). OTP is in console.`);
    return { messageId: null, previewUrl: null };
  }
}

// ── Rate Limiter for OTP endpoint ──────────────────────
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  keyGenerator: (req) => req.body.email || req.ip,
  message: { error: 'Too many OTP requests. Try again in 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ─────────────────────────────────────────────

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(email);
    if (existing && existing.verified) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    if (existing && !existing.verified) {
      // Update unverified account with new details
      db.prepare('UPDATE users SET name = ?, password_hash = ? WHERE id = ?')
        .run(name, passwordHash, existing.id);
    } else {
      // Create new user
      db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name, email, passwordHash);
    }

    // Generate and send OTP
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate old OTPs for this email
    db.prepare('UPDATE otps SET used = 1 WHERE email = ? AND used = 0').run(email);

    // Store new OTP
    db.prepare('INSERT INTO otps (email, otp_hash, expires_at) VALUES (?, ?, ?)')
      .run(email, otpHash, expiresAt);

    const emailResult = await sendOTPEmail(email, otp);

    res.status(201).json({
      message: 'Account created. Check your email for the verification code.',
      previewUrl: emailResult.previewUrl || null,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/send-otp
app.post('/auth/send-otp', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate old OTPs
    db.prepare('UPDATE otps SET used = 1 WHERE email = ? AND used = 0').run(email);

    // Store new OTP
    db.prepare('INSERT INTO otps (email, otp_hash, expires_at) VALUES (?, ?, ?)')
      .run(email, otpHash, expiresAt);

    const emailResult = await sendOTPEmail(email, otp);

    res.json({
      message: 'Verification code sent to your email.',
      previewUrl: emailResult.previewUrl || null,
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /auth/verify-otp
app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find the most recent unused OTP for this email
    const otpRecord = db.prepare(
      'SELECT * FROM otps WHERE email = ? AND used = 0 ORDER BY id DESC LIMIT 1'
    ).get(email);

    if (!otpRecord) {
      return res.status(400).json({ error: 'No pending verification code found. Request a new one.' });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({ error: 'Verification code has expired. Request a new one.' });
    }

    // Verify OTP
    const valid = await bcrypt.compare(otp, otpRecord.otp_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark OTP as used
    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otpRecord.id);

    // Mark user as verified
    db.prepare('UPDATE users SET verified = 1 WHERE email = ?').run(email);

    // Get user and issue JWT
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email);
    const token = signToken(user);

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this email' });
    }

    if (!user.verified) {
      return res.status(403).json({ error: 'Account not verified. Please complete email verification first.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    const token = signToken(user);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me
app.get('/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

// ── Health check ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, async () => {
  // Pre-initialize transporter so Ethereal creds print at startup
  await getTransporter();
  console.log(`\n🚀 Capsule Auth Server running on http://localhost:${PORT}\n`);
});
