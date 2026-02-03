import { NextRequest, NextResponse } from 'next/server';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const LAMBDA_FUNCTION_NAME = 'kb-search';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // Invoke Lambda
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify(body),
    });
    
    const response = await lambda.send(command);
    
    if (response.Payload) {
      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      const elapsed = Date.now() - startTime;
      console.log(`KB search completed in ${elapsed}ms`);
      
      // For VAPI tool calls, return the results directly
      if (result.results && Array.isArray(result.results) && result.results[0]?.toolCallId) {
        return NextResponse.json(result);
      }
      
      // For direct search, add timing info
      return NextResponse.json({
        ...result,
        proxy_time_ms: elapsed,
      });
    }
    
    return NextResponse.json({ error: 'No response from Lambda' }, { status: 500, headers: corsHeaders });
    
  } catch (error) {
    console.error('KB search error:', error);
    return NextResponse.json(
      { error: `KB search failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  try {
    const command = new InvokeCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({}),
    });
    
    const response = await lambda.send(command);
    
    if (response.Payload) {
      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      return NextResponse.json(result);
    }
    
    return NextResponse.json({ status: 'ok', lambda: 'unreachable' });
    
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
