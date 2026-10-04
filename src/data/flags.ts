/**
 * Especificación de banderas para el generador de SVG.
 *
 * `FLAG_SPECS` describe banderas de franjas (horizontales/verticales) con un
 * emblema opcional; cubre la mayoría de selecciones de forma reconocible.
 * `FLAG_EXCEPTIONS` guarda el SVG interno (viewBox 0 0 60 40) de las banderas
 * que no encajan en el patrón. Las banderas que no aparezcan usan un estandarte
 * generado a partir del código.
 */
export interface FlagEmblem {
  shape: 'circle' | 'cross' | 'star' | 'crescent' | 'diamond' | 'triangle' | 'triangleLeft';
  color: string;
  /** Tamaño relativo (1 = por defecto). */
  scale?: number;
}

export interface FlagSpec {
  layout: 'horizontal' | 'vertical';
  /** Colores, de arriba a abajo o de izquierda a derecha. */
  stripes: string[];
  emblem?: FlagEmblem;
}

export const FLAG_SPECS: Record<string, FlagSpec> = {
  /* ---------------------------------------------------------------- Europa */
  ES: { layout: 'horizontal', stripes: ['#aa151b', '#f1bf00', '#aa151b'] },
  DE: { layout: 'horizontal', stripes: ['#111111', '#dd0000', '#ffce00'] },
  IT: { layout: 'vertical', stripes: ['#008c45', '#f4f5f0', '#cd212a'] },
  FR: { layout: 'vertical', stripes: ['#002395', '#ffffff', '#ed2939'] },
  PT: { layout: 'vertical', stripes: ['#046a38', '#da291c', '#da291c'], emblem: { shape: 'circle', color: '#ffd100', scale: 0.9 } },
  NL: { layout: 'horizontal', stripes: ['#ae1c28', '#ffffff', '#21468b'] },
  BE: { layout: 'vertical', stripes: ['#111111', '#fae042', '#ed2939'] },
  HR: { layout: 'horizontal', stripes: ['#ff0000', '#ffffff', '#171796'], emblem: { shape: 'diamond', color: '#d11212', scale: 0.7 } },
  DK: { layout: 'horizontal', stripes: ['#c8102e'], emblem: { shape: 'cross', color: '#ffffff' } },
  CH: { layout: 'horizontal', stripes: ['#d52b1e'], emblem: { shape: 'cross', color: '#ffffff', scale: 0.8 } },
  AT: { layout: 'horizontal', stripes: ['#ed2939', '#ffffff', '#ed2939'] },
  RS: { layout: 'horizontal', stripes: ['#c6363c', '#0c4076', '#ffffff'] },
  TR: { layout: 'horizontal', stripes: ['#e30a17'], emblem: { shape: 'crescent', color: '#ffffff' } },
  UA: { layout: 'horizontal', stripes: ['#0057b7', '#ffd700'] },
  NO: { layout: 'horizontal', stripes: ['#ba0c2f'], emblem: { shape: 'cross', color: '#ffffff' } },
  PL: { layout: 'horizontal', stripes: ['#ffffff', '#dc143c'] },
  SE: { layout: 'horizontal', stripes: ['#006aa7'], emblem: { shape: 'cross', color: '#fecc00' } },
  HU: { layout: 'horizontal', stripes: ['#cd2a3e', '#ffffff', '#436f4d'] },
  RO: { layout: 'vertical', stripes: ['#002b7f', '#fcd116', '#ce1126'] },
  IE: { layout: 'vertical', stripes: ['#169b62', '#ffffff', '#ff883e'] },
  IS: { layout: 'horizontal', stripes: ['#02529c'], emblem: { shape: 'cross', color: '#dc1e35' } },
  CZ: { layout: 'horizontal', stripes: ['#ffffff', '#d7141a'], emblem: { shape: 'triangleLeft', color: '#11457e' } },
  GR: { layout: 'horizontal', stripes: ['#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf'], emblem: { shape: 'cross', color: '#ffffff', scale: 0.9 } },
  AL: { layout: 'horizontal', stripes: ['#e41e20'], emblem: { shape: 'circle', color: '#111111', scale: 0.8 } },
  GE: { layout: 'horizontal', stripes: ['#ffffff'], emblem: { shape: 'cross', color: '#ff0000' } },
  UY: { layout: 'horizontal', stripes: ['#ffffff', '#0038a8', '#ffffff', '#0038a8', '#ffffff'], emblem: { shape: 'circle', color: '#fcd116', scale: 0.7 } },

  /* ---------------------------------------------------------- Sudamérica */
  AR: { layout: 'horizontal', stripes: ['#74acdf', '#ffffff', '#74acdf'] },
  CO: { layout: 'horizontal', stripes: ['#fcd116', '#003893', '#ce1126'] },
  EC: { layout: 'horizontal', stripes: ['#fcd116', '#003893', '#ce1126'], emblem: { shape: 'circle', color: '#ffd100', scale: 0.7 } },
  PE: { layout: 'vertical', stripes: ['#d91023', '#ffffff', '#d91023'] },
  PY: { layout: 'horizontal', stripes: ['#d52b1e', '#ffffff', '#0038a8'], emblem: { shape: 'circle', color: '#009b3a', scale: 0.6 } },
  VE: { layout: 'horizontal', stripes: ['#fcd116', '#00247d', '#cf142b'] },
  BO: { layout: 'horizontal', stripes: ['#d52b1e', '#f9e300', '#007934'] },

  /* ------------------------------------------------------- Norteamérica */
  MX: { layout: 'vertical', stripes: ['#006341', '#ffffff', '#ce1126'], emblem: { shape: 'circle', color: '#8b4513', scale: 0.6 } },
  CA: { layout: 'vertical', stripes: ['#ff0000', '#ffffff', '#ff0000'], emblem: { shape: 'star', color: '#ff0000', scale: 0.8 } },
  CR: { layout: 'horizontal', stripes: ['#002b7f', '#ffffff', '#ce1126', '#ffffff', '#002b7f'] },
  PA: { layout: 'horizontal', stripes: ['#ffffff', '#d21034', '#005293'], emblem: { shape: 'star', color: '#005293', scale: 0.6 } },
  HN: { layout: 'horizontal', stripes: ['#0073cf', '#ffffff', '#0073cf'], emblem: { shape: 'star', color: '#0073cf', scale: 0.6 } },
  GT: { layout: 'vertical', stripes: ['#4997d0', '#ffffff', '#4997d0'], emblem: { shape: 'circle', color: '#006341', scale: 0.6 } },
  HT: { layout: 'horizontal', stripes: ['#00209f', '#d21034'], emblem: { shape: 'circle', color: '#ffffff', scale: 0.5 } },
  SV: { layout: 'horizontal', stripes: ['#0f47af', '#ffffff', '#0f47af'] },
  TT: { layout: 'horizontal', stripes: ['#ce1126', '#ffffff', '#111111'] },
  CU: { layout: 'horizontal', stripes: ['#002a8f', '#ffffff', '#002a8f', '#ffffff', '#002a8f'], emblem: { shape: 'triangleLeft', color: '#cf142b' } },
  SR: { layout: 'horizontal', stripes: ['#377e3f', '#ffffff', '#b40a2d', '#ffffff', '#377e3f'], emblem: { shape: 'star', color: '#f7d116', scale: 0.6 } },
  DO: { layout: 'horizontal', stripes: ['#002d62', '#ffffff', '#ce1126'], emblem: { shape: 'cross', color: '#ffffff', scale: 0.7 } },
  JM: { layout: 'horizontal', stripes: ['#009b3a'], emblem: { shape: 'cross', color: '#fed100' } },

  /* ----------------------------------------------------------------- Asia */
  JP: { layout: 'horizontal', stripes: ['#ffffff'], emblem: { shape: 'circle', color: '#bc002d', scale: 0.9 } },
  KR: { layout: 'horizontal', stripes: ['#ffffff'], emblem: { shape: 'circle', color: '#cd2e3a', scale: 0.8 } },
  IR: { layout: 'horizontal', stripes: ['#239f40', '#ffffff', '#da0000'], emblem: { shape: 'circle', color: '#da0000', scale: 0.5 } },
  SA: { layout: 'horizontal', stripes: ['#006c35'], emblem: { shape: 'star', color: '#ffffff', scale: 0.7 } },
  QA: { layout: 'horizontal', stripes: ['#ffffff', '#8d1b3d'] },
  IQ: { layout: 'horizontal', stripes: ['#ce1126', '#ffffff', '#111111'], emblem: { shape: 'star', color: '#007a3d', scale: 0.5 } },
  UZ: { layout: 'horizontal', stripes: ['#0099b5', '#ffffff', '#1eb53a'], emblem: { shape: 'crescent', color: '#ffffff', scale: 0.6 } },
  AE: { layout: 'horizontal', stripes: ['#00732f', '#ffffff', '#111111'], emblem: { shape: 'triangleLeft', color: '#ff0000' } },
  JO: { layout: 'horizontal', stripes: ['#111111', '#ffffff', '#007a3d'], emblem: { shape: 'triangleLeft', color: '#ce1126' } },
  CN: { layout: 'horizontal', stripes: ['#de2910'], emblem: { shape: 'star', color: '#ffde00', scale: 0.8 } },
  OM: { layout: 'horizontal', stripes: ['#db161b', '#ffffff', '#008000'], emblem: { shape: 'circle', color: '#db161b', scale: 0.5 } },
  BH: { layout: 'horizontal', stripes: ['#ffffff', '#ce1126'] },
  VN: { layout: 'horizontal', stripes: ['#da251d'], emblem: { shape: 'star', color: '#ffff00', scale: 0.8 } },
  SY: { layout: 'horizontal', stripes: ['#ce1126', '#ffffff', '#111111'], emblem: { shape: 'star', color: '#007a3d', scale: 0.5 } },
  TH: { layout: 'horizontal', stripes: ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'] },
  LB: { layout: 'horizontal', stripes: ['#ed1c24', '#ffffff', '#ed1c24'], emblem: { shape: 'diamond', color: '#00a651', scale: 0.5 } },
  ID: { layout: 'horizontal', stripes: ['#ff0000', '#ffffff'] },
  IN: { layout: 'horizontal', stripes: ['#ff9933', '#ffffff', '#138808'], emblem: { shape: 'circle', color: '#000080', scale: 0.5 } },
  PH: { layout: 'horizontal', stripes: ['#0038a8', '#ce1126'], emblem: { shape: 'triangleLeft', color: '#ffffff' } },
  MY: { layout: 'horizontal', stripes: ['#cc0001', '#ffffff', '#cc0001', '#ffffff', '#cc0001'], emblem: { shape: 'crescent', color: '#ffcc00', scale: 0.6 } },

  /* --------------------------------------------------------------- África */
  MA: { layout: 'horizontal', stripes: ['#c1272d'], emblem: { shape: 'star', color: '#006233', scale: 0.8 } },
  SN: { layout: 'vertical', stripes: ['#00853f', '#fdef42', '#e31b23'], emblem: { shape: 'star', color: '#00853f', scale: 0.5 } },
  NGA: { layout: 'vertical', stripes: ['#008751', '#ffffff', '#008751'] },
  DZ: { layout: 'vertical', stripes: ['#006233', '#ffffff'], emblem: { shape: 'crescent', color: '#d21034', scale: 0.7 } },
  EG: { layout: 'horizontal', stripes: ['#ce1126', '#ffffff', '#111111'], emblem: { shape: 'star', color: '#c09300', scale: 0.5 } },
  CI: { layout: 'vertical', stripes: ['#f77f00', '#ffffff', '#009e60'] },
  CM: { layout: 'vertical', stripes: ['#007a5e', '#ce1126', '#fcd116'], emblem: { shape: 'star', color: '#fcd116', scale: 0.5 } },
  GH: { layout: 'horizontal', stripes: ['#ce1126', '#fcd116', '#006b3f'], emblem: { shape: 'star', color: '#111111', scale: 0.6 } },
  TN: { layout: 'horizontal', stripes: ['#e70013'], emblem: { shape: 'crescent', color: '#ffffff' } },
  ML: { layout: 'vertical', stripes: ['#14b53a', '#fcd116', '#ce1126'] },
  ZA: { layout: 'horizontal', stripes: ['#007a4d', '#ffffff', '#de3831', '#002395', '#111111'], emblem: { shape: 'triangleLeft', color: '#007a4d' } },
  GN: { layout: 'vertical', stripes: ['#ce1126', '#fcd116', '#009460'] },
  GAB: { layout: 'horizontal', stripes: ['#009e60', '#fcd116', '#3a75c4'] },
  AO: { layout: 'horizontal', stripes: ['#ce1126', '#111111'], emblem: { shape: 'circle', color: '#ffcc00', scale: 0.5 } },
  ZM: { layout: 'horizontal', stripes: ['#198a00'], emblem: { shape: 'circle', color: '#ef7d00', scale: 0.6 } },
  KEN: { layout: 'horizontal', stripes: ['#111111', '#ffffff', '#bb0000', '#ffffff', '#006600'] },
  NZ: { layout: 'horizontal', stripes: ['#00247d'], emblem: { shape: 'star', color: '#cc142b', scale: 0.7 } },
};

/** SVG interno (viewBox 0 0 60 40) de banderas que no siguen el patrón de franjas. */
export const FLAG_EXCEPTIONS: Record<string, string> = {
  // Inglaterra: cruz de San Jorge.
  GB:
    '<rect width="60" height="40" fill="#ffffff"/>' +
    '<rect x="24" width="12" height="40" fill="#cf142b"/>' +
    '<rect y="14" width="60" height="12" fill="#cf142b"/>',
  // Escocia: aspa de San Andrés.
  SCT:
    '<rect width="60" height="40" fill="#0065bd"/>' +
    '<path d="M0 0 L60 40 M60 0 L0 40" stroke="#ffffff" stroke-width="8" fill="none"/>',
  // Gales: blanco y verde con dragón (simplificado).
  WAL:
    '<rect width="60" height="20" fill="#ffffff"/>' +
    '<rect y="20" width="60" height="20" fill="#00b140"/>' +
    '<path d="M18 28 q8 -10 20 -6 q-4 4 -2 8 q-10 2 -18 -2z" fill="#d30731"/>',
  // Estados Unidos: franjas y cantón.
  US:
    '<rect width="60" height="40" fill="#ffffff"/>' +
    '<g fill="#b22234"><rect y="0" width="60" height="3.1"/><rect y="6.2" width="60" height="3.1"/><rect y="12.4" width="60" height="3.1"/><rect y="18.6" width="60" height="3.1"/><rect y="24.8" width="60" height="3.1"/><rect y="31" width="60" height="3.1"/><rect y="37.2" width="60" height="2.8"/></g>' +
    '<rect width="26" height="21.6" fill="#3c3b6e"/>' +
    '<g fill="#ffffff"><circle cx="5" cy="5" r="1.4"/><circle cx="13" cy="5" r="1.4"/><circle cx="21" cy="5" r="1.4"/><circle cx="9" cy="11" r="1.4"/><circle cx="17" cy="11" r="1.4"/><circle cx="5" cy="17" r="1.4"/><circle cx="13" cy="17" r="1.4"/><circle cx="21" cy="17" r="1.4"/></g>',
  // Brasil: rombo y círculo.
  BR:
    '<rect width="60" height="40" fill="#009b3a"/>' +
    '<polygon points="30,4 56,20 30,36 4,20" fill="#fedf00"/>' +
    '<circle cx="30" cy="20" r="9" fill="#002776"/>' +
    '<path d="M22 18 q8 5 16 1 q-2 6 -8 7 q-6 -1 -8 -8z" fill="#ffffff"/>',
  // Chile: cantón azul con estrella.
  CL:
    '<rect width="60" height="20" fill="#ffffff"/>' +
    '<rect y="20" width="60" height="20" fill="#d52b1e"/>' +
    '<rect width="20" height="20" fill="#0039a6"/>' +
    '<polygon points="10,5 11.8,10 17,10 12.8,13 14.5,18 10,15 5.5,18 7.2,13 3,10 8.2,10" fill="#ffffff"/>',
};
