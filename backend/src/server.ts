import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { UserModel, EventModel, TicketModel } from './models';

dotenv.config();

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
  ?.split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json());

type UserRole = 'USER' | 'MANAGER';

type AuthClaims = {
  userId: string;
  role: UserRole;
  deviceId: string;
  expiresAt: number;
};

type AuthenticatedRequest = express.Request & { auth: AuthClaims };

/* ================= DATABASE ================= */
const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securebuy';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

/* ================= SECURITY ================= */
const SESSION_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('JWT_SECRET or SESSION_SECRET is required in production');
      })()
    : crypto.randomBytes(32).toString('hex'));

const hashRecoveryCode = (code: string) =>
  crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

const issueSession = (user: { _id: unknown; role: UserRole; boundDeviceId?: string }) => {
  const payload: AuthClaims = {
    userId: String(user._id),
    role: user.role,
    deviceId: user.boundDeviceId || '',
    expiresAt: Date.now() + 1000 * 60 * 60 * 24
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

const readSession = (token: string): AuthClaims | null => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as AuthClaims;
  return payload.expiresAt > Date.now() ? payload : null;
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const auth = token ? readSession(token) : null;
  if (!auth) return res.status(401).json({ error: 'Authentication required' });
  (req as AuthenticatedRequest).auth = auth;
  next();
};

const requireManager = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as AuthenticatedRequest).auth.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
};

/* ================= GEMINI ================= */
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const geminiModel = genAI?.getGenerativeModel({ model: 'gemini-2.5-flash' });

/* ================= TOTP ================= */
const validateTOTP = (secret: string, token: string): boolean => {
  const currentStep = Math.floor(Date.now() / 1000 / 15);
  return [-1, 0, 1].some(offset => {
    const hash = crypto
      .createHash('sha256')
      .update(`${secret}-${currentStep + offset}`)
      .digest('hex');
    const expected = (parseInt(hash.slice(0, 8), 16) % 1_000_000)
      .toString()
      .padStart(6, '0');
    return token === expected;
  });
};

const generateTOTP = (secret: string) => {
  const epoch = Math.floor(Date.now() / 1000 / 15);
  const hash = crypto.createHash('sha256').update(`${secret}-${epoch}`).digest('hex');
  return (parseInt(hash.slice(0, 8), 16) % 1_000_000).toString().padStart(6, '0');
};

/* ================= AUTH ================= */
app.post('/api/auth/login', async (req, res) => {
  const { email, name, role, deviceId } = req.body;

  try {
    if (typeof email !== 'string' || typeof deviceId !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email and device ID are required' });
    }
    let user = await UserModel.findOne({ email: email.trim().toLowerCase() }).select('+recoveryCodeHash +recoveryCode +recoveryCodeExpiresAt');

    if (!user) {
      const recoveryCode = `REC-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

      user = await UserModel.create({
        email: email.trim().toLowerCase(),
        name: typeof name === 'string' && name.trim() ? name.trim() : 'SecureBuy user',
        role,
        boundDeviceId: role === 'USER' ? deviceId : '',
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      });

      return res.json({ user, token: issueSession(user), isNew: true, recoveryCode });
    }

    if (role === 'USER' && user.boundDeviceId && user.boundDeviceId !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch' });
    }

    if (role === 'USER' && !user.boundDeviceId) {
      user.boundDeviceId = deviceId;
      await user.save();
    }

    res.json({ user, token: issueSession(user), isNew: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/recover', async (req, res) => {
  const { email, recoveryCode, deviceId } = req.body;
  if (typeof email !== 'string' || typeof recoveryCode !== 'string' || typeof deviceId !== 'string') {
    return res.status(400).json({ error: 'Email, recovery code, and device ID are required' });
  }
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() }).select('+recoveryCodeHash +recoveryCode +recoveryCodeExpiresAt');
  if (!user || user.recoveryCodeExpiresAt && user.recoveryCodeExpiresAt < new Date()) {
    return res.status(403).json({ error: 'Invalid or expired recovery code' });
  }
  const storedHash = user.recoveryCodeHash || (user.recoveryCode ? hashRecoveryCode(user.recoveryCode) : '');
  if (!storedHash || !crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(hashRecoveryCode(recoveryCode)))) {
    return res.status(403).json({ error: 'Invalid or expired recovery code' });
  }
  user.boundDeviceId = deviceId;
  user.recoveryCodeHash = undefined;
  user.recoveryCode = undefined;
  user.recoveryCodeExpiresAt = undefined;
  await user.save();
  res.json({ user, token: issueSession(user) });
});

/* ================= EVENTS ================= */
app.get('/api/events', async (_req, res) => {
  const events = await EventModel.find();
  res.json(events);
});

app.post('/api/events', requireAuth, requireManager, async (req, res) => {
  const { name, venue, date, price, totalTickets, description, image, tags } = req.body;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof venue !== 'string' ||
    !venue.trim() ||
    typeof date !== 'string' ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0 ||
    !Number.isInteger(Number(totalTickets)) ||
    Number(totalTickets) <= 0 ||
    Number.isNaN(Date.parse(date))
  ) {
    return res.status(400).json({ error: 'Invalid event details' });
  }

  const auth = (req as AuthenticatedRequest).auth;
  const event = await EventModel.create({
    name: name.trim(),
    venue: venue.trim(),
    date: new Date(date),
    price: Number(price),
    totalTickets: Number(totalTickets),
    description: typeof description === 'string' ? description.trim() : '',
    image,
    tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string').slice(0, 10) : [],
    organizerId: auth.userId
  });
  res.status(201).json(event);
});

/* ================= TICKETS ================= */
app.get('/api/tickets/:userId', requireAuth, async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (auth.role !== 'MANAGER' && auth.userId !== req.params.userId) {
    return res.status(403).json({ error: 'You can only access your own tickets' });
  }
  const tickets = await TicketModel.find({ userId: req.params.userId });
  res.json(tickets);
});

app.post('/api/tickets/purchase', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.body;
    const auth = (req as AuthenticatedRequest).auth;
    if (auth.role !== 'USER' || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'A valid attendee and event are required' });
    }

    if (typeof eventId !== 'string' || !eventId.trim()) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const event = await EventModel.findOneAndUpdate(
      { _id: eventId, $expr: { $lt: ['$soldTickets', '$totalTickets'] } },
      { $inc: { soldTickets: 1 } },
      { new: true }
    );
    if (!event) {
      const exists = await EventModel.exists({ _id: eventId });
      return res.status(exists ? 409 : 404).json({
        error: exists ? 'Event sold out' : 'Event not found'
      });
    }

    const seedSecret = crypto.randomBytes(20).toString('hex');

    let ticket;
    try {
      ticket = await TicketModel.create({
        eventId: event._id.toString(),
        eventName: event.name,
        eventDate: event.date,
        venue: event.venue,
        userId: auth.userId,
        boundDeviceId: auth.deviceId,
        seedSecret,
        status: 'ACTIVE'
      });
    } catch (error) {
      await EventModel.updateOne({ _id: event._id, soldTickets: { $gt: 0 } }, { $inc: { soldTickets: -1 } });
      throw error;
    }

    const { seedSecret: _seedSecret, ...safeTicket } = ticket.toObject();
    res.status(201).json(safeTicket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:ticketId/token', requireAuth, async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  const ticket = await TicketModel.findById(req.params.ticketId).select('+seedSecret');
  if (!ticket || ticket.userId !== auth.userId || ticket.boundDeviceId !== auth.deviceId) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  if (ticket.status !== 'ACTIVE') return res.status(409).json({ error: 'Ticket is no longer active' });
  res.json({ token: generateTOTP(ticket.seedSecret), expiresIn: 15 - (Math.floor(Date.now() / 1000) % 15) });
});

app.post('/api/tickets/scan', requireAuth, requireManager, async (req, res) => {
  const { ticketId, token } = req.body;

  const ticket = await TicketModel.findById(ticketId).select('+seedSecret');
  if (!ticket) {
    return res.status(404).json({ valid: false, message: 'Invalid ticket' });
  }

  const valid = ticket.status === 'ACTIVE' && validateTOTP(ticket.seedSecret, token);
  const { seedSecret: _seedSecret, ...safeTicket } = ticket.toObject();
  if (valid) {
    const updated = await TicketModel.findOneAndUpdate(
      { _id: ticketId, status: 'ACTIVE' },
      { $set: { status: 'USED' } },
      { new: true }
    );
    if (!updated) return res.json({ valid: false, message: 'Ticket was already used', ticket: safeTicket });
  }

  res.json({
    valid,
    message: valid ? 'Ticket verified' : 'Invalid or expired token',
    ticket: valid ? { ...safeTicket, status: 'USED' } : safeTicket
  });
});

/* ================= AI ================= */
app.post('/api/ai/hype', async (req, res) => {
  try {
    if (!geminiModel) return res.status(503).json({ error: 'AI service is not configured' });
    const { name, venue, price } = req.body;

    const result = await geminiModel.generateContent(
      `Write a high-energy cyberpunk-style event description for ${name} at ${venue}. Ticket price ₹${price}.`
    );

    res.json({ text: result.response.text() });
  } catch (err: any) {
    console.error('AI HYPE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!geminiModel) return res.status(503).json({ error: 'AI service is not configured' });
    const { message, context } = req.body;

    const result = await geminiModel.generateContent(
      `You are an event concierge AI.\n\nContext:\n${context}\n\nUser:\n${message}`
    );

    res.json({ reply: result.response.text() });
  } catch (err: any) {
    console.error('AI CHAT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SecureBuy backend running on http://localhost:${PORT}`);
});
