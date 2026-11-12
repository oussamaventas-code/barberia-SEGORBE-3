import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  appointmentEvents,
  appointments,
  appointmentServices,
  businessSettings,
  communicationConsents,
  customerNotes,
  customers,
  notifications,
  payments,
  staff,
} from '../db/schema.ts';

export type CrmSegment =
  | 'NEW'
  | 'HABITUAL'
  | 'FREQUENT'
  | 'INACTIVE'
  | 'UPCOMING'
  | 'RECURRING_CANCEL';

export interface Customer360Summary {
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
  segments: CrmSegment[];
  daysSinceLastVisit: number | null;
  expectedCadenceDays: number;
  overdueForVisit: boolean;
  marketingOptIn: boolean;
  privacyPolicyAccepted: boolean;
}

/**
 * Computes real CRM segmentation and metrics strictly from PostgreSQL history.
 * Never marks a customer as inactive/lost without sufficient completed visit data.
 */
export async function getAllCustomers360(): Promise<Customer360Summary[]> {
  const [settings] = await db.select().from(businessSettings).limit(1);
  const defaultCadence = settings?.defaultReturnCadenceDays ?? 28;

  const allCustomers = await db.select().from(customers).orderBy(desc(customers.createdAt));
  if (allCustomers.length === 0) return [];

  const allAppts = await db.select().from(appointments).orderBy(desc(appointments.startAtUtc));
  const allApptSvcs = await db.select().from(appointmentServices);
  const allPayments = await db.select().from(payments).where(eq(payments.status, 'PAID'));
  const allConsents = await db.select().from(communicationConsents);

  const svcsByAppt = new Map<number, string[]>();
  for (const s of allApptSvcs) {
    const arr = svcsByAppt.get(s.appointmentId) ?? [];
    arr.push(s.serviceNameSnapshot);
    svcsByAppt.set(s.appointmentId, arr);
  }

  const paidByCustomer = new Map<number, number>();
  for (const p of allPayments) {
    paidByCustomer.set(p.customerId, (paidByCustomer.get(p.customerId) ?? 0) + p.amountCents);
  }

  const consentByCustomer = new Map<number, (typeof allConsents)[number]>();
  for (const c of allConsents) {
    consentByCustomer.set(c.customerId, c);
  }

  const nowMs = Date.now();

  return allCustomers.map((cust) => {
    const custAppts = allAppts.filter((a) => a.customerId === cust.id);
    const completed = custAppts
      .filter((a) => a.status === 'COMPLETED')
      .sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());
    const upcoming = custAppts
      .filter((a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.startAtUtc.getTime() >= nowMs)
      .sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());
    const cancelledCount = custAppts.filter((a) => a.status === 'CANCELLED').length;
    const noShowCount = custAppts.filter((a) => a.status === 'NO_SHOW').length;

    const lastVisit = completed.length > 0 ? completed[completed.length - 1].startAtUtc : null;
    const nextAppt = upcoming.length > 0 ? upcoming[0].startAtUtc : null;

    // Compute real personal cadence from intervals between completed visits if >= 2 visits
    let calculatedCadence = cust.visitCadenceDays ?? defaultCadence;
    if (!cust.visitCadenceDays && completed.length >= 2) {
      let totalGapDays = 0;
      for (let i = 1; i < completed.length; i++) {
        totalGapDays +=
          (completed[i].startAtUtc.getTime() - completed[i - 1].startAtUtc.getTime()) / 86_400_000;
      }
      calculatedCadence = Math.max(7, Math.round(totalGapDays / (completed.length - 1)));
    }

    const daysSinceLastVisit = lastVisit ? Math.floor((nowMs - lastVisit.getTime()) / 86_400_000) : null;
    const overdueForVisit =
      completed.length >= 2 &&
      daysSinceLastVisit !== null &&
      daysSinceLastVisit > calculatedCadence &&
      !nextAppt;

    const segments: CrmSegment[] = [];
    if (completed.length <= 1) segments.push('NEW');
    if (completed.length >= 2) segments.push('HABITUAL');
    if (completed.length >= 5) segments.push('FREQUENT');
    if (upcoming.length > 0) segments.push('UPCOMING');
    if (cancelledCount + noShowCount >= 2) segments.push('RECURRING_CANCEL');
    // Only tag INACTIVE if there is sufficient historical visit data (>= 2 completed visits) and exceeded cadence
    if (overdueForVisit) segments.push('INACTIVE');

    const serviceSet = new Set<string>();
    for (const a of custAppts) {
      for (const sName of svcsByAppt.get(a.id) ?? []) {
        serviceSet.add(sName);
      }
    }

    const consent = consentByCustomer.get(cust.id);

    return {
      id: cust.id,
      publicCode: cust.publicCode,
      fullName: cust.fullName,
      phone: cust.phone,
      email: cust.email,
      preferences: cust.preferences,
      relationshipStatus: cust.relationshipStatus,
      visitCadenceDays: cust.visitCadenceDays,
      createdAt: cust.createdAt.toISOString(),
      lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
      nextAppointmentAt: nextAppt ? nextAppt.toISOString() : null,
      totalVisits: completed.length,
      cancelledCount,
      noShowCount,
      totalSpentCents: paidByCustomer.get(cust.id) ?? 0,
      servicesUsed: Array.from(serviceSet),
      segments,
      daysSinceLastVisit,
      expectedCadenceDays: calculatedCadence,
      overdueForVisit,
      marketingOptIn: consent?.marketingOptIn ?? false,
      privacyPolicyAccepted: consent?.privacyPolicyAccepted ?? false,
    };
  });
}

/**
 * Full 360° dossier for a single customer (for Admin/Staff CRM view only).
 */
export async function getCustomer360Detail(customerId: number) {
  const [cust] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!cust) return null;

  const allSummaries = await getAllCustomers360();
  const summary = allSummaries.find((s) => s.id === customerId);

  const custAppts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.customerId, customerId))
    .orderBy(desc(appointments.startAtUtc));

  const apptIds = custAppts.map((a) => a.id);
  const apptSvcs =
    apptIds.length > 0
      ? await db
          .select()
          .from(appointmentServices)
          .where(inArray(appointmentServices.appointmentId, apptIds))
      : [];
  const events =
    apptIds.length > 0
      ? await db
          .select()
          .from(appointmentEvents)
          .where(inArray(appointmentEvents.appointmentId, apptIds))
          .orderBy(desc(appointmentEvents.createdAt))
      : [];

  const staffRows = await db.select().from(staff);
  const staffMap = new Map(staffRows.map((s) => [s.id, s.name]));

  const notes = await db
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.createdAt));

  const comms = await db
    .select()
    .from(notifications)
    .where(eq(notifications.customerId, customerId))
    .orderBy(desc(notifications.createdAt));

  const custPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.customerId, customerId))
    .orderBy(desc(payments.paidAt));

  const [consent] = await db
    .select()
    .from(communicationConsents)
    .where(eq(communicationConsents.customerId, customerId))
    .limit(1);

  return {
    summary,
    customer: cust,
    consent: consent ?? null,
    appointments: custAppts.map((a) => ({
      ...a,
      staffName: staffMap.get(a.staffId) ?? 'Profesional',
      services: apptSvcs.filter((s) => s.appointmentId === a.id),
    })),
    timeline: [
      ...events.map((e) => ({
        id: `ev-${e.id}`,
        kind: 'EVENT',
        title: e.eventType,
        details: e.details,
        actor: e.actorLabel,
        createdAt: e.createdAt.toISOString(),
      })),
      ...comms.map((c) => ({
        id: `nt-${c.id}`,
        kind: 'COMMUNICATION',
        title: `${c.channel} · ${c.eventType}`,
        details: `${c.subject} (${c.status})`,
        actor: c.provider,
        createdAt: c.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notes,
    communications: comms,
    payments: custPayments,
  };
}
