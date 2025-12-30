import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function proxyRequest(request: NextRequest, path: string) {
  const cookieStore = await cookies();

  // Try multiple cookie name variants (secure prefix used in production HTTPS)
  const sessionToken = cookieStore.get('authjs.session-token')?.value
    || cookieStore.get('__Secure-authjs.session-token')?.value
    || cookieStore.get('next-auth.session-token')?.value
    || cookieStore.get('__Secure-next-auth.session-token')?.value;

  // Debug: Log all cookies in production to diagnose auth issues
  if (process.env.NODE_ENV === 'production') {
    const allCookies = cookieStore.getAll();
    console.log('[Proxy] Available cookies:', allCookies.map(c => c.name).join(', '));
    console.log('[Proxy] Session token found:', !!sessionToken);
  }

  const headers: HeadersInit = {
    'Content-Type': request.headers.get('Content-Type') || 'application/json',
  };

  // Forward the session cookie - try both formats
  if (sessionToken) {
    headers['Cookie'] = `authjs.session-token=${sessionToken}; __Secure-authjs.session-token=${sessionToken}`;
  }

  const url = `${API_URL}/${path}`;

  if (process.env.NODE_ENV === 'production') {
    console.log('[Proxy] Forwarding to:', url);
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  // Forward body for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      fetchOptions.body = await request.text();
    } else {
      fetchOptions.body = await request.arrayBuffer();
    }
  }

  try {
    const response = await fetch(url, fetchOptions);

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip hop-by-hop headers
      if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path.join('/'));
}
