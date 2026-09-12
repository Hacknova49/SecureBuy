import {
  Ticket,
  User,
  Event,
  UserRole,
  ScanResult,
  AuthResponse
} from '../types';

const API_URL = `${import.meta.env.VITE_API_URL || 'https://securebuy.onrender.com'}/api`;


type WithId<T> = T & { id: string };

// --------------------
// DEVICE ID
// --------------------
const STORAGE_KEY_DEVICE = 'dynaTick_deviceId';
const STORAGE_KEY_SESSION_USER = 'session_user';
const STORAGE_KEY_SESSION_TOKEN = 'session_token';

if (!localStorage.getItem(STORAGE_KEY_DEVICE)) {
  localStorage.setItem(
    STORAGE_KEY_DEVICE,
    'device_' + Math.random().toString(36).substring(2, 9)
  );
}

export const getMyDeviceId = () =>
  localStorage.getItem(STORAGE_KEY_DEVICE)!;

// --------------------
// API FETCHER
// --------------------
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem(STORAGE_KEY_SESSION_TOKEN)
        ? { Authorization: `Bearer ${localStorage.getItem(STORAGE_KEY_SESSION_TOKEN)}` }
        : {})
    },
    ...options
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || 'Unknown API error');
  }

  return data as T;
}

// --------------------
// AUTH
// --------------------
export const registerOrLogin = async (
  email: string,
  name: string,
  role: UserRole
): Promise<AuthResponse> => {
  const data = await apiFetch<{ user: any; token: string; isNew: boolean; recoveryCode?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      name,
      role,
      deviceId: getMyDeviceId()
    })
  });

  const user: User = {
    ...data.user,
    id: data.user._id
  };

  if (data.recoveryCode) user.recoveryCode = data.recoveryCode;
  localStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_SESSION_TOKEN, data.token);

  return { user, isNew: data.isNew };
};

export const recoverAccount = async (
  email: string,
  recoveryCode: string
): Promise<User> => {
  const data = await apiFetch<any>('/auth/recover', {
    method: 'POST',
    body: JSON.stringify({
      email,
      recoveryCode,
      deviceId: getMyDeviceId()
    })
  });

  const user: User = {
    ...data.user,
    id: data.user._id
  };

  localStorage.setItem(STORAGE_KEY_SESSION_USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY_SESSION_TOKEN, data.token);
  return user;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEY_SESSION_USER);
  localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
};

export const getTicketToken = async (ticketId: string): Promise<{ token: string; expiresIn: number }> =>
  apiFetch(`/tickets/${ticketId}/token`);

export const getCurrentUser = (): User | null => {
  try {
    const u = localStorage.getItem(STORAGE_KEY_SESSION_USER);
    if (!u) return null;

    const user = JSON.parse(u);
    return {
      ...user,
      id: user.id || user._id
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY_SESSION_USER);
    return null;
  }
};

// --------------------
// EVENTS
// --------------------
export const getEvents = async (): Promise<Event[]> => {
  const data = await apiFetch<any[]>('/events');
  return data.map(e => ({ ...e, id: e._id }));
};

export const createEvent = async (
  organizerId: string,
  eventData: Partial<Event>
): Promise<Event> => {
  const data = await apiFetch<any>('/events', {
    method: 'POST',
    body: JSON.stringify({ ...eventData, organizerId })
  });

  return { ...data, id: data._id };
};

// --------------------
// TICKETS
// --------------------
export const getTicketsForUser = async (
  userId: string
): Promise<Ticket[]> => {
  const data = await apiFetch<any[]>(`/tickets/${userId}`);
  return data.map(t => ({ ...t, id: t._id }));
};

export const purchaseTicket = async (
  user: User,
  eventId: string
): Promise<WithId<Ticket>> => {
  const data = await apiFetch<any>('/tickets/purchase', {
    method: 'POST',
    body: JSON.stringify({
      userId: user.id,
      eventId,
      deviceId: getMyDeviceId()
    })
  });

  return { ...data, id: data._id };
};

export const scanTicket = async (
  ticketId: string,
  token: string
): Promise<ScanResult> => {
  return apiFetch<ScanResult>('/tickets/scan', {
    method: 'POST',
    body: JSON.stringify({ ticketId, token })
  });
};

// --------------------
// AI
// --------------------
export const generateHype = async (
  name: string,
  venue: string,
  price: number
): Promise<string> => {
  const data = await apiFetch<{ text: string }>('/ai/hype', {
    method: 'POST',
    body: JSON.stringify({ name, venue, price })
  });

  return data.text;
};

export const chatConcierge = async (
  message: string,
  context: string
): Promise<{ reply: string; grounding?: any[] }> => {
  return apiFetch<{ reply: string; grounding?: any[] }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context })
  });
};
