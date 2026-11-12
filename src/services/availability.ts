import { and, eq, gt, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { db, type DbExecutor } from '../db/index.ts';
import {
  appointments,
  blockedSlots,
  businessSettings,
  services,
  staff,
  staffAvailability,
  staffServices,
  workingHours,
} from '../db/schema.ts';
import {
  addDaysToDateStr,
  formatDateMadrid,
  formatTimeMadrid,
  getDayOfWeekMadrid,
  madridLocalToUtc,
  minutesToTime,
  timeToMinutes,
} from '../lib/timezone.ts';

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  timeLabel: string; // HH:MM in Europe/Madrid
  staffId: number;
  staffName: string;
}

export interface DayAvailabilitySummary {
  date: string; // YYYY-MM-DD
  available: boolean;
  slotsCount: number;
  reason?: string;
}

export interface AvailabilityWindowResult {
  startDate: string;
  daysCount: number;
  days: DayAvailabilitySummary[];
  slotsByDate: Record<string, AvailableSlot[]>;
}

const CACHE_TTL_MS = 15_000;
let cacheEpoch = 1;
const windowCache = new Map<string, { expiresAt: number; data: AvailabilityWindowResult }>();
const inFlightWindow = new Map<string, Promise<AvailabilityWindowResult>>();

export function getAvailabilityCacheEpoch(): number {
  return cacheEpoch;
}

export function invalidateAvailabilityCache(): void {
  cacheEpoch += 1;
  windowCache.clear();
  inFlightWindow.clear();
}

export async function getActiveBusinessSettings() {
  const rows = await db.select().from(businessSettings).limit(1);
  return rows[0];
}

/**
 * Resolves effective service duration and price for a given staff member (if any).
 */
export async function resolveServiceForStaff(
  serviceIds: number[],
  staffId?: number,
  exec: DbExecutor = db
) {
  const svcRows = await exec
    .select()
    .from(services)
    .where(and(inArray(services.id, serviceIds), isNull(services.deletedAt)));

  if (svcRows.length !== serviceIds.length) {
    throw new Error('Uno o más servicios seleccionados no existen.');
  }

  for (const svc of svcRows) {
    if (!svc.isConfigured || !svc.isActive || svc.durationMinutes == null || svc.priceCents == null) {
      throw new Error(`El servicio "${svc.name}" no está activo o tiene tarifa/duración pendiente.`);
    }
  }

  let customMap = new Map<number, { customDurationMinutes: number | null; customPriceCents: number | null }>();
  if (staffId) {
    const ssRows = await exec
      .select()
      .from(staffServices)
      .where(and(eq(staffServices.staffId, staffId), inArray(staffServices.serviceId, serviceIds)));
    if (ssRows.length !== serviceIds.length) {
      return null; // Staff does not perform all requested services
    }
    for (const row of ssRows) {
      customMap.set(row.serviceId, {
        customDurationMinutes: row.customDurationMinutes,
        customPriceCents: row.customPriceCents,
      });
    }
  }

  let totalDurationMinutes = 0;
  let totalPriceCents = 0;
  const resolved = svcRows.map((svc) => {
    const custom = customMap.get(svc.id);
    const dur = custom?.customDurationMinutes ?? svc.durationMinutes!;
    const price = custom?.customPriceCents ?? svc.priceCents!;
    totalDurationMinutes += dur;
    totalPriceCents += price;
    return {
      serviceId: svc.id,
      name: svc.name,
      durationMinutes: dur,
      priceCents: price,
    };
  });

  return { resolved, totalDurationMinutes, totalPriceCents };
}

function computeWindowsFromPreloaded(
  staffId: number,
  dateStr: string,
  exceptions: Array<typeof staffAvailability.$inferSelect>,
  allWorkingHours: Array<typeof workingHours.$inferSelect>
): Array<{ startMin: number; endMin: number }> {
  const dayOfWeek = getDayOfWeekMadrid(dateStr);

  const businessHoliday = exceptions.find(
    (e) => e.date === dateStr && e.staffId === null && e.type === 'HOLIDAY'
  );
  if (businessHoliday) return [];

  const staffExc = exceptions.find((e) => e.date === dateStr && e.staffId === staffId);
  if (staffExc) {
    if (staffExc.type === 'DAY_OFF' || staffExc.type === 'VACATION' || staffExc.type === 'HOLIDAY') {
      return [];
    }
    if (staffExc.type === 'CUSTOM_HOURS' && staffExc.startTime && staffExc.endTime) {
      return [{ startMin: timeToMinutes(staffExc.startTime), endMin: timeToMinutes(staffExc.endTime) }];
    }
  }

  const staffWh = allWorkingHours.find(
    (w) => w.staffId === staffId && w.dayOfWeek === dayOfWeek
  );
  const effectiveWh =
    staffWh ?? allWorkingHours.find((w) => w.staffId === null && w.dayOfWeek === dayOfWeek);

  if (!effectiveWh || !effectiveWh.isOpen) return [];

  const openMin = timeToMinutes(effectiveWh.openTime);
  const closeMin = timeToMinutes(effectiveWh.closeTime);
  if (closeMin <= openMin) return [];

  if (effectiveWh.breakStart && effectiveWh.breakEnd) {
    const bStart = timeToMinutes(effectiveWh.breakStart);
    const bEnd = timeToMinutes(effectiveWh.breakEnd);
    if (bStart > openMin && bEnd < closeMin && bEnd > bStart) {
      return [
        { startMin: openMin, endMin: bStart },
        { startMin: bEnd, endMin: closeMin },
      ];
    }
  }

  return [{ startMin: openMin, endMin: closeMin }];
}

/**
 * Computes open intervals in minutes since midnight for a staff member on a specific YYYY-MM-DD in Europe/Madrid.
 */
async function getStaffDailyWindows(
  staffId: number,
  dateStr: string,
  exec: DbExecutor = db
): Promise<Array<{ startMin: number; endMin: number }>> {
  const dayOfWeek = getDayOfWeekMadrid(dateStr);

  const exceptions = await exec
    .select()
    .from(staffAvailability)
    .where(
      and(
        eq(staffAvailability.date, dateStr),
        or(isNull(staffAvailability.staffId), eq(staffAvailability.staffId, staffId))
      )
    );

  const staffWh = await exec
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.staffId, staffId), eq(workingHours.dayOfWeek, dayOfWeek)))
    .limit(1);

  const fallbackWh =
    staffWh.length > 0
      ? []
      : await exec
          .select()
          .from(workingHours)
          .where(and(isNull(workingHours.staffId), eq(workingHours.dayOfWeek, dayOfWeek)))
          .limit(1);

  return computeWindowsFromPreloaded(staffId, dateStr, exceptions, [...staffWh, ...fallbackWh]);
}

/**
 * High-capacity batched availability loader:
 * Computes BOTH daily availability summaries AND exact bookable time slots across a multi-day window
 * using 1 parallel DB query roundtrip + single-flight request coalescing + short TTL cache.
 */
export async function getAvailabilityWindow(params: {
  startDateStr: string;
  daysCount: number;
  serviceIds: number[];
  staffId?: number | null;
  excludeAppointmentId?: number;
}): Promise<AvailabilityWindowResult> {
  const count = Math.min(Math.max(params.daysCount, 1), 35);
  const sortedServiceIds = [...params.serviceIds].sort((a, b) => a - b);
  const cacheKey = `${cacheEpoch}:${params.startDateStr}:${count}:${sortedServiceIds.join(',')}:${params.staffId ?? 'ANY'}`;

  if (!params.excludeAppointmentId) {
    const cached = windowCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const existingFlight = inFlightWindow.get(cacheKey);
    if (existingFlight) {
      return existingFlight;
    }
  }

  const runCompute = async (): Promise<AvailabilityWindowResult> => {
    const endDateStr = addDaysToDateStr(params.startDateStr, count - 1);
    const rangeStartUtc = madridLocalToUtc(params.startDateStr, '00:00');
    const rangeEndUtc = madridLocalToUtc(addDaysToDateStr(endDateStr, 1), '00:00');

    const [
      settingsRows,
      svcRows,
      activeStaffRows,
      ssRows,
      exceptionsRows,
      whRows,
      rangeAppointments,
      rangeBlocks,
    ] = await Promise.all([
      db.select().from(businessSettings).limit(1),
      db
        .select()
        .from(services)
        .where(and(inArray(services.id, sortedServiceIds), isNull(services.deletedAt))),
      db
        .select()
        .from(staff)
        .where(
          params.staffId
            ? and(eq(staff.id, params.staffId), eq(staff.isActive, true))
            : eq(staff.isActive, true)
        ),
      db
        .select()
        .from(staffServices)
        .where(inArray(staffServices.serviceId, sortedServiceIds)),
      db
        .select()
        .from(staffAvailability)
        .where(and(gte(staffAvailability.date, params.startDateStr), lte(staffAvailability.date, endDateStr))),
      db.select().from(workingHours),
      db
        .select()
        .from(appointments)
        .where(
          and(
            inArray(appointments.status, ['PENDING', 'CONFIRMED']),
            lt(appointments.startAtUtc, rangeEndUtc),
            gt(appointments.endAtUtc, rangeStartUtc)
          )
        ),
      db
        .select()
        .from(blockedSlots)
        .where(and(lt(blockedSlots.startAtUtc, rangeEndUtc), gt(blockedSlots.endAtUtc, rangeStartUtc))),
    ]);

    const settings = settingsRows[0];
    const emptyDays: DayAvailabilitySummary[] = [];
    const slotsByDate: Record<string, AvailableSlot[]> = {};

    for (let i = 0; i < count; i++) {
      const dStr = addDaysToDateStr(params.startDateStr, i);
      emptyDays.push({ date: dStr, available: false, slotsCount: 0 });
      slotsByDate[dStr] = [];
    }

    if (!settings || svcRows.length !== sortedServiceIds.length || activeStaffRows.length === 0) {
      return { startDate: params.startDateStr, daysCount: count, days: emptyDays, slotsByDate };
    }

    for (const svc of svcRows) {
      if (!svc.isConfigured || !svc.isActive || svc.durationMinutes == null || svc.priceCents == null) {
        return { startDate: params.startDateStr, daysCount: count, days: emptyDays, slotsByDate };
      }
    }

    const now = new Date();
    const todayMadrid = formatDateMadrid(now);
    const maxDateMadrid = addDaysToDateStr(todayMadrid, settings.maxAdvanceDays);
    const minLeadCutoffMs = now.getTime() + settings.minLeadMinutes * 60_000;
    const bufferMin = settings.bufferMinutes ?? 0;
    const stepMinutes = 15;

    // Pre-resolve eligible staff durations + busy intervals
    const eligibleStaff: Array<{
      barber: typeof staff.$inferSelect;
      durationMinutes: number;
      busyIntervals: Array<{ startMs: number; endMs: number }>;
    }> = [];

    for (const barber of activeStaffRows) {
      const barberServices = ssRows.filter((ss) => ss.staffId === barber.id);
      if (barberServices.length !== sortedServiceIds.length) continue;

      let totalDuration = 0;
      for (const svc of svcRows) {
        const custom = barberServices.find((ss) => ss.serviceId === svc.id);
        totalDuration += custom?.customDurationMinutes ?? svc.durationMinutes!;
      }

      const busyIntervals: Array<{ startMs: number; endMs: number }> = [];
      for (const appt of rangeAppointments) {
        if (appt.staffId !== barber.id) continue;
        if (params.excludeAppointmentId && appt.id === params.excludeAppointmentId) continue;
        const apptBufferMs = Math.max(bufferMin, appt.bufferMinutes ?? 0) * 60_000;
        busyIntervals.push({
          startMs: appt.startAtUtc.getTime() - bufferMin * 60_000,
          endMs: appt.endAtUtc.getTime() + apptBufferMs,
        });
      }
      for (const blk of rangeBlocks) {
        if (blk.staffId !== null && blk.staffId !== barber.id) continue;
        busyIntervals.push({
          startMs: blk.startAtUtc.getTime(),
          endMs: blk.endAtUtc.getTime(),
        });
      }

      eligibleStaff.push({ barber, durationMinutes: totalDuration, busyIntervals });
    }

    const days: DayAvailabilitySummary[] = [];

    for (let i = 0; i < count; i++) {
      const dateStr = addDaysToDateStr(params.startDateStr, i);
      if (dateStr < todayMadrid || dateStr > maxDateMadrid) {
        slotsByDate[dateStr] = [];
        days.push({ date: dateStr, available: false, slotsCount: 0 });
        continue;
      }

      const daySlots: AvailableSlot[] = [];
      for (const item of eligibleStaff) {
        const windows = computeWindowsFromPreloaded(
          item.barber.id,
          dateStr,
          exceptionsRows,
          whRows
        );
        if (windows.length === 0) continue;

        const durationMs = item.durationMinutes * 60_000;
        for (const win of windows) {
          const winEndUtc = madridLocalToUtc(dateStr, minutesToTime(win.endMin));
          const winEndMs = winEndUtc.getTime();

          for (let m = win.startMin; m + item.durationMinutes <= win.endMin; m += stepMinutes) {
            const timeStr = minutesToTime(m);
            const slotStartUtc = madridLocalToUtc(dateStr, timeStr);
            const sMs = slotStartUtc.getTime();
            if (sMs < minLeadCutoffMs) continue;

            const eMs = sMs + durationMs;
            if (eMs > winEndMs) continue;

            const hasOverlap = item.busyIntervals.some(
              (busy) => sMs < busy.endMs && eMs > busy.startMs
            );
            if (!hasOverlap) {
              daySlots.push({
                startUtc: slotStartUtc.toISOString(),
                endUtc: new Date(eMs).toISOString(),
                timeLabel: formatTimeMadrid(slotStartUtc),
                staffId: item.barber.id,
                staffName: item.barber.name,
              });
            }
          }
        }
      }

      daySlots.sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.staffId - b.staffId);
      slotsByDate[dateStr] = daySlots;
      const uniqueTimes = new Set(daySlots.map((s) => s.timeLabel));
      days.push({
        date: dateStr,
        available: uniqueTimes.size > 0,
        slotsCount: uniqueTimes.size,
      });
    }

    const result: AvailabilityWindowResult = {
      startDate: params.startDateStr,
      daysCount: count,
      days,
      slotsByDate,
    };

    if (!params.excludeAppointmentId) {
      windowCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data: result,
      });
      if (windowCache.size > 200) {
        const firstKey = windowCache.keys().next().value;
        if (firstKey) windowCache.delete(firstKey);
      }
    }

    return result;
  };

  if (params.excludeAppointmentId) {
    return runCompute();
  }

  const flight = runCompute().finally(() => {
    inFlightWindow.delete(cacheKey);
  });
  inFlightWindow.set(cacheKey, flight);
  return flight;
}

/**
 * Computes real bookable time slots for a given date (YYYY-MM-DD in Europe/Madrid),
 * service IDs, and optional staffId (if omitted, aggregates across all eligible active staff).
 */
export async function getAvailableSlotsForDate(params: {
  dateStr: string;
  serviceIds: number[];
  staffId?: number | null;
  excludeAppointmentId?: number;
  ignoreLeadTime?: boolean;
}): Promise<AvailableSlot[]> {
  if (!params.ignoreLeadTime) {
    const win = await getAvailabilityWindow({
      startDateStr: params.dateStr,
      daysCount: 1,
      serviceIds: params.serviceIds,
      staffId: params.staffId,
      excludeAppointmentId: params.excludeAppointmentId,
    });
    return win.slotsByDate[params.dateStr] ?? [];
  }

  const settings = await getActiveBusinessSettings();
  if (!settings) return [];

  const activeStaffRows = await db
    .select()
    .from(staff)
    .where(
      params.staffId
        ? and(eq(staff.id, params.staffId), eq(staff.isActive, true))
        : eq(staff.isActive, true)
    );

  if (activeStaffRows.length === 0) return [];

  const dayStartUtc = madridLocalToUtc(params.dateStr, '00:00');
  const nextDayStr = addDaysToDateStr(params.dateStr, 1);
  const dayEndUtc = madridLocalToUtc(nextDayStr, '00:00');

  const dayAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        inArray(appointments.status, ['PENDING', 'CONFIRMED']),
        lt(appointments.startAtUtc, dayEndUtc),
        gt(appointments.endAtUtc, dayStartUtc)
      )
    );

  const dayBlocks = await db
    .select()
    .from(blockedSlots)
    .where(and(lt(blockedSlots.startAtUtc, dayEndUtc), gt(blockedSlots.endAtUtc, dayStartUtc)));

  const stepMinutes = 15;
  const bufferMin = settings.bufferMinutes ?? 0;
  const results: AvailableSlot[] = [];

  for (const barber of activeStaffRows) {
    const svcInfo = await resolveServiceForStaff(params.serviceIds, barber.id).catch(() => null);
    if (!svcInfo) continue;

    const windows = await getStaffDailyWindows(barber.id, params.dateStr);
    if (windows.length === 0) continue;

    const barberBusyIntervals: Array<{ startMs: number; endMs: number }> = [];

    for (const appt of dayAppointments) {
      if (appt.staffId !== barber.id) continue;
      if (params.excludeAppointmentId && appt.id === params.excludeAppointmentId) continue;
      const apptBufferMs = Math.max(bufferMin, appt.bufferMinutes ?? 0) * 60_000;
      barberBusyIntervals.push({
        startMs: appt.startAtUtc.getTime() - bufferMin * 60_000,
        endMs: appt.endAtUtc.getTime() + apptBufferMs,
      });
    }

    for (const blk of dayBlocks) {
      if (blk.staffId !== null && blk.staffId !== barber.id) continue;
      barberBusyIntervals.push({
        startMs: blk.startAtUtc.getTime(),
        endMs: blk.endAtUtc.getTime(),
      });
    }

    const durationMs = svcInfo.totalDurationMinutes * 60_000;

    for (const win of windows) {
      for (let m = win.startMin; m + svcInfo.totalDurationMinutes <= win.endMin; m += stepMinutes) {
        const timeStr = minutesToTime(m);
        const slotStartUtc = madridLocalToUtc(params.dateStr, timeStr);
        const slotEndUtc = new Date(slotStartUtc.getTime() + durationMs);
        const winEndUtc = madridLocalToUtc(params.dateStr, minutesToTime(win.endMin));
        if (slotEndUtc.getTime() > winEndUtc.getTime()) continue;

        const sMs = slotStartUtc.getTime();
        const eMs = slotEndUtc.getTime();
        const hasOverlap = barberBusyIntervals.some((busy) => sMs < busy.endMs && eMs > busy.startMs);
        if (!hasOverlap) {
          results.push({
            startUtc: slotStartUtc.toISOString(),
            endUtc: slotEndUtc.toISOString(),
            timeLabel: formatTimeMadrid(slotStartUtc),
            staffId: barber.id,
            staffName: barber.name,
          });
        }
      }
    }
  }

  results.sort((a, b) => a.startUtc.localeCompare(b.startUtc) || a.staffId - b.staffId);
  return results;
}

/**
 * Returns day-by-day availability across a range of dates using the batched window engine.
 */
export async function getCalendarDaysAvailability(params: {
  startDateStr: string;
  daysCount: number;
  serviceIds: number[];
  staffId?: number | null;
}): Promise<DayAvailabilitySummary[]> {
  const win = await getAvailabilityWindow(params);
  return win.days;
}

/**
 * Strict server-side interval validation used inside a locked PostgreSQL transaction
 * before inserting or rescheduling an appointment.
 */
export async function assertStaffSlotAvailableInTx(
  tx: DbExecutor,
  params: {
    staffId: number;
    startAtUtc: Date;
    durationMinutes: number;
    bufferMinutes: number;
    excludeAppointmentId?: number;
    enforceWorkingHours: boolean;
    enforceLeadTime: boolean;
  }
) {
  const dateStr = formatDateMadrid(params.startAtUtc);
  const endAtUtc = new Date(params.startAtUtc.getTime() + params.durationMinutes * 60_000);

  const [settings] = await tx.select().from(businessSettings).limit(1);
  if (!settings) {
    throw new Error('Configuración del negocio no inicializada.');
  }

  if (params.enforceLeadTime) {
    const now = new Date();
    const minLeadMs = settings.minLeadMinutes * 60_000;
    if (params.startAtUtc.getTime() < now.getTime() + minLeadMs) {
      throw new Error(
        `Debes reservar con al menos ${settings.minLeadMinutes} minutos de antelación.`
      );
    }
    const todayMadrid = formatDateMadrid(now);
    const maxDateMadrid = addDaysToDateStr(todayMadrid, settings.maxAdvanceDays);
    if (dateStr > maxDateMadrid) {
      throw new Error(`No es posible reservar con más de ${settings.maxAdvanceDays} días de antelación.`);
    }
  }

  if (params.enforceWorkingHours) {
    const windows = await getStaffDailyWindows(params.staffId, dateStr, tx);
    const fitsWindow = windows.some((w) => {
      const wStart = madridLocalToUtc(dateStr, minutesToTime(w.startMin));
      const wEnd = madridLocalToUtc(dateStr, minutesToTime(w.endMin));
      return (
        params.startAtUtc.getTime() >= wStart.getTime() && endAtUtc.getTime() <= wEnd.getTime()
      );
    });
    if (!fitsWindow) {
      throw new Error('El horario seleccionado está fuera de la jornada laboral o en un día no disponible.');
    }
  }

  // Check overlapping appointments with buffer (the larger of the appointment's own and the business buffer)
  const bufferMin = Math.max(params.bufferMinutes, settings.bufferMinutes ?? 0);
  const checkStart = new Date(params.startAtUtc.getTime() - bufferMin * 60_000);
  const checkEnd = new Date(endAtUtc.getTime() + bufferMin * 60_000);

  const overlappingAppts = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.staffId, params.staffId),
        inArray(appointments.status, ['PENDING', 'CONFIRMED']),
        lt(appointments.startAtUtc, checkEnd),
        gt(appointments.endAtUtc, checkStart)
      )
    );

  const conflict = overlappingAppts.find((a) => a.id !== params.excludeAppointmentId);
  if (conflict) {
    throw new Error('Disponibilidad agotada: este horario acaba de ser reservado.');
  }

  // Check blocked slots
  const overlappingBlocks = await tx
    .select()
    .from(blockedSlots)
    .where(
      and(
        or(isNull(blockedSlots.staffId), eq(blockedSlots.staffId, params.staffId)),
        lt(blockedSlots.startAtUtc, endAtUtc),
        gt(blockedSlots.endAtUtc, params.startAtUtc)
      )
    );

  if (overlappingBlocks.length > 0) {
    throw new Error('La franja horaria está bloqueada en la agenda.');
  }

  return { endAtUtc, settings };
}
