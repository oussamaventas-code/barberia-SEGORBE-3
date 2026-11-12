import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AdminSettings() {
  const { getToken, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<any>({});
  const [hours, setHours] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);

  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', role: 'STAFF' });
  const [userMsg, setUserMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [holidayDate, setHolidayDate] = useState('');
  const [holidayReason, setHolidayReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<any>('/api/admin/settings', { token });
      setSettings(res.settings || {});
      const map = new Map((res.workingHours || []).map((w: any) => [w.dayOfWeek, w]));
      setHours(
        [1, 2, 3, 4, 5, 6, 0].map(
          (dow) =>
            map.get(dow) ?? {
              dayOfWeek: dow,
              isOpen: false,
              openTime: '09:30',
              closeTime: '20:00',
              breakStart: null,
              breakEnd: null,
            }
        )
      );
      setHolidays(res.holidays || []);
      setUserProfiles(res.userProfiles || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          ...settings,
          workingHours: hours,
          isSetupComplete: true,
        }),
      });
      setSavedMsg('Configuración guardada correctamente.');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate) return;
    const token = await getToken();
    await apiFetch('/api/admin/availability-exceptions', {
      method: 'POST',
      token,
      body: JSON.stringify({
        staffId: null,
        date: holidayDate,
        type: 'HOLIDAY',
        reason: holidayReason || 'Festivo',
      }),
    });
    setHolidayDate('');
    setHolidayReason('');
    await load();
  };

  const handleDeleteHoliday = async (id: number) => {
    const token = await getToken();
    await apiFetch(`/api/admin/availability-exceptions/${id}`, { method: 'DELETE', token });
    await load();
  };

  const handleRoleChange = async (id: number, role: string) => {
    setUserMsg(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/profiles/${id}/role`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (err: any) {
      setUserMsg({ ok: false, text: err.message });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);
    try {
      const token = await getToken();
      await apiFetch('/api/admin/profiles', { method: 'POST', token, body: JSON.stringify(newUser) });
      setUserMsg({ ok: true, text: `Usuario ${newUser.email} creado. Ya puede entrar en /admin.` });
      setNewUser({ fullName: '', email: '', password: '', role: 'STAFF' });
      await load();
    } catch (err: any) {
      setUserMsg({ ok: false, text: err.message });
    }
  };

  const handleResetPassword = async (id: number, email: string) => {
    const password = window.prompt(`Nueva contraseña para ${email} (mínimo 8 caracteres):`);
    if (!password) return;
    setUserMsg(null);
    try {
      const token = await getToken();
      await apiFetch(`/api/admin/profiles/${id}/password`, {
        method: 'POST',
        token,
        body: JSON.stringify({ password }),
      });
      setUserMsg({ ok: true, text: `Contraseña de ${email} actualizada.` });
    } catch (err: any) {
      setUserMsg({ ok: false, text: err.message });
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-[2rem] bg-[#F5F3EE]" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono-data text-xs text-[#E63B2E]">CONFIGURACIÓN DEL NEGOCIO</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Asistente inicial y reglas operativas
        </h1>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#15803D] bg-[#15803D]/10 px-4 py-3 text-xs font-medium text-[#15803D]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[#E63B2E] bg-[#E63B2E]/10 px-4 py-3 text-xs text-[#E63B2E]">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Commercial Info */}
        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Datos comerciales y de contacto</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Nombre comercial</span>
              <input
                value={settings.businessName || ''}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Ciudad</span>
              <input
                value={settings.city || ''}
                onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Dirección exacta</span>
              <input
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Pendiente de configurar"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Teléfono</span>
              <input
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="Pendiente de configurar"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Correo electrónico</span>
              <input
                value={settings.email || ''}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="Pendiente de configurar"
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3.5 py-2.5"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Razón social / NIF (Legal)</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={settings.legalEntityName || ''}
                  onChange={(e) => setSettings({ ...settings, legalEntityName: e.target.value })}
                  placeholder="Razón social"
                  className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
                <input
                  value={settings.legalTaxId || ''}
                  onChange={(e) => setSettings({ ...settings, legalTaxId: e.target.value })}
                  placeholder="NIF / CIF"
                  className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2.5"
                />
              </div>
            </label>
          </div>
        </section>

        {/* Booking Policies */}
        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Políticas de reserva y CRM</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-xs">
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Antelación mínima (min)</span>
              <input
                type="number"
                value={settings.minLeadMinutes ?? 60}
                onChange={(e) =>
                  setSettings({ ...settings, minLeadMinutes: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Antelación máxima (días)</span>
              <input
                type="number"
                value={settings.maxAdvanceDays ?? 30}
                onChange={(e) =>
                  setSettings({ ...settings, maxAdvanceDays: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Límite cancelar (horas)</span>
              <input
                type="number"
                value={settings.cancelCutoffHours ?? 24}
                onChange={(e) =>
                  setSettings({ ...settings, cancelCutoffHours: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Límite modificar (horas)</span>
              <input
                type="number"
                value={settings.rescheduleCutoffHours ?? 12}
                onChange={(e) =>
                  setSettings({ ...settings, rescheduleCutoffHours: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Margen entre citas (min)</span>
              <input
                type="number"
                value={settings.bufferMinutes ?? 0}
                onChange={(e) =>
                  setSettings({ ...settings, bufferMinutes: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-mono-data font-bold">Cadencia retorno CRM (días)</span>
              <input
                type="number"
                value={settings.defaultReturnCadenceDays ?? 28}
                onChange={(e) =>
                  setSettings({ ...settings, defaultReturnCadenceDays: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
              />
            </label>
          </div>
        </section>

        {/* Weekly Opening Hours */}
        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Horario general semanal</h2>
          <div className="space-y-2 text-xs">
            {hours.map((row, idx) => (
              <div
                key={row.dayOfWeek}
                className="grid grid-cols-2 sm:grid-cols-5 items-center gap-2 rounded-xl border border-[#111111]/10 bg-white p-2.5"
              >
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={row.isOpen}
                    onChange={(e) =>
                      setHours((prev) =>
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
                    setHours((prev) =>
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
                    setHours((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, closeTime: e.target.value } : r))
                    )
                  }
                  className="rounded border border-[#111111]/15 px-2 py-1"
                />
                <input
                  type="time"
                  disabled={!row.isOpen}
                  value={row.breakStart || ''}
                  onChange={(e) =>
                    setHours((prev) =>
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
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, breakEnd: e.target.value || null } : r
                      )
                    )
                  }
                  className="rounded border border-[#111111]/15 px-2 py-1"
                />
              </div>
            ))}
          </div>
        </section>

        {profile?.role === 'ADMIN' && (
          <button
            type="submit"
            className="cs-btn-signal rounded-full bg-[#E63B2E] px-8 py-3.5 font-display text-sm font-bold text-[#F5F3EE]"
          >
            Guardar toda la configuración
          </button>
        )}
      </form>

      {/* Holidays */}
      <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
        <h2 className="font-display text-lg font-bold">Días festivos y cierres</h2>
        <form onSubmit={handleAddHoliday} className="flex flex-wrap gap-2 text-xs">
          <input
            type="date"
            required
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
          />
          <input
            value={holidayReason}
            onChange={(e) => setHolidayReason(e.target.value)}
            placeholder="Motivo (ej. Bando de la Huerta)"
            className="flex-1 rounded-xl border border-[#111111]/20 bg-white px-3 py-2"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-xl bg-[#111111] px-4 py-2 font-display font-bold text-[#F5F3EE]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Añadir festivo</span>
          </button>
        </form>
        <div className="divide-y divide-[#111111]/10 text-xs">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-2.5">
              <span>
                <strong className="font-mono-data">{h.date}</strong> · {h.reason || 'Festivo'}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteHoliday(h.id)}
                className="text-[#E63B2E]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Notification Channels Status */}
      <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-3">
        <h2 className="font-display text-lg font-bold">Canales externos de notificación</h2>
        <p className="text-xs text-[#111111]/70">
          Los canales externos permanecen en estado pendiente hasta configurar sus credenciales en las variables de entorno del servidor.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono-data text-xs">
          <div className="rounded-xl border border-[#111111]/10 bg-white p-3.5">
            <p className="text-[#111111]/60">Email (SMTP)</p>
            <p className="mt-1 font-bold">
              {settings.emailProvider === 'PENDING' ? 'Pendiente configurar' : settings.emailProvider}
            </p>
          </div>
          <div className="rounded-xl border border-[#111111]/10 bg-white p-3.5">
            <p className="text-[#111111]/60">SMS</p>
            <p className="mt-1 font-bold">
              {settings.smsProvider === 'PENDING' ? 'Pendiente configurar' : settings.smsProvider}
            </p>
          </div>
          <div className="rounded-xl border border-[#111111]/10 bg-white p-3.5">
            <p className="text-[#111111]/60">WhatsApp Business</p>
            <p className="mt-1 font-bold">
              {settings.whatsappProvider === 'PENDING'
                ? 'Pendiente configurar'
                : settings.whatsappProvider}
            </p>
          </div>
        </div>
      </section>

      {/* Users & permissions */}
      {profile?.role === 'ADMIN' && (
        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold">Usuarios del panel</h2>
            <p className="text-xs text-[#111111]/65">
              Dirección: acceso total. Equipo: agenda, reservas y clientes (sin cambiar configuración ni catálogo).
            </p>
          </div>

          {userMsg && (
            <div
              className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
                userMsg.ok ? 'border-[#15803D] bg-[#15803D]/10 text-[#15803D]' : 'border-[#E63B2E] bg-[#E63B2E]/10 text-[#E63B2E]'
              }`}
            >
              {userMsg.text}
            </div>
          )}

          <div className="divide-y divide-[#111111]/10 text-xs">
            {userProfiles.map((u) => (
              <div key={u.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">
                    {u.fullName || u.email}
                    {u.id === profile.id && <span className="ml-2 font-mono-data text-[10px] text-[#E63B2E]">(tú)</span>}
                  </p>
                  <p className="font-mono-data text-[#111111]/60">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(u.id, u.email)}
                    className="rounded-lg border border-[#111111]/20 px-3 py-1.5 font-mono-data hover:bg-white"
                  >
                    Cambiar contraseña
                  </button>
                  <select
                    value={u.role}
                    disabled={u.id === profile.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="rounded-lg border border-[#111111]/20 bg-white px-3 py-1.5 font-mono-data disabled:opacity-60"
                    aria-label={`Rol de ${u.email}`}
                  >
                    <option value="ADMIN">Dirección</option>
                    <option value="STAFF">Equipo</option>
                    <option value="CUSTOMER">Sin acceso</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-2 border-t border-[#111111]/10 pt-4 sm:grid-cols-5">
            <input
              required
              placeholder="Nombre"
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2 text-xs"
            />
            <input
              required
              type="email"
              placeholder="email@ejemplo.com"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2 text-xs"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Contraseña (mín. 8)"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2 text-xs"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="rounded-xl border border-[#111111]/20 bg-white px-3 py-2 text-xs"
            >
              <option value="STAFF">Equipo</option>
              <option value="ADMIN">Dirección</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111111] px-4 py-2 font-display text-xs font-bold text-[#F5F3EE]"
            >
              <Plus className="h-3.5 w-3.5" /> Crear usuario
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
