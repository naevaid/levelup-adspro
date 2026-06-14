const fallbackApiBaseUrl = "http://localhost:3001";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request gagal dengan status ${response.status}`;

    try {
      const body = (await response.json()) as
        | { message?: string | string[] }
        | undefined;

      if (Array.isArray(body?.message)) {
        message = body.message.join(", ");
      } else if (typeof body?.message === "string") {
        message = body.message;
      }
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as T;
}
