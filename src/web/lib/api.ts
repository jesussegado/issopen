export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields: FieldError[] = [],
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    const intended = `${window.location.pathname}${window.location.search}`;
    const signIn = `/sign-in?returnTo=${encodeURIComponent(intended)}`;
    window.location.assign(signIn);
    throw new ApiError(401, "Authentication required");
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: FieldError[];
  };
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error ?? "Request failed",
      body.fields ?? [],
    );
  }
  return body as T;
}

export function unavailable(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.status === 404)
  );
}
