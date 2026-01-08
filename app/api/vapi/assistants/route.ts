import { NextResponse } from 'next/server';

export const runtime = 'edge';

const VAPI_BASE_URL = 'https://api.vapi.ai';

export async function GET() {
  try {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    const response = await fetch(`${VAPI_BASE_URL}/assistant`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch assistants' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch assistants error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch assistants' },
      { status: 500 }
    );
  }
}
