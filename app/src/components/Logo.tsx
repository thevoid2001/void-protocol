/** Void Protocol logo — a black circle with a cyan glowing edge */
export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id="voidGlow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#000000" />
          <stop offset="95%" stopColor="#64C8FF" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#64C8FF" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="#050505"
        stroke="#64C8FF"
        strokeWidth="1.5"
        filter="url(#glow)"
        opacity="0.9"
      />
      <circle cx="50" cy="50" r="38" fill="url(#voidGlow)" />
    </svg>
  );
}
