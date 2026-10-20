import { APIErrorResponse } from '../types';
import { getCurrentTenantSubdomain } from '../lib/tenant';

let currentToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string | null) {
  currentToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  return currentToken;
}

export class AppAPIError extends Error {
  code: string;
  requestId?: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number, requestId?: string) {
    super(message);
    this.name = 'AppAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }

  if (typeof window !== 'undefined' && !headers.has('X-Tenant-Slug')) {
    try {
      const slug = getCurrentTenantSubdomain();
      if (slug) {
        headers.set('X-Tenant-Slug', slug);
      }
    } catch {}
  }

  const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://127.0.0.1:8080' : '');
  const path = endpoint.startsWith('/') ? endpoint : `/api/v1/${endpoint}`;
  const url = `${apiBase}${path}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      if (data && data.error) {
        const errPayload = data as APIErrorResponse;
        throw new AppAPIError(
          errPayload.error.message || 'حدث خطأ في الخادم',
          errPayload.error.code || 'UNKNOWN_ERROR',
          res.status,
          errPayload.request_id
        );
      }
      throw new AppAPIError(`HTTP Error: ${res.statusText}`, 'HTTP_ERROR', res.status);
    }

    if (!isJson) {
      throw new AppAPIError('الخادم لم يُرجع بيانات JSON', 'INVALID_RESPONSE', res.status);
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof AppAPIError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'تعذر الاتصال بالخادم';
    throw new AppAPIError(message, 'NETWORK_ERROR', 0);
  }
}
