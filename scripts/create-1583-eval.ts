/**
 * Script to create an eval for testing the check_1583_status tool in VAPI
 * Run with: npx ts-node scripts/create-1583-eval.ts
 * 
 * Requires: VAPI_API_KEY environment variable
 */

const VAPI_EVAL_API_URL = 'https://api.vapi.ai';

interface JudgePlanAI {
  type: 'ai';
  model: {
    provider: 'openai';
    model: string;
    temperature: number;
    maxTokens: number;
    messages: Array<{ role: string; content: string }>;
  };
}

interface MockMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: Array<{ name: string; arguments?: Record<string, unknown> }>;
}

interface EvalMessage {
  role: 'assistant';
  judgePlan: JudgePlanAI;
}

interface CreateEvalPayload {
  type: 'chat.mockConversation';
  name: string;
  description: string;
  messages: Array<MockMessage | EvalMessage>;
}

async function createEval() {
  const apiKey = process.env.VAPI_API_KEY;

  if (!apiKey) {
    console.error('❌ VAPI_API_KEY environment variable is required');
    console.log('   Set it with: export VAPI_API_KEY=your_key_here');
    process.exit(1);
  }

  // Helper to create AI judge plan
  const createJudgePlan = (criteria: string): JudgePlanAI => ({
    type: 'ai',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 100,
      messages: [
        {
          role: 'system',
          content: `You are evaluating an AI assistant's response. Respond with only "pass" or "fail".

Evaluation criteria: ${criteria}

The conversation so far is provided in {{messages}}. The assistant's response to evaluate is the last message: {{messages[-1]}}`,
        },
      ],
    },
  });

  // Eval 1: Test "Approved" status response
  const eval1: CreateEvalPayload = {
    type: 'chat.mockConversation',
    name: '1583 Status Check - Approved Status',
    description: 'Verifies the assistant responds correctly when status is Approved',
    messages: [
      {
        role: 'user',
        content: "Hi, I'd like to check on my 1583 status please.",
      },
      {
        role: 'assistant',
        content: 'One moment please while I check your 1583 approval status.',
        toolCalls: [
          {
            name: 'check_1583_status',
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({
          success: true,
          contact: {
            displayName: 'John Doe',
            mailboxId: '12345',
            approvalStatus: 'Approved',
            flaggedForResubmission: 'No',
            belongsTo: '',
            tags: [],
          },
        }),
      },
      {
        role: 'assistant',
        judgePlan: createJudgePlan('The assistant should tell the customer that their 1583 form has been APPROVED. The response should be friendly, positive, and congratulatory.'),
      },
    ],
  };

  // Eval 2: Test "Pending" status response
  const eval2: CreateEvalPayload = {
    type: 'chat.mockConversation',
    name: '1583 Status Check - Pending Status',
    description: 'Verifies the assistant responds correctly when status is Pending',
    messages: [
      {
        role: 'user',
        content: "What's the status of my 1583 form?",
      },
      {
        role: 'assistant',
        content: 'One moment please while I check your 1583 approval status.',
        toolCalls: [
          {
            name: 'check_1583_status',
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({
          success: true,
          contact: {
            displayName: 'Jane Smith',
            mailboxId: '67890',
            approvalStatus: 'Pending',
            flaggedForResubmission: 'No',
            belongsTo: '',
            tags: [],
          },
        }),
      },
      {
        role: 'assistant',
        judgePlan: createJudgePlan('The assistant should inform the customer that their 1583 form is PENDING review. Should be reassuring.'),
      },
    ],
  };

  // Eval 3: Test phone number request flow
  const eval3: CreateEvalPayload = {
    type: 'chat.mockConversation',
    name: '1583 Status Check - Phone Number Request',
    description: 'Verifies the assistant asks for phone number when initial lookup fails',
    messages: [
      {
        role: 'user',
        content: 'Can you check my account status?',
      },
      {
        role: 'assistant',
        content: 'One moment please while I check your account.',
        toolCalls: [
          {
            name: 'check_1583_status',
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({
          success: false,
          error: 'No contact found with the provided phone number',
          needsPhoneNumber: true,
        }),
      },
      {
        role: 'assistant',
        judgePlan: createJudgePlan('The assistant should ask the customer for their phone number since the automatic lookup failed. Should be polite and explain the issue.'),
      },
    ],
  };

  const evals = [eval1, eval2, eval3];

  console.log('📤 Creating evals in VAPI...\n');

  for (const evalPayload of evals) {
    try {
      const response = await fetch(`${VAPI_EVAL_API_URL}/eval`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evalPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ Failed to create eval "${evalPayload.name}":`, errorData);
        continue;
      }

      const result = await response.json();
      console.log(`✅ Created: ${evalPayload.name}`);
      console.log(`   ID: ${result.id}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Error creating eval "${evalPayload.name}":`, error);
    }
  }

  console.log('📋 Next steps:');
  console.log('1. Go to VAPI Dashboard > Evals');
  console.log('2. Select an assistant to test with');
  console.log('3. Run the evals to verify the tool is working');
}

createEval();
