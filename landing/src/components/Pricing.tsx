import { Icon } from "./Icons";
import {
  comparison,
  formatCLP,
  IVA_PERCENT,
  plans,
  parentAccess,
  priceBreakdown,
  STATUS_LABELS,
} from "../content/plans";

export function PricingView({
  showBreakdown,
  onChange,
}: {
  showBreakdown: boolean;
  onChange: (showBreakdown: boolean) => void;
}) {
  return (
    <div
      className="pricing-view"
      role="group"
      aria-label="Opciones de IVA"
      aria-describedby="pricing-academic-note"
    >
      <button
        type="button"
        aria-pressed={!showBreakdown}
        aria-controls="pricing-cards"
        onClick={() => onChange(false)}
      >
        IVA incluido
      </button>
      <button
        type="button"
        aria-pressed={showBreakdown}
        aria-controls="pricing-cards"
        onClick={() => onChange(true)}
      >
        Desglose
      </button>
    </div>
  );
}

export function Pricing({
  showBreakdown = false,
}: {
  showBreakdown?: boolean;
}) {
  return (
    <>
      <p className="sr-only" role="status" aria-atomic="true">
        {showBreakdown
          ? "Desglose visible: valor neto e IVA en cada plan. El precio total se mantiene."
          : "Vista de precio final con IVA incluido. El precio total se mantiene."}
      </p>
      <div className="plans-grid" id="pricing-cards">
        {plans.map((plan, i) => {
          const price = priceBreakdown(plan.monthlyCLP);
          return (
            <article
              className={`plan plan-${plan.code}`}
              key={plan.code}
              aria-labelledby={`plan-${plan.code}`}
              aria-describedby="pricing-academic-note"
            >
              <div className="plan-header">
                <span className="plan-index" aria-hidden="true">0{i + 1}</span>
                <span className="plan-label">
                  {plan.code === "basic" ? "Gestión base" : "MVP académico"}
                </span>
              </div>
              <h3 id={`plan-${plan.code}`}>{plan.name}</h3>
              <p className="plan-description">{plan.description}</p>
              <p className="sr-only plan-total-label">Total con IVA incluido</p>
              <p className="plan-price">
                {formatCLP(price.totalCLP)}
                <span>CLP / mes</span>
              </p>
              {showBreakdown && (
                <dl
                  className="plan-breakdown"
                  aria-label={`Desglose de ${plan.name}`}
                >
                  <div>
                    <dt>Valor neto</dt>
                    <dd>{formatCLP(price.netCLP)} CLP</dd>
                  </div>
                  <div>
                    <dt>IVA ({IVA_PERCENT} %)</dt>
                    <dd>{formatCLP(price.ivaCLP)} CLP</dd>
                  </div>
                </dl>
              )}
              <div className="plan-features">
                <ul aria-label={`Funciones destacadas de ${plan.name}`}>
                  {plan.features
                    .filter(
                      (feature) => "highlight" in feature && feature.highlight,
                    )
                    .map((feature) => (
                      <li
                        className={`pricing-feature ${feature.status}`}
                        key={feature.label}
                      >
                        <Icon
                          name={
                            feature.status === "available" ? "check" : "plus"
                          }
                          size={18}
                        />
                        <span>
                          {"shortLabel" in feature
                            ? feature.shortLabel
                            : feature.label}
                          <small
                            className={
                              feature.status === "available"
                                ? "sr-only"
                                : "feature-status"
                            }
                          >
                            {" · "}
                            {STATUS_LABELS[feature.status]}
                          </small>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
      <p className="pricing-caption" id="pricing-academic-note" role="note">
        Propuesta académica · Precios referenciales con IVA, sin contratación
        habilitada.
        <span className="pricing-current-scope">
          Informes mensuales desde Pro; informes avanzados y archivos XLSX en
          Elite. Asistentes experimentales, sin servicio comercial disponible.
        </span>
      </p>
      <div className="parent-pricing">
        <span className="parent-price-icon">
          <Icon name="home" size={23} />
        </span>
        <div>
          <span className="overline">PARA LAS FAMILIAS</span>
          <h3>Acceso inicial gratuito para apoderados.</h3>
          <p>Sin inscripciones abiertas.</p>
        </div>
        <span className="parent-price-tag">
          {formatCLP(parentAccess.initialCLP)}{" "}
          <small>CLP / acceso inicial</small>
        </span>
      </div>
      <details className="comparison-details">
        <summary>
          Comparar funciones y condiciones
          <span>
            <Icon name="plus" size={18} />
          </span>
        </summary>
        <div
          className="comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Comparación de planes, desplazable horizontalmente"
        >
          <table>
            <caption>
              Capacidades por plan en el MVP académico T12, sin disponibilidad
              comercial.
            </caption>
            <thead>
              <tr>
                <th scope="col">Capacidad</th>
                {plans.map((plan) => (
                  <th key={plan.code} scope="col">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <th scope="row">
                    {row.label}
                    <span className={`maturity ${row.status}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </th>
                  {row.included.map((included, i) => (
                    <td key={i}>
                      {included ? (
                        <>
                          <Icon
                            name={row.status === "available" ? "check" : "plus"}
                            size={16}
                          />
                          <span className="sr-only">
                            {STATUS_LABELS[row.status]}
                          </span>
                        </>
                      ) : (
                        <span aria-label="No contemplado en este plan">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="comparison-footnote">
          Elite compara con el mes anterior y exporta tres tipos de XLSX: pagos
          manuales, recorridos/cupos y solicitudes de contacto; no es un cupo de
          tres descargas al mes. Básico no incluye informes mensuales.
        </p>
        <div className="maturity-note">
          <p>
            <strong>Implementado en MVP académico:</strong> gestión base común,
            informes mensuales en Pro y Elite, e informes avanzados y XLSX en Elite,
            con activación manual y permisos sujetos a perfil y vigencia.
            Publicar requiere revisión interna,
            documentos vigentes y los demás requisitos de elegibilidad; no
            implica lanzamiento comercial.
          </p>
          <p>
            <strong>Experimental:</strong> T12 implementa permisos y lógica de
            asistente FAQ en Pro y Elite, y contextual en Elite; su integración y
            UX siguen pendientes de cierre. Son automatizados, basados en reglas
            y contenido revisado.
          </p>
          <p>
            <strong>Disponibilidad comercial futura:</strong> no habilitada,
            sin fecha confirmada. La implementación académica no implica un
            servicio comercial disponible.
          </p>
          <p>
            Seguridad y accesibilidad son transversales. La revisión interna no
            certifica permisos, seguros ni seguridad del transporte.
          </p>
        </div>
      </details>
    </>
  );
}
