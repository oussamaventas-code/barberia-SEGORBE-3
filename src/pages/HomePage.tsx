import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Clock, Instagram, MapPin, Navigation, Phone, Scissors, Star } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { BRAND } from '../lib/brand';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CalendarCursorShowcase } from '../components/LandingShowcases';
import { apiFetch } from '../lib/api';
import { formatEuro, type PublicBusinessInfo, type ServiceItem, type StaffMember } from '../types/domain';

gsap.registerPlugin(ScrollTrigger);

interface OpeningHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

interface BootstrapPayload {
  systemOperational: boolean;
  business: PublicBusinessInfo | null;
  services: ServiceItem[];
  staff: StaffMember[];
  openingHours?: OpeningHour[];
  realMetrics?: { completedAppointments: number };
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<BootstrapPayload>('/api/public/bootstrap')
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !rootRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.hero-stagger', {
        y: 28,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Reveal sections on scroll once content is loaded
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !rootRef.current || !data) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, [data]);

  const business = data?.business ?? null;
  const services = data?.services ?? [];
  const team = data?.staff ?? [];
  const hours = data?.openingHours ?? [];
  const todayDow = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', weekday: 'short' }).format(new Date())
  ];
  const fromPrice = services.length
    ? Math.min(...services.map((s) => s.priceCents ?? Infinity))
    : null;

  return (
    <div ref={rootRef} className="min-h-screen w-full bg-[#E8E4DD] text-[#111111]">
      <Navbar variant="hero" />

      {/* HERO */}
      <section className="relative flex min-h-[100dvh] w-full items-end overflow-hidden bg-[#111111] text-[#F5F3EE]">
        <img
          src="/images/hero_barber_cinematic.jpg"
          alt="Barbero profesional trabajando en Barbería Segorbe, Murcia"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/65 to-[#111111]/30" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#111111]/85 via-[#111111]/40 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-6 pb-8 pt-24 sm:pb-14">
          <div className="max-w-3xl space-y-4 sm:space-y-6">
            <LogoMark className="hero-stagger h-20 w-20 sm:h-24 sm:w-24 text-[#F5F3EE]" background="#111111" />
            <p className="hero-stagger font-mono-data text-xs sm:text-sm tracking-[0.2em] text-[#E8E4DD]/85">
              {(business?.city || 'Murcia').toUpperCase()} · BARBERÍA CONTEMPORÁNEA
            </p>

            <h1 className="hero-stagger leading-[0.92] tracking-tight">
              <span className="block font-display text-5xl font-bold sm:text-7xl lg:text-8xl">DEFINE EL</span>
              <span className="block font-editorial text-6xl text-[#F5F3EE] sm:text-8xl lg:text-[7.5rem]">
                ESTILO<span className="text-[#E63B2E]">.</span>
              </span>
            </h1>

            <p className="hero-stagger font-display text-base sm:text-2xl text-[#E8E4DD]/90 max-w-xl">
              Cortes con precisión, barbas con oficio. Reserva tu hueco en menos de un minuto.
            </p>

            <div className="hero-stagger flex flex-col items-start gap-3 sm:gap-4 pt-1 sm:pt-2 sm:flex-row sm:items-center">
              <Link
                to="/reservar"
                className="cs-btn-signal min-h-[52px] inline-flex items-center gap-3 rounded-full bg-[#E63B2E] px-8 py-3.5 font-display text-sm sm:text-base font-bold tracking-wide text-[#F5F3EE]"
              >
                <span>PEDIR CITA</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#servicios"
                className="min-h-[52px] inline-flex items-center rounded-full border border-[#F5F3EE]/30 px-6 py-3.5 font-display text-sm font-bold hover:bg-[#F5F3EE]/10 transition-colors"
              >
                Ver servicios y precios
              </a>
            </div>
          </div>

          <dl className="hero-stagger mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-[#F5F3EE]/15 pt-5">
            <div>
              <dt className="font-mono-data text-[11px] uppercase text-[#E8E4DD]/60">Desde</dt>
              <dd className="font-display text-xl sm:text-2xl font-bold">{fromPrice != null && Number.isFinite(fromPrice) ? formatEuro(fromPrice) : '—'}</dd>
            </div>
            <div>
              <dt className="font-mono-data text-[11px] uppercase text-[#E8E4DD]/60">Google</dt>
              <dd className="font-display text-xl sm:text-2xl font-bold">
                {BRAND.googleRating.toLocaleString('es-ES')} <span className="text-[#E63B2E]">★</span>
              </dd>
            </div>
            <div>
              <dt className="font-mono-data text-[11px] uppercase text-[#E8E4DD]/60">Servicios hechos</dt>
              <dd className="font-display text-xl sm:text-2xl font-bold tabular-nums">
                {data?.realMetrics ? data.realMetrics.completedAppointments.toLocaleString('es-ES') : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {loadError && (
        <div className="mx-auto max-w-6xl px-5 pt-8">
          <p className="rounded-2xl border border-[#E63B2E] bg-[#E63B2E]/10 px-5 py-4 text-sm text-[#E63B2E]">
            No hemos podido cargar la información de la barbería. Recarga la página en unos segundos.
          </p>
        </div>
      )}

      {/* SERVICIOS */}
      <section id="servicios" className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28 scroll-mt-20">
        <div className="reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">01 · SERVICIOS</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Carta de <span className="font-editorial font-normal">servicios</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-[#111111]/70">
            Precios cerrados, sin sorpresas. Elige uno o combina varios al reservar.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 && !loadError
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-[2rem] bg-[#111111]/8" />
              ))
            : services.map((svc) => (
                <Link
                  key={svc.id}
                  to={`/reservar?servicio=${svc.id}`}
                  className="reveal cs-interactive group flex flex-col overflow-hidden rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] hover:border-[#111111]"
                >
                  {svc.imageUrl && (
                    <div className="relative h-44 overflow-hidden">
                      <img
                        src={svc.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl font-bold">{svc.name}</h3>
                      <span className="font-mono-data text-lg font-bold text-[#E63B2E] tabular-nums">
                        {formatEuro(svc.priceCents)}
                      </span>
                    </div>
                    <p className="mt-2 flex-1 text-sm text-[#111111]/70">{svc.description}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-[#111111]/10 pt-4 font-mono-data text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[#111111]/65">
                        <Clock className="h-3.5 w-3.5" /> {svc.durationMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold group-hover:text-[#E63B2E]">
                        Reservar <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-[#F5F3EE] border-y border-[#111111]/10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 sm:px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div className="reveal space-y-6">
            <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">02 · RESERVA ONLINE</p>
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Sin llamadas. <span className="font-editorial font-normal">Sin esperas.</span>
            </h2>
            <ol className="space-y-4">
              {[
                ['Elige servicio', 'Corte, barba o la sesión completa.'],
                ['Escoge barbero, día y hora', 'Solo verás huecos realmente libres, al minuto.'],
                ['Confirma', 'Recibes un código para cambiar o cancelar cuando quieras.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] font-mono-data text-xs font-bold text-[#F5F3EE]">
                    0{i + 1}
                  </span>
                  <div>
                    <p className="font-display font-bold">{title}</p>
                    <p className="text-sm text-[#111111]/70">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              to="/reservar"
              className="cs-btn-signal inline-flex items-center gap-2 rounded-full bg-[#111111] px-6 py-3.5 font-display text-sm font-bold text-[#F5F3EE]"
            >
              Reservar ahora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="reveal">
            <CalendarCursorShowcase />
          </div>
        </div>
      </section>

      {/* EQUIPO */}
      {team.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28">
          <div className="reveal">
            <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">03 · EQUIPO</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Manos <span className="font-editorial font-normal">expertas</span>
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <article
                key={member.id}
                className="reveal flex flex-col rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6"
              >
                <div className="flex items-center gap-4">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#111111] font-display text-lg font-bold text-[#F5F3EE]">
                      {initials(member.name)}
                    </span>
                  )}
                  <div>
                    <h3 className="font-display text-lg font-bold">{member.name}</h3>
                    <p className="font-mono-data text-xs text-[#E63B2E]">{member.roleTitle}</p>
                  </div>
                </div>
                {member.bio && <p className="mt-4 flex-1 text-sm text-[#111111]/75">{member.bio}</p>}
                {member.specialties && (
                  <p className="mt-4 flex items-start gap-2 border-t border-[#111111]/10 pt-4 font-mono-data text-xs text-[#111111]/65">
                    <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {member.specialties}
                  </p>
                )}
                <Link
                  to={`/reservar?barbero=${member.id}`}
                  className="mt-4 inline-flex items-center gap-1.5 font-display text-sm font-bold text-[#E63B2E]"
                >
                  Reservar con {member.name.split(' ')[0]} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* EL LOCAL + HORARIO */}
      <section className="relative overflow-hidden bg-[#111111] text-[#F5F3EE]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 sm:px-6 py-20 sm:py-28 lg:grid-cols-12">
          <div className="reveal lg:col-span-7">
            <div className="overflow-hidden rounded-[2rem]">
              <img
                src="/images/barber_interior.jpg"
                alt="Interior de la barbería Barbería Segorbe"
                loading="lazy"
                className="h-72 w-full object-cover sm:h-[26rem]"
              />
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href={BRAND.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[#F5F3EE]/12 p-5 hover:border-[#F5F3EE]/40 transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold">{BRAND.googleRating.toLocaleString('es-ES')}</span>
                  <div className="flex gap-0.5 text-[#E63B2E]" aria-label={`${BRAND.googleRating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
                <p className="mt-1 font-mono-data text-xs text-[#E8E4DD]/65">{BRAND.googleReviews} reseñas en Google</p>
              </a>
              <a
                href={BRAND.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col justify-between rounded-2xl border border-[#F5F3EE]/12 p-5 hover:border-[#F5F3EE]/40 transition-colors"
              >
                <Instagram className="h-7 w-7 text-[#E63B2E]" />
                <div>
                  <p className="mt-3 font-display font-bold">@{BRAND.instagramHandle}</p>
                  <p className="font-mono-data text-xs text-[#E8E4DD]/65">Mira nuestros trabajos</p>
                </div>
              </a>
            </div>
          </div>

          <div className="reveal space-y-8 lg:col-span-5">
            <div>
              <p className="font-mono-data text-xs tracking-widest text-[#E63B2E]">04 · VISÍTANOS</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight">Horario</h2>
            </div>
            <ul className="divide-y divide-[#F5F3EE]/10 rounded-2xl border border-[#F5F3EE]/12">
              {(hours.length ? DAY_ORDER.map((d) => hours.find((h) => h.dayOfWeek === d)).filter(Boolean) : []).map((h) => {
                const hour = h as OpeningHour;
                const isToday = hour.dayOfWeek === todayDow;
                return (
                  <li
                    key={hour.dayOfWeek}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${isToday ? 'bg-[#F5F3EE]/8' : ''}`}
                  >
                    <span className="font-display font-medium">
                      {DAY_NAMES[hour.dayOfWeek]}
                      {isToday && <span className="ml-2 font-mono-data text-[10px] text-[#E63B2E]">HOY</span>}
                    </span>
                    <span className="font-mono-data text-xs tabular-nums text-[#E8E4DD]/80">
                      {!hour.isOpen
                        ? 'Cerrado'
                        : hour.breakStart && hour.breakEnd
                        ? `${hour.openTime}–${hour.breakStart} · ${hour.breakEnd}–${hour.closeTime}`
                        : `${hour.openTime}–${hour.closeTime}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-3 font-mono-data text-sm text-[#E8E4DD]/80">
              {business?.address && (
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#E63B2E]" /> {business.address}
                </p>
              )}
              {business?.phone && (
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 hover:text-[#F5F3EE]">
                  <Phone className="h-4 w-4 shrink-0 text-[#E63B2E]" /> {business.phone}
                </a>
              )}
              <a
                href={BRAND.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#F5F3EE]/25 px-4 py-2 font-display text-xs font-bold text-[#F5F3EE] hover:bg-[#F5F3EE]/10"
              >
                <Navigation className="h-3.5 w-3.5" /> Cómo llegar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28">
        <div className="reveal flex flex-col items-start gap-6 rounded-[2rem] bg-[#E63B2E] p-8 text-[#F5F3EE] sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">¿Toca corte?</h2>
            <p className="mt-2 text-sm text-[#F5F3EE]/85 sm:text-base">Mira los huecos libres de esta semana y reserva en un minuto.</p>
          </div>
          <Link
            to="/reservar"
            className="cs-btn-signal inline-flex shrink-0 items-center gap-2 rounded-full bg-[#111111] px-7 py-4 font-display text-sm font-bold"
          >
            Pedir cita <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer business={business} systemOperational={Boolean(data?.systemOperational)} />
    </div>
  );
}
