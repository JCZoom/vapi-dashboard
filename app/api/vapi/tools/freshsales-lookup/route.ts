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

interface FreshsalesContact {
  id: number;
  display_name?: string;
  email?: string;
  mobile_number?: string;
  custom_field?: {
    cf_mailbox_id?: string;
    cf_1583_doc_status?: string;
    cf_flagged_for_resubmission?: string;
    cf_belongs_to?: string;
  };
  tags?: string[];
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
  arguments?: Record<string, unknown>;  // VAPI sends arguments, not parameters
  type?: 'function';
  function?: {
    name: string;
    arguments: string;
  };
}

interface VapiToolWithToolCall {
  name?: string;
  toolCall: {
    id: string;
    parameters?: Record<string, unknown>;
    function?: {
      name: string;
      parameters?: Record<string, unknown>;
    };
  };
}

interface VapiMessage {
  type: string;
  toolCallList?: VapiToolCall[];
  toolWithToolCallList?: VapiToolWithToolCall[];
  toolCalls?: VapiToolCall[];  // Alternative format VAPI may use
  call?: {
    customer?: {
      number?: string;
    };
  };
}

interface LookupResult {
  success: boolean;
  contact?: {
    displayName: string;
    mailboxId: string;
    approvalStatus: string;
    flaggedForResubmission: string;
    belongsTo: string;
    tags: string[];
  };
  error?: string;
  needsPhoneNumber?: boolean;
  phoneSearched?: string;
  fieldSearched?: string;
  variationsTried?: string[];
}

async function lookupByPhone(
  phoneNumber: string,
  freshsalesToken: string
): Promise<LookupResult> {
  const variations = getPhoneLookupVariations(phoneNumber);
  const normalized = normalizePhoneNumber(phoneNumber);
  
  // Try ALL variations on mobile_number first (most reliable field)
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
          return {
            success: true,
            contact: {
              displayName: contact.display_name || 'Unknown',
              mailboxId: contact.custom_field?.cf_mailbox_id || '',
              approvalStatus: contact.custom_field?.cf_1583_doc_status || 'No Docs',
              flaggedForResubmission: contact.custom_field?.cf_flagged_for_resubmission || 'No',
              belongsTo: contact.custom_field?.cf_belongs_to || '',
              tags: contact.tags || [],
            },
            phoneSearched: variation,
            fieldSearched: 'mobile_number',
            variationsTried: variations,
          };
        }
      }
    } catch (error) {
      console.error(`Error looking up mobile_number ${variation}:`, error);
    }
  }

  // Only fallback to phone field if mobile_number found nothing
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
          return {
            success: true,
            contact: {
              displayName: contact.display_name || 'Unknown',
              mailboxId: contact.custom_field?.cf_mailbox_id || '',
              approvalStatus: contact.custom_field?.cf_1583_doc_status || 'No Docs',
              flaggedForResubmission: contact.custom_field?.cf_flagged_for_resubmission || 'No',
              belongsTo: contact.custom_field?.cf_belongs_to || '',
              tags: contact.tags || [],
            },
            phoneSearched: variation,
            fieldSearched: 'phone',
            variationsTried: variations,
          };
        }
      }
    } catch (error) {
      console.error(`Error looking up phone ${variation}:`, error);
    }
  }

  return {
    success: false,
    error: 'No contact found with the provided phone number',
    needsPhoneNumber: true,
    phoneSearched: normalized.withCountryCode,
    variationsTried: variations,
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
              error: 'FRESHSALES_API_TOKEN not configured on server',
            }),
          }],
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const body = await request.json();
    
    // Log received body for debugging
    console.log('VAPI webhook received - keys:', Object.keys(body), 'body:', JSON.stringify(body).substring(0, 500));
    
    // VAPI can send message at top level or nested
    const message: VapiMessage = body.message || body;
    
    // VAPI may send call info at multiple paths - check all possibilities
    const callInfo = message.call || body.call;

    // Handle assistant-request event - fires before call starts, allows personalized greeting
    if (message?.type === 'assistant-request') {
      const customerPhone = message.call?.customer?.number;
      let firstName: string | null = null;

      if (customerPhone) {
        // Quick lookup for first name only
        const variations = getPhoneLookupVariations(customerPhone);
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
                firstName = displayName.split(/\s+/)[0] || null;
                break;
              }
            }
          } catch (error) {
            console.error(`Greeting lookup error for ${variation}:`, error);
          }
        }
      }

      const personalizedGreeting = firstName
        ? `Hi ${firstName}! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`
        : `Hi! Thank you for calling iPostal1. I'm an AI assistant trained on all iPostal1 knowledge. How can I help you today?`;

      // Return assistantId with overrides - inherits all settings from Freddy AI
      // startSpeakingPlan configured here to allow delays beyond the 5s UI limit
      // Adjust START_SPEAKING_DELAY_SECONDS below to change the wait time
      const START_SPEAKING_DELAY_SECONDS = 10; // Configurable: seconds to wait before AI speaks (UI max is 5)
      
      return NextResponse.json({
        assistantId: '756e9d05-80e3-4922-99a5-928277d93206',
        assistantOverrides: {
          firstMessage: personalizedGreeting,
          firstMessageMode: 'assistant-speaks-first',
          // startSpeakingPlan: controls when AI starts speaking after call connects
          startSpeakingPlan: {
            waitSeconds: START_SPEAKING_DELAY_SECONDS,
            smartEndpointingEnabled: true,
            transcriptionEndpointingPlan: {
              onPunctuationSeconds: 0.5,
              onNoPunctuationSeconds: 1.5,
              onNumberSeconds: 0.5,
            },
          },
        },
      }, { headers: corsHeaders });
    }

    // SIMPLIFIED: If it's not assistant-request, treat it as a tool call
    // Extract tool call ID from ANY possible location
    const toolCallId = 
      body?.message?.toolCallList?.[0]?.id ||
      body?.message?.toolCalls?.[0]?.id ||
      body?.message?.toolWithToolCallList?.[0]?.toolCall?.id ||
      body?.toolCallList?.[0]?.id ||
      body?.toolCalls?.[0]?.id ||
      body?.toolWithToolCallList?.[0]?.toolCall?.id ||
      message?.toolCallList?.[0]?.id ||
      message?.toolCalls?.[0]?.id ||
      message?.toolWithToolCallList?.[0]?.toolCall?.id ||
      'fallback_tool_call';
    
    // Get phone number from ANY possible location
    const phoneNumber = 
      callInfo?.customer?.number ||
      body?.call?.customer?.number ||
      message?.call?.customer?.number ||
      body?.message?.call?.customer?.number;
    
    console.log('Tool call - ID:', toolCallId, 'Phone:', phoneNumber, 'Body keys:', Object.keys(body));
    
    // If we have a phone number, do the lookup
    if (phoneNumber) {
      const lookupResult = await lookupByPhone(phoneNumber, freshsalesToken);
      
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify(lookupResult),
        }]
      }, { status: 200, headers: corsHeaders });
    }
    
    // No phone number found - return error with debug info
    return NextResponse.json({
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify({
          success: false,
          error: 'No phone number found in request',
          needsPhoneNumber: true,
          debug: {
            bodyKeys: Object.keys(body),
            messageKeys: message ? Object.keys(message) : [],
            hasCall: !!body?.call || !!message?.call,
          }
        }),
      }]
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Freshsales lookup error:', error);
    return NextResponse.json(
      {
        results: [{
          toolCallId: 'error',
          result: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Lookup failed',
          }),
        }],
      },
      { status: 200, headers: corsHeaders }
    );
  }
}
