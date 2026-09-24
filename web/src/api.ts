import type {
  AdminValidation,
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

  async csrf(): Promise<void> {
    const body = await request<Csrf>("auth/csrf/", "GET");
    if (typeof body?.csrf_token !== "string")
      throw new Error("Invalid CSRF response");
    this.csrfToken = body.csrf_token;
  }

  private async unsafe<T>(
    path: string,
    body: unknown,
    method: "POST" | "PATCH" = "POST",
  ): Promise<T> {
    if (!this.csrfToken) await this.csrf();
    try {
      return await request<T>(path, method, body, this.csrfToken!);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "csrf_failed"))
        throw error;
      await this.csrf();
      return request<T>(path, method, body, this.csrfToken!);
    }
  }

  register(input: RegisterRequest): Promise<Identity> {
    return this.unsafe<Identity>("auth/register/", input);
  }

  async login(input: LoginRequest): Promise<Identity> {
    const body = await this.unsafe<LoginResponse>("auth/login/", input);
    if (typeof body.csrf_token !== "string")
      throw new Error("Invalid login response");
    this.csrfToken = body.csrf_token;
    return {
      id: body.id,
      email: body.email,
      role: body.role,
      display_name: body.display_name,
    };
  }

  me(): Promise<Identity> {
    return request<Identity>("auth/me/", "GET");
  }

  async logout(): Promise<LogoutResponse> {
    const result = await this.unsafe<LogoutResponse>("auth/logout/", {});
    this.clear();
    return result;
  }

  driverProfile(): Promise<DriverProfile> {
    return request("driver/profile/", "GET");
  }
  updateDriverProfile(input: DriverProfileUpdate): Promise<DriverProfile> {
    return this.unsafe("driver/profile/", input, "PATCH");
  }
  checklist(): Promise<DriverChecklist> {
    return request("driver/validation/checklist/", "GET");
  }
  documents(): Promise<DriverDocuments> {
    return request("driver/documents/", "GET");
  }
  upload(kind: string, expiresOn: string, file: File): Promise<DriverDocument> {
    const form = new FormData();
    form.set("kind", kind);
    if (expiresOn) form.set("expires_on", expiresOn);
    form.set("file", file);
    return this.unsafe("driver/documents/", form);
  }
  validations(): Promise<DriverValidations> {
    return request("driver/validations/", "GET");
  }
  submitValidation(): Promise<DriverValidation> {
    return this.unsafe("driver/validations/submit/", {});
  }
  adminValidations(state: string): Promise<AdminValidations> {
    return request(
      `admin/validations/?state=${encodeURIComponent(state)}`,
      "GET",
    );
  }
  adminValidation(id: number): Promise<AdminValidation> {
    return request(`admin/validations/${id}/`, "GET");
  }
  adminDecision(
    id: number,
    action: "approve" | "reject",
    input: ObservationInput,
  ): Promise<AdminValidation> {
    return this.unsafe(`admin/validations/${id}/${action}/`, input);
  }
  publication(): Promise<Publication> {
    return request("driver/publication/", "GET");
  }
  setPublication(input: PublicationInput): Promise<Publication> {
    return this.unsafe("driver/publication/", input, "PATCH");
  }
  communes(): Promise<Communes> {
    return request("driver/communes/", "GET");
  }
  routes(): Promise<Routes> {
    return request("driver/routes/", "GET");
  }
  createRoute(input: RouteInput): Promise<Route> {
    return this.unsafe("driver/routes/", input);
  }
  updateRoute(id: number, input: RouteUpdate): Promise<Route> {
    return this.unsafe(`driver/routes/${id}/`, input, "PATCH");
  }
  plans(): Promise<Plans> {
    return request("admin/plans/", "GET");
  }
  adminSubscription(id: number): Promise<AdminSubscription> {
    return request(`admin/drivers/${id}/subscription/`, "GET");
  }
  changeSubscription(
    id: number,
    input: SubscriptionInput,
  ): Promise<AdminSubscription> {
    return this.unsafe(`admin/drivers/${id}/subscription/`, input);
  }
  downloadDocument(id: number, admin: boolean): Promise<Blob> {
    return downloadPrivateDocument(
      `${admin ? "admin" : "driver"}/documents/${id}/download/`,
    );
  }
  driverContactRequests(): Promise<DriverContactRequests> {
    return request("driver/contact-requests/", "GET");
  }
  driverContactRequest(id: number): Promise<DriverContactRequest> {
    return request(`driver/contact-requests/${id}/`, "GET");
  }
  decideContactRequest(
    id: number,
    decision: "accept" | "decline",
  ): Promise<DriverContactRequest> {
    return this.unsafe(`driver/contact-requests/${id}/${decision}/`, {});
  }

  clear(): void {
    this.csrfToken = null;
  }
}
