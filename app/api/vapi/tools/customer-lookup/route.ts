import { NextRequest, NextResponse } from 'next/server';
import { getPhoneLookupVariations } from '@/lib/phoneUtils';

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

interface FreshsalesContact {
  id: number;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
}

interface FreshsalesLookupResponse {
  contacts?: {
    contacts?: FreshsalesContact[];
  };
}

interface VapiToolCall {
  id: string;
  name?: string;
  parameters?: Record<string, unknown>;
  type?: 'function';
  function?: {
    name: string;
    arguments: string;
  };
}

interface VapiToolMessage {
  type: 'tool-calls';
  toolCallList?: VapiToolCall[];
  toolWithToolCallList?: Array<{
    name?: string;
    toolCall: {
      id: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  call?: {
    customer?: {
      number?: string;
    };
  };
}

interface CustomerLookupResult {
  success: boolean;
  firstName?: string;
  displayName?: string;
  isKnownCustomer: boolean;
  error?: string;
}

function extractFirstName(displayName: string): string {
  // Display name is typically "First Last" or "First Middle Last"
  // Extract just the first name
  const parts = displayName.trim().split(/\s+/);
  return parts[0] || '';
}

async function lookupCustomerByPhone(
  phoneNumber: string,
  freshsalesToken: string
): Promise<CustomerLookupResult> {
  const variations = getPhoneLookupVariations(phoneNumber);
  
  // Try mobile_number field first
  for (const variation of variations) {
    try {
      const mobileUrl = `${FRESHSALES_BASE_URL}/lookup?q=${encodeURIComponent(variation)}&f=mobile_number&entities=contact`;
      
      const response = await fetch(mobileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Token token=${freshsalesToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: FreshsalesLookupResponse = await response.json();
        const contacts = data.contacts?.contacts;
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          const displayName = contact.display_name || '';
          const firstName = contact.first_name || extractFirstName(displayName);
          
          return {
            success: true,
            firstName: firstName,
            displayName: displayName,
            isKnownCustomer: true,
          };
        }
      }
    } catch (error) {
      console.error(`Error looking up mobile_number ${variation}:`, error);
    }
  }

  // Fallback to phone field
  for (const variation of variations) {
    try {
      const phoneUrl = `${FRESHSALES_BASE_URL}/lookup?q=${encodeURIComponent(variation)}&f=phone&entities=contact`;
      
      const phoneResponse = await fetch(phoneUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Token token=${freshsalesToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (phoneResponse.ok) {
        const data: FreshsalesLookupResponse = await phoneResponse.json();
        const contacts = data.contacts?.contacts;
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          const displayName = contact.display_name || '';
          const firstName = contact.first_name || extractFirstName(displayName);
          
          return {
            success: true,
            firstName: firstName,
            displayName: displayName,
            isKnownCustomer: true,
          };
        }
      }
    } catch (error) {
      console.error(`Error looking up phone ${variation}:`, error);
    }
  }

  return {
    success: true,
    isKnownCustomer: false,
    firstName: '',
    displayName: '',
  };
}

export async function POST(request: NextRequest) {
  try {
    const freshsalesToken = process.env.FRESHSALES_API_TOKEN;

    if (!freshsalesToken) {
      return NextResponse.json(
        {
          results: [{
            toolCallId: 'error',
            result: JSON.stringify({
              success: false,
              isKnownCustomer: false,
              error: 'FRESHSALES_API_TOKEN not configured on server',
            }),
          }],
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const body = await request.json();
    
    // VAPI can send message at top level or nested
    const message: VapiToolMessage = body.message || body;

    // Handle VAPI tool call format
    if (message?.type === 'tool-calls' && (message.toolCallList || message.toolWithToolCallList)) {
      const toolCalls: VapiToolCall[] = message.toolCallList || 
        (message.toolWithToolCallList?.map((t) => ({ 
          id: t.toolCall?.id, 
          name: t.name,
          parameters: t.toolCall?.parameters 
        })) || []);
      
      const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const toolName = toolCall.name || toolCall.function?.name;
          const toolArgs = toolCall.parameters || 
            (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});
          
          if (toolName === 'lookup_customer_for_greeting') {
            // Get phone number from call customer data (caller ID)
            let phoneNumber = toolArgs.phone_number as string | undefined;
            
            if (!phoneNumber && message.call?.customer?.number) {
              phoneNumber = message.call.customer.number;
            }

            if (!phoneNumber) {
              return {
                toolCallId: toolCall.id,
                result: JSON.stringify({
                  success: true,
                  isKnownCustomer: false,
                  firstName: '',
                  message: 'No caller phone number available',
                }),
              };
            }

            const lookupResult = await lookupCustomerByPhone(phoneNumber, freshsalesToken);
            
            return {
              toolCallId: toolCall.id,
              result: JSON.stringify(lookupResult),
            };
          }

          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({
              success: false,
              error: `Unknown tool: ${toolName}`,
            }),
          };
        })
      );

      return NextResponse.json({ results }, { headers: corsHeaders });
    }

    // Fallback for direct API calls (testing)
    const { phone_number } = body;
    
    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phone_number is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await lookupCustomerByPhone(phone_number, freshsalesToken);
    return NextResponse.json(result, { headers: corsHeaders });

  } catch (error) {
    console.error('Customer lookup error:', error);
    return NextResponse.json(
      {
        results: [{
          toolCallId: 'error',
          result: JSON.stringify({
            success: false,
            isKnownCustomer: false,
            error: error instanceof Error ? error.message : 'Lookup failed',
          }),
        }],
      },
      { status: 200, headers: corsHeaders }
    );
  }
}
