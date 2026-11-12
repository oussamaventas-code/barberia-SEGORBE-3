import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { apiFetch } from '../lib/api';
import { PublicBusinessInfo } from '../types/domain';

interface BootstrapPayload {
  systemOperational: boolean;
  business: PublicBusinessInfo | null;
}

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BootstrapPayload | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<BootstrapPayload>('/api/public/bootstrap')
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  return (
    <div ref={rootRef} className="h-[100dvh] w-full overflow-hidden bg-[#111111] text-[#F5F3EE]">
      <Navbar variant="hero" />

      {/* HERO H1 — FULL-BLEED 100dvh WITHOUT SCROLL */}
      <section className="relative flex h-[100dvh] w-full items-end overflow-hidden bg-[#111111] text-[#F5F3EE]">
        <img
          src="/src/assets/images/hero_barber_cinematic_1794509411473.jpg"
          alt="Barbero profesional trabajando en Club Segorbe, Murcia"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/65 to-[#111111]/30"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#111111]/85 via-[#111111]/40 to-transparent"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-6 pb-6 pt-16 sm:pb-12 sm:pt-24">
          <div className="max-w-3xl space-y-4 sm:space-y-6">
            <p className="hero-stagger font-mono-data text-xs sm:text-sm tracking-[0.2em] text-[#E8E4DD]/85">
              MURCIA · BARBERÍA
            </p>

            <h1 className="hero-stagger leading-[0.92] tracking-tight">
              <span className="block font-display text-5xl font-bold sm:text-7xl lg:text-8xl">
                DEFINE EL
              </span>
              <span className="block font-editorial text-6xl text-[#F5F3EE] sm:text-8xl lg:text-[7.5rem]">
                ESTILO.
              </span>
            </h1>

            <p className="hero-stagger font-display text-base sm:text-2xl text-[#E8E4DD]/90 max-w-xl">
              Tu próximo corte empieza aquí.
            </p>

            <div className="hero-stagger flex flex-col items-start gap-3 sm:gap-4 pt-1 sm:pt-2 sm:flex-row sm:items-center">
              <Link
                to="/reservar"
                className="cs-btn-signal min-h-[52px] inline-flex items-center gap-3 rounded-full bg-[#E63B2E] px-8 py-3.5 font-display text-sm sm:text-base font-bold tracking-wide text-[#F5F3EE]"
              >
                <span>PEDIR CITA</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="font-mono-data text-xs text-[#E8E4DD]/75">
                Reserva online en 3 pasos · Desde tu móvil.
              </span>
            </div>
          </div>

          <div className="mt-6 sm:mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#F5F3EE]/15 pt-3.5 font-mono-data text-[11px] text-[#E8E4DD]/65">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span>{data?.business?.businessName || 'Club Segorbe'}</span>
              <span aria-hidden="true">·</span>
              <Link to="/privacidad" className="hover:text-[#F5F3EE] transition-colors">
                Privacidad
              </Link>
              <Link to="/aviso-legal" className="hover:text-[#F5F3EE] transition-colors">
                Aviso legal
              </Link>
              <Link to="/condiciones-reserva" className="hover:text-[#F5F3EE] transition-colors">
                Cancelación
              </Link>
            </div>
            <span>{data?.business?.city || 'Murcia'} · Europe/Madrid · <Link to="/admin" className="hover:text-[#F5F3EE] transition-colors">Acceso equipo</Link></span>
          </div>
        </div>
      </section>
    </div>
  );
}
