import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  avatarUrl: String,
  boundDeviceId: { type: String, default: '' },
  recoveryCode: String,
  role: { type: String, enum: ['USER', 'MANAGER'], default: 'USER' }
});

const EventSchema = new mongoose.Schema({
  name: String,
  description: String,
  date: Date,
  venue: String,
  price: Number,
  image: String,
  tags: [String],
  organizerId: String,
  totalTickets: Number,
  soldTickets: { type: Number, default: 0 }
});

const TicketSchema = new mongoose.Schema({
  eventId: String,
  eventName: String,
  eventDate: Date,
  venue: String,
  userId: String,
  status: { type: String, enum: ['ACTIVE', 'USED', 'REVOKED'], default: 'ACTIVE' },
  boundDeviceId: String,
  seedSecret: String,
  purchaseDate: { type: Date, default: Date.now }
});

export const UserModel = mongoose.model('User', UserSchema);
export const EventModel = mongoose.model('Event', EventSchema);
export const TicketModel = mongoose.model('Ticket', TicketSchema);