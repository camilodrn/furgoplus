import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "./api";
import type { Publication } from "./api-types";
import { planValidity } from "./PlanValidity";
import { useModal } from "./useModal";

export const adminLabels = {
  active: "Activo",
  suspended: "Suspendido",
  deactivated: "Desactivado",
  draft: "Sin enviar",
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Con observaciones",
  superseded: "Reemplazada por cambios",
  inactive: "Inactivo",
  missing: "Sin plan",
  eligible: "Visible",
  blocked: "No visible",
  basic: "Basic",
  pro: "Pro",
  elite: "Elite",
};
export const profileExplanation = {
  active: "El conductor puede operar según el resto de sus requisitos.",
  suspended:
    "El perfil está temporalmente suspendido y no aparece para apoderados.",
  deactivated: "El perfil está desactivado y no aparece para apoderados.",
};
export const profileActions = {
  active: "Reactivar perfil",
  suspended: "Suspender perfil",
  deactivated: "Desactivar perfil",
};
export const profileResults = {
  active: "Perfil reactivado",
  suspended: "Perfil suspendido",
  deactivated: "Perfil desactivado",
};
const blockerLabels: Record<Publication["blockers"][number]["code"], string> = {
  account_inactive: "La cuenta del conductor no está activa.",
  driver_suspended: "El perfil está suspendido.",
  driver_deactivated: "El perfil está desactivado.",
  publication_not_requested:
    "El conductor aún no ha solicitado la publicación.",
  validation_not_approved: "La validación aún no está aprobada.",
  approved_revision_stale:
    "Los cambios del servicio necesitan una nueva revisión.",
  required_document_missing: "Falta un documento requerido vigente.",
  required_document_expired: "Un documento requerido está vencido.",
  subscription_missing: "Falta un plan activo.",
  subscription_inactive: "El plan está inactivo.",
  subscription_suspended: "El plan está suspendido.",
  subscription_not_started: "El período del plan aún no comienza.",
  subscription_expired: "El período del plan terminó.",
  profile_display_name_missing: "Falta el nombre del servicio.",
  profile_summary_missing: "Falta la descripción del servicio.",
  service_contact_email_missing: "Falta el correo de contacto del servicio.",
  active_route_missing: "Falta una ruta activa y completa.",
};
export function adminBlocker(item: Publication["blockers"][number]) {
  return blockerLabels[item.code] ?? "Hay un requisito pendiente por revisar.";
}
export function adminError(cause: unknown) {
  if (!(cause instanceof ApiError))
    return "No pudimos obtener una respuesta. Revisa tu conexión.";
  if (cause.code === "not_authenticated")
    return "La sesión caducó. Vuelve a iniciar sesión.";
  if (cause.code === "stale_request") return "";
  if (cause.status === 403) return "Tu sesión no permite esta acción.";
  if (cause.status === 409)
    return "El estado de este conductor cambió mientras revisabas la información.";
  return (
    Object.values(cause.fields).flat().join(" ") ||
    "No pudimos completar la solicitud. Revisa la información."
  );
}
export function adminRetryable(cause: unknown) {
  return !(cause instanceof ApiError) || cause.status >= 500;
}
export function visibilityFeedback(publication: Publication) {
  return publication.eligible
    ? "El servicio está visible para los apoderados."
    : "El servicio no está visible para los apoderados.";
}
export function AdminBadge({
  children,
  positive = false,
  danger = false,
  neutral = false,
}: {
  children: React.ReactNode;
  positive?: boolean;
  danger?: boolean;
  neutral?: boolean;
}) {
  return (
    <span
      className={`admin-badge ${positive ? "is-positive" : danger ? "is-danger" : neutral ? "is-neutral" : "is-warning"}`}
    >
      <span aria-hidden="true">{positive ? "✓" : neutral ? "·" : "!"}</span>{" "}
      {children}
    </span>
  );
}
export function AdminStatusBadges({
  publication: p,
}: {
  publication: Publication;
}) {
  const validity = planValidity(
    p.subscription,
    p.blockers.map((item) => item.code),
  );
  return (
    <div className="admin-status-badges">
      <AdminBadge
        positive={p.profile_status === "active"}
        danger={p.profile_status === "deactivated"}
      >
        Perfil: {adminLabels[p.profile_status]}
      </AdminBadge>
      <AdminBadge
        positive={p.validation_state === "approved"}
        neutral={p.validation_state === "pending"}
      >
        Validación: {adminLabels[p.validation_state]}
      </AdminBadge>
      <AdminBadge positive={p.eligible}>
        Visibilidad: {p.eligible ? "Visible" : "No visible"}
      </AdminBadge>
      <AdminBadge positive={validity === "Vigente"}>
        Plan:{" "}
        {p.subscription
          ? `${p.subscription.plan_label} · ${validity}`
          : "Sin plan asignado"}
      </AdminBadge>
    </div>
  );
}
export function AdminServiceSummary({
  publication: p,
}: {
  publication: Publication;
}) {
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const blockersId = useId();
  const blockerSet = JSON.stringify(p.blockers);
  const expanded = expandedFor === blockerSet;
  const visibleBlockers = expanded ? p.blockers : p.blockers.slice(0, 3);
  return (
    <section
      className="panel admin-service-summary"
      aria-label="Estado del servicio"
    >
      <h2>Estado del servicio</h2>
      <p
        className={`admin-visibility ${p.eligible ? "is-positive" : "is-warning"}`}
      >
        <span aria-hidden="true">{p.eligible ? "✓" : "!"}</span>{" "}
        {p.eligible ? "Visible para apoderados" : "No visible para apoderados"}
      </p>
      {p.eligible ? (
        <p>Los apoderados pueden encontrar este servicio.</p>
      ) : (
        <div className="admin-blockers">
          {p.blockers.length > 0 && (
            <p>
              Faltan {p.blockers.length}{" "}
              {p.blockers.length === 1 ? "requisito" : "requisitos"}.
            </p>
          )}
          <p>
            <strong>
              {p.blockers[0]
                ? adminBlocker(p.blockers[0])
                : "Revisa los requisitos pendientes del servicio."}
            </strong>
          </p>
          {p.blockers.length > 1 && (
            <ul id={blockersId}>
              {visibleBlockers.slice(1).map((item) => (
                <li key={item.code}>{adminBlocker(item)}</li>
              ))}
            </ul>
          )}
          {p.blockers.length > 3 && (
            <button
              type="button"
              className="button button-quiet"
              aria-expanded={expanded}
              aria-controls={blockersId}
              onClick={() => setExpandedFor(expanded ? null : blockerSet)}
            >
              {expanded
                ? "Ocultar requisitos"
                : p.blockers.length === 4
                  ? "Ver el requisito restante"
                  : `Ver los ${p.blockers.length - 3} requisitos restantes`}
            </button>
          )}
        </div>
      )}
      <dl className="admin-facts">
        <div>
          <dt>Perfil</dt>
          <dd>{adminLabels[p.profile_status]}</dd>
        </div>
        <div>
          <dt>Validación</dt>
          <dd>{adminLabels[p.validation_state]}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>
            {p.subscription
              ? `${p.subscription.plan_label} · ${planValidity(
                  p.subscription,
                  p.blockers.map((item) => item.code),
                )}`
              : "Sin plan asignado"}
          </dd>
        </div>
        <div>
          <dt>Publicación solicitada</dt>
          <dd>{p.publication_requested ? "Sí" : "No"}</dd>
        </div>
        <div>
          <dt>Rutas activas completas</dt>
          <dd>{p.active_route_count}</dd>
        </div>
        <div>
          <dt>Cobertura</dt>
          <dd>
            {p.coverage.map((item) => item.display_name).join(", ") ||
              "Sin cobertura"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
// Native modal keeps editors out of page flow and makes the background inert.
// Focus returns only if its trigger survives the authoritative refresh.
export function AdminFocusPanel({
  title,
  children,
  onClose,
  busy = false,
  confirmation = false,
  restoreFocus,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  confirmation?: boolean;
  restoreFocus?: () => void;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useModal(true, restoreFocus);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <dialog
      ref={dialog}
      className="admin-focus-panel"
      role={confirmation ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && !busy) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
        if (event.key === "Tab") {
          const controls = Array.from(
            dialog.current!.querySelectorAll<HTMLElement>("*"),
          ).filter(
            (element) =>
              element.tabIndex >= 0 &&
              !element.matches(":disabled") &&
              !element.closest('[hidden], input[type="hidden"]'),
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === heading.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <h3 id={id} tabIndex={-1} ref={heading}>
        {title}
      </h3>
      {children}
      <button
        type="button"
        className="button button-outline"
        disabled={busy}
        onClick={onClose}
      >
        {confirmation ? "Cancelar cambio" : "Cerrar"}
      </button>
    </dialog>
  );
}
