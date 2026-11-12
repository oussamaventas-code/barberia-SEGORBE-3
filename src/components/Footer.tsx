import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { PublicBusinessInfo } from '../types/domain';
import { LogoMark } from './Logo';
import { BRAND } from '../lib/brand';

interface FooterProps {
  business: PublicBusinessInfo | null;
  systemOperational: boolean;
}

export function Footer({ business, systemOperational }: FooterProps) {
  return (
    <footer className="bg-[#111111] text-[#F5F3EE] border-t border-[#F5F3EE]/10">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <LogoMark className="h-14 w-14" background="#111111" />
              <h2 className="font-display text-2xl font-bold tracking-tight">
                {business?.businessName || 'Barbería Segorbe'}
              </h2>
            </div>
            <p className="font-editorial text-xl text-[#E8E4DD]/80">
              Barbería contemporánea en {business?.city || 'Murcia'}.
            </p>
            <div className="pt-2 space-y-1.5 text-sm text-[#E8E4DD]/70 font-mono-data">
              {business?.address ? (
                <p>{business.address}</p>
              ) : (
                <p>Dirección pendiente de configurar</p>
              )}
              {business?.phone ? (
                <p>{business.phone}</p>
              ) : (
                <p>Teléfono pendiente de configurar</p>
              )}
              {business?.email && <p>{business.email}</p>}
              <a
                href={BRAND.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 pt-1 hover:text-[#E63B2E] transition-colors"
              >
                <Instagram className="h-4 w-4" /> @{BRAND.instagramHandle}
              </a>
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="font-mono-data text-xs tracking-wider text-[#E8E4DD]/50 uppercase">
              Navegación
            </p>
            <ul className="space-y-2 text-sm text-[#E8E4DD]/80">
              <li>
                <Link to="/" className="hover:text-[#E63B2E] transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/reservar" className="hover:text-[#E63B2E] transition-colors">
                  Pedir cita
                </Link>
              </li>
              <li>
                <Link to="/mi-cita" className="hover:text-[#E63B2E] transition-colors">
                  Consultar mi cita
                </Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-[#E63B2E] transition-colors">
                  Acceso equipo
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <p className="font-mono-data text-xs tracking-wider text-[#E8E4DD]/50 uppercase">
              Normativa y privacidad
            </p>
            <ul className="space-y-2 text-sm text-[#E8E4DD]/80">
              <li>
                <Link to="/privacidad" className="hover:text-[#E63B2E] transition-colors">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/aviso-legal" className="hover:text-[#E63B2E] transition-colors">
                  Aviso legal
                </Link>
              </li>
              <li>
                <Link to="/politica-cookies" className="hover:text-[#E63B2E] transition-colors">
                  Política de cookies
                </Link>
              </li>
              <li>
                <Link to="/condiciones-reserva" className="hover:text-[#E63B2E] transition-colors">
                  Política de cancelación
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[#F5F3EE]/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono-data text-xs text-[#E8E4DD]/50">
            © {new Date().getFullYear()} {business?.businessName || 'Barbería Segorbe'} · {business?.city || 'Murcia'}
          </p>
          {systemOperational && (
            <p className="font-mono-data text-xs text-[#E8E4DD]/70">
              Reservas online en tiempo real · Hora de Murcia
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
