import { apiRequest } from "@/api/client";
import type { Session } from "@/auth/types";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** `POST /api/auth` — creates the account and a server session. */
export function register(input: RegisterInput): Promise<Session> {
  return apiRequest<Session>("/auth", { method: "POST", body: input });
}

export interface LoginInput {
  email: string;
  password: string;
}

/** `PUT /api/auth` — verifies credentials and creates a server session. */
export function login(input: LoginInput): Promise<Session> {
  return apiRequest<Session>("/auth", { method: "PUT", body: input });
}

/** `POST /api/auth/forgot-password` — emails a reset link if the account exists. */
export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiRequest("/auth/forgot-password", { method: "POST", body: { email } });
}

/** `POST /api/auth/reset-password/verify` — checks a reset link without using it up. */
export function verifyResetToken(token: string): Promise<{ valid: true }> {
  return apiRequest("/auth/reset-password/verify", { method: "POST", body: { token } });
}

/** `POST /api/auth/reset-password` — sets a new password using the emailed token. */
export function resetPassword(token: string, password: string): Promise<{ message: string }> {
  return apiRequest("/auth/reset-password", { method: "POST", body: { token, password } });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Path for `PUT /api/auth/password`; call it through `useAuth().authRequest` so the session token is sent. */
export const CHANGE_PASSWORD_PATH = "/auth/password";

/** `DELETE /api/auth` — ends the server session for this token. */
export function logout(token: string): Promise<{ message: string }> {
  return apiRequest("/auth", { method: "DELETE", token });
}
