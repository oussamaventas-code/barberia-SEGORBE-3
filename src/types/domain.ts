export interface PublicBusinessInfo {
  businessName: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  cancelCutoffHours: number;
  rescheduleCutoffHours: number;
  cancellationPolicyText: string | null;
  legalEntityName: string | null;
  legalTaxId: string | null;
  isSetupComplete: boolean;
}

export interface ServiceItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number | null;
  durationMinutes: number | null;
  imageUrl: string | null;
  isActive: boolean;
  isConfigured: boolean;
  sortOrder: number;
  staffIds?: number[];
}

export interface StaffMember {
  id: number;
  name: string;
  roleTitle: string;
  bio: string | null;
  specialties: string | null;
  photoUrl: string | null;
  isActive?: boolean;
  serviceIds: number[];
}

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  timeLabel: string;
  staffId: number;
  staffName: string;
}

export interface DayAvailability {
  date: string;
  available: boolean;
  slotsCount: number;
}

export interface BookingSummary {
  id: number;
  bookingCode: string;
  accessToken: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  startAtUtc: string;
  endAtUtc: string;
  dateMadrid: string;
  timeMadrid: string;
  totalPriceCents: number | null;
  totalDurationMinutes: number;
  customerNotes?: string | null;
  staff: { id: number; name: string; roleTitle?: string } | null;
  services: Array<{
    id: number;
    serviceId: number;
    serviceNameSnapshot: string;
    priceCentsSnapshot: number | null;
    durationMinutesSnapshot: number;
  }>;
  events?: Array<{
    id: number;
    eventType: string;
    actorRole: string;
    actorLabel: string;
    details: string | null;
    createdAt: string;
  }>;
}

export interface Customer360 {
  id: number;
  publicCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  preferences: string | null;
  relationshipStatus: string;
  visitCadenceDays: number | null;
  createdAt: string;
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
  totalVisits: number;
  cancelledCount: number;
  noShowCount: number;
  totalSpentCents: number;
  servicesUsed: string[];
  segments: Array<'NEW' | 'HABITUAL' | 'FREQUENT' | 'INACTIVE' | 'UPCOMING' | 'RECURRING_CANCEL'>;
  daysSinceLastVisit: number | null;
  expectedCadenceDays: number;
  overdueForVisit: boolean;
  marketingOptIn: boolean;
  privacyPolicyAccepted: boolean;
}

export function formatEuro(cents: number | null | undefined): string {
  if (cents == null) return 'Por configurar';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No presentado',
};

export const WAITLIST_STATUS_LABELS: Record<string, string> = {
  WAITING: 'En espera',
  OFFERED: 'Hueco ofrecido',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Caducada',
  CANCELLED: 'Cancelada',
};
