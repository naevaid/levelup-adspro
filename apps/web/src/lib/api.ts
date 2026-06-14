const fallbackApiBaseUrl = "http://localhost:3001";

export function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return fallbackApiBaseUrl;
}

function buildApiUrl(path: string) {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${baseUrl}${normalizedPath.slice(4)}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Tidak bisa terhubung ke API. Cek koneksi atau konfigurasi server.",
    );
  }

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
