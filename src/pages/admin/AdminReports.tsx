import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { formatEuro } from '../../types/domain';

interface ReportsData {
  range: { from: string; to: string };
  summary: {
    totalAppointments: number;
    completed: number;
    confirmed: number;
    cancelled: number;
    noShow: number;
    totalPaidCents: number;
    paymentCount: number;
  };
  payments: any[];
  auditLogs: any[];
}

export default function AdminReports() {
  const { getToken } = useAuth();
  const [data, setData] = useState<ReportsData | null>(null);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const [rep, notifs] = await Promise.all([
          apiFetch<ReportsData>('/api/admin/reports', { token }),
          apiFetch<{ waitlist: any[] }>('/api/admin/notifications', { token }),
        ]);
        setData(rep);
        setWaitlist(notifs.waitlist);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !data) {
    return <div className="h-48 animate-pulse rounded-[2rem] bg-[#F5F3EE]" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono-data text-xs text-[#E63B2E]">INFORMES Y AUDITORÍA</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Actividad real, cobros y registros
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
          <p className="font-mono-data text-xs text-[#111111]/60">Total cobrado (30d)</p>
          <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
            {formatEuro(data.summary.totalPaidCents)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
          <p className="font-mono-data text-xs text-[#111111]/60">Citas completadas</p>
          <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
            {data.summary.completed}
          </p>
        </div>
        <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
          <p className="font-mono-data text-xs text-[#111111]/60">Canceladas</p>
          <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums text-[#E63B2E]">
            {data.summary.cancelled}
          </p>
        </div>
        <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
          <p className="font-mono-data text-xs text-[#111111]/60">No presentados</p>
          <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
            {data.summary.noShow}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Lista de espera</h2>
          {waitlist.length === 0 ? (
            <p className="font-mono-data text-xs text-[#111111]/60">
              No hay solicitudes activas en lista de espera.
            </p>
          ) : (
            <div className="divide-y divide-[#111111]/10 text-xs">
              {waitlist.map((w) => (
                <div key={w.id} className="py-3 flex justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {w.customerName} ({w.customerPhone})
                    </p>
                    <p className="font-mono-data text-[#111111]/65">
                      {w.preferredDate} · {w.serviceName}
                    </p>
                  </div>
                  <span className="font-mono-data font-bold text-[#E63B2E]">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 space-y-4">
          <h2 className="font-display text-lg font-bold">Auditoría de seguridad</h2>
          {data.auditLogs.length === 0 ? (
            <p className="font-mono-data text-xs text-[#111111]/60">
              Sin acciones registradas todavía.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#111111]/10 text-xs">
              {data.auditLogs.map((log) => (
                <div key={log.id} className="py-2.5">
                  <div className="flex justify-between font-mono-data text-[11px] text-[#111111]/60">
                    <span className="font-bold text-[#111111]">{log.action}</span>
                    <span>{String(log.createdAt).slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <p className="mt-0.5 text-[#111111]/75">
                    {log.actorEmail || log.actorRole} · {log.details || log.entityType}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
