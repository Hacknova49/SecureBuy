import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { UserModel, EventModel, TicketModel } from './models';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */
const MONGO_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/securebuy';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

/* ================= GEMINI ================= */
if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY missing in .env');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'models/gemini-1.5-flash'
});

/* ================= TOTP ================= */
const validateTOTP = (secret: string, token: string): boolean => {
  const epoch = Math.floor(Date.now() / 1000 / 15);
  const hash = crypto
    .createHash('sha256')
    .update(`${secret}-${epoch}`)
    .digest('hex');

  const current = (parseInt(hash.slice(0, 8), 16) % 1_000_000)
    .toString()
    .padStart(6, '0');

  return token === current;
};

/* ================= AUTH ================= */
app.post('/api/auth/login', async (req, res) => {
  const { email, name, role, deviceId } = req.body;

  try {
    let user = await UserModel.findOne({ email });

    if (!user) {
      const recoveryCode = `REC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      user = await UserModel.create({
        email,
        name,
        role,
        boundDeviceId: role === 'USER' ? deviceId : '',
        recoveryCode
      });

      return res.json({ user, isNew: true });
    }

    if (role === 'USER' && user.boundDeviceId && user.boundDeviceId !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch' });
    }

    if (role === 'USER' && !user.boundDeviceId) {
      user.boundDeviceId = deviceId;
      await user.save();
    }

    res.json({ user, isNew: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= EVENTS ================= */
app.get('/api/events', async (_req, res) => {
  const events = await EventModel.find();
  res.json(events);
});

app.post('/api/events', async (req, res) => {
  const event = await EventModel.create(req.body);
  res.json(event);
});

/* ================= TICKETS ================= */
app.get('/api/tickets/:userId', async (req, res) => {
  const tickets = await TicketModel.find({ userId: req.params.userId });
  res.json(tickets);
});

app.post('/api/tickets/purchase', async (req, res) => {
  try {
    const { userId, eventId, deviceId } = req.body;

    const event = await EventModel.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.soldTickets >= event.totalTickets) {
      return res.status(400).json({ error: 'Event sold out' });
    }

    const seedSecret = crypto.randomBytes(20).toString('hex');

    const ticket = await TicketModel.create({
      eventId: event._id.toString(),
      eventName: event.name,
      eventDate: event.date,
      venue: event.venue,
      userId,
      boundDeviceId: deviceId,
      seedSecret,
      status: 'ACTIVE'
    });

    event.soldTickets += 1;
    await event.save();

    res.json(ticket);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets/scan', async (req, res) => {
  const { ticketId, token } = req.body;

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) {
    return res.status(404).json({ valid: false, message: 'Invalid ticket' });
  }

  const valid = validateTOTP(ticket.seedSecret, token);

  res.json({
    valid,
    message: valid ? 'Ticket verified' : 'Invalid or expired token',
    ticket
  });
});

/* ================= AI ================= */
app.post('/api/ai/hype', async (req, res) => {
  const { name, venue, price } = req.body;

  const result = await geminiModel.generateContent(
    `Write a high-energy, cyberpunk-style event description for ${name} at ${venue}. Ticket price ₹${price}.`
  );

  res.json({ text: result.response.text() });
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, context } = req.body;

  const result = await geminiModel.generateContent(
    `Context:\n${context}\n\nUser:\n${message}`
  );

  res.json({ reply: result.response.text() });
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SecureBuy backend running on http://localhost:${PORT}`);
});
