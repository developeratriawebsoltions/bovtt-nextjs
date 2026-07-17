import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = "process.env.WHATSAPP_TOKEN";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const mediaId = (await params).id;

  if (!mediaId) {
    return new NextResponse('Media ID required', { status: 400 });
  }

  try {
    // Get media URL from WhatsApp
    const mediaUrl = `https://graph.facebook.com/v25.0/${mediaId}`;
    const response = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Media fetch error:', error);
      return new NextResponse('Failed to fetch media', { status: response.status });
    }

    const mediaData = await response.json();
    
    if (!mediaData.url) {
      return new NextResponse('Media URL not found', { status: 404 });
    }

    // Fetch the actual media file
    const mediaResponse = await fetch(mediaData.url, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      }
    });

    if (!mediaResponse.ok) {
      return new NextResponse('Failed to download media', { status: mediaResponse.status });
    }

    const buffer = await mediaResponse.arrayBuffer();
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mediaData.mime_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error: any) {
    console.error('Media proxy error:', error);
    return new NextResponse('Error fetching media', { status: 500 });
  }
}