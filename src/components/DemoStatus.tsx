import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_MODE } from '../lib/api';

/** Aviso flotante mientras se prepara la base de datos demo del navegador (solo la primera vez). */
export function DemoStatus() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('ready');
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (API_MODE !== 'demo') return;
    let unsub: (() => void) | undefined;
    let timer: number | undefined;
    // Se arranca tras el primer pintado para que la portada salga al instante
    const start = () => import('../demo/local-api').then(({ onDemoStateChange, ensureDemoReady }) => {
      unsub = onDemoStateChange((s) => {
        setState(s);
        if (s === 'loading') timer = window.setTimeout(() => setVisible(true), 700);
        else {
          window.clearTimeout(timer);
          setVisible(s === 'error');
        }
      });
      ensureDemoReady().catch(() => {});
    });
    const idle = window.setTimeout(start, 250);
    return () => {
      window.clearTimeout(idle);
      unsub?.();
      window.clearTimeout(timer);
    };
  }, []);

  if (!visible || (pathname === '/' && state !== 'error')) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-full border border-[#111111]/15 bg-[#F5F3EE] px-5 py-2.5 font-mono-data text-xs text-[#111111] shadow-lg"
    >
      {state === 'error' ? (
        <span className="text-[#E63B2E]">No se pudo iniciar la agenda. Recarga la página.</span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#E63B2E]" /> Preparando la agenda…
        </span>
      )}
    </div>
  );
}

/** Botón para borrar los datos demo de este dispositivo y empezar de cero. */
export function ResetDemoButton({ className = '' }: { className?: string }) {
  if (API_MODE !== 'demo') return null;
  const onClick = async () => {
    if (!window.confirm('¿Reiniciar la demo? Se borrarán las citas y cambios hechos en este dispositivo y se volverán a cargar los datos de ejemplo.')) return;
    const { resetDemo } = await import('../demo/local-api');
    await resetDemo();
  };
  return (
    <button type="button" onClick={onClick} className={className}>
      Reiniciar demo
    </button>
  );
}
