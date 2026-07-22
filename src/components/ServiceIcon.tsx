type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Tooth = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z" />
  </svg>
);

const Sparkle = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
    <path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </svg>
);

const Implant = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M9 3h6M10 6h4M12 6v3M9.5 9h5l-.6 4h-3.8L9.5 9Z" />
    <path d="M11 13l-.4 8M13 13l.4 8" />
  </svg>
);

const Align = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="3" y="9" width="4" height="6" rx="1" />
    <rect x="10" y="9" width="4" height="6" rx="1" />
    <rect x="17" y="9" width="4" height="6" rx="1" />
    <path d="M3 12h18" />
  </svg>
);

const Shield = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3l7 2.5v5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5v-5L12 3Z" />
    <path d="M9.2 12l2 2 3.6-4" />
  </svg>
);

const Whiten = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 4.5c-2-1.3-4.6-1.4-5.8.3-1.1 1.7-.5 4 0 6.1.5 1.8.3 2.8.8 4.9.3 1.3.6 2.7 1.4 2.7 1 0 1-1.9 1.5-3.4.3-.9.7-1.6 1.1-1.6" />
    <path d="M16.5 4.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" />
  </svg>
);

const Crown = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M4 8l3 3 5-6 5 6 3-3-1.5 10h-13L4 8Z" />
    <path d="M6.5 18h11" />
  </svg>
);

const Kids = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="9" r="5" />
    <path d="M9.5 8.5h.01M14.5 8.5h.01M9.5 11c.8.8 4.2.8 5 0" />
    <path d="M5 21c1-3 4-4 7-4s6 1 7 4" />
  </svg>
);

const map: Record<string, (p: IconProps) => React.ReactElement> = {
  tooth: Tooth,
  sparkle: Sparkle,
  implant: Implant,
  align: Align,
  shield: Shield,
  whiten: Whiten,
  crown: Crown,
  kids: Kids,
};

export function ServiceIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = map[name] ?? Tooth;
  return <Cmp className={className} />;
}
