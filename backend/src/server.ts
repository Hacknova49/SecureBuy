import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { UserModel, EventModel, TicketModel } from './models';



dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* -------------------- DATABASE -------------------- */
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/securebuy';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

/* -------------------- GEMINI -------------------- */
if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY missing in .env');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash'
});

/* -------------------- TOTP (DEMO) -------------------- */
const validateTOTP = (secret: string, token: string): boolean => {
  const epoch = Math.floor(Date.now() / 1000 / 15);
  const hash = Math.abs(
    Array.from(`${secret}-${epoch}`)
      .reduce((a, c) => a + c.charCodeAt(0), 0)
  );
  const current = (hash % 1_000_000).toString().padStart(6, '0');
  return token === current;
};

/* -------------------- AUTH -------------------- */
app.post('/api/auth/login', async (req, res) => {
  const { email, name, role, deviceId } = req.body;

  try {
    let user = await UserModel.findOne({ email });

    if (!user) {
      const recoveryCode = `REC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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

app.post('/api/auth/recover', async (req, res) => {
  const { email, recoveryCode, deviceId } = req.body;

  const user = await UserModel.findOne({ email, recoveryCode });
  if (!user) return res.status(404).json({ error: 'Invalid recovery code' });

  user.boundDeviceId = deviceId;
  await user.save();

  res.json(user);
});

/* -------------------- EVENTS -------------------- */
app.get('/api/events', async (_req, res) => {
  const events = await EventModel.find();
  res.json(events);
});

app.post('/api/events', async (req, res) => {
  const event = await EventModel.create(req.body);
  res.json(event);
});

/* -------------------- TICKETS -------------------- */
app.get('/api/tickets/:userId', async (req, res) => {
  const tickets = await TicketModel.find({ userId: req.params.userId });
  res.json(tickets);
});

app.post('/api/tickets/purchase', async (req, res) => {
  const ticket = await TicketModel.create(req.body);
  res.json(ticket);
});

app.post('/api/tickets/scan', async (req, res) => {
  const { ticketId, token } = req.body;

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) return res.status(404).json({ valid: false, message: 'Invalid ticket' });

  const valid = validateTOTP(ticket.seedSecret, token);
  res.json({
    valid,
    message: valid ? 'Ticket verified' : 'Invalid or expired token',
    ticket
  });
});

/* -------------------- AI -------------------- */
app.post('/api/ai/hype', async (req, res) => {
  const { name, venue, price } = req.body;

  const result = await geminiModel.generateContent(
    `Write a hype event description for ${name} at ${venue}. Price ₹${price}.`
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

/* -------------------- START -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 SecureBuy backend running on http://localhost:${PORT}`)
);
