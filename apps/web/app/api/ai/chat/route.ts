import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// System prompt for the fantasy AI assistant
const SYSTEM_PROMPT = `You are an expert fantasy sports AI assistant with deep knowledge of:
- Sports betting patterns and strategies
- Fantasy sports lineup optimization
- Player statistics and performance analysis
- Game predictions and odds
- Pattern detection (Back-to-Back Fade, Embarrassment Revenge, Altitude Advantage, etc.)

You provide specific, actionable advice with confidence levels and statistical backing.
Keep responses concise but informative. Use emojis sparingly for emphasis.
When discussing patterns, always mention accuracy rates and ROI when relevant.`;

/**
 * POST /api/ai/chat
 * Chat with the AI assistant using Anthropic Claude
 */
export async function POST(request: NextRequest) {
  try {
    const { messages, temperature = 0.7, maxTokens = 500 } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Anthropic API key not configured');
      
      // Return a helpful message instead of failing
      return NextResponse.json({
        role: 'assistant',
        content: 'I apologize, but I need to be configured with an Anthropic API key. Please add ANTHROPIC_API_KEY to your .env.local file. Visit https://console.anthropic.com/settings/keys to get your key.',
        error: true
      });
    }

    // Convert messages to Anthropic format
    const systemMessage = SYSTEM_PROMPT;
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Call Anthropic API
    const completion = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Using Claude 3 Opus for best quality
      system: systemMessage,
      messages: formattedMessages,
      max_tokens: maxTokens || 1000,
      temperature: temperature || 0.7
    });

    // Extract the text content
    const content = completion.content[0].type === 'text' 
      ? completion.content[0].text 
      : 'Sorry, I could not generate a response.';

    return NextResponse.json({
      role: 'assistant',
      content,
      usage: {
        prompt_tokens: completion.usage?.input_tokens,
        completion_tokens: completion.usage?.output_tokens,
        total_tokens: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0)
      }
    });

  } catch (error: any) {
    console.error('Anthropic API error:', error);

    // Handle specific Anthropic errors
    if (error?.status === 401) {
      return NextResponse.json({
        role: 'assistant',
        content: 'Authentication failed. Please check your Anthropic API key in .env.local.',
        error: true
      });
    }

    if (error?.status === 429) {
      return NextResponse.json({
        role: 'assistant',
        content: 'Rate limit exceeded. Please wait a moment and try again.',
        error: true
      });
    }

    if (error?.status === 400) {
      return NextResponse.json({
        role: 'assistant',
        content: 'Invalid request. Please check the message format.',
        error: true
      });
    }

    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat
 * Get information about the chat endpoint
 */
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  
  return NextResponse.json({
    endpoint: '/api/ai/chat',
    method: 'POST',
    description: 'Chat with the Fantasy AI assistant powered by Claude',
    configured: hasApiKey,
    model: 'claude-3-opus-20240229',
    provider: 'Anthropic',
    features: [
      'Fantasy sports advice',
      'Pattern analysis',
      'Lineup optimization tips',
      'Betting strategies',
      'Real-time game analysis'
    ],
    usage: {
      request: {
        messages: [
          { role: 'user', content: 'Your question here' }
        ],
        temperature: 0.7,
        maxTokens: 1000
      }
    },
    setup: hasApiKey ? 'Ready' : 'Add ANTHROPIC_API_KEY to .env.local'
  });
}