import { db } from '../db/index.ts';
import {
  appointments,
  businessSettings,
  services,
  staff,
  staffServices,
  workingHours,
} from '../db/schema.ts';
import { eq, isNull, sql } from 'drizzle-orm';

let initializedPromise: Promise<void> | null = null;

/**
 * Ensures Club Segorbe OS boots in a 100% operational state for bookings:
 * - Singleton business_settings with Murcia timezone and booking policies
 * - 3 active services (Corte de pelo, Arreglo de barba, Corte + barba) if unconfigured
 * - Standard Murcia weekly working hours if all days are still closed
 * - 1 active default barber linked to services if no staff exists yet
 * Strictly NO fake appointments, NO fake customers, and NO fake revenue.
 */
export async function ensureSystemBootstrap(): Promise<void> {
  if (initializedPromise) {
    return initializedPromise;
  }

  initializedPromise = (async () => {
    try {
      const existingSettings = await db.select().from(businessSettings).limit(1);
      if (existingSettings.length === 0) {
        await db.insert(businessSettings).values({
          businessName: 'Club Segorbe',
          city: 'Murcia',
          timezone: 'Europe/Madrid',
          minLeadMinutes: 30,
          maxAdvanceDays: 30,
          cancelCutoffHours: 2,
          rescheduleCutoffHours: 2,
          bufferMinutes: 0,
          defaultReturnCadenceDays: 28,
          reminderHoursBefore: 24,
          waitlistAutoOffer: false,
          emailProvider: process.env.SMTP_HOST ? 'SMTP' : 'PENDING',
          smsProvider: process.env.SMS_PROVIDER_API_KEY ? 'CONFIGURED' : 'PENDING',
          whatsappProvider: process.env.WHATSAPP_BUSINESS_TOKEN ? 'META_CLOUD' : 'PENDING',
          isSetupComplete: true,
        });
      } else if (!existingSettings[0].isSetupComplete) {
        const apptCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments);
        if ((apptCount[0]?.count ?? 0) === 0) {
          await db
            .update(businessSettings)
            .set({
              minLeadMinutes: 30,
              cancelCutoffHours: 2,
              rescheduleCutoffHours: 2,
              isSetupComplete: true,
              updatedAt: new Date(),
            })
            .where(eq(businessSettings.id, existingSettings[0].id));
        }
      }

      // Ensure the 3 core services exist and are operational if none are configured yet
      const allSvcs = await db.select().from(services);
      if (allSvcs.length === 0) {
        await db.insert(services).values([
          {
            slug: 'corte-de-pelo',
            name: 'Corte de pelo',
            description:
              'Corte contemporáneo adaptado a fisonomía, textura y acabado con tijera y máquina.',
            priceCents: 1800,
            durationMinutes: 30,
            imageUrl: '/src/assets/images/service_haircut_1794509411927.jpg',
            isActive: true,
            isConfigured: true,
            sortOrder: 1,
          },
          {
            slug: 'arreglo-de-barba',
            name: 'Arreglo de barba',
            description:
              'Perfilado de líneas, rebaje simétrico, toalla templada y cuidado con navaja.',
            priceCents: 1200,
            durationMinutes: 20,
            imageUrl: '/src/assets/images/service_beard_1794509411639.jpg',
            isActive: true,
            isConfigured: true,
            sortOrder: 2,
          },
          {
            slug: 'corte-y-barba',
            name: 'Corte + barba',
            description:
              'Sesión completa de diseño capilar y ritual de barba en una sola cita.',
            priceCents: 2600,
            durationMinutes: 45,
            imageUrl: '/src/assets/images/service_combo_1794509412488.jpg',
            isActive: true,
            isConfigured: true,
            sortOrder: 3,
          },
        ]);
      } else {
        // Activate initial unconfigured placeholder rows if nothing has been configured yet
        const anyConfigured = allSvcs.some((s) => s.isConfigured);
        if (!anyConfigured) {
          const defaults: Record<string, { priceCents: number; durationMinutes: number }> = {
            'corte-de-pelo': { priceCents: 1800, durationMinutes: 30 },
            'arreglo-de-barba': { priceCents: 1200, durationMinutes: 20 },
            'corte-y-barba': { priceCents: 2600, durationMinutes: 45 },
          };
          for (const svc of allSvcs) {
            const def = defaults[svc.slug];
            if (def) {
              await db
                .update(services)
                .set({
                  priceCents: def.priceCents,
                  durationMinutes: def.durationMinutes,
                  isConfigured: true,
                  isActive: true,
                  updatedAt: new Date(),
                })
                .where(eq(services.id, svc.id));
            }
          }
        }
      }

      // Ensure default weekly workingHours are open Mon-Sat if no open days exist yet
      const baseWh = await db
        .select()
        .from(workingHours)
        .where(isNull(workingHours.staffId));

      const defaultSchedule = [
        { dayOfWeek: 1, isOpen: true, openTime: '09:30', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
        { dayOfWeek: 2, isOpen: true, openTime: '09:30', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
        { dayOfWeek: 3, isOpen: true, openTime: '09:30', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
        { dayOfWeek: 4, isOpen: true, openTime: '09:30', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
        { dayOfWeek: 5, isOpen: true, openTime: '09:30', closeTime: '20:30', breakStart: '14:00', breakEnd: '16:30' },
        { dayOfWeek: 6, isOpen: true, openTime: '09:30', closeTime: '14:00', breakStart: null, breakEnd: null },
        { dayOfWeek: 0, isOpen: false, openTime: '09:30', closeTime: '14:00', breakStart: null, breakEnd: null },
      ];

      if (baseWh.length === 0) {
        await db.insert(workingHours).values(
          defaultSchedule.map((d) => ({ staffId: null, ...d }))
        );
      } else if (!baseWh.some((w) => w.isOpen)) {
        for (const d of defaultSchedule) {
          const existingDay = baseWh.find((w) => w.dayOfWeek === d.dayOfWeek);
          if (existingDay) {
            await db
              .update(workingHours)
              .set({
                isOpen: d.isOpen,
                openTime: d.openTime,
                closeTime: d.closeTime,
                breakStart: d.breakStart,
                breakEnd: d.breakEnd,
              })
              .where(eq(workingHours.id, existingDay.id));
          }
        }
      }

      // Ensure at least 1 active barber exists so online booking works immediately
      const staffCount = await db.select({ count: sql<number>`count(*)::int` }).from(staff);
      if ((staffCount[0]?.count ?? 0) === 0) {
        const [defaultBarber] = await db
          .insert(staff)
          .values({
            name: 'Club Segorbe · Maestro Barbero',
            roleTitle: 'Barbero Principal',
            specialties: 'Corte contemporáneo, degradado y ritual de barba',
            isActive: true,
            sortOrder: 1,
          })
          .returning();

        const activeSvcs = await db
          .select()
          .from(services)
          .where(eq(services.isActive, true));
        if (activeSvcs.length > 0) {
          await db.insert(staffServices).values(
            activeSvcs.map((svc) => ({
              staffId: defaultBarber.id,
              serviceId: svc.id,
            }))
          );
        }

        await db.insert(workingHours).values(
          defaultSchedule.map((d) => ({ staffId: defaultBarber.id, ...d }))
        );
      }
    } catch (error) {
      initializedPromise = null;
      console.error('Bootstrap error:', error);
      throw new Error('Error inicializando configuración operativa.', { cause: error });
    }
  })();

  return initializedPromise;
}
