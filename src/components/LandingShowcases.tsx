import { useEffect, useRef, useState } from 'react';
import { Bell, Calendar, Check, MousePointer2 } from 'lucide-react';

const DEMO_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DEMO_HOURS = ['10:00', '11:30', '13:00', '17:30', '19:00'];

export function CalendarCursorShowcase() {
  const [step, setStep] = useState(0); // 0=idle, 1=day, 2=hour, 3=confirmed

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setStep(3);
      return;
    }

    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  const selectedDayIdx = step >= 1 ? 3 : -1;
  const selectedHourIdx = step >= 2 ? 1 : -1;

  // Cursor position across the 3 interactive stages
  const cursorStyle =
    step === 0
      ? { transform: 'translate(24px, 20px)' }
      : step === 1
      ? { transform: 'translate(168px, 68px)' }
      : step === 2
      ? { transform: 'translate(115px, 146px)' }
      : { transform: 'translate(210px, 210px)' };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#111111]/12 bg-[#F5F3EE] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-[#111111]/10 pb-4">
        <div>
          <p className="font-mono-data text-xs text-[#111111]/60">
            Demostración visual de flujo · Agenda semanal
          </p>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight">
            Reserva en segundos
          </h3>
        </div>
        <Calendar className="h-5 w-5 text-[#E63B2E] shrink-0" />
      </div>

      <div className="relative mt-6 space-y-5">
        <div>
          <p className="font-mono-data text-xs text-[#111111]/60 mb-2">01 · Selección de día</p>
          <div className="grid grid-cols-6 gap-2">
            {DEMO_DAYS.map((day, idx) => {
              const active = idx === selectedDayIdx;
              return (
                <div
                  key={day}
                  className={`rounded-xl border px-2 py-2.5 text-center font-mono-data text-xs transition-colors duration-200 ${
                    active
                      ? 'border-[#111111] bg-[#111111] text-[#F5F3EE]'
                      : 'border-[#111111]/12 bg-[#E8E4DD]/60 text-[#111111]'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="font-mono-data text-xs text-[#111111]/60 mb-2">02 · Hora disponible</p>
          <div className="grid grid-cols-5 gap-2">
            {DEMO_HOURS.map((hour, idx) => {
              const active = idx === selectedHourIdx;
              return (
                <div
                  key={hour}
                  className={`rounded-xl border px-2 py-2 text-center font-mono-data text-xs tabular-nums transition-colors duration-200 ${
                    active
                      ? 'border-[#E63B2E] bg-[#E63B2E] text-[#F5F3EE]'
                      : 'border-[#111111]/12 bg-white text-[#111111]'
                  }`}
                >
                  {hour}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-200 ${
            step === 3
              ? 'border-[#15803D]/30 bg-[#15803D]/10 text-[#111111]'
              : 'border-[#111111]/10 bg-[#E8E4DD]/50 text-[#111111]/60'
          }`}
        >
          <span className="font-mono-data text-xs">
            {step === 3 ? 'Jue · 11:30 · Confirmación visual' : 'Selecciona día y tramo'}
          </span>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[#F5F3EE]">
            <Check className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Animated visual pointer */}
        <div
          aria-hidden="true"
          style={cursorStyle}
          className="pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-700 ease-out"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111]/90 text-[#F5F3EE] shadow-md">
            <MousePointer2 className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_STACK = [
  {
    id: 'n1',
    type: 'Nueva reserva',
    detail: 'Corte de pelo · Jueves 18:00 · Confirmación automática',
    state: 'Registrada',
  },
  {
    id: 'n2',
    type: 'Cita confirmada',
    detail: 'Arreglo de barba · Viernes 11:30 · Europe/Madrid',
    state: 'Confirmada',
  },
  {
    id: 'n3',
    type: 'Horario liberado',
    detail: 'Cancelación procesada · Aviso a lista de espera compatible',
    state: 'Disponible',
  },
];

export function NotificationStackShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    timerRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % DEMO_STACK.length);
    }, 2400);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="rounded-[2rem] border border-[#111111]/12 bg-[#111111] p-6 sm:p-8 text-[#F5F3EE]">
      <div className="flex items-center justify-between gap-4 border-b border-[#F5F3EE]/12 pb-4">
        <div>
          <p className="font-mono-data text-xs text-[#E8E4DD]/60">
            Demostración visual · Centro de eventos
          </p>
          <h3 className="mt-1 font-display text-xl font-bold tracking-tight">
            Notificaciones operativas
          </h3>
        </div>
        <Bell className="h-5 w-5 text-[#E63B2E] shrink-0" />
      </div>

      <div className="mt-6 space-y-3">
        {DEMO_STACK.map((item, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 ${
                isCurrent
                  ? 'border-[#E63B2E] bg-[#F5F3EE] text-[#111111] translate-x-1'
                  : 'border-[#F5F3EE]/12 bg-[#F5F3EE]/5 text-[#E8E4DD]/80 hover:border-[#F5F3EE]/30'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-sm font-bold">{item.type}</span>
                <span
                  className={`font-mono-data text-xs ${
                    isCurrent ? 'text-[#E63B2E]' : 'text-[#E8E4DD]/50'
                  }`}
                >
                  {item.state}
                </span>
              </div>
              <p
                className={`mt-1 font-mono-data text-xs ${
                  isCurrent ? 'text-[#111111]/75' : 'text-[#E8E4DD]/60'
                }`}
              >
                {item.detail}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
