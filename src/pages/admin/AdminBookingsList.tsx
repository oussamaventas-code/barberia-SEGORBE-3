import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { formatEuro } from '../../types/domain';

interface BookingRow {
  id: number;
  bookingCode: string;
  status: string;
  dateMadrid: string;
  timeMadrid: string;
  totalDurationMinutes: number;
  totalPriceCents: number | null;
  source: string;
  customer: { fullName: string; phone: string } | null;
  staff: { name: string } | null;
  services: Array<{ serviceNameSnapshot: string }>;
}

function getMadridOffset(days: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + days * 86_400_000));
}

export default function AdminBookingsList() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const from = getMadridOffset(-60);
      const to = getMadridOffset(60);
      const res = await apiFetch<{ appointments: BookingRow[] }>(
        `/api/admin/agenda?from=${from}&to=${to}`,
        { token }
      );
      setRows(res.appointments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: number, status: string) => {
    const token = await getToken();
    await apiFetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.bookingCode.toLowerCase().includes(q) ||
        (r.customer?.fullName || '').toLowerCase().includes(q) ||
        (r.customer?.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div>
          <p className="font-mono-data text-xs text-[#E63B2E]">REGISTRO DE RESERVAS</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Reservas</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código, cliente o teléfono..."
            className="rounded-xl border border-[#111111]/15 bg-[#F5F3EE] px-4 py-2 text-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#111111]/15 bg-[#F5F3EE] px-3 py-2 font-mono-data text-xs"
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

      <div className="overflow-x-auto rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#111111]/12 font-mono-data text-xs text-[#111111]/60">
              <th className="px-5 py-3.5">Código</th>
              <th className="px-5 py-3.5">Fecha y hora</th>
              <th className="px-5 py-3.5">Cliente</th>
              <th className="px-5 py-3.5">Servicio / Profesional</th>
              <th className="px-5 py-3.5 text-right">Importe</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5 text-right">Acción rápida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111111]/10">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center font-mono-data text-xs">
                  Cargando reservas...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center font-mono-data text-xs text-[#111111]/60"
                >
                  No hay reservas que coincidan con el filtro.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/60">
                  <td className="px-5 py-3.5 font-mono-data text-xs font-bold">{r.bookingCode}</td>
                  <td className="px-5 py-3.5 font-mono-data text-xs tabular-nums">
                    {r.dateMadrid} · {r.timeMadrid}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium">{r.customer?.fullName}</p>
                    <p className="font-mono-data text-xs text-[#111111]/60">
                      {r.customer?.phone}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <p>{r.services.map((s) => s.serviceNameSnapshot).join(' + ')}</p>
                    <p className="font-mono-data text-[#111111]/60">{r.staff?.name}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono-data text-xs tabular-nums">
                    {formatEuro(r.totalPriceCents)}
                  </td>
                  <td className="px-5 py-3.5 font-mono-data text-xs font-bold">{r.status}</td>
                  <td className="px-5 py-3.5 text-right font-mono-data text-xs">
                    {r.status === 'CONFIRMED' && (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(r.id, 'COMPLETED')}
                          className="text-[#15803D] underline"
                        >
                          Completar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(r.id, 'CANCELLED')}
                          className="text-[#E63B2E] underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
