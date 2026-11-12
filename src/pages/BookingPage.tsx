import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Scissors,
  UserCheck,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { apiFetch } from '../lib/api';
import {
  AvailableSlot,
  BookingSummary,
  DayAvailability,
  PublicBusinessInfo,
  ServiceItem,
  StaffMember,
  formatEuro,
} from '../types/domain';

interface BootstrapData {
  systemOperational: boolean;
  business: PublicBusinessInfo | null;
  services: ServiceItem[];
  staff: StaffMember[];
}

interface WindowAvailabilityResponse {
  startDate: string;
  daysCount: number;
  days: DayAvailability[];
  slotsByDate: Record<string, AvailableSlot[]>;
}

function getMadridTodayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function formatShortDayChip(dateStr: string, todayStr: string): { top: string; num: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (dateStr === todayStr) {
    return { top: 'HOY', num: String(d) };
  }
  const weekday = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    timeZone: 'UTC',
  })
    .format(dt)
    .replace('.', '')
    .toUpperCase();
  return { top: weekday.slice(0, 3), num: String(d) };
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dt);
}

function downloadIcsFile(booking: BookingSummary, businessName: string, address: string | null) {
  const start = new Date(booking.startAtUtc).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(booking.endAtUtc).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const summary = `Cita ${businessName} · ${booking.services.map((s) => s.serviceNameSnapshot).join(', ')}`;
  const location = address ? `${businessName}, ${address}` : `${businessName}, Murcia`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Club Segorbe//Reservas//ES',
    'BEGIN:VEVENT',
    `UID:${booking.bookingCode}@clubsegorbe.es`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:Código ${booking.bookingCode} · Barbero: ${booking.staff?.name || ''}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cita-${booking.bookingCode}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const generateKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const [boot, setBoot] = useState<BootstrapData | null>(null);
  const [loadingBoot, setLoadingBoot] = useState(true);

  // 3 ultra-simple steps: 1 = Servicio, 2 = Día y Hora, 3 = Datos mínimos y Confirmar, 4 = Confirmada
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [staffSelectionMode, setStaffSelectionMode] = useState<'ANY' | 'SPECIFIC'>('ANY');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Preloaded Availability Window (zero-latency day switching)
  const todayMadrid = useMemo(() => getMadridTodayStr(), []);
  const [windowStart, setWindowStart] = useState<string>(todayMadrid);
  const [daysList, setDaysList] = useState<DayAvailability[]>([]);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, AvailableSlot[]>>({});
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // In-memory client prefetch cache for instant transitions
  const clientWindowCache = useRef<Map<string, WindowAvailabilityResponse>>(new Map());

  // Minimal Customer Form + Optional collapsible extras
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [preferredChannel, setPreferredChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE'>('NONE');

  // Returning customer lookup inside collapsible extras
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Waitlist form when selected day has 0 slots
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // Submission & Idempotency
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(generateKey);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingSummary | null>(null);

  useEffect(() => {
    apiFetch<BootstrapData>('/api/public/bootstrap')
      .then((res) => {
        setBoot(res);
        const preService = Number(searchParams.get('servicio'));
        const active = res.services.filter((s) => s.isActive && s.isConfigured);
        if (preService && active.some((s) => s.id === preService)) {
          setSelectedServiceIds([preService]);
        } else if (active.length > 0) {
          // Pre-warm availability cache silently for the most common first service
          const firstId = active[0].id;
          const url = `/api/public/availability/window?start=${todayMadrid}&days=21&serviceIds=${firstId}`;
          apiFetch<WindowAvailabilityResponse>(url)
            .then((win) => {
              clientWindowCache.current.set(`${todayMadrid}:21:${firstId}:ANY`, win);
            })
            .catch(() => {});
        }
      })
      .finally(() => setLoadingBoot(false));
  }, [searchParams, todayMadrid]);

  const activeServices = useMemo(
    () => (boot?.services ?? []).filter((s) => s.isActive && s.isConfigured),
    [boot]
  );

  const selectedServices = useMemo(
    () => activeServices.filter((s) => selectedServiceIds.includes(s.id)),
    [activeServices, selectedServiceIds]
  );

  const compatibleStaff = useMemo(() => {
    if (!boot?.staff) return [];
    if (selectedServiceIds.length === 0) return boot.staff;
    return boot.staff.filter((barber) =>
      selectedServiceIds.every((sid) => barber.serviceIds.includes(sid))
    );
  }, [boot, selectedServiceIds]);

  const totals = useMemo(
    () =>
      selectedServices.reduce(
        (acc, s) => ({
          priceCents: acc.priceCents + (s.priceCents ?? 0),
          durationMinutes: acc.durationMinutes + (s.durationMinutes ?? 0),
        }),
        { priceCents: 0, durationMinutes: 0 }
      ),
    [selectedServices]
  );

  const fetchWindowAvailability = async (
    svcIds: number[],
    startStr: string,
    staffMode: 'ANY' | 'SPECIFIC',
    staffIdVal: number | null,
    forceRefresh = false
  ) => {
    if (svcIds.length === 0) return;
    const sorted = [...svcIds].sort((a, b) => a - b).join(',');
    const effectiveStaff = staffMode === 'SPECIFIC' && staffIdVal ? String(staffIdVal) : 'ANY';
    const key = `${startStr}:21:${sorted}:${effectiveStaff}`;

    if (!forceRefresh) {
      const cached = clientWindowCache.current.get(key);
      if (cached) {
        setDaysList(cached.days);
        setSlotsByDate(cached.slotsByDate);
        const firstOpen = cached.days.find((d) => d.available);
        if (firstOpen) {
          setSelectedDate((prev) =>
            prev && cached.slotsByDate[prev]?.length ? prev : firstOpen.date
          );
        } else if (cached.days[0]) {
          setSelectedDate(cached.days[0].date);
        }
        return;
      }
    }

    setLoadingWindow(true);
    try {
      const params = new URLSearchParams({
        start: startStr,
        days: '21',
        serviceIds: sorted,
      });
      if (effectiveStaff !== 'ANY') params.set('staffId', effectiveStaff);

      const res = await apiFetch<WindowAvailabilityResponse>(
        `/api/public/availability/window?${params.toString()}`
      );
      clientWindowCache.current.set(key, res);
      setDaysList(res.days);
      setSlotsByDate(res.slotsByDate);
      const firstOpen = res.days.find((d) => d.available);
      if (firstOpen) {
        setSelectedDate((prev) =>
          prev && res.slotsByDate[prev]?.length ? prev : firstOpen.date
        );
      } else if (res.days[0]) {
        setSelectedDate(res.days[0].date);
      }
    } finally {
      setLoadingWindow(false);
    }
  };

  // Prefetch silently as soon as user toggles services on Step 1
  useEffect(() => {
    if (selectedServiceIds.length === 0) return;
    const effectiveMode = compatibleStaff.length === 1 ? 'SPECIFIC' : staffSelectionMode;
    const effectiveStaff =
      compatibleStaff.length === 1
        ? compatibleStaff[0].id
        : effectiveMode === 'SPECIFIC'
        ? selectedStaffId
        : null;
    fetchWindowAvailability(selectedServiceIds, windowStart, effectiveMode, effectiveStaff);
  }, [selectedServiceIds, windowStart, staffSelectionMode, selectedStaffId, compatibleStaff]);

  const toggleService = (id: number) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedSlot(null);
    setSubmitError(null);
  };

  const goToStep2 = () => {
    if (selectedServiceIds.length === 0) return;
    if (compatibleStaff.length === 1) {
      setStaffSelectionMode('SPECIFIC');
      setSelectedStaffId(compatibleStaff[0].id);
    }
    setStep(2);
  };

  // Slots for the selected date — 0ms synchronous lookup from memory!
  const displayedSlots = useMemo(() => {
    const raw = selectedDate ? slotsByDate[selectedDate] ?? [] : [];
    const deduped =
      staffSelectionMode === 'SPECIFIC'
        ? raw
        : raw.filter((slot, idx, arr) => arr.findIndex((x) => x.timeLabel === slot.timeLabel) === idx);

    if (periodFilter === 'MORNING') {
      return deduped.filter((s) => s.timeLabel < '14:00');
    }
    if (periodFilter === 'AFTERNOON') {
      return deduped.filter((s) => s.timeLabel >= '14:00');
    }
    return deduped;
  }, [selectedDate, slotsByDate, staffSelectionMode, periodFilter]);

  const handleLookupCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupMessage(null);
    try {
      const res = await apiFetch<{
        found: boolean;
        requiresVerification?: boolean;
        message?: string;
        customer?: {
          fullName: string;
          phone: string;
          email: string | null;
          preferredChannel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'NONE';
        };
      }>('/api/public/lookup-customer', {
        method: 'POST',
        body: JSON.stringify({
          phone: lookupPhone,
          bookingCode: lookupCode || undefined,
        }),
      });
      if (!res.found) {
        setLookupMessage('No encontramos ninguna ficha con ese teléfono.');
      } else if (res.requiresVerification) {
        setLookupMessage(res.message || 'Introduce un código de reserva anterior para verificar.');
      } else if (res.customer) {
        setFullName(res.customer.fullName);
        setPhone(res.customer.phone);
        setEmail(res.customer.email || '');
        setPreferredChannel(res.customer.preferredChannel || 'NONE');
        setLookupMessage('Datos recuperados correctamente.');
      }
    } catch (err: any) {
      setLookupMessage(err.message);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || fullName.trim().length < 2 || phone.trim().length < 7 || !privacyAccepted) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch<{ booking: BookingSummary }>('/api/public/bookings', {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey,
          serviceIds: selectedServiceIds,
          staffId:
            staffSelectionMode === 'SPECIFIC' && selectedStaffId
              ? selectedStaffId
              : selectedSlot.staffId,
          startAtUtc: selectedSlot.startUtc,
          customer: {
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim() || null,
            notes: notes.trim() || null,
          },
          consents: {
            privacyPolicyAccepted: privacyAccepted,
            marketingOptIn,
            preferredChannel,
          },
        }),
      });
      clientWindowCache.current.clear();
      setConfirmedBooking(res.booking);
      setStep(4);
    } catch (err: any) {
      const msg = err.message || 'No se pudo completar la reserva.';
      setSubmitError(msg);
      setIdempotencyKey(generateKey());
      // On slot collision, remove taken slot immediately and return to Step 2 preserving name & phone
      if (msg.includes('Disponibilidad') || msg.includes('bloqueada') || msg.includes('ocupado')) {
        clientWindowCache.current.clear();
        setSelectedSlot(null);
        await fetchWindowAvailability(
          selectedServiceIds,
          windowStart,
          staffSelectionMode,
          selectedStaffId,
          true
        );
        setStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceIds[0] || !selectedDate) return;
    setSubmitError(null);
    try {
      await apiFetch('/api/public/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          phone,
          email: email || null,
          serviceId: selectedServiceIds[0],
          staffId: staffSelectionMode === 'SPECIFIC' ? selectedStaffId : null,
          preferredDate: selectedDate,
          privacyPolicyAccepted: true,
        }),
      });
      setWaitlistSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#E8E4DD] text-[#111111] flex flex-col">
      <Navbar variant="solid" />

      <main className="flex-1 mx-auto w-full max-w-3xl px-3.5 sm:px-6 pt-16 sm:pt-20 pb-20 sm:pb-12 flex flex-col justify-between gap-3">
        {step < 4 && (
          <div>
            {/* Compact 3-Step Indicator — Single-Line */}
            <div className="flex items-center justify-between gap-2 border-b border-[#111111]/12 pb-2.5">
              <div className="flex items-center gap-2 sm:gap-4 font-mono-data text-xs overflow-x-auto whitespace-nowrap">
                {[
                  { n: 1, label: '01. Servicio' },
                  { n: 2, label: '02. Día y hora' },
                  { n: 3, label: '03. Confirmar' },
                ].map((item, idx) => (
                  <React.Fragment key={item.n}>
                    <button
                      type="button"
                      disabled={item.n > step}
                      onClick={() => item.n < step && setStep(item.n as 1 | 2 | 3)}
                      className={`whitespace-nowrap shrink-0 transition-colors ${
                        step === item.n
                          ? 'font-bold text-[#E63B2E]'
                          : item.n < step
                          ? 'text-[#111111] hover:underline'
                          : 'text-[#111111]/40'
                      }`}
                    >
                      {item.label}
                    </button>
                    {idx < 2 && <span className="text-[#111111]/25">/</span>}
                  </React.Fragment>
                ))}
              </div>
              <span className="hidden sm:inline font-mono-data text-[11px] text-[#111111]/55 whitespace-nowrap">
                Murcia · Europe/Madrid
              </span>
            </div>
          </div>
        )}

        {loadingBoot ? (
          <div className="flex-1 grid gap-3 py-4">
            <div className="h-16 animate-pulse rounded-2xl bg-[#F5F3EE]" />
            <div className="h-16 animate-pulse rounded-2xl bg-[#F5F3EE]" />
            <div className="h-16 animate-pulse rounded-2xl bg-[#F5F3EE]" />
          </div>
        ) : activeServices.length === 0 || (boot?.staff.length ?? 0) === 0 ? (
          <div className="rounded-3xl border border-[#111111]/15 bg-[#F5F3EE] p-6 sm:p-8 space-y-4">
            <AlertCircle className="h-7 w-7 text-[#B45309]" />
            <h1 className="font-display text-xl font-bold">Agenda en configuración inicial</h1>
            <p className="text-sm text-[#111111]/75">
              Todavía no hay servicios o profesionales activos configurados para reservas online.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-display text-sm font-bold text-[#E63B2E]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al inicio</span>
            </Link>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-start">
            {/* STEP 1 — COMPACT TOUCH ROWS (ZERO SCROLL ON MOBILE) */}
            {step === 1 && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    ¿Qué te hacemos hoy?
                  </h1>
                  <span className="font-mono-data text-xs text-[#111111]/60 whitespace-nowrap">
                    Elige 1 o varios
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                  {activeServices.map((svc) => {
                    const selected = selectedServiceIds.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`w-full min-h-[68px] flex items-center justify-between gap-3 rounded-2xl border p-3 sm:p-4 text-left transition-all duration-150 ${
                          selected
                            ? 'border-[#111111] bg-[#111111] text-[#F5F3EE]'
                            : 'border-[#111111]/12 bg-[#F5F3EE] text-[#111111] hover:border-[#111111]/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#E8E4DD] text-[#111111] flex items-center justify-center">
                            {svc.imageUrl ? (
                              <img
                                src={svc.imageUrl}
                                alt={svc.name}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Scissors className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-base sm:text-lg font-bold truncate">
                              {svc.name}
                            </p>
                            <p
                              className={`text-xs truncate ${
                                selected ? 'text-[#E8E4DD]/75' : 'text-[#111111]/65'
                              }`}
                            >
                              {svc.durationMinutes} min · {svc.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono-data text-sm sm:text-base font-bold tabular-nums">
                            {formatEuro(svc.priceCents)}
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                              selected
                                ? 'border-[#E63B2E] bg-[#E63B2E] text-[#F5F3EE]'
                                : 'border-[#111111]/25'
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2 — HORIZONTAL DATE STRIP + INSTANT 0ms TIME GRID */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    Elige día y hora
                  </h1>
                  <span className="font-mono-data text-xs text-[#111111]/70 tabular-nums">
                    {totals.durationMinutes} min · {formatEuro(totals.priceCents)}
                  </span>
                </div>

                {submitError && (
                  <div className="rounded-xl border border-[#E63B2E] bg-[#E63B2E]/10 px-3.5 py-2.5 text-xs font-medium text-[#E63B2E]">
                    {submitError}
                  </div>
                )}

                {/* Compact single-row barber selector only when >1 compatible barber */}
                {compatibleStaff.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStaffSelectionMode('ANY');
                        setSelectedStaffId(null);
                        setSelectedSlot(null);
                      }}
                      className={`min-h-[38px] rounded-xl px-3 py-1.5 font-mono-data text-xs whitespace-nowrap shrink-0 border transition-colors ${
                        staffSelectionMode === 'ANY'
                          ? 'border-[#111111] bg-[#111111] font-bold text-[#F5F3EE]'
                          : 'border-[#111111]/15 bg-[#F5F3EE] text-[#111111]'
                      }`}
                    >
                      Primer disponible
                    </button>
                    {compatibleStaff.map((barber) => {
                      const active =
                        staffSelectionMode === 'SPECIFIC' && selectedStaffId === barber.id;
                      return (
                        <button
                          key={barber.id}
                          type="button"
                          onClick={() => {
                            setStaffSelectionMode('SPECIFIC');
                            setSelectedStaffId(barber.id);
                            setSelectedSlot(null);
                          }}
                          className={`min-h-[38px] rounded-xl px-3 py-1.5 font-mono-data text-xs whitespace-nowrap shrink-0 border transition-colors ${
                            active
                              ? 'border-[#111111] bg-[#111111] font-bold text-[#F5F3EE]'
                              : 'border-[#111111]/15 bg-[#F5F3EE] text-[#111111]'
                          }`}
                        >
                          {barber.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Horizontal Scrollable Date Strip */}
                <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-3 space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {loadingWindow && daysList.length === 0 ? (
                      [1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-[#E8E4DD]"
                        />
                      ))
                    ) : (
                      <>
                        {daysList.map((day) => {
                          const { top, num } = formatShortDayChip(day.date, todayMadrid);
                          const isSelected = selectedDate === day.date;
                          return (
                            <button
                              key={day.date}
                              type="button"
                              disabled={!day.available}
                              onClick={() => {
                                setSelectedDate(day.date);
                                setSelectedSlot(null);
                                setShowWaitlist(false);
                              }}
                              className={`min-w-[56px] h-14 shrink-0 rounded-xl flex flex-col items-center justify-center font-mono-data transition-all duration-150 ${
                                isSelected
                                  ? 'bg-[#E63B2E] text-[#F5F3EE] font-bold'
                                  : day.available
                                  ? 'bg-white border border-[#111111]/15 text-[#111111] hover:border-[#111111]'
                                  : 'bg-[#E8E4DD]/65 text-[#111111]/30 cursor-not-allowed'
                              }`}
                            >
                              <span className="text-[10px] leading-none">{top}</span>
                              <span className="mt-1 text-base font-bold tabular-nums leading-none">
                                {num}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setWindowStart((prev) => addDaysLocal(prev, 14))}
                          className="min-w-[68px] h-14 shrink-0 rounded-xl border border-dashed border-[#111111]/25 px-2 font-mono-data text-[11px] font-bold text-[#111111]/75 hover:bg-white"
                        >
                          Más días
                        </button>
                      </>
                    )}
                  </div>

                  {/* Morning / Afternoon Quick Filter to prevent long vertical lists */}
                  <div className="flex items-center justify-between gap-2 border-t border-[#111111]/10 pt-2.5">
                    <span className="font-mono-data text-xs font-bold capitalize">
                      {formatReadableDate(selectedDate)}
                    </span>
                    <div className="flex items-center gap-1 rounded-lg bg-[#E8E4DD] p-0.5 font-mono-data text-[11px]">
                      {(
                        [
                          { k: 'ALL', label: 'Todo' },
                          { k: 'MORNING', label: 'Mañana' },
                          { k: 'AFTERNOON', label: 'Tarde' },
                        ] as const
                      ).map((p) => (
                        <button
                          key={p.k}
                          type="button"
                          onClick={() => setPeriodFilter(p.k)}
                          className={`rounded-md px-2.5 py-1 whitespace-nowrap transition-colors ${
                            periodFilter === p.k
                              ? 'bg-[#111111] font-bold text-[#F5F3EE]'
                              : 'text-[#111111]/70'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Slots Grid — Instant 0ms Switch */}
                  {displayedSlots.length === 0 ? (
                    <div className="rounded-xl bg-[#E8E4DD]/60 p-4 text-center space-y-2">
                      <p className="text-xs text-[#111111]/75">
                        {periodFilter !== 'ALL' && (slotsByDate[selectedDate]?.length ?? 0) > 0
                          ? 'No hay huecos en este tramo horario. Prueba con «Todo».'
                          : 'No quedan horas disponibles para este día.'}
                      </p>
                      {selectedDate && selectedDate >= todayMadrid && (
                        <button
                          type="button"
                          onClick={() => setShowWaitlist((v) => !v)}
                          className="font-display text-xs font-bold text-[#E63B2E] underline"
                        >
                          Apuntarme a lista de espera
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[240px] sm:max-h-[290px] overflow-y-auto pr-0.5">
                      {displayedSlots.map((slot) => {
                        const active =
                          selectedSlot?.startUtc === slot.startUtc &&
                          selectedSlot?.staffId === slot.staffId;
                        return (
                          <button
                            key={`${slot.startUtc}-${slot.staffId}`}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`h-11 rounded-xl border font-mono-data text-sm tabular-nums transition-all duration-150 ${
                              active
                                ? 'border-[#111111] bg-[#111111] font-bold text-[#F5F3EE]'
                                : 'border-[#111111]/15 bg-white text-[#111111] hover:border-[#E63B2E]'
                            }`}
                          >
                            {slot.timeLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {showWaitlist && (
                  <form
                    onSubmit={handleJoinWaitlist}
                    className="rounded-2xl border border-[#111111]/15 bg-[#F5F3EE] p-4 space-y-3"
                  >
                    <p className="font-display text-sm font-bold">
                      Lista de espera · {selectedDate}
                    </p>
                    {waitlistSuccess ? (
                      <p className="text-xs font-medium text-[#15803D]">
                        Solicitud registrada. Si queda un hueco libre te avisaremos.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          required
                          placeholder="Nombre"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="min-h-[44px] rounded-xl border border-[#111111]/20 bg-white px-3 text-sm"
                        />
                        <input
                          required
                          type="tel"
                          inputMode="tel"
                          placeholder="Teléfono"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="min-h-[44px] rounded-xl border border-[#111111]/20 bg-white px-3 text-sm"
                        />
                        <button
                          type="submit"
                          className="min-h-[44px] rounded-xl bg-[#111111] px-4 font-display text-xs font-bold text-[#F5F3EE]"
                        >
                          Avisarme
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* STEP 3 — MINIMAL DATA + DIRECT CONFIRMATION (ZERO SCROLL) */}
            {step === 3 && selectedSlot && (
              <form id="booking-confirm-form" onSubmit={handleConfirmBooking} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    Último paso
                  </h1>
                  <span className="font-mono-data text-xs font-bold text-[#111111]/75 tabular-nums">
                    {formatReadableDate(selectedDate)} · {selectedSlot.timeLabel} ·{' '}
                    {formatEuro(totals.priceCents)}
                  </span>
                </div>

                {/* Compact 1-Line Booking Summary */}
                <div className="rounded-2xl border border-[#111111]/12 bg-[#111111] px-4 py-3 text-[#F5F3EE] flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium">
                    {selectedServices.map((s) => s.name).join(' + ')} · {selectedSlot.staffName}
                  </span>
                  <span className="font-mono-data font-bold tabular-nums shrink-0 text-[#E8E4DD]">
                    {totals.durationMinutes} min
                  </span>
                </div>

                <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-4 sm:p-5 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="font-mono-data text-xs font-bold">Nombre *</span>
                      <input
                        required
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre"
                        className="w-full min-h-[46px] rounded-xl border border-[#111111]/20 bg-white px-3.5 text-sm focus:border-[#111111] focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="font-mono-data text-xs font-bold">Teléfono *</span>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="600 000 000"
                        className="w-full min-h-[46px] rounded-xl border border-[#111111]/20 bg-white px-3.5 text-sm focus:border-[#111111] focus:outline-none"
                      />
                    </label>
                  </div>

                  {/* Privacy Checkbox — Large Mobile Hitbox */}
                  <label className="flex items-start gap-3 min-h-[44px] py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 accent-[#E63B2E]"
                    />
                    <span className="text-xs leading-relaxed text-[#111111]/85">
                      Acepto la{' '}
                      <Link to="/privacidad" target="_blank" className="underline font-bold">
                        Política de privacidad
                      </Link>{' '}
                      y{' '}
                      <Link
                        to="/condiciones-reserva"
                        target="_blank"
                        className="underline font-bold"
                      >
                        condiciones de reserva
                      </Link>
                      . *
                    </span>
                  </label>

                  {/* Collapsible Optional Fields (Hidden by default for Zero Scroll) */}
                  <div className="border-t border-[#111111]/10 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setShowExtras((v) => !v)}
                      className="w-full min-h-[40px] flex items-center justify-between font-mono-data text-xs text-[#111111]/70 hover:text-[#111111]"
                    >
                      <span>¿Ya viniste antes? · Añadir email o nota (opcional)</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showExtras ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {showExtras && (
                      <div className="mt-3 space-y-3 border-t border-[#111111]/10 pt-3">
                        {/* Returning Customer Fast Recovery */}
                        <div className="rounded-xl bg-[#E8E4DD]/65 p-3 space-y-2">
                          <p className="flex items-center gap-1.5 font-mono-data text-[11px] font-bold">
                            <UserCheck className="h-3.5 w-3.5 text-[#E63B2E]" />
                            <span>Recuperar datos con código anterior</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="tel"
                              inputMode="tel"
                              placeholder="Teléfono"
                              value={lookupPhone}
                              onChange={(e) => setLookupPhone(e.target.value)}
                              className="min-h-[40px] rounded-lg border border-[#111111]/20 bg-white px-3 text-xs"
                            />
                            <input
                              placeholder="Código (CS-...)"
                              value={lookupCode}
                              onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                              className="min-h-[40px] rounded-lg border border-[#111111]/20 bg-white px-3 font-mono-data text-xs uppercase"
                            />
                            <button
                              type="button"
                              onClick={handleLookupCustomer}
                              className="min-h-[40px] rounded-lg bg-[#111111] px-3 font-display text-xs font-bold text-[#F5F3EE]"
                            >
                              Recuperar
                            </button>
                          </div>
                          {lookupMessage && (
                            <p className="text-[11px] font-medium text-[#E63B2E]">{lookupMessage}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email (opcional)"
                            className="min-h-[42px] rounded-xl border border-[#111111]/20 bg-white px-3 text-xs"
                          />
                          <select
                            value={preferredChannel}
                            onChange={(e) => setPreferredChannel(e.target.value as any)}
                            className="min-h-[42px] rounded-xl border border-[#111111]/20 bg-white px-3 text-xs"
                          >
                            <option value="NONE">Avisos: Solo web (/mi-cita)</option>
                            <option value="WHATSAPP">Avisos: WhatsApp</option>
                            <option value="EMAIL">Avisos: Email</option>
                            <option value="SMS">Avisos: SMS</option>
                          </select>
                        </div>

                        <input
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Nota para tu barbero (opcional)"
                          className="w-full min-h-[42px] rounded-xl border border-[#111111]/20 bg-white px-3 text-xs"
                        />

                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={marketingOptIn}
                            onChange={(e) => setMarketingOptIn(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-[#E63B2E]"
                          />
                          <span className="text-[11px] text-[#111111]/70">
                            Acepto recibir avisos promocionales de Club Segorbe.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-xl border border-[#E63B2E] bg-[#E63B2E]/10 px-3.5 py-2.5 text-xs font-medium text-[#E63B2E]">
                    {submitError}
                  </div>
                )}
              </form>
            )}

            {/* STEP 4 — BOOKING CONFIRMED */}
            {step === 4 && confirmedBooking && (
              <div className="rounded-3xl border border-[#111111]/15 bg-[#111111] p-6 sm:p-10 text-[#F5F3EE] space-y-6">
                <div className="space-y-1.5">
                  <p className="font-mono-data text-xs tracking-[0.2em] text-[#E63B2E]">
                    CÓDIGO · {confirmedBooking.bookingCode}
                  </p>
                  <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight">
                    CITA CONFIRMADA.
                  </h1>
                  <p className="text-xs sm:text-sm text-[#E8E4DD]/75">
                    Guarda tu código para consultar, cambiar o cancelar tu cita desde el móvil.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-[#F5F3EE]/15 py-4 text-xs sm:text-sm">
                  <div>
                    <p className="font-mono-data text-[11px] text-[#E8E4DD]/55">Fecha y hora</p>
                    <p className="mt-1 font-mono-data font-bold tabular-nums">
                      {confirmedBooking.dateMadrid} · {confirmedBooking.timeMadrid}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-data text-[11px] text-[#E8E4DD]/55">Profesional</p>
                    <p className="mt-1 font-display font-bold">{confirmedBooking.staff?.name}</p>
                  </div>
                  <div>
                    <p className="font-mono-data text-[11px] text-[#E8E4DD]/55">Servicio</p>
                    <p className="mt-1">
                      {confirmedBooking.services.map((s) => s.serviceNameSnapshot).join(' + ')}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono-data text-[11px] text-[#E8E4DD]/55">Importe</p>
                    <p className="mt-1 font-mono-data font-bold tabular-nums">
                      {confirmedBooking.totalDurationMinutes} min ·{' '}
                      {formatEuro(confirmedBooking.totalPriceCents)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      downloadIcsFile(
                        confirmedBooking,
                        boot?.business?.businessName || 'Club Segorbe',
                        boot?.business?.address ?? null
                      )
                    }
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#F5F3EE] px-5 py-2.5 font-display text-xs font-bold text-[#111111]"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    <span>Añadir al calendario</span>
                  </button>

                  <Link
                    to={`/mi-cita?code=${encodeURIComponent(
                      confirmedBooking.bookingCode
                    )}&token=${encodeURIComponent(confirmedBooking.accessToken)}`}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#E63B2E] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
                  >
                    <span>Gestionar mi cita</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    to="/"
                    className="min-h-[44px] inline-flex items-center justify-center rounded-full border border-[#F5F3EE]/25 px-5 py-2.5 font-display text-xs font-medium text-[#F5F3EE]"
                  >
                    <span>Inicio</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* THUMB-ZONE FIXED BOTTOM CTA BAR (<= 8% viewport height) */}
      {step < 4 && activeServices.length > 0 && (boot?.staff.length ?? 0) > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#111111]/12 bg-[#F5F3EE]/95 backdrop-blur-md px-3.5 sm:px-6 py-2">
          <div className="mx-auto max-w-3xl flex items-center justify-between gap-3">
            {step === 1 && (
              <>
                <div className="font-mono-data text-xs tabular-nums min-w-0">
                  {selectedServices.length > 0 ? (
                    <span className="truncate block">
                      <strong>{formatEuro(totals.priceCents)}</strong> · {totals.durationMinutes} min
                    </span>
                  ) : (
                    <span className="text-[#111111]/60 truncate block">Elige un servicio</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={selectedServiceIds.length === 0}
                  onClick={goToStep2}
                  className="cs-btn-signal min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#E63B2E] px-6 font-display text-xs sm:text-sm font-bold text-[#F5F3EE] disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <span>Elegir hora</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-full border border-[#111111]/20 bg-white px-4 font-display text-xs font-bold shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Servicios</span>
                </button>
                <div className="font-mono-data text-xs truncate text-center flex-1">
                  {selectedSlot ? (
                    <span className="font-bold">
                      {formatReadableDate(selectedDate)} · {selectedSlot.timeLabel}
                    </span>
                  ) : (
                    <span className="text-[#111111]/60">Toca una hora libre</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={() => setStep(3)}
                  className="cs-btn-signal min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[#E63B2E] px-6 font-display text-xs sm:text-sm font-bold text-[#F5F3EE] disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <span>Continuar</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-full border border-[#111111]/20 bg-white px-4 font-display text-xs font-bold shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Hora</span>
                </button>
                <button
                  type="submit"
                  form="booking-confirm-form"
                  disabled={
                    submitting ||
                    fullName.trim().length < 2 ||
                    phone.trim().length < 7 ||
                    !privacyAccepted
                  }
                  className="cs-btn-signal min-h-[44px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-full bg-[#E63B2E] px-7 font-display text-xs sm:text-sm font-bold text-[#F5F3EE] disabled:opacity-40 whitespace-nowrap"
                >
                  <Clock className={`h-4 w-4 ${submitting ? 'animate-spin' : 'hidden'}`} />
                  <span>{submitting ? 'Confirmando...' : 'Confirmar cita'}</span>
                  <Check className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
