import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const VAPI_BASE_URL = 'https://api.vapi.ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    const { path, method, headers: customHeaders, body } = await request.json();

    if (!path || !method) {
      return NextResponse.json(
        { error: 'Missing required fields: path, method' },
        { status: 400 }
      );
    }

    const url = `${VAPI_BASE_URL}${path}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...customHeaders,
      },
    };

    if (body && ['POST', 'PATCH', 'PUT'].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
    });
  } catch (error) {
    console.error('Vapi proxy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Proxy request failed' },
      { status: 500 }
    );
  }
}
