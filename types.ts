export type UserRole = 'USER' | 'MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  boundDeviceId: string;
  recoveryCode?: string; // Secret code to re-bind device
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
  description?: string; // AI Generated description
  date: string;
  venue: string;
  price: number;
  image: string;
  tags: string[]; // Event categories/tags
  organizerId: string; // Link event to the manager who created it
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

export type ViewMode = 'MARKET' | 'USER' | 'SCANNER' | 'ADMIN' | 'CREATE_EVENT';

export interface ScanResult {
  valid: boolean;
  message: string;
  ticket?: Ticket;
  timestamp: string;
  confidenceScore?: number;
}