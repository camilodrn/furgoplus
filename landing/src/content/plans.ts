/** Task 13 editorial proposal; never imported by the private product or Task 12.
 * Sources and maturity decisions: ../../CONTENT_REVIEW.md.
 * Prices are academic business hypotheses, not validated commercial tariffs.
 */
export type FeatureStatus = "available" | "testing" | "future";
export const STATUS_LABELS: Record<FeatureStatus, string> = {
  available: "Implementado en MVP académico",
  testing: "Experimental",
  future: "Propuesta futura",
};
// Demo totals already include IVA. Round the net once, then use the remainder
// for IVA so both whole-peso amounts always add back to the published total.
export const IVA_PERCENT = 19;
export function priceBreakdown(totalCLP: number) {
  const netCLP = Math.round(totalCLP / (1 + IVA_PERCENT / 100));
  return { totalCLP, netCLP, ivaCLP: totalCLP - netCLP };
}
export const plans = [
  {
    code: "basic",
    name: "Básico",
    monthlyCLP: 19990,
    description: "Para organizar tu jornada.",
    features: [
      {
        label: "Publicación tras validación y requisitos de elegibilidad",
        status: "available",
      },
      {
        label: "Solicitudes de contacto",
        status: "available",
        highlight: true,
      },
      {
        label: "Rutas, horarios y cupos",
        status: "available",
        highlight: true,
      },
      {
        label: "Registro manual de pagos",
        status: "available",
        highlight: true,
      },
    ],
  },
  {
    code: "pro",
    name: "Pro",
    monthlyCLP: 39990,
    description: "Para revisar tu gestión mensual.",
    features: [
      { label: "Gestión de Básico", status: "available", highlight: true },
      { label: "Informes mensuales", status: "available", highlight: true },
      {
        label: "Asistente FAQ automatizado",
        status: "testing",
        highlight: true,
      },
    ],
  },
  {
    code: "elite",
    name: "Elite",
    monthlyCLP: 69990,
    description: "Para analizar tu operación.",
    features: [
      { label: "Gestión de Básico", status: "available", highlight: true },
      { label: "Informes mensuales", status: "available" },
      { label: "Asistente FAQ automatizado", status: "testing" },
      {
        label: "Informes avanzados y comparación con el mes anterior",
        shortLabel: "Informes avanzados",
        status: "available",
        highlight: true,
      },
      { label: "Tres tipos de exportación XLSX", status: "available", highlight: true },
      { label: "Asistente contextual automatizado", status: "testing" },
    ],
  },
] as const satisfies readonly {
  code: string;
  name: string;
  monthlyCLP: number;
  description: string;
  features: readonly {
    label: string;
    shortLabel?: string;
    status: FeatureStatus;
    highlight?: boolean;
  }[];
}[];
export const comparison = [
  {
    label: "Publicación, rutas, solicitudes y registro manual de pagos",
    status: "available",
    included: [true, true, true],
  },
  {
    label: "Informes mensuales",
    status: "available",
    included: [false, true, true],
  },
  {
    label: "Informes avanzados y comparación con el mes anterior",
    status: "available",
    included: [false, false, true],
  },
  {
    label: "Tres tipos de exportación XLSX",
    status: "available",
    included: [false, false, true],
  },
  {
    label: "Asistente FAQ automatizado",
    status: "testing",
    included: [false, true, true],
  },
  {
    label: "Asistente contextual",
    status: "testing",
    included: [false, false, true],
  },
] as const;
export function formatCLP(value: number) {
  return `$${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value)}`;
}

export const parentAccess = { initialCLP: 0 } as const;
