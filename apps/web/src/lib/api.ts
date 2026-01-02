// API utility for making authenticated requests
// Uses the proxy route to forward session cookies properly in production

/**
 * Get the base API URL for making requests.
 * - In browser: Uses /api/proxy to forward cookies cross-origin
 * - On server: Uses direct API URL
 */
export function getApiUrl(): string {
  // Server-side: use direct API URL
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // Client-side in production: use proxy to handle cookies
  if (process.env.NODE_ENV === 'production') {
    return '/api/proxy';
  }

  // Client-side in development: direct API (same-origin cookies work)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/**
 * Make an authenticated API request.
 * Automatically includes credentials and handles the proxy.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getApiUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}
// Redeploy trigger: Thu Jan 02 2026
