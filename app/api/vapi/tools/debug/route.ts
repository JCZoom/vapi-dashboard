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
  try {
    const body = await request.json();
    
    // Extract tool call info from the request
    const message = body.message || body;
    const toolCalls = message?.toolCallList || message?.toolWithToolCallList || [];
    
    // Find the tool call ID
    let toolCallId = 'unknown';
    if (toolCalls.length > 0) {
      const firstCall = toolCalls[0];
      toolCallId = firstCall.id || firstCall.toolCall?.id || 'unknown';
    }
    
    // Return a simple success response
    return NextResponse.json({
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify({
          success: true,
          message: 'Debug endpoint reached successfully',
          receivedType: message?.type || 'unknown',
          toolCallCount: toolCalls.length,
          timestamp: new Date().toISOString(),
        }),
      }],
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        result: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      }],
    }, { status: 200, headers: corsHeaders });
  }
}
