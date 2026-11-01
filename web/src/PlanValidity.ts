// Presentation only: blockers/effective come from the server. This function
// never evaluates dates or grants capabilities/publication access.
export function planValidity(
  subscription: { status: string; effective?: boolean } | null,
  blockers: readonly string[],
) {
  if (!subscription || blockers.includes("subscription_missing"))
    return "Sin plan asignado";
  if (
    subscription.status === "suspended" ||
    blockers.includes("subscription_suspended")
  )
    return "Suspendido";
  if (
    subscription.status !== "active" ||
    blockers.includes("subscription_inactive")
  )
    return "Inactivo";
  if (blockers.includes("subscription_expired")) return "Vencido";
  if (blockers.includes("subscription_not_started")) return "Aún no comienza";
  if (
    subscription.effective === false ||
    blockers.some(
      (code) => code.startsWith("subscription_") || code === "plan_unknown",
    )
  )
    return "Vigencia no confirmada";
  return "Vigente";
}
