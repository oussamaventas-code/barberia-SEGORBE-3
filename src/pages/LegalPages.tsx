import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { apiFetch } from '../lib/api';
import { PublicBusinessInfo } from '../types/domain';

interface LegalPageProps {
  docType: 'privacidad' | 'aviso-legal' | 'cookies' | 'cancelacion';
}

export default function LegalPages({ docType }: LegalPageProps) {
  const [business, setBusiness] = useState<PublicBusinessInfo | null>(null);

  useEffect(() => {
    apiFetch<{ business: PublicBusinessInfo | null }>('/api/public/bootstrap')
      .then((res) => setBusiness(res.business))
      .catch(() => {});
  }, []);

  const entity = business?.legalEntityName || '[Razón social pendiente de configuración y revisión profesional]';
  const taxId = business?.legalTaxId || '[NIF/CIF pendiente de configuración]';
  const address = business?.address || '[Dirección postal pendiente de configuración]';
  const contactEmail = business?.email || '[Email de contacto pendiente de configuración]';

  return (
    <div className="min-h-screen bg-[#E8E4DD] text-[#111111] flex flex-col">
      <Navbar variant="solid" />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 pt-28 pb-20 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono-data text-xs text-[#111111]/70 hover:text-[#E63B2E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a Barbería Segorbe</span>
        </Link>

        <article className="rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-8 sm:p-12 space-y-6 text-sm leading-relaxed text-[#111111]/85">
          {docType === 'privacidad' && (
            <>
              <p className="font-mono-data text-xs text-[#E63B2E]">RGPD · LOPDGDD (ESPAÑA)</p>
              <h1 className="font-display text-3xl font-bold text-[#111111]">
                Política de Privacidad
              </h1>
              <p>
                <strong>Responsable del tratamiento:</strong> {entity} · NIF/CIF: {taxId} · Domicilio: {address} · Contacto: {contactEmail}.
              </p>
              <h2 className="font-display text-lg font-bold text-[#111111]">
                1. Finalidad y base jurídica
              </h2>
              <p>
                Los datos estrictamente necesarios (nombre, teléfono y, en su caso, correo electrónico) se tratan para gestionar tu reserva, modificaciones, cancelaciones y recordatorios operativos en ejecución de la relación de servicio solicitada (art. 6.1.b RGPD).
              </p>
              <p>
                Las comunicaciones comerciales o avisos promocionales únicamente se enviarán cuando hayas marcado de forma expresa y separada el consentimiento comercial opcional (art. 6.1.a RGPD).
              </p>
              <h2 className="font-display text-lg font-bold text-[#111111]">
                2. Derechos de acceso, rectificación, supresión y portabilidad
              </h2>
              <p>
                Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad (descarga directa en JSON disponible desde el área de cliente) escribiendo a {contactEmail} o solicitándolo presencialmente en la barbería.
              </p>
            </>
          )}

          {docType === 'aviso-legal' && (
            <>
              <p className="font-mono-data text-xs text-[#E63B2E]">LSSI-CE · ESPAÑA</p>
              <h1 className="font-display text-3xl font-bold text-[#111111]">Aviso Legal</h1>
              <p>
                Titular del sitio web y del sistema de reservas <strong>Segorbe OS</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nombre comercial: {business?.businessName || 'Barbería Segorbe'}</li>
                <li>Titular / Razón social: {entity}</li>
                <li>NIF / CIF: {taxId}</li>
                <li>Domicilio: {address}</li>
                <li>Correo de contacto: {contactEmail}</li>
              </ul>
              <p className="font-mono-data text-xs text-[#B45309]">
                Nota: Los datos fiscales y societarios marcados como pendientes deben ser revisados y completados por el titular desde Administración antes de la publicación definitiva.
              </p>
            </>
          )}

          {docType === 'cookies' && (
            <>
              <p className="font-mono-data text-xs text-[#E63B2E]">NORMATIVA DE COOKIES</p>
              <h1 className="font-display text-3xl font-bold text-[#111111]">
                Política de Cookies
              </h1>
              <p>
                Segorbe OS utiliza exclusivamente cookies y almacenamiento técnico estrictamente necesarios para mantener la seguridad de sesión en las áreas autenticadas y la integridad del proceso de reserva. No se utilizan cookies publicitarias de terceros.
              </p>
            </>
          )}

          {docType === 'cancelacion' && (
            <>
              <p className="font-mono-data text-xs text-[#E63B2E]">CONDICIONES DEL SERVICIO</p>
              <h1 className="font-display text-3xl font-bold text-[#111111]">
                Condiciones de Reserva y Cancelación
              </h1>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Antelación mínima para reservar online:{' '}
                  <strong>{business?.minLeadMinutes ?? 60} minutos</strong>.
                </li>
                <li>
                  Antelación máxima de apertura de agenda:{' '}
                  <strong>{business?.maxAdvanceDays ?? 30} días</strong>.
                </li>
                <li>
                  Plazo límite para cancelar online:{' '}
                  <strong>{business?.cancelCutoffHours ?? 24} horas</strong> antes de la cita.
                </li>
                <li>
                  Plazo límite para modificar fecha, hora o profesional:{' '}
                  <strong>{business?.rescheduleCutoffHours ?? 12} horas</strong> antes de la cita.
                </li>
              </ul>
              {business?.cancellationPolicyText && (
                <p className="pt-2">{business.cancellationPolicyText}</p>
              )}
            </>
          )}
        </article>
      </main>
      <Footer business={business} systemOperational={true} />
    </div>
  );
}
