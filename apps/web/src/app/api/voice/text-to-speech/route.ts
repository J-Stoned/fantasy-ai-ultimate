/**
 * Text-to-Speech API endpoint using 11Labs
 * Provides natural voice responses for Hey Fantasy
 */

import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // Default voice

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // If no API key, return success without audio (fallback to browser TTS)
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Using browser text-to-speech (11Labs API key not configured)',
        audioUrl: null
      })
    }

    // Call 11Labs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('11Labs API error:', error)
      throw new Error('Failed to generate speech')
    }

    // Get audio data
    const audioBuffer = await response.arrayBuffer()
    
    // Convert to base64 for easier client handling
    const base64Audio = Buffer.from(audioBuffer).toString('base64')
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`

    return NextResponse.json({
      success: true,
      audioUrl,
      voiceId: voiceId || VOICE_ID
    })
  } catch (error: any) {
    console.error('Text-to-speech error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate speech',
        details: error.message,
        fallback: 'Use browser text-to-speech'
      },
      { status: 500 }
    )
  }
}