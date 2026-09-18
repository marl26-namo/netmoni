export type HttpRequest = { url: string; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; headers?: Record<string, string>; body?: unknown };

export async function request<T = unknown>(input: HttpRequest): Promise<T> {
  const response = await fetch(input.url, { method: input.method ?? "GET", headers: { "content-type": "application/json", ...(input.headers ?? {}) }, body: input.body ? JSON.stringify(input.body) : undefined });
  if (!response.ok) throw new Error(`HTTP connector failed with ${response.status}`);
  return response.json() as Promise<T>;
}
