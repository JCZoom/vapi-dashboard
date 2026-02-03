import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneNumber, getPhoneLookupVariations } from '@/lib/phoneUtils';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Remove edge runtime to use AWS SDK
// export const runtime = 'edge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const FRESHSALES_BASE_URL = 'https://ipostal1-org.myfreshworks.com/crm/sales/api';

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

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
  };
}

async function searchKnowledgeBase(query: string): Promise<string> {
  try {
    const command = new InvokeCommand({
      FunctionName: 'kb-search',
      Payload: JSON.stringify({ query, k: 5 }),
    });

    const response = await lambda.send(command);
    
    if (response.Payload) {
      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      
      // Format results for voice response
      if (result.results && result.results.length > 0) {
        const topResults = result.results.slice(0, 3);
        const formattedParts: string[] = [];
        
        for (const r of topResults) {
          const meta = r.meta || {};
          const text = meta.text_cleaned || meta.raw_text || '';
          const title = meta.article_title || '';
          
          // Clean HTML and truncate for voice
          const cleanText = text.replace(/<[^>]*>/g, '').substring(0, 400);
          if (title) {
            formattedParts.push(`From "${title}": ${cleanText}`);
          } else {
            formattedParts.push(cleanText);
          }
        }
        
        return formattedParts.join('\n\n');
      }
    }
    
    return "I couldn't find specific information about that in our knowledge base.";
    
  } catch (error) {
    console.error('KB search error:', error);
    return "I'm having trouble accessing the knowledge base right now.";
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

    console.log('VAPI server event:', messageType);

    // Handle tool-calls event - this fires when the assistant calls a function tool
    if (messageType === 'tool-calls') {
      const toolCalls = body.message?.toolCalls || [];
      const results = [];

      for (const tc of toolCalls) {
        if (tc.function.name === 'search_knowledge_base') {
          const args = JSON.parse(tc.function.arguments || '{}');
          const query = args.query || '';
          
          console.log(`KB search tool called with query: ${query}`);
          const searchResult = await searchKnowledgeBase(query);
          
          results.push({
            toolCallId: tc.id,
            result: searchResult,
          });
        }
      }

      if (results.length > 0) {
        return NextResponse.json({ results }, { headers: corsHeaders });
      }
    }

    // Handle assistant-request event - this fires before the call starts
    if (messageType === 'assistant-request') {
      const customerPhone = body.message?.call?.customer?.number;
      let firstName: string | null = null;

      if (customerPhone && freshsalesToken) {
        firstName = await lookupCustomerName(customerPhone, freshsalesToken);
        console.log(`Looked up customer ${customerPhone}: ${firstName || 'not found'}`);
      }

      // Return assistant overrides with personalized firstMessage
      const personalizedGreeting = firstName
        ? `Hi ${firstName}! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`
        : `Hi! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`;

      return NextResponse.json({
        assistant: {
          firstMessage: personalizedGreeting,
          firstMessageMode: 'assistant-speaks-first',
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
