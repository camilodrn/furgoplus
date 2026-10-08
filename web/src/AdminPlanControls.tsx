import { useEffect, useRef, useState } from "react";
import { ApiError, AuthApi } from "./api";
import type { AdminSubscription, Plans, Publication } from "./api-types";
import {
  chileDateTimeParts,
  chileInstant,
  humanChileanDate,
  parseChileanDate,
} from "./dates";
import { ChileanDateField } from "./ChileanDateField";
import { ActionNotice, useActionFeedback } from "./ActionFeedback";
import {
  AdminBadge,
  AdminFocusPanel,
  AdminServiceSummary,
  adminError,
  adminLabels,
  adminRetryable,
  visibilityFeedback,
} from "./AdminExperience";

type Draft = {
  plan: "basic" | "pro" | "elite";
  status: "inactive" | "active" | "suspended";
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
  version: number | null;
};
type FieldErrors = Partial<
  Record<"startDate" | "startTime" | "endDate" | "endTime" | "reason", string>
>;
function draftFor(data: AdminSubscription): Draft {
  const sub = data.publication.subscription;
  const start = sub?.starts_at
    ? chileDateTimeParts(sub.starts_at)
    : { date: "", time: "00:00" };
  const end = sub?.ends_at
    ? chileDateTimeParts(sub.ends_at)
    : { date: "", time: "00:00" };
  return {
    plan: sub?.plan_code ?? "basic",
    status: sub?.status ?? "active",
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    reason: "",
    version: data.version,
  };
}
export function AdminPublicationScreen({
  api,
  driverId,
  driverName = "este conductor",
  refreshKey = 0,
  onChanged,
  onPublicationChange,
  showServiceSummary = true,
}: {
  api: AuthApi;
  driverId: number;
  driverName?: string;
  refreshKey?: number;
  onChanged?: () => void;
  onPublicationChange?: (publication: Publication) => void;
  showServiceSummary?: boolean;
}) {
  const [data, setData] = useState<AdminSubscription | null>(null);
  const [plans, setPlans] = useState<Plans | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmHidden, setConfirmHidden] = useState(false);
  const [readError, setReadError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const planTrigger = useRef<HTMLButtonElement>(null);
  const section = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const callbacks = useRef({ onChanged, onPublicationChange });
  callbacks.current = { onChanged, onPublicationChange };
  const feedback = useActionFeedback();
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current += 1;
    };
  }, []);
  function apply(current: AdminSubscription) {
    setData(current);
    callbacks.current.onPublicationChange?.(current.publication);
  }
  async function refresh() {
    const request = ++generation.current;
    setLoading(true);
    setReadError("");
    setRetryable(false);
    try {
      const [current, catalog] = await Promise.all([
        api.adminSubscription(driverId),
        api.plans(),
      ]);
      if (!alive.current || request !== generation.current) return;
      apply(current);
      setPlans(catalog);
      return true;
    } catch (cause) {
      if (!alive.current || request !== generation.current) return;
      setReadError(adminError(cause));
      setRetryable(adminRetryable(cause));
      if (cause instanceof ApiError && cause.code === "not_authenticated") {
        setData(null);
        setPlans(null);
        setDraft(null);
        setConfirmHidden(false);
        setError("");
        feedback.clear();
      }
    } finally {
      if (alive.current && request === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    // An explicit overall refresh cancels editing instead of adopting a newer
    // subscription version into an open draft. History pagination does not.
    setDraft(null);
    setConfirmHidden(false);
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [api, driverId, refreshKey]);
  function close() {
    setDraft(null);
    setConfirmHidden(false);
    setError("");
    setFieldErrors({});
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busyRef.current ||
      !draft ||
      (draft.status !== "active" && !confirmHidden)
    )
      return;
    const input = draft;
    const starts_at = chileInstant(input.startDate, input.startTime),
      ends_at = chileInstant(input.endDate, input.endTime);
    const invalid: FieldErrors = {};
    if (!parseChileanDate(input.startDate))
      invalid.startDate =
        "Ingresa una fecha de inicio válida en formato dd/mm/aaaa.";
    if (!input.startTime) invalid.startTime = "Ingresa la hora de inicio.";
    else if (!invalid.startDate && !starts_at)
      invalid.startTime =
        "Ingresa una hora de inicio válida en Chile. Los cambios de hora ambiguos no se aceptan.";
    if (!parseChileanDate(input.endDate))
      invalid.endDate =
        "Ingresa una fecha de término válida en formato dd/mm/aaaa.";
    if (!input.endTime) invalid.endTime = "Ingresa la hora de término.";
    else if (!invalid.endDate && !ends_at)
      invalid.endTime =
        "Ingresa una hora de término válida en Chile. Los cambios de hora ambiguos no se aceptan.";
    if (starts_at && ends_at && ends_at <= starts_at)
      invalid.endDate =
        "La fecha y hora de término deben ser posteriores al inicio.";
    if (!input.reason.trim())
      invalid.reason = "Ingresa el motivo del cambio de plan.";
    setFieldErrors(invalid);
    setError("");
    const firstInvalid = Object.keys(invalid)[0];
    if (firstInvalid) {
      const selector =
        firstInvalid === "startDate"
          ? "#subscription-start-date"
          : firstInvalid === "endDate"
            ? "#subscription-end-date"
            : `[data-plan-field="${firstInvalid}"]`;
      event.currentTarget.querySelector<HTMLElement>(selector)?.focus();
      return;
    }
    if (!starts_at || !ends_at) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    feedback.clear();
    // Reject prior reads before the write, in addition to AuthApi generations.
    generation.current += 1;
    try {
      const current = await api.changeSubscription(driverId, {
        plan_code: input.plan,
        status: input.status,
        starts_at,
        ends_at,
        reason: input.reason,
        expected_version: input.version,
      });
      if (!alive.current) return;
      apply(current);
      close();
      feedback.show({
        kind: "success",
        title: "Plan actualizado",
        message: visibilityFeedback(current.publication),
      });
      callbacks.current.onChanged?.();
      await refresh();
    } catch (cause) {
      if (
        !alive.current ||
        (cause instanceof ApiError && cause.code === "stale_request")
      )
        return;
      setError(adminError(cause));
      feedback.show({
        kind: "error",
        title: "No pudimos actualizar el plan",
        message:
          cause instanceof ApiError && cause.status === 409
            ? "Revisa el estado actual antes de volver a guardar."
            : "Revisa la información de esta acción.",
      });
      if (cause instanceof ApiError && cause.code === "not_authenticated") {
        setData(null);
        setPlans(null);
        close();
        feedback.clear();
      } else if (cause instanceof ApiError && cause.status === 409) {
        setDraft(null);
        setConfirmHidden(false);
        const updated = await refresh();
        if (alive.current) {
          setError(
            `${adminError(cause)} ${updated ? "Actualizamos los datos. Revisa el plan actual antes de abrir el editor de nuevo." : "No pudimos actualizar los datos del plan. Actualiza antes de volver a editar."}`,
          );
          callbacks.current.onChanged?.();
        }
      }
    } finally {
      if (alive.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  const sub = data?.publication.subscription;
  return (
    <section
      ref={section}
      tabIndex={-1}
      className="panel admin-plan"
      aria-label="Plan del conductor"
    >
      <ActionNotice feedback={feedback.local} />
      {showServiceSummary && data && (
        <AdminServiceSummary publication={data.publication} />
      )}
      <div className="admin-section-heading">
        <h2>Plan actual</h2>
        <button
          type="button"
          className="button button-quiet"
          disabled={busy || loading}
          onClick={() => {
            close();
            void refresh();
          }}
        >
          Actualizar plan
        </button>
      </div>
      {loading && <p role="status">Cargando plan…</p>}
      {readError && (
        <div role="alert">
          <p>{readError}</p>
          {retryable && (
            <button
              onClick={() => {
                close();
                void refresh();
              }}
            >
              Reintentar carga del plan
            </button>
          )}
        </div>
      )}
      {data && (
        <>
          {sub ? (
            <>
              <p className="admin-plan-name">{sub.plan_label}</p>
              <AdminBadge
                positive={
                  sub.status === "active" &&
                  !data.publication.blockers.some((item) =>
                    item.code.startsWith("subscription_"),
                  )
                }
              >
                {adminLabels[sub.status]}
              </AdminBadge>
              <p>
                {humanChileanDate(sub.starts_at)} →{" "}
                {humanChileanDate(sub.ends_at)}
              </p>
            </>
          ) : (
            <p>
              <strong>Sin plan asignado</strong>
            </p>
          )}
          <p className="helper-text">
            Sin un plan activo y vigente, el servicio no puede mostrarse a los
            apoderados.
          </p>
          <button
            ref={planTrigger}
            hidden={!!draft}
            className="button button-outline"
            disabled={busy || loading || !!readError || !plans}
            onClick={() => {
              setError("");
              setFieldErrors({});
              setConfirmHidden(false);
              setDraft(draftFor(data));
            }}
          >
            Administrar plan
          </button>
        </>
      )}
      {error && !draft && <p role="alert">{error}</p>}
      {draft && (
        <AdminFocusPanel
          title={`Administrar plan: ${driverName}`}
          busy={busy}
          onClose={close}
          restoreFocus={() => {
            if (
              planTrigger.current?.isConnected &&
              !planTrigger.current.hidden &&
              !planTrigger.current.disabled
            )
              planTrigger.current.focus({ preventScroll: true });
            else section.current?.focus({ preventScroll: true });
          }}
        >
          <p>
            Este cambio puede afectar inmediatamente la visibilidad del
            servicio.
          </p>
          <form
            noValidate
            className="admin-plan-form"
            onSubmit={(event) => void save(event)}
          >
            <fieldset disabled={busy}>
              <label>
                Plan
                <select
                  value={draft.plan}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      plan: event.target.value as Draft["plan"],
                    })
                  }
                >
                  {plans?.plans.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.display_label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado del plan
                <select
                  value={draft.status}
                  onChange={(event) => {
                    setDraft({
                      ...draft,
                      status: event.target.value as Draft["status"],
                    });
                    setConfirmHidden(false);
                  }}
                >
                  <option value="inactive">Inactivo</option>
                  <option value="active">Activo</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </label>
              {draft.status !== "active" && (
                <div className="admin-plan-consequence">
                  <p>
                    Al guardar el plan{" "}
                    {draft.status === "suspended" ? "suspendido" : "inactivo"},
                    el servicio dejará de aparecer para los apoderados.
                  </p>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={confirmHidden}
                      onChange={(event) =>
                        setConfirmHidden(event.target.checked)
                      }
                    />
                    Confirmo que este plan dejará de habilitar la visibilidad
                  </label>
                </div>
              )}
              <p className="admin-form-wide">
                El período usa la fecha y hora de Chile. Reactivar un plan solo
                permite mostrar el servicio si cumple todos los demás
                requisitos.
              </p>
              <ChileanDateField
                id="subscription-start-date"
                label="Fecha de inicio"
                value={draft.startDate}
                error={
                  !!fieldErrors.startDate ||
                  (!!draft.startDate && !parseChileanDate(draft.startDate))
                }
                errorMessage={fieldErrors.startDate}
                required
                onChange={(startDate) => setDraft({ ...draft, startDate })}
              />
              <label>
                Hora de inicio
                <input
                  type="time"
                  lang="es-CL"
                  step="60"
                  value={draft.startTime}
                  data-plan-field="startTime"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.startTime}
                  aria-describedby={
                    fieldErrors.startTime ? "plan-start-time-error" : undefined
                  }
                  onChange={(event) =>
                    setDraft({ ...draft, startTime: event.target.value })
                  }
                />
                {fieldErrors.startTime && (
                  <span
                    id="plan-start-time-error"
                    className="field-error"
                    role="alert"
                  >
                    {fieldErrors.startTime}
                  </span>
                )}
              </label>
              <ChileanDateField
                id="subscription-end-date"
                label="Fecha de término"
                value={draft.endDate}
                error={
                  !!fieldErrors.endDate ||
                  (!!draft.endDate && !parseChileanDate(draft.endDate))
                }
                errorMessage={fieldErrors.endDate}
                required
                onChange={(endDate) => setDraft({ ...draft, endDate })}
              />
              <label>
                Hora de término
                <input
                  type="time"
                  lang="es-CL"
                  step="60"
                  value={draft.endTime}
                  data-plan-field="endTime"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.endTime}
                  aria-describedby={
                    fieldErrors.endTime ? "plan-end-time-error" : undefined
                  }
                  onChange={(event) =>
                    setDraft({ ...draft, endTime: event.target.value })
                  }
                />
                {fieldErrors.endTime && (
                  <span
                    id="plan-end-time-error"
                    className="field-error"
                    role="alert"
                  >
                    {fieldErrors.endTime}
                  </span>
                )}
              </label>
              <p className="admin-form-wide helper-text">
                El plan deja de estar vigente al llegar la fecha y hora de
                término.
              </p>
              <label className="admin-form-wide">
                Motivo
                <textarea
                  value={draft.reason}
                  data-plan-field="reason"
                  aria-required="true"
                  aria-invalid={!!fieldErrors.reason}
                  aria-describedby={
                    fieldErrors.reason ? "plan-reason-error" : undefined
                  }
                  maxLength={1000}
                  onChange={(event) =>
                    setDraft({ ...draft, reason: event.target.value })
                  }
                />
                {fieldErrors.reason && (
                  <span
                    id="plan-reason-error"
                    className="field-error"
                    role="alert"
                  >
                    {fieldErrors.reason}
                  </span>
                )}
              </label>
              {error && (
                <p className="admin-form-wide" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-primary admin-form-wide"
                disabled={busy || (draft.status !== "active" && !confirmHidden)}
              >
                {busy ? "Guardando…" : "Guardar plan"}
              </button>
            </fieldset>
          </form>
        </AdminFocusPanel>
      )}
    </section>
  );
}
