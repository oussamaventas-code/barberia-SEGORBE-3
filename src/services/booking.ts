import crypto from 'node:crypto';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  appointmentEvents,
  appointments,
  appointmentServices,
  auditLogs,
  businessSettings,
  communicationConsents,
  customers,
  staff,
  waitlist,
} from '../db/schema.ts';
import { formatDateMadrid, formatSpanishDate, formatTimeMadrid } from '../lib/timezone.ts';
import {
  assertStaffSlotAvailableInTx,
  invalidateAvailabilityCache,
  resolveServiceForStaff,
} from './availability.ts';
import { recordNotification } from './notifications.ts';

function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CS-';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

function generateAccessToken(): string {
  return crypto.randomBytes(20).toString('hex');
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '').trim();
}

export interface CreateBookingInput {
  idempotencyKey?: string;
  serviceIds: number[];
  staffId: number;
  startAtUtc: string; // ISO UTC
  customer: {
    fullName: string;
    phone: string;
    email?: string | null;
    notes?: string | null;
    profileUid?: string | null;
  };
  consents: {
    privacyPolicyAccepted: boolean;
    marketingOptIn: boolean;
    preferredChannel?: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE';
  };
  source: 'WEB' | 'ADMIN' | 'WAITLIST';
  actorRole: 'CUSTOMER' | 'ADMIN' | 'STAFF';
  actorLabel: string;
  bypassLeadTime?: boolean;
  bypassWorkingHours?: boolean;
}

/**
 * Atomic, concurrency-safe appointment creation using PostgreSQL advisory lock
 * keyed per staff member + idempotency key deduplication.
 */
export async function createAtomicBooking(input: CreateBookingInput) {
  if (!input.consents.privacyPolicyAccepted && input.source === 'WEB') {
    throw new Error('Es obligatorio aceptar la política de privacidad para completar la reserva.');
  }

  const normalizedPhone = normalizePhone(input.customer.phone);
  if (normalizedPhone.length < 7) {
    throw new Error('Introduce un número de teléfono válido.');
  }

  const startAtUtc = new Date(input.startAtUtc);
  if (Number.isNaN(startAtUtc.getTime())) {
    throw new Error('Fecha y hora de reserva inválidas.');
  }

  // Idempotency fast-path check
  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(appointments)
      .where(eq(appointments.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing.length > 0) {
      return { appointment: existing[0], deduplicated: true };
    }
  }

  const result = await db.transaction(async (tx) => {
    // Re-check idempotency inside transaction
    if (input.idempotencyKey) {
      const dup = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (dup.length > 0) {
        return { appointment: dup[0], deduplicated: true, isNewCustomer: false, customerRecord: null, barberName: '' };
      }
    }

    // Acquire transaction-scoped advisory lock on staffId to serialize concurrent bookings
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.staffId})`);

    const [barber] = await tx
      .select()
      .from(staff)
      .where(and(eq(staff.id, input.staffId), eq(staff.isActive, true)))
      .limit(1);

    if (!barber) {
      throw new Error('El profesional seleccionado no está disponible.');
    }

    const svcInfo = await resolveServiceForStaff(input.serviceIds, input.staffId, tx);
    if (!svcInfo) {
      throw new Error('El profesional seleccionado no realiza los servicios indicados.');
    }

    const { endAtUtc, settings } = await assertStaffSlotAvailableInTx(tx, {
      staffId: input.staffId,
      startAtUtc,
      durationMinutes: svcInfo.totalDurationMinutes,
      bufferMinutes: 0, // resolved inside helper from settings
      enforceWorkingHours: !input.bypassWorkingHours,
      enforceLeadTime: !input.bypassLeadTime,
    });

    // Lookup or create customer by normalized phone
    const existingCusts = await tx
      .select()
      .from(customers)
      .where(eq(customers.phone, normalizedPhone))
      .limit(1);

    let customerRecord = existingCusts[0];
    let isNewCustomer = false;

    if (!customerRecord) {
      isNewCustomer = true;
      const publicCode = `CL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const [insertedCust] = await tx
        .insert(customers)
        .values({
          publicCode,
          fullName: input.customer.fullName.trim(),
          phone: normalizedPhone,
          email: input.customer.email?.trim().toLowerCase() || null,
          profileUid: input.customer.profileUid || null,
          relationshipStatus: 'NEW',
        })
        .returning();
      customerRecord = insertedCust;
    } else {
      const [updatedCust] = await tx
        .update(customers)
        .set({
          fullName: input.customer.fullName.trim() || customerRecord.fullName,
          email: input.customer.email?.trim().toLowerCase() || customerRecord.email,
          profileUid: input.customer.profileUid || customerRecord.profileUid,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerRecord.id))
        .returning();
      customerRecord = updatedCust;
    }

    // Store RGPD separated consent ledger
    const now = new Date();
    await tx
      .insert(communicationConsents)
      .values({
        customerId: customerRecord.id,
        privacyPolicyAccepted: input.consents.privacyPolicyAccepted,
        privacyPolicyAcceptedAt: input.consents.privacyPolicyAccepted ? now : null,
        marketingOptIn: input.consents.marketingOptIn,
        marketingOptInAt: input.consents.marketingOptIn ? now : null,
        preferredChannel: input.consents.preferredChannel ?? 'NONE',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: communicationConsents.customerId,
        set: {
          privacyPolicyAccepted: input.consents.privacyPolicyAccepted,
          privacyPolicyAcceptedAt: input.consents.privacyPolicyAccepted ? now : undefined,
          marketingOptIn: input.consents.marketingOptIn,
          marketingOptInAt: input.consents.marketingOptIn ? now : undefined,
          preferredChannel: input.consents.preferredChannel ?? 'NONE',
          updatedAt: now,
        },
      });

    const bookingCode = generateBookingCode();
    const accessToken = generateAccessToken();

    const [createdAppt] = await tx
      .insert(appointments)
      .values({
        bookingCode,
        accessToken,
        idempotencyKey: input.idempotencyKey || null,
        customerId: customerRecord.id,
        staffId: input.staffId,
        startAtUtc,
        endAtUtc,
        bufferMinutes: settings.bufferMinutes,
        status: 'CONFIRMED',
        totalPriceCents: svcInfo.totalPriceCents,
        totalDurationMinutes: svcInfo.totalDurationMinutes,
        source: input.source,
        customerNotes: input.customer.notes?.trim() || null,
      })
      .returning();

    // Save immutable historical service snapshots
    await tx.insert(appointmentServices).values(
      svcInfo.resolved.map((s) => ({
        appointmentId: createdAppt.id,
        serviceId: s.serviceId,
        serviceNameSnapshot: s.name,
        priceCentsSnapshot: s.priceCents,
        durationMinutesSnapshot: s.durationMinutes,
      }))
    );

    await tx.insert(appointmentEvents).values({
      appointmentId: createdAppt.id,
      eventType: 'CREATED',
      actorRole: input.actorRole,
      actorLabel: input.actorLabel,
      previousStatus: null,
      newStatus: 'CONFIRMED',
      details: `Reserva ${bookingCode} confirmada para ${formatDateMadrid(startAtUtc)} ${formatTimeMadrid(startAtUtc)} con ${barber.name}.`,
    });

    return {
      appointment: createdAppt,
      deduplicated: false,
      isNewCustomer,
      customerRecord,
      barberName: barber.name,
      servicesResolved: svcInfo.resolved,
    };
  });

  // Post-commit notifications (never fake external sends)
  if (!result.deduplicated && result.customerRecord) {
    const dateLabel = formatSpanishDate(result.appointment.startAtUtc);
    const timeLabel = formatTimeMadrid(result.appointment.startAtUtc);
    await recordNotification({
      eventType: 'NEW_BOOKING',
      channel: 'INTERNAL',
      recipient: 'Administración',
      customerId: result.customerRecord.id,
      appointmentId: result.appointment.id,
      subject: `Nueva reserva ${result.appointment.bookingCode}`,
      body: `${result.customerRecord.fullName} · ${dateLabel} a las ${timeLabel} con ${result.barberName}.`,
    });

    if (result.isNewCustomer) {
      await recordNotification({
        eventType: 'NEW_CUSTOMER',
        channel: 'INTERNAL',
        recipient: 'CRM',
        customerId: result.customerRecord.id,
        subject: `Nuevo cliente registrado: ${result.customerRecord.fullName}`,
        body: `Alta automática desde reserva ${result.appointment.bookingCode}.`,
      });
    }

    if (result.customerRecord.email) {
      await recordNotification({
        eventType: 'NEW_BOOKING',
        channel: 'EMAIL',
        recipient: result.customerRecord.email,
        customerId: result.customerRecord.id,
        appointmentId: result.appointment.id,
        subject: `Confirmación de cita ${result.appointment.bookingCode} · Barbería Segorbe`,
        body: `Tu cita queda confirmada para el ${dateLabel} a las ${timeLabel} con ${result.barberName}.`,
      });
    }
  }

  if (!result.deduplicated) {
    invalidateAvailabilityCache();
  }
  return result;
}

/**
 * Reschedules an existing appointment atomically with full conflict validation.
 */
export async function rescheduleAppointment(params: {
  appointmentId: number;
  newStartAtUtc: string;
  newStaffId?: number;
  actorRole: 'CUSTOMER' | 'ADMIN' | 'STAFF';
  actorLabel: string;
  enforcePolicies: boolean;
}) {
  const newStart = new Date(params.newStartAtUtc);
  if (Number.isNaN(newStart.getTime())) {
    throw new Error('Nueva fecha u hora no válida.');
  }

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, params.appointmentId))
      .limit(1);

    if (!existing) {
      throw new Error('Cita no encontrada.');
    }
    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED' || existing.status === 'NO_SHOW') {
      throw new Error('No se puede modificar una cita cancelada, completada o marcada como no presentada.');
    }

    const targetStaffId = params.newStaffId ?? existing.staffId;
    // Lock target staff (and existing staff if different) in deterministic order
    const lockIds = Array.from(new Set([existing.staffId, targetStaffId])).sort((a, b) => a - b);
    for (const lid of lockIds) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lid})`);
    }

    const apptSvcs = await tx
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, existing.id));
    const serviceIds = apptSvcs.map((s) => s.serviceId);

    // Ensure target staff supports the booked services
    const compat = await resolveServiceForStaff(serviceIds, targetStaffId, tx);
    if (!compat) {
      throw new Error('El profesional seleccionado no realiza alguno de los servicios de esta cita.');
    }

    const { endAtUtc, settings } = await assertStaffSlotAvailableInTx(tx, {
      staffId: targetStaffId,
      startAtUtc: newStart,
      durationMinutes: existing.totalDurationMinutes,
      bufferMinutes: existing.bufferMinutes,
      excludeAppointmentId: existing.id,
      enforceWorkingHours: params.enforcePolicies,
      enforceLeadTime: params.enforcePolicies,
    });

    if (params.enforcePolicies) {
      const hoursUntil = (existing.startAtUtc.getTime() - Date.now()) / 3_600_000;
      if (hoursUntil < settings.rescheduleCutoffHours) {
        throw new Error(
          `Las modificaciones requieren al menos ${settings.rescheduleCutoffHours} horas de antelación.`
        );
      }
    }

    const [saved] = await tx
      .update(appointments)
      .set({
        staffId: targetStaffId,
        startAtUtc: newStart,
        endAtUtc,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, existing.id))
      .returning();

    await tx.insert(appointmentEvents).values({
      appointmentId: existing.id,
      eventType: targetStaffId !== existing.staffId ? 'STAFF_CHANGED' : 'RESCHEDULED',
      actorRole: params.actorRole,
      actorLabel: params.actorLabel,
      previousStatus: existing.status,
      newStatus: existing.status,
      details: `Reprogramada a ${formatDateMadrid(newStart)} ${formatTimeMadrid(newStart)}.`,
    });

    return saved;
  });

  await recordNotification({
    eventType: 'MODIFIED',
    channel: 'INTERNAL',
    recipient: 'Administración',
    customerId: updated.customerId,
    appointmentId: updated.id,
    subject: `Cita modificada ${updated.bookingCode}`,
    body: `Nuevo horario: ${formatDateMadrid(updated.startAtUtc)} ${formatTimeMadrid(updated.startAtUtc)}.`,
  });

  invalidateAvailabilityCache();
  return updated;
}

/**
 * Cancels an appointment, logs the event, frees the slot, and detects compatible waitlist candidates.
 */
export async function cancelAppointment(params: {
  appointmentId: number;
  reason?: string;
  actorRole: 'CUSTOMER' | 'ADMIN' | 'STAFF';
  actorLabel: string;
  enforcePolicy: boolean;
}) {
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(appointments)
      .where(eq(appointments.id, params.appointmentId))
      .limit(1);

    if (!existing) throw new Error('Cita no encontrada.');
    if (existing.status === 'CANCELLED') {
      throw new Error('Esta cita ya ha sido cancelada anteriormente.');
    }
    if (existing.status === 'COMPLETED') {
      throw new Error('No se puede cancelar una cita ya completada.');
    }

    if (params.enforcePolicy) {
      const [settings] = await tx.select().from(businessSettings).limit(1);
      if (settings) {
        const hoursUntil = (existing.startAtUtc.getTime() - Date.now()) / 3_600_000;
        if (hoursUntil < settings.cancelCutoffHours) {
          throw new Error(
            `El límite para cancelar online es de ${settings.cancelCutoffHours} horas antes de la cita.`
          );
        }
      }
    }

    const [cancelled] = await tx
      .update(appointments)
      .set({
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: params.reason?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, existing.id))
      .returning();

    await tx.insert(appointmentEvents).values({
      appointmentId: existing.id,
      eventType: 'CANCELLED',
      actorRole: params.actorRole,
      actorLabel: params.actorLabel,
      previousStatus: existing.status,
      newStatus: 'CANCELLED',
      details: params.reason?.trim() || 'Cancelación registrada.',
    });

    // Find compatible waitlist entries for that date & staff/services (never auto-confirm!)
    const apptSvcs = await tx
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, existing.id));
    const serviceIds = apptSvcs.map((s) => s.serviceId);
    const dateMadrid = formatDateMadrid(existing.startAtUtc);

    const waitlistMatches =
      serviceIds.length > 0
        ? await tx
            .select()
            .from(waitlist)
            .where(
              and(
                eq(waitlist.preferredDate, dateMadrid),
                eq(waitlist.status, 'WAITING'),
                inArray(waitlist.serviceId, serviceIds),
                or(isNull(waitlist.staffId), eq(waitlist.staffId, existing.staffId))
              )
            )
            .orderBy(desc(waitlist.createdAt))
        : [];

    if (waitlistMatches.length > 0) {
      await tx
        .update(waitlist)
        .set({
          status: 'OFFERED',
          offeredSlotStartUtc: existing.startAtUtc,
          offeredAt: new Date(),
        })
        .where(eq(waitlist.id, waitlistMatches[0].id));
    }

    return { cancelled, waitlistMatches };
  });

  await recordNotification({
    eventType: 'CANCELLED',
    channel: 'INTERNAL',
    recipient: 'Administración',
    customerId: result.cancelled.customerId,
    appointmentId: result.cancelled.id,
    subject: `Cita cancelada ${result.cancelled.bookingCode}`,
    body: `Horario liberado: ${formatDateMadrid(result.cancelled.startAtUtc)} ${formatTimeMadrid(result.cancelled.startAtUtc)}.`,
  });

  if (result.waitlistMatches.length > 0) {
    await recordNotification({
      eventType: 'SLOT_FREED',
      channel: 'INTERNAL',
      recipient: 'Lista de espera',
      customerId: result.waitlistMatches[0].customerId,
      appointmentId: result.cancelled.id,
      subject: `Hueco liberado compatible con lista de espera`,
      body: `Se detectaron ${result.waitlistMatches.length} cliente(s) compatibles para el ${formatDateMadrid(result.cancelled.startAtUtc)} a las ${formatTimeMadrid(result.cancelled.startAtUtc)}. Pendiente aceptación del cliente.`,
    });
  }

  invalidateAvailabilityCache();
  return result;
}

export async function recordAdminAudit(params: {
  actorUid?: string | null;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUid: params.actorUid ?? null,
      actorEmail: params.actorEmail ?? null,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}
