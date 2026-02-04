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

// Critical FAQ fallbacks for questions where Lambda search fails
// ORDER MATTERS: Specific checks MUST come before general checks
function getCriticalFallback(query: string): string | null {
  // SPECIFIC CHECKS FIRST (before general 1583 check)
  
  // Bank notary / different location / other notary locations
  if (query.includes('different') || query.includes('bank') || query.includes('other location') ||
      (query.includes('notari') && (query.includes('location') || query.includes('where')))) {
    return "No, you cannot use bank notaries, other iPostal1 locations, or any other notary. You must notarize at YOUR specific mail center location or use the online notary at proof.com.";
  }
  
  // International / outside US
  if (query.includes('outside') || query.includes('international') || query.includes('abroad') || 
      (query.includes('live') && !query.includes('how'))) {
    return "If you live outside the US, you must use the online notary service at proof.com to notarize your Form 1583. In-person notarization at the mail center is not available for international customers.";
  }
  
  // How to notarize (general)
  if (query.includes('notari') && (query.includes('how') || query.includes('get'))) {
    return "You can get your Form 1583 notarized in two ways: online through proof.com for $25, or in person at your specific mail center location. Bank notaries and other locations are not accepted.";
  }
  
  // Add spouse / additional person
  if (query.includes('spouse') || (query.includes('add') && (query.includes('person') || query.includes('someone') || query.includes('recipient')))) {
    return "To add a spouse or additional recipient, they need their own Form 1583, two valid IDs, and notarization via proof.com or at your mail center. There's a $5 discount for additional recipients notarized in the same session.";
  }
  
  // GENERAL CHECKS LAST
  
  // What is 1583 / Form 1583 (only if asking "what is")
  if (query.includes('1583') && query.includes('what')) {
    return "Form 1583 is a USPS authorization form that allows iPostal1 to receive and handle mail on your behalf. It's required for all virtual mailbox accounts and must be notarized.";
  }
  
  // Scan cost
  if (query.includes('scan') && (query.includes('cost') || query.includes('much') || query.includes('price'))) {
    return "Scanning costs $2.25 for the first 10 pages, then $0.25 for each additional page. Scan and shred bundles are available at a discount.";
  }
  
  // Discard vs shred
  if ((query.includes('discard') || query.includes('shred')) && (query.includes('difference') || query.includes('vs'))) {
    return "Discarding is free and mail goes to regular trash. Shredding costs $2.25 and securely destroys documents - recommended for sensitive mail.";
  }
  
  return null;
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
      
      // Extract query from arguments - handle all possible formats from VAPI
      const rawArgs = tc.function?.arguments || tc.parameters || {};
      console.log('Raw args type:', typeof rawArgs, 'value:', JSON.stringify(rawArgs).substring(0, 200));
      
      if (typeof rawArgs === 'string') {
        try {
          const args = JSON.parse(rawArgs);
          query = typeof args.query === 'string' ? args.query : String(args.query || '');
        } catch {
          query = rawArgs;
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        const argsObj = rawArgs as Record<string, unknown>;
        const queryVal = argsObj.query;
        // Ensure query is always a string
        if (typeof queryVal === 'string') {
          query = queryVal;
        } else if (queryVal && typeof queryVal === 'object') {
          // Query might be nested - try to extract
          query = JSON.stringify(queryVal);
        } else if (queryVal) {
          query = String(queryVal);
        }
      }
      
      // Final safety check - ensure query is a non-empty string
      if (typeof query !== 'string' || !query.trim()) {
        console.log('Query extraction failed, got:', typeof query, query);
        results.push({
          toolCallId,
          result: "I couldn't understand the search query. Could you please rephrase your question?",
        });
        continue;
      }
      query = query.trim();
      
      if (!query) {
        results.push({
          toolCallId,
          result: "I couldn't understand the search query. Could you please rephrase your question?",
        });
        continue;
      }
      
      console.log('KB search query:', query);
      const queryLower = query.toLowerCase();
      
      // CRITICAL FAQ FALLBACKS - bypass Lambda for key questions
      const criticalFallback = getCriticalFallback(queryLower);
      if (criticalFallback) {
        console.log('Using critical fallback for query');
        results.push({
          toolCallId,
          result: `ANSWER THE CUSTOMER NOW: ${criticalFallback}`,
        });
        continue;
      }
      
      try {
        // Invoke Lambda
        const lambdaResult = await invokeLambda('kb-search', { query, k: 5 }) as {
          results?: Array<{ meta?: { text_cleaned?: string; raw_text?: string; article_title?: string } }>;
          error?: string;
        };
        
        // Format results for voice - find first result with actual content
        if (lambdaResult.results && lambdaResult.results.length > 0) {
          let finalText = '';
          
          for (const result of lambdaResult.results.slice(0, 5)) {
            const meta = result.meta || {};
            let text = meta.text_cleaned || meta.raw_text || '';
            
            // Clean up text
            text = text
              .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
              .replace(/#+\s*/g, '')  // Remove # symbols
              .replace(/Click for Full View/gi, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/[\n\r]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Skip if mostly empty (less than 50 chars of real content)
            if (text.length >= 50) {
              finalText = text.substring(0, 400);
              break;
            }
          }
          
          // Fallback to first article title if no good content found
          if (!finalText) {
            const title = lambdaResult.results[0]?.meta?.article_title;
            finalText = title ? `I found an article about ${title}. Would you like me to connect you with an agent for more details?` : '';
          }
          
          results.push({
            toolCallId,
            result: `ANSWER THE CUSTOMER NOW: ${finalText || "I couldn't find detailed information. Let me connect you with an agent."}`,
          });
        } else {
          results.push({
            toolCallId,
            result: "ANSWER THE CUSTOMER NOW: I couldn't find specific information about that in our knowledge base. Would you like me to connect you with an agent?",
          });
        }
      } catch (error) {
        console.error('KB search Lambda error:', error);
        results.push({
          toolCallId,
          result: "ANSWER THE CUSTOMER NOW: I'm having trouble accessing our knowledge base right now. Let me connect you with an agent who can help.",
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
