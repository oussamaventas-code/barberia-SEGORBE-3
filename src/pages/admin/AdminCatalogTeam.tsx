import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { ServiceItem, formatEuro } from '../../types/domain';

interface StaffFull {
  id: number;
  name: string;
  roleTitle: string;
  bio: string | null;
  specialties: string | null;
  photoUrl: string | null;
  isActive: boolean;
  serviceIds: number[];
  workingHours: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    breakStart: string | null;
    breakEnd: string | null;
  }>;
  exceptions: Array<{
    id: number;
    date: string;
    type: string;
    reason: string | null;
  }>;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AdminCatalogTeam({ mode }: { mode: 'SERVICES' | 'TEAM' }) {
  const { getToken } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Service Form Modal
  const [svcModal, setSvcModal] = useState<Partial<ServiceItem> | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('');
  const [svcImage, setSvcImage] = useState('');
  const [svcActive, setSvcActive] = useState(true);
  const [svcStaffIds, setSvcStaffIds] = useState<number[]>([]);

  // Staff Form Modal
  const [staffModal, setStaffModal] = useState<Partial<StaffFull> | null>(null);
  const [stName, setStName] = useState('');
  const [stRole, setStRole] = useState('Barbero');
  const [stSpecialties, setStSpecialties] = useState('');
  const [stActive, setStActive] = useState(true);
  const [stServiceIds, setStServiceIds] = useState<number[]>([]);

  // Staff Working Hours & Vacation Modal
  const [hoursTarget, setHoursTarget] = useState<StaffFull | null>(null);
  const [hoursDraft, setHoursDraft] = useState<StaffFull['workingHours']>([]);
  const [excDate, setExcDate] = useState('');
  const [excType, setExcType] = useState<'DAY_OFF' | 'VACATION'>('DAY_OFF');
  const [excReason, setExcReason] = useState('');

  const load = async (): Promise<StaffFull[]> => {
    setLoading(true);
    try {
      const token = await getToken();
      const [sv, st] = await Promise.all([
        apiFetch<{ services: ServiceItem[] }>('/api/admin/services', { token }),
        apiFetch<{ staff: StaffFull[] }>('/api/admin/staff', { token }),
      ]);
      setServices(sv.services);
      setStaffList(st.staff);
      return st.staff;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openSvcEditor = (svc?: ServiceItem) => {
    if (svc) {
      setSvcModal(svc);
      setSvcName(svc.name);
      setSvcDesc(svc.description);
      setSvcPrice(svc.priceCents != null ? (svc.priceCents / 100).toString() : '');
      setSvcDuration(svc.durationMinutes != null ? String(svc.durationMinutes) : '');
      setSvcImage(svc.imageUrl || '');
      setSvcActive(svc.isActive);
      setSvcStaffIds(svc.staffIds ?? []);
    } else {
      setSvcModal({});
      setSvcName('');
      setSvcDesc('');
      setSvcPrice('');
      setSvcDuration('');
      setSvcImage('');
      setSvcActive(true);
      setSvcStaffIds(staffList.map((s) => s.id));
    }
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await getToken();
      const payload = {
        name: svcName,
        description: svcDesc,
        priceEuros: svcPrice !== '' ? Number(svcPrice) : null,
        durationMinutes: svcDuration !== '' ? Number(svcDuration) : null,
        imageUrl: svcImage || null,
        isActive: svcActive,
        staffIds: svcStaffIds,
      };
      if (svcModal?.id) {
        await apiFetch(`/api/admin/services/${svcModal.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/services', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
      }
      setSvcModal(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteService = async (id: number) => {
    const token = await getToken();
    await apiFetch(`/api/admin/services/${id}`, { method: 'DELETE', token });
    await load();
  };

  const openStaffEditor = (barber?: StaffFull) => {
    if (barber) {
      setStaffModal(barber);
      setStName(barber.name);
      setStRole(barber.roleTitle);
      setStSpecialties(barber.specialties || '');
      setStActive(barber.isActive);
      setStServiceIds(barber.serviceIds);
    } else {
      setStaffModal({});
      setStName('');
      setStRole('Barbero');
      setStSpecialties('');
      setStActive(true);
      setStServiceIds(services.filter((s) => s.isConfigured).map((s) => s.id));
    }
  };

  const saveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await getToken();
      const payload = {
        name: stName,
        roleTitle: stRole,
        specialties: stSpecialties,
        isActive: stActive,
        serviceIds: stServiceIds,
        useBusinessHours: true,
      };
      if (staffModal?.id) {
        await apiFetch(`/api/admin/staff/${staffModal.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/admin/staff', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
      }
      setStaffModal(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openHoursEditor = (barber: StaffFull) => {
    setHoursTarget(barber);
    const map = new Map(barber.workingHours.map((w) => [w.dayOfWeek, w]));
    setHoursDraft(
      [1, 2, 3, 4, 5, 6, 0].map(
        (dayOfWeek) =>
          map.get(dayOfWeek) ?? {
            dayOfWeek,
            isOpen: false,
            openTime: '09:30',
            closeTime: '20:00',
            breakStart: null,
            breakEnd: null,
          }
      )
    );
  };

  const saveHours = async () => {
    if (!hoursTarget) return;
    const token = await getToken();
    await apiFetch(`/api/admin/staff/${hoursTarget.id}/working-hours`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ hours: hoursDraft }),
    });
    setHoursTarget(null);
    await load();
  };

  const addStaffException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hoursTarget || !excDate) return;
    setError(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/availability-exceptions', {
        method: 'POST',
        token,
        body: JSON.stringify({
          staffId: hoursTarget.id,
          date: excDate,
          type: excType,
          reason: excReason || null,
        }),
      });
      setExcDate('');
      setExcReason('');
      const freshStaff = await load();
      const updated = freshStaff.find((s) => s.id === hoursTarget.id);
      if (updated) setHoursTarget(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteStaffException = async (exceptionId: number) => {
    if (!hoursTarget) return;
    setError(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/availability-exceptions/${exceptionId}`, {
        method: 'DELETE',
        token,
      });
      const freshStaff = await load();
      const updated = freshStaff.find((s) => s.id === hoursTarget.id);
      if (updated) setHoursTarget(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div>
          <p className="font-mono-data text-xs text-[#E63B2E]">
            {mode === 'SERVICES' ? 'CATÁLOGO DE SERVICIOS' : 'EQUIPO Y HORARIOS'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {mode === 'SERVICES' ? 'Servicios y tarifas' : 'Profesionales'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => (mode === 'SERVICES' ? openSvcEditor() : openStaffEditor())}
          className="cs-btn-signal inline-flex items-center gap-1.5 rounded-full bg-[#E63B2E] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
        >
          <Plus className="h-4 w-4" />
          <span>{mode === 'SERVICES' ? 'Nuevo servicio' : 'Nuevo profesional'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[#E63B2E] bg-[#E63B2E]/10 px-4 py-3 text-xs text-[#E63B2E]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-[2rem] bg-[#F5F3EE]" />
      ) : mode === 'SERVICES' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4"
            >
              <div>
                <div className="flex items-center justify-between font-mono-data text-xs">
                  <span className={s.isActive && s.isConfigured ? 'text-[#15803D]' : 'text-[#B45309]'}>
                    {s.isConfigured ? (s.isActive ? 'Activo' : 'Desactivado') : 'Pendiente configurar'}
                  </span>
                  <span>{s.durationMinutes ? `${s.durationMinutes} min` : 'Sin duración'}</span>
                </div>
                <h2 className="mt-2 font-display text-xl font-bold">{s.name}</h2>
                <p className="mt-1 text-xs text-[#111111]/75">{s.description}</p>
              </div>
              <div className="flex items-center justify-between border-t border-[#111111]/10 pt-3">
                <span className="font-mono-data text-base font-bold tabular-nums">
                  {formatEuro(s.priceCents)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openSvcEditor(s)}
                    className="rounded-lg border border-[#111111]/15 p-2 hover:bg-white"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteService(s.id)}
                    className="rounded-lg border border-[#111111]/15 p-2 text-[#E63B2E] hover:bg-white"
                    title="Eliminar (conserva historial)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : staffList.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[#111111]/20 bg-[#F5F3EE] p-10 text-center space-y-3">
          <p className="font-display text-lg font-bold">No hay profesionales registrados todavía</p>
          <p className="text-xs text-[#111111]/70">
            Añade al menos un barbero y asígnale los servicios que realiza para activar las reservas online.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {staffList.map((b) => (
            <div
              key={b.id}
              className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`font-mono-data text-xs font-bold ${
                      b.isActive ? 'text-[#15803D]' : 'text-[#111111]/45'
                    }`}
                  >
                    {b.isActive ? 'Activo' : 'Inactivo'} · {b.roleTitle}
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-bold">{b.name}</h2>
                  {b.specialties && (
                    <p className="mt-1 text-xs text-[#111111]/75">{b.specialties}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openStaffEditor(b)}
                  className="rounded-lg border border-[#111111]/15 p-2 hover:bg-white"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[#111111]/10 pt-3 font-mono-data text-xs">
                <span>{b.serviceIds.length} servicio(s) asignado(s)</span>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => openHoursEditor(b)}
                  className="font-bold text-[#E63B2E] underline"
                >
                  Configurar horario, descansos y vacaciones
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Modal */}
      {svcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={saveService}
            className="w-full max-w-lg rounded-[2rem] bg-[#F5F3EE] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {svcModal.id ? 'Editar servicio' : 'Nuevo servicio'}
              </h2>
              <button type="button" onClick={() => setSvcModal(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                required
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
                placeholder="Nombre del servicio"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
              <textarea
                required
                rows={2}
                value={svcDesc}
                onChange={(e) => setSvcDesc(e.target.value)}
                placeholder="Descripción breve"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  step="0.01"
                  value={svcPrice}
                  onChange={(e) => setSvcPrice(e.target.value)}
                  placeholder="Precio (€)"
                  className="rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
                />
                <input
                  required
                  type="number"
                  step="5"
                  value={svcDuration}
                  onChange={(e) => setSvcDuration(e.target.value)}
                  placeholder="Duración (min)"
                  className="rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
                />
              </div>
              {staffList.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-mono-data font-bold">Profesionales que realizan este servicio</p>
                  <div className="flex flex-wrap gap-2">
                    {staffList.map((st) => (
                      <label key={st.id} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 border border-[#111111]/15">
                        <input
                          type="checkbox"
                          checked={svcStaffIds.includes(st.id)}
                          onChange={(e) =>
                            setSvcStaffIds((prev) =>
                              e.target.checked ? [...prev, st.id] : prev.filter((x) => x !== st.id)
                            )
                          }
                        />
                        <span>{st.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={svcActive}
                  onChange={(e) => setSvcActive(e.target.checked)}
                />
                <span>Servicio activo y reservable online</span>
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#E63B2E] py-3 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Guardar servicio
            </button>
          </form>
        </div>
      )}

      {/* Staff Modal */}
      {staffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <form
            onSubmit={saveStaff}
            className="w-full max-w-lg rounded-[2rem] bg-[#F5F3EE] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                {staffModal.id ? 'Editar profesional' : 'Nuevo profesional'}
              </h2>
              <button type="button" onClick={() => setStaffModal(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                required
                value={stName}
                onChange={(e) => setStName(e.target.value)}
                placeholder="Nombre del barbero"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
              <input
                required
                value={stRole}
                onChange={(e) => setStRole(e.target.value)}
                placeholder="Puesto (ej. Master Barber)"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
              <input
                value={stSpecialties}
                onChange={(e) => setStSpecialties(e.target.value)}
                placeholder="Especialidades (ej. Degradados, tijera, navaja)"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
              <div className="space-y-1.5">
                <p className="font-mono-data font-bold">Servicios habilitados</p>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#111111]/15 bg-white px-3 py-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={stServiceIds.includes(s.id)}
                        onChange={(e) =>
                          setStServiceIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                          )
                        }
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={stActive}
                  onChange={(e) => setStActive(e.target.checked)}
                />
                <span>Profesional activo</span>
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#E63B2E] py-3 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Guardar profesional
            </button>
          </form>
        </div>
      )}

      {/* Staff Working Hours & Vacations Modal */}
      {hoursTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-[#F5F3EE] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">
                Horario y días libres · {hoursTarget.name}
              </h2>
              <button type="button" onClick={() => setHoursTarget(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {hoursDraft.map((row, idx) => (
                <div
                  key={row.dayOfWeek}
                  className="grid grid-cols-2 sm:grid-cols-6 items-center gap-2 rounded-xl border border-[#111111]/10 bg-white p-2.5"
                >
                  <label className="flex items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={row.isOpen}
                      onChange={(e) =>
                        setHoursDraft((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, isOpen: e.target.checked } : r))
                        )
                      }
                    />
                    <span>{DAY_NAMES[row.dayOfWeek]}</span>
                  </label>
                  <input
                    type="time"
                    disabled={!row.isOpen}
                    value={row.openTime}
                    onChange={(e) =>
                      setHoursDraft((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, openTime: e.target.value } : r))
                      )
                    }
                    className="rounded border border-[#111111]/15 px-2 py-1"
                  />
                  <input
                    type="time"
                    disabled={!row.isOpen}
                    value={row.closeTime}
                    onChange={(e) =>
                      setHoursDraft((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, closeTime: e.target.value } : r))
                      )
                    }
                    className="rounded border border-[#111111]/15 px-2 py-1"
                  />
                  <input
                    type="time"
                    disabled={!row.isOpen}
                    value={row.breakStart || ''}
                    placeholder="Pausa ini"
                    onChange={(e) =>
                      setHoursDraft((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, breakStart: e.target.value || null } : r
                        )
                      )
                    }
                    className="rounded border border-[#111111]/15 px-2 py-1"
                  />
                  <input
                    type="time"
                    disabled={!row.isOpen}
                    value={row.breakEnd || ''}
                    placeholder="Pausa fin"
                    onChange={(e) =>
                      setHoursDraft((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, breakEnd: e.target.value || null } : r
                        )
                      )
                    }
                    className="rounded border border-[#111111]/15 px-2 py-1"
                  />
                  <span className="font-mono-data text-[10px] text-[#111111]/55">
                    {row.breakStart && row.breakEnd ? 'Con pausa' : 'Continuo'}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={saveHours}
              className="w-full rounded-full bg-[#111111] py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
            >
              Guardar horario semanal
            </button>

            <form
              onSubmit={addStaffException}
              className="border-t border-[#111111]/12 pt-4 space-y-3 text-xs"
            >
              <p className="font-mono-data font-bold">Registrar día libre o vacaciones</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="date"
                  required
                  value={excDate}
                  onChange={(e) => setExcDate(e.target.value)}
                  className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
                />
                <select
                  value={excType}
                  onChange={(e) => setExcType(e.target.value as any)}
                  className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
                >
                  <option value="DAY_OFF">Día libre</option>
                  <option value="VACATION">Vacaciones</option>
                </select>
                <input
                  value={excReason}
                  onChange={(e) => setExcReason(e.target.value)}
                  placeholder="Motivo"
                  className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#E63B2E] px-3 py-2 font-display font-bold text-[#F5F3EE]"
                >
                  Añadir fecha
                </button>
              </div>
              {hoursTarget.exceptions && hoursTarget.exceptions.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="font-mono-data text-[11px] text-[#111111]/60">
                    Excepciones registradas:
                  </p>
                  <div className="space-y-1">
                    {hoursTarget.exceptions.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between rounded-xl border border-[#111111]/10 bg-white px-3 py-1.5 font-mono-data text-xs"
                      >
                        <span>
                          {ex.date} · {ex.type === 'VACATION' ? 'Vacaciones' : 'Día libre'}
                          {ex.reason ? ` (${ex.reason})` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteStaffException(ex.id)}
                          className="text-[#E63B2E] hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
