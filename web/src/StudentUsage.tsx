import type { DriverCapabilities } from "./api-types";

export function StudentUsage({
  usage,
}: {
  usage: DriverCapabilities["student_usage"] | undefined;
}) {
  if (!usage) return null;
  const { active, limit, available, plan_label: plan } = usage;
  return (
    <div aria-live="polite">
      <p>
        Estudiantes activos:{" "}
        <strong>{limit === null ? active : `${active} de ${limit}`}</strong>
        {available !== null && <> · Disponibles: {available}</>}
      </p>
      {limit !== null && active >= limit && (
        <p className="helper-text">
          {active > limit
            ? `Superas el máximo de estudiantes de tu plan ${plan}. Puedes conservar y actualizar las asignaciones existentes.`
            : `Has alcanzado el máximo de estudiantes de tu plan ${plan}.`}
        </p>
      )}
    </div>
  );
}
