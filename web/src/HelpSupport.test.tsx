import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ApiError, AuthApi } from "./api";
import { HelpSupport } from "./HelpSupport";
import type { AssistantAnswer, HelpCenter, SupportTicket } from "./api-types";

const help: HelpCenter = {
  version: "2026-10-19.1",
  service_notice: "Sin garantía de servidor ni atención humana inmediata 24/7.",
  privacy_notice: "No envíes datos de menores, documentos ni pagos privados.",
  assistant_modes: ["faq", "contextual"],
  articles: [
    {
      id: "plans",
      title: "Vigencia y planes",
      category: "Planes",
      role: "driver",
      body: "La suscripción requiere vigencia activa.",
    },
    {
      id: "support",
      title: "Soporte",
      category: "Ayuda",
      role: "all",
      body: "La gravedad precede al plan.",
    },
  ],
};
const ticket: SupportTicket = {
  id: 8,
  subject: "Consulta general",
  severity: 3,
  state: "open",
  priority: "priority",
  priority_at_creation: "priority",
  version: 1,
  created_at: "2026-10-19T12:00:00Z",
  updated_at: "2026-10-19T12:00:00Z",
  allowed_transitions: ["in_progress", "waiting_user", "resolved"],
  events: [
    {
      id: 1,
      author_id: 4,
      author_role: "driver",
      body: "Necesito orientación",
      from_state: "",
      to_state: "open",
      reason: "",
      occurred_at: "2026-10-19T12:00:00Z",
    },
  ],
};
const answer: AssistantAnswer = {
  answer: "La suscripción requiere vigencia activa.",
  article_id: "plans",
  context: [],
  can_offer_ticket: true,
  kind: "rules_and_content",
  content_version: help.version,
};
function setup(
  overrides: Partial<AuthApi> = {},
  admin = false,
  driver = false,
) {
  const api = {
    helpCenter: vi.fn().mockResolvedValue(structuredClone(help)),
    supportTickets: vi.fn().mockResolvedValue({ count: 1, results: [ticket] }),
    supportTicket: vi.fn().mockResolvedValue(structuredClone(ticket)),
    createSupportTicket: vi.fn().mockResolvedValue(structuredClone(ticket)),
    replySupportTicket: vi.fn().mockResolvedValue({ ...ticket, version: 2 }),
    updateSupportTicket: vi
      .fn()
      .mockResolvedValue({ ...ticket, state: "waiting_user", version: 2 }),
    askAssistant: vi.fn().mockResolvedValue(structuredClone(answer)),
    ...overrides,
  };
  render(
    <HelpSupport
      api={api as unknown as AuthApi}
      admin={admin}
      driver={driver}
    />,
  );
  return api;
}
async function ready() {
  const panel = screen.queryByRole("button", { name: "Panel de soporte" });
  if (panel?.getAttribute("aria-current") === "page") {
    await screen.findByRole("heading", { name: "Cola de soporte" });
  } else {
    await screen.findByText(/Contenido revisado/);
  }
}
async function tickets() {
  fireEvent.click(
    screen.getByRole("button", {
      name: /Consultas de soporte|Panel de soporte/,
    }),
  );
  await screen.findByRole("button", { name: /#8/ });
}
async function assistant() {
  fireEvent.click(
    screen.getByRole("button", { name: "Asistente automatizado" }),
  );
  await screen.findByRole("button", { name: "Consultar asistente" });
}
function ask(question = "planes") {
  fireEvent.change(screen.getByLabelText("Pregunta"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: "Consultar asistente" }));
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("versioned help has a compact labeled category selector and service notice", async () => {
  setup();
  await ready();
  const filter = screen.getByRole("combobox", {
    name: "Tema de ayuda",
  }) as HTMLSelectElement;
  expect(filter.value).toBe("Planes");
  expect(screen.getByRole("option", { name: "Todos los temas" })).toBeTruthy();
  expect(document.getElementById("help-plans")?.textContent).toContain(
    "La suscripción requiere",
  );
  expect(screen.getByText(/Sin garantía/)).toBeTruthy();
  expect(
    screen.queryByRole("navigation", { name: "Índice de guías" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Actualizar ayuda" })).toBeNull();
});

test("basic or suspended account retains help and tickets but cannot ask assistant", async () => {
  const api = setup({
    helpCenter: vi.fn().mockResolvedValue({ ...help, assistant_modes: [] }),
  });
  await ready();
  expect(screen.getByText("No disponible con tu acceso actual.")).toBeTruthy();
  expect(
    screen.queryByText("Haz una pregunta y recibe orientación automática."),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Asistente automatizado" }),
  );
  expect(await screen.findByText(/requiere Pro o Elite vigentes/)).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Sobre el asistente" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Conversa con el asistente" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Consultar asistente" }),
  ).toBeNull();
  expect(api.askAssistant).not.toHaveBeenCalled();
  await tickets();
  expect(api.supportTickets).toHaveBeenCalledWith(false, 0);
});

test("ticket creation requires explicit confirmation and prevents double submission", async () => {
  const api = setup();
  await ready();
  await tickets();
  fireEvent.click(
    screen.getByRole("button", { name: "Crear consulta de soporte" }),
  );
  const send = screen.getByRole("button", {
    name: "Confirmar y enviar consulta",
  }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Asunto"), {
    target: { value: "Consulta general" },
  });
  fireEvent.change(screen.getByLabelText("Describe el problema"), {
    target: { value: "Necesito ayuda" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(send);
  fireEvent.click(send);
  await screen.findByText(/Consulta enviada/);
  expect(api.createSupportTicket).toHaveBeenCalledTimes(1);
  expect(api.createSupportTicket).toHaveBeenCalledWith({
    subject: "Consulta general",
    body: "Necesito ayuda",
    severity: 3,
    privacy_confirmed: true,
  });
  expect(
    screen.getByRole("article", { name: "Historial de soporte" }).textContent,
  ).toContain("19 oct 2026 · 09:00");
});

test("editing content resets privacy consent and cancel sends nothing", async () => {
  const api = setup();
  await ready();
  await tickets();
  fireEvent.click(
    screen.getByRole("button", { name: "Crear consulta de soporte" }),
  );
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Describe el problema"), {
    target: { value: "Nuevo texto" },
  });
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(api.createSupportTicket).not.toHaveBeenCalled();
});

test("driver reads administrative answer and responds with current version", async () => {
  const withReply = {
    ...ticket,
    state: "waiting_user",
    version: 2,
    events: [
      ...ticket.events,
      {
        ...ticket.events[0]!,
        id: 2,
        author_id: 9,
        author_role: "admin",
        body: "Respuesta del administrador",
        from_state: "open",
        to_state: "waiting_user",
        reason: "Revisión",
      },
    ],
  } as SupportTicket;
  const api = setup({ supportTicket: vi.fn().mockResolvedValue(withReply) });
  await ready();
  await tickets();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByText("Respuesta del administrador");
  expect(screen.getByText("Soporte", { selector: "strong" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Respuesta"), {
    target: { value: "Gracias por responder" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
  await waitFor(() =>
    expect(api.replySupportTicket).toHaveBeenCalledWith(8, {
      body: "Gracias por responder",
      expected_version: 2,
    }),
  );
});

test("administrator responds and transitions with required reason", async () => {
  const api = setup({}, true);
  await ready();
  await tickets();
  expect(api.supportTickets).toHaveBeenCalledWith(true, 0, "active");
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByLabelText("Respuesta");
  fireEvent.change(screen.getByLabelText("Respuesta"), {
    target: { value: "Revisa esta orientación" },
  });
  fireEvent.click(screen.getByText("Cambiar estado (opcional)"));
  fireEvent.change(screen.getByLabelText("Estado"), {
    target: { value: "waiting_user" },
  });
  expect(
    (screen.getByLabelText("Motivo del cambio") as HTMLInputElement).required,
  ).toBe(true);
  expect(
    within(screen.getByLabelText("Estado")).queryByRole("option", {
      name: "Cerrada",
    }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Motivo del cambio"), {
    target: { value: "Pendiente de confirmar" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar respuesta y cambiar estado" }),
  );
  await waitFor(() =>
    expect(api.updateSupportTicket).toHaveBeenCalledWith(8, {
      body: "Revisa esta orientación",
      state: "waiting_user",
      reason: "Pendiente de confirmar",
      expected_version: 1,
    }),
  );
});

test("closed ticket shows retained history without a reply form", async () => {
  setup({
    supportTicket: vi.fn().mockResolvedValue({
      ...ticket,
      state: "closed",
      allowed_transitions: [],
    }),
  });
  await ready();
  await tickets();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByText(/Consulta cerrada/);
  expect(screen.queryByLabelText("Respuesta")).toBeNull();
});

test("FAQ answer cites approved source and handoff creates only a reviewed draft", async () => {
  const api = setup();
  await ready();
  await assistant();
  ask("Consulta privada fuera de alcance");
  await screen.findByRole("article", { name: "Respuesta del asistente" });
  expect(api.askAssistant).toHaveBeenCalledWith({
    question: "Consulta privada fuera de alcance",
    mode: "faq",
  });
  expect(
    screen
      .getByRole("link", { name: "Consultar guía de origen" })
      .getAttribute("href"),
  ).toBe("#help-plans");
  fireEvent.click(
    screen.getByRole("button", { name: "Preparar consulta de soporte" }),
  );
  expect(
    (screen.getByLabelText("Describe el problema") as HTMLTextAreaElement)
      .value,
  ).toBe("");
  expect(api.createSupportTicket).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Asunto"), {
    target: { value: "Ayuda general" },
  });
  fireEvent.change(screen.getByLabelText("Describe el problema"), {
    target: { value: "Orientación revisada" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar y enviar consulta" }),
  );
  await screen.findByText(/Consulta enviada/);
  expect(api.createSupportTicket).toHaveBeenCalledTimes(1);
});

test("out of scope remains clear and offers a confirmed handoff", async () => {
  const api = setup({
    askAssistant: vi.fn().mockResolvedValue({
      ...answer,
      article_id: null,
      answer: "Consulta fuera del alcance del asistente.",
    }),
  });
  await ready();
  await assistant();
  ask();
  expect(
    await screen.findByText("Consulta fuera del alcance del asistente."),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "Consultar guía de origen" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Preparar consulta de soporte" }),
  ).toBeTruthy();
  expect(api.createSupportTicket).not.toHaveBeenCalled();
});

test("Elite contextual answer is cleared on permission refresh after plan change", async () => {
  const api = setup({
    askAssistant: vi.fn().mockResolvedValue({
      ...answer,
      context: [{ label: "Plan", value: "Elite" }],
    }),
  });
  await ready();
  await assistant();
  fireEvent.change(screen.getByLabelText("Tipo de ayuda"), {
    target: { value: "contextual" },
  });
  ask();
  await screen.findByText("Elite", { selector: "dd" });
  expect(api.askAssistant).toHaveBeenCalledWith({
    question: "planes",
    mode: "contextual",
  });
  (api.helpCenter as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...help,
    assistant_modes: [],
  });
  fireEvent(window, new Event("focus"));
  await screen.findByText(/requiere Pro o Elite vigentes/);
  expect(screen.queryByText("Elite", { selector: "dd" })).toBeNull();
});

test("Pro never presents contextual mode", async () => {
  setup({
    helpCenter: vi
      .fn()
      .mockResolvedValue({ ...help, assistant_modes: ["faq"] }),
  });
  await ready();
  await assistant();
  expect(screen.queryByRole("option", { name: /Contexto propio/ })).toBeNull();
});

for (const [status, message] of [
  [403, "No tienes permiso"],
  [409, "La consulta cambió"],
  [429, "Alcanzaste el límite"],
] as const) {
  test(`support errors ${status} are visible and do not claim success`, async () => {
    setup({
      replySupportTicket: vi
        .fn()
        .mockRejectedValue(new ApiError(status, "denied", "Error")),
    });
    await ready();
    await tickets();
    fireEvent.click(screen.getByRole("button", { name: /#8/ }));
    await screen.findByLabelText("Respuesta");
    fireEvent.change(screen.getByLabelText("Respuesta"), {
      target: { value: "Consulta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(screen.queryByText("Historial actualizado.")).toBeNull();
  });
}

test("administrator without support permission sees access error", async () => {
  setup(
    {
      supportTickets: vi
        .fn()
        .mockRejectedValue(new ApiError(403, "permission_denied", "Denied")),
    },
    true,
  );
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Panel de soporte" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "No tienes permiso",
  );
  expect(
    screen.queryByRole("button", { name: "Crear consulta de soporte" }),
  ).toBeNull();
});

test("obsolete assistant result cannot reappear after entitlement refresh", async () => {
  let resolveAnswer!: (value: AssistantAnswer) => void;
  setup({
    askAssistant: vi.fn().mockImplementation(
      () =>
        new Promise<AssistantAnswer>((resolve) => {
          resolveAnswer = resolve;
        }),
    ),
  });
  await ready();
  await assistant();
  ask();
  fireEvent(window, new Event("focus"));
  await act(async () => {
    resolveAnswer(answer);
  });
  expect(
    screen.queryByRole("article", { name: "Respuesta del asistente" }),
  ).toBeNull();
});

test("AuthApi uses private owner/admin endpoints and CSRF for every write", async () => {
  const fetcher = vi.fn().mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      path.endsWith("auth/csrf/") ? { csrf_token: "synthetic" } : {},
  }));
  vi.stubGlobal("fetch", fetcher);
  const api = new AuthApi();
  await api.helpCenter();
  await api.supportTickets();
  await api.supportTickets(true, 25);
  await api.supportTicket(8);
  await api.supportTicket(8, true);
  await api.createSupportTicket({
    subject: "Consulta",
    body: "Ayuda",
    severity: 3,
    privacy_confirmed: true,
  });
  await api.replySupportTicket(8, { body: "Respuesta", expected_version: 1 });
  await api.updateSupportTicket(8, {
    body: "Respuesta",
    state: "waiting_user",
    reason: "Revisión",
    expected_version: 1,
  });
  await api.askAssistant({ question: "planes", mode: "faq" });
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/api/v1/help/",
    "/api/v1/support/tickets/?offset=0&limit=25",
    "/api/v1/admin/support/tickets/?offset=25&limit=25&state=active",
    "/api/v1/support/tickets/8/",
    "/api/v1/admin/support/tickets/8/",
    "/api/v1/auth/csrf/",
    "/api/v1/support/tickets/",
    "/api/v1/support/tickets/8/",
    "/api/v1/admin/support/tickets/8/",
    "/api/v1/assistant/",
  ]);
  for (const [, options] of fetcher.mock.calls) {
    expect(options.credentials).toBe("same-origin");
    if (options.method === "POST")
      expect(options.headers["X-CSRFToken"]).toBe("synthetic");
  }
});

test("administrative queue separates active work from closed history", async () => {
  const api = setup({}, true);
  await ready();
  await tickets();
  fireEvent.change(screen.getByLabelText("Filtrar consultas"), {
    target: { value: "closed" },
  });
  await waitFor(() =>
    expect(api.supportTickets).toHaveBeenCalledWith(true, 0, "closed"),
  );
});

test("guide disclosure and assistant source open the requested guide", async () => {
  setup();
  await ready();
  const guide = document.getElementById("help-plans") as HTMLDetailsElement;
  expect(guide.open).toBe(false);
  fireEvent.click(
    screen.getByText("Vigencia y planes", { selector: "summary" }),
  );
  expect(guide.open).toBe(true);
  fireEvent.change(screen.getByLabelText("Tema de ayuda"), {
    target: { value: "Ayuda" },
  });
  expect(document.getElementById("help-plans")).toBeNull();
  await assistant();
  ask();
  fireEvent.click(
    await screen.findByRole("link", { name: "Consultar guía de origen" }),
  );
  await waitFor(() =>
    expect(
      (document.getElementById("help-plans") as HTMLDetailsElement).open,
    ).toBe(true),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      document.getElementById("help-plans")?.querySelector("summary"),
    ),
  );
});

test("empty support history gives a clear first action without pagination", async () => {
  setup({
    supportTickets: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  });
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Consultas de soporte" }));
  await screen.findByText("No tienes consultas en esta vista.");
  expect(
    screen.getByRole("button", { name: "Crear consulta de soporte" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
});

test("long ticket history shows recent messages and preserves the earlier conversation", async () => {
  const long = {
    ...ticket,
    events: Array.from({ length: 7 }, (_, index) => ({
      ...ticket.events[0]!,
      id: index + 1,
      body: `Mensaje de prueba ${index + 1}`,
    })),
  };
  setup({ supportTicket: vi.fn().mockResolvedValue(long) });
  await ready();
  await tickets();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByText("Mensaje de prueba 7");
  const older = screen
    .getByText("Ver 4 mensajes anteriores")
    .closest("details")!;
  expect(older.open).toBe(false);
  expect(screen.getByText("Mensaje de prueba 1").closest("details")).toBe(
    older,
  );
  expect(screen.getByText("Mensaje de prueba 5").closest("details")).toBeNull();
  fireEvent.click(screen.getByText("Ver 4 mensajes anteriores"));
  expect(older.open).toBe(true);
  expect(screen.queryByText(/Usuario #/)).toBeNull();
});

test("assistant network failure provides recovery to a reviewed support draft", async () => {
  const api = setup({
    askAssistant: vi.fn().mockRejectedValue(new Error("offline")),
  });
  await ready();
  await assistant();
  ask();
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar con el equipo de soporte" }),
  );
  await screen.findByLabelText("Asunto");
  expect(api.createSupportTicket).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Describe el problema") as HTMLTextAreaElement)
      .value,
  ).toBe("");
  expect(
    (
      screen.getByRole("button", {
        name: "Confirmar y enviar consulta",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test("category selection shows only its questions and all topics restores every guide locally", async () => {
  const api = setup();
  await ready();
  const filter = screen.getByLabelText("Tema de ayuda");
  expect(screen.queryByText("Soporte", { selector: "summary" })).toBeNull();
  fireEvent.change(filter, { target: { value: "Ayuda" } });
  expect(screen.getByText("Soporte", { selector: "summary" })).toBeTruthy();
  expect(
    screen.queryByText("Vigencia y planes", { selector: "summary" }),
  ).toBeNull();
  fireEvent.change(filter, { target: { value: "" } });
  expect(
    screen.getByText("Vigencia y planes", { selector: "summary" }),
  ).toBeTruthy();
  expect(screen.getByText("Soporte", { selector: "summary" })).toBeTruthy();
  expect(api.helpCenter).toHaveBeenCalledTimes(1);
});

test("help failure offers retry without a permanent refresh action", async () => {
  setup({
    helpCenter: vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(help),
  });
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await ready();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Actualizar ayuda" })).toBeNull();
});

test("admin opens the queue with real page indicators and preserves API order before commercial priority", async () => {
  const rows: SupportTicket[] = [
    { ...ticket, id: 12, severity: 1, priority: "standard", state: "open" },
    {
      ...ticket,
      id: 9,
      severity: 2,
      priority: "priority",
      state: "in_progress",
    },
    { ...ticket, id: 10, severity: 3, state: "waiting_user" },
    { ...ticket, id: 11, severity: 1, state: "closed" },
  ];
  const api = setup(
    {
      supportTickets: vi.fn().mockResolvedValue({ count: 60, results: rows }),
      supportTicket: vi
        .fn()
        .mockImplementation((id: number) => Promise.resolve({ ...ticket, id })),
    },
    true,
  );
  const queue = await screen.findByRole("list", {
    name: "Consultas en orden de atención",
  });
  expect(api.supportTickets).toHaveBeenCalledWith(true, 0, "active");
  expect(
    within(queue)
      .getAllByRole("heading")
      .map((heading) => heading.textContent),
  ).toEqual(rows.map((row) => `#${row.id} · ${row.subject}`));
  const summary = screen.getByRole("region", { name: "Resumen de la cola" });
  expect(summary.textContent).toContain("60 consultas en esta vista");
  expect(summary.textContent).toContain(
    "Mostrando 1–4 · Indicadores de esta página",
  );
  for (const label of [
    "Críticas activas",
    "Abiertas · por revisar",
    "En revisión",
  ]) {
    expect(
      within(summary).getByText(label).parentElement?.querySelector("dd")
        ?.textContent,
    ).toBe("1");
  }
  await waitFor(() =>
    expect(within(queue).getAllByText("Conductor · Usuario #4")).toHaveLength(
      4,
    ),
  );
  expect(within(queue).getByText("Esperando al solicitante")).toBeTruthy();
  expect(screen.queryByText("Esperando tu respuesta")).toBeNull();
});

test("requester enrichment limits concurrent reads and discards late identities on filter change", async () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    ...ticket,
    id: index + 1,
  }));
  const pending: Array<(value: SupportTicket) => void> = [];
  const details = vi
    .fn()
    .mockImplementation(
      () => new Promise<SupportTicket>((resolve) => pending.push(resolve)),
    );
  const api = setup(
    {
      supportTickets: vi
        .fn()
        .mockResolvedValueOnce({ count: 5, results: rows })
        .mockResolvedValue({ count: 1, results: [{ ...ticket, id: 20 }] }),
      supportTicket: details,
    },
    true,
  );
  await waitFor(() => expect(details).toHaveBeenCalledTimes(3));
  expect(screen.getAllByText("Cargando identificación…")).toHaveLength(5);
  fireEvent.change(screen.getByLabelText("Filtrar consultas"), {
    target: { value: "closed" },
  });
  await waitFor(() =>
    expect(api.supportTickets).toHaveBeenCalledWith(true, 0, "closed"),
  );
  await waitFor(() => expect(details).toHaveBeenCalledTimes(4));
  await act(async () => {
    pending[3]!({
      ...ticket,
      id: 20,
      events: [{ ...ticket.events[0]!, author_id: 99, author_role: "parent" }],
    });
    pending[0]!({ ...ticket, id: 1 });
    pending[1]!({ ...ticket, id: 2 });
    pending[2]!({ ...ticket, id: 3 });
  });
  expect(await screen.findByText("Apoderado · Usuario #99")).toBeTruthy();
  expect(screen.queryByText("Conductor · Usuario #4")).toBeNull();
  expect(details).toHaveBeenCalledTimes(4);
});

test("identity failure leaves reviewing available and never substitutes the last author", async () => {
  setup(
    { supportTicket: vi.fn().mockRejectedValue(new Error("offline")) },
    true,
  );
  expect(
    await screen.findByText("Identificación no disponible · revisa el caso"),
  ).toBeTruthy();
  const review = screen.getByRole("button", {
    name: /Revisar consulta #8/,
  }) as HTMLButtonElement;
  expect(review.disabled).toBe(false);
  expect(screen.queryByText(/Usuario #/)).toBeNull();
  fireEvent.click(review);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "No se pudo completar",
  );
});

test("admin can send a response without a transition, confirms it once, and retains versioned payload", async () => {
  let finish!: (value: SupportTicket) => void;
  const api = setup(
    {
      updateSupportTicket: vi.fn().mockImplementation(
        () =>
          new Promise<SupportTicket>((resolve) => {
            finish = resolve;
          }),
      ),
    },
    true,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Revisar consulta #8/ }),
  );
  await screen.findByLabelText("Respuesta");
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Consulta general" }),
    ),
  );
  expect(screen.getByText("Solicitante:").parentElement?.textContent).toContain(
    "Conductor · Usuario #4",
  );
  const controls = screen
    .getByText("Cambiar estado (opcional)")
    .closest("details")!;
  expect(controls.open).toBe(false);
  fireEvent.change(screen.getByLabelText("Respuesta"), {
    target: { value: "Orientación revisada" },
  });
  const send = screen.getByRole("button", { name: "Enviar respuesta" });
  fireEvent.click(send);
  fireEvent.click(send);
  expect(api.updateSupportTicket).toHaveBeenCalledTimes(1);
  expect(api.updateSupportTicket).toHaveBeenCalledWith(8, {
    body: "Orientación revisada",
    state: "open",
    reason: "",
    expected_version: 1,
  });
  await act(async () => finish({ ...ticket, version: 2 }));
  expect((await screen.findByRole("status")).textContent).toContain(
    "Respuesta enviada",
  );
  expect(
    (screen.getByLabelText("Respuesta") as HTMLTextAreaElement).value,
  ).toBe("");
});

test("state-only management keeps the required reason visible even after secondary controls close", async () => {
  const api = setup({}, true);
  fireEvent.click(
    await screen.findByRole("button", { name: /Revisar consulta #8/ }),
  );
  await screen.findByLabelText("Respuesta");
  const toggle = screen.getByText("Cambiar estado (opcional)");
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText("Estado"), {
    target: { value: "waiting_user" },
  });
  fireEvent.click(toggle);
  const reason = screen.getByLabelText("Motivo del cambio") as HTMLInputElement;
  expect(reason.closest("details")).toBeNull();
  expect(reason.required).toBe(true);
  const save = screen.getByRole("button", {
    name: "Guardar cambio de estado",
  }) as HTMLButtonElement;
  expect(save.disabled).toBe(true);
  fireEvent.change(reason, { target: { value: "Falta confirmación" } });
  fireEvent.click(save);
  await waitFor(() =>
    expect(api.updateSupportTicket).toHaveBeenCalledWith(8, {
      body: "",
      state: "waiting_user",
      reason: "Falta confirmación",
      expected_version: 1,
    }),
  );
  expect((await screen.findByRole("status")).textContent).toContain(
    "Motivo registrado",
  );
});

test("admin back navigation retains filter and page and restores focus to the queue", async () => {
  const api = setup(
    {
      supportTickets: vi
        .fn()
        .mockResolvedValue({ count: 60, results: [ticket] }),
    },
    true,
  );
  await screen.findByRole("button", { name: /Revisar consulta #8/ });
  fireEvent.change(screen.getByLabelText("Filtrar consultas"), {
    target: { value: "waiting_user" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
  await waitFor(() =>
    expect(api.supportTickets).toHaveBeenLastCalledWith(
      true,
      25,
      "waiting_user",
    ),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Revisar consulta #8/ }),
  );
  await screen.findByLabelText("Respuesta");
  expect(
    screen.queryByRole("button", { name: "Volver a mis consultas" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Volver a la cola de soporte" }),
  );
  await screen.findByRole("button", { name: /Revisar consulta #8/ });
  expect(api.supportTickets).toHaveBeenLastCalledWith(true, 25, "waiting_user");
  expect(
    (screen.getByLabelText("Filtrar consultas") as HTMLSelectElement).value,
  ).toBe("waiting_user");
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Cola de soporte" }),
    ),
  );
});

test("conflict preserves the administrative draft and reason without announcing success", async () => {
  const api = setup(
    {
      updateSupportTicket: vi
        .fn()
        .mockRejectedValue(new ApiError(409, "conflict", "Changed")),
    },
    true,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Revisar consulta #8/ }),
  );
  await screen.findByLabelText("Respuesta");
  fireEvent.change(screen.getByLabelText("Respuesta"), {
    target: { value: "Conservar borrador" },
  });
  fireEvent.click(screen.getByText("Cambiar estado (opcional)"));
  fireEvent.change(screen.getByLabelText("Estado"), {
    target: { value: "in_progress" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del cambio"), {
    target: { value: "Revisión inicial" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar respuesta y cambiar estado" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "La consulta cambió",
  );
  expect(
    (screen.getByLabelText("Respuesta") as HTMLTextAreaElement).value,
  ).toBe("Conservar borrador");
  expect(
    (screen.getByLabelText("Motivo del cambio") as HTMLInputElement).value,
  ).toBe("Revisión inicial");
  expect(api.updateSupportTicket).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Respuesta enviada/)).toBeNull();
});

test("admin closed history preserves earlier audit reasons and has no response form", async () => {
  const closed: SupportTicket = {
    ...ticket,
    state: "closed",
    allowed_transitions: [],
    events: [
      ...ticket.events,
      {
        ...ticket.events[0]!,
        id: 2,
        author_role: "admin",
        author_id: 9,
        body: "Revisado",
        from_state: "open",
        to_state: "resolved",
        reason: "Solución confirmada",
      },
      { ...ticket.events[0]!, id: 3, author_role: "driver", body: "Gracias" },
      {
        ...ticket.events[0]!,
        id: 4,
        author_role: "admin",
        author_id: 9,
        body: "",
        from_state: "resolved",
        to_state: "closed",
        reason: "Cierre verificado",
      },
    ],
  };
  setup({ supportTicket: vi.fn().mockResolvedValue(closed) }, true);
  fireEvent.click(
    await screen.findByRole("button", { name: /Revisar consulta #8/ }),
  );
  await screen.findByText(/Consulta cerrada/);
  expect(
    screen.queryByRole("form", { name: "Responder al solicitante" }),
  ).toBeNull();
  const earlier = screen
    .getByText("Ver 1 eventos anteriores")
    .closest("details")!;
  fireEvent.click(screen.getByText("Ver 1 eventos anteriores"));
  expect(earlier.open).toBe(true);
  expect(within(earlier).getByText("Necesito orientación")).toBeTruthy();
  expect(screen.getByText("Motivo: Solución confirmada")).toBeTruthy();
  expect(screen.getByText("Motivo: Cierre verificado")).toBeTruthy();
  expect(
    screen.getByText(/Estado anterior: Resuelta. Estado: Cerrada./),
  ).toBeTruthy();
});

test("driver help starts with one short task and drills into exactly one whole guide", async () => {
  const api = setup({}, false, true);
  await ready();
  expect(api.supportTickets).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("region", { name: "Consultas de soporte" }),
  ).toBeNull();
  expect(screen.queryByRole("list", { name: "Elegir una guía" })).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  expect(screen.queryByText(help.articles[0]!.body)).toBeNull();
  expect(screen.getAllByRole("heading")).toHaveLength(2);
  expect(
    screen.queryByRole("button", { name: "Crear consulta de soporte" }),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Tema de ayuda"), {
    target: { value: "Planes" },
  });
  const choose = screen.getByRole("button", { name: "Vigencia y planes" });
  expect(screen.queryByText(help.articles[0]!.body)).toBeNull();
  fireEvent.click(choose);
  expect(
    screen.getByRole("article", { name: "Vigencia y planes" }).textContent,
  ).toContain(help.articles[0]!.body);
  expect(screen.queryByRole("list", { name: "Elegir una guía" })).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("help-selected-guide-title"),
  );
  await tickets();
  expect(
    screen.queryByRole("article", { name: "Vigencia y planes" }),
  ).toBeNull();
  expect(screen.queryByRole("region", { name: "Guías" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByRole("heading", {
    name: /#8 · Consulta general/,
    level: 2,
  });
  expect(document.querySelector(".support-list")).toBeNull();
  expect(screen.queryByLabelText("Estado en esta página")).toBeNull();
  expect(screen.getByText("Necesito orientación")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Guías de ayuda" }));
  expect(
    screen.getByRole("article", { name: "Vigencia y planes" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("article", { name: "Historial de soporte" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Volver a las guías" }));
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("help-guide-choice-plans"),
  );
  expect(
    (screen.getByLabelText("Tema de ayuda") as HTMLSelectElement).value,
  ).toBe("Planes");
  expect(api.replySupportTicket).not.toHaveBeenCalled();
  expect(api.createSupportTicket).not.toHaveBeenCalled();
});

test("driver case search and states filter only the received server page and keep navigation when empty", async () => {
  const next = {
    ...ticket,
    id: 33,
    state: "waiting_user" as const,
    subject: "Información pendiente",
  };
  const read = vi
    .fn()
    .mockResolvedValueOnce({ count: 26, results: [ticket] })
    .mockResolvedValueOnce({ count: 26, results: [next] });
  const api = setup({ supportTickets: read }, false, true);
  await ready();
  await tickets();
  fireEvent.change(screen.getByLabelText("Estado en esta página"), {
    target: { value: "waiting_user" },
  });
  expect(screen.queryByRole("button", { name: /#8/ })).toBeNull();
  expect(
    screen.getByText(/No hay consultas con los criterios elegidos/),
  ).toBeTruthy();
  expect(screen.getByText(/El filtro se aplica a esta página/)).toBeTruthy();
  fireEvent.click(supportPages().getByRole("button", { name: "Siguiente" }));
  expect(await screen.findByRole("button", { name: /#33/ })).toBeTruthy();
  expect(read).toHaveBeenLastCalledWith(false, 25);
  expect(
    (screen.getByLabelText("Estado en esta página") as HTMLSelectElement).value,
  ).toBe("waiting_user");
  fireEvent.change(
    screen.getByLabelText("Buscar en esta página de consultas"),
    { target: { value: "no coincide" } },
  );
  expect(screen.queryByRole("button", { name: /#33/ })).toBeNull();
  expect(supportPages().getByText(/Página 2 de 2/)).toBeTruthy();
  expect(api.supportTicket).not.toHaveBeenCalled();
});

test("driver guide retry fetches only its task, and the inbox has independent read recovery", async () => {
  const read = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ count: 1, results: [ticket] });
  const api = setup(
    {
      helpCenter: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(help),
      supportTickets: read,
    },
    false,
    true,
  );
  await screen.findByRole("alert");
  expect(read).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
  await ready();
  expect(api.helpCenter).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Consultas de soporte" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: "Guías" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar consultas" }));
  expect(await screen.findByRole("button", { name: /#8/ })).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(2);
  expect(api.createSupportTicket).not.toHaveBeenCalled();
});

function manyGuides(): HelpCenter {
  return {
    ...help,
    articles: Array.from({ length: 23 }, (_, index) => ({
      ...help.articles[0]!,
      id: `guide-${index + 1}`,
      title: `Guía ${index + 1}`,
      category: index < 12 ? "Planes" : "Ayuda",
      body: `Orientación íntegra ${index + 1}`,
    })),
  };
}
function guidePages() {
  return within(screen.getByRole("navigation", { name: "Páginas de guías" }));
}
function supportPages() {
  return within(
    screen.getByRole("navigation", {
      name: "Páginas de consultas de soporte",
    }),
  );
}

function chooseTopic(value = "Planes") {
  fireEvent.change(screen.getByLabelText("Tema de ayuda"), {
    target: { value },
  });
}

test("guide result pages are conditional, search full bodies without accents, and never paginate the article", async () => {
  const api = setup(
    { helpCenter: vi.fn().mockResolvedValue(manyGuides()) },
    false,
    true,
  );
  await ready();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  chooseTopic();
  expect(
    within(screen.getByRole("list", { name: "Elegir una guía" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(5);
  expect(guidePages().getByText(/1–5 de 12/)).toBeTruthy();
  fireEvent.click(guidePages().getByRole("button", { name: "Siguiente" }));
  expect(screen.getByRole("button", { name: "Guía 6" })).toBeTruthy();
  expect(document.activeElement?.id).toBe("help-guide-results");
  fireEvent.click(
    screen.getByRole("button", { name: "Asistente automatizado" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Guías de ayuda" }));
  expect(guidePages().getByText(/Página 2 de 3/)).toBeTruthy();
  chooseTopic("");
  fireEvent.change(screen.getByLabelText("Buscar una guía"), {
    target: { value: "ORIENTACION INTEGRA 23" },
  });
  expect(screen.getByRole("button", { name: /Guía 23/ })).toBeTruthy();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Guía 23/ }));
  expect(
    screen.getByRole("article", { name: "Guía 23" }).textContent,
  ).toContain("Orientación íntegra 23");
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  expect(screen.queryByText("Orientación íntegra 22")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Volver a las guías" }));
  chooseTopic("Planes");
  expect(screen.getByText(/No encontramos una guía/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Buscar una guía"), {
    target: { value: "" },
  });
  expect(guidePages().getByText(/Página 1 de 3/)).toBeTruthy();
  fireEvent.change(guidePages().getByRole("combobox"), {
    target: { value: "10" },
  });
  expect(
    within(screen.getByRole("list", { name: "Elegir una guía" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(10);
  fireEvent.click(guidePages().getByRole("button", { name: "Siguiente" }));
  expect(guidePages().getByText(/11–12 de 12/)).toBeTruthy();
  fireEvent.change(guidePages().getByRole("combobox"), {
    target: { value: "20" },
  });
  expect(guidePages().getByRole("combobox")).toBeTruthy();
  expect(guidePages().getByText(/Página 1 de 1/)).toBeTruthy();
  expect(api.helpCenter).toHaveBeenCalledTimes(1);
  expect(api.supportTickets).not.toHaveBeenCalled();
});

test("guide and inbox state survive exclusive task views, case detail and cancellation without writing", async () => {
  const next = {
    ...ticket,
    id: 33,
    subject: "Orientación de publicación",
    state: "waiting_user" as const,
  };
  const read = vi.fn(async (_admin: boolean, at: number) => ({
    count: 26,
    results: [at ? next : ticket],
  }));
  const api = setup(
    {
      helpCenter: vi.fn().mockResolvedValue(manyGuides()),
      supportTickets: read,
      supportTicket: vi
        .fn()
        .mockResolvedValue({ ...next, events: ticket.events }),
    },
    false,
    true,
  );
  await ready();
  chooseTopic();
  fireEvent.click(guidePages().getByRole("button", { name: "Siguiente" }));
  await tickets();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  fireEvent.click(supportPages().getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("button", { name: /#33/ });
  fireEvent.change(screen.getByLabelText("Estado en esta página"), {
    target: { value: "waiting_user" },
  });
  fireEvent.change(
    screen.getByLabelText("Buscar en esta página de consultas"),
    { target: { value: "PUBLICACION" } },
  );
  expect(
    screen.getByText(/1 coincidencia de 1 consulta recibida/),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /Total informado por la API: 26 consultas \(sin filtrar\)/,
    ),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /#33/ }));
  await screen.findByRole("heading", { name: /#33/ });
  expect(
    screen.queryByRole("navigation", {
      name: "Páginas de consultas de soporte",
    }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Volver a mis consultas" }),
  );
  await screen.findByRole("button", { name: /#33/ });
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("support-case-results"),
  );
  expect(supportPages().getByText(/26–26 de 26/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Crear consulta de soporte" }),
  );
  expect(
    screen.queryByRole("navigation", {
      name: "Páginas de consultas de soporte",
    }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await screen.findByRole("button", { name: /#33/ });
  fireEvent.click(screen.getByRole("button", { name: "Guías de ayuda" }));
  expect(guidePages().getByText(/Página 2 de 3/)).toBeTruthy();
  expect(
    screen.queryByRole("region", { name: "Consultas de soporte" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Consultas de soporte" }));
  await screen.findByRole("button", { name: /#33/ });
  expect(
    (
      screen.getByLabelText(
        "Buscar en esta página de consultas",
      ) as HTMLInputElement
    ).value,
  ).toBe("PUBLICACION");
  expect(
    (screen.getByLabelText("Estado en esta página") as HTMLSelectElement).value,
  ).toBe("waiting_user");
  expect(read).toHaveBeenLastCalledWith(false, 25);
  fireEvent.click(
    screen.getByRole("button", { name: "Limpiar criterios de consultas" }),
  );
  expect(supportPages().getByText(/Página 2 de 2/)).toBeTruthy();
  expect(api.createSupportTicket).not.toHaveBeenCalled();
});

test("server counts shrinking past the selected support page recover to the last available page", async () => {
  let count = 60;
  const read = vi.fn(async (_admin: boolean, at: number) => ({
    count,
    results: at >= count ? [] : [ticket],
  }));
  setup({ supportTickets: read }, false, true);
  await ready();
  await tickets();
  fireEvent.click(supportPages().getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("button", { name: /#8/ });
  fireEvent.click(supportPages().getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("button", { name: /#8/ });
  count = 26;
  fireEvent.click(screen.getByRole("button", { name: "Actualizar consultas" }));
  await waitFor(() => expect(read).toHaveBeenLastCalledWith(false, 25));
  await screen.findByRole("button", { name: /#8/ });
  expect(supportPages().getByText(/Página 2 de 2/)).toBeTruthy();
  count = 0;
  fireEvent.click(screen.getByRole("button", { name: "Actualizar consultas" }));
  await screen.findByText("No tienes consultas en esta vista.");
  expect(read).toHaveBeenLastCalledWith(false, 0);
  expect(
    screen.queryByRole("navigation", {
      name: "Páginas de consultas de soporte",
    }),
  ).toBeNull();
});

test("the assistant source opens one complete guide directly and returns to its result page", async () => {
  setup(
    {
      helpCenter: vi.fn().mockResolvedValue(manyGuides()),
      askAssistant: vi
        .fn()
        .mockResolvedValue({ ...answer, article_id: "guide-12" }),
    },
    false,
    true,
  );
  await ready();
  await assistant();
  ask();
  fireEvent.click(
    await screen.findByRole("link", { name: "Consultar guía de origen" }),
  );
  expect(await screen.findByRole("article", { name: "Guía 12" })).toBeTruthy();
  expect(
    screen.queryByRole("navigation", { name: "Páginas de guías" }),
  ).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Consultas de soporte" }),
  ).toBeNull();
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("help-selected-guide-title"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Volver a las guías" }));
  expect(guidePages().getByText(/Página 3 de 3/)).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("help-guide-choice-guide-12"),
  );
});

test("long older conversations keep their independent pages and recent messages next to reply", async () => {
  const events = Array.from({ length: 30 }, (_, index) => ({
    ...ticket.events[0]!,
    id: index + 1,
    body: `Evento ${index + 1}`,
  }));
  setup(
    { supportTicket: vi.fn().mockResolvedValue({ ...ticket, events }) },
    false,
    true,
  );
  await ready();
  await tickets();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  await screen.findByText("Evento 30");
  fireEvent.click(screen.getByText("Ver 27 mensajes anteriores"));
  const nav = () =>
    within(
      screen.getByRole("navigation", {
        name: "Páginas de mensajes anteriores",
      }),
    );
  expect(screen.queryByText("Evento 11")).toBeNull();
  fireEvent.click(nav().getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Evento 11")).toBeTruthy();
  expect(screen.getByText("Evento 30")).toBeTruthy();
  expect(screen.getByLabelText("Respuesta")).toBeTruthy();
  fireEvent.click(nav().getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Evento 27")).toBeTruthy();
  expect(nav().getByText(/21–27 de 27/)).toBeTruthy();
});

test("refreshed guide collections clamp a removed page without resurrecting it when they grow", async () => {
  let content = manyGuides();
  setup({ helpCenter: vi.fn(async () => content) }, false, true);
  await ready();
  chooseTopic();
  fireEvent.click(guidePages().getByRole("button", { name: "Siguiente" }));
  content = { ...content, articles: content.articles.slice(0, 2) };
  fireEvent(window, new Event("focus"));
  await waitFor(() =>
    expect(
      screen.queryByRole("navigation", { name: "Páginas de guías" }),
    ).toBeNull(),
  );
  content = manyGuides();
  fireEvent(window, new Event("focus"));
  await waitFor(() =>
    expect(guidePages().getByText(/Página 1 de 3/)).toBeTruthy(),
  );
});

test("exclusive page controls retain native keyboard semantics, boundary states and result focus", async () => {
  setup(
    {
      helpCenter: vi.fn().mockResolvedValue(manyGuides()),
      supportTickets: vi
        .fn()
        .mockResolvedValue({ count: 26, results: [ticket] }),
    },
    false,
    true,
  );
  await ready();
  chooseTopic();
  expect(
    (
      guidePages().getByRole("button", {
        name: "Anterior",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  const guideNext = guidePages().getByRole("button", { name: "Siguiente" });
  expect(guideNext.tagName).toBe("BUTTON");
  expect(guideNext.tabIndex).toBe(0);
  guideNext.focus();
  expect(document.activeElement).toBe(guideNext);
  fireEvent.click(guideNext);
  expect(document.activeElement?.id).toBe("help-guide-results");
  await tickets();
  expect(
    (
      supportPages().getByRole("button", {
        name: "Anterior",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  const supportNext = supportPages().getByRole("button", { name: "Siguiente" });
  supportNext.focus();
  fireEvent.click(supportNext);
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("support-case-results"),
  );
  expect(supportPages().getByText(/Página 2 de 2/)).toBeTruthy();
  expect(document.querySelector('[tabindex="1"]')).toBeNull();
});

test("leaving a loading case for guides discards late reads and never reveals the inbox beside a guide", async () => {
  let resolve!: (value: SupportTicket) => void;
  const pending = new Promise<SupportTicket>((done) => {
    resolve = done;
  });
  setup({ supportTicket: vi.fn().mockReturnValue(pending) }, false, true);
  await ready();
  await tickets();
  fireEvent.click(screen.getByRole("button", { name: /#8/ }));
  expect(screen.getByText("Abriendo el historial…")).toBeTruthy();
  expect(document.querySelector(".support-list")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Guías de ayuda" }));
  chooseTopic();
  fireEvent.click(screen.getByRole("button", { name: "Vigencia y planes" }));
  await act(async () => resolve(ticket));
  expect(
    screen.getByRole("article", { name: "Vigencia y planes" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("article", { name: "Historial de soporte" }),
  ).toBeNull();
  expect(screen.queryByText("Abriendo el historial…")).toBeNull();
});

test("admin page search and severity filters keep global state pagination and show priority separately", async () => {
  const api = setup(
    {
      supportTickets: vi.fn().mockResolvedValue({
        count: 60,
        results: [
          {
            ...ticket,
            id: 1,
            subject: "Acceso interrumpido",
            severity: 1,
            priority: "standard",
          },
          {
            ...ticket,
            id: 2,
            subject: "Consulta de plan",
            severity: 3,
            priority: "priority",
          },
        ],
      }),
      supportTicket: vi.fn(async (id: number) => ({ ...ticket, id })),
    },
    true,
  );
  const queue = await screen.findByRole("list", {
    name: "Consultas en orden de atención",
  });
  expect(within(queue).getByText("Atención: Estándar")).toBeTruthy();
  expect(within(queue).getByText("Atención: Prioritaria")).toBeTruthy();
  fireEvent.click(screen.getByText("Buscar y filtrar esta página"));
  fireEvent.change(screen.getByLabelText("Gravedad en esta página"), {
    target: { value: "1" },
  });
  expect(within(queue).getAllByRole("listitem")).toHaveLength(1);
  expect(within(queue).getByText(/Acceso interrumpido/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Buscar en esta página de soporte"), {
    target: { value: "Consulta" },
  });
  expect(screen.getByText(/No hay coincidencias en esta página/)).toBeTruthy();
  expect(api.supportTickets).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: "Limpiar búsqueda de página" }),
  );
  expect(within(queue).getAllByRole("listitem")).toHaveLength(2);
});
