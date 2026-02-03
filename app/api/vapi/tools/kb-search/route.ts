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

// AWS Signature V4 signing for edge runtime (uses Web Crypto API)
const AWS_REGION = 'us-east-2';
const AWS_SERVICE = 'lambda';

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function getSignatureKey(secretKey: string, dateStamp: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretKey}`).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, AWS_SERVICE);
  return hmacSha256(kService, 'aws4_request');
}

async function invokeLambda(functionName: string, payload: object): Promise<unknown> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured');
  }

  const host = `lambda.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}/2015-03-31/functions/${functionName}/invocations`;
  const method = 'POST';
  const body = JSON.stringify(payload);
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256(body);
  
  // Create canonical request
  const canonicalUri = `/2015-03-31/functions/${functionName}/invocations`;
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  // Add timeout - VAPI has ~10s timeout for tools
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  console.log('Invoking Lambda:', functionName, 'at', new Date().toISOString());
  
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader,
      },
      body,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('Lambda response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lambda error:', response.status, errorText);
      throw new Error(`Lambda invocation failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Lambda result received, results count:', (result as {results?: unknown[]}).results?.length || 0);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      console.error('Lambda invocation timed out after 8s');
      throw new Error('Lambda timed out');
    }
    throw error;
  }
}

interface VapiToolCall {
  id: string;
  function?: {
    name: string;
    arguments: string;
  };
}

interface VapiMessage {
  type?: string;
  toolCalls?: VapiToolCall[];
  toolCallList?: VapiToolCall[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('=== KB SEARCH REQUEST START ===', new Date().toISOString());
  console.log('Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));
  
  try {
    const rawBody = await request.text();
    console.log('Raw body length:', rawBody.length);
    console.log('Raw body preview:', rawBody.substring(0, 500));
    
    const body = JSON.parse(rawBody);
    const message: VapiMessage = body.message || body;
    
    // Extract tool call info - try all possible locations
    const toolCalls = message.toolCalls || message.toolCallList || body.toolCalls || body.toolCallList || [];
    console.log('Parsed toolCalls count:', toolCalls.length);
    
    if (toolCalls.length === 0) {
      return NextResponse.json({
        results: [{
          toolCallId: 'error',
          result: 'No tool calls found in request',
        }]
      }, { headers: corsHeaders });
    }
    
    const results = [];
    
    for (const tc of toolCalls) {
      const toolCallId = tc.id || 'unknown';
      let query = '';
      
      // Extract query from arguments
      if (tc.function?.arguments) {
        try {
          const args = JSON.parse(tc.function.arguments);
          query = args.query || '';
        } catch {
          query = tc.function.arguments;
        }
      }
      
      if (!query) {
        results.push({
          toolCallId,
          result: "I couldn't understand the search query. Could you please rephrase your question?",
        });
        continue;
      }
      
      console.log('KB search query:', query);
      
      try {
        // Invoke Lambda
        const lambdaResult = await invokeLambda('kb-search', { query, k: 5 }) as {
          results?: Array<{ meta?: { text_cleaned?: string; raw_text?: string; article_title?: string } }>;
          error?: string;
        };
        
        // Format results for voice
        if (lambdaResult.results && lambdaResult.results.length > 0) {
          const formattedParts: string[] = [];
          
          for (const r of lambdaResult.results.slice(0, 3)) {
            const meta = r.meta || {};
            const text = (meta.text_cleaned || meta.raw_text || '').replace(/<[^>]*>/g, '').substring(0, 400);
            const title = meta.article_title || '';
            
            if (title && text) {
              formattedParts.push(`From "${title}": ${text}`);
            } else if (text) {
              formattedParts.push(text);
            }
          }
          
          // CRITICAL: VAPI requires single-line strings - newlines cause parsing errors
          const resultText = formattedParts.join(' ').replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
          results.push({
            toolCallId,
            result: resultText || "I found some information but couldn't format it properly.",
          });
        } else {
          // DEBUG: Include what we got from Lambda
          results.push({
            toolCallId,
            result: `DEBUG: Lambda returned ${lambdaResult.results?.length || 0} results for query "${query}". Raw: ${JSON.stringify(lambdaResult).substring(0, 200)}`,
          });
        }
      } catch (error) {
        console.error('KB search Lambda error:', error);
        // DEBUG: Include error details
        results.push({
          toolCallId,
          result: `DEBUG ERROR: ${(error as Error).message || 'Unknown error'} for query "${query}"`,
        });
      }
    }
    
    const responseObj = { results };
    console.log('=== SENDING RESPONSE ===');
    console.log('Response:', JSON.stringify(responseObj));
    console.log('Total time:', Date.now() - startTime, 'ms');
    return NextResponse.json(responseObj, { headers: corsHeaders });
    
  } catch (error) {
    console.error('KB search error:', error);
    console.log('Error after', Date.now() - startTime, 'ms');
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        result: "I'm having trouble processing your request. Would you like me to connect you with an agent?",
      }]
    }, { headers: corsHeaders });
  }
}
