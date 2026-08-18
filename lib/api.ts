import type { ApiError } from './types';

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 30000, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isForm = body instanceof FormData;

  try {
    const res = await fetch(path, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') ?? '';
    let payload: unknown = null;
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else if (res.status !== 204) {
      payload = await res.text();
    }

    if (!res.ok) {
      const err = payload as ApiError | null;
      throw new ApiRequestError(
        res.status,
        err?.error?.code ?? 'REQUEST_FAILED',
        err?.error?.message ?? `Request failed with status ${res.status}`,
        err?.error?.details
      );
    }

    return payload as T;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(408, 'TIMEOUT', 'The request took too long. Please try again.');
    }
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  } finally {
    clearTimeout(timer);
  }
}

export const apiGet = <T>(path: string, options?: RequestOptions) => api<T>(path, { ...options, method: 'GET' });
export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  api<T>(path, { ...options, method: 'POST', body });
export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  api<T>(path, { ...options, method: 'PUT', body });
export const apiDelete = <T>(path: string, options?: RequestOptions) => api<T>(path, { ...options, method: 'DELETE' });

export function fileQuery<T>(path: string, file: File, options: RequestOptions = {}): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return api<T>(path, { ...options, method: 'POST', body: form });
}

export async function downloadFile(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new ApiRequestError(res.status, 'DOWNLOAD_FAILED', 'Could not download the file');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition');
  let name = fallbackName;
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  if (match) name = match[1];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export function uploadCsv<T>(file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  return api<{ data: T }>('/api/candidates/import/preview', {
    method: 'POST',
    body: form,
  }).then((r) => r.data);
}

export function uploadExcel<T>(file: File): Promise<T> {
  return uploadCsv<T>(file);
}

export function pdfUrl(sessionId: string, hallId: string): string {
  return `/api/attendance-sheets/${sessionId}/${hallId}/pdf`;
}

export function htmlUrl(sessionId: string, hallId: string): string {
  return `/api/attendance-sheets/${sessionId}/${hallId}/html`;
} 