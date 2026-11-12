/* Entirely synthetic. No API, storage, analytics, or external requests. */
window.FurgoDemo = (() => {
  const first = [
    "Emilia",
    "Mateo",
    "Sofía",
    "Lucas",
    "Isidora",
    "Benjamín",
    "Antonia",
    "Tomás",
    "Florencia",
    "Joaquín",
    "Martina",
    "Gabriel",
    "Julieta",
    "Agustín",
    "Trinidad",
    "Vicente",
  ];
  const last = [
    "Ríos",
    "Lagos",
    "Vega",
    "Soto",
    "Prado",
    "Vidal",
    "Rojas",
    "León",
    "Paz",
    "Mora",
    "Silva",
    "Díaz",
  ];
  const guardians = [
    "Andrea",
    "Diego",
    "Camila",
    "Daniel",
    "Paula",
    "Felipe",
    "Carolina",
    "Pablo",
  ];
  const baseRoutes = [
    {
      id: 1,
      name: "Mañana · Los Aromos",
      time: "07:15",
      end: "08:00",
      capacity: 12,
      used: 8,
      destination: "Colegio Los Aromos",
      address: "Pasaje de Ejemplo 120",
      commune: "La Florida",
      status: "Activa",
    },
    {
      id: 2,
      name: "Mañana · El Arrayán",
      time: "07:30",
      end: "08:15",
      capacity: 10,
      used: 10,
      destination: "Escuela El Arrayán",
      address: "Avenida de Prueba 240",
      commune: "Puente Alto",
      status: "Activa",
    },
    {
      id: 3,
      name: "Tarde · Los Aromos",
      time: "16:00",
      end: "16:45",
      capacity: 14,
      used: 6,
      destination: "Colegio Los Aromos",
      address: "Pasaje de Ejemplo 120",
      commune: "La Florida",
      status: "Activa",
    },
  ];
  function makeData(mode = "normal") {
    const routes = baseRoutes.map((x) => ({ ...x }));
    if (mode === "muchos")
      for (let i = 4; i <= 12; i++)
        routes.push({
          id: i,
          name: `${i % 2 ? "Tarde" : "Mañana"} · Ruta ${i}`,
          time: i % 2 ? "16:15" : "07:00",
          end: i % 2 ? "17:00" : "07:45",
          capacity: 14,
          used: 8 + (i % 5),
          destination: `Colegio de Ejemplo ${i}`,
          address: `Calle Sintética ${i * 100}`,
          commune: i % 2 ? "La Florida" : "Puente Alto",
          status: "Activa",
        });
    let id = 1;
    const passengers = [];
    for (const route of routes)
      for (let i = 0; i < (mode === "vacio" ? 0 : route.used); i++) {
        const n = id++;
        passengers.push({
          id: n,
          name: `${first[(n - 1) % first.length]} ${last[Math.floor((n - 1) / first.length) % last.length]}`,
          guardian: `${guardians[(n - 1) % guardians.length]} ${last[n % last.length]}`,
          phone: "+56 9 0000 0000",
          route: route.id,
          pickup: `Acceso de ejemplo ${n}, esperar junto al portón.`,
          start: "2026-10-01",
          end: "2026-12-31",
          status: "Vigente",
        });
      }
    for (const route of routes)
      route.used = passengers.filter((p) => p.route === route.id).length;
    if (mode !== "vacio") {
      passengers.push({
        id: id++,
        name: "Amanda Lagos",
        guardian: "Paula Lagos",
        phone: "+56 9 0000 0000",
        route: 3,
        pickup: "Punto de ejemplo",
        start: "2026-11-10",
        end: "2026-12-31",
        status: "Futura",
      });
      passengers.push({
        id: id++,
        name: "Nicolás Vega",
        guardian: "Pablo Vega",
        phone: "+56 9 0000 0000",
        route: 3,
        pickup: "Punto de ejemplo",
        start: "2026-10-01",
        end: "2026-10-30",
        status: "Finalizada",
      });
    }
    const payments = passengers
      .filter((p) => p.status === "Vigente")
      .map((p, i) => ({
        id: 501 + i,
        assignment: p.id,
        amount: 70000 + (i % 4) * 5000,
        status: i % 6 < 3 ? "paid" : i % 6 === 5 ? "void" : "pending",
        start: "2026-11-01",
        end: "2026-11-30",
        due: "2026-11-05",
      }));
    const requests =
      mode === "vacio"
        ? []
        : [
            {
              id: 101,
              name: "Andrea Vega",
              status: "pending",
              date: "04 nov · 08:10",
              message:
                "Hola, busco traslado para la jornada de mañana hacia Los Aromos. ¿Podemos coordinar los horarios?",
              email: "familia.vega@example.test",
            },
            {
              id: 102,
              name: "Pablo Ríos",
              status: "pending",
              date: "03 nov · 18:40",
              message:
                "Me gustaría conocer la cobertura del servicio para La Florida.",
              email: "familia.rios@example.test",
            },
            {
              id: 103,
              name: "Camila Prado",
              status: "accepted",
              date: "02 nov · 12:15",
              message: "Necesitamos coordinar el regreso de la tarde.",
              email: "familia.prado@example.test",
            },
            {
              id: 104,
              name: "Daniel Soto",
              status: "declined",
              date: "01 nov · 09:20",
              message: "Consulta por traslado fuera de la cobertura.",
              email: "familia.soto@example.test",
            },
          ];
    if (mode === "muchos")
      for (let i = 5; i <= 38; i++)
        requests.push({
          id: 100 + i,
          name: `${guardians[i % 8]} ${last[i % 12]}`,
          status: i % 3 ? "pending" : "accepted",
          date: "02 nov · 10:00",
          message: "Quisiera coordinar un traslado escolar.",
          email: `familia${i}@example.test`,
        });
    return { routes, passengers, payments, requests };
  }
  return { makeData, baseRoutes };
})();
