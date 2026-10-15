// Build-time flag; the dedicated hostname also protects a mismatched normal build.
export function isDemoMode(hostname = window.location.hostname): boolean {
  return (
    import.meta.env.VITE_FURGOPLUS_DEMO_MODE === "true" ||
    hostname === "demo.furgoplus.cl"
  );
}

export const demoRegistrationNotice =
  "Registro ilustrativo: esta demostración no crea cuentas. Los datos del formulario no se envían ni se guardan en la aplicación. Las cuentas ficticias las prepara el equipo.";
