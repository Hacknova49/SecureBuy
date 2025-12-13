import { Ticket, User, Event, UserRole, ScanResult } from '../types';

const API_URL = 'http://localhost:5000/api';

// --- Device ID ---
const STORAGE_KEY_DEVICE = 'dynaTick_deviceId';
if (!localStorage.getItem(STORAGE_KEY_DEVICE)) {
  localStorage.setItem(STORAGE_KEY_DEVICE, 'device_' + Math.random().toString(36).substr(2, 9));
}
export const getMyDeviceId = () => localStorage.getItem(STORAGE_KEY_DEVICE)!;

// --- Auth ---
export const registerOrLogin = async (email: string, name: string, role: UserRole) => {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, deviceId: getMyDeviceId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    localStorage.setItem('session_user', JSON.stringify(data.user));
    return data;
};

export const recoverAccount = async (email: string, recoveryCode: string) => {
    const res = await fetch(`${API_URL}/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recoveryCode, deviceId: getMyDeviceId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    
    localStorage.setItem('session_user', JSON.stringify(data));
    return data;
};

export const logout = () => {
    localStorage.removeItem('session_user');
};

export const getCurrentUser = (): User | null => {
    const u = localStorage.getItem('session_user');
    return u ? JSON.parse(u) : null;
};

// --- Events ---
export const getEvents = async (): Promise<Event[]> => {
    const res = await fetch(`${API_URL}/events`);
    const data = await res.json();
    // Map _id to id for frontend compatibility
    return data.map((d: any) => ({ ...d, id: d._id }));
};

export const createEvent = async (organizerId: string, eventData: Partial<Event>) => {
    const res = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...eventData, organizerId })
    });
    return await res.json();
};

// --- Tickets ---
export const getTicketsForUser = async (userId: string): Promise<Ticket[]> => {
    const res = await fetch(`${API_URL}/tickets/${userId}`);
    const data = await res.json();
    return data.map((d: any) => ({ ...d, id: d._id }));
};

export const purchaseTicket = async (user: User, eventId: string) => {
    const res = await fetch(`${API_URL}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, eventId, deviceId: getMyDeviceId() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { ...data, id: data._id };
};

export const scanTicket = async (ticketId: string, token: string): Promise<ScanResult> => {
    const res = await fetch(`${API_URL}/tickets/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, token })
    });
    return await res.json();
};

// --- AI Services ---
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
