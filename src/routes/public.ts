import { Router } from 'express';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  appointmentEvents,
  appointments,
  appointmentServices,
  businessSettings,
  communicationConsents,
  customers,
  services,
  staff,
  staffServices,
  waitlist,
} from '../db/schema.ts';
import { ensureSystemBootstrap } from '../services/bootstrap.ts';
import {
  getAvailabilityCacheEpoch,
  getAvailabilityWindow,
  getAvailableSlotsForDate,
  getCalendarDaysAvailability,
  resolveServiceForStaff,
} from '../services/availability.ts';
import { cancelAppointment, createAtomicBooking, rescheduleAppointment } from '../services/booking.ts';
import { optionalAuth, type AuthRequest } from '../middleware/auth.ts';
import { formatDateMadrid, formatTimeMadrid } from '../lib/timezone.ts';
import { recordNotification } from '../services/notifications.ts';

const router = Router();

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '').trim();
}

let bootstrapCache: { epoch: number; expiresAt: number; payload: any } | null = null;
let bootstrapInFlight: Promise<any> | null = null;

// Public bootstrap: business settings (safe public fields), services, active staff, real metrics
router.get('/bootstrap', async (_req, res) => {
  try {
    const epoch = getAvailabilityCacheEpoch();
    if (bootstrapCache && bootstrapCache.epoch === epoch && bootstrapCache.expiresAt > Date.now()) {
      return res.json(bootstrapCache.payload);
    }

    if (!bootstrapInFlight) {
      bootstrapInFlight = (async () => {
        await ensureSystemBootstrap();
        const [settingsRows, serviceRows, activeStaff, ssRows, completedRows, totalRows] =
          await Promise.all([
            db.select().from(businessSettings).limit(1),
            db
              .select()
              .from(services)
              .where(isNull(services.deletedAt))
              .orderBy(services.sortOrder, services.id),
            db
              .select({
                id: staff.id,
                name: staff.name,
                roleTitle: staff.roleTitle,
                bio: staff.bio,
                specialties: staff.specialties,
                photoUrl: staff.photoUrl,
                sortOrder: staff.sortOrder,
              })
              .from(staff)
              .where(eq(staff.isActive, true))
              .orderBy(staff.sortOrder, staff.id),
            db.select().from(staffServices),
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(appointments)
              .where(eq(appointments.status, 'COMPLETED')),
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(appointments)
              .where(inArray(appointments.status, ['CONFIRMED', 'COMPLETED'])),
          ]);

        const settings = settingsRows[0];
        const payload = {
          systemOperational: true,
          business: settings
            ? {
                businessName: settings.businessName,
                city: settings.city,
                address: settings.address,
                phone: settings.phone,
                email: settings.email,
                timezone: settings.timezone,
                minLeadMinutes: settings.minLeadMinutes,
                maxAdvanceDays: settings.maxAdvanceDays,
                cancelCutoffHours: settings.cancelCutoffHours,
                rescheduleCutoffHours: settings.rescheduleCutoffHours,
                cancellationPolicyText: settings.cancellationPolicyText,
                legalEntityName: settings.legalEntityName,
                legalTaxId: settings.legalTaxId,
                isSetupComplete: settings.isSetupComplete,
              }
            : null,
          services: serviceRows,
          staff: activeStaff.map((barber) => ({
            ...barber,
            serviceIds: ssRows.filter((ss) => ss.staffId === barber.id).map((ss) => ss.serviceId),
          })),
          realMetrics: {
            completedAppointments: completedRows[0]?.count ?? 0,
            totalBookings: totalRows[0]?.count ?? 0,
            activeServices: serviceRows.filter((s) => s.isActive && s.isConfigured).length,
            activeStaff: activeStaff.length,
          },
        };
        bootstrapCache = {
          epoch: getAvailabilityCacheEpoch(),
          expiresAt: Date.now() + 10_000,
          payload,
        };
        return payload;
      })().finally(() => {
        bootstrapInFlight = null;
      });
    }

    const payload = await bootstrapInFlight;
    res.json(payload);
  } catch (error: any) {
    console.error('Public bootstrap failed:', error);
    res.status(500).json({ error: error.message || 'No se pudo cargar la configuración pública.' });
  }
});

// Single-roundtrip availability window (returns days + exact slotsByDate for instant mobile switching)
router.get('/availability/window', async (req, res) => {
  try {
    const start = String(req.query.start || formatDateMadrid(new Date()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      return res.status(400).json({ error: 'Formato de fecha inicial inválido (YYYY-MM-DD).' });
    }
    const days = Number(req.query.days || 21);
    const serviceIds = String(req.query.serviceIds || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;

    if (serviceIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un servicio.' });
    }

    const windowData = await getAvailabilityWindow({
      startDateStr: start,
      daysCount: days,
      serviceIds,
      staffId,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.json({ timezone: 'Europe/Madrid', ...windowData });
  } catch (error: any) {
    console.error('Availability window error:', error);
    res.status(400).json({ error: error.message || 'Error consultando disponibilidad.' });
  }
});

// Calendar days availability
router.get('/availability/days', async (req, res) => {
  try {
    const start = String(req.query.start || formatDateMadrid(new Date()));
    const days = Number(req.query.days || 31);
    const serviceIds = String(req.query.serviceIds || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;

    if (serviceIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un servicio.' });
    }

    const summary = await getCalendarDaysAvailability({
      startDateStr: start,
      daysCount: days,
      serviceIds,
      staffId,
    });

    res.json({ days: summary });
  } catch (error: any) {
    console.error('Availability days error:', error);
    res.status(400).json({ error: error.message || 'Error consultando días disponibles.' });
  }
});

// Exact time slots for a specific date (YYYY-MM-DD in Europe/Madrid)
router.get('/availability/slots', async (req, res) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD).' });
    }
    const serviceIds = String(req.query.serviceIds || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const staffId = req.query.staffId ? Number(req.query.staffId) : null;
    const excludeAppointmentId = req.query.excludeAppointmentId
      ? Number(req.query.excludeAppointmentId)
      : undefined;

    if (serviceIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un servicio.' });
    }

    const slots = await getAvailableSlotsForDate({
      dateStr,
      serviceIds,
      staffId,
      excludeAppointmentId,
    });

    res.json({ date: dateStr, timezone: 'Europe/Madrid', slots });
  } catch (error: any) {
    console.error('Availability slots error:', error);
    res.status(400).json({ error: error.message || 'Error consultando horarios.' });
  }
});

// Returning customer lookup (requires phone + bookingCode or authenticated session so personal data cannot be enumerated)
const lookupSchema = z.object({
  phone: z.string().min(7),
  bookingCode: z.string().optional(),
});

router.post('/lookup-customer', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = lookupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de identificación inválidos.' });
    }

    const phone = normalizePhone(parsed.data.phone);
    const [cust] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (!cust) {
      return res.json({ found: false });
    }

    // Verify ownership via authenticated profile OR matching bookingCode
    let verified = false;
    if (req.profile && cust.profileUid && req.profile.uid === cust.profileUid) {
      verified = true;
    } else if (parsed.data.bookingCode) {
      const code = parsed.data.bookingCode.trim().toUpperCase();
      const [appt] = await db
        .select()
        .from(appointments)
        .where(and(eq(appointments.customerId, cust.id), eq(appointments.bookingCode, code)))
        .limit(1);
      if (appt) verified = true;
    }

    if (!verified) {
      return res.json({
        found: true,
        requiresVerification: true,
        message: 'Introduce un código de reserva anterior (ej. CS-XXXXXX) para recuperar tus datos de forma segura.',
      });
    }

    const [consent] = await db
      .select()
      .from(communicationConsents)
      .where(eq(communicationConsents.customerId, cust.id))
      .limit(1);

    return res.json({
      found: true,
      requiresVerification: false,
      customer: {
        fullName: cust.fullName,
        phone: cust.phone,
        email: cust.email,
        preferredChannel: consent?.preferredChannel ?? 'NONE',
      },
    });
  } catch (error: any) {
    console.error('Customer lookup error:', error);
    res.status(500).json({ error: 'Error verificando cliente.' });
  }
});

// Create atomic booking
const createBookingSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  serviceIds: z.array(z.number().int().positive()).min(1),
  staffId: z.number().int().positive().nullable().optional(), // null means "first available"
  startAtUtc: z.string().min(10),
  customer: z.object({
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(30),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    notes: z.string().max(500).optional().nullable(),
  }),
  consents: z.object({
    privacyPolicyAccepted: z.literal(true),
    marketingOptIn: z.boolean().default(false),
    preferredChannel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'NONE']).optional(),
  }),
});

router.post('/bookings', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Revisa los datos de la reserva y la aceptación de privacidad.',
        details: parsed.error.flatten(),
      });
    }

    const data = parsed.data;
    let targetStaffId = data.staffId;

    // If "first available" (staffId null), pick an eligible staff free at startAtUtc
    if (!targetStaffId) {
      const dateStr = formatDateMadrid(new Date(data.startAtUtc));
      const slots = await getAvailableSlotsForDate({
        dateStr,
        serviceIds: data.serviceIds,
      });
      const targetTime = new Date(data.startAtUtc).getTime();
      const matching = slots.find((s) => new Date(s.startUtc).getTime() === targetTime);
      if (!matching) {
        return res.status(409).json({
          error: 'Disponibilidad agotada para el horario seleccionado.',
        });
      }
      targetStaffId = matching.staffId;
    }

    const result = await createAtomicBooking({
      idempotencyKey: data.idempotencyKey,
      serviceIds: data.serviceIds,
      staffId: targetStaffId,
      startAtUtc: data.startAtUtc,
      customer: {
        fullName: data.customer.fullName,
        phone: data.customer.phone,
        email: data.customer.email || null,
        notes: data.customer.notes || null,
        profileUid: req.profile?.uid ?? null,
      },
      consents: {
        privacyPolicyAccepted: data.consents.privacyPolicyAccepted,
        marketingOptIn: data.consents.marketingOptIn,
        preferredChannel: data.consents.preferredChannel ?? 'NONE',
      },
      source: 'WEB',
      actorRole: 'CUSTOMER',
      actorLabel: data.customer.fullName,
    });

    const appt = result.appointment;
    const [barber] = await db.select().from(staff).where(eq(staff.id, appt.staffId)).limit(1);
    const apptSvcs = await db
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, appt.id));

    res.status(result.deduplicated ? 200 : 201).json({
      booking: {
        id: appt.id,
        bookingCode: appt.bookingCode,
        accessToken: appt.accessToken,
        status: appt.status,
        startAtUtc: appt.startAtUtc.toISOString(),
        endAtUtc: appt.endAtUtc.toISOString(),
        dateMadrid: formatDateMadrid(appt.startAtUtc),
        timeMadrid: formatTimeMadrid(appt.startAtUtc),
        totalPriceCents: appt.totalPriceCents,
        totalDurationMinutes: appt.totalDurationMinutes,
        staff: barber ? { id: barber.id, name: barber.name } : null,
        services: apptSvcs,
      },
    });
  } catch (error: any) {
    const msg = error?.message || 'No se pudo confirmar la reserva.';
    const isConflict = msg.includes('Disponibilidad') || msg.includes('bloqueada');
    res.status(isConflict ? 409 : 400).json({ error: msg });
  }
});

// Join waitlist
const waitlistSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  serviceId: z.number().int().positive(),
  staffId: z.number().int().positive().nullable().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeWindowStart: z.string().optional(),
  timeWindowEnd: z.string().optional(),
  privacyPolicyAccepted: z.literal(true),
});

router.post('/waitlist', async (req, res) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Completa todos los campos obligatorios.' });
    }
    const d = parsed.data;
    const phone = normalizePhone(d.phone);

    let [cust] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (!cust) {
      const [created] = await db
        .insert(customers)
        .values({
          publicCode: `CL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          fullName: d.fullName.trim(),
          phone,
          email: d.email?.trim().toLowerCase() || null,
          relationshipStatus: 'NEW',
        })
        .returning();
      cust = created;
      await db.insert(communicationConsents).values({
        customerId: cust.id,
        privacyPolicyAccepted: true,
        privacyPolicyAcceptedAt: new Date(),
        marketingOptIn: false,
      });
    }

    const [entry] = await db
      .insert(waitlist)
      .values({
        customerId: cust.id,
        serviceId: d.serviceId,
        staffId: d.staffId ?? null,
        preferredDate: d.preferredDate,
        timeWindowStart: d.timeWindowStart ?? null,
        timeWindowEnd: d.timeWindowEnd ?? null,
        status: 'WAITING',
      })
      .returning();

    await recordNotification({
      eventType: 'NEW_BOOKING',
      channel: 'INTERNAL',
      recipient: 'Lista de espera',
      customerId: cust.id,
      subject: `Nueva solicitud en lista de espera (${d.preferredDate})`,
      body: `${cust.fullName} espera hueco para el ${d.preferredDate}.`,
    });

    res.status(201).json({ waitlistEntry: entry });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al registrar en lista de espera.' });
  }
});

// Helper to verify client access to a specific appointment (never exposes other clients' data or internal notes)
async function verifyClientBookingAccess(params: {
  bookingCode: string;
  token?: string;
  phone?: string;
}) {
  const code = params.bookingCode.trim().toUpperCase();
  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.bookingCode, code))
    .limit(1);

  if (!appt) return null;

  const [cust] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, appt.customerId))
    .limit(1);

  if (!cust) return null;

  if (params.token && appt.accessToken === params.token.trim()) {
    return { appt, cust };
  }
  if (params.phone && normalizePhone(params.phone) === cust.phone) {
    return { appt, cust };
  }
  return null;
}

// Client Area: consult a single appointment via bookingCode + (token OR phone)
router.get('/my-booking', async (req, res) => {
  try {
    const bookingCode = String(req.query.code || '');
    const token = req.query.token ? String(req.query.token) : undefined;
    const phone = req.query.phone ? String(req.query.phone) : undefined;

    if (!bookingCode || (!token && !phone)) {
      return res.status(400).json({ error: 'Introduce el código de reserva y tu teléfono o enlace seguro.' });
    }

    const verified = await verifyClientBookingAccess({ bookingCode, token, phone });
    if (!verified) {
      return res.status(404).json({ error: 'No encontramos ninguna cita con esos datos.' });
    }

    const { appt, cust } = verified;
    const [barber] = await db.select().from(staff).where(eq(staff.id, appt.staffId)).limit(1);
    const apptSvcs = await db
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, appt.id));
    const events = await db
      .select()
      .from(appointmentEvents)
      .where(eq(appointmentEvents.appointmentId, appt.id))
      .orderBy(desc(appointmentEvents.createdAt));

    const [settings] = await db.select().from(businessSettings).limit(1);

    // Compatible staff who perform all services of this appointment
    const allActiveStaff = await db.select().from(staff).where(eq(staff.isActive, true));
    const compatStaff = [];
    for (const s of allActiveStaff) {
      const ok = await resolveServiceForStaff(
        apptSvcs.map((x) => x.serviceId),
        s.id
      ).catch(() => null);
      if (ok) compatStaff.push({ id: s.id, name: s.name, roleTitle: s.roleTitle });
    }

    res.json({
      booking: {
        id: appt.id,
        bookingCode: appt.bookingCode,
        accessToken: appt.accessToken,
        status: appt.status,
        startAtUtc: appt.startAtUtc.toISOString(),
        endAtUtc: appt.endAtUtc.toISOString(),
        dateMadrid: formatDateMadrid(appt.startAtUtc),
        timeMadrid: formatTimeMadrid(appt.startAtUtc),
        totalPriceCents: appt.totalPriceCents,
        totalDurationMinutes: appt.totalDurationMinutes,
        customerNotes: appt.customerNotes,
        staff: barber ? { id: barber.id, name: barber.name, roleTitle: barber.roleTitle } : null,
        services: apptSvcs,
        events,
      },
      customer: {
        fullName: cust.fullName,
        phone: cust.phone,
        email: cust.email,
      },
      compatibleStaff: compatStaff,
      policies: settings
        ? {
            cancelCutoffHours: settings.cancelCutoffHours,
            rescheduleCutoffHours: settings.rescheduleCutoffHours,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Get my-booking error:', error);
    res.status(500).json({ error: 'Error consultando la cita.' });
  }
});

// Client Area: list customer's past & upcoming bookings securely
router.get('/my-bookings', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const phone = req.query.phone ? normalizePhone(String(req.query.phone)) : undefined;
    const bookingCode = req.query.code ? String(req.query.code).trim().toUpperCase() : undefined;
    const token = req.query.token ? String(req.query.token).trim() : undefined;

    let customerId: number | null = null;

    if (req.profile) {
      const [cust] = await db
        .select()
        .from(customers)
        .where(eq(customers.profileUid, req.profile.uid))
        .limit(1);
      if (cust) customerId = cust.id;
    }

    if (!customerId && bookingCode && (phone || token)) {
      const verified = await verifyClientBookingAccess({ bookingCode, phone, token });
      if (verified) customerId = verified.cust.id;
    }

    if (!customerId) {
      return res.status(401).json({
        error: 'Verifica tu teléfono con un código de reserva o inicia sesión para ver tu historial.',
      });
    }

    const [cust] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    const appts = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, customerId))
      .orderBy(desc(appointments.startAtUtc));

    const staffRows = await db.select().from(staff);
    const staffMap = new Map(staffRows.map((s) => [s.id, s.name]));

    const apptIds = appts.map((a) => a.id);
    const svcs =
      apptIds.length > 0
        ? await db
            .select()
            .from(appointmentServices)
            .where(inArray(appointmentServices.appointmentId, apptIds))
        : [];

    res.json({
      customer: cust
        ? {
            fullName: cust.fullName,
            phone: cust.phone,
            email: cust.email,
          }
        : null,
      bookings: appts.map((a) => ({
        id: a.id,
        bookingCode: a.bookingCode,
        accessToken: a.accessToken,
        status: a.status,
        startAtUtc: a.startAtUtc.toISOString(),
        endAtUtc: a.endAtUtc.toISOString(),
        dateMadrid: formatDateMadrid(a.startAtUtc),
        timeMadrid: formatTimeMadrid(a.startAtUtc),
        totalPriceCents: a.totalPriceCents,
        totalDurationMinutes: a.totalDurationMinutes,
        staffId: a.staffId,
        staffName: staffMap.get(a.staffId) ?? 'Profesional',
        services: svcs.filter((s) => s.appointmentId === a.id),
      })),
    });
  } catch (error: any) {
    console.error('Get my-bookings error:', error);
    res.status(500).json({ error: 'Error consultando historial de citas.' });
  }
});

// Client Area: Reschedule or change staff
const clientRescheduleSchema = z.object({
  bookingCode: z.string().min(4),
  token: z.string().optional(),
  phone: z.string().optional(),
  newStartAtUtc: z.string().min(10),
  newStaffId: z.number().int().positive().optional(),
});

router.post('/my-booking/reschedule', async (req, res) => {
  try {
    const parsed = clientRescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de reprogramación inválidos.' });
    }
    const { bookingCode, token, phone, newStartAtUtc, newStaffId } = parsed.data;
    const verified = await verifyClientBookingAccess({ bookingCode, token, phone });
    if (!verified) {
      return res.status(403).json({ error: 'No autorizado para modificar esta cita.' });
    }

    const updated = await rescheduleAppointment({
      appointmentId: verified.appt.id,
      newStartAtUtc,
      newStaffId,
      actorRole: 'CUSTOMER',
      actorLabel: verified.cust.fullName,
      enforcePolicies: true,
    });

    res.json({
      booking: {
        id: updated.id,
        bookingCode: updated.bookingCode,
        status: updated.status,
        startAtUtc: updated.startAtUtc.toISOString(),
        endAtUtc: updated.endAtUtc.toISOString(),
        dateMadrid: formatDateMadrid(updated.startAtUtc),
        timeMadrid: formatTimeMadrid(updated.startAtUtc),
      },
    });
  } catch (error: any) {
    const msg = error?.message || 'No se pudo modificar la cita.';
    res.status(msg.includes('Disponibilidad') ? 409 : 400).json({ error: msg });
  }
});

// Client Area: Cancel appointment
const clientCancelSchema = z.object({
  bookingCode: z.string().min(4),
  token: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().max(300).optional(),
});

router.post('/my-booking/cancel', async (req, res) => {
  try {
    const parsed = clientCancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de cancelación inválidos.' });
    }
    const { bookingCode, token, phone, reason } = parsed.data;
    const verified = await verifyClientBookingAccess({ bookingCode, token, phone });
    if (!verified) {
      return res.status(403).json({ error: 'No autorizado para cancelar esta cita.' });
    }

    const { cancelled } = await cancelAppointment({
      appointmentId: verified.appt.id,
      reason,
      actorRole: 'CUSTOMER',
      actorLabel: verified.cust.fullName,
      enforcePolicy: true,
    });

    res.json({
      booking: {
        id: cancelled.id,
        bookingCode: cancelled.bookingCode,
        status: cancelled.status,
        cancelledAt: cancelled.cancelledAt?.toISOString() ?? null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'No se pudo cancelar la cita.' });
  }
});

// RGPD Client Data Export (portable JSON of their own data, never internal notes)
router.get('/my-data/export', async (req, res) => {
  try {
    const bookingCode = String(req.query.code || '');
    const token = req.query.token ? String(req.query.token) : undefined;
    const phone = req.query.phone ? String(req.query.phone) : undefined;

    const verified = await verifyClientBookingAccess({ bookingCode, token, phone });
    if (!verified) {
      return res.status(403).json({ error: 'Verificación requerida para exportar datos RGPD.' });
    }

    const appts = await db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, verified.cust.id));

    const [consent] = await db
      .select()
      .from(communicationConsents)
      .where(eq(communicationConsents.customerId, verified.cust.id))
      .limit(1);

    res.json({
      exportedAt: new Date().toISOString(),
      controller: 'Club Segorbe (Murcia, España)',
      customer: {
        publicCode: verified.cust.publicCode,
        fullName: verified.cust.fullName,
        phone: verified.cust.phone,
        email: verified.cust.email,
        createdAt: verified.cust.createdAt,
      },
      consents: consent ?? null,
      appointments: appts.map((a) => ({
        bookingCode: a.bookingCode,
        status: a.status,
        startAtUtc: a.startAtUtc,
        endAtUtc: a.endAtUtc,
        totalPriceCents: a.totalPriceCents,
        totalDurationMinutes: a.totalDurationMinutes,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error exportando datos personales.' });
  }
});

export default router;
