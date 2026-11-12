import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Send, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { Customer360, formatEuro } from '../../types/domain';

interface CustomerDossier {
  summary: Customer360;
  customer: any;
  consent: any;
  appointments: any[];
  timeline: Array<{
    id: string;
    kind: string;
    title: string;
    details: string;
    actor: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: number;
    noteType: string;
    content: string;
    authorName: string;
    createdAt: string;
  }>;
  payments: any[];
}

const SEGMENT_LABELS: Record<string, string> = {
  ALL: 'Todos',
  NEW: 'Nuevos',
  HABITUAL: 'Habituales',
  FREQUENT: 'Frecuentes',
  INACTIVE: 'Inactivos (sin retorno)',
  UPCOMING: 'Con cita próxima',
  RECURRING_CANCEL: 'Cancelaciones recurrentes',
};

export default function AdminCustomersCrm({ mode }: { mode: 'CUSTOMERS' | 'CRM' }) {
  const { getToken, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer360[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<string>(mode === 'CRM' ? 'INACTIVE' : 'ALL');
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const [dossier, setDossier] = useState<CustomerDossier | null>(null);
  const [noteType, setNoteType] = useState<'NOTE' | 'INCIDENT' | 'PREFERENCE'>('NOTE');
  const [noteContent, setNoteContent] = useState('');
  const [prefEdit, setPrefEdit] = useState('');
  const [cadenceEdit, setCadenceEdit] = useState('');
  const [campaignResult, setCampaignResult] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await apiFetch<{ customers: Customer360[] }>('/api/admin/customers', { token });
      setCustomers(res.customers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSegment(mode === 'CRM' ? 'INACTIVE' : 'ALL');
  }, [mode]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setQuery(q);
  }, [searchParams]);

  const openDossier = async (id: number) => {
    const token = await getToken();
    const res = await apiFetch<CustomerDossier>(`/api/admin/customers/${id}`, { token });
    setDossier(res);
    setPrefEdit(res.customer.preferences || '');
    setCadenceEdit(res.customer.visitCadenceDays ? String(res.customer.visitCadenceDays) : '');
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier || !noteContent.trim()) return;
    const token = await getToken();
    await apiFetch(`/api/admin/customers/${dossier.customer.id}/notes`, {
      method: 'POST',
      token,
      body: JSON.stringify({ noteType, content: noteContent }),
    });
    setNoteContent('');
    await openDossier(dossier.customer.id);
  };

  const handleUpdateCustomerPrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier) return;
    const token = await getToken();
    await apiFetch(`/api/admin/customers/${dossier.customer.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        fullName: dossier.customer.fullName,
        phone: dossier.customer.phone,
        email: dossier.customer.email,
        preferences: prefEdit || null,
        visitCadenceDays: cadenceEdit ? Number(cadenceEdit) : null,
      }),
    });
    await loadCustomers();
    await openDossier(dossier.customer.id);
  };

  const handleRgpdErase = async () => {
    if (!dossier) return;
    const token = await getToken();
    await apiFetch(`/api/admin/customers/${dossier.customer.id}/rgpd-erase`, {
      method: 'POST',
      token,
    });
    setDossier(null);
    await loadCustomers();
  };

  const handleRecoveryCampaign = async () => {
    const token = await getToken();
    const res = await apiFetch<{
      targetedCount: number;
      skippedWithoutConsent: number;
    }>('/api/admin/crm/recovery-campaign', { method: 'POST', token });
    setCampaignResult(
      `Campaña registrada: ${res.targetedCount} cliente(s) con consentimiento comercial · ${res.skippedWithoutConsent} omitido(s) por RGPD sin opt-in.`
    );
  };

  const filtered = customers.filter((c) => {
    if (segment !== 'ALL' && !c.segments.includes(segment as any)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.publicCode.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div>
          <p className="font-mono-data text-xs text-[#E63B2E]">
            {mode === 'CRM' ? 'CRM INTELIGENTE Y RETENCIÓN' : 'DIRECTORIO DE CLIENTES'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {mode === 'CRM' ? 'Segmentación y ficha 360°' : 'Clientes'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre, teléfono, código..."
            className="rounded-xl border border-[#111111]/15 bg-[#F5F3EE] px-4 py-2 text-xs"
          />
          {mode === 'CRM' && (
            <button
              type="button"
              onClick={handleRecoveryCampaign}
              className="cs-btn-signal inline-flex items-center gap-1.5 rounded-full bg-[#E63B2E] px-4 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Campaña recuperación inactivos</span>
            </button>
          )}
        </div>
      </div>

      {campaignResult && (
        <div className="rounded-2xl border border-[#111111]/15 bg-[#F5F3EE] px-4 py-3 text-xs font-medium">
          {campaignResult}
        </div>
      )}

      {/* Segment Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[#111111]/10 bg-[#F5F3EE] p-2">
        {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSegment(key)}
            className={`rounded-xl px-3.5 py-2 font-mono-data text-xs transition-colors ${
              segment === key
                ? 'bg-[#111111] font-bold text-[#F5F3EE]'
                : 'text-[#111111]/70 hover:bg-[#E8E4DD]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Customer Cards / Table */}
      <div className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] overflow-hidden">
        {loading ? (
          <p className="p-8 font-mono-data text-xs">Cargando fichas CRM...</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center font-mono-data text-xs text-[#111111]/60">
            No hay clientes en este segmento todavía.
          </div>
        ) : (
          <div className="divide-y divide-[#111111]/10">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openDossier(c.id)}
                className="w-full text-left px-6 py-4 hover:bg-white/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-mono-data text-xs text-[#111111]/60">
                    <span>{c.publicCode}</span>
                    <span>·</span>
                    <span>{c.phone}</span>
                    {c.email && (
                      <>
                        <span>·</span>
                        <span>{c.email}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold">{c.fullName}</h3>
                  <p className="font-mono-data text-xs text-[#111111]/65">
                    {c.segments.map((s) => SEGMENT_LABELS[s] || s).join(' · ')}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 font-mono-data text-xs tabular-nums">
                  <span className="font-bold">
                    {c.totalVisits} visitas · {formatEuro(c.totalSpentCents)}
                  </span>
                  <span className="text-[#111111]/60">
                    {c.daysSinceLastVisit !== null
                      ? `Última hace ${c.daysSinceLastVisit}d (cadencia ${c.expectedCadenceDays}d)`
                      : 'Sin visitas completadas'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 360° Customer Dossier Modal */}
      {dossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#111111]/60">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#F5F3EE] p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-[#111111]/12 pb-4">
              <div>
                <p className="font-mono-data text-xs text-[#E63B2E]">
                  FICHA 360° · {dossier.customer.publicCode}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">
                  {dossier.customer.fullName}
                </h2>
                <p className="font-mono-data text-xs text-[#111111]/70">
                  {dossier.customer.phone} {dossier.customer.email ? `· ${dossier.customer.email}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => setDossier(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-2xl border border-[#111111]/10 bg-white p-3.5">
                <p className="font-mono-data text-[#111111]/60">Visitas</p>
                <p className="mt-1 font-mono-data text-xl font-bold tabular-nums">
                  {dossier.summary?.totalVisits ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-[#111111]/10 bg-white p-3.5">
                <p className="font-mono-data text-[#111111]/60">Histórico cobrado</p>
                <p className="mt-1 font-mono-data text-xl font-bold tabular-nums">
                  {formatEuro(dossier.summary?.totalSpentCents ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#111111]/10 bg-white p-3.5">
                <p className="font-mono-data text-[#111111]/60">Marketing RGPD</p>
                <p className="mt-1 font-mono-data text-sm font-bold">
                  {dossier.summary?.marketingOptIn ? 'Autorizado' : 'No autorizado'}
                </p>
              </div>
            </div>

            {/* Preferences & Cadence */}
            <form
              onSubmit={handleUpdateCustomerPrefs}
              className="rounded-2xl border border-[#111111]/12 bg-white p-4 space-y-3 text-xs"
            >
              <h3 className="font-display text-sm font-bold">Preferencias y periodicidad</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  value={prefEdit}
                  onChange={(e) => setPrefEdit(e.target.value)}
                  placeholder="Estilo preferido, degradado, bebidas..."
                  className="sm:col-span-2 rounded-xl border border-[#111111]/15 px-3 py-2"
                />
                <input
                  type="number"
                  value={cadenceEdit}
                  onChange={(e) => setCadenceEdit(e.target.value)}
                  placeholder="Cadencia días (ej. 21)"
                  className="rounded-xl border border-[#111111]/15 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-[#111111] px-4 py-2 font-display text-xs font-bold text-[#F5F3EE]"
              >
                Guardar ficha
              </button>
            </form>

            {/* Private Internal Notes (never visible to customer) */}
            <div className="rounded-2xl border border-[#111111]/15 bg-[#E8E4DD]/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 font-display text-sm font-bold">
                  <Lock className="h-3.5 w-3.5 text-[#E63B2E]" />
                  <span>Notas internas privadas (invisibles para el cliente)</span>
                </h3>
              </div>

              <form onSubmit={handleAddNote} className="flex flex-col sm:flex-row gap-2 text-xs">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as any)}
                  className="rounded-xl border border-[#111111]/15 bg-white px-3 py-2"
                >
                  <option value="NOTE">Nota</option>
                  <option value="PREFERENCE">Preferencia</option>
                  <option value="INCIDENT">Incidencia</option>
                </select>
                <input
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Añadir nota interna o incidencia..."
                  className="flex-1 rounded-xl border border-[#111111]/15 bg-white px-3 py-2"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#E63B2E] px-4 py-2 font-display font-bold text-[#F5F3EE]"
                >
                  Añadir
                </button>
              </form>

              <div className="space-y-2">
                {dossier.notes.map((n) => (
                  <div key={n.id} className="rounded-xl bg-white p-3 text-xs">
                    <div className="flex justify-between font-mono-data text-[11px] text-[#111111]/60">
                      <span className="font-bold text-[#E63B2E]">{n.noteType}</span>
                      <span>
                        {n.authorName} · {n.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <h3 className="font-display text-sm font-bold">Línea temporal completa</h3>
              <div className="divide-y divide-[#111111]/10 rounded-2xl border border-[#111111]/10 bg-white px-4">
                {dossier.timeline.length === 0 ? (
                  <p className="py-4 font-mono-data text-xs text-[#111111]/60">
                    Sin eventos registrados todavía.
                  </p>
                ) : (
                  dossier.timeline.map((ev) => (
                    <div key={ev.id} className="py-3 text-xs">
                      <div className="flex justify-between font-mono-data text-[11px] text-[#111111]/60">
                        <span className="font-bold text-[#111111]">{ev.title}</span>
                        <span>{ev.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="mt-0.5 text-[#111111]/80">{ev.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RGPD Erasure (ADMIN only) */}
            {profile?.role === 'ADMIN' && (
              <div className="border-t border-[#111111]/15 pt-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono-data text-xs text-[#111111]/60">
                  <ShieldAlert className="h-4 w-4 text-[#E63B2E]" />
                  Derecho de supresión RGPD
                </span>
                <button
                  type="button"
                  onClick={handleRgpdErase}
                  className="rounded-full border border-[#E63B2E] px-4 py-2 font-mono-data text-xs font-bold text-[#E63B2E] hover:bg-[#E63B2E] hover:text-white"
                >
                  Anonimizar datos personales
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
