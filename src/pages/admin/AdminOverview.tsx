import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { formatEuro } from '../../types/domain';

interface OverviewData {
  setupStatus: {
    isSetupComplete: boolean;
    hasActiveStaff: boolean;
    hasConfiguredServices: boolean;
    hasWorkingHours: boolean;
  };
  kpis: {
    todayAppointments: number;
    pendingUpcoming: number;
    newCustomers: number;
    habitualCustomers: number;
    cancellationsInRange: number;
    occupancyRate: number | null;
    recordedRevenueCents: number;
    inactiveAlertCount: number;
    unreadNotifications: number;
  };
  charts: {
    evolution: Array<{ date: string; total: number; completed: number; cancelled: number }>;
    serviceDistribution: Array<{ name: string; count: number }>;
    staffPerformance: Array<{
      staffId: number;
      name: string;
      totalAppointments: number;
      completedAppointments: number;
    }>;
  };
}

function getMadridDateOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export default function AdminOverview() {
  const { getToken } = useAuth();
  const [fromDate, setFromDate] = useState(() => getMadridDateOffset(-29));
  const [toDate, setToDate] = useState(() => getMadridDateOffset(0));
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<OverviewData>(
        `/api/admin/overview?from=${fromDate}&to=${toDate}`,
        { token }
      );
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  const setupIncomplete =
    data &&
    (!data.setupStatus.isSetupComplete ||
      !data.setupStatus.hasActiveStaff ||
      !data.setupStatus.hasConfiguredServices ||
      !data.setupStatus.hasWorkingHours);

  const maxEvolution = Math.max(1, ...(data?.charts.evolution.map((e) => e.total) ?? [1]));
  const maxServiceCount = Math.max(
    1,
    ...(data?.charts.serviceDistribution.map((s) => s.count) ?? [1])
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div>
          <p className="font-mono-data text-xs text-[#E63B2E]">VISIÓN GENERAL</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Estado de la barbería
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-[#111111]/15 bg-[#F5F3EE] px-3 py-2"
          />
          <span>a</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-[#111111]/15 bg-[#F5F3EE] px-3 py-2"
          />
        </div>
      </div>

      {/* Setup Wizard Alert if initial business config is pending */}
      {setupIncomplete && data && (
        <div className="rounded-[2rem] border border-[#111111] bg-[#111111] p-6 sm:p-8 text-[#F5F3EE] flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#E63B2E] font-mono-data text-xs">
              <AlertTriangle className="h-4 w-4" />
              <span>CONFIGURACIÓN INICIAL PENDIENTE</span>
            </div>
            <h2 className="font-display text-xl font-bold">
              Activa tu barbería sin datos ficticios
            </h2>
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono-data text-xs text-[#E8E4DD]/80">
              <span>
                {data.setupStatus.hasWorkingHours ? '✓' : '○'} Horarios de apertura
              </span>
              <span>
                {data.setupStatus.hasConfiguredServices ? '✓' : '○'} Tarifas y duraciones
              </span>
              <span>
                {data.setupStatus.hasActiveStaff ? '✓' : '○'} Profesionales activos
              </span>
            </div>
          </div>

          <Link
            to="/admin/configuracion"
            className="cs-btn-signal inline-flex items-center gap-2 rounded-full bg-[#E63B2E] px-6 py-3 font-display text-xs font-bold text-[#F5F3EE] whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <span>Completar configuración</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[#111111]/10 bg-[#F5F3EE]"
            />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Grid — Real Data Only */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Citas de hoy</p>
              <p className="mt-2 font-mono-data text-3xl font-bold tabular-nums">
                {data.kpis.todayAppointments}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Citas pendientes</p>
              <p className="mt-2 font-mono-data text-3xl font-bold tabular-nums">
                {data.kpis.pendingUpcoming}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Ocupación hoy</p>
              <p className="mt-2 font-mono-data text-3xl font-bold tabular-nums">
                {data.kpis.occupancyRate !== null ? `${data.kpis.occupancyRate}%` : 'Sin horario'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">
                Ingresos registrados (cobros reales)
              </p>
              <p className="mt-2 font-mono-data text-3xl font-bold tabular-nums">
                {formatEuro(data.kpis.recordedRevenueCents)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Clientes nuevos</p>
              <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
                {data.kpis.newCustomers}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Clientes habituales</p>
              <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
                {data.kpis.habitualCustomers}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Cancelaciones (rango)</p>
              <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums text-[#E63B2E]">
                {data.kpis.cancellationsInRange}
              </p>
            </div>
            <div className="rounded-2xl border border-[#111111]/12 bg-[#F5F3EE] p-5">
              <p className="font-mono-data text-xs text-[#111111]/60">Clientes sin retorno</p>
              <p className="mt-2 font-mono-data text-2xl font-bold tabular-nums">
                {data.kpis.inactiveAlertCount}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Booking Evolution Chart */}
            <div className="lg:col-span-7 rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6">
              <h2 className="font-display text-lg font-bold">Evolución de reservas</h2>
              <p className="font-mono-data text-xs text-[#111111]/60">
                Datos reales del periodo {fromDate} a {toDate}
              </p>
              {data.charts.evolution.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-[#111111]/20 p-8 text-center font-mono-data text-xs text-[#111111]/60">
                  Todavía no hay reservas en este rango de fechas.
                </div>
              ) : (
                <div className="mt-6 flex h-56 items-stretch gap-2 border-b border-[#111111]/15 pb-2 overflow-x-auto">
                  {data.charts.evolution.map((pt) => {
                    const heightPct = Math.max(8, Math.round((pt.total / maxEvolution) * 100));
                    return (
                      <div
                        key={pt.date}
                        className="flex h-full min-w-[36px] flex-1 flex-col items-center gap-1"
                        title={`${pt.date}: ${pt.total} citas (${pt.completed} completadas, ${pt.cancelled} canceladas)`}
                      >
                        <span className="font-mono-data text-[10px] tabular-nums">{pt.total}</span>
                        <div className="flex w-full flex-1 items-end justify-center">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="flex w-full max-w-[28px] flex-col overflow-hidden rounded-t-md bg-[#111111] transition-all"
                          >
                            {pt.cancelled > 0 && (
                              <div
                                style={{ height: `${Math.round((pt.cancelled / Math.max(1, pt.total)) * 100)}%` }}
                                className="w-full bg-[#E63B2E]"
                              />
                            )}
                          </div>
                        </div>
                        <span className="font-mono-data text-[10px] text-[#111111]/60">
                          {pt.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Service Distribution & Staff Performance */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6">
                <h2 className="font-display text-lg font-bold">Distribución de servicios</h2>
                {data.charts.serviceDistribution.length === 0 ? (
                  <p className="mt-4 font-mono-data text-xs text-[#111111]/60">
                    Sin servicios reservados en este periodo.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {data.charts.serviceDistribution.map((s) => (
                      <div key={s.name} className="space-y-1">
                        <div className="flex justify-between font-mono-data text-xs">
                          <span>{s.name}</span>
                          <span className="font-bold tabular-nums">{s.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E4DD]">
                          <div
                            style={{ width: `${Math.round((s.count / maxServiceCount) * 100)}%` }}
                            className="h-full bg-[#E63B2E]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6">
                <h2 className="font-display text-lg font-bold">Rendimiento por profesional</h2>
                {data.charts.staffPerformance.length === 0 ? (
                  <p className="mt-4 font-mono-data text-xs text-[#111111]/60">
                    No hay profesionales activos configurados.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[#111111]/10">
                    {data.charts.staffPerformance.map((st) => (
                      <div
                        key={st.staffId}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <span className="font-medium">{st.name}</span>
                        <span className="font-mono-data text-xs tabular-nums">
                          {st.completedAppointments} completadas / {st.totalAppointments} activas
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/agenda"
              className="rounded-full bg-[#111111] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
            >
              Abrir agenda del día
            </Link>
            <Link
              to="/admin/clientes"
              className="rounded-full border border-[#111111]/20 bg-[#F5F3EE] px-5 py-2.5 font-display text-xs font-bold"
            >
              Explorar CRM de clientes
            </Link>
            {!setupIncomplete && (
              <span className="inline-flex items-center gap-1.5 font-mono-data text-xs text-[#15803D] px-2">
                <CheckCircle2 className="h-4 w-4" />
                Sistema operativo configurado
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
