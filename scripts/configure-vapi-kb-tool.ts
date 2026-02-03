#!/usr/bin/env npx ts-node
/**
 * Configure VAPI Assistant with Custom KB Search Tool
 * 
 * This script:
 * 1. Creates the search_knowledge_base function tool in VAPI
 * 2. Updates the assistant to use the new tool instead of the slow Gemini query tool
 * 
 * Usage:
 *   VAPI_API_KEY=xxx KB_SEARCH_URL=https://xxx.lambda-url.us-east-2.on.aws/ npx ts-node configure-vapi-kb-tool.ts
 * 
 * Environment Variables:
 *   VAPI_API_KEY - Your VAPI API key
 *   KB_SEARCH_URL - URL of the deployed KB search Lambda
 *   ASSISTANT_ID - (optional) Override default assistant ID
 */

import * as fs from 'fs';
import * as path from 'path';

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const KB_SEARCH_URL = process.env.KB_SEARCH_URL;
const ASSISTANT_ID = process.env.ASSISTANT_ID || '756e9d05-80e3-4922-99a5-928277d93206';
const OLD_QUERY_TOOL_ID = '3129d2a0-23e4-4b31-bfa9-8809a1924a6d'; // Gemini tool to replace

const VAPI_BASE_URL = 'https://api.vapi.ai';

interface VapiTool {
  id?: string;
  type: string;
  function?: {
    name: string;
    description: string;
    parameters: object;
  };
  server?: {
    url: string;
  };
  async?: boolean;
  messages?: Array<{
    type: string;
    content: string;
  }>;
}

interface VapiAssistant {
  id: string;
  name: string;
  model: object;
  tools?: VapiTool[];
  toolIds?: string[];
}

async function vapiRequest(endpoint: string, method: string = 'GET', body?: object): Promise<any> {
  const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VAPI API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function createKBSearchTool(): Promise<string> {
  console.log('📦 Creating KB search function tool...');

  // Load tool definition from JSON file
  const toolDefPath = path.join(__dirname, '../lib/vapi-tool-definitions/search-knowledge-base.json');
  const toolDef = JSON.parse(fs.readFileSync(toolDefPath, 'utf-8'));

  // Replace placeholder with actual URL
  toolDef.server.url = KB_SEARCH_URL;

  // Create the tool in VAPI
  const tool = await vapiRequest('/tool', 'POST', toolDef);
  
  console.log(`   ✅ Tool created: ${tool.id}`);
  console.log(`   Name: ${tool.function?.name}`);
  console.log(`   URL: ${tool.server?.url}`);
  
  return tool.id;
}

async function getAssistant(): Promise<VapiAssistant> {
  console.log(`\n🤖 Fetching assistant ${ASSISTANT_ID}...`);
  const assistant = await vapiRequest(`/assistant/${ASSISTANT_ID}`);
  console.log(`   Name: ${assistant.name}`);
  console.log(`   Current tools: ${assistant.toolIds?.length || 0}`);
  return assistant;
}

async function updateAssistantTools(toolId: string): Promise<void> {
  console.log('\n🔧 Updating assistant tools...');

  // Get current assistant
  const assistant = await getAssistant();
  
  // Get current tool IDs, remove old query tool, add new KB search tool
  let toolIds = assistant.toolIds || [];
  
  // Remove old Gemini query tool if present
  const oldToolIndex = toolIds.indexOf(OLD_QUERY_TOOL_ID);
  if (oldToolIndex > -1) {
    toolIds.splice(oldToolIndex, 1);
    console.log(`   Removed old query tool: ${OLD_QUERY_TOOL_ID}`);
  }
  
  // Add new KB search tool if not already present
  if (!toolIds.includes(toolId)) {
    toolIds.push(toolId);
    console.log(`   Added new KB search tool: ${toolId}`);
  }

  // Update assistant
  await vapiRequest(`/assistant/${ASSISTANT_ID}`, 'PATCH', {
    toolIds: toolIds
  });

  console.log(`   ✅ Assistant updated with ${toolIds.length} tools`);
}

async function testKBSearch(): Promise<void> {
  console.log('\n🧪 Testing KB search endpoint...');
  
  try {
    const response = await fetch(KB_SEARCH_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'how do I forward my mail?' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log(`   ✅ Search working: ${data.count || data.results?.length || 0} results`);
    console.log(`   Response time: ${data.time_ms || 'N/A'}ms`);
  } catch (error) {
    console.log(`   ⚠️  Search test failed: ${error}`);
    console.log('   Continuing anyway - tool will be created but may need debugging');
  }
}

async function main(): Promise<void> {
  console.log('=== VAPI KB Tool Configuration ===\n');

  // Validate environment
  if (!VAPI_API_KEY) {
    console.error('❌ VAPI_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!KB_SEARCH_URL) {
    console.error('❌ KB_SEARCH_URL environment variable not set');
    console.error('   Deploy the Lambda first: ./aws/scripts/deploy-kb-search-lambda.sh');
    process.exit(1);
  }

  console.log(`Assistant ID: ${ASSISTANT_ID}`);
  console.log(`KB Search URL: ${KB_SEARCH_URL}`);

  // Test the KB search endpoint first
  await testKBSearch();

  // Create the tool in VAPI
  const toolId = await createKBSearchTool();

  // Update the assistant to use the new tool
  await updateAssistantTools(toolId);

  console.log('\n=== Configuration Complete ===');
  console.log(`
Next steps:
1. Test the voice bot - ask an iPostal1 question
2. Check call logs for tool usage
3. Monitor response times (target: <2s)

Tool ID: ${toolId}
Save this ID - you can use it to update or delete the tool later.
  `);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
