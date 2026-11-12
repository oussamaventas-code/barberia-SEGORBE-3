import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
  UserSquare2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { LogoMark } from '../../components/Logo';
import { ResetDemoButton } from '../../components/DemoStatus';

interface AdminNotif {
  id: number;
  eventType: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  provider: string;
  errorMessage: string | null;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  NEW_BOOKING: 'Nueva reserva',
  MODIFIED: 'Cita modificada',
  CANCELLED: 'Cancelación',
  REMINDER: 'Recordatorio',
  NEW_CUSTOMER: 'Nuevo cliente',
  SLOT_FREED: 'Hueco liberado',
  DELIVERY_ERROR: 'Error de envío',
  RECOVERY_CAMPAIGN: 'Campaña',
};
const CHANNEL_LABELS: Record<string, string> = {
  INTERNAL: 'Interna',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};
const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Sin leer',
  READ: 'Leída',
  PENDING_PROVIDER: 'Envío pendiente',
  SENT: 'Enviada',
  FAILED: 'Fallida',
};

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/servicios', label: 'Servicios', icon: Scissors },
  { to: '/admin/equipo', label: 'Equipo', icon: UserSquare2 },
  { to: '/admin/crm', label: 'CRM', icon: Sparkles },
  { to: '/admin/informes', label: 'Informes', icon: BarChart3 },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, adminOnly: true },
];

export default function AdminLayout() {
  const { profile, loading, authError, signIn, logout, getToken } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    await signIn(loginEmail.trim(), loginPassword);
    setSigningIn(false);
  };

  const fillDemo = (email: string, password: string) => {
    setLoginEmail(email);
    setLoginPassword(password);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const madridTodayLabel = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const loadNotifications = async () => {
    const token = await getToken();
    if (!token) return;
    apiFetch<{ notifications: AdminNotif[] }>('/api/admin/notifications', { token })
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
  };

  useEffect(() => {
    if (profile && (profile.role === 'ADMIN' || profile.role === 'STAFF')) {
      loadNotifications();
    }
  }, [profile]);

  const markRead = async (id: number) => {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/admin/notifications/${id}/read`, { method: 'POST', token });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'READ' } : n)));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/admin/clientes?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] text-[#F5F3EE] flex items-center justify-center font-mono-data text-sm">
        Verificando credenciales de Segorbe OS...
      </div>
    );
  }

  // Unauthenticated gate — never render CRM/admin data
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#111111] text-[#F5F3EE] flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-[2rem] border border-[#F5F3EE]/15 bg-[#191919] p-8 sm:p-10 space-y-6">
          <div>
            <LogoMark className="mb-4 h-16 w-16" background="#191919" />
            <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">ACCESO PRIVADO</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">BARBERÍA SEGORBE</h1>
            <p className="mt-2 text-sm text-[#E8E4DD]/70">
              Panel privado de dirección, agenda en tiempo real y CRM de la barbería.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <label className="block">
              <span className="font-mono-data text-[11px] uppercase tracking-wider text-[#E8E4DD]/60">Email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#F5F3EE]/15 bg-[#111111] px-4 py-3 text-sm text-[#F5F3EE] focus:border-[#E63B2E] focus:outline-none"
                placeholder="tu@email.com"
              />
            </label>
            <label className="block">
              <span className="font-mono-data text-[11px] uppercase tracking-wider text-[#E8E4DD]/60">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#F5F3EE]/15 bg-[#111111] px-4 py-3 text-sm text-[#F5F3EE] focus:border-[#E63B2E] focus:outline-none"
                placeholder="••••••••"
              />
            </label>

            {authError && (
              <div role="alert" className="rounded-xl border border-[#E63B2E] bg-[#E63B2E]/15 p-3 text-xs text-[#F5F3EE]">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="cs-btn-signal w-full rounded-full bg-[#E63B2E] px-6 py-4 font-display text-sm font-bold text-[#F5F3EE] disabled:opacity-60"
            >
              {signingIn ? 'Entrando…' : 'Entrar al panel'}
            </button>
          </form>

          <div className="rounded-2xl border border-dashed border-[#F5F3EE]/20 p-4 space-y-2">
            <p className="font-mono-data text-[11px] uppercase tracking-wider text-[#E8E4DD]/60">
              Modo demostración · cuentas de prueba
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin@barberiasegorbe.demo', 'segorbe2026')}
                className="rounded-xl border border-[#F5F3EE]/15 px-3 py-2 text-left text-xs hover:bg-[#F5F3EE]/10"
              >
                <span className="block font-display font-bold">Dueño</span>
                <span className="font-mono-data text-[10px] text-[#E8E4DD]/60">Acceso total</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('barbero@barberiasegorbe.demo', 'barbero2026')}
                className="rounded-xl border border-[#F5F3EE]/15 px-3 py-2 text-left text-xs hover:bg-[#F5F3EE]/10"
              >
                <span className="block font-display font-bold">Barbero</span>
                <span className="font-mono-data text-[10px] text-[#E8E4DD]/60">Agenda y clientes</span>
              </button>
            </div>
          </div>

          <div className="border-t border-[#F5F3EE]/10 pt-4 text-center">
            <Link to="/" className="font-mono-data text-xs text-[#E8E4DD]/60 hover:text-[#F5F3EE]">
              Volver a la web pública
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Unauthorized role gate
  if (profile.role !== 'ADMIN' && profile.role !== 'STAFF') {
    return (
      <div className="min-h-screen bg-[#E8E4DD] text-[#111111] flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[2rem] border border-[#111111]/15 bg-[#F5F3EE] p-8 space-y-5">
          <ShieldAlert className="h-8 w-8 text-[#E63B2E]" />
          <h1 className="font-display text-2xl font-bold">Acceso restringido</h1>
          <p className="text-sm text-[#111111]/75">
            La cuenta <strong>{profile.email}</strong> tiene rol de cliente ({profile.role}) y no dispone de permisos para el panel operativo.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/mis-citas"
              className="rounded-full bg-[#111111] px-5 py-2.5 font-display text-xs font-bold text-[#F5F3EE]"
            >
              Ir a mis citas
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-[#111111]/20 px-5 py-2.5 font-display text-xs font-bold"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => n.status === 'QUEUED').length;
  const navItems = NAV_ITEMS.filter((item) => !('adminOnly' in item && item.adminOnly) || profile.role === 'ADMIN');

  return (
    <div className="min-h-screen bg-[#E8E4DD] text-[#111111] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#111111] text-[#F5F3EE] p-5 border-r border-[#111111]">
        <div>
          <div className="border-b border-[#F5F3EE]/12 pb-5">
            <Link to="/admin" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight">
              <LogoMark className="h-9 w-9" background="#111111" />
              SEGORBE OS
            </Link>
            <p className="mt-1 font-mono-data text-xs text-[#E8E4DD]/50">
              Murcia · {profile.role === 'ADMIN' ? 'Dirección' : 'Equipo'}
            </p>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#E63B2E] text-[#F5F3EE]'
                        : 'text-[#E8E4DD]/75 hover:bg-[#F5F3EE]/10 hover:text-[#F5F3EE]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#F5F3EE]/12 pt-4 space-y-3">
          <Link
            to="/"
            className="block font-mono-data text-xs text-[#E8E4DD]/60 hover:text-[#F5F3EE]"
          >
            Ver web pública →
          </Link>
          <ResetDemoButton className="block font-mono-data text-xs text-[#E8E4DD]/60 hover:text-[#E63B2E]" />
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl border border-[#F5F3EE]/15 px-3 py-2 font-mono-data text-xs text-[#E8E4DD]/80 hover:bg-[#F5F3EE]/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#111111]/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col justify-between bg-[#111111] p-6 text-[#F5F3EE]">
            <div>
              <div className="flex items-center justify-between border-b border-[#F5F3EE]/12 pb-4">
                <span className="font-display text-lg font-bold">SEGORBE OS</span>
                <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                          isActive ? 'bg-[#E63B2E] text-[#F5F3EE]' : 'text-[#E8E4DD]/80'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <ResetDemoButton className="mb-4 block text-left font-mono-data text-xs text-[#E8E4DD]/60" />
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 font-mono-data text-xs text-[#E8E4DD]/70"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#111111]/12 bg-[#F5F3EE]/95 px-4 sm:px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-[#111111]/15 p-2"
              aria-label="Abrir menú"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="font-display text-sm font-bold tracking-tight lg:hidden">
                SEGORBE OS
              </p>
              <p className="font-mono-data text-xs capitalize text-[#111111]/65">
                {madridTodayLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#111111]/50" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente o teléfono..."
                  className="w-60 rounded-full border border-[#111111]/15 bg-white pl-9 pr-4 py-1.5 text-xs focus:border-[#111111] focus:outline-none"
                />
              </div>
            </form>

            <button
              type="button"
              onClick={() => {
                loadNotifications();
                setNotifOpen((v) => !v);
              }}
              aria-label={`Notificaciones (${unreadCount} sin leer)`}
              className={`relative flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono-data text-xs ${
                unreadCount > 0 ? 'border-[#E63B2E] bg-[#E63B2E] text-[#F5F3EE]' : 'border-[#111111]/15 bg-white'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="tabular-nums">{unreadCount}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 border-l border-[#111111]/15 pl-3">
              <div className="text-right">
                <p className="font-display text-xs font-bold leading-none">
                  {profile.fullName || 'Administrador'}
                </p>
                <p className="font-mono-data text-[11px] text-[#111111]/55">{profile.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Notifications Drawer */}
        {notifOpen && (
          <div className="fixed right-4 top-16 z-40 w-[calc(100%-2rem)] max-w-md rounded-[2rem] border border-[#111111]/15 bg-[#F5F3EE] p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#111111]/10 pb-3">
              <h2 className="font-display text-base font-bold">Centro de notificaciones</h2>
              <button type="button" onClick={() => setNotifOpen(false)} aria-label="Cerrar notificaciones">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <p className="py-6 text-center font-mono-data text-xs text-[#111111]/60">
                  Sin notificaciones registradas todavía.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3 text-xs ${
                      n.status === 'QUEUED'
                        ? 'border-[#E63B2E]/40 bg-white'
                        : 'border-[#111111]/10 bg-[#E8E4DD]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono-data text-[11px]">
                      <span className="font-bold text-[#E63B2E]">
                        {EVENT_LABELS[n.eventType] ?? n.eventType} · {CHANNEL_LABELS[n.channel] ?? n.channel}
                      </span>
                      <span className="text-[#111111]/60">{STATUS_LABELS[n.status] ?? n.status}</span>
                    </div>
                    <p className="mt-1 font-display font-bold">{n.subject}</p>
                    <p className="mt-0.5 text-[#111111]/75">{n.body}</p>
                    <p className="mt-1 font-mono-data text-[10px] text-[#111111]/45">
                      {new Date(n.createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                    {n.errorMessage && (
                      <p className="mt-1 font-mono-data text-[11px] text-[#B45309]">
                        {n.errorMessage}
                      </p>
                    )}
                    {n.status === 'QUEUED' && (
                      <button
                        type="button"
                        onClick={() => markRead(n.id)}
                        className="mt-2 font-mono-data text-[11px] underline"
                      >
                        Marcar como leída
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
