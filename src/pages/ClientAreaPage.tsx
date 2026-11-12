import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Download,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiFetch } from '../lib/api';
import {
  AvailableSlot,
  BookingSummary,
  PublicBusinessInfo,
  formatEuro,
} from '../types/domain';

interface MyBookingResponse {
  booking: BookingSummary;
  customer: { fullName: string; phone: string; email: string | null };
  compatibleStaff: Array<{ id: number; name: string; roleTitle: string }>;
  policies: { cancelCutoffHours: number; rescheduleCutoffHours: number } | null;
}

interface HistoryResponse {
  customer: { fullName: string; phone: string; email: string | null } | null;
  bookings: Array<BookingSummary & { staffId: number; staffName: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No presentado',
};

export default function ClientAreaPage() {
  const [searchParams] = useSearchParams();

  const [bootBusiness, setBootBusiness] = useState<PublicBusinessInfo | null>(null);
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [phone, setPhone] = useState('');

  const [detail, setDetail] = useState<MyBookingResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Reschedule UI state
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newStaffId, setNewStaffId] = useState<number | undefined>(undefined);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Cancel UI state
  const [cancelReason, setCancelReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const todayMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

  useEffect(() => {
    apiFetch<{ business: PublicBusinessInfo | null }>('/api/public/bootstrap')
      .then((res) => setBootBusiness(res.business))
      .catch(() => {});
  }, []);

  const loadBookingAndHistory = async (c: string, t: string, p: string) => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const params = new URLSearchParams({ code: c.trim().toUpperCase() });
      if (t) params.set('token', t);
      if (p) params.set('phone', p);

      const res = await apiFetch<MyBookingResponse>(`/api/public/my-booking?${params.toString()}`);
      setDetail(res);
      setCode(res.booking.bookingCode);
      setToken(res.booking.accessToken);
      setRescheduleOpen(false);
      setConfirmCancel(false);
      setNewDate(res.booking.dateMadrid);
      setNewStaffId(res.booking.staff?.id);

      const hist = await apiFetch<HistoryResponse>(`/api/public/my-bookings?${params.toString()}`);
      setHistory(hist);
    } catch (err: any) {
      setError(err.message || 'No se pudo localizar la cita.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlCode = searchParams.get('code');
    const urlToken = searchParams.get('token');
    if (urlCode && urlToken) {
      setCode(urlCode);
      setToken(urlToken);
      loadBookingAndHistory(urlCode, urlToken, '');
    }
  }, [searchParams]);

  // Fetch reschedule slots
  useEffect(() => {
    if (!rescheduleOpen || !detail || !newDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const serviceIds = detail.booking.services.map((s) => s.serviceId).join(',');
    const params = new URLSearchParams({
      date: newDate,
      serviceIds,
      excludeAppointmentId: String(detail.booking.id),
    });
    if (newStaffId) params.set('staffId', String(newStaffId));

    apiFetch<{ slots: AvailableSlot[] }>(`/api/public/availability/slots?${params.toString()}`)
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [rescheduleOpen, newDate, newStaffId, detail]);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadBookingAndHistory(code, token, phone);
  };

  const handleConfirmReschedule = async () => {
    if (!detail || !selectedSlot) return;
    setError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await apiFetch('/api/public/my-booking/reschedule', {
        method: 'POST',
        body: JSON.stringify({
          bookingCode: detail.booking.bookingCode,
          token: token || undefined,
          phone: phone || undefined,
          newStartAtUtc: selectedSlot.startUtc,
          newStaffId: newStaffId ?? selectedSlot.staffId,
        }),
      });
      await loadBookingAndHistory(detail.booking.bookingCode, token, phone);
      setActionMessage(`Cita cambiada al ${selectedSlot.timeLabel} h. ¡Te esperamos!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!detail) return;
    setError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await apiFetch('/api/public/my-booking/cancel', {
        method: 'POST',
        body: JSON.stringify({
          bookingCode: detail.booking.bookingCode,
          token: token || undefined,
          phone: phone || undefined,
          reason: cancelReason || 'Cancelada por el cliente',
        }),
      });
      await loadBookingAndHistory(detail.booking.bookingCode, token, phone);
      setActionMessage('Cita cancelada. Gracias por avisar: el hueco queda libre para otro cliente.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  };

  const handleExportRgpd = async () => {
    if (!detail) return;
    const params = new URLSearchParams({ code: detail.booking.bookingCode });
    if (token) params.set('token', token);
    if (phone) params.set('phone', phone);
    let data: unknown;
    try {
      data = await apiFetch<any>(`/api/public/my-data/export?${params.toString()}`);
    } catch (err: any) {
      setError(err.message);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-datos-barberia-segorbe-${detail.booking.bookingCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canModify =
    detail && (detail.booking.status === 'CONFIRMED' || detail.booking.status === 'PENDING');

  return (
    <div className="min-h-screen bg-[#E8E4DD] text-[#111111] flex flex-col">
      <Navbar variant="solid" />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 pt-18 sm:pt-24 pb-16 space-y-6">
        <div>
          <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">
            ÁREA DEL CLIENTE
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Gestiona tu cita
          </h1>
          <p className="mt-1.5 text-sm text-[#111111]/75 max-w-xl">
            Consulta tu reserva, cambia la fecha u hora, o cancela sin llamadas.
          </p>
        </div>

        {/* Lookup form */}
        <form
          onSubmit={handleLookupSubmit}
          className="rounded-3xl border border-[#111111]/12 bg-[#F5F3EE] p-4 sm:p-6 space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Código (ej. CS-7K2M9Q)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="min-h-[46px] rounded-xl border border-[#111111]/20 bg-white px-4 py-2.5 font-mono-data text-sm uppercase"
            />
            <input
              type="tel"
              inputMode="tel"
              placeholder="Teléfono usado al reservar"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-[46px] rounded-xl border border-[#111111]/20 bg-white px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="cs-btn-signal min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-2.5 font-display text-sm font-bold text-[#F5F3EE]"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Buscando...' : 'Consultar cita'}</span>
            </button>
          </div>
          <p className="border-t border-[#111111]/10 pt-3 text-xs text-[#111111]/65">
            Encontrarás el código en la confirmación de tu reserva.{' '}
            <button
              type="button"
              onClick={() => {
                setCode('CS-DEMO26');
                setPhone('600111222');
                setToken('');
              }}
              className="font-mono-data font-bold text-[#E63B2E] underline"
            >
              Probar con la cita demo (CS-DEMO26 · 600111222)
            </button>
          </p>
        </form>

        {error && (
          <div className="rounded-2xl border border-[#E63B2E] bg-[#E63B2E]/10 px-5 py-4 text-sm font-medium text-[#E63B2E]">
            {error}
          </div>
        )}

        {actionMessage && (
          <div className="rounded-2xl border border-[#15803D] bg-[#15803D]/10 px-5 py-4 text-sm font-medium text-[#15803D]">
            {actionMessage}
          </div>
        )}

        {detail && (
          <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#111111]/10 pb-4">
              <div>
                <p className="font-mono-data text-xs text-[#111111]/60">
                  Código · {detail.booking.bookingCode}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  {detail.booking.services.map((s) => s.serviceNameSnapshot).join(' + ')}
                </h2>
              </div>
              <span
                className={`font-mono-data text-xs font-bold uppercase ${
                  detail.booking.status === 'CANCELLED'
                    ? 'text-[#E63B2E]'
                    : detail.booking.status === 'COMPLETED'
                    ? 'text-[#15803D]'
                    : 'text-[#111111]'
                }`}
              >
                Estado: {STATUS_LABELS[detail.booking.status] || detail.booking.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
              <div>
                <p className="font-mono-data text-xs text-[#111111]/60">Fecha y hora (Murcia)</p>
                <p className="mt-1 font-mono-data text-base font-bold tabular-nums">
                    {new Date(detail.booking.startAtUtc).toLocaleDateString('es-ES', {
                    timeZone: 'Europe/Madrid',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}{' '}
                  · {detail.booking.timeMadrid}
                </p>
              </div>
              <div>
                <p className="font-mono-data text-xs text-[#111111]/60">Profesional</p>
                <p className="mt-1 font-medium">{detail.booking.staff?.name}</p>
              </div>
              <div>
                <p className="font-mono-data text-xs text-[#111111]/60">Duración e importe</p>
                <p className="mt-1 font-mono-data font-bold tabular-nums">
                  {detail.booking.totalDurationMinutes} min ·{' '}
                  {formatEuro(detail.booking.totalPriceCents)}
                </p>
              </div>
            </div>

            {canModify && (
              <div className="flex flex-wrap gap-3 border-t border-[#111111]/10 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleOpen((v) => !v);
                    setConfirmCancel(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 font-display text-xs font-bold text-[#F5F3EE]"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Cambiar fecha, hora o barbero</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmCancel((v) => !v);
                    setRescheduleOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E63B2E] px-5 py-3 font-display text-xs font-bold text-[#E63B2E] hover:bg-[#E63B2E] hover:text-[#F5F3EE] transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancelar cita</span>
                </button>
              </div>
            )}

            {rescheduleOpen && canModify && (
              <div className="rounded-2xl border border-[#111111]/15 bg-[#E8E4DD]/60 p-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="font-mono-data text-xs font-bold">Nueva fecha</span>
                    <input
                      type="date"
                      min={todayMadrid}
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-mono-data text-xs font-bold">Profesional compatible</span>
                    <select
                      value={newStaffId ?? ''}
                      onChange={(e) => setNewStaffId(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5 text-sm"
                    >
                      {detail.compatibleStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {loadingSlots ? (
                  <p className="font-mono-data text-xs text-[#111111]/60">Consultando disponibilidad real...</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-[#E63B2E]">
                    No hay huecos libres para esta fecha y profesional. Prueba otro día u otro barbero.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startUtc}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-xl border py-2 font-mono-data text-xs tabular-nums ${
                          selectedSlot?.startUtc === slot.startUtc
                            ? 'border-[#E63B2E] bg-[#E63B2E] text-[#F5F3EE] font-bold'
                            : 'border-[#111111]/15 bg-white'
                        }`}
                      >
                        {slot.timeLabel}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={!selectedSlot || busy}
                    onClick={handleConfirmReschedule}
                    className="rounded-full bg-[#E63B2E] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE] disabled:opacity-40"
                  >
                    {busy ? 'Guardando…' : 'Guardar nuevo horario'}
                  </button>
                </div>
              </div>
            )}

            {canModify && confirmCancel && (
              <div className="rounded-2xl border border-[#E63B2E]/40 bg-[#E63B2E]/5 p-5 space-y-3">
                <p className="font-display text-sm font-bold">¿Seguro que quieres cancelar esta cita?</p>
                <label className="block space-y-1">
                  <span className="font-mono-data text-xs text-[#111111]/60">Motivo (opcional)</span>
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ej. Cambio de agenda"
                    className="w-full rounded-xl border border-[#111111]/15 bg-white px-3.5 py-2 text-sm"
                  />
                </label>
                {detail.policies && (
                  <p className="text-xs text-[#111111]/65">
                    Las cancelaciones online se aceptan hasta {detail.policies.cancelCutoffHours} h antes.
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-full border border-[#111111]/20 px-5 py-2.5 font-display text-xs font-bold"
                  >
                    Mantener cita
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleCancelBooking}
                    className="rounded-full bg-[#E63B2E] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE] disabled:opacity-50"
                  >
                    {busy ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-[#111111]/10 pt-4 text-xs">
              <button
                type="button"
                onClick={handleExportRgpd}
                className="inline-flex items-center gap-1.5 font-mono-data text-[#111111]/70 hover:text-[#111111] underline"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar mis datos personales (RGPD)</span>
              </button>

              {detail.booking.services[0] && (
                <Link
                  to={`/reservar?servicio=${detail.booking.services[0].serviceId}`}
                  className="inline-flex items-center gap-1.5 font-display font-bold text-[#E63B2E]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Volver a reservar servicio</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Past & upcoming bookings history */}
        {history && history.bookings.length > 0 && (
          <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 sm:p-8 space-y-4">
            <h2 className="font-display text-xl font-bold">
              Historial de reservas · {history.customer?.fullName}
            </h2>
            <div className="divide-y divide-[#111111]/10">
              {(showAllHistory ? history.bookings : history.bookings.slice(0, 6)).map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 text-sm"
                >
                  <div>
                    <p className="font-mono-data text-xs text-[#111111]/60">
                      {b.bookingCode} · {b.dateMadrid} {b.timeMadrid} · {b.staffName}
                    </p>
                    <p className="font-display font-bold">
                      {b.services.map((s) => s.serviceNameSnapshot).join(' + ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono-data text-xs">
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadBookingAndHistory(b.bookingCode, b.accessToken, phone)}
                      className="inline-flex items-center gap-1 font-display text-xs font-bold text-[#E63B2E]"
                    >
                      <span>Abrir</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {history.bookings.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((v) => !v)}
                className="font-mono-data text-xs font-bold underline"
              >
                {showAllHistory ? 'Ver menos' : `Ver las ${history.bookings.length} reservas`}
              </button>
            )}
          </section>
        )}
      </main>

      <Footer business={bootBusiness} systemOperational={true} />
    </div>
  );
}
