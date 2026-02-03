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

interface VapiServerMessage {
  message: {
    type: string;
    call?: {
      customer?: {
        number?: string;
      };
    };
  };
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
