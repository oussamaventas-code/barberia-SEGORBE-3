import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, runMigrations } from '../db/index.ts';
import {
  appointmentEvents,
  appointments,
  appointmentServices,
  auditLogs,
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
import { hashPassword } from '../lib/session.ts';
import {
  addDaysToDateStr,
  formatDateMadrid,
  getDayOfWeekMadrid,
  madridLocalToUtc,
  minutesToTime,
  timeToMinutes,
} from '../lib/timezone.ts';

/**
 * Arranque de la base de datos local:
 * 1. Aplica migraciones.
 * 2. Si la base está vacía, carga la configuración del negocio y (salvo DEMO_SEED=false)
 *    un conjunto de datos de demostración realista: equipo, servicios, clientes, citas
 *    pasadas y futuras, cobros, notas de CRM y lista de espera.
 * 3. Garantiza que existe al menos un usuario ADMIN para poder entrar al panel.
 */

export const DEMO_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@barberiasegorbe.demo').toLowerCase();
export const DEMO_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'segorbe2026';
export const DEMO_STAFF_EMAIL = 'barbero@barberiasegorbe.demo';
export const DEMO_STAFF_PASSWORD = 'barbero2026';

// Horario real (ficha de Google): L-V 10:00–14:00 y 16:30–20:30 · sábado y domingo cerrado
const DEFAULT_SCHEDULE = [
  { dayOfWeek: 1, isOpen: true, openTime: '10:00', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
  { dayOfWeek: 2, isOpen: true, openTime: '10:00', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
  { dayOfWeek: 3, isOpen: true, openTime: '10:00', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
  { dayOfWeek: 4, isOpen: true, openTime: '10:00', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
  { dayOfWeek: 5, isOpen: true, openTime: '10:00', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
  { dayOfWeek: 6, isOpen: false, openTime: '10:00', closeTime: '14:00', breakStart: null, breakEnd: null },
  { dayOfWeek: 0, isOpen: false, openTime: '10:00', closeTime: '14:00', breakStart: null, breakEnd: null },
];

const SERVICE_CATALOG = [
  {
    slug: 'corte-de-pelo',
    name: 'Corte de pelo',
    description: 'Corte contemporáneo adaptado a tu fisonomía y textura, con tijera y máquina. Incluye lavado y peinado.',
    priceCents: 1800,
    durationMinutes: 30,
    imageUrl: '/images/service_haircut.jpg',
  },
  {
    slug: 'arreglo-de-barba',
    name: 'Arreglo de barba',
    description: 'Perfilado de líneas, rebaje simétrico, toalla caliente y acabado a navaja.',
    priceCents: 1200,
    durationMinutes: 20,
    imageUrl: '/images/service_beard.jpg',
  },
  {
    slug: 'corte-y-barba',
    name: 'Corte + barba',
    description: 'La sesión completa: diseño de corte y ritual de barba en una sola cita.',
    priceCents: 2600,
    durationMinutes: 45,
    imageUrl: '/images/service_combo.jpg',
  },
  {
    slug: 'degradado-skin-fade',
    name: 'Degradado / Skin fade',
    description: 'Degradado a cero con transición limpia y detalle de contornos a navaja.',
    priceCents: 2000,
    durationMinutes: 40,
    imageUrl: '/images/service_haircut.jpg',
  },
  {
    slug: 'afeitado-clasico',
    name: 'Afeitado clásico',
    description: 'Afeitado tradicional a navaja con toallas calientes, aceite pre-afeitado y bálsamo.',
    priceCents: 1500,
    durationMinutes: 30,
    imageUrl: '/images/service_beard.jpg',
  },
  {
    slug: 'corte-infantil',
    name: 'Corte infantil',
    description: 'Corte para menores de 12 años, con paciencia y buen ambiente.',
    priceCents: 1300,
    durationMinutes: 25,
    imageUrl: '/images/service_combo.jpg',
  },
];

const TEAM = [
  {
    name: 'Álex Segorbe',
    roleTitle: 'Fundador · Master barber',
    bio: 'Más de 12 años detrás de la silla. Obsesionado con la precisión y el detalle.',
    specialties: 'Cortes clásicos, tijera, barbas largas',
    services: ['corte-de-pelo', 'arreglo-de-barba', 'corte-y-barba', 'afeitado-clasico', 'degradado-skin-fade'],
  },
  {
    name: 'Javi Morales',
    roleTitle: 'Barbero senior',
    bio: 'Especialista en degradados y diseños urbanos. Formado en Madrid y Londres.',
    specialties: 'Skin fade, diseños, texturizados',
    services: ['corte-de-pelo', 'arreglo-de-barba', 'corte-y-barba', 'degradado-skin-fade', 'corte-infantil'],
  },
  {
    name: 'Nico Ruiz',
    roleTitle: 'Barbero',
    bio: 'La nueva generación de Barbería Segorbe. Tendencias, buen rollo y mano firme.',
    specialties: 'Cortes modernos, crop, infantil',
    services: ['corte-de-pelo', 'arreglo-de-barba', 'degradado-skin-fade', 'corte-infantil'],
  },
];

const FIRST_NAMES = [
  'Carlos', 'David', 'Pablo', 'Sergio', 'Alejandro', 'Daniel', 'Adrián', 'Javier', 'Iván', 'Rubén',
  'Manuel', 'Hugo', 'Marcos', 'Raúl', 'Antonio', 'Diego', 'Álvaro', 'Óscar', 'Jorge', 'Luis',
  'Francisco', 'Mario', 'Víctor', 'Samuel', 'Gonzalo', 'Enrique', 'Andrés', 'Miguel Ángel', 'José',
  'Fernando', 'Alberto', 'Ignacio', 'Rafael', 'Joaquín', 'Pedro', 'Ángel', 'Lucas', 'Martín', 'Izan', 'Mohamed',
];
const LAST_NAMES = [
  'Martínez', 'López', 'García', 'Fernández', 'Sánchez', 'Pérez', 'Gómez', 'Navarro', 'Romero', 'Torres',
  'Ruiz', 'Molina', 'Ortega', 'Castillo', 'Jiménez', 'Moreno', 'Serrano', 'Ramos', 'Gil', 'Marín',
  'Cano', 'Herrera', 'Medina', 'Iglesias', 'Vidal', 'Blanco', 'Cortés', 'Sáez', 'Hernández', 'Pastor',
];
const CUSTOMER_COUNT = 220;

/** PRNG determinista (mulberry32) para que la demo sea siempre igual. */
function createRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CS-';
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(0, chars.length)];
  return code;
}

let initializedPromise: Promise<void> | null = null;

export function ensureSystemBootstrap(): Promise<void> {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      await runMigrations();
      const existing = await db.select().from(businessSettings).limit(1);
      if (existing.length === 0) {
        if (process.env.DEMO_SEED === 'false') {
          await seedBaseConfiguration();
        } else {
          await seedDemoData();
        }
      }
      await ensureAdminAccount();
    })().catch((error) => {
      initializedPromise = null;
      console.error('Bootstrap error:', error);
      throw new Error('Error inicializando la base de datos local.', { cause: error });
    });
  }
  return initializedPromise;
}

async function ensureAdminAccount() {
  const [admin] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.role, 'ADMIN'));
  if ((admin?.count ?? 0) > 0) return;
  await db
    .insert(profiles)
    .values({
      uid: `local-${crypto.randomUUID()}`,
      email: DEMO_ADMIN_EMAIL,
      fullName: 'Administración Barbería Segorbe',
      passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
      role: 'ADMIN',
    })
    .onConflictDoNothing();
}

/** Solo configuración mínima operativa (sin clientes ni citas). */
async function seedBaseConfiguration() {
  await db.transaction(async (tx) => {
    await tx.insert(businessSettings).values({
      businessName: 'Barbería Segorbe',
      city: 'Murcia',
      minLeadMinutes: 30,
      cancelCutoffHours: 2,
      rescheduleCutoffHours: 2,
      isSetupComplete: true,
    });
    const svcRows = await tx
      .insert(services)
      .values(SERVICE_CATALOG.slice(0, 3).map((s, i) => ({ ...s, isActive: true, isConfigured: true, sortOrder: i + 1 })))
      .returning();
    await tx.insert(workingHours).values(DEFAULT_SCHEDULE.map((d) => ({ staffId: null, ...d })));
    const [barber] = await tx
      .insert(staff)
      .values({ name: TEAM[0].name, roleTitle: TEAM[0].roleTitle, bio: TEAM[0].bio, specialties: TEAM[0].specialties, sortOrder: 1 })
      .returning();
    await tx.insert(staffServices).values(svcRows.map((s) => ({ staffId: barber.id, serviceId: s.id })));
  });
}

/** Datos de demostración completos. */
async function seedDemoData() {
  const rng = createRng(20261112);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const now = new Date();
  const today = formatDateMadrid(now);

  console.log('[demo] Cargando datos de demostración en la base de datos local…');

  await db.transaction(async (tx) => {
    await tx.insert(businessSettings).values({
      businessName: 'Barbería Segorbe',
      city: 'Murcia',
      address: 'C. Jesús Esteban, 30009 Murcia',
      phone: '+34 643 11 28 58',
      email: null,
      minLeadMinutes: 30,
      maxAdvanceDays: 30,
      cancelCutoffHours: 2,
      rescheduleCutoffHours: 2,
      bufferMinutes: 0,
      defaultReturnCadenceDays: 28,
      reminderHoursBefore: 24,
      legalEntityName: 'Barbería Segorbe',
      legalTaxId: null,
      cancellationPolicyText:
        'Puedes cancelar o cambiar tu cita gratis hasta 2 horas antes desde el enlace de tu reserva. Si no puedes venir, avísanos: otro cliente podrá aprovechar el hueco.',
      isSetupComplete: true,
    });

    // Servicios
    const svcRows = await tx
      .insert(services)
      .values(SERVICE_CATALOG.map((s, i) => ({ ...s, isActive: true, isConfigured: true, sortOrder: i + 1 })))
      .returning();
    const svcBySlug = new Map(svcRows.map((s) => [s.slug, s]));

    // Horario general
    await tx.insert(workingHours).values(DEFAULT_SCHEDULE.map((d) => ({ staffId: null, ...d })));

    // Equipo
    const staffRows = [];
    for (const [i, member] of TEAM.entries()) {
      const [row] = await tx
        .insert(staff)
        .values({ name: member.name, roleTitle: member.roleTitle, bio: member.bio, specialties: member.specialties, sortOrder: i + 1 })
        .returning();
      staffRows.push({ row, services: member.services });
      await tx.insert(staffServices).values(member.services.map((slug) => ({ staffId: row.id, serviceId: svcBySlug.get(slug)!.id })));
      // Nico descansa los lunes: horario propio
      const schedule = DEFAULT_SCHEDULE.map((d) =>
        i === 2 && d.dayOfWeek === 1 ? { ...d, isOpen: false } : d
      );
      await tx.insert(workingHours).values(schedule.map((d) => ({ staffId: row.id, ...d })));
    }

    // Festivo local y vacaciones de ejemplo
    const isWeekday = (d: string) => ![0, 6].includes(getDayOfWeekMadrid(d));
    const holidayDate = [20, 21, 22].map((d) => addDaysToDateStr(today, d)).find(isWeekday)!;
    const javiDayOff = [9, 10, 11].map((d) => addDaysToDateStr(today, d)).find(isWeekday)!;
    await tx.insert(staffAvailability).values([
      {
        staffId: null,
        date: holidayDate,
        type: 'HOLIDAY',
        reason: 'Festivo local (demo)',
      },
      {
        staffId: staffRows[1].row.id,
        date: javiDayOff,
        type: 'DAY_OFF',
        reason: 'Asuntos propios',
      },
    ]);

    // Clientes
    const customerRows = [];
    const usedNames = new Set<string>(['Carlos Martínez']);
    const customerNames = ['Carlos Martínez'];
    while (customerNames.length < CUSTOMER_COUNT) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        customerNames.push(name);
      }
    }
    const usedPhones = new Set<string>(['600111222']);
    for (const [i, name] of customerNames.entries()) {
      let phone = '600111222';
      if (i > 0) {
        do phone = `6${String(10000000 + Math.floor(rng() * 89999999))}`;
        while (usedPhones.has(phone));
        usedPhones.add(phone);
      }
      const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(' ');
      const createdAt = new Date(now.getTime() - (70 + Math.floor(rng() * 200)) * 86_400_000);
      const [row] = await tx
        .insert(customers)
        .values({
          publicCode: `CL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          fullName: name,
          phone,
          email: rng() < 0.7 ? `${slug[0]}.${slug[slug.length - 1]}@correo.demo` : null,
          preferredStaffId: rng() < 0.6 ? pick(staffRows).row.id : null,
          preferences: rng() < 0.35 ? pick(['Degradado bajo, número 1 en laterales', 'Barba perfilada, sin bigote corto', 'Le gusta charlar de fútbol', 'Piel sensible: sin alcohol tras el afeitado', 'Siempre café solo']) : null,
          relationshipStatus: 'ACTIVE',
          createdAt,
        })
        .returning();
      customerRows.push(row);
      const marketing = rng() < 0.6;
      await tx.insert(communicationConsents).values({
        customerId: row.id,
        privacyPolicyAccepted: true,
        privacyPolicyAcceptedAt: createdAt,
        marketingOptIn: marketing,
        marketingOptInAt: marketing ? createdAt : null,
        preferredChannel: marketing ? pick(['WHATSAPP', 'EMAIL', 'SMS']) : 'NONE',
      });
    }

    // Agenda: ocupación por profesional y día para evitar solapes
    const occupied = new Map<string, Array<[number, number]>>();
    const isFree = (staffId: number, date: string, start: number, end: number) =>
      !(occupied.get(`${staffId}:${date}`) ?? []).some(([s, e]) => start < e && end > s);
    const occupy = (staffId: number, date: string, start: number, end: number) => {
      const key = `${staffId}:${date}`;
      occupied.set(key, [...(occupied.get(key) ?? []), [start, end]]);
    };

    const schedFor = (staffIndex: number, date: string) => {
      const dow = getDayOfWeekMadrid(date);
      const d = DEFAULT_SCHEDULE.find((x) => x.dayOfWeek === dow)!;
      if (!d.isOpen || (staffIndex === 2 && dow === 1)) return [];
      if (date === holidayDate || (staffIndex === 1 && date === javiDayOff)) return [];
      const open = timeToMinutes(d.openTime);
      const close = timeToMinutes(d.closeTime);
      if (d.breakStart && d.breakEnd) {
        return [
          [open, timeToMinutes(d.breakStart)],
          [timeToMinutes(d.breakEnd), close],
        ] as Array<[number, number]>;
      }
      return [[open, close]] as Array<[number, number]>;
    };

    // Cliente habitual con patrón de visitas regular (para segmentación CRM)
    const loyalty = customerRows.map(() => 0.15 + rng() * 0.85);
    // Algunos clientes "perdidos": dejaron de venir hace tiempo
    const lostCustomers = new Set(customerRows.filter((_, i) => i > 0 && i % 13 === 0).map((c) => c.id));
    // Cada cliente tiene como mucho una cita futura activa
    const hasUpcoming = new Set<number>();
    // Separación mínima entre visitas de un mismo cliente (días)
    const lastVisitOffset = new Map<number, number>();

    let demoBookingAssigned = false;

    const createAppt = async (opts: {
      date: string;
      staffIndex: number;
      startMin: number;
      serviceSlugs: string[];
      customer: (typeof customerRows)[number];
      status: 'COMPLETED' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW';
      code?: string;
      token?: string;
    }) => {
      const { row: barber } = staffRows[opts.staffIndex];
      const svcs = opts.serviceSlugs.map((s) => svcBySlug.get(s)!);
      const duration = svcs.reduce((acc, s) => acc + s.durationMinutes!, 0);
      const price = svcs.reduce((acc, s) => acc + s.priceCents!, 0);
      const startAtUtc = madridLocalToUtc(opts.date, minutesToTime(opts.startMin));
      const endAtUtc = new Date(startAtUtc.getTime() + duration * 60_000);
      const createdAt = new Date(Math.min(startAtUtc.getTime() - (1 + Math.floor(rng() * 6)) * 86_400_000, now.getTime() - 3_600_000));
      const [appt] = await tx
        .insert(appointments)
        .values({
          bookingCode: opts.code ?? bookingCode(),
          accessToken: opts.token ?? crypto.randomBytes(20).toString('hex'),
          customerId: opts.customer.id,
          staffId: barber.id,
          startAtUtc,
          endAtUtc,
          status: opts.status,
          totalPriceCents: price,
          totalDurationMinutes: duration,
          source: rng() < 0.8 ? 'WEB' : 'ADMIN',
          cancelledAt: opts.status === 'CANCELLED' ? new Date(startAtUtc.getTime() - 20 * 3_600_000) : null,
          cancellationReason: opts.status === 'CANCELLED' ? pick(['Me ha surgido un imprevisto', 'Viaje de trabajo', 'Estoy enfermo']) : null,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      await tx.insert(appointmentServices).values(
        svcs.map((s) => ({
          appointmentId: appt.id,
          serviceId: s.id,
          serviceNameSnapshot: s.name,
          priceCentsSnapshot: s.priceCents,
          durationMinutesSnapshot: s.durationMinutes!,
        }))
      );
      await tx.insert(appointmentEvents).values({
        appointmentId: appt.id,
        eventType: 'CREATED',
        actorRole: 'CUSTOMER',
        actorLabel: opts.customer.fullName,
        newStatus: 'CONFIRMED',
        details: `Reserva ${appt.bookingCode} confirmada con ${barber.name}.`,
        createdAt,
      });
      if (opts.status !== 'CONFIRMED') {
        await tx.insert(appointmentEvents).values({
          appointmentId: appt.id,
          eventType: opts.status === 'CANCELLED' ? 'CANCELLED' : 'STATUS_CHANGED',
          actorRole: opts.status === 'CANCELLED' ? 'CUSTOMER' : 'STAFF',
          actorLabel: opts.status === 'CANCELLED' ? opts.customer.fullName : barber.name,
          previousStatus: 'CONFIRMED',
          newStatus: opts.status,
          details: opts.status === 'COMPLETED' ? 'Servicio completado.' : opts.status === 'NO_SHOW' ? 'El cliente no se presentó.' : 'Cancelación registrada.',
          createdAt: opts.status === 'CANCELLED' ? appt.cancelledAt! : endAtUtc,
        });
      }
      if (opts.status === 'COMPLETED') {
        await tx.insert(payments).values({
          appointmentId: appt.id,
          customerId: opts.customer.id,
          amountCents: price,
          method: pick(['CARD', 'CARD', 'CASH', 'BIZUM']),
          status: 'PAID',
          paidAt: endAtUtc,
          createdAt: endAtUtc,
        });
      }
      return appt;
    };

    const comboOptions: string[][] = [
      ['corte-de-pelo'], ['corte-de-pelo'], ['corte-de-pelo'], ['corte-y-barba'], ['corte-y-barba'],
      ['arreglo-de-barba'], ['degradado-skin-fade'], ['degradado-skin-fade'], ['afeitado-clasico'], ['corte-infantil'],
    ];

    for (let offset = -75; offset <= 14; offset++) {
      const date = addDaysToDateStr(today, offset);
      const isPast = offset < 0;
      const isToday = offset === 0;
      for (let si = 0; si < staffRows.length; si++) {
        const windows = schedFor(si, date);
        if (windows.length === 0) continue;
        // Más ocupación en pasado reciente y días cercanos; los viernes y sábados, a tope
        const dow = getDayOfWeekMadrid(date);
        const baseRate = dow === 5 ? 0.75 : dow === 4 ? 0.62 : 0.5;
        const rate = isPast ? baseRate : Math.max(0.15, baseRate - offset * 0.035);
        for (const [wStart, wEnd] of windows) {
          for (let m = wStart; m < wEnd; m += 15) {
            if (rng() > rate * 0.6) continue;
            const combo = pick(comboOptions).filter((slug) => staffRows[si].services.includes(slug));
            if (combo.length === 0) continue;
            const duration = combo.reduce((acc, s) => acc + svcBySlug.get(s)!.durationMinutes!, 0);
            if (m + duration > wEnd || !isFree(staffRows[si].row.id, date, m, m + duration)) continue;

            const startUtc = madridLocalToUtc(date, minutesToTime(m));
            const inPast = startUtc.getTime() < now.getTime();
            if (!inPast && startUtc.getTime() < now.getTime() + 45 * 60_000) continue;

            let customer = customerRows[1 + Math.floor(rng() * (customerRows.length - 1))];
            // Cita de demostración fija para el área de cliente (Carlos Martínez · 600111222)
            const makeDemo = !demoBookingAssigned && offset >= 2 && !isToday;
            let tries = 0;
            while (!makeDemo && tries < 5 && (rng() > loyalty[customerRows.indexOf(customer)] || (lostCustomers.has(customer.id) && offset > -40))) {
              customer = customerRows[1 + Math.floor(rng() * (customerRows.length - 1))];
              tries++;
            }
            if (makeDemo) customer = customerRows[0];
            // Carlos viene cada ~3 semanas en el pasado
            else if (inPast && offset % 21 === 0 && offset <= -14 && si === 0) customer = customerRows[0];
            if (lostCustomers.has(customer.id) && offset > -40) continue;
            if (!makeDemo && customer.id === customerRows[0].id && !inPast) continue; // su cita futura es la demo
            const prev = lastVisitOffset.get(customer.id);
            if (prev !== undefined && offset - prev < 10) continue;
            if (!inPast && hasUpcoming.has(customer.id)) continue;

            let status: 'COMPLETED' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' = 'CONFIRMED';
            if (inPast) {
              const r = rng();
              status = r < 0.86 ? 'COMPLETED' : r < 0.95 ? 'CANCELLED' : 'NO_SHOW';
            } else if (!isToday && rng() < 0.05) {
              status = 'CANCELLED';
            }

            // Cita de demostración fija para el área de cliente
            let code: string | undefined;
            let token: string | undefined;
            if (makeDemo) {
              status = 'CONFIRMED';
              code = 'CS-DEMO26';
              token = 'demo-token-barberia-segorbe-2026';
              demoBookingAssigned = true;
            }

            await createAppt({ date, staffIndex: si, startMin: m, serviceSlugs: combo, customer, status, code, token });
            if (status !== 'CANCELLED') lastVisitOffset.set(customer.id, offset);
            if (!inPast && status === 'CONFIRMED') hasUpcoming.add(customer.id);
            if (status !== 'CANCELLED') occupy(staffRows[si].row.id, date, m, m + duration);
            m += duration - 15;
          }
        }
      }
    }

    // Notas privadas de CRM
    const noteSamples: Array<[number, string, string]> = [
      [0, 'PREFERENCE', 'Prefiere degradado medio y nuca recta. Viene cada 3-4 semanas.'],
      [1, 'NOTE', 'Recomendado por Carlos Martínez. Interesado en el bono mensual.'],
      [3, 'INCIDENT', 'Llegó 20 min tarde; se le atendió igualmente. Avisar del margen de cortesía.'],
      [13, 'NOTE', 'No viene desde hace más de un mes. Buen candidato para la campaña de recuperación.'],
      [8, 'PREFERENCE', 'Alergia a ciertos aftershaves: usar bálsamo neutro.'],
    ];
    for (const [idx, type, content] of noteSamples) {
      await tx.insert(customerNotes).values({
        customerId: customerRows[idx].id,
        authorUid: 'seed',
        authorName: 'Álex Segorbe',
        noteType: type,
        content,
      });
    }

    // Lista de espera
    await tx.insert(waitlist).values([
      {
        customerId: customerRows[9].id,
        serviceId: svcBySlug.get('corte-y-barba')!.id,
        staffId: staffRows[0].row.id,
        preferredDate: addDaysToDateStr(today, 1),
        timeWindowStart: '17:00',
        timeWindowEnd: '20:00',
        status: 'WAITING',
      },
      {
        customerId: customerRows[14].id,
        serviceId: svcBySlug.get('degradado-skin-fade')!.id,
        preferredDate: addDaysToDateStr(today, 3),
        status: 'WAITING',
      },
    ]);

    // Notificaciones internas recientes
    await tx.insert(notifications).values([
      {
        eventType: 'NEW_CUSTOMER',
        channel: 'INTERNAL',
        recipient: 'CRM',
        customerId: customerRows[CUSTOMER_COUNT - 1].id,
        subject: `Nuevo cliente registrado: ${customerRows[CUSTOMER_COUNT - 1].fullName}`,
        body: 'Alta automática desde la reserva online.',
        status: 'QUEUED',
        provider: 'ADMIN_CENTER',
      },
      {
        eventType: 'NEW_BOOKING',
        channel: 'INTERNAL',
        recipient: 'Lista de espera',
        customerId: customerRows[9].id,
        subject: 'Nueva solicitud en lista de espera',
        body: `${customerRows[9].fullName} espera hueco para mañana por la tarde.`,
        status: 'QUEUED',
        provider: 'ADMIN_CENTER',
      },
    ]);

    // Usuarios del panel
    await tx.insert(profiles).values([
      {
        uid: `local-${crypto.randomUUID()}`,
        email: DEMO_ADMIN_EMAIL,
        fullName: 'Álex Segorbe',
        passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
        role: 'ADMIN',
        staffId: staffRows[0].row.id,
      },
      {
        uid: `local-${crypto.randomUUID()}`,
        email: DEMO_STAFF_EMAIL,
        fullName: 'Javi Morales',
        passwordHash: hashPassword(DEMO_STAFF_PASSWORD),
        role: 'STAFF',
        staffId: staffRows[1].row.id,
      },
    ]);

    await tx.insert(auditLogs).values({
      actorRole: 'SYSTEM',
      action: 'DEMO_SEED',
      entityType: 'database',
      details: 'Base de datos local inicializada con datos de demostración.',
    });
  });

  // Ajusta el estado de relación según el historial
  const counts = await db
    .select({ customerId: appointments.customerId, n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(eq(appointments.status, 'COMPLETED'))
    .groupBy(appointments.customerId);
  for (const c of counts) {
    await db
      .update(customers)
      .set({ relationshipStatus: c.n >= 5 ? 'FREQUENT' : c.n >= 2 ? 'ACTIVE' : 'NEW' })
      .where(eq(customers.id, c.customerId));
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(appointments);
  console.log(`[demo] Datos cargados: ${CUSTOMER_COUNT} clientes, ${TEAM.length} barberos, ${n} citas.`);
}
