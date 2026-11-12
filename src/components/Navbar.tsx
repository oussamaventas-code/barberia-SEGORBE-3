import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LogoLockup } from './Logo';

interface NavbarProps {
  variant?: 'hero' | 'solid';
}

export function Navbar({ variant = 'hero' }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 36);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isLightSurface = variant === 'solid' || scrolled;

  return (
    <header className="fixed top-2 sm:top-3 left-0 right-0 z-40 flex justify-center px-3 sm:px-4">
      <div
        className={`flex w-full max-w-4xl items-center justify-between gap-3 sm:gap-8 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 transition-all duration-200 ${
          isLightSurface
            ? 'bg-[#F5F3EE]/95 text-[#111111] border border-[#111111]/12 backdrop-blur-md shadow-sm'
            : 'bg-[#111111]/45 text-[#F5F3EE] border border-[#F5F3EE]/15 backdrop-blur-sm'
        }`}
      >
        <Link
          to="/"
          aria-label="Barbería Segorbe, inicio"
          className="text-xs sm:text-sm whitespace-nowrap shrink-0"
        >
          <LogoLockup
            markClassName="h-7 w-7 sm:h-8 sm:w-8"
            background={isLightSurface ? '#F5F3EE' : '#111111'}
            className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline"
          />
        </Link>

        <nav className="flex items-center gap-4 sm:gap-7 text-xs sm:text-sm font-medium">
          <Link
            to="/reservar"
            className="whitespace-nowrap shrink-0 py-1 hover:text-[#E63B2E] transition-colors"
          >
            Reservar
          </Link>
          <Link
            to="/mi-cita"
            className="whitespace-nowrap shrink-0 py-1 hover:text-[#E63B2E] transition-colors"
          >
            Mi cita
          </Link>
        </nav>

        <Link
          to="/reservar"
          className="cs-btn-signal inline-flex items-center gap-1.5 rounded-full bg-[#E63B2E] px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold tracking-wide text-[#F5F3EE] whitespace-nowrap shrink-0"
        >
          <span>Pedir cita</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}
