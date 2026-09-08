export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | null | undefined>;
};

export function createApiClient(baseUrl: string) {
  async function request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = response.status === 204 ? null : await response.json();

    if (!response.ok) {
      const errorPayload = payload as ApiErrorPayload;
      throw new ApiError(
        response.status,
        errorPayload.error?.code ?? "request_failed",
        errorPayload.error?.message ?? "Request failed",
      );
    }

    return payload as TResponse;
  }

  return {
    get: <TResponse>(path: string, options?: RequestOptions) => request<TResponse>(path, { ...options, method: "GET" }),
    post: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
      request<TResponse>(path, { ...options, method: "POST", body }),
  };
}
