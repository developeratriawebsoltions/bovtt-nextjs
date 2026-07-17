// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_URL = process.env.WEBHOOK_PROXY_URL || 'https://bovttwebhook.atriatestingsite.com/webhook.php';

export async function GET(request: NextRequest) {
  // Forward verification to PHP webhook
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  
  return new NextResponse('Verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward to PHP webhook
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });
    
    const data = await response.text();
    return new NextResponse(data, { status: response.status });
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}