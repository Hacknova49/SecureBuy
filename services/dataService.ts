import { Ticket, User, Event, UserRole, ScanResult } from './types';


// --- Configuration ---
const API_URL = 'http://localhost:5000/api';

// --- Device ID (Client-Side Only) ---
// This remains on the client side, as the server needs the client to report its ID
const STORAGE_KEY_DEVICE = 'dynaTick_deviceId';
const STORAGE_KEY_SESSION_USER = 'session_user';

if (!localStorage.getItem(STORAGE_KEY_DEVICE)) {
    localStorage.setItem(STORAGE_KEY_DEVICE, 'device_' + Math.random().toString(36).substr(2, 9));
}
export const getMyDeviceId = () => localStorage.getItem(STORAGE_KEY_DEVICE)!;

// --- Auth Services (Server-Backed) ---

/**
 * Handles user login or registration and binds the account to the current device.
 * The server handles all the strict device binding and recovery logic.
 */
export const registerOrLogin = async (email: string, name: string, role: UserRole) => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email, 
            name, 
            role, 
            deviceId: getMyDeviceId() // Send device ID for server-side binding
        })
    });
    const data = await res.json();
    
    if (!res.ok) {
        // The server sends specific errors like "Device mismatch" or "Account bound"
        throw new Error(data.error); 
    }
    
    // Store the full user object (with _id) returned by the server
    localStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(data.user));
    
    // Map _id to id for consistency in the frontend
    return { 
        ...data, 
        user: { ...data.user, id: data.user._id } 
    };
};

/**
 * Allows a user to re-bind their account to the current device using a recovery code.
 * The server handles code verification and updates the boundDeviceId in MongoDB.
 */
export const recoverAccount = async (email: string, recoveryCode: string): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email, 
            recoveryCode, 
            deviceId: getMyDeviceId() 
        })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error);

    // Save the new user object after successful recovery/re-binding
    localStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(data));
    
    return { ...data, id: data._id };
};

export const logout = () => {
    localStorage.removeItem(STORAGE_KEY_SESSION_USER);
};

export const getCurrentUser = (): User | null => {
    const u = localStorage.getItem(STORAGE_KEY_SESSION_USER);
    if (!u) return null;
    
    const user = JSON.parse(u);
    
    // Map _id to id for frontend use
    return { ...user, id: user._id };
};


// --- Events Services (Server-Backed) ---

export const getEvents = async (): Promise<Event[]> => {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    
    // Map MongoDB's _id to the frontend's expected 'id' property
    return data.map((d: any) => ({ ...d, id: d._id }));
};

export const createEvent = async (organizerId: string, eventData: Partial<Event>): Promise<Event> => {
    const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, organizerId })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error);
    
    return { ...data, id: data._id };
};

// --- Tickets Services (Server-Backed) ---

export const getTicketsForUser = async (userId: string): Promise<Ticket[]> => {
    const res = await fetch(`${API_URL}/tickets/${userId}`);
    const data = await res.json();
    
    // Map MongoDB's _id to the frontend's expected 'id' property
    return data.map((d: any) => ({ ...d, id: d._id }));
};

export const purchaseTicket = async (user: User, eventId: string): Promise<Ticket> => {
    const res = await fetch(`${API_URL}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: user.id, // Use the user's MongoDB ID
            eventId, 
            deviceId: getMyDeviceId() // Send device ID for ticket binding
        })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error);
    
    return { ...data, id: data._id };
};

/**
 * Sends ticket ID and the dynamic token for server-side validation and AI risk analysis.
 */
export const scanTicket = async (ticketId: string, token: string): Promise<ScanResult> => {
    const res = await fetch(`${API_URL}/tickets/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, token })
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error);
    
    return data;
};

// --- AI Services (Proxy via Server) ---

export const generateHype = async (name: string, venue: string, price: any) => {
    const res = await fetch(`${API_URL}/ai/hype`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, venue, price })
    });
    const data = await res.json();
    
    return data.text;
};

export const chatConcierge = async (message: string, context: string) => {
    const res = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context })
    });
    
    return await res.json();
};