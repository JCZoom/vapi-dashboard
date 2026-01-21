import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const VAPI_BASE_URL = 'https://api.vapi.ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { question, assistantId } = body;

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    if (!assistantId) {
      return NextResponse.json(
        { error: 'Assistant ID is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${VAPI_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId,
        input: question,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to get response from assistant' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract the LAST assistant text response (not tool calls)
    const output = data.output || [];
    const assistantResponses = output.filter(
      (msg: { role: string; content?: string; tool_calls?: unknown }) => 
        msg.role === 'assistant' && msg.content && !msg.tool_calls
    );
    const lastAssistantResponse = assistantResponses[assistantResponses.length - 1];
    
    // Also capture any tool errors for debugging
    const toolErrors = output
      .filter((msg: { role: string; content?: string }) => 
        msg.role === 'tool' && msg.content?.includes('error'))
      .map((msg: { content: string }) => msg.content);
    
    return NextResponse.json({
      chatId: data.id,
      question,
      answer: lastAssistantResponse?.content || 'No response received',
      toolErrors: toolErrors.length > 0 ? toolErrors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('QA test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run QA test' },
      { status: 500 }
    );
  }
}
