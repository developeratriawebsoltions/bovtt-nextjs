// app/api/upload-whatsapp-media/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Upload to WhatsApp
    const uploadFormData = new FormData();
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = new Blob([buffer], { type: file.type });
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('messaging_product', 'whatsapp');
    uploadFormData.append('type', file.type);
    
    const uploadUrl = `https://graph.facebook.com/v18.0/${PHONE_ID}/media`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: uploadFormData
    });
    
    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: uploadResult.error?.message || 'Failed to upload media' 
      }, { status: uploadResponse.status });
    }
    
    return NextResponse.json({ 
      success: true, 
      media_id: uploadResult.id 
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}