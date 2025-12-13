import { Ticket, TicketStatus, User, Event, UserRole } from '../types';

// --- Storage Keys ---
const STORAGE_KEY_DEVICE = 'dynaTick_deviceId';
const STORAGE_KEY_DB_USERS = 'dynaTick_db_users';
const STORAGE_KEY_DB_TICKETS = 'dynaTick_db_tickets';
const STORAGE_KEY_DB_EVENTS = 'dynaTick_db_events';

// --- Device ID Init ---
if (!localStorage.getItem(STORAGE_KEY_DEVICE)) {
  localStorage.setItem(STORAGE_KEY_DEVICE, 'device_' + Math.random().toString(36).substr(2, 9));
}
const MY_DEVICE_ID = localStorage.getItem(STORAGE_KEY_DEVICE)!;

// --- Mock Data ---
const INITIAL_EVENTS: Event[] = [
  {
    id: 'evt_001',
    name: 'Neon Horizon Festival',
    description: 'Experience the ultimate convergence of light and sound at the Cyberdome. Featuring immersive holographic displays and bass that rewrites your DNA.',
    date: '2024-12-15T20:00:00Z',
    venue: 'Cyberdome Arena',
    price: 150,
    image: 'https://picsum.photos/seed/neon/400/200',
    tags: ['Music', 'Cyberpunk', 'Rave', 'Festival'],
    organizerId: 'admin_1',
    totalTickets: 5000,
    soldTickets: 2400
  },
  {
    id: 'evt_002',
    name: 'Quantum Jazz Night',
    description: 'Smooth synths meet algorithmic improvisation. A sophisticated evening for the discerning audiophile in the heart of the district.',
    date: '2024-12-20T19:00:00Z',
    venue: 'The Blue Note Holo',
    price: 85,
    image: 'https://picsum.photos/seed/jazz/400/200',
    tags: ['Music', 'Jazz', 'Chill', 'Nightlife'],
    organizerId: 'admin_1',
    totalTickets: 200,
    soldTickets: 150
  }
];

// --- Helpers ---

const getDbUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEY_DB_USERS);
  return data ? JSON.parse(data) : [];
};

const saveDbUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEY_DB_USERS, JSON.stringify(users));
};

const getDbTickets = (): Ticket[] => {
  const data = localStorage.getItem(STORAGE_KEY_DB_TICKETS);
  return data ? JSON.parse(data) : [];
};

const saveDbTickets = (tickets: Ticket[]) => {
  localStorage.setItem(STORAGE_KEY_DB_TICKETS, JSON.stringify(tickets));
};

const getDbEvents = (): Event[] => {
  const data = localStorage.getItem(STORAGE_KEY_DB_EVENTS);
  if (data) return JSON.parse(data);
  // Initialize if empty
  localStorage.setItem(STORAGE_KEY_DB_EVENTS, JSON.stringify(INITIAL_EVENTS));
  return INITIAL_EVENTS;
};

const saveDbEvents = (events: Event[]) => {
  localStorage.setItem(STORAGE_KEY_DB_EVENTS, JSON.stringify(events));
};

const generateRecoveryCode = (): string => {
    // Generate a formatted code like REC-A1B2-C3D4
    const p1 = Math.random().toString(36).substr(2, 4).toUpperCase();
    const p2 = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `REC-${p1}-${p2}`;
};

// --- Exported Services ---

export const getMyDeviceId = () => MY_DEVICE_ID;

export const getEvents = () => getDbEvents();

export const getTicketsForUser = (userId: string): Ticket[] => {
  return getDbTickets().filter(t => t.userId === userId);
};

export const getTicketById = (id: string): Ticket | undefined => {
  return getDbTickets().find(t => t.id === id);
};

// --- Auth & Strict Binding Logic ---

export const getCurrentUser = (): User | null => {
  const email = localStorage.getItem('dynaTick_session_email');
  if (!email) return null;
  const users = getDbUsers();
  return users.find(u => u.email === email) || null;
};

export const logout = () => {
  localStorage.removeItem('dynaTick_session_email');
};

// Returns User and a flag indicating if it was a new registration
export const registerOrLogin = async (email: string, name: string, role: UserRole): Promise<{ user: User, isNew: boolean }> => {
  await new Promise(r => setTimeout(r, 600));

  const users = getDbUsers();
  const existingUser = users.find(u => u.email === email);
  
  // STRICT RULE 1: DEVICE EXCLUSIVITY (Hardware Check)
  if (role === 'USER') {
      const userBoundToThisDevice = users.find(u => u.boundDeviceId === MY_DEVICE_ID);
      
      if (userBoundToThisDevice) {
        if (userBoundToThisDevice.email !== email) {
          throw new Error(`ACCESS DENIED: This device is bound to '${userBoundToThisDevice.name}'. Cannot login as different user.`);
        }
      }
  }

  if (existingUser) {
    // Login
    
    // STRICT RULE 2: ACCOUNT EXCLUSIVITY
    if (role === 'USER') {
        if (existingUser.boundDeviceId && existingUser.boundDeviceId !== MY_DEVICE_ID) {
           throw new Error(`ACCESS DENIED: Account '${email}' is bound to a different device. Use Account Recovery if you lost your device.`);
        }
    }

    // Update role if changed
    if (existingUser.role !== role) {
        existingUser.role = role;
        // Logic for role switching binding...
        if (role === 'MANAGER') {
            existingUser.boundDeviceId = '';
        } else if (role === 'USER' && !existingUser.boundDeviceId) {
            existingUser.boundDeviceId = MY_DEVICE_ID;
        }
        saveDbUsers(users);
    }
    
    localStorage.setItem('dynaTick_session_email', email);
    return { user: existingUser, isNew: false };
  } else {
    // Registration
    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name,
      email,
      avatarUrl: `https://picsum.photos/seed/${email}/200`,
      boundDeviceId: role === 'USER' ? MY_DEVICE_ID : '',
      role: role,
      recoveryCode: role === 'USER' ? generateRecoveryCode() : undefined
    };
    
    users.push(newUser);
    saveDbUsers(users);
    localStorage.setItem('dynaTick_session_email', email);
    return { user: newUser, isNew: true };
  }
};

export const recoverAccount = async (email: string, recoveryCode: string): Promise<User> => {
    await new Promise(r => setTimeout(r, 1000));
    
    const users = getDbUsers();
    const user = users.find(u => u.email === email);

    if (!user) throw new Error("Account not found.");
    
    if (user.role !== 'USER') throw new Error("Only Attendee accounts need recovery.");

    if (user.recoveryCode !== recoveryCode) {
        throw new Error("Invalid Recovery Code.");
    }

    // Check if this device is already bound to someone else
    const userBoundToThisDevice = users.find(u => u.boundDeviceId === MY_DEVICE_ID);
    if (userBoundToThisDevice && userBoundToThisDevice.id !== user.id) {
         throw new Error(`This device is already bound to ${userBoundToThisDevice.email}. Factory reset app/storage to clear.`);
    }

    // Success: Re-bind
    user.boundDeviceId = MY_DEVICE_ID;
    saveDbUsers(users);
    
    // Auto-login
    localStorage.setItem('dynaTick_session_email', email);

    return user;
};

// --- Ticket Operations ---

export const purchaseTicket = async (user: User, eventId: string): Promise<Ticket> => {
  await new Promise(r => setTimeout(r, 800));
  
  const tickets = getDbTickets();
  const events = getDbEvents();
  const event = events.find(e => e.id === eventId);
  
  if (!event) throw new Error("Event not found");

  // Rule: Max 4 Tickets Per User Per Event
  const userTicketsForEvent = tickets.filter(t => t.userId === user.id && t.eventId === eventId);
  if (userTicketsForEvent.length >= 4) {
    throw new Error("Ticket limit reached (Max 4 per account).");
  }

  // Update Sold Count
  if (event.soldTickets >= event.totalTickets) {
      throw new Error("Event is Sold Out.");
  }
  
  event.soldTickets += 1;
  saveDbEvents(events);

  const newTicket: Ticket = {
    id: `TICK-${Math.floor(Math.random() * 10000)}-${eventId.substr(4)}`,
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    venue: event.venue,
    seat: 'General Admission',
    userId: user.id,
    status: TicketStatus.ACTIVE,
    boundDeviceId: user.boundDeviceId, // Bind to current device
    seedSecret: Math.random().toString(36).substr(2, 10).toUpperCase() + 'SECRET',
    purchaseDate: new Date().toISOString()
  };

  tickets.push(newTicket);
  saveDbTickets(tickets);
  return newTicket;
};

// --- Manager Operations ---

export const createEvent = async (organizerId: string, eventData: Partial<Event>): Promise<Event> => {
    await new Promise(r => setTimeout(r, 800));
    const events = getDbEvents();

    const newEvent: Event = {
        id: 'evt_' + Math.random().toString(36).substr(2, 6),
        name: eventData.name || 'Untitled Event',
        description: eventData.description || 'No description provided.',
        date: eventData.date || new Date().toISOString(),
        venue: eventData.venue || 'TBD',
        price: eventData.price || 0,
        image: `https://picsum.photos/seed/${Math.random()}/400/200`,
        tags: eventData.tags || [],
        organizerId: organizerId,
        totalTickets: eventData.totalTickets || 100,
        soldTickets: 0
    };

    events.unshift(newEvent); // Add to top
    saveDbEvents(events);
    return newEvent;
}