/** Error thrown for any non-2xx response, carrying the HTTP status and the server's message. */
export class ApiError extends Error {
  readonly status: number;
  /** Machine-readable reason, when the server sends one (e.g. "invalid_reset_link"). */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  /** Serialized as JSON. */
  body?: unknown;
  /** Session token, sent as `Authorization: Bearer <token>`. */
  token?: string | null;
  signal?: AbortSignal;
}

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Single entry point for calls to our API. Paths are relative to `/api`
 * (proxied to the server in development by vite.config.ts).
 *
 * Throws `ApiError` for HTTP errors; network failures propagate as the
 * browser's `TypeError` so callers can tell the two apart.
 */
export async function apiRequest<T>(path: string, { method = "GET", body, token, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? DEFAULT_ERROR_MESSAGE, data?.code);
  }
  return data as T;
}
