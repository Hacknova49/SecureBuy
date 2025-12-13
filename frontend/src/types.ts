export type UserRole = 'USER' | 'MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  boundDeviceId: string;
  recoveryCode?: string;
  role: UserRole;
}

export enum TicketStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  REVOKED = 'REVOKED',
  TRANSFERRED = 'TRANSFERRED'
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  venue: string;
  price: number;
  image: string;
  tags: string[];
  organizerId: string;
  totalTickets: number;
  soldTickets: number;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  venue: string;
  seat: string;
  userId: string;
  status: TicketStatus;
  boundDeviceId: string;
  seedSecret: string;
  purchaseDate: string;
}

export type ViewMode =
  | 'MARKET'
  | 'USER'
  | 'SCANNER'
  | 'ADMIN'
  | 'CREATE_EVENT';

export interface ScanResult {
  valid: boolean;
  message: string;
  ticket?: Ticket;
  timestamp: string;
  confidenceScore?: number;
}

/** ✅ REQUIRED FOR registerOrLogin */
export interface AuthResponse {
  user: User;
  isNew: boolean;
}
