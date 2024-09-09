import { NextResponse } from 'next/server';
import { textToSpeech } from '@/services/tts';

export async function POST(request: Request) {
  const { text } = await request.json();

  try {
    const buffer = await textToSpeech(text);
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}