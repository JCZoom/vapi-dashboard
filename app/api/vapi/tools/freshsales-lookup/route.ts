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
    
    // DEBUG MODE: Return received body so we can see what VAPI actually sends
    // This will show up in the VAPI call logs
    const DEBUG_CAPTURE = true;
    if (DEBUG_CAPTURE && !body.debug_bypass) {
      // Extract any tool call ID we can find
      const toolCallId = body?.message?.toolCallList?.[0]?.id ||
                        body?.message?.toolCalls?.[0]?.id ||
                        body?.message?.toolWithToolCallList?.[0]?.toolCall?.id ||
                        body?.toolCallList?.[0]?.id ||
                        body?.toolCalls?.[0]?.id ||
                        'unknown_tool_call';
      
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify({
            debug: true,
            message: 'Captured VAPI request for debugging',
            receivedBodyKeys: Object.keys(body),
            receivedBody: body,
          })
        }]
      }, { status: 200, headers: corsHeaders });
    }
    
    // Debug: Log the full body structure to understand VAPI's payload
    console.log('VAPI webhook received:', JSON.stringify(body, null, 2));
    
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

      // Return assistantId with overrides - inherits all settings (voice, model, startSpeakingPlan, etc.) from Freddy AI
      // startSpeakingPlan is NOT overridden here - control it via VAPI dashboard
      return NextResponse.json({
        assistantId: '756e9d05-80e3-4922-99a5-928277d93206',
        assistantOverrides: {
          firstMessage: personalizedGreeting,
          firstMessageMode: 'assistant-speaks-first',
        },
      }, { headers: corsHeaders });
    }

    // AGGRESSIVE tool call detection - try to find tool calls ANYWHERE in the body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function findToolCalls(obj: any): VapiToolCall[] {
      if (!obj) return [];
      // Direct arrays
      if (obj.toolCallList) return obj.toolCallList;
      if (obj.toolCalls) return obj.toolCalls;
      if (obj.toolWithToolCallList) {
        return obj.toolWithToolCallList.map((t: VapiToolWithToolCall) => ({
          id: t.toolCall?.id || t.toolCall?.function?.name,
          name: t.name,
          arguments: t.toolCall?.parameters || t.toolCall?.function?.parameters,
        }));
      }
      // Check nested message
      if (obj.message) return findToolCalls(obj.message);
      return [];
    }
    
    const toolCalls = findToolCalls(body);
    const hasToolCalls = toolCalls.length > 0 || message?.type === 'tool-calls';
    
    console.log('Tool call detection - found:', toolCalls.length, 'tools, type:', message?.type, 'body keys:', Object.keys(body));
    
    if (hasToolCalls) {
      console.log('Tool calls detected:', JSON.stringify(toolCalls, null, 2));
      
      // If no tool calls found but type is tool-calls, return debug info
      if (toolCalls.length === 0) {
        return NextResponse.json({
          results: [{
            toolCallId: 'no_tools_found',
            result: JSON.stringify({
              success: false,
              error: 'No tool calls found in request',
              receivedBody: body,
            })
          }]
        }, { status: 200, headers: corsHeaders });
      }
      
      const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
          // VAPI sends: { name, arguments } or { name, parameters } or { function: { name, arguments } }
          const toolName = toolCall.name || toolCall.function?.name;
          const toolArgs = toolCall.arguments || toolCall.parameters || 
            (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});
          
          if (toolName === 'check_1583_status') {
            // Priority 1: Use provided phone number from arguments
            // Priority 2: Use caller's phone number from the call (check multiple paths)
            let phoneNumber = toolArgs.phone_number;
            
            if (!phoneNumber) {
              // Try multiple paths where VAPI might put customer number
              phoneNumber = callInfo?.customer?.number || 
                           body.call?.customer?.number ||
                           message.call?.customer?.number;
            }
            
            console.log('check_1583_status - phoneNumber:', phoneNumber, 'from args:', toolArgs.phone_number);

            if (!phoneNumber) {
              return {
                toolCallId: toolCall.id,
                result: JSON.stringify({
                  success: false,
                  error: 'No phone number provided. Please ask the customer for their phone number.',
                  needsPhoneNumber: true,
                }),
              };
            }

            const lookupResult = await lookupByPhone(phoneNumber, freshsalesToken);
            
            return {
              toolCallId: toolCall.id,
              result: JSON.stringify(lookupResult),
            };
          }

          // Handle customer greeting lookup tool
          if (toolName === 'lookup_customer_for_greeting') {
            let phoneNumber = toolArgs.phone_number as string | undefined;
            
            if (!phoneNumber) {
              phoneNumber = callInfo?.customer?.number || 
                           body.call?.customer?.number ||
                           message.call?.customer?.number;
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

            // Look up customer and extract first name
            const lookupResult = await lookupByPhone(phoneNumber, freshsalesToken);
            
            if (lookupResult.success && lookupResult.contact) {
              const displayName = lookupResult.contact.displayName || '';
              const firstName = displayName.split(/\s+/)[0] || '';
              
              return {
                toolCallId: toolCall.id,
                result: JSON.stringify({
                  success: true,
                  isKnownCustomer: true,
                  firstName: firstName,
                  displayName: displayName,
                }),
              };
            }

            return {
              toolCallId: toolCall.id,
              result: JSON.stringify({
                success: true,
                isKnownCustomer: false,
                firstName: '',
              }),
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

    // Log unhandled request format for debugging - include full body for diagnosis
    console.log('UNHANDLED REQUEST - FULL BODY:', JSON.stringify(body, null, 2));
    
    // Fallback for direct API calls (non-VAPI)
    const { phone_number } = body;
    
    if (!phone_number) {
      // Return the FULL body so we can see exactly what VAPI sends
      return NextResponse.json(
        { 
          results: [{
            toolCallId: 'debug',
            result: JSON.stringify({
              success: false, 
              error: 'Unrecognized request format - see receivedBody',
              receivedBody: body,
            })
          }]
        },
        { status: 200, headers: corsHeaders }
      );
    }

    const result = await lookupByPhone(phone_number, freshsalesToken);
    return NextResponse.json(result, { headers: corsHeaders });

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
