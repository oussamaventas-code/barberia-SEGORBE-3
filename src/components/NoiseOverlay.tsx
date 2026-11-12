export function NoiseOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-[0.05]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="barberia-segorbe-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.8"
          numOctaves="3"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#barberia-segorbe-noise)" />
    </svg>
  );
}
