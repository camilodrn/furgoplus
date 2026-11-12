import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ApiError, type AuthApi } from "./api";
import type { Publication } from "./api-types";
import { formatChileanDate } from "./dates";
import { ActionNotice, useActionFeedback } from "./ActionFeedback";

export type DriverDestination =
  | "profile"
  | "documents"
  | "validation"
  | "publication"
  | "routes"
  | "requests"
  | "roster"
  | "payments"
  | "help";
const blockers: Record<
  Publication["blockers"][number]["code"],
  [string, string, DriverDestination]
> = {
  account_inactive: [
    "Tu cuenta no está activa.",
    "Ver estado del servicio",
    "publication",
  ],
  driver_suspended: [
    "Tu servicio está suspendido.",
    "Ver estado del servicio",
    "publication",
  ],
  driver_deactivated: [
    "Tu servicio está desactivado.",
    "Ver estado del servicio",
    "publication",
  ],
  publication_not_requested: [
    "Aún no has pedido que tu servicio sea visible.",
    "Solicitar que mi servicio sea visible",
    "publication",
  ],
  validation_not_approved: [
    "Tu información todavía no está aprobada.",
    "Revisar mi validación",
    "validation",
  ],
  approved_revision_stale: [
    "Los cambios en tu información necesitan una nueva revisión.",
    "Revisar mi validación",
    "validation",
  ],
  required_document_missing: [
    "Falta un documento requerido vigente.",
    "Completar mis documentos",
    "documents",
  ],
  required_document_expired: [
    "Un documento requerido está vencido.",
    "Actualizar mis documentos",
    "documents",
  ],
  subscription_missing: [
    "Aún no tienes un plan asignado.",
    "Ver estado del plan",
    "publication",
  ],
  subscription_inactive: [
    "Tu plan no está activo.",
    "Ver estado del plan",
    "publication",
  ],
  subscription_suspended: [
    "Tu plan está suspendido.",
    "Ver estado del plan",
    "publication",
  ],
  subscription_not_started: [
    "Tu plan aún no comienza.",
    "Ver estado del plan",
    "publication",
  ],
  subscription_expired: [
    "Tu plan terminó.",
    "Ver estado del plan",
    "publication",
  ],
  profile_display_name_missing: [
    "Completa el nombre de tu servicio.",
    "Completar los datos de mi servicio",
    "profile",
  ],
  profile_summary_missing: [
    "Completa la descripción de tu servicio.",
    "Completar los datos de mi servicio",
    "profile",
  ],
  service_contact_email_missing: [
    "Completa el correo de contacto de tu servicio.",
    "Completar los datos de mi servicio",
    "profile",
  ],
  active_route_missing: [
    "Necesitas al menos una ruta activa y completa.",
    "Configurar una ruta",
    "routes",
  ],
};
export function publicationBlocker(item: Publication["blockers"][number]) {
  return (
    blockers[item.code]?.[0] ??
    "Hay un requisito pendiente. Actualiza el estado o revisa tu información."
  );
}
export function blockerAction(item: Publication["blockers"][number]) {
  return (
    blockers[item.code] ?? [
      publicationBlocker(item),
      "Revisar publicación",
      "publication",
    ]
  );
}
export function driverError(cause: unknown, area?: "route" | "assignment") {
  if (!(cause instanceof ApiError))
    return "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.";
  if (cause.code === "not_authenticated")
    return "La sesión caducó. Vuelve a iniciar sesión.";
  if (cause.code === "run_conflict" && area === "route")
    return "No puedes cambiar esta ruta porque el servicio de hoy ya comenzó. También se protege cuando ha finalizado.";
  if (cause.fields.seat_capacity && area === "assignment")
    return "Esta ruta no tiene cupos disponibles para esas fechas.";
  if (cause.code === "operation_conflict" && area === "assignment")
    return "No se pudo cambiar la asignación. El servicio de hoy puede haber comenzado o la fecha de término ya cambió. Actualiza y revisa las fechas; los cambios que afecten solo días futuros pueden permitirse.";
  if (cause.code === "driver_ineligible")
    return "No puedes aceptar mientras tu servicio no esté visible. Revisa validación, plan y rutas. Puedes rechazarla.";
  if (cause.status === 409)
    return "La información cambió. Actualiza antes de continuar.";
  return Object.values(cause.fields).flat().join(" ") || cause.message;
}

// Complements AuthApi's session generation. Local read ordering and unmount/expiry
// invalidation never replace the central identity-keyed workspace boundary.
export function useDriverResource<T>(
  api: AuthApi,
  read: () => Promise<T>,
  resetDraft: () => void = () => {},
  area?: "route" | "assignment",
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [actionError, setActionError] = useState("");
  const [errorAttempt, setErrorAttempt] = useState(0);
  const { show, clear, local } = useActionFeedback();
  const setError = useCallback(
    (message: string, title = "Revisa los datos antes de continuar") => {
      setActionError(message);
      if (message) {
        setErrorAttempt((attempt) => attempt + 1);
        // Local validation copy is static and contains no private form values.
        show({ kind: "error", title, message });
      } else clear();
    },
    [show, clear],
  );
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const reader = useRef(read),
    reset = useRef(resetDraft);
  reader.current = read;
  reset.current = resetDraft;
  const lifetime = useRef(0),
    reads = useRef(0),
    pending = useRef(false);
  const fail = useCallback(
    (
      cause: unknown,
      origin: "read" | "action",
      title = "No pudimos guardar los cambios",
    ) => {
      if (cause instanceof ApiError && cause.code === "stale_request") return;
      if (cause instanceof ApiError && cause.code === "not_authenticated") {
        lifetime.current += 1;
        reads.current += 1;
        pending.current = false;
        setBusy(false);
        setLoading(false);
        setData(null);
        setActionError("");
        setFields({});
        clear();
        reset.current();
        setReadError(driverError(cause, area));
        setRetryable(false);
        return;
      }
      if (origin === "read") {
        setReadError(
          cause instanceof ApiError
            ? driverError(cause, area)
            : "No pudimos cargar la información. Revisa tu conexión e inténtalo de nuevo.",
        );
        setRetryable(
          !(cause instanceof ApiError) ||
            cause.code === "request_timeout" ||
            cause.status >= 500,
        );
        return;
      }
      setFields(cause instanceof ApiError ? cause.fields : {});
      setActionError(driverError(cause, area));
      setErrorAttempt((attempt) => attempt + 1);
      // Never copy arbitrary server messages/fields or private drafts into a global notice.
      const message =
        cause instanceof ApiError &&
        cause.fields.seat_capacity &&
        area === "assignment"
          ? "Esta ruta no tiene cupos disponibles para esas fechas."
          : cause instanceof ApiError &&
              ((cause.code === "run_conflict" && area === "route") ||
                (cause.code === "operation_conflict" &&
                  area === "assignment") ||
                cause.code === "driver_ineligible")
            ? driverError(cause, area)
            : cause instanceof ApiError && cause.status === 409
              ? "La información cambió. Actualiza y revisa los datos antes de continuar."
              : !(cause instanceof ApiError) || cause.status >= 500
                ? "No se pudo confirmar la acción. Revisa tu conexión y actualiza la información antes de volver a guardar."
                : "Revisa los datos y las indicaciones de esta acción antes de continuar.";
      show({ kind: "error", title, message });
    },
    [area, clear, show],
  );
  const refresh = useCallback(async () => {
    const generation = ++reads.current,
      life = lifetime.current;
    setLoading(true);
    setReadError("");
    setRetryable(false);
    try {
      const result = await reader.current();
      if (generation === reads.current && life === lifetime.current)
        setData(result);
    } catch (cause) {
      if (generation === reads.current && life === lifetime.current)
        fail(cause, "read");
    } finally {
      if (generation === reads.current && life === lifetime.current)
        setLoading(false);
    }
  }, [fail]);
  useEffect(() => {
    void refresh();
    return () => {
      lifetime.current += 1;
      reads.current += 1;
    };
  }, [api, refresh]);
  async function mutate<R>(
    write: () => Promise<R>,
    saved: (result: R) => void,
    success: string,
    errorTitle: string,
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setFields({});
    setReadError("");
    const life = lifetime.current;
    reads.current += 1; // An older read cannot undo a confirmed write.
    setLoading(false);
    try {
      const result = await write();
      if (life !== lifetime.current) return;
      saved(result);
      if (success) show({ kind: "success", title: success });
      await refresh();
    } catch (cause) {
      if (life === lifetime.current) fail(cause, "action", errorTitle);
    } finally {
      if (life === lifetime.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return {
    data,
    loading,
    error: actionError || readError,
    readError,
    actionError,
    errorAttempt,
    retryable,
    localNotice: local,
    fields,
    busy,
    refresh,
    mutate,
    setError,
  };
}

export function DriverReadNotice({
  loading,
  readError,
  retryable,
  refresh,
  localNotice,
}: {
  loading: boolean;
  readError: string;
  retryable: boolean;
  refresh: () => Promise<void>;
  localNotice: ReturnType<typeof useActionFeedback>["local"];
}) {
  return (
    <>
      <ActionNotice feedback={localNotice} />
      {loading && <p role="status">Cargando información…</p>}
      {readError && (
        <div className="auth-notice notice-error" role="alert">
          <p>
            <span aria-hidden="true">! </span>
            {readError}
          </p>
          {retryable && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => void refresh()}
            >
              Reintentar
            </button>
          )}
        </div>
      )}
    </>
  );
}
// Keep the correction near the action. The global alert announces the result;
// this focusable region locates the preserved draft without a second live alert.
export function DriverActionError({
  actionError,
  errorAttempt,
  busy,
}: {
  actionError: string;
  errorAttempt: number;
  busy: boolean;
}) {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!actionError || busy || region.current?.closest("[hidden]")) return;
    region.current?.focus({ preventScroll: true });
    region.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [actionError, errorAttempt, busy]);
  return actionError ? (
    <div
      ref={region}
      tabIndex={-1}
      role="group"
      aria-labelledby={id}
      aria-describedby={`${id}-message`}
      className="action-context-error notice-error"
    >
      <strong id={id}>
        <span aria-hidden="true">! </span>Revisa esta acción
      </strong>
      <p id={`${id}-message`}>{actionError}</p>
      {actionError ===
        "Esta ruta no tiene cupos disponibles para esas fechas." && (
        <p>Prueba con otra ruta o cambia las fechas.</p>
      )}
    </div>
  ) : null;
}
export function FieldError({
  errors,
  name,
}: {
  errors: Record<string, string[]>;
  name: string;
}) {
  return errors[name] ? (
    <span id={`driver-${name}-error`} className="field-error">
      {errors[name]?.join(" ")}
    </span>
  ) : null;
}
export function CapacityText({
  route,
}: {
  route: {
    used_seats: number;
    available_seats: number;
    seat_capacity: number;
    next_service_date: string;
  };
}) {
  return (
    <div className="capacity-display">
      <p className="capacity-text">
        <strong>
          {route.used_seats} de {route.seat_capacity} cupos utilizados
        </strong>
        <br />
        {route.available_seats} cupos disponibles · Próximo servicio:{" "}
        {formatChileanDate(route.next_service_date)}
      </p>
      <meter
        className="capacity-meter"
        min={0}
        max={route.seat_capacity}
        value={route.used_seats}
        aria-label={`Cupos utilizados para el ${formatChileanDate(route.next_service_date)}`}
      >
        {route.used_seats} de {route.seat_capacity}
      </meter>
    </div>
  );
}
export function VisibilityStatus({
  publication,
}: {
  publication: Publication;
}) {
  return (
    <>
      <h3
        className={`publication-state ${publication.eligible ? "publication-visible" : ""}`}
      >
        {publication.eligible
          ? "Tu servicio está visible"
          : "Tu servicio aún no está visible"}
      </h3>
      <p>
        {publication.eligible
          ? "Los apoderados pueden encontrarte en FurgoPlus."
          : "Los apoderados aún no pueden encontrarte en FurgoPlus."}
      </p>
      {publication.publication_requested && !publication.eligible && (
        <p>
          Pediste que tu servicio sea visible, pero aún falta resolver lo
          siguiente.
        </p>
      )}
    </>
  );
}

export function ProductIcon({
  name,
  size = 28,
}: {
  name:
    | "home"
    | "check"
    | "route"
    | "people"
    | "message"
    | "payment"
    | "visible"
    | "waiting"
    | "reports"
    | "book"
    | "support";
  size?: number;
}) {
  const paths = {
    home: "M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9",
    check: "m5 12 4 4L19 6M3 3h18v18H3Z",
    reports: "M4 3h12l4 4v14H4ZM8 16v-3m4 3V9m4 7v-5",
    book: "M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z",
    support:
      "M8 8 5 5m11 3 3-3M8 16l-3 3m11-3 3 3M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
    route: "M4 6h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8M4 3v6m-3-3h6M16 19l3 3-3 1",
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
    message:
      "M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h7",
    payment: "M3 5h18v14H3ZM3 9h18M7 15h4",
    visible:
      "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    waiting: "M12 8v5m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  };
  return (
    <svg
      className="product-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// A nonmodal panel in document flow: ordinary keyboard navigation, explicit close,
// Escape and focus restoration. No overlay or custom focus trap.
export function FocusPanel({
  title,
  children,
  onClose,
  busy = false,
  showCloseButton = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  showCloseButton?: boolean;
}) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return (
    <section
      className="focus-panel"
      aria-labelledby={id}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented && !busy) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="publication-heading">
        <h3 id={id} ref={heading} tabIndex={-1}>
          {title}
        </h3>
        {showCloseButton && (
          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cerrar
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// Presentation groups only. Visibility and permissions stay on the server.
export function activationSteps(publication: Publication) {
  const dataCodes = [
    "required_document_missing",
    "required_document_expired",
    "profile_display_name_missing",
    "profile_summary_missing",
    "service_contact_email_missing",
  ];
  const groups = [
    {
      title: "Datos y documentos",
      matches: (code: string) => dataCodes.includes(code),
      confirmed: true,
      destination: "profile" as DriverDestination,
      action: "Completar datos del servicio",
    },
    {
      title: "Revisión del equipo",
      matches: (code: string) =>
        ["validation_not_approved", "approved_revision_stale"].includes(code),
      confirmed: publication.validation_state === "approved",
      destination: "validation" as DriverDestination,
      action: "Revisar validación",
    },
    {
      title: "Plan vigente",
      matches: (code: string) => code.startsWith("subscription_"),
      confirmed: publication.subscription?.status === "active",
      destination: "help" as DriverDestination,
      action: "Consultar plan con soporte",
    },
    {
      title: "Ruta y publicación",
      matches: (code: string) =>
        ["active_route_missing", "publication_not_requested"].includes(code),
      confirmed:
        publication.active_route_count > 0 && publication.publication_requested,
      destination: "publication" as DriverDestination,
      action: "Solicitar que mi servicio sea visible",
    },
  ];
  return groups.map((group) => {
    const pending = publication.blockers.filter((item) =>
      group.matches(item.code),
    );
    return {
      ...group,
      pending,
      complete: publication.eligible || (!!group.confirmed && !pending.length),
    };
  });
}

export function ServiceAvailabilityNotice({
  publication,
  onNavigate,
}: {
  publication: Publication;
  onNavigate?: (destination: DriverDestination) => void;
}) {
  const reasons = publication.blockers.filter((item) =>
    ["account_inactive", "driver_suspended", "driver_deactivated"].includes(
      item.code,
    ),
  );
  // Preserve an explicit profile status even if a caller has no blocker details.
  if (!reasons.length && publication.profile_status === "active") return null;
  return (
    <section className="panel" aria-label="Estado de tu servicio">
      <h3>Estado de tu servicio</h3>
      {reasons.length ? (
        reasons.map((item) => <p key={item.code}>{publicationBlocker(item)}</p>)
      ) : (
        <p>
          {publication.profile_status === "suspended"
            ? "Tu servicio está suspendido."
            : "Tu servicio está desactivado."}
        </p>
      )}
      {onNavigate && (
        <button
          type="button"
          className="button button-outline"
          onClick={() => onNavigate("help")}
        >
          Consultar soporte
        </button>
      )}
    </section>
  );
}
