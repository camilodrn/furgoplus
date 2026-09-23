import type {
  Csrf,
  Health,
  Identity,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  RegisterRequest,
} from "./api-types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  csrfToken?: string,
  signal?: AbortSignal,
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
    },
    signal,
  };
  if (method === "POST") options.body = JSON.stringify(body ?? {});
  const response = await fetch(`/api/v1/${path}`, options);
  const value: unknown = await response.json();
  if (!response.ok) {
    const error = value as { code?: string; message?: string };
    throw new ApiError(
      response.status,
      error?.code ?? "error",
      error?.message ?? "Request failed.",
    );
  }
  return value as T;
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

  private async unsafe<T>(path: string, body: unknown): Promise<T> {
    if (!this.csrfToken) await this.csrf();
    try {
      return await request<T>(path, "POST", body, this.csrfToken!);
    } catch (error) {
      if (error instanceof ApiError && error.code === "csrf_failed")
        await this.csrf();
      throw error;
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

  clear(): void {
    this.csrfToken = null;
  }
}
