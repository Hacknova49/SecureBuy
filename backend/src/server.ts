import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { UserModel, EventModel, TicketModel } from './models';

dotenv.config();

const app = express();
app.use(cors() as any);
app.use(express.json() as any);

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/securebuy')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// --- Gemini Client ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helper: TOTP Validation (Simplified for Demo) ---
const validateTOTP = (secret: string, token: string): boolean => {
    // In production, use a library like 'otpauth'
    const pseudoHmac = (s: string, e: number) => {
        const input = `${s}-${e}`;
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString();
    };
    const epoch = Math.floor(Date.now() / 1000);
    const window = 15;
    const timeStep = Math.floor(epoch / window);
    
    const current = (parseInt(pseudoHmac(secret, timeStep)) % 1000000).toString().padStart(6, '0');
    const prev = (parseInt(pseudoHmac(secret, timeStep - 1)) % 1000000).toString().padStart(6, '0');
    
    return token === current || token === prev;
};

// --- Routes ---

// 1. Auth & Device Binding
app.post('/api/auth/login', async (req, res) => {
    const { email, name, role, deviceId, recoveryCode } = req.body;
    
    try {
        let user = await UserModel.findOne({ email });

        if (user) {
            // Login Logic
            if (role === 'USER') {
                if (user.boundDeviceId && user.boundDeviceId !== deviceId) {
                    return res.status(403).json({ error: "Device mismatch. Account bound to another device." });
                }
                // First time binding for existing user (if switching roles)
                if (!user.boundDeviceId) {
                    user.boundDeviceId = deviceId;
                    await user.save();
                }
            }
        } else {
            // Register Logic
            const recCode = `REC-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            user = new UserModel({
                email,
                name,
                role,
                avatarUrl: `https://picsum.photos/seed/${email}/200`,
                boundDeviceId: role === 'USER' ? deviceId : '',
                recoveryCode: recCode
            });
            await user.save();
            return res.json({ user, isNew: true });
        }
        res.json({ user, isNew: false });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/recover', async (req, res) => {
    const { email, recoveryCode, deviceId } = req.body;
    const user = await UserModel.findOne({ email });
    
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.recoveryCode !== recoveryCode) return res.status(403).json({ error: "Invalid code" });

    user.boundDeviceId = deviceId;
    await user.save();
    res.json(user);
});

// 2. Events
app.get('/api/events', async (req, res) => {
    const events = await EventModel.find().sort({ date: 1 });
    res.json(events);
});

app.post('/api/events', async (req, res) => {
    const event = new EventModel(req.body);
    await event.save();
    res.json(event);
});

// 3. Tickets
app.get('/api/tickets/:userId', async (req, res) => {
    const tickets = await TicketModel.find({ userId: req.params.userId });
    res.json(tickets);
});

app.post('/api/tickets/purchase', async (req, res) => {
    const { userId, eventId, deviceId } = req.body;
    
    const event = await EventModel.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.soldTickets >= (event.totalTickets || 0)) return res.status(400).json({ error: "Sold out" });

    // Check limit
    const existing = await TicketModel.countDocuments({ userId, eventId });
    if (existing >= 4) return res.status(400).json({ error: "Limit reached" });

    event.soldTickets = (event.soldTickets || 0) + 1;
    await event.save();

    const ticket = new TicketModel({
        eventId: event._id,
        eventName: event.name,
        eventDate: event.date,
        venue: event.venue,
        userId,
        boundDeviceId: deviceId,
        seedSecret: Math.random().toString(36).substr(2, 10).toUpperCase() + 'SECRET'
    });
    await ticket.save();
    res.json(ticket);
});

app.post('/api/tickets/scan', async (req, res) => {
    const { ticketId, token } = req.body;
    
    // Simulate finding ticket by ID format used in frontend (or MongoDB _id)
    // The frontend currently generates fake IDs like TICK-..., we need to adjust schema or use _id
    // For this migration, let's assume the frontend now passes the MongoDB _id as ticketId
    
    let ticket;
    try {
         ticket = await TicketModel.findById(ticketId);
    } catch (e) {
         // handle fake IDs from old mock data if necessary
         return res.status(404).json({ valid: false, message: "Ticket ID invalid" });
    }

    if (!ticket) return res.status(404).json({ valid: false, message: "Ticket not found" });

    const isValid = validateTOTP(ticket.seedSecret!, token);
    
    if (!isValid) return res.json({ valid: false, message: "Invalid Token", ticket });
    
    // Perform AI Risk Analysis on Server Side
    let riskAnalysis = "Low Risk";
    try {
        const aiRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze risk for ticket scan. User: ${ticket.userId}, Event: ${ticket.eventName}. Time: ${new Date().toISOString()}. Return 1 sentence.`
        });
        riskAnalysis = aiRes.text || "Analysis failed";
    } catch (e) { console.error(e); }

    res.json({ valid: true, message: "Access Granted", ticket, riskAnalysis });
});

// 4. AI Endpoints (Proxies)
app.post('/api/ai/hype', async (req, res) => {
    const { name, venue, price } = req.body;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a high-energy, cyberpunk-themed 2-sentence marketing description for: ${name} at ${venue}. Price: ₹${price}. Tone: Exciting, futuristic.`
        });
        res.json({ text: response.text });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/ai/chat', async (req, res) => {
    const { message, history, context } = req.body;
    try {
        // Construct chat with context
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Context: ${context}\n\nUser: ${message}`,
            config: {
                tools: [{ googleMaps: {} }]
            }
        });
        res.json({ 
            text: response.text, 
            grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks 
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));