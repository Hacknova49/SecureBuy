import mongoose from 'mongoose';

/* -------------------- USER -------------------- */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    avatarUrl: String,
    boundDeviceId: { type: String, default: '' },
    recoveryCode: String,
    role: {
      type: String,
      enum: ['USER', 'MANAGER'],
      default: 'USER'
    }
  },
  { timestamps: true }
);

/* -------------------- EVENT -------------------- */
const EventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    date: { type: Date, required: true },
    venue: { type: String, required: true },
    price: { type: Number, required: true },
    image: {
      type: String,
      default: 'https://picsum.photos/seed/event/600/400'
    },
    tags: [String],
    organizerId: { type: String, required: true },
    totalTickets: { type: Number, required: true },
    soldTickets: { type: Number, default: 0 }
  },
  { timestamps: true }
);

/* -------------------- TICKET -------------------- */
const TicketSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    eventName: { type: String, required: true },
    eventDate: { type: Date, required: true },
    venue: { type: String, required: true },

    userId: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: ['ACTIVE', 'USED', 'REVOKED'],
      default: 'ACTIVE'
    },

    boundDeviceId: { type: String, required: true },

    seedSecret: {
      type: String,
      required: true
    },

    purchaseDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

/* -------------------- MODELS -------------------- */
export const UserModel =
  mongoose.models.User || mongoose.model('User', UserSchema);

export const EventModel =
  mongoose.models.Event || mongoose.model('Event', EventSchema);

export const TicketModel =
  mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
