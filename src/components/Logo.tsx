/**
 * Escudo de Barbería Segorbe (corona, escudo con iniciales B·S y bigote, ornamentos laterales).
 * Recreación vectorial del logotipo: usa `currentColor`, por lo que se adapta al fondo.
 * Para usar el archivo original, colócalo en /public/images/logo.png y pasa `src`.
 */
interface LogoProps {
  className?: string;
  title?: string;
  src?: string;
  /** Color del fondo sobre el que va el logo (se usa para recortar el bigote). */
  background?: string;
}

export function LogoMark({ className = 'h-10 w-10', title = 'Barbería Segorbe', src, background = '#111111' }: LogoProps) {
  if (src) return <img src={src} alt={title} className={className} />;
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      style={{ ['--logo-bg' as string]: background }}
    >
      <title>{title}</title>
      {/* Corona */}
      <path
        d="M44 26 L48 12 L54 20 L60 8 L66 20 L72 12 L76 26 Z"
        fill="currentColor"
      />
      <rect x="43" y="27" width="34" height="4" rx="1" fill="currentColor" />
      {/* Ornamentos laterales */}
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M33 40 C22 34 12 42 16 52 C18 57 25 57 26 52" />
        <path d="M32 58 C18 56 10 68 17 77 C21 82 28 79 27 74" />
        <path d="M34 80 C24 84 22 98 32 101 C37 102 40 97 37 94" />
        <path d="M87 40 C98 34 108 42 104 52 C102 57 95 57 94 52" />
        <path d="M88 58 C102 56 110 68 103 77 C99 82 92 79 93 74" />
        <path d="M86 80 C96 84 98 98 88 101 C83 102 80 97 83 94" />
      </g>
      <g fill="currentColor">
        <path d="M20 47 C23 44 27 45 28 48 C25 49 22 49 20 47 Z" />
        <path d="M100 47 C97 44 93 45 92 48 C95 49 98 49 100 47 Z" />
        <path d="M21 72 C24 69 28 70 29 73 C26 74 23 74 21 72 Z" />
        <path d="M99 72 C96 69 92 70 91 73 C94 74 97 74 99 72 Z" />
      </g>
      {/* Escudo */}
      <path
        d="M34 34 H86 V66 C86 86 74 98 60 106 C46 98 34 86 34 66 Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M60 34 V106" stroke="currentColor" strokeWidth="2" />
            {/* Cuarteles rellenos (alternos) */}
      <path d="M60 34 H86 V55 H60 Z" fill="currentColor" />
      <path d="M34 69 H60 V106 C46 98 34 86 34 69 Z" fill="currentColor" />
      {/* Iniciales */}
      <text x="47" y="51" textAnchor="middle" fontFamily="Georgia, 'DM Serif Display', serif" fontWeight="700" fontSize="20" fill="currentColor">
        B
      </text>
      <text x="73" y="92" textAnchor="middle" fontFamily="Georgia, 'DM Serif Display', serif" fontWeight="700" fontSize="20" fill="currentColor">
        S
      </text>
      {/* Banda central con bigote */}
      <rect x="35.5" y="55" width="49" height="14" fill="currentColor" />
      <path
        d="M60 60.5 C56 56 48 56 44.5 61 C43.5 62.6 41.5 63 40.5 62 C41 66 46 67.5 50 66.2 C54 65 57.5 63.6 60 62.4 C62.5 63.6 66 65 70 66.2 C74 67.5 79 66 79.5 62 C78.5 63 76.5 62.6 75.5 61 C72 56 64 56 60 60.5 Z"
        fill="var(--logo-bg, #111111)"
      />
    </svg>
  );
}

/** Logo + nombre en una línea. */
export function LogoLockup({
  className = '',
  markClassName = 'h-8 w-8',
  background,
}: {
  className?: string;
  markClassName?: string;
  background?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} background={background} />
      <span className="font-display font-bold tracking-tight leading-none">BARBERÍA SEGORBE</span>
    </span>
  );
}
