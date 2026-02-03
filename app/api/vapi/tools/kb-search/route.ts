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
  
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      'Authorization': authorizationHeader,
    },
    body,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lambda error:', response.status, errorText);
    throw new Error(`Lambda invocation failed: ${response.status}`);
  }
  
  return response.json();
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
  try {
    const body = await request.json();
    const message: VapiMessage = body.message || body;
    
    console.log('KB search request received:', JSON.stringify(body).substring(0, 300));
    
    // Extract tool call info
    const toolCalls = message.toolCalls || message.toolCallList || body.toolCalls || body.toolCallList || [];
    
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
      
      // TEMPORARY: Hardcoded response to test if VAPI integration works
      // Remove this block once we confirm the flow works
      if (query.toLowerCase().includes('1583') || query.toLowerCase().includes('form')) {
        results.push({
          toolCallId,
          result: "Form 1583 is a USPS form required to authorize a mail center to receive mail on your behalf. All iPostal1 customers must complete and notarize this form. You can complete Form 1583 online through our website, and notarization can be done remotely using our online notary service.",
        });
        continue;
      }
      
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
          
          results.push({
            toolCallId,
            result: formattedParts.join('\n\n') || "I found some information but couldn't format it properly.",
          });
        } else {
          results.push({
            toolCallId,
            result: "I couldn't find specific information about that in our knowledge base. Would you like me to connect you with an agent?",
          });
        }
      } catch (error) {
        console.error('KB search Lambda error:', error);
        results.push({
          toolCallId,
          result: "I'm having trouble accessing our knowledge base right now. Let me connect you with an agent who can help.",
        });
      }
    }
    
    return NextResponse.json({ results }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('KB search error:', error);
    return NextResponse.json({
      results: [{
        toolCallId: 'error',
        result: "I'm having trouble processing your request. Would you like me to connect you with an agent?",
      }]
    }, { headers: corsHeaders });
  }
}
