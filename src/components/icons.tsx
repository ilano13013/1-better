/** Jeu d'icônes minimal, trait fin, cohérent avec l'identité premium. */
type P = { size?: number; strokeWidth?: number };

const base = (size: number, strokeWidth: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconHome = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></svg>
);
export const IconCalendar = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
);
export const IconDumbbell = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>
);
export const IconBowl = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7.5c0-1.5 1-2.5 1-4M12 7c0-2 1.2-3 1.2-4.5M16 7.5c0-1.2.8-2 .8-3" /></svg>
);
export const IconUser = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>
);
export const IconCart = ({ size = 18, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.4a2 2 0 0 0 2-1.6L20 8H6" /><circle cx="9.5" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
);
export const IconCheck = ({ size = 14, strokeWidth = 2.6 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="m4 12.5 5 5L20 6.5" /></svg>
);
export const IconClose = ({ size = 16, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconBack = ({ size = 18, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M15 5 8 12l7 7" /></svg>
);
export const IconChevron = ({ size = 16, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="m9 5 7 7-7 7" /></svg>
);
export const IconSwap = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 8h13l-3.2-3.2M20 16H7l3.2 3.2" /></svg>
);
export const IconPlus = ({ size = 16, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = ({ size = 16, strokeWidth = 2 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M5 12h14" /></svg>
);
export const IconSpark = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const IconTrend = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="m3 16 5-5 4 4 8-8" /><path d="M16 7h4v4" /></svg>
);
export const IconShare = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
);
export const IconCopy = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
);
export const IconDownload = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" /><path d="M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" /></svg>
);
export const IconInfo = ({ size = 15, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.5" /></svg>
);
export const IconFlame = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.8.8-3.2 1.6-4.2.3 1.2 1 2 1.9 2.2C10 8.4 12 6 12 3Z" /></svg>
);
export const IconClock = ({ size = 15, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></svg>
);
export const IconMedal = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="12" cy="14" r="5.5" /><path d="M8.5 9 6 3h12l-2.5 6" /></svg>
);
export const IconRest = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" /></svg>
);
export const IconTrash = ({ size = 15, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);
export const IconEdit = ({ size = 15, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>
);
export const IconWallet = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16.5 14.5h.01" /></svg>
);

/** Sifflet — l'écran Coach. */
export const IconWhistle = ({ size = 22, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M13 8h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-7" />
    <circle cx="8" cy="12" r="5" />
    <path d="M13 8V6.5a1.5 1.5 0 0 0-3 0V8" />
  </svg>
);

/** Instagram. */
export const IconInstagram = ({ size = 16, strokeWidth = 1.7 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.5 6.5h.01" />
  </svg>
);

/** Loupe — recherche dans la base d'aliments. */
export const IconSearch = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
);

/** Code-barres — saisie et scan. */
export const IconBarcode = ({ size = 16, strokeWidth = 1.8 }: P) => (
  <svg {...base(size, strokeWidth)}>
    <path d="M4 6v12M7.5 6v12M11 6v8M14.5 6v12M18 6v12M20.5 6v8" />
  </svg>
);
