import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const FRESHCALLER_BASE_URL = process.env.FRESHCALLER_DOMAIN 
  ? `https://${process.env.FRESHCALLER_DOMAIN}/api/v1`
  : null;

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.FRESHCALLER_API_KEY;
    const baseUrl = FRESHCALLER_BASE_URL;

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: 'FRESHCALLER_API_KEY or FRESHCALLER_DOMAIN not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const perPage = searchParams.get('per_page') || '20';
    const page = searchParams.get('page') || '1';

    const response = await fetch(
      `${baseUrl}/calls?per_page=${perPage}&page=${page}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Api-Auth': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Freshcaller API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Freshcaller calls error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
