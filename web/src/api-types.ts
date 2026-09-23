// Generated from backend/openapi.json. Do not edit by hand.
export type Health = { status: "ok" };
export type Csrf = { csrf_token: string };
export type Identity = {
  id: number;
  email: string;
  role: "parent" | "driver" | "admin";
  display_name: string | null;
};
export type LoginResponse = {
  id: number;
  email: string;
  role: "parent" | "driver" | "admin";
  display_name: string | null;
  csrf_token: string;
};
export type RegisterRequest = {
  email: string;
  password: string;
  role: "parent" | "driver";
  display_name: string;
};
export type LoginRequest = { email: string; password: string };
export type LogoutResponse = { ok: true };
