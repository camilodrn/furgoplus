import { demoRegistrationNotice, isDemoMode } from "./demo";
import type {
  AdminValidation,
  AdminDrivers,
  AdminDriver,
  ProfileStatusInput,
  AdminDriverHistory,
  AdminDriverValidations,
  AdminValidations,
  Csrf,
  DriverChecklist,
  DriverDocument,
  DriverDocuments,
  DriverProfile,
  DriverProfileUpdate,
  DriverValidation,
  DriverValidations,
  Health,
  Identity,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ObservationInput,
  RegisterRequest,
  Publication,
  PublicationInput,
  Communes,
  Routes,
  Route,
  RouteInput,
  RouteUpdate,
  Plans,
  AdminSubscription,
  SubscriptionInput,
  DriverContactRequests,
  DriverContactRequest,
  DriverSummary,
  Assignments,
  Assignment,
  AssignmentInput,
  AssignmentUpdate,
  Payments,
  Payment,
  PaymentInput,
} from "./api-types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: unknown,
  csrfToken?: string,
  signal?: AbortSignal,
): Promise<T> {
  const multipart = body instanceof FormData;
  const options: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body && !multipart ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    signal,
  };
  if (method !== "GET")
    options.body = multipart ? body : JSON.stringify(body ?? {});
  const response = await fetch(`/api/v1/${path}`, options);
  if (!response.ok) {
    const error = (await response.json()) as {
      code?: string;
      message?: string;
      fields?: Record<string, string[]>;
    };
    throw new ApiError(
      response.status,
      error?.code ?? "error",
      error?.message ?? "Request failed.",
      error?.fields ?? {},
    );
  }
  return (await response.json()) as T;
}

async function downloadPrivateDocument(path: string): Promise<Blob> {
  const response = await fetch(`/api/v1/${path}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "*/*" },
  });
  if (!response.ok) {
    const error = (await response.json()) as {
      code?: string;
      message?: string;
      fields?: Record<string, string[]>;
    };
    throw new ApiError(
      response.status,
      error.code ?? "error",
      error.message ?? "No se pudo descargar el documento.",
      error.fields ?? {},
    );
  }
  return response.blob();
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const body = await request<Health>(
    "health/",
    "GET",
    undefined,
    undefined,
    signal,
  );
  if (body?.status !== "ok") throw new Error("Invalid health response");
  return body;
}

export class AuthApi {
  private csrfToken: string | null = null;
  private generation = 0;

  constructor(private readonly onExpired?: () => void) {}

  invalidateRequests(): void {
    this.generation += 1;
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation)
      throw new ApiError(
        0,
        "stale_request",
        "La solicitud ya no pertenece a la sesión actual.",
      );
  }

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    try {
      const result = await operation();
      this.assertCurrent(generation);
      return result;
    } catch (error) {
      this.assertCurrent(generation);
      if (error instanceof ApiError && error.code === "not_authenticated") {
        this.clear();
        this.onExpired?.();
      }
      throw error;
    }
  }

  private request<T>(...args: Parameters<typeof request>): Promise<T> {
    return this.guarded(() => request<T>(...args));
  }

  async csrf(): Promise<void> {
    const generation = this.generation;
    const body = await this.request<Csrf>("auth/csrf/", "GET");
    if (typeof body?.csrf_token !== "string")
      throw new Error("Invalid CSRF response");
    this.assertCurrent(generation);
    this.csrfToken = body.csrf_token;
  }

  private async unsafe<T>(
    path: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST",
  ): Promise<T> {
    return this.guarded(async () => {
      const generation = this.generation;
      if (!this.csrfToken) await this.csrf();
      this.assertCurrent(generation);
      try {
        return await request<T>(path, method, body, this.csrfToken!);
      } catch (error) {
        this.assertCurrent(generation);
        if (!(error instanceof ApiError && error.code === "csrf_failed"))
          throw error;
        await this.csrf();
        this.assertCurrent(generation);
        return request<T>(path, method, body, this.csrfToken!);
      }
    });
  }

  register(input: RegisterRequest): Promise<Identity> {
    if (isDemoMode())
      return Promise.reject(
        new ApiError(403, "registration_disabled", demoRegistrationNotice, {}),
      );
    return this.unsafe<Identity>("auth/register/", input);
  }

  async login(input: LoginRequest): Promise<Identity> {
    const generation = this.generation;
    const body = await this.unsafe<LoginResponse>("auth/login/", input);
    if (typeof body.csrf_token !== "string")
      throw new Error("Invalid login response");
    this.assertCurrent(generation);
    this.csrfToken = body.csrf_token;
    return {
      id: body.id,
      email: body.email,
      role: body.role,
      display_name: body.display_name,
    };
  }

  me(): Promise<Identity> {
    return this.request<Identity>("auth/me/", "GET");
  }

  async logout(): Promise<LogoutResponse> {
    const generation = this.generation;
    const result = await this.unsafe<LogoutResponse>("auth/logout/", {});
    this.assertCurrent(generation);
    this.clear();
    return result;
  }

  driverProfile(): Promise<DriverProfile> {
    return this.request("driver/profile/", "GET");
  }
  updateDriverProfile(input: DriverProfileUpdate): Promise<DriverProfile> {
    return this.unsafe("driver/profile/", input, "PATCH");
  }
  checklist(): Promise<DriverChecklist> {
    return this.request("driver/validation/checklist/", "GET");
  }
  documents(): Promise<DriverDocuments> {
    return this.request("driver/documents/", "GET");
  }
  upload(kind: string, expiresOn: string, file: File): Promise<DriverDocument> {
    const form = new FormData();
    form.set("kind", kind);
    if (expiresOn) form.set("expires_on", expiresOn);
    form.set("file", file);
    return this.unsafe("driver/documents/", form);
  }
  validations(): Promise<DriverValidations> {
    return this.request("driver/validations/", "GET");
  }
  submitValidation(): Promise<DriverValidation> {
    return this.unsafe("driver/validations/submit/", {});
  }
  adminDrivers(filters: URLSearchParams): Promise<AdminDrivers> {
    return this.request(`admin/drivers/?${filters.toString()}`, "GET");
  }
  adminDriver(id: number): Promise<AdminDriver> {
    return this.request(`admin/drivers/${id}/`, "GET");
  }
  adminDriverHistory(id: number, offset = 0): Promise<AdminDriverHistory> {
    return this.request(`admin/drivers/${id}/history/?offset=${offset}`, "GET");
  }
  adminDriverValidations(
    id: number,
    offset = 0,
  ): Promise<AdminDriverValidations> {
    return this.request(
      `admin/drivers/${id}/validations/?offset=${offset}`,
      "GET",
    );
  }
  changeProfileStatus(
    id: number,
    input: ProfileStatusInput,
  ): Promise<AdminDriver> {
    return this.unsafe(`admin/drivers/${id}/status/`, input);
  }
  adminValidations(state: string): Promise<AdminValidations> {
    return this.request(
      `admin/validations/?state=${encodeURIComponent(state)}`,
      "GET",
    );
  }
  adminValidation(id: number): Promise<AdminValidation> {
    return this.request(`admin/validations/${id}/`, "GET");
  }
  adminDecision(
    id: number,
    action: "approve" | "reject",
    input: ObservationInput,
  ): Promise<AdminValidation> {
    return this.unsafe(`admin/validations/${id}/${action}/`, input);
  }
  publication(): Promise<Publication> {
    return this.request("driver/publication/", "GET");
  }
  setPublication(input: PublicationInput): Promise<Publication> {
    return this.unsafe("driver/publication/", input, "PATCH");
  }
  communes(): Promise<Communes> {
    return this.request("driver/communes/", "GET");
  }
  routes(): Promise<Routes> {
    return this.request("driver/routes/", "GET");
  }
  createRoute(input: RouteInput): Promise<Route> {
    return this.unsafe("driver/routes/", input);
  }
  updateRoute(id: number, input: RouteUpdate): Promise<Route> {
    return this.unsafe(`driver/routes/${id}/`, input, "PATCH");
  }
  summary(): Promise<DriverSummary> {
    return this.request("driver/summary/", "GET");
  }
  assignments(routeId?: number): Promise<Assignments> {
    return this.request(
      `driver/passenger-assignments/${routeId ? `?route_id=${routeId}` : ""}`,
      "GET",
    );
  }
  createAssignment(input: AssignmentInput): Promise<Assignment> {
    return this.unsafe("driver/passenger-assignments/", input);
  }
  updateAssignment(id: number, input: AssignmentUpdate): Promise<Assignment> {
    return this.unsafe(`driver/passenger-assignments/${id}/`, input, "PATCH");
  }
  endAssignment(id: number, endsOn: string): Promise<Assignment> {
    return this.unsafe(`driver/passenger-assignments/${id}/end/`, {
      ends_on: endsOn,
    });
  }
  payments(): Promise<Payments> {
    return this.request("driver/payments/", "GET");
  }
  createPayment(input: PaymentInput): Promise<Payment> {
    return this.unsafe("driver/payments/", input);
  }
  markPaymentPaid(id: number): Promise<Payment> {
    return this.unsafe(`driver/payments/${id}/mark-paid/`, {});
  }
  voidPayment(id: number): Promise<Payment> {
    return this.unsafe(`driver/payments/${id}/void/`, {});
  }
  plans(): Promise<Plans> {
    return this.request("admin/plans/", "GET");
  }
  adminSubscription(id: number): Promise<AdminSubscription> {
    return this.request(`admin/drivers/${id}/subscription/`, "GET");
  }
  changeSubscription(
    id: number,
    input: SubscriptionInput,
  ): Promise<AdminSubscription> {
    return this.unsafe(`admin/drivers/${id}/subscription/`, input);
  }
  downloadDocument(id: number, admin: boolean): Promise<Blob> {
    return this.guarded(() =>
      downloadPrivateDocument(
        `${admin ? "admin" : "driver"}/documents/${id}/download/`,
      ),
    );
  }
  driverContactRequests(): Promise<DriverContactRequests> {
    return this.request("driver/contact-requests/", "GET");
  }
  driverContactRequest(id: number): Promise<DriverContactRequest> {
    return this.request(`driver/contact-requests/${id}/`, "GET");
  }
  decideContactRequest(
    id: number,
    decision: "accept" | "decline",
  ): Promise<DriverContactRequest> {
    return this.unsafe(`driver/contact-requests/${id}/${decision}/`, {});
  }

  clear(): void {
    this.invalidateRequests();
    this.csrfToken = null;
  }
}
