import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  appointmentEvents,
  appointments,
  appointmentServices,
  auditLogs,
  blockedSlots,
  businessSettings,
  communicationConsents,
  customerNotes,
  customers,
  notifications,
  payments,
  profiles,
  services,
  staff,
  staffAvailability,
  staffServices,
  waitlist,
  workingHours,
} from '../db/schema.ts';
import {
  type AuthRequest,
  requireAdmin,
  requireAdminOrStaff,
  requireAuth,
  toAppProfile,
} from '../middleware/auth.ts';
import { createSessionToken, hashPassword, verifyPassword } from '../lib/session.ts';
import { ensureSystemBootstrap } from '../services/bootstrap.ts';
import { cancelAppointment, createAtomicBooking, recordAdminAudit, rescheduleAppointment } from '../services/booking.ts';
import { getAllCustomers360, getCustomer360Detail } from '../services/crm.ts';
import { addDaysToDateStr, formatDateMadrid, formatTimeMadrid, madridLocalToUtc } from '../lib/timezone.ts';
import { recordNotification } from '../services/notifications.ts';
import { invalidateAvailabilityCache } from '../services/availability.ts';

const router = Router();

// Local login (demo auth: email + password stored as scrypt hash in `profiles`)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

router.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Introduce un email y una contraseña válidos.' });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [p] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (!p || !verifyPassword(parsed.data.password, p.passwordHash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
  }
  await recordAdminAudit({
    actorUid: p.uid,
    actorEmail: p.email,
    actorRole: p.role,
    action: 'LOGIN',
    entityType: 'profile',
    entityId: String(p.id),
    ipAddress: req.ip ?? null,
  });
  res.json({ token: createSessionToken(p.uid), profile: toAppProfile(p) });
});

// Auth session info endpoint (any authenticated user)
router.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({
    profile: req.profile,
  });
});

// Protect all routes below to ADMIN or STAFF only
router.use(requireAuth, requireAdminOrStaff);

// Automatically invalidate availability cache after any successful admin/staff mutation
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        invalidateAvailabilityCache();
      }
    });
  }
  next();
});

// 1. OVERVIEW KPIs & REAL ANALYTICS (Zero invented numbers)
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    await ensureSystemBootstrap();
    const now = new Date();
    const todayStr = formatDateMadrid(now);
    const fromStr = String(req.query.from || addDaysToDateStr(todayStr, -29));
    const toStr = String(req.query.to || todayStr);

    const rangeStartUtc = madridLocalToUtc(fromStr, '00:00');
    const rangeEndUtc = madridLocalToUtc(addDaysToDateStr(toStr, 1), '00:00');
    const todayStartUtc = madridLocalToUtc(todayStr, '00:00');
    const todayEndUtc = madridLocalToUtc(addDaysToDateStr(todayStr, 1), '00:00');

    const [settings] = await db.select().from(businessSettings).limit(1);
    const activeStaff = await db.select().from(staff).where(eq(staff.isActive, true));
    const allServices = await db.select().from(services).where(isNull(services.deletedAt));

    const rangeAppts = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAtUtc, rangeStartUtc), lte(appointments.startAtUtc, rangeEndUtc)));

    const todayAppts = rangeAppts.filter(
      (a) => a.startAtUtc >= todayStartUtc && a.startAtUtc < todayEndUtc && a.status !== 'CANCELLED'
    );
    const pendingAppts = await db
      .select()
      .from(appointments)
      .where(inArray(appointments.status, ['PENDING', 'CONFIRMED']));

    const upcomingPending = pendingAppts.filter((a) => a.startAtUtc >= now);
    const cancelledInRange = rangeAppts.filter((a) => a.status === 'CANCELLED').length;

    // Real recorded payments ONLY (never assume an appointment equals collected revenue)
    const rangePayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'PAID'),
          gte(payments.paidAt, rangeStartUtc),
          lte(payments.paidAt, rangeEndUtc)
        )
      );
    const recordedRevenueCents = rangePayments.reduce((sum, p) => sum + p.amountCents, 0);

    // Customers breakdown
    const customers360 = await getAllCustomers360();
    const newCustomersCount = customers360.filter((c) => c.segments.includes('NEW')).length;
    const habitualCustomersCount = customers360.filter((c) => c.segments.includes('HABITUAL')).length;
    const inactiveAlertCount = customers360.filter((c) => c.overdueForVisit).length;

    // Occupancy today: booked minutes vs configured working minutes today
    const whToday = await db.select().from(workingHours);
    const todayDow = new Date(todayStartUtc.getTime() + 12 * 3_600_000).getUTCDay();
    let totalOpenMinutesToday = 0;
    for (const s of activeStaff) {
      const sWh =
        whToday.find((w) => w.staffId === s.id && w.dayOfWeek === todayDow) ??
        whToday.find((w) => w.staffId === null && w.dayOfWeek === todayDow);
      if (sWh && sWh.isOpen) {
        const [oh, om] = sWh.openTime.split(':').map(Number);
        const [ch, cm] = sWh.closeTime.split(':').map(Number);
        let mins = ch * 60 + cm - (oh * 60 + om);
        if (sWh.breakStart && sWh.breakEnd) {
          const [bh, bm] = sWh.breakStart.split(':').map(Number);
          const [eh, em] = sWh.breakEnd.split(':').map(Number);
          mins -= Math.max(0, eh * 60 + em - (bh * 60 + bm));
        }
        totalOpenMinutesToday += Math.max(0, mins);
      }
    }
    const bookedMinutesToday = todayAppts.reduce((sum, a) => sum + a.totalDurationMinutes, 0);
    const occupancyRate =
      totalOpenMinutesToday > 0
        ? Math.min(100, Math.round((bookedMinutesToday / totalOpenMinutesToday) * 100))
        : null;

    // Charts data from real records
    const evolutionMap = new Map<string, { date: string; total: number; completed: number; cancelled: number }>();
    for (const a of rangeAppts) {
      const d = formatDateMadrid(a.startAtUtc);
      const cur = evolutionMap.get(d) ?? { date: d, total: 0, completed: 0, cancelled: 0 };
      cur.total += 1;
      if (a.status === 'COMPLETED') cur.completed += 1;
      if (a.status === 'CANCELLED') cur.cancelled += 1;
      evolutionMap.set(d, cur);
    }

    const apptIds = rangeAppts.map((a) => a.id);
    const rangeApptSvcs =
      apptIds.length > 0
        ? await db
            .select()
            .from(appointmentServices)
            .where(inArray(appointmentServices.appointmentId, apptIds))
        : [];
    const svcDistMap = new Map<string, number>();
    for (const s of rangeApptSvcs) {
      svcDistMap.set(s.serviceNameSnapshot, (svcDistMap.get(s.serviceNameSnapshot) ?? 0) + 1);
    }

    const staffPerf = activeStaff.map((barber) => {
      const bAppts = rangeAppts.filter((a) => a.staffId === barber.id);
      const completed = bAppts.filter((a) => a.status === 'COMPLETED').length;
      return {
        staffId: barber.id,
        name: barber.name,
        totalAppointments: bAppts.filter((a) => a.status !== 'CANCELLED').length,
        completedAppointments: completed,
      };
    });

    const unreadNotifications = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(eq(notifications.status, 'QUEUED'));

    res.json({
      setupStatus: {
        isSetupComplete: settings?.isSetupComplete ?? false,
        hasActiveStaff: activeStaff.length > 0,
        hasConfiguredServices: allServices.some((s) => s.isConfigured && s.isActive),
        hasWorkingHours: whToday.some((w) => w.isOpen),
      },
      kpis: {
        todayAppointments: todayAppts.length,
        pendingUpcoming: upcomingPending.length,
        newCustomers: newCustomersCount,
        habitualCustomers: habitualCustomersCount,
        cancellationsInRange: cancelledInRange,
        occupancyRate,
        recordedRevenueCents,
        inactiveAlertCount,
        unreadNotifications: unreadNotifications[0]?.count ?? 0,
      },
      charts: {
        evolution: Array.from(evolutionMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        serviceDistribution: Array.from(svcDistMap.entries()).map(([name, count]) => ({ name, count })),
        staffPerformance: staffPerf,
      },
    });
  } catch (error: any) {
    console.error('Overview error:', error);
    res.status(500).json({ error: 'Error cargando resumen operativo.' });
  }
});

// 2. AGENDA & APPOINTMENTS
router.get('/agenda', async (req, res) => {
  try {
    const fromStr = String(req.query.from || formatDateMadrid(new Date()));
    const toStr = String(req.query.to || addDaysToDateStr(fromStr, 7));
    const staffIdFilter = req.query.staffId ? Number(req.query.staffId) : null;
    const statusFilter = req.query.status ? String(req.query.status) : null;

    const startUtc = madridLocalToUtc(fromStr, '00:00');
    const endUtc = madridLocalToUtc(addDaysToDateStr(toStr, 1), '00:00');

    const appts = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAtUtc, startUtc), lte(appointments.startAtUtc, endUtc)))
      .orderBy(appointments.startAtUtc);

    const filteredAppts = appts.filter((a) => {
      if (staffIdFilter && a.staffId !== staffIdFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });

    const custRows = await db.select().from(customers);
    const custMap = new Map(custRows.map((c) => [c.id, c]));
    const staffRows = await db.select().from(staff);
    const staffMap = new Map(staffRows.map((s) => [s.id, s]));

    const apptIds = filteredAppts.map((a) => a.id);
    const svcs =
      apptIds.length > 0
        ? await db
            .select()
            .from(appointmentServices)
            .where(inArray(appointmentServices.appointmentId, apptIds))
        : [];
    const paymentRows =
      apptIds.length > 0
        ? await db.select().from(payments).where(inArray(payments.appointmentId, apptIds))
        : [];

    const blocks = await db
      .select()
      .from(blockedSlots)
      .where(and(gte(blockedSlots.startAtUtc, startUtc), lte(blockedSlots.startAtUtc, endUtc)))
      .orderBy(blockedSlots.startAtUtc);

    res.json({
      appointments: filteredAppts.map((a) => ({
        ...a,
        dateMadrid: formatDateMadrid(a.startAtUtc),
        timeMadrid: formatTimeMadrid(a.startAtUtc),
        endTimeMadrid: formatTimeMadrid(a.endAtUtc),
        customer: custMap.get(a.customerId) ?? null,
        staff: staffMap.get(a.staffId) ?? null,
        services: svcs.filter((s) => s.appointmentId === a.id),
        payments: paymentRows.filter((p) => p.appointmentId === a.id),
      })),
      blockedSlots: blocks.map((b) => ({
        ...b,
        dateMadrid: formatDateMadrid(b.startAtUtc),
        timeMadrid: formatTimeMadrid(b.startAtUtc),
        endTimeMadrid: formatTimeMadrid(b.endAtUtc),
      })),
    });
  } catch (error: any) {
    console.error('Agenda error:', error);
    res.status(500).json({ error: 'Error cargando la agenda.' });
  }
});

// Create manual appointment from Admin Agenda
const adminCreateBookingSchema = z.object({
  serviceIds: z.array(z.number().int().positive()).min(1),
  staffId: z.number().int().positive(),
  startAtUtc: z.string().min(10),
  customerFullName: z.string().min(2),
  customerPhone: z.string().min(7),
  customerEmail: z.string().email().optional().or(z.literal('')).nullable(),
  notes: z.string().optional().nullable(),
  bypassWorkingHours: z.boolean().optional(),
});

router.post('/appointments', async (req: AuthRequest, res) => {
  try {
    const parsed = adminCreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de cita manual inválidos.' });
    }
    const d = parsed.data;
    const result = await createAtomicBooking({
      serviceIds: d.serviceIds,
      staffId: d.staffId,
      startAtUtc: d.startAtUtc,
      customer: {
        fullName: d.customerFullName,
        phone: d.customerPhone,
        email: d.customerEmail || null,
        notes: d.notes || null,
      },
      consents: {
        privacyPolicyAccepted: true,
        marketingOptIn: false,
      },
      source: 'ADMIN',
      actorRole: req.profile!.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
      actorLabel: req.profile!.email,
      bypassLeadTime: true,
      bypassWorkingHours: Boolean(d.bypassWorkingHours),
    });

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'CREATE_APPOINTMENT_MANUAL',
      entityType: 'appointment',
      entityId: String(result.appointment.id),
      details: `Cita ${result.appointment.bookingCode} creada manualmente.`,
    });

    res.status(201).json({ appointment: result.appointment });
  } catch (error: any) {
    const msg = error?.message || 'Error creando cita.';
    res.status(msg.includes('Disponibilidad') || msg.includes('bloqueada') ? 409 : 400).json({ error: msg });
  }
});

// Reschedule / edit appointment from Admin (with backend availability validation)
router.put('/appointments/:id/reschedule', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { newStartAtUtc, newStaffId, enforceWorkingHours } = req.body;
    const updated = await rescheduleAppointment({
      appointmentId: id,
      newStartAtUtc,
      newStaffId: newStaffId ? Number(newStaffId) : undefined,
      actorRole: req.profile!.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
      actorLabel: req.profile!.email,
      enforcePolicies: Boolean(enforceWorkingHours),
    });

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'RESCHEDULE_APPOINTMENT',
      entityType: 'appointment',
      entityId: String(id),
      details: `Reprogramada a ${newStartAtUtc}`,
    });

    res.json({ appointment: updated });
  } catch (error: any) {
    const msg = error?.message || 'Error reprogramando cita.';
    res.status(msg.includes('Disponibilidad') || msg.includes('bloqueada') ? 409 : 400).json({ error: msg });
  }
});

// Change appointment status (COMPLETED, NO_SHOW, CONFIRMED, PENDING, CANCELLED)
router.patch('/appointments/:id/status', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status, reason } = req.body;
    const valid = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Estado de cita no válido.' });
    }

    if (status === 'CANCELLED') {
      const result = await cancelAppointment({
        appointmentId: id,
        reason,
        actorRole: req.profile!.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
        actorLabel: req.profile!.email,
        enforcePolicy: false,
      });
      return res.json({ appointment: result.cancelled });
    }

    const [existing] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Cita no encontrada.' });
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Una cita cancelada no puede reactivarse.' });
    }

    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();

    await db.insert(appointmentEvents).values({
      appointmentId: id,
      eventType: 'STATUS_CHANGED',
      actorRole: req.profile!.role,
      actorLabel: req.profile!.email,
      previousStatus: existing.status,
      newStatus: status,
      details: reason || `Estado actualizado a ${status}`,
    });

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'UPDATE_APPOINTMENT_STATUS',
      entityType: 'appointment',
      entityId: String(id),
      details: `${existing.status} -> ${status}`,
    });

    res.json({ appointment: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error actualizando estado.' });
  }
});

// Record payment for an appointment (real revenue ledger)
router.post('/payments', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      appointmentId: z.number().int().positive(),
      amountCents: z.number().int().nonnegative(),
      method: z.enum(['CASH', 'CARD', 'BIZUM', 'OTHER']),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de pago inválidos.' });
    }

    const [appt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, parsed.data.appointmentId))
      .limit(1);
    if (!appt) return res.status(404).json({ error: 'Cita no encontrada.' });

    const [created] = await db
      .insert(payments)
      .values({
        appointmentId: appt.id,
        customerId: appt.customerId,
        amountCents: parsed.data.amountCents,
        method: parsed.data.method,
        status: 'PAID',
        notes: parsed.data.notes ?? null,
      })
      .returning();

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'RECORD_PAYMENT',
      entityType: 'payment',
      entityId: String(created.id),
      details: `Cobro registrado ${parsed.data.amountCents} céntimos (${parsed.data.method}) para cita ${appt.bookingCode}.`,
    });

    res.status(201).json({ payment: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error registrando pago.' });
  }
});

// Blocked slots (breaks, vacations, manual blocks)
router.post('/blocked-slots', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      staffId: z.number().int().positive().nullable().optional(),
      startAtUtc: z.string().min(10),
      endAtUtc: z.string().min(10),
      blockType: z.enum(['BREAK', 'BLOCKED', 'VACATION', 'MEETING']),
      title: z.string().min(2).max(120),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de bloqueo inválidos.' });
    }
    const start = new Date(parsed.data.startAtUtc);
    const end = new Date(parsed.data.endAtUtc);
    if (end <= start) {
      return res.status(400).json({ error: 'La hora de fin debe ser posterior al inicio.' });
    }

    const [created] = await db
      .insert(blockedSlots)
      .values({
        staffId: parsed.data.staffId ?? null,
        startAtUtc: start,
        endAtUtc: end,
        blockType: parsed.data.blockType,
        title: parsed.data.title,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    res.status(201).json({ blockedSlot: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error creando bloqueo.' });
  }
});

router.delete('/blocked-slots/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
  res.json({ deleted: true });
});

// 3. CRM 360°
router.get('/customers', async (_req, res) => {
  try {
    const list = await getAllCustomers360();
    res.json({ customers: list });
  } catch (error: any) {
    console.error('Customers CRM error:', error);
    res.status(500).json({ error: 'Error cargando clientes.' });
  }
});

router.get('/customers/:id', async (req, res) => {
  try {
    const detail = await getCustomer360Detail(Number(req.params.id));
    if (!detail) return res.status(404).json({ error: 'Cliente no encontrado.' });
    res.json(detail);
  } catch (error: any) {
    res.status(500).json({ error: 'Error cargando ficha del cliente.' });
  }
});

router.patch('/customers/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(30),
      email: z.string().email().optional().or(z.literal('')).nullable(),
      preferences: z.string().max(1000).optional().nullable(),
      visitCadenceDays: z.union([z.number(), z.string()]).optional().nullable(),
      relationshipStatus: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Revisa nombre, teléfono y email del cliente.' });
    }
    const { fullName, preferences, visitCadenceDays, relationshipStatus } = parsed.data;
    const phone = parsed.data.phone.replace(/[\s\-().]/g, '');
    const email = parsed.data.email?.trim().toLowerCase() || null;
    const [phoneOwner] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (phoneOwner && phoneOwner.id !== id) {
      return res.status(409).json({ error: 'Ese teléfono ya pertenece a otro cliente.' });
    }
    const [updated] = await db
      .update(customers)
      .set({
        fullName,
        phone,
        email,
        preferences: preferences ?? null,
        visitCadenceDays: visitCadenceDays ? Number(visitCadenceDays) : null,
        relationshipStatus: relationshipStatus || 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'UPDATE_CUSTOMER',
      entityType: 'customer',
      entityId: String(id),
    });

    res.json({ customer: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error actualizando cliente.' });
  }
});

// Private internal CRM notes
router.post('/customers/:id/notes', async (req: AuthRequest, res) => {
  try {
    const customerId = Number(req.params.id);
    const { noteType, content } = req.body;
    if (!content || String(content).trim().length < 2) {
      return res.status(400).json({ error: 'Escribe el contenido de la nota.' });
    }
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId,
        authorUid: req.profile!.uid,
        authorName: req.profile!.fullName || req.profile!.email,
        noteType: noteType || 'NOTE',
        content: String(content).trim(),
        isPrivate: true,
      })
      .returning();
    res.status(201).json({ note });
  } catch (error: any) {
    res.status(400).json({ error: 'Error guardando nota privada.' });
  }
});

// RGPD Customer Anonymization / Suppression (Admin only)
router.post('/customers/:id/rgpd-erase', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(customers)
      .set({
        fullName: `Cliente Suprimido #${id}`,
        phone: `SUP-${id}`,
        email: null,
        preferences: null,
        relationshipStatus: 'INACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

    await db.delete(customerNotes).where(eq(customerNotes.customerId, id));
    await db
      .update(communicationConsents)
      .set({ marketingOptIn: false, preferredChannel: 'NONE', updatedAt: new Date() })
      .where(eq(communicationConsents.customerId, id));

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'RGPD_ERASURE',
      entityType: 'customer',
      entityId: String(id),
      details: 'Supresión / anonimización RGPD ejecutada.',
    });

    res.json({ customer: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Error ejecutando supresión RGPD.' });
  }
});

// Inactive recovery campaign trigger (respects marketingOptIn!)
router.post('/crm/recovery-campaign', async (req: AuthRequest, res) => {
  try {
    const customers360 = await getAllCustomers360();
    const eligible = customers360.filter((c) => c.overdueForVisit && c.marketingOptIn);
    const skippedNoConsent = customers360.filter((c) => c.overdueForVisit && !c.marketingOptIn).length;

    const createdNotifications = [];
    for (const cust of eligible) {
      const channel = cust.email ? 'EMAIL' : 'SMS';
      const notif = await recordNotification({
        eventType: 'RECOVERY_CAMPAIGN',
        channel,
        recipient: cust.email || cust.phone,
        customerId: cust.id,
        subject: `Te echamos de menos en Barbería Segorbe`,
        body: `Hola ${cust.fullName}, han pasado ${cust.daysSinceLastVisit} días desde tu última visita.`,
      });
      createdNotifications.push(notif);
    }

    res.json({
      targetedCount: eligible.length,
      skippedWithoutConsent: skippedNoConsent,
      notifications: createdNotifications,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error generando campaña de recuperación.' });
  }
});

// 4. SERVICES CATALOG MANAGEMENT (ADMIN)
router.get('/services', async (_req, res) => {
  await ensureSystemBootstrap();
  const list = await db
    .select()
    .from(services)
    .where(isNull(services.deletedAt))
    .orderBy(services.sortOrder, services.id);
  const ss = await db.select().from(staffServices);
  res.json({
    services: list.map((s) => ({
      ...s,
      staffIds: ss.filter((x) => x.serviceId === s.id).map((x) => x.staffId),
    })),
  });
});

router.post('/services', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(2),
      priceEuros: z.number().nonnegative(),
      durationMinutes: z.number().int().min(5).max(360),
      imageUrl: z.string().optional().nullable(),
      isActive: z.boolean().default(true),
      staffIds: z.array(z.number().int().positive()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de servicio inválidos.' });
    }
    const d = parsed.data;
    const slug = `${d.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

    const [created] = await db
      .insert(services)
      .values({
        slug,
        name: d.name.trim(),
        description: d.description.trim(),
        priceCents: Math.round(d.priceEuros * 100),
        durationMinutes: d.durationMinutes,
        imageUrl: d.imageUrl || null,
        isActive: d.isActive,
        isConfigured: true,
      })
      .returning();

    if (d.staffIds && d.staffIds.length > 0) {
      await db.insert(staffServices).values(
        d.staffIds.map((staffId) => ({
          staffId,
          serviceId: created.id,
        }))
      );
    }

    res.status(201).json({ service: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error creando servicio.' });
  }
});

router.put('/services/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().min(2),
      priceEuros: z.number().nonnegative().nullable(),
      durationMinutes: z.number().int().min(5).max(360).nullable(),
      imageUrl: z.string().optional().nullable(),
      isActive: z.boolean(),
      staffIds: z.array(z.number().int().positive()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de servicio inválidos.' });
    }
    const d = parsed.data;
    const isConfigured = d.priceEuros !== null && d.durationMinutes !== null;

    const [updated] = await db
      .update(services)
      .set({
        name: d.name.trim(),
        description: d.description.trim(),
        priceCents: d.priceEuros !== null ? Math.round(d.priceEuros * 100) : null,
        durationMinutes: d.durationMinutes,
        imageUrl: d.imageUrl ?? undefined,
        isConfigured,
        isActive: isConfigured ? d.isActive : false,
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning();

    if (d.staffIds) {
      await db.delete(staffServices).where(eq(staffServices.serviceId, id));
      if (d.staffIds.length > 0) {
        await db.insert(staffServices).values(
          d.staffIds.map((staffId) => ({
            staffId,
            serviceId: id,
          }))
        );
      }
    }

    res.json({ service: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error actualizando servicio.' });
  }
});

router.delete('/services/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  // Soft-delete preserves historical appointment references
  await db
    .update(services)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(services.id, id));
  res.json({ deleted: true });
});

// 5. STAFF / TEAM MANAGEMENT
router.get('/staff', async (_req, res) => {
  const list = await db.select().from(staff).orderBy(staff.sortOrder, staff.id);
  const ss = await db.select().from(staffServices);
  const wh = await db.select().from(workingHours);
  const exceptions = await db.select().from(staffAvailability).orderBy(staffAvailability.date);

  res.json({
    staff: list.map((b) => ({
      ...b,
      serviceIds: ss.filter((x) => x.staffId === b.id).map((x) => x.serviceId),
      workingHours: wh.filter((w) => w.staffId === b.id),
      exceptions: exceptions.filter((e) => e.staffId === b.id),
    })),
    businessHolidays: exceptions.filter((e) => e.staffId === null),
  });
});

router.post('/staff', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      roleTitle: z.string().min(2).default('Barbero'),
      bio: z.string().optional().nullable(),
      specialties: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
      isActive: z.boolean().default(true),
      serviceIds: z.array(z.number().int().positive()).optional(),
      useBusinessHours: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de profesional inválidos.' });
    }
    const d = parsed.data;
    const [created] = await db
      .insert(staff)
      .values({
        name: d.name.trim(),
        roleTitle: d.roleTitle.trim(),
        bio: d.bio || null,
        specialties: d.specialties || null,
        photoUrl: d.photoUrl || null,
        isActive: d.isActive,
      })
      .returning();

    if (d.serviceIds && d.serviceIds.length > 0) {
      await db.insert(staffServices).values(
        d.serviceIds.map((serviceId) => ({
          staffId: created.id,
          serviceId,
        }))
      );
    }

    // Clone current business default working hours for this staff member
    if (d.useBusinessHours) {
      const baseHours = await db.select().from(workingHours).where(isNull(workingHours.staffId));
      if (baseHours.length > 0) {
        await db.insert(workingHours).values(
          baseHours.map((h) => ({
            staffId: created.id,
            dayOfWeek: h.dayOfWeek,
            isOpen: h.isOpen,
            openTime: h.openTime,
            closeTime: h.closeTime,
            breakStart: h.breakStart,
            breakEnd: h.breakEnd,
          }))
        );
      }
    }

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'CREATE_STAFF',
      entityType: 'staff',
      entityId: String(created.id),
      details: created.name,
    });

    res.status(201).json({ staff: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error creando profesional.' });
  }
});

router.put('/staff/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = z.object({
      name: z.string().trim().min(2).max(120),
      roleTitle: z.string().trim().min(2).max(80),
      bio: z.string().optional().nullable(),
      specialties: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
      isActive: z.boolean(),
      serviceIds: z.array(z.number().int().positive()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de profesional inválidos.' });
    }
    const { name, roleTitle, bio, specialties, photoUrl, isActive, serviceIds } = parsed.data;
    const [updated] = await db
      .update(staff)
      .set({
        name,
        roleTitle,
        bio: bio || null,
        specialties: specialties || null,
        photoUrl: photoUrl || null,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(staff.id, id))
      .returning();

    if (Array.isArray(serviceIds)) {
      await db.delete(staffServices).where(eq(staffServices.staffId, id));
      if (serviceIds.length > 0) {
        await db.insert(staffServices).values(
          serviceIds.map((serviceId) => ({
            staffId: id,
            serviceId,
          }))
        );
      }
    }

    res.json({ staff: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error actualizando profesional.' });
  }
});

router.put('/staff/:id/working-hours', requireAdmin, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const hours = req.body.hours as Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
      breakStart?: string | null;
      breakEnd?: string | null;
    }>;

    await db.delete(workingHours).where(eq(workingHours.staffId, staffId));
    if (hours.length > 0) {
      await db.insert(workingHours).values(
        hours.map((h) => ({
          staffId,
          dayOfWeek: h.dayOfWeek,
          isOpen: h.isOpen,
          openTime: h.openTime,
          closeTime: h.closeTime,
          breakStart: h.breakStart || null,
          breakEnd: h.breakEnd || null,
        }))
      );
    }

    res.json({ saved: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error guardando horario del profesional.' });
  }
});

// Holidays / days off / vacations
router.post('/availability-exceptions', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      staffId: z.number().int().positive().nullable().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      type: z.enum(['HOLIDAY', 'DAY_OFF', 'VACATION', 'CUSTOM_HOURS']),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
      reason: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos de excepción inválidos.' });
    }
    const [created] = await db
      .insert(staffAvailability)
      .values({
        staffId: parsed.data.staffId ?? null,
        date: parsed.data.date,
        type: parsed.data.type,
        startTime: parsed.data.startTime || null,
        endTime: parsed.data.endTime || null,
        reason: parsed.data.reason || null,
      })
      .returning();
    res.status(201).json({ exception: created });
  } catch (error: any) {
    res.status(400).json({ error: 'Error guardando excepción de calendario.' });
  }
});

router.delete('/availability-exceptions/:id', requireAdmin, async (req, res) => {
  await db.delete(staffAvailability).where(eq(staffAvailability.id, Number(req.params.id)));
  res.json({ deleted: true });
});

// 6. BUSINESS SETTINGS & SETUP WIZARD
router.get('/settings', async (_req, res) => {
  await ensureSystemBootstrap();
  const [settings] = await db.select().from(businessSettings).limit(1);
  const baseHours = await db
    .select()
    .from(workingHours)
    .where(isNull(workingHours.staffId))
    .orderBy(workingHours.dayOfWeek);
  const holidays = await db
    .select()
    .from(staffAvailability)
    .where(isNull(staffAvailability.staffId))
    .orderBy(staffAvailability.date);
  const userProfiles = (await db.select().from(profiles).orderBy(desc(profiles.createdAt))).map(
    ({ passwordHash: _omit, ...rest }) => rest
  );

  res.json({
    settings,
    workingHours: baseHours,
    holidays,
    userProfiles,
  });
});

router.put('/settings', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      businessName,
      city,
      address,
      phone,
      email,
      minLeadMinutes,
      maxAdvanceDays,
      cancelCutoffHours,
      rescheduleCutoffHours,
      bufferMinutes,
      defaultReturnCadenceDays,
      reminderHoursBefore,
      waitlistAutoOffer,
      legalEntityName,
      legalTaxId,
      cancellationPolicyText,
      isSetupComplete,
      workingHours: newHours,
    } = req.body;

    const [current] = await db.select().from(businessSettings).limit(1);
    if (!current) return res.status(404).json({ error: 'Configuración no encontrada.' });

    const [updated] = await db
      .update(businessSettings)
      .set({
        businessName: businessName || current.businessName,
        city: city || current.city,
        address: address || null,
        phone: phone || null,
        email: email || null,
        minLeadMinutes: Number(minLeadMinutes ?? current.minLeadMinutes),
        maxAdvanceDays: Number(maxAdvanceDays ?? current.maxAdvanceDays),
        cancelCutoffHours: Number(cancelCutoffHours ?? current.cancelCutoffHours),
        rescheduleCutoffHours: Number(rescheduleCutoffHours ?? current.rescheduleCutoffHours),
        bufferMinutes: Number(bufferMinutes ?? current.bufferMinutes),
        defaultReturnCadenceDays: Number(defaultReturnCadenceDays ?? current.defaultReturnCadenceDays),
        reminderHoursBefore: Number(reminderHoursBefore ?? current.reminderHoursBefore),
        waitlistAutoOffer: Boolean(waitlistAutoOffer ?? current.waitlistAutoOffer),
        legalEntityName: legalEntityName || null,
        legalTaxId: legalTaxId || null,
        cancellationPolicyText: cancellationPolicyText || null,
        isSetupComplete: Boolean(isSetupComplete ?? current.isSetupComplete),
        updatedAt: new Date(),
      })
      .where(eq(businessSettings.id, current.id))
      .returning();

    if (Array.isArray(newHours)) {
      await db.delete(workingHours).where(isNull(workingHours.staffId));
      await db.insert(workingHours).values(
        newHours.map((h: any) => ({
          staffId: null,
          dayOfWeek: Number(h.dayOfWeek),
          isOpen: Boolean(h.isOpen),
          openTime: String(h.openTime || '09:30'),
          closeTime: String(h.closeTime || '20:00'),
          breakStart: h.breakStart || null,
          breakEnd: h.breakEnd || null,
        }))
      );
    }

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'UPDATE_SETTINGS',
      entityType: 'business_settings',
      entityId: String(updated.id),
    });

    res.json({ settings: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error guardando configuración.' });
  }
});

// Create a local user account (ADMIN only)
router.post('/profiles', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      fullName: z.string().min(2).max(120),
      password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(200),
      role: z.enum(['ADMIN', 'STAFF']),
      staffId: z.number().int().positive().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || 'Datos de usuario inválidos.' });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const [exists] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });

    const [created] = await db
      .insert(profiles)
      .values({
        uid: `local-${crypto.randomUUID()}`,
        email,
        fullName: parsed.data.fullName.trim(),
        passwordHash: hashPassword(parsed.data.password),
        role: parsed.data.role,
        staffId: parsed.data.staffId ?? null,
      })
      .returning();

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'CREATE_USER',
      entityType: 'profile',
      entityId: String(created.id),
      details: `${email} (${parsed.data.role})`,
    });

    const { passwordHash: _omit, ...safe } = created;
    res.status(201).json({ profile: safe });
  } catch (error: any) {
    res.status(400).json({ error: 'Error creando usuario.' });
  }
});

// Reset a user's password (ADMIN only)
router.post('/profiles/:id/password', requireAdmin, async (req: AuthRequest, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }
  const id = Number(req.params.id);
  const [updated] = await db
    .update(profiles)
    .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
    .where(eq(profiles.id, id))
    .returning({ id: profiles.id });
  if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });
  await recordAdminAudit({
    actorUid: req.profile!.uid,
    actorEmail: req.profile!.email,
    actorRole: req.profile!.role,
    action: 'RESET_PASSWORD',
    entityType: 'profile',
    entityId: String(id),
  });
  res.json({ ok: true });
});

// Manage user roles (ADMIN only)
router.patch('/profiles/:id/role', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { role, staffId } = req.body;
    if (!['ADMIN', 'STAFF', 'CUSTOMER'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }
    if (id === req.profile!.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administrador.' });
    }
    const [updated] = await db
      .update(profiles)
      .set({ role, staffId: staffId ?? null, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado.' });

    await recordAdminAudit({
      actorUid: req.profile!.uid,
      actorEmail: req.profile!.email,
      actorRole: req.profile!.role,
      action: 'UPDATE_USER_ROLE',
      entityType: 'profile',
      entityId: String(id),
      details: `Role -> ${role}`,
    });

    const { passwordHash: _omit, ...safe } = updated;
    res.json({ profile: safe });
  } catch (error: any) {
    res.status(400).json({ error: 'Error actualizando permisos.' });
  }
});

// 7. NOTIFICATIONS, WAITLIST & AUDIT LOGS
router.get('/notifications', async (_req, res) => {
  const list = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
  const wl = await db.select().from(waitlist).orderBy(desc(waitlist.createdAt)).limit(100);
  const custs = await db.select().from(customers);
  const svcs = await db.select().from(services);
  const custMap = new Map(custs.map((c) => [c.id, c]));
  const svcMap = new Map(svcs.map((s) => [s.id, s.name]));

  res.json({
    notifications: list,
    waitlist: wl.map((w) => ({
      ...w,
      customerName: custMap.get(w.customerId)?.fullName ?? 'Cliente',
      customerPhone: custMap.get(w.customerId)?.phone ?? '',
      serviceName: svcMap.get(w.serviceId) ?? 'Servicio',
    })),
  });
});

router.post('/notifications/:id/read', async (req, res) => {
  await db
    .update(notifications)
    .set({ status: 'READ' })
    .where(eq(notifications.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.get('/reports', async (req, res) => {
  try {
    const fromStr = String(req.query.from || addDaysToDateStr(formatDateMadrid(new Date()), -30));
    const toStr = String(req.query.to || formatDateMadrid(new Date()));
    const startUtc = madridLocalToUtc(fromStr, '00:00');
    const endUtc = madridLocalToUtc(addDaysToDateStr(toStr, 1), '00:00');

    const appts = await db
      .select()
      .from(appointments)
      .where(and(gte(appointments.startAtUtc, startUtc), lte(appointments.startAtUtc, endUtc)));

    const payRows = await db
      .select()
      .from(payments)
      .where(and(gte(payments.paidAt, startUtc), lte(payments.paidAt, endUtc)));

    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(60);

    res.json({
      range: { from: fromStr, to: toStr },
      summary: {
        totalAppointments: appts.length,
        completed: appts.filter((a) => a.status === 'COMPLETED').length,
        confirmed: appts.filter((a) => a.status === 'CONFIRMED').length,
        cancelled: appts.filter((a) => a.status === 'CANCELLED').length,
        noShow: appts.filter((a) => a.status === 'NO_SHOW').length,
        totalPaidCents: payRows
          .filter((p) => p.status === 'PAID')
          .reduce((acc, p) => acc + p.amountCents, 0),
        paymentCount: payRows.length,
      },
      payments: payRows,
      auditLogs: logs,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error generando informes.' });
  }
});

export default router;
