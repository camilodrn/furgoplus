// Keep HTML constraints without displaying browser-owned validation messages.
// Business rules and mutation results remain authoritative on the server.
export function validateForm(
  form: HTMLFormElement,
  showError: (message: string) => void,
): boolean {
  if (form.checkValidity()) return true;
  showError("Revisa los campos obligatorios y su formato.");
  const field = form.querySelector<HTMLElement>(
    "input:invalid, select:invalid, textarea:invalid",
  );
  requestAnimationFrame(() => {
    if (field?.isConnected && !field.closest("[hidden]")) field.focus();
  });
  return false;
}
