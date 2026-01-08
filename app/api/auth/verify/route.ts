import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    const accessCode = process.env.DASHBOARD_ACCESS_CODE;

    if (!accessCode) {
      return NextResponse.json(
        { success: false, error: 'Access code not configured on server' },
        { status: 500 }
      );
    }

    const success = code === accessCode;

    return NextResponse.json({ success });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
