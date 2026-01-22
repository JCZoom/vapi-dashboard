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
  };
}

interface VapiMessage {
  type: string;
  toolCallList?: VapiToolCall[];
  toolWithToolCallList?: VapiToolWithToolCall[];
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
    
    // VAPI can send message at top level or nested
    const message: VapiMessage = body.message || body;

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

      // Return full transient assistant configuration (required when phone number has no fixed assistantId)
      return NextResponse.json({
        assistant: {
          firstMessage: personalizedGreeting,
          firstMessageMode: 'assistant-speaks-first',
          model: {
            provider: 'openai',
            model: 'gpt-4.1',
            toolIds: [
              '3129d2a0-23e4-4b31-bfa9-8809a1924a6d',
              '6cea30e0-8678-4614-af2b-92e38fd6e198',
            ],
            messages: [
              {
                role: 'system',
                content: `ROLE:\nYou are an "iPostal1 AI Customer Support Agent". Your PRIMARY mission is to thoroughly answer customer questions using your knowledge base. You are knowledgeable and helpful.\n\nPRIOR TO USING QUERY TOOL:\n- Say "Please wait one moment while I look into that for you" before using the query_tool_3 tool.\n\nCORE PRINCIPLE - ANSWER FIRST:\n- ALWAYS search the knowledge base and provide a complete, helpful answer BEFORE considering a transfer.\n- You have extensive knowledge about iPostal1 services, Form 1583, notarization, mail handling, account management, and policies.\n- When a customer asks "how do I..." or "what is the status of..." or "can you help with...", ANSWER THE QUESTION using your knowledge base.\n- Only transfer to an agent when you genuinely cannot help (e.g., the customer needs you to PERFORM an action on their account, not just EXPLAIN how something works).\n\nWHEN TO ANSWER (DO NOT TRANSFER):\n- Questions about how to do something (update business name, submit forms, etc.) → ANSWER with step-by-step instructions from knowledge base\n- Questions about Form 1583 status or process → ANSWER with information about the process and typical timelines\n- Questions about policies, fees, services → ANSWER from knowledge base\n- Questions about notarization options → ANSWER with the approved options\n- General "how does X work" questions → ANSWER thoroughly\n\nWHEN TO TRANSFER (ONLY THESE SITUATIONS):\n- Customer explicitly says "agent", "live agent", "speak to a person", "transfer me", "human"\n- Legal threats or safety concerns\n- Customer needs you to PERFORM an account action (not explain how to do it themselves)\n- After you have answered and the customer still needs additional help that requires account access\n\nCRITICAL RULE FOR NOTARIZATION QUESTIONS:\nWhen users ask about notarizing Form 1583, you MUST ONLY mention these 2 options:\n1. Online notary via proof.com ($25 fee)\n2. In person at their mail center location (if service is available)\nNEVER suggest: banks, post offices, UPS stores, personal notaries, or any other notary service.\n\nRESPONSE STYLE:\n- Be thorough and helpful - provide complete answers\n- Tone: empathetic, knowledgeable, confident\n- Do not mention "knowledge base" to the customer\n\nPROHIBITIONS:\n- Do NOT confirm account-specific data (approval status, specific dates, account numbers)\n- Do NOT collect sensitive data (card numbers, SSN, passwords)\n- Do NOT give legal advice\n- Do NOT invent information not in your knowledge base\n\nFALLBACK:\n- If the knowledge base does not have the answer, provide general guidance and THEN offer to connect to an agent for specifics\n- Say: "Based on what I know, [provide general answer]. Would you like me to connect you with an agent who can look into your specific account?"`,
              },
            ],
            maxTokens: 250,
            temperature: 0.2,
          },
          voice: {
            provider: '11labs',
            voiceId: 'TcAStCk0faGcHdNIFX23',
            model: 'eleven_turbo_v2_5',
            stability: 0.5,
            similarityBoost: 0.75,
          },
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
          },
        },
      }, { headers: corsHeaders });
    }

    // Handle VAPI tool call format (supports both VAPI native and OpenAI formats)
    if (message?.type === 'tool-calls' && (message.toolCallList || message.toolWithToolCallList)) {
      // Normalize tool calls from either format
      const toolCalls: VapiToolCall[] = message.toolCallList || 
        (message.toolWithToolCallList?.map((t) => ({ 
          id: t.toolCall?.id, 
          name: t.name,
          parameters: t.toolCall?.parameters 
        })) || []);
      
      const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
          // VAPI sends: { name, parameters } or { function: { name, arguments } }
          const toolName = toolCall.name || toolCall.function?.name;
          const toolArgs = toolCall.parameters || 
            (toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {});
          
          if (toolName === 'check_1583_status') {
            // Priority 1: Use provided phone number from arguments
            // Priority 2: Use caller's phone number from the call
            let phoneNumber = toolArgs.phone_number;
            
            if (!phoneNumber && message.call?.customer?.number) {
              phoneNumber = message.call.customer.number;
            }

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

    // Fallback for direct API calls (non-VAPI)
    const { phone_number } = body;
    
    if (!phone_number) {
      return NextResponse.json(
        { success: false, error: 'phone_number is required' },
        { status: 400, headers: corsHeaders }
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
