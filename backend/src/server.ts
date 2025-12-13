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

// --------------------
// Database
// --------------------
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/securebuy')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// --------------------
// Gemini Client
// --------------------
if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY missing in .env');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash'
});

// --------------------
// Helper: TOTP (demo only)
// --------------------
const validateTOTP = (secret: string, token: string): boolean => {
  const pseudoHmac = (s: string, e: number) => {
    const input = `${s}-${e}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString();
  };

  const epoch = Math.floor(Date.now() / 1000);
  const step = Math.floor(epoch / 15);

  const current = (parseInt(pseudoHmac(secret, step)) % 1_000_000)
    .toString()
    .padStart(6, '0');

  const prev = (parseInt(pseudoHmac(secret, step - 1)) % 1_000_000)
    .toString()
    .padStart(6, '0');

  return token === current || token === prev;
};

// --------------------
// AUTH
// --------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, name, role, deviceId } = req.body;

  try {
    let user = await UserModel.findOne({ email });

    if (!user) {
      const recoveryCode = `REC-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      user = new UserModel({
        email,
        name,
        role,
        avatarUrl: `https://picsum.photos/seed/${email}/200`,
        boundDeviceId: role === 'USER' ? deviceId : '',
        recoveryCode
      });

      await user.save();
      return res.json({ user, isNew: true });
    }

    if (role === 'USER' && user.boundDeviceId && user.boundDeviceId !== deviceId) {
      return res.status(403).json({ error: 'Device mismatch' });
    }

    if (!user.boundDeviceId && role === 'USER') {
      user.boundDeviceId = deviceId;
      await user.save();
    }

    res.json({ user, isNew: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --------------------
// AI ENDPOINTS
// --------------------
app.post('/api/ai/hype', async (req, res) => {
  const { name, venue, price } = req.body;

  try {
    const result = await geminiModel.generateContent(
      `Write a high-energy, cyberpunk-style 2-sentence event description for ${name} at ${venue}. Price ₹${price}.`
    );

    res.json({ text: result.response.text() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, context } = req.body;

  try {
    const result = await geminiModel.generateContent(
      `Context:\n${context}\n\nUser:\n${message}`
    );

    res.json({
      reply: result.response.text()
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
