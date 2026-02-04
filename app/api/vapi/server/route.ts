import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber, getPhoneLookupVariations } from '@/lib/phoneUtils';

export const runtime = 'edge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const FRESHSALES_BASE_URL = 'https://ipostal1-org.myfreshworks.com/crm/sales/api';
const AWS_REGION = 'us-east-2';
const AWS_SERVICE = 'lambda';

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface VapiServerMessage {
  message: {
    type: string;
    call?: {
      customer?: {
        number?: string;
      };
    };
    toolCalls?: ToolCall[];
    toolCallList?: ToolCall[];
    toolWithToolCallList?: Array<{ toolCall: ToolCall }>;
  };
}

// AWS Signature V4 functions for Lambda invocation
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
  
  const canonicalUri = `/2015-03-31/functions/${functionName}/invocations`;
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256(canonicalRequest)].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
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

async function searchKnowledgeBase(query: string): Promise<string> {
  try {
    console.log('Searching KB for:', query);
    const lambdaResult = await invokeLambda('kb-search', { query, k: 5 }) as {
      results?: Array<{ meta?: { text_cleaned?: string; raw_text?: string; article_title?: string } }>;
      error?: string;
    };
    
    console.log('Lambda result count:', lambdaResult.results?.length || 0);
    
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
      
      return formattedParts.join('\n\n') || "I found some information but couldn't format it properly.";
    }
    
    return "I couldn't find specific information about that in our knowledge base. Would you like me to connect you with an agent?";
  } catch (error) {
    console.error('KB search error:', error);
    return "I'm having trouble accessing our knowledge base right now. Let me connect you with an agent who can help.";
  }
}

async function lookupCustomerName(phoneNumber: string, freshsalesToken: string): Promise<string | null> {
  const variations = getPhoneLookupVariations(phoneNumber);
  
  for (const variation of variations) {
    try {
      const url = `${FRESHSALES_BASE_URL}/lookup?q=${encodeURIComponent(variation)}&f=mobile_number&entities=contact`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token token=${freshsalesToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const contacts = data.contacts?.contacts;
        if (contacts && contacts.length > 0) {
          const displayName = contacts[0].display_name || '';
          const firstName = displayName.split(/\s+/)[0];
          return firstName || null;
        }
      }
    } catch (error) {
      console.error(`Error looking up ${variation}:`, error);
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const freshsalesToken = process.env.FRESHSALES_API_TOKEN;
    const body: VapiServerMessage = await request.json();
    const messageType = body.message?.type;

    console.log('VAPI server event:', messageType, new Date().toISOString());

    // DO NOT handle tool-calls here - let the tool's own server.url handle them
    // This endpoint only handles assistant-request for personalized greetings
    if (messageType === 'tool-calls') {
      console.log('Tool-calls received at server endpoint - returning empty to let tool server handle');
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // Handle assistant-request event - this fires before the call starts
    if (messageType === 'assistant-request') {
      const customerPhone = body.message?.call?.customer?.number;
      let firstName: string | null = null;

      if (customerPhone && freshsalesToken) {
        firstName = await lookupCustomerName(customerPhone, freshsalesToken);
        console.log(`Looked up customer ${customerPhone}: ${firstName || 'not found'}`);
      }

      // Return the Freddy AI assistant ID with personalized greeting override
      const personalizedGreeting = firstName
        ? `Hi ${firstName}! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`
        : `Hi! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`;

      return NextResponse.json({
        assistantId: '756e9d05-80e3-4922-99a5-928277d93206',
        assistantOverrides: {
          firstMessage: personalizedGreeting,
        },
      }, { headers: corsHeaders });
    }

    // For other events, just acknowledge
    return NextResponse.json({ success: true }, { headers: corsHeaders });

  } catch (error) {
    console.error('VAPI server error:', error);
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }
}
