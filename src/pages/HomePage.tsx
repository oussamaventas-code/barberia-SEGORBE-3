import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowRight, Clock, MapPin, Star } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { LogoMark } from '../components/Logo';
import { BRAND } from '../lib/brand';

/**
 * Portada de UNA sola pantalla (sin scroll), pensada para móvil.
 * No consulta la base de datos: se pinta al instante. La agenda se prepara en segundo plano.
 */
export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.hero-stagger', {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.07,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#111111] text-[#F5F3EE]"
    >
      <Navbar variant="hero" hideCta />

      <img
        src="/images/hero_barber_cinematic.jpg"
        alt="Barbero trabajando en Barbería Segorbe, Murcia"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[65%_center]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/70 to-[#111111]/25" />

      <main className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col justify-end px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-20 sm:max-w-2xl">
        <LogoMark className="hero-stagger mb-4 h-16 w-16 sm:h-20 sm:w-20" background="#111111" />

        <h1 className="hero-stagger leading-[0.9] tracking-tight">
          <span className="block font-display text-[2.9rem] font-bold sm:text-7xl">DEFINE EL</span>
          <span className="block font-editorial text-[3.6rem] sm:text-8xl">
            ESTILO<span className="text-[#E63B2E]">.</span>
          </span>
        </h1>

        <p className="hero-stagger mt-3 font-display text-base text-[#E8E4DD]/85 sm:text-xl">
          Reserva tu cita en un minuto.
        </p>

        <Link
          to="/reservar"
          className="hero-stagger cs-btn-signal mt-6 flex h-16 w-full items-center justify-center gap-3 rounded-full bg-[#E63B2E] font-display text-lg font-bold tracking-wide text-[#F5F3EE] shadow-[0_10px_30px_-10px_rgba(230,59,46,0.7)] sm:h-[72px] sm:text-xl"
        >
          PEDIR CITA
          <ArrowRight className="h-5 w-5" />
        </Link>

        <Link
          to="/mi-cita"
          className="hero-stagger mt-4 text-center font-mono-data text-xs text-[#E8E4DD]/70 underline-offset-4 hover:underline"
        >
          ¿Ya tienes cita? Cámbiala o cancélala
        </Link>

        <div className="hero-stagger mt-5 grid grid-cols-3 gap-2 border-t border-[#F5F3EE]/15 pt-4 font-mono-data text-[10.5px] leading-tight text-[#E8E4DD]/75 sm:text-xs">
          <a href={BRAND.mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-1.5">
            <Star className="mt-px h-3.5 w-3.5 shrink-0 fill-[#E63B2E] text-[#E63B2E]" />
            <span>
              {BRAND.googleRating.toLocaleString('es-ES')} Google
              <br />
              {BRAND.googleReviews} reseñas
            </span>
          </a>
          <span className="flex items-start gap-1.5">
            <Clock className="mt-px h-3.5 w-3.5 shrink-0 text-[#E63B2E]" />
            <span>
              L–V 10–14h
              <br />
              16:30–20:30h
            </span>
          </span>
          <a href={BRAND.mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-1.5">
            <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-[#E63B2E]" />
            <span>
              C. Jesús Esteban
              <br />
              Murcia
            </span>
          </a>
        </div>

        <nav className="mt-3 flex justify-center gap-3 whitespace-nowrap font-mono-data text-[10px] text-[#E8E4DD]/45">
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/aviso-legal">Aviso legal</Link>
          <Link to="/condiciones-reserva">Cancelación</Link>
          <Link to="/admin">Equipo</Link>
        </nav>
      </main>
    </div>
  );
}
