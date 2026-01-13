/**
 * Script to create the check_1583_status tool in VAPI
 * Run with: npx ts-node scripts/create-1583-status-tool.ts
 * 
 * Before running, set your environment variables:
 * - VAPI_API_KEY: Your VAPI API key
 * - SERVER_URL: Your deployed server URL (e.g., https://your-app.vercel.app)
 */

const VAPI_API_URL = 'https://api.vapi.ai';

interface CreateToolPayload {
  type: 'function';
  async: boolean;
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
  server: {
    url: string;
    timeoutSeconds: number;
  };
  messages: Array<{
    type: 'request-start' | 'request-complete' | 'request-failed';
    content: string;
  }>;
}

async function createTool() {
  const apiKey = process.env.VAPI_API_KEY;
  const serverUrl = process.env.SERVER_URL;

  if (!apiKey) {
    console.error('❌ VAPI_API_KEY environment variable is required');
    console.log('   Set it with: export VAPI_API_KEY=your_key_here');
    process.exit(1);
  }

  if (!serverUrl) {
    console.error('❌ SERVER_URL environment variable is required');
    console.log('   Set it with: export SERVER_URL=https://your-app.vercel.app');
    process.exit(1);
  }

  const toolPayload: CreateToolPayload = {
    type: 'function',
    async: false,
    function: {
      name: 'check_1583_status',
      description: `Check the customer's USPS 1583 form approval status by looking up their account using their phone number. 
      
The tool automatically tries the caller's phone number first. If that doesn't find a match, it will indicate that a phone number is needed and you should ask the customer for their phone number.

IMPORTANT: Call this tool WITHOUT arguments first to try the caller's phone. Only provide phone_number if the first call returns needsPhoneNumber: true.`,
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: "The customer's phone number to look up. Can be in any format: +19092601366, 19092601366, 9092601366, (909) 260-1366, etc. If not provided, the system will automatically try to use the caller's phone number.",
          },
        },
        required: [],
      },
    },
    server: {
      url: `${serverUrl}/api/vapi/tools/freshsales-lookup`,
      timeoutSeconds: 30,
    },
    messages: [
      {
        type: 'request-start',
        content: 'One moment please while I check your 1583 approval status.',
      },
      {
        type: 'request-complete',
        content: '', // Empty - the assistant will respond based on the result
      },
      {
        type: 'request-failed',
        content: "I'm sorry, I'm having trouble looking up your account right now. Let me transfer you to a team member who can help.",
      },
    ],
  };

  console.log('📤 Creating tool in VAPI...');
  console.log(`   Server URL: ${toolPayload.server.url}`);

  try {
    const response = await fetch(`${VAPI_API_URL}/tool`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toolPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Failed to create tool:', errorData);
      process.exit(1);
    }

    const tool = await response.json();
    console.log('✅ Tool created successfully!');
    console.log('');
    console.log('Tool ID:', tool.id);
    console.log('Tool Name:', tool.function?.name);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Go to VAPI Dashboard > Assistants');
    console.log('2. Edit your assistant and add this tool');
    console.log('3. Update the system prompt with the workflow instructions');
    console.log('');
    console.log('Tool details:', JSON.stringify(tool, null, 2));

    return tool;
  } catch (error) {
    console.error('❌ Error creating tool:', error);
    process.exit(1);
  }
}

createTool();
