import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  // Super minimal endpoint - just echo back a hardcoded response
  const timestamp = new Date().toISOString();
  
  try {
    const body = await request.json();
    const toolCalls = body.message?.toolCalls || body.toolCalls || [];
    const toolCallId = toolCalls[0]?.id || 'unknown';
    
    return NextResponse.json({
      results: [{
        toolCallId,
        result: `Test successful at ${timestamp}. Form 1583 is a USPS form required to authorize iPostal1 to receive mail on your behalf.`,
      }]
    }, { headers: corsHeaders });
  } catch {
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        result: `Test endpoint reached at ${timestamp} but could not parse request.`,
      }]
    }, { headers: corsHeaders });
  }
}
