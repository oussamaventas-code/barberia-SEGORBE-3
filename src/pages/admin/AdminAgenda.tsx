import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Plus,
  RefreshCw,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { ServiceItem, StaffMember, formatEuro } from '../../types/domain';

interface AgendaAppt {
  id: number;
  bookingCode: string;
  status: string;
  dateMadrid: string;
  timeMadrid: string;
  endTimeMadrid: string;
  totalPriceCents: number | null;
  totalDurationMinutes: number;
  staffId: number;
  customer: { id: number; fullName: string; phone: string } | null;
  staff: { id: number; name: string } | null;
  services: Array<{ serviceId: number; serviceNameSnapshot: string }>;
  payments: Array<{ id: number; amountCents: number; method: string; status: string }>;
}

interface AgendaBlock {
  id: number;
  staffId: number | null;
  blockType: string;
  title: string;
  dateMadrid: string;
  timeMadrid: string;
  endTimeMadrid: string;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function madridToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Converts local Europe/Madrid YYYY-MM-DD + HH:MM into UTC ISO string via server-safe probe
 */
function localMadridToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(guess);
  const val = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0');
  let h = val('hour');
  if (h === 24) h = 0;
  const tzMs = Date.UTC(val('year'), val('month') - 1, val('day'), h, val('minute'), 0);
  const offset = tzMs - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'text-[#B45309]',
  CONFIRMED: 'text-[#111111]',
  COMPLETED: 'text-[#15803D]',
  CANCELLED: 'text-[#E63B2E] line-through',
  NO_SHOW: 'text-[#E63B2E]',
};

export default function AdminAgenda() {
  const { getToken } = useAuth();
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('DAY');
  const [focusDate, setFocusDate] = useState(madridToday);
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [appointments, setAppointments] = useState<AgendaAppt[]>([]);
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [activeAppt, setActiveAppt] = useState<AgendaAppt | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AgendaAppt | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<AgendaAppt | null>(null);

  // New Manual Booking Form
  const [nbServiceId, setNbServiceId] = useState<number>(0);
  const [nbStaffId, setNbStaffId] = useState<number>(0);
  const [nbDate, setNbDate] = useState(focusDate);
  const [nbTime, setNbTime] = useState('10:00');
  const [nbName, setNbName] = useState('');
  const [nbPhone, setNbPhone] = useState('');
  const [nbBypassHours, setNbBypassHours] = useState(false);

  // Block Slot Form
  const [blkStaffId, setBlkStaffId] = useState<string>('');
  const [blkDate, setBlkDate] = useState(focusDate);
  const [blkStart, setBlkStart] = useState('14:00');
  const [blkEnd, setBlkEnd] = useState('15:00');
  const [blkType, setBlkType] = useState<'BREAK' | 'BLOCKED' | 'VACATION' | 'MEETING'>('BREAK');
  const [blkTitle, setBlkTitle] = useState('Descanso');

  // Reschedule Form
  const [rsDate, setRsDate] = useState('');
  const [rsTime, setRsTime] = useState('');
  const [rsStaffId, setRsStaffId] = useState<number>(0);

  // Payment Form
  const [payEuros, setPayEuros] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'BIZUM' | 'OTHER'>('CARD');

  const dateRange = useMemo(() => {
    if (viewMode === 'DAY') return { from: focusDate, to: focusDate };
    if (viewMode === 'WEEK') return { from: focusDate, to: addDays(focusDate, 6) };
    return { from: `${focusDate.slice(0, 7)}-01`, to: addDays(`${focusDate.slice(0, 7)}-01`, 30) };
  }, [viewMode, focusDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      if (staffFilter !== 'ALL') params.set('staffId', staffFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const [ag, st, sv] = await Promise.all([
        apiFetch<{ appointments: AgendaAppt[]; blockedSlots: AgendaBlock[] }>(
          `/api/admin/agenda?${params.toString()}`,
          { token }
        ),
        apiFetch<{ staff: StaffMember[] }>('/api/admin/staff', { token }),
        apiFetch<{ services: ServiceItem[] }>('/api/admin/services', { token }),
      ]);
      setAppointments(ag.appointments);
      setBlocks(ag.blockedSlots);
      setStaffList(st.staff);
      const activeSvcs = sv.services.filter((s) => s.isActive && s.isConfigured);
      setServicesList(activeSvcs);
      if (activeSvcs[0] && !nbServiceId) setNbServiceId(activeSvcs[0].id);
      const defaultStaff = st.staff.find((x) => x.isActive) ?? st.staff[0];
      if (defaultStaff && !nbStaffId) setNbStaffId(defaultStaff.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange.from, dateRange.to, staffFilter, statusFilter]);

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/appointments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          serviceIds: [nbServiceId],
          staffId: nbStaffId,
          startAtUtc: localMadridToIso(nbDate, nbTime),
          customerFullName: nbName,
          customerPhone: nbPhone,
          bypassWorkingHours: nbBypassHours,
        }),
      });
      setNewBookingOpen(false);
      setNbName('');
      setNbPhone('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/blocked-slots', {
        method: 'POST',
        token,
        body: JSON.stringify({
          staffId: blkStaffId ? Number(blkStaffId) : null,
          startAtUtc: localMadridToIso(blkDate, blkStart),
          endAtUtc: localMadridToIso(blkDate, blkEnd),
          blockType: blkType,
          title: blkTitle,
        }),
      });
      setBlockModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (apptId: number, status: string) => {
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/appointments/${apptId}/status`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      });
      setActiveAppt(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/appointments/${rescheduleTarget.id}/reschedule`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          newStartAtUtc: localMadridToIso(rsDate, rsTime),
          newStaffId: rsStaffId,
          enforceWorkingHours: false,
        }),
      });
      setRescheduleTarget(null);
      setActiveAppt(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          appointmentId: paymentTarget.id,
          amountCents: Math.round(Number(payEuros) * 100),
          method: payMethod,
        }),
      });
      setPaymentTarget(null);
      setActiveAppt(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBlock = async (id: number) => {
    const token = await getToken();
    await apiFetch(`/api/admin/blocked-slots/${id}`, { method: 'DELETE', token });
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
        <div>
          <p className="font-mono-data text-xs text-[#E63B2E]">AGENDA INTELIGENTE</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Calendario operativo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNbDate(focusDate);
              setNewBookingOpen(true);
            }}
            className="cs-btn-signal inline-flex items-center gap-1.5 rounded-full bg-[#E63B2E] px-4 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nueva cita manual</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBlkDate(focusDate);
              setBlockModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#111111]/20 bg-[#F5F3EE] px-4 py-2.5 font-display text-xs font-bold"
          >
            <Ban className="h-3.5 w-3.5" />
            <span>Bloquear franja / descanso</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-4">
        <div className="flex items-center gap-1 rounded-xl bg-[#E8E4DD] p-1">
          {(['DAY', 'WEEK', 'MONTH'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1.5 font-mono-data text-xs font-bold ${
                viewMode === mode ? 'bg-[#111111] text-[#F5F3EE]' : 'text-[#111111]/70'
              }`}
            >
              {mode === 'DAY' ? 'Día' : mode === 'WEEK' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setFocusDate((prev) =>
                  addDays(prev, viewMode === 'DAY' ? -1 : viewMode === 'WEEK' ? -7 : -30)
                )
              }
              aria-label="Periodo anterior"
              className="rounded-xl border border-[#111111]/15 bg-white p-2 hover:bg-[#E8E4DD]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <input
              type="date"
              value={focusDate}
              onChange={(e) => setFocusDate(e.target.value)}
              className="rounded-xl border border-[#111111]/15 bg-white px-3 py-2"
            />
            <button
              type="button"
              onClick={() =>
                setFocusDate((prev) =>
                  addDays(prev, viewMode === 'DAY' ? 1 : viewMode === 'WEEK' ? 7 : 30)
                )
              }
              aria-label="Siguiente periodo"
              className="rounded-xl border border-[#111111]/15 bg-white p-2 hover:bg-[#E8E4DD]"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setFocusDate(madridToday())}
              className="rounded-xl border border-[#111111]/15 bg-white px-3 py-2 font-bold hover:bg-[#E8E4DD]"
            >
              Hoy
            </button>
          </div>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-xl border border-[#111111]/15 bg-white px-3 py-2"
          >
            <option value="ALL">Todos los profesionales</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#111111]/15 bg-white px-3 py-2"
          >
            <option value="ALL">Todos los estados</option>
            <option value="CONFIRMED">Confirmadas</option>
            <option value="PENDING">Pendientes</option>
            <option value="COMPLETED">Completadas</option>
            <option value="CANCELLED">Canceladas</option>
            <option value="NO_SHOW">No presentado</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#E63B2E] bg-[#E63B2E]/10 px-4 py-3 text-sm font-medium text-[#E63B2E]">
          {error}
        </div>
      )}

      {/* Visual Blocks List / Columns */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-[2rem] bg-[#F5F3EE]" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Appointment Blocks */}
          <div className="lg:col-span-8 space-y-3">
            {appointments.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[#111111]/20 bg-[#F5F3EE] p-10 text-center space-y-3">
                <CalendarPlus className="mx-auto h-7 w-7 text-[#111111]/40" />
                <p className="font-display text-lg font-bold">
                  No hay citas en el periodo seleccionado
                </p>
                <p className="text-xs text-[#111111]/65">
                  Usa "Nueva cita manual" para agendar directamente desde aquí.
                </p>
              </div>
            ) : (
              appointments.map((appt) => {
                const paidTotal = appt.payments
                  .filter((p) => p.status === 'PAID')
                  .reduce((acc, p) => acc + p.amountCents, 0);
                return (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={() => setActiveAppt(appt)}
                    className="w-full text-left rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-4 sm:p-5 hover:border-[#111111] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs text-[#111111]/65 tabular-nums">
                        <span className="font-bold text-[#111111]">
                          {appt.dateMadrid} · {appt.timeMadrid}–{appt.endTimeMadrid}
                        </span>
                        <span>·</span>
                        <span>{appt.totalDurationMinutes} min</span>
                        <span>·</span>
                        <span>{appt.staff?.name}</span>
                        <span>·</span>
                        <span>{appt.bookingCode}</span>
                      </div>
                      <h3 className="font-display text-lg font-bold">
                        {appt.customer?.fullName}{' '}
                        <span className="font-normal text-sm text-[#111111]/65">
                          ({appt.customer?.phone})
                        </span>
                      </h3>
                      <p className="text-xs text-[#111111]/75">
                        {appt.services.map((s) => s.serviceNameSnapshot).join(' + ')}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                      <span
                        className={`font-mono-data text-xs font-bold ${
                          STATUS_BADGE[appt.status] || ''
                        }`}
                      >
                        {appt.status}
                      </span>
                      <span className="font-mono-data text-xs tabular-nums text-[#111111]/70">
                        {paidTotal > 0
                          ? `Cobrado ${formatEuro(paidTotal)}`
                          : formatEuro(appt.totalPriceCents)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Blocked Slots & Breaks Column */}
          <div className="lg:col-span-4 rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-5 space-y-4 self-start">
            <h2 className="font-display text-base font-bold">Bloqueos y descansos</h2>
            {blocks.length === 0 ? (
              <p className="font-mono-data text-xs text-[#111111]/60">
                Sin franjas bloqueadas en este rango.
              </p>
            ) : (
              <div className="space-y-2.5">
                {blocks.map((blk) => (
                  <div
                    key={blk.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-[#111111]/10 bg-white p-3 text-xs"
                  >
                    <div>
                      <p className="font-mono-data font-bold text-[#B45309]">
                        {blk.blockType} · {blk.dateMadrid} {blk.timeMadrid}–{blk.endTimeMadrid}
                      </p>
                      <p className="mt-0.5 font-medium">{blk.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(blk.id)}
                      className="text-[#111111]/45 hover:text-[#E63B2E]"
                      title="Eliminar bloqueo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Appointment Action Drawer/Modal */}
      {activeAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-[#F5F3EE] p-6 sm:p-8 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono-data text-xs text-[#E63B2E]">
                  {activeAppt.bookingCode} · {activeAppt.status}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  {activeAppt.customer?.fullName}
                </h2>
                <p className="font-mono-data text-xs text-[#111111]/70">
                  {activeAppt.dateMadrid} {activeAppt.timeMadrid}–{activeAppt.endTimeMadrid} ·{' '}
                  {activeAppt.staff?.name}
                </p>
              </div>
              <button type="button" onClick={() => setActiveAppt(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-y border-[#111111]/12 py-4">
              {activeAppt.status !== 'COMPLETED' && activeAppt.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeAppt.id, 'COMPLETED')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#15803D] px-4 py-2 text-xs font-bold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Marcar completada</span>
                </button>
              )}
              {activeAppt.status !== 'NO_SHOW' && activeAppt.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeAppt.id, 'NO_SHOW')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309] px-4 py-2 text-xs font-bold text-[#B45309]"
                >
                  <UserX className="h-3.5 w-3.5" />
                  <span>No presentado</span>
                </button>
              )}
              {activeAppt.status !== 'CANCELLED' && activeAppt.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleTarget(activeAppt);
                    setRsDate(activeAppt.dateMadrid);
                    setRsTime(activeAppt.timeMadrid);
                    setRsStaffId(activeAppt.staffId);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#111111]/25 px-4 py-2 text-xs font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reprogramar</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPaymentTarget(activeAppt);
                  setPayEuros(
                    activeAppt.totalPriceCents != null
                      ? (activeAppt.totalPriceCents / 100).toFixed(2)
                      : '0'
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 text-xs font-bold text-[#F5F3EE]"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Registrar cobro</span>
              </button>
              {activeAppt.status !== 'CANCELLED' && activeAppt.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(activeAppt.id, 'CANCELLED')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E63B2E] px-4 py-2 text-xs font-bold text-[#E63B2E]"
                >
                  <span>Cancelar cita</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Booking Modal */}
      {newBookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={handleCreateManual}
            className="w-full max-w-lg rounded-[2rem] bg-[#F5F3EE] p-6 sm:p-8 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Nueva cita manual</h2>
              <button type="button" onClick={() => setNewBookingOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Servicio</span>
                <select
                  required
                  value={nbServiceId}
                  onChange={(e) => setNbServiceId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                >
                  {servicesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes}m · {formatEuro(s.priceCents)})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Profesional</span>
                <select
                  required
                  value={nbStaffId}
                  onChange={(e) => setNbStaffId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Fecha</span>
                <input
                  type="date"
                  required
                  value={nbDate}
                  onChange={(e) => setNbDate(e.target.value)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Hora (Murcia)</span>
                <input
                  type="time"
                  required
                  value={nbTime}
                  onChange={(e) => setNbTime(e.target.value)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Nombre del cliente</span>
                <input
                  required
                  value={nbName}
                  onChange={(e) => setNbName(e.target.value)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="font-mono-data font-bold">Teléfono</span>
                <input
                  required
                  value={nbPhone}
                  onChange={(e) => setNbPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={nbBypassHours}
                onChange={(e) => setNbBypassHours(e.target.checked)}
              />
              <span>Permitir fuera de horario habitual (mantiene validación de solapamientos)</span>
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-[#E63B2E] py-3 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Guardar cita en agenda
            </button>
          </form>
        </div>
      )}

      {/* Block Slot Modal */}
      {blockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={handleCreateBlock}
            className="w-full max-w-md rounded-[2rem] bg-[#F5F3EE] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Bloquear franja horaria</h2>
              <button type="button" onClick={() => setBlockModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <select
                value={blkStaffId}
                onChange={(e) => setBlkStaffId(e.target.value)}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              >
                <option value="">Toda la barbería</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={blkType}
                onChange={(e) => setBlkType(e.target.value as any)}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              >
                <option value="BREAK">Descanso</option>
                <option value="BLOCKED">Bloqueo manual</option>
                <option value="VACATION">Vacaciones</option>
                <option value="MEETING">Reunión / formación</option>
              </select>
              <input
                required
                value={blkTitle}
                onChange={(e) => setBlkTitle(e.target.value)}
                placeholder="Motivo"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={blkDate}
                  onChange={(e) => setBlkDate(e.target.value)}
                  className="rounded-xl border border-[#111111]/20 bg-white px-2.5 py-2"
                />
                <input
                  type="time"
                  value={blkStart}
                  onChange={(e) => setBlkStart(e.target.value)}
                  className="rounded-xl border border-[#111111]/20 bg-white px-2.5 py-2"
                />
                <input
                  type="time"
                  value={blkEnd}
                  onChange={(e) => setBlkEnd(e.target.value)}
                  className="rounded-xl border border-[#111111]/20 bg-white px-2.5 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#111111] py-3 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Confirmar bloqueo
            </button>
          </form>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={handleReschedule}
            className="w-full max-w-md rounded-[2rem] bg-[#F5F3EE] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                Reprogramar {rescheduleTarget.bookingCode}
              </h2>
              <button type="button" onClick={() => setRescheduleTarget(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="date"
                required
                value={rsDate}
                onChange={(e) => setRsDate(e.target.value)}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              />
              <input
                type="time"
                required
                value={rsTime}
                onChange={(e) => setRsTime(e.target.value)}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              />
              <select
                value={rsStaffId}
                onChange={(e) => setRsStaffId(Number(e.target.value))}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#E63B2E] py-3 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Validar y reprogramar
            </button>
          </form>
        </div>
      )}

      {/* Record Real Payment Modal */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={handleRecordPayment}
            className="w-full max-w-md rounded-[2rem] bg-[#F5F3EE] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                Registrar cobro · {paymentTarget.bookingCode}
              </h2>
              <button type="button" onClick={() => setPaymentTarget(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="font-mono-data font-bold">Importe cobrado (€)</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payEuros}
                  onChange={(e) => setPayEuros(e.target.value)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-mono-data font-bold">Método de pago</span>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                >
                  <option value="CARD">Tarjeta</option>
                  <option value="CASH">Efectivo</option>
                  <option value="BIZUM">Bizum</option>
                  <option value="OTHER">Otro</option>
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#15803D] py-3 font-display text-sm font-bold text-white"
            >
              Confirmar cobro real
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
